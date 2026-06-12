import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  authFetch,
  clearStoredUser,
  getStoredUser,
  isAdminUser,
  parseErrorMessage,
  syncStoredUserRole,
} from './api';
import { appAlert, appConfirm } from './modal';
import Layout from './components/Layout';
import LoadingSpinner from './components/LoadingSpinner';

interface AdminOverview {
  totalUsers: number;
  totalDocuments: number;
  totalNetworks: number;
  networkVisibleDocuments: number;
  sharedDocuments: number;
  activeUsers24h: number;
}

interface AdminUserAnalytics {
  ownedDocuments: number;
  sharedWithYou: number;
  incomingRequests: number;
  networkVisibleDocuments: number;
  networksJoined: number;
  totalWords: number;
  totalCharacters: number;
  collaborationScore: number;
  weeklyActivity: { label: string; count: number }[];
}

interface AdminUserDocument {
  _id: string;
  name: string;
  networkVisible: boolean;
  networkId: string | null;
  sharedCount: number;
  wordCount: number;
  updatedAt: string;
}

interface AdminUserNetwork {
  _id: string;
  name: string;
  joinCode: string;
  memberCount: number;
}

interface AdminUserRecord {
  _id: string;
  name: string;
  email: string;
  role: string;
  passwordStatus: string;
  createdAt: string;
  updatedAt: string;
  networks: AdminUserNetwork[];
  documents: AdminUserDocument[];
  analytics: AdminUserAnalytics;
}

interface AdminNetworkRecord {
  _id: string;
  name: string;
  description: string;
  joinCode: string;
  memberCount: number;
  visibleDocuments: number;
  createdBy: { _id: string; name: string; email: string } | null;
  createdAt: string;
}

const Admin: React.FC = () => {
  const navigate = useNavigate();
  const storedUser = getStoredUser();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [networks, setNetworks] = useState<AdminNetworkRecord[]>([]);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});
  const [savingPasswordFor, setSavingPasswordFor] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadAdmin = useCallback(async () => {
    const [overviewRes, usersRes, networksRes] = await Promise.all([
      authFetch('/admin/overview'),
      authFetch('/admin/users'),
      authFetch('/admin/networks'),
    ]);

    if (!overviewRes.ok || !usersRes.ok || !networksRes.ok) {
      const message = await parseErrorMessage(
        !overviewRes.ok ? overviewRes : !usersRes.ok ? usersRes : networksRes,
        'Failed to load admin data'
      );
      throw new Error(message);
    }

    const [overviewData, usersData, networksData] = await Promise.all([
      overviewRes.json(),
      usersRes.json(),
      networksRes.json(),
    ]);

    setOverview(overviewData);
    setUsers(usersData);
    setNetworks(networksData);
  }, []);

  useEffect(() => {
    if (!storedUser) {
      navigate('/login');
      return;
    }

    const ensureAdmin = async () => {
      const profileRes = await authFetch(`/users/${storedUser._id}`);
      if (profileRes.ok) {
        const profile = await profileRes.json();
        if (profile.role) {
          syncStoredUserRole(profile.role);
        }
        if (!isAdminUser({ role: profile.role })) {
          navigate('/dashboard');
          return false;
        }
        return true;
      }

      if (!isAdminUser(storedUser)) {
        navigate('/dashboard');
        return false;
      }
      return true;
    };

    ensureAdmin().then(isAdmin => {
      if (!isAdmin) return;
      return loadAdmin();
    })
      .catch(err => {
        if ((err as Error).message !== 'Session expired') {
          setError((err as Error).message || 'Failed to load admin panel');
        }
      })
      .finally(() => setIsLoading(false));
  }, [loadAdmin, navigate, storedUser]);

  const handlePasswordChange = async (userId: string, userName: string) => {
    const password = passwordDrafts[userId]?.trim();
    if (!password || password.length < 6) {
      await appAlert('Password must be at least 6 characters.', { variant: 'error' });
      return;
    }

    setSavingPasswordFor(userId);
    try {
      const res = await authFetch(`/admin/users/${userId}/password`, {
        method: 'PUT',
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const message = await parseErrorMessage(res, 'Failed to update password');
        throw new Error(message);
      }

      setPasswordDrafts(prev => ({ ...prev, [userId]: '' }));
      await appAlert(`Password updated for ${userName}.`, {
        variant: 'success',
        title: 'Password updated',
      });
    } catch (err) {
      await appAlert((err as Error).message, { variant: 'error' });
    } finally {
      setSavingPasswordFor(null);
    }
  };

  const handleDeleteUser = async (user: AdminUserRecord) => {
    const confirmed = await appConfirm(
      `Delete ${user.name} (${user.email})? Their documents will also be removed.`,
      { title: 'Delete user', confirmLabel: 'Delete', variant: 'error' }
    );
    if (!confirmed) return;

    const res = await authFetch(`/admin/users/${user._id}`, { method: 'DELETE' });
    if (!res.ok) {
      await appAlert(await parseErrorMessage(res, 'Failed to delete user'), {
        variant: 'error',
      });
      return;
    }

    setUsers(prev => prev.filter(item => item._id !== user._id));
    if (expandedUserId === user._id) setExpandedUserId(null);
    if (overview) {
      setOverview({
        ...overview,
        totalUsers: Math.max(overview.totalUsers - 1, 0),
      });
    }
    await appAlert('User deleted.', { variant: 'success', title: 'Deleted' });
  };

  const handleDeleteDocument = async (doc: AdminUserDocument, ownerName: string) => {
    const confirmed = await appConfirm(
      `Delete "${doc.name || 'Untitled Document'}" owned by ${ownerName}?`,
      { title: 'Delete document', confirmLabel: 'Delete', variant: 'error' }
    );
    if (!confirmed) return;

    const res = await authFetch(`/admin/documents/${doc._id}`, { method: 'DELETE' });
    if (!res.ok) {
      await appAlert(await parseErrorMessage(res, 'Failed to delete document'), {
        variant: 'error',
      });
      return;
    }

    setUsers(prev =>
      prev.map(user => ({
        ...user,
        documents: user.documents.filter(item => item._id !== doc._id),
        analytics: {
          ...user.analytics,
          ownedDocuments: user.documents.some(item => item._id === doc._id)
            ? Math.max(user.analytics.ownedDocuments - 1, 0)
            : user.analytics.ownedDocuments,
        },
      }))
    );
    if (overview) {
      setOverview({
        ...overview,
        totalDocuments: Math.max(overview.totalDocuments - 1, 0),
      });
    }
    await appAlert('Document deleted.', { variant: 'success', title: 'Deleted' });
  };

  const handleDeleteNetwork = async (network: AdminNetworkRecord) => {
    const confirmed = await appConfirm(
      `Delete network "${network.name}"? Documents will be hidden from this network.`,
      { title: 'Delete network', confirmLabel: 'Delete', variant: 'error' }
    );
    if (!confirmed) return;

    const res = await authFetch(`/admin/networks/${network._id}`, { method: 'DELETE' });
    if (!res.ok) {
      await appAlert(await parseErrorMessage(res, 'Failed to delete network'), {
        variant: 'error',
      });
      return;
    }

    setNetworks(prev => prev.filter(item => item._id !== network._id));
    setUsers(prev =>
      prev.map(user => ({
        ...user,
        networks: user.networks.filter(item => item._id !== network._id),
        analytics: {
          ...user.analytics,
          networksJoined: user.networks.some(item => item._id === network._id)
            ? Math.max(user.analytics.networksJoined - 1, 0)
            : user.analytics.networksJoined,
        },
      }))
    );
    if (overview) {
      setOverview({
        ...overview,
        totalNetworks: Math.max(overview.totalNetworks - 1, 0),
      });
    }
    await appAlert('Network deleted.', { variant: 'success', title: 'Deleted' });
  };

  if (isLoading) {
    return (
      <Layout title="Admin">
        <LoadingSpinner label="Loading admin analytics..." />
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Admin">
        <div className="error-state glass-card">
          <p>{error}</p>
          <Link to="/dashboard" className="btn btn--secondary">
            Back to Dashboard
          </Link>
        </div>
      </Layout>
    );
  }

  const handleLogout = () => {
    clearStoredUser();
    navigate('/login');
  };

  return (
    <Layout
      variant="admin"
      title="Admin Console"
      subtitle="Manage users, passwords, documents, and networks across the platform."
      actions={
        <>
          <Link to="/dashboard" className="btn btn--secondary">
            My Workspace
          </Link>
          <Link to="/profile" className="btn btn--secondary">
            Profile
          </Link>
          <button type="button" className="btn btn--ghost" onClick={handleLogout}>
            Logout
          </button>
        </>
      }
    >
      <div className="admin-page">
        {overview && (
          <section className="admin-overview">
            <div className="admin-stat glass-card">
              <span>Total Users</span>
              <strong>{overview.totalUsers}</strong>
            </div>
            <div className="admin-stat glass-card">
              <span>Documents</span>
              <strong>{overview.totalDocuments}</strong>
            </div>
            <div className="admin-stat glass-card">
              <span>Networks</span>
              <strong>{overview.totalNetworks}</strong>
            </div>
            <div className="admin-stat glass-card">
              <span>Network-Visible Docs</span>
              <strong>{overview.networkVisibleDocuments}</strong>
            </div>
            <div className="admin-stat glass-card">
              <span>Shared Docs</span>
              <strong>{overview.sharedDocuments}</strong>
            </div>
            <div className="admin-stat glass-card">
              <span>Active (24h)</span>
              <strong>{overview.activeUsers24h}</strong>
            </div>
          </section>
        )}

        <section className="admin-users glass-card">
          <div className="panel-header">
            <h3>User Management</h3>
            <span>{users.length} accounts</span>
          </div>

          <div className="admin-user-list">
            {users.map(user => {
              const isExpanded = expandedUserId === user._id;
              const maxActivity = Math.max(
                ...user.analytics.weeklyActivity.map(day => day.count),
                1
              );
              const isSelf = storedUser?._id === user._id;

              return (
                <article key={user._id} className="admin-user-card">
                  <button
                    type="button"
                    className="admin-user-card__summary"
                    onClick={() =>
                      setExpandedUserId(isExpanded ? null : user._id)
                    }
                  >
                    <div>
                      <strong>{user.name}</strong>
                      <span>{user.email}</span>
                    </div>
                    <div className="admin-user-card__stats">
                      <span className="badge badge--edit">
                        {user.role === 'admin' ? 'Admin' : 'User'}
                      </span>
                      <span>{user.analytics.ownedDocuments} docs</span>
                      <span>{user.analytics.networksJoined} networks</span>
                      <span>Score {user.analytics.collaborationScore}</span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="admin-user-card__details">
                      <div className="admin-manage-block">
                        <h4>Password</h4>
                        <p className="admin-manage-block__hint">
                          Passwords are stored encrypted and cannot be viewed. Set a new
                          password below.
                        </p>
                        <div className="admin-password-row">
                          <span className="admin-password-mask" aria-hidden="true">
                            ••••••••
                          </span>
                          <span className="badge badge--view">Encrypted</span>
                        </div>
                        <div className="admin-password-form">
                          <input
                            className="input"
                            type="password"
                            placeholder="New password (min 6 chars)"
                            value={passwordDrafts[user._id] || ''}
                            onChange={event =>
                              setPasswordDrafts(prev => ({
                                ...prev,
                                [user._id]: event.target.value,
                              }))
                            }
                          />
                          <button
                            type="button"
                            className="btn btn--primary btn--sm"
                            disabled={savingPasswordFor === user._id}
                            onClick={() => handlePasswordChange(user._id, user.name)}
                          >
                            {savingPasswordFor === user._id ? 'Saving...' : 'Set Password'}
                          </button>
                        </div>
                      </div>

                      <div className="admin-user-card__grid">
                        <div>
                          <h4>Usage</h4>
                          <ul className="admin-detail-list">
                            <li>Owned documents: {user.analytics.ownedDocuments}</li>
                            <li>Shared with user: {user.analytics.sharedWithYou}</li>
                            <li>
                              Network-visible docs: {user.analytics.networkVisibleDocuments}
                            </li>
                            <li>Networks joined: {user.analytics.networksJoined}</li>
                            <li>Pending requests: {user.analytics.incomingRequests}</li>
                            <li>
                              Joined: {new Date(user.createdAt).toLocaleDateString()}
                            </li>
                          </ul>
                        </div>

                        <div>
                          <h4>7-Day Activity</h4>
                          <div className="admin-activity-bars">
                            {user.analytics.weeklyActivity.map(day => (
                              <div key={day.label} className="admin-activity-bar">
                                <div
                                  className="admin-activity-bar__fill"
                                  style={{
                                    height: `${(day.count / maxActivity) * 100}%`,
                                  }}
                                />
                                <span>{day.label}</span>
                                <small>{day.count}</small>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4>Networks</h4>
                        {user.networks.length === 0 ? (
                          <p className="empty-state">No networks.</p>
                        ) : (
                          <ul className="admin-manage-list">
                            {user.networks.map(network => (
                              <li key={network._id} className="admin-manage-list__item">
                                <div>
                                  <strong>{network.name}</strong>
                                  <span>
                                    {network.memberCount} members · Code {network.joinCode}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  className="btn btn--danger btn--sm"
                                  onClick={() => {
                                    const record = networks.find(
                                      item => item._id === network._id
                                    );
                                    if (record) handleDeleteNetwork(record);
                                  }}
                                >
                                  Delete
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div>
                        <h4>Documents</h4>
                        {user.documents.length === 0 ? (
                          <p className="empty-state">No documents.</p>
                        ) : (
                          <ul className="admin-manage-list">
                            {user.documents.map(doc => (
                              <li key={doc._id} className="admin-manage-list__item">
                                <div>
                                  <strong>{doc.name || 'Untitled Document'}</strong>
                                  <span>
                                    {doc.wordCount} words · {doc.sharedCount} shared ·{' '}
                                    {doc.networkVisible ? 'In network' : 'Private'}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  className="btn btn--danger btn--sm"
                                  onClick={() => handleDeleteDocument(doc, user.name)}
                                >
                                  Delete
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {!isSelf && (
                        <div className="admin-user-card__danger">
                          <button
                            type="button"
                            className="btn btn--danger"
                            onClick={() => handleDeleteUser(user)}
                          >
                            Delete User
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <section className="admin-users glass-card">
          <div className="panel-header">
            <h3>All Networks</h3>
            <span>{networks.length} networks</span>
          </div>

          {networks.length === 0 ? (
            <p className="empty-state">No networks yet.</p>
          ) : (
            <ul className="admin-manage-list">
              {networks.map(network => (
                <li key={network._id} className="admin-manage-list__item">
                  <div>
                    <strong>{network.name}</strong>
                    <span>
                      {network.memberCount} members · {network.visibleDocuments} shared
                      docs · Code {network.joinCode}
                      {network.createdBy ? ` · by ${network.createdBy.name}` : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    onClick={() => handleDeleteNetwork(network)}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Layout>
  );
};

export default Admin;
