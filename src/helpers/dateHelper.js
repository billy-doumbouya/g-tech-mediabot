/**
 * src/helpers/dateHelper.js
 * ============================================================
 * DATE UTILITY HELPERS
 * ============================================================
 * WHY HELPERS EXIST:
 * Small reusable functions that don't belong to any specific
 * service go here. Think of helpers as your utility belt.
 * They have no side effects and are easy to test.
 * ============================================================
 */

/**
 * Get today's date as a string key "YYYY-MM-DD"
 * Used for analytics bucketing
 * @returns {string}
 */
export const todayKey = () => new Date().toISOString().split('T')[0];

/**
 * Get the current posting category based on the hour
 * Useful for determining which category to use right now
 * @returns {'morning'|'midday'|'evening'|null}
 */
export const getCurrentCategory = () => {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 16) return 'midday';
  if (hour >= 16 && hour < 22) return 'evening';
  return null; // Outside posting hours
};

/**
 * Format a date to French locale string
 * @param {Date} date
 * @returns {string}
 */
export const formatDateFR = (date) => {
  return new Date(date).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
