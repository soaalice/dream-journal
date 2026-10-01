import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.js';
import dreamRoutes from './routes/dreams.js';
import userRoutes from './routes/users.js';
import notificationRoutes from './routes/notifications.js';
import blockRoutes from './routes/blocks.js';
import adminRoutes from './routes/admin.js';
import statsRoutes from './routes/stats.js';
import adminAppealRoutes from './routes/adminAppeals.js';
import adminStaffRoutes from './routes/adminStaff.js';
import appealRoutes from './routes/appeals.js';
import { originGuard } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { buildSchemas } from './utils/validation.js';
import { mountClient } from './clientHosting.js';

export const createApp = (config) => {
  const app = express();
  const schemas = buildSchemas(config.avatarHosts);

  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  // The CSP is set per kind of response: a locked-down one for the API below, the app's own one for pages (clientHosting.js).
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use('/api', (req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    next();
  });
  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '50kb' }));
  app.use(cookieParser());
  app.use(originGuard(config.clientOrigin));

  const limiterDefaults = { standardHeaders: true, legacyHeaders: false };
  app.use('/api', rateLimit({ ...limiterDefaults, windowMs: 15 * 60 * 1000, limit: 600 }));
  const authLimiter = rateLimit({
    ...limiterDefaults,
    windowMs: 15 * 60 * 1000,
    limit: config.authRateLimit ?? 20,
    message: { message: 'Too many attempts, please try again later' }
  });

  const reportLimiter = rateLimit({
    ...limiterDefaults,
    windowMs: 60 * 60 * 1000,
    limit: 30,
    message: { message: 'Too many reports, please try again later' }
  });

  const deps = { config, schemas, authLimiter, reportLimiter };
  app.use('/api/auth', authRoutes(deps));
  app.use('/api/dreams', dreamRoutes(deps));
  app.use('/api/users', userRoutes(deps));
  app.use('/api/notifications', notificationRoutes(deps));
  app.use('/api/blocks', blockRoutes(deps));
  app.use('/api/stats', statsRoutes(deps));
  app.use('/api/admin', adminRoutes(deps));
  app.use('/api/admin', adminAppealRoutes(deps));
  app.use('/api/admin', adminStaffRoutes(deps));
  app.use('/api/appeals', appealRoutes(deps));

  if (config.serveClient) mountClient(app, config);

  app.use(notFound);
  app.use(errorHandler);
  return app;
};
