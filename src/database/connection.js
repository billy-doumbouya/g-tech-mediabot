/**
 * src/database/connection.js
 * ============================================================
 * MONGODB ATLAS CONNECTION MANAGER
 * ============================================================
 * WHY WE SEPARATE THIS:
 * Database connection logic belongs in its own module.
 * This keeps app.js clean and makes it easy to mock the DB
 * in tests or swap it out later.
 *
 * WHY MONGOOSE:
 * Mongoose gives us schemas/models (structure + validation),
 * which prevents saving malformed data and documents our data shape.
 * ============================================================
 */

import mongoose from "mongoose";
import logger from "../utils/logger.js";
import { config } from "../config/index.js";
import dns from "dns";

dns.setServers(["8.8.8.8"]);

/**
 * Connect to MongoDB Atlas
 * Called once at app startup
 */
export const connectDatabase = async () => {
  try {
    logger.info("🔄 Connecting to MongoDB Atlas...");

    await mongoose.connect(config.mongodb.uri, {
      // These options prevent common connection warnings
      serverSelectionTimeoutMS: 5000, // Fail fast if can't reach DB
      socketTimeoutMS: 45000,
    });

    logger.info("✅ MongoDB Atlas connected successfully");

    // Log when connection is lost (Railway network hiccup, etc.)
    mongoose.connection.on("disconnected", () => {
      logger.warn("⚠️ MongoDB disconnected. Attempting to reconnect...");
    });

    mongoose.connection.on("reconnected", () => {
      logger.info("✅ MongoDB reconnected");
    });
  } catch (error) {
    logger.error("❌ MongoDB connection failed", { error: error.message });
    // Exit the process — app cannot function without database
    process.exit(1);
  }
};

/**
 * Gracefully close the database connection
 * Called during app shutdown (SIGTERM, SIGINT)
 */
export const disconnectDatabase = async () => {
  await mongoose.connection.close();
  logger.info("🔌 MongoDB connection closed gracefully");
};
