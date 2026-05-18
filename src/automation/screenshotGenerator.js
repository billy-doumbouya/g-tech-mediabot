/**
 * src/automation/screenshotGenerator.js
 * ============================================================
 * HTML → IMAGE SCREENSHOT GENERATOR
 * ============================================================
 * WHY THIS APPROACH:
 * We render our HTML template in a real Chromium browser and
 * take a screenshot. This gives us:
 * - Perfect CSS rendering (gradients, shadows, Google Fonts)
 * - Pixel-perfect 1200x630px output
 * - No external API dependencies
 * - Full control over design
 *
 * FLOW:
 * 1. Open new browser page
 * 2. Set HTML content directly (no web server needed)
 * 3. Wait for fonts/images to load
 * 4. Take screenshot
 * 5. Save to disk
 * 6. Close page
 * ============================================================
 */

import path from 'path';
import fs from 'fs-extra';
import { newPage } from './browserManager.js';
import { config } from '../config/index.js';
import { sleep } from '../utils/asyncWrapper.js';
import logger from '../utils/logger.js';
import Analytics from '../models/Analytics.js';

/**
 * Generate an image from HTML content
 * @param {string} html - Full HTML string to render
 * @param {string} filename - Output filename (without extension)
 * @returns {Promise<string>} - Absolute path to saved PNG
 */
export const generateImage = async (html, filename) => {
  // Ensure output directory exists
  await fs.ensureDir(config.images.outputDir);

  const outputPath = path.resolve(config.images.outputDir, `${filename}.png`);
  let page = null;

  try {
    logger.info(`📸 Generating image: ${filename}.png`);

    // Open a fresh page for this screenshot
    page = await newPage();

    // Set the viewport explicitly to match our target image size
    await page.setViewport({
      width: config.images.width,
      height: config.images.height,
      deviceScaleFactor: 1, // 1x = 1200x630px | 2x = 2400x1260px retina
    });

    // INJECT HTML DIRECTLY
    // We use setContent() instead of navigating to a URL because:
    // - No web server needed
    // - Faster (no network request)
    // - Works in Railway (no inbound port needed for this)
    await page.setContent(html, {
      // waitUntil: 'networkidle0' means wait until no network requests
      // for 500ms. This ensures Google Fonts have loaded.
      // WARNING: Can timeout if fonts are blocked in the environment.
      // If Railway blocks fonts.googleapis.com, change to 'domcontentloaded'
      waitUntil: 'networkidle0',
      timeout: 15000,
    });

    // Extra wait for CSS animations and font rendering
    // WHY: Sometimes fonts render a frame late, causing blurry text
    await sleep(500);

    // TAKE THE SCREENSHOT
    await page.screenshot({
      path: outputPath,
      type: 'png',
      clip: {
        x: 0, y: 0,
        width: config.images.width,
        height: config.images.height,
      },
    });

    logger.info(`✅ Image saved: ${outputPath}`);
    await Analytics.increment('imagesGenerated').catch(() => {});

    return outputPath;

  } catch (error) {
    await Analytics.increment('imagesFailed').catch(() => {});
    logger.error('❌ Screenshot generation failed', { error: error.message, filename });
    throw error;
  } finally {
    // ALWAYS close the page to free memory
    // WHY: Each page uses ~20-50MB. Not closing = memory leak
    if (page) {
      await page.close().catch(() => {});
    }
  }
};
