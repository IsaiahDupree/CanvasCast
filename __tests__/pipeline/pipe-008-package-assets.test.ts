/**
 * Tests for Package Assets Step
 * Feature: PIPE-008 - Asset Packaging Step
 *
 * This test suite covers:
 * - Uploading all assets to storage
 * - Generating asset manifest
 * - Creating ZIP archive
 * - Generating thumbnails from video
 * - Recording assets in database
 * - Error handling for missing files
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PipelineContext, JobRow, ProjectRow } from '../../apps/worker/src/pipeline/types';

// Mock Supabase first - before any imports
const mockDownload = vi.fn();
const mockUpload = vi.fn();
const mockInsert = vi.fn();
const mockGetPublicUrl = vi.fn();
const mockFrom = vi.fn();
const mockSupabaseClient = {
  storage: {
    from: vi.fn(() => ({
      download: mockDownload,
      upload: mockUpload,
      getPublicUrl: mockGetPublicUrl,
    })),
  },
  from: mockFrom,
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

// Mock child_process exec for ffmpeg
const mockExec = vi.fn((cmd: string, callback: Function) => {
  callback(null, { stdout: 'success', stderr: '' });
});
vi.mock('child_process', () => ({
  exec: mockExec,
}));

// Mock fs/promises
const mockMkdtemp = vi.fn();
const mockWriteFile = vi.fn();
const mockReadFile = vi.fn();
const mockRm = vi.fn();
const mockStat = vi.fn();
const mockCreateWriteStream = vi.fn();

vi.mock('fs/promises', () => ({
  default: {
    mkdtemp: mockMkdtemp,
    writeFile: mockWriteFile,
    readFile: mockReadFile,
    rm: mockRm,
    stat: mockStat,
  },
  mkdtemp: mockMkdtemp,
  writeFile: mockWriteFile,
  readFile: mockReadFile,
  rm: mockRm,
  stat: mockStat,
}));

vi.mock('fs', () => ({
  default: {
    createWriteStream: mockCreateWriteStream,
  },
  createWriteStream: mockCreateWriteStream,
}));

// Mock archiver
const mockArchive = {
  pipe: vi.fn(),
  file: vi.fn(),
  append: vi.fn(),
  finalize: vi.fn().mockResolvedValue(undefined),
};
const mockArchiver = vi.fn(() => mockArchive);
vi.mock('archiver', () => ({
  default: mockArchiver,
}));

// Import after mocking
const { packageAssets } = await import('../../apps/worker/src/pipeline/steps/package-assets');

describe('PIPE-008: Asset Packaging Step', () => {
  let mockContext: PipelineContext;
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create a temp directory path for testing
    tempDir = '/tmp/test-package-123';

    // Set up environment
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

    // Mock fs operations
    mockMkdtemp.mockResolvedValue(tempDir);
    mockWriteFile.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue(Buffer.from('fake-file-data'));
    mockRm.mockResolvedValue(undefined);
    mockStat.mockResolvedValue({
      size: 1024,
      isFile: () => true,
      isDirectory: () => false,
    });

    // Mock createWriteStream properly
    mockCreateWriteStream.mockImplementation(() => {
      const stream: any = {
        on: vi.fn((event: string, cb: Function) => {
          if (event === 'close') {
            // Simulate async close event
            setTimeout(() => cb(), 10);
          }
          return stream;
        }),
        once: vi.fn((event: string, cb: Function) => {
          if (event === 'close') {
            setTimeout(() => cb(), 10);
          }
          return stream;
        }),
        write: vi.fn(),
        end: vi.fn(),
      };
      return stream;
    });

    // Mock exec to succeed by default
    mockExec.mockImplementation((cmd: string, options: any, callback: Function) => {
      const cb = typeof options === 'function' ? options : callback;
      if (cb) {
        cb(null, { stdout: 'success', stderr: '' });
      }
      return { stdout: '', stderr: '' };
    });

    // Mock Supabase operations
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://storage.test.com/file.mp4' },
    });
    mockInsert.mockResolvedValue({ data: [], error: null });
    mockFrom.mockReturnValue({
      insert: mockInsert,
    });
    mockDownload.mockResolvedValue({
      data: new Blob(['fake-data']),
      error: null,
    });

    // Create mock context with all required artifacts
    const mockJob: JobRow = {
      id: 'job-123',
      project_id: 'project-456',
      user_id: 'user-789',
      status: 'packaging',
      progress: 90,
      error_code: null,
      error_message: null,
      claimed_at: new Date().toISOString(),
      claimed_by: 'worker-1',
      started_at: new Date().toISOString(),
      finished_at: null,
      cost_credits_reserved: 10,
      cost_credits_final: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockProject: ProjectRow = {
      id: 'project-456',
      user_id: 'user-789',
      title: 'Test Video Project',
      niche_preset: 'educational',
      target_minutes: 1,
      status: 'processing',
      template_id: 'default',
      visual_preset_id: 'modern',
      voice_profile_id: null,
      image_density: 'medium',
      target_resolution: '1080p',
      timeline_path: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    mockContext = {
      job: mockJob,
      project: mockProject,
      userId: 'user-789',
      projectId: 'project-456',
      jobId: 'job-123',
      basePath: 'project-assets/u_user-789/p_project-456/j_job-123',
      outputPath: 'project-outputs/u_user-789/p_project-456/j_job-123',
      artifacts: {
        videoPath: 'project-outputs/u_user-789/p_project-456/j_job-123/final.mp4',
        narrationPath: 'project-assets/u_user-789/p_project-456/j_job-123/narration.mp3',
        narrationDurationMs: 60000,
        captionsSrtPath: 'project-assets/u_user-789/p_project-456/j_job-123/captions.srt',
        imagePaths: [
          'project-assets/u_user-789/p_project-456/j_job-123/image_0.png',
          'project-assets/u_user-789/p_project-456/j_job-123/image_1.png',
        ],
        script: {
          title: 'Test Video',
          sections: [
            {
              id: 's1',
              order: 1,
              headline: 'Introduction',
              narrationText: 'This is a test video',
              visualKeywords: ['test', 'video'],
              paceHint: 'normal',
              estimatedDurationMs: 30000,
            },
          ],
          totalWordCount: 5,
          estimatedDurationMs: 30000,
          generatedAt: new Date().toISOString(),
        },
        whisperSegments: [
          {
            id: 1,
            start: 0,
            end: 5,
            text: 'This is a test video',
          },
        ],
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Packaging', () => {
    it('should successfully package all assets', async () => {
      const result = await packageAssets(mockContext);

      if (!result.success) {
        console.log('Package result error:', result.error);
      }

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.zipPath).toBeDefined();
      expect(result.data?.zipPath).toContain('assets.zip');
    });

    it('should upload video to storage', async () => {
      await packageAssets(mockContext);

      expect(mockUpload).toHaveBeenCalledWith(
        expect.stringContaining('final.mp4'),
        expect.any(Buffer),
        expect.objectContaining({
          contentType: 'video/mp4',
        })
      );
    });

    it('should upload audio to storage', async () => {
      await packageAssets(mockContext);

      expect(mockUpload).toHaveBeenCalledWith(
        expect.stringContaining('audio.mp3'),
        expect.any(Buffer),
        expect.objectContaining({
          contentType: 'audio/mpeg',
        })
      );
    });

    it('should upload captions to storage', async () => {
      await packageAssets(mockContext);

      expect(mockUpload).toHaveBeenCalledWith(
        expect.stringContaining('captions.srt'),
        expect.any(Buffer),
        expect.objectContaining({
          contentType: 'text/plain',
        })
      );
    });

    it('should upload all images to storage', async () => {
      await packageAssets(mockContext);

      const imageUploads = mockUpload.mock.calls.filter((call: any) =>
        call[0].includes('images/')
      );
      expect(imageUploads.length).toBe(2);
    });
  });

  describe('Manifest Generation', () => {
    it('should generate a valid manifest', async () => {
      const result = await packageAssets(mockContext);

      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('manifest.json'),
        expect.stringContaining('"version"')
      );
    });

    it('should include all asset types in manifest', async () => {
      await packageAssets(mockContext);

      const manifestCall = mockWriteFile.mock.calls.find((call: any) =>
        call[0].includes('manifest.json')
      );
      expect(manifestCall).toBeDefined();

      const manifestContent = JSON.parse(manifestCall![1]);
      expect(manifestContent).toHaveProperty('video');
      expect(manifestContent).toHaveProperty('audio');
      expect(manifestContent).toHaveProperty('captions');
      expect(manifestContent).toHaveProperty('images');
    });

    it('should include project metadata in manifest', async () => {
      await packageAssets(mockContext);

      const manifestCall = mockWriteFile.mock.calls.find((call: any) =>
        call[0].includes('manifest.json')
      );
      const manifestContent = JSON.parse(manifestCall![1]);

      expect(manifestContent.metadata.title).toBe('Test Video Project');
      expect(manifestContent.metadata.niche).toBe('educational');
    });
  });

  describe('ZIP Archive', () => {
    it('should create a ZIP archive', async () => {
      await packageAssets(mockContext);

      expect(mockArchiver).toHaveBeenCalledWith('zip', expect.any(Object));
      expect(mockArchive.finalize).toHaveBeenCalled();
    });

    it('should upload ZIP to storage', async () => {
      await packageAssets(mockContext);

      // ZIP is uploaded after video, audio, captions, images (2), thumbnails (3), so it should be in the calls
      const zipUploads = mockUpload.mock.calls.filter((call: any) =>
        call[0].includes('assets.zip')
      );
      expect(zipUploads.length).toBeGreaterThan(0);
    });
  });

  describe('Database Records', () => {
    it('should save asset records to database', async () => {
      await packageAssets(mockContext);

      expect(mockInsert).toHaveBeenCalled();
      const insertCall = mockInsert.mock.calls[0][0];
      expect(Array.isArray(insertCall)).toBe(true);
      expect(insertCall.length).toBeGreaterThan(0);
    });

    it('should include asset metadata in database records', async () => {
      await packageAssets(mockContext);

      const insertCall = mockInsert.mock.calls[0][0];
      const videoRecord = insertCall.find((r: any) => r.type === 'video');

      expect(videoRecord).toBeDefined();
      expect(videoRecord.job_id).toBe('job-123');
      expect(videoRecord.url).toBeDefined();
      expect(videoRecord.storage_path).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing video path', async () => {
      delete mockContext.artifacts.videoPath;

      const result = await packageAssets(mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ERR_PACKAGING');
      expect(result.error?.message).toContain('video');
    });

    it('should handle storage upload failure', async () => {
      mockUpload.mockResolvedValueOnce({
        error: { message: 'Storage quota exceeded' }
      });

      const result = await packageAssets(mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ERR_PACKAGING');
    });

    it('should handle file read failure', async () => {
      mockReadFile.mockRejectedValueOnce(new Error('File not found'));

      const result = await packageAssets(mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ERR_PACKAGING');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup temporary files', async () => {
      await packageAssets(mockContext);

      expect(mockRm).toHaveBeenCalledWith(
        expect.stringContaining('/tmp'),
        expect.objectContaining({ recursive: true, force: true })
      );
    });

    it('should cleanup even on error', async () => {
      mockUpload.mockRejectedValueOnce(new Error('Upload failed'));

      await packageAssets(mockContext);

      expect(mockRm).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ recursive: true, force: true })
      );
    });
  });
});
