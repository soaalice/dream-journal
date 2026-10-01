import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError, setUnauthorizedHandler } from '../lib/api';
import { ChangePasswordData, LoginCredentials, ProfileUpdateData, RegisterData, User } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: ProfileUpdateData) => Promise<void>;
  changePassword: (data: ChangePasswordData) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const messageOf = (error: unknown, fallback: string) =>
  error instanceof ApiError || error instanceof Error ? error.message : fallback;

/**
 * Session lives in an httpOnly cookie set by the server, so no token is ever
 * readable from JavaScript (or from localStorage) and XSS cannot steal it.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api<{ user: User }>('/auth/me', { signal: controller.signal, skipAuthHandler: true })
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  const authenticate = useCallback(
    async (path: string, body: unknown, fallback: string) => {
      try {
        const data = await api<{ user: User }>(path, { method: 'POST', body, skipAuthHandler: true });
        setUser(data.user);
        setError(null);
      } catch (err) {
        setError(messageOf(err, fallback));
        throw err;
      }
    },
    []
  );

  const login = useCallback(
    (credentials: LoginCredentials) => authenticate('/auth/login', credentials, 'Login failed'),
    [authenticate]
  );

  const register = useCallback(
    (data: RegisterData) => {
      const payload = { name: data.name, email: data.email, password: data.password, avatarUrl: data.avatarUrl };
      return authenticate('/auth/register', payload, 'Registration failed');
    },
    [authenticate]
  );

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST', skipAuthHandler: true });
    } finally {
      setUser(null);
    }
  }, []);

  const updateProfile = useCallback(async (data: ProfileUpdateData) => {
    setUser(await api<User>('/users/profile', { method: 'PUT', body: data }));
  }, []);

  const changePassword = useCallback(async (data: ChangePasswordData) => {
    await api('/users/password', { method: 'PUT', body: data, skipAuthHandler: true });
  }, []);

  const deleteAccount = useCallback(async (password: string) => {
    await api('/users/me', { method: 'DELETE', body: { password }, skipAuthHandler: true });
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user !== null,
      loading,
      error,
      login,
      register,
      logout,
      updateProfile,
      changePassword,
      deleteAccount
    }),
    [user, loading, error, login, register, logout, updateProfile, changePassword, deleteAccount]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
