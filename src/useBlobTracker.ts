import { useRef, useEffect } from "react";
import { processFrame, type FrameResult, type ProcessFrameOptions } from "./lib/processFrame";
import { extractContours } from "./lib/marchingSquares";
import { labelConnectedComponents } from "./lib/connectedComponents";
import { createGpuPipeline, type GpuPipeline } from "./lib/gpuPipeline";

export interface FrameLayout {
  dw: number;
  dh: number;
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
}

export interface UseBlobTrackerOptions extends ProcessFrameOptions {
  resolution?: number;
  onFrame?: (ctx: CanvasRenderingContext2D, result: FrameResult, layout: FrameLayout) => void;
}

/** Hook that runs blob tracking on a video element, returning a canvas ref. */
export function useBlobTracker(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  options?: UseBlobTrackerOptions
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onFrameRef = useRef(options?.onFrame);
  onFrameRef.current = options?.onFrame;

  const { resolution = 120, threshold, minBlobArea } = options ?? {};

  // Store in refs so slider changes don't restart the animation loop
  const thresholdRef = useRef(threshold);
  thresholdRef.current = threshold;
  const minBlobAreaRef = useRef(minBlobArea);
  minBlobAreaRef.current = minBlobArea;

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d")!;

    const syncCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    };
    syncCanvasSize();
    window.addEventListener("resize", syncCanvasSize);

    let animId = 0;
    let started = false;
    let gpu: GpuPipeline | null = null;

    // CPU fallback resources (only created if GPU unavailable)
    let logicCanvas: HTMLCanvasElement | null = null;
    let logicCtx: CanvasRenderingContext2D | null = null;
    let prevFrame: ImageData | null = null;

    const tryStart = () => {
      if (started) return;
      if (video.videoWidth === 0) return;
      started = true;

      const lh = resolution;
      const lw = Math.round(lh * (video.videoWidth / video.videoHeight)) || Math.round(lh * (16 / 9));

      gpu = createGpuPipeline(lw, lh);

      if (!gpu) {
        logicCanvas = document.createElement("canvas");
        logicCanvas.width = lw;
        logicCanvas.height = lh;
        logicCtx = logicCanvas.getContext("2d")!;
      }

      const render = () => {
        if (video.paused || video.ended) {
          animId = requestAnimationFrame(render);
          return;
        }

        const dw = canvas.width;
        const dh = canvas.height;

        // Letterbox
        const videoAspect = video.videoWidth / video.videoHeight;
        const canvasAspect = dw / dh;
        let drawW: number, drawH: number, offsetX: number, offsetY: number;
        if (videoAspect > canvasAspect) {
          drawW = dw;
          drawH = dw / videoAspect;
          offsetX = 0;
          offsetY = (dh - drawH) / 2;
        } else {
          drawH = dh;
          drawW = dh * videoAspect;
          offsetX = (dw - drawW) / 2;
          offsetY = 0;
        }

        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, dw, dh);
        ctx.drawImage(video, offsetX, offsetY, drawW, drawH);

        let result: FrameResult | null = null;

        if (gpu) {
          const mask = gpu.process(video, thresholdRef.current ?? 30);
          const contours = extractContours(mask);
          const blobs = labelConnectedComponents(mask, minBlobAreaRef.current);
          result = { contours, blobs, mask };
        } else {
          logicCtx!.drawImage(video, 0, 0, lw, lh);
          const currentFrame = logicCtx!.getImageData(0, 0, lw, lh);
          if (prevFrame) {
            result = processFrame(currentFrame, prevFrame, {
              threshold: thresholdRef.current,
              minBlobArea: minBlobAreaRef.current,
            });
          }
          prevFrame = currentFrame;
        }

        if (result) {
          const layout: FrameLayout = {
            dw, dh, offsetX, offsetY,
            scaleX: drawW / lw,
            scaleY: drawH / lh,
          };
          onFrameRef.current?.(ctx, result, layout);
        }

        animId = requestAnimationFrame(render);
      };

      render();
    };

    if (video.videoWidth > 0) {
      tryStart();
    }
    video.addEventListener("loadedmetadata", tryStart);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", syncCanvasSize);
      video.removeEventListener("loadedmetadata", tryStart);
      gpu?.dispose();
    };
  }, [videoRef, resolution]);

  return { canvasRef };
}
