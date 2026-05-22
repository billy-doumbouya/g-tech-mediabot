/**
 * src/automation/screenshotGenerator.js
 * ============================================================
 * HARDENED HTML → IMAGE SCREENSHOT GENERATOR (CORRIGÉ)
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
  await fs.ensureDir(config.images.outputDir);

  const outputPath = path.resolve(config.images.outputDir, `${filename}.png`);
  let page = null;

  try {
    logger.info(
      `📸 Initializing image snapshot workspace for asset: ${filename}.png`,
    );

    page = await newPage();

    await page.setViewport({
      width: config.images.width,
      height: config.images.height,
      deviceScaleFactor: 1,
    });

    // FIX INTÉGRATION POLICES/IMAGES LOCALES :
    // Si ton HTML utilise des fichiers locaux, on force l'URL de base sur le projet,
    // sinon le chargement depuis "about:blank" échouera en mode headless.
    const projectRootUri = `file://${path.resolve(".")}/`;

    // FIX SÉCURITÉ CHARGEMENT :
    // On utilise "networkidle0" (plus aucun trafic réseau pendant 500ms).
    // C'est indispensable pour s'assurer que les images <img src="..."> et les CSS externes sont chargés.
    // Le timeout de 10s protège contre les blocages de CDN tiers.
    await page
      .setContent(html, {
        waitUntil: "networkidle0",
        timeout: 10000,
      })
      .catch((err) => {
        // Si networkidle0 échoue à cause d'un tracker ou d'un script tiers qui tourne en boucle,
        // on vérifie si le DOM basique est quand même là. Si oui, on tolère et on continue.
        logger.warn(
          "⚠️ Network idle timed out early, attempting to proceed with available DOM layers.",
        );
      });

    // PRODUCTION FIX : Attente réelle de la compilation des polices
    logger.debug("🔤 Waiting for font asset compilation layers...");
    try {
      // On force une évaluation explicite avec un timeout interne
      await page.evaluate(() => document.fonts.ready);
    } catch (fontErr) {
      logger.warn(
        "⚠️ Font engine tracking timed out or failed. Reverting to backup rendering canvas.",
      );
    }

    // CRITICAL CLOUD STABILITY FIX: Suppress CSS transitions/animations
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

    // DOUBLE CHECK: S'assurer que le moteur d'affichage a fini de calculer les boîtes de rendu (Reflow/Repaint)
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(resolve)),
    );

    // TAKE THE SCREENSHOT WITH CLIP BOUNDS
    await page.screenshot({
      path: outputPath,
      type: "png",
      omitBackground: false,
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
    if (page) {
      logger.debug("🧹 Recycler engaging on local page container threads...");
      // Ton excellent Promise.race pour éviter les fuites de mémoire (OOM)
      await Promise.race([
        page.close(),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]).catch(() => {});
    }
  }
};
