/**
 * src/scripts/manualTrigger.js
 * ============================================================
 * MANUAL TRIGGER SCRIPT
 * ============================================================
 * Run this to manually test the full pipeline without waiting
 * for the scheduler.
 *
 * USAGE:
 *   node src/scripts/manualTrigger.js morning
 *   node src/scripts/manualTrigger.js midday
 *   node src/scripts/manualTrigger.js evening
 *   npm run trigger -- morning
 * ============================================================
 */

import '../config/index.js'; // Load dotenv
import { connectDatabase, disconnectDatabase } from '../database/connection.js';
import { runPostPipeline } from '../services/postService.js';
import { closeBrowser } from '../automation/browserManager.js';
import logger from '../utils/logger.js';

const category = process.argv[2] || 'morning';
const validCategories = ['morning', 'midday', 'evening'];

if (!validCategories.includes(category)) {
  console.error(`❌ Invalid category: "${category}". Use: ${validCategories.join(' | ')}`);
  process.exit(1);
}

logger.info(`🔧 Manual trigger starting — category: ${category}`);

(async () => {
  try {
    await connectDatabase();
    const result = await runPostPipeline(category);

    logger.info('✅ Manual trigger complete', {
      postId: result.uuid,
      status: result.status,
      publishedVia: result.publishedVia,
    });

  } catch (error) {
    logger.error('❌ Manual trigger failed', { error: error.message });
  } finally {
    await closeBrowser();
    await disconnectDatabase();
    process.exit(0);
  }
})();
