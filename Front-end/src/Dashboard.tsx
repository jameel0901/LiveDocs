import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from './config';

interface User {
  _id: string;
  name: string;
  email: string;
  documents: {
    _id: string;
    name: string;
    owner: { _id: string; name: string } | null;
    sharedAt?: string;
  }[];

}

interface OtherUser {
  _id: string;
  name: string;
  documents: { _id: string; name: string }[];

}

interface IncomingRequest {
  documentId: string;
  documentName: string;
  requesterId: string;
  requesterName: string;
  permission: string;
}

interface OutgoingRequest {
  documentId: string;
  documentName: string;
  ownerId: string;
  ownerName: string;
  permission: string;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  const [others, setOthers] = useState<OtherUser[]>([]);
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingRequest[]>([]);


  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) {
      navigate('/login');
      return;
    }
    const u = JSON.parse(stored);
    fetch(`${API_BASE_URL}/users/${u._id}`)
      .then(res => res.json())
      .then(data => setUser(data));
    fetch(`${API_BASE_URL}/users`)
      .then(res => res.json())
      .then(data => setOthers(data.filter((o: OtherUser) => o._id !== u._id)));
    fetch(`${API_BASE_URL}/users/${u._id}/incoming-requests`)
      .then(res => res.json())
      .then(setIncoming);
    fetch(`${API_BASE_URL}/users/${u._id}/outgoing-requests`)
      .then(res => res.json())
      .then(setOutgoing);

  }, [navigate]);

  const createDoc = async () => {
    if (!user) return;
    const res = await fetch(`${API_BASE_URL}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId: user._id })
    });
    const doc = await res.json();
    navigate(`/document/${doc._id}`);
  };


  const sendRequest = async (docId: string, permission: string) => {
    if (!user) return;
    await fetch(`${API_BASE_URL}/documents/${docId}/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user._id, permission })
    });
    alert('Request sent');
  };

  const grantRequest = async (docId: string, requesterId: string) => {
    await fetch(`${API_BASE_URL}/documents/${docId}/requests/${requesterId}/grant`, {
      method: 'POST'
    });
    setIncoming(prev => prev.filter(r => !(r.documentId === docId && r.requesterId === requesterId)));
  };

  const removeRequest = async (docId: string, requesterId: string, type: 'incoming' | 'outgoing') => {
    await fetch(`${API_BASE_URL}/documents/${docId}/requests/${requesterId}`, {
      method: 'DELETE'
    });
    if (type === 'incoming') {
      setIncoming(prev => prev.filter(r => !(r.documentId === docId && r.requesterId === requesterId)));
    } else {
      setOutgoing(prev => prev.filter(r => r.documentId !== docId));
    }
  };

  if (!user) return <div>Loading...</div>;

  return (
    <div className="dashboard">

      <h2>Dashboard</h2>
      <p>Name: {user.name}</p>
      <p>Email: {user.email}</p>
      <button onClick={createDoc}>New Document</button>
      <h3>Your Documents</h3>
      <ul>
        {(user.documents || [])
          .filter(doc => doc.owner && doc.owner._id === user._id)
          .map(doc => (
          <li key={doc._id}>

            <button onClick={() => navigate(`/document/${doc._id}`)}>
              {doc.name || doc._id}
            </button>
          </li>
        ))}
      </ul>
      <h3>Shared With You</h3>
      <ul>

        {(user.documents || [])
          .filter(doc => doc.owner && doc.owner._id !== user._id)

          .map(doc => (
            <li key={doc._id}>
              <button onClick={() => navigate(`/document/${doc._id}`)}>
                {doc.name || doc._id}
              </button>

              {doc.owner && (
                <span>
                  {' '}– {doc.owner.name}{' '}
                  {doc.sharedAt &&
                    `(${new Date(doc.sharedAt).toLocaleDateString()})`}
                </span>
              )}

            </li>
          ))}
      </ul>
      <h3>Other Users</h3>
      <ul>
        {others.map(u => (
          <li key={u._id}>
            <strong>{u.name}</strong>
            <ul>
              {u.documents.map(d => (
                <li key={d._id}>
                  {d.name || d._id}{' '}
                  <button
                    onClick={() => sendRequest(d._id, 'view')}
                  >
                    Request View
                  </button>{' '}
                  <button
                    onClick={() => sendRequest(d._id, 'edit')}
                  >
                    Request Edit
                  </button>
                </li>
              ))}
            </ul>

          </li>
        ))}
      </ul>
      <h3>Incoming Requests</h3>
      <ul>
        {incoming.map(r => (
          <li key={r.documentId + r.requesterId}>
            {r.requesterName} wants {r.permission} on {r.documentName}{' '}
            <button onClick={() => grantRequest(r.documentId, r.requesterId)}>Grant</button>{' '}
            <button onClick={() => removeRequest(r.documentId, r.requesterId, 'incoming')}>Decline</button>
          </li>
        ))}
      </ul>
      <h3>Outgoing Requests</h3>
      <ul>
        {outgoing.map(r => (
          <li key={r.documentId}>
            Request to {r.ownerName} for {r.permission} on {r.documentName}{' '}
            <button onClick={() => removeRequest(r.documentId, user!._id, 'outgoing')}>Cancel</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Dashboard;
