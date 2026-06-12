import React, { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { SOCKET_URL } from './config';
import { authFetch, getStoredUser, parseErrorMessage } from './api';
import { appAlert, appConfirm } from './modal';
import Layout from './components/Layout';
import AttributedEditor from './components/AttributedEditor';
import AuthorLegend from './components/AuthorLegend';
import ActiveEditors from './components/ActiveEditors';
import { PresenceUser } from './types/presence';
import {
  ContentSegment,
  contentToSegments,
  normalizeSegments,
  segmentsToText,
} from './utils/segments';

interface NetworkOption {
  _id: string;
  name: string;
}

interface Props {
  id: string;
  onExit: () => void;
}

const DocumentEditor: React.FC<Props> = ({ id, onExit }) => {
  const navigate = useNavigate();
  const [segments, setSegments] = useState<ContentSegment[]>([]);
  const [name, setName] = useState('');
  const [permission, setPermission] = useState<'view' | 'edit'>('edit');
  const [activeUsers, setActiveUsers] = useState<PresenceUser[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [networks, setNetworks] = useState<NetworkOption[]>([]);
  const [networkId, setNetworkId] = useState<string | null>(null);
  const [networkVisible, setNetworkVisible] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const currentUser = getStoredUser();
  const canEdit = permission === 'edit';

  const emitEdit = useCallback(
    (nextSegments: ContentSegment[]) => {
      socketRef.current?.emit('edit-document', {
        content: segmentsToText(nextSegments),
        segments: nextSegments,
      });
    },
    []
  );

  const handleSegmentsChange = (nextSegments: ContentSegment[]) => {
    setSegments(nextSegments);
    if (canEdit) {
      emitEdit(nextSegments);
    }
  };

  const handleTyping = () => {
    socketRef.current?.emit('typing');
  };

  useEffect(() => {
    const user = getStoredUser();
    if (!user) {
      navigate('/login');
      return;
    }

    const socket = io(SOCKET_URL, {
      auth: { token: user.token },
    });

    socketRef.current = socket;

    socket.on('document-segments', (incomingSegments: ContentSegment[]) => {
      const normalized = normalizeSegments(incomingSegments, {
        authorId: user._id,
        authorName: user.name,
      });
      setSegments(normalized);
      setIsLoading(false);
    });

    socket.on('document', (content: string) => {
      if (!content) {
        setSegments([]);
      }
      setIsLoading(false);
    });

    socket.on('permission', (value: 'view' | 'edit') => {
      setPermission(value);
    });

    socket.on('active-users', (users: PresenceUser[]) => {
      setActiveUsers(users);
    });

    socket.on('presence-update', (payload: { documentId: string; users: PresenceUser[] }) => {
      if (payload.documentId === id) {
        setActiveUsers(payload.users);
      }
    });

    socket.on('error', (payload: { message?: string }) => {
      setError(payload?.message || 'Unable to access this document');
      setIsLoading(false);
    });

    socket.on('connect_error', (err: Error) => {
      setError(err.message || 'Failed to connect to server');
      setIsLoading(false);
    });

    socket.emit('join-document', id);

    authFetch('/networks')
      .then(async res => (res.ok ? res.json() : []))
      .then((items: NetworkOption[]) => setNetworks(items))
      .catch(() => undefined);

    authFetch(`/document/${id}`)
      .then(async res => {
        if (!res.ok) {
          const message = await parseErrorMessage(res, 'Failed to load document');
          throw new Error(message);
        }
        return res.json();
      })
      .then(doc => {
        setName(doc.name || '');
        if (doc.permission) {
          setPermission(doc.permission);
        }
        const ownerId = doc.owner?._id || doc.owner;
        setIsOwner(ownerId?.toString() === user._id);
        setNetworkId(doc.networkId || null);
        setNetworkVisible(!!doc.networkVisible);

        const initialSegments =
          normalizeSegments(doc.contentSegments, {
            authorId: user._id,
            authorName: user.name,
          }) || contentToSegments(doc.content || '', {
            authorId: user._id,
            authorName: user.name,
          });

        if (initialSegments.length > 0) {
          setSegments(initialSegments);
        }
      })
      .catch(err => {
        if (err.message !== 'Session expired') {
          setError(err.message || 'Failed to load document');
        }
        setIsLoading(false);
      });

    return () => {
      socket.emit('leave-document');
      socket.disconnect();
    };
  }, [id, navigate]);

  const saveAndExit = async () => {
    if (!canEdit) {
      onExit();
      return;
    }

    if (networkVisible && !networkId) {
      await appAlert('Select a network before sharing this document.', { variant: 'error' });
      return;
    }

    const res = await authFetch(`/documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name,
        content: segmentsToText(segments),
        contentSegments: segments,
        networkId: networkVisible ? networkId : null,
        networkVisible,
      }),
    });

    if (!res.ok) {
      const message = await parseErrorMessage(res, 'Failed to save document');
      await appAlert(message, { variant: 'error' });
      return;
    }

    onExit();
  };

  const handleDelete = async () => {
    if (!isOwner) return;

    const label = name.trim() || 'Untitled Document';
    const confirmed = await appConfirm(`Delete "${label}"? This cannot be undone.`, {
      title: 'Delete document',
      confirmLabel: 'Delete',
      variant: 'error',
    });
    if (!confirmed) {
      return;
    }

    const res = await authFetch(`/documents/${id}`, { method: 'DELETE' });

    if (!res.ok) {
      const message = await parseErrorMessage(res, 'Failed to delete document');
      await appAlert(message, { variant: 'error' });
      return;
    }

    socketRef.current?.emit('leave-document');
    socketRef.current?.disconnect();
    onExit();
  };

  if (error) {
    return (
      <Layout title="Document unavailable">
        <div className="error-state glass-card">
          <p>{error}</p>
          <button className="btn btn--secondary" onClick={onExit}>
            Back to Dashboard
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title="Document Editor"
      subtitle={canEdit ? 'Changes sync live with collaborators.' : 'You have view-only access.'}
      actions={
        <button className="btn btn--ghost" onClick={onExit}>
          Dashboard
        </button>
      }
    >
      <div className="editor-page">
        <div className="editor-toolbar glass-card">
          <div className="editor-toolbar__left">
            <div className="editor-status">
              <span
                className={`editor-status__dot ${
                  canEdit ? '' : 'editor-status__dot--view'
                }`}
              />
              {isLoading ? 'Connecting...' : canEdit ? 'Live editing' : 'View only'}
            </div>
            {!canEdit && <span className="badge badge--view">Read only</span>}
          </div>
          <div className="editor-toolbar__right">
            {isOwner && (
              <button className="btn btn--danger btn--sm" onClick={handleDelete}>
                Delete
              </button>
            )}
            <button className="btn btn--ghost" onClick={onExit}>
              Cancel
            </button>
            <button className="btn btn--primary" onClick={saveAndExit}>
              {canEdit ? 'Save & Exit' : 'Exit'}
            </button>
          </div>
        </div>

        <ActiveEditors users={activeUsers} currentUserId={currentUser?._id} />

        <div className="editor-surface glass-card">
          <input
            className="doc-title"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Untitled Document"
            readOnly={!canEdit}
          />

          {isOwner && (
            <div className="doc-network-settings">
              <div className="doc-network-settings__header">
                <strong>Network visibility</strong>
                <p>
                  Documents are private by default. Opt in to recommend this document to members
                  of a network you belong to.
                </p>
              </div>
              <label className="doc-network-settings__toggle">
                <input
                  type="checkbox"
                  checked={networkVisible}
                  onChange={event => setNetworkVisible(event.target.checked)}
                  disabled={!canEdit || networks.length === 0}
                />
                <span>Share in a network</span>
              </label>
              {networkVisible && (
                <select
                  className="input doc-network-settings__select"
                  value={networkId || ''}
                  onChange={event => setNetworkId(event.target.value || null)}
                  disabled={!canEdit}
                >
                  <option value="">Select a network</option>
                  {networks.map(network => (
                    <option key={network._id} value={network._id}>
                      {network.name}
                    </option>
                  ))}
                </select>
              )}
              {networks.length === 0 && (
                <p className="doc-network-settings__hint">
                  Join or create a network from your dashboard to share documents.
                </p>
              )}
            </div>
          )}

          <AttributedEditor
            segments={segments}
            currentAuthor={{
              authorId: currentUser?._id || '',
              authorName: currentUser?.name || 'User',
            }}
            onChange={handleSegmentsChange}
            onTyping={handleTyping}
            readOnly={!canEdit || isLoading}
            placeholder={isLoading ? 'Loading document...' : 'Start writing...'}
          />

          <AuthorLegend segments={segments} currentUserId={currentUser?._id} />
        </div>
      </div>
    </Layout>
  );
};

export default DocumentEditor;
