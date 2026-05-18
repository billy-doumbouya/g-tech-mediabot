/**
 * src/controllers/postController.js
 * ============================================================
 * POST CONTROLLER — HTTP LAYER
 * ============================================================
 * WHY CONTROLLERS EXIST (ARCHITECTURE LESSON):
 * Controllers handle ONE thing: the HTTP request/response cycle.
 * They extract data from req, call the appropriate service,
 * and format the response. That's it.
 *
 * THEY DO NOT contain business logic.
 * Business logic lives in services/.
 *
 * This separation means:
 * - You can change how you receive inputs (REST vs GraphQL vs CLI)
 *   without touching business logic
 * - Services are testable without HTTP context
 * - Controllers stay thin and readable
 * ============================================================
 */

import { runPostPipeline, getRecentPosts, getTodayAnalytics } from '../services/postService.js';
import logger from '../utils/logger.js';

/**
 * POST /api/trigger-post
 * Manually trigger a post for a given category
 * Body: { category: 'morning' | 'midday' | 'evening' }
 */
export const triggerPost = async (req, res) => {
  const { category = 'morning' } = req.body;

  const validCategories = ['morning', 'midday', 'evening'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({
      success: false,
      message: `Invalid category. Valid values: ${validCategories.join(', ')}`,
    });
  }

  logger.info(`🔧 Manual trigger: ${category} post by ${req.ip}`);

  // Run the pipeline — can take 15-30 seconds
  // We don't await here for a fast response, but we do in practice for status
  const result = await runPostPipeline(category);

  return res.status(200).json({
    success: true,
    message: `Post pipeline completed`,
    data: {
      postId: result.uuid,
      status: result.status,
      publishedVia: result.publishedVia,
      facebookPostId: result.facebookPostId,
      title: result.aiContent?.title,
    },
  });
};

/**
 * GET /api/analytics
 * Return posting analytics summary
 */
export const getAnalytics = async (req, res) => {
  const analytics = await getTodayAnalytics();

  return res.status(200).json({
    success: true,
    data: analytics,
  });
};

/**
 * GET /api/posts
 * Return recent posts history
 */
export const getPosts = async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const posts = await getRecentPosts(limit);

  return res.status(200).json({
    success: true,
    count: posts.length,
    data: posts.map(p => ({
      id: p.uuid,
      category: p.category,
      title: p.aiContent?.title,
      status: p.status,
      publishedVia: p.publishedVia,
      publishedAt: p.publishedAt,
      createdAt: p.createdAt,
    })),
  });
};

/**
 * GET /health
 * Health check endpoint for Railway and monitoring tools
 */
export const healthCheck = (req, res) => {
  res.status(200).json({
    status: 'healthy',
    app: 'GTech MediaBot',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV,
  });
};
