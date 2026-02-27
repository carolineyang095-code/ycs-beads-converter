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
  gridInterval: 10,
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
    const totalWidth = gridWidth * cellSize + coordMargin + 40;
    const totalHeight = headerHeight + coordMargin + gridHeight * cellSize + legendHeight + 40;

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
  options?: ExportOptions
): void {
  // Load logo first
  const logo = new Image();
  logo.src = '/logo.png';
  logo.onload = () => {
    renderPattern(logo);
  };
  logo.onerror = () => {
    renderPattern(null);
  };

  function renderPattern(logoImg: HTMLImageElement | null) {
    try {
      const opts = { ...DEFAULT_OPTIONS, ...options };

      // High-definition cell size (increased from 16-50 to 24-60)
      if (opts.cellSize === 0) {
        opts.cellSize = Math.max(24, Math.min(60, Math.floor(4000 / Math.max(gridWidth, gridHeight))));
      }

      const coordMargin = opts.showCoordinates ? 40 : 0;
      const headerHeight = 150; // Increased for logo and additional text

      // Calculate legend dimensions (Grid layout: 4 columns)
      const legendEntries = Array.from(colorStats.entries())
        .sort((a, b) => a[0].localeCompare(b[0]));
      
      const legendItemWidth = 150; // Adjusted for new layout
      const legendItemHeight = 40; // Adjusted for new layout
      const legendCols = Math.floor((gridWidth * opts.cellSize + coordMargin) / legendItemWidth); // Dynamic columns based on grid width
      const legendRows = Math.ceil(legendEntries.length / legendCols);
      const legendPadding = 40;
      const legendHeight = opts.showLegend ? (legendRows * legendItemHeight + legendPadding + 60) : 0;

      // Calculate safe cell size
      const cellSize = calculateSafeCellSize(
        gridWidth, gridHeight,
        coordMargin, headerHeight,
        legendHeight,
        opts.cellSize
      );

      const gridPixelWidth = gridWidth * cellSize;
      const gridPixelHeight = gridHeight * cellSize;

      // Total canvas size
      const totalWidth = Math.max(gridPixelWidth + coordMargin + 40, legendCols * legendItemWidth + 40);
      const totalHeight = headerHeight + coordMargin + gridPixelHeight + legendHeight + 40;

      const canvas = document.createElement('canvas');
      canvas.width = totalWidth;
      canvas.height = totalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to create canvas');

      // Transparent background (do not fill with white)
      // ctx.fillStyle = '#FFFFFF';
      // ctx.fillRect(0, 0, totalWidth, totalHeight);

      // === HEADER ===
      let currentY = 20;
      if (logoImg) {
        const logoHeight = 60;
        const logoWidth = (logoImg.width / logoImg.height) * logoHeight;
        ctx.drawImage(logoImg, 20, currentY, logoWidth, logoHeight);
        currentY += logoHeight + 10;
      }

      ctx.fillStyle = '#452F60';
      ctx.font = 'bold 28px "Klee One", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText("Yaya's Creative Studio", 20, currentY);
      currentY += 35;

      ctx.font = '16px "Klee One", sans-serif';
      ctx.fillStyle = '#9867DA';
      ctx.fillText("Turn Any Image into a Custom Bead Pattern · 221 Artkal Colors · One-Click Bead Order", 20, currentY);
      currentY += 25;

      ctx.font = '14px "Klee One", sans-serif';
      ctx.fillStyle = '#9867DA';
      ctx.fillText("https://tools.yayascreativestudio.com/", 20, currentY);
      currentY += 30; // Adjust for spacing

      const totalBeads = Array.from(colorStats.values()).reduce((a, b) => a + b, 0);
      const totalColors = colorStats.size;

      ctx.font = '16px "Klee One", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#9867DA';
      ctx.fillText(
        `${totalColors} colors · ${totalBeads.toLocaleString()} beads · ${gridWidth}×${gridHeight}`,
        totalWidth - 20,
        40
      );

      const gridStartX = coordMargin + 20;
      const gridStartY = headerHeight + coordMargin;

      // === COORDINATE AXES ===
      if (opts.showCoordinates) {
        ctx.fillStyle = '#718096';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        for (let x = 0; x < gridWidth; x++) {
          if (x % opts.gridInterval === 0 || x === gridWidth - 1) {
            ctx.fillText(
              String(x + 1),
              gridStartX + x * cellSize + cellSize / 2,
              gridStartY - 5
            );
          }
        }

        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let y = 0; y < gridHeight; y++) {
          if (y % opts.gridInterval === 0 || y === gridHeight - 1) {
            ctx.fillText(
              String(y + 1),
              gridStartX - 8,
              gridStartY + y * cellSize + cellSize / 2
            );
          }
        }
      }

      // === GRID CELLS ===
      const showCodeText = opts.showCodes && cellSize >= 18;
      // Use thinner font for better clarity
      const fontSize = Math.max(8, Math.min(14, Math.floor(cellSize * 0.35)));

      for (let i = 0; i < pixels.length; i++) {
        const pixel = pixels[i];
        const col = i % gridWidth;
        const row = Math.floor(i / gridWidth);
        const x = gridStartX + col * cellSize;
        const y = gridStartY + row * cellSize;
        const isBg = backgroundIndices.has(i);

        // Fill cell
        if (isBg) {
          // Background removal area: semi-transparent or light gray
          ctx.fillStyle = 'rgba(245, 245, 245, 0.5)';
          ctx.fillRect(x, y, cellSize, cellSize);
        } else if (pixel.hex === 'transparent' || !pixel.code) {
          // Truly transparent (erased) area: do not fill, keep PNG transparent
          ctx.clearRect(x, y, cellSize, cellSize);
        } else {
          ctx.fillStyle = pixel.hex;
          ctx.fillRect(x, y, cellSize, cellSize);
        }

        // Draw color code inside cell
        if (showCodeText && !isBg) {
          const brightness = (pixel.rgb.r * 299 + pixel.rgb.g * 587 + pixel.rgb.b * 114) / 1000;
          ctx.fillStyle = brightness > 160 ? '#452F60' : '#FFFFFF';
          // Using thinner font weight (300 or 400) for clarity
          ctx.font = `400 ${fontSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(pixel.code, x + cellSize / 2, y + cellSize / 2);
        }
      }

      // === GRID LINES ===
      if (opts.showGrid) {
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 0.5;

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

        // Bold lines at intervals
        ctx.strokeStyle = '#A0AEC0';
        ctx.lineWidth = 1.2;
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
        ctx.strokeStyle = '#452F60';
        ctx.lineWidth = 2;
        ctx.strokeRect(gridStartX, gridStartY, gridPixelWidth, gridPixelHeight);
      }

      // === LEGEND (圆角矩形网格排版) ===
      if (opts.showLegend && legendEntries.length > 0) {
        const legendStartY = gridStartY + gridPixelHeight + 40;
        
        // Separator
        ctx.strokeStyle = '#F0E6FF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(20, legendStartY - 20);
        ctx.lineTo(totalWidth - 20, legendStartY - 20);
        ctx.stroke();

        ctx.font = 'bold 18px "Klee One", sans-serif';
        ctx.fillStyle = '#452F60';
        ctx.textAlign = 'left';
        ctx.fillText('Color Breakdown', 20, legendStartY);

        const legendGridStartX = 20;
        const legendGridStartY = legendStartY + 20;

        // Calculate actual columns based on available width
        const availableLegendWidth = totalWidth - 40; // 20px padding on each side
        const actualLegendCols = Math.max(1, Math.floor(availableLegendWidth / legendItemWidth));

        for (let i = 0; i < legendEntries.length; i++) {
          const [code, count] = legendEntries[i];
          const color = palette.get(code);
          const col = i % actualLegendCols;
          const row = Math.floor(i / actualLegendCols);
          
          const x = legendGridStartX + col * legendItemWidth;
          const y = legendGridStartY + row * legendItemHeight;
          
          // Draw rounded rectangle background
          const rectW = legendItemWidth - 15;
          const rectH = legendItemHeight - 10;
          const radius = 8;
          
          ctx.fillStyle = color ? color.hex : '#F7F7F7';
          
        // Draw rounded rect
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + rectW - radius, y);
        ctx.quadraticCurveTo(x + rectW, y, x + rectW, y + radius);
        ctx.lineTo(x + rectW, y + rectH - radius);
        ctx.quadraticCurveTo(x + rectW, y + rectH, x + rectW - radius, y + rectH);
        ctx.lineTo(x + radius, y + rectH);
        ctx.quadraticCurveTo(x, y + rectH, x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        
        // Fill legend background with white first to ensure text is readable even on transparent PNG
        ctx.save();
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.restore();
        
        ctx.fill();
          
          // Border for light colors
          const brightness = color ? (color.rgb.r * 299 + color.rgb.g * 587 + color.rgb.b * 114) / 1000 : 255;
          if (brightness > 220) {
            ctx.strokeStyle = '#E2E8F0';
            ctx.lineWidth = 1;
            ctx.stroke();
          }

          // Text inside rounded rect
          ctx.fillStyle = brightness > 160 ? '#452F60' : '#FFFFFF';
          ctx.font = 'bold 14px sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(code, x + 12, y + rectH / 2);
          
          ctx.font = '14px sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(`(${count})`, x + rectW - 12, y + rectH / 2);
        }

        // Footer Total
        ctx.fillStyle = '#9867DA';
        ctx.font = 'bold 16px "Klee One", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(
          `Total: ${totalBeads.toLocaleString()} beads`,
          totalWidth - 20,
          legendGridStartY + legendRows * legendItemHeight + 20
        );
      }

      // Download
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
