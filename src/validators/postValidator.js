/**
 * src/validators/postValidator.js
 * ============================================================
 * PRODUCTION-READY INPUT VALIDATORS
 * ============================================================
 */

/**
 * Global freeze array definition to protect core validation arrays from downstream alterations
 */
export const VALID_CATEGORIES = Object.freeze(["morning", "midday", "evening"]);

/**
 * Validate a post category payload securely against structural type mutations
 * @param {any} category - Raw incoming request query or body parameter
 * @returns {{ valid: boolean, error?: string, normalized?: string }}
 */
export const validateCategory = (category) => {
  // PRODUCTION FIX: Assert type parameters strictly to protect methods from object or array injections
  if (category === undefined || category === null) {
    return {
      valid: false,
      error: "Category parameter field is strictly required.",
    };
  }

  if (typeof category !== "string") {
    return {
      valid: false,
      error:
        "Malformed input structure: Category parameters must be string primitives.",
    };
  }

  // PRODUCTION FIX: Normalize casing parameters and strip ambient blank spacing elements
  const normalizedCategory = category.toLowerCase().trim();

  if (normalizedCategory.length === 0) {
    return {
      valid: false,
      error:
        "Category parameter cannot be empty or contain only blank spacing characters.",
    };
  }

  if (!VALID_CATEGORIES.includes(normalizedCategory)) {
    return {
      valid: false,
      error: `Invalid category mapping profile: "${category}". Must evaluate precisely as one of: [ ${VALID_CATEGORIES.join(", ")} ]`,
    };
  }

  // Return the verified validation state alongside the cleaned, normalized string for safe database queries
  return {
    valid: true,
    normalized: normalizedCategory,
  };
};
