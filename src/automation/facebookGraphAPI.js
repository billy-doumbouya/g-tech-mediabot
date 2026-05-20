/**
 * src/automation/facebookGraphAPI.js
 * ============================================================
 * PRODUCTION HARDENED FACEBOOK GRAPH API PUBLISHER
 * ============================================================
 */

import axios from "axios";
import fs from "fs-extra";
import FormData from "form-data";
import { config } from "../config/index.js";
import { withRetry } from "../utils/asyncWrapper.js";
import logger from "../utils/logger.js";

const GRAPH_API_BASE = "https://graph.facebook.com/v19.0";

/* ============================================================
   PUBLIC ENTRY
============================================================ */

export const publishViaGraphAPI = async (imagePath, caption) => {
  if (!config.facebook.pageId || !config.facebook.pageAccessToken) {
    throw new Error("[GraphAPI] Missing credentials");
  }

  const exists = await fs.pathExists(imagePath);
  if (!exists) {
    throw new Error(`[GraphAPI] File not found: ${imagePath}`);
  }

  return withRetry(
    () => uploadPhoto(imagePath, caption),
    3,
    2000,
    "GraphAPI Publish",
  );
};

/* ============================================================
   CORE UPLOAD
============================================================ */

const uploadPhoto = async (imagePath, caption) => {
  const formData = new FormData();

  const stats = await fs.stat(imagePath);
  const stream = fs.createReadStream(imagePath);

  formData.append("source", stream, {
    knownLength: stats.size,
  });

  formData.append("message", caption);
  formData.append("access_token", config.facebook.pageAccessToken);
  formData.append("published", "true");

  const url = `${GRAPH_API_BASE}/${config.facebook.pageId}/photos`;

  let contentLength;

  try {
    contentLength = await new Promise((resolve, reject) => {
      formData.getLength((err, len) => {
        if (err) reject(err);
        else resolve(len);
      });
    });
  } catch (e) {
    logger.warn("[GraphAPI] Could not compute content length");
  }

  const controller = new AbortController();

  // optional hard timeout safety
  const timeout = setTimeout(() => {
    controller.abort();
  }, 90000);

  try {
    const response = await axios.post(url, formData, {
      headers: {
        ...formData.getHeaders(),
        ...(contentLength ? { "Content-Length": contentLength } : {}),
      },
      signal: controller.signal,
      timeout: 90000,
    });

    const postId = response.data?.post_id || response.data?.id;

    if (!postId) {
      throw new Error("[GraphAPI] Missing post ID in response");
    }

    logger.info("[GraphAPI] Post published", {
      postId,
    });

    return postId;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error("[GraphAPI] API error", {
        status: error.response?.status,
        code: error.code,
      });

      // IMPORTANT: detect invalid token early
      if (error.response?.data?.error?.code === 190) {
        logger.error("[GraphAPI] Invalid or expired token detected");
      }
    } else {
      logger.error("[GraphAPI] Unexpected error", {
        message: error.message,
      });
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

/* ============================================================
   HEALTH CHECK
============================================================ */

export const isGraphAPIConfigured = () => {
  return Boolean(config.facebook.pageId && config.facebook.pageAccessToken);
};
