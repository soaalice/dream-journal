import mongoose from 'mongoose';
import { loadConfig } from './config.js';
import { createApp } from './app.js';

const config = loadConfig();

mongoose
  .connect(config.mongoUri)
  .then(() => {
    console.log('Connected to MongoDB');
    const server = createApp(config).listen(config.port, () =>
      console.log(`Server running on port ${config.port}`)
    );

    const shutdown = () => server.close(() => mongoose.disconnect().then(() => process.exit(0)));
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  });
