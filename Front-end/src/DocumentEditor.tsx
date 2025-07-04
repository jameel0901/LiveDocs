import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL, SOCKET_URL } from './config';

const fetchApi: typeof fetch =
  (typeof window !== 'undefined' && (window as any).fetch) ||
  (global as any).fetch;

interface Props { id: string; onExit: () => void; }

const DocumentEditor: React.FC<Props> = ({ id, onExit }) => {
  const [content, setContent] = useState('');

  const [name, setName] = useState('');
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(SOCKET_URL);
    socketRef.current = socket;
    socket.emit('join-document', id);
    socket.on('document', (data: string) => {
      setContent(data);
    });

    fetchApi(`${API_BASE_URL}/document/${id}`)
      .then(res => res.json())
      .then(doc => setName(doc.name || ''));

    return () => {
      socket.disconnect();
    };
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setContent(value);
    socketRef.current?.emit('edit-document', value);
  };


  const saveAndExit = async () => {
    await fetchApi(`${API_BASE_URL}/documents/${id}` , {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, content })
    });
    onExit();
  };

  return (
    <div className="editor-container">
      <div className="editor-actions">
        <button onClick={saveAndExit}>Save &amp; Exit</button>
      </div>
      <input
        className="doc-title"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Document Name"
      />
      <textarea
        className="editor-textarea"
        value={content}
        onChange={handleChange}
      />
    </div>
  );
};

export default DocumentEditor;
