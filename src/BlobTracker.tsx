import { useRef, useCallback } from "react";
import { useBlobTracker, type UseBlobTrackerOptions, type FrameLayout } from "./useBlobTracker";
import { toRGBAString, type RGBA } from "./lib/color";
import type { FrameResult } from "./lib/processFrame";

export interface BlobTrackerProps extends Omit<UseBlobTrackerOptions, "onFrame"> {
  /** Video source URL */
  src: string;
  /** Show contour edge lines. Default: true */
  showEdges?: boolean;
  /** Show blob bounding boxes with centroid labels. Default: true */
  showBlobs?: boolean;
  /** Edge line color. Default: { r: 179, g: 162, b: 255, a: 1 } */
  edgeColor?: RGBA;
  /** Edge line width in pixels. Default: 2 */
  edgeWidth?: number;
  /** Blob bounding box color. Default: { r: 0, g: 255, b: 255, a: 1 } */
  blobColor?: RGBA;
  /** Blob bounding box line width in pixels. Default: 2 */
  blobWidth?: number;
  /** Show coordinate labels on blobs. Default: true */
  showLabels?: boolean;
  /** Font for coordinate labels. Default: "12px monospace" */
  labelFont?: string;
  /** Label text color. Default: { r: 0, g: 255, b: 255, a: 1 } */
  labelColor?: RGBA;
  /** CSS style for the container div */
  style?: React.CSSProperties;
}

const DEFAULT_EDGE_COLOR: RGBA = { r: 179, g: 162, b: 255, a: 1 };
const DEFAULT_BLOB_COLOR: RGBA = { r: 0, g: 255, b: 255, a: 1 };
const DEFAULT_LABEL_COLOR: RGBA = { r: 0, g: 255, b: 255, a: 1 };

/** Drop-in component: renders video with contour edges and blob bounding boxes overlaid. */
export function BlobTracker({
  src,
  showEdges = true,
  showBlobs = true,
  edgeColor = DEFAULT_EDGE_COLOR,
  edgeWidth = 2,
  blobColor = DEFAULT_BLOB_COLOR,
  blobWidth = 2,
  showLabels = true,
  labelFont = "12px monospace",
  labelColor = DEFAULT_LABEL_COLOR,
  style,
  resolution,
  threshold,
  minBlobArea,
}: BlobTrackerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const propsRef = useRef({ showEdges, showBlobs, edgeColor, edgeWidth, blobColor, blobWidth, showLabels, labelFont, labelColor });
  propsRef.current = { showEdges, showBlobs, edgeColor, edgeWidth, blobColor, blobWidth, showLabels, labelFont, labelColor };

  const onFrame = useCallback((ctx: CanvasRenderingContext2D, result: FrameResult, layout: FrameLayout) => {
    const { contours, blobs } = result;
    const { offsetX, offsetY, scaleX, scaleY } = layout;
    const props = propsRef.current;

    // Contour edges — chain segments by nearest endpoint for a continuous stroke
    if (props.showEdges) {
      const segments = contours.filter(c => c.points.length >= 2).map(c => c.points);

      if (segments.length > 0) {
        const used = new Uint8Array(segments.length);
        used[0] = 1;
        const ordered = [segments[0]];

        for (let n = 1; n < segments.length; n++) {
          const last = ordered[ordered.length - 1];
          const end = last[last.length - 1];
          let bestDist = Infinity;
          let bestIdx = -1;
          let bestReverse = false;

          for (let j = 0; j < segments.length; j++) {
            if (used[j]) continue;
            const c = segments[j];
            const ds = (c[0].x - end.x) ** 2 + (c[0].y - end.y) ** 2;
            const de = (c[c.length - 1].x - end.x) ** 2 + (c[c.length - 1].y - end.y) ** 2;
            const d = Math.min(ds, de);
            if (d < bestDist) {
              bestDist = d;
              bestIdx = j;
              bestReverse = de < ds;
            }
          }

          if (bestIdx !== -1) {
            used[bestIdx] = 1;
            ordered.push(bestReverse ? [...segments[bestIdx]].reverse() : segments[bestIdx]);
          }
        }

        const allPts = ordered.flat();
        const jitterSeed = allPts.length * 7.31;

        ctx.save();
        ctx.strokeStyle = toRGBAString(props.edgeColor);
        ctx.lineWidth = props.edgeWidth;
        ctx.beginPath();
        ctx.moveTo(offsetX + allPts[0].x * scaleX, offsetY + allPts[0].y * scaleY);
        for (let i = 1; i < allPts.length; i++) {
          const jx = Math.sin(i * 3.17 + jitterSeed) * 0.4;
          const jy = Math.cos(i * 2.73 + jitterSeed) * 0.4;
          ctx.lineTo(offsetX + allPts[i].x * scaleX + jx, offsetY + allPts[i].y * scaleY + jy);
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    // Bounding boxes
    if (props.showBlobs) {
      ctx.save();
      ctx.strokeStyle = toRGBAString(props.blobColor);
      ctx.lineWidth = props.blobWidth;

      if (props.showLabels) {
        ctx.font = props.labelFont;
        ctx.fillStyle = toRGBAString(props.labelColor);
        ctx.textAlign = "left";
      }

      for (const blob of blobs) {
        const bx = offsetX + blob.boundingBox.x * scaleX;
        const by = offsetY + blob.boundingBox.y * scaleY;
        const bw = blob.boundingBox.w * scaleX;
        const bh = blob.boundingBox.h * scaleY;
        ctx.strokeRect(bx, by, bw, bh);

        if (props.showLabels) {
          const cx = (offsetX + blob.centroid.x * scaleX).toFixed(1);
          const cy = (offsetY + blob.centroid.y * scaleY).toFixed(1);
          ctx.fillText(`${cx}, ${cy}`, bx + bw / 2, by + bh / 2 + 4);
        }
      }
      ctx.restore();
    }
  }, []);

  const { canvasRef } = useBlobTracker(videoRef, {
    resolution,
    threshold,
    minBlobArea,
    onFrame,
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "black",
        overflow: "hidden",
        position: "relative",
        ...style,
      }}
    >
      <video
        ref={videoRef}
        src={src}
        loop
        muted
        playsInline
        autoPlay
        style={{ display: "none" }}
      />
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
