/**
 * src/scripts/setupSession.js
 * ============================================================
 * BROWSER SESSION SETUP — RUN ONCE
 * ============================================================
 * This script opens a VISIBLE (non-headless) browser so you can
 * log into Facebook manually. Once logged in, the session cookies
 * are saved to the PUPPETEER_USER_DATA_DIR folder and reused
 * automatically by the bot from then on.
 *
 * WHEN TO RUN:
 * - First-time setup
 * - After session expires (Facebook logs you out)
 * - After changing FACEBOOK account
 *
 * HOW TO RUN:
 *   npm run setup-session
 *
 * WHAT TO DO:
 * 1. A browser window opens
 * 2. Log into Facebook manually
 * 3. Navigate to G-tech-academy page
 * 4. Confirm you can see the "Create Post" button
 * 5. Press ENTER in the terminal to save and close
 * ============================================================
 */

import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs-extra';
import path from 'path';
import readline from 'readline';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';

puppeteerExtra.use(StealthPlugin());

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const waitForEnter = (msg) => new Promise(resolve => rl.question(msg, resolve));

logger.info('🔧 Browser Session Setup — GTech MediaBot');
logger.info(`📁 Session will be saved to: ${path.resolve(config.puppeteer.userDataDir)}`);

(async () => {
  await fs.ensureDir(config.puppeteer.userDataDir);

  // Launch VISIBLE browser (headless: false)
  const browser = await puppeteerExtra.launch({
    headless: false,  // IMPORTANT: Must be visible for manual login
    userDataDir: path.resolve(config.puppeteer.userDataDir),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1280,800',
    ],
    defaultViewport: { width: 1280, height: 800 },
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  await page.goto('https://www.facebook.com', { waitUntil: 'networkidle2' });

  console.log('\n' + '='.repeat(60));
  console.log('👋 A browser window has opened.');
  console.log('');
  console.log('STEPS:');
  console.log('  1. Log into your Facebook account');
  console.log('  2. Navigate to the G-tech-academy page');
  console.log('  3. Verify you see the "Create Post" area');
  console.log('  4. Come back here and press ENTER');
  console.log('='.repeat(60) + '\n');

  await waitForEnter('Press ENTER when you are logged in and ready → ');

  await browser.close();
  rl.close();

  logger.info('✅ Session saved! You can now run the bot.');
  logger.info(`📁 Session stored at: ${path.resolve(config.puppeteer.userDataDir)}`);
  process.exit(0);
})();
