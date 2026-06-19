import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getStoredUser } from './api';
import { LiveChatKeyPair } from './liveChat/crypto/e2eCrypto';
import Layout from './components/Layout';
import IdentitySetup from './liveChat/components/IdentitySetup';
import ChatThread from './liveChat/components/ChatThread';
import ChatInput from './liveChat/components/ChatInput';
import CallModal from './liveChat/components/CallModal';
import GroupCreateModal from './liveChat/components/GroupCreateModal';
import { useLiveChat } from './liveChat/hooks/useLiveChat';
import { appAlert } from './modal';

type SidebarTab = 'chats' | 'users';

const LiveChat: React.FC = () => {
  const navigate = useNavigate();
  const [keyPair, setKeyPair] = useState<LiveChatKeyPair | null>(null);
  const [alias, setAlias] = useState('');
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('chats');
  const [showGroupModal, setShowGroupModal] = useState(false);

  const chat = useLiveChat(keyPair, alias);

  useEffect(() => {
    if (!getStoredUser()) navigate('/login');
  }, [navigate]);

  const handleCall = async (mode: 'audio' | 'video') => {
    try {
      await chat.startCall(mode);
    } catch (err) {
      await appAlert((err as Error).message, { variant: 'error' });
    }
  };

  const startChat = async (target: (typeof chat.users)[0]) => {
    try {
      await chat.startDirectChat(target);
      setSidebarTab('chats');
    } catch (err) {
      await appAlert((err as Error).message, { variant: 'error' });
    }
  };

  if (!keyPair) {
    return (
      <Layout title="liveChat" subtitle="Encrypted messaging">
        <IdentitySetup
          onReady={(kp, chosenAlias) => {
            setKeyPair(kp);
            setAlias(chosenAlias);
          }}
        />
      </Layout>
    );
  }

  const isDirectChat = chat.activeConversation?.type === 'direct';
  const chatTitle = chat.activeConversation
    ? chat.getConversationTitle(chat.activeConversation)
    : 'Select a chat';

  return (
    <Layout
      actions={
        <Link to="/dashboard" className="btn btn--ghost">
          Back
        </Link>
      }
    >
      <div className="livechat-page">
        <div className="livechat-app">
          <aside className="livechat-sidebar glass-card">
            <div className="livechat-sidebar__identity">
              <strong>{alias}</strong>
              <span className={`livechat-status ${chat.connected ? 'livechat-status--on' : ''}`}>
                {chat.connected ? 'Online' : 'Connecting…'}
              </span>
            </div>

            <div className="livechat-sidebar__tabs">
              <button
                type="button"
                className={sidebarTab === 'chats' ? 'active' : ''}
                onClick={() => setSidebarTab('chats')}
              >
                Chats
              </button>
              <button
                type="button"
                className={sidebarTab === 'users' ? 'active' : ''}
                onClick={() => {
                  setSidebarTab('users');
                  chat.loadUsers();
                }}
              >
                Users
              </button>
            </div>

            {sidebarTab === 'chats' && (
              <>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm btn--block"
                  onClick={() => {
                    chat.loadUsers();
                    setShowGroupModal(true);
                  }}
                >
                  New group
                </button>
                <ul className="livechat-conv-list">
                  {chat.conversations.length === 0 && (
                    <li className="livechat-conv-list__empty">No conversations yet</li>
                  )}
                  {chat.conversations.map((conv) => (
                    <li key={conv.conversationId}>
                      <button
                        type="button"
                        className={
                          chat.activeConversation?.conversationId === conv.conversationId
                            ? 'active'
                            : ''
                        }
                        onClick={() => chat.openConversation(conv)}
                      >
                        <span className="livechat-conv-list__title">
                          {chat.getConversationTitle(conv)}
                        </span>
                        <span className="livechat-conv-list__meta">
                          {conv.type === 'group' ? 'Group' : 'Direct'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {sidebarTab === 'users' && (
              <ul className="livechat-user-list">
                {chat.users.length === 0 && (
                  <li className="livechat-user-list__empty">No other users registered yet</li>
                )}
                {chat.users.map((user) => (
                  <li key={user.identityHash}>
                    <button type="button" onClick={() => startChat(user)}>
                      <span className="livechat-user-list__avatar">
                        {user.displayAlias.charAt(0).toUpperCase()}
                      </span>
                      <span>{user.displayAlias}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <section className="livechat-main glass-card">
            <header className="livechat-main__header">
              <div>
                <h2>{chatTitle}</h2>
                {chat.activeConversation && (
                  <span className="livechat-main__subtitle">
                    {chat.activeConversation.type === 'group'
                      ? `${chat.activeConversation.participants.length} members · E2EE`
                      : 'End-to-end encrypted'}
                  </span>
                )}
              </div>
            </header>

            <ChatThread messages={chat.messages} loading={chat.loadingChat} />
            <ChatInput
              onSendText={chat.sendText}
              onSendFile={chat.sendFile}
              onStartCall={handleCall}
              disabled={!chat.activeConversation}
              callsEnabled={isDirectChat}
            />
          </section>
        </div>
      </div>

      {showGroupModal && (
        <GroupCreateModal
          users={chat.users}
          onClose={() => setShowGroupModal(false)}
          onCreate={chat.createGroup}
        />
      )}

      <CallModal
        callState={chat.callState}
        turnAvailable={chat.turnAvailable}
        onAccept={chat.acceptCall}
        onReject={chat.rejectCall}
        onEnd={chat.endCall}
        onToggleMute={chat.toggleMute}
        onToggleCamera={chat.toggleCamera}
      />
    </Layout>
  );
};

export default LiveChat;
