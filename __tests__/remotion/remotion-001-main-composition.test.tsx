/**
 * Test: REMOTION-001 - Main Video Composition
 *
 * Acceptance criteria:
 * 1. Renders video with images
 * 2. Syncs audio
 * 3. Shows captions
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineV1 } from '@canvascast/shared';
import { TimelineContractV1 } from '@canvascast/shared';

const REMOTION_ROOT = join(__dirname, '../../packages/remotion');
const COMPOSITION_PATH = join(REMOTION_ROOT, 'src/compositions/CanvasCastVideo.tsx');

describe('REMOTION-001: Main Video Composition', () => {
  const mockTimeline: TimelineV1 = {
    version: 1,
    fps: 30,
    width: 1920,
    height: 1080,
    durationFrames: 780,
    theme: {
      primary: '#2F2B4A',
      secondary: '#4B6B4D',
      accent: '#3E356C',
      text: '#111827',
      fontFamily: 'Inter',
    },
    tracks: [
      { type: 'audio', src: 'https://example.com/audio.mp3', volume: 1 },
    ],
    captions: {
      src: 'https://example.com/captions.vtt',
      style: {
        enabled: true,
        position: 'bottom',
        maxWidthPct: 0.86,
        fontSize: 44,
        lineHeight: 1.15,
        textColor: '#F7F7F7',
        strokeColor: '#111827',
        strokeWidth: 3,
        bgColor: 'rgba(17,24,39,0.35)',
        bgPadding: 16,
        borderRadius: 18,
      },
    },
    segments: [
      {
        id: 'seg_000',
        startFrame: 0,
        endFrame: 240,
        text: 'Test caption text',
        image: {
          src: 'https://example.com/image1.jpg',
          fit: 'cover',
          zoom: 1.05,
        },
        overlays: [
          { text: 'Overlay text', x: 0.08, y: 0.78, size: 56, weight: 800 },
        ],
        transition: { type: 'cut', durationFrames: 0 },
      },
      {
        id: 'seg_001',
        startFrame: 240,
        endFrame: 510,
        text: 'Second segment text',
        image: {
          src: 'https://example.com/image2.jpg',
          fit: 'cover',
          zoom: 1.03,
        },
        overlays: [],
        transition: { type: 'fade', durationFrames: 12 },
      },
    ],
  };

  describe('File structure', () => {
    it('should have CanvasCastVideo.tsx composition file', () => {
      expect(existsSync(COMPOSITION_PATH)).toBe(true);
    });

    it('should export CanvasCastVideo component', () => {
      const content = readFileSync(COMPOSITION_PATH, 'utf-8');
      expect(content).toContain('export');
      expect(content).toContain('CanvasCastVideo');
      expect(content).toContain('React.FC');
    });

    it('should accept timeline props', () => {
      const content = readFileSync(COMPOSITION_PATH, 'utf-8');
      expect(content).toContain('Props');
      expect(content).toContain('timeline');
      expect(content).toContain('TimelineV1');
    });
  });

  describe('Acceptance Criterion 1: Renders video with images', () => {
    it('should import and use Img component from Remotion', () => {
      const content = readFileSync(COMPOSITION_PATH, 'utf-8');
      expect(content).toContain("import");
      expect(content).toContain('Img');
      expect(content).toContain('from "remotion"');
      expect(content).toContain('<Img');
    });

    it('should render images from segment data', () => {
      const content = readFileSync(COMPOSITION_PATH, 'utf-8');
      // Should access active segment
      expect(content).toContain('segments');
      expect(content).toContain('active');
      // Should render image with src
      expect(content).toContain('image');
      expect(content).toContain('src');
    });

    it('should apply zoom/scale effects to images', () => {
      const content = readFileSync(COMPOSITION_PATH, 'utf-8');
      // Should use interpolate for zoom effects
      expect(content).toContain('zoom');
      expect(content).toContain('scale');
      expect(content).toContain('interpolate');
    });

    it('should support object-fit property for images', () => {
      const content = readFileSync(COMPOSITION_PATH, 'utf-8');
      expect(content).toContain('objectFit');
      expect(content).toContain('fit');
    });

    it('should handle missing image with fallback gradient', () => {
      const content = readFileSync(COMPOSITION_PATH, 'utf-8');
      // Should check if image source exists
      expect(content).toContain('!active.image');
      expect(content).toContain('linear-gradient');
      expect(content).toContain('theme');
    });
  });

  describe('Acceptance Criterion 2: Syncs audio', () => {
    it('should import and use Audio component from Remotion', () => {
      const content = readFileSync(COMPOSITION_PATH, 'utf-8');
      expect(content).toContain('Audio');
      expect(content).toContain('from "remotion"');
      expect(content).toContain('<Audio');
    });

    it('should render audio track from timeline', () => {
      const content = readFileSync(COMPOSITION_PATH, 'utf-8');
      // Should access audio track from timeline
      expect(content).toContain('tracks');
      expect(content).toContain('audio');
      expect(content).toContain('audioTrack');
    });

    it('should pass audio src to Audio component', () => {
      const content = readFileSync(COMPOSITION_PATH, 'utf-8');
      // Should pass src prop
      expect(content).toContain('audioTrack.src');
      expect(content).toContain('src=');
    });

    it('should support volume control', () => {
      const content = readFileSync(COMPOSITION_PATH, 'utf-8');
      expect(content).toContain('volume');
    });

    it('should handle missing audio track gracefully', () => {
      const content = readFileSync(COMPOSITION_PATH, 'utf-8');
      // Should conditionally render audio
      expect(content).toContain('audioTrack?.src');
    });
  });

  describe('Acceptance Criterion 3: Shows captions', () => {
    it('should render caption text from segments', () => {
      const content = readFileSync(COMPOSITION_PATH, 'utf-8');
      // Should access segment text
      expect(content).toContain('active.text');
      expect(content).toContain('caption');
    });

    it('should have CaptionDisplay component', () => {
      const content = readFileSync(COMPOSITION_PATH, 'utf-8');
      expect(content).toContain('CaptionDisplay');
      expect(content).toContain('<CaptionDisplay');
    });

    it('should apply caption styling from timeline', () => {
      const content = readFileSync(COMPOSITION_PATH, 'utf-8');
      // Should use caption style from timeline
      expect(content).toContain('captions');
      expect(content).toContain('style');
      expect(content).toContain('fontSize');
    });

    it('should support caption positioning', () => {
      const content = readFileSync(COMPOSITION_PATH, 'utf-8');
      expect(content).toContain('position');
      // Should support different positions (flex-end for bottom, center for center)
      expect(content).toContain('flex-end');
      expect(content).toContain('center');
    });

    it('should apply text stroke for readability', () => {
      const content = readFileSync(COMPOSITION_PATH, 'utf-8');
      expect(content).toContain('strokeColor');
      expect(content).toContain('strokeWidth');
      expect(content).toContain('WebkitTextStroke');
    });

    it('should respect caption enabled flag', () => {
      const content = readFileSync(COMPOSITION_PATH, 'utf-8');
      // Should check if captions are enabled
      expect(content).toContain('enabled');
    });

    it('should apply theme font family to captions', () => {
      const content = readFileSync(COMPOSITION_PATH, 'utf-8');
      expect(content).toContain('fontFamily');
      expect(content).toContain('theme.fontFamily');
    });
  });

  describe('Additional composition features', () => {
    it('should use AbsoluteFill for layout', () => {
      const content = readFileSync(COMPOSITION_PATH, 'utf-8');
      expect(content).toContain('AbsoluteFill');
      expect(content).toContain('<AbsoluteFill');
    });

    it('should use useCurrentFrame hook for animations', () => {
      const content = readFileSync(COMPOSITION_PATH, 'utf-8');
      expect(content).toContain('useCurrentFrame');
      expect(content).toContain('frame');
    });

    it('should use useVideoConfig hook', () => {
      const content = readFileSync(COMPOSITION_PATH, 'utf-8');
      expect(content).toContain('useVideoConfig');
      expect(content).toContain('fps');
    });

    it('should validate timeline with Zod schema', () => {
      const content = readFileSync(COMPOSITION_PATH, 'utf-8');
      expect(content).toContain('TimelineContractV1');
      expect(content).toContain('parse');
    });

    it('should support fade transitions', () => {
      const content = readFileSync(COMPOSITION_PATH, 'utf-8');
      expect(content).toContain('transition');
      expect(content).toContain('fade');
      expect(content).toContain('opacity');
    });

    it('should render text overlays', () => {
      const content = readFileSync(COMPOSITION_PATH, 'utf-8');
      expect(content).toContain('overlays');
      expect(content).toContain('overlay.text');
    });

    it('should apply theme colors', () => {
      const content = readFileSync(COMPOSITION_PATH, 'utf-8');
      expect(content).toContain('theme');
      expect(content).toContain('primary');
      expect(content).toContain('secondary');
    });
  });

  describe('Timeline schema validation', () => {
    it('should validate correct timeline schema', () => {
      expect(() => TimelineContractV1.parse(mockTimeline)).not.toThrow();
    });

    it('should validate timeline with all required fields', () => {
      const result = TimelineContractV1.safeParse(mockTimeline);
      expect(result.success).toBe(true);
    });

    it('should have all necessary timeline properties', () => {
      const result = TimelineContractV1.safeParse(mockTimeline);
      if (result.success) {
        expect(result.data).toHaveProperty('version');
        expect(result.data).toHaveProperty('fps');
        expect(result.data).toHaveProperty('width');
        expect(result.data).toHaveProperty('height');
        expect(result.data).toHaveProperty('durationFrames');
        expect(result.data).toHaveProperty('theme');
        expect(result.data).toHaveProperty('tracks');
        expect(result.data).toHaveProperty('captions');
        expect(result.data).toHaveProperty('segments');
      }
    });
  });

  describe('Integration with Root composition', () => {
    it('should be registered in Root.tsx', () => {
      const rootPath = join(REMOTION_ROOT, 'src/Root.tsx');
      const rootContent = readFileSync(rootPath, 'utf-8');

      expect(rootContent).toContain('CanvasCastVideo');
      expect(rootContent).toContain('Composition');
      expect(rootContent).toContain('id="CanvasCastVideo"');
    });

    it('should have default props configured in Root', () => {
      const rootPath = join(REMOTION_ROOT, 'src/Root.tsx');
      const rootContent = readFileSync(rootPath, 'utf-8');

      expect(rootContent).toContain('defaultProps');
      expect(rootContent).toContain('timeline');
    });

    it('should have correct video dimensions in Root', () => {
      const rootPath = join(REMOTION_ROOT, 'src/Root.tsx');
      const rootContent = readFileSync(rootPath, 'utf-8');

      expect(rootContent).toContain('width={1920}');
      expect(rootContent).toContain('height={1080}');
      expect(rootContent).toContain('fps={30}');
    });
  });
});
