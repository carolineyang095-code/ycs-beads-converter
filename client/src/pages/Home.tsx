import HeroIntro from '@/components/HeroIntro';
import type React from 'react';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useIsMobile } from '@/hooks/useMobile';
import {
  Upload, Download, Paintbrush, Eraser,
  Pipette, Eye, RotateCcw, ZoomIn, ZoomOut,
  SlidersHorizontal, Layers, Sparkles, Loader2, Palette, Copy, Check,
  PanelLeftClose, PanelRightClose, PanelRightOpen, Minus, Plus,
  Undo2, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import ImageUploadSection from '@/components/ImageUploadSection';
import ShopifyIntegration from '@/components/ShopifyIntegration';
import NoiseColorRemoval from '@/components/NoiseColorRemoval';
import CropModal from '@/components/CropModal';
import {
 loadImage, resizeImageToGrid, processImageToGrid, drawPixelGrid,
  exportGridAsPNG, exportStatsAsCSV, calculateGridDimensions,
  getAspectRatioString, getPixelAt, setPixelAt,
  PixelGridCell, ProcessedImage, ProcessingMode
} from '@/lib/imageProcessing';
import { exportFullPatternPNG } from '@/lib/exportPattern';
import { createColorIndex, ColorData } from '@/lib/colorMapping';
import ProjectManager from '@/components/ProjectManager';
import { saveProject, generateThumbnail, SavedProject } from '@/lib/projectStorage';


type EditTool = 'none' | 'brush' | 'eraser' | 'eyedropper';
  const MAX_COLOR_OPTIONS = [20, 50, 100, 150, 221] as const;
  type MaxColors = typeof MAX_COLOR_OPTIONS[number];

export default function Home() {
  // Core state
  const [palette, setPalette] = useState<ColorData[]>([]);
  const [gridSize, setGridSize] = useState<number>(100);
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
  const [pixelSize, setPixelSize] = useState(8);
  const [isPinching, setIsPinching] = useState(false);
  const lastPinchDistRef = useRef<number | null>(null);
  const [hoveredPixel, setHoveredPixel] = useState<{ x: number; y: number; pixel: PixelGridCell } | null>(null);
  const [ditherStrength, setDitherStrength] = useState<number>(30);
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('clean');

  // === UI visibility toggles (temporary) ===
const SHOW_DITHERING = false;
const SHOW_SIMPLIFY_SMALL_AREAS = false;
const SHOW_REMOVE_BACKGROUND = false;

  const [maxColorIndex, setMaxColorIndex] = useState(1);
  const maxColors = MAX_COLOR_OPTIONS[maxColorIndex];

  const [isPreview, setIsPreview] = useState(false);
  const isMobile = useIsMobile();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [brushSize, setBrushSize] = useState<number>(1);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  // Noise color removal state
  const [removedColors, setRemovedColors] = useState<Map<string, string>>(new Map());
  const [baseProcessed, setBaseProcessed] = useState<ProcessedImage | null>(null);

  // Crop state
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);

  // Track last uploaded file name for ImageUploadSection display
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Replace Color modal state
  const [replaceModalOpen, setReplaceModalOpen] = useState(false);
  const [replaceTargetCode, setReplaceTargetCode] = useState<string | null>(null);
  const [replaceFamilyFilter, setReplaceFamilyFilter] = useState<string>('A');

  const hasAutoOpenedSidebar = useRef(false);

  // Auto-show sidebar only on initial image load (not on brush strokes)
  useEffect(() => {
    if (processed && !hasAutoOpenedSidebar.current) {
      hasAutoOpenedSidebar.current = true;
      setIsSidebarOpen(true);
    }
  }, [processed]);

  // Hide sidebar when crop modal is shown
  useEffect(() => {
    if (cropImageSrc && isSidebarOpen) {
      setIsSidebarOpen(false);
    }
  }, [cropImageSrc]);


  // Undo history state
  const [historyStack, setHistoryStack] = useState<ProcessedImage[]>([]);
  const MAX_HISTORY = 20;

  const pushToHistory = useCallback((currentProcessed: ProcessedImage | null) => {
    if (!currentProcessed) return;
    const snapshot: ProcessedImage = {
      ...currentProcessed,
      pixels: [...currentProcessed.pixels.map(p => ({ ...p }))],
      colorStats: new Map(currentProcessed.colorStats),
      backgroundIndices: new Set(currentProcessed.backgroundIndices)
    };
    setHistoryStack(prev => {
      const newStack = [...prev, snapshot];
      if (newStack.length > MAX_HISTORY) return newStack.slice(newStack.length - MAX_HISTORY);
      return newStack;
    });
  }, []);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorIndexRef = useRef<Map<string, ColorData>>(new Map());
  const processingTimeoutRef = useRef<number | null>(null);
  const hiddenFileInputRef = useRef<HTMLInputElement>(null);

  // Load palette — set default brush color to H07
  useEffect(() => {
    const loadPalette = async () => {
      try {
        const response = await fetch('/artkal_221.json');
        if (!response.ok) throw new Error('Failed to load color palette');
        const data: ColorData[] = await response.json();
        setPalette(data);
        const index = createColorIndex(data);
        colorIndexRef.current = index;
        // Default brush color: H07
        const defaultColor = index.get('H07');
        if (defaultColor) setSelectedColor(defaultColor);
      } catch (err) {
        setError(`Failed to load palette: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };
    loadPalette();
  }, []);

  const processImage = useCallback((
    canvas: HTMLCanvasElement, gridW: number, gridH: number,
    merge: number, bgRemoval: boolean, excluded: Set<string>, dither: number
  ) => {
    if (palette.length === 0) return;
    if (processingTimeoutRef.current) cancelAnimationFrame(processingTimeoutRef.current);
    setIsProcessing(true);
    processingTimeoutRef.current = requestAnimationFrame(() => {
      try {
        const resized = resizeImageToGrid(canvas, gridW, gridH);
        const result = processImageToGrid(resized, gridW, gridH, palette, merge, bgRemoval, excluded, dither, {mode: processingMode, maxColors});
        setProcessed(result);
        setBaseProcessed(result);
        setRemovedColors(new Map());
      } catch (err) {
        setError(`Processing error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setIsProcessing(false);
      }
    });
  }, [palette, maxColors, processingMode]);

  useEffect(() => {
    if (!processed || !canvasRef.current) return;
    try {
      drawPixelGrid(canvasRef.current, processed.gridWidth, processed.gridHeight, processed.pixels, pixelSize, !isPreview, highlightCode, processed.backgroundIndices, showBackground, isPreview);
    } catch (err) { console.error('Draw error:', err); }
  }, [processed, pixelSize, highlightCode, showBackground, isPreview]);

  useEffect(() => {
    if (sourceImage && dims) {
      processImage(sourceImage, dims.width, dims.height, mergeThreshold, enableBgRemoval, excludedCodes, ditherStrength);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxColors, processingMode]);

  const handleImageUpload = async (file: File) => {
    setUploadedFileName(file.name);
    setError(null); setExcludedCodes(new Set()); setHighlightCode(null); setRemovedColors(new Map());
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setPendingCropFile(file);
      setCropImageSrc(dataUrl);
    } catch (err) {
      setError(`Failed to load image: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleCropConfirm = async (croppedCanvas: HTMLCanvasElement) => {
    setCropImageSrc(null); setPendingCropFile(null);
    if (isMobile) setIsSidebarOpen(false);
    try {
      setIsProcessing(true); pushToHistory(processed);
      setSourceImage(croppedCanvas); setCanvasSource('image');
      const d = calculateGridDimensions(croppedCanvas, gridSize);
      setDims(d);
      processImage(croppedCanvas, d.width, d.height, mergeThreshold, enableBgRemoval, new Set(), ditherStrength);
    } catch (err) {
      setError(`Failed to process cropped image: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsProcessing(false);
    }
  };

  const handleCropCancel = () => { 
    setCropImageSrc(null); setPendingCropFile(null);
    if (isMobile) setIsSidebarOpen(false);
  };

  const handleRegenerateFromImage = () => {
    if (!sourceImage) return;
    pushToHistory(processed); setCanvasSource('image');
    const d = calculateGridDimensions(sourceImage, gridSize);
    setDims(d);
    processImage(sourceImage, d.width, d.height, mergeThreshold, enableBgRemoval, excludedCodes, ditherStrength);
    toast.success('Re-generated from image');
  };

  const handleCreateCanvas = () => {
    setError(null); setExcludedCodes(new Set()); setHighlightCode(null); setRemovedColors(new Map());
    pushToHistory(processed); setCanvasSource('manual');
    const d = { width: gridSize, height: gridSize }; setDims(d);
    const emptyPixels: PixelGridCell[] = Array.from({ length: gridSize * gridSize }, () => ({
      code: '', hex: 'transparent', rgb: { r: 0, g: 0, b: 0 }, originalRgb: { r: 0, g: 0, b: 0 }, isBackground: false
    }));
    const result: ProcessedImage = { gridWidth: gridSize, gridHeight: gridSize, pixels: emptyPixels, colorStats: new Map(), backgroundCode: null, backgroundIndices: new Set() };
    setProcessed(result); setBaseProcessed(result);
    toast.success(`Created ${gridSize}x${gridSize} empty canvas`);
  };

  const resizeGridPreserveContent = (oldProcessed: ProcessedImage, newWidth: number, newHeight: number): ProcessedImage => {
    const newPixels: PixelGridCell[] = Array.from({ length: newWidth * newHeight }, (_, i) => {
      const x = i % newWidth; const y = Math.floor(i / newWidth);
      if (x < oldProcessed.gridWidth && y < oldProcessed.gridHeight) return oldProcessed.pixels[y * oldProcessed.gridWidth + x];
      return { code: '', hex: 'transparent', rgb: { r: 0, g: 0, b: 0 }, originalRgb: { r: 0, g: 0, b: 0 }, isBackground: false };
    });
    const newStats = new Map<string, number>();
    newPixels.forEach((p) => { if (p.code && p.code !== 'BG' && p.hex !== 'transparent') newStats.set(p.code, (newStats.get(p.code) || 0) + 1); });
    return { ...oldProcessed, gridWidth: newWidth, gridHeight: newHeight, pixels: newPixels, colorStats: newStats, backgroundIndices: new Set() };
  };

  const handleGridSizeChange = (value: number[]) => {
    const size = value[0]; setGridSize(size);
    if (canvasSource === 'image' && sourceImage) {
      pushToHistory(processed);
      const d = calculateGridDimensions(sourceImage, size); setDims(d);
      processImage(sourceImage, d.width, d.height, mergeThreshold, enableBgRemoval, excludedCodes, ditherStrength);
    } else if (canvasSource === 'manual' && processed) {
      pushToHistory(processed);
      setDims({ width: size, height: size });
      const resized = resizeGridPreserveContent(processed, size, size);
      setProcessed(resized); setBaseProcessed(resized);
    }
  };

  const handleMergeChange = (value: number[]) => {
    const merge = value[0]; setMergeThreshold(merge);
    if (sourceImage && dims) { pushToHistory(processed); processImage(sourceImage, dims.width, dims.height, merge, enableBgRemoval, excludedCodes, ditherStrength); }
  };

  const handleDitherChange = (value: number[]) => {
    const d = value[0]; setDitherStrength(d);
    if (sourceImage && dims) { pushToHistory(processed); processImage(sourceImage, dims.width, dims.height, mergeThreshold, enableBgRemoval, excludedCodes, d); }
  };

  const handleModeChange = (value: string) => {
    const next = value as ProcessingMode; setProcessingMode(next);
    if (sourceImage && dims) { pushToHistory(processed); processImage(sourceImage, dims.width, dims.height, mergeThreshold, enableBgRemoval, excludedCodes, ditherStrength); }
  };

  const handleBgToggle = (enabled: boolean) => {
    setEnableBgRemoval(enabled);
    if (sourceImage && dims) { pushToHistory(processed); processImage(sourceImage, dims.width, dims.height, mergeThreshold, enabled, excludedCodes, ditherStrength); }
  };

  const handleExcludeColor = (code: string) => {
    const newExcluded = new Set(excludedCodes);
    if (newExcluded.has(code)) newExcluded.delete(code); else newExcluded.add(code);
    setExcludedCodes(newExcluded);
    if (sourceImage && dims) { pushToHistory(processed); processImage(sourceImage, dims.width, dims.height, mergeThreshold, enableBgRemoval, newExcluded, ditherStrength); }
  };

  const handleRemoveNoiseColor = (code: string, replacementCode: string) => {
    if (!processed) return; pushToHistory(processed);
    const newPixels = processed.pixels.map((pixel) => {
      if (pixel.code === code && !pixel.isBackground) {
        const replacement = colorIndexRef.current.get(replacementCode);
        if (replacement) return { ...pixel, code: replacement.code, hex: replacement.hex, rgb: replacement.rgb };
      }
      return pixel;
    });
    const newStats = new Map<string, number>();
    newPixels.forEach((p, i) => { if (!processed.backgroundIndices.has(i) && p.code && p.code !== 'BG' && p.hex !== 'transparent') newStats.set(p.code, (newStats.get(p.code) || 0) + 1); });
    const newRemoved = new Map(removedColors); newRemoved.set(code, replacementCode);
    setRemovedColors(newRemoved); setProcessed({ ...processed, pixels: newPixels, colorStats: newStats });
  };

  const handleRestoreColor = (code: string) => {
    if (!baseProcessed || !processed) return; pushToHistory(processed);
    const newPixels = processed.pixels.map((pixel, i) => {
      const basePixel = baseProcessed.pixels[i];
      if (basePixel && basePixel.code === code) return { ...basePixel };
      return pixel;
    });
    const newStats = new Map<string, number>();
    newPixels.forEach((p, i) => { if (!processed.backgroundIndices.has(i) && p.code && p.code !== 'BG' && p.hex !== 'transparent') newStats.set(p.code, (newStats.get(p.code) || 0) + 1); });
    const newRemoved = new Map(removedColors); newRemoved.delete(code);
    setRemovedColors(newRemoved); setProcessed({ ...processed, pixels: newPixels, colorStats: newStats });
  };

  const handleRestoreAll = () => {
    if (!baseProcessed) return; pushToHistory(processed);
    setProcessed({ ...baseProcessed }); setRemovedColors(new Map());
  };

  const handleMassReplace = useCallback((fromCode: string, toCode: string) => {
    if (!processed) return;
    const toColor = colorIndexRef.current.get(toCode);
    if (!toColor) return;
    pushToHistory(processed);
    const newPixels = processed.pixels.map((pixel) => {
      if (pixel.code === fromCode && !pixel.isBackground) {
        return { ...pixel, code: toColor.code, hex: toColor.hex, rgb: toColor.rgb };
      }
      return pixel;
    });
    const newStats = new Map<string, number>();
    newPixels.forEach((p, i) => {
      if (!processed.backgroundIndices.has(i) && p.code && p.code !== 'BG' && p.hex !== 'transparent') {
        newStats.set(p.code, (newStats.get(p.code) || 0) + 1);
      }
    });
    setProcessed({ ...processed, pixels: newPixels, colorStats: newStats });
    setReplaceModalOpen(false);
    setReplaceTargetCode(null);
    toast.success(`Replaced all ${fromCode} → ${toCode}`);
  }, [processed, pushToHistory]);

  const handleUndo = useCallback(() => {
    if (historyStack.length === 0) return;
    const lastSnapshot = historyStack[historyStack.length - 1];
    setHistoryStack(prev => prev.slice(0, -1));
    setProcessed(lastSnapshot); setBaseProcessed(lastSnapshot);
    setDims({ width: lastSnapshot.gridWidth, height: lastSnapshot.gridHeight });
    setGridSize(lastSnapshot.gridWidth);
    toast.success('Undo successful');
  }, [historyStack]);

  const breakdownText = useMemo(() => {
    if (!processed) return '';
    const entries = Array.from(processed.colorStats.entries())
      .filter(([code]) => { const color = colorIndexRef.current.get(code); return code && code !== 'BG' && !excludedCodes.has(code) && color && color.hex !== 'transparent'; })
      .sort((a, b) => a[0].localeCompare(b[0]));
    return entries.map(([code, count]) => `${code}:${count}`).join('; ');
  }, [processed, excludedCodes]);

  const [copied, setCopied] = useState(false);
  const handleCopyBreakdown = () => {
    if (!breakdownText) return;
    navigator.clipboard.writeText(breakdownText).then(() => {
      setCopied(true); toast.success('Copied breakdown to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => toast.error('Failed to copy. Please select and copy manually.'));
  };

  const handleHighlightColor = (code: string | null) => setHighlightCode(prev => prev === code ? null : code);

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!processed || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) * (canvasRef.current.width / rect.width) / pixelSize);
    const y = Math.floor((e.clientY - rect.top) * (canvasRef.current.height / rect.height) / pixelSize);
    if (x >= 0 && x < processed.gridWidth && y >= 0 && y < processed.gridHeight) {
      const pixel = getPixelAt(processed.pixels, processed.gridWidth, x, y);
      if (pixel) setHoveredPixel({ x, y, pixel });
      if (isDrawing && (activeTool === 'brush' || activeTool === 'eraser')) handleCanvasAction(x, y);
    } else { setHoveredPixel(null); }
  };

  function applyBrush(pixels: PixelGridCell[], gridW: number, gridH: number, x: number, y: number, size: number, color: ColorData | null) {
    const half = Math.floor(size / 2);
    let out = pixels;
    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const xx = x + dx; const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= gridW || yy >= gridH) continue;
        if (color) { out = setPixelAt(out, gridW, xx, yy, color); }
        else {
          const newPixels = [...out];
          newPixels[yy * gridW + xx] = { code: 'BG', hex: 'transparent', rgb: { r: 0, g: 0, b: 0 }, originalRgb: { r: 0, g: 0, b: 0 }, isBackground: true };
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
      if (pixel) { const color = colorIndexRef.current.get(pixel.code); if (color) { setSelectedColor(color); toast(`Picked: ${color.code}`); } }
    } else if (activeTool === 'brush' && selectedColor) {
      const newPixels = applyBrush(processed.pixels, processed.gridWidth, processed.gridHeight, x, y, brushSize, selectedColor);
      const newStats = new Map<string, number>();
      newPixels.forEach((p, i) => { if (!processed.backgroundIndices.has(i) && p.code && p.code !== 'BG' && p.hex !== 'transparent') newStats.set(p.code, (newStats.get(p.code) || 0) + 1); });
      setProcessed({ ...processed, pixels: newPixels, colorStats: newStats });
    } else if (activeTool === 'eraser') {
      const newPixels = applyBrush(processed.pixels, processed.gridWidth, processed.gridHeight, x, y, brushSize, null);
      const newStats = new Map<string, number>();
      newPixels.forEach((p, i) => { if (!processed.backgroundIndices.has(i) && p.code && p.code !== 'BG' && p.hex !== 'transparent') newStats.set(p.code, (newStats.get(p.code) || 0) + 1); });
      setProcessed({ ...processed, pixels: newPixels, colorStats: newStats });
    }
  }, [processed, dims, activeTool, selectedColor, brushSize, palette]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!processed || !canvasRef.current) return;
    if (activeTool === 'brush' || activeTool === 'eraser') pushToHistory(processed);
    setIsDrawing(true);
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) * (canvasRef.current.width / rect.width) / pixelSize);
    const y = Math.floor((e.clientY - rect.top) * (canvasRef.current.height / rect.height) / pixelSize);
    if (x >= 0 && y >= 0 && x < processed.gridWidth && y < processed.gridHeight) handleCanvasAction(x, y);
  };

  const handleCanvasMouseUp = () => setIsDrawing(false);
  const handleCanvasMouseLeave = () => setHoveredPixel(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) { setIsPinching(true); lastPinchDistRef.current = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY); }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (isPinching && e.touches.length === 2 && lastPinchDistRef.current !== null) {
      const dist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
      const delta = dist - lastPinchDistRef.current;
      if (Math.abs(delta) > 2) { setPixelSize(prev => Math.max(4, Math.min(100, prev + (delta > 0 ? 1 : -1)))); lastPinchDistRef.current = dist; }
    }
  };
  const handleTouchEnd = () => { setIsPinching(false); lastPinchDistRef.current = null; };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); handleUndo(); } };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo]);

  const handleReset = () => {
    if (confirm("This will clear the entire canvas and cannot be undone. Continue?")) {
      if (sourceImage && dims) {
        pushToHistory(processed); setExcludedCodes(new Set()); setHighlightCode(null);
        setMergeThreshold(1); setEnableBgRemoval(false); setRemovedColors(new Map());
        processImage(sourceImage, dims.width, dims.height, 1, false, new Set(), ditherStrength);
        setHistoryStack([]);
      }
    }
  };

  const handleExportPatternPNG = () => {
    if (!processed || !dims) return;
    try {
      console.log('Exporting with options:', { gridInterval: 5 });
      exportFullPatternPNG(
        dims.width, 
        dims.height, 
        processed.pixels, 
        processed.colorStats, 
        colorIndexRef.current, 
        processed.backgroundIndices, 
        `perler-pattern-${dims.width}x${dims.height}.png`, 
        { 
          title: 'Bead Pattern',
          gridInterval: 5,
          showCoordinates: true,
          showGrid: true,
          showLegend: true
        }
      );
      toast.success('Exporting pattern...');
    } catch (err) { toast.error(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`); }
  };

  const handleExportCSV = () => {
    if (!processed || !dims) return;
    try { exportStatsAsCSV(processed.colorStats, colorIndexRef.current, `perler-stats-${dims.width}x${dims.height}.csv`); toast.success('CSV exported'); }
    catch (err) { toast.error(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`); }
  };

  const filteredColorStats = useMemo(() => {
    if (!processed) return new Map<string, number>();
    return new Map(Array.from(processed.colorStats.entries()).filter(([code]) => code && code !== 'BG' && !excludedCodes.has(code)));
  }, [processed, excludedCodes]);

  const totalBeads = useMemo(() => Array.from(filteredColorStats.values()).reduce((a, b) => a + b, 0), [filteredColorStats]);
  const totalColors = filteredColorStats.size;

  // Shared palette popup content
  const PalettePopupContent = () => (
    <>
      <div className="flex items-center justify-between mb-3 border-b pb-2">
        <h4 className="text-sm font-semibold text-[#452F60]">Artkal 221 Palette</h4>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setPaletteOpen(false)}>×</Button>
      </div>
      {Array.from(new Set(palette.map(c => c.code[0]))).sort().map(family => (
        <div key={family} className="mb-4">
          <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-2">
            <span className="w-4 h-[1px] bg-border"></span>Family {family}
          </h5>
          <div className="grid grid-cols-8 gap-1.5">
            {palette.filter(c => c.code.startsWith(family)).map(color => {
              const isH01 = color.code === 'H01';
              return (
                <Tooltip key={color.code}>
                  <TooltipTrigger asChild>
                    <button
                      className={`w-7 h-7 rounded-sm border transition-transform hover:scale-110 relative overflow-hidden ${selectedColor?.code === color.code ? 'ring-2 ring-purple-500 ring-offset-1 border-transparent' : 'border-gray-200'}`}
                      style={{ backgroundColor: color.hex }}
                      onClick={() => { setSelectedColor(color); setActiveTool('brush'); setPaletteOpen(false); toast(`Selected: ${color.code}`); }}
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
                    <div className="text-[10px]"><p className="font-bold">{color.code}</p><p className="opacity-80">{color.hex}</p></div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );

  return (
    <div className="h-screen flex flex-col bg-[#F5EFE6] overflow-hidden relative">
      <input
        id="hero-file-input"
        ref={hiddenFileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImageUpload(file);
          e.target.value = '';
        }}
      />
      {cropImageSrc && <CropModal imageSrc={cropImageSrc} onConfirm={handleCropConfirm} onCancel={handleCropCancel} />}

      {isSidebarOpen && isMobile && (
        <div className="fixed inset-0 bg-black/20 z-40 lg:hidden transition-opacity duration-300" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Header */}
      <header className="border-b border-border bg-white px-3 py-2 flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <a href="https://tools.yayascreativestudio.com/" className="flex-shrink-0 transition-transform hover:scale-105">
              <img src="/yaya_logo_final.png" alt="Logo" className="h-10 sm:h-12 w-auto" />
            </a>
            {processed && (
              <div className="hidden sm:flex text-[10px] sm:text-xs text-muted-foreground items-center gap-2">
                <span className="whitespace-nowrap">Total: <span className="font-semibold text-foreground">{totalBeads.toLocaleString()}</span> beads</span>
                <span className="text-border">·</span>
                <span className="whitespace-nowrap">Colors: <span className="font-semibold text-foreground">{totalColors}</span></span>
              </div>
            )}
          </div>
          {processed && (
            <div className="flex items-center gap-1.5">
              <ShopifyIntegration colorStats={filteredColorStats} />
              <ProjectManager
                hasActiveProject={!!processed}
                onSave={(name) => {
                  if (!processed) return;
                  try {
                    saveProject(name, {
                      thumbnailDataUrl: generateThumbnail(canvasRef.current),
                      gridWidth: processed.gridWidth,
                      gridHeight: processed.gridHeight,
                      pixelsJson: JSON.stringify(processed.pixels),
                      colorStatsJson: JSON.stringify(Array.from(processed.colorStats.entries())),
                      backgroundIndicesJson: JSON.stringify(Array.from(processed.backgroundIndices)),
                      gridSize,
                    });
                    toast.success(`Project "${name}" saved`);
                  } catch (e) {
                    toast.error('Save failed, please try again');
                  }
                }}
                onLoad={(project: SavedProject) => {
                  try {
                    const pixels = JSON.parse(project.pixelsJson);
                    const colorStats = new Map<string, number>(JSON.parse(project.colorStatsJson));
                    const backgroundIndices = new Set<number>(JSON.parse(project.backgroundIndicesJson));
                    const loaded = {
                      gridWidth: project.gridWidth,
                      gridHeight: project.gridHeight,
                      pixels,
                      colorStats,
                      backgroundCode: null,
                      backgroundIndices,
                    };
                    setProcessed(loaded);
                    setBaseProcessed(loaded);
                    setDims({ width: project.gridWidth, height: project.gridHeight });
                    setGridSize(project.gridSize);
                    toast.success(`Loaded project "${project.name}"`);
                  } catch (e) {
                    toast.error('Failed to load project — data may be corrupted');
                  }
                }}
              />
              <Button onClick={handleExportPatternPNG} size="sm" variant="outline" className="text-[9px] sm:text-xs gap-1 border-[#7B6A9B] text-[#7B6A9B] hover:bg-purple-50 rounded-full px-2 sm:px-3 h-7 w-full sm:w-auto">
                <Download className="w-3 h-3" /> Export Pattern
              </Button>
              {/* 右上角收起侧边栏按钮（暂时隐藏，保留代码以备恢复） */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hidden" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                    {isSidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isSidebarOpen ? 'Hide' : 'Show'} Settings Panel</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </header>

      {error && (
        <div className="mx-4 mt-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex-shrink-0">
          {error}<button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas Area — pb-[108px] on mobile reserves space for bottom toolbar */}
        <div className="flex-1 flex flex-col overflow-hidden pb-[108px] lg:pb-0">

          {/* Desktop Toolbar — hidden on mobile */}
          {processed && (
            <div className="hidden lg:flex border-b border-border px-4 py-2 items-center gap-3 flex-shrink-0 bg-white">
              <div className="flex items-center gap-2 border-r border-border pr-3">
                <span className="text-xs font-medium text-muted-foreground">Preview</span>
                <Switch checked={isPreview} onCheckedChange={setIsPreview} />
              </div>
              <div className="flex items-center gap-1 border-r border-border pr-3">
                <Tooltip><TooltipTrigger asChild>
                  <Button size="sm" variant={activeTool === 'brush' ? 'default' : 'ghost'} className="h-8 w-8 p-0" onClick={() => setActiveTool(activeTool === 'brush' ? 'none' : 'brush')}><Paintbrush className="w-4 h-4" /></Button>
                </TooltipTrigger><TooltipContent>Brush Tool</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild>
                  <Button size="sm" variant={activeTool === 'eraser' ? 'default' : 'ghost'} className="h-8 w-8 p-0" onClick={() => setActiveTool(activeTool === 'eraser' ? 'none' : 'eraser')}><Eraser className="w-4 h-4" /></Button>
                </TooltipTrigger><TooltipContent>Eraser Tool</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild>
                  <Button size="sm" variant={activeTool === 'eyedropper' ? 'default' : 'ghost'} className="h-8 w-8 p-0" onClick={() => setActiveTool(activeTool === 'eyedropper' ? 'none' : 'eyedropper')}><Pipette className="w-4 h-4" /></Button>
                </TooltipTrigger><TooltipContent>Eyedropper</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleUndo} disabled={historyStack.length === 0}><Undo2 className="w-4 h-4" /></Button>
                </TooltipTrigger><TooltipContent>Undo (Step Back)</TooltipContent></Tooltip>
              </div>
              <div className="flex items-center gap-1 border-l border-border pl-3">
                <span className="text-xs text-muted-foreground whitespace-nowrap mr-1">Size</span>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-full border-2 border-[#E53E3E] hover:bg-[#E53E3E]/10" onClick={() => setBrushSize(prev => Math.max(1, prev - 1))} disabled={brushSize <= 1}><Minus className="w-3.5 h-3.5" /></Button>
                <span className="text-xs font-mono text-muted-foreground w-5 text-center">{brushSize}</span>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-full border-2 border-[#38A169] hover:bg-[#38A169]/10" onClick={() => setBrushSize(prev => Math.min(30, prev + 1))} disabled={brushSize >= 30}><Plus className="w-3.5 h-3.5" /></Button>
              </div>
              {selectedColor && (
                <div className="relative flex items-center gap-1 border-x border-border px-3 cursor-pointer" onClick={() => setPaletteOpen((v: boolean) => !v)}>
                  <div className="w-5 h-5 rounded border border-gray-300" style={{ backgroundColor: selectedColor.hex }} />
                  <span className="text-xs font-medium">{selectedColor.code}</span>
                  {paletteOpen && (
                    <div className="absolute top-full left-0 w-96 mt-2 bg-[#F5EFE6] border border-border rounded-lg shadow-xl z-50 p-3 max-h-[500px] overflow-y-auto">
                      <PalettePopupContent />
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 border-r border-border pr-3">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Zoom</span>
                <div className="w-24 lg:w-32">
                  <Slider value={[pixelSize]} onValueChange={(v) => setPixelSize(v[0])} min={4} max={30} step={2} />
                </div>
                <span className="text-xs font-mono text-muted-foreground w-8 text-center">{pixelSize}px</span>
              </div>
              <div className="flex items-center gap-1 border-l border-border pl-3">
                <Tooltip><TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={handleReset}><Trash2 className="w-4 h-4" /></Button>
                </TooltipTrigger><TooltipContent>Reset Canvas (Clear All)</TooltipContent></Tooltip>
              </div>

              <Button size="sm" variant="ghost" className={`h-8 w-8 p-0 lg:hidden ${isSidebarOpen ? 'text-primary bg-primary/10' : ''}`} onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                {isSidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <SlidersHorizontal className="w-4 h-4" />}
              </Button>
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
          <div className="flex-1 overflow-auto flex items-start justify-center p-4 bg-[#F5EFE6]">
            {isProcessing && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#F5EFE6]/60 z-10">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" />Processing...</div>
              </div>
            )}
            {(sourceImage || processed) && processed ? (
              <canvas
                ref={canvasRef}
                className="border border-border shadow-sm bg-white"
                style={{ imageRendering: 'pixelated', cursor: activeTool === 'brush' ? 'crosshair' : activeTool === 'eraser' ? 'cell' : activeTool === 'eyedropper' ? 'copy' : 'default' }}
                onMouseMove={handleCanvasMouseMove}
                onMouseDown={handleCanvasMouseDown}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={() => { handleCanvasMouseLeave(); handleCanvasMouseUp(); }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              />
            ) : (
              <HeroIntro
                onUploadClick={() => hiddenFileInputRef.current?.click()}
                shopUrl="https://yayascreativestudio.com/"
                fileInputId="hero-file-input"
              />
            )}
          </div>

          {/* Status bar */}
          {dims && processed && (
            <div className="border-t border-border px-4 py-1.5 flex items-center justify-between text-xs text-muted-foreground bg-white flex-shrink-0">
              <span>Grid: {dims.width} x {dims.height} | Ratio: {getAspectRatioString(dims.width, dims.height)}</span>
              <span>Total: {totalBeads.toLocaleString()} beads | Colors: {totalColors}</span>
            </div>
          )}
        </div>

        {/* Right: Controls Panel */}
        {processed && (
<div className={`${isSidebarOpen ? 'w-80 translate-x-0' : 'w-0 translate-x-full lg:translate-x-0'} fixed lg:relative right-0 top-0 bottom-0 z-50 lg:z-0 border-l border-border flex flex-col overflow-visible bg-white flex-shrink-0 transition-all duration-300 ease-in-out`}>
  {/* Purple circle toggle — outside opacity div so always visible */}
  <button
    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
    title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
    className="absolute top-4 -left-3.5 z-30 w-7 h-7 rounded-full bg-[#7B6A9B] hover:bg-[#6a5a8a] active:bg-[#594a78] text-white shadow-md flex items-center justify-center transition-colors duration-150"
  >
    {isSidebarOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
  </button>
  <div className={`${isSidebarOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'} transition-all duration-200 flex flex-col h-full w-80 overflow-y-auto`}>
            <div className="p-4 border-b border-border" data-upload-panel="1">
              <h3 className="text-xs font-semibold mb-2 uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Upload className="w-3.5 h-3.5" /> Canvas Source</h3>
              <div className="space-y-2">
                <ImageUploadSection onImageUpload={handleImageUpload} isProcessing={isProcessing} onTrigger={() => hiddenFileInputRef.current?.click()} fileName={uploadedFileName} />
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={handleCreateCanvas} variant="outline" className="w-full text-[10px] h-8 gap-1.5 border-dashed" disabled={isProcessing}><Sparkles className="w-3 h-3" /> New Canvas</Button>
                  <Button onClick={handleRegenerateFromImage} variant="outline" className="w-full text-[10px] h-8 gap-1.5" disabled={isProcessing || !sourceImage}><RotateCcw className="w-3 h-3" /> Reset to Image</Button>
                </div>
              </div>
            </div>
            {processed && (
              <div className="p-4 border-b border-border space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><SlidersHorizontal className="w-3.5 h-3.5" /> Parameters</h3>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-foreground">Canvas Width (Beads)</label>
                    <span className="text-xs font-mono text-muted-foreground">{gridSize}</span>
                  </div>
                  <Slider value={[gridSize]} onValueChange={handleGridSizeChange} min={10} max={250} step={1} className="w-full" />
                  {dims && <p className="text-[10px] text-muted-foreground mt-1">Output: {dims.width} x {dims.height}</p>}
                </div>
                {canvasSource === 'image' && (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-foreground">Processing Mode</label>
                        <span className="text-xs font-mono text-muted-foreground">{processingMode}</span>
                      </div>
                      <select value={processingMode} onChange={(e) => handleModeChange(e.target.value)} className="w-full h-9 px-2 text-xs border border-border rounded-md bg-white">
                        <option value="clean">Clean Cartoon</option>
                        <option value="vivid">Vivid Game</option>
                        <option value="soft">Soft Illustration</option>
                      </select>
                      <p className="text-[10px] text-muted-foreground mt-1">clean = no dithering + stronger simplify · vivid = keep details · soft = gentle simplify</p>
                    </div>
                    {SHOW_DITHERING && (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-medium text-foreground">Color Detail (Dithering)</label>
                          <span className="text-xs font-mono text-muted-foreground">{ditherStrength}</span>
                        </div>
                        <Slider value={[ditherStrength]} onValueChange={handleDitherChange} min={0} max={100} step={1} className="w-full" />
                        <p className="text-[10px] text-muted-foreground mt-1">0 = off · 20–40 natural · 60+ grainy</p>
                      </div>
                    )}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-foreground">Color Palette Limit</label>
                        <span className="text-xs font-mono text-muted-foreground">{maxColors}</span>
                      </div>
                      <Slider value={[maxColorIndex]} onValueChange={(v) => setMaxColorIndex(v[0])} min={0} max={MAX_COLOR_OPTIONS.length - 1} step={1} className="w-full" />
                      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">{MAX_COLOR_OPTIONS.map((n) => <span key={n}>{n}</span>)}</div>
                      <p className="text-[10px] text-muted-foreground mt-1">221 = most vivid · 50 = cleaner cartoon · 20 = very simplified</p>
                    </div>
                    {SHOW_SIMPLIFY_SMALL_AREAS && (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-medium text-foreground">Simplify Small Areas</label>
                          <span className="text-xs font-mono text-muted-foreground">{mergeThreshold}</span>
                        </div>
                        <Slider value={[mergeThreshold]} onValueChange={handleMergeChange} min={1} max={12} step={1} className="w-full" />
                        <p className="text-[10px] text-muted-foreground mt-1">Regions smaller than {mergeThreshold}px will be merged</p>
                      </div>
                    )}
                    {SHOW_REMOVE_BACKGROUND && (
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-foreground">Remove Background</label>
                        <Switch checked={enableBgRemoval} onCheckedChange={handleBgToggle} />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {processed && (
              <div className="p-4 border-b border-border">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3"><Sparkles className="w-3.5 h-3.5" /> Clean Up Stray Beads</h3>
                <NoiseColorRemoval colorStats={processed.colorStats} palette={colorIndexRef.current} threshold={10} onRemoveColor={handleRemoveNoiseColor} onRestoreColor={handleRestoreColor} onRestoreAll={handleRestoreAll} removedColors={removedColors} />
              </div>
            )}
            {processed && (
              <div className="p-4 border-b border-border">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3"><Layers className="w-3.5 h-3.5" /> Bead Count & Colors ({totalColors})</h3>
                <p className="text-[10px] text-muted-foreground mb-2">Click to highlight · ✏️ to replace</p>
                <div className="space-y-0.5 max-h-72 overflow-y-auto mb-4">
                  {Array.from(processed.colorStats.entries()).sort((a, b) => b[1] - a[1]).map(([code, count]) => {
                    const color = colorIndexRef.current.get(code);
                    const pct = totalBeads > 0 ? ((count / totalBeads) * 100).toFixed(1) : '0';
                    const isExcluded = excludedCodes.has(code);
                    const isHighlighted = highlightCode === code;
                    return (
                      <div key={code} className="relative group">
                        <div
                          className={`flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer transition-colors ${isHighlighted ? 'bg-purple-50 ring-1 ring-purple-300' : 'hover:bg-gray-50'} ${isExcluded ? 'opacity-40 line-through' : ''}`}
                          onClick={() => handleHighlightColor(code)}
                          onContextMenu={(e) => { e.preventDefault(); handleExcludeColor(code); }}
                        >
                          {color && <div className="w-4 h-4 rounded-sm border border-gray-300 flex-shrink-0" style={{ backgroundColor: color.hex }} />}
                          <span className="font-mono font-medium flex-shrink-0 w-8">{code}</span>
                          <div className="flex-1 h-1.5 bg-[#D9D0C4] rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.max(2, parseFloat(pct))}%`, backgroundColor: color?.hex || '#999' }} />
                          </div>
                          <span className="text-muted-foreground flex-shrink-0 w-10 text-right font-mono">{count}</span>
                          <span className="text-muted-foreground flex-shrink-0 w-10 text-right">{pct}%</span>
                          <button
                            className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto flex-shrink-0 w-5 h-5 rounded flex items-center justify-center hover:bg-purple-100 text-[#7B6A9B]"
                            title={`Replace all ${code} beads`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setReplaceTargetCode(code);
                              setReplaceFamilyFilter('A');
                              setReplaceModalOpen(true);
                            }}
                          >
                            ✏️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Quick Breakdown</span>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] gap-1 hover:bg-purple-50 text-[#7B6A9B]" onClick={handleCopyBreakdown}>
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}{copied ? 'Copied!' : 'Copy breakdown'}
                    </Button>
                  </div>
                  <textarea readOnly value={breakdownText} className="w-full h-20 p-2 text-[10px] font-mono bg-gray-50 border border-border rounded resize-none focus:outline-none" placeholder="No beads to show" />
                </div>
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {/* ── Replace Color Modal ── */}
      {replaceModalOpen && replaceTargetCode && (() => {
        const targetColor = colorIndexRef.current.get(replaceTargetCode);
        const families = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'M'];
        const filteredPalette = palette.filter(
          c => c.code.startsWith(replaceFamilyFilter)
        );
        return (
          <div className="fixed inset-0 z-[200] flex items-center justify-center">
            {/* Backdrop - clicking does NOT close modal */}
            <div className="absolute inset-0 bg-black/40" />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-[90vw] max-w-[640px] max-h-[85vh] flex flex-col overflow-hidden">

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div>
                  <h3 className="font-bold text-sm text-gray-800">🎨 Choose a Replacement Color</h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">All beads of this color will be replaced instantly</p>
                </div>
                <div className="flex items-center gap-3">
                  {targetColor && (
                    <div className="flex items-center gap-2 bg-purple-50 px-3 py-1.5 rounded-lg">
                      <div className="w-4 h-4 rounded border border-gray-200 flex-shrink-0" style={{ backgroundColor: targetColor.hex }} />
                      <span className="text-xs font-bold text-[#7B6A9B]">Replacing: {replaceTargetCode}</span>
                    </div>
                  )}
                  <button
                    onClick={() => { setReplaceModalOpen(false); setReplaceTargetCode(null); }}
                    className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors text-sm font-medium"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Family Filter Tabs */}
              <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap gap-1.5">
                {families.map(f => (
                  <button
                    key={f}
                    onClick={() => setReplaceFamilyFilter(f)}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-all ${
                      replaceFamilyFilter === f
                        ? 'bg-[#7B6A9B] text-white border-[#7B6A9B]'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-[#7B6A9B] hover:text-[#7B6A9B]'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* Color Grid */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-2">
                  {filteredPalette.filter(c => c.hex && c.hex !== '#null').map(color => {
                    const isCurrent = color.code === replaceTargetCode;
                    return (
                      <button
                        key={color.code}
                        onClick={() => handleMassReplace(replaceTargetCode, color.code)}
                        className={`rounded-xl overflow-hidden border-2 transition-all hover:scale-105 hover:shadow-md ${
                          isCurrent
                            ? 'border-[#7B6A9B] shadow-md ring-2 ring-[#7B6A9B]/30'
                            : 'border-transparent hover:border-[#7B6A9B]'
                        }`}
                        title={color.code}
                      >
                        <div className="h-10 w-full" style={{ backgroundColor: color.hex }} />
                        <div className="bg-white px-1 py-0.5 text-center relative">
                          <span className="text-[10px] font-mono font-medium text-gray-700 leading-tight block truncate">
                            {color.code}
                          </span>
                          {isCurrent && (
                            <span className="absolute -top-1.5 right-0.5 text-[8px] text-[#7B6A9B] font-bold">★</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Footer hint */}
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                <p className="text-[11px] text-gray-400">★ = current color &nbsp;·&nbsp; Click any swatch to replace all matching beads</p>
                <p className="text-[11px] text-gray-400">{filteredPalette.filter(c => c.hex && c.hex !== '#null').length} colors</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============================================
          Mobile Bottom Toolbar — lg:hidden only
          ============================================ */}
      {processed && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-border shadow-lg pb-safe">
          {/* Row 1: Tool buttons - Horizontal Scrollable for small screens */}
          <div className="flex items-center justify-between px-2 pt-2 pb-1 overflow-x-auto no-scrollbar">
            <button onClick={() => setIsPreview(v => !v)} className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] min-w-[56px] flex-shrink-0 ${isPreview ? 'bg-purple-100 text-[#7B6A9B]' : 'text-gray-500'}`}>
              <Eye className="w-5 h-5" /><span>Preview</span>
            </button>
            <button onClick={() => setActiveTool(activeTool === 'brush' ? 'none' : 'brush')} className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] min-w-[56px] flex-shrink-0 ${activeTool === 'brush' ? 'bg-purple-100 text-[#7B6A9B]' : 'text-gray-500'}`}>
              <Paintbrush className="w-5 h-5" /><span>Brush</span>
            </button>
            <button onClick={() => setActiveTool(activeTool === 'eraser' ? 'none' : 'eraser')} className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] min-w-[56px] flex-shrink-0 ${activeTool === 'eraser' ? 'bg-purple-100 text-[#7B6A9B]' : 'text-gray-500'}`}>
              <Eraser className="w-5 h-5" /><span>Eraser</span>
            </button>
            <button onClick={() => setActiveTool(activeTool === 'eyedropper' ? 'none' : 'eyedropper')} className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] min-w-[56px] flex-shrink-0 ${activeTool === 'eyedropper' ? 'bg-purple-100 text-[#7B6A9B]' : 'text-gray-500'}`}>
              <Pipette className="w-5 h-5" /><span>Pick</span>
            </button>
            <button onClick={handleUndo} disabled={historyStack.length === 0} className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] min-w-[56px] flex-shrink-0 text-gray-500 disabled:opacity-30">
              <Undo2 className="w-5 h-5" /><span>Undo</span>
            </button>
            <button onClick={() => setPaletteOpen(v => !v)} className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] min-w-[56px] flex-shrink-0 ${paletteOpen ? 'bg-purple-100 text-[#7B6A9B]' : 'text-gray-500'}`}>
              {selectedColor
                ? <div className="w-5 h-5 rounded border-2 border-gray-300" style={{ backgroundColor: selectedColor.hex }} />
                : <Palette className="w-5 h-5" />
              }
              <span>{selectedColor ? selectedColor.code : 'Color'}</span>
            </button>
            <button onClick={() => setIsSidebarOpen(v => !v)} className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] min-w-[56px] flex-shrink-0 ${isSidebarOpen ? 'bg-purple-100 text-[#7B6A9B]' : 'text-gray-500'}`}>
              <SlidersHorizontal className="w-5 h-5" /><span>Settings</span>
            </button>
          </div>

          {/* Row 2: Brush size + Zoom */}
          <div className="flex items-center gap-3 px-4 pb-3 pt-1">
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[10px] text-muted-foreground">Size</span>
              <button onClick={() => setBrushSize(prev => Math.max(1, prev - 1))} disabled={brushSize <= 1} className="w-6 h-6 flex items-center justify-center rounded border border-border disabled:opacity-30">
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-xs font-mono w-5 text-center">{brushSize}</span>
              <button onClick={() => setBrushSize(prev => Math.min(30, prev + 1))} disabled={brushSize >= 30} className="w-6 h-6 flex items-center justify-center rounded border border-border disabled:opacity-30">
                <Plus className="w-3 h-3" />
              </button>
            </div>
            <div className="flex items-center gap-2 flex-1">
              <span className="text-[10px] text-muted-foreground flex-shrink-0">Zoom</span>
              <Slider value={[pixelSize]} onValueChange={(v) => setPixelSize(v[0])} min={4} max={30} step={2} className="flex-1" />
              <span className="text-[10px] font-mono text-muted-foreground w-8 flex-shrink-0 text-right">{pixelSize}px</span>
            </div>
          </div>

          {/* Mobile Palette Popup */}
          {paletteOpen && (
            <div className="absolute bottom-full left-0 right-0 bg-white border-t border-border shadow-2xl z-50 p-3 max-h-72 overflow-y-auto">
              <PalettePopupContent />
            </div>
          )}
        </div>
      )}

    </div>
  );
}
