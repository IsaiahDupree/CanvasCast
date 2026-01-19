import React from "react";
import { AbsoluteFill, Img, useCurrentFrame, interpolate } from "remotion";
import type { Motion, Transition } from "@canvascast/shared";

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface SceneProps {
  imageSrc: string;
  startFrame: number;
  endFrame: number;
  motion?: Motion;
  transition?: Transition;
  objectFit?: "cover" | "contain";
}

// ============================================
// SCENE COMPONENT
// ============================================

export const Scene: React.FC<SceneProps> = ({
  imageSrc,
  startFrame,
  endFrame,
  motion,
  transition,
  objectFit = "cover",
}) => {
  const currentFrame = useCurrentFrame();

  // Calculate local frame relative to segment start
  const localFrame = currentFrame - startFrame;

  // Calculate segment duration
  const duration = Math.max(1, endFrame - startFrame);

  // ============================================
  // KEN BURNS EFFECT (ZOOM/PAN)
  // ============================================

  const motionType = motion?.type ?? "none";
  const intensity = motion?.intensity ?? 0.3;

  let scale = 1;
  let translateX = 0;
  let translateY = 0;

  if (motionType === "ken-burns" || motionType === "zoom-in") {
    // Zoom from 1 to (1 + intensity * 0.2) - creates subtle zoom
    const maxZoom = 1 + intensity * 0.2;
    scale = interpolate(localFrame, [0, duration], [1, maxZoom], {
      extrapolateRight: "clamp",
    });
  } else if (motionType === "zoom-out") {
    // Zoom from (1 + intensity * 0.2) to 1
    const maxZoom = 1 + intensity * 0.2;
    scale = interpolate(localFrame, [0, duration], [maxZoom, 1], {
      extrapolateRight: "clamp",
    });
  } else if (motionType === "pan-left") {
    // Pan from right to left
    const panAmount = intensity * 10; // percentage
    translateX = interpolate(localFrame, [0, duration], [panAmount, -panAmount], {
      extrapolateRight: "clamp",
    });
  } else if (motionType === "pan-right") {
    // Pan from left to right
    const panAmount = intensity * 10; // percentage
    translateX = interpolate(localFrame, [0, duration], [-panAmount, panAmount], {
      extrapolateRight: "clamp",
    });
  } else if (motionType === "float") {
    // Gentle up and down float
    const floatAmount = intensity * 5; // percentage
    translateY = interpolate(localFrame, [0, duration], [0, -floatAmount], {
      extrapolateRight: "clamp",
    });
    // Add subtle zoom
    const maxZoom = 1 + intensity * 0.1;
    scale = interpolate(localFrame, [0, duration], [1, maxZoom], {
      extrapolateRight: "clamp",
    });
  }

  // ============================================
  // SMOOTH TRANSITIONS (FADE)
  // ============================================

  const transitionType = transition?.type ?? "none";
  const durationFrames = transition?.durationFrames ?? 0;

  let opacity = 1;

  if (transitionType === "fade" && durationFrames > 0) {
    // Fade in at the start of the segment
    opacity = interpolate(localFrame, [0, durationFrames], [0, 1], {
      extrapolateRight: "clamp",
    });
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <AbsoluteFill style={{ opacity }}>
      <Img
        src={imageSrc}
        style={{
          width: "100%",
          height: "100%",
          objectFit,
          transform: `scale(${scale}) translate(${translateX}%, ${translateY}%)`,
          transformOrigin: "center center",
        }}
      />
    </AbsoluteFill>
  );
};
