/**
 * Facts & Trivia template variants - Engaging info-based content styles
 */

import type { TemplateVariant } from './types';

export const factsTemplates: TemplateVariant[] = [
  {
    id: 'facts_playful',
    name: 'Playful Fun',
    description: 'Bright and fun design perfect for interesting facts',
    nicheId: 'facts',
    isDefault: true,
    theme: {
      primary: '#F59E0B', // Amber 500
      secondary: '#10B981', // Emerald 500
      accent: '#FBBF24', // Amber 400
      text: '#1C1917', // Stone 900
      fontFamily: 'Nunito, sans-serif',
    },
    captionStyle: {
      enabled: true,
      position: 'bottom',
      maxWidthPct: 0.9,
      fontSize: 48,
      lineHeight: 1.2,
      textColor: '#FEF3C7',
      strokeColor: '#451A03',
      strokeWidth: 4,
      bgColor: 'rgba(28, 25, 23, 0.8)',
      bgPadding: 20,
      borderRadius: 20,
    },
    previewThumbnail: '/templates/previews/facts_playful.jpg',
    tags: ['fun', 'playful', 'colorful'],
    difficulty: 'beginner',
    transitionStyle: 'fade',
    zoomIntensity: 'moderate',
  },
  {
    id: 'facts_newspaper',
    name: 'Newspaper Classic',
    description: 'Traditional news-style layout with authoritative feel',
    nicheId: 'facts',
    theme: {
      primary: '#374151', // Gray 700
      secondary: '#1F2937', // Gray 800
      accent: '#6B7280', // Gray 500
      text: '#111827', // Gray 900
      fontFamily: 'Georgia, serif',
    },
    captionStyle: {
      enabled: true,
      position: 'bottom',
      maxWidthPct: 0.85,
      fontSize: 42,
      lineHeight: 1.25,
      textColor: '#F9FAFB',
      strokeColor: '#111827',
      strokeWidth: 2,
      bgColor: 'rgba(17, 24, 39, 0.9)',
      bgPadding: 18,
      borderRadius: 8,
    },
    previewThumbnail: '/templates/previews/facts_newspaper.jpg',
    tags: ['classic', 'traditional', 'authoritative'],
    difficulty: 'beginner',
    transitionStyle: 'cut',
    zoomIntensity: 'subtle',
  },
  {
    id: 'facts_neon',
    name: 'Neon Pop',
    description: 'Eye-catching neon style for viral-ready content',
    nicheId: 'facts',
    theme: {
      primary: '#EC4899', // Pink 500
      secondary: '#8B5CF6', // Violet 500
      accent: '#F472B6', // Pink 400
      text: '#0F0F0F', // Near black
      fontFamily: 'Archivo Black, sans-serif',
    },
    captionStyle: {
      enabled: true,
      position: 'bottom',
      maxWidthPct: 0.92,
      fontSize: 50,
      lineHeight: 1.15,
      textColor: '#FCE7F3',
      strokeColor: '#831843',
      strokeWidth: 5,
      bgColor: 'rgba(15, 15, 15, 0.75)',
      bgPadding: 24,
      borderRadius: 24,
    },
    previewThumbnail: '/templates/previews/facts_neon.jpg',
    tags: ['neon', 'bold', 'viral'],
    difficulty: 'advanced',
    transitionStyle: 'cut',
    zoomIntensity: 'dramatic',
  },
  {
    id: 'facts_minimal',
    name: 'Minimal Clean',
    description: 'Ultra-minimal design letting facts speak for themselves',
    nicheId: 'facts',
    theme: {
      primary: '#0EA5E9', // Sky 500
      secondary: '#0284C7', // Sky 600
      accent: '#38BDF8', // Sky 400
      text: '#1E293B', // Slate 800
      fontFamily: 'Roboto, sans-serif',
    },
    captionStyle: {
      enabled: true,
      position: 'bottom',
      maxWidthPct: 0.88,
      fontSize: 44,
      lineHeight: 1.2,
      textColor: '#F8FAFC',
      strokeColor: '#0F172A',
      strokeWidth: 2,
      bgColor: 'rgba(30, 41, 59, 0.7)',
      bgPadding: 16,
      borderRadius: 12,
    },
    previewThumbnail: '/templates/previews/facts_minimal.jpg',
    tags: ['minimal', 'clean', 'modern'],
    difficulty: 'beginner',
    transitionStyle: 'fade',
    zoomIntensity: 'subtle',
  },
];
