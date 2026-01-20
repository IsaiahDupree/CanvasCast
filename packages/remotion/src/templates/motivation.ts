/**
 * Motivation template variants - Inspirational content styles
 */

import type { TemplateVariant } from './types';

export const motivationTemplates: TemplateVariant[] = [
  {
    id: 'motivation_sunrise',
    name: 'Sunrise Inspiration',
    description: 'Warm, uplifting colors that energize and motivate',
    nicheId: 'motivation',
    isDefault: true,
    theme: {
      primary: '#F97316', // Orange 500
      secondary: '#FBBF24', // Amber 400
      accent: '#FB923C', // Orange 400
      text: '#18181B', // Zinc 900
      fontFamily: 'Montserrat, sans-serif',
    },
    captionStyle: {
      enabled: true,
      position: 'center',
      maxWidthPct: 0.85,
      fontSize: 52,
      lineHeight: 1.2,
      textColor: '#FFFFFF',
      strokeColor: '#000000',
      strokeWidth: 5,
      bgColor: 'rgba(0, 0, 0, 0.3)',
      bgPadding: 24,
      borderRadius: 20,
    },
    previewThumbnail: '/templates/previews/motivation_sunrise.jpg',
    tags: ['warm', 'energetic', 'positive'],
    difficulty: 'beginner',
    transitionStyle: 'fade',
    zoomIntensity: 'dramatic',
  },
  {
    id: 'motivation_bold',
    name: 'Bold Impact',
    description: 'High-contrast design that commands attention',
    nicheId: 'motivation',
    theme: {
      primary: '#DC2626', // Red 600
      secondary: '#991B1B', // Red 800
      accent: '#EF4444', // Red 500
      text: '#0F0F0F', // Near black
      fontFamily: 'Oswald, sans-serif',
    },
    captionStyle: {
      enabled: true,
      position: 'center',
      maxWidthPct: 0.9,
      fontSize: 56,
      lineHeight: 1.15,
      textColor: '#FFEDD5',
      strokeColor: '#450A0A',
      strokeWidth: 6,
      bgColor: 'rgba(15, 15, 15, 0.7)',
      bgPadding: 28,
      borderRadius: 24,
    },
    previewThumbnail: '/templates/previews/motivation_bold.jpg',
    tags: ['bold', 'powerful', 'dramatic'],
    difficulty: 'intermediate',
    transitionStyle: 'cut',
    zoomIntensity: 'dramatic',
  },
  {
    id: 'motivation_serene',
    name: 'Serene Calm',
    description: 'Peaceful design with gentle colors for mindful motivation',
    nicheId: 'motivation',
    theme: {
      primary: '#10B981', // Emerald 500
      secondary: '#059669', // Emerald 600
      accent: '#34D399', // Emerald 400
      text: '#064E3B', // Emerald 900
      fontFamily: 'Lato, sans-serif',
    },
    captionStyle: {
      enabled: true,
      position: 'bottom',
      maxWidthPct: 0.88,
      fontSize: 46,
      lineHeight: 1.22,
      textColor: '#F0FDF4',
      strokeColor: '#064E3B',
      strokeWidth: 3,
      bgColor: 'rgba(6, 78, 59, 0.65)',
      bgPadding: 20,
      borderRadius: 16,
    },
    previewThumbnail: '/templates/previews/motivation_serene.jpg',
    tags: ['calm', 'peaceful', 'mindful'],
    difficulty: 'beginner',
    transitionStyle: 'fade',
    zoomIntensity: 'subtle',
  },
  {
    id: 'motivation_gradient',
    name: 'Gradient Flow',
    description: 'Modern gradient aesthetic with smooth transitions',
    nicheId: 'motivation',
    theme: {
      primary: '#8B5CF6', // Violet 500
      secondary: '#EC4899', // Pink 500
      accent: '#A78BFA', // Violet 400
      text: '#312E81', // Violet 900
      fontFamily: 'Raleway, sans-serif',
    },
    captionStyle: {
      enabled: true,
      position: 'center',
      maxWidthPct: 0.84,
      fontSize: 50,
      lineHeight: 1.18,
      textColor: '#FDFEFF',
      strokeColor: '#312E81',
      strokeWidth: 4,
      bgColor: 'rgba(139, 92, 246, 0.45)',
      bgPadding: 26,
      borderRadius: 22,
    },
    previewThumbnail: '/templates/previews/motivation_gradient.jpg',
    tags: ['modern', 'gradient', 'colorful'],
    difficulty: 'intermediate',
    transitionStyle: 'fade',
    zoomIntensity: 'moderate',
  },
];
