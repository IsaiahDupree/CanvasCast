import React from "react";

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface CaptionWord {
  word: string;
  start: number;
  end: number;
}

export interface CaptionStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  activeColor: string;
  backgroundColor: string;
  padding: string;
  position: 'top' | 'center' | 'bottom';
  animation?: 'highlight' | 'typewriter' | 'bounce';
}

export interface CaptionProps {
  words: CaptionWord[];
  style: CaptionStyle;
  currentFrame: number;
  fps: number;
}

// ============================================
// CAPTION PRESETS
// ============================================

export const CAPTION_PRESETS: Record<string, CaptionStyle> = {
  motivation: {
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 48,
    color: '#ffffff',
    activeColor: '#ffcc00',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: '12px 24px',
    position: 'bottom',
    animation: 'highlight',
  },
  explainer: {
    fontFamily: 'Inter, sans-serif',
    fontSize: 42,
    color: '#ffffff',
    activeColor: '#00d4ff',
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: '8px 16px',
    position: 'bottom',
    animation: 'typewriter',
  },
  facts: {
    fontFamily: 'Poppins, sans-serif',
    fontSize: 52,
    color: '#ffffff',
    activeColor: '#ff6b6b',
    backgroundColor: 'transparent',
    padding: '0',
    position: 'center',
    animation: 'bounce',
  },
};

// ============================================
// CAPTION COMPONENT
// ============================================

export const Caption: React.FC<CaptionProps> = ({
  words,
  style,
  currentFrame,
  fps
}) => {
  const currentTime = currentFrame / fps;

  // Find active words
  const activeWords = words.filter(
    w => currentTime >= w.start && currentTime <= w.end
  );

  // Build display text with highlighting
  const displayWords = words.map(word => ({
    ...word,
    isActive: activeWords.some(aw => aw.word === word.word),
  }));

  // Container style based on position
  const captionContainerStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    ...(style.position === 'top' && { top: '60px' }),
    ...(style.position === 'center' && { top: '50%', transform: 'translateY(-50%)' }),
    ...(style.position === 'bottom' && { bottom: '60px' }),
  };

  const captionTextStyle: React.CSSProperties = {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    backgroundColor: style.backgroundColor,
    padding: style.padding,
    borderRadius: '8px',
    textAlign: 'center',
    maxWidth: '90%',
    lineHeight: 1.2,
  };

  return (
    <div style={captionContainerStyle}>
      <div style={captionTextStyle}>
        {displayWords.map((word, i) => (
          <span
            key={i}
            style={{
              color: word.isActive ? style.activeColor : style.color,
              fontWeight: word.isActive ? 'bold' : 'normal',
            }}
          >
            {word.word}{' '}
          </span>
        ))}
      </div>
    </div>
  );
};
