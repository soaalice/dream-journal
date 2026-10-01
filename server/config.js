import dotenv from 'dotenv';

dotenv.config();

const parseThreshold = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
};

export const loadConfig = (env = process.env) => {
  const { JWT_SECRET, MONGODB_URI } = env;

  if (!MONGODB_URI) throw new Error('MONGODB_URI is required');
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET is required and must be at least 32 characters');
  }

  return {
    isProd: env.NODE_ENV === 'production',
    port: Number(env.PORT) || 5000,
    mongoUri: MONGODB_URI,
    jwtSecret: JWT_SECRET,
    clientOrigin: env.CLIENT_ORIGIN || 'http://localhost:5173',
    trustProxy: env.TRUST_PROXY === 'true',
    /**
     * Content is hidden automatically once this many different people reported it (until a moderator decides).
     * 0 turns auto-hiding off.
     */
    autoHideThreshold: parseThreshold(env.AUTO_HIDE_REPORT_THRESHOLD, 10),
    /** serve the built frontend (dist/) from this server, with security headers */
    serveClient: env.SERVE_CLIENT === 'true',
    /** where the built frontend is (default: ./dist) */
    clientDir: env.CLIENT_DIR || undefined,
    /** another origin the frontend may call, when the API is on a different domain (adds it to the CSP) */
    apiOrigin: env.API_ORIGIN || '',
    avatarHosts: (env.AVATAR_HOSTS || 'api.dicebear.com')
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean)
  };
};
