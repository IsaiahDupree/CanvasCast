/**
 * Test Render Script for FOUND-005
 *
 * This script tests that the Remotion composition can be rendered programmatically.
 * Acceptance criteria: Composition renders test video
 */

import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const OUTPUT_DIR = join(__dirname, '../../../out');

async function testRender() {
  console.log('🎬 Starting Remotion test render...');

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const entryPoint = join(__dirname, 'index.ts');
  const bundleLocation = join(__dirname, '../remotion-bundle');
  const outputLocation = join(OUTPUT_DIR, 'test-video.mp4');

  try {
    // Step 1: Bundle the composition
    console.log('📦 Bundling Remotion composition...');
    await bundle({
      entryPoint,
      outDir: bundleLocation,
    });
    console.log('✅ Bundle created successfully');

    // Step 2: Select the composition
    console.log('🎯 Selecting composition...');
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'CanvasCastVideo',
    });
    console.log(`✅ Composition selected: ${composition.id}`);
    console.log(`   - Duration: ${composition.durationInFrames} frames`);
    console.log(`   - FPS: ${composition.fps}`);
    console.log(`   - Resolution: ${composition.width}x${composition.height}`);

    // Step 3: Render the video
    console.log('🎥 Rendering video...');
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation,
      verbose: true,
    });

    console.log('✅ Test render complete!');
    console.log(`📹 Video saved to: ${outputLocation}`);
    console.log('\n✨ FOUND-005 acceptance criteria met: Composition renders test video ✅');

    return true;
  } catch (error) {
    console.error('❌ Test render failed:', error);
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  testRender()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { testRender };
