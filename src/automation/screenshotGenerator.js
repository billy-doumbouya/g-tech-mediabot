/**
 * src/automation/screenshotGenerator.js
 * ============================================================
 * HARDENED HTML → IMAGE SCREENSHOT GENERATOR
 * ============================================================
 */

import path from "path";
import fs from "fs-extra";
import { newPage } from "./browserManager.js";
import { config } from "../config/index.js";
import logger from "../utils/logger.js";
import Analytics from "../models/Analytics.js";

/**
 * Generate an image from HTML content safely under strict memory constraints
 * @param {string} html - Full HTML string to render
 * @param {string} filename - Output filename (without extension)
 * @returns {Promise<string>} - Absolute path to saved PNG
 */
export const generateImage = async (html, filename) => {
  // Ensure output directory layout exists on volume disk early
  await fs.ensureDir(config.images.outputDir);

  const outputPath = path.resolve(config.images.outputDir, `${filename}.png`);
  let page = null;

  try {
    logger.info(
      `📸 Initializing image snapshot workspace for asset: ${filename}.png`,
    );

    // Spawns a dedicated page abstraction instance from the singleton core
    page = await newPage();

    // Enforce target dimensional metrics explicitly
    await page.setViewport({
      width: config.images.width,
      height: config.images.height,
      deviceScaleFactor: 1, // Keep at 1x to optimize processing speed on cloud instances
    });

    // OPTIMIZATION: Use domcontentloaded to prevent network hanging loops
    await page.setContent(html, {
      waitUntil: "domcontentloaded",
      timeout: 10000, // Strict 10-second ceiling to prevent container worker stalls
    });

    // PRODUCTION FIX: Programmatically wait for all custom typography styling blocks to download
    logger.debug("🔤 Waiting for font asset compilation layers...");
    try {
      await page.evaluate(() => document.fonts.ready);
    } catch (fontErr) {
      logger.warn(
        "⚠️ Font engine tracking timed out or failed. Reverting to backup rendering canvas.",
      );
    }

    // CRITICAL CLOUD STABILITY FIX: Suppress CSS transitions/animations
    // This stops images from being captured halfway through a fade-in animation
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          transition: none !important;
          animation: none !important;
          animation-duration: 0s !important;
          transition-duration: 0s !important;
        }
      `,
    });

    // TAKE THE SCREENSHOT WITH CLIP BOUNDS
    await page.screenshot({
      path: outputPath,
      type: "png",
      omitBackground: false, // Guarantees default transparency states don't corrupt target formats
      clip: {
        x: 0,
        y: 0,
        width: config.images.width,
        height: config.images.height,
      },
    });

    logger.info(`✅ Asset capture completely synchronized: ${outputPath}`);
    await Analytics.increment("imagesGenerated").catch(() => {});

    return outputPath;
  } catch (error) {
    await Analytics.increment("imagesFailed").catch(() => {});
    logger.error(
      "❌ Snapshot worker encountered a structural pipeline exception:",
      {
        message: error.message,
        filename,
      },
    );
    throw error;
  } finally {
    // PROTECTED WORKER TEARDOWN Pipeline
    if (page) {
      logger.debug("🧹 Recycler engaging on local page container threads...");
      // Wrap the close loop with a forced promise race to protect the node thread from sticking on OOM instances
      await Promise.race([
        page.close(),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]).catch(() => {});
    }
  }
};
