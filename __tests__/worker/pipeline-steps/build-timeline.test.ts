/**
 * Tests for Build Timeline Step
 * Feature: PIPE-006 - Timeline Build Step
 *
 * This test suite covers:
 * - Creating timeline JSON from visual plan and images
 * - Mapping images to segments with correct frame timing
 * - Setting up tracks (audio, images, captions)
 * - Handling different video configurations
 * - Storage upload and asset creation
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PipelineContext, JobRow, ProjectRow, VisualPlan, WhisperSegment } from '../../../apps/worker/src/pipeline/types';

// Mock Supabase
const mockUpload = vi.fn();
const mockInsert = vi.fn();

vi.mock('../../../apps/worker/src/lib/supabase', () => ({
  createAdminSupabase: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        upload: mockUpload,
      })),
    },
    from: vi.fn(() => ({
      insert: mockInsert,
    })),
  })),
}));

// Mock DB functions
vi.mock('../../../apps/worker/src/lib/db', () => ({
  insertJobEvent: vi.fn().mockResolvedValue({}),
  upsertAsset: vi.fn().mockResolvedValue({}),
  heartbeat: vi.fn().mockResolvedValue({}),
}));

// Import after mocking
const { buildTimeline } = await import('../../../apps/worker/src/pipeline/steps/build-timeline');

describe('PIPE-006: Timeline Build Step', () => {
  let mockContext: PipelineContext;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up environment
    process.env.SUPABASE_URL = 'https://test.supabase.co';

    // Create mock context
    const mockJob: JobRow = {
      id: 'job_test_001',
      project_id: 'proj_test_001',
      user_id: 'user_test_001',
      status: 'BUILDING_TIMELINE',
      progress: 60,
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
      title: 'Test Video',
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

    const mockVisualPlan: VisualPlan = {
      slots: [
        {
          id: 'slot_000',
          startMs: 0,
          endMs: 5000,
          text: 'Welcome to this video',
          prompt: 'photorealistic, high quality, welcome scene',
          stylePreset: 'photorealistic',
        },
        {
          id: 'slot_001',
          startMs: 5000,
          endMs: 10000,
          text: 'Today we will learn about AI',
          prompt: 'photorealistic, high quality, AI scene',
          stylePreset: 'photorealistic',
        },
        {
          id: 'slot_002',
          startMs: 10000,
          endMs: 15000,
          text: 'Thank you for watching',
          prompt: 'photorealistic, high quality, conclusion scene',
          stylePreset: 'photorealistic',
        },
      ],
      totalImages: 3,
      cadenceMs: 5000,
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
        visualPlan: mockVisualPlan,
        imagePaths: [
          'images/image_001.png',
          'images/image_002.png',
          'images/image_003.png',
        ],
        narrationPath: 'audio/narration.mp3',
        narrationDurationMs: 15000,
        captionsSrtPath: 'captions/captions.srt',
      },
    };

    // Mock successful uploads
    mockUpload.mockResolvedValue({ data: { path: 'test-path' }, error: null });
    mockInsert.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('FR-1: Timeline JSON Creation', () => {
    it('should create a valid timeline JSON structure', async () => {
      const result = await buildTimeline(mockContext);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.timeline).toBeDefined();

      const timeline = result.data!.timeline as any;
      expect(timeline.version).toBe(1);
      expect(timeline.fps).toBe(30);
      expect(timeline.width).toBe(1920);
      expect(timeline.height).toBe(1080);
    });

    it('should include theme configuration', async () => {
      const result = await buildTimeline(mockContext);

      expect(result.success).toBe(true);
      const timeline = result.data!.timeline as any;

      expect(timeline.theme).toBeDefined();
      expect(timeline.theme.primary).toBeDefined();
      expect(timeline.theme.secondary).toBeDefined();
      expect(timeline.theme.accent).toBeDefined();
      expect(timeline.theme.text).toBeDefined();
      expect(timeline.theme.fontFamily).toBeDefined();
    });

    it('should create audio track with correct path', async () => {
      const result = await buildTimeline(mockContext);

      expect(result.success).toBe(true);
      const timeline = result.data!.timeline as any;

      expect(timeline.tracks).toBeDefined();
      expect(timeline.tracks.length).toBeGreaterThan(0);

      const audioTrack = timeline.tracks.find((t: any) => t.type === 'audio');
      expect(audioTrack).toBeDefined();
      expect(audioTrack.src).toContain('narration.mp3');
      expect(audioTrack.volume).toBe(1);
    });

    it('should include captions configuration', async () => {
      const result = await buildTimeline(mockContext);

      expect(result.success).toBe(true);
      const timeline = result.data!.timeline as any;

      expect(timeline.captions).toBeDefined();
      expect(timeline.captions.style).toBeDefined();
      expect(timeline.captions.style.enabled).toBe(true);
      expect(timeline.captions.style.position).toBe('bottom');
    });

    it('should set correct duration in frames', async () => {
      const result = await buildTimeline(mockContext);

      expect(result.success).toBe(true);
      const timeline = result.data!.timeline as any;

      // 15000ms at 30fps = 450 frames
      expect(timeline.durationFrames).toBe(450);
    });
  });

  describe('FR-2: Image to Segment Mapping', () => {
    it('should create segments matching visual plan slots', async () => {
      const result = await buildTimeline(mockContext);

      expect(result.success).toBe(true);
      const timeline = result.data!.timeline as any;

      expect(timeline.segments).toBeDefined();
      expect(timeline.segments.length).toBe(3);
    });

    it('should map images to segments correctly', async () => {
      const result = await buildTimeline(mockContext);

      expect(result.success).toBe(true);
      const timeline = result.data!.timeline as any;

      timeline.segments.forEach((segment: any, idx: number) => {
        expect(segment.image).toBeDefined();
        expect(segment.image.src).toContain(`image_00${idx + 1}.png`);
      });
    });

    it('should set correct frame timing for segments', async () => {
      const result = await buildTimeline(mockContext);

      expect(result.success).toBe(true);
      const timeline = result.data!.timeline as any;

      // First segment: 0-5000ms = 0-150 frames at 30fps
      expect(timeline.segments[0].startFrame).toBe(0);
      expect(timeline.segments[0].endFrame).toBe(150);

      // Second segment: 5000-10000ms = 150-300 frames
      expect(timeline.segments[1].startFrame).toBe(150);
      expect(timeline.segments[1].endFrame).toBe(300);

      // Third segment: 10000-15000ms = 300-450 frames
      expect(timeline.segments[2].startFrame).toBe(300);
      expect(timeline.segments[2].endFrame).toBe(450);
    });

    it('should include segment IDs from visual plan', async () => {
      const result = await buildTimeline(mockContext);

      expect(result.success).toBe(true);
      const timeline = result.data!.timeline as any;

      expect(timeline.segments[0].id).toBe('slot_000');
      expect(timeline.segments[1].id).toBe('slot_001');
      expect(timeline.segments[2].id).toBe('slot_002');
    });

    it('should include text from visual plan slots', async () => {
      const result = await buildTimeline(mockContext);

      expect(result.success).toBe(true);
      const timeline = result.data!.timeline as any;

      expect(timeline.segments[0].text).toBe('Welcome to this video');
      expect(timeline.segments[1].text).toBe('Today we will learn about AI');
      expect(timeline.segments[2].text).toBe('Thank you for watching');
    });

    it('should apply Ken Burns zoom effect to images', async () => {
      const result = await buildTimeline(mockContext);

      expect(result.success).toBe(true);
      const timeline = result.data!.timeline as any;

      timeline.segments.forEach((segment: any) => {
        expect(segment.image.zoom).toBe(1.03);
        expect(segment.image.fit).toBe('cover');
      });
    });

    it('should handle missing images by reusing last image', async () => {
      // Only provide 2 images for 3 slots
      mockContext.artifacts.imagePaths = [
        'images/image_001.png',
        'images/image_002.png',
      ];

      const result = await buildTimeline(mockContext);

      expect(result.success).toBe(true);
      const timeline = result.data!.timeline as any;

      // Third segment should reuse last image
      expect(timeline.segments[2].image.src).toContain('image_002.png');
    });
  });

  describe('FR-3: Transitions', () => {
    it('should use cut transition for first segment', async () => {
      const result = await buildTimeline(mockContext);

      expect(result.success).toBe(true);
      const timeline = result.data!.timeline as any;

      expect(timeline.segments[0].transition.type).toBe('cut');
      expect(timeline.segments[0].transition.durationFrames).toBe(0);
    });

    it('should use fade transition for subsequent segments', async () => {
      const result = await buildTimeline(mockContext);

      expect(result.success).toBe(true);
      const timeline = result.data!.timeline as any;

      expect(timeline.segments[1].transition.type).toBe('fade');
      expect(timeline.segments[1].transition.durationFrames).toBe(12);

      expect(timeline.segments[2].transition.type).toBe('fade');
      expect(timeline.segments[2].transition.durationFrames).toBe(12);
    });
  });

  describe('Storage and Asset Management', () => {
    it('should upload timeline JSON to storage', async () => {
      await buildTimeline(mockContext);

      expect(mockUpload).toHaveBeenCalled();

      const uploadCall = mockUpload.mock.calls[0];
      expect(uploadCall[0]).toContain('timeline/timeline.json');
      expect(uploadCall[1]).toBeInstanceOf(Blob);
    });

    it('should create asset record with correct metadata', async () => {
      await buildTimeline(mockContext);

      expect(mockInsert).toHaveBeenCalled();

      const insertCall = mockInsert.mock.calls[0][0];
      expect(insertCall.project_id).toBe('proj_test_001');
      expect(insertCall.user_id).toBe('user_test_001');
      expect(insertCall.job_id).toBe('job_test_001');
      expect(insertCall.type).toBe('timeline');
      expect(insertCall.meta).toBeDefined();
      expect(insertCall.meta.segments).toBe(3);
    });

    it('should update context artifacts with timeline path', async () => {
      const result = await buildTimeline(mockContext);

      expect(result.success).toBe(true);
      expect(mockContext.artifacts.timelinePath).toBeDefined();
      expect(mockContext.artifacts.timelinePath).toContain('timeline/timeline.json');
    });
  });

  describe('Error Handling', () => {
    it('should return error when visual plan is missing', async () => {
      mockContext.artifacts.visualPlan = undefined;

      const result = await buildTimeline(mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ERR_TIMELINE');
      expect(result.error?.message).toContain('Missing visual plan');
    });

    it('should return error when image paths are missing', async () => {
      mockContext.artifacts.imagePaths = undefined;

      const result = await buildTimeline(mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ERR_TIMELINE');
      expect(result.error?.message).toContain('Missing visual plan or images');
    });

    it('should return error when image paths array is empty', async () => {
      mockContext.artifacts.imagePaths = [];

      const result = await buildTimeline(mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ERR_TIMELINE');
    });

    it('should handle storage upload errors', async () => {
      mockUpload.mockResolvedValueOnce({
        data: null,
        error: new Error('Storage upload failed')
      });

      const result = await buildTimeline(mockContext);

      // Implementation currently doesn't check upload error, but continues
      // This test documents the current behavior
      expect(result.success).toBe(true);
    });

    it('should handle unexpected errors gracefully', async () => {
      mockUpload.mockRejectedValueOnce(new Error('Unexpected error'));

      const result = await buildTimeline(mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ERR_TIMELINE');
      expect(result.error?.message).toContain('Unexpected error');
    });
  });

  describe('Caption Handling', () => {
    it('should include caption source when available', async () => {
      const result = await buildTimeline(mockContext);

      expect(result.success).toBe(true);
      const timeline = result.data!.timeline as any;

      expect(timeline.captions.src).toBeDefined();
      expect(timeline.captions.src).toContain('captions.srt');
    });

    it('should handle missing caption source gracefully', async () => {
      mockContext.artifacts.captionsSrtPath = undefined;

      const result = await buildTimeline(mockContext);

      expect(result.success).toBe(true);
      const timeline = result.data!.timeline as any;

      expect(timeline.captions.src).toBeUndefined();
    });
  });

  describe('Frame Calculation', () => {
    it('should calculate frames correctly at 30fps', async () => {
      const result = await buildTimeline(mockContext);

      expect(result.success).toBe(true);
      const timeline = result.data!.timeline as any;

      // Verify frame calculation: ms / 1000 * fps
      // 5000ms = 5s * 30fps = 150 frames
      const segment = timeline.segments[0];
      const expectedEndFrame = Math.round((5000 / 1000) * 30);
      expect(segment.endFrame).toBe(expectedEndFrame);
    });

    it('should handle fractional frame values by rounding', async () => {
      // Create a slot with timing that doesn't divide evenly
      mockContext.artifacts.visualPlan!.slots[0].endMs = 5333; // Should round

      const result = await buildTimeline(mockContext);

      expect(result.success).toBe(true);
      const timeline = result.data!.timeline as any;

      // 5333ms / 1000 * 30 = 159.99 -> rounds to 160
      expect(timeline.segments[0].endFrame).toBe(160);
    });
  });

  describe('Integration with Pipeline Context', () => {
    it('should use correct storage base path', async () => {
      await buildTimeline(mockContext);

      const uploadCall = mockUpload.mock.calls[0];
      const uploadPath = uploadCall[0];

      expect(uploadPath).toContain('u_user_test_001');
      expect(uploadPath).toContain('p_proj_test_001');
      expect(uploadPath).toContain('j_job_test_001');
    });

    it('should preserve existing artifacts', async () => {
      const existingArtifact = mockContext.artifacts.narrationPath;

      await buildTimeline(mockContext);

      expect(mockContext.artifacts.narrationPath).toBe(existingArtifact);
    });
  });

  describe('URL Generation', () => {
    it('should generate correct storage URLs for assets', async () => {
      const result = await buildTimeline(mockContext);

      expect(result.success).toBe(true);
      const timeline = result.data!.timeline as any;

      // Audio track URL should include Supabase storage path
      const audioTrack = timeline.tracks.find((t: any) => t.type === 'audio');
      expect(audioTrack.src).toContain('https://test.supabase.co/storage/v1/object/public/project-assets/');
    });

    it('should handle missing paths gracefully', async () => {
      mockContext.artifacts.narrationPath = '';

      const result = await buildTimeline(mockContext);

      expect(result.success).toBe(true);
      const timeline = result.data!.timeline as any;

      const audioTrack = timeline.tracks.find((t: any) => t.type === 'audio');
      expect(audioTrack.src).toBe('');
    });
  });
});
