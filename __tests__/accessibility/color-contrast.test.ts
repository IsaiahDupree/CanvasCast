import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * A11Y-004: Color Contrast
 *
 * Ensures all text meets WCAG 2.1 AA contrast requirements:
 * - 4.5:1 ratio for normal text (< 18pt or < 14pt bold)
 * - 3:1 ratio for large text (>= 18pt or >= 14pt bold)
 * - 3:1 ratio for UI components and graphics
 */

// Helper to convert HSL to RGB
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [
    Math.round(255 * f(0)),
    Math.round(255 * f(8)),
    Math.round(255 * f(4)),
  ];
}

// Calculate relative luminance
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Calculate contrast ratio
function getContrastRatio(
  rgb1: [number, number, number],
  rgb2: [number, number, number]
): number {
  const lum1 = getLuminance(...rgb1);
  const lum2 = getLuminance(...rgb2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Parse HSL string like "270 91% 65%"
function parseHsl(hsl: string): [number, number, number] {
  const parts = hsl.trim().split(/\s+/);
  return [
    parseFloat(parts[0]),
    parseFloat(parts[1].replace('%', '')),
    parseFloat(parts[2].replace('%', '')),
  ];
}

describe('A11Y-004: Color Contrast', () => {
  const cssPath = join(process.cwd(), 'apps', 'web', 'src', 'app', 'globals.css');
  let cssContent: string;

  test('globals.css file exists', () => {
    cssContent = readFileSync(cssPath, 'utf-8');
    expect(cssContent).toBeTruthy();
  });

  describe('Light mode contrast ratios', () => {
    test('primary text on background meets 4.5:1', () => {
      const cssContent = readFileSync(cssPath, 'utf-8');

      // Extract light mode colors
      const foregroundMatch = cssContent.match(/--foreground:\s*([^;]+);/);
      const backgroundMatch = cssContent.match(/--background:\s*([^;]+);/);

      expect(foregroundMatch).toBeTruthy();
      expect(backgroundMatch).toBeTruthy();

      // foreground: 0 0% 3.9% (very dark gray)
      const foreground = hslToRgb(...parseHsl(foregroundMatch![1]));
      // background: 0 0% 100% (white)
      const background = hslToRgb(...parseHsl(backgroundMatch![1]));

      const ratio = getContrastRatio(foreground, background);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    test('muted text on background meets 4.5:1', () => {
      const cssContent = readFileSync(cssPath, 'utf-8');

      const mutedForegroundMatch = cssContent.match(/--muted-foreground:\s*([^;]+);/);
      const backgroundMatch = cssContent.match(/--background:\s*([^;]+);/);

      expect(mutedForegroundMatch).toBeTruthy();
      expect(backgroundMatch).toBeTruthy();

      // muted-foreground: 0 0% 45.1% (medium gray)
      const mutedForeground = hslToRgb(...parseHsl(mutedForegroundMatch![1]));
      // background: 0 0% 100% (white)
      const background = hslToRgb(...parseHsl(backgroundMatch![1]));

      const ratio = getContrastRatio(mutedForeground, background);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    test('primary button text on primary background meets 4.5:1', () => {
      const cssContent = readFileSync(cssPath, 'utf-8');

      const primaryMatch = cssContent.match(/--primary:\s*([^;]+);/);
      const primaryForegroundMatch = cssContent.match(/--primary-foreground:\s*([^;]+);/);

      expect(primaryMatch).toBeTruthy();
      expect(primaryForegroundMatch).toBeTruthy();

      // primary: 270 91% 65% (purple)
      const primary = hslToRgb(...parseHsl(primaryMatch![1]));
      // primary-foreground: 0 0% 98% (almost white)
      const primaryForeground = hslToRgb(...parseHsl(primaryForegroundMatch![1]));

      const ratio = getContrastRatio(primary, primaryForeground);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    test('accent text on accent background meets 4.5:1', () => {
      const cssContent = readFileSync(cssPath, 'utf-8');

      const accentMatch = cssContent.match(/--accent:\s*([^;]+);/);
      const accentForegroundMatch = cssContent.match(/--accent-foreground:\s*([^;]+);/);

      expect(accentMatch).toBeTruthy();
      expect(accentForegroundMatch).toBeTruthy();

      // accent: 191 100% 50% (cyan)
      const accent = hslToRgb(...parseHsl(accentMatch![1]));
      // accent-foreground: 0 0% 9% (very dark)
      const accentForeground = hslToRgb(...parseHsl(accentForegroundMatch![1]));

      const ratio = getContrastRatio(accent, accentForeground);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    test('secondary text on secondary background meets 4.5:1', () => {
      const cssContent = readFileSync(cssPath, 'utf-8');

      const secondaryMatch = cssContent.match(/--secondary:\s*([^;]+);/);
      const secondaryForegroundMatch = cssContent.match(/--secondary-foreground:\s*([^;]+);/);

      expect(secondaryMatch).toBeTruthy();
      expect(secondaryForegroundMatch).toBeTruthy();

      // secondary: 0 0% 96.1% (very light gray)
      const secondary = hslToRgb(...parseHsl(secondaryMatch![1]));
      // secondary-foreground: 0 0% 9% (very dark)
      const secondaryForeground = hslToRgb(...parseHsl(secondaryForegroundMatch![1]));

      const ratio = getContrastRatio(secondary, secondaryForeground);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    test('destructive text on destructive background meets 4.5:1', () => {
      const cssContent = readFileSync(cssPath, 'utf-8');

      const destructiveMatch = cssContent.match(/--destructive:\s*([^;]+);/);
      const destructiveForegroundMatch = cssContent.match(/--destructive-foreground:\s*([^;]+);/);

      expect(destructiveMatch).toBeTruthy();
      expect(destructiveForegroundMatch).toBeTruthy();

      // destructive: 0 84.2% 60.2% (red)
      const destructive = hslToRgb(...parseHsl(destructiveMatch![1]));
      // destructive-foreground: 0 0% 98% (almost white)
      const destructiveForeground = hslToRgb(...parseHsl(destructiveForegroundMatch![1]));

      const ratio = getContrastRatio(destructive, destructiveForeground);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe('Dark mode contrast ratios', () => {
    test('primary text on background meets 4.5:1', () => {
      const cssContent = readFileSync(cssPath, 'utf-8');

      // Extract dark mode colors
      const darkSection = cssContent.match(/\.dark\s*\{([^}]+)\}/s);
      expect(darkSection).toBeTruthy();

      const darkContent = darkSection![1];
      const foregroundMatch = darkContent.match(/--foreground:\s*([^;]+);/);
      const backgroundMatch = darkContent.match(/--background:\s*([^;]+);/);

      expect(foregroundMatch).toBeTruthy();
      expect(backgroundMatch).toBeTruthy();

      // foreground: 0 0% 98% (almost white)
      const foreground = hslToRgb(...parseHsl(foregroundMatch![1]));
      // background: 0 0% 3.9% (very dark)
      const background = hslToRgb(...parseHsl(backgroundMatch![1]));

      const ratio = getContrastRatio(foreground, background);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    test('muted text on background meets 4.5:1', () => {
      const cssContent = readFileSync(cssPath, 'utf-8');

      const darkSection = cssContent.match(/\.dark\s*\{([^}]+)\}/s);
      expect(darkSection).toBeTruthy();

      const darkContent = darkSection![1];
      const mutedForegroundMatch = darkContent.match(/--muted-foreground:\s*([^;]+);/);
      const backgroundMatch = darkContent.match(/--background:\s*([^;]+);/);

      expect(mutedForegroundMatch).toBeTruthy();
      expect(backgroundMatch).toBeTruthy();

      // muted-foreground: 0 0% 63.9%
      const mutedForeground = hslToRgb(...parseHsl(mutedForegroundMatch![1]));
      // background: 0 0% 3.9%
      const background = hslToRgb(...parseHsl(backgroundMatch![1]));

      const ratio = getContrastRatio(mutedForeground, background);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    test('primary button text on primary background meets 4.5:1', () => {
      const cssContent = readFileSync(cssPath, 'utf-8');

      const darkSection = cssContent.match(/\.dark\s*\{([^}]+)\}/s);
      expect(darkSection).toBeTruthy();

      const darkContent = darkSection![1];
      const primaryMatch = darkContent.match(/--primary:\s*([^;]+);/);
      const primaryForegroundMatch = darkContent.match(/--primary-foreground:\s*([^;]+);/);

      expect(primaryMatch).toBeTruthy();
      expect(primaryForegroundMatch).toBeTruthy();

      // primary: 270 91% 65% (purple)
      const primary = hslToRgb(...parseHsl(primaryMatch![1]));
      // primary-foreground: 0 0% 98%
      const primaryForeground = hslToRgb(...parseHsl(primaryForegroundMatch![1]));

      const ratio = getContrastRatio(primary, primaryForeground);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    test('accent text on accent background meets 4.5:1', () => {
      const cssContent = readFileSync(cssPath, 'utf-8');

      const darkSection = cssContent.match(/\.dark\s*\{([^}]+)\}/s);
      expect(darkSection).toBeTruthy();

      const darkContent = darkSection![1];
      const accentMatch = darkContent.match(/--accent:\s*([^;]+);/);
      const accentForegroundMatch = darkContent.match(/--accent-foreground:\s*([^;]+);/);

      expect(accentMatch).toBeTruthy();
      expect(accentForegroundMatch).toBeTruthy();

      // accent: 191 100% 50%
      const accent = hslToRgb(...parseHsl(accentMatch![1]));
      // accent-foreground: 0 0% 98%
      const accentForeground = hslToRgb(...parseHsl(accentForegroundMatch![1]));

      const ratio = getContrastRatio(accent, accentForeground);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    test('secondary text on secondary background meets 4.5:1', () => {
      const cssContent = readFileSync(cssPath, 'utf-8');

      const darkSection = cssContent.match(/\.dark\s*\{([^}]+)\}/s);
      expect(darkSection).toBeTruthy();

      const darkContent = darkSection![1];
      const secondaryMatch = darkContent.match(/--secondary:\s*([^;]+);/);
      const secondaryForegroundMatch = darkContent.match(/--secondary-foreground:\s*([^;]+);/);

      expect(secondaryMatch).toBeTruthy();
      expect(secondaryForegroundMatch).toBeTruthy();

      // secondary: 0 0% 14.9%
      const secondary = hslToRgb(...parseHsl(secondaryMatch![1]));
      // secondary-foreground: 0 0% 98%
      const secondaryForeground = hslToRgb(...parseHsl(secondaryForegroundMatch![1]));

      const ratio = getContrastRatio(secondary, secondaryForeground);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe('UI component contrast (3:1 minimum)', () => {
    test('border on background meets 3:1', () => {
      const cssContent = readFileSync(cssPath, 'utf-8');

      const borderMatch = cssContent.match(/--border:\s*([^;]+);/);
      const backgroundMatch = cssContent.match(/--background:\s*([^;]+);/);

      expect(borderMatch).toBeTruthy();
      expect(backgroundMatch).toBeTruthy();

      // border: 0 0% 89.8%
      const border = hslToRgb(...parseHsl(borderMatch![1]));
      // background: 0 0% 100%
      const background = hslToRgb(...parseHsl(backgroundMatch![1]));

      const ratio = getContrastRatio(border, background);
      expect(ratio).toBeGreaterThanOrEqual(3.0);
    });

    test('input border on background meets 3:1', () => {
      const cssContent = readFileSync(cssPath, 'utf-8');

      const inputMatch = cssContent.match(/--input:\s*([^;]+);/);
      const backgroundMatch = cssContent.match(/--background:\s*([^;]+);/);

      expect(inputMatch).toBeTruthy();
      expect(backgroundMatch).toBeTruthy();

      // input: 0 0% 89.8%
      const input = hslToRgb(...parseHsl(inputMatch![1]));
      // background: 0 0% 100%
      const background = hslToRgb(...parseHsl(backgroundMatch![1]));

      const ratio = getContrastRatio(input, background);
      expect(ratio).toBeGreaterThanOrEqual(3.0);
    });
  });

  test('documentation for color contrast is available', () => {
    const docsPath = join(process.cwd(), 'docs', 'ACCESSIBILITY.md');
    const docs = readFileSync(docsPath, 'utf-8');

    // Should document color contrast requirements
    expect(docs).toMatch(/contrast/i);
    expect(docs).toMatch(/4\.5:1|4.5:1/);
    expect(docs).toMatch(/3:1|3\.0:1/);
  });
});
