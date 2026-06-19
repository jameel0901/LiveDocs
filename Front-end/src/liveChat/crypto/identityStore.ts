import {
  generateKeyPair,
  hashAlias,
  LiveChatKeyPair,
  deriveRoomKey,
  saveKeyPair,
  getStoredKeyMeta,
  toBase64,
} from './e2eCrypto';

const PRIVATE_KEY_STORAGE = 'livedocs_livechat_priv';
const ALIAS_STORAGE = 'livedocs_livechat_alias';

const encoder = new TextEncoder();

const derivePinKey = async (pin: string, salt: Uint8Array) =>
  crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveKey']).then(
    (keyMaterial) =>
      crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      )
  );

export const persistPrivateKey = async (privateKey: CryptoKey, pin: string) => {
  const jwk = await crypto.subtle.exportKey('jwk', privateKey);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const pinKey = await derivePinKey(pin, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    pinKey,
    encoder.encode(JSON.stringify(jwk))
  );
  const bundle = {
    salt: toBase64(salt.buffer),
    iv: toBase64(iv.buffer),
    data: toBase64(encrypted),
  };
  localStorage.setItem(PRIVATE_KEY_STORAGE, JSON.stringify(bundle));
};

export const loadPrivateKey = async (pin: string): Promise<CryptoKey | null> => {
  const raw = localStorage.getItem(PRIVATE_KEY_STORAGE);
  if (!raw) return null;
  try {
    const bundle = JSON.parse(raw);
    const salt = Uint8Array.from(atob(bundle.salt), (c) => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(bundle.iv), (c) => c.charCodeAt(0));
    const data = Uint8Array.from(atob(bundle.data), (c) => c.charCodeAt(0));
    const pinKey = await derivePinKey(pin, salt);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, pinKey, data);
    const jwk = JSON.parse(new TextDecoder().decode(decrypted));
    return crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveKey']
    );
  } catch {
    return null;
  }
};

export const saveDisplayAlias = (alias: string) =>
  localStorage.setItem(ALIAS_STORAGE, alias.trim());

export const getStoredDisplayAlias = () => localStorage.getItem(ALIAS_STORAGE) || '';

export const setupIdentity = async (alias: string, pin: string) => {
  const keyPair = await generateKeyPair();
  const aliasHash = await hashAlias(alias);
  await persistPrivateKey(keyPair.privateKey, pin);
  saveKeyPair(keyPair.identityHash, aliasHash);
  saveDisplayAlias(alias);
  return { keyPair, aliasHash };
};

export const unlockIdentity = async (
  pin: string,
  publicKeyJwk: JsonWebKey,
  identityHash: string,
  aliasHash: string
): Promise<LiveChatKeyPair | null> => {
  const privateKey = await loadPrivateKey(pin);
  if (!privateKey) return null;
  const publicKey = await crypto.subtle.importKey(
    'jwk',
    publicKeyJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
  saveKeyPair(identityHash, aliasHash);
  return { publicKey, privateKey, publicKeyJwk, identityHash };
};

export const deriveDirectConversationKey = async (
  keyPair: LiveChatKeyPair,
  peerPublicKeyJwk: JsonWebKey
) => deriveRoomKey(keyPair.privateKey, peerPublicKeyJwk);

export const hasStoredPrivateKey = () => !!localStorage.getItem(PRIVATE_KEY_STORAGE);

export const getKeyMeta = getStoredKeyMeta;
