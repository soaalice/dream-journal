import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.js';
import dreamRoutes from './routes/dreams.js';
import userRoutes from './routes/users.js';
import { originGuard } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { buildSchemas } from './utils/validation.js';

export const createApp = (config) => {
  const app = express();
  const schemas = buildSchemas(config.avatarHosts);

  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '50kb' }));
  app.use(cookieParser());
  app.use(originGuard(config.clientOrigin));

  const limiterDefaults = { standardHeaders: true, legacyHeaders: false };
  app.use('/api', rateLimit({ ...limiterDefaults, windowMs: 15 * 60 * 1000, limit: 600 }));
  const authLimiter = rateLimit({
    ...limiterDefaults,
    windowMs: 15 * 60 * 1000,
    limit: 20,
    message: { message: 'Too many attempts, please try again later' }
  });

  const deps = { config, schemas, authLimiter };
  app.use('/api/auth', authRoutes(deps));
  app.use('/api/dreams', dreamRoutes(deps));
  app.use('/api/users', userRoutes(deps));

  app.use(notFound);
  app.use(errorHandler);
  return app;
};
