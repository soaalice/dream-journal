import React, { createContext, useContext, useState, useEffect } from 'react';
import { Dream, User, AuthState, LoginCredentials, RegisterData, ProfileUpdateData } from '../types';

interface AppContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  userDreams: Dream[];
  publicFeed: Dream[];
  allDreams: Dream[];
  isDarkMode: boolean;
  setIsDarkMode: (value: boolean) => void;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  updateProfile: (data: ProfileUpdateData) => Promise<void>;
  addDream: (dream: Omit<Dream, '_id' | 'createdAt' | 'updatedAt' | 'userId' | 'userName' | 'comments' | 'likes' | 'mentions'>) => Promise<void>;
  likeDream: (dreamId: string) => Promise<void>;
  addComment: (dreamId: string, content: string, mentions: string[]) => Promise<void>;
  searchUsers: (query: string) => Promise<Array<{ _id: string; name: string }>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const API_URL = 'http://localhost:5000/api';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    loading: true,
    error: null
  });

  const [dreamsList, setDreamsList] = useState<Dream[]>([]);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (token && userData) {
      try {
        const user = JSON.parse(userData);
        setAuthState({
          isAuthenticated: true,
          user,
          loading: false,
          error: null
        });
      } catch (error) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setAuthState({
          isAuthenticated: false,
          user: null,
          loading: false,
          error: 'Invalid session'
        });
      }
    } else {
      setAuthState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    const fetchDreams = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers: HeadersInit = {
          'Content-Type': 'application/json'
        };

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        // Fetch public feed
        const feedResponse = await fetch(`${API_URL}/dreams/feed`, { headers });
        if (!feedResponse.ok) throw new Error('Failed to fetch dreams feed');
        const feedData = await feedResponse.json();

        // Fetch user dreams if authenticated and we have a user ID
        let userDreams: Dream[] = [];
        if (authState.user?._id) {
          try {
            const userDreamsResponse = await fetch(
              `${API_URL}/dreams/user/${authState.user._id}`,
              { headers }
            );
            if (userDreamsResponse.ok) {
              userDreams = await userDreamsResponse.json();
            }
          } catch (error) {
            console.error('Error fetching user dreams:', error);
          }
        }

        // Combine and deduplicate dreams
        const allDreams = [...feedData, ...userDreams];
        const uniqueDreams = allDreams.filter((dream, index, self) =>
          index === self.findIndex((d) => d._id === dream._id)
        );

        setDreamsList(uniqueDreams);
      } catch (error) {
        console.error('Error fetching dreams:', error);
      }
    };

    fetchDreams();
  }, [authState.isAuthenticated, authState.user?._id]);

  const login = async (credentials: LoginCredentials) => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      setAuthState({
        isAuthenticated: true,
        user: data.user,
        loading: false,
        error: null
      });
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Login failed'
      }));
      throw error;
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || 'Registration failed');
      }

      localStorage.setItem('token', responseData.token);
      localStorage.setItem('user', JSON.stringify(responseData.user));

      setAuthState({
        isAuthenticated: true,
        user: responseData.user,
        loading: false,
        error: null
      });
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Registration failed'
      }));
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setAuthState({
      isAuthenticated: false,
      user: null,
      loading: false,
      error: null
    });
    setDreamsList([]);
  };

  const updateProfile = async (data: ProfileUpdateData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });

      const updatedUser = await response.json();

      if (!response.ok) {
        throw new Error(updatedUser.message || 'Profile update failed');
      }

      localStorage.setItem('user', JSON.stringify(updatedUser));
      setAuthState(prev => ({
        ...prev,
        user: updatedUser
      }));
    } catch (error) {
      throw error;
    }
  };

  const userDreamsList = dreamsList.filter(dream =>
    authState.user?._id === dream.userId
  );

  const publicFeedList = dreamsList.filter(dream =>
    dream.privacyLevel === 'public' || dream.privacyLevel === 'anonymous'
  );

  const addDream = async (dream: Omit<Dream, '_id' | 'createdAt' | 'updatedAt' | 'userId' | 'userName' | 'comments' | 'likes' | 'mentions'>) => {
    if (!authState.user) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/dreams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(dream)
      });

      if (!response.ok) {
        throw new Error('Failed to create dream');
      }

      const newDream = await response.json();
      setDreamsList(prevDreams => [newDream, ...prevDreams]);
    } catch (error) {
      console.error('Error creating dream:', error);
      throw error;
    }
  };

  const likeDream = async (dreamId: string) => {
    if (!authState.isAuthenticated) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/dreams/${dreamId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to update like');
      }

      const updatedDream = await response.json();
      setDreamsList(prevDreams =>
        prevDreams.map(dream =>
          dream._id === dreamId ? updatedDream : dream
        )
      );
    } catch (error) {
      console.error('Error updating like:', error);
      throw error;
    }
  };

  const addComment = async (dreamId: string, content: string, mentions: string[] = []) => {
    if (!authState.user) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/dreams/${dreamId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content, mentions })
      });

      if (!response.ok) {
        throw new Error('Failed to add comment');
      }

      const updatedDream = await response.json();
      setDreamsList(prevDreams =>
        prevDreams.map(dream =>
          dream._id === dreamId ? updatedDream : dream
        )
      );
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  };

  const searchUsers = async (query: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/users/search/${query}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to search users');
      }

      return await response.json();
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  };

  const value = {
    user: authState.user,
    isAuthenticated: authState.isAuthenticated,
    loading: authState.loading,
    error: authState.error,
    userDreams: userDreamsList,
    publicFeed: publicFeedList,
    allDreams: dreamsList,
    isDarkMode,
    setIsDarkMode,
    login,
    register,
    logout,
    updateProfile,
    addDream,
    likeDream,
    addComment,
    searchUsers
  };

  if (authState.loading) {
    return <div>Loading...</div>;
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};