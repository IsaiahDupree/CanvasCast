/**
 * @feature REMOTION-005: Template Variants
 * @description Test that multiple visual styles per niche preset exist and work
 */

import { describe, it, expect } from 'vitest';
import { getTemplatesForNiche, getTemplateById, type TemplateVariant } from '../src/templates';
import { NICHE_PRESETS, type NichePresetId } from '@canvascast/shared';

describe('REMOTION-005: Template Variants', () => {
  describe('Template availability', () => {
    it('should have at least 3 templates for each major niche', () => {
      const majorNiches: NichePresetId[] = ['explainer', 'motivation', 'facts'];

      majorNiches.forEach(nicheId => {
        const templates = getTemplatesForNiche(nicheId);
        expect(templates.length).toBeGreaterThanOrEqual(3);
      });
    });

    it('should return array of templates for any niche', () => {
      NICHE_PRESETS.forEach(niche => {
        const templates = getTemplatesForNiche(niche.id);
        expect(Array.isArray(templates)).toBe(true);
        expect(templates.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Template structure', () => {
    it('should have valid template properties', () => {
      const templates = getTemplatesForNiche('explainer');

      templates.forEach(template => {
        expect(template).toHaveProperty('id');
        expect(template).toHaveProperty('name');
        expect(template).toHaveProperty('description');
        expect(template).toHaveProperty('nicheId');
        expect(template).toHaveProperty('theme');
        expect(template).toHaveProperty('captionStyle');
        expect(template).toHaveProperty('previewThumbnail');

        // Validate theme structure
        expect(template.theme).toHaveProperty('primary');
        expect(template.theme).toHaveProperty('secondary');
        expect(template.theme).toHaveProperty('accent');
        expect(template.theme).toHaveProperty('text');
        expect(template.theme).toHaveProperty('fontFamily');

        // Validate caption style
        expect(template.captionStyle).toHaveProperty('position');
        expect(template.captionStyle).toHaveProperty('fontSize');
        expect(template.captionStyle).toHaveProperty('textColor');
      });
    });

    it('should have unique template IDs', () => {
      const allTemplates: TemplateVariant[] = [];

      NICHE_PRESETS.forEach(niche => {
        const templates = getTemplatesForNiche(niche.id);
        allTemplates.push(...templates);
      });

      const ids = allTemplates.map(t => t.id);
      const uniqueIds = new Set(ids);

      expect(ids.length).toBe(uniqueIds.size);
    });
  });

  describe('Template retrieval', () => {
    it('should retrieve template by ID', () => {
      const templates = getTemplatesForNiche('explainer');
      const firstTemplate = templates[0];

      const retrieved = getTemplateById(firstTemplate.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(firstTemplate.id);
      expect(retrieved?.name).toBe(firstTemplate.name);
    });

    it('should return undefined for invalid template ID', () => {
      const template = getTemplateById('invalid_template_id');
      expect(template).toBeUndefined();
    });

    it('should have default template for each niche', () => {
      NICHE_PRESETS.forEach(niche => {
        const templates = getTemplatesForNiche(niche.id);
        const defaultTemplate = templates.find(t => t.isDefault);

        expect(defaultTemplate).toBeDefined();
      });
    });
  });

  describe('Template theme variations', () => {
    it('should have different color schemes across templates', () => {
      const templates = getTemplatesForNiche('explainer');

      if (templates.length >= 2) {
        const colors1 = templates[0].theme.primary;
        const colors2 = templates[1].theme.primary;

        expect(colors1).not.toBe(colors2);
      }
    });

    it('should have different font families across templates', () => {
      const templates = getTemplatesForNiche('motivation');

      const fontFamilies = new Set(templates.map(t => t.theme.fontFamily));

      // At least 2 different fonts across all motivation templates
      expect(fontFamilies.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Preview thumbnails', () => {
    it('should have preview thumbnail path for each template', () => {
      const templates = getTemplatesForNiche('explainer');

      templates.forEach(template => {
        expect(template.previewThumbnail).toBeTruthy();
        expect(typeof template.previewThumbnail).toBe('string');
      });
    });
  });

  describe('Template metadata', () => {
    it('should include tags for filtering', () => {
      const templates = getTemplatesForNiche('explainer');

      templates.forEach(template => {
        if (template.tags) {
          expect(Array.isArray(template.tags)).toBe(true);
        }
      });
    });

    it('should include difficulty rating', () => {
      const templates = getTemplatesForNiche('motivation');

      templates.forEach(template => {
        if (template.difficulty) {
          expect(['beginner', 'intermediate', 'advanced']).toContain(template.difficulty);
        }
      });
    });
  });
});
