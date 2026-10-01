import express from 'express';
import { z } from 'zod';
import Notification from '../models/Notification.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';
import { blockedIdsFor } from '../utils/blocks.js';
import { objectId, validate } from '../utils/validation.js';
import { serializeNotification } from '../utils/serializeNotification.js';

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  // keyset pagination on the sort field: pass `nextCursor` from the previous page
  before: z.coerce.date().optional(),
  /** inbox filters: a group of types, and unread only */
  group: z.enum(['all', 'activity', 'moderation', 'appeals']).default('all'),
  unread: z.enum(['0', '1']).default('0')
});

const GROUPS = {
  activity: ['comment', 'reply', 'mention', 'like'],
  moderation: ['moderation'],
  appeals: ['appeal']
};

const readBody = z.object({ ids: z.array(objectId).max(100).optional() });

export default ({ config }) => {
  const router = express.Router();
  router.use(authenticate(config.jwtSecret));

  router.param('id', (req, res, next, value) =>
    objectId.safeParse(value).success ? next() : res.status(400).json({ message: 'Invalid id' })
  );

  // Cheap endpoint polled by the bell badge
  router.get(
    '/unread-count',
    asyncHandler(async (req, res) => {
      const unreadCount = await Notification.countDocuments({ userId: req.user.userId, readAt: null });
      res.json({ unreadCount });
    })
  );

  router.get(
    '/',
    validate(listQuery, 'query'),
    asyncHandler(async (req, res) => {
      const viewerId = req.user.userId;
      const { limit, before, group, unread } = req.valid.query;

      const filter = { userId: viewerId };
      if (group !== 'all') filter.type = { $in: GROUPS[group] };
      if (unread === '1') filter.readAt = null;
      // Appeal notices are for staff only (also covers someone who lost their staff role).
      if (req.user.role !== 'admin' && req.user.role !== 'moderator') filter.type = { ...(filter.type ?? {}), $ne: 'appeal' };
      if (before) filter.updatedAt = { $lt: before };

      const blocked = await blockedIdsFor(viewerId);
      const rows = await Notification.find(filter)
        .sort({ updatedAt: -1 })
        .limit(limit + 1)
        .populate('actorId', 'name avatarUrl')
        .populate('dreamId', 'title privacyLevel userId status moderationState')
        .populate('appealId', 'status');

      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;

      const [unreadCount, unreadAppeals] = await Promise.all([
        Notification.countDocuments({ userId: viewerId, readAt: null }),
        Notification.countDocuments({ userId: viewerId, type: 'appeal', readAt: null })
      ]);

      res.json({
        unreadAppeals,
        notifications: page.map((n) => serializeNotification(n, viewerId, blocked)).filter(Boolean),
        hasMore,
        nextCursor: hasMore ? page[page.length - 1].updatedAt : null,
        unreadCount
      });
    })
  );

  // Mark some (`ids`) or all notifications as read
  router.post(
    '/read',
    validate(readBody),
    asyncHandler(async (req, res) => {
      const { ids } = req.valid.body;
      const filter = { userId: req.user.userId, readAt: null };
      if (ids) filter._id = { $in: ids };

      await Notification.updateMany(filter, { $set: { readAt: new Date() } }, { timestamps: false });
      const unreadCount = await Notification.countDocuments({ userId: req.user.userId, readAt: null });
      res.json({ unreadCount });
    })
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const result = await Notification.deleteOne({ _id: req.params.id, userId: req.user.userId });
      if (result.deletedCount === 0) throw new HttpError(404, 'Notification not found');
      const unreadCount = await Notification.countDocuments({ userId: req.user.userId, readAt: null });
      res.json({ unreadCount });
    })
  );

  return router;
};
