import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const COOKIE_NAME = 'token';

/** Normal sessions last a week; staff sessions (admins and moderators) are shorter because they can do more damage if stolen. */
const SESSION = {
  user: { jwt: '7d', cookieMs: 7 * 24 * 60 * 60 * 1000 },
  admin: { jwt: '12h', cookieMs: 12 * 60 * 60 * 1000 }
};

const sessionFor = (role) => (role === 'admin' || role === 'moderator' ? SESSION.admin : SESSION.user);

export const generateToken = (userId, secret, role = 'user') =>
  jwt.sign({ userId: String(userId) }, secret, { algorithm: 'HS256', expiresIn: sessionFor(role).jwt });

const cookieOptions = (isProd) => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: isProd,
  path: '/'
});

export const setAuthCookie = (res, token, isProd, role = 'user') =>
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(isProd), maxAge: sessionFor(role).cookieMs });

export const clearAuthCookie = (res, isProd) => res.clearCookie(COOKIE_NAME, cookieOptions(isProd));

const readToken = (req) => {
  if (req.cookies?.[COOKIE_NAME]) return req.cookies[COOKIE_NAME];
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
};

/**
 * The role is never read from the token: it is looked up on every request, so removing someone's admin
 * rights or suspending them takes effect immediately, even for sessions that are already open.
 */
const resolveUser = async (req, secret) => {
  const token = readToken(req);
  if (!token) return { user: null };
  const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
  const account = await User.findById(decoded.userId).select('role suspendedAt suspensionReason');
  if (!account) return { user: null };
  if (account.suspendedAt) return { user: null, suspended: account };
  return { user: { userId: String(decoded.userId), role: account.role ?? 'user' } };
};

const isTokenError = (error) =>
  ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name);

/** Requires a valid session; 401 otherwise. */
export const authenticate = (secret) =>
  asyncHandler(async (req, res, next) => {
    let result;
    try {
      result = await resolveUser(req, secret);
    } catch (error) {
      if (isTokenError(error)) return res.status(401).json({ message: 'Invalid or expired session' });
      throw error;
    }
    if (result.suspended) {
      return res.status(401).json({ message: 'Your account has been suspended', code: 'suspended' });
    }
    if (!result.user) return res.status(401).json({ message: 'Authentication required' });
    req.user = result.user;
    next();
  });

/** Attaches req.user when a valid session exists; never rejects. Suspended accounts count as signed out. */
export const optionalAuth = (secret) =>
  asyncHandler(async (req, res, next) => {
    try {
      req.user = (await resolveUser(req, secret)).user ?? undefined;
    } catch {
      req.user = undefined;
    }
    next();
  });

/**
 * Use after `authenticate`. Anyone without one of the roles gets a plain 404, so the moderation API looks like it
 * does not exist.
 */
export const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) return res.status(404).json({ message: 'Not found' });
  next();
};

export const requireAdmin = requireRole('admin');
/** Moderators and administrators: everything about handling reports. */
export const requireStaff = requireRole('moderator', 'admin');

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
