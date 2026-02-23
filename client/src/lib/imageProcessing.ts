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
  excludedCodes: Set<string> = new Set()
): ProcessedImage {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels: PixelGridCell[] = [];
  const colorStats = new Map<string, number>();

  const cellWidth = Math.ceil(canvas.width / gridWidth);
  const cellHeight = Math.ceil(canvas.height / gridHeight);

  // Step 1: Map each pixel to palette color
  const rawCodes: string[] = [];
  const originalRgbs: RGB[] = [];

  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const dominantColor = getDominantColor(
        imageData.data, 0, canvas.width, canvas.height,
        x, y, cellWidth, cellHeight
      );
      originalRgbs.push(dominantColor);

      const closestColor = findClosestColor(dominantColor, palette, excludedCodes);
      rawCodes.push(closestColor.code);
    }
  }

  // Step 2: BFS merge small regions if threshold > 0
  let mergedCodes = rawCodes;
  if (mergeThreshold > 1) {
    const colorIndex = createColorIndex(palette);
    mergedCodes = bfsMergeColors(rawCodes, gridWidth, gridHeight, mergeThreshold, palette, colorIndex);
  }

  // Step 3: Detect background if enabled
  let backgroundIndices = new Set<number>();
  let backgroundCode: string | null = null;
  if (enableBackgroundRemoval) {
    const bgResult = detectBackground(mergedCodes, gridWidth, gridHeight);
    backgroundIndices = bgResult.backgroundIndices;
    backgroundCode = bgResult.backgroundCode;
  }

  // Step 4: Build final pixel array and stats
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

    // Only count non-background pixels in stats
    if (!isBackground) {
      colorStats.set(code, (colorStats.get(code) || 0) + 1);
    }
  }

  return { gridWidth, gridHeight, pixels, colorStats, backgroundCode, backgroundIndices };
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

    if (isBg) {
      ctx.fillStyle = '#F5F5F5';
    } else {
      ctx.fillStyle = pixel.hex;
    }
    ctx.fillRect(x, y, pixelSize, pixelSize);

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
  newColor: ColorData
): PixelGridCell[] {
  const result = [...pixels];
  const idx = y * gridWidth + x;
  if (idx >= 0 && idx < result.length) {
    result[idx] = {
      ...result[idx],
      code: newColor.code,
      hex: newColor.hex,
      rgb: newColor.rgb,
    };
  }
  return result;
}
