/**
 * src/automation/browserManager.js
 * ============================================================
 * PRODUCTION-GRADE BROWSER SINGLETON MANAGER (CORRIGÉ NATIVE API)
 * ============================================================
 */

import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs-extra";
import path from "path";
import { config } from "../config/index.js";
import logger from "../utils/logger.js";

puppeteerExtra.use(StealthPlugin());

let browserInstance = null;
let launchingPromise = null;

const FIXED_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const getBrowser = async () => {
  // CORRECTION 1 : Propriété native (pas de parenthèses)
  if (browserInstance?.connected) {
    return browserInstance;
  }

  if (launchingPromise) {
    return launchingPromise;
  }

  launchingPromise = launchBrowser();

  try {
    browserInstance = await launchingPromise;
    return browserInstance;
  } finally {
    launchingPromise = null;
  }
};

const launchBrowser = async () => {
  logger.info("[Browser] Launching Chromium...");

  // FORCE LE CHEMIN EXACT : On utilise directement le dossier "browser-session"
  // au lieu de rajouter "-prod" ou "-dev" qui casse la synchronisation
  const storagePath = path.resolve("./browser-session");
  await fs.ensureDir(storagePath);

  const browser = await puppeteerExtra.launch({
    // Assure-toi que c'est bien à "shell" ou true pour l'automatisation
    headless: config.puppeteer.headless ?? "shell",
    userDataDir: storagePath,

    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--window-size=1200,630",
      "--lang=fr-FR,fr",
    ],

    defaultViewport: {
      width: config.images.width || 1200,
      height: config.images.height || 630,
    },

    timeout: 30000,
  });

  browser.on("disconnected", () => {
    logger.warn("[Browser] Disconnected event triggered");
    browserInstance = null;
  });

  logger.info("[Browser] Ready");
  return browser;
};

export const newPage = async () => {
  const browser = await getBrowser();

  // CORRECTION 2 : Propriété native (pas de parenthèses)
  if (!browser?.connected) {
    throw new Error("[Browser] Browser not available");
  }

  const page = await browser.newPage();

  await page.setUserAgent(FIXED_USER_AGENT);

  await page.setExtraHTTPHeaders({
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8,en-US;q=0.7",
  });

  page.setDefaultNavigationTimeout(45000);
  page.setDefaultTimeout(30000);

  return page;
};

export const isBrowserHealthy = () => {
  // CORRECTION 3 : Nettoyage final de la méthode obsolète
  return !!browserInstance?.connected;
};

export const restartBrowser = async () => {
  logger.warn("[Browser] Restarting browser manually...");
  try {
    await browserInstance?.close?.();
  } catch {}
  browserInstance = null;
  launchingPromise = null;
  await getBrowser();
};

export const closeBrowser = async () => {
  if (!browserInstance) return;
  logger.info("[Browser] Closing...");
  try {
    await browserInstance.close();
  } catch (e) {
    logger.error("[Browser] Close error", { message: e.message });
  }
  browserInstance = null;
  launchingPromise = null;
  logger.info("[Browser] Closed");
};
