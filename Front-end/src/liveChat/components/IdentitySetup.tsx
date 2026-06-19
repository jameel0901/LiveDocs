import React, { useState } from 'react';
import { authFetch } from '../../api';
import { LiveChatKeyPair } from '../crypto/e2eCrypto';
import { setupIdentity, unlockIdentity, hasStoredPrivateKey } from '../crypto/identityStore';

interface IdentitySetupProps {
  onReady: (keyPair: LiveChatKeyPair, alias: string) => void;
}

const IdentitySetup: React.FC<IdentitySetupProps> = ({ onReady }) => {
  const [alias, setAlias] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'create' | 'unlock'>(hasStoredPrivateKey() ? 'unlock' : 'create');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'create') {
        if (pin.length < 6) throw new Error('PIN must be at least 6 characters');
        if (pin !== confirmPin) throw new Error('PINs do not match');
        if (!alias.trim()) throw new Error('Choose a pseudonym alias');

        const { keyPair, aliasHash } = await setupIdentity(alias.trim(), pin);
        const res = await authFetch('/livechat/identity', {
          method: 'POST',
          body: JSON.stringify({
            publicKeyJwk: keyPair.publicKeyJwk,
            aliasHash,
            identityHash: keyPair.identityHash,
            displayAlias: alias.trim(),
          }),
        });
        if (!res.ok) throw new Error('Failed to register identity');
        onReady(keyPair, alias.trim());
      } else {
        const meRes = await authFetch('/livechat/identity/me');
        if (!meRes.ok) throw new Error('No identity found — create one first');
        const me = await meRes.json();
        const keyPair = await unlockIdentity(pin, me.publicKeyJwk, me.identityHash, me.aliasHash);
        if (!keyPair) throw new Error('Invalid PIN');
        onReady(keyPair, me.displayAlias || 'User');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="livechat-setup glass-card">
      <div className="livechat-setup__header">
        <h2>liveChat Identity</h2>
        <p>
          Zero-knowledge encrypted messaging. Your private keys never leave this device.
          Use a pseudonym — no real email or phone required.
        </p>
      </div>

      <div className="livechat-setup__tabs">
        <button
          type="button"
          className={mode === 'create' ? 'active' : ''}
          onClick={() => setMode('create')}
        >
          Create identity
        </button>
        <button
          type="button"
          className={mode === 'unlock' ? 'active' : ''}
          onClick={() => setMode('unlock')}
        >
          Unlock
        </button>
      </div>

      <form onSubmit={handleSubmit} className="livechat-setup__form">
        {mode === 'create' && (
          <div className="field">
            <label htmlFor="lc-alias">Pseudonym</label>
            <input
              id="lc-alias"
              className="input"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="e.g. shadow-fox"
              required
            />
          </div>
        )}

        <div className="field">
          <label htmlFor="lc-pin">Encryption PIN</label>
          <input
            id="lc-pin"
            className="input"
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Never sent to server"
            required
          />
        </div>

        {mode === 'create' && (
          <div className="field">
            <label htmlFor="lc-pin2">Confirm PIN</label>
            <input
              id="lc-pin2"
              className="input"
              type="password"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              required
            />
          </div>
        )}

        {error && <p className="livechat-setup__error">{error}</p>}

        <button type="submit" className="btn btn--primary btn--block" disabled={loading}>
          {loading ? 'Securing…' : mode === 'create' ? 'Generate keys & enter' : 'Unlock keys'}
        </button>
      </form>
    </div>
  );
};

export default IdentitySetup;
