/**
 * Test that templates can be properly imported and used
 */

import { describe, it, expect } from 'vitest';
import { renderVideo } from '../src/render';
import { getTemplatesForNiche, getDefaultTemplate } from '../src/templates';

describe('Template Integration', () => {
  it('should export templates from render module', () => {
    expect(getTemplatesForNiche).toBeDefined();
    expect(typeof getTemplatesForNiche).toBe('function');
  });

  it('should be able to get default template for a niche', () => {
    const template = getDefaultTemplate('explainer');

    expect(template).toBeDefined();
    expect(template.isDefault).toBe(true);
    expect(template.nicheId).toBe('explainer');
  });

  it('should have valid theme that can be used in timeline', () => {
    const template = getDefaultTemplate('motivation');

    // Verify theme structure matches TimelineThemeType
    expect(template.theme.primary).toMatch(/^#[0-9A-F]{6}$/i);
    expect(template.theme.secondary).toMatch(/^#[0-9A-F]{6}$/i);
    expect(template.theme.accent).toMatch(/^#[0-9A-F]{6}$/i);
    expect(template.theme.text).toMatch(/^#[0-9A-F]{6}$/i);
    expect(typeof template.theme.fontFamily).toBe('string');
  });
});
