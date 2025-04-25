import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from './AuthContext';

const LoginPage = () => {
  const { login } = useContext(AuthContext);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#121212' }}>
      <div style={{ background: '#1e1e1e', padding: 40, borderRadius: 12, width: 400, color: '#fff', boxShadow: '0 0 20px rgba(0,0,0,0.4)' }}>
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <img src="/logo-dark.png" alt="Logo" style={{ width: 80, borderRadius: 10 }} />
          <h2 style={{ marginTop: 10 }}>🔐 Login</h2>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: '93%', padding: 12, marginBottom: 12, borderRadius: 6, border: '1px solid #333', background: '#2c2c2c', color: '#fff' }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '93%', padding: 12, marginBottom: 12, borderRadius: 6, border: '1px solid #333', background: '#2c2c2c', color: '#fff' }}
          />
          <button
            type="submit"
            style={{ width: '100%', padding: 12, backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold' }}
          >
            Login
          </button>
        </form>
        {error && <p style={{ color: 'tomato', marginTop: 10 }}>{error}</p>}
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <p>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: '#00bcd4', textDecoration: 'none' }}>Register</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
