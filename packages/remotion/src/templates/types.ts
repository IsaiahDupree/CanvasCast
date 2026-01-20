/**
 * Template variant types for different visual styles
 */

import type { NichePresetId } from '@canvascast/shared';
import type { TimelineThemeType } from '@canvascast/shared';

export interface CaptionStyleConfig {
  enabled: boolean;
  position: 'top' | 'center' | 'bottom';
  maxWidthPct: number;
  fontSize: number;
  lineHeight: number;
  textColor: string;
  strokeColor: string;
  strokeWidth: number;
  bgColor: string;
  bgPadding: number;
  borderRadius: number;
}

export interface TemplateVariant {
  id: string;
  name: string;
  description: string;
  nicheId: NichePresetId;
  theme: TimelineThemeType;
  captionStyle: CaptionStyleConfig;
  previewThumbnail: string;
  isDefault?: boolean;
  tags?: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  // Animation preferences
  transitionStyle?: 'fade' | 'cut' | 'slide';
  zoomIntensity?: 'subtle' | 'moderate' | 'dramatic';
}
