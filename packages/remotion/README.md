# @canvascast/remotion

Remotion video composition package for CanvasCast.

## Feature: FOUND-005 - Remotion Package Setup

This package provides the video composition and rendering capabilities for CanvasCast, transforming timeline data into fully rendered MP4 videos.

## Acceptance Criteria ✅

1. **Remotion preview works** - Run `pnpm dev` to start the Remotion Studio
2. **Composition renders test video** - Run `pnpm build` or `pnpm test:render`

## Installation

From the root directory:

```bash
pnpm install
```

## Development

### Start Remotion Studio (Preview)

```bash
# From root
pnpm dev:remotion

# Or from this package
pnpm dev
```

This will open the Remotion Studio in your browser at `http://localhost:3000`, where you can:
- Preview the video composition
- Adjust timeline parameters
- Test different segment configurations
- Export test videos

### Build/Render Video

```bash
# Render the default composition
pnpm build

# Or use the test render script
pnpm test:render
```

## Package Structure

```
packages/remotion/
├── src/
│   ├── index.ts                       # Entry point (registers Root)
│   ├── Root.tsx                       # Remotion root with Composition definitions
│   ├── compositions/
│   │   └── CanvasCastVideo.tsx       # Main video composition component
│   └── test-render.ts                # Programmatic test render script
├── package.json
├── tsconfig.json
└── README.md (this file)
```

## Composition

### CanvasCastVideo

The main composition that renders a complete video from timeline data.

**Props:**
```typescript
interface Props {
  timeline: TimelineV1;
}
```

**Timeline Structure:**
```typescript
interface TimelineV1 {
  version: 1;
  fps: number;
  width: number;
  height: number;
  durationFrames: number;
  theme: TimelineThemeType;
  tracks: TimelineTrackType[];
  captions: TimelineCaptionsType;
  segments: TimelineSegmentType[];
}
```

### Features

- ✅ Audio track synchronization
- ✅ Image/video segments with Ken Burns effects
- ✅ Animated captions with word-level highlighting
- ✅ Smooth transitions between scenes
- ✅ Theme-based styling
- ✅ Support for overlays and text

## Usage in Worker

The worker pipeline uses this package to render videos:

```typescript
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

// 1. Bundle the composition
const bundleLocation = await bundle({
  entryPoint: require.resolve('@canvascast/remotion'),
  outDir: './remotion-bundle',
});

// 2. Select composition with timeline data
const composition = await selectComposition({
  serveUrl: bundleLocation,
  id: 'CanvasCastVideo',
  inputProps: { timeline: myTimelineData },
});

// 3. Render to MP4
await renderMedia({
  composition,
  serveUrl: bundleLocation,
  codec: 'h264',
  outputLocation: './output/video.mp4',
});
```

## Testing

Run the automated tests:

```bash
# From root
pnpm test __tests__/foundation/remotion-setup.test.ts
```

## Output Specifications

| Property | Value |
|----------|-------|
| Container | MP4 |
| Video Codec | H.264 |
| Resolution | 1920x1080 (16:9) or 1080x1920 (9:16) |
| Frame Rate | 30 fps |
| Bitrate | 8 Mbps |

## Integration with Shared Package

This package depends on `@canvascast/shared` for:
- `TimelineV1` type definition
- `TimelineContractV1` Zod schema for validation
- Segment, theme, and caption types

## Dependencies

- **remotion** - Core Remotion library
- **@remotion/bundler** - Bundles the composition
- **@remotion/cli** - CLI tools for preview and rendering
- **@remotion/renderer** - Programmatic rendering API
- **react** & **react-dom** - Required by Remotion
- **@canvascast/shared** - Shared types and schemas

## Related PRDs

- [08-video-rendering.md](../../docs/prds/08-video-rendering.md) - Detailed PRD for video rendering
- [16-shared-packages.md](../../docs/prds/16-shared-packages.md) - Shared package documentation

## Troubleshooting

### Preview doesn't start

Make sure Remotion dependencies are installed:
```bash
pnpm install
```

### Render fails

Check that:
1. Timeline data is valid (`TimelineContractV1.parse()` should pass)
2. All image/audio URLs are accessible
3. Chromium dependencies are installed (for Docker/CI environments)

### Performance issues

For faster rendering:
- Reduce concurrency: `--concurrency=1`
- Lower quality: `--quality=50`
- Disable pixel format conversion: `--pixel-format=yuv420p`

## License

Private - CanvasCast Project
