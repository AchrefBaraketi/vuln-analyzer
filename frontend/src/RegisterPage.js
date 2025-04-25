// frontend/src/RegisterPage.js
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const RegisterPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  // Fetch available roles on mount
  useEffect(() => {
    axios.get('/roles')
      .then(res => {
        setRoles(res.data);
        if (res.data.length) setSelectedRole(res.data[0]._id);
      })
      .catch(() => setMessage('Failed to load roles'));
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setMessage('❌ Passwords do not match');
      return;
    }
    try {
      await axios.post('/auth/register', { username, password, roleId: selectedRole });
      setMessage('✅ Registered successfully');
      setTimeout(() => navigate('/login'), 1000);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Registration failed');
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#121212' }}>
      <div style={{ background: '#1e1e1e', padding: 40, borderRadius: 12, width: 400, color: '#fff', boxShadow: '0 0 20px rgba(0,0,0,0.4)' }}>
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <img src="/logo-dark.png" alt="Logo" style={{ width: 80, borderRadius: 10 }} />
          <h2 style={{ marginTop: 10 }}>📝 Register</h2>
        </div>
        <form onSubmit={handleRegister}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            style={{ width: '93%', padding: 12, marginBottom: 12, borderRadius: 6, border: '1px solid #333', background: '#2c2c2c', color: '#fff' }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{ width: '93%', padding: 12, marginBottom: 12, borderRadius: 6, border: '1px solid #333', background: '#2c2c2c', color: '#fff' }}
          />
          <input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
            style={{ width: '93%', padding: 12, marginBottom: 12, borderRadius: 6, border: '1px solid #333', background: '#2c2c2c', color: '#fff' }}
          />
          <select
            value={selectedRole}
            onChange={e => setSelectedRole(e.target.value)}
            required
            style={{ width: '100%', padding: 12, marginBottom: 12, borderRadius: 6, border: '1px solid #333', background: '#2c2c2c', color: '#fff' }}
          >
            {roles.map(r => (
              <option key={r._id} value={r._id}>{r.name}</option>
            ))}
          </select>
          <button type="submit" style={{ width: '100%', padding: 12, backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold' }}>
            Register
          </button>
        </form>
        {message && <p style={{ color: message.startsWith('✅') ? '#00e676' : '#ff5252', marginTop: 10 }}>{message}</p>}
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <p>Already have an account? <Link to="/login" style={{ color: '#00bcd4', textDecoration: 'none' }}>Login</Link></p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;