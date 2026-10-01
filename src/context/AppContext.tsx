import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { Dream, DreamInput, FeedPage, FeedParams, User } from '../types';
import { useAuth } from './AuthContext';

interface AppContextType {
  userDreams: Dream[];
  publicFeed: Dream[];
  allDreams: Dream[];
  isDarkMode: boolean;
  setIsDarkMode: (value: boolean) => void;
  fetchFeed: (params?: FeedParams) => Promise<FeedPage>;
  fetchDream: (id: string) => Promise<Dream>;
  fetchUserDreams: (userId: string) => Promise<Dream[]>;
  addDream: (dream: DreamInput) => Promise<Dream>;
  updateDream: (id: string, dream: Partial<DreamInput>) => Promise<Dream>;
  deleteDream: (id: string) => Promise<void>;
  likeDream: (dreamId: string) => Promise<void>;
  addComment: (dreamId: string, content: string, mentions?: string[]) => Promise<void>;
  deleteComment: (dreamId: string, commentId: string) => Promise<void>;
  searchUsers: (query: string) => Promise<Array<{ _id: string; name: string; avatarUrl?: string }>>;
  getUser: (id: string) => Promise<User>;
  toggleFollow: (id: string) => Promise<User>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const THEME_KEY = 'theme';

const readStoredTheme = (): boolean => {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored) return stored === 'dark';
  } catch {
    /* storage unavailable */
  }
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const userId = user?._id;

  const [dreams, setDreams] = useState<Record<string, Dream>>({});
  const [isDarkMode, setDarkMode] = useState<boolean>(readStoredTheme);

  const setIsDarkMode = useCallback((value: boolean) => {
    setDarkMode(value);
    try {
      localStorage.setItem(THEME_KEY, value ? 'dark' : 'light');
    } catch {
      /* storage unavailable */
    }
  }, []);

  const upsert = useCallback((incoming: Dream[]) => {
    setDreams((prev) => {
      const next = { ...prev };
      incoming.forEach((d) => {
        next[d._id] = d;
      });
      return next;
    });
  }, []);

  const fetchFeed = useCallback(
    async (params: FeedParams = {}) => {
      const page = await api<FeedPage>('/dreams/feed', { query: { ...params } });
      upsert(page.dreams);
      return page;
    },
    [upsert]
  );

  const fetchDream = useCallback(
    async (id: string) => {
      const dream = await api<Dream>(`/dreams/${id}`);
      upsert([dream]);
      return dream;
    },
    [upsert]
  );

  const fetchUserDreams = useCallback(
    async (id: string) => {
      const list = await api<Dream[]>(`/dreams/user/${id}`);
      upsert(list);
      return list;
    },
    [upsert]
  );

  // Reload visible dreams whenever the session changes (likedByMe / ownership depend on the viewer).
  useEffect(() => {
    setDreams({});
    const controller = new AbortController();
    const load = async () => {
      try {
        const feed = await api<FeedPage>('/dreams/feed', {
          query: { limit: 50 },
          signal: controller.signal
        });
        upsert(feed.dreams);
        if (userId) upsert(await api<Dream[]>(`/dreams/user/${userId}`, { signal: controller.signal }));
      } catch (error) {
        if (!controller.signal.aborted) console.error('Error fetching dreams:', error);
      }
    };
    load();
    return () => controller.abort();
  }, [userId, upsert]);

  const addDream = useCallback(
    async (input: DreamInput) => {
      const dream = await api<Dream>('/dreams', { method: 'POST', body: input });
      upsert([dream]);
      return dream;
    },
    [upsert]
  );

  const updateDream = useCallback(
    async (id: string, input: Partial<DreamInput>) => {
      const dream = await api<Dream>(`/dreams/${id}`, { method: 'PUT', body: input });
      upsert([dream]);
      return dream;
    },
    [upsert]
  );

  const deleteDream = useCallback(async (id: string) => {
    await api(`/dreams/${id}`, { method: 'DELETE' });
    setDreams((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const likeDream = useCallback(
    async (dreamId: string) => {
      upsert([await api<Dream>(`/dreams/${dreamId}/like`, { method: 'POST' })]);
    },
    [upsert]
  );

  const addComment = useCallback(
    async (dreamId: string, content: string, mentions: string[] = []) => {
      upsert([await api<Dream>(`/dreams/${dreamId}/comments`, { method: 'POST', body: { content, mentions } })]);
    },
    [upsert]
  );

  const deleteComment = useCallback(
    async (dreamId: string, commentId: string) => {
      upsert([await api<Dream>(`/dreams/${dreamId}/comments/${commentId}`, { method: 'DELETE' })]);
    },
    [upsert]
  );

  const searchUsers = useCallback(async (query: string) => {
    if (query.trim().length < 2) return [];
    try {
      return await api<Array<{ _id: string; name: string; avatarUrl?: string }>>('/users/search', {
        query: { q: query }
      });
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  }, []);

  const getUser = useCallback((id: string) => api<User>(`/users/${id}`), []);
  const toggleFollow = useCallback((id: string) => api<User>(`/users/${id}/follow`, { method: 'POST' }), []);

  const value = useMemo<AppContextType>(() => {
    const all = Object.values(dreams).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      allDreams: all,
      userDreams: all.filter((d) => d.isOwner),
      publicFeed: all.filter((d) => d.privacyLevel !== 'private'),
      isDarkMode,
      setIsDarkMode,
      fetchFeed,
      fetchDream,
      fetchUserDreams,
      addDream,
      updateDream,
      deleteDream,
      likeDream,
      addComment,
      deleteComment,
      searchUsers,
      getUser,
      toggleFollow
    };
  }, [
    dreams,
    isDarkMode,
    setIsDarkMode,
    fetchFeed,
    fetchDream,
    fetchUserDreams,
    addDream,
    updateDream,
    deleteDream,
    likeDream,
    addComment,
    deleteComment,
    searchUsers,
    getUser,
    toggleFollow
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

/** Combined auth + dreams + theme API used by pages and components. */
export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  const auth = useAuth();
  return { ...auth, ...context };
};
