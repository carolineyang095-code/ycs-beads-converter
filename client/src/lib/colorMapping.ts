/**
 * Color Mapping Library
 * Handles RGB to Artkal palette color mapping using Euclidean distance
 */

export interface ColorData {
  code: string;
  name: string;
  hex: string;
  rgb: {
    r: number;
    g: number;
    b: number;
  };
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Calculate Euclidean distance between two RGB colors
 * Formula: sqrt((r1-r2)^2 + (g1-g2)^2 + (b1-b2)^2)
 */
export function euclideanDistance(color1: RGB, color2: RGB): number {
  const dr = color1.r - color2.r;
  const dg = color1.g - color2.g;
  const db = color1.b - color2.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Find the closest color in the palette to the given RGB color
 */
export function findClosestColor(
  targetColor: RGB,
  palette: ColorData[]
): ColorData {
  let closestColor = palette[0];
  let minDistance = euclideanDistance(targetColor, palette[0].rgb);

  for (let i = 1; i < palette.length; i++) {
    const distance = euclideanDistance(targetColor, palette[i].rgb);
    if (distance < minDistance) {
      minDistance = distance;
      closestColor = palette[i];
    }
  }

  return closestColor;
}

/**
 * Convert hex color string to RGB object
 */
export function hexToRgb(hex: string): RGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Convert RGB object to hex string
 */
export function rgbToHex(rgb: RGB): string {
  const toHex = (n: number) => {
    const hex = n.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`.toUpperCase();
}

/**
 * Get the dominant color (most frequent) from a pixel region
 * Used to determine the primary color for a grid cell
 */
export function getDominantColor(
  imageData: Uint8ClampedArray,
  startIndex: number,
  width: number,
  height: number,
  cellX: number,
  cellY: number,
  cellWidth: number,
  cellHeight: number
): RGB {
  const colorMap = new Map<string, number>();
  let maxCount = 0;
  let dominantColor: RGB = { r: 0, g: 0, b: 0 };

  // Iterate through all pixels in the cell
  for (let y = 0; y < cellHeight; y++) {
    for (let x = 0; x < cellWidth; x++) {
      const pixelX = cellX * cellWidth + x;
      const pixelY = cellY * cellHeight + y;

      // Ensure we're within bounds
      if (pixelX >= width || pixelY >= height) continue;

      const pixelIndex = (pixelY * width + pixelX) * 4;
      const r = imageData[pixelIndex];
      const g = imageData[pixelIndex + 1];
      const b = imageData[pixelIndex + 2];
      const a = imageData[pixelIndex + 3];

      // Skip transparent pixels
      if (a < 128) continue;

      const colorKey = `${r},${g},${b}`;
      const count = (colorMap.get(colorKey) || 0) + 1;
      colorMap.set(colorKey, count);

      if (count > maxCount) {
        maxCount = count;
        dominantColor = { r, g, b };
      }
    }
  }

  return dominantColor;
}

/**
 * Create a color index map for quick palette lookups
 */
export function createColorIndex(palette: ColorData[]): Map<string, ColorData> {
  const index = new Map<string, ColorData>();
  for (const color of palette) {
    index.set(color.code, color);
  }
  return index;
}
