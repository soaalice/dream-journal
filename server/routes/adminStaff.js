import express from 'express';
import User from '../models/User.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';
import { escapeRegex, objectId, validate } from '../utils/validation.js';
import { audit } from '../services/audit.js';

const serialize = (u) => ({
  _id: String(u._id),
  name: u.name,
  email: u.email,
  role: u.role ?? 'user',
  joinedAt: u.joinedAt,
  suspended: Boolean(u.suspendedAt)
});

/**
 * Managing who is staff. Administrators only. Roles are read from the database on every request, so a change takes
 * effect immediately (the person only needs to sign in again to get the shorter staff session).
 */
export default ({ config, schemas }) => {
  const router = express.Router();
  router.use(authenticate(config.jwtSecret), requireAdmin);

  router.param('id', (req, res, next, value) =>
    objectId.safeParse(value).success ? next() : res.status(400).json({ message: 'Invalid id' })
  );

  router.get(
    '/staff',
    asyncHandler(async (req, res) => {
      const staff = await User.find({ role: { $in: ['admin', 'moderator'] } }).sort({ role: 1, name: 1 });
      res.json({ staff: staff.map(serialize) });
    })
  );

  // Find any account (by name or email) to promote. Administrators can see emails.
  router.get(
    '/users/search',
    validate(schemas.adminUserSearch, 'query'),
    asyncHandler(async (req, res) => {
      const pattern = { $regex: escapeRegex(req.valid.query.q), $options: 'i' };
      const users = await User.find({ $or: [{ name: pattern }, { email: pattern }] }).sort({ name: 1 }).limit(10);
      res.json({ users: users.map(serialize) });
    })
  );

  router.put(
    '/users/:id/role',
    validate(schemas.adminRole),
    asyncHandler(async (req, res) => {
      const { role } = req.valid.body;
      const adminId = req.user.userId;
      if (req.params.id === adminId) throw new HttpError(400, 'You cannot change your own role');

      const target = await User.findById(req.params.id);
      if (!target) throw new HttpError(404, 'User not found');

      const from = target.role ?? 'user';
      if (from === role) return res.json({ user: serialize(target) });
      if (role !== 'user' && target.suspendedAt) throw new HttpError(400, 'Unsuspend this account before giving it a staff role');

      // Never leave the app without an administrator.
      if (from === 'admin' && role !== 'admin' && (await User.countDocuments({ role: 'admin' })) <= 1) {
        throw new HttpError(400, 'There must be at least one administrator');
      }

      target.role = role;
      await target.save();
      await audit(adminId, { action: 'role_changed', targetType: 'user', targetUserId: target._id, note: `${from} → ${role}` });

      res.json({ user: serialize(target) });
    })
  );

  return router;
};
