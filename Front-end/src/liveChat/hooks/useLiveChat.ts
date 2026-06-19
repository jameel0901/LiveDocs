import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { authFetch, getStoredUser } from '../../api';
import { SOCKET_URL } from '../../config';
import {
  decryptText,
  encryptFile,
  encryptText,
  LiveChatKeyPair,
  decryptFile,
  EncryptedPayload,
  generateConversationKey,
  wrapKeyForPeer,
  unwrapKeyFromPeer,
} from '../crypto/e2eCrypto';
import { deriveDirectConversationKey } from '../crypto/identityStore';
import {
  attachLocalMedia,
  createCallPeerConnection,
  decryptSignal,
  encryptSignal,
  stopMediaStream,
  addEncryptedIceCandidate,
  signalModeFromOffer,
  ManagedPeerConnection,
  TurnConfig,
} from '../webrtc/callManager';
import {
  CallMode,
  CallState,
  LiveChatConversation,
  LiveChatMessage,
  LiveChatPeer,
  LiveChatUser,
  TurnCredentials,
} from '../types';

const initialCallState: CallState = {
  phase: 'idle',
  mode: 'audio',
  sessionHash: null,
  peerIdentityHash: null,
  localStream: null,
  remoteStream: null,
  muted: false,
  cameraOff: false,
};

interface StoredMessage {
  messageId: string;
  senderIdentityHash: string;
  ciphertext: string;
  nonce: string;
  payloadType?: string;
  createdAt?: string;
}

const revokeMessageUrls = (msgs: LiveChatMessage[]) => {
  msgs.forEach((m) => {
    if (m.fileUrl?.startsWith('blob:')) URL.revokeObjectURL(m.fileUrl);
  });
};

export const useLiveChat = (keyPair: LiveChatKeyPair | null, myAlias: string) => {
  const [users, setUsers] = useState<LiveChatUser[]>([]);
  const [conversations, setConversations] = useState<LiveChatConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<LiveChatConversation | null>(null);
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [callPeer, setCallPeer] = useState<LiveChatPeer | null>(null);
  const [conversationKey, setConversationKey] = useState<CryptoKey | null>(null);
  const [connected, setConnected] = useState(false);
  const [callState, setCallState] = useState<CallState>(initialCallState);
  const [loadingChat, setLoadingChat] = useState(false);
  const [turnAvailable, setTurnAvailable] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const socketReadyRef = useRef(false);
  const keyRef = useRef<CryptoKey | null>(null);
  const activeConvRef = useRef<LiveChatConversation | null>(null);
  const joinedConvRef = useRef<string | null>(null);
  const openRequestRef = useRef(0);
  const userMapRef = useRef<Map<string, string>>(new Map());
  const managedPcRef = useRef<ManagedPeerConnection | null>(null);
  const turnRef = useRef<TurnConfig | null>(null);
  const pendingOfferRef = useRef<EncryptedPayload | null>(null);
  const pendingIceRef = useRef<
    Array<{ sessionHash: string; encryptedCandidate: EncryptedPayload }>
  >([]);
  const callKeyRef = useRef<CryptoKey | null>(null);
  const callSessionRef = useRef<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    keyRef.current = conversationKey;
  }, [conversationKey]);

  useEffect(() => {
    activeConvRef.current = activeConversation;
  }, [activeConversation]);

  const refreshUserMap = useCallback(
    (list: LiveChatUser[]) => {
      const map = new Map<string, string>();
      list.forEach((u) => map.set(u.identityHash, u.displayAlias));
      if (keyPair) map.set(keyPair.identityHash, myAlias);
      userMapRef.current = map;
    },
    [keyPair, myAlias]
  );

  const loadUsers = useCallback(async () => {
    const res = await authFetch('/livechat/users');
    if (!res.ok) return;
    const list: LiveChatUser[] = await res.json();
    setUsers(list);
    refreshUserMap(list);
  }, [refreshUserMap]);

  const loadConversations = useCallback(async () => {
    const res = await authFetch('/livechat/conversations');
    if (!res.ok) return;
    const list: LiveChatConversation[] = await res.json();
    setConversations(list);
  }, []);

  const joinConversationRoom = useCallback(
    (conversationId: string): Promise<boolean> =>
      new Promise((resolve) => {
        const tryJoin = (attemptsLeft: number) => {
          if (!socketRef.current || !socketReadyRef.current) {
            if (attemptsLeft > 0) {
              setTimeout(() => tryJoin(attemptsLeft - 1), 150);
            } else {
              resolve(false);
            }
            return;
          }

          if (joinedConvRef.current && joinedConvRef.current !== conversationId) {
            socketRef.current.emit('livechat-leave-conversation', {
              conversationId: joinedConvRef.current,
            });
          }

          socketRef.current.emit(
            'livechat-join-conversation',
            { conversationId },
            (res: { ok: boolean }) => {
              if (res?.ok) {
                joinedConvRef.current = conversationId;
                resolve(true);
              } else if (attemptsLeft > 0) {
                setTimeout(() => tryJoin(attemptsLeft - 1), 150);
              } else {
                resolve(false);
              }
            }
          );
        };
        tryJoin(8);
      }),
    []
  );

  const teardownCall = useCallback(() => {
    stopMediaStream(localStreamRef.current);
    localStreamRef.current = null;
    managedPcRef.current?.close();
    managedPcRef.current = null;
    pendingOfferRef.current = null;
    pendingIceRef.current = [];
    callKeyRef.current = null;
    callSessionRef.current = null;
    setCallState(initialCallState);
  }, []);

  const decryptStoredMessage = useCallback(
    async (stored: StoredMessage, key: CryptoKey): Promise<LiveChatMessage | null> => {
      const outgoing = stored.senderIdentityHash === keyPair?.identityHash;
      const senderName = userMapRef.current.get(stored.senderIdentityHash) || 'Unknown';
      const encrypted: EncryptedPayload = {
        ciphertext: stored.ciphertext,
        nonce: stored.nonce,
      };

      try {
        if (stored.payloadType === 'file') {
          const parsed = JSON.parse(await decryptText(key, encrypted));
          const { name, blob } = await decryptFile(key, parsed.meta, parsed.payload);
          return {
            id: stored.messageId,
            kind: 'file',
            fileName: name,
            fileUrl: URL.createObjectURL(blob),
            mimeType: parsed.meta.mimeType,
            status: 'delivered',
            timestamp: stored.createdAt ? new Date(stored.createdAt).getTime() : Date.now(),
            outgoing,
            senderName: outgoing ? undefined : senderName,
          };
        }

        const text = await decryptText(key, encrypted);
        return {
          id: stored.messageId,
          kind: 'text',
          text,
          status: 'delivered',
          timestamp: stored.createdAt ? new Date(stored.createdAt).getTime() : Date.now(),
          outgoing,
          senderName: outgoing ? undefined : senderName,
        };
      } catch {
        return {
          id: stored.messageId,
          kind: 'system',
          text: '[Unable to decrypt message]',
          status: 'delivered',
          timestamp: stored.createdAt ? new Date(stored.createdAt).getTime() : Date.now(),
          outgoing,
        };
      }
    },
    [keyPair]
  );

  const resolveConversationKey = useCallback(
    async (conversation: LiveChatConversation): Promise<CryptoKey | null> => {
      if (!keyPair) return null;

      if (conversation.type === 'direct') {
        const otherHash = conversation.participants.find((p) => p !== keyPair.identityHash);
        if (!otherHash) return null;
        const res = await authFetch(`/livechat/identity/${otherHash}`);
        if (!res.ok) return null;
        const peer: LiveChatPeer = await res.json();
        setCallPeer(peer);
        return deriveDirectConversationKey(keyPair, peer.publicKeyJwk);
      }

      const myEnvelope = conversation.groupKeyEnvelopes?.find(
        (e) => e.identityHash === keyPair.identityHash
      );
      if (!myEnvelope) return null;

      const creatorRes = await authFetch(`/livechat/identity/${conversation.createdBy}`);
      if (!creatorRes.ok) return null;
      const creator: LiveChatPeer = await creatorRes.json();
      return unwrapKeyFromPeer(
        { ciphertext: myEnvelope.ciphertext, nonce: myEnvelope.nonce },
        keyPair.privateKey,
        creator.publicKeyJwk
      );
    },
    [keyPair]
  );

  const openConversation = useCallback(
    async (conversation: LiveChatConversation) => {
      if (!keyPair) return;
      const requestId = ++openRequestRef.current;
      setLoadingChat(true);
      setActiveConversation(conversation);
      setMessages((prev) => {
        revokeMessageUrls(prev);
        return [];
      });

      try {
        const key = await resolveConversationKey(conversation);
        if (!key) throw new Error('Could not unlock conversation key');
        if (requestId !== openRequestRef.current) return;

        setConversationKey(key);
        await joinConversationRoom(conversation.conversationId);

        const res = await authFetch(
          `/livechat/conversations/${conversation.conversationId}/messages`
        );
        if (requestId !== openRequestRef.current) return;

        if (res.ok) {
          const stored: StoredMessage[] = await res.json();
          const decrypted = await Promise.all(stored.map((m) => decryptStoredMessage(m, key)));
          if (requestId === openRequestRef.current) {
            setMessages(decrypted.filter(Boolean) as LiveChatMessage[]);
          }
        }
      } catch {
        if (requestId === openRequestRef.current) {
          setMessages([
            {
              id: crypto.randomUUID(),
              kind: 'system',
              text: 'Could not open this conversation.',
              status: 'delivered',
              timestamp: Date.now(),
              outgoing: false,
            },
          ]);
        }
      } finally {
        if (requestId === openRequestRef.current) setLoadingChat(false);
      }
    },
    [keyPair, resolveConversationKey, decryptStoredMessage, joinConversationRoom]
  );

  const handleInbound = useCallback(
    async (payload: StoredMessage & { conversationId: string }) => {
      const active = activeConvRef.current;
      if (!active || payload.conversationId !== active.conversationId) {
        loadConversations();
        return;
      }

      const key = keyRef.current;
      if (!key) return;

      const msg = await decryptStoredMessage(payload, key);
      if (!msg) return;

      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });

      socketRef.current?.emit('livechat-delivered', {
        conversationId: payload.conversationId,
        messageId: payload.messageId,
      });
    },
    [decryptStoredMessage, loadConversations]
  );

  const flushPendingIce = useCallback(async () => {
    const managed = managedPcRef.current;
    const callKey = callKeyRef.current;
    const session = callSessionRef.current;
    if (!managed || !callKey || !session) return;

    const pending = pendingIceRef.current.filter((p) => p.sessionHash === session);
    pendingIceRef.current = pendingIceRef.current.filter((p) => p.sessionHash !== session);

    for (const item of pending) {
      await addEncryptedIceCandidate(managed, item.encryptedCandidate, callKey);
    }
  }, []);

  const emitIce = useCallback(
    (sessionHash: string, candidate: RTCIceCandidateInit, targetIdentityHash: string) => {
      const key = callKeyRef.current;
      if (!key) return;
      encryptSignal(key, candidate).then((encryptedCandidate) => {
        socketRef.current?.emit('livechat-call-ice', {
          sessionHash,
          encryptedCandidate,
          targetIdentityHash,
        });
      });
    },
    []
  );

  const fetchTurn = useCallback(async (): Promise<TurnConfig> => {
    const res = await authFetch('/livechat/turn-credentials');
    const data: TurnCredentials = res.ok
      ? await res.json()
      : {
          urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
          username: '',
          credential: '',
          ttl: 3600,
          iceTransportPolicy: 'all',
          turnAvailable: false,
        };
    setTurnAvailable(!!data.turnAvailable);
    const config: TurnConfig = {
      urls: data.urls,
      username: data.username,
      credential: data.credential,
      iceTransportPolicy: data.iceTransportPolicy || 'all',
    };
    turnRef.current = config;
    return config;
  }, []);

  useEffect(() => {
    if (!keyPair) return undefined;
    const user = getStoredUser();
    if (!user?.token) return undefined;

    fetchTurn();

    const socket = io(SOCKET_URL, { auth: { token: user.token } });
    socketRef.current = socket;
    socketReadyRef.current = false;

    const onIncomingCall = async ({
      sessionHash,
      encryptedSignal,
      fromIdentityHash,
    }: {
      sessionHash: string;
      encryptedSignal: EncryptedPayload;
      fromIdentityHash: string;
    }) => {
      try {
        const res = await authFetch(`/livechat/identity/${fromIdentityHash}`);
        if (!res.ok) return;
        const peer: LiveChatPeer = await res.json();
        const callKey = await deriveDirectConversationKey(keyPair, peer.publicKeyJwk);
        callKeyRef.current = callKey;
        pendingOfferRef.current = encryptedSignal;
        callSessionRef.current = sessionHash;
        setCallPeer(peer);

        let mode: CallMode = 'audio';
        try {
          const signal = await decryptSignal(callKey, encryptedSignal);
          mode = signalModeFromOffer(signal) as CallMode;
        } catch {
          // default audio
        }

        setCallState((s) => ({
          ...s,
          phase: 'incoming',
          mode,
          sessionHash,
          peerIdentityHash: fromIdentityHash,
        }));
      } catch {
        // ignore malformed call
      }
    };

    const onCallAnswer = async ({
      sessionHash,
      encryptedSignal,
    }: {
      sessionHash: string;
      encryptedSignal: EncryptedPayload;
    }) => {
      if (sessionHash !== callSessionRef.current) return;
      const managed = managedPcRef.current;
      const callKey = callKeyRef.current;
      if (!managed || !callKey) return;

      const signal = await decryptSignal(callKey, encryptedSignal);
      if (signal?.sdp) {
        await managed.setRemoteDescription(signal.sdp);
        await flushPendingIce();
        setCallState((s) => (s.sessionHash === sessionHash ? { ...s, phase: 'connecting' } : s));
      }
    };

    const onCallIce = async ({
      sessionHash,
      encryptedCandidate,
    }: {
      sessionHash: string;
      encryptedCandidate: EncryptedPayload;
    }) => {
      if (sessionHash !== callSessionRef.current) return;
      const managed = managedPcRef.current;
      const callKey = callKeyRef.current;

      if (!managed || !callKey) {
        pendingIceRef.current.push({ sessionHash, encryptedCandidate });
        return;
      }

      await addEncryptedIceCandidate(managed, encryptedCandidate, callKey);
    };

    const onCallRejected = () => teardownCall();
    const onCallEnded = () => teardownCall();

    socket.on('connect', () => {
      socket.emit('livechat-register-socket', {}, (res: { ok: boolean }) => {
        if (res?.ok) {
          socketReadyRef.current = true;
          setConnected(true);
          loadUsers();
          loadConversations();
        }
      });
    });

    socket.on('livechat-inbound', handleInbound);
    socket.on('livechat-delivered', ({
      messageId,
      conversationId,
    }: {
      messageId: string;
      conversationId?: string;
    }) => {
      if (conversationId && activeConvRef.current?.conversationId !== conversationId) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, status: 'delivered' } : m))
      );
    });
    socket.on('livechat-call-incoming', onIncomingCall);
    socket.on('livechat-call-answer', onCallAnswer);
    socket.on('livechat-call-ice', onCallIce);
    socket.on('livechat-call-rejected', onCallRejected);
    socket.on('livechat-call-ended', onCallEnded);

    return () => {
      socket.off('livechat-inbound', handleInbound);
      socket.off('livechat-call-incoming', onIncomingCall);
      socket.off('livechat-call-answer', onCallAnswer);
      socket.off('livechat-call-ice', onCallIce);
      socket.off('livechat-call-rejected', onCallRejected);
      socket.off('livechat-call-ended', onCallEnded);
      socket.disconnect();
      socketRef.current = null;
      socketReadyRef.current = false;
    };
  }, [keyPair, handleInbound, loadUsers, loadConversations, fetchTurn, flushPendingIce, teardownCall]);

  const startDirectChat = useCallback(
    async (target: LiveChatUser) => {
      const res = await authFetch('/livechat/conversations/direct', {
        method: 'POST',
        body: JSON.stringify({ targetIdentityHash: target.identityHash }),
      });
      if (!res.ok) throw new Error('Could not start chat');
      const conversation: LiveChatConversation = await res.json();
      await loadConversations();
      await openConversation(conversation);
    },
    [loadConversations, openConversation]
  );

  const createGroup = useCallback(
    async (name: string, members: LiveChatUser[]) => {
      if (!keyPair) return;
      if (members.length === 0) throw new Error('Select at least one member');

      const groupKey = await generateConversationKey();
      const participantIdentityHashes = members.map((m) => m.identityHash);

      const groupKeyEnvelopes = await Promise.all(
        [keyPair.identityHash, ...participantIdentityHashes].map(async (identityHash) => {
          const member =
            identityHash === keyPair.identityHash
              ? { publicKeyJwk: keyPair.publicKeyJwk }
              : members.find((m) => m.identityHash === identityHash) ||
                users.find((u) => u.identityHash === identityHash);
          if (!member?.publicKeyJwk) throw new Error('Member not found');
          const wrapped = await wrapKeyForPeer(groupKey, keyPair.privateKey, member.publicKeyJwk);
          return { identityHash, ciphertext: wrapped.ciphertext, nonce: wrapped.nonce };
        })
      );

      const res = await authFetch('/livechat/conversations/group', {
        method: 'POST',
        body: JSON.stringify({ name, participantIdentityHashes, groupKeyEnvelopes }),
      });
      if (!res.ok) throw new Error('Could not create group');
      const conversation: LiveChatConversation = await res.json();
      await loadConversations();
      await openConversation(conversation);
    },
    [keyPair, users, loadConversations, openConversation]
  );

  const sendText = useCallback(
    async (text: string) => {
      if (!conversationKey || !activeConversation || !keyPair) return;
      const messageId = crypto.randomUUID();
      const encrypted = await encryptText(conversationKey, text);

      setMessages((prev) => [
        ...prev,
        {
          id: messageId,
          kind: 'text',
          text,
          status: 'sending',
          timestamp: Date.now(),
          outgoing: true,
        },
      ]);

      socketRef.current?.emit(
        'livechat-send-message',
        {
          conversationId: activeConversation.conversationId,
          messageId,
          senderIdentityHash: keyPair.identityHash,
          ciphertext: encrypted.ciphertext,
          nonce: encrypted.nonce,
          payloadType: 'text',
        },
        (res: { ok: boolean }) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId ? { ...m, status: res?.ok ? 'sent' : 'sending' } : m
            )
          );
          if (res?.ok) loadConversations();
        }
      );
    },
    [conversationKey, activeConversation, keyPair, loadConversations]
  );

  const sendFile = useCallback(
    async (file: File) => {
      if (!conversationKey || !activeConversation || !keyPair) return;
      const messageId = crypto.randomUUID();
      const { meta, payload } = await encryptFile(conversationKey, file);
      const bundle = JSON.stringify({ meta, payload });
      const encrypted = await encryptText(conversationKey, bundle);
      const fileUrl = URL.createObjectURL(file);

      setMessages((prev) => [
        ...prev,
        {
          id: messageId,
          kind: 'file',
          fileName: file.name,
          fileUrl,
          mimeType: file.type,
          status: 'sending',
          timestamp: Date.now(),
          outgoing: true,
        },
      ]);

      socketRef.current?.emit(
        'livechat-send-message',
        {
          conversationId: activeConversation.conversationId,
          messageId,
          senderIdentityHash: keyPair.identityHash,
          ciphertext: encrypted.ciphertext,
          nonce: encrypted.nonce,
          payloadType: 'file',
        },
        (res: { ok: boolean }) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId ? { ...m, status: res?.ok ? 'sent' : 'sending' } : m
            )
          );
          if (res?.ok) loadConversations();
        }
      );
    },
    [conversationKey, activeConversation, keyPair, loadConversations]
  );

  const startCall = useCallback(
    async (mode: CallMode) => {
      if (!conversationKey || !callPeer || !keyPair || activeConversation?.type === 'group') {
        throw new Error('Calls are available in direct chats only');
      }

      const turn = turnRef.current || (await fetchTurn());
      const sessionHash = crypto.randomUUID();
      callSessionRef.current = sessionHash;
      callKeyRef.current = conversationKey;

      setCallState((s) => ({
        ...s,
        phase: 'outgoing',
        mode,
        sessionHash,
        peerIdentityHash: callPeer.identityHash,
      }));

      const managed = createCallPeerConnection({
        turn,
        onRemoteStream: (stream) =>
          setCallState((s) => ({ ...s, remoteStream: stream, phase: 'connected' })),
        onStateChange: (state) => {
          if (state === 'connected') {
            setCallState((s) => ({ ...s, phase: 'connected' }));
          }
          if (state === 'disconnected' || state === 'failed') {
            teardownCall();
          }
        },
        onIceCandidate: (candidate) => emitIce(sessionHash, candidate, callPeer.identityHash),
      });
      managedPcRef.current = managed;

      const localStream = await attachLocalMedia(managed, mode === 'video');
      localStreamRef.current = localStream;
      setCallState((s) => ({ ...s, localStream }));

      const offer = await managed.pc.createOffer();
      await managed.pc.setLocalDescription(offer);
      const encryptedSignal = await encryptSignal(conversationKey, { sdp: offer, mode });

      socketRef.current?.emit('livechat-call-offer', {
        sessionHash,
        encryptedSignal,
        targetIdentityHash: callPeer.identityHash,
      });
    },
    [
      conversationKey,
      callPeer,
      keyPair,
      activeConversation,
      fetchTurn,
      emitIce,
      teardownCall,
    ]
  );

  const acceptCall = useCallback(async () => {
    const callKey = callKeyRef.current;
    const sessionHash = callSessionRef.current;
    const peerIdentityHash = callState.peerIdentityHash;
    const pending = pendingOfferRef.current;

    if (!callKey || !sessionHash || !peerIdentityHash || !pending) return;

    const turn = turnRef.current || (await fetchTurn());
    const signal = await decryptSignal(callKey, pending);
    const mode = signalModeFromOffer(signal) as CallMode;

    const managed = createCallPeerConnection({
      turn,
      onRemoteStream: (stream) =>
        setCallState((s) => ({ ...s, remoteStream: stream, phase: 'connected' })),
      onStateChange: (state) => {
        if (state === 'connected') {
          setCallState((s) => ({ ...s, phase: 'connected' }));
        }
        if (state === 'disconnected' || state === 'failed') {
          teardownCall();
        }
      },
      onIceCandidate: (candidate) => emitIce(sessionHash, candidate, peerIdentityHash),
    });
    managedPcRef.current = managed;

    const localStream = await attachLocalMedia(managed, mode === 'video');
    localStreamRef.current = localStream;

    await managed.setRemoteDescription(signal.sdp);
    const answer = await managed.pc.createAnswer();
    await managed.pc.setLocalDescription(answer);
    await flushPendingIce();

    const encryptedAnswer = await encryptSignal(callKey, { sdp: answer, mode });
    socketRef.current?.emit('livechat-call-answer', {
      sessionHash,
      encryptedSignal: encryptedAnswer,
      targetIdentityHash: peerIdentityHash,
    });

    pendingOfferRef.current = null;
    setCallState((s) => ({
      ...s,
      localStream,
      mode,
      phase: 'connecting',
    }));
  }, [callState.peerIdentityHash, fetchTurn, emitIce, flushPendingIce, teardownCall]);

  const rejectCall = useCallback(() => {
    socketRef.current?.emit('livechat-call-reject', {
      sessionHash: callState.sessionHash,
      targetIdentityHash: callState.peerIdentityHash,
    });
    teardownCall();
  }, [callState.sessionHash, callState.peerIdentityHash, teardownCall]);

  const endCall = useCallback(() => {
    socketRef.current?.emit('livechat-call-end', {
      sessionHash: callState.sessionHash,
      targetIdentityHash: callState.peerIdentityHash,
    });
    teardownCall();
  }, [callState.sessionHash, callState.peerIdentityHash, teardownCall]);

  const toggleMute = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setCallState((s) => ({ ...s, muted: !s.muted }));
  }, []);

  const toggleCamera = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setCallState((s) => ({ ...s, cameraOff: !s.cameraOff }));
  }, []);

  const getConversationTitle = useCallback(
    (conv: LiveChatConversation) => {
      if (conv.type === 'group') return conv.name || 'Group';
      const other = conv.participants.find((p) => p !== keyPair?.identityHash);
      if (!other) return conv.name || 'Direct chat';
      return userMapRef.current.get(other) || conv.name || 'Direct chat';
    },
    [keyPair]
  );

  return {
    users,
    conversations,
    activeConversation,
    messages,
    connected,
    callState,
    loadingChat,
    callPeer,
    turnAvailable,
    loadUsers,
    startDirectChat,
    createGroup,
    openConversation,
    getConversationTitle,
    sendText,
    sendFile,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
  };
};
