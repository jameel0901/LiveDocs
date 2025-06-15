import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface User {
  _id: string;
  name: string;
  email: string;
  documents: { _id: string }[];
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

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

  if (!user) return <div>Loading...</div>;

  return (
    <div>
      <h2>Dashboard</h2>
      <p>Name: {user.name}</p>
      <p>Email: {user.email}</p>
      <button onClick={createDoc}>New Document</button>
      <h3>Your Documents</h3>
      <ul>
        {user.documents.map(doc => (
          <li key={doc._id}>
            <button onClick={() => navigate(`/document/${doc._id}`)}>{doc._id}</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Dashboard;
