/**
 * src/validators/postValidator.js
 * ============================================================
 * INPUT VALIDATORS
 * ============================================================
 * WHY VALIDATE:
 * Never trust input — even from your own API endpoints.
 * Validation catches bugs early and gives clear error messages
 * instead of cryptic database errors.
 * ============================================================
 */

export const VALID_CATEGORIES = ['morning', 'midday', 'evening'];

/**
 * Validate a post category
 * @param {string} category
 * @returns {{ valid: boolean, error?: string }}
 */
export const validateCategory = (category) => {
  if (!category) {
    return { valid: false, error: 'Category is required' };
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return {
      valid: false,
      error: `Invalid category "${category}". Must be one of: ${VALID_CATEGORIES.join(', ')}`,
    };
  }
  return { valid: true };
};
