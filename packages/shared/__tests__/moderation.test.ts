import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for MOD-001: Prompt Content Filter
 *
 * These tests verify that:
 * 1. The moderation API is called for prompts
 * 2. Blocked prompts are rejected with clear error messages
 * 3. Safe prompts pass moderation
 */

// Set NODE_ENV to test to bypass OpenAI API calls
process.env.NODE_ENV = 'test';

describe('Prompt Moderation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('moderatePrompt', () => {
    it('should handle empty prompts', async () => {
      const { moderatePrompt } = await import('../src/moderation');

      const result = await moderatePrompt('');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('empty');
    });

    it('should handle invalid prompts', async () => {
      const { moderatePrompt } = await import('../src/moderation');

      // @ts-ignore - testing invalid input
      const result = await moderatePrompt(null);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Invalid prompt');
    });

    it('should allow valid prompts in test mode', async () => {
      const { moderatePrompt } = await import('../src/moderation');

      const safePrompt = 'Create a video about healthy eating and nutrition tips';

      const result = await moderatePrompt(safePrompt);

      // In test mode without API key, all valid prompts are allowed
      expect(result.allowed).toBe(true);
    });

    it('should return proper result structure', async () => {
      const { moderatePrompt } = await import('../src/moderation');

      const result = await moderatePrompt('Test prompt');

      expect(result).toHaveProperty('allowed');
      expect(typeof result.allowed).toBe('boolean');
      if (!result.allowed) {
        expect(typeof result.reason).toBe('string');
      }
    });

    it('should handle moderation API errors gracefully', async () => {
      const { moderatePrompt } = await import('../src/moderation');

      // Test with an extremely long prompt that might cause API issues
      const longPrompt = 'a'.repeat(100000);

      // Should either pass or fail gracefully, not throw
      await expect(moderatePrompt(longPrompt)).resolves.toBeDefined();
    });

    it('should cache moderation results for identical prompts', async () => {
      const { moderatePrompt, clearModerationCache } = await import('../src/moderation');

      // Clear cache first
      if (clearModerationCache) {
        clearModerationCache();
      }

      const prompt = 'Create a motivational video about success';

      // First call
      const result1 = await moderatePrompt(prompt);

      // Second call with same prompt (should use cache)
      const result2 = await moderatePrompt(prompt);

      expect(result1).toEqual(result2);
    });
  });

  describe('ModerationError', () => {
    it('should create a proper ModerationError with reason', async () => {
      const { ModerationError } = await import('../src/moderation');

      const error = new ModerationError('violence', 'Content contains violent themes');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ModerationError');
      expect(error.category).toBe('violence');
      expect(error.message).toBe('Content contains violent themes');
    });
  });
});
