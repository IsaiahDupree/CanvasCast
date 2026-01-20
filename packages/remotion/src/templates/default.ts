/**
 * Default template for niches without custom templates
 */

import type { TemplateVariant } from './types';
import type { NichePresetId } from '@canvascast/shared';

export function createDefaultTemplate(nicheId: NichePresetId): TemplateVariant {
  return {
    id: `${nicheId}_default`,
    name: 'Classic Style',
    description: 'Versatile template suitable for all content types',
    nicheId,
    isDefault: true,
    theme: {
      primary: '#2F2B4A',
      secondary: '#4B6B4D',
      accent: '#3E356C',
      text: '#111827',
      fontFamily: 'Inter, sans-serif',
    },
    captionStyle: {
      enabled: true,
      position: 'bottom',
      maxWidthPct: 0.86,
      fontSize: 44,
      lineHeight: 1.15,
      textColor: '#F7F7F7',
      strokeColor: '#111827',
      strokeWidth: 3,
      bgColor: 'rgba(17, 24, 39, 0.35)',
      bgPadding: 16,
      borderRadius: 18,
    },
    previewThumbnail: '/templates/previews/default.jpg',
    tags: ['default', 'versatile', 'classic'],
    difficulty: 'beginner',
    transitionStyle: 'fade',
    zoomIntensity: 'subtle',
  };
}
