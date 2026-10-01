import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const COOKIE_NAME = 'token';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const generateToken = (userId, secret) =>
  jwt.sign({ userId: String(userId) }, secret, { algorithm: 'HS256', expiresIn: '7d' });

const cookieOptions = (isProd) => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: isProd,
  path: '/'
});

export const setAuthCookie = (res, token, isProd) =>
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(isProd), maxAge: MAX_AGE_MS });

export const clearAuthCookie = (res, isProd) => res.clearCookie(COOKIE_NAME, cookieOptions(isProd));

const readToken = (req) => {
  if (req.cookies?.[COOKIE_NAME]) return req.cookies[COOKIE_NAME];
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
};

const resolveUser = async (req, secret) => {
  const token = readToken(req);
  if (!token) return null;
  const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
  const exists = await User.exists({ _id: decoded.userId });
  return exists ? { userId: String(decoded.userId) } : null;
};

/** Requires a valid session; 401 otherwise. */
export const authenticate = (secret) =>
  asyncHandler(async (req, res, next) => {
    let user;
    try {
      user = await resolveUser(req, secret);
    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' || error.name === 'NotBeforeError') {
        return res.status(401).json({ message: 'Invalid or expired session' });
      }
      throw error;
    }
    if (!user) return res.status(401).json({ message: 'Authentication required' });
    req.user = user;
    next();
  });

/** Attaches req.user when a valid session exists; never rejects. */
export const optionalAuth = (secret) =>
  asyncHandler(async (req, res, next) => {
    try {
      req.user = (await resolveUser(req, secret)) || undefined;
    } catch {
      req.user = undefined;
    }
    next();
  });

/**
 * CSRF defence in depth on top of SameSite=Lax cookies: reject state-changing
 * requests whose Origin header does not match the configured client origin.
 */
export const originGuard = (allowedOrigin) => (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (origin && origin !== allowedOrigin) {
    return res.status(403).json({ message: 'Origin not allowed' });
  }
  next();
};
