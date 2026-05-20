/**
 * src/schedulers/postScheduler.js
 * ============================================================
 * DISTRIBUTION-SAFE PRODUCTION SCHEDULER
 * ============================================================
 * FEATURES:
 * - Safe cron initialization
 * - Timezone validation
 * - Fail-fast configuration validation
 * - Overlap protection
 * - Execution timeout protection
 * - Structured logging
 * - Graceful shutdown
 * - Scalable schedule registry
 * - Task destruction support
 *
 * NOTE:
 * This version is production-safe for SINGLE INSTANCE deployments.
 *
 * For horizontally scaled deployments:
 * - PM2 cluster
 * - Kubernetes
 * - Docker replicas
 * - Railway autoscaling
 *
 * Add:
 * - Redis distributed locks
 * - BullMQ / Agenda / Temporal
 * ============================================================
 */

import cron from "node-cron";

import { config } from "../config/index.js";
import { runPostPipeline } from "../services/postService.js";
import logger from "../utils/logger.js";

// ============================================================
// INTERNAL STATE
// ============================================================

const activeTasks = [];
const runningPipelines = new Set();

let schedulerInitialized = false;

// ============================================================
// CONSTANTS
// ============================================================

const PIPELINE_TIMEOUT_MS = 1000 * 60 * 30; // 30 minutes

// ============================================================
// VALIDATION HELPERS
// ============================================================

/**
 * Validate timezone safely using Intl
 */
const isValidTimezone = (timezone) => {
  try {
    Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
    });

    return true;
  } catch {
    return false;
  }
};

/**
 * Validate hour configuration
 */
const validateHour = (hour, fieldName) => {
  const parsedHour = Number(hour);

  if (Number.isNaN(parsedHour) || parsedHour < 0 || parsedHour > 23) {
    throw new Error(`[Scheduler] Invalid hour for "${fieldName}": ${hour}`);
  }

  return parsedHour;
};

/**
 * Convert hour to cron expression
 */
const hourToCron = (hour) => {
  return `0 ${hour} * * *`;
};

/**
 * Promise timeout wrapper
 */
const withTimeout = async (promise, timeoutMs) => {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Pipeline execution timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
};

// ============================================================
// SCHEDULER INITIALIZATION
// ============================================================

export const initScheduler = () => {
  // ------------------------------------------------------------
  // Prevent duplicate initialization
  // ------------------------------------------------------------

  if (schedulerInitialized) {
    logger.warn("[Scheduler] Already initialized");
    return;
  }

  schedulerInitialized = true;

  logger.info("[Scheduler] Initializing");

  // ------------------------------------------------------------
  // Extract and validate config
  // ------------------------------------------------------------

  const { morningHour, middayHour, eveningHour, timezone } = config.scheduler;

  const verifiedTimezone = isValidTimezone(timezone) ? timezone : "UTC";

  if (verifiedTimezone !== timezone) {
    logger.warn(
      `[Scheduler] Invalid timezone "${timezone}". Falling back to UTC`,
    );
  }

  const schedules = [
    {
      name: "morning",
      hour: validateHour(morningHour, "morningHour"),
      icon: "🌅",
    },
    {
      name: "midday",
      hour: validateHour(middayHour, "middayHour"),
      icon: "☀️",
    },
    {
      name: "evening",
      hour: validateHour(eveningHour, "eveningHour"),
      icon: "🌙",
    },
  ];

  // ------------------------------------------------------------
  // Register cron jobs
  // ------------------------------------------------------------

  for (const schedule of schedules) {
    const cronExpression = hourToCron(schedule.hour);

    if (!cron.validate(cronExpression)) {
      throw new Error(
        `[Scheduler] Invalid cron expression generated: ${cronExpression}`,
      );
    }

    const task = cron.schedule(
      cronExpression,
      async () => {
        logger.info("[Scheduler] Trigger fired", {
          category: schedule.name,
          hour: schedule.hour,
          timezone: verifiedTimezone,
        });

        await runScheduledPost(schedule.name);
      },
      {
        timezone: verifiedTimezone,
      },
    );

    activeTasks.push(task);

    logger.info("[Scheduler] Task registered", {
      category: schedule.name,
      cron: cronExpression,
      timezone: verifiedTimezone,
    });
  }

  logger.info("[Scheduler] Ready");
};

// ============================================================
// PIPELINE EXECUTION
// ============================================================

const runScheduledPost = async (category) => {
  // ------------------------------------------------------------
  // Prevent overlapping executions
  // ------------------------------------------------------------

  if (runningPipelines.has(category)) {
    logger.warn("[Scheduler] Overlap prevented", {
      category,
    });

    return;
  }

  runningPipelines.add(category);

  logger.info("[Scheduler] Pipeline started", {
    category,
  });

  try {
    const result = await withTimeout(
      runPostPipeline(category),
      PIPELINE_TIMEOUT_MS,
    );

    logger.info("[Scheduler] Pipeline completed", {
      category,
      status: result?.status || "unknown",
    });
  } catch (error) {
    logger.error("[Scheduler] Pipeline failed", {
      category,
      message: error.message,
      stack: error.stack,
    });
  } finally {
    runningPipelines.delete(category);

    logger.info("[Scheduler] Pipeline lock released", {
      category,
    });
  }
};

// ============================================================
// SHUTDOWN HANDLER
// ============================================================

export const stopScheduler = () => {
  logger.info("[Scheduler] Stopping");

  for (const [index, task] of activeTasks.entries()) {
    try {
      task.stop();

      // Optional cleanup depending on node-cron version
      if (typeof task.destroy === "function") {
        task.destroy();
      }

      logger.info("[Scheduler] Task stopped", {
        index,
      });
    } catch (error) {
      logger.error("[Scheduler] Failed stopping task", {
        index,
        message: error.message,
      });
    }
  }

  activeTasks.length = 0;
  runningPipelines.clear();

  schedulerInitialized = false;

  logger.info("[Scheduler] Fully stopped");
};
