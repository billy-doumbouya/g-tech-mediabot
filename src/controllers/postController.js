/**
 * src/controllers/postController.js
 * ============================================================
 * PRODUCTION-READY POST CONTROLLER — HTTP LAYER
 * ============================================================
 */

import {
  runPostPipeline,
  getRecentPosts,
  getTodayAnalytics,
} from "../services/postService.js";
import logger from "../utils/logger.js";

/**
 * POST /api/trigger-post
 * Manually trigger a post for a given category asynchronously
 * Body: { category: 'morning' | 'midday' | 'evening' }
 */
export const triggerPost = async (req, res) => {
  try {
    const { category = "morning" } = req.body;
    const validCategories = ["morning", "midday", "evening"];

    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category. Valid values: ${validCategories.join(", ")}`,
      });
    }

    logger.info(
      `🔧 Manual trigger initiated: ${category} post by client IP ${req.ip}`,
    );

    // PRODUCTION FIX: Do NOT await long-running execution sequences inside HTTP handling threads.
    // We hand off the task and run it asynchronously to avoid proxy timeout thresholds (e.g. 504 Gateway errors).
    runPostPipeline(category)
      .then((result) => {
        logger.info(
          `🎉 Background automated pipeline run successfully completed for target: ${category}`,
          {
            uuid: result?.uuid,
            publishedVia: result?.publishedVia,
          },
        );
      })
      .catch((pipelineErr) => {
        logger.error(
          `❌ Background post automation task tracking encountered an unhandled execution crash:`,
          {
            message: pipelineErr.message,
            category,
          },
        );
      });

    // Instantly return an HTTP 202 Accepted status indicating processing has started safely in the background.
    return res.status(202).json({
      success: true,
      message: `Post generation pipeline safely scheduled and executed in worker background context.`,
      category,
    });
  } catch (error) {
    logger.error(
      "❌ Critical handler failure inside triggerPost API endpoint:",
      { message: error.message },
    );
    return res.status(500).json({
      success: false,
      message: "Internal server initialization error.",
    });
  }
};

/**
 * GET /api/analytics
 * Return posting analytics summary
 */
export const getAnalytics = async (req, res) => {
  try {
    const analytics = await getTodayAnalytics();

    return res.status(200).json({
      success: true,
      data: analytics || {},
    });
  } catch (error) {
    logger.error(
      "❌ Data hydration exception encountered inside getAnalytics API endpoint:",
      { message: error.message },
    );
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve target data layers.",
    });
  }
};

/**
 * GET /api/posts
 * Return recent posts history
 */
export const getPosts = async (req, res) => {
  try {
    // Hardened Query Normalization: Eliminate NaN vulnerabilities cleanly
    const parsedLimit = parseInt(req.query.limit, 10);
    const safeLimit = isNaN(parsedLimit) ? 20 : Math.min(parsedLimit, 100);

    const posts = await getRecentPosts(safeLimit);

    return res.status(200).json({
      success: true,
      count: posts ? posts.length : 0,
      data: (posts || []).map((p) => ({
        id: p.uuid,
        category: p.category,
        title: p.aiContent?.title || "Untitled Generation",
        status: p.status,
        publishedVia: p.publishedVia,
        publishedAt: p.publishedAt,
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    logger.error(
      "❌ Query collection process aborted inside getPosts API endpoint:",
      { message: error.message },
    );
    return res
      .status(500)
      .json({ success: false, message: "Could not fetch records feed." });
  }
};

/**
 * GET /health
 * Health check endpoint for Railway and external continuous infrastructure monitoring tools
 */
export const healthCheck = (req, res) => {
  try {
    return res.status(200).json({
      status: "healthy",
      app: "GTech MediaBot",
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || "development",
    });
  } catch (error) {
    // Minimal fallback logic to ensure system monitors still receive a structural object format during heavy context failures
    return res.status(500).json({ status: "unhealthy", error: error.message });
  }
};
