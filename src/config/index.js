/**
 * src/config/index.js
 * ============================================================
 * CENTRAL CONFIGURATION MODULE
 * ============================================================
 * WHY THIS EXISTS:
 * Instead of calling process.env.SOMETHING everywhere in the
 * codebase, we load and validate all config in ONE place.
 * This means:
 * - If a variable is missing, we catch it at startup (not mid-run)
 * - All config has a single source of truth
 * - Easy to add validation rules later
 * ============================================================
 */

import dotenv from 'dotenv';

// Load .env file into process.env
dotenv.config();

/**
 * Helper: get required env variable or throw at startup
 * This prevents the bot from running with missing critical config
 */
const required = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`❌ Missing required environment variable: ${key}\nCheck your .env file.`);
  }
  return value;
};

/**
 * Helper: get optional env variable with a default fallback
 */
const optional = (key, defaultValue = '') => {
  return process.env[key] || defaultValue;
};

// ============================================================
// EXPORTED CONFIGURATION OBJECT
// ============================================================
export const config = {

  // --- App ---
  app: {
    env: optional('NODE_ENV', 'development'),
    port: parseInt(optional('PORT', '3000')),
    name: optional('APP_NAME', 'GTech MediaBot'),
    isDev: optional('NODE_ENV', 'development') === 'development',
  },

  // --- MongoDB ---
  mongodb: {
    uri: required('MONGODB_URI'),
  },

  // --- OpenRouter AI ---
  openrouter: {
    apiKey: required('OPENROUTER_API_KEY'),
    model: optional('OPENROUTER_MODEL', 'mistralai/mistral-7b-instruct'),
    baseUrl: 'https://openrouter.ai/api/v1',
  },

  // --- Facebook Graph API (primary publisher) ---
  facebook: {
    pageId: optional('FACEBOOK_PAGE_ID', ''),
    pageAccessToken: optional('FACEBOOK_PAGE_ACCESS_TOKEN', ''),
    email: optional('FACEBOOK_EMAIL', ''),
    password: optional('FACEBOOK_PASSWORD', ''),
    pageName: optional('FACEBOOK_PAGE_NAME', 'G-tech-academy'),
  },

  // --- Puppeteer ---
  puppeteer: {
    userDataDir: optional('PUPPETEER_USER_DATA_DIR', './browser-session'),
    headless: optional('PUPPETEER_HEADLESS', 'true') === 'true',
  },

  // --- Scheduler ---
  scheduler: {
    morningHour: parseInt(optional('MORNING_POST_HOUR', '8')),
    middayHour: parseInt(optional('MIDDAY_POST_HOUR', '12')),
    eveningHour: parseInt(optional('EVENING_POST_HOUR', '19')),
    timezone: optional('SCHEDULER_TIMEZONE', 'Africa/Conakry'),
  },

  // --- Images ---
  images: {
    outputDir: optional('IMAGES_OUTPUT_DIR', './generated-images'),
    width: 1200,
    height: 630,
  },

  // --- Logging ---
  logging: {
    level: optional('LOG_LEVEL', 'info'),
    dir: optional('LOG_DIR', './src/logs'),
  },
};

export default config;
