/**
 * src/utils/asyncWrapper.js
 * ============================================================
 * ASYNC ERROR WRAPPER & RESILIENCE UTILITIES (CORRIGÉ)
 * ============================================================
 */

import logger from "./logger.js"; // On centralise sur ton logger custom plutôt que console.warn

/**
 * Wraps an async Express route handler to catch errors automatically.
 * Essential for Express 4.x applications to prevent unhandled rejections from hanging.
 * @param {Function} fn - Async route handler (req, res, next)
 * @returns {Function} - Wrapped handler that catches errors
 */
export const asyncWrapper = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Retry a function N times with an incremental backoff delay between attempts.
 * Preserves the original semantic stack traces for modern cloud logging platforms.
 *
 * @param {Function} fn - The async function to retry
 * @param {number} maxRetries - Maximum retry attempts
 * @param {number} delayMs - Base milliseconds to wait between retries
 * @param {string} label - Label for context logging
 * @returns {Promise<*>} - The resolved result of the passed function
 */
export const withRetry = async (
  fn,
  maxRetries = 3,
  delayMs = 2000,
  label = "operation",
) => {
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      logger.warn(
        `⚠️ [${label}] Attempt ${attempt}/${maxRetries} failed. Retrying...`,
        {
          message: error.message,
          stack: error.stack,
        },
      );

      if (attempt < maxRetries) {
        // Backoff incrémentiel linéaire : 2s, puis 4s, puis 6s...
        await sleep(delayMs * attempt);
      }
    }
  }

  // PRODUCTION FIX: On lève une erreur explicite TOUT EN préservant
  // la structure native et la stack trace de l'erreur d'origine grâce à "cause".
  const failureError = new Error(
    `[${label}] Orchestrator pipeline aborted after ${maxRetries} sequential attempts.`,
  );

  failureError.cause = lastError;
  throw failureError;
};

/**
 * Simple execution thread sleep/delay utility
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
