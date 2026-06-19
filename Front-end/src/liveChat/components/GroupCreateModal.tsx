import React, { useState } from 'react';
import { LiveChatUser } from '../types';

interface GroupCreateModalProps {
  users: LiveChatUser[];
  onClose: () => void;
  onCreate: (name: string, members: LiveChatUser[]) => Promise<void>;
}

const GroupCreateModal: React.FC<GroupCreateModalProps> = ({ users, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggle = (hash: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(hash)) next.delete(hash);
      else next.add(hash);
      return next;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || selected.size === 0) return;
    setLoading(true);
    setError('');
    try {
      const members = users.filter((u) => selected.has(u.identityHash));
      await onCreate(name.trim(), members);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="livechat-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="livechat-modal glass-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="group-modal-title"
      >
        <h3 id="group-modal-title">Create group</h3>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="group-name">Group name</label>
            <input
              id="group-name"
              className="input livechat-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Team chat"
              required
            />
          </div>
          <p className="livechat-modal__hint">Select members</p>
          <ul className="livechat-user-pick">
            {users.map((user) => (
              <li key={user.identityHash}>
                <label>
                  <input
                    type="checkbox"
                    checked={selected.has(user.identityHash)}
                    onChange={() => toggle(user.identityHash)}
                  />
                  <span>{user.displayAlias}</span>
                </label>
              </li>
            ))}
          </ul>
          {error && <p className="livechat-setup__error">{error}</p>}
          <div className="livechat-modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={loading || !name.trim() || selected.size === 0}
            >
              {loading ? 'Creating…' : 'Create group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GroupCreateModal;
