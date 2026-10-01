import express from 'express';
import bcrypt from 'bcryptjs';
import Appeal from '../models/Appeal.js';
import User, { DUMMY_HASH } from '../models/User.js';
import {
  authenticate,
  clearAuthCookie,
  generateToken,
  setAuthCookie
} from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../utils/validation.js';
import { serializeUser } from '../utils/serialize.js';

export default ({ config, schemas, authLimiter }) => {
  const router = express.Router();

  const startSession = async (res, user, status = 200) => {
    setAuthCookie(res, generateToken(user._id, config.jwtSecret, user.role), config.isProd, user.role);
    res.status(status).json({ user: await serializeUser(user) });
  };

  router.post(
    '/register',
    authLimiter,
    validate(schemas.register),
    asyncHandler(async (req, res) => {
      const { name, email, password, avatarUrl } = req.valid.body;

      if (await User.exists({ email })) {
        return res.status(409).json({ message: 'Email already registered' });
      }

      // The unique index still protects against a concurrent duplicate (E11000 -> 409).
      const user = await User.create({ name, email, password, ...(avatarUrl && { avatarUrl }) });
      await startSession(res, user, 201);
    })
  );

  router.post(
    '/login',
    authLimiter,
    validate(schemas.login),
    asyncHandler(async (req, res) => {
      const { email, password } = req.valid.body;

      const user = await User.findOne({ email }).select('+password');
      // Always run bcrypt so response time does not reveal whether the account exists.
      const hash = user ? user.password : DUMMY_HASH;
      const matches = await bcrypt.compare(password, hash);

      if (!user || !matches) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      // Only someone who knows the password learns that the account is suspended.
      if (user.suspendedAt) {
        const latest = await Appeal.findOne({ userId: user._id, targetType: 'account' }).sort({ createdAt: -1 }).select('status');
        return res.status(403).json({
          message: 'Your account has been suspended',
          code: 'suspended',
          reason: user.suspensionReason || undefined,
          appealStatus: latest?.status ?? null
        });
      }
      await startSession(res, user);
    })
  );

  // A suspended person cannot sign in, so they appeal with their credentials instead.
  router.post(
    '/appeal-suspension',
    authLimiter,
    validate(schemas.suspensionAppeal),
    asyncHandler(async (req, res) => {
      const { email, password, message } = req.valid.body;

      const user = await User.findOne({ email }).select('+password');
      const matches = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);
      if (!user || !matches) return res.status(401).json({ message: 'Invalid credentials' });
      if (!user.suspendedAt) return res.status(400).json({ message: 'Your account is not suspended' });

      const latest = await Appeal.findOne({ userId: user._id, targetType: 'account' }).sort({ createdAt: -1 });
      if (latest?.status === 'open') return res.status(409).json({ message: 'Your appeal is already being reviewed' });
      const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
      if (latest?.status === 'upheld' && Date.now() - latest.resolvedAt.getTime() < COOLDOWN_MS) {
        return res.status(409).json({ message: 'Your last appeal was declined. You can appeal again after 30 days.' });
      }

      await Appeal.create({
        userId: user._id,
        targetType: 'account',
        message,
        snapshot: { moderationMessage: user.suspensionReason }
      });
      res.status(201).json({ message: 'Your appeal was sent. An administrator will review it.' });
    })
  );

  router.post('/logout', (req, res) => {
    clearAuthCookie(res, config.isProd);
    res.json({ message: 'Logged out' });
  });

  router.get(
    '/me',
    authenticate(config.jwtSecret),
    asyncHandler(async (req, res) => {
      const user = await User.findById(req.user.userId);
      res.json({ user: await serializeUser(user) });
    })
  );

  return router;
};
