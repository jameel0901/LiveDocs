import React from 'react';

interface PermissionBadgeProps {
  permission?: 'view' | 'edit' | string;
  size?: 'sm' | 'md';
}

const PermissionBadge: React.FC<PermissionBadgeProps> = ({ permission = 'view', size = 'sm' }) => {
  const isEdit = permission === 'edit';

  return (
    <span
      className={`permission-badge permission-badge--${
        isEdit ? 'write' : 'read'
      } permission-badge--${size}`}
      title={isEdit ? 'Can edit and write' : 'Read only access'}
    >
      {isEdit ? 'Write' : 'Read'}
    </span>
  );
};

export default PermissionBadge;
