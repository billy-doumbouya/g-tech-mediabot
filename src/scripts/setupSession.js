/**
 * src/scripts/setupSession.js
 * ============================================================
 * HARDENED BROWSER SESSION SETUP — RUN ONCE
 * ============================================================
 */

import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs-extra";
import path from "path";
import readline from "readline";
import { config } from "../config/index.js";
import logger from "../utils/logger.js";

puppeteerExtra.use(StealthPlugin());

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const waitForEnter = (msg) =>
  new Promise((resolve) => rl.question(msg, resolve));

logger.info("🔧 Hardened Browser Session Provisioner — GTech MediaBot");
logger.info(
  `📁 Output profile destination: ${path.resolve(config.puppeteer.userDataDir)}`,
);

(async () => {
  try {
    // Ensure path trees exist prior to mounting
    await fs.ensureDir(config.puppeteer.userDataDir);

    // Launch visible browser instance for authentication capturing
    const browser = await puppeteerExtra.launch({
      headless: false, // Core constraint: Must remain visible for human validation
      userDataDir: path.resolve(config.puppeteer.userDataDir),
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--window-size=1280,800",
        "--disable-extensions",
      ],
      defaultViewport: { width: 1280, height: 800 },
    });

    // PRODUCTION FIX: Reuse the initial default tab created by launch()
    // This stops multiple tabs from racing to write conflicting storage states on closure.
    const openPages = await browser.pages();
    const page = openPages.length > 0 ? openPages[0] : await browser.newPage();

    // Mask fingerprinting flags inside the provisioner workspace
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );

    // Block notification permission alerts natively to keep the UI clean
    const context = browser.defaultBrowserContext();
    await context.overridePermissions("https://www.facebook.com", [
      "notifications",
    ]);

    await page.goto("https://www.facebook.com", {
      waitUntil: "templates" in page ? "networkidle2" : "domcontentloaded",
    });

    console.log("\n" + "=".repeat(60));
    console.log("👋 Secure profile window initialized successfully.");
    console.log("");
    console.log("CRITICAL STEPS:");
    console.log("  1. Authenticate your target Facebook identity profile");
    console.log("  2. Navigate to your target business workspace / Page");
    console.log("  3. Assert profile switching prompts have been cleared");
    console.log("  4. Re-focus this terminal prompt window and press ENTER");
    console.log("=".repeat(60) + "\n");

    await waitForEnter(
      "Press ENTER once your workspace session state stabilizes → ",
    );

    // PRODUCTION FIX: Programmatically extract and check cookies to confirm a valid login session
    logger.debug("📊 Verifying state tokens before teardown...");
    const sessionCookies = await page.cookies();
    const loginConfirmed = sessionCookies.some(
      (cookie) => cookie.name === "c_user",
    );

    if (!loginConfirmed) {
      logger.warn(
        '⚠️ Warning: No active Facebook session cookies ("c_user") were detected. Your session may run unauthenticated.',
      );
    } else {
      logger.info(
        "🔑 Active user authentication cookies verified inside storage layer.",
      );
    }

    // Give Chromium a 3-second grace period to flush its internal database logs to disk
    logger.debug("💾 Synchronizing storage profiles with file system...");
    await page.goto("about:blank").catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Tear down interface configurations cleanly
    await browser.close();
    rl.close();

    logger.info("🎉 Production token storage compiled successfully!");
    logger.info(
      `📁 Active session available for upload at: ${path.resolve(config.puppeteer.userDataDir)}`,
    );
    process.exit(0);
  } catch (err) {
    logger.error(
      "❌ Session generation wizard aborted due to a system exception:",
      { message: err.message },
    );
    rl.close();
    process.exit(1);
  }
})();
