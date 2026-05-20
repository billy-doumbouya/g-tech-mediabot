/**
 * src/models/Analytics.js
 * ============================================================
 * ANALYTICS MODEL
 * ============================================================
 * Tracks daily publication stats for the dashboard.
 * One document per calendar day.
 * ============================================================
 */

import mongoose from "mongoose";

const AnalyticsSchema = new mongoose.Schema(
  {
    // Date key: "2024-01-15" — one doc per day
    dateKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Counters
    postsGenerated: { type: Number, default: 0 },
    postsPublished: { type: Number, default: 0 },
    postsFailed: { type: Number, default: 0 },

    // Which publisher was used
    graphApiSuccess: { type: Number, default: 0 },
    puppeteerFallbackUsed: { type: Number, default: 0 },

    // AI generation stats
    aiCallsTotal: { type: Number, default: 0 },
    aiCallsFailed: { type: Number, default: 0 },

    // Image generation stats
    imagesGenerated: { type: Number, default: 0 },
    imagesFailed: { type: Number, default: 0 },
  },
  { timestamps: true },
);

/**
 * Static method: increment a counter for today
 * Usage: Analytics.increment('postsPublished')
 */
AnalyticsSchema.statics.increment = async function (field, amount = 1) {
  const today = new Date().toISOString().split("T")[0]; // "2024-01-15"
  return this.findOneAndUpdate(
    { dateKey: today },
    { $inc: { [field]: amount } },
    { upsert: true, new: true },
  );
};

export default mongoose.model("Analytics", AnalyticsSchema);
