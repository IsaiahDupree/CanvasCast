/**
 * Color Contrast Utilities
 *
 * Utilities for checking WCAG 2.1 AA color contrast compliance.
 * Reference: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
 */

/**
 * Convert HSL to RGB
 */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
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

/**
 * Calculate relative luminance according to WCAG definition
 * https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
export function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 * https://www.w3.org/WAI/GL/wiki/Contrast_ratio
 *
 * @param rgb1 - First color as [r, g, b] where each value is 0-255
 * @param rgb2 - Second color as [r, g, b] where each value is 0-255
 * @returns Contrast ratio (1-21)
 */
export function getContrastRatio(
  rgb1: [number, number, number],
  rgb2: [number, number, number]
): number {
  const lum1 = getLuminance(...rgb1);
  const lum2 = getLuminance(...rgb2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Parse HSL string like "270 91% 65%"
 */
export function parseHsl(hsl: string): [number, number, number] {
  const parts = hsl.trim().split(/\s+/);
  return [
    parseFloat(parts[0]),
    parseFloat(parts[1].replace('%', '')),
    parseFloat(parts[2].replace('%', '')),
  ];
}

/**
 * WCAG 2.1 AA Contrast Requirements
 */
export const WCAG_AA = {
  /** Minimum contrast for normal text (< 18pt or < 14pt bold) */
  NORMAL_TEXT: 4.5,
  /** Minimum contrast for large text (>= 18pt or >= 14pt bold) */
  LARGE_TEXT: 3.0,
  /** Minimum contrast for UI components and graphics */
  UI_COMPONENTS: 3.0,
} as const;

/**
 * WCAG 2.1 AAA Contrast Requirements (enhanced)
 */
export const WCAG_AAA = {
  /** Minimum contrast for normal text */
  NORMAL_TEXT: 7.0,
  /** Minimum contrast for large text */
  LARGE_TEXT: 4.5,
  /** Minimum contrast for UI components and graphics */
  UI_COMPONENTS: 3.0,
} as const;

/**
 * Check if contrast ratio meets WCAG AA requirements
 */
export function meetsWCAG_AA(ratio: number, isLargeText = false): boolean {
  const threshold = isLargeText ? WCAG_AA.LARGE_TEXT : WCAG_AA.NORMAL_TEXT;
  return ratio >= threshold;
}

/**
 * Check if contrast ratio meets WCAG AAA requirements
 */
export function meetsWCAG_AAA(ratio: number, isLargeText = false): boolean {
  const threshold = isLargeText ? WCAG_AAA.LARGE_TEXT : WCAG_AAA.NORMAL_TEXT;
  return ratio >= threshold;
}

/**
 * Get a human-readable grade for a contrast ratio
 */
export function getContrastGrade(ratio: number): 'Fail' | 'AA' | 'AA Large' | 'AAA' | 'AAA Large' {
  if (ratio >= WCAG_AAA.NORMAL_TEXT) return 'AAA';
  if (ratio >= WCAG_AA.NORMAL_TEXT) return 'AA';
  if (ratio >= WCAG_AAA.LARGE_TEXT) return 'AAA Large';
  if (ratio >= WCAG_AA.LARGE_TEXT) return 'AA Large';
  return 'Fail';
}

/**
 * Check contrast between two HSL colors
 *
 * @example
 * ```ts
 * const result = checkHslContrast('270 91% 55%', '0 0% 98%');
 * console.log(result.ratio); // 4.56
 * console.log(result.grade); // 'AA'
 * console.log(result.meetsAA); // true
 * ```
 */
export function checkHslContrast(hsl1: string, hsl2: string) {
  const rgb1 = hslToRgb(...parseHsl(hsl1));
  const rgb2 = hslToRgb(...parseHsl(hsl2));
  const ratio = getContrastRatio(rgb1, rgb2);
  const grade = getContrastGrade(ratio);

  return {
    ratio: Math.round(ratio * 100) / 100,
    grade,
    meetsAA: meetsWCAG_AA(ratio),
    meetsAAA: meetsWCAG_AAA(ratio),
    meetsAA_Large: meetsWCAG_AA(ratio, true),
    meetsAAA_Large: meetsWCAG_AAA(ratio, true),
  };
}
