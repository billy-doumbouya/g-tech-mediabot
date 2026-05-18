/**
 * src/automation/facebookPuppeteer.js — UPDATED VERSION
 */

import path from "path";
import { newPage } from "./browserManager.js";
import { sleep } from "../utils/asyncWrapper.js";
import { config } from "../config/index.js";
import logger from "../utils/logger.js";

const FACEBOOK_URL = "https://www.facebook.com";

export const publishViaPuppeteer = async (imagePath, caption) => {
  logger.info("🤖 Attempting Puppeteer Facebook publish (fallback)...");
  let page = null;
  try {
    page = await newPage();
    const isLoggedIn = await checkLoginStatus(page);
    if (!isLoggedIn) {
      logger.info("🔐 Not logged in. Attempting login...");
      await loginToFacebook(page);
    } else {
      logger.info("✅ Already logged in (session active)");
    }
    await navigateToPage(page);
    await createPost(page, imagePath, caption);
    logger.info("✅ Puppeteer publish successful");
    return "puppeteer-success";
  } catch (error) {
    logger.error("❌ Puppeteer publish failed", { error: error.message });
    throw error;
  } finally {
    if (page) await page.close().catch(() => {});
  }
};

const checkLoginStatus = async (page) => {
  await page.goto(FACEBOOK_URL, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await sleep(2000);
  const currentUrl = page.url();
  const hasLoginForm = await page
    .$('[data-testid="royal_email"]')
    .catch(() => null);
  return !currentUrl.includes("/login") && !hasLoginForm;
};

const loginToFacebook = async (page) => {
  if (!config.facebook.email || !config.facebook.password) {
    throw new Error(
      "Facebook credentials not set. Add FACEBOOK_EMAIL and FACEBOOK_PASSWORD to .env",
    );
  }
  await page.goto(`${FACEBOOK_URL}/login`, {
    waitUntil: "networkidle2",
    timeout: 30000,
  });
  await sleep(1500);
  await page.type("#email", config.facebook.email, { delay: 80 });
  await sleep(500);
  await page.type("#pass", config.facebook.password, { delay: 80 });
  await sleep(500);
  await page.click('[data-testid="royal_login_button"]');
  await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 });
  logger.info("✅ Facebook login successful");
  await sleep(3000);
};

const navigateToPage = async (page) => {
  const pageUrl = `${FACEBOOK_URL}/${config.facebook.pageName}`;
  logger.info(`🔗 Navigating to: ${pageUrl}`);
  await page.goto(pageUrl, { waitUntil: "networkidle2", timeout: 30000 });
  await sleep(3000);
  try {
    const switchBtn = await page.$('[aria-label*="Switch to Page"]');
    if (switchBtn) {
      await switchBtn.click();
      await sleep(2000);
      logger.info("✅ Switched to Page posting mode");
    }
  } catch {
    /* Not required */
  }
};

const createPost = async (page, imagePath, caption) => {
  // STEP 1: Find composer
  logger.debug("📝 Looking for post composer...");
  await sleep(3000);

  await page.screenshot({
    path: path.resolve("./generated-images/debug-page.png"),
  });
  logger.info("📸 Debug screenshot → generated-images/debug-page.png");

  // PRIMARY SELECTORS — based on G-tech-academy page (English UK)
  const composerSelectors = [
    '[aria-label="Share a thought..."]',
    '[aria-label="Write something..."]',
    '[aria-label="Create a post"]',
    '[aria-label="Créer une publication"]',
    '[aria-label="Créer un post"]',
    '[aria-label="Quoi de neuf ?"]',
    '[role="button"][tabindex="0"]',
    'div[contenteditable="true"]',
  ];

  let composerClicked = false;

  for (const selector of composerSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 3000 });
      const el = await page.$(selector);
      if (el) {
        await el.click();
        composerClicked = true;
        logger.debug(`✅ Composer clicked: ${selector}`);
        await sleep(2000);
        break;
      }
    } catch {
      /* try next */
    }
  }

  // FALLBACK 1 — ciblage par placeholder text exact
  if (!composerClicked) {
    try {
      await page.evaluate(() => {
        const all = Array.from(document.querySelectorAll("*"));
        const target = all.find(
          (el) =>
            el.textContent.trim() === "Share a thought..." ||
            el.getAttribute("placeholder") === "Share a thought..." ||
            el.textContent.trim() === "Write something..." ||
            el.getAttribute("placeholder") === "Write something...",
        );
        if (target) target.click();
      });
      composerClicked = true;
      logger.debug("✅ Composer clicked via Share a thought placeholder");
      await sleep(2000);
    } catch {
      /* continue */
    }
  }

  // FALLBACK 2 — recherche par mots-clés
  if (!composerClicked) {
    try {
      await page.evaluate(() => {
        const divs = Array.from(
          document.querySelectorAll('div[role="button"]'),
        );
        const composer = divs.find(
          (d) =>
            d.textContent.includes("thought") ||
            d.textContent.includes("something") ||
            d.textContent.includes("tête") ||
            d.textContent.includes("mind") ||
            d.textContent.includes("publication") ||
            d.textContent.includes("post"),
        );
        if (composer) composer.click();
      });
      composerClicked = true;
      logger.debug("✅ Composer clicked via text content search");
      await sleep(2000);
    } catch {
      /* continue */
    }
  }

  if (!composerClicked) {
    throw new Error(
      "Could not find post composer. Check generated-images/debug-page.png",
    );
  }

  // STEP 2: Click Photo button
  logger.debug("🖼️ Looking for Photo/Video button...");
  await sleep(1500);

  const photoButtonSelectors = [
    '[aria-label*="Photo"]',
    '[aria-label*="photo"]',
    '[aria-label*="Video"]',
    '[aria-label*="Vidéo"]',
    '[aria-label*="image"]',
    '[data-testid*="photo"]',
  ];

  for (const selector of photoButtonSelectors) {
    try {
      const btn = await page.$(selector);
      if (btn) {
        await btn.click();
        logger.debug(`✅ Photo button clicked: ${selector}`);
        await sleep(2000);
        break;
      }
    } catch {
      /* try next */
    }
  }

  // STEP 3: Upload image
  logger.debug("📎 Attaching image file...");
  try {
    await page.waitForSelector('input[type="file"]', { timeout: 5000 });
    const fileInput = await page.$('input[type="file"]');
    if (fileInput) {
      await fileInput.uploadFile(path.resolve(imagePath));
      logger.debug("✅ Image file attached");
      await sleep(4000);
    }
  } catch {
    logger.warn("⚠️ File input not found — will post text only");
  }

  // STEP 4: Type caption
  logger.debug("✍️ Typing caption...");
  try {
    const textArea =
      (await page.$('div[contenteditable="true"][role="textbox"]')) ||
      (await page.$('div[contenteditable="true"]'));
    if (textArea) {
      await textArea.click();
      await sleep(500);
      await page.keyboard.type(caption, { delay: 10 });
      logger.debug("✅ Caption typed");
    }
  } catch {
    await page.keyboard.type(caption, { delay: 10 });
  }

  await sleep(2000);

  await page.screenshot({
    path: path.resolve("./generated-images/debug-before-publish.png"),
  });
  logger.info(
    "📸 Pre-publish screenshot → generated-images/debug-before-publish.png",
  );

  // STEP 5: Click Publish
  logger.debug("🚀 Looking for publish button...");

  const publishSelectors = [
    '[aria-label="Publier"]',
    '[aria-label="Post"]',
    '[aria-label="Poster"]',
    'div[aria-label="Publier"]',
    'div[aria-label="Post"]',
  ];

  let published = false;

  for (const selector of publishSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 3000 });
      const btn = await page.$(selector);
      if (btn) {
        await btn.click();
        published = true;
        logger.debug(`✅ Publish button clicked: ${selector}`);
        break;
      }
    } catch {
      /* try next */
    }
  }

  // Last resort — find by text
  if (!published) {
    try {
      await page.evaluate(() => {
        const buttons = Array.from(
          document.querySelectorAll('div[role="button"], button'),
        );
        const publishBtn = buttons.find(
          (b) =>
            b.textContent.trim() === "Publier" ||
            b.textContent.trim() === "Post" ||
            b.textContent.trim() === "Poster",
        );
        if (publishBtn) publishBtn.click();
      });
      published = true;
      logger.debug("✅ Publish button clicked via text search");
    } catch {
      /* failed */
    }
  }

  if (!published) {
    throw new Error(
      "Could not find publish button. Check generated-images/debug-before-publish.png",
    );
  }

  await sleep(5000);
  logger.info("✅ Post submitted via Puppeteer");
};
