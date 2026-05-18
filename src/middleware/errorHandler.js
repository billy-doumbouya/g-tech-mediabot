/**
 * src/middleware/errorHandler.js
 * ============================================================
 * GLOBAL EXPRESS ERROR HANDLER
 * ============================================================
 * WHY THIS MATTERS:
 * Without a global error handler, unhandled errors in Express
 * result in a hanging request or generic 500 response with
 * a raw stack trace exposed to the client.
 *
 * This middleware:
 * - Catches ALL errors from route handlers (via asyncWrapper)
 * - Logs them properly with Winston
 * - Returns clean, consistent JSON error responses
 * - Hides implementation details from the client in production
 * ============================================================
 */

import logger from '../utils/logger.js';
import { config } from '../config/index.js';

/**
 * Global error handling middleware
 * Must have 4 parameters (err, req, res, next) for Express to recognize it
 */
export const errorHandler = (err, req, res, next) => {
  // Log the full error internally
  logger.error('🔥 Unhandled error in route', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    ip: req.ip,
  });

  // Status code: use error's code if set, else default 500
  const statusCode = err.statusCode || err.status || 500;

  // Response: hide stack traces in production
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
    // Only expose stack in development
    ...(config.app.isDev && { stack: err.stack }),
  });
};

/**
 * 404 handler — for routes that don't exist
 */
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.url}`,
    availableRoutes: [
      'GET /health',
      'POST /api/trigger-post',
      'GET /api/posts',
      'GET /api/analytics',
    ],
  });
};
