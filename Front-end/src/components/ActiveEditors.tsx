import React from 'react';
import { PresenceUser } from '../types/presence';
import { getUserColor } from '../utils/colors';

interface ActiveEditorsProps {
  users: PresenceUser[];
  currentUserId?: string;
  compact?: boolean;
}

const ActiveEditors: React.FC<ActiveEditorsProps> = ({
  users,
  currentUserId,
  compact = false,
}) => {
  const visibleUsers = users.filter(user => user.isActive);

  if (visibleUsers.length === 0) {
    return compact ? null : (
      <div className="active-editors active-editors--empty">
        <span>No one is in this document right now</span>
      </div>
    );
  }

  return (
    <div className={`active-editors ${compact ? 'active-editors--compact' : ''}`}>
      {!compact && <span className="active-editors__label">Live in document</span>}
      <ul className="active-editors__list">
        {visibleUsers.map(user => (
          <li
            key={user.userId}
            className={`active-editors__item ${
              user.isTyping ? 'active-editors__item--typing' : ''
            }`}
          >
            <span
              className="active-editors__dot"
              style={{ backgroundColor: getUserColor(user.userId) }}
              aria-hidden="true"
            />
            <span className="active-editors__name">
              {user.userName}
              {user.userId === currentUserId ? ' (you)' : ''}
            </span>
            <span className="active-editors__status">
              {user.isTyping ? 'writing...' : 'viewing'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ActiveEditors;
