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
  /** drafts are visible to their author only */
  status: DreamStatus;
  /** set only for the author when moderators hid or removed the dream */
  moderation: ModerationInfo | null;
  privacyLevel: PrivacyLevel;
  tags: string[];
  mood: DreamMood;
  likesCount: number;
  likedByMe: boolean;
  /** comments that are shown (placeholders for deleted/hidden ones are not counted) */
  commentsCount: number;
  /** flat list; use `parentId` to build the thread */
  comments: Comment[];
  mentions: string[];
}

export type DreamStatus = 'draft' | 'published';

export interface ModerationInfo {
  /** hidden = automatically, waiting for a moderator; removed = a moderator's decision */
  state: 'hidden' | 'removed';
  message: string;
}

export interface DreamInput {
  title: string;
  content: string;
  privacyLevel: PrivacyLevel;
  tags: string[];
  mood: DreamMood;
  mentions?: string[];
  /** defaults to published */
  status?: DreamStatus;
}

export interface MyDreamsParams {
  page?: number;
  limit?: number;
  status?: DreamStatus;
  privacyLevel?: PrivacyLevel;
}

export interface MyDreamsPage extends FeedPage {
  counts: Record<'all' | PrivacyLevel | 'draft', number>;
}

export type ReportReason = 'spam' | 'harassment' | 'hate' | 'sexual' | 'violence' | 'self_harm' | 'other';

export interface BlockedUser {
  _id: string;
  createdAt: string;
  /** true when the block was made from anonymous content: no name or avatar is known */
  anonymous: boolean;
  user: { name: string; avatarUrl: string } | null;
}

export interface BlocksPage {
  blocks: BlockedUser[];
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
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
  joinedAt: string;
  /** administrators get the moderation panel; the server re-checks this on every request */
  role: 'user' | 'moderator' | 'admin';
}

export interface Comment {
  _id: string;
  /** the comment this one replies to, null for top-level comments */
  parentId: string | null;
  content: string;
  userId: string | null;
  userName: string;
  userAvatar: string;
  createdAt: string;
  mentions: string[];
  canDelete: boolean;
  /** written by the signed-in user */
  isOwn: boolean;
  /** an empty placeholder kept because replies still hang under it (deleted, or by someone you blocked) */
  deleted: boolean;
  /** set only for the author when moderators hid or removed their comment */
  moderation: ModerationInfo | null;
}

export type NotificationType = 'comment' | 'reply' | 'mention' | 'like' | 'moderation';

export type ModerationEvent = 'removed' | 'hidden' | 'restored' | 'appeal_upheld' | 'appeal_overturned';

/** What moderators did with the person's content; carries its own copy of the text. */
export interface ModerationNotice {
  event: ModerationEvent;
  kind: 'dream' | 'comment';
  title: string;
  excerpt: string;
  message: string;
  reasons: ReportReason[];
  appeal: { status: 'open' | 'upheld' | 'overturned' } | null;
  canAppeal: boolean;
}

export interface AppNotification {
  _id: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  /** for likes: how many likes this grouped row stands for */
  count: number;
  /** null when the actor is hidden (anonymous author) or no longer exists */
  actor: DreamAuthor | null;
  dream: { _id: string; title: string } | null;
  commentId: string | null;
  /** present when type is `moderation` */
  moderation?: ModerationNotice;
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