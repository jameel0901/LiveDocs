import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from './config';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('user', JSON.stringify(data));
        navigate('/dashboard');
      } else {
        alert('Login failed');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to connect to server');
    }
  };

  return (

    <form className="auth-container" onSubmit={handleSubmit}>

      <h2>Login</h2>
      <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
      <button type="submit">Login</button>

      <p style={{ textAlign: 'center', marginTop: '0.5rem' }}>

        No account? <a href="/signup">Sign Up</a>
      </p>
    </form>
  );
};

export default Login;
