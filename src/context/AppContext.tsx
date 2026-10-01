import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { Dream, DreamInput, FeedPage, FeedParams, MyDreamsPage, MyDreamsParams } from '../types';
import { useAuth } from './AuthContext';

interface AppContextType {
  userDreams: Dream[];
  publicFeed: Dream[];
  allDreams: Dream[];
  /** true until the first feed request settles */
  feedLoading: boolean;
  /**
   * Bumped whenever something that changes *which* dreams are visible happens (blocking or unblocking someone).
   * Screens that keep their own paginated lists include it in their dependencies to refetch.
   */
  dataVersion: number;
  reloadDreams: () => void;
  fetchFeed: (params?: FeedParams) => Promise<FeedPage>;
  fetchMyDreams: (params?: MyDreamsParams) => Promise<MyDreamsPage>;
  fetchDream: (id: string) => Promise<Dream>;
  addDream: (dream: DreamInput) => Promise<Dream>;
  updateDream: (id: string, dream: Partial<DreamInput>) => Promise<Dream>;
  deleteDream: (id: string) => Promise<void>;
  likeDream: (dreamId: string) => Promise<void>;
  addComment: (dreamId: string, content: string, mentions?: string[], parentId?: string) => Promise<void>;
  deleteComment: (dreamId: string, commentId: string) => Promise<void>;
  searchUsers: (query: string) => Promise<Array<{ _id: string; name: string; avatarUrl?: string }>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const userId = user?._id;

  const [dreams, setDreams] = useState<Record<string, Dream>>({});
  const [feedLoading, setFeedLoading] = useState(true);
  const [dataVersion, setDataVersion] = useState(0);

  const upsert = useCallback((incoming: Dream[]) => {
    setDreams((prev) => {
      const next = { ...prev };
      incoming.forEach((d) => {
        next[d._id] = d;
      });
      return next;
    });
  }, []);

  const reloadDreams = useCallback(() => setDataVersion((v) => v + 1), []);

  const fetchFeed = useCallback(
    async (params: FeedParams = {}) => {
      const page = await api<FeedPage>('/dreams/feed', { query: { ...params } });
      upsert(page.dreams);
      return page;
    },
    [upsert]
  );

  const fetchMyDreams = useCallback(
    async (params: MyDreamsParams = {}) => {
      const page = await api<MyDreamsPage>('/dreams/mine', { query: { ...params } });
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

  // Reload the shared feed when the session changes (likedByMe and ownership depend on the viewer) or when
  // blocks change what is visible.
  useEffect(() => {
    setDreams({});
    setFeedLoading(true);
    const controller = new AbortController();
    api<FeedPage>('/dreams/feed', { query: { limit: 50 }, signal: controller.signal })
      .then((feed) => upsert(feed.dreams))
      .catch((error) => {
        if (!controller.signal.aborted) console.error('Error fetching dreams:', error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setFeedLoading(false);
      });
    return () => controller.abort();
  }, [userId, dataVersion, upsert]);

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

  // Optimistic: the heart flips immediately and rolls back if the request fails.
  const likeDream = useCallback(
    async (dreamId: string) => {
      let previous: Dream | undefined;
      setDreams((prev) => {
        previous = prev[dreamId];
        if (!previous) return prev;
        const liked = !previous.likedByMe;
        return {
          ...prev,
          [dreamId]: { ...previous, likedByMe: liked, likesCount: previous.likesCount + (liked ? 1 : -1) }
        };
      });
      try {
        upsert([await api<Dream>(`/dreams/${dreamId}/like`, { method: 'POST' })]);
      } catch (error) {
        const original = previous;
        if (original) upsert([original]);
        throw error;
      }
    },
    [upsert]
  );

  const addComment = useCallback(
    async (dreamId: string, content: string, mentions: string[] = [], parentId?: string) => {
      upsert([await api<Dream>(`/dreams/${dreamId}/comments`, { method: 'POST', body: { content, mentions, parentId } })]);
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

  const value = useMemo<AppContextType>(() => {
    const all = Object.values(dreams).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      allDreams: all,
      userDreams: all.filter((d) => d.isOwner && d.status !== 'draft'),
      publicFeed: all.filter((d) => d.privacyLevel !== 'private' && d.status !== 'draft'),
      feedLoading,
      dataVersion,
      reloadDreams,
      fetchFeed,
      fetchMyDreams,
      fetchDream,
      addDream,
      updateDream,
      deleteDream,
      likeDream,
      addComment,
      deleteComment,
      searchUsers
    };
  }, [
    dreams,
    feedLoading,
    dataVersion,
    reloadDreams,
    fetchFeed,
    fetchMyDreams,
    fetchDream,
    addDream,
    updateDream,
    deleteDream,
    likeDream,
    addComment,
    deleteComment,
    searchUsers
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

/** Combined auth + dreams API used by pages and components. */
export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  const auth = useAuth();
  return { ...auth, ...context };
};
