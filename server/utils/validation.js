import { z } from 'zod';

export const MOODS = ['happy', 'sad', 'scary', 'confusing', 'exciting', 'peaceful', 'anxious', 'mysterious'];
export const PRIVACY_LEVELS = ['public', 'private', 'anonymous'];
export const REPORT_REASONS = ['spam', 'harassment', 'hate', 'sexual', 'violence', 'self_harm', 'other'];

/** Replies may nest this deep (top-level comments are depth 0). */
export const MAX_REPLY_DEPTH = 4;
/** A user can keep this many unpublished drafts. */
export const MAX_DRAFTS = 50;

export const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

const emptyToUndefined = (v) => (v === '' ? undefined : v);

export const buildAvatarUrl = (allowedHosts) =>
  z.preprocess(
    emptyToUndefined,
    z
      .string()
      .max(500)
      .refine((value) => {
        try {
          const url = new URL(value);
          return url.protocol === 'https:' && allowedHosts.includes(url.hostname.toLowerCase());
        } catch {
          return false;
        }
      }, 'Avatar must be an https URL from an allowed host')
      .optional()
  );

const website = z.preprocess(
  (v) => (v === undefined ? '' : v),
  z
    .string()
    .max(200)
    .refine((value) => {
      if (value === '') return true;
      try {
        const { protocol } = new URL(value);
        return protocol === 'https:' || protocol === 'http:';
      } catch {
        return false;
      }
    }, 'Website must be a valid http(s) URL')
);

export const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

export const buildSchemas = (allowedHosts) => {
  const avatarUrl = buildAvatarUrl(allowedHosts);
  const name = z.string().trim().min(2).max(50);
  const mentions = z.array(objectId).max(20).default([]);

  const tags = z
    .array(z.string().trim().toLowerCase().min(1).max(30))
    .max(10)
    .transform((list) => [...new Set(list)]);

  // A dream that is published (visible to others) must be complete.
  const dreamPublished = z.object({
    status: z.literal('published').default('published'),
    title: z.string().trim().min(1).max(120),
    content: z.string().trim().min(10).max(10000),
    privacyLevel: z.enum(PRIVACY_LEVELS),
    tags: tags.default([]),
    mood: z.enum(MOODS),
    mentions
  });

  // A draft only needs some text; everything else has a default and is checked again on publish.
  const dreamDraft = z.object({
    status: z.literal('draft'),
    title: z.string().trim().max(120).default(''),
    content: z.string().trim().min(1).max(10000),
    privacyLevel: z.enum(PRIVACY_LEVELS).default('private'),
    tags: tags.default([]),
    mood: z.enum(MOODS).default('peaceful'),
    mentions
  });

  const defaultToPublished = (value) =>
    value && typeof value === 'object' && !Array.isArray(value) && value.status === undefined
      ? { ...value, status: 'published' }
      : value;

  return {
    register: z.object({
      name,
      email: z.string().trim().toLowerCase().email().max(254),
      password,
      avatarUrl
    }),
    login: z.object({
      email: z.string().trim().toLowerCase().email().max(254),
      password: z.string().min(1).max(72)
    }),
    profile: z.object({
      name,
      bio: z.string().max(160).default(''),
      location: z.string().max(100).default(''),
      website,
      avatarUrl
    }),
    changePassword: z.object({
      currentPassword: z.string().min(1).max(72),
      newPassword: password
    }),
    deleteAccount: z.object({ password: z.string().min(1).max(72) }),
    dreamPublished,
    dreamCreate: z.preprocess(defaultToPublished, z.discriminatedUnion('status', [dreamPublished, dreamDraft])),
    // Partial update. When the result is published, the route re-checks it against `dreamPublished`.
    dreamUpdate: z
      .object({
        status: z.enum(['draft', 'published']),
        title: z.string().trim().max(120),
        content: z.string().trim().min(1).max(10000),
        privacyLevel: z.enum(PRIVACY_LEVELS),
        tags,
        mood: z.enum(MOODS),
        mentions
      })
      .partial()
      .refine((v) => Object.keys(v).length > 0, 'At least one field is required'),
    comment: z.object({
      content: z.string().trim().min(1).max(1000),
      mentions,
      parentId: objectId.optional()
    }),
    report: z.object({
      reason: z.enum(REPORT_REASONS),
      details: z.string().trim().max(500).default('')
    }),
    mineQuery: z.object({
      page: z.coerce.number().int().min(1).max(10000).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(12),
      status: z.enum(['published', 'draft']).default('published'),
      privacyLevel: z.enum(PRIVACY_LEVELS).optional()
    }),
    adminReportsQuery: z.object({
      page: z.coerce.number().int().min(1).max(10000).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(15),
      status: z.enum(['open', 'reviewed', 'dismissed', 'all']).default('open'),
      type: z.enum(['dream', 'comment']).optional(),
      reason: z.enum(REPORT_REASONS).optional()
    }),
    adminPageQuery: z.object({
      page: z.coerce.number().int().min(1).max(10000).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(20)
    }),
    appeal: z.object({
      notificationId: objectId,
      message: z.string().trim().min(10, 'Tell us why you think this was a mistake (at least 10 characters)').max(1000)
    }),
    suspensionAppeal: z.object({
      email: z.string().trim().toLowerCase().email().max(254),
      password: z.string().min(1).max(72),
      message: z.string().trim().min(10, 'Tell us why you think this was a mistake (at least 10 characters)').max(1000)
    }),
    adminAppealsQuery: z.object({
      page: z.coerce.number().int().min(1).max(10000).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(15),
      status: z.enum(['open', 'upheld', 'overturned', 'all']).default('open')
    }),
    adminAppealDecision: z.object({
      decision: z.enum(['upheld', 'overturned']),
      note: z.string().trim().max(500).default(''),
      /** what the author is told about the decision */
      message: z.string().trim().max(300).default('')
    }),
    adminRole: z.object({ role: z.enum(['user', 'moderator', 'admin']) }),
    adminUserSearch: z.object({ q: z.string().trim().min(2).max(50) }),
    adminCaseQuery: z.object({ dreamId: objectId, commentId: objectId.optional() }),
    adminResolve: z
      .object({
        dreamId: objectId,
        commentId: objectId.optional(),
        resolution: z.enum(['reviewed', 'dismissed']),
        removeContent: z.boolean().default(false),
        suspendAuthor: z.boolean().default(false),
        suspensionReason: z.string().trim().max(300).default(''),
        /** what the author is told when their content is removed (the note below stays internal) */
        authorMessage: z.string().trim().max(300).default(''),
        note: z.string().trim().max(500).default('')
      })
      .superRefine((v, ctx) => {
        if (v.resolution === 'dismissed' && (v.removeContent || v.suspendAuthor)) {
          ctx.addIssue({ code: 'custom', path: ['resolution'], message: 'A dismissed report cannot remove content or suspend anyone' });
        }
        if (v.suspendAuthor && v.suspensionReason.length < 3) {
          ctx.addIssue({ code: 'custom', path: ['suspensionReason'], message: 'Give a reason for the suspension' });
        }
      }),
    blocksQuery: z.object({
      limit: z.coerce.number().int().min(1).max(50).default(20),
      before: z.coerce.date().optional()
    }),
    feedQuery: z.object({
      page: z.coerce.number().int().min(1).max(10000).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(10),
      // comma-separated lists, matched with OR semantics
      tag: z
        .string()
        .max(200)
        .transform((v) => v.toLowerCase().split(',').map((t) => t.trim()).filter(Boolean).slice(0, 10))
        .optional(),
      mood: z
        .string()
        .max(200)
        .transform((v) => v.split(',').map((m) => m.trim()).filter(Boolean))
        .pipe(z.array(z.enum(MOODS)).max(MOODS.length))
        .optional(),
      q: z.string().trim().max(100).optional()
    }),
    searchQuery: z.object({ q: z.string().trim().min(2).max(50) })
  };
};

/** Validates req[source] and stores the parsed (stripped, coerced) result on req.valid[source]. */
export const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
    });
  }
  req.valid = { ...(req.valid || {}), [source]: result.data };
  next();
};

export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
