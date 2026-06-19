import { EncryptedPayload, encryptBytes, decryptBytes } from '../crypto/e2eCrypto';

export interface TurnConfig {
  urls: string[];
  username: string;
  credential: string;
  iceTransportPolicy: RTCIceTransportPolicy;
}

export interface CallSessionOptions {
  turn: TurnConfig;
  onRemoteStream: (stream: MediaStream) => void;
  onStateChange: (state: RTCPeerConnectionState) => void;
  onIceCandidate: (candidate: RTCIceCandidateInit) => void;
}

export interface ManagedPeerConnection {
  pc: RTCPeerConnection;
  setRemoteDescription: (desc: RTCSessionDescriptionInit) => Promise<void>;
  addIceCandidate: (candidate: RTCIceCandidateInit) => Promise<void>;
  close: () => void;
}

export const createCallPeerConnection = ({
  turn,
  onRemoteStream,
  onStateChange,
  onIceCandidate,
}: CallSessionOptions): ManagedPeerConnection => {
  const iceServers =
    turn.username && turn.credential
      ? [{ urls: turn.urls, username: turn.username, credential: turn.credential }]
      : [{ urls: turn.urls }];

  const pc = new RTCPeerConnection({
    iceTransportPolicy: turn.iceTransportPolicy,
    iceServers,
  });

  const pendingCandidates: RTCIceCandidateInit[] = [];
  let remoteDescriptionSet = false;

  const flushCandidates = async () => {
    const queue = pendingCandidates.splice(0, pendingCandidates.length);
    for (const candidate of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // ICE can arrive late; ignore non-fatal errors
      }
    }
  };

  pc.ontrack = (event) => {
    if (event.streams[0]) onRemoteStream(event.streams[0]);
  };

  pc.onconnectionstatechange = () => onStateChange(pc.connectionState);

  pc.onicecandidate = (event) => {
    if (event.candidate) onIceCandidate(event.candidate.toJSON());
  };

  return {
    pc,
    async setRemoteDescription(desc) {
      await pc.setRemoteDescription(desc);
      remoteDescriptionSet = true;
      await flushCandidates();
    },
    async addIceCandidate(candidate) {
      if (remoteDescriptionSet) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {
          // ignore
        }
      } else {
        pendingCandidates.push(candidate);
      }
    },
    close() {
      pc.close();
    },
  };
};

export const attachLocalMedia = async (
  managed: ManagedPeerConnection,
  video: boolean
): Promise<MediaStream> => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
  stream.getTracks().forEach((track) => managed.pc.addTrack(track, stream));
  return stream;
};

export const encryptSignal = (key: CryptoKey, data: object) =>
  encryptBytes(key, new TextEncoder().encode(JSON.stringify(data)).buffer);

export const decryptSignal = async (key: CryptoKey, payload: EncryptedPayload) => {
  const buffer = await decryptBytes(key, payload);
  return JSON.parse(new TextDecoder().decode(buffer));
};

export const stopMediaStream = (stream: MediaStream | null) => {
  stream?.getTracks().forEach((t) => t.stop());
};

export const addEncryptedIceCandidate = async (
  managed: ManagedPeerConnection,
  encryptedCandidate: EncryptedPayload,
  key: CryptoKey
) => {
  const candidate = await decryptSignal(key, encryptedCandidate);
  if (candidate?.candidate) {
    await managed.addIceCandidate(candidate);
  }
};

export const signalModeFromOffer = (signal: { mode?: string; sdp?: RTCSessionDescriptionInit }) => {
  if (signal.mode === 'video' || signal.mode === 'audio') return signal.mode;
  const sdp = signal.sdp?.sdp || '';
  return sdp.includes('m=video') ? 'video' : 'audio';
};
