/**
 * src/ai/openrouter.js
 * ============================================================
 * OPENROUTER API CLIENT
 * ============================================================
 * WHY OPENROUTER:
 * OpenRouter is an API aggregator that gives access to 100+
 * AI models (GPT-4, Claude, Mistral, Llama, etc.) through
 * ONE API key and ONE endpoint. This means:
 * - Easy to switch models without changing code
 * - Fallback models if one is down
 * - Better pricing than direct API access
 *
 * WHY AXIOS INSTEAD OF FETCH:
 * Axios gives us automatic JSON parsing, better error messages,
 * and request/response interceptors for future logging.
 * ============================================================
 */

import axios from 'axios';
import { config } from '../config/index.js';
import { buildPrompt } from './prompts.js';
import { withRetry } from '../utils/asyncWrapper.js';
import logger from '../utils/logger.js';
import Analytics from '../models/Analytics.js';

/**
 * Call the OpenRouter API to generate post content
 * @param {string} category - 'morning' | 'midday' | 'evening'
 * @returns {Promise<Object>} - Parsed AI response: { title, bodyText, cta, hashtags, designSuggestion }
 */
export const generateContent = async (category) => {
  const { system, user } = buildPrompt(category);

  logger.info(`🤖 Generating AI content for category: ${category}`);

  // Use retry wrapper — AI APIs can have transient failures
  const response = await withRetry(
    async () => callOpenRouter(system, user),
    3,       // max 3 attempts
    2000,    // 2 second delay between attempts
    'OpenRouter AI'
  );

  // Track in analytics
  await Analytics.increment('aiCallsTotal').catch(() => {});

  return response;
};

/**
 * Internal: make the actual HTTP call to OpenRouter
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @returns {Promise<Object>}
 */
const callOpenRouter = async (systemPrompt, userPrompt) => {
  let rawText = '';

  try {
    const response = await axios.post(
      `${config.openrouter.baseUrl}/chat/completions`,
      {
        model: config.openrouter.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        // temperature: creativity level (0=deterministic, 1=creative)
        temperature: 0.85,
        max_tokens: 600,
      },
      {
        headers: {
          'Authorization': `Bearer ${config.openrouter.apiKey}`,
          'Content-Type': 'application/json',
          // OpenRouter requires these headers to track usage
          'HTTP-Referer': 'https://gtech-academy.com',
          'X-Title': 'GTech MediaBot',
        },
        timeout: 30000, // 30 second timeout
      }
    );

    // Extract the text response from OpenRouter's structure
    rawText = response.data?.choices?.[0]?.message?.content || '';

    if (!rawText) {
      throw new Error('OpenRouter returned empty response');
    }

    logger.debug('🤖 Raw AI response received', { length: rawText.length });

    // Parse the JSON the AI returned
    return parseAIResponse(rawText);

  } catch (error) {
    // Track failed AI calls
    await Analytics.increment('aiCallsFailed').catch(() => {});

    if (error.response) {
      // HTTP error from OpenRouter
      throw new Error(`OpenRouter API error ${error.response.status}: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
};

/**
 * Parse the AI's JSON response with fallback handling
 * WHY: AI models sometimes add extra text around the JSON.
 * We need to extract just the JSON part robustly.
 *
 * @param {string} rawText - Raw text from AI
 * @returns {Object} - Parsed content object
 */
const parseAIResponse = (rawText) => {
  try {
    // Try direct parse first
    return JSON.parse(rawText);
  } catch {
    // Try to extract JSON from the text (AI sometimes adds preamble)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // Fall through to fallback
      }
    }

    // If all parsing fails, return a safe fallback so the pipeline continues
    logger.warn('⚠️ Could not parse AI JSON response, using fallback content', { rawText });
    return {
      title: 'L\'Afrique Tech se lève 🚀',
      bodyText: 'Chaque jour est une nouvelle opportunité de construire ton avenir digital. G-tech-academy est là pour t\'accompagner dans cette transformation.',
      cta: 'Rejoins G-tech-academy aujourd\'hui →',
      hashtags: ['#GtechAcademy', '#AfricaTech', '#CodeAfrique', '#Entrepreneuriat', '#FuturDigital'],
      designSuggestion: 'Gradient violet-bleu futuriste',
    };
  }
};
