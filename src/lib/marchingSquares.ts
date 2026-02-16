import type { BinaryMask } from "./binaryMask";

export interface Point {
  x: number;
  y: number;
}

export interface Contour {
  points: Point[];
  isClosed: boolean;
}

/**
 * Marching squares contour extraction.
 * Walks cell-to-cell along boundaries in the binary mask,
 * returning ordered polylines tracing foreground edges.
 */
export function extractContours(mask: BinaryMask): Contour[] {
  const { data, width: w, height: h } = mask;
  const contours: Contour[] = [];

  // Cell grid is (w-1) x (h-1) — each cell is a 2x2 pixel block
  const cw = w - 1;
  const ch = h - 1;
  const visitedEdges = new Set<number>();

  const px = (x: number, y: number): number => {
    if (x < 0 || x >= w || y < 0 || y >= h) return 0;
    return data[y * w + x];
  };

  // 4-bit case from 2x2 block: TL(8) TR(4) BR(2) BL(1)
  const cellCase = (cx: number, cy: number): number => {
    return (
      (px(cx, cy) << 3) |
      (px(cx + 1, cy) << 2) |
      (px(cx + 1, cy + 1) << 1) |
      px(cx, cy + 1)
    );
  };

  // Edges: 0=top, 1=right, 2=bottom, 3=left
  const edgeMidpoint = (cx: number, cy: number, edge: number): Point => {
    switch (edge) {
      case 0: return { x: cx + 0.5, y: cy };
      case 1: return { x: cx + 1, y: cy + 0.5 };
      case 2: return { x: cx + 0.5, y: cy + 1 };
      case 3: return { x: cx, y: cy + 0.5 };
      default: return { x: cx + 0.5, y: cy + 0.5 };
    }
  };

  // Edge pairs per case. Saddle cases (5, 10) use default disambiguation.
  const edgePairs: number[][][] = [
    [],                  // 0
    [[2, 3]],            // 1: BL
    [[1, 2]],            // 2: BR
    [[1, 3]],            // 3: BL+BR
    [[0, 1]],            // 4: TR
    [[0, 3], [1, 2]],    // 5: TR+BL (saddle)
    [[0, 2]],            // 6: TR+BR
    [[0, 3]],            // 7: TR+BR+BL
    [[0, 3]],            // 8: TL
    [[0, 2]],            // 9: TL+BL
    [[0, 1], [2, 3]],    // 10: TL+BR (saddle)
    [[0, 1]],            // 11: TL+BL+BR
    [[1, 3]],            // 12: TL+TR
    [[1, 2]],            // 13: TL+TR+BL
    [[2, 3]],            // 14: TL+TR+BR
    [],                  // 15
  ];

  const oppositeEdge = [2, 3, 0, 1];

  const neighborCell = (cx: number, cy: number, edge: number): [number, number] => {
    switch (edge) {
      case 0: return [cx, cy - 1];
      case 1: return [cx + 1, cy];
      case 2: return [cx, cy + 1];
      case 3: return [cx - 1, cy];
      default: return [cx, cy];
    }
  };

  const edgeKey = (cx: number, cy: number, edge: number): number =>
    (cy * cw + cx) * 4 + edge;

  const findExit = (caseVal: number, entryEdge: number): number => {
    for (const pair of edgePairs[caseVal]) {
      if (pair[0] === entryEdge) return pair[1];
      if (pair[1] === entryEdge) return pair[0];
    }
    return -1;
  };

  for (let cy = 0; cy < ch; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      const c = cellCase(cx, cy);
      if (c === 0 || c === 15) continue;

      for (const pair of edgePairs[c]) {
        const startEdge = pair[0];
        if (visitedEdges.has(edgeKey(cx, cy, startEdge))) continue;

        const points: Point[] = [];
        let curCx = cx;
        let curCy = cy;
        let curEntry = startEdge;
        let isClosed = false;

        for (let step = 0; step < 50000; step++) {
          const curCase = cellCase(curCx, curCy);
          if (curCase === 0 || curCase === 15) break;

          const exitEdge = findExit(curCase, curEntry);
          if (exitEdge === -1) break;

          visitedEdges.add(edgeKey(curCx, curCy, curEntry));
          visitedEdges.add(edgeKey(curCx, curCy, exitEdge));
          points.push(edgeMidpoint(curCx, curCy, exitEdge));

          const [nx, ny] = neighborCell(curCx, curCy, exitEdge);

          // Closure detection
          if (nx === cx && ny === cy) {
            if (oppositeEdge[exitEdge] === startEdge) {
              isClosed = true;
              break;
            }
          }

          if (nx < 0 || nx >= cw || ny < 0 || ny >= ch) break;

          curCx = nx;
          curCy = ny;
          curEntry = oppositeEdge[exitEdge];
        }

        if (points.length >= 3) {
          contours.push({ points, isClosed });
        }
      }
    }
  }

  return contours;
}
