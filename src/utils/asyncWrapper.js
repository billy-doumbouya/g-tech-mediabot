/**
 * src/utils/asyncWrapper.js
 * ============================================================
 * ASYNC ERROR WRAPPER UTILITY
 * ============================================================
 * WHY THIS EXISTS:
 * In Express, if an async function throws an error and you don't
 * catch it, the server hangs forever. Wrapping every route handler
 * in try/catch is repetitive and messy.
 *
 * This utility wraps any async function and automatically passes
 * errors to Express's next() error handler.
 *
 * USAGE:
 *   router.get('/route', asyncWrapper(async (req, res) => {
 *     const data = await someAsyncOperation();
 *     res.json(data);
 *   }));
 * ============================================================
 */

/**
 * Wraps an async Express route handler to catch errors automatically
 * @param {Function} fn - Async route handler
 * @returns {Function} - Wrapped handler that catches errors
 */
export const asyncWrapper = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Retry a function N times with delay between attempts
 * WHY: Network calls (AI API, Facebook Graph API) can fail transiently.
 * Retrying gives us resilience without crashing the whole pipeline.
 *
 * @param {Function} fn - The async function to retry
 * @param {number} maxRetries - Maximum retry attempts
 * @param {number} delayMs - Milliseconds to wait between retries
 * @param {string} label - Label for logging
 */
export const withRetry = async (fn, maxRetries = 3, delayMs = 2000, label = 'operation') => {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.warn(`⚠️ [${label}] Attempt ${attempt}/${maxRetries} failed: ${error.message}`);

      if (attempt < maxRetries) {
        await sleep(delayMs * attempt); // Exponential-ish backoff
      }
    }
  }

  throw new Error(`[${label}] Failed after ${maxRetries} attempts. Last error: ${lastError.message}`);
};

/**
 * Simple sleep/delay utility
 * @param {number} ms - Milliseconds to wait
 */
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
