import { PrivacyLevel, ReportReason } from './index';

export type ReportStatus = 'open' | 'reviewed' | 'dismissed';

export interface AdminSummary {
  open: number;
  reviewedLast7Days: number;
  dismissedLast7Days: number;
  suspendedUsers: number;
  openAppeals: number;
}

/** All reports about one dream or comment, shown as a single item in the queue. */
export interface AdminCaseSummary {
  key: string;
  targetType: 'dream' | 'comment';
  dreamId: string;
  commentId: string | null;
  reportCount: number;
  openCount: number;
  reasons: Partial<Record<ReportReason, number>>;
  firstReportedAt: string;
  lastReportedAt: string;
  lastResolvedAt: string | null;
  contentExists: boolean;
  /** visible | hidden (automatically, awaiting review) | removed (by a moderator) */
  moderationState: 'visible' | 'hidden' | 'removed';
  title: string;
  excerpt: string;
  authorName: string;
  authorSuspended: boolean;
}

export interface AdminCasesPage {
  cases: AdminCaseSummary[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface AdminReportRow {
  _id: string;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  createdAt: string;
  reporter: { _id: string; name: string } | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string;
}

export interface AdminCaseDetail {
  /** the author's latest appeal about this content, if any */
  appeal: { _id: string; status: AppealStatus; createdAt: string } | null;
  target: {
    type: 'dream' | 'comment';
    dreamId: string;
    commentId: string | null;
    exists: boolean;
    title: string;
    content: string;
    privacyLevel: PrivacyLevel | null;
    draft: boolean;
    moderationState: 'visible' | 'hidden' | 'removed' | null;
    /** the author is hidden from the community: handle their identity with care */
    anonymous: boolean;
    reportedText: string;
    createdAt: string | null;
  };
  author: {
    _id: string;
    name: string;
    /** only administrators receive contact details */
    email: string | null;
    joinedAt: string;
    role: 'user' | 'moderator' | 'admin';
    suspended: boolean;
    suspensionReason: string;
    reportedCases: number;
    removals: number;
    suspensions: number;
  } | null;
  reports: AdminReportRow[];
}

export interface ResolveCaseInput {
  dreamId: string;
  commentId?: string;
  resolution: 'reviewed' | 'dismissed';
  removeContent?: boolean;
  suspendAuthor?: boolean;
  suspensionReason?: string;
  /** what the author is told when their content is removed */
  authorMessage?: string;
  note?: string;
}

export interface SuspendedUser {
  _id: string;
  name: string;
  email: string;
  suspendedAt: string;
  suspensionReason: string;
}

export type AuditAction =
  | 'report_dismissed'
  | 'report_reviewed'
  | 'content_removed'
  | 'user_suspended'
  | 'user_unsuspended'
  | 'viewed_anonymous_author'
  | 'auto_hidden'
  | 'content_restored'
  | 'appeal_upheld'
  | 'appeal_overturned'
  | 'role_changed';

export type AppealStatus = 'open' | 'upheld' | 'overturned';

export interface AppealSummary {
  _id: string;
  targetType: 'dream' | 'comment' | 'account';
  status: AppealStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  authorName: string;
  title: string;
  excerpt: string;
  message: string;
}

export interface AppealDetail {
  appeal: {
    _id: string;
    targetType: 'dream' | 'comment' | 'account';
    status: AppealStatus;
    message: string;
    createdAt: string;
    resolvedAt: string | null;
    resolvedBy: string | null;
    resolutionNote: string;
    /** the moderator whose decision is appealed; they cannot decide it (unless they are an administrator) */
    decidedBy: string | null;
    decidedByMe: boolean;
  };
  author: { name: string; email: string | null; joinedAt: string; suspended: boolean; suspensionReason: string } | null;
  content: { exists: boolean; title: string; text: string; moderationState: 'visible' | 'hidden' | 'removed' | null; moderationMessage: string };
  reasons: ReportReason[];
  /** where the content lives in the reports queue; null for an account appeal */
  target: { dreamId: string; commentId: string | null } | null;
  /** for a comment: the dream (and the comment it answers) around it */
  context: { dreamTitle: string; dreamExcerpt: string; parentExcerpt: string } | null;
}

export interface StaffMember {
  _id: string;
  name: string;
  email: string;
  role: 'user' | 'moderator' | 'admin';
  joinedAt: string;
  suspended: boolean;
}

export interface AuditEntry {
  _id: string;
  action: AuditAction;
  targetType: 'dream' | 'comment' | 'user';
  dreamId: string | null;
  commentId: string | null;
  /** who acted; "System" for automatic actions */
  admin: string;
  targetUser: string | null;
  reportCount: number;
  note: string;
  snapshot: { title: string; content: string };
  createdAt: string;
}
