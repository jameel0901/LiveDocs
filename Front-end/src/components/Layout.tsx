import React from 'react';
import { Link } from 'react-router-dom';
import { getStoredUser, isAdminUser } from '../api';

interface LayoutProps {
  children: React.ReactNode;
  variant?: 'auth' | 'app' | 'admin';
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  variant = 'app',
  title,
  subtitle,
  actions,
}) => {
  const storedUser = getStoredUser();
  const admin = isAdminUser(storedUser);
  const homeHref = admin ? '/admin' : '/dashboard';

  return (
    <div className={`app-shell app-shell--${variant}`}>
      <div className="app-bg" aria-hidden="true">
        <span className="app-bg__orb app-bg__orb--one" />
        <span className="app-bg__orb app-bg__orb--two" />
        <span className="app-bg__orb app-bg__orb--three" />
      </div>

      <header className="app-header">
        <Link to={homeHref} className="brand">
          <span className="brand__icon">LD</span>
          <span className="brand__text">
            <strong>LiveDocs</strong>
            <small>{variant === 'admin' ? 'Admin console' : 'Write together, live'}</small>
          </span>
          {admin && <span className="brand__admin-badge">Admin</span>}
        </Link>
        {actions && <div className="app-header__actions app-header__actions--desktop">{actions}</div>}
      </header>

      <main className={`app-main app-main--${variant}`}>
        {(title || subtitle) && (
          <div className="page-heading">
            {title && <h1>{title}</h1>}
            {subtitle && <p>{subtitle}</p>}
          </div>
        )}
        {children}
      </main>
    </div>
  );
};

export default Layout;
