/**
 * Explainer template variants - Educational content styles
 */

import type { TemplateVariant } from './types';

export const explainerTemplates: TemplateVariant[] = [
  {
    id: 'explainer_clean',
    name: 'Clean Professional',
    description: 'Minimalist design with high contrast for clarity',
    nicheId: 'explainer',
    isDefault: true,
    theme: {
      primary: '#2563EB', // Blue 600
      secondary: '#1E40AF', // Blue 800
      accent: '#3B82F6', // Blue 500
      text: '#111827', // Gray 900
      fontFamily: 'Inter, sans-serif',
    },
    captionStyle: {
      enabled: true,
      position: 'bottom',
      maxWidthPct: 0.86,
      fontSize: 44,
      lineHeight: 1.15,
      textColor: '#FFFFFF',
      strokeColor: '#111827',
      strokeWidth: 3,
      bgColor: 'rgba(17, 24, 39, 0.85)',
      bgPadding: 16,
      borderRadius: 12,
    },
    previewThumbnail: '/templates/previews/explainer_clean.jpg',
    tags: ['professional', 'minimalist', 'clean'],
    difficulty: 'beginner',
    transitionStyle: 'fade',
    zoomIntensity: 'subtle',
  },
  {
    id: 'explainer_vibrant',
    name: 'Vibrant Energy',
    description: 'Bold colors and dynamic styling for engaging content',
    nicheId: 'explainer',
    theme: {
      primary: '#F59E0B', // Amber 500
      secondary: '#EF4444', // Red 500
      accent: '#FBBF24', // Amber 400
      text: '#1F2937', // Gray 800
      fontFamily: 'Poppins, sans-serif',
    },
    captionStyle: {
      enabled: true,
      position: 'bottom',
      maxWidthPct: 0.82,
      fontSize: 48,
      lineHeight: 1.2,
      textColor: '#FFF',
      strokeColor: '#000',
      strokeWidth: 4,
      bgColor: 'rgba(245, 158, 11, 0.95)',
      bgPadding: 20,
      borderRadius: 18,
    },
    previewThumbnail: '/templates/previews/explainer_vibrant.jpg',
    tags: ['bold', 'energetic', 'colorful'],
    difficulty: 'intermediate',
    transitionStyle: 'fade',
    zoomIntensity: 'moderate',
  },
  {
    id: 'explainer_tech',
    name: 'Tech Modern',
    description: 'Futuristic style perfect for technology content',
    nicheId: 'explainer',
    theme: {
      primary: '#06B6D4', // Cyan 500
      secondary: '#8B5CF6', // Violet 500
      accent: '#14B8A6', // Teal 500
      text: '#0F172A', // Slate 900
      fontFamily: 'Space Grotesk, monospace',
    },
    captionStyle: {
      enabled: true,
      position: 'bottom',
      maxWidthPct: 0.88,
      fontSize: 42,
      lineHeight: 1.18,
      textColor: '#E0F2FE',
      strokeColor: '#0C4A6E',
      strokeWidth: 2,
      bgColor: 'rgba(15, 23, 42, 0.75)',
      bgPadding: 18,
      borderRadius: 16,
    },
    previewThumbnail: '/templates/previews/explainer_tech.jpg',
    tags: ['modern', 'tech', 'futuristic'],
    difficulty: 'intermediate',
    transitionStyle: 'slide',
    zoomIntensity: 'moderate',
  },
  {
    id: 'explainer_academic',
    name: 'Academic Classic',
    description: 'Traditional educational style with serif fonts',
    nicheId: 'explainer',
    theme: {
      primary: '#4F46E5', // Indigo 600
      secondary: '#7C3AED', // Violet 600
      accent: '#6366F1', // Indigo 500
      text: '#1E293B', // Slate 800
      fontFamily: 'Merriweather, serif',
    },
    captionStyle: {
      enabled: true,
      position: 'bottom',
      maxWidthPct: 0.8,
      fontSize: 40,
      lineHeight: 1.25,
      textColor: '#FEFEFE',
      strokeColor: '#1E293B',
      strokeWidth: 2,
      bgColor: 'rgba(30, 41, 59, 0.88)',
      bgPadding: 22,
      borderRadius: 8,
    },
    previewThumbnail: '/templates/previews/explainer_academic.jpg',
    tags: ['classic', 'educational', 'traditional'],
    difficulty: 'beginner',
    transitionStyle: 'fade',
    zoomIntensity: 'subtle',
  },
];
