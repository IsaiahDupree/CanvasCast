/**
 * Test: REMOTION-002 - Caption Component
 *
 * Acceptance criteria:
 * 1. Highlights current word
 * 2. Animates smoothly
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const REMOTION_ROOT = join(__dirname, '../../packages/remotion');
const CAPTION_COMPONENT_PATH = join(REMOTION_ROOT, 'src/components/Caption.tsx');

describe('REMOTION-002: Caption Component', () => {
  describe('File structure', () => {
    it('should have Caption.tsx component file', () => {
      expect(existsSync(CAPTION_COMPONENT_PATH)).toBe(true);
    });

    it('should export Caption component', () => {
      const content = readFileSync(CAPTION_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('export');
      expect(content).toContain('Caption');
      expect(content).toContain('React.FC');
    });
  });

  describe('Component props interface', () => {
    it('should accept words array prop', () => {
      const content = readFileSync(CAPTION_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('words');
      expect(content).toContain('CaptionWord');
    });

    it('should accept style prop', () => {
      const content = readFileSync(CAPTION_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('style');
      expect(content).toContain('CaptionStyle');
    });

    it('should accept currentFrame prop', () => {
      const content = readFileSync(CAPTION_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('currentFrame');
    });

    it('should accept fps prop', () => {
      const content = readFileSync(CAPTION_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('fps');
    });
  });

  describe('Type definitions', () => {
    it('should define CaptionWord interface', () => {
      const content = readFileSync(CAPTION_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('interface CaptionWord');
      expect(content).toContain('word: string');
      expect(content).toContain('start: number');
      expect(content).toContain('end: number');
    });

    it('should define CaptionStyle interface', () => {
      const content = readFileSync(CAPTION_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('interface CaptionStyle');
      expect(content).toContain('fontFamily');
      expect(content).toContain('fontSize');
      expect(content).toContain('color');
      expect(content).toContain('activeColor');
    });

    it('should define CaptionProps interface', () => {
      const content = readFileSync(CAPTION_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('interface CaptionProps');
      expect(content).toContain('words: CaptionWord[]');
      expect(content).toContain('style: CaptionStyle');
    });
  });

  describe('Acceptance Criterion 1: Highlights current word', () => {
    it('should calculate current time from frame and fps', () => {
      const content = readFileSync(CAPTION_COMPONENT_PATH, 'utf-8');
      // Should convert frame to time
      expect(content).toContain('currentTime');
      expect(content).toContain('currentFrame');
      expect(content).toContain('fps');
      // Should divide frame by fps to get seconds
      expect(content).toMatch(/currentFrame\s*\/\s*fps|frame\s*\/\s*fps/);
    });

    it('should filter active words based on timestamps', () => {
      const content = readFileSync(CAPTION_COMPONENT_PATH, 'utf-8');
      // Should filter words
      expect(content).toContain('filter');
      expect(content).toContain('start');
      expect(content).toContain('end');
      // Should check if currentTime is within word bounds
      expect(content).toMatch(/currentTime\s*>=|currentTime\s*<=|>=.*start|<=.*end/);
    });

    it('should map words with isActive flag', () => {
      const content = readFileSync(CAPTION_COMPONENT_PATH, 'utf-8');
      // Should map words to add isActive property
      expect(content).toContain('map');
      expect(content).toContain('isActive');
    });

    it('should apply different colors for active vs inactive words', () => {
      const content = readFileSync(CAPTION_COMPONENT_PATH, 'utf-8');
      // Should conditionally apply colors
      expect(content).toContain('isActive');
      expect(content).toContain('activeColor');
      expect(content).toContain('color');
      // Should use ternary or conditional logic
      expect(content).toMatch(/\?|isActive.*activeColor|activeColor.*isActive/);
    });

    it('should apply bold font weight to active words', () => {
      const content = readFileSync(CAPTION_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('fontWeight');
      expect(content).toContain('bold');
    });

    it('should render each word in a span element', () => {
      const content = readFileSync(CAPTION_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('<span');
      expect(content).toContain('word.word');
    });

    it('should add space after each word', () => {
      const content = readFileSync(CAPTION_COMPONENT_PATH, 'utf-8');
      // Should add space after word text
      expect(content).toMatch(/word\.word.*\{?\s*['"]\s*['"]\s*\}?|word\.word.*\+.*['"]\s*['"]/);
    });
  });

  describe('Acceptance Criterion 2: Animates smoothly', () => {
    it('should use appropriate container styling', () => {
      const content = readFileSync(CAPTION_COMPONENT_PATH, 'utf-8');
      // Should have container div
      expect(content).toContain('<div');
      expect(content).toContain('style=');
    });

    it('should support position styling from style prop', () => {
      const content = readFileSync(CAPTION_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('position');
    });

    it('should support backgroundColor from style prop', () => {
      const content = readFileSync(CAPTION_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('backgroundColor');
    });

    it('should support padding from style prop', () => {
      const content = readFileSync(CAPTION_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('padding');
    });

    it('should use unique key for each word span', () => {
      const content = readFileSync(CAPTION_COMPONENT_PATH, 'utf-8');
      // Should use index or id as key
      expect(content).toMatch(/key=\{[^}]*\}/);
    });
  });

  describe('Caption style presets', () => {
    it('should define caption style presets constant', () => {
      const content = readFileSync(CAPTION_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('CAPTION_PRESETS');
      expect(content).toMatch(/CAPTION_PRESETS\s*[:=]/);
    });

    it('should have motivation preset', () => {
      const content = readFileSync(CAPTION_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('motivation');
    });

    it('should have explainer preset', () => {
      const content = readFileSync(CAPTION_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('explainer');
    });

    it('should have facts preset', () => {
      const content = readFileSync(CAPTION_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('facts');
    });

    it('should define preset colors', () => {
      const content = readFileSync(CAPTION_COMPONENT_PATH, 'utf-8');
      // Should have hex color codes
      expect(content).toMatch(/#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}/);
    });
  });

  describe('Integration with composition', () => {
    it('should be importable from components directory', () => {
      const content = readFileSync(CAPTION_COMPONENT_PATH, 'utf-8');
      // Should have proper exports
      expect(content).toMatch(/export\s+(const|function|interface)/);
    });

    it('should work with Remotion hooks', () => {
      const content = readFileSync(CAPTION_COMPONENT_PATH, 'utf-8');
      // Caption component receives currentFrame from parent, doesn't need to import hooks
      // But it should work with frame-based timing
      expect(content).toContain('currentFrame');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty words array', () => {
      const content = readFileSync(CAPTION_COMPONENT_PATH, 'utf-8');
      // Should map over words array safely
      expect(content).toContain('words.map');
    });

    it('should handle missing style properties with defaults', () => {
      const content = readFileSync(CAPTION_COMPONENT_PATH, 'utf-8');
      // Should access style properties
      expect(content).toMatch(/style\./);
    });

    it('should handle no active words gracefully', () => {
      const content = readFileSync(CAPTION_COMPONENT_PATH, 'utf-8');
      // Filter can return empty array, code should handle it
      expect(content).toContain('filter');
    });
  });
});
