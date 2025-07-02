import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_URL, SOCKET_URL } from './config';

const fetchApi: typeof fetch =
  (typeof window !== 'undefined' && (window as any).fetch) ||
  (global as any).fetch;

interface Props { id: string; onExit: () => void; }

interface Operation {
  index: number;
  deleteCount: number;
  insertText: string;
  userId: string;
}

// Simplified editor without author highlighting
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

  const applyTextOp = (text: string, op: Operation) => {
    const insert =
      typeof op.insertText === 'string'
        ? op.insertText
        : op.insertText != null
        ? String(op.insertText)
        : '';
    return text.slice(0, op.index) + insert + text.slice(op.index + op.deleteCount);
  };

  const diff = (oldStr: string, newStr: string) => {
    let start = 0;
    while (
      start < oldStr.length &&
      start < newStr.length &&
      oldStr[start] === newStr[start]
    )
      start++;

    let endOld = oldStr.length - 1;
    let endNew = newStr.length - 1;
    while (
      endOld >= start &&
      endNew >= start &&
      oldStr[endOld] === newStr[endNew]
    ) {
      endOld--;
      endNew--;
    }
    const deleteCount = endOld - start + 1;
    const insertText = newStr.slice(start, endNew + 1);
    return { index: start, deleteCount, insertText };
  };

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

    socket.on('document-op', (op: Operation) => {
      setContent(prev => applyTextOp(prev, op));
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

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const { index, deleteCount, insertText } = diff(content, value);
    const op: Operation = { index, deleteCount, insertText, userId: user.current._id };
    setContent(value);
    socketRef.current?.emit('edit-document', op);
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
        <textarea
          className="editor-textarea"
          value={content}
          onChange={handleChange}
        />
      </div>
    </div>
  );
};

export default DocumentEditor;
