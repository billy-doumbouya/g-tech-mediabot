/**
 * src/automation/facebookGraphAPI.js
 * ============================================================
 * FACEBOOK GRAPH API PUBLISHER (PRIMARY METHOD)
 * ============================================================
 * WHY GRAPH API IS THE PRIMARY METHOD:
 * - Official, stable, supported by Meta
 * - No risk of account suspension
 * - Reliable — doesn't break when Facebook updates its UI
 * - Can post images + text in one API call
 * - Rate limits are generous for PAGE publishing
 *
 * HOW TO GET YOUR CREDENTIALS:
 * 1. Go to https://developers.facebook.com/
 * 2. Create an App → Business type
 * 3. Add "Pages" product
 * 4. Get Page Access Token (long-lived via token debugger)
 * 5. Copy Page ID from your Facebook Page URL or settings
 *
 * API USED:
 * POST /{page-id}/photos — Upload image + caption in one call
 * ============================================================
 */

import axios from "axios";
import fs from "fs-extra";
import FormData from "form-data";
import { config } from "../config/index.js";
import { withRetry } from "../utils/asyncWrapper.js";
import logger from "../utils/logger.js";

const GRAPH_API_BASE = "https://graph.facebook.com/v19.0";

/**
 * Publish an image post to the Facebook Page via Graph API
 * @param {string} imagePath - Local path to the image file
 * @param {string} caption - Full post text (body + hashtags)
 * @returns {Promise<string>} - Facebook post ID
 */
export const publishViaGraphAPI = async (imagePath, caption) => {
  // Validate config — fail early if credentials are missing
  if (!config.facebook.pageId || !config.facebook.pageAccessToken) {
    throw new Error(
      "Facebook Graph API credentials missing. " +
        "Set FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN in .env",
    );
  }

  // Verify image file exists
  const imageExists = await fs.pathExists(imagePath);
  if (!imageExists) {
    throw new Error(`Image file not found: ${imagePath}`);
  }

  logger.info("📤 Publishing via Facebook Graph API...");

  return withRetry(
    async () => uploadPhotoToPage(imagePath, caption),
    3,
    3000,
    "Facebook Graph API",
  );
};

/**
 * Internal: Upload photo to Facebook Page
 * Uses the /photos endpoint which accepts an image + message in one call
 */
const uploadPhotoToPage = async (imagePath, caption) => {
  try {
    const formData = new FormData();
    formData.append("source", fs.createReadStream(imagePath));
    formData.append("message", caption);
    formData.append("access_token", config.facebook.pageAccessToken);
    formData.append("published", "true");

    const response = await axios.post(
      `${GRAPH_API_BASE}/${config.facebook.pageId}/photos`,
      formData,
      {
        headers: { ...formData.getHeaders() },
        timeout: 60000,
      },
    );

    const postId = response.data?.post_id || response.data?.id;
    if (!postId) {
      throw new Error(
        `Graph API returned unexpected response: ${JSON.stringify(response.data)}`,
      );
    }

    logger.info(`✅ Graph API publish success. Post ID: ${postId}`);
    return postId;
  } catch (error) {
    // Log the FULL error detail so we can debug
    if (error.response?.data) {
      logger.error("❌ Graph API full error:", {
        status: error.response.status,
        detail: JSON.stringify(error.response.data),
      });
    }
    throw error;
  }
};

/**
 * Check if Graph API credentials are configured
 * @returns {boolean}
 */
export const isGraphAPIConfigured = () => {
  return !!(config.facebook.pageId && config.facebook.pageAccessToken);
};
