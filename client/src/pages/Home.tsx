import HeroIntro from '@/components/HeroIntro';
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload, Download, Paintbrush, Eraser,
  Pipette, Eye, EyeOff, RotateCcw, ZoomIn, ZoomOut,
  SlidersHorizontal, Layers, Sparkles, Loader2, Palette
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import ImageUploadSection from '@/components/ImageUploadSection';
import ShopifyIntegration from '@/components/ShopifyIntegration';
import NoiseColorRemoval from '@/components/NoiseColorRemoval';
import {
  loadImage, resizeImageToGrid, processImageToGrid, drawPixelGrid,
  exportGridAsPNG, exportStatsAsCSV, calculateGridDimensions,
  getAspectRatioString, getPixelAt, setPixelAt,
  PixelGridCell, ProcessedImage
} from '@/lib/imageProcessing';
import { exportFullPatternPNG } from '@/lib/exportPattern';
import { createColorIndex, ColorData } from '@/lib/colorMapping';


type EditTool = 'none' | 'brush' | 'eraser' | 'eyedropper';
  const MAX_COLOR_OPTIONS = [20, 50, 100, 150, 221] as const;
  type MaxColors = typeof MAX_COLOR_OPTIONS[number];

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
  const [ditherStrength, setDitherStrength] = useState<number>(30);
  const [maxColorIndex, setMaxColorIndex] = useState(1);    // 默认 50（index=1）
  const maxColors = MAX_COLOR_OPTIONS[maxColorIndex];

  // previewMode=false：干净（无网格线）
  // previewMode=true：显示网格线（方便照着拼）
  const [previewMode, setPreviewMode] = useState(false); 

  // ===== Brush size (1~30) =====
  const [brushSize, setBrushSize] = useState<number>(1);

  // ===== Palette popup =====
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Noise color removal state
  const [removedColors, setRemovedColors] = useState<Map<string, string>>(new Map());
  const [baseProcessed, setBaseProcessed] = useState<ProcessedImage | null>(null);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorIndexRef = useRef<Map<string, ColorData>>(new Map());
  const processingTimeoutRef = useRef<number | null>(null);

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
        setError(`Failed to load palette: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };
    loadPalette();
  }, []);

  // Process image - debounced to prevent UI freeze
  const processImage = useCallback((
    canvas: HTMLCanvasElement,
    gridW: number,
    gridH: number,
    merge: number,
    bgRemoval: boolean,
    excluded: Set<string>,
    dither: number

  ) => {
    if (palette.length === 0) return;

    if (processingTimeoutRef.current) {
      cancelAnimationFrame(processingTimeoutRef.current);
    }

    setIsProcessing(true);

    processingTimeoutRef.current = requestAnimationFrame(() => {
      try {
        const resized = resizeImageToGrid(canvas, gridW, gridH);
        const result = processImageToGrid(
  resized,
  gridW,
  gridH,
  palette,
  merge,
  bgRemoval,
  excluded,
  dither,
  { maxColors }
);
        setProcessed(result);
        setBaseProcessed(result);
        setRemovedColors(new Map());
      } catch (err) {
        setError(`Processing error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setIsProcessing(false);
      }
    });
  }, [palette, maxColors]);

  // Redraw canvas when visual settings change
  useEffect(() => {
    if (!processed || !canvasRef.current) return;
    try {
      drawPixelGrid(
        canvasRef.current, processed.gridWidth, processed.gridHeight,
        processed.pixels, pixelSize, previewMode, highlightCode,
        processed.backgroundIndices, showBackground
      );
    } catch (err) {
      console.error('Draw error:', err);
    }
  }, [processed, pixelSize, highlightCode, showBackground, previewMode]);

  useEffect(() => {
  if (sourceImage && dims) {
    processImage(
      sourceImage,
      dims.width,
      dims.height,
      mergeThreshold,
      enableBgRemoval,
      excludedCodes,
      ditherStrength
    );
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [maxColors]);

  // Handle image upload
  const handleImageUpload = async (file: File) => {
    setError(null);
    setExcludedCodes(new Set());
    setHighlightCode(null);
    setRemovedColors(new Map());
    try {
      setIsProcessing(true);
      const canvas = await loadImage(file);
      setSourceImage(canvas);
      const d = calculateGridDimensions(canvas, gridSize);
      setDims(d);
      processImage(canvas, d.width, d.height, mergeThreshold, enableBgRemoval, new Set(), ditherStrength);
    } catch (err) {
      setError(`Failed to load image: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
      processImage(sourceImage, d.width, d.height, mergeThreshold, enableBgRemoval, excludedCodes, ditherStrength);
    }
  };

  // Handle merge threshold change
  const handleMergeChange = (value: number[]) => {
    const merge = value[0];
    setMergeThreshold(merge);
    if (sourceImage && dims) {
      processImage(sourceImage, dims.width, dims.height, merge, enableBgRemoval, excludedCodes, ditherStrength);
    }
  };

  // Handle merge dither change
  const handleDitherChange = (value: number[]) => {
  const d = value[0];
  setDitherStrength(d);
  if (sourceImage && dims) {
    processImage(
      sourceImage,
      dims.width,
      dims.height,
      mergeThreshold,
      enableBgRemoval,
      excludedCodes,
      d
    );
  }
};

  // Handle background removal toggle
  const handleBgToggle = (enabled: boolean) => {
    setEnableBgRemoval(enabled);
    if (sourceImage && dims) {
      processImage(sourceImage, dims.width, dims.height, mergeThreshold, enabled, excludedCodes, ditherStrength);
    }
  };

  // Handle color exclusion (right-click in stats)
  const handleExcludeColor = (code: string) => {
    const newExcluded = new Set(excludedCodes);
    if (newExcluded.has(code)) {
      newExcluded.delete(code);
    } else {
      newExcluded.add(code);
    }
    setExcludedCodes(newExcluded);
    if (sourceImage && dims) {
      processImage(sourceImage, dims.width, dims.height, mergeThreshold, enableBgRemoval, newExcluded, ditherStrength);
    }
  };

  // === NOISE COLOR REMOVAL ===
  const handleRemoveNoiseColor = (code: string, replacementCode: string) => {
    if (!processed) return;

    const newPixels = processed.pixels.map((pixel) => {
      if (pixel.code === code && !pixel.isBackground) {
        const replacement = colorIndexRef.current.get(replacementCode);
        if (replacement) {
          return { ...pixel, code: replacement.code, hex: replacement.hex, rgb: replacement.rgb };
        }
      }
      return pixel;
    });

    const newStats = new Map<string, number>();
    newPixels.forEach((p, i) => {
      if (!processed.backgroundIndices.has(i)) {
        newStats.set(p.code, (newStats.get(p.code) || 0) + 1);
      }
    });

    const newRemoved = new Map(removedColors);
    newRemoved.set(code, replacementCode);
    setRemovedColors(newRemoved);
    setProcessed({ ...processed, pixels: newPixels, colorStats: newStats });
  };

  const handleRestoreColor = (code: string) => {
    if (!baseProcessed || !processed) return;

    const newPixels = processed.pixels.map((pixel, i) => {
      const basePixel = baseProcessed.pixels[i];
      if (basePixel && basePixel.code === code) {
        return { ...basePixel };
      }
      return pixel;
    });

    const newStats = new Map<string, number>();
    newPixels.forEach((p, i) => {
      if (!processed.backgroundIndices.has(i)) {
        newStats.set(p.code, (newStats.get(p.code) || 0) + 1);
      }
    });

    const newRemoved = new Map(removedColors);
    newRemoved.delete(code);
    setRemovedColors(newRemoved);
    setProcessed({ ...processed, pixels: newPixels, colorStats: newStats });
  };

  const handleRestoreAll = () => {
    if (!baseProcessed) return;
    setProcessed({ ...baseProcessed });
    setRemovedColors(new Map());
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

  function applyBrush(
    pixels: PixelGridCell[],
    gridW: number,
    gridH: number,
    x: number,
    y: number,
    size: number,
    color: ColorData
  ) {
    const half = Math.floor(size / 2);
    let out = pixels;

    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= gridW || yy >= gridH) continue;
        out = setPixelAt(out, gridW, xx, yy, color);
      }
    }
    return out;
  }

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
          toast(`Picked: ${color.code}`);
        }
      }
    } else if (activeTool === 'brush' && selectedColor) {
      const newPixels = applyBrush(
        processed.pixels,
        processed.gridWidth,
        processed.gridHeight,
        x,
        y,
        brushSize,
        selectedColor
      );
      const newStats = new Map<string, number>();
      newPixels.forEach((p, i) => {
        if (!processed.backgroundIndices.has(i)) {
          newStats.set(p.code, (newStats.get(p.code) || 0) + 1);
        }
      });
      setProcessed({ ...processed, pixels: newPixels, colorStats: newStats });
    } else if (activeTool === 'eraser') {
      const whiteColor: ColorData = { code: 'BG', name: 'Background', hex: '#FFFFFF', rgb: { r: 255, g: 255, b: 255 } };
      const bgColor = palette.find(c => c.hex === '#FFFFFF') || whiteColor;
      const newPixels = applyBrush(
        processed.pixels,
        processed.gridWidth,
        processed.gridHeight,
        x,
        y,
        brushSize,
        bgColor
      );
      const newStats = new Map<string, number>();
      newPixels.forEach((p, i) => {
        if (!processed.backgroundIndices.has(i)) {
          newStats.set(p.code, (newStats.get(p.code) || 0) + 1);
        }
      });
      setProcessed({ ...processed, pixels: newPixels, colorStats: newStats });
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
      setRemovedColors(new Map());
      processImage(sourceImage, dims.width, dims.height, 1, false, new Set(), ditherStrength);
    }
  };

  // Export handlers
  const handleExportPNG = () => {
    if (!processed || !dims) return;
    try {
      const exportCanvas = document.createElement('canvas');
      drawPixelGrid(exportCanvas, dims.width, dims.height, processed.pixels, 15, true, null, processed.backgroundIndices, showBackground);
      exportGridAsPNG(exportCanvas, `perler-${dims.width}x${dims.height}.png`);
      toast.success('Preview exported');
    } catch (err) {
      toast.error(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleExportPatternPNG = () => {
    if (!processed || !dims) return;
    try {
      exportFullPatternPNG(
        dims.width,
        dims.height,
        processed.pixels,
        processed.colorStats,
        colorIndexRef.current,
        processed.backgroundIndices,
        `perler-pattern-${dims.width}x${dims.height}.png`,
        { title: 'Bead Pattern' }
      );
      toast.success('Exporting pattern...');
    } catch (err) {
      toast.error(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleExportCSV = () => {
    if (!processed || !dims) return;
    try {
      exportStatsAsCSV(processed.colorStats, colorIndexRef.current, `perler-stats-${dims.width}x${dims.height}.csv`);
      toast.success('CSV exported');
    } catch (err) {
      toast.error(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Calculate totals
  const totalBeads = processed ? Array.from(processed.colorStats.values()).reduce((a, b) => a + b, 0) : 0;
  const totalColors = processed ? processed.colorStats.size : 0;

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <header className="border-b border-border bg-white px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#452F60' }}>
            Yaya’s Creative Studio
          </h1>
          <p className="text-xs" style={{ color: '#9867DA' }}>Turn Any Image into a Custom Bead Pattern · 221 Artkal Colors · One-Click Bead Order</p>
        </div>
        <div className="flex items-center gap-4">
  {processed && (
    <>
      {/* ===== Total Info ===== */}
      <div className="text-xs text-muted-foreground flex items-center gap-3">
        <span>
          Total: <span className="font-semibold">{totalBeads.toLocaleString()}</span> beads
        </span>
        <span>
          Colors: <span className="font-semibold">{totalColors}</span>
        </span>
      </div>

      {/* ===== Shopping Cart Summary ===== */}
      <div className="text-xs bg-purple-50 text-purple-700 px-3 py-1 rounded-md font-medium">
        🛒 {totalBeads.toLocaleString()} pcs
      </div>

      {/* ===== Export Button ===== */}
      <Button
        onClick={handleExportPatternPNG}
        size="sm"
        variant="default"
        className="text-xs gap-1"
      >
        <Download className="w-3 h-3" /> Export Pattern
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
                  <TooltipContent>Brush</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant={activeTool === 'eraser' ? 'default' : 'ghost'} className="h-8 w-8 p-0" onClick={() => setActiveTool(activeTool === 'eraser' ? 'none' : 'eraser')}>
                      <Eraser className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Eraser</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant={activeTool === 'eyedropper' ? 'default' : 'ghost'} className="h-8 w-8 p-0" onClick={() => setActiveTool(activeTool === 'eyedropper' ? 'none' : 'eyedropper')}>
                      <Pipette className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Eyedropper</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant={paletteOpen ? 'default' : 'ghost'}
                      className="h-8 w-8 p-0"
                      onClick={() => setPaletteOpen((v: boolean) => !v)}
                    >
                      <Palette className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Palette</TooltipContent>
                </Tooltip>
              </div>

              {/* Size Slider */}
              <div className="flex items-center gap-2 border-l border-border pl-3">
                <span className="text-xs text-muted-foreground">Size</span>
                <div className="w-32">
                  <Slider
                    value={[brushSize]}
                    onValueChange={(v) => setBrushSize(v[0])}
                    min={1}
                    max={30}
                    step={1}
                  />
                </div>
                <span className="text-xs font-mono text-muted-foreground w-6">{brushSize}</span>
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
                <TooltipContent>Reset</TooltipContent>
              </Tooltip>

              {/* Pixel info on hover */}
              {hoveredPixel && (
                <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-4 h-4 rounded border border-gray-300" style={{ backgroundColor: hoveredPixel.pixel.hex }} />
                  <span className="font-mono">{hoveredPixel.pixel.code}</span>
                  <span className="font-mono">{hoveredPixel.pixel.hex}</span>
                  <span>({hoveredPixel.x + 1}, {hoveredPixel.y + 1})</span>
                </div>
              )}
            </div>
          )}

          {/* Canvas */}
          <div className="flex-1 overflow-auto bg-gray-100 flex items-start justify-center p-4">
            {isProcessing && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-10">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </div>
              </div>
            )}
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
              
              <HeroIntro
  onUploadClick={() => {
    const panel = document.querySelector('[data-upload-panel="1"]') as HTMLElement | null;
    panel?.scrollIntoView({ behavior: "smooth", block: "start" });

    // 等滚动/渲染一帧，再触发文件选择
    requestAnimationFrame(() => {
      const fileInput =
  (panel?.querySelector('input[type="file"]') as HTMLInputElement | null) ??
  (document.querySelector('input[type="file"]') as HTMLInputElement | null);

fileInput?.click();
    });
  }}
  shopUrl="https://yayascreativestudio.com/"
/>
            )}
          </div>

          {/* Status bar */}
          {dims && processed && (
            <div className="border-t border-border px-4 py-1.5 flex items-center justify-between text-xs text-muted-foreground bg-gray-50 flex-shrink-0">
              <span>Grid: {dims.width} x {dims.height} | Ratio: {getAspectRatioString(dims.width, dims.height)}</span>
              <span>Total: {totalBeads.toLocaleString()} beads | Colors: {totalColors}</span>
            </div>
          )}
        </div>

        {/* Right: Controls Panel */}
        <div className="w-80 border-l border-border flex flex-col overflow-y-auto bg-white flex-shrink-0">
          {/* Upload */}
          <div className="p-4 border-b border-border" data-upload-panel="1">
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
                  <label className="text-xs font-medium text-foreground">Horizontal Grid Count</label>
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
                    Output: {dims.width} x {dims.height}
                  </p>
                )}
              </div>
              {/* Dithering Strength Slider */}
            <div>
             <div className="flex items-center justify-between mb-1.5">
               <label className="text-xs font-medium text-foreground">Dithering Strength</label>
               <span className="text-xs font-mono text-muted-foreground">{ditherStrength}</span>
            </div>
            <Slider
             value={[ditherStrength]}
             onValueChange={handleDitherChange}
             min={0}
             max={100}
             step={1}
             className="w-full"
             />
             <p className="text-[10px] text-muted-foreground mt-1">
              0 = off · 20–40 natural · 60+ grainy
              </p>
            </div>

<div>
  <div className="flex items-center justify-between mb-1.5">
    <label className="text-xs font-medium text-foreground">Max Colors</label>
    <span className="text-xs font-mono text-muted-foreground">{maxColors}</span>
  </div>

  <Slider
  value={[maxColorIndex]}
  onValueChange={(v) => setMaxColorIndex(v[0])}
  min={0}
  max={MAX_COLOR_OPTIONS.length - 1}
  step={1}
  className="w-full"
/>

  <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
    {MAX_COLOR_OPTIONS.map((n) => <span key={n}>{n}</span>)}
  </div>

  <p className="text-[10px] text-muted-foreground mt-1">
    221 = most vivid · 50 = cleaner cartoon · 20 = very simplified
  </p>
</div>

              {/* Merge Threshold Slider */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-foreground">Color Merge Threshold</label>
                  <span className="text-xs font-mono text-muted-foreground">{mergeThreshold}</span>
                </div>
                <Slider
                  value={[mergeThreshold]}
                  onValueChange={handleMergeChange}
                  min={1}
                  max={12}
                  step={1}
                  className="w-full"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Regions smaller than {mergeThreshold}px will be merged
                </p>
              </div>

              {/* Background Removal */}
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground">Remove Background</label>
                <Switch checked={enableBgRemoval} onCheckedChange={handleBgToggle} />
              </div>
            </div>
          )}

          {/* Noise Color Removal */}
          {processed && (
            <div className="p-4 border-b border-border">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3">
                <Sparkles className="w-3.5 h-3.5" /> Noise Removal
              </h3>
              <NoiseColorRemoval
                colorStats={processed.colorStats}
                palette={colorIndexRef.current}
                threshold={10}
                onRemoveColor={handleRemoveNoiseColor}
                onRestoreColor={handleRestoreColor}
                onRestoreAll={handleRestoreAll}
                removedColors={removedColors}
              />
            </div>
          )}

          {/* Color Statistics */}
          {processed && (
            <div className="p-4 border-b border-border">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3">
                <Layers className="w-3.5 h-3.5" /> Color Statistics ({totalColors})
              </h3>
              <p className="text-[10px] text-muted-foreground mb-2">
                Click to highlight · Right-click to exclude
              </p>
              <div className="space-y-0.5 max-h-72 overflow-y-auto">
                {Array.from(processed.colorStats.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([code, count]) => {
                    const color = colorIndexRef.current.get(code);
                    const pct = totalBeads > 0 ? ((count / totalBeads) * 100).toFixed(1) : '0';
                    const isExcluded = excludedCodes.has(code);
                    const isHighlighted = highlightCode === code;

                    return (
                      <div
                        key={code}
                        className={`flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
                          isHighlighted ? 'bg-purple-50 ring-1 ring-purple-300' : 'hover:bg-gray-50'
                        } ${isExcluded ? 'opacity-40 line-through' : ''}`}
                        onClick={() => handleHighlightColor(code)}
                        onContextMenu={(e) => { e.preventDefault(); handleExcludeColor(code); }}
                      >
                        {color && (
                          <div className="w-4 h-4 rounded-sm border border-gray-300 flex-shrink-0" style={{ backgroundColor: color.hex }} />
                        )}
                        <span className="font-mono font-medium flex-shrink-0 w-8">{code}</span>
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.max(2, parseFloat(pct))}%`, backgroundColor: color?.hex || '#999' }} />
                        </div>
                        <span className="text-muted-foreground flex-shrink-0 w-10 text-right font-mono">{count}</span>
                        <span className="text-muted-foreground flex-shrink-0 w-10 text-right">{pct}%</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Shopify Integration hidden */}
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
