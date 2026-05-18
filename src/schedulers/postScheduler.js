/**
 * src/schedulers/postScheduler.js
 * ============================================================
 * POST SCHEDULER — 3X DAILY AUTOMATED POSTING
 * ============================================================
 * WHY SCHEDULERS ARE ISOLATED:
 * Cron job definitions don't belong in app.js or services.
 * They have their own lifecycle (start, stop) and concerns.
 * Keeping them isolated makes it easy to:
 * - Add/remove schedules without touching other code
 * - Test scheduling logic independently
 * - See all schedules in one place
 *
 * HOW NODE-CRON WORKS:
 * Cron expressions: "0 8 * * *"
 *                    │ │ │ │ │
 *                    │ │ │ │ └── Day of week (0-7, 0=Sunday)
 *                    │ │ │ └──── Month (1-12)
 *                    │ │ └────── Day of month (1-31)
 *                    │ └──────── Hour (0-23)
 *                    └────────── Minute (0-59)
 *
 * "0 8 * * *" = Every day at 08:00
 * ============================================================
 */

import cron from 'node-cron';
import { config } from '../config/index.js';
import { runPostPipeline } from '../services/postService.js';
import logger from '../utils/logger.js';

// Store references to active cron tasks so we can stop them gracefully
const activeTasks = [];

/**
 * Build a cron expression for a given hour
 * @param {number} hour - Hour in 24h format
 * @returns {string} - Cron expression
 */
const hourToCron = (hour) => `0 ${hour} * * *`;

/**
 * Initialize all scheduled post jobs
 * Called once during app startup
 */
export const initScheduler = () => {
  logger.info('⏰ Initializing post scheduler...');

  const { morningHour, middayHour, eveningHour, timezone } = config.scheduler;

  // ============================================================
  // JOB 1: MORNING POST
  // ============================================================
  const morningJob = cron.schedule(
    hourToCron(morningHour),
    async () => {
      logger.info(`🌅 [SCHEDULER] Morning post triggered (${morningHour}:00 ${timezone})`);
      await runScheduledPost('morning');
    },
    {
      timezone,
      scheduled: true,
    }
  );
  activeTasks.push(morningJob);

  // ============================================================
  // JOB 2: MIDDAY POST
  // ============================================================
  const middayJob = cron.schedule(
    hourToCron(middayHour),
    async () => {
      logger.info(`☀️ [SCHEDULER] Midday post triggered (${middayHour}:00 ${timezone})`);
      await runScheduledPost('midday');
    },
    {
      timezone,
      scheduled: true,
    }
  );
  activeTasks.push(middayJob);

  // ============================================================
  // JOB 3: EVENING POST
  // ============================================================
  const eveningJob = cron.schedule(
    hourToCron(eveningHour),
    async () => {
      logger.info(`🌙 [SCHEDULER] Evening post triggered (${eveningHour}:00 ${timezone})`);
      await runScheduledPost('evening');
    },
    {
      timezone,
      scheduled: true,
    }
  );
  activeTasks.push(eveningJob);

  logger.info(`✅ Scheduler active:`);
  logger.info(`   🌅 Morning: ${morningHour}:00 ${timezone}`);
  logger.info(`   ☀️ Midday:  ${middayHour}:00 ${timezone}`);
  logger.info(`   🌙 Evening: ${eveningHour}:00 ${timezone}`);
};

/**
 * Run a scheduled post with error isolation
 * WHY: If a post fails, it should NOT crash the scheduler.
 * The scheduler must keep running for the next post.
 * @param {string} category
 */
const runScheduledPost = async (category) => {
  try {
    logger.info(`🎬 [SCHEDULER] Starting ${category} post pipeline...`);
    const result = await runPostPipeline(category);
    logger.info(`✅ [SCHEDULER] ${category} post completed. Status: ${result.status}`);
  } catch (error) {
    // CRITICAL: Never let errors propagate out of cron callbacks
    // If they do, the cron library may stop the job silently
    logger.error(`❌ [SCHEDULER] ${category} post failed`, {
      error: error.message,
      stack: error.stack,
    });
    // Post continues to run on next scheduled time
  }
};

/**
 * Stop all cron jobs gracefully
 * Called during app shutdown (SIGTERM, SIGINT)
 */
export const stopScheduler = () => {
  logger.info('⏹️ Stopping scheduler...');
  activeTasks.forEach(task => task.stop());
  activeTasks.length = 0;
  logger.info('✅ Scheduler stopped');
};
