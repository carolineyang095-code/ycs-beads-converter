/**
 * Color Mapping Library
 * Handles RGB to Artkal palette color mapping using Euclidean distance,
 * BFS color merging, background removal, and color exclusion.
 */

export interface ColorData {
  code: string;
  name: string;
  hex: string;
  family?: string;
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
 */
export function euclideanDistance(color1: RGB, color2: RGB): number {
  if (!color1 || !color2) return Infinity;
  const dr = (color1.r || 0) - (color2.r || 0);
  const dg = (color1.g || 0) - (color2.g || 0);
  const db = (color1.b || 0) - (color2.b || 0);
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Find the closest color in the palette to the given RGB color
 * Supports excluding certain color codes
 */
export function findClosestColor(
  targetColor: RGB,
  palette: ColorData[],
  excludedCodes?: Set<string>
): ColorData {
  let closestColor: ColorData | null = null;
  let minDistance = Infinity;

  for (let i = 0; i < palette.length; i++) {
    if (excludedCodes && excludedCodes.has(palette[i].code)) continue;
    if (palette[i].code === 'H01') continue;
    if (!palette[i].hex || palette[i].hex === '#null' || palette[i].hex === 'null') continue;
    const distance = euclideanDistance(targetColor, palette[i].rgb);
    if (distance < minDistance) {
      minDistance = distance;
      closestColor = palette[i];
    }
  }

  return closestColor || palette[0];
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
    const hex = Math.max(0, Math.min(255, n)).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`.toUpperCase();
}

/**
 * Get the dominant color (most frequent) from a pixel region
 */
export function getDominantColor(
  imageData: Uint8ClampedArray,
  _startIndex: number,
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

  for (let y = 0; y < cellHeight; y++) {
    for (let x = 0; x < cellWidth; x++) {
      const pixelX = cellX * cellWidth + x;
      const pixelY = cellY * cellHeight + y;

      if (pixelX >= width || pixelY >= height) continue;

      const pixelIndex = (pixelY * width + pixelX) * 4;
      const r = imageData[pixelIndex];
      const g = imageData[pixelIndex + 1];
      const b = imageData[pixelIndex + 2];
      const a = imageData[pixelIndex + 3];

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

/**
 * BFS Color Merging Algorithm
 * Merges small color regions into neighboring colors when the region size
 * is below a threshold, reducing noise and simplifying the pattern.
 * 
 * @param pixels - flat array of color codes (row-major)
 * @param gridWidth - number of columns
 * @param gridHeight - number of rows
 * @param mergeThreshold - minimum region size; regions smaller than this are merged
 * @param palette - color palette for finding closest replacement
 * @param colorIndex - map of code -> ColorData
 * @returns new pixel array with merged colors
 */
export function bfsMergeColors(
  pixels: string[],
  gridWidth: number,
  gridHeight: number,
  mergeThreshold: number,
  palette: ColorData[],
  colorIndex: Map<string, ColorData>,
  maxMergeDistance: number = 28,     // 越小越“硬朗”、越保轮廓（漫画推荐 22~32）
  edgeProtectDistance: number = 85    // 邻居对比太强 => 视为边缘，不 merge（漫画推荐 75~95）
): string[] {
  const result = [...pixels];
  const visited = new Array(pixels.length).fill(false);
  const directions = [
    [0, 1], [0, -1], [1, 0], [-1, 0],
  ];

  // Find all connected regions using BFS
  const regions: Array<{ code: string; indices: number[]; neighbors: Set<string> }> = [];

  for (let i = 0; i < pixels.length; i++) {
    if (visited[i]) continue;

    const code = pixels[i];
    if (code === 'TRANSPARENT' || code === '') continue;
    const indices: number[] = [];
    const neighbors = new Set<string>();
    const queue: number[] = [i];
    visited[i] = true;

    while (queue.length > 0) {
      const idx = queue.shift()!;
      indices.push(idx);

      const x = idx % gridWidth;
      const y = Math.floor(idx / gridWidth);

      for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= gridWidth || ny < 0 || ny >= gridHeight) continue;

        const nIdx = ny * gridWidth + nx;
        if (pixels[nIdx] === code) {
          if (!visited[nIdx]) {
            visited[nIdx] = true;
            queue.push(nIdx);
          }
        } else {
          const nCode = pixels[nIdx];
          if (nCode !== 'TRANSPARENT' && nCode !== '') {
            neighbors.add(nCode);
          }
        }
      }
    }

    regions.push({ code, indices, neighbors });
  }
// Merge small regions with edge protection + color distance control
for (const region of regions) {
  if (region.indices.length >= mergeThreshold * mergeThreshold) continue;
  if (region.neighbors.size === 0) continue;

  const regionColor = colorIndex.get(region.code);
  if (!regionColor) continue;

  const luminance = (rgb: { r: number; g: number; b: number }) => {
    if (!rgb) return 255;
    return ((rgb.r || 0) * 299 + (rgb.g || 0) * 587 + (rgb.b || 0) * 114) / 1000;
  };

  let bestNeighbor = region.code;
  let bestScore = Infinity;

  Array.from(region.neighbors).forEach((neighborCode) => {
  const neighborColor = colorIndex.get(neighborCode);
  if (!neighborColor) return;

  const dist = euclideanDistance(regionColor.rgb, neighborColor.rgb);

  const MAX_MERGE_DISTANCE = 28;
  if (dist > MAX_MERGE_DISTANCE) return;

  const lum = luminance(neighborColor.rgb);
  const darkBonus = (255 - lum) / 255;

  const score = dist - darkBonus * 6;

  if (score < bestScore) {
    bestScore = score;
    bestNeighbor = neighborCode;
  }
});

  if (bestNeighbor === region.code) continue;

  for (const idx of region.indices) {
    result[idx] = bestNeighbor;
  }
}

return result;
}

/**
 * Flood-fill background detection from image edges
 * Uses BFS from the four edges to detect background color
 * 
 * @param pixels - flat array of color codes
 * @param gridWidth - number of columns
 * @param gridHeight - number of rows
 * @param tolerance - how many different colors to consider as background
 * @returns Set of pixel indices that are background
 */
export function detectBackground(
  pixels: string[],
  gridWidth: number,
  gridHeight: number,
  tolerance: number = 10
): { backgroundIndices: Set<number>; backgroundCode: string | null } {
  // Count colors on the edges to find the most common edge color
  const edgeColorCounts = new Map<string, number>();

  // Top and bottom edges
  for (let x = 0; x < gridWidth; x++) {
    const topCode = pixels[x];
    const bottomCode = pixels[(gridHeight - 1) * gridWidth + x];
    edgeColorCounts.set(topCode, (edgeColorCounts.get(topCode) || 0) + 1);
    edgeColorCounts.set(bottomCode, (edgeColorCounts.get(bottomCode) || 0) + 1);
  }
  // Left and right edges
  for (let y = 0; y < gridHeight; y++) {
    const leftCode = pixels[y * gridWidth];
    const rightCode = pixels[y * gridWidth + gridWidth - 1];
    edgeColorCounts.set(leftCode, (edgeColorCounts.get(leftCode) || 0) + 1);
    edgeColorCounts.set(rightCode, (edgeColorCounts.get(rightCode) || 0) + 1);
  }

  // Find the most common edge color
  let bgCode: string | null = null;
  let maxCount = 0;
  edgeColorCounts.forEach((count, code) => {
    if (count > maxCount) {
      maxCount = count;
      bgCode = code;
    }
  });

  if (!bgCode) return { backgroundIndices: new Set(), backgroundCode: null };

  // BFS flood fill from all edge pixels that match bgCode
  const backgroundIndices = new Set<number>();
  const visited = new Array(pixels.length).fill(false);
  const queue: number[] = [];
  const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  // Seed from edges
  for (let x = 0; x < gridWidth; x++) {
    if (pixels[x] === bgCode) { queue.push(x); visited[x] = true; }
    const bIdx = (gridHeight - 1) * gridWidth + x;
    if (pixels[bIdx] === bgCode && !visited[bIdx]) { queue.push(bIdx); visited[bIdx] = true; }
  }
  for (let y = 0; y < gridHeight; y++) {
    const lIdx = y * gridWidth;
    if (pixels[lIdx] === bgCode && !visited[lIdx]) { queue.push(lIdx); visited[lIdx] = true; }
    const rIdx = y * gridWidth + gridWidth - 1;
    if (pixels[rIdx] === bgCode && !visited[rIdx]) { queue.push(rIdx); visited[rIdx] = true; }
  }

  while (queue.length > 0) {
    const idx = queue.shift()!;
    backgroundIndices.add(idx);

    const x = idx % gridWidth;
    const y = Math.floor(idx / gridWidth);

    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= gridWidth || ny < 0 || ny >= gridHeight) continue;
      const nIdx = ny * gridWidth + nx;
      if (!visited[nIdx] && pixels[nIdx] === bgCode) {
        visited[nIdx] = true;
        queue.push(nIdx);
      }
    }
  }

  return { backgroundIndices, backgroundCode: bgCode };
}

/**
 * Re-map pixels after excluding certain colors
 * Excluded pixels are remapped to the closest remaining palette color
 */
export function remapExcludedColors(
  pixels: Array<{ code: string; originalRgb: RGB }>,
  excludedCodes: Set<string>,
  palette: ColorData[]
): Array<{ code: string; hex: string; rgb: RGB }> {
  return pixels.map((pixel) => {
    if (excludedCodes.has(pixel.code)) {
      const closest = findClosestColor(pixel.originalRgb, palette, excludedCodes);
      return { code: closest.code, hex: closest.hex, rgb: closest.rgb };
    }
    const paletteColor = palette.find(c => c.code === pixel.code);
    return {
      code: pixel.code,
      hex: paletteColor?.hex || '#000000',
      rgb: paletteColor?.rgb || { r: 0, g: 0, b: 0 },
    };
  });
}
