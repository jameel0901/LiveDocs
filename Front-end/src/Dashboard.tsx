import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface User {
  _id: string;
  name: string;
  email: string;

  documents: { _id: string; name: string }[];
}

interface OtherUser {
  _id: string;
  name: string;
  documents: { _id: string; name: string }[];

}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  const [others, setOthers] = useState<OtherUser[]>([]);


  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) {
      navigate('/login');
      return;
    }
    const u = JSON.parse(stored);
    fetch(`http://localhost:5000/users/${u._id}`)
      .then(res => res.json())
      .then(data => setUser(data));
    fetch('http://localhost:5000/users')
      .then(res => res.json())
      .then(data => setOthers(data.filter((o: OtherUser) => o._id !== u._id)));

  }, [navigate]);

  const createDoc = async () => {
    if (!user) return;
    const res = await fetch('http://localhost:5000/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId: user._id })
    });
    const doc = await res.json();
    navigate(`/document/${doc._id}`);
  };


  const sendRequest = async (docId: string, permission: string) => {
    if (!user) return;
    await fetch(`http://localhost:5000/documents/${docId}/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user._id, permission })
    });
    alert('Request sent');
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
        {user.documents.map(doc => (
          <li key={doc._id}>

            <button onClick={() => navigate(`/document/${doc._id}`)}>
              {doc.name || doc._id}
            </button>
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
    </div>
  );
};

export default Dashboard;
