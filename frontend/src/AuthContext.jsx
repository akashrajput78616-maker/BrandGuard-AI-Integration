import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE } from './brandguardApi';

const AuthContext = createContext(null);

const DEFAULT_DEMO_USER = {
  user_id: 'user-admin',
  email: 'admin@acmecloudsync.com',
  name: 'Sarah Chen',
  avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
  tenant_id: 'default-tenant',
  tenant_name: 'Acme CloudSync',
  role: 'Admin',
  permissions: ['read', 'write', 'comment', 'review', 'approve', 'reject', 'admin', 'manage_webhooks'],
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('bg_auth_user');
      return saved ? JSON.parse(saved) : DEFAULT_DEMO_USER;
    } catch {
      return DEFAULT_DEMO_USER;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('bg_auth_token') || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      localStorage.setItem('bg_auth_user', JSON.stringify(user));
    }
    if (token) {
      localStorage.setItem('bg_auth_token', token);
    }
  }, [user, token]);

  const login = async (email, role = 'Editor', provider = 'google') => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role, provider }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setToken(data.access_token);
        return data.user;
      }
    } catch (err) {
      console.warn('Backend auth offline, using local fallback credentials:', err);
      const fallbackUser = {
        ...DEFAULT_DEMO_USER,
        email,
        name: email.split('@')[0].replace('.', ' ').toUpperCase(),
        role,
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
      };
      setUser(fallbackUser);
      return fallbackUser;
    } finally {
      setLoading(false);
    }
  };

  const switchRole = async (newRole) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/switch-role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        if (data.access_token) setToken(data.access_token);
        return;
      }
    } catch (e) {
      console.warn('Switch role error:', e);
    }
    // Local fallback update
    setUser((prev) => ({ ...prev, role: newRole }));
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch (e) {
      // Ignore network errors on logout
    }
    setUser(null);
    setToken('');
    localStorage.removeItem('bg_auth_user');
    localStorage.removeItem('bg_auth_token');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        switchRole,
        isAdmin: user?.role === 'Admin',
        isReviewer: user?.role === 'Reviewer' || user?.role === 'Admin',
        isEditor: ['Editor', 'Reviewer', 'Admin'].includes(user?.role),
        isViewer: user?.role === 'Viewer',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
