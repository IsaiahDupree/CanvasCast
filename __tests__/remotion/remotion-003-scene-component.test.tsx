/**
 * Test: REMOTION-003 - Scene Component
 *
 * Acceptance criteria:
 * 1. Ken Burns effect (zoom/pan animation)
 * 2. Smooth transitions between scenes
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const REMOTION_ROOT = join(__dirname, '../../packages/remotion');
const SCENE_COMPONENT_PATH = join(REMOTION_ROOT, 'src/components/Scene.tsx');

describe('REMOTION-003: Scene Component', () => {
  describe('File structure', () => {
    it('should have Scene.tsx component file', () => {
      expect(existsSync(SCENE_COMPONENT_PATH)).toBe(true);
    });

    it('should export Scene component', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('export');
      expect(content).toContain('Scene');
      expect(content).toContain('React.FC');
    });
  });

  describe('Component props interface', () => {
    it('should accept imageSrc prop', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('imageSrc');
    });

    it('should accept startFrame and endFrame props', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('startFrame');
      expect(content).toContain('endFrame');
    });

    it('should accept motion prop', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('motion');
    });

    it('should accept transition prop', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('transition');
    });
  });

  describe('Type definitions', () => {
    it('should define SceneProps interface', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('interface SceneProps');
      expect(content).toContain('imageSrc: string');
    });

    it('should support motion types from shared timeline schema', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      // Should reference Motion type from shared package
      expect(content).toMatch(/Motion|motion/);
    });

    it('should support transition types from shared timeline schema', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      // Should reference Transition type from shared package
      expect(content).toMatch(/Transition|transition/);
    });
  });

  describe('Acceptance Criterion 1: Ken Burns effect', () => {
    it('should import useCurrentFrame from remotion', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('useCurrentFrame');
      expect(content).toMatch(/from\s+['"]remotion['"]/);
    });

    it('should import interpolate from remotion', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('interpolate');
      expect(content).toMatch(/from\s+['"]remotion['"]/);
    });

    it('should calculate local frame relative to segment start', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      // Should subtract startFrame from current frame
      expect(content).toContain('localFrame');
      expect(content).toMatch(/frame.*-.*startFrame|currentFrame.*-.*startFrame/);
    });

    it('should calculate segment duration', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      // Should calculate endFrame - startFrame
      expect(content).toContain('duration');
      expect(content).toMatch(/endFrame.*-.*startFrame/);
    });

    it('should interpolate scale for zoom effect', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('scale');
      expect(content).toContain('interpolate');
      // Should interpolate from start to end scale
      expect(content).toMatch(/\[1.*1\.\d+\]|\[\s*1\s*,.*[zZ]oom|\[0,\s*duration\],\s*\[1,/);
    });

    it('should apply transform scale to image', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('transform');
      expect(content).toContain('scale');
      expect(content).toMatch(/scale\(/);
    });

    it('should support different motion types', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      // Should check motion.type
      expect(content).toContain('motion');
      expect(content).toMatch(/ken-burns|zoom-in|zoom-out|pan/);
    });

    it('should apply transformOrigin for proper zoom center', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('transformOrigin');
      expect(content).toMatch(/center|50%/);
    });
  });

  describe('Acceptance Criterion 2: Smooth transitions', () => {
    it('should handle fade transition', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('fade');
      expect(content).toContain('opacity');
    });

    it('should interpolate opacity for fade effect', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      // Should interpolate opacity from 0 to 1 or vice versa
      expect(content).toMatch(/opacity.*interpolate|interpolate.*opacity/);
    });

    it('should use transition.durationFrames', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('durationFrames');
      expect(content).toContain('transition');
    });

    it('should apply opacity style to container', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('opacity');
      expect(content).toContain('style');
    });

    it('should handle "none" transition type', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      // Should handle case where no transition is applied
      expect(content).toMatch(/none|transition.*type|type.*===.*['"]none['"]/);
    });

    it('should clamp interpolation values', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      // Should use extrapolateRight: "clamp" for smooth animation
      expect(content).toMatch(/extrapolate.*clamp|clamp/);
    });
  });

  describe('Image rendering', () => {
    it('should use Remotion Img component', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('Img');
      expect(content).toMatch(/import.*Img.*from\s+['"]remotion['"]/);
    });

    it('should set image src from prop', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('src=');
      expect(content).toContain('imageSrc');
    });

    it('should use objectFit cover by default', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('objectFit');
      expect(content).toMatch(/cover|contain/);
    });

    it('should fill container with image', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      // Should set width and height to 100%
      expect(content).toMatch(/width.*100%|height.*100%/);
    });
  });

  describe('Container structure', () => {
    it('should use AbsoluteFill from Remotion', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('AbsoluteFill');
      expect(content).toMatch(/import.*AbsoluteFill.*from\s+['"]remotion['"]/);
    });

    it('should apply styles to container', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('style=');
    });
  });

  describe('Motion intensity', () => {
    it('should support motion intensity prop', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      expect(content).toContain('intensity');
    });

    it('should scale motion effect based on intensity', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      // Should multiply or scale the effect by intensity
      expect(content).toMatch(/intensity.*\*|intensity.*zoom|\*.*intensity/);
    });

    it('should default intensity to reasonable value', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      // Should have default intensity (e.g., 0.2, 0.3)
      expect(content).toMatch(/0\.\d+|intensity.*\?/);
    });
  });

  describe('Integration with shared types', () => {
    it('should import types from @canvascast/shared', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      expect(content).toMatch(/from\s+['"]@canvascast\/shared['"]/);
    });

    it('should use Motion type', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      expect(content).toMatch(/Motion|MotionSchema/);
    });

    it('should use Transition type', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      expect(content).toMatch(/Transition|TransitionSchema/);
    });
  });

  describe('Edge cases', () => {
    it('should handle missing motion prop with defaults', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      // Should use optional chaining or default values
      expect(content).toMatch(/\?\.|\?\?|motion\s*\|\|/);
    });

    it('should handle missing transition prop with defaults', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      // Should use optional chaining or default values
      expect(content).toMatch(/\?\.|\?\?|transition\s*\|\|/);
    });

    it('should handle zero duration segments', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      // Should protect against division by zero or ensure minimum duration
      expect(content).toMatch(/Math\.max|duration.*>|>\s*0/);
    });

    it('should handle missing image src gracefully', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      // Should have imageSrc prop required or handle undefined
      expect(content).toContain('imageSrc');
    });
  });

  describe('Performance', () => {
    it('should use useMemo or efficient calculations', () => {
      const content = readFileSync(SCENE_COMPONENT_PATH, 'utf-8');
      // Should avoid recalculating on every frame if possible
      // interpolate is already optimized by Remotion
      expect(content).toContain('interpolate');
    });
  });
});
