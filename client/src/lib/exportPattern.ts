/**
 * Pattern Export Library
 * Generates a comprehensive PNG pattern sheet with:
 * - Header: title, total colors, total beads
 * - Grid: color-filled cells with color codes inside
 * - Coordinate axes: row/column numbers
 * - Footer: color palette legend with code, swatch, and count
 */

import { PixelGridCell } from './imageProcessing';
import { ColorData } from './colorMapping';

interface ExportOptions {
  title?: string;
  cellSize?: number; // pixel size per grid cell
  showGrid?: boolean;
  showCodes?: boolean;
  showCoordinates?: boolean;
  showLegend?: boolean;
  gridInterval?: number; // bold line every N cells
}

const DEFAULT_OPTIONS: Required<ExportOptions> = {
  title: '拼豆图纸',
  cellSize: 0, // auto-calculated
  showGrid: true,
  showCodes: true,
  showCoordinates: true,
  showLegend: true,
  gridInterval: 10,
};

/**
 * Export a full pattern sheet as PNG
 */
export function exportFullPatternPNG(
  gridWidth: number,
  gridHeight: number,
  pixels: PixelGridCell[],
  colorStats: Map<string, number>,
  palette: Map<string, ColorData>,
  backgroundIndices: Set<number>,
  fileName: string,
  options?: ExportOptions
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Auto-calculate cell size to keep image reasonable (target ~4000px wide max)
  if (opts.cellSize === 0) {
    opts.cellSize = Math.max(20, Math.min(50, Math.floor(4000 / Math.max(gridWidth, gridHeight))));
  }

  const cellSize = opts.cellSize;
  const coordMargin = opts.showCoordinates ? 30 : 0;
  const headerHeight = 50;
  const gridPixelWidth = gridWidth * cellSize;
  const gridPixelHeight = gridHeight * cellSize;

  // Calculate legend dimensions
  const legendEntries = Array.from(colorStats.entries())
    .sort((a, b) => a[0].localeCompare(b[0]));
  const legendCols = Math.min(4, Math.max(1, Math.floor((gridPixelWidth + coordMargin) / 250)));
  const legendRows = Math.ceil(legendEntries.length / legendCols);
  const legendRowHeight = 28;
  const legendHeight = opts.showLegend ? (legendRows * legendRowHeight + 40) : 0;

  // Total canvas size
  const totalWidth = gridPixelWidth + coordMargin + 20; // 20px right padding
  const totalHeight = headerHeight + coordMargin + gridPixelHeight + legendHeight + 20;

  const canvas = document.createElement('canvas');
  canvas.width = totalWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  // White background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  // === HEADER ===
  const totalBeads = Array.from(colorStats.values()).reduce((a, b) => a + b, 0);
  const totalColors = colorStats.size;

  ctx.fillStyle = '#2D3748';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(opts.title, coordMargin + 10, headerHeight / 2);

  // Summary on the right
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#4A5568';
  ctx.fillText(
    `${totalColors} 色 · ${totalBeads.toLocaleString()} 颗 · ${gridWidth}×${gridHeight}`,
    totalWidth - 20,
    headerHeight / 2
  );

  const gridStartX = coordMargin;
  const gridStartY = headerHeight + coordMargin;

  // === COORDINATE AXES ===
  if (opts.showCoordinates) {
    ctx.fillStyle = '#718096';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    // Column numbers (top)
    for (let x = 0; x < gridWidth; x++) {
      if (x % opts.gridInterval === 0 || x === gridWidth - 1) {
        ctx.fillText(
          String(x + 1),
          gridStartX + x * cellSize + cellSize / 2,
          gridStartY - 3
        );
      }
    }

    // Row numbers (left)
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let y = 0; y < gridHeight; y++) {
      if (y % opts.gridInterval === 0 || y === gridHeight - 1) {
        ctx.fillText(
          String(y + 1),
          gridStartX - 5,
          gridStartY + y * cellSize + cellSize / 2
        );
      }
    }
  }

  // === GRID CELLS ===
  for (let i = 0; i < pixels.length; i++) {
    const pixel = pixels[i];
    const col = i % gridWidth;
    const row = Math.floor(i / gridWidth);
    const x = gridStartX + col * cellSize;
    const y = gridStartY + row * cellSize;
    const isBg = backgroundIndices.has(i);

    // Fill cell
    if (isBg) {
      ctx.fillStyle = '#F7F7F7';
    } else {
      ctx.fillStyle = pixel.hex;
    }
    ctx.fillRect(x, y, cellSize, cellSize);

    // Draw color code inside cell
    if (opts.showCodes && !isBg && cellSize >= 16) {
      const brightness = (pixel.rgb.r * 299 + pixel.rgb.g * 587 + pixel.rgb.b * 114) / 1000;
      ctx.fillStyle = brightness > 128 ? '#1A202C' : '#FFFFFF';
      const fontSize = Math.max(7, Math.min(11, Math.floor(cellSize * 0.35)));
      ctx.font = `bold ${fontSize}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pixel.code, x + cellSize / 2, y + cellSize / 2);
    }
  }

  // === GRID LINES ===
  if (opts.showGrid) {
    // Thin grid lines
    ctx.strokeStyle = '#CBD5E0';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= gridWidth; x++) {
      ctx.beginPath();
      ctx.moveTo(gridStartX + x * cellSize, gridStartY);
      ctx.lineTo(gridStartX + x * cellSize, gridStartY + gridPixelHeight);
      ctx.stroke();
    }
    for (let y = 0; y <= gridHeight; y++) {
      ctx.beginPath();
      ctx.moveTo(gridStartX, gridStartY + y * cellSize);
      ctx.lineTo(gridStartX + gridPixelWidth, gridStartY + y * cellSize);
      ctx.stroke();
    }

    // Bold lines at intervals
    ctx.strokeStyle = '#4A5568';
    ctx.lineWidth = 1.5;
    for (let x = 0; x <= gridWidth; x += opts.gridInterval) {
      ctx.beginPath();
      ctx.moveTo(gridStartX + x * cellSize, gridStartY);
      ctx.lineTo(gridStartX + x * cellSize, gridStartY + gridPixelHeight);
      ctx.stroke();
    }
    for (let y = 0; y <= gridHeight; y += opts.gridInterval) {
      ctx.beginPath();
      ctx.moveTo(gridStartX, gridStartY + y * cellSize);
      ctx.lineTo(gridStartX + gridPixelWidth, gridStartY + y * cellSize);
      ctx.stroke();
    }

    // Border
    ctx.strokeStyle = '#2D3748';
    ctx.lineWidth = 2;
    ctx.strokeRect(gridStartX, gridStartY, gridPixelWidth, gridPixelHeight);
  }

  // === LEGEND ===
  if (opts.showLegend && legendEntries.length > 0) {
    const legendStartY = gridStartY + gridPixelHeight + 20;
    const colWidth = Math.floor((totalWidth - 20) / legendCols);

    // Separator line
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(10, legendStartY - 10);
    ctx.lineTo(totalWidth - 10, legendStartY - 10);
    ctx.stroke();

    for (let i = 0; i < legendEntries.length; i++) {
      const [code, count] = legendEntries[i];
      const color = palette.get(code);
      const col = i % legendCols;
      const row = Math.floor(i / legendCols);
      const lx = 10 + col * colWidth;
      const ly = legendStartY + row * legendRowHeight;

      // Color swatch
      if (color) {
        ctx.fillStyle = color.hex;
        ctx.fillRect(lx, ly, 18, 18);
        ctx.strokeStyle = '#CBD5E0';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(lx, ly, 18, 18);
      }

      // Code
      ctx.fillStyle = '#2D3748';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(code, lx + 24, ly + 9);

      // Count
      ctx.fillStyle = '#718096';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${count} 颗`, lx + colWidth - 10, ly + 9);
    }

    // Total at bottom-right
    ctx.fillStyle = '#2D3748';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(
      `总计: ${totalBeads.toLocaleString()} 颗`,
      totalWidth - 20,
      legendStartY + legendRows * legendRowHeight + 5
    );
  }

  // Download
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
