/**
 * src/services/postService.js
 * ============================================================
 * POST SERVICE — CORE BUSINESS LOGIC PIPELINE
 * ============================================================
 * WHY SERVICES EXIST (ARCHITECTURE LESSON):
 * The "service layer" contains PURE BUSINESS LOGIC.
 * It knows nothing about HTTP (no req/res), nothing about
 * how routes are structured. It just orchestrates the pipeline.
 *
 * This means:
 * - Controllers call services (HTTP layer talks to business layer)
 * - Schedulers call services (cron jobs talk to business layer)
 * - Both share the same logic — no code duplication
 *
 * THE COMPLETE PIPELINE:
 * 1. Generate AI content (OpenRouter)
 * 2. Choose layout template
 * 3. Render HTML template
 * 4. Generate image (Puppeteer screenshot)
 * 5. Build caption text
 * 6. Try Graph API publish → if fails → try Puppeteer publish
 * 7. Save everything to MongoDB
 * 8. Update analytics
 * ============================================================
 */

import { v4 as uuidv4 } from 'uuid';
import { generateContent } from '../ai/openrouter.js';
import { renderTemplate, suggestLayouts } from '../templates/layouts.js';
import { generateImage } from '../automation/screenshotGenerator.js';
import { publishViaGraphAPI, isGraphAPIConfigured } from '../automation/facebookGraphAPI.js';
import { publishViaPuppeteer } from '../automation/facebookPuppeteer.js';
import Post from '../models/Post.js';
import Analytics from '../models/Analytics.js';
import logger from '../utils/logger.js';

/**
 * MAIN PIPELINE: Run the complete post creation and publishing flow
 * @param {string} category - 'morning' | 'midday' | 'evening'
 * @returns {Promise<Object>} - The saved Post document
 */
export const runPostPipeline = async (category) => {
  const postId = uuidv4();
  logger.info(`🎬 Starting post pipeline [${category}] — ID: ${postId}`);

  // ============================================================
  // STEP 1: GENERATE AI CONTENT
  // ============================================================
  logger.info('🤖 Step 1/5: Generating AI content...');
  const aiContent = await generateContent(category);
  await Analytics.increment('aiCallsTotal').catch(() => {});

  logger.info(`✅ AI content ready: "${aiContent.title}"`);

  // ============================================================
  // STEP 2: SELECT LAYOUT
  // Choose the best visual layout for this category
  // ============================================================
  logger.info('🎨 Step 2/5: Selecting layout...');
  const suggestedLayouts = suggestLayouts(category);
  // Pick the primary suggested layout
  // In future: could rotate layouts to avoid repetition
  const templateName = suggestedLayouts[0];
  logger.info(`✅ Layout selected: ${templateName}`);

  // ============================================================
  // STEP 3: RENDER HTML TEMPLATE
  // ============================================================
  logger.info('🖼️ Step 3/5: Rendering HTML template...');
  const html = renderTemplate(templateName, aiContent);
  logger.info('✅ HTML template rendered');

  // ============================================================
  // STEP 4: GENERATE IMAGE
  // ============================================================
  logger.info('📸 Step 4/5: Generating screenshot image...');
  const imagePath = await generateImage(html, postId);
  await Analytics.increment('imagesGenerated').catch(() => {});

  // ============================================================
  // STEP 5: BUILD CAPTION
  // ============================================================
  const caption = buildCaption(aiContent);

  // ============================================================
  // STEP 6: SAVE INITIAL POST RECORD (pending)
  // WHY: We save before publishing so if the app crashes mid-publish,
  // we have a record and can retry later.
  // ============================================================
  const post = await Post.create({
    uuid: postId,
    category,
    aiContent: {
      ...aiContent,
      model: 'openrouter',
    },
    templateName,
    imagePath,
    htmlSnapshot: html,
    status: 'pending',
  });

  await Analytics.increment('postsGenerated').catch(() => {});

  // ============================================================
  // STEP 7: PUBLISH (Hybrid: Graph API → Puppeteer fallback)
  // ============================================================
  logger.info('📤 Step 5/5: Publishing to Facebook...');

  let facebookPostId = null;
  let publishedVia = null;
  let publishError = null;
  let publishAttempts = 0;

  // --- PRIMARY: Try Graph API ---
  if (isGraphAPIConfigured()) {
    try {
      publishAttempts++;
      facebookPostId = await publishViaGraphAPI(imagePath, caption);
      publishedVia = 'graph_api';
      await Analytics.increment('graphApiSuccess').catch(() => {});
      logger.info('✅ Published via Graph API');
    } catch (error) {
      publishError = error.message;
      logger.warn(`⚠️ Graph API failed: ${error.message}. Trying Puppeteer fallback...`);
    }
  } else {
    logger.info('ℹ️ Graph API not configured — skipping to Puppeteer');
  }

  // --- FALLBACK: Try Puppeteer ---
  if (!publishedVia) {
    try {
      publishAttempts++;
      facebookPostId = await publishViaPuppeteer(imagePath, caption);
      publishedVia = 'puppeteer';
      await Analytics.increment('puppeteerFallbackUsed').catch(() => {});
      logger.info('✅ Published via Puppeteer');
    } catch (error) {
      publishError = `Graph API: ${publishError || 'not tried'} | Puppeteer: ${error.message}`;
      logger.error('❌ Both publishing methods failed', { error: publishError });
    }
  }

  // ============================================================
  // STEP 8: UPDATE POST RECORD
  // ============================================================
  const status = publishedVia ? 'published' : 'failed';

  await post.updateOne({
    status,
    publishedVia,
    facebookPostId,
    errorMessage: publishError,
    publishAttempts,
    publishedAt: publishedVia ? new Date() : null,
  });

  if (status === 'published') {
    await Analytics.increment('postsPublished').catch(() => {});
  } else {
    await Analytics.increment('postsFailed').catch(() => {});
  }

  logger.info(`🏁 Pipeline complete. Status: ${status}${publishedVia ? ` via ${publishedVia}` : ''}`);

  return { ...post.toObject(), status, publishedVia, facebookPostId };
};

/**
 * Build the full Facebook post caption from AI content
 * Combines body text + CTA + hashtags
 * @param {Object} aiContent
 * @returns {string}
 */
const buildCaption = (aiContent) => {
  const parts = [
    aiContent.bodyText,
    '',
    aiContent.cta,
    '',
    aiContent.hashtags.join(' '),
  ];
  return parts.filter(p => p !== undefined && p !== null).join('\n').trim();
};

/**
 * Get recent posts for the analytics/logs API endpoint
 * @param {number} limit - Max number of posts to return
 * @returns {Promise<Array>}
 */
export const getRecentPosts = async (limit = 20) => {
  return Post.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

/**
 * Get today's analytics summary
 * @returns {Promise<Object>}
 */
export const getTodayAnalytics = async () => {
  const today = new Date().toISOString().split('T')[0];
  const analytics = await Analytics.findOne({ dateKey: today }).lean();
  const totalPosts = await Post.countDocuments();
  const publishedPosts = await Post.countDocuments({ status: 'published' });

  return {
    today: analytics || { dateKey: today },
    allTime: { totalPosts, publishedPosts },
  };
};
