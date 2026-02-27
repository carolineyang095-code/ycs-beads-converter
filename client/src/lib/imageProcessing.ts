/**
 * Image Processing Library
 * Handles image scaling, canvas rendering, pixel grid generation,
 * BFS color merging, background removal, and export features.
 */

import {
  ColorData,
  RGB,
  getDominantColor,
  findClosestColor,
  bfsMergeColors,
  detectBackground,
  createColorIndex,
  euclideanDistance,
} from './colorMapping';

export type { ColorData, RGB };

export interface PixelGridCell {
  code: string;
  hex: string;
  rgb: RGB;
  originalRgb: RGB; // Original color before mapping (for re-mapping)
  isBackground: boolean;
}

export interface ProcessedImage {
  gridWidth: number;
  gridHeight: number;
  pixels: PixelGridCell[];
  colorStats: Map<string, number>;
  backgroundCode: string | null;
  backgroundIndices: Set<number>;
}

/**
 * Load an image file and return a canvas element
 */
export async function loadImage(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Calculate grid dimensions while preserving aspect ratio
 */
export function calculateGridDimensions(
  sourceCanvas: HTMLCanvasElement,
  horizontalGridSize: number
): { width: number; height: number } {
  const aspectRatio = sourceCanvas.height / sourceCanvas.width;
  const verticalGridSize = Math.round(horizontalGridSize * aspectRatio);
  return {
    width: horizontalGridSize,
    height: Math.max(1, verticalGridSize),
  };
}

/**
 * Resize image to target grid size using nearest neighbor algorithm
 */
export function resizeImageToGrid(
  sourceCanvas: HTMLCanvasElement,
  gridWidth: number,
  gridHeight: number
): HTMLCanvasElement {
  const targetCanvas = document.createElement('canvas');
  targetCanvas.width = gridWidth;
  targetCanvas.height = gridHeight;

  const ctx = targetCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sourceCanvas, 0, 0, gridWidth, gridHeight);
  return targetCanvas;
}

// ===============================
// Cartoon Post-Processing Helpers
// ===============================
function computeColorStats(
  pixels: PixelGridCell[],
  backgroundIndices: Set<number>
): Map<string, number> {
  const stats = new Map<string, number>();
  pixels.forEach((p, i) => {
    if (backgroundIndices.has(i)) return;
    stats.set(p.code, (stats.get(p.code) || 0) + 1);
  });
  return stats;
}

function detectEdgesSimple(
  pixels: PixelGridCell[],
  gridWidth: number,
  gridHeight: number,
  backgroundIndices: Set<number>,
  threshold: number = 25
): Set<number> {
  const edges = new Set<number>();

  const brightness = (p: PixelGridCell) =>
    (p.rgb.r * 299 + p.rgb.g * 587 + p.rgb.b * 114) / 1000;

  for (let y = 1; y < gridHeight - 1; y++) {
    for (let x = 1; x < gridWidth - 1; x++) {
      const idx = y * gridWidth + x;
      if (backgroundIndices.has(idx)) continue;

      const c = brightness(pixels[idx]);
      const r = brightness(pixels[idx + 1]);
      const b = brightness(pixels[idx + gridWidth]);

      if (Math.abs(c - r) > threshold || Math.abs(c - b) > threshold) {
        edges.add(idx);
      }
    }
  }
  return edges;
}

function applyEdgeShadingToPalette(
  pixels: PixelGridCell[],
  edges: Set<number>,
  palette: ColorData[],
  excludedCodes: Set<string>,
  intensity: number = 0.18 // ✅ 建议 0.10~0.25，越小越弱
): PixelGridCell[] {
  const result = [...pixels];

  const darken = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * (1 - intensity))));

  Array.from(edges).forEach((idx) => {
    const p = result[idx];
    if (p.isBackground) return;

    const shaded: RGB = {
      r: darken(p.rgb.r),
      g: darken(p.rgb.g),
      b: darken(p.rgb.b),
    };

    // ✅ 压暗后重新映射回色板，保证 code/hex/rgb 一致（不会出现 rgb(...) 这种）
    const closest = findClosestColor(shaded, palette, excludedCodes);

    result[idx] = {
      ...p,
      code: closest.code,
      hex: closest.hex,
      rgb: closest.rgb,
    };
  });

  return result;
}

function mergeSinglesToNearestNeighbor(
  pixels: PixelGridCell[],
  gridWidth: number,
  gridHeight: number,
  backgroundIndices: Set<number>,
  paletteIndex: Map<string, ColorData>
): PixelGridCell[] {
  const stats = computeColorStats(pixels, backgroundIndices);
  const result = [...pixels];
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];

  for (let i = 0; i < result.length; i++) {
    if (backgroundIndices.has(i)) continue;

    const code = result[i].code;
    if ((stats.get(code) || 0) !== 1) continue;

    const x = i % gridWidth;
    const y = Math.floor(i / gridWidth);

    const src = paletteIndex.get(code);
    if (!src) continue;

    let bestCode = code;
    let bestDist = Infinity;

    dirs.forEach(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= gridWidth || ny < 0 || ny >= gridHeight) return;

      const ni = ny * gridWidth + nx;
      if (backgroundIndices.has(ni)) return;

      const nCode = result[ni].code;
      if (nCode === code) return;

      const tgt = paletteIndex.get(nCode);
      if (!tgt) return;

      const dist = euclideanDistance(src.rgb, tgt.rgb);
      if (dist < bestDist) {
        bestDist = dist;
        bestCode = nCode;
      }
    });

    if (bestCode !== code) {
      const rep = paletteIndex.get(bestCode);
      if (rep) result[i] = { ...result[i], code: rep.code, hex: rep.hex, rgb: rep.rgb };
    }
  }

  return result;
}

function limitMaxColors(
  pixels: PixelGridCell[],
  backgroundIndices: Set<number>,
  paletteIndex: Map<string, ColorData>,
  maxColors: number
): PixelGridCell[] {
  if (maxColors <= 0) return pixels;

  const stats = computeColorStats(pixels, backgroundIndices);
  const sorted = Array.from(stats.entries()).sort((a, b) => b[1] - a[1]);
  const allowed = new Set(sorted.slice(0, maxColors).map(([code]) => code));

  return pixels.map((p, i) => {
    if (backgroundIndices.has(i)) return p;
    if (allowed.has(p.code)) return p;

    const src = paletteIndex.get(p.code);
    if (!src) return p;

    let bestCode = p.code;
    let bestDist = Infinity;

    // 注意：用 Array.from 避免 Set 迭代 target 问题
    Array.from(allowed).forEach((code) => {
      const tgt = paletteIndex.get(code);
      if (!tgt) return;
      const dist = euclideanDistance(src.rgb, tgt.rgb);
      if (dist < bestDist) {
        bestDist = dist;
        bestCode = code;
      }
    });

    const rep = paletteIndex.get(bestCode);
    return rep ? { ...p, code: rep.code, hex: rep.hex, rgb: rep.rgb } : p;
  });
}


/**
 * Process image to create a pixel grid with color mapping
 * Supports BFS merge and background removal
 */
export function processImageToGrid(
  canvas: HTMLCanvasElement,
  gridWidth: number,
  gridHeight: number,
  palette: ColorData[],
  mergeThreshold: number = 0,
  enableBackgroundRemoval: boolean = false,
  excludedCodes: Set<string> = new Set(),
  ditherStrength: number = 0,
  options?: {
    maxColors?: 20 | 50 | 100 | 150 | 221;
  }
): ProcessedImage {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }
  const maxColors = options?.maxColors ?? 211;       // 默认保持 211 色

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels: PixelGridCell[] = [];

  // Step 1: Map each cell (1px) to palette color
  const rawCodes: string[] = new Array(gridWidth * gridHeight);
  const originalRgbs: RGB[] = new Array(gridWidth * gridHeight);

  const data = imageData.data;

  // Dithering config
  const strength = Math.max(0, Math.min(100, ditherStrength)) / 100; // 0..1
  const useDither = strength > 0;

  // Working buffers (float) for dithering
  const workR = new Float32Array(gridWidth * gridHeight);
  const workG = new Float32Array(gridWidth * gridHeight);
  const workB = new Float32Array(gridWidth * gridHeight);

  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const idx = y * gridWidth + x;
      const p = idx * 4;

      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];

      originalRgbs[idx] = { r, g, b };

      workR[idx] = r;
      workG[idx] = g;
      workB[idx] = b;
    }
  }

  // Floyd–Steinberg dithering on the grid
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const idx = y * gridWidth + x;

      const oldColor: RGB = {
        r: workR[idx],
        g: workG[idx],
        b: workB[idx],
      };

      const closest = findClosestColor(oldColor, palette, excludedCodes);
      rawCodes[idx] = closest.code;

      if (!useDither) continue;

      // Error = old - new
      const errR = (oldColor.r - closest.rgb.r) * strength;
      const errG = (oldColor.g - closest.rgb.g) * strength;
      const errB = (oldColor.b - closest.rgb.b) * strength;

      const addErr = (nx: number, ny: number, factor: number) => {
        if (nx < 0 || nx >= gridWidth || ny < 0 || ny >= gridHeight) return;
        const n = ny * gridWidth + nx;
        workR[n] = Math.max(0, Math.min(255, workR[n] + errR * factor));
        workG[n] = Math.max(0, Math.min(255, workG[n] + errG * factor));
        workB[n] = Math.max(0, Math.min(255, workB[n] + errB * factor));
      };

      addErr(x + 1, y, 7 / 16);
      addErr(x - 1, y + 1, 3 / 16);
      addErr(x, y + 1, 5 / 16);
      addErr(x + 1, y + 1, 1 / 16);
    }
  }

  // Step 2: BFS merge small regions if threshold > 0
  let mergedCodes = rawCodes;
  if (mergeThreshold > 1) {
    const paletteIndex = createColorIndex(palette);
    mergedCodes = bfsMergeColors(
      rawCodes,
      gridWidth,
      gridHeight,
      mergeThreshold,
      palette,
      paletteIndex,
      35
    );
  }

  // Step 3: Detect background if enabled
  let backgroundIndices = new Set<number>();
  let backgroundCode: string | null = null;
  if (enableBackgroundRemoval) {
    const bgResult = detectBackground(mergedCodes, gridWidth, gridHeight);
    backgroundIndices = bgResult.backgroundIndices;
    backgroundCode = bgResult.backgroundCode;
  }

  // Step 4: Build final pixel array
  const colorIndex = createColorIndex(palette);
  for (let i = 0; i < mergedCodes.length; i++) {
    const code = mergedCodes[i];
    const color = colorIndex.get(code);
    const isBackground = backgroundIndices.has(i);

    pixels.push({
      code,
      hex: color?.hex || '#000000',
      rgb: color?.rgb || { r: 0, g: 0, b: 0 },
      originalRgb: originalRgbs[i],
      isBackground,
    });
  }

  // ✅ Step 4.5: Limit max colors (always effective)
let finalPixels = pixels;

if (maxColors < 221) {
  finalPixels = limitMaxColors(finalPixels, backgroundIndices, colorIndex, maxColors);
}

const finalStats = computeColorStats(finalPixels, backgroundIndices);

return {
  gridWidth,
  gridHeight,
  pixels: finalPixels,
  colorStats: finalStats,
  backgroundCode,
  backgroundIndices,
};
}

/**
 * Draw the pixel grid on a canvas with optional highlighting and background dimming
 */
export function drawPixelGrid(
  canvas: HTMLCanvasElement,
  gridWidth: number,
  gridHeight: number,
  pixels: PixelGridCell[],
  pixelSize: number = 20,
  showGrid: boolean = true,
  highlightCode: string | null = null,
  backgroundIndices: Set<number> = new Set(),
  showBackground: boolean = true
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  canvas.width = gridWidth * pixelSize;
  canvas.height = gridHeight * pixelSize;

  for (let i = 0; i < pixels.length; i++) {
    const pixel = pixels[i];
    const x = (i % gridWidth) * pixelSize;
    const y = Math.floor(i / gridWidth) * pixelSize;

    const isBg = backgroundIndices.has(i);

    if (isBg && !showBackground) {
      // Draw background as light gray checkerboard
      ctx.fillStyle = (Math.floor(i / gridWidth) + (i % gridWidth)) % 2 === 0
        ? '#F0F0F0' : '#E0E0E0';
      ctx.fillRect(x, y, pixelSize, pixelSize);
    } else {
      ctx.fillStyle = pixel.hex;
      ctx.fillRect(x, y, pixelSize, pixelSize);

      // Dim non-highlighted pixels when a color is highlighted
      if (highlightCode && pixel.code !== highlightCode) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillRect(x, y, pixelSize, pixelSize);
      }
    }

    if (showGrid) {
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x, y, pixelSize, pixelSize);
    }
  }
}

/**
 * Draw pixel grid with color codes overlaid (for export)
 */
export function drawPixelGridWithCodes(
  canvas: HTMLCanvasElement,
  gridWidth: number,
  gridHeight: number,
  pixels: PixelGridCell[],
  pixelSize: number = 30,
  backgroundIndices: Set<number> = new Set()
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  canvas.width = gridWidth * pixelSize;
  canvas.height = gridHeight * pixelSize;

  for (let i = 0; i < pixels.length; i++) {
    const pixel = pixels[i];
    const x = (i % gridWidth) * pixelSize;
    const y = Math.floor(i / gridWidth) * pixelSize;

    const isBg = backgroundIndices.has(i);

    if (isBg || pixel.hex === 'transparent' || !pixel.code) {
      // Background removal or erased area: clear to show checkerboard
      ctx.clearRect(x, y, pixelSize, pixelSize);
      if (isBg) {
        ctx.fillStyle = 'rgba(245, 245, 245, 0.5)';
        ctx.fillRect(x, y, pixelSize, pixelSize);
      }
    } else {
      ctx.fillStyle = pixel.hex;
      ctx.fillRect(x, y, pixelSize, pixelSize);
    }

    // Draw grid
    ctx.strokeStyle = '#CCCCCC';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x, y, pixelSize, pixelSize);

    // Draw color code text if not background and pixel is large enough
    if (!isBg && pixelSize >= 20) {
      const brightness = (pixel.rgb.r * 299 + pixel.rgb.g * 587 + pixel.rgb.b * 114) / 1000;
      ctx.fillStyle = brightness > 128 ? '#333333' : '#FFFFFF';
      ctx.font = `${Math.max(8, pixelSize * 0.3)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pixel.code, x + pixelSize / 2, y + pixelSize / 2);
    }
  }
}

/**
 * Export the pixel grid as PNG
 */
export function exportGridAsPNG(
  canvas: HTMLCanvasElement,
  fileName: string = 'perler-pattern.png'
): void {
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export pattern as PNG with color codes overlaid
 */
export function exportGridWithCodesPNG(
  gridWidth: number,
  gridHeight: number,
  pixels: PixelGridCell[],
  backgroundIndices: Set<number>,
  fileName: string = 'perler-pattern-coded.png'
): void {
  const pixelSize = Math.max(30, Math.min(50, Math.floor(4000 / Math.max(gridWidth, gridHeight))));
  const exportCanvas = document.createElement('canvas');
  drawPixelGridWithCodes(exportCanvas, gridWidth, gridHeight, pixels, pixelSize, backgroundIndices);
  exportGridAsPNG(exportCanvas, fileName);
}

/**
 * Export color statistics as CSV
 */
export function exportStatsAsCSV(
  colorStats: Map<string, number>,
  palette: Map<string, ColorData>,
  fileName: string = 'perler-stats.csv'
): void {
  const rows: string[] = ['code,name,hex,count'];
  const sortedCodes = Array.from(colorStats.keys()).sort();

  for (const code of sortedCodes) {
    const count = colorStats.get(code) || 0;
    const color = palette.get(code);
    if (color) {
      rows.push(`${code},${color.name},${color.hex},${count}`);
    }
  }

  const csv = rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Get total bead count
 */
export function getTotalBeadCount(gridWidth: number, gridHeight: number): number {
  return gridWidth * gridHeight;
}

/**
 * Get aspect ratio display string
 */
export function getAspectRatioString(gridWidth: number, gridHeight: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(gridWidth, gridHeight);
  return `${gridWidth / divisor}:${gridHeight / divisor}`;
}

/**
 * Get pixel info at a specific grid position
 */
export function getPixelAt(
  pixels: PixelGridCell[],
  gridWidth: number,
  x: number,
  y: number
): PixelGridCell | null {
  const idx = y * gridWidth + x;
  return pixels[idx] || null;
}

/**
 * Set pixel at a specific grid position (for brush/eraser tools)
 */
export function setPixelAt(
  pixels: PixelGridCell[],
  gridWidth: number,
  x: number,
  y: number,
  newColor: ColorData | null
): PixelGridCell[] {
  const result = [...pixels];
  const idx = y * gridWidth + x;
  if (idx >= 0 && idx < result.length) {
    if (newColor) {
      result[idx] = {
        ...result[idx],
        code: newColor.code,
        hex: newColor.hex,
        rgb: newColor.rgb,
      };
    } else {
      // Eraser mode: set to transparent
      result[idx] = {
        ...result[idx],
        code: '',
        hex: 'transparent',
        rgb: { r: 0, g: 0, b: 0 },
      };
    }
  }
  return result;
}
