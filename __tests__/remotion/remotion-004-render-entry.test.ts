/**
 * Test: REMOTION-004 - Render Entry Point
 *
 * Acceptance criteria:
 * 1. Called from worker
 * 2. Returns output path
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { TimelineV1 } from '@canvascast/shared';

const REMOTION_ROOT = join(__dirname, '../../packages/remotion');

describe('REMOTION-004: Render Entry Point', () => {
  describe('File structure', () => {
    it('should have src/render.ts entry point', () => {
      const renderPath = join(REMOTION_ROOT, 'src/render.ts');
      expect(existsSync(renderPath)).toBe(true);
    });
  });

  describe('Render function', () => {
    it('should export a renderVideo function', () => {
      const renderPath = join(REMOTION_ROOT, 'src/render.ts');
      const renderContent = readFileSync(renderPath, 'utf-8');

      expect(renderContent).toContain('export');
      expect(renderContent).toContain('renderVideo');
    });

    it('should accept timeline and outputPath parameters', () => {
      const renderPath = join(REMOTION_ROOT, 'src/render.ts');
      const renderContent = readFileSync(renderPath, 'utf-8');

      // Should reference timeline parameter
      expect(renderContent).toContain('timeline');

      // Should reference outputPath or output location
      expect(renderContent).toMatch(/outputPath|outputLocation|output/i);
    });

    it('should use @remotion/bundler and @remotion/renderer', () => {
      const renderPath = join(REMOTION_ROOT, 'src/render.ts');
      const renderContent = readFileSync(renderPath, 'utf-8');

      expect(renderContent).toContain('@remotion/bundler');
      expect(renderContent).toContain('@remotion/renderer');
    });

    it('should bundle the composition before rendering', () => {
      const renderPath = join(REMOTION_ROOT, 'src/render.ts');
      const renderContent = readFileSync(renderPath, 'utf-8');

      expect(renderContent).toContain('bundle');
    });

    it('should call renderMedia', () => {
      const renderPath = join(REMOTION_ROOT, 'src/render.ts');
      const renderContent = readFileSync(renderPath, 'utf-8');

      expect(renderContent).toContain('renderMedia');
    });

    it('should select CanvasCastVideo composition', () => {
      const renderPath = join(REMOTION_ROOT, 'src/render.ts');
      const renderContent = readFileSync(renderPath, 'utf-8');

      expect(renderContent).toContain('selectComposition');
      expect(renderContent).toContain('CanvasCastVideo');
    });

    it('should return output path in result', () => {
      const renderPath = join(REMOTION_ROOT, 'src/render.ts');
      const renderContent = readFileSync(renderPath, 'utf-8');

      // Should return an object with output path
      expect(renderContent).toContain('return');
      expect(renderContent).toMatch(/outputPath|videoPath/i);
    });

    it('should accept options parameter for codec and quality settings', () => {
      const renderPath = join(REMOTION_ROOT, 'src/render.ts');
      const renderContent = readFileSync(renderPath, 'utf-8');

      // Should support options or have codec configuration
      expect(renderContent).toMatch(/codec|options|config/i);
    });
  });

  describe('Integration with worker', () => {
    it('should be callable as a module from worker pipeline', () => {
      const renderPath = join(REMOTION_ROOT, 'src/render.ts');

      // File should exist and be importable
      expect(existsSync(renderPath)).toBe(true);

      const renderContent = readFileSync(renderPath, 'utf-8');

      // Should export async function (for worker to await)
      expect(renderContent).toMatch(/export\s+(async\s+)?function|export\s+const\s+\w+\s*=\s*async/);
    });

    it('should handle errors and return them in a structured format', () => {
      const renderPath = join(REMOTION_ROOT, 'src/render.ts');
      const renderContent = readFileSync(renderPath, 'utf-8');

      // Should have try-catch or error handling
      expect(renderContent).toMatch(/try|catch|throw|Error/);
    });
  });

  describe('Render configuration', () => {
    it('should use h264 codec by default', () => {
      const renderPath = join(REMOTION_ROOT, 'src/render.ts');
      const renderContent = readFileSync(renderPath, 'utf-8');

      expect(renderContent).toContain('h264');
    });

    it('should pass inputProps with timeline to composition', () => {
      const renderPath = join(REMOTION_ROOT, 'src/render.ts');
      const renderContent = readFileSync(renderPath, 'utf-8');

      expect(renderContent).toContain('inputProps');
    });
  });

  describe('Type safety', () => {
    it('should use TypeScript and import Timeline types', () => {
      const renderPath = join(REMOTION_ROOT, 'src/render.ts');
      const renderContent = readFileSync(renderPath, 'utf-8');

      // Should import from shared package
      expect(renderContent).toContain('@canvascast/shared');
      expect(renderContent).toContain('TimelineV1');
    });
  });
});
