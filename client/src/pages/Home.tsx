import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload, Download, Grid3x3, Maximize2, Paintbrush, Eraser,
  Pipette, ShoppingCart, Eye, EyeOff, RotateCcw, ZoomIn, ZoomOut,
  SlidersHorizontal, Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import ImageUploadSection from '@/components/ImageUploadSection';
import ColorStatistics from '@/components/ColorStatistics';
import ShopifyIntegration from '@/components/ShopifyIntegration';
import {
  loadImage, resizeImageToGrid, processImageToGrid, drawPixelGrid,
  exportGridAsPNG, exportStatsAsCSV, getTotalBeadCount, calculateGridDimensions,
  getAspectRatioString, getPixelAt, setPixelAt, exportGridWithCodesPNG,
  PixelGridCell, ProcessedImage
} from '@/lib/imageProcessing';
import { createColorIndex, ColorData } from '@/lib/colorMapping';

type EditTool = 'none' | 'brush' | 'eraser' | 'eyedropper';

export default function Home() {
  // Core state
  const [palette, setPalette] = useState<ColorData[]>([]);
  const [gridSize, setGridSize] = useState<number>(50);
  const [mergeThreshold, setMergeThreshold] = useState<number>(1);
  const [sourceImage, setSourceImage] = useState<HTMLCanvasElement | null>(null);
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);
  const [processed, setProcessed] = useState<ProcessedImage | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editing state
  const [activeTool, setActiveTool] = useState<EditTool>('none');
  const [selectedColor, setSelectedColor] = useState<ColorData | null>(null);
  const [highlightCode, setHighlightCode] = useState<string | null>(null);
  const [excludedCodes, setExcludedCodes] = useState<Set<string>>(new Set());
  const [enableBgRemoval, setEnableBgRemoval] = useState(false);
  const [showBackground, setShowBackground] = useState(true);
  const [pixelSize, setPixelSize] = useState(12);
  const [hoveredPixel, setHoveredPixel] = useState<{ x: number; y: number; pixel: PixelGridCell } | null>(null);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorIndexRef = useRef<Map<string, ColorData>>(new Map());

  // Load palette
  useEffect(() => {
    const loadPalette = async () => {
      try {
        const response = await fetch('/artkal_221.json');
        if (!response.ok) throw new Error('Failed to load color palette');
        const data: ColorData[] = await response.json();
        setPalette(data);
        colorIndexRef.current = createColorIndex(data);
      } catch (err) {
        setError(`Failed to load color palette: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };
    loadPalette();
  }, []);

  // Process image
  const processImage = useCallback((
    canvas: HTMLCanvasElement,
    gridW: number,
    gridH: number,
    merge: number,
    bgRemoval: boolean,
    excluded: Set<string>
  ) => {
    if (palette.length === 0) return;
    try {
      setIsProcessing(true);
      const resized = resizeImageToGrid(canvas, gridW, gridH);
      const result = processImageToGrid(resized, gridW, gridH, palette, merge, bgRemoval, excluded);
      setProcessed(result);
      if (canvasRef.current) {
        drawPixelGrid(canvasRef.current, gridW, gridH, result.pixels, pixelSize, true, highlightCode, result.backgroundIndices, showBackground);
      }
    } catch (err) {
      setError(`Processing error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [palette, pixelSize, highlightCode, showBackground]);

  // Redraw when visual settings change
  useEffect(() => {
    if (!processed || !canvasRef.current) return;
    drawPixelGrid(canvasRef.current, processed.gridWidth, processed.gridHeight, processed.pixels, pixelSize, true, highlightCode, processed.backgroundIndices, showBackground);
  }, [processed, pixelSize, highlightCode, showBackground]);

  // Handle image upload
  const handleImageUpload = async (file: File) => {
    setError(null);
    setExcludedCodes(new Set());
    setHighlightCode(null);
    try {
      setIsProcessing(true);
      const canvas = await loadImage(file);
      setSourceImage(canvas);
      const d = calculateGridDimensions(canvas, gridSize);
      setDims(d);
      processImage(canvas, d.width, d.height, mergeThreshold, enableBgRemoval, excludedCodes);
    } catch (err) {
      setError(`Failed to load image: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle grid size slider change
  const handleGridSizeChange = (value: number[]) => {
    const size = value[0];
    setGridSize(size);
    if (sourceImage) {
      const d = calculateGridDimensions(sourceImage, size);
      setDims(d);
      processImage(sourceImage, d.width, d.height, mergeThreshold, enableBgRemoval, excludedCodes);
    }
  };

  // Handle merge threshold change
  const handleMergeChange = (value: number[]) => {
    const merge = value[0];
    setMergeThreshold(merge);
    if (sourceImage && dims) {
      processImage(sourceImage, dims.width, dims.height, merge, enableBgRemoval, excludedCodes);
    }
  };

  // Handle background removal toggle
  const handleBgToggle = (enabled: boolean) => {
    setEnableBgRemoval(enabled);
    if (sourceImage && dims) {
      processImage(sourceImage, dims.width, dims.height, mergeThreshold, enabled, excludedCodes);
    }
  };

  // Handle color exclusion
  const handleExcludeColor = (code: string) => {
    const newExcluded = new Set(excludedCodes);
    if (newExcluded.has(code)) {
      newExcluded.delete(code);
    } else {
      newExcluded.add(code);
    }
    setExcludedCodes(newExcluded);
    if (sourceImage && dims) {
      processImage(sourceImage, dims.width, dims.height, mergeThreshold, enableBgRemoval, newExcluded);
    }
  };

  // Handle highlight color click
  const handleHighlightColor = (code: string | null) => {
    setHighlightCode(prev => prev === code ? null : code);
  };

  // Canvas mouse interaction
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!processed || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX / pixelSize);
    const y = Math.floor((e.clientY - rect.top) * scaleY / pixelSize);

    if (x >= 0 && x < processed.gridWidth && y >= 0 && y < processed.gridHeight) {
      const pixel = getPixelAt(processed.pixels, processed.gridWidth, x, y);
      if (pixel) setHoveredPixel({ x, y, pixel });
    } else {
      setHoveredPixel(null);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!processed || !canvasRef.current || !dims) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX / pixelSize);
    const y = Math.floor((e.clientY - rect.top) * scaleY / pixelSize);

    if (x < 0 || x >= processed.gridWidth || y < 0 || y >= processed.gridHeight) return;

    if (activeTool === 'eyedropper') {
      const pixel = getPixelAt(processed.pixels, processed.gridWidth, x, y);
      if (pixel) {
        const color = colorIndexRef.current.get(pixel.code);
        if (color) {
          setSelectedColor(color);
          toast(`Picked color: ${color.code}`);
        }
      }
    } else if (activeTool === 'brush' && selectedColor) {
      const newPixels = setPixelAt(processed.pixels, processed.gridWidth, x, y, selectedColor);
      // Recalculate stats
      const newStats = new Map<string, number>();
      newPixels.forEach((p, i) => {
        if (!processed.backgroundIndices.has(i)) {
          newStats.set(p.code, (newStats.get(p.code) || 0) + 1);
        }
      });
      const updated = { ...processed, pixels: newPixels, colorStats: newStats };
      setProcessed(updated);
    } else if (activeTool === 'eraser') {
      // Set to background color (white)
      const whiteColor: ColorData = { code: 'BG', name: 'Background', hex: '#FFFFFF', rgb: { r: 255, g: 255, b: 255 } };
      const bgColor = palette.find(c => c.hex === '#FFFFFF') || whiteColor;
      const newPixels = setPixelAt(processed.pixels, processed.gridWidth, x, y, bgColor);
      const newStats = new Map<string, number>();
      newPixels.forEach((p, i) => {
        if (!processed.backgroundIndices.has(i)) {
          newStats.set(p.code, (newStats.get(p.code) || 0) + 1);
        }
      });
      const updated = { ...processed, pixels: newPixels, colorStats: newStats };
      setProcessed(updated);
    }
  };

  const handleCanvasMouseLeave = () => setHoveredPixel(null);

  // Zoom controls
  const zoomIn = () => setPixelSize(prev => Math.min(40, prev + 2));
  const zoomOut = () => setPixelSize(prev => Math.max(4, prev - 2));

  // Reset processing
  const handleReset = () => {
    if (sourceImage && dims) {
      setExcludedCodes(new Set());
      setHighlightCode(null);
      setMergeThreshold(1);
      setEnableBgRemoval(false);
      processImage(sourceImage, dims.width, dims.height, 1, false, new Set());
    }
  };

  // Export handlers
  const handleExportPNG = () => {
    if (!processed || !dims) return;
    const exportCanvas = document.createElement('canvas');
    drawPixelGrid(exportCanvas, dims.width, dims.height, processed.pixels, 15, true, null, processed.backgroundIndices, showBackground);
    exportGridAsPNG(exportCanvas, `perler-${dims.width}x${dims.height}.png`);
  };

  const handleExportCodedPNG = () => {
    if (!processed || !dims) return;
    exportGridWithCodesPNG(dims.width, dims.height, processed.pixels, processed.backgroundIndices, `perler-coded-${dims.width}x${dims.height}.png`);
  };

  const handleExportCSV = () => {
    if (!processed || !dims) return;
    exportStatsAsCSV(processed.colorStats, colorIndexRef.current, `perler-stats-${dims.width}x${dims.height}.csv`);
  };

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <header className="border-b border-border bg-white px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-foreground">Perler Bead Pattern Converter</h1>
          <p className="text-xs text-muted-foreground">Artkal 221 Color Mapping</p>
        </div>
        <div className="flex items-center gap-2">
          {processed && (
            <>
              <Button onClick={handleExportPNG} size="sm" variant="outline" className="text-xs gap-1">
                <Download className="w-3 h-3" /> PNG
              </Button>
              <Button onClick={handleExportCodedPNG} size="sm" variant="outline" className="text-xs gap-1">
                <Download className="w-3 h-3" /> Coded PNG
              </Button>
              <Button onClick={handleExportCSV} size="sm" variant="outline" className="text-xs gap-1">
                <Download className="w-3 h-3" /> CSV
              </Button>
            </>
          )}
        </div>
      </header>

      {error && (
        <div className="mx-4 mt-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex-shrink-0">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Canvas Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          {processed && (
            <div className="border-b border-border px-4 py-2 flex items-center gap-3 flex-shrink-0 bg-gray-50">
              {/* Edit tools */}
              <div className="flex items-center gap-1 border-r border-border pr-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant={activeTool === 'brush' ? 'default' : 'ghost'} className="h-8 w-8 p-0" onClick={() => setActiveTool(activeTool === 'brush' ? 'none' : 'brush')}>
                      <Paintbrush className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Brush Tool</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant={activeTool === 'eraser' ? 'default' : 'ghost'} className="h-8 w-8 p-0" onClick={() => setActiveTool(activeTool === 'eraser' ? 'none' : 'eraser')}>
                      <Eraser className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Eraser Tool</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant={activeTool === 'eyedropper' ? 'default' : 'ghost'} className="h-8 w-8 p-0" onClick={() => setActiveTool(activeTool === 'eyedropper' ? 'none' : 'eyedropper')}>
                      <Pipette className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Eyedropper Tool</TooltipContent>
                </Tooltip>
              </div>

              {/* Selected color indicator */}
              {selectedColor && (
                <div className="flex items-center gap-1 border-r border-border pr-3">
                  <div className="w-5 h-5 rounded border border-gray-300" style={{ backgroundColor: selectedColor.hex }} />
                  <span className="text-xs font-medium">{selectedColor.code}</span>
                </div>
              )}

              {/* Zoom */}
              <div className="flex items-center gap-1 border-r border-border pr-3">
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={zoomOut}><ZoomOut className="w-4 h-4" /></Button>
                <span className="text-xs text-muted-foreground w-8 text-center">{pixelSize}px</span>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={zoomIn}><ZoomIn className="w-4 h-4" /></Button>
              </div>

              {/* Background toggle */}
              <div className="flex items-center gap-1 border-r border-border pr-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setShowBackground(!showBackground)}>
                      {showBackground ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{showBackground ? 'Hide' : 'Show'} Background</TooltipContent>
                </Tooltip>
              </div>

              {/* Reset */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleReset}>
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset All</TooltipContent>
              </Tooltip>

              {/* Pixel info on hover */}
              {hoveredPixel && (
                <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-4 h-4 rounded border border-gray-300" style={{ backgroundColor: hoveredPixel.pixel.hex }} />
                  <span className="font-mono">{hoveredPixel.pixel.code}</span>
                  <span className="font-mono">{hoveredPixel.pixel.hex}</span>
                  <span>({hoveredPixel.x}, {hoveredPixel.y})</span>
                </div>
              )}
            </div>
          )}

          {/* Canvas */}
          <div className="flex-1 overflow-auto bg-gray-100 flex items-start justify-center p-4">
            {sourceImage && processed ? (
              <canvas
                ref={canvasRef}
                className="border border-border shadow-sm bg-white"
                style={{
                  imageRendering: 'pixelated',
                  cursor: activeTool === 'brush' ? 'crosshair' : activeTool === 'eraser' ? 'cell' : activeTool === 'eyedropper' ? 'copy' : 'default',
                }}
                onMouseMove={handleCanvasMouseMove}
                onClick={handleCanvasClick}
                onMouseLeave={handleCanvasMouseLeave}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center h-full">
                <div className="text-center text-muted-foreground">
                  <Upload className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">Upload an image to get started</p>
                  <p className="text-sm mt-1">Supports JPG, PNG, WebP</p>
                </div>
              </div>
            )}
          </div>

          {/* Status bar */}
          {dims && processed && (
            <div className="border-t border-border px-4 py-1.5 flex items-center justify-between text-xs text-muted-foreground bg-gray-50 flex-shrink-0">
              <span>Grid: {dims.width} × {dims.height} | Ratio: {getAspectRatioString(dims.width, dims.height)}</span>
              <span>Total: {getTotalBeadCount(dims.width, dims.height)} beads | Colors: {processed.colorStats.size} | Non-BG: {Array.from(processed.colorStats.values()).reduce((a, b) => a + b, 0)}</span>
            </div>
          )}
        </div>

        {/* Right: Controls Panel */}
        <div className="w-80 border-l border-border flex flex-col overflow-y-auto bg-white flex-shrink-0">
          {/* Upload */}
          <div className="p-4 border-b border-border">
            <h3 className="text-xs font-semibold mb-2 uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" /> Upload Image
            </h3>
            <ImageUploadSection onImageUpload={handleImageUpload} isProcessing={isProcessing} />
          </div>

          {/* Processing Parameters */}
          {sourceImage && (
            <div className="p-4 border-b border-border space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5" /> Parameters
              </h3>

              {/* Grid Size Slider */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-foreground">Horizontal Grid</label>
                  <span className="text-xs font-mono text-muted-foreground">{gridSize}</span>
                </div>
                <Slider
                  value={[gridSize]}
                  onValueChange={handleGridSizeChange}
                  min={10}
                  max={250}
                  step={1}
                  className="w-full"
                />
                {dims && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Output: {dims.width}×{dims.height}
                  </p>
                )}
              </div>

              {/* Merge Threshold Slider */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-foreground">Color Merge</label>
                  <span className="text-xs font-mono text-muted-foreground">{mergeThreshold}</span>
                </div>
                <Slider
                  value={[mergeThreshold]}
                  onValueChange={handleMergeChange}
                  min={1}
                  max={50}
                  step={1}
                  className="w-full"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Regions smaller than {mergeThreshold} px are merged
                </p>
              </div>

              {/* Background Removal */}
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground">Background Removal</label>
                <Switch checked={enableBgRemoval} onCheckedChange={handleBgToggle} />
              </div>
            </div>
          )}

          {/* Color Statistics */}
          {processed && (
            <div className="p-4 border-b border-border">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3">
                <Layers className="w-3.5 h-3.5" /> Colors ({processed.colorStats.size})
              </h3>
              <p className="text-[10px] text-muted-foreground mb-2">
                Click to highlight · Right-click to exclude
              </p>
              <div className="space-y-0.5 max-h-72 overflow-y-auto">
                {Array.from(processed.colorStats.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([code, count]) => {
                    const color = colorIndexRef.current.get(code);
                    const total = Array.from(processed.colorStats.values()).reduce((a, b) => a + b, 0);
                    const pct = ((count / total) * 100).toFixed(1);
                    const isExcluded = excludedCodes.has(code);
                    const isHighlighted = highlightCode === code;

                    return (
                      <div
                        key={code}
                        className={`flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
                          isHighlighted ? 'bg-blue-50 ring-1 ring-blue-300' : 'hover:bg-gray-50'
                        } ${isExcluded ? 'opacity-40 line-through' : ''}`}
                        onClick={() => handleHighlightColor(code)}
                        onContextMenu={(e) => { e.preventDefault(); handleExcludeColor(code); }}
                      >
                        {color && (
                          <div className="w-4 h-4 rounded-sm border border-gray-300 flex-shrink-0" style={{ backgroundColor: color.hex }} />
                        )}
                        <span className="font-mono font-medium flex-shrink-0 w-8">{code}</span>
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color?.hex || '#999' }} />
                        </div>
                        <span className="text-muted-foreground flex-shrink-0 w-10 text-right">{count}</span>
                        <span className="text-muted-foreground flex-shrink-0 w-10 text-right">{pct}%</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Shopify Integration */}
          {processed && (
            <div className="p-4">
              <ShopifyIntegration
                colorStats={processed.colorStats}
                palette={colorIndexRef.current}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
