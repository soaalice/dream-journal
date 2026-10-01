import express from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import Dream from '../models/Dream.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../utils/validation.js';
import { buildStats, isValidTimeZone, todayKeyIn } from '../services/stats.js';

const statsQuery = z.object({
  range: z.enum(['30', '90', '365', 'all']).default('365'),
  tz: z
    .string()
    .max(64)
    .default('UTC')
    .refine(isValidTimeZone, 'Unknown time zone')
});

/** Upper bound on dreams read for one report: a journal this big is far beyond normal use. */
const MAX_DREAMS = 20000;

/**
 * Statistics about the signed-in user's own dreams. Nobody else's data is ever included, and nothing here is shared:
 * there is no way to ask for another person's stats.
 */
export default ({ config }) => {
  const router = express.Router();
  router.use(authenticate(config.jwtSecret));

  router.get(
    '/me',
    validate(statsQuery, 'query'),
    asyncHandler(async (req, res) => {
      const { range, tz } = req.valid.query;
      const userId = new mongoose.Types.ObjectId(req.user.userId);
      const date = { date: '$createdAt', timezone: tz };

      const [rows, drafts] = await Promise.all([
        Dream.aggregate([
          { $match: { userId, status: { $ne: 'draft' } } },
          { $sort: { createdAt: -1 } },
          { $limit: MAX_DREAMS },
          {
            $project: {
              _id: 0,
              day: { $dateToString: { format: '%Y-%m-%d', ...date } },
              month: { $dateToString: { format: '%Y-%m', ...date } },
              dow: { $dayOfWeek: date },
              mood: 1,
              tags: 1,
              privacyLevel: 1,
              words: { $size: { $regexFindAll: { input: '$content', regex: '\\S+' } } },
              likes: { $size: { $ifNull: ['$likes', []] } },
              // comments from other people that are still there
              comments: { $size: { $filter: { input: { $ifNull: ['$comments', []] }, cond: { $not: ['$$this.deleted'] } } } }
            }
          }
        ]),
        Dream.countDocuments({ userId, status: 'draft' })
      ]);

      res.json({
        tz,
        generatedAt: new Date().toISOString(),
        ...buildStats(rows, { todayKey: todayKeyIn(tz), rangeDays: range === 'all' ? null : Number(range), drafts })
      });
    })
  );

  return router;
};
