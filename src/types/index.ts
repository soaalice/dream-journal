export type PrivacyLevel = 'public' | 'private' | 'anonymous';

export type DreamMood =
  | 'happy'
  | 'sad'
  | 'scary'
  | 'confusing'
  | 'exciting'
  | 'peaceful'
  | 'anxious'
  | 'mysterious';

export interface Dream {
  _id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  userId: {
    _id: string;
    name: string;
    avatarUrl: string;
  };
  userName: string;
  privacyLevel: PrivacyLevel;
  tags: string[];
  mood: DreamMood;
  likes: string[];
  comments: Comment[];
  mentions: string[];
}

export interface User {
  _id: string;
  name: string;
  email: string;
  avatarUrl: string;
  bio: string;
  location: string;
  website: string;
  dreamCount: number;
  followersCount: number;
  followingCount: number;
  joinedAt: string;
}

export interface Comment {
  _id: string;
  content: string;
  userId: string;
  userName: string;
  userAvatar: string;
  createdAt: string;
  mentions: string[];
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  avatarUrl: string;
}

export interface ProfileUpdateData {
  name: string;
  bio: string;
  location: string;
  website: string;
  avatarUrl: string;
}