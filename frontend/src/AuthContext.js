import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

export const AuthContext = createContext();
// somewhere that runs on app startup, e.g. in AuthProvider:


const getInitialAuth = () => {
  const token = localStorage.getItem('token');
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    const user = JSON.parse(localStorage.getItem('user'));
    return { token, user };
  }
  return { token: null, user: null };
};

export const AuthProvider = ({ children }) => {
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }, []);
  const [{ token, user }, setAuth] = useState(getInitialAuth());

  const login = async (username, password) => {
    const { data } = await axios.post('/auth/login', { username, password });
    const { token: newToken, user: newUser } = data;
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setAuth({ token: newToken, user: newUser });
    return newUser;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setAuth({ token: null, user: null });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
