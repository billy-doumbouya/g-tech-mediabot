/**
 * src/automation/browserManager.js
 * ============================================================
 * PUPPETEER BROWSER MANAGER
 * ============================================================
 * WHY THIS IS ITS OWN MODULE:
 * Browser lifecycle (launch, reuse, close) is complex.
 * We want ONE shared browser instance — not a new browser
 * for every screenshot or Facebook post. Spawning a new
 * Chromium for every operation is:
 * - Slow (takes 3-5 seconds per launch)
 * - Memory-intensive (each browser = ~150MB RAM)
 * - Unnecessary if we can reuse the same instance
 *
 * WHY PUPPETEER-EXTRA + STEALTH PLUGIN:
 * Facebook uses JavaScript fingerprinting to detect bots.
 * The stealth plugin modifies Puppeteer's behavior to bypass
 * common bot detection checks:
 * - Removes the `navigator.webdriver = true` flag
 * - Randomizes canvas fingerprinting
 * - Fixes Chrome-specific properties that headless breaks
 * - Mimics a real browser more accurately
 *
 * WHY PERSISTENT USER DATA DIR (SESSION PERSISTENCE):
 * Without this, every browser launch starts fresh (no cookies,
 * no login state). With it, once logged into Facebook,
 * the session is saved to disk and reused on next launch.
 * This means: login ONCE manually, then the bot uses that session.
 * ============================================================
 */

import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs-extra';
import path from 'path';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';

// Apply the stealth plugin to puppeteer-extra
// WHY: Must be done before launching any browser
puppeteerExtra.use(StealthPlugin());

// ============================================================
// BROWSER SINGLETON
// We maintain a single browser instance across the app lifetime.
// WHY SINGLETON: Saves memory and startup time on Railway.
// ============================================================
let browserInstance = null;

/**
 * Get or create the shared browser instance
 * @returns {Promise<Browser>} - Puppeteer browser object
 */
export const getBrowser = async () => {
  // If browser is already running and connected, reuse it
  if (browserInstance && browserInstance.isConnected()) {
    logger.debug('♻️ Reusing existing browser instance');
    return browserInstance;
  }

  logger.info('🚀 Launching new Puppeteer browser...');
  browserInstance = await launchBrowser();
  logger.info('✅ Browser launched successfully');
  return browserInstance;
};

/**
 * Launch a new Puppeteer browser with Railway-compatible config
 * @returns {Promise<Browser>}
 */
const launchBrowser = async () => {
  // Ensure the session directory exists
  await fs.ensureDir(config.puppeteer.userDataDir);

  return puppeteerExtra.launch({
    headless: config.puppeteer.headless,

    // WHERE SESSION DATA IS SAVED
    // This is the magic that enables persistent login sessions.
    // After logging into Facebook once, the cookies/localStorage
    // are saved here and reused on every subsequent launch.
    userDataDir: path.resolve(config.puppeteer.userDataDir),

    // RAILWAY-COMPATIBLE ARGS
    // Railway (and most CI/cloud environments) run without a display server.
    // These flags configure Chromium to work in such environments:
    args: [
      '--no-sandbox',              // Required in containerized environments
      '--disable-setuid-sandbox',  // Additional sandbox bypass for containers
      '--disable-dev-shm-usage',   // Use /tmp instead of /dev/shm (Railway has small /dev/shm)
      '--disable-gpu',             // No GPU in server environments
      '--no-first-run',            // Skip Chrome first-run wizard
      '--no-zygote',               // Disable zygote process (more stable in containers)
      '--disable-extensions',      // Faster startup
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',

      // Viewport size — must match our image dimensions
      '--window-size=1200,630',
    ],

    // Default viewport for all pages
    defaultViewport: {
      width: config.images.width,
      height: config.images.height,
    },

    // How long to wait for browser launch (10 seconds)
    timeout: 10000,

    // Let puppeteer-extra handle the executable path
    // (it auto-downloads Chromium if not found)
  });
};

/**
 * Open a new page in the shared browser
 * Each "task" (screenshot, Facebook post) should get its own page
 * and close it when done — to avoid memory leaks.
 * @returns {Promise<Page>} - Puppeteer page object
 */
export const newPage = async () => {
  const browser = await getBrowser();
  const page = await browser.newPage();

  // Set a realistic user agent string
  // WHY: Headless Chromium has a user agent that includes "HeadlessChrome"
  // Facebook can detect this. We replace it with a real desktop UA.
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  // Set extra headers to look more like a real browser
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  });

  return page;
};

/**
 * Close the browser and reset the singleton
 * Called during graceful shutdown
 */
export const closeBrowser = async () => {
  if (browserInstance) {
    logger.info('🔌 Closing browser...');
    await browserInstance.close().catch(() => {});
    browserInstance = null;
    logger.info('✅ Browser closed');
  }
};
