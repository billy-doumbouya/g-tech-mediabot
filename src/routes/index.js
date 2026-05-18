/**
 * src/routes/index.js
 * ============================================================
 * EXPRESS ROUTER — ALL API ROUTES
 * ============================================================
 * WHY SEPARATE ROUTES FROM CONTROLLERS:
 * Routes define WHERE requests go (URLs + HTTP methods).
 * Controllers define WHAT happens when they arrive.
 * Separation keeps both files small and focused.
 * ============================================================
 */

import { Router } from 'express';
import { asyncWrapper } from '../utils/asyncWrapper.js';
import {
  triggerPost,
  getAnalytics,
  getPosts,
  healthCheck,
} from '../controllers/postController.js';

const router = Router();

// ============================================================
// HEALTH CHECK — Railway uses this to verify the app is running
// ============================================================
router.get('/health', healthCheck);

// ============================================================
// POST MANAGEMENT
// ============================================================

// Manually trigger a post (useful for testing)
// POST /api/trigger-post  { "category": "morning" }
router.post('/trigger-post', asyncWrapper(triggerPost));

// Get recent post history
// GET /api/posts?limit=10
router.get('/posts', asyncWrapper(getPosts));

// ============================================================
// ANALYTICS
// ============================================================

// Get today's analytics + all-time stats
// GET /api/analytics
router.get('/analytics', asyncWrapper(getAnalytics));

export default router;
