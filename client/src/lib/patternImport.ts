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

/** What one grid cell looks like: its fill colour and how much printed text sits on top of it. */
export interface CellSample {
  /** Fill colour of the cell (the most common colour, so printed text does not skew it). */
  rgb: RGB;
  /** Share of the cell's pixels that clearly differ from the fill colour (0-1). Printed codes give ~5-20%. */
  inkRatio: number;
}

/** Share of the cell trimmed on each side so grid lines are never sampled. */
const CELL_INSET = 0.12;
/** A pixel counts as "ink" (printed code) when it is this far from the cell's fill colour. */
const INK_DISTANCE = 110;
/** A cell counts as "has a code printed in it" above this ink ratio. Empty cells with light watermarks stay near 0. */
const TEXT_INK_RATIO = 0.03;

/**
 * Sample one grid cell.
 * The whole cell is used (minus a small margin for grid lines), so the
 * fill colour wins the vote even when a code like "A5" covers the centre.
 * Uses an 8-step RGB quantization bucket vote (robust to JPEG noise), then
 * averages the real pixel values that fall in the winning bucket.
 */
export function sampleCell(
  ctx: CanvasRenderingContext2D,
  cellX: number,
  cellY: number,
  cellWidth: number,
  cellHeight: number
): CellSample {
  const rawX = Math.round(cellX + cellWidth * CELL_INSET);
  const rawY = Math.round(cellY + cellHeight * CELL_INSET);
  const rawW = Math.max(1, Math.round(cellWidth * (1 - 2 * CELL_INSET)));
  const rawH = Math.max(1, Math.round(cellHeight * (1 - 2 * CELL_INSET)));

  const canvasWidth = ctx.canvas.width;
  const canvasHeight = ctx.canvas.height;
  const sx = Math.max(0, Math.min(rawX, canvasWidth - 1));
  const sy = Math.max(0, Math.min(rawY, canvasHeight - 1));
  const sw = Math.max(1, Math.min(rawW, canvasWidth - sx));
  const sh = Math.max(1, Math.min(rawH, canvasHeight - sy));

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

  if (!winner) return { rgb: { r: 255, g: 255, b: 255 }, inkRatio: 0 };
  const rgb = {
    r: Math.round(winner.sumR / winner.count),
    g: Math.round(winner.sumG / winner.count),
    b: Math.round(winner.sumB / winner.count),
  };

  let inkPixels = 0;
  let totalPixels = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 10) continue;
    totalPixels += 1;
    const dr = data[i] - rgb.r;
    const dg = data[i + 1] - rgb.g;
    const db = data[i + 2] - rgb.b;
    if (dr * dr + dg * dg + db * db > INK_DISTANCE * INK_DISTANCE) inkPixels += 1;
  }

  return { rgb, inkRatio: totalPixels > 0 ? inkPixels / totalPixels : 0 };
}

function sampleGrid(
  canvas: HTMLCanvasElement,
  frame: GridFrame,
  columns: number,
  rows: number
): CellSample[] {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Failed to get canvas context');

  const cellWidth = frame.width / columns;
  const cellHeight = frame.height / rows;
  const samples: CellSample[] = new Array(columns * rows);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const cellX = frame.x + col * cellWidth;
      const cellY = frame.y + row * cellHeight;
      samples[row * columns + col] = sampleCell(ctx, cellX, cellY, cellWidth, cellHeight);
    }
  }

  return samples;
}

/**
 * Centroid clustering of the given cells' colours.
 * Step 1: a cell starts a new group when it is at least `threshold` away from
 * every existing group centre. Step 2: a few rounds of "move every cell to its
 * nearest centre, recompute centres". Unlike chain merging, two different
 * colours can no longer be glued together through a trail of in-between
 * JPEG shades.
 */
function clusterCellColors(
  colors: RGB[],
  cellIndices: number[],
  threshold: number
): { groupRgb: RGB[]; groupMembers: number[][] } {
  if (cellIndices.length === 0) return { groupRgb: [], groupMembers: [] };

  let centres: RGB[] = [];
  cellIndices.forEach((idx) => {
    const c = colors[idx];
    const isNew = centres.every((centre) => euclideanDistance(c, centre) >= threshold);
    if (isNew) centres.push({ ...c });
  });

  let assignment = new Array<number>(cellIndices.length).fill(0);
  for (let round = 0; round < 10; round++) {
    assignment = cellIndices.map((idx) => {
      let best = 0;
      let bestDistance = Infinity;
      for (let k = 0; k < centres.length; k++) {
        const d = euclideanDistance(colors[idx], centres[k]);
        if (d < bestDistance) {
          bestDistance = d;
          best = k;
        }
      }
      return best;
    });

    centres = centres.map((centre, k) => {
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let count = 0;
      assignment.forEach((groupId, pos) => {
        if (groupId !== k) return;
        const c = colors[cellIndices[pos]];
        sumR += c.r;
        sumG += c.g;
        sumB += c.b;
        count += 1;
      });
      if (count === 0) return centre;
      return { r: Math.round(sumR / count), g: Math.round(sumG / count), b: Math.round(sumB / count) };
    });
  }

  const groupMembers: number[][] = centres.map(() => []);
  assignment.forEach((groupId, pos) => groupMembers[groupId].push(cellIndices[pos]));

  const groupRgb: RGB[] = [];
  const nonEmptyMembers: number[][] = [];
  groupMembers.forEach((members, k) => {
    if (members.length === 0) return;
    nonEmptyMembers.push(members);
    groupRgb.push(centres[k]);
  });

  return { groupRgb, groupMembers: nonEmptyMembers };
}

/** Average colour of a set of cells. */
function averageColor(colors: RGB[], cellIndices: number[]): RGB {
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  cellIndices.forEach((idx) => {
    sumR += colors[idx].r;
    sumG += colors[idx].g;
    sumB += colors[idx].b;
  });
  const n = Math.max(1, cellIndices.length);
  return { r: Math.round(sumR / n), g: Math.round(sumG / n), b: Math.round(sumB / n) };
}

/**
 * Normalise what the user typed from the pattern's legend into MARD codes.
 * "H1", "h01", "H01" all become "H01"; "ZG01" becomes "ZG1".
 * Counts like "x313" are ignored. Codes not in the current palette are
 * returned in `unknown` so the modal can show them.
 */
export function parseLegendCodes(
  input: string,
  palette: ColorData[]
): { codes: string[]; unknown: string[] } {
  const known = new Set(palette.map((c) => c.code));
  const codes: string[] = [];
  const unknown: string[] = [];

  const tokens = input.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  tokens.forEach((token) => {
    const match = token.match(/^(ZG|[A-Z])0*(\d{1,2})$/);
    if (!match) return;
    const [, letters, digits] = match;
    const code = letters === 'ZG' ? `ZG${Number(digits)}` : `${letters}${digits.padStart(2, '0')}`;
    if (codes.includes(code) || unknown.includes(code)) return;
    if (known.has(code)) codes.push(code);
    else unknown.push(code);
  });

  return { codes, unknown };
}

function isOuterRing(cellIndex: number, columns: number, rows: number): boolean {
  const col = cellIndex % columns;
  const row = Math.floor(cellIndex / columns);
  return row === 0 || row === rows - 1 || col === 0 || col === columns - 1;
}

/**
 * Full pipeline for one "Analyse the grid" click:
 * 1. sample every cell (fill colour + how much printed text it has)
 * 2. cells with a printed code are beads; cells without one are empty.
 *    (If no cell in the whole grid has text, fall back to colour only:
 *    every cell is a bead and the near-white outer-ring group is suggested
 *    as the empty background, like before.)
 * 3. group the bead cells by colour, match each group to the closest MARD
 *    colour (only among the legend codes when the user entered them), and
 *    merge groups that end up on the same code.
 */
export function analyzeGrid(
  canvas: HTMLCanvasElement,
  frame: GridFrame,
  columns: number,
  rows: number,
  palette: ColorData[],
  mergeThreshold: number,
  legendCodes: string[] = []
): GridAnalysisResult {
  const samples = sampleGrid(canvas, frame, columns, rows);
  const cellColors = samples.map((s) => s.rgb);
  const allIndices = cellColors.map((_, idx) => idx);

  const textIndices = allIndices.filter((idx) => samples[idx].inkRatio > TEXT_INK_RATIO);
  const useText = textIndices.length > 0;
  const beadIndices = useText ? textIndices : allIndices;
  const emptyIndices = useText ? allIndices.filter((idx) => samples[idx].inkRatio <= TEXT_INK_RATIO) : [];

  const legendSet = new Set(legendCodes);
  const legendPalette = palette.filter((c) => legendSet.has(c.code));
  const candidates = legendPalette.length > 0 ? legendPalette : palette;

  const { groupRgb, groupMembers } = clusterCellColors(cellColors, beadIndices, mergeThreshold);

  // Match each colour group to a code, then merge groups sharing the same code.
  const byCode = new Map<string, number[]>();
  groupMembers.forEach((members, k) => {
    const code = findClosestColor(groupRgb[k], candidates).code;
    const existing = byCode.get(code);
    if (existing) existing.push(...members);
    else byCode.set(code, [...members]);
  });

  let nextId = 0;
  let groups: ImportColorGroup[] = Array.from(byCode.entries()).map(([code, members]) => ({
    id: nextId++,
    rgb: averageColor(cellColors, members),
    cellCount: members.length,
    cellIndices: members,
    matchedCode: code,
    isBackground: false,
  }));

  if (useText) {
    if (emptyIndices.length > 0) {
      const rgb = averageColor(cellColors, emptyIndices);
      groups.push({
        id: nextId++,
        rgb,
        cellCount: emptyIndices.length,
        cellIndices: emptyIndices,
        matchedCode: findClosestColor(rgb, palette).code,
        isBackground: true,
      });
    }
  } else {
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
  }

  groups.sort((a, b) => b.cellCount - a.cellCount);

  return { groups, cellColors };
}

/**
 * Turn the (user-reviewed) groups into a ProcessedImage compatible with the
 * rest of the app's downstream components (export, Shopify, noise cleanup).
 *
 * Empty cells are stored exactly like the cells of a new blank canvas
 * (code '', transparent, isBackground false) and `backgroundIndices` stays
 * empty. That list is only for photo background removal: export and stats
 * treat every cell in it as empty even after it is painted, so putting
 * imported empty cells there made brush edits on them disappear on export.
 */
export function buildProcessedImage(
  groups: ImportColorGroup[],
  cellColors: RGB[],
  columns: number,
  rows: number,
  paletteIndex: Map<string, ColorData>
): ProcessedImage {
  const pixels: PixelGridCell[] = new Array(columns * rows);

  groups.forEach((group) => {
    const matched = group.isBackground ? undefined : paletteIndex.get(group.matchedCode);
    group.cellIndices.forEach((idx) => {
      const originalRgb = cellColors[idx] ?? group.rgb;
      if (group.isBackground) {
        pixels[idx] = {
          code: '',
          hex: 'transparent',
          rgb: { r: 0, g: 0, b: 0 },
          originalRgb,
          isBackground: false,
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
  pixels.forEach((pixel) => {
    if (!pixel.code || pixel.code === 'BG' || pixel.hex === 'transparent') return;
    colorStats.set(pixel.code, (colorStats.get(pixel.code) || 0) + 1);
  });

  return {
    gridWidth: columns,
    gridHeight: rows,
    pixels,
    colorStats,
    backgroundCode: null,
    backgroundIndices: new Set<number>(),
  };
}
