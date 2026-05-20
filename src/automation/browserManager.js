/**
 * src/automation/browserManager.js
 * ============================================================
 * PRODUCTION-GRADE BROWSER SINGLETON MANAGER
 * ============================================================
 */

import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs-extra";
import path from "path";
import { config } from "../config/index.js";
import logger from "../utils/logger.js";

puppeteerExtra.use(StealthPlugin());

// ============================================================
// STATE
// ============================================================

let browserInstance = null;
let launchingPromise = null;

// ============================================================
// SAFE LAUNCH LOCK
// prevents race-condition double browser spawn
// ============================================================

const getBrowser = async () => {
  // already healthy
  if (browserInstance?.isConnected()) {
    return browserInstance;
  }

  // prevent concurrent launches
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

// ============================================================
// LAUNCH BROWSER
// ============================================================

const launchBrowser = async () => {
  logger.info("[Browser] Launching Chromium...");

  await fs.ensureDir(config.puppeteer.userDataDir);

  const browser = await puppeteerExtra.launch({
    headless: config.puppeteer.headless ?? "new",

    userDataDir: path.resolve(
      `${config.puppeteer.userDataDir}-${process.env.NODE_ENV || "prod"}`,
    ),

    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--no-zygote",
      "--disable-extensions",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--window-size=1200,630",
    ],

    defaultViewport: {
      width: config.images.width,
      height: config.images.height,
    },

    timeout: 20000,
  });

  browser.on("disconnected", () => {
    logger.warn("[Browser] Disconnected event triggered");
    browserInstance = null;
  });

  logger.info("[Browser] Ready");
  return browser;
};

// ============================================================
// PAGE CREATION WITH SAFETY LIMIT
// ============================================================

export const newPage = async () => {
  const browser = await getBrowser();

  if (!browser?.isConnected()) {
    throw new Error("[Browser] Browser not available");
  }

  const page = await browser.newPage();

  // Realistic UA rotation (lightweight anti-fingerprint)
  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36",
  ];

  const ua = userAgents[Math.floor(Math.random() * userAgents.length)];

  await page.setUserAgent(ua);

  await page.setExtraHTTPHeaders({
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
  });

  // HARDEN: avoid silent hangs
  page.setDefaultNavigationTimeout(45000);
  page.setDefaultTimeout(30000);

  return page;
};

// ============================================================
// HEALTH CHECK
// ============================================================

export const isBrowserHealthy = () => {
  return !!browserInstance?.isConnected();
};

// ============================================================
// FORCE RECOVERY
// ============================================================

export const restartBrowser = async () => {
  logger.warn("[Browser] Restarting browser manually...");

  try {
    await browserInstance?.close?.();
  } catch {}

  browserInstance = null;
  launchingPromise = null;

  await getBrowser();
};

// ============================================================
// SHUTDOWN
// ============================================================

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
