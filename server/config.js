import dotenv from 'dotenv';

dotenv.config();

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
    avatarHosts: (env.AVATAR_HOSTS || 'api.dicebear.com')
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean)
  };
};
