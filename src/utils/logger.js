/**
 * src/utils/logger.js
 * ============================================================
 * WINSTON LOGGER — CENTRALIZED LOGGING SYSTEM
 * ============================================================
 * WHY LOGGING MATTERS:
 * In an automated system that runs 24/7 without human supervision,
 * logs are your EYES. Without them, you're blind when something
 * breaks at 3am. Winston gives us:
 *
 * - Multiple log levels (info, warn, error, debug)
 * - Automatic timestamps on every line
 * - Separate files for general logs vs error logs
 * - Console output for development
 * - JSON format for production (parseable by Railway/monitoring tools)
 * ============================================================
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs-extra';
import { config } from '../config/index.js';

// Ensure the logs directory exists before trying to write to it
await fs.ensureDir(config.logging.dir);

// ============================================================
// LOG FORMAT
// ============================================================
// We use different formats for dev vs production:
// - Dev: colorized, readable text
// - Prod: structured JSON (easier to parse/filter in monitoring tools)

const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  })
);

const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

const format = config.app.isDev ? devFormat : prodFormat;

// ============================================================
// TRANSPORTS (where logs go)
// ============================================================
const transports = [

  // 1. Console output — always active
  new winston.transports.Console({ format }),

  // 2. General log file — all levels
  new winston.transports.File({
    filename: path.join(config.logging.dir, 'app.log'),
    format: prodFormat,
    maxsize: 5 * 1024 * 1024, // 5MB max per file
    maxFiles: 5,              // Keep last 5 rotated files
  }),

  // 3. Error-only log file — easier to find critical issues
  new winston.transports.File({
    filename: path.join(config.logging.dir, 'error.log'),
    level: 'error',
    format: prodFormat,
    maxsize: 5 * 1024 * 1024,
    maxFiles: 5,
  }),
];

// ============================================================
// CREATE LOGGER INSTANCE
// ============================================================
const logger = winston.createLogger({
  level: config.logging.level,
  transports,
  // Don't crash the app on unhandled exceptions — log them instead
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(config.logging.dir, 'exceptions.log'),
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(config.logging.dir, 'rejections.log'),
    }),
  ],
});

export default logger;
