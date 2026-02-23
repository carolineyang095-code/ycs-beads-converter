/**
 * Image Processing Library
 * Handles image scaling, canvas rendering, and pixel grid generation
 */

import { ColorData, getDominantColor, findClosestColor } from './colorMapping';

export type { ColorData };

export interface PixelGridCell {
  code: string;
  hex: string;
  rgb: {
    r: number;
    g: number;
    b: number;
  };
}

export interface ProcessedImage {
  gridWidth: number;
  gridHeight: number;
  pixels: PixelGridCell[];
  colorStats: Map<string, number>; // code -> count
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
 * Resize image to target grid size using nearest neighbor algorithm
 * This preserves the pixel art style
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

  // Use nearest neighbor by disabling image smoothing
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sourceCanvas, 0, 0, gridWidth, gridHeight);

  return targetCanvas;
}

/**
 * Process image to create a pixel grid with color mapping
 */
export function processImageToGrid(
  canvas: HTMLCanvasElement,
  gridWidth: number,
  gridHeight: number,
  palette: ColorData[]
): ProcessedImage {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels: PixelGridCell[] = [];
  const colorStats = new Map<string, number>();

  // Calculate cell dimensions
  const cellWidth = Math.ceil(canvas.width / gridWidth);
  const cellHeight = Math.ceil(canvas.height / gridHeight);

  // Process each grid cell
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      // Get dominant color in this cell
      const dominantColor = getDominantColor(
        imageData.data,
        0,
        canvas.width,
        canvas.height,
        x,
        y,
        cellWidth,
        cellHeight
      );

      // Find closest color in palette
      const closestColor = findClosestColor(dominantColor, palette);

      pixels.push({
        code: closestColor.code,
        hex: closestColor.hex,
        rgb: closestColor.rgb,
      });

      // Update statistics
      const count = (colorStats.get(closestColor.code) || 0) + 1;
      colorStats.set(closestColor.code, count);
    }
  }

  return {
    gridWidth,
    gridHeight,
    pixels,
    colorStats,
  };
}

/**
 * Draw the pixel grid on a canvas
 */
export function drawPixelGrid(
  canvas: HTMLCanvasElement,
  gridWidth: number,
  gridHeight: number,
  pixels: PixelGridCell[],
  pixelSize: number = 20,
  showGrid: boolean = true
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  canvas.width = gridWidth * pixelSize;
  canvas.height = gridHeight * pixelSize;

  // Draw pixels
  for (let i = 0; i < pixels.length; i++) {
    const pixel = pixels[i];
    const x = (i % gridWidth) * pixelSize;
    const y = Math.floor(i / gridWidth) * pixelSize;

    ctx.fillStyle = pixel.hex;
    ctx.fillRect(x, y, pixelSize, pixelSize);

    // Draw grid lines if enabled
    if (showGrid) {
      ctx.strokeStyle = '#e8e8e8';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, pixelSize, pixelSize);
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
 * Export color statistics as CSV
 */
export function exportStatsAsCSV(
  colorStats: Map<string, number>,
  palette: Map<string, ColorData>,
  fileName: string = 'perler-stats.csv'
): void {
  const rows: string[] = ['code,name,hex,count'];

  // Sort by code for consistency
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
 * Get total bead count (grid width × grid height)
 */
export function getTotalBeadCount(
  gridWidth: number,
  gridHeight: number
): number {
  return gridWidth * gridHeight;
}
