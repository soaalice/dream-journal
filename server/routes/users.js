import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Dream from '../models/Dream.js';
import { authenticate, clearAuthCookie } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';
import { escapeRegex, objectId, validate } from '../utils/validation.js';
import { serializeUser } from '../utils/serialize.js';
import { notifyFollow, removeForUser } from '../services/notifications.js';

export default ({ config, schemas, authLimiter }) => {
  const router = express.Router();
  router.use(authenticate(config.jwtSecret));

  router.param('id', (req, res, next, value) =>
    objectId.safeParse(value).success ? next() : res.status(400).json({ message: 'Invalid id' })
  );

  // Autocomplete for @mentions. Matches on name only (never email) and is capped.
  router.get(
    '/search',
    validate(schemas.searchQuery, 'query'),
    asyncHandler(async (req, res) => {
      const { q } = req.valid.query;
      const users = await User.find({ name: { $regex: escapeRegex(q), $options: 'i' } })
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
      res.json(await serializeUser(user, req.user.userId));
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
        Dream.updateMany({}, { $pull: { likes: userId, comments: { userId }, mentions: userId } }),
        User.updateMany({ following: userId }, { $pull: { following: userId } })
      ]);
      await removeForUser({ userId, dreamIds });
      await User.deleteOne({ _id: userId });

      clearAuthCookie(res, config.isProd);
      res.json({ message: 'Account deleted' });
    })
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const user = await User.findById(req.params.id);
      if (!user) throw new HttpError(404, 'User not found');
      res.json(await serializeUser(user, req.user.userId));
    })
  );

  router.post(
    '/:id/follow',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const viewerId = req.user.userId;
      if (id === viewerId) throw new HttpError(400, 'You cannot follow yourself');

      const target = await User.findById(id);
      if (!target) throw new HttpError(404, 'User not found');

      const already = await User.exists({ _id: viewerId, following: id });
      await User.updateOne(
        { _id: viewerId },
        already ? { $pull: { following: id } } : { $addToSet: { following: id } }
      );
      await notifyFollow({ targetId: id, actorId: viewerId, following: !already });

      res.json(await serializeUser(target, viewerId));
    })
  );

  return router;
};
