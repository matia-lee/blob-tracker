# blob-tracker

Real-time motion contour tracing and blob detection for React.

## Install

```bash
npm install blob-tracker
```

## `<BlobTracker />`

```tsx
import { BlobTracker } from "blob-tracker";

<BlobTracker src="/video.mp4" />
```

| Prop | Type | Default |
|------|------|---------|
| `src` | `string` | *required* |
| `threshold?` | `number` | `30` |
| `minBlobArea?` | `number` | `15` |
| `resolution?` | `number` | `120` |
| `showEdges?` | `boolean` | `true` |
| `showBlobs?` | `boolean` | `true` |
| `edgeColor?` | `RGBA` | `{ r: 255, g: 255, b: 255, a: 1 }` |
| `edgeWidth?` | `number` | `2` |
| `edgeStyle?` | `"solid" \| "dashed" \| "dotted"` | `"solid"` |
| `blobColor?` | `RGBA` | `{ r: 255, g: 255, b: 255, a: 1 }` |
| `blobWidth?` | `number` | `2` |
| `blobStyle?` | `"rect" \| "corners"` | `"rect"` |
| `cornerLength?` | `number` | `0.25` |
| `showLabels?` | `boolean` | `true` |
| `labelFont?` | `string` | `"12px monospace"` |
| `labelColor?` | `RGBA` | `{ r: 255, g: 255, b: 255, a: 1 }` |
| `style?` | `CSSProperties` | none |

## `useBlobTracker()`

```tsx
import { useRef } from "react";
import { useBlobTracker } from "blob-tracker";

const videoRef = useRef<HTMLVideoElement>(null);
const { canvasRef } = useBlobTracker(videoRef, {
  threshold: 30,
  onFrame: (ctx, { contours, blobs, mask }, layout) => {
    // draw overlays here
  },
});
```

Returns `{ canvasRef }`.

Options: same as component (`threshold?`, `minBlobArea?`, `resolution?`), plus `onFrame?` callback.

## `processFrame()`

Framework-agnostic. Works outside React.

```ts
import { processFrame } from "blob-tracker";

const { contours, blobs, mask } = processFrame(currentFrame, previousFrame, {
  threshold: 30,   // default: 30
  minBlobArea: 15,  // default: 15
});
```

## Types

```ts
interface RGBA { r: number; g: number; b: number; a: number }
interface Point { x: number; y: number }
interface Contour { points: Point[]; isClosed: boolean }
interface BoundingBox { x: number; y: number; w: number; h: number }
interface Blob { id: number; boundingBox: BoundingBox; centroid: Point; area: number }
interface BinaryMask { data: Uint8Array; width: number; height: number }
```

## License

MIT
