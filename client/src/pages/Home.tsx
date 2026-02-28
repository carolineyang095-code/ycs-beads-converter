import HeroIntro from '@/components/HeroIntro';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Upload, Download, Paintbrush, Eraser,
  Pipette, Eye, EyeOff, RotateCcw, ZoomIn, ZoomOut,
  SlidersHorizontal, Layers, Sparkles, Loader2, Palette, Copy, Check
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
  const [canvasSource, setCanvasSource] = useState<'image' | 'manual'>('image');
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
  const [pixelSize, setPixelSize] = useState(20);
  const [isPinching, setIsPinching] = useState(false);
  const lastPinchDistRef = useRef<number | null>(null);
  const [hoveredPixel, setHoveredPixel] = useState<{ x: number; y: number; pixel: PixelGridCell } | null>(null);
  const [ditherStrength, setDitherStrength] = useState<number>(30);
  const [maxColorIndex, setMaxColorIndex] = useState(1);    // 默认 50（index=1）
  const maxColors = MAX_COLOR_OPTIONS[maxColorIndex];

  // isPreview=false：显示网格线
  // isPreview=true：隐藏网格线（预览模式）
  const [isPreview, setIsPreview] = useState(false);

  // ===== Brush size (1~30) =====
  const [brushSize, setBrushSize] = useState<number>(1);

  // ===== Palette popup =====
  const [paletteOpen, setPaletteOpen] = useState(false);

  // ===== Drawing state =====
  const [isDrawing, setIsDrawing] = useState(false);

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
        processed.pixels, pixelSize, !isPreview, highlightCode,
        processed.backgroundIndices, showBackground
      );
    } catch (err) {
      console.error('Draw error:', err);
    }
  }, [processed, pixelSize, highlightCode, showBackground, isPreview]);

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
      setCanvasSource('image');
      const d = calculateGridDimensions(canvas, gridSize);
      setDims(d);
      processImage(canvas, d.width, d.height, mergeThreshold, enableBgRemoval, new Set(), ditherStrength);
    } catch (err) {
      setError(`Failed to load image: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsProcessing(false);
    }
  };

  // Re-generate from current source image
  const handleRegenerateFromImage = () => {
    if (!sourceImage) return;
    setCanvasSource('image');
    const d = calculateGridDimensions(sourceImage, gridSize);
    setDims(d);
    processImage(sourceImage, d.width, d.height, mergeThreshold, enableBgRemoval, excludedCodes, ditherStrength);
    toast.success('Re-generated from image');
  };

  // Handle create empty canvas
  const handleCreateCanvas = () => {
    setError(null);
    setExcludedCodes(new Set());
    setHighlightCode(null);
    setRemovedColors(new Map());
    setCanvasSource('manual');

    const width = gridSize;
    const height = gridSize;
    const d = { width, height };
    setDims(d);

    const emptyPixels: PixelGridCell[] = Array.from({ length: width * height }, () => ({
      code: '',
      hex: 'transparent',
      rgb: { r: 0, g: 0, b: 0 },
      originalRgb: { r: 0, g: 0, b: 0 },
      isBackground: false
    }));

    const result: ProcessedImage = {
      gridWidth: width,
      gridHeight: height,
      pixels: emptyPixels,
      colorStats: new Map(),
      backgroundCode: null,
      backgroundIndices: new Set()
    };

    setProcessed(result);
    setBaseProcessed(result);
    toast.success(`Created ${width}x${height} empty canvas`);
  };

  // Resize grid while preserving content (top-left anchor)
  const resizeGridPreserveContent = (oldProcessed: ProcessedImage, newWidth: number, newHeight: number): ProcessedImage => {
    const newPixels: PixelGridCell[] = Array.from({ length: newWidth * newHeight }, (_, i) => {
      const x = i % newWidth;
      const y = Math.floor(i / newWidth);
      
      if (x < oldProcessed.gridWidth && y < oldProcessed.gridHeight) {
        return oldProcessed.pixels[y * oldProcessed.gridWidth + x];
      }
      
      return {
        code: '',
        hex: 'transparent',
        rgb: { r: 0, g: 0, b: 0 },
        originalRgb: { r: 0, g: 0, b: 0 },
        isBackground: false
      };
    });

    const newStats = new Map<string, number>();
    newPixels.forEach((p) => {
      if (p.code && p.code !== 'BG' && p.hex !== 'transparent') {
        newStats.set(p.code, (newStats.get(p.code) || 0) + 1);
      }
    });

    return {
      ...oldProcessed,
      gridWidth: newWidth,
      gridHeight: newHeight,
      pixels: newPixels,
      colorStats: newStats,
      backgroundIndices: new Set() // Reset background indices for manual mode
    };
  };

  // Handle grid size slider change
  const handleGridSizeChange = (value: number[]) => {
    const size = value[0];
    setGridSize(size);
    
    if (canvasSource === 'image' && sourceImage) {
      const d = calculateGridDimensions(sourceImage, size);
      setDims(d);
      processImage(sourceImage, d.width, d.height, mergeThreshold, enableBgRemoval, excludedCodes, ditherStrength);
    } else if (canvasSource === 'manual' && processed) {
      // For manual mode, we maintain square aspect ratio for simplicity or follow current dims
      // Here we'll keep it square as per "Create Canvas" logic
      const newWidth = size;
      const newHeight = size;
      const d = { width: newWidth, height: newHeight };
      setDims(d);
      
      const resized = resizeGridPreserveContent(processed, newWidth, newHeight);
      setProcessed(resized);
      setBaseProcessed(resized);
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
      if (!processed.backgroundIndices.has(i) && p.code && p.code !== 'BG' && p.hex !== 'transparent') {
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
      if (!processed.backgroundIndices.has(i) && p.code && p.code !== 'BG' && p.hex !== 'transparent') {
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

  // Bead Breakdown logic
  const breakdownText = useMemo(() => {
    if (!processed) return '';
    
    // Filter out excluded colors, BG, and empty codes
    const entries = Array.from(processed.colorStats.entries())
      .filter(([code]) => {
        const color = colorIndexRef.current.get(code);
        return code && code !== 'BG' && !excludedCodes.has(code) && color && color.hex !== 'transparent';
      })
      .sort((a, b) => a[0].localeCompare(b[0])); // Sort alphabetically by code

    return entries.map(([code, count]) => `${code}:${count}`).join('; ');
  }, [processed, excludedCodes]);

  const [copied, setCopied] = useState(false);
  const handleCopyBreakdown = () => {
    if (!breakdownText) return;
    navigator.clipboard.writeText(breakdownText).then(() => {
      setCopied(true);
      toast.success('Copied breakdown to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy: ', err);
      toast.error('Failed to copy. Please select and copy manually.');
    });
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

      // Continuous drawing
      if (isDrawing && (activeTool === 'brush' || activeTool === 'eraser')) {
        handleCanvasAction(x, y);
      }
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
    color: ColorData | null
  ) {
    const half = Math.floor(size / 2);
    let out = pixels;

    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= gridW || yy >= gridH) continue;
        if (color) {
          out = setPixelAt(out, gridW, xx, yy, color);
        } else {
          // Eraser: set to transparent/background
          const idx = yy * gridW + xx;
          const newPixels = [...out];
          newPixels[idx] = { 
            code: 'BG', 
            hex: 'transparent', 
            rgb: { r: 0, g: 0, b: 0 }, 
            originalRgb: { r: 0, g: 0, b: 0 },
            isBackground: true 
          };
          out = newPixels;
        }
      }
    }
    return out;
  }

  const handleCanvasAction = useCallback((x: number, y: number) => {
    if (!processed || !dims) return;

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
        if (!processed.backgroundIndices.has(i) && p.code && p.code !== 'BG' && p.hex !== 'transparent') {
          newStats.set(p.code, (newStats.get(p.code) || 0) + 1);
        }
      });
      setProcessed({ ...processed, pixels: newPixels, colorStats: newStats });
    } else if (activeTool === 'eraser') {
      const newPixels = applyBrush(
        processed.pixels,
        processed.gridWidth,
        processed.gridHeight,
        x,
        y,
        brushSize,
        null // Pass null for eraser to set transparent
      );
      const newStats = new Map<string, number>();
      newPixels.forEach((p, i) => {
        if (!processed.backgroundIndices.has(i) && p.code && p.code !== 'BG' && p.hex !== 'transparent') {
          newStats.set(p.code, (newStats.get(p.code) || 0) + 1);
        }
      });
      setProcessed({ ...processed, pixels: newPixels, colorStats: newStats });
    }
  }, [processed, dims, activeTool, selectedColor, brushSize, palette]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!processed || !canvasRef.current) return;
    setIsDrawing(true);
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX / pixelSize);
    const y = Math.floor((e.clientY - rect.top) * scaleY / pixelSize);

    if (x >= 0 && y >= 0 && x < processed.gridWidth && y < processed.gridHeight) {
      handleCanvasAction(x, y);
    }
  };

  const handleCanvasMouseUp = () => {
    setIsDrawing(false);
  };

  const handleCanvasMouseLeave = () => setHoveredPixel(null);

  // Zoom controls
  const zoomIn = () => setPixelSize(prev => Math.min(100, prev + 2));
  const zoomOut = () => setPixelSize(prev => Math.max(4, prev - 2));

  // Handle pinch-to-zoom for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setIsPinching(true);
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      lastPinchDistRef.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isPinching && e.touches.length === 2 && lastPinchDistRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      const delta = dist - lastPinchDistRef.current;
      
      if (Math.abs(delta) > 2) {
        setPixelSize(prev => {
          const next = prev + (delta > 0 ? 1 : -1);
          return Math.max(4, Math.min(100, next));
        });
        lastPinchDistRef.current = dist;
      }
    }
  };

  const handleTouchEnd = () => {
    setIsPinching(false);
    lastPinchDistRef.current = null;
  };

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

  // Calcu  // Calculate totals
  const filteredColorStats = useMemo(() => {
    if (!processed) return new Map<string, number>();
    return new Map(
      Array.from(processed.colorStats.entries())
        .filter(([code]) => code && code !== 'BG' && !excludedCodes.has(code))
    );
  }, [processed, excludedCodes]);

  const totalBeads = useMemo(() => {
    return Array.from(filteredColorStats.values()).reduce((a, b) => a + b, 0);
  }, [filteredColorStats]);

  const totalColors = filteredColorStats.size;e : 0;

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

      {/* ===== Add to Cart Button ===== */}
      <ShopifyIntegration colorStats={filteredColorStats} />

      {/* ===== Export Button ===== */}
      <Button
        onClick={handleExportPatternPNG}
        size="sm"
        variant="outline"
        className="text-xs gap-1 border-[#9867DA] text-[#9867DA] hover:bg-purple-50 rounded-full px-4"
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
              {/* Preview Toggle */}
              <div className="flex items-center gap-2 border-r border-border pr-3">
                <span className="text-xs font-medium text-muted-foreground">Preview</span>
                <Switch
                  checked={isPreview}
                  onCheckedChange={setIsPreview}
                />
              </div>

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
                  <TooltipContent>Eyedropper</TooltipContent>
                </Tooltip>
                <div className="relative">
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
                    <TooltipContent>Full Palette</TooltipContent>
                  </Tooltip>

                  {paletteOpen && (
                    <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-border rounded-lg shadow-xl z-50 p-3 max-h-[500px] overflow-y-auto">
                      <div className="flex items-center justify-between mb-3 border-b pb-2">
                        <h4 className="text-sm font-semibold text-[#452F60]">Artkal 221 Palette</h4>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setPaletteOpen(false)}>×</Button>
                      </div>
                      
                      {/* Group colors by their first letter (Family) */}
                      {Array.from(new Set(palette.map(c => c.code[0]))).sort().map(family => (
                        <div key={family} className="mb-4">
                          <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-2">
                            <span className="w-4 h-[1px] bg-border"></span>
                            Family {family}
                          </h5>
                          <div className="grid grid-cols-8 gap-1.5">
                            {palette
                              .filter(c => c.code.startsWith(family))
                              .map(color => {
                                const isH01 = color.code === 'H01';
                                return (
                                  <Tooltip key={color.code}>
                                    <TooltipTrigger asChild>
                                      <button
                                        className={`w-7 h-7 rounded-sm border transition-transform hover:scale-110 relative overflow-hidden ${
                                          selectedColor?.code === color.code ? 'ring-2 ring-purple-500 ring-offset-1 border-transparent' : 'border-gray-200'
                                        }`}
                                        style={{ backgroundColor: color.hex }}
                                        onClick={() => {
                                          setSelectedColor(color);
                                          setActiveTool('brush');
                                          setPaletteOpen(false);
                                          toast(`Selected: ${color.code}`);
                                        }}
                                      >
                                        {isH01 && (
                                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <div className="w-full h-[1px] bg-red-500 rotate-45 absolute"></div>
                                            <div className="w-full h-[1px] bg-red-500 -rotate-45 absolute"></div>
                                          </div>
                                        )}
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <div className="text-[10px]">
                                        <p className="font-bold">{color.code}</p>
                                        <p className="opacity-80">{color.hex}</p>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Size Slider */}
              <div className="flex items-center gap-2 border-l border-border pl-3">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Brush / Eraser Size</span>
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
          <div className="flex-1 overflow-auto flex items-start justify-center p-4 bg-gray-50">
            {isProcessing && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-10">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </div>
              </div>
            )}
            {(sourceImage || processed) && processed ? (
              <canvas
                ref={canvasRef}
                className="border border-border shadow-sm bg-white"
                style={{
                  imageRendering: 'pixelated',
                  cursor: activeTool === 'brush' ? 'crosshair' : activeTool === 'eraser' ? 'cell' : activeTool === 'eyedropper' ? 'copy' : 'default',
                }}
                onMouseMove={handleCanvasMouseMove}
                onMouseDown={handleCanvasMouseDown}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={() => {
                  handleCanvasMouseLeave();
                  handleCanvasMouseUp();
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
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
              <Upload className="w-3.5 h-3.5" /> Canvas Source
            </h3>
            <div className="space-y-2">
              <ImageUploadSection onImageUpload={handleImageUpload} isProcessing={isProcessing} />
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={handleCreateCanvas}
                  variant="outline"
                  className="w-full text-[10px] h-8 gap-1.5 border-dashed"
                  disabled={isProcessing}
                >
                  <Sparkles className="w-3 h-3" /> New Canvas
                </Button>
                <Button
                  onClick={handleRegenerateFromImage}
                  variant="outline"
                  className="w-full text-[10px] h-8 gap-1.5"
                  disabled={isProcessing || !sourceImage}
                >
                  <RotateCcw className="w-3 h-3" /> Reset to Image
                </Button>
              </div>
            </div>
          </div>

          {/* Processing Parameters */}
          {processed && (
            <div className="p-4 border-b border-border space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5" /> Parameters
              </h3>

              {/* Grid Size Slider */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-foreground">Canvas Width (Beads)</label>
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
              {/* Image-only Parameters */}
              {canvasSource === 'image' && (
                <>
                  {/* Dithering Strength Slider */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium text-foreground">Color Detail (Dithering)</label>
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
                      <label className="text-xs font-medium text-foreground">Color Palette Limit</label>
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
                      <label className="text-xs font-medium text-foreground">Simplify Small Areas</label>
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
                </>
              )}
            </div>
          )}

          {/* Noise Color Removal */}
          {processed && (
            <div className="p-4 border-b border-border">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3">
                <Sparkles className="w-3.5 h-3.5" /> Clean Up Stray Beads
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
                <Layers className="w-3.5 h-3.5" /> Bead Count & Colors ({totalColors})
              </h3>
              <p className="text-[10px] text-muted-foreground mb-2">
                Click to highlight · Right-click to exclude
              </p>
              <div className="space-y-0.5 max-h-72 overflow-y-auto mb-4">
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

              {/* Breakdown Copy Area */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Quick Breakdown</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px] gap-1 hover:bg-purple-50 text-[#9867DA]"
                    onClick={handleCopyBreakdown}
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied!' : 'Copy breakdown'}
                  </Button>
                </div>
                <textarea
                  readOnly
                  value={breakdownText}
                  className="w-full h-20 p-2 text-[10px] font-mono bg-gray-50 border border-border rounded resize-none focus:outline-none"
                  placeholder="No beads to show"
                />
              </div>
            </div>
          )}


        </div>
      </div>
    </div>
  );
}