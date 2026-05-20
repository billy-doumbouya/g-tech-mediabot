/**
 * src/scripts/manualTrigger.js
 * ============================================================
 * PRODUCTION-READY MANUAL TRIGGER SCRIPT
 * ============================================================
 */

// PRODUCTION FIX: Always initialize configurations before pulling down dependent application layers.
import { config } from "../config/index.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { runPostPipeline } from "../services/postService.js";
import { closeBrowser } from "../automation/browserManager.js";
import logger from "../utils/logger.js";

// Argument extraction and normalizations
const targetCategory = (process.argv[2] || "morning").toLowerCase().trim();
const validCategories = ["morning", "midday", "evening"];

if (!validCategories.includes(targetCategory)) {
  logger.error(
    `❌ Validation Error: Invalid category payload "${targetCategory}" provided.`,
  );
  logger.error(
    `💡 Acceptable interface runtime arguments: [ ${validCategories.join(" | ")} ]`,
  );
  process.exit(1);
}

logger.info(
  `🔧 Launching administrative manual trigger pipeline runner for task: [${targetCategory}]`,
);

(async () => {
  let dbConnected = false;

  try {
    // 1. Establish data layer socket connectivity
    logger.debug(
      "💾 Mounting infrastructure data layer context connections...",
    );
    await connectDatabase();
    dbConnected = true;

    // 2. Invoke core business process pipeline
    const processingResult = await runPostPipeline(targetCategory);

    // 3. Evaluate and log results feed
    if (processingResult?.status === "published") {
      logger.info("🎉 Manual execution workflow processed cleanly!");
    } else {
      logger.warn(
        "⚠️ Pipeline parsed completely but deployment targets reported tracking drops.",
      );
    }

    logger.info("📊 Summary Execution Report:", {
      postId: processingResult?.uuid || "N/A",
      status: processingResult?.status || "failed",
      publishedVia: processingResult?.publishedVia || "none",
      facebookPostId: processingResult?.facebookPostId || "none",
    });
  } catch (error) {
    logger.error(
      "❌ Automation runner encountered a severe processing exception:",
      {
        message: error.message,
      },
    );
    process.exitCode = 1; // Set bad exit status safely without violently crashing systemic cleanup tasks
  } finally {
    logger.debug("🔌 Initiating resource cleanup routines...");

    // Clean browser context safely. Only run tear down handlers if the browser was touched.
    try {
      await closeBrowser();
    } catch (browserTeardownErr) {
      logger.error(
        "⚠️ Secondary fault skipped during browser engine closure:",
        browserTeardownErr.message,
      );
    }

    // Tear down active database networks securely if previously mounted
    if (dbConnected) {
      try {
        // Give MongoDB a 1.5 second pause block to flush pending operations safely before killing sockets
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await disconnectDatabase();
        logger.debug("💾 Database connection pools safely drained.");
      } catch (dbTeardownErr) {
        logger.error(
          "⚠️ Secondary fault skipped during database network drain:",
          dbTeardownErr.message,
        );
      }
    }

    logger.info("🏁 Process terminal session context closed.");
    // process.exitCode naturally forces the execution environment to cleanly close active thread pools.
    process.exit(process.exitCode || 0);
  }
})();
