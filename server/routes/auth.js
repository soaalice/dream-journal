import express from 'express';
import bcrypt from 'bcryptjs';
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
    setAuthCookie(res, generateToken(user._id, config.jwtSecret), config.isProd);
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
      await startSession(res, user);
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
