/**
 * Tests for Script Generation Step
 * Feature: PIPE-001 - Script Generation Step
 *
 * This test suite covers:
 * - Auto script generation using OpenAI GPT-4
 * - Handling niche presets
 * - Script validation
 * - Duration estimation
 * - Error handling and retry logic
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PipelineContext, Script, JobRow, ProjectRow } from '../../../apps/worker/src/pipeline/types';

// Mock OpenAI before importing - must be at top level
const mockCreate = vi.fn();

vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
  };
});

// Mock Supabase
vi.mock('../../../apps/worker/src/lib/supabase', () => ({
  createAdminSupabase: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: { path: 'test-path' }, error: null }),
      })),
    },
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  })),
}));

// Mock DB functions
vi.mock('../../../apps/worker/src/lib/db', () => ({
  insertJobEvent: vi.fn().mockResolvedValue({}),
  upsertAsset: vi.fn().mockResolvedValue({}),
}));

// Mock storage functions
vi.mock('../../../apps/worker/src/lib/storage', () => ({
  uploadBuffer: vi.fn().mockResolvedValue('test-upload-path'),
  downloadBuffer: vi.fn().mockResolvedValue(Buffer.from('test')),
}));

// Import after mocking
const { generateScript } = await import('../../../apps/worker/src/pipeline/steps/generate-script');

describe('PIPE-001: Script Generation Step', () => {
  let mockContext: PipelineContext;

  beforeEach(() => {
    vi.clearAllMocks();
    // Create mock context
    const mockJob: JobRow = {
      id: 'job_test_001',
      project_id: 'proj_test_001',
      user_id: 'user_test_001',
      status: 'SCRIPTING',
      progress: 10,
      error_code: null,
      error_message: null,
      claimed_at: new Date().toISOString(),
      claimed_by: 'worker_001',
      started_at: new Date().toISOString(),
      finished_at: null,
      cost_credits_reserved: 10,
      cost_credits_final: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockProject: ProjectRow = {
      id: 'proj_test_001',
      user_id: 'user_test_001',
      title: 'Test Video About AI',
      niche_preset: 'explainer',
      target_minutes: 1,
      status: 'processing',
      template_id: 'narrated_storyboard_v1',
      visual_preset_id: 'vp_default',
      voice_profile_id: null,
      image_density: 'normal',
      target_resolution: '1080p',
      timeline_path: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    mockContext = {
      job: mockJob,
      project: mockProject,
      userId: 'user_test_001',
      projectId: 'proj_test_001',
      jobId: 'job_test_001',
      basePath: 'project-assets/u_user_test_001/p_proj_test_001/j_job_test_001',
      outputPath: 'project-outputs/u_user_test_001/p_proj_test_001/j_job_test_001',
      artifacts: {
        mergedInputText: 'Artificial Intelligence is transforming the world. It powers everything from virtual assistants to self-driving cars.',
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('FR-1: Auto Script Generation', () => {
    it('should generate a valid script from prompt', async () => {
      // Mock OpenAI response
      const mockGPTResponse = {
        title: 'The Future of Artificial Intelligence',
        sections: [
          {
            id: 'section_001',
            order: 0,
            headline: 'Introduction to AI',
            narrationText: 'Artificial Intelligence is changing how we live and work. From smart assistants to autonomous vehicles, AI is everywhere.',
            visualKeywords: ['AI', 'technology', 'future'],
            onScreenText: 'What is AI?',
            paceHint: 'normal',
          },
          {
            id: 'section_002',
            order: 1,
            headline: 'AI Applications',
            narrationText: 'Today AI powers virtual assistants like Siri and Alexa. It helps doctors diagnose diseases and drives cars without human intervention.',
            visualKeywords: ['virtual assistant', 'healthcare', 'self-driving cars'],
            paceHint: 'normal',
          },
        ],
      };

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify(mockGPTResponse),
            },
          },
        ],
      });

      const result = await generateScript(mockContext);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.script).toBeDefined();
      expect(result.data?.script.title).toBe('The Future of Artificial Intelligence');
      expect(result.data?.script.sections).toHaveLength(2);
    });

    it('should call OpenAI with correct parameters for explainer niche', async () => {
      const mockGPTResponse = {
        title: 'Test',
        sections: [
          {
            id: 'section_001',
            order: 0,
            headline: 'Test',
            narrationText: 'This is a test section with approximately twenty words to meet the minimum content requirement for testing.',
            visualKeywords: ['test'],
            paceHint: 'normal',
          },
        ],
      };

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockGPTResponse) } }],
      });

      await generateScript(mockContext);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          response_format: { type: 'json_object' },
          temperature: 0.7,
        })
      );

      const call = mockCreate.mock.calls[0][0];
      expect(call.messages[0].content).toContain('explainer');
    });

    it('should handle motivation niche with appropriate tone', async () => {
      mockContext.project.niche_preset = 'motivation';

      const mockGPTResponse = {
        title: 'Motivational Content',
        sections: [
          {
            id: 'section_001',
            order: 0,
            headline: 'Rise and Shine',
            narrationText: 'Every day is a new opportunity to chase your dreams and become the best version of yourself.',
            visualKeywords: ['success', 'motivation', 'achievement'],
            paceHint: 'fast',
          },
        ],
      };

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockGPTResponse) } }],
      });

      const result = await generateScript(mockContext);

      expect(result.success).toBe(true);
      const call = mockCreate.mock.calls[0][0];
      expect(call.messages[0].content).toContain('motivation');
    });

    it('should target correct word count based on target_minutes', async () => {
      mockContext.project.target_minutes = 2; // Should target ~300 words at 150 WPM

      const mockGPTResponse = {
        title: 'Longer Video',
        sections: [
          {
            id: 'section_001',
            order: 0,
            headline: 'Section 1',
            narrationText: 'This is section one with enough words. '.repeat(10),
            visualKeywords: ['test'],
            paceHint: 'normal',
          },
          {
            id: 'section_002',
            order: 1,
            headline: 'Section 2',
            narrationText: 'This is section two with enough words. '.repeat(10),
            visualKeywords: ['test'],
            paceHint: 'normal',
          },
        ],
      };

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockGPTResponse) } }],
      });

      await generateScript(mockContext);

      const call = mockCreate.mock.calls[0][0];
      const targetWords = 2 * 150; // 300 words
      expect(call.messages[0].content).toContain(`${targetWords} words`);
    });

    it('should include 5-8 sections in generated script', async () => {
      const mockGPTResponse = {
        title: 'Test Video',
        sections: Array.from({ length: 6 }, (_, i) => ({
          id: `section_${String(i + 1).padStart(3, '0')}`,
          order: i,
          headline: `Section ${i + 1}`,
          narrationText: `This is the narration for section ${i + 1}. It contains enough words to be valid.`,
          visualKeywords: ['test', 'section'],
          paceHint: 'normal',
        })),
      };

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockGPTResponse) } }],
      });

      const result = await generateScript(mockContext);

      expect(result.success).toBe(true);
      expect(result.data?.script.sections.length).toBeGreaterThanOrEqual(5);
      expect(result.data?.script.sections.length).toBeLessThanOrEqual(8);
    });
  });

  describe('FR-3: Script Validation', () => {
    it('should validate that all sections have required fields', async () => {
      const mockGPTResponse = {
        title: 'Complete Script',
        sections: [
          {
            id: 'section_001',
            order: 0,
            headline: 'Test Section',
            narrationText: 'This section has all required fields including narration text that is long enough.',
            visualKeywords: ['test', 'validation'],
            paceHint: 'normal',
          },
        ],
      };

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockGPTResponse) } }],
      });

      const result = await generateScript(mockContext);

      expect(result.success).toBe(true);
      const script = result.data?.script;
      expect(script?.sections[0].id).toBeDefined();
      expect(script?.sections[0].headline).toBeDefined();
      expect(script?.sections[0].narrationText).toBeDefined();
      expect(script?.sections[0].visualKeywords).toBeDefined();
    });

    it('should calculate total word count correctly', async () => {
      const mockGPTResponse = {
        title: 'Word Count Test',
        sections: [
          {
            id: 'section_001',
            order: 0,
            headline: 'Section One',
            narrationText: 'One two three four five', // 5 words
            visualKeywords: ['test'],
            paceHint: 'normal',
          },
          {
            id: 'section_002',
            order: 1,
            headline: 'Section Two',
            narrationText: 'Six seven eight nine ten', // 5 words
            visualKeywords: ['test'],
            paceHint: 'normal',
          },
        ],
      };

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockGPTResponse) } }],
      });

      const result = await generateScript(mockContext);

      expect(result.success).toBe(true);
      expect(result.data?.script.totalWordCount).toBe(10);
    });

    it('should calculate estimated duration based on word count', async () => {
      const mockGPTResponse = {
        title: 'Duration Test',
        sections: [
          {
            id: 'section_001',
            order: 0,
            headline: 'Test',
            narrationText: 'word '.repeat(150), // 150 words = 1 minute at 150 WPM
            visualKeywords: ['test'],
            paceHint: 'normal',
          },
        ],
      };

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockGPTResponse) } }],
      });

      const result = await generateScript(mockContext);

      expect(result.success).toBe(true);
      // 150 words / 150 WPM * 60 seconds * 1000 ms = 60000 ms
      expect(result.data?.script.estimatedDurationMs).toBe(60000);
    });

    it('should calculate per-section duration estimates', async () => {
      const mockGPTResponse = {
        title: 'Section Duration Test',
        sections: [
          {
            id: 'section_001',
            order: 0,
            headline: 'Fast Section',
            narrationText: 'word '.repeat(75), // 75 words = 30 seconds
            visualKeywords: ['test'],
            paceHint: 'normal',
          },
          {
            id: 'section_002',
            order: 1,
            headline: 'Slow Section',
            narrationText: 'word '.repeat(75), // 75 words = 30 seconds
            visualKeywords: ['test'],
            paceHint: 'normal',
          },
        ],
      };

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockGPTResponse) } }],
      });

      const result = await generateScript(mockContext);

      expect(result.success).toBe(true);
      expect(result.data?.script.sections[0].estimatedDurationMs).toBe(30000);
      expect(result.data?.script.sections[1].estimatedDurationMs).toBe(30000);
    });
  });

  describe('Error Handling', () => {
    it('should return error when no merged input text is available', async () => {
      mockContext.artifacts.mergedInputText = '';

      const result = await generateScript(mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ERR_SCRIPT_GEN');
      expect(result.error?.message).toContain('No merged input text');
    });

    it('should handle OpenAI API errors gracefully', async () => {
      mockCreate.mockRejectedValue(
        new Error('OpenAI API rate limit exceeded')
      );

      const result = await generateScript(mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ERR_SCRIPT_GEN');
      expect(result.error?.message).toContain('rate limit');
    });

    it('should handle invalid JSON response from OpenAI', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'This is not valid JSON',
            },
          },
        ],
      });

      const result = await generateScript(mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ERR_SCRIPT_GEN');
    });

    it('should handle empty response from OpenAI', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
      });

      const result = await generateScript(mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ERR_SCRIPT_GEN');
      expect(result.error?.message).toContain('No content returned');
    });
  });

  describe('Storage and Asset Management', () => {
    it('should upload script to correct storage path', async () => {
      const mockGPTResponse = {
        title: 'Storage Test',
        sections: [
          {
            id: 'section_001',
            order: 0,
            headline: 'Test',
            narrationText: 'Testing storage functionality with adequate word count for validation.',
            visualKeywords: ['test'],
            paceHint: 'normal',
          },
        ],
      };

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockGPTResponse) } }],
      });

      const { createAdminSupabase } = await import('../../../apps/worker/src/lib/supabase');
      const mockSupabase = createAdminSupabase();

      await generateScript(mockContext);

      expect(mockSupabase.storage.from).toHaveBeenCalledWith('project-assets');
    });

    it('should create asset record with correct metadata', async () => {
      const mockGPTResponse = {
        title: 'Asset Test',
        sections: [
          {
            id: 'section_001',
            order: 0,
            headline: 'Test',
            narrationText: 'word '.repeat(50), // 50 words
            visualKeywords: ['test'],
            paceHint: 'normal',
          },
        ],
      };

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockGPTResponse) } }],
      });

      const { createAdminSupabase } = await import('../../../apps/worker/src/lib/supabase');
      const mockSupabase = createAdminSupabase();

      await generateScript(mockContext);

      expect(mockSupabase.from).toHaveBeenCalledWith('assets');
    });
  });

  describe('Niche-Specific Behavior', () => {
    const niches = ['motivation', 'explainer', 'facts', 'history', 'finance', 'science'];

    niches.forEach((niche) => {
      it(`should handle ${niche} niche preset`, async () => {
        mockContext.project.niche_preset = niche;

        const mockGPTResponse = {
          title: `${niche} Video`,
          sections: [
            {
              id: 'section_001',
              order: 0,
              headline: 'Test',
              narrationText: 'This is a test narration with sufficient words to pass validation checks.',
              visualKeywords: ['test'],
              paceHint: 'normal',
            },
          ],
        };

        mockCreate.mockResolvedValue({
          choices: [{ message: { content: JSON.stringify(mockGPTResponse) } }],
        });

        const result = await generateScript(mockContext);

        expect(result.success).toBe(true);
        const call = mockCreate.mock.calls[0][0];
        expect(call.messages[0].content).toContain(niche);
      });
    });
  });

  describe('Integration with Pipeline Context', () => {
    it('should add script to context artifacts', async () => {
      const mockGPTResponse = {
        title: 'Context Test',
        sections: [
          {
            id: 'section_001',
            order: 0,
            headline: 'Test',
            narrationText: 'Testing context artifact integration with proper word count.',
            visualKeywords: ['test'],
            paceHint: 'normal',
          },
        ],
      };

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockGPTResponse) } }],
      });

      const result = await generateScript(mockContext);

      expect(result.success).toBe(true);
      expect(result.data?.script).toBeDefined();
      expect(result.data?.script.title).toBe('Context Test');
    });

    it('should preserve existing artifacts in context', async () => {
      mockContext.artifacts.mergedInputText = 'Test input text';

      const mockGPTResponse = {
        title: 'Artifact Preservation Test',
        sections: [
          {
            id: 'section_001',
            order: 0,
            headline: 'Test',
            narrationText: 'Testing that existing artifacts are not lost during script generation.',
            visualKeywords: ['test'],
            paceHint: 'normal',
          },
        ],
      };

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockGPTResponse) } }],
      });

      await generateScript(mockContext);

      expect(mockContext.artifacts.mergedInputText).toBe('Test input text');
    });
  });
});
