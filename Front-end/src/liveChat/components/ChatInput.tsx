import React, { useRef, useState } from 'react';

interface ChatInputProps {
  onSendText: (text: string) => void;
  onSendFile: (file: File) => void;
  onStartCall: (mode: 'audio' | 'video') => void;
  disabled?: boolean;
  callsEnabled?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSendText,
  onSendFile,
  onStartCall,
  disabled,
  callsEnabled = true,
}) => {
  const [text, setText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSendText(text.trim());
    setText('');
  };

  return (
    <div className="livechat-composer">
      <div className="livechat-composer__actions">
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => onStartCall('audio')}
          disabled={disabled || !callsEnabled}
          title="Voice call"
        >
          📞
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => onStartCall('video')}
          disabled={disabled || !callsEnabled}
          title="Video call"
        >
          📹
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          title="Attach encrypted file"
        >
          📎
        </button>
        <input
          ref={fileRef}
          type="file"
          hidden
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onSendFile(file);
            e.target.value = '';
          }}
        />
      </div>
      <form onSubmit={submit} className="livechat-composer__form">
        <input
          className="input livechat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Encrypted message…"
          disabled={disabled}
        />
        <button type="submit" className="btn btn--primary btn--sm" disabled={disabled || !text.trim()}>
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatInput;
