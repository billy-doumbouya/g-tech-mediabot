/**
 * src/app.js
 * ============================================================
 * MAIN APPLICATION ENTRY POINT — GTech MediaBot
 * ============================================================
 * WHY app.js IS MINIMAL:
 * app.js is the "orchestrator" — it only wires things together.
 * The actual logic lives in specialized modules:
 * - config/   → environment variables
 * - database/ → MongoDB connection
 * - routes/   → HTTP endpoints
 * - schedulers/ → cron jobs
 *
 * A fat app.js is a code smell. Keep it thin.
 * ============================================================
 */

import express from 'express';
import { config } from './config/index.js';
import { connectDatabase, disconnectDatabase } from './database/connection.js';
import { initScheduler, stopScheduler } from './schedulers/postScheduler.js';
import { closeBrowser } from './automation/browserManager.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import logger from './utils/logger.js';
import fs from 'fs-extra';

// ============================================================
// STARTUP
// ============================================================
const startApp = async () => {
  logger.info('═'.repeat(60));
  logger.info(`🚀 Starting ${config.app.name}`);
  logger.info(`📦 Environment: ${config.app.env}`);
  logger.info(`🕐 Scheduler timezone: ${config.scheduler.timezone}`);
  logger.info('═'.repeat(60));

  // Ensure required directories exist
  await fs.ensureDir(config.images.outputDir);
  await fs.ensureDir(config.logging.dir);
  await fs.ensureDir(config.puppeteer.userDataDir);

  // 1. Connect to database
  await connectDatabase();

  // 2. Setup Express app
  const app = express();

  // Parse JSON bodies
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Mount all routes under /api (except /health which is at root)
  app.get('/health', (req, res) => res.json({
    status: 'healthy',
    app: config.app.name,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  }));
  app.use('/api', routes);

  // 404 handler — must be after routes
  app.use(notFoundHandler);

  // Global error handler — must be last middleware
  app.use(errorHandler);

  // 3. Start HTTP server
  const server = app.listen(config.app.port, () => {
    logger.info(`🌐 HTTP server listening on port ${config.app.port}`);
    logger.info(`   → Health check: http://localhost:${config.app.port}/health`);
    logger.info(`   → Trigger post: POST http://localhost:${config.app.port}/api/trigger-post`);
    logger.info(`   → Analytics:    GET  http://localhost:${config.app.port}/api/analytics`);
  });

  // 4. Start the cron scheduler
  initScheduler();

  logger.info('✅ GTech MediaBot is running and ready!');
  logger.info('═'.repeat(60));

  return server;
};

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================
// WHY: When Railway restarts the container or you press Ctrl+C,
// Node.js receives SIGTERM/SIGINT. We catch these signals and
// clean up properly before exiting:
// - Close browser (releases system resources)
// - Close DB connection (prevents connection pool leaks)
// - Stop cron jobs (prevents ghost tasks)

const shutdown = async (signal) => {
  logger.info(`\n📡 Received ${signal}. Shutting down gracefully...`);

  stopScheduler();
  await closeBrowser();
  await disconnectDatabase();

  logger.info('👋 GTech MediaBot shut down cleanly. Goodbye!');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Catch unhandled promise rejections at the top level
// WHY: Without this, Node.js silently swallows async errors
process.on('unhandledRejection', (reason) => {
  logger.error('🔥 Unhandled Promise Rejection', { reason: String(reason) });
});

// Launch the app
startApp().catch((error) => {
  logger.error('💥 Failed to start application', { error: error.message });
  process.exit(1);
});
