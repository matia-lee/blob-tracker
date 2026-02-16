import type { BinaryMask } from "./binaryMask";

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Blob {
  id: number;
  boundingBox: BoundingBox;
  centroid: { x: number; y: number };
  area: number;
}

/** Flood-fill connected components, returning blobs above minArea. */
export function labelConnectedComponents(
  mask: BinaryMask,
  minArea: number = 15
): Blob[] {
  const { data, width: w, height: h } = mask;
  const labels = new Int32Array(w * h); // 0 = unlabeled
  let nextLabel = 1;
  const blobs: Blob[] = [];

  // 4-connected BFS neighbors
  const dx = [1, -1, 0, 0];
  const dy = [0, 0, 1, -1];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (data[idx] === 0 || labels[idx] !== 0) continue;

      const label = nextLabel++;
      const queue: number[] = [idx];
      labels[idx] = label;

      let minX = x, maxX = x, minY = y, maxY = y;
      let sumX = 0, sumY = 0, area = 0;

      let head = 0;
      while (head < queue.length) {
        const ci = queue[head++];
        const cx = ci % w;
        const cy = (ci - cx) / w;

        area++;
        sumX += cx;
        sumY += cy;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        for (let d = 0; d < 4; d++) {
          const nx = cx + dx[d];
          const ny = cy + dy[d];
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const ni = ny * w + nx;
          if (data[ni] === 1 && labels[ni] === 0) {
            labels[ni] = label;
            queue.push(ni);
          }
        }
      }

      if (area >= minArea) {
        blobs.push({
          id: blobs.length,
          boundingBox: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
          centroid: { x: sumX / area, y: sumY / area },
          area,
        });
      }
    }
  }

  return blobs;
}
