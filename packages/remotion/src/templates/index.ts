/**
 * Template Variants System
 * Provides multiple visual styles for each niche preset
 */

import type { NichePresetId } from '@canvascast/shared';
import { explainerTemplates } from './explainer';
import { motivationTemplates } from './motivation';
import { factsTemplates } from './facts';
import { createDefaultTemplate } from './default';
import type { TemplateVariant } from './types';

export type { TemplateVariant, CaptionStyleConfig } from './types';

// Template registry
const templateRegistry: Record<NichePresetId, TemplateVariant[]> = {
  explainer: explainerTemplates,
  motivation: motivationTemplates,
  facts: factsTemplates,
  // Other niches get default templates
  history: [createDefaultTemplate('history')],
  science: [createDefaultTemplate('science')],
  finance: [createDefaultTemplate('finance')],
  tech: [createDefaultTemplate('tech')],
  storytelling: [createDefaultTemplate('storytelling')],
  true_crime: [createDefaultTemplate('true_crime')],
  documentary: [createDefaultTemplate('documentary')],
};

/**
 * Get all templates for a specific niche
 */
export function getTemplatesForNiche(nicheId: NichePresetId): TemplateVariant[] {
  return templateRegistry[nicheId] || [createDefaultTemplate(nicheId)];
}

/**
 * Get a specific template by ID
 */
export function getTemplateById(templateId: string): TemplateVariant | undefined {
  const allTemplates = Object.values(templateRegistry).flat();
  return allTemplates.find((t) => t.id === templateId);
}

/**
 * Get the default template for a niche
 */
export function getDefaultTemplate(nicheId: NichePresetId): TemplateVariant {
  const templates = getTemplatesForNiche(nicheId);
  return templates.find((t) => t.isDefault) || templates[0];
}

/**
 * Get all available templates across all niches
 */
export function getAllTemplates(): TemplateVariant[] {
  return Object.values(templateRegistry).flat();
}

/**
 * Search templates by tags
 */
export function searchTemplatesByTags(tags: string[]): TemplateVariant[] {
  const allTemplates = getAllTemplates();
  return allTemplates.filter((template) => {
    if (!template.tags) return false;
    return tags.some((tag) => template.tags!.includes(tag.toLowerCase()));
  });
}

/**
 * Get templates by difficulty
 */
export function getTemplatesByDifficulty(
  difficulty: 'beginner' | 'intermediate' | 'advanced'
): TemplateVariant[] {
  const allTemplates = getAllTemplates();
  return allTemplates.filter((t) => t.difficulty === difficulty);
}

// Re-export template collections for direct access
export { explainerTemplates, motivationTemplates, factsTemplates };
