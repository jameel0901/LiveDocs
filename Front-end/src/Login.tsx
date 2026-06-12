import React, { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from './config';
import { useNavigate, Link } from 'react-router-dom';
import { setStoredUser, parseErrorMessage } from './api';
import { appAlert } from './modal';
import Layout from './components/Layout';

const SERVER_AWAKE_KEY = 'livedocs_server_awake';
const WAKE_UP_DELAY_MS = 3000;

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [wakeUpMessage, setWakeUpMessage] = useState(false);
  const wakeUpTimerRef = useRef<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionStorage.getItem(SERVER_AWAKE_KEY)) {
      fetch(`${API_BASE_URL}/health`).catch(() => undefined);
    }

    return () => {
      if (wakeUpTimerRef.current) {
        window.clearTimeout(wakeUpTimerRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setWakeUpMessage(false);

    const isFirstServerVisit = !sessionStorage.getItem(SERVER_AWAKE_KEY);

    if (isFirstServerVisit) {
      wakeUpTimerRef.current = window.setTimeout(() => {
        setWakeUpMessage(true);
      }, WAKE_UP_DELAY_MS);
    }

    try {
      const res = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        sessionStorage.setItem(SERVER_AWAKE_KEY, 'true');
        const data = await res.json();
        setStoredUser(data);
        navigate(data.role === 'admin' ? '/admin' : '/dashboard');
        return;
      }

      const message = await parseErrorMessage(res, 'Login failed');
      await appAlert(message, { variant: 'error' });
    } catch (err) {
      console.error(err);
      await appAlert('Failed to connect to server', { variant: 'error' });
    } finally {
      if (wakeUpTimerRef.current) {
        window.clearTimeout(wakeUpTimerRef.current);
        wakeUpTimerRef.current = null;
      }
      setIsLoading(false);
      setWakeUpMessage(false);
    }
  };

  return (
    <Layout variant="auth">
      <form className="auth-container glass-card" onSubmit={handleSubmit}>
        <div className="auth-container__intro">
          <h2>Welcome back</h2>
          <p>Sign in to continue collaborating on your documents.</p>
        </div>

        {wakeUpMessage && (
          <div className="server-wakeup-banner" role="status" aria-live="polite">
            <strong>Waking up the server...</strong>
            <p>
              The backend is hosted on Render&apos;s free tier and sleeps when idle. The first
              request can take up to a minute while the server starts. Please wait.
            </p>
          </div>
        )}

        <div className="field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div className="field">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <button type="submit" className="btn btn--primary btn--block" disabled={isLoading}>
          {isLoading ? 'Signing in...' : 'Sign In'}
        </button>

        <p className="auth-container__footer">
          No account yet? <Link to="/signup">Create one</Link>
        </p>
      </form>
    </Layout>
  );
};

export default Login;
