/**
 * Remotion Render Entry Point
 *
 * This module provides a programmatic interface for rendering videos
 * using Remotion from the worker pipeline. It bundles the composition,
 * selects it, and renders the final MP4 output.
 *
 * Feature: REMOTION-004
 * Acceptance criteria:
 * - Called from worker
 * - Returns output path
 */

import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { join } from 'path';
import type { TimelineV1 } from '@canvascast/shared';

/**
 * Options for video rendering
 */
export interface RenderOptions {
  codec?: 'h264' | 'h265' | 'vp8' | 'vp9';
  crf?: number;
  concurrency?: number;
  verbose?: boolean;
  chromiumOptions?: {
    enableMultiProcessOnLinux?: boolean;
    disableWebSecurity?: boolean;
  };
}

/**
 * Result of video rendering
 */
export interface RenderResult {
  outputPath: string;
  videoPath: string;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
}

/**
 * Render a video using Remotion
 *
 * @param timeline - The timeline data for the video composition
 * @param outputPath - The path where the video should be saved
 * @param options - Optional rendering configuration
 * @returns Promise resolving to render result with output path
 *
 * @example
 * ```ts
 * const result = await renderVideo(timeline, '/tmp/output.mp4', {
 *   codec: 'h264',
 *   crf: 18,
 *   concurrency: 2
 * });
 * console.log('Video saved to:', result.outputPath);
 * ```
 */
export async function renderVideo(
  timeline: TimelineV1,
  outputPath: string,
  options: RenderOptions = {}
): Promise<RenderResult> {
  try {
    // Default options
    const {
      codec = 'h264',
      crf = 18,
      concurrency = 2,
      verbose = false,
      chromiumOptions = {
        enableMultiProcessOnLinux: true,
      },
    } = options;

    // Get the entry point for Remotion composition
    const entryPoint = join(__dirname, 'index.ts');
    const bundleLocation = join(__dirname, '../.remotion-bundle');

    if (verbose) {
      console.log('[Remotion] Starting render process...');
      console.log('[Remotion] Entry point:', entryPoint);
      console.log('[Remotion] Bundle location:', bundleLocation);
    }

    // Step 1: Bundle the composition
    if (verbose) {
      console.log('[Remotion] Bundling composition...');
    }

    await bundle({
      entryPoint,
      outDir: bundleLocation,
    });

    if (verbose) {
      console.log('[Remotion] Bundle complete');
    }

    // Step 2: Select the composition
    if (verbose) {
      console.log('[Remotion] Selecting CanvasCastVideo composition...');
    }

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'CanvasCastVideo',
      inputProps: {
        timeline,
      },
    });

    if (verbose) {
      console.log('[Remotion] Composition selected:', composition.id);
      console.log('[Remotion] Duration:', composition.durationInFrames, 'frames');
      console.log('[Remotion] FPS:', composition.fps);
      console.log('[Remotion] Resolution:', `${composition.width}x${composition.height}`);
    }

    // Step 3: Render the video
    if (verbose) {
      console.log('[Remotion] Rendering video to:', outputPath);
    }

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec,
      crf,
      concurrency,
      outputLocation: outputPath,
      inputProps: {
        timeline,
      },
      chromiumOptions,
      verbose,
    });

    if (verbose) {
      console.log('[Remotion] Render complete!');
    }

    // Return result
    return {
      outputPath,
      videoPath: outputPath,
      durationInFrames: composition.durationInFrames,
      fps: composition.fps,
      width: composition.width,
      height: composition.height,
    };
  } catch (error) {
    // Handle errors and re-throw with context
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to render video: ${errorMessage}`);
  }
}
