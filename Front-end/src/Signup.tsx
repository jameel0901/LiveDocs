import React, { useState } from 'react';
import { API_BASE_URL } from './config';
import { useNavigate, Link } from 'react-router-dom';
import { parseErrorMessage } from './api';
import { appAlert } from './modal';
import Layout from './components/Layout';

const Signup: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      if (res.ok) {
        navigate('/login');
        return;
      }

      const message = await parseErrorMessage(res, 'Signup failed');
      await appAlert(message, { variant: 'error' });
    } catch (err) {
      console.error(err);
      await appAlert('Failed to connect to server', { variant: 'error' });
    }
  };

  return (
    <Layout variant="auth">
      <form className="auth-container glass-card" onSubmit={handleSubmit}>
        <div className="auth-container__intro">
          <h2>Create your account</h2>
          <p>Start writing and sharing documents in real time.</p>
        </div>

        <div className="field">
          <label htmlFor="signup-name">Full name</label>
          <input
            id="signup-name"
            placeholder="Jane Cooper"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="signup-email">Email</label>
          <input
            id="signup-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="signup-password">Password</label>
          <input
            id="signup-password"
            type="password"
            placeholder="At least 6 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>

        <button type="submit" className="btn btn--primary btn--block">
          Create Account
        </button>

        <p className="auth-container__footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </Layout>
  );
};

export default Signup;
