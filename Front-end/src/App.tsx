import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const socket = io('http://localhost:5000');
const DOCUMENT_ID = 'main';

function App() {
  const [content, setContent] = useState('');

  useEffect(() => {
    socket.emit('join-document', DOCUMENT_ID);
    socket.on('document', (data: string) => {
      setContent(data);
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setContent(value);
    socket.emit('edit-document', value);
  };

  return (
    <div className="App">
      <textarea
        style={{ width: '100%', height: '90vh' }}
        value={content}
        onChange={handleChange}
      />
    </div>
  );
}

export default App;
