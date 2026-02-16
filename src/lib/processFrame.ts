import { createMotionMask, morphOpen, type BinaryMask } from "./binaryMask";
import { extractContours, type Contour } from "./marchingSquares";
import { labelConnectedComponents, type Blob } from "./connectedComponents";

export interface ProcessFrameOptions {
  threshold?: number;
  minBlobArea?: number;
}

export interface FrameResult {
  contours: Contour[];
  blobs: Blob[];
  mask: BinaryMask;
}

/** Run the blob-tracking pipeline on two consecutive frames. Framework-agnostic. */
export function processFrame(
  current: ImageData,
  previous: ImageData,
  options?: ProcessFrameOptions
): FrameResult {
  const threshold = options?.threshold ?? 30;
  const minBlobArea = options?.minBlobArea ?? 15;

  let mask = createMotionMask(current, previous, threshold);
  mask = morphOpen(mask);

  const contours = extractContours(mask);
  const blobs = labelConnectedComponents(mask, minBlobArea);

  return { contours, blobs, mask };
}
