/**
 * src/ai/prompts.js
 * ============================================================
 * AI PROMPT TEMPLATES
 * ============================================================
 * WHY SEPARATE PROMPTS FROM API CALLS:
 * Prompt engineering is its own discipline. Keeping prompts in
 * their own file means you can iterate on tone/style without
 * touching the API call logic. Clean separation of concerns.
 *
 * PROMPT STRATEGY:
 * We use "structured output" prompting — asking the AI to return
 * JSON. This makes parsing reliable and deterministic.
 *
 * BRAND VOICE:
 * - Futuristic, inspiring, African tech entrepreneurship
 * - French only
 * - Billy Doumbouya / G-tech-academy personal brand
 * ============================================================
 */

/**
 * System prompt — defines the AI's persona and output format
 * This is sent as the "system" message in every API call
 */
export const SYSTEM_PROMPT = `
Tu es le copywriter officiel de G-tech-academy, l'académie tech fondée par Billy Doumbouya.
Ta mission : créer du contenu social media en français qui inspire, éduque et transforme des jeunes africains en entrepreneurs tech.

STYLE DE COMMUNICATION :
- Futuriste, moderne, inspirant
- Axé sur l'entrepreneuriat tech africain
- Ton intelligent mais accessible
- Énergie positive et motivante
- Concret, actionnable, percutant

RÈGLES ABSOLUES :
- Répondre UNIQUEMENT en JSON valide, sans markdown, sans backticks
- Toujours en français
- Jamais plus de 280 caractères pour postText (optimal Facebook)
- Les hashtags doivent être pertinents et en français/anglais mixte

FORMAT DE RÉPONSE JSON OBLIGATOIRE :
{
  "title": "Titre accrocheur (max 60 caractères)",
  "bodyText": "Corps du post Facebook (max 280 caractères)",
  "cta": "Appel à l'action (max 80 caractères)",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"],
  "designSuggestion": "Suggestion de couleur dominante ou ambiance visuelle"
}
`.trim();

/**
 * Category-specific user prompts
 * Each category has a different content focus and energy level
 */
export const CATEGORY_PROMPTS = {

  /**
   * MORNING: Motivational content — start the day with fire
   * Target: Young Africans waking up, needing inspiration
   */
  morning: `
Crée un post Facebook MATINAL pour G-tech-academy.

OBJECTIF : Motiver les jeunes africains dès le réveil.
THÈME : Motivation entrepreneuriale, mindset de gagnant, vision du futur.
EXEMPLE DE SUJETS :
- L'Afrique digitale de demain se construit aujourd'hui
- Le code est le nouveau français — apprenons-le
- Chaque ligne de code = une brique de ton empire
- Réveille-toi avec la mentalité du fondateur

ÉNERGIE : Explosive, inspirante, cinétique.
Inclure une métaphore puissante ou une vérité choc.
  `.trim(),

  /**
   * MIDDAY: Tech/career content — practical value at peak focus time
   * Target: Students, developers, career-changers on lunch break
   */
  midday: `
Crée un post Facebook pour le MILIEU DE JOURNÉE pour G-tech-academy.

OBJECTIF : Apporter de la valeur tech/carrière concrète.
THÈME : Développement, tech, carrière digitale, compétences du futur.
EXEMPLE DE SUJETS :
- Pourquoi apprendre le JavaScript en 2024
- Les 3 compétences tech les plus payées en Afrique
- Comment passer de zéro à développeur en 6 mois
- L'IA va créer 10x plus d'emplois qu'elle n'en détruit

ÉNERGIE : Éducatif, professionnel, mais accessible et engageant.
Inclure un fait concret ou statistique si possible.
  `.trim(),

  /**
   * EVENING: CTA content — convert followers into students
   * Target: People winding down, considering investing in themselves
   */
  evening: `
Crée un post Facebook VESPÉRAL avec CTA fort pour G-tech-academy.

OBJECTIF : Convertir les followers en étudiants de G-tech-academy.
THÈME : Rejoindre l'académie, transformation de carrière, communauté tech.
EXEMPLE DE SUJETS :
- Ce que nos étudiants accomplissent après 3 mois
- Places limitées — pourquoi attendre encore ?
- Investir dans tes compétences = meilleur ROI de ta vie
- La communauté G-tech-academy t'attend

ÉNERGIE : Urgente, chaleureuse, communautaire.
Le CTA doit être irrésistible. Créer un sentiment d'appartenance.
  `.trim(),
};

/**
 * Build the complete prompt for a given category
 * @param {string} category - 'morning' | 'midday' | 'evening'
 * @returns {{ system: string, user: string }}
 */
export const buildPrompt = (category) => {
  const userPrompt = CATEGORY_PROMPTS[category];

  if (!userPrompt) {
    throw new Error(`Unknown prompt category: ${category}. Valid: morning, midday, evening`);
  }

  return {
    system: SYSTEM_PROMPT,
    user: userPrompt,
  };
};
