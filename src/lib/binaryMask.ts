export interface BinaryMask {
  data: Uint8Array;
  width: number;
  height: number;
}

/** Create a binary motion mask from two frames using max-channel difference. */
export function createMotionMask(
  current: ImageData,
  previous: ImageData,
  threshold: number = 30
): BinaryMask {
  const w = current.width;
  const h = current.height;
  const mask = new Uint8Array(w * h);
  const cd = current.data;
  const pd = previous.data;

  for (let i = 0, p = 0; i < cd.length; i += 4, p++) {
    const dr = Math.abs(cd[i] - pd[i]);
    const dg = Math.abs(cd[i + 1] - pd[i + 1]);
    const db = Math.abs(cd[i + 2] - pd[i + 2]);
    const maxDiff = Math.max(dr, dg, db);
    if (maxDiff > threshold) {
      mask[p] = 1;
    }
  }

  return { data: mask, width: w, height: h };
}

/** Erode: pixel survives only if all 4 cardinal neighbors are set. */
export function erodeMask(mask: BinaryMask): BinaryMask {
  const { data, width: w, height: h } = mask;
  const out = new Uint8Array(w * h);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (
        data[i] &&
        data[i - 1] &&
        data[i + 1] &&
        data[i - w] &&
        data[i + w]
      ) {
        out[i] = 1;
      }
    }
  }

  return { data: out, width: w, height: h };
}

/** Dilate: pixel set if any of its 4 cardinal neighbors is set. */
export function dilateMask(mask: BinaryMask): BinaryMask {
  const { data, width: w, height: h } = mask;
  const out = new Uint8Array(w * h);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (
        data[i] ||
        data[i - 1] ||
        data[i + 1] ||
        data[i - w] ||
        data[i + w]
      ) {
        out[i] = 1;
      }
    }
  }

  return { data: out, width: w, height: h };
}

/** Morphological open (erode → dilate). Removes noise specks. */
export function morphOpen(mask: BinaryMask): BinaryMask {
  return dilateMask(erodeMask(mask));
}
