/**
 * Pattern Export Library
 * Generates a comprehensive PNG pattern sheet with:
 * - Header: Logo, title, total colors, total beads
 * - Grid: High-definition color-filled cells with color codes inside
 * - Coordinate axes: row/column numbers
 * - Footer: Color palette legend with rounded swatch, code, and count in a grid layout
 */

import { PixelGridCell } from './imageProcessing';
import { ColorData } from './colorMapping';

interface ExportOptions {
  title?: string;
  cellSize?: number;
  showGrid?: boolean;
  showCodes?: boolean;
  showCoordinates?: boolean;
  showLegend?: boolean;
  gridInterval?: number;
}

const DEFAULT_OPTIONS: Required<ExportOptions> = {
  title: 'Bead Pattern',
  cellSize: 0,
  showGrid: true,
  showCodes: true,
  showCoordinates: true,
  showLegend: true,
  gridInterval: 5, // User requested 5
};

// Browser canvas size limits (conservative)
const MAX_CANVAS_DIMENSION = 16384;
const MAX_CANVAS_AREA = 16384 * 16384;

/**
 * Calculate safe cell size that won't exceed canvas limits
 */
function calculateSafeCellSize(
  gridWidth: number,
  gridHeight: number,
  coordMargin: number,
  headerHeight: number,
  legendHeight: number,
  preferredCellSize: number
): number {
  let cellSize = preferredCellSize;

  for (let attempt = 0; attempt < 20; attempt++) {
    const totalWidth = gridWidth * cellSize + coordMargin * 2 + 80;
    const totalHeight = headerHeight + coordMargin * 2 + gridHeight * cellSize + legendHeight + 80;

    if (
      totalWidth <= MAX_CANVAS_DIMENSION &&
      totalHeight <= MAX_CANVAS_DIMENSION &&
      totalWidth * totalHeight <= MAX_CANVAS_AREA
    ) {
      return cellSize;
    }

    cellSize = Math.max(12, cellSize - 2);
  }

  return Math.max(12, cellSize);
}

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
  options?: ExportOptions,
  paletteType: 'mard' | 'artkal' = 'mard'
): void {
  const displayCode = (code: string): string =>
    paletteType === 'artkal' && code.startsWith('A') ? code.slice(1) : code;

  // Load logo first
  const logo = new Image();
  logo.src = '/yaya_logo_final.png';
  logo.onload = () => {
    renderPattern(logo);
  };
  logo.onerror = () => {
    renderPattern(null);
  };

  function renderPattern(logoImg: HTMLImageElement | null) {
    try {
      const opts = { ...DEFAULT_OPTIONS, ...options };

      // High-definition cell size
      if (opts.cellSize === 0) {
        opts.cellSize = Math.max(40, Math.min(80, Math.floor(8000 / Math.max(gridWidth, gridHeight))));
      }

      const coordMargin = opts.showCoordinates ? 80 : 20; // Increased for 4-side coordinates
      const headerHeight = 500; // Significantly increased to prevent overlap

      // Calculate legend dimensions
      const legendEntries = Array.from(colorStats.entries())
        .filter(([code]) => code !== 'BG')
        .sort((a, b) => a[0].localeCompare(b[0]));
      
      const legendItemWidth = 280; // Enlarged
      const legendItemHeight = 80; // Enlarged
      
      // Calculate safe cell size
      const cellSize = calculateSafeCellSize(
        gridWidth, gridHeight,
        coordMargin, headerHeight,
        0, // Legend height calculated later
        opts.cellSize
      );

      const gridPixelWidth = gridWidth * cellSize;
      const gridPixelHeight = gridHeight * cellSize;
      
      const legendCols = Math.max(1, Math.floor((gridPixelWidth + coordMargin * 2) / legendItemWidth));
      const legendRows = Math.ceil(legendEntries.length / legendCols);
      const legendHeight = opts.showLegend ? (legendRows * legendItemHeight + 150) : 0;

      // Total canvas size
      const totalWidth = Math.max(gridPixelWidth + coordMargin * 2 + 100, legendCols * legendItemWidth + 100);
      const totalHeight = headerHeight + gridPixelHeight + coordMargin * 2 + legendHeight + 100;

      const canvas = document.createElement('canvas');
      canvas.width = totalWidth;
      canvas.height = totalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to create canvas');

      ctx.imageSmoothingEnabled = true; // Enable for logo clarity

      // White background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, totalWidth, totalHeight);

      // === HEADER (Horizontal Layout) ===
      let currentY = 50;
      
      if (logoImg) {
        const logoHeight = 360; // 2x of previous 240
        const logoWidth = (logoImg.width / logoImg.height) * logoHeight;
        ctx.drawImage(logoImg, 40, currentY, logoWidth, logoHeight);
        
        // Text next to logo - Vertically Centered
        const textStartX = 40 + logoWidth + 80; // 80px gap
        const totalTextHeight = 48 + 25 + 42; // subtitle + gap + link
        let textY = currentY + (logoHeight - totalTextHeight) / 2;
        
        ctx.font = '500 48px "Inter", sans-serif';
        ctx.fillStyle = '#7B6A9B';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText("Turn Any Image into a Custom Bead Pattern", textStartX, textY);
        textY += 73; // 48 + 25 gap

        ctx.font = '400 42px "Inter", sans-serif';
        ctx.fillStyle = '#7B6A9B';
        ctx.fillText("https://tools.yayascreativestudio.com/", textStartX, textY);
      } else {
        ctx.fillStyle = '#452F60';
        ctx.font = 'bold 84px "Inter", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText("Yaya's Creative Studio", 40, currentY);
        currentY += 120;
        
        ctx.font = '500 48px "Inter", sans-serif';
        ctx.fillStyle = '#7B6A9B';
        ctx.fillText("Turn Any Image into a Custom Bead Pattern · 221 Artkal Colors · One-Click Bead Order", 40, currentY);
        currentY += 70;

        ctx.font = '400 42px "Inter", sans-serif';
        ctx.fillStyle = '#7B6A9B';
        ctx.fillText("https://tools.yayascreativestudio.com/", 40, currentY);
      }

      const totalBeads = Array.from(colorStats.values()).reduce((a, b) => a + b, 0);
      const totalColors = colorStats.size;

      ctx.font = 'bold 48px "Inter", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#7B6A9B';
      ctx.fillText(
        `${totalColors} colors · ${totalBeads.toLocaleString()} beads · ${gridWidth}×${gridHeight}`,
        totalWidth - 40,
        80
      );

      const gridStartX = coordMargin + 40;
      const gridStartY = headerHeight + 40;

      // === COORDINATE AXES (All four sides) ===
      if (opts.showCoordinates) {
        ctx.fillStyle = '#718096';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';

        // Top and Bottom
        for (let x = 0; x < gridWidth; x++) {
          if (x % opts.gridInterval === 0 || x === gridWidth - 1) {
            const label = String(x + 1);
            const posX = gridStartX + x * cellSize + cellSize / 2;
            // Top
            ctx.textBaseline = 'bottom';
            ctx.fillText(label, posX, gridStartY - 15);
            // Bottom
            ctx.textBaseline = 'top';
            ctx.fillText(label, posX, gridStartY + gridPixelHeight + 15);
          }
        }

        // Left and Right
        ctx.textBaseline = 'middle';
        for (let y = 0; y < gridHeight; y++) {
          if (y % opts.gridInterval === 0 || y === gridHeight - 1) {
            const label = String(y + 1);
            const posY = gridStartY + y * cellSize + cellSize / 2;
            // Left
            ctx.textAlign = 'right';
            ctx.fillText(label, gridStartX - 20, posY);
            // Right
            ctx.textAlign = 'left';
            ctx.fillText(label, gridStartX + gridPixelWidth + 20, posY);
          }
        }
      }

      // === GRID CELLS ===
      ctx.imageSmoothingEnabled = false; // Disable for sharp pixels
      const showCodeText = opts.showCodes && cellSize >= 18;
      const fontSize = Math.max(10, Math.min(24, Math.floor(cellSize * 0.38)));

      for (let i = 0; i < pixels.length; i++) {
        const pixel = pixels[i];
        const col = i % gridWidth;
        const row = Math.floor(i / gridWidth);
        const x0 = Math.round(gridStartX + col * cellSize);
        const y0 = Math.round(gridStartY + row * cellSize);
        const x1 = Math.round(gridStartX + (col + 1) * cellSize);
        const y1 = Math.round(gridStartY + (row + 1) * cellSize);
        const w = x1 - x0;
        const h = y1 - y0;
        const isBg = backgroundIndices.has(i);

        if (isBg || pixel.hex === 'transparent' || !pixel.code) {
          ctx.fillStyle = (col + row) % 2 === 0 ? '#F0F0F0' : '#E0E0E0';
          ctx.fillRect(x0, y0, w, h);
        } else {
          ctx.fillStyle = pixel.hex;
          ctx.fillRect(x0, y0, w, h);
        }

        if (showCodeText && !isBg) {
          const brightness = (pixel.rgb.r * 299 + pixel.rgb.g * 587 + pixel.rgb.b * 114) / 1000;
          ctx.fillStyle = brightness > 160 ? '#452F60' : '#FFFFFF';
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(displayCode(pixel.code), x0 + w / 2, y0 + h / 2);
        }
      }

      // === GRID LINES (Orange-Red) ===
      if (opts.showGrid) {
        ctx.strokeStyle = '#FF4500'; // Orange-Red
        ctx.lineWidth = 1.0;

        ctx.beginPath();
        for (let x = 0; x <= gridWidth; x++) {
          ctx.moveTo(gridStartX + x * cellSize, gridStartY);
          ctx.lineTo(gridStartX + x * cellSize, gridStartY + gridPixelHeight);
        }
        for (let y = 0; y <= gridHeight; y++) {
          ctx.moveTo(gridStartX, gridStartY + y * cellSize);
          ctx.lineTo(gridStartX + gridPixelWidth, gridStartY + y * cellSize);
        }
        ctx.stroke();

        // Bold lines at intervals (Every 5 cells)
        ctx.lineWidth = 3.0;
        ctx.beginPath();
        for (let x = 0; x <= gridWidth; x += opts.gridInterval) {
          ctx.moveTo(gridStartX + x * cellSize, gridStartY);
          ctx.lineTo(gridStartX + x * cellSize, gridStartY + gridPixelHeight);
        }
        for (let y = 0; y <= gridHeight; y += opts.gridInterval) {
          ctx.moveTo(gridStartX, gridStartY + y * cellSize);
          ctx.lineTo(gridStartX + gridPixelWidth, gridStartY + y * cellSize);
        }
        ctx.stroke();

        // Border
        ctx.lineWidth = 5;
        ctx.strokeRect(gridStartX, gridStartY, gridPixelWidth, gridPixelHeight);
      }

      // === LEGEND ===
      if (opts.showLegend && legendEntries.length > 0) {
        const legendStartY = gridStartY + gridPixelHeight + 100;
        
        ctx.strokeStyle = '#FF4500';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(40, legendStartY - 40);
        ctx.lineTo(totalWidth - 40, legendStartY - 40);
        ctx.stroke();

        ctx.font = 'bold 48px "Inter", sans-serif';
        ctx.fillStyle = '#452F60';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('Color Breakdown', 40, legendStartY);

        const legendGridStartX = 40;
        const legendGridStartY = legendStartY + 80;

        for (let i = 0; i < legendEntries.length; i++) {
          const [code, count] = legendEntries[i];
          const color = palette.get(code);
          const col = i % legendCols;
          const row = Math.floor(i / legendCols);
          
          const x = legendGridStartX + col * legendItemWidth;
          const y = legendGridStartY + row * legendItemHeight;
          
          const rectW = legendItemWidth - 30;
          const rectH = legendItemHeight - 20;
          const radius = 12;
          
          ctx.fillStyle = color ? color.hex : '#F7F7F7';
          
          ctx.beginPath();
          ctx.roundRect(x, y, rectW, rectH, radius);
          ctx.fill();
          
          const brightness = color ? (color.rgb.r * 299 + color.rgb.g * 587 + color.rgb.b * 114) / 1000 : 255;
          if (brightness > 220) {
            ctx.strokeStyle = '#E2E8F0';
            ctx.lineWidth = 2;
            ctx.stroke();
          }

          ctx.fillStyle = brightness > 160 ? '#452F60' : '#FFFFFF';
          ctx.font = 'bold 28px sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(displayCode(code), x + 20, y + rectH / 2);
          
          ctx.font = '24px sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(`(${count})`, x + rectW - 20, y + rectH / 2);
        }

        ctx.fillStyle = '#7B6A9B';
        ctx.font = 'bold 40px "Inter", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(
          `Total: ${totalBeads.toLocaleString()} beads`,
          totalWidth - 40,
          legendGridStartY + legendRows * legendItemHeight + 40
        );
      }

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }, 'image/png');

    } catch (error) {
      console.error('Export error:', error);
    }
  }
}
