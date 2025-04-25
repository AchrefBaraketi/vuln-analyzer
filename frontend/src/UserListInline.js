import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from './AuthContext';

const listContainer = (darkMode) => ({
  listStyle: 'none',
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  margin: '20px 0'
});

const listItem = (darkMode) => ({
  padding: 16,
  borderRadius: 10,
  backgroundColor: darkMode ? '#2b2b2b' : '#f5f5f5',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  boxShadow: darkMode ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 6px rgba(0,0,0,0.1)',
  transition: 'background-color 0.3s ease'
});

// Add at the very top, after your imports:
const confirmBtnStyle = {
  padding: '8px 16px',
  backgroundColor: '#28a745',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer'
};

const cancelBtnStyle = {
  padding: '8px 16px',
  backgroundColor: '#6c757d',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer'
};


const buttonStyle = {
  padding: '6px 12px',
  border: 'none',
  borderRadius: 6,
  fontSize: 14,
  cursor: 'pointer'
};

const addBtn = (darkMode) => ({
  ...buttonStyle,
  backgroundColor: '#28a745',
  color: '#fff'
});

const editBtn = {
  ...buttonStyle,
  backgroundColor: '#17a2b8',
  color: '#fff'
};

const deleteBtn = {
  ...buttonStyle,
  backgroundColor: '#dc3545',
  color: '#fff'
};

const modalOverlay = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999
};

const modalBox = (darkMode) => ({
  backgroundColor: darkMode ? '#2c2c2c' : '#fff',
  color: darkMode ? '#fff' : '#000',
  padding: 30, borderRadius: 10, width: 360,
  boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
});

const UserListInline = ({ darkMode }) => {
  const { user } = useContext(AuthContext);
  const token = localStorage.getItem('token');
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [popup, setPopup] = useState(null);
  const [form, setForm] = useState({ id: '', username: '', password: '', roleId: '' });

  const authHdr = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    if (user?.role === 'admin') {
      axios.get('/users', authHdr).then(r => setUsers(r.data));
      axios.get('/roles', authHdr).then(r => setRoles(r.data));
    }
  }, [user]);

  if (!user || user.role !== 'admin') {
    return <p style={{ padding: 20 }}>❌ Access denied. Admins only.</p>;
  }

  const openAdd = () => {
    setForm({ id: '', username: '', password: '', roleId: roles[0]?._id || '' });
    setPopup('add');
  };

  const openEdit = u => {
    setForm({ id: u.id, username: u.username, password: '', roleId: u.roleId });
    setPopup('edit');
  };

  const submit = async () => {
    try {
      if (popup === 'add') {
        await axios.post('/users', { username: form.username, password: form.password, roleId: form.roleId }, authHdr);
      } else {
        await axios.put(`/users/${form.id}`, { username: form.username, roleId: form.roleId }, authHdr);
      }
      setPopup(null);
      setUsers((await axios.get('/users', authHdr)).data);
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    }
  };

  const doDelete = async id => {
    if (!window.confirm('Delete this user?')) return;
    await axios.delete(`/users/${id}`, authHdr);
    setUsers(users.filter(u => u.id !== id));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>👥 User Management</h2>
        <button onClick={openAdd} style={addBtn(darkMode)}>➕ Add User</button>
      </div>

      <ul style={listContainer(darkMode)}>
        {users.map(u => (
          <li key={u.id} style={listItem(darkMode)}>
            <span>{u.username}</span>
            <span>{u.roleName || u.role}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => openEdit(u)} style={editBtn}>✏️ Edit</button>
              <button onClick={() => doDelete(u.id)} style={deleteBtn}>🗑️ Delete</button>
            </div>
          </li>
        ))}
      </ul>

      {popup && (
        <div style={modalOverlay}>
          <div style={modalBox(darkMode)}>
            <h3>{popup === 'add' ? 'Add User' : 'Edit User'}</h3>
            <input
              placeholder="Username"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              style={{ width: '94%', margin: '12px 0', padding: 8, borderRadius: 6 }}
            />
            {popup === 'add' && (
              <input
                type="password"
                placeholder="Password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                style={{ width: '94%', margin: '12px 0', padding: 8, borderRadius: 6 }}
              />
            )}
            <select
              value={form.roleId}
              onChange={e => setForm(f => ({ ...f, roleId: e.target.value }))}
              disabled={popup === 'edit'}
              style={{
                width: '100%',
                margin: '8px 0',
                padding: 8,
                backgroundColor: popup === 'edit' ? '#e9ecef' : undefined,  // optional: grey it out
                color: popup === 'edit' ? '#6c757d' : undefined
              }}
            >
              {roles.map(r => (
                <option key={r._id} value={r._id}>
                  {r.name}
                </option>
              ))}
            </select>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
              <button onClick={() => setPopup(null)} style={cancelBtnStyle}>❌ Cancel</button>
              <button onClick={submit} style={confirmBtnStyle}>✅ Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserListInline;