import HeroIntro from '@/components/HeroIntro';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Upload,
  Download,
  Paintbrush,
  Eraser,
  Pipette,
  Eye,
  EyeOff,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  SlidersHorizontal,
  Layers,
  Sparkles,
  Loader2,
  Palette,
  Minus,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import ImageUploadSection from '@/components/ImageUploadSection';
import NoiseColorRemoval from '@/components/NoiseColorRemoval';
import {
  loadImage,
  resizeImageToGrid,
  processImageToGrid,
  drawPixelGrid,
  exportGridAsPNG,
  exportStatsAsCSV,
  calculateGridDimensions,
  getAspectRatioString,
  getPixelAt,
  setPixelAt,
  PixelGridCell,
  ProcessedImage,
} from '@/lib/imageProcessing';
import { exportFullPatternPNG } from '@/lib/exportPattern';
import { createColorIndex, ColorData } from '@/lib/colorMapping';
import { buildShopifyCartUrl } from '@/lib/shopifyIntegration';

type EditTool = 'none' | 'brush' | 'eraser' | 'eyedropper';

const MAX_COLOR_OPTIONS = [20, 50, 100, 150, 221] as const;
type MaxColors = (typeof MAX_COLOR_OPTIONS)[number];

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export default function Home() {
  // ===== Shopify 固定参数（隐藏 UI，只保留一键加购）=====
  const SHOP_DOMAIN = 'https://yayascreativestudio.com';
  const SHOPIFY_VARIANT_ID = '57339981201782';

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

  // Pixel rendering size (not view zoom)
  const [pixelSize, setPixelSize] = useState(12);

  const [hoveredPixel, setHoveredPixel] = useState<{ x: number; y: number; pixel: PixelGridCell } | null>(null);

  const [ditherStrength, setDitherStrength] = useState<number>(30);
  const [maxColorIndex, setMaxColorIndex] = useState(1); // 默认 50（index=1）
  const maxColors: MaxColors = MAX_COLOR_OPTIONS[maxColorIndex];

  // previewMode=false：无网格线 / true：显示网格线
  const [previewMode, setPreviewMode] = useState(false);

  // ===== Brush / eraser size (1~100) =====
  const [brushSize, setBrushSize] = useState<number>(1);

  // ===== Palette popup =====
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [familyFilter, setFamilyFilter] = useState<string>('ALL'); // 'ALL' | 'A' | 'B'...

  // ===== View scale (UI zoom: desktop buttons + wheel; mobile pinch) =====
  const [viewScale, setViewScale] = useState<number>(1);

  // Noise color removal state
  const [removedColors, setRemovedColors] = useState<Map<string, string>>(new Map());
  const [baseProcessed, setBaseProcessed] = useState<ProcessedImage | null>(null);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorIndexRef = useRef<Map<string, ColorData>>(new Map());
  const processingRAFRef = useRef<number | null>(null);

  // Pinch refs
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartRef = useRef<{ dist: number; scale: number } | null>(null);

  const toolBtnClass = 'h-8 px-2 text-xs gap-1 flex items-center';

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

  // Process image - debounced with rAF to keep UI smooth
  const processImage = useCallback(
    (
      canvas: HTMLCanvasElement,
      gridW: number,
      gridH: number,
      merge: number,
      bgRemoval: boolean,
      excluded: Set<string>,
      dither: number
    ) => {
      if (palette.length === 0) return;

      if (processingRAFRef.current) cancelAnimationFrame(processingRAFRef.current);
      setIsProcessing(true);

      processingRAFRef.current = requestAnimationFrame(() => {
        try {
          const resized = resizeImageToGrid(canvas, gridW, gridH);
          const result = processImageToGrid(resized, gridW, gridH, palette, merge, bgRemoval, excluded, dither, { maxColors });

          setProcessed(result);
          setBaseProcessed(result);
          setRemovedColors(new Map());

          // init selectedColor (more friendly): pick top color
          if (!selectedColor) {
            const top = Array.from(result.colorStats.entries()).sort((a, b) => b[1] - a[1])[0];
            if (top) {
              const c = colorIndexRef.current.get(top[0]);
              if (c) setSelectedColor(c);
            }
          }
        } catch (err) {
          setError(`Processing error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
          setIsProcessing(false);
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [palette, maxColors]
  );

  // Redraw canvas when visual settings change
  useEffect(() => {
    if (!processed || !canvasRef.current) return;
    try {
      drawPixelGrid(
        canvasRef.current,
        processed.gridWidth,
        processed.gridHeight,
        processed.pixels,
        pixelSize,
        previewMode,
        highlightCode,
        processed.backgroundIndices,
        showBackground
      );
    } catch (err) {
      console.error('Draw error:', err);
    }
  }, [processed, pixelSize, highlightCode, showBackground, previewMode]);

  // Re-process when maxColors changes
  useEffect(() => {
    if (sourceImage && dims) {
      processImage(sourceImage, dims.width, dims.height, mergeThreshold, enableBgRemoval, excludedCodes, ditherStrength);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxColors]);

  // Handle image upload
  const handleImageUpload = async (file: File) => {
    setError(null);
    setExcludedCodes(new Set());
    setHighlightCode(null);
    setRemovedColors(new Map());
    setPaletteOpen(false);

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

  // Parameters
  const handleGridSizeChange = (value: number[]) => {
    const size = value[0];
    setGridSize(size);
    if (sourceImage) {
      const d = calculateGridDimensions(sourceImage, size);
      setDims(d);
      processImage(sourceImage, d.width, d.height, mergeThreshold, enableBgRemoval, excludedCodes, ditherStrength);
    }
  };

  const handleMergeChange = (value: number[]) => {
    const merge = value[0];
    setMergeThreshold(merge);
    if (sourceImage && dims) {
      processImage(sourceImage, dims.width, dims.height, merge, enableBgRemoval, excludedCodes, ditherStrength);
    }
  };

  const handleDitherChange = (value: number[]) => {
    const d = value[0];
    setDitherStrength(d);
    if (sourceImage && dims) {
      processImage(sourceImage, dims.width, dims.height, mergeThreshold, enableBgRemoval, excludedCodes, d);
    }
  };

  const handleBgToggle = (enabled: boolean) => {
    setEnableBgRemoval(enabled);
    if (sourceImage && dims) {
      processImage(sourceImage, dims.width, dims.height, mergeThreshold, enabled, excludedCodes, ditherStrength);
    }
  };

  const handleExcludeColor = (code: string) => {
    const next = new Set(excludedCodes);
    if (next.has(code)) next.delete(code);
    else next.add(code);

    setExcludedCodes(next);

    if (sourceImage && dims) {
      processImage(sourceImage, dims.width, dims.height, mergeThreshold, enableBgRemoval, next, ditherStrength);
    }
  };

  // ===== NOISE COLOR REMOVAL =====
  const handleRemoveNoiseColor = (code: string, replacementCode: string) => {
    if (!processed) return;

    const replacement = colorIndexRef.current.get(replacementCode);
    if (!replacement) return;

    const newPixels = processed.pixels.map((pixel) => {
      if (pixel.code === code && !pixel.isBackground) {
        return { ...pixel, code: replacement.code, hex: replacement.hex, rgb: replacement.rgb };
      }
      return pixel;
    });

    const newStats = new Map<string, number>();
    newPixels.forEach((p, i) => {
      if (!processed.backgroundIndices.has(i)) newStats.set(p.code, (newStats.get(p.code) || 0) + 1);
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
      if (basePixel && basePixel.code === code) return { ...basePixel };
      return pixel;
    });

    const newStats = new Map<string, number>();
    newPixels.forEach((p, i) => {
      if (!processed.backgroundIndices.has(i)) newStats.set(p.code, (newStats.get(p.code) || 0) + 1);
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

  // Highlight
  const handleHighlightColor = (code: string | null) => {
    setHighlightCode((prev) => (prev === code ? null : code));
  };

  // ===== Brush apply =====
  const applyBrush = useCallback(
    (
      pixels: PixelGridCell[],
      gridW: number,
      gridH: number,
      x: number,
      y: number,
      size: number,
      color: ColorData
    ) => {
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
    },
    []
  );

  // Canvas hover
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!processed || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    const x = Math.floor(((e.clientX - rect.left) * scaleX) / pixelSize);
    const y = Math.floor(((e.clientY - rect.top) * scaleY) / pixelSize);

    if (x >= 0 && x < processed.gridWidth && y >= 0 && y < processed.gridHeight) {
      const pixel = getPixelAt(processed.pixels, processed.gridWidth, x, y);
      if (pixel) setHoveredPixel({ x, y, pixel });
    } else {
      setHoveredPixel(null);
    }
  };

  const handleCanvasMouseLeave = () => setHoveredPixel(null);

  // Canvas click (paint / erase / pick)
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!processed || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    const x = Math.floor(((e.clientX - rect.left) * scaleX) / pixelSize);
    const y = Math.floor(((e.clientY - rect.top) * scaleY) / pixelSize);

    if (x < 0 || x >= processed.gridWidth || y < 0 || y >= processed.gridHeight) return;

    if (activeTool === 'eyedropper') {
      const pixel = getPixelAt(processed.pixels, processed.gridWidth, x, y);
      if (!pixel) return;

      const color = colorIndexRef.current.get(pixel.code);
      if (color) {
        setSelectedColor(color);
        toast(`Picked: ${color.code}`);
      }
      return;
    }

    if (activeTool === 'brush' && selectedColor) {
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
        if (!processed.backgroundIndices.has(i)) newStats.set(p.code, (newStats.get(p.code) || 0) + 1);
      });

      setProcessed({ ...processed, pixels: newPixels, colorStats: newStats });
      return;
    }

    if (activeTool === 'eraser') {
      // 现在橡皮：先用“白色”当擦除（后续我们可以升级成真正透明 BG）
      const fallback: ColorData = { code: 'BG', name: 'Background', hex: '#FFFFFF', rgb: { r: 255, g: 255, b: 255 } };
      const bgColor = palette.find((c) => c.hex.toUpperCase() === '#FFFFFF') || fallback;

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
        if (!processed.backgroundIndices.has(i)) newStats.set(p.code, (newStats.get(p.code) || 0) + 1);
      });

      setProcessed({ ...processed, pixels: newPixels, colorStats: newStats });
    }
  };

  // ===== ViewScale controls =====
  const zoomViewIn = () => setViewScale((v) => clamp(Number((v + 0.1).toFixed(2)), 0.5, 6));
  const zoomViewOut = () => setViewScale((v) => clamp(Number((v - 0.1).toFixed(2)), 0.5, 6));
  const resetView = () => setViewScale(1);

  // Wheel zoom (desktop): Ctrl/⌘ + wheel
  const onWheelCanvasArea = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();

    const delta = e.deltaY;
    setViewScale((prev) => {
      const next = delta > 0 ? prev - 0.08 : prev + 0.08;
      return clamp(Number(next.toFixed(2)), 0.5, 6);
    });
  };

  // Pinch zoom (mobile)
  const onPointerDownCanvasArea = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.hypot(dx, dy);
      pinchStartRef.current = { dist, scale: viewScale };
    }
  };

  const onPointerMoveCanvasArea = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2 && pinchStartRef.current) {
      e.preventDefault();
      const pts = Array.from(pointersRef.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.hypot(dx, dy);

      const ratio = dist / pinchStartRef.current.dist;
      const next = clamp(pinchStartRef.current.scale * ratio, 0.5, 6);
      setViewScale(Number(next.toFixed(2)));
    }
  };

  const onPointerUpCanvasArea = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchStartRef.current = null;
  };

  // PixelSize controls (your existing zoom)
  const zoomIn = () => setPixelSize((prev) => Math.min(40, prev + 2));
  const zoomOut = () => setPixelSize((prev) => Math.max(4, prev - 2));

  // Reset processing
  const handleReset = () => {
    if (sourceImage && dims) {
      setExcludedCodes(new Set());
      setHighlightCode(null);
      setMergeThreshold(1);
      setEnableBgRemoval(false);
      setRemovedColors(new Map());
      setBrushSize(1);
      setActiveTool('none');
      setPaletteOpen(false);

      processImage(sourceImage, dims.width, dims.height, 1, false, new Set(), ditherStrength);
    }
  };

  // Export handlers
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

  const totalBeads = processed ? Array.from(processed.colorStats.values()).reduce((a, b) => a + b, 0) : 0;
  const totalColors = processed ? processed.colorStats.size : 0;

  const handleAddToCart = () => {
    if (!processed) return;

    try {
      const url = buildShopifyCartUrl({ storeUrl: SHOP_DOMAIN, variantId: SHOPIFY_VARIANT_ID }, processed.colorStats);
      window.open(url, '_blank');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add to cart');
    }
  };

  const filteredPalette = useMemo(() => {
    if (familyFilter === 'ALL') return palette;
    return palette.filter((c) => c.code.startsWith(familyFilter));
  }, [palette, familyFilter]);

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <header className="border-b border-border bg-white px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#452F60' }}>
            Yaya’s Creative Studio
          </h1>
          <p className="text-xs" style={{ color: '#9867DA' }}>
            Turn Any Image into a Custom Bead Pattern · 221 Artkal Colors · One-Click Bead Order
          </p>
        </div>

        <div className="flex items-center gap-3">
          {processed && (
            <>
              <div className="text-xs text-muted-foreground flex items-center gap-3">
                <span>
                  Total: <span className="font-semibold">{totalBeads.toLocaleString()}</span> beads
                </span>
                <span>
                  Colors: <span className="font-semibold">{totalColors}</span>
                </span>
              </div>

              <Button
                onClick={handleAddToCart}
                size="sm"
                variant="default"
                className="text-xs gap-2"
                title="Add all required beads to cart"
              >
                🛒 Order my beads now · {totalBeads.toLocaleString()} pcs
              </Button>

              <Button onClick={handleExportPatternPNG} size="sm" variant="default" className="text-xs gap-1">
                <Download className="w-3 h-3" /> Export Pattern
              </Button>
            </>
          )}
        </div>
      </header>

      {error && (
        <div className="mx-4 mt-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex-shrink-0">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: canvas */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          {processed && (
            <div className="border-b border-border px-4 py-2 flex items-center gap-3 flex-shrink-0 bg-gray-50 relative">
              <div className="flex items-center gap-1 border-r border-border pr-3">
                <Button
                  size="sm"
                  variant={activeTool === 'brush' ? 'default' : 'ghost'}
                  className={toolBtnClass}
                  onClick={() => setActiveTool((t) => (t === 'brush' ? 'none' : 'brush'))}
                >
                  <Paintbrush className="w-4 h-4" />
                  Brush
                </Button>

                <Button
                  size="sm"
                  variant={activeTool === 'eraser' ? 'default' : 'ghost'}
                  className={toolBtnClass}
                  onClick={() => setActiveTool((t) => (t === 'eraser' ? 'none' : 'eraser'))}
                >
                  <Eraser className="w-4 h-4" />
                  Eraser
                </Button>

                <Button
                  size="sm"
                  variant={activeTool === 'eyedropper' ? 'default' : 'ghost'}
                  className={toolBtnClass}
                  onClick={() => setActiveTool((t) => (t === 'eyedropper' ? 'none' : 'eyedropper'))}
                >
                  <Pipette className="w-4 h-4" />
                  Pick
                </Button>

                <Button
                  size="sm"
                  variant={paletteOpen ? 'default' : 'ghost'}
                  className={toolBtnClass}
                  onClick={() => setPaletteOpen((v) => !v)}
                >
                  <Palette className="w-4 h-4" />
                  Palette
                </Button>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant={previewMode ? 'default' : 'ghost'}
                      className="h-8 px-2 text-xs"
                      onClick={() => setPreviewMode((v) => !v)}
                    >
                      Preview
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Toggle grid preview</TooltipContent>
                </Tooltip>
              </div>

              {/* Brush size */}
              <div className="flex items-center gap-2 border-r border-border pr-3">
                <span className="text-xs text-muted-foreground">Size</span>
                <div className="w-40">
                  <Slider value={[brushSize]} onValueChange={(v) => setBrushSize(v[0])} min={1} max={100} step={1} />
                </div>
                <span className="text-xs font-mono text-muted-foreground w-10 text-right">{brushSize}</span>
              </div>

              {/* Selected color */}
              {selectedColor && (
                <div className="flex items-center gap-2 border-r border-border pr-3">
                  <div className="w-5 h-5 rounded border border-gray-300" style={{ backgroundColor: selectedColor.hex }} />
                  <span className="text-xs font-medium">{selectedColor.code}</span>
                </div>
              )}

              {/* Pixel zoom */}
              <div className="flex items-center gap-1 border-r border-border pr-3">
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={zoomOut} title="Pixel zoom out">
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-xs text-muted-foreground w-12 text-center">{pixelSize}px</span>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={zoomIn} title="Pixel zoom in">
                  <ZoomIn className="w-4 h-4" />
                </Button>
              </div>

              {/* View scale zoom */}
              <div className="flex items-center gap-1 border-r border-border pr-3">
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={zoomViewOut} title="View zoom out">
                  <Minus className="w-4 h-4" />
                </Button>
                <button
                  className="text-xs text-muted-foreground w-14 text-center hover:underline"
                  onClick={resetView}
                  title="Reset view zoom"
                  type="button"
                >
                  {Math.round(viewScale * 100)}%
                </button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={zoomViewIn} title="View zoom in">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* Background toggle */}
              <div className="flex items-center gap-1 border-r border-border pr-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setShowBackground((v) => !v)}>
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

              {/* Hover info */}
              {hoveredPixel && (
                <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-4 h-4 rounded border border-gray-300" style={{ backgroundColor: hoveredPixel.pixel.hex }} />
                  <span className="font-mono">{hoveredPixel.pixel.code}</span>
                  <span className="font-mono">{hoveredPixel.pixel.hex}</span>
                  <span>
                    ({hoveredPixel.x + 1}, {hoveredPixel.y + 1})
                  </span>
                </div>
              )}

              {/* Palette popup */}
              {paletteOpen && (
                <div className="absolute left-4 top-[44px] z-50 w-[520px] max-w-[calc(100vw-32px)] rounded-xl border bg-white shadow-lg p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="text-xs font-semibold text-muted-foreground">Choose a color</div>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setPaletteOpen(false)}>
                      Close
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-3">
                    {['ALL', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'M'].map((f) => (
                      <Button
                        key={f}
                        size="sm"
                        variant={familyFilter === f ? 'default' : 'outline'}
                        className="h-7 px-2 text-[11px]"
                        onClick={() => setFamilyFilter(f)}
                      >
                        {f}
                      </Button>
                    ))}
                  </div>

                  <div className="max-h-[260px] overflow-auto grid grid-cols-10 gap-1">
                    {filteredPalette.map((c) => (
                      <button
                        key={c.code}
                        className="group relative w-full aspect-square rounded border hover:shadow-sm"
                        style={{ backgroundColor: c.hex }}
                        onClick={() => {
                          setSelectedColor(c);
                          setActiveTool('brush');
                          toast(`Selected: ${c.code}`);
                        }}
                        title={`${c.code} ${c.name}`}
                      >
                        <span className="absolute bottom-0 left-0 right-0 text-[9px] leading-3 text-black/70 bg-white/70 opacity-0 group-hover:opacity-100">
                          {c.code}
                        </span>
                      </button>
                    ))}
                  </div>

                  <p className="mt-2 text-[10px] text-muted-foreground">
                    Tip: pick any Artkal color (even if not in the current pattern), then paint with Brush.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Canvas Area */}
          <div
            className="flex-1 overflow-auto bg-gray-100 flex items-start justify-center p-4 touch-none"
            onWheel={onWheelCanvasArea}
            onPointerDown={onPointerDownCanvasArea}
            onPointerMove={onPointerMoveCanvasArea}
            onPointerUp={onPointerUpCanvasArea}
            onPointerCancel={onPointerUpCanvasArea}
          >
            {isProcessing && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-10">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </div>
              </div>
            )}

            {sourceImage && processed ? (
              <div className="origin-top-left" style={{ transform: `scale(${viewScale})` }}>
                <canvas
                  ref={canvasRef}
                  className="border border-border shadow-sm bg-white"
                  style={{
                    imageRendering: 'pixelated',
                    cursor:
                      activeTool === 'brush'
                        ? 'crosshair'
                        : activeTool === 'eraser'
                        ? 'cell'
                        : activeTool === 'eyedropper'
                        ? 'copy'
                        : 'default',
                  }}
                  onMouseMove={handleCanvasMouseMove}
                  onClick={handleCanvasClick}
                  onMouseLeave={handleCanvasMouseLeave}
                />
              </div>
            ) : (
              <HeroIntro
                onUploadClick={() => {
                  const panel = document.querySelector('[data-upload-panel="1"]') as HTMLElement | null;
                  panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });

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
              <span>
                Grid: {dims.width} x {dims.height} | Ratio: {getAspectRatioString(dims.width, dims.height)}
              </span>
              <span className="hidden md:inline">Zoom: Ctrl/⌘ + Wheel · Mobile: Pinch</span>
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

              {/* Grid Size */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-foreground">Horizontal Grid Count</label>
                  <span className="text-xs font-mono text-muted-foreground">{gridSize}</span>
                </div>
                <Slider value={[gridSize]} onValueChange={handleGridSizeChange} min={10} max={250} step={1} className="w-full" />
                {dims && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Output: {dims.width} x {dims.height}
                  </p>
                )}
              </div>

              {/* Dither */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-foreground">Dithering Strength</label>
                  <span className="text-xs font-mono text-muted-foreground">{ditherStrength}</span>
                </div>
                <Slider value={[ditherStrength]} onValueChange={handleDitherChange} min={0} max={100} step={1} className="w-full" />
                <p className="text-[10px] text-muted-foreground mt-1">0 = off · 20–40 natural · 60+ grainy</p>
              </div>

              {/* Max colors */}
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
                  {MAX_COLOR_OPTIONS.map((n) => (
                    <span key={n}>{n}</span>
                  ))}
                </div>

                <p className="text-[10px] text-muted-foreground mt-1">221 = most vivid · 50 = cleaner cartoon · 20 = very simplified</p>
              </div>

              {/* Merge threshold */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-foreground">Color Merge Threshold</label>
                  <span className="text-xs font-mono text-muted-foreground">{mergeThreshold}</span>
                </div>
                <Slider value={[mergeThreshold]} onValueChange={handleMergeChange} min={1} max={12} step={1} className="w-full" />
                <p className="text-[10px] text-muted-foreground mt-1">Regions smaller than {mergeThreshold}px will be merged</p>
              </div>

              {/* Background removal */}
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground">Remove Background</label>
                <Switch checked={enableBgRemoval} onCheckedChange={handleBgToggle} />
              </div>
            </div>
          )}

          {/* Noise */}
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

          {/* Stats */}
          {processed && (
            <div className="p-4 border-b border-border">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3">
                <Layers className="w-3.5 h-3.5" /> Color Statistics ({totalColors})
              </h3>
              <p className="text-[10px] text-muted-foreground mb-2">Click to highlight · Right-click to exclude</p>

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
                        onContextMenu={(e) => {
                          e.preventDefault();
                          handleExcludeColor(code);
                        }}
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
        </div>
      </div>
    </div>
  );
}