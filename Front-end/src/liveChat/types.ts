export type MessageStatus = 'sending' | 'sent' | 'delivered';

export type MessageKind = 'text' | 'file' | 'system';

export interface LiveChatMessage {
  id: string;
  kind: MessageKind;
  text?: string;
  fileName?: string;
  fileUrl?: string;
  mimeType?: string;
  status: MessageStatus;
  timestamp: number;
  outgoing: boolean;
  senderName?: string;
}

export interface LiveChatUser {
  identityHash: string;
  displayAlias: string;
  publicKeyJwk: JsonWebKey;
}

export interface LiveChatPeer {
  identityHash: string;
  displayAlias: string;
  publicKeyJwk: JsonWebKey;
  aliasHash?: string;
}

export interface GroupKeyEnvelope {
  identityHash: string;
  ciphertext: string;
  nonce: string;
}

export interface LiveChatConversation {
  conversationId: string;
  type: 'direct' | 'group';
  name: string;
  participants: string[];
  createdBy: string;
  groupKeyEnvelopes?: GroupKeyEnvelope[];
  lastMessageAt?: string;
}

export interface TurnCredentials {
  urls: string[];
  username: string;
  credential: string;
  ttl: number;
  iceTransportPolicy: RTCIceTransportPolicy;
  turnAvailable?: boolean;
}

export type CallMode = 'audio' | 'video';
export type CallPhase = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'connected';

export interface CallState {
  phase: CallPhase;
  mode: CallMode;
  sessionHash: string | null;
  peerIdentityHash: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  muted: boolean;
  cameraOff: boolean;
}
