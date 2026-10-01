import express from 'express';
import bcrypt from 'bcryptjs';
import Block from '../models/Block.js';
import Dream from '../models/Dream.js';
import Report from '../models/Report.js';
import User from '../models/User.js';
import { authenticate, clearAuthCookie } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';
import { blockedIdsFor } from '../utils/blocks.js';
import { escapeRegex, validate } from '../utils/validation.js';
import { serializeUser } from '../utils/serialize.js';
import { removeForUser } from '../services/notifications.js';

/**
 * Account endpoints. There are deliberately no endpoints to look at another user's profile: people interact
 * through dreams and comments, they do not browse each other.
 */
export default ({ config, schemas, authLimiter }) => {
  const router = express.Router();
  router.use(authenticate(config.jwtSecret));

  // Autocomplete for @mentions. Matches on name only (never email), is capped, and leaves out yourself and
  // anyone you are blocked with.
  router.get(
    '/search',
    validate(schemas.searchQuery, 'query'),
    asyncHandler(async (req, res) => {
      const { q } = req.valid.query;
      const exclude = [...(await blockedIdsFor(req.user.userId)), req.user.userId];
      const users = await User.find({ name: { $regex: escapeRegex(q), $options: 'i' }, _id: { $nin: exclude } })
        .select('name avatarUrl')
        .limit(10);
      res.json(users.map((u) => ({ _id: String(u._id), name: u.name, avatarUrl: u.avatarUrl })));
    })
  );

  router.put(
    '/profile',
    validate(schemas.profile),
    asyncHandler(async (req, res) => {
      const { name, bio, location, website, avatarUrl } = req.valid.body;
      const update = { name, bio, location, website, ...(avatarUrl && { avatarUrl }) };
      const user = await User.findByIdAndUpdate(req.user.userId, update, {
        new: true,
        runValidators: true
      });
      res.json(await serializeUser(user));
    })
  );

  router.put(
    '/password',
    authLimiter,
    validate(schemas.changePassword),
    asyncHandler(async (req, res) => {
      const { currentPassword, newPassword } = req.valid.body;
      const user = await User.findById(req.user.userId).select('+password');
      if (!(await bcrypt.compare(currentPassword, user.password))) {
        throw new HttpError(401, 'Current password is incorrect');
      }
      user.password = newPassword;
      await user.save();
      res.json({ message: 'Password updated' });
    })
  );

  // Account deletion: removes the user's dreams and every trace in other documents.
  router.delete(
    '/me',
    authLimiter,
    validate(schemas.deleteAccount),
    asyncHandler(async (req, res) => {
      const userId = req.user.userId;
      const user = await User.findById(userId).select('+password');
      if (!(await bcrypt.compare(req.valid.body.password, user.password))) {
        throw new HttpError(401, 'Password is incorrect');
      }

      const dreamIds = await Dream.find({ userId }).distinct('_id');
      await Promise.all([
        Dream.deleteMany({ userId }),
        // Their comments become deleted placeholders (so replies from other people keep their context),
        // and their likes and mentions disappear.
        Dream.updateMany(
          { 'comments.userId': userId },
          { $set: { 'comments.$[c].deleted': true, 'comments.$[c].content': '[deleted]', 'comments.$[c].mentions': [] } },
          { arrayFilters: [{ 'c.userId': userId }] }
        ),
        Dream.updateMany({}, { $pull: { likes: userId, mentions: userId, 'comments.$[].mentions': userId } }),
        Block.deleteMany({ $or: [{ blockerId: userId }, { blockedId: userId }] }),
        Report.deleteMany({ reporterId: userId })
      ]);
      await removeForUser({ userId, dreamIds });
      await User.deleteOne({ _id: userId });

      clearAuthCookie(res, config.isProd);
      res.json({ message: 'Account deleted' });
    })
  );

  return router;
};
