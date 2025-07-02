import React, { useEffect, useRef, useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { io, Socket } from 'socket.io-client';
import { API_URL, SOCKET_URL } from './config';

const fetchApi: typeof fetch =
  (typeof window !== 'undefined' && (window as any).fetch) ||
  (global as any).fetch;

interface Props { id: string; onExit: () => void; }


const DocumentEditor: React.FC<Props> = ({ id, onExit }) => {
  const [content, setContent] = useState('');
  const [name, setName] = useState('');
  const socketRef = useRef<Socket | null>(null);

  const storedUser = () => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : { _id: 'anon', name: 'Anonymous' };
    } catch {
      return { _id: 'anon', name: 'Anonymous' };
    }
  };
  const user = useRef<{ _id: string; name: string }>(storedUser());
  const quillRef = useRef<ReactQuill | null>(null);

  useEffect(() => {
    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.emit('join-document', id);

    let initialized = false;
    socket.on('document', (payload: any) => {
      let text: string | undefined;

      if (typeof payload === 'string') {
        text = payload;
      } else if (payload && typeof payload === 'object') {
        if (typeof payload.content === 'string') text = payload.content;
        else if (typeof payload.data === 'string') text = payload.data;
        else if (typeof payload.text === 'string') text = payload.text;
      }

      if (!initialized) {
        setContent(typeof text === 'string' ? text : '');
        initialized = true;
      }
    });

    socket.on('document-op', (delta: any) => {
      const editor = quillRef.current?.getEditor();
      if (editor) {
        editor.updateContents(delta, 'api');
        setContent(editor.root.innerHTML);
      }
    });

    fetchApi(`${API_URL}/document/${id}`)
      .then(res => res.json())
      .then(doc => {
        const { name = '', content, data, text } = doc || {};
        setName(name);

        const initial =
          typeof content === 'string'
            ? content
            : typeof data === 'string'
            ? data
            : typeof text === 'string'
            ? text
            : '';

        if (initial) {
          setContent(initial);
        }
      });

    return () => {
      socket.disconnect();
    };
  }, [id]);

  const handleChange = (value: string, delta: any, source: string) => {
    setContent(value);
    if (source === 'user') {
      socketRef.current?.emit('edit-document', { delta, content: value });
    }
  };

  const saveAndExit = async () => {
    await fetchApi(`${API_URL}/documents/${id}`, {
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
      <div className="editor-wrapper">
        <ReactQuill ref={quillRef} value={content} onChange={handleChange} />
      </div>
    </div>
  );
};

export default DocumentEditor;
