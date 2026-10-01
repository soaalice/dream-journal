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

export interface DreamAuthor {
  _id: string;
  name: string;
  avatarUrl: string;
}

export interface Dream {
  _id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  /** null when the dream is anonymous and the viewer is not its author */
  userId: DreamAuthor | null;
  userName: string;
  isOwner: boolean;
  privacyLevel: PrivacyLevel;
  tags: string[];
  mood: DreamMood;
  likesCount: number;
  likedByMe: boolean;
  comments: Comment[];
  mentions: string[];
}

export interface DreamInput {
  title: string;
  content: string;
  privacyLevel: PrivacyLevel;
  tags: string[];
  mood: DreamMood;
  mentions?: string[];
}

export interface FeedParams {
  page?: number;
  limit?: number;
  /** comma-separated tags (OR) */
  tag?: string;
  /** comma-separated moods (OR) */
  mood?: string;
  q?: string;
}

export interface FeedPage {
  dreams: Dream[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface User {
  _id: string;
  name: string;
  /** only present on the authenticated user's own profile */
  email?: string;
  avatarUrl: string;
  bio: string;
  location: string;
  website: string;
  dreamCount: number;
  followersCount: number;
  followingCount: number;
  isFollowing?: boolean;
  joinedAt: string;
}

export interface Comment {
  _id: string;
  content: string;
  userId: string | null;
  userName: string;
  userAvatar: string;
  createdAt: string;
  mentions: string[];
  canDelete: boolean;
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

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export interface ProfileUpdateData {
  name: string;
  bio: string;
  location: string;
  website: string;
  avatarUrl: string;
}