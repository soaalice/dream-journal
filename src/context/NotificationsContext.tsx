import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';

interface NotificationsContextType {
  unreadCount: number;
  /** re-fetch the badge now (the inbox page calls this after changes) */
  refreshUnread: () => Promise<void>;
  setUnreadCount: (count: number) => void;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

const POLL_MS = 45_000;

/**
 * Keeps the unread badge fresh: polls while the tab is visible and refreshes when it regains
 * focus. Polling is deliberately simple; swap it for Server-Sent Events later without touching
 * the components that read `unreadCount`.
 */
export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const userId = user?._id;
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnread = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await api<{ unreadCount: number }>('/notifications/unread-count');
      setUnreadCount(data.unreadCount);
    } catch {
      /* the badge is a convenience: ignore transient failures */
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }
    refreshUnread();

    const tick = () => {
      if (!document.hidden) refreshUnread();
    };
    const interval = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, [userId, refreshUnread]);

  const value = useMemo(() => ({ unreadCount, refreshUnread, setUnreadCount }), [unreadCount, refreshUnread]);
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};

export const useNotifications = (): NotificationsContextType => {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationsProvider');
  return context;
};
