/**
 * Pattern Import Library
 * Turns a screenshot/photo of an already-finished bead pattern back into a
 * ProcessedImage (grid + colour codes), so the existing export / cart /
 * cleanup tools can be reused on a pattern the user didn't build in this app.
 *
 * This file is intentionally self-contained: it duplicates the small amount
 * of colour-sampling logic that already exists in colorMapping.ts
 * (getDominantColor) instead of touching that file, and it re-uses
 * euclideanDistance / findClosestColor / the ProcessedImage & PixelGridCell
 * types as-is.
 */

import { ColorData, RGB, euclideanDistance, findClosestColor } from './colorMapping';
import { ProcessedImage, PixelGridCell } from './imageProcessing';

/** The user-adjustable rectangle (in the ORIGINAL image's pixel coordinates) that covers the grid. */
export interface GridFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One detected colour cluster, before or after user review. */
export interface ImportColorGroup {
  id: number;
  /** Representative colour for the whole group (average of its member cells). */
  rgb: RGB;
  cellCount: number;
  /** Row-major cell indices (index = row * columns + col) belonging to this group. */
  cellIndices: number[];
  /** MARD code this group is currently mapped to (editable by the user in the review table). */
  matchedCode: string;
  /** Whether this group should render as an empty/transparent cell instead of a bead. */
  isBackground: boolean;
}

export interface GridAnalysisResult {
  groups: ImportColorGroup[];
  /** Raw sampled colour for every cell, row-major, before clustering. */
  cellColors: RGB[];
}

/**
 * Sample the dominant colour of one grid cell.
 * Only the center 50% of the cell is sampled, to avoid grid lines and any
 * color-code text printed inside the cell.
 * Uses an 8-step RGB quantization bucket vote (robust to JPEG noise), then
 * averages the real pixel values that fall in the winning bucket.
 */
export function getCellDominantColor(
  ctx: CanvasRenderingContext2D,
  cellX: number,
  cellY: number,
  cellWidth: number,
  cellHeight: number
): RGB {
  const sampleSize = Math.max(1, Math.floor(Math.min(cellWidth, cellHeight) * 0.5));
  const rawX = Math.round(cellX + (cellWidth - sampleSize) / 2);
  const rawY = Math.round(cellY + (cellHeight - sampleSize) / 2);

  const canvasWidth = ctx.canvas.width;
  const canvasHeight = ctx.canvas.height;
  const sx = Math.max(0, Math.min(rawX, canvasWidth - 1));
  const sy = Math.max(0, Math.min(rawY, canvasHeight - 1));
  const sw = Math.max(1, Math.min(sampleSize, canvasWidth - sx));
  const sh = Math.max(1, Math.min(sampleSize, canvasHeight - sy));

  const { data } = ctx.getImageData(sx, sy, sw, sh);

  const buckets = new Map<string, { count: number; sumR: number; sumG: number; sumB: number }>();

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 10) continue;

    const key = `${r >> 3},${g >> 3},${b >> 3}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count += 1;
      bucket.sumR += r;
      bucket.sumG += g;
      bucket.sumB += b;
    } else {
      buckets.set(key, { count: 1, sumR: r, sumG: g, sumB: b });
    }
  }

  const bucketList = Array.from(buckets.values());
  let winner: { count: number; sumR: number; sumG: number; sumB: number } | null = null;
  for (let i = 0; i < bucketList.length; i++) {
    if (!winner || bucketList[i].count > winner.count) winner = bucketList[i];
  }

  if (!winner) return { r: 255, g: 255, b: 255 };
  return {
    r: Math.round(winner.sumR / winner.count),
    g: Math.round(winner.sumG / winner.count),
    b: Math.round(winner.sumB / winner.count),
  };
}

function sampleGridColors(
  canvas: HTMLCanvasElement,
  frame: GridFrame,
  columns: number,
  rows: number
): RGB[] {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  const cellWidth = frame.width / columns;
  const cellHeight = frame.height / rows;
  const colors: RGB[] = new Array(columns * rows);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const cellX = frame.x + col * cellWidth;
      const cellY = frame.y + row * cellHeight;
      colors[row * columns + col] = getCellDominantColor(ctx, cellX, cellY, cellWidth, cellHeight);
    }
  }

  return colors;
}

/**
 * Union-find clustering: any two cells whose colours are closer than
 * `threshold` (Euclidean distance, via colorMapping.euclideanDistance) end
 * up in the same group. Group representative = average of member colours.
 */
function clusterCellColors(
  colors: RGB[],
  threshold: number
): { groupRgb: RGB[]; groupMembers: number[][] } {
  const n = colors.length;
  const parent = new Array<number>(n);
  for (let i = 0; i < n; i++) parent[i] = i;

  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };

  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (find(i) === find(j)) continue;
      if (euclideanDistance(colors[i], colors[j]) < threshold) union(i, j);
    }
  }

  const rootToGroupId = new Map<number, number>();
  const groupMembers: number[][] = [];

  for (let i = 0; i < n; i++) {
    const root = find(i);
    let groupId = rootToGroupId.get(root);
    if (groupId === undefined) {
      groupId = groupMembers.length;
      rootToGroupId.set(root, groupId);
      groupMembers.push([]);
    }
    groupMembers[groupId].push(i);
  }

  const groupRgb: RGB[] = groupMembers.map((members) => {
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    members.forEach((idx) => {
      sumR += colors[idx].r;
      sumG += colors[idx].g;
      sumB += colors[idx].b;
    });
    return {
      r: Math.round(sumR / members.length),
      g: Math.round(sumG / members.length),
      b: Math.round(sumB / members.length),
    };
  });

  return { groupRgb, groupMembers };
}

function isOuterRing(cellIndex: number, columns: number, rows: number): boolean {
  const col = cellIndex % columns;
  const row = Math.floor(cellIndex / columns);
  return row === 0 || row === rows - 1 || col === 0 || col === columns - 1;
}

/**
 * Full pipeline for one "Analyse the grid" click:
 * sample every cell -> cluster similar colours -> match each cluster to the
 * closest palette (MARD) colour -> suggest one near-white outer-ring group
 * as the default "treat as empty" background.
 */
export function analyzeGrid(
  canvas: HTMLCanvasElement,
  frame: GridFrame,
  columns: number,
  rows: number,
  palette: ColorData[],
  mergeThreshold: number
): GridAnalysisResult {
  const cellColors = sampleGridColors(canvas, frame, columns, rows);
  const { groupRgb, groupMembers } = clusterCellColors(cellColors, mergeThreshold);

  let groups: ImportColorGroup[] = groupMembers.map((members, id) => {
    const rgb = groupRgb[id];
    const matched = findClosestColor(rgb, palette);
    return {
      id,
      rgb,
      cellCount: members.length,
      cellIndices: members,
      matchedCode: matched.code,
      isBackground: false,
    };
  });

  let bestBgGroupId: number | null = null;
  let bestBgEdgeCount = 0;
  groups.forEach((group) => {
    const isNearWhite = group.rgb.r > 240 && group.rgb.g > 240 && group.rgb.b > 240;
    if (!isNearWhite) return;
    const edgeCount = group.cellIndices.filter((idx) => isOuterRing(idx, columns, rows)).length;
    if (edgeCount > bestBgEdgeCount) {
      bestBgEdgeCount = edgeCount;
      bestBgGroupId = group.id;
    }
  });
  if (bestBgGroupId !== null) {
    groups = groups.map((g) => (g.id === bestBgGroupId ? { ...g, isBackground: true } : g));
  }

  groups.sort((a, b) => b.cellCount - a.cellCount);

  return { groups, cellColors };
}

/**
 * Turn the (user-reviewed) groups into a ProcessedImage compatible with the
 * rest of the app's downstream components (export, Shopify, noise cleanup).
 */
export function buildProcessedImage(
  groups: ImportColorGroup[],
  cellColors: RGB[],
  columns: number,
  rows: number,
  paletteIndex: Map<string, ColorData>
): ProcessedImage {
  const pixels: PixelGridCell[] = new Array(columns * rows);
  const backgroundIndices = new Set<number>();

  groups.forEach((group) => {
    const matched = group.isBackground ? undefined : paletteIndex.get(group.matchedCode);
    group.cellIndices.forEach((idx) => {
      const originalRgb = cellColors[idx] ?? group.rgb;
      if (group.isBackground) {
        backgroundIndices.add(idx);
        pixels[idx] = {
          code: '',
          hex: 'transparent',
          rgb: { r: 0, g: 0, b: 0 },
          originalRgb,
          isBackground: true,
        };
      } else {
        pixels[idx] = {
          code: matched?.code ?? group.matchedCode,
          hex: matched?.hex ?? '#000000',
          rgb: matched?.rgb ?? { r: 0, g: 0, b: 0 },
          originalRgb,
          isBackground: false,
        };
      }
    });
  });

  const colorStats = new Map<string, number>();
  pixels.forEach((pixel, idx) => {
    if (backgroundIndices.has(idx)) return;
    if (!pixel.code || pixel.code === 'BG' || pixel.hex === 'transparent') return;
    colorStats.set(pixel.code, (colorStats.get(pixel.code) || 0) + 1);
  });

  return {
    gridWidth: columns,
    gridHeight: rows,
    pixels,
    colorStats,
    backgroundCode: null,
    backgroundIndices,
  };
}
