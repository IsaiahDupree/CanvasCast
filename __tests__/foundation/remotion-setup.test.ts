/**
 * Test: FOUND-005 - Remotion Package Setup
 *
 * Acceptance criteria:
 * 1. Remotion preview works
 * 2. Composition renders test video
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const REMOTION_ROOT = join(__dirname, '../../packages/remotion');

describe('FOUND-005: Remotion Package Setup', () => {
  describe('Package structure', () => {
    it('should have package.json with remotion dependencies', () => {
      const packageJsonPath = join(REMOTION_ROOT, 'package.json');
      expect(existsSync(packageJsonPath)).toBe(true);

      const packageJson = require(packageJsonPath);
      expect(packageJson.name).toBe('@canvascast/remotion');
      expect(packageJson.dependencies).toHaveProperty('remotion');
      expect(packageJson.dependencies).toHaveProperty('@remotion/bundler');
      expect(packageJson.dependencies).toHaveProperty('@remotion/cli');
      expect(packageJson.dependencies).toHaveProperty('@remotion/renderer');
    });

    it('should have remotion dev script', () => {
      const packageJsonPath = join(REMOTION_ROOT, 'package.json');
      const packageJson = require(packageJsonPath);

      expect(packageJson.scripts).toHaveProperty('dev');
      expect(packageJson.scripts.dev).toContain('remotion');
    });

    it('should have remotion build script', () => {
      const packageJsonPath = join(REMOTION_ROOT, 'package.json');
      const packageJson = require(packageJsonPath);

      expect(packageJson.scripts).toHaveProperty('build');
      expect(packageJson.scripts.build).toContain('remotion render');
    });
  });

  describe('Source structure', () => {
    it('should have src/index.ts entry point', () => {
      const indexPath = join(REMOTION_ROOT, 'src/index.ts');
      expect(existsSync(indexPath)).toBe(true);
    });

    it('should have Root.tsx with composition registration', () => {
      const rootPath = join(REMOTION_ROOT, 'src/Root.tsx');
      expect(existsSync(rootPath)).toBe(true);

      const rootContent = readFileSync(rootPath, 'utf-8');
      expect(rootContent).toContain('Composition');
      expect(rootContent).toContain('CanvasCastVideo');
    });

    it('should have compositions/CanvasCastVideo.tsx', () => {
      const compositionPath = join(REMOTION_ROOT, 'src/compositions/CanvasCastVideo.tsx');
      expect(existsSync(compositionPath)).toBe(true);
    });
  });

  describe('TypeScript configuration', () => {
    it('should have tsconfig.json', () => {
      const tsconfigPath = join(REMOTION_ROOT, 'tsconfig.json');
      expect(existsSync(tsconfigPath)).toBe(true);
    });
  });

  describe('Composition functionality', () => {
    it('should export CanvasCastVideo component', () => {
      const compositionPath = join(REMOTION_ROOT, 'src/compositions/CanvasCastVideo.tsx');
      const compositionContent = readFileSync(compositionPath, 'utf-8');

      expect(compositionContent).toContain('export');
      expect(compositionContent).toContain('CanvasCastVideo');
      expect(compositionContent).toContain('AbsoluteFill');
      expect(compositionContent).toContain('Audio');
    });

    it('should use timeline props from shared package', () => {
      const compositionPath = join(REMOTION_ROOT, 'src/compositions/CanvasCastVideo.tsx');
      const compositionContent = readFileSync(compositionPath, 'utf-8');

      expect(compositionContent).toContain('@canvascast/shared');
      expect(compositionContent).toContain('TimelineV1');
    });

    it('should render segments with images and captions', () => {
      const compositionPath = join(REMOTION_ROOT, 'src/compositions/CanvasCastVideo.tsx');
      const compositionContent = readFileSync(compositionPath, 'utf-8');

      // Should handle segments
      expect(compositionContent).toContain('segments');

      // Should render images
      expect(compositionContent).toContain('Img');
      expect(compositionContent).toContain('image');

      // Should handle captions
      expect(compositionContent).toContain('caption');
    });
  });

  describe('Integration with shared types', () => {
    it('should reference @canvascast/shared in package.json', () => {
      const packageJsonPath = join(REMOTION_ROOT, 'package.json');
      const packageJson = require(packageJsonPath);

      expect(packageJson.dependencies).toHaveProperty('@canvascast/shared');
      expect(packageJson.dependencies['@canvascast/shared']).toBe('workspace:*');
    });
  });
});
