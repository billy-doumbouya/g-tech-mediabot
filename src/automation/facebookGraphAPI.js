/**
 * src/automation/facebookGraphAPI.js
 * ============================================================
 * PRODUCTION HARDENED FACEBOOK GRAPH API PUBLISHER (CORRIGÉ)
 * ============================================================
 */

import axios from "axios";
import fs from "fs-extra";
import FormData from "form-data";
import { config } from "../config/index.js";
import { withRetry } from "../utils/asyncWrapper.js";
import logger from "../utils/logger.js";

// v21.0 ou v19.0 selon ton app Meta, mais la logique reste standardisée
const GRAPH_API_BASE = "https://graph.facebook.com/v19.0";

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

const uploadPhoto = async (imagePath, caption) => {
  const formData = new FormData();
  let stream = null;

  try {
    const stats = await fs.stat(imagePath);
    stream = fs.createReadStream(imagePath);

    formData.append("source", stream, {
      knownLength: stats.size,
    });

    formData.append("message", caption);
    formData.append("access_token", config.facebook.pageAccessToken);

    // On s'assure que l'image est publiée directement sur le fil de la page
    formData.append("published", "true");

    // Endpoint standardisé pour la publication de photo sur le mur d'une Page
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

    // Gestion propre du timeout via Axios uniquement (évite les conflits de signaux)
    const response = await axios.post(url, formData, {
      headers: {
        ...formData.getHeaders(),
        ...(contentLength ? { "Content-Length": contentLength } : {}),
      },
      timeout: 60000, // 60 secondes suffisent largement pour un upload d'image
    });

    // Selon les versions, l'API retourne 'id' (ID de la photo) ou 'post_id' (ID de la publication sur le feed)
    const postId = response.data?.post_id || response.data?.id;

    if (!postId) {
      throw new Error("[GraphAPI] Missing post ID in response");
    }

    logger.info("[GraphAPI] ✅ Post published successfully via API", {
      postId,
    });
    return postId;
  } catch (error) {
    // SÉCURITÉ CRITIQUE : Destruction du stream en cas d'erreur pour libérer le fichier
    if (stream && !stream.destroyed) {
      stream.destroy();
    }

    if (axios.isAxiosError(error)) {
      const fbError = error.response?.data?.error;

      logger.error("[GraphAPI] ❌ API error details", {
        status: error.response?.status,
        code: fbError?.code,
        subcode: fbError?.error_subcode,
        message: fbError?.message,
      });

      // Token expiré ou révoqué (Code 190)
      if (fbError?.code === 190) {
        logger.error(
          "[GraphAPI] CRITICAL: Invalid or expired Page Access Token",
        );
      }

      // Erreur de permission (Code 200)
      if (fbError?.code === 200) {
        logger.error(
          "[GraphAPI] CRITICAL: Missing permissions (requires pages_manage_posts)",
        );
      }
    } else {
      logger.error("[GraphAPI] Unexpected execution error", {
        message: error.message,
      });
    }

    throw error;
  }
};

export const isGraphAPIConfigured = () => {
  return Boolean(config.facebook.pageId && config.facebook.pageAccessToken);
};
