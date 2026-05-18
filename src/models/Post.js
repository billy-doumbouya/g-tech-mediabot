/**
 * src/models/Post.js
 * ============================================================
 * MONGOOSE POST MODEL
 * ============================================================
 * WHY WE DEFINE SCHEMAS:
 * A schema is a contract for your data. It tells MongoDB:
 * "every Post document MUST have these fields, these types,
 * and these constraints." This prevents saving garbage data
 * and gives us autocomplete + validation for free.
 *
 * WHAT WE STORE PER POST:
 * - The AI-generated content (title, text, CTA, hashtags)
 * - The HTML template used
 * - The path to the generated image
 * - Publication status + timestamp
 * - Analytics basics
 * ============================================================
 */

import mongoose from 'mongoose';

// ============================================================
// AI CONTENT SUB-SCHEMA
// Embedded document — avoids a separate collection for small data
// ============================================================
const AIContentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  bodyText: { type: String, required: true },
  cta: { type: String, default: '' },
  hashtags: [{ type: String }],
  designSuggestion: { type: String, default: '' },
  prompt: { type: String },      // The prompt we sent to the AI
  model: { type: String },       // Which AI model responded
}, { _id: false });

// ============================================================
// MAIN POST SCHEMA
// ============================================================
const PostSchema = new mongoose.Schema({

  // Unique ID for this post (used as filename for image)
  uuid: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  // When to publish: morning | midday | evening
  category: {
    type: String,
    enum: ['morning', 'midday', 'evening'],
    required: true,
  },

  // The AI-generated content object
  aiContent: {
    type: AIContentSchema,
    required: true,
  },

  // Which HTML template layout was used
  templateName: {
    type: String,
    required: true,
  },

  // Path to the generated PNG image on disk
  imagePath: {
    type: String,
    default: null,
  },

  // Full HTML used to generate the image (for debugging/regeneration)
  htmlSnapshot: {
    type: String,
    default: null,
  },

  // Publication status
  status: {
    type: String,
    enum: ['pending', 'published', 'failed', 'skipped'],
    default: 'pending',
    index: true,
  },

  // Which publisher was used
  publishedVia: {
    type: String,
    enum: ['graph_api', 'puppeteer', null],
    default: null,
  },

  // Facebook post ID returned after successful publish
  facebookPostId: {
    type: String,
    default: null,
  },

  // Error message if publication failed
  errorMessage: {
    type: String,
    default: null,
  },

  // Number of publish attempts (for retry tracking)
  publishAttempts: {
    type: Number,
    default: 0,
  },

  // When it was actually published
  publishedAt: {
    type: Date,
    default: null,
  },

}, {
  // Automatically adds createdAt and updatedAt fields
  timestamps: true,
});

// ============================================================
// VIRTUAL FIELD: formatted publish date
// ============================================================
PostSchema.virtual('publishedAtFormatted').get(function () {
  if (!this.publishedAt) return null;
  return this.publishedAt.toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
});

// ============================================================
// INDEXES for efficient querying
// ============================================================
PostSchema.index({ createdAt: -1 });
PostSchema.index({ status: 1, category: 1 });

export default mongoose.model('Post', PostSchema);
