import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

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

interface Char {
  ch: string;
  userId: string | null;
}

const colors = [
  '#ffadad',
  '#ffd6a5',
  '#caffbf',
  '#9bf6ff',
  '#a0c4ff',
  '#bdb2ff',
  '#ffc6ff',
];

const DocumentEditor: React.FC<Props> = ({ id, onExit }) => {
  const [content, setContent] = useState('');
  const [chars, setChars] = useState<Char[]>([]);

  const [showWriters, setShowWriters] = useState(false);
  const [legend, setLegend] = useState<Record<string, string>>({});
  const [name, setName] = useState('');
  const overlayRef = useRef<HTMLPreElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const colorMap = useRef<Record<string, string>>({});
  const storedUser = () => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : { _id: 'anon', name: 'Anonymous' };
    } catch {
      return { _id: 'anon', name: 'Anonymous' };
    }
  };
  const user = useRef<{ _id: string; name: string }>(storedUser());

  const getColor = (id: string) => {
    if (!colorMap.current[id]) {
      const used = Object.keys(colorMap.current).length;
      colorMap.current[id] = colors[used % colors.length];
      setLegend({ ...colorMap.current });
    }
    return colorMap.current[id];
  };

  const applyTextOp = (text: string, op: Operation) => {
    const insert =
      typeof op.insertText === 'string' ? op.insertText : String(op.insertText);
    return text.slice(0, op.index) + insert + text.slice(op.index + op.deleteCount);
  };

  const applyCharOp = (arr: Char[], op: Operation) => {
    const before = arr.slice(0, op.index);
    const after = arr.slice(op.index + op.deleteCount);
    const text =
      typeof op.insertText === 'string' ? op.insertText : String(op.insertText);
    const inserted = text.split('').map(ch => ({ ch, userId: op.userId }));
    return [...before, ...inserted, ...after];
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
    const socket = io('https://livedocs-gool.onrender.com');
    socketRef.current = socket;

    socket.emit('join-document', id);

    socket.on('document', (data: any) => {
      if (typeof data === 'string') {
        setContent(data);
        setChars(data.split('').map(ch => ({ ch, userId: null })));
      } else if (data && typeof data.content === 'string') {
        setContent(data.content);
        const arr = data.content.split('').map((ch: string, i: number) => ({
          ch,
          userId: data.authors?.[i] || null,
        }));
        setChars(arr);
      }
    });

    socket.on('document-op', (op: Operation) => {
      setContent(prev => applyTextOp(prev, op));
      setChars(prev => applyCharOp(prev, op));
    });

    fetchApi(`https://livedocs-gool.onrender.com/document/${id}`)
      .then(res => res.json())
      .then(doc => {
        setName(doc.name || '');

        if (typeof doc.content === 'string') {
          setContent(doc.content);
          setChars(
            doc.content.split('').map((ch: string) => ({ ch, userId: null }))
          );
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
    setChars(prev => applyCharOp(prev, op));
    socketRef.current?.emit('edit-document', op);
  };

  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const updateOverlay = () => {
    if (!overlayRef.current) return;
    let html = '';
    for (let i = 0; i < chars.length; ) {
      const uid = chars[i].userId;
      let j = i;
      while (j < chars.length && chars[j].userId === uid) j++;
      const text = chars
        .slice(i, j)
        .map(c => escapeHtml(String(c.ch)))
        .join('');
      if (uid && showWriters) {
        html += `<span style="background-color:${getColor(uid)}77">${text}</span>`;
      } else {
        html += text;
      }
      i = j;
    }
    overlayRef.current.innerHTML = html;
  };

  useEffect(updateOverlay, [chars, showWriters]);


  const saveAndExit = async () => {
    await fetchApi(`https://livedocs-gool.onrender.com/documents/${id}` , {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, content })
    });
    onExit();
  };

  return (
    <div className="editor-container">
      <div className="editor-actions">
        <label style={{ marginRight: '0.5rem' }}>
          <input
            type="checkbox"
            checked={showWriters}
            onChange={e => setShowWriters(e.target.checked)}
          />{' '}
          Show Writers
        </label>
        {showWriters && (
          <span className="writer-legend">
            {Object.entries(legend).map(([uid, color]) => (
              <span
                key={uid}
                className="legend-item"
                style={{ backgroundColor: color }}
              >
                {uid === user.current._id ? 'You' : uid.slice(0, 6)}
              </span>
            ))}
          </span>
        )}
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
        {showWriters && (
          <pre
            className="writer-overlay"
            ref={overlayRef}
            aria-hidden="true"
          ></pre>
        )}
      </div>
    </div>
  );
};

export default DocumentEditor;
