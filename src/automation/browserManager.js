import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs-extra";
import path from "path";
import { config } from "../config/index.js";
import logger from "../utils/logger.js";

puppeteerExtra.use(StealthPlugin());

let browserInstance = null;
let launchingPromise = null;

// UA Cohérent avec la version de Chromium utilisée par Puppeteer
const FIXED_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export const getBrowser = async () => {
  if (browserInstance?.connected) return browserInstance;
  if (launchingPromise) return launchingPromise;

  launchingPromise = launchBrowser();
  try {
    browserInstance = await launchingPromise;
    return browserInstance;
  } finally {
    launchingPromise = null;
  }
};

const launchBrowser = async () => {
  logger.info("[Browser] Launching...");
  const storagePath = path.resolve("./browser-session");
  await fs.ensureDir(storagePath);

  const browser = await puppeteerExtra.launch({
    headless: config.puppeteer.headless === "true" ? "new" : false,
    userDataDir: storagePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-notifications",
      "--lang=fr-FR,fr",
      "--window-size=1280,800",
    ],
    defaultViewport: { width: 1280, height: 800 },
  });

  browser.on("disconnected", () => {
    logger.warn("[Browser] Disconnected");
    browserInstance = null;
  });

  return browser;
};

export const newPage = async () => {
  const browser = await getBrowser();
  const page = await browser.newPage();

  await page.setUserAgent(FIXED_USER_AGENT);
  await page.setExtraHTTPHeaders({ "Accept-Language": "fr-FR,fr;q=0.9" });

  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(30000);

  return page;
};

export const closeBrowser = async () => {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
};
