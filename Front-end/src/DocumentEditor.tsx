import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000');

interface Props { id: string; onExit: () => void; }

const DocumentEditor: React.FC<Props> = ({ id, onExit }) => {
  const [content, setContent] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    socket.emit('join-document', id);
    socket.on('document', (data: string) => {
      setContent(data);
    });
    fetch(`http://localhost:5000/document/${id}`)
      .then(res => res.json())
      .then(doc => setName(doc.name || ''));
    return () => {
      socket.disconnect();
    };
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setContent(value);
    socket.emit('edit-document', value);
  };

  const saveAndExit = async () => {
    await fetch(`http://localhost:5000/documents/${id}` , {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, content })
    });
    onExit();
  };

  return (
    <div>
      <input
        style={{ width: '100%', fontSize: '1.5rem', marginBottom: '0.5rem' }}
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Document Name"
      />
      <button onClick={saveAndExit}>Save & Exit</button>
      <textarea
        style={{ width: '100%', height: '80vh' }}
        value={content}
        onChange={handleChange}
      />
    </div>
  );
};

export default DocumentEditor;
