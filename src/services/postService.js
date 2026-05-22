/**
 * src/services/postService.js
 * ============================================================
 * PRODUCTION-READY POST SERVICE — CORE BUSINESS LOGIC PIPELINE (CORRIGÉ)
 * ============================================================
 */

import { v4 as uuidv4 } from "uuid";
import { generateContent } from "../ai/openrouter.js";
import { renderTemplate, suggestLayouts } from "../templates/layouts.js";
import { generateImage } from "../automation/screenshotGenerator.js";
import {
  publishViaGraphAPI,
  isGraphAPIConfigured,
} from "../automation/facebookGraphAPI.js";
import { publishViaPuppeteer } from "../automation/facebookPuppeteer.js";
import Post from "../models/Post.js";
import Analytics from "../models/Analytics.js";
import logger from "../utils/logger.js";
import fs from "fs-extra"; // Ajouté pour le nettoyage du disque

/**
 * MAIN PIPELINE: Run the complete post creation and publishing flow
 * @param {string} category - 'morning' | 'midday' | 'evening'
 * @returns {Promise<Object>} - The saved and finalized Post document
 */
export const runPostPipeline = async (category) => {
  const postId = uuidv4();
  logger.info(`🎬 Starting post pipeline [${category}] — ID: ${postId}`);

  const postInstance = new Post({
    uuid: postId,
    category,
    status: "pending",
    publishAttempts: 0,
  });

  // Persistance initiale immédiate pour l'audit de crash
  await postInstance.save({ validateBeforeSave: false });
  await Analytics.increment("postsGenerated").catch(() => {});

  let imagePath = null;
  let caption = null;
  let facebookPostId = null;
  let publishedVia = null;
  let publishError = null;

  try {
    // ============================================================
    // STEP 1: GENERATE AI CONTENT
    // ============================================================
    logger.info("🤖 Step 1/5: Requesting OpenRouter content models...");
    const aiContent = await generateContent(category);
    await Analytics.increment("aiCallsTotal").catch(() => {});

    postInstance.aiContent = { ...aiContent, model: "openrouter" };
    logger.info(`✅ AI content engine completed: "${aiContent.title}"`);

    // ============================================================
    // STEP 2: SELECT LAYOUT
    // ============================================================
    logger.info("🎨 Step 2/5: Distributing visual layout templates...");
    const suggestedLayoutsList = suggestLayouts(category);
    const templateName = suggestedLayoutsList[0] || "default";
    postInstance.templateName = templateName;
    logger.info(`✅ Layout successfully chosen: ${templateName}`);

    // ============================================================
    // STEP 3: RENDER HTML TEMPLATE
    // ============================================================
    logger.info("🖼️ Step 3/5: Compiling HTML template matrices...");
    const html = renderTemplate(templateName, aiContent);
    postInstance.htmlSnapshot = html;
    logger.info("✅ HTML canvas rendered into string stream");

    // ============================================================
    // STEP 4: GENERATE IMAGE
    // ============================================================
    logger.info("📸 Step 4/5: Running background capture worker...");
    imagePath = await generateImage(html, postId);
    postInstance.imagePath = imagePath;

    // ============================================================
    // STEP 5: BUILD CAPTION
    // ============================================================
    caption = buildCaption(aiContent);

    // Checkpoint intermédiaire indispensable avant d'attaquer le réseau
    await postInstance.save();

    // ============================================================
    // STEP 6: HYBRID PUBLISHING (Graph API → Puppeteer)
    // ============================================================
    logger.info("📤 Step 5/5: Executing hybrid publication network layers...");

    // --- STRATÉGIE PRIMAIRE : Graph API ---
    if (isGraphAPIConfigured()) {
      try {
        postInstance.publishAttempts++;
        // Sauvegarde immédiate du compteur de tentative pour l'historique
        await postInstance.save();

        facebookPostId = await publishViaGraphAPI(imagePath, caption);
        publishedVia = "graph_api";

        await Analytics.increment("graphApiSuccess").catch(() => {});
        logger.info(
          "✅ API handshake success! Dispatched via Facebook Graph API.",
        );
      } catch (graphError) {
        publishError = `[Graph API Error]: ${graphError.message}`;
        logger.warn(
          `⚠️ Graph API layer dropped connection: ${graphError.message}. Initiating Puppeteer recovery fallback...`,
        );
      }
    } else {
      logger.info(
        "ℹ️ Network Profile Note: Graph API variables unconfigured — diverting directly to browser layer.",
      );
    }

    // --- STRATÉGIE DE SECOURS : Puppeteer Automation ---
    if (!publishedVia) {
      try {
        postInstance.publishAttempts++;
        await postInstance.save(); // Sauvegarde de la deuxième tentative

        facebookPostId = await publishViaPuppeteer(imagePath, caption);
        publishedVia = "puppeteer";

        await Analytics.increment("puppeteerFallbackUsed").catch(() => {});
        logger.info(
          "✅ Automation engine success! Dispatched via Puppeteer background browser instance.",
        );
      } catch (pupError) {
        publishError = `${publishError || "Unattempted"} | [Puppeteer Error]: ${pupError.message}`;
        logger.error(
          "❌ Critical Pipeline Failure: Both network broadcast layers aborted execution parameters.",
          { error: publishError },
        );
      }
    }

    // ============================================================
    // STEP 7: STATE NORMALIZATION & SAVE
    // ============================================================
    postInstance.status = publishedVia ? "published" : "failed";
    postInstance.publishedVia = publishedVia;
    postInstance.facebookPostId = facebookPostId;
    postInstance.errorMessage = publishedVia ? null : publishError;
    postInstance.publishedAt = publishedVia ? new Date() : null;

    await postInstance.save();

    if (postInstance.status === "published") {
      await Analytics.increment("postsPublished").catch(() => {});
    } else {
      await Analytics.increment("postsFailed").catch(() => {});
    }

    logger.info(
      `🏁 Post workflow completely parsed. Status profile resolved to: ${postInstance.status}`,
    );
    return postInstance.toObject();
  } catch (criticalPipelineError) {
    logger.error(
      "❌ Severe exception interrupted post pipeline orchestration workflow:",
      { message: criticalPipelineError.message },
    );

    postInstance.status = "failed";
    postInstance.errorMessage = `[Critical Core System Pipeline Crash]: ${criticalPipelineError.message}`;

    await postInstance
      .save()
      .catch((dbErr) =>
        logger.error(
          "💾 Double Fault: Unable to write catch-state to Mongo store:",
          dbErr,
        ),
      );

    await Analytics.increment("postsFailed").catch(() => {});
    throw criticalPipelineError;
  } finally {
    // NETTOYAGE CRITIQUE DU DISQUE DUR :
    // Une fois l'image téléversée ou le processus planté, on supprime le PNG local
    // pour éviter de saturer l'espace disque du serveur de production.
    if (imagePath) {
      fs.remove(imagePath)
        .then(() =>
          logger.debug(
            `🧹 Local asset artifact garbage collected: ${imagePath}`,
          ),
        )
        .catch((err) =>
          logger.warn(
            `⚠️ Failed to remove temporary asset image file: ${err.message}`,
          ),
        );
    }
  }
};

const buildCaption = (aiContent) => {
  if (!aiContent) return "";
  const parts = [
    aiContent.bodyText,
    "",
    aiContent.cta,
    "",
    Array.isArray(aiContent.hashtags) ? aiContent.hashtags.join(" ") : "",
  ];
  return parts
    .filter((p) => p !== undefined && p !== null)
    .join("\n")
    .trim();
};

export const getRecentPosts = async (limit = 20) => {
  try {
    return await Post.find().sort({ createdAt: -1 }).limit(limit).lean();
  } catch (err) {
    logger.error("❌ Unable to map find constraints on Post schemas:", err);
    return [];
  }
};

export const getTodayAnalytics = async () => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const analytics = await Analytics.findOne({ dateKey: today }).lean();

    const [totalPosts, publishedPosts] = await Promise.all([
      Post.countDocuments(),
      Post.countDocuments({ status: "published" }),
    ]);

    return {
      today: analytics || { dateKey: today },
      allTime: { totalPosts, publishedPosts },
    };
  } catch (err) {
    logger.error(
      "❌ Data calculation failed inside analytics aggregation:",
      err,
    );
    return { today: {}, allTime: { totalPosts: 0, publishedPosts: 0 } };
  }
};
