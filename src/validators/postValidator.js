/**
 * src/validators/postValidator.js
 * ============================================================
 * PRODUCTION-READY INPUT VALIDATORS (CORRIGÉ)
 * ============================================================
 */

/**
 * Global freeze array definition to protect core validation arrays from downstream alterations
 */
export const VALID_CATEGORIES = Object.freeze(["morning", "midday", "evening"]);

/**
 * Validate a post category payload securely against structural type mutations and memory bloat
 * @param {any} category - Raw incoming request query or body parameter
 * @returns {{ valid: boolean, error?: string, normalized?: string }}
 */
export const validateCategory = (category) => {
  // 1. TYPE ASSERSTION
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

  // PRODUCTION FIX (SECURITY): Limiter immédiatement la taille de la chaîne de caractères.
  // La plus longue catégorie valide ("morning") fait 7 caractères. En bloquant à 30 caractères maximum,
  // on élimine les payload géants (DoS) avant que le CPU ne commence à allouer de la mémoire pour les fonctions de chaînes.
  if (category.length > 30) {
    return {
      valid: false,
      error:
        "Malformed input structure: Category parameter exceeds maximum allowed buffer length.",
    };
  }

  // 2. NORMALIZATION (Maintenant sécurisée car la taille de la chaîne est sous contrôle)
  const normalizedCategory = category.toLowerCase().trim();

  if (normalizedCategory.length === 0) {
    return {
      valid: false,
      error:
        "Category parameter cannot be empty or contain only blank spacing characters.",
    };
  }

  // 3. BOUNDARY CHECK
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
