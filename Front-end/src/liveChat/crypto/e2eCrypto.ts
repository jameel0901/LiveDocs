export interface LiveChatKeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicKeyJwk: JsonWebKey;
  identityHash: string;
}

export interface EncryptedPayload {
  ciphertext: string;
  nonce: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const toBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const fromBase64 = (value: string) =>
  Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

export const hashBuffer = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

export const hashAlias = async (alias: string) => hashBuffer(alias.trim().toLowerCase());

export const generateKeyPair = async (): Promise<LiveChatKeyPair> => {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey']
  );

  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const identityHash = await hashBuffer(JSON.stringify(publicKeyJwk));

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    publicKeyJwk,
    identityHash,
  };
};

export const importPublicKey = (jwk: JsonWebKey) =>
  crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, []);

const deriveAesKey = async (privateKey: CryptoKey, publicKey: CryptoKey) =>
  crypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

export const deriveRoomKey = async (
  privateKey: CryptoKey,
  peerPublicKeyJwk: JsonWebKey,
  _roomSecret?: string
) => {
  const peerKey = await importPublicKey(peerPublicKeyJwk);
  return deriveAesKey(privateKey, peerKey);
};

export const generateConversationKey = () =>
  crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);

export const wrapKeyForPeer = async (
  conversationKey: CryptoKey,
  privateKey: CryptoKey,
  peerPublicKeyJwk: JsonWebKey
): Promise<EncryptedPayload> => {
  const peerKey = await importPublicKey(peerPublicKeyJwk);
  const wrapKey = await deriveAesKey(privateKey, peerKey);
  const raw = await crypto.subtle.exportKey('raw', conversationKey);
  return encryptBytes(wrapKey, raw);
};

export const unwrapKeyFromPeer = async (
  payload: EncryptedPayload,
  privateKey: CryptoKey,
  peerPublicKeyJwk: JsonWebKey
): Promise<CryptoKey> => {
  const peerKey = await importPublicKey(peerPublicKeyJwk);
  const wrapKey = await deriveAesKey(privateKey, peerKey);
  const raw = await decryptBytes(wrapKey, payload);
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
};

export const encryptBytes = async (
  key: CryptoKey,
  data: ArrayBuffer
): Promise<EncryptedPayload> => {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, data);
  return { ciphertext: toBase64(ciphertext), nonce: toBase64(nonce.buffer) };
};

export const decryptBytes = async (
  key: CryptoKey,
  payload: EncryptedPayload
): Promise<ArrayBuffer> => {
  const nonce = fromBase64(payload.nonce);
  const ciphertext = fromBase64(payload.ciphertext);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ciphertext);
};

export const encryptText = async (key: CryptoKey, text: string) =>
  encryptBytes(key, encoder.encode(text).buffer);

export const decryptText = async (key: CryptoKey, payload: EncryptedPayload) => {
  const plain = await decryptBytes(key, payload);
  return decoder.decode(plain);
};

export interface EncryptedFileMeta {
  encryptedName: EncryptedPayload;
  mimeType: string;
  size: number;
}

export const encryptFile = async (
  key: CryptoKey,
  file: File
): Promise<{ meta: EncryptedFileMeta; payload: EncryptedPayload }> => {
  const buffer = await file.arrayBuffer();
  const payload = await encryptBytes(key, buffer);
  const encryptedName = await encryptText(key, file.name);
  return {
    meta: {
      encryptedName,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
    },
    payload,
  };
};

export const decryptFile = async (
  key: CryptoKey,
  meta: EncryptedFileMeta,
  payload: EncryptedPayload
): Promise<{ name: string; blob: Blob }> => {
  const name = await decryptText(key, meta.encryptedName);
  const buffer = await decryptBytes(key, payload);
  return { name, blob: new Blob([buffer], { type: meta.mimeType }) };
};

export const computeRoomHash = async (
  roomSecretHash: string,
  participantKeyHashes: string[]
) => {
  const sorted = [...participantKeyHashes].sort();
  return hashBuffer([roomSecretHash, ...sorted].join(':'));
};

export const randomRoomSecret = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const KEY_STORAGE = 'livedocs_livechat_keys';

export const saveKeyPair = (identityHash: string, aliasHash: string) => {
  sessionStorage.setItem(KEY_STORAGE, JSON.stringify({ identityHash, aliasHash }));
};

export const getStoredKeyMeta = (): { identityHash: string; aliasHash: string } | null => {
  const raw = sessionStorage.getItem(KEY_STORAGE);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const clearStoredKeyMeta = () => sessionStorage.removeItem(KEY_STORAGE);
