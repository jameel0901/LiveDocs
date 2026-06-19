import React from 'react';
import { LiveChatMessage } from '../types';

interface ChatThreadProps {
  messages: LiveChatMessage[];
  loading?: boolean;
}

const statusLabel = (status: LiveChatMessage['status']) => {
  if (status === 'sending') return '○';
  if (status === 'sent') return '✓';
  return '✓✓';
};

const ChatThread: React.FC<ChatThreadProps> = ({ messages, loading }) => {
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (loading) {
    return (
      <div className="livechat-thread livechat-thread--loading">
        <p>Loading messages…</p>
      </div>
    );
  }

  return (
    <div className="livechat-thread">
      {messages.length === 0 && (
        <p className="livechat-thread__empty">
          Messages are end-to-end encrypted and saved in this conversation.
        </p>
      )}
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`livechat-bubble livechat-bubble--${msg.outgoing ? 'out' : 'in'} livechat-bubble--${msg.kind}`}
        >
          {msg.kind === 'system' && (
            <span className="livechat-bubble__system">{msg.text}</span>
          )}
          {msg.kind === 'text' && (
            <div className="livechat-bubble__body">
              {!msg.outgoing && msg.senderName && (
                <span className="livechat-bubble__sender">{msg.senderName}</span>
              )}
              <div className="livechat-bubble__content">
                <p>{msg.text}</p>
                {msg.outgoing && (
                  <span className="livechat-bubble__status">{statusLabel(msg.status)}</span>
                )}
              </div>
            </div>
          )}
          {msg.kind === 'file' && (
            <div className="livechat-bubble__body">
              {!msg.outgoing && msg.senderName && (
                <span className="livechat-bubble__sender">{msg.senderName}</span>
              )}
              <div className="livechat-bubble__file">
                {msg.fileUrl && msg.mimeType?.startsWith('image/') ? (
                  <img
                    src={msg.fileUrl}
                    alt={msg.fileName || 'Attachment'}
                    className="livechat-bubble__image"
                  />
                ) : (
                  <span className="livechat-bubble__file-name">📎 {msg.fileName || 'File'}</span>
                )}
                {msg.fileUrl && (
                  <a href={msg.fileUrl} download={msg.fileName} target="_blank" rel="noreferrer">
                    Download
                  </a>
                )}
                {msg.outgoing && (
                  <span className="livechat-bubble__status">{statusLabel(msg.status)}</span>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
};

export default ChatThread;
