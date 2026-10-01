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
  before: z.coerce.date().optional()
});

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
      const { limit, before } = req.valid.query;

      const filter = { userId: viewerId };
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

      const unreadCount = await Notification.countDocuments({ userId: viewerId, readAt: null });

      res.json({
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
