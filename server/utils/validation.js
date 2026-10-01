import { z } from 'zod';

export const MOODS = ['happy', 'sad', 'scary', 'confusing', 'exciting', 'peaceful', 'anxious', 'mysterious'];
export const PRIVACY_LEVELS = ['public', 'private', 'anonymous'];

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

  const dreamBase = z.object({
    title: z.string().trim().min(1).max(120),
    content: z.string().trim().min(10).max(10000),
    privacyLevel: z.enum(PRIVACY_LEVELS),
    tags: z
      .array(z.string().trim().toLowerCase().min(1).max(30))
      .max(10)
      .transform((tags) => [...new Set(tags)]),
    mood: z.enum(MOODS),
    mentions
  });

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
    dreamCreate: dreamBase.extend({ tags: dreamBase.shape.tags.default([]) }),
    dreamUpdate: dreamBase
      .partial()
      .refine((v) => Object.keys(v).length > 0, 'At least one field is required'),
    comment: z.object({
      content: z.string().trim().min(1).max(1000),
      mentions
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
    userDreamsQuery: z.object({
      privacyLevel: z.enum(PRIVACY_LEVELS).optional()
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
