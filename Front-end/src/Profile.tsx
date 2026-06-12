import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Layout from './components/Layout';
import LoadingSpinner from './components/LoadingSpinner';
import {
  authFetch,
  getStoredUser,
  parseErrorMessage,
  setStoredUser,
} from './api';

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const storedUser = getStoredUser();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!storedUser) {
      navigate('/login');
      return;
    }

    authFetch(`/users/${storedUser._id}`)
      .then(async res => {
        if (!res.ok) {
          const message = await parseErrorMessage(res, 'Failed to load profile');
          throw new Error(message);
        }
        return res.json();
      })
      .then(data => {
        setName(data.name || '');
        setEmail(data.email || '');
      })
      .catch(err => {
        if (err.message !== 'Session expired') {
          setErrorMessage(err.message || 'Failed to load profile');
        }
      })
      .finally(() => setLoading(false));
  }, [navigate, storedUser]);

  const showSuccess = (message: string, updated?: { name: string; email: string }) => {
    setSuccessMessage(message);
    setErrorMessage('');
    setTimeout(() => setSuccessMessage(''), 3000);

    if (updated && storedUser) {
      setStoredUser({
        ...storedUser,
        name: updated.name,
        email: updated.email,
      });
    }
  };

  const updateProfile = async (
    section: string,
    body: Record<string, string>
  ) => {
    if (!storedUser) return;

    setSavingSection(section);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await authFetch(`/users/${storedUser._id}/profile`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const message = await parseErrorMessage(res, 'Failed to update profile');
        throw new Error(message);
      }

      const data = await res.json();
      showSuccess(data.message || 'Profile updated successfully', {
        name: data.name,
        email: data.email,
      });
    } catch (err) {
      if ((err as Error).message !== 'Session expired') {
        setErrorMessage((err as Error).message || 'Failed to update profile');
      }
    } finally {
      setSavingSection(null);
    }
  };

  const handleNameSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile('name', { name });
  };

  const handleEmailSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile('email', { email });
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setErrorMessage('New passwords do not match');
      return;
    }

    await updateProfile('password', { currentPassword, newPassword });
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  if (loading) {
    return (
      <Layout title="Profile">
        <LoadingSpinner label="Loading profile..." />
      </Layout>
    );
  }

  return (
    <Layout
      title="Profile Settings"
      subtitle="Manage your account details and security."
      actions={
        <Link to="/dashboard" className="btn btn--ghost">
          Back to Dashboard
        </Link>
      }
    >
      <div className="profile-page">
        {successMessage && (
          <div className="profile-alert profile-alert--success" role="status">
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="profile-alert profile-alert--error" role="alert">
            {errorMessage}
          </div>
        )}

        <section className="profile-card glass-card">
          <div className="profile-card__header">
            <h3>Display Name</h3>
            <p>This is the name shown to other collaborators.</p>
          </div>
          <form onSubmit={handleNameSave}>
            <div className="field">
              <label htmlFor="profile-name">Username</label>
              <input
                id="profile-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={savingSection === 'name'}
            >
              {savingSection === 'name' ? 'Saving...' : 'Save Name'}
            </button>
          </form>
        </section>

        <section className="profile-card glass-card">
          <div className="profile-card__header">
            <h3>Email Address</h3>
            <p>Used for signing in to your account.</p>
          </div>
          <form onSubmit={handleEmailSave}>
            <div className="field">
              <label htmlFor="profile-email">Email</label>
              <input
                id="profile-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={savingSection === 'email'}
            >
              {savingSection === 'email' ? 'Saving...' : 'Save Email'}
            </button>
          </form>
        </section>

        <section className="profile-card glass-card">
          <div className="profile-card__header">
            <h3>Password</h3>
            <p>Update your password. You must enter your current password to confirm.</p>
          </div>
          <form onSubmit={handlePasswordSave}>
            <div className="field">
              <label htmlFor="profile-current-password">Current Password</label>
              <input
                id="profile-current-password"
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
            </div>
            <div className="field">
              <label htmlFor="profile-new-password">New Password</label>
              <input
                id="profile-new-password"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                minLength={6}
              />
            </div>
            <div className="field">
              <label htmlFor="profile-confirm-password">Confirm New Password</label>
              <input
                id="profile-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                minLength={6}
              />
            </div>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={
                savingSection === 'password' ||
                !currentPassword ||
                !newPassword ||
                !confirmPassword
              }
            >
              {savingSection === 'password' ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </section>
      </div>
    </Layout>
  );
};

export default Profile;
