// frontend/app/context/AuthContext.js

'use client';

import { createContext, useContext, useState, useEffect } from 'react';

// Use environment variable, fallback to production URL, then localhost for dev
const API_URL = process.env.NEXT_PUBLIC_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname === 'localhost' 
    ? 'http://localhost:8000' 
    : 'https://lecture-lessons.onrender.com');

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentClass, setCurrentClass] = useState(null);

  useEffect(() => {
    // Check for saved auth on mount
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('access_token');
    const savedClass = localStorage.getItem('current_class');
    
    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser));
      if (savedClass) {
        setCurrentClass(JSON.parse(savedClass));
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const formData = new FormData();
    formData.append('email', email);
    formData.append('password', password);

    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }

    const data = await response.json();
    
    // Save to state and localStorage
    const userData = {
      id: data.user_id,
      email: data.email,
      name: data.name
    };
    
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    
    return data;
  };

  const signup = async (email, password, name) => {
    const formData = new FormData();
    formData.append('email', email);
    formData.append('password', password);
    formData.append('name', name);

    const response = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Signup failed');
    }

    return await response.json();
  };

  const logout = () => {
    setUser(null);
    setCurrentClass(null);
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('current_class');
  };

  const selectClass = (classData) => {
    setCurrentClass(classData);
    if (classData) {
      localStorage.setItem('current_class', JSON.stringify(classData));
    } else {
      localStorage.removeItem('current_class');
    }
  };

  const getAuthHeader = () => {
    const token = localStorage.getItem('access_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  const authFetch = async (url, options = {}) => {
    const headers = {
      ...options.headers,
      ...getAuthHeader()
    };
    
    const response = await fetch(url, { ...options, headers });
    
    // If we get a 401, the token is expired - logout the user
    if (response.status === 401) {
      console.warn('Token expired, logging out...');
      logout();
      // Redirect to login page
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    
    return response;
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      currentClass,
      login,
      signup,
      logout,
      selectClass,
      getAuthHeader,
      authFetch,
      isAuthenticated: !!user,
      API_URL
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

// Export API_URL for use in non-authenticated requests
export const getApiUrl = () => process.env.NEXT_PUBLIC_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname === 'localhost' 
    ? 'http://localhost:8000' 
    : 'https://lecture-lessons.onrender.com');