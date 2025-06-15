import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000');

interface Props { id: string; onExit: () => void; }

const DocumentEditor: React.FC<Props> = ({ id, onExit }) => {
  const [content, setContent] = useState('');

  useEffect(() => {
    socket.emit('join-document', id);
    socket.on('document', (data: string) => {
      setContent(data);
    });
    return () => {
      socket.disconnect();
    };
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setContent(value);
    socket.emit('edit-document', value);
  };

  return (
    <div>
      <button onClick={onExit}>Exit</button>
      <textarea
        style={{ width: '100%', height: '80vh' }}
        value={content}
        onChange={handleChange}
      />
    </div>
  );
};

export default DocumentEditor;
