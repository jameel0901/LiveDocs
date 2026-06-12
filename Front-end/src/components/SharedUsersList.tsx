import React from 'react';
import PermissionBadge from './PermissionBadge';

export interface SharedUser {
  _id: string;
  name: string;
  permission: 'view' | 'edit' | string;
  sharedAt?: string;
}

interface SharedUsersListProps {
  users: SharedUser[];
}

const SharedUsersList: React.FC<SharedUsersListProps> = ({ users }) => {
  if (!users.length) {
    return <span className="shared-users-list__empty">Not shared with anyone yet</span>;
  }

  return (
    <ul className="shared-users-list">
      {users.map(sharedUser => (
        <li key={sharedUser._id} className="shared-users-list__item">
          <span className="shared-users-list__name">{sharedUser.name}</span>
          <PermissionBadge permission={sharedUser.permission} />
          {sharedUser.sharedAt && (
            <span className="shared-users-list__date">
              {new Date(sharedUser.sharedAt).toLocaleDateString()}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
};

export default SharedUsersList;
