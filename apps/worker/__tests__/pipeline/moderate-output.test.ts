/**
 * Tests for MOD-002: Output Content Scanning
 *
 * Tests moderation of generated scripts and images for policy violations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock db functions before imports
vi.mock('../../src/lib/db', () => ({
  insertJobEvent: vi.fn(),
  upsertAsset: vi.fn(),
}));

// Mock OpenAI with moderation create method
const mockModerationCreate = vi.fn();
vi.mock('openai', () => ({
  default: class {
    moderations = {
      create: mockModerationCreate,
    };
  },
}));

import { moderateOutput } from '../../src/pipeline/steps/moderate-output';
import type { PipelineContext, Script } from '../../src/pipeline/types';

describe('MOD-002: Output Content Scanning', () => {
  let mockContext: PipelineContext;

  beforeEach(() => {
    // Setup mock context
    mockContext = {
      jobId: 'test-job-123',
      projectId: 'test-project-456',
      userId: 'test-user-789',
      basePath: 'test-base-path',
      outputPath: 'test-output-path',
      job: {
        id: 'test-job-123',
        project_id: 'test-project-456',
        user_id: 'test-user-789',
        status: 'SCRIPTING',
        progress: 20,
      } as any,
      project: {
        id: 'test-project-456',
        user_id: 'test-user-789',
        title: 'Test Project',
        niche_preset: 'educational',
        target_minutes: 1,
      } as any,
      artifacts: {
        script: {
          title: 'Test Video',
          sections: [
            {
              id: 'sec-1',
              heading: 'Introduction',
              text: 'This is a safe introduction to our topic.',
              durationEstimateSeconds: 10,
            },
            {
              id: 'sec-2',
              heading: 'Main Content',
              text: 'This is the main content of the video.',
              durationEstimateSeconds: 20,
            },
          ],
          totalEstimatedSeconds: 30,
        } as Script,
      },
    };

    // Set environment variable for API key
    process.env.OPENAI_API_KEY = 'test-api-key';
    // Disable bypass for tests
    delete process.env.MODERATION_BYPASS;
    process.env.NODE_ENV = 'production'; // Test production behavior
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Script Moderation', () => {
    it('should pass when script content is safe', async () => {
      // Mock safe moderation response
      mockModerationCreate.mockResolvedValue({
        results: [
          {
            flagged: false,
            categories: {},
          },
        ],
      });

      const result = await moderateOutput(mockContext);

      expect(result.success).toBe(true);
      expect(mockModerationCreate).toHaveBeenCalled();
    });

    it('should fail when script contains prohibited content', async () => {
      // Mock flagged moderation response
      mockModerationCreate.mockResolvedValue({
        results: [
          {
            flagged: true,
            categories: {
              violence: true,
              'violence/graphic': false,
              hate: false,
              'hate/threatening': false,
              harassment: false,
              'harassment/threatening': false,
              'self-harm': false,
              'self-harm/intent': false,
              'self-harm/instructions': false,
              sexual: false,
              'sexual/minors': false,
            },
          },
        ],
      });

      const result = await moderateOutput(mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ERR_MODERATION');
      expect(result.error?.message).toContain('policy');
    });

    it('should check all script sections for violations', async () => {
      // Mock safe response
      mockModerationCreate.mockResolvedValue({
        results: [
          {
            flagged: false,
            categories: {},
          },
        ],
      });

      await moderateOutput(mockContext);

      // Should be called for each section (2 sections)
      expect(mockModerationCreate).toHaveBeenCalledTimes(2);
    });

    it('should handle missing script gracefully', async () => {
      mockContext.artifacts.script = undefined;

      const result = await moderateOutput(mockContext);

      expect(result.success).toBe(true);
      expect(mockModerationCreate).not.toHaveBeenCalled();
    });
  });

  describe('Image Moderation', () => {
    it('should skip image moderation if no images generated yet', async () => {
      // No imagePaths in artifacts
      mockModerationCreate.mockResolvedValue({
        results: [
          {
            flagged: false,
            categories: {},
          },
        ],
      });

      const result = await moderateOutput(mockContext);

      expect(result.success).toBe(true);
    });

    it('should moderate image prompts from visual plan', async () => {
      mockContext.artifacts.visualPlan = {
        totalImages: 2,
        scenes: [
          {
            id: 'scene-1',
            imagePrompt: 'A peaceful landscape with mountains',
            startMs: 0,
            endMs: 5000,
          },
          {
            id: 'scene-2',
            imagePrompt: 'A city skyline at sunset',
            startMs: 5000,
            endMs: 10000,
          },
        ],
      } as any;

      mockModerationCreate.mockResolvedValue({
        results: [
          {
            flagged: false,
            categories: {},
          },
        ],
      });

      const result = await moderateOutput(mockContext);

      expect(result.success).toBe(true);
      // Should check script sections + image prompts (2 + 2 = 4)
      expect(mockModerationCreate).toHaveBeenCalledTimes(4);
    });

    it('should fail if image prompt contains prohibited content', async () => {
      mockContext.artifacts.visualPlan = {
        totalImages: 1,
        scenes: [
          {
            id: 'scene-1',
            imagePrompt: 'Violent content',
            startMs: 0,
            endMs: 5000,
          },
        ],
      } as any;

      // First calls for script sections (safe)
      // Last call for image prompt (flagged)
      mockModerationCreate
        .mockResolvedValueOnce({
          results: [{ flagged: false, categories: {} }],
        })
        .mockResolvedValueOnce({
          results: [{ flagged: false, categories: {} }],
        })
        .mockResolvedValueOnce({
          results: [
            {
              flagged: true,
              categories: {
                violence: true,
              },
            },
          ],
        });

      const result = await moderateOutput(mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ERR_MODERATION');
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockModerationCreate.mockRejectedValue(
        new Error('API rate limit exceeded')
      );

      const result = await moderateOutput(mockContext);

      // Should fail closed in production
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ERR_MODERATION');
      expect(result.error?.message).toContain('Unable to verify');
    });

    it('should bypass moderation in test environment', async () => {
      process.env.NODE_ENV = 'test';

      const result = await moderateOutput(mockContext);

      expect(result.success).toBe(true);
      expect(mockModerationCreate).not.toHaveBeenCalled();
    });

    it('should bypass moderation when MODERATION_BYPASS is set', async () => {
      process.env.MODERATION_BYPASS = 'true';

      const result = await moderateOutput(mockContext);

      expect(result.success).toBe(true);
      expect(mockModerationCreate).not.toHaveBeenCalled();
    });
  });

  describe('Logging and Flagging', () => {
    it('should log violation details when content is flagged', async () => {
      mockModerationCreate.mockResolvedValue({
        results: [
          {
            flagged: true,
            categories: {
              harassment: true,
              'harassment/threatening': true,
            },
          },
        ],
      });

      const result = await moderateOutput(mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.details).toBeDefined();
      expect(result.error?.details).toMatchObject({
        violationType: 'script',
        categories: expect.arrayContaining(['harassment', 'harassment/threatening']),
      });
    });
  });
});
