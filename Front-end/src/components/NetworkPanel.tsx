import React, { useState } from 'react';
import { authFetch, parseErrorMessage } from '../api';
import { appAlert, appConfirm } from '../modal';

export interface NetworkSummary {
  _id: string;
  name: string;
  description: string;
  joinCode: string;
  memberCount: number;
}

export interface NetworkFeedMember {
  _id: string;
  name: string;
  email: string;
  documents: { _id: string; name: string; updatedAt?: string }[];
}

export interface NetworkFeed {
  network: { _id: string; name: string; description: string };
  members: NetworkFeedMember[];
  visibleDocumentCount: number;
}

interface NetworkPanelProps {
  networks: NetworkSummary[];
  activeNetworkId: string | null;
  feed: NetworkFeed | null;
  onNetworksChange: (networks: NetworkSummary[]) => void;
  onActiveNetworkChange: (networkId: string | null) => void;
  onFeedChange: (feed: NetworkFeed | null) => void;
  onRequestAccess: (docId: string, permission: string) => void;
}

const NetworkPanel: React.FC<NetworkPanelProps> = ({
  networks,
  activeNetworkId,
  feed,
  onNetworksChange,
  onActiveNetworkChange,
  onFeedChange,
  onRequestAccess,
}) => {
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  const loadFeed = async (networkId: string) => {
    const res = await authFetch(`/networks/${networkId}/feed`);
    if (!res.ok) {
      const message = await parseErrorMessage(res, 'Failed to load network feed');
      throw new Error(message);
    }
    const data = await res.json();
    onFeedChange(data);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!createName.trim()) return;

    setIsCreating(true);
    setError('');
    try {
      const res = await authFetch('/networks', {
        method: 'POST',
        body: JSON.stringify({
          name: createName.trim(),
          description: createDescription.trim(),
        }),
      });

      if (!res.ok) {
        const message = await parseErrorMessage(res, 'Failed to create network');
        throw new Error(message);
      }

      const network = await res.json();
      const nextNetworks = [network, ...networks];
      onNetworksChange(nextNetworks);
      onActiveNetworkChange(network._id);
      await loadFeed(network._id);
      setCreateName('');
      setCreateDescription('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!joinCode.trim()) return;

    setIsJoining(true);
    setError('');
    try {
      const res = await authFetch('/networks/join', {
        method: 'POST',
        body: JSON.stringify({ joinCode: joinCode.trim() }),
      });

      if (!res.ok) {
        const message = await parseErrorMessage(res, 'Failed to join network');
        throw new Error(message);
      }

      const network = await res.json();
      const exists = networks.some(item => item._id === network._id);
      const nextNetworks = exists
        ? networks
        : [{ ...network, memberCount: network.memberCount || 1 }, ...networks];
      onNetworksChange(nextNetworks);
      onActiveNetworkChange(network._id);
      await loadFeed(network._id);
      setJoinCode('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsJoining(false);
    }
  };

  const handleSelectNetwork = async (networkId: string) => {
    onActiveNetworkChange(networkId);
    setError('');
    try {
      await loadFeed(networkId);
    } catch (err) {
      setError((err as Error).message);
      onFeedChange(null);
    }
  };

  const handleLeave = async (networkId: string) => {
    const confirmed = await appConfirm(
      'Leave this network? Your documents will be hidden from it.',
      { title: 'Leave network', confirmLabel: 'Leave' }
    );
    if (!confirmed) {
      return;
    }

    const res = await authFetch(`/networks/${networkId}/leave`, { method: 'POST' });
    if (!res.ok) {
      const message = await parseErrorMessage(res, 'Failed to leave network');
      await appAlert(message, { variant: 'error' });
      return;
    }

    const nextNetworks = networks.filter(network => network._id !== networkId);
    onNetworksChange(nextNetworks);
    if (activeNetworkId === networkId) {
      const nextActive = nextNetworks[0]?._id || null;
      onActiveNetworkChange(nextActive);
      if (nextActive) {
        await loadFeed(nextActive);
      } else {
        onFeedChange(null);
      }
    }
  };

  const activeNetwork = networks.find(network => network._id === activeNetworkId);

  return (
    <div className="network-panel">
      <div className="network-panel__forms">
        <form className="network-form glass-card" onSubmit={handleCreate}>
          <h4>Create a network</h4>
          <p className="network-form__hint">
            Start a private space where members can optionally share documents.
          </p>
          <input
            className="input"
            placeholder="Network name"
            value={createName}
            onChange={event => setCreateName(event.target.value)}
          />
          <input
            className="input"
            placeholder="Description (optional)"
            value={createDescription}
            onChange={event => setCreateDescription(event.target.value)}
          />
          <button className="btn btn--primary btn--sm" type="submit" disabled={isCreating}>
            {isCreating ? 'Creating...' : 'Create Network'}
          </button>
        </form>

        <form className="network-form glass-card" onSubmit={handleJoin}>
          <h4>Join a network</h4>
          <p className="network-form__hint">Enter the join code shared by a network owner.</p>
          <input
            className="input"
            placeholder="Join code"
            value={joinCode}
            onChange={event => setJoinCode(event.target.value.toUpperCase())}
          />
          <button className="btn btn--secondary btn--sm" type="submit" disabled={isJoining}>
            {isJoining ? 'Joining...' : 'Join Network'}
          </button>
        </form>
      </div>

      {error && <div className="network-panel__error">{error}</div>}

      {networks.length > 0 ? (
        <>
          <div className="network-tabs">
            {networks.map(network => (
              <button
                key={network._id}
                type="button"
                className={`network-tab${
                  activeNetworkId === network._id ? ' network-tab--active' : ''
                }`}
                onClick={() => handleSelectNetwork(network._id)}
              >
                <span>{network.name}</span>
                <small>{network.memberCount} members</small>
              </button>
            ))}
          </div>

          {activeNetwork && (
            <div className="network-active glass-card">
              <div className="network-active__header">
                <div>
                  <h3>{activeNetwork.name}</h3>
                  {activeNetwork.description && <p>{activeNetwork.description}</p>}
                </div>
                <div className="network-active__meta">
                  <span className="badge badge--pending">Code: {activeNetwork.joinCode}</span>
                  <button
                    className="btn btn--ghost btn--sm"
                    type="button"
                    onClick={() => handleLeave(activeNetwork._id)}
                  >
                    Leave
                  </button>
                </div>
              </div>

              <p className="network-active__note">
                Only documents a member chooses to share in this network appear below. Everything
                else stays private.
              </p>

              {feed ? (
                <div className="network-feed">
                  {feed.members.length === 0 ? (
                    <div className="empty-state">
                      No shared documents in this network yet. Members can opt in from the editor.
                    </div>
                  ) : (
                    feed.members.map(member => (
                      <div key={member._id} className="network-feed__member">
                        <div className="network-feed__member-header">
                          <strong>{member.name}</strong>
                          <span>{member.email}</span>
                        </div>
                        <ul className="user-group__docs">
                          {member.documents.length === 0 ? (
                            <li className="empty-state">No documents shared in this network.</li>
                          ) : (
                            member.documents.map(doc => (
                              <li key={doc._id} className="item-card">
                                <div className="item-card__main">
                                  <span className="item-card__title">
                                    {doc.name || 'Untitled Document'}
                                  </span>
                                  <div className="item-card__meta">
                                    <span className="badge badge--success">In network</span>
                                  </div>
                                </div>
                                <div className="item-card__actions">
                                  <button
                                    className="btn btn--secondary btn--sm"
                                    onClick={() => onRequestAccess(doc._id, 'view')}
                                  >
                                    Request View
                                  </button>
                                  <button
                                    className="btn btn--primary btn--sm"
                                    onClick={() => onRequestAccess(doc._id, 'edit')}
                                  >
                                    Request Edit
                                  </button>
                                </div>
                              </li>
                            ))
                          )}
                        </ul>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="empty-state">Select a network to browse shared documents.</div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="empty-state glass-card">
          You are not in any networks yet. Create one or join with a code to discover documents.
        </div>
      )}
    </div>
  );
};

export default NetworkPanel;
