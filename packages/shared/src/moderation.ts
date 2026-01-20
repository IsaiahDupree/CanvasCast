/**
 * Content Moderation Module (MOD-001)
 *
 * Provides prompt content filtering using OpenAI's moderation API
 * to prevent prohibited content from being processed.
 */

import OpenAI from 'openai';

/**
 * Result of content moderation check
 */
export interface ModerationResult {
  allowed: boolean;
  reason?: string;
  categories?: string[];
}

/**
 * Custom error for moderation failures
 */
export class ModerationError extends Error {
  public readonly category: string;

  constructor(category: string, message: string) {
    super(message);
    this.name = 'ModerationError';
    this.category = category;
    Object.setPrototypeOf(this, ModerationError.prototype);
  }
}

/**
 * Simple in-memory cache for moderation results
 * Cache key is the hash of the prompt content
 */
const moderationCache = new Map<string, ModerationResult>();
const CACHE_MAX_SIZE = 1000;
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

interface CacheEntry {
  result: ModerationResult;
  timestamp: number;
}

const moderationCacheWithTTL = new Map<string, CacheEntry>();

/**
 * Simple hash function for cache keys
 */
function hashPrompt(prompt: string): string {
  let hash = 0;
  for (let i = 0; i < prompt.length; i++) {
    const char = prompt.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Clear the moderation cache (useful for testing)
 */
export function clearModerationCache(): void {
  moderationCacheWithTTL.clear();
}

/**
 * Moderate a text prompt using OpenAI's moderation API
 *
 * @param prompt - The text content to moderate
 * @returns ModerationResult indicating if content is allowed
 */
export async function moderatePrompt(prompt: string): Promise<ModerationResult> {
  // Handle empty or invalid prompts
  if (!prompt || typeof prompt !== 'string') {
    return {
      allowed: false,
      reason: 'Invalid prompt: content must be a non-empty string',
    };
  }

  // Trim and check minimum length
  const trimmedPrompt = prompt.trim();
  if (trimmedPrompt.length === 0) {
    return {
      allowed: false,
      reason: 'Invalid prompt: content cannot be empty',
    };
  }

  // Check cache first
  const cacheKey = hashPrompt(trimmedPrompt);
  const cached = moderationCacheWithTTL.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }

  // In development/testing, allow all content without calling API
  if (process.env.NODE_ENV === 'test' || process.env.MODERATION_BYPASS === 'true') {
    return {
      allowed: true,
    };
  }

  // Initialize OpenAI client
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const openai = new OpenAI({ apiKey });

  try {
    // Call OpenAI moderation API
    const moderation = await openai.moderations.create({
      input: trimmedPrompt,
      model: 'omni-moderation-latest', // Use latest moderation model
    });

    const result = moderation.results[0];

    // Check if content is flagged
    if (result.flagged) {
      // Get the categories that were flagged
      const flaggedCategories = Object.entries(result.categories)
        .filter(([_, flagged]) => flagged)
        .map(([category]) => category);

      const moderationResult: ModerationResult = {
        allowed: false,
        reason: `Content violates our content policy. Prohibited categories: ${flaggedCategories.join(', ')}`,
        categories: flaggedCategories,
      };

      // Cache the result
      moderationCacheWithTTL.set(cacheKey, {
        result: moderationResult,
        timestamp: Date.now(),
      });

      // Enforce cache size limit
      if (moderationCacheWithTTL.size > CACHE_MAX_SIZE) {
        const firstKey = moderationCacheWithTTL.keys().next().value;
        moderationCacheWithTTL.delete(firstKey);
      }

      return moderationResult;
    }

    // Content is safe
    const moderationResult: ModerationResult = {
      allowed: true,
    };

    // Cache the result
    moderationCacheWithTTL.set(cacheKey, {
      result: moderationResult,
      timestamp: Date.now(),
    });

    // Enforce cache size limit
    if (moderationCacheWithTTL.size > CACHE_MAX_SIZE) {
      const firstKey = moderationCacheWithTTL.keys().next().value;
      moderationCacheWithTTL.delete(firstKey);
    }

    return moderationResult;
  } catch (error: any) {
    // Handle API errors gracefully
    console.error('[MODERATION] Error calling OpenAI moderation API:', error);

    // For very long prompts or API errors, fail safely
    if (error?.message?.includes('maximum context length') || trimmedPrompt.length > 50000) {
      return {
        allowed: false,
        reason: 'Content is too long to moderate. Please shorten your prompt.',
      };
    }

    // For other errors, log but allow content in non-production
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[MODERATION] Allowing content due to API error in non-production environment');
      return {
        allowed: true,
      };
    }

    // In production, fail closed (reject content on error)
    return {
      allowed: false,
      reason: 'Unable to verify content safety. Please try again later.',
    };
  }
}

/**
 * Batch moderate multiple prompts
 * Returns an array of moderation results in the same order as inputs
 */
export async function moderatePrompts(prompts: string[]): Promise<ModerationResult[]> {
  return Promise.all(prompts.map((prompt) => moderatePrompt(prompt)));
}
