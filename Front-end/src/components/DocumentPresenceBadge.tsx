import React from 'react';
import { PresenceUser } from '../types/presence';
import { getUserColor } from '../utils/colors';

interface DocumentPresenceBadgeProps {
  users: PresenceUser[];
  currentUserId?: string;
}

const DocumentPresenceBadge: React.FC<DocumentPresenceBadgeProps> = ({
  users,
  currentUserId,
}) => {
  const activeUsers = users.filter(user => user.isActive);
  if (activeUsers.length === 0) return null;

  const typingUsers = activeUsers.filter(user => user.isTyping);
  const displayUsers = typingUsers.length > 0 ? typingUsers : activeUsers;

  return (
    <div className="presence-badge">
      <span className="presence-badge__pulse" aria-hidden="true" />
      <div className="presence-badge__avatars">
        {displayUsers.slice(0, 3).map(user => (
          <span
            key={user.userId}
            className="presence-badge__avatar"
            style={{ backgroundColor: getUserColor(user.userId) }}
            title={user.userName}
          >
            {user.userName.charAt(0).toUpperCase()}
          </span>
        ))}
      </div>
      <span className="presence-badge__text">
        {typingUsers.length > 0
          ? `${typingUsers
              .map(user => (user.userId === currentUserId ? 'You are' : `${user.userName} is`))
              .join(', ')} writing`
          : `${displayUsers.map(user => user.userName).join(', ')} viewing`}
      </span>
    </div>
  );
};

export default DocumentPresenceBadge;
