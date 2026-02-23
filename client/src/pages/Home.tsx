import { useState, useRef, useEffect } from 'react';
import { Upload, Download, Grid3x3, Settings, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import ImageUploadSection from '@/components/ImageUploadSection';
import GridSizeSelector from '@/components/GridSizeSelector';
import CanvasPreview from '@/components/CanvasPreview';
import ColorStatistics from '@/components/ColorStatistics';
import ShopifyIntegration from '@/components/ShopifyIntegration';
import { loadImage, resizeImageToGrid, processImageToGrid, drawPixelGrid, exportGridAsPNG, exportStatsAsCSV, getTotalBeadCount, calculateGridDimensions, getAspectRatioString } from '@/lib/imageProcessing';
import { createColorIndex } from '@/lib/colorMapping';
import { ColorData, ProcessedImage } from '@/lib/imageProcessing';

const GRID_SIZES = [30, 50, 80, 120, 200];

/**
 * Home Page - Main Perler Bead Converter Interface
 * 
 * Design: Minimalist Craft Studio with optimized layout
 * - Large canvas on left (occupies majority of space)
 * - Compact controls on right (upload, grid size, statistics)
 * - Real-time updates with smooth transitions
 */
export default function Home() {
  const [palette, setPalette] = useState<ColorData[]>([]);
  const [selectedGridSize, setSelectedGridSize] = useState<number>(50);
  const [sourceImage, setSourceImage] = useState<HTMLCanvasElement | null>(null);
  const [calculatedGridDimensions, setCalculatedGridDimensions] = useState<{ width: number; height: number } | null>(null);
  const [processedImage, setProcessedImage] = useState<ProcessedImage | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorIndexRef = useRef<Map<string, ColorData>>(new Map());

  // Load color palette on mount
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

  // Handle image upload
  const handleImageUpload = async (file: File) => {
    setError(null);
    try {
      setIsProcessing(true);
      const canvas = await loadImage(file);
      setSourceImage(canvas);
      // Calculate dynamic grid dimensions based on image aspect ratio
      const dimensions = calculateGridDimensions(canvas, selectedGridSize);
      setCalculatedGridDimensions(dimensions);
      // Auto-process with calculated dimensions
      processImage(canvas, dimensions.width, dimensions.height);
    } catch (err) {
      setError(`Failed to load image: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Process image with selected grid size
  const processImage = (canvas: HTMLCanvasElement, gridWidth: number, gridHeight: number) => {
    if (palette.length === 0) {
      setError('Color palette not loaded');
      return;
    }

    try {
      setIsProcessing(true);
      // Resize image to grid size using nearest neighbor
      const resizedCanvas = resizeImageToGrid(canvas, gridWidth, gridHeight);
      // Process to create pixel grid with color mapping
      const processed = processImageToGrid(resizedCanvas, gridWidth, gridHeight, palette);
      setProcessedImage(processed);
      
      // Draw on canvas
      if (canvasRef.current) {
        drawPixelGrid(canvasRef.current, gridWidth, gridHeight, processed.pixels, 15, true);
      }
    } catch (err) {
      setError(`Failed to process image: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle grid size change
  const handleGridSizeChange = (size: number) => {
    setSelectedGridSize(size);
    if (sourceImage) {
      const dimensions = calculateGridDimensions(sourceImage, size);
      setCalculatedGridDimensions(dimensions);
      processImage(sourceImage, dimensions.width, dimensions.height);
    }
  };

  // Export as PNG
  const handleExportPNG = () => {
    if (canvasRef.current && calculatedGridDimensions) {
      exportGridAsPNG(canvasRef.current, `perler-pattern-${calculatedGridDimensions.width}x${calculatedGridDimensions.height}.png`);
    }
  };

  // Export as CSV
  const handleExportCSV = () => {
    if (processedImage && colorIndexRef.current && calculatedGridDimensions) {
      exportStatsAsCSV(processedImage.colorStats, colorIndexRef.current, `perler-stats-${calculatedGridDimensions.width}x${calculatedGridDimensions.height}.csv`);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="container py-4">
          <h1 className="text-3xl font-bold text-foreground font-playfair">
            Perler Bead Pattern Converter
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Convert images to perler bead patterns with Artkal 221 color mapping
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container py-6 flex gap-6">
        {error && (
          <div className="absolute top-24 left-6 right-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm z-10">
            {error}
          </div>
        )}

        {/* Left Column - Large Canvas */}
        <div className="flex-1 flex flex-col min-w-0">
          {sourceImage && calculatedGridDimensions ? (
            <Card className="flex-1 p-6 flex flex-col">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Maximize2 className="w-5 h-5" />
                Pattern Preview
              </h2>
              <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-lg border border-border overflow-auto">
                {isProcessing ? (
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <p className="mt-2 text-muted-foreground">Processing image...</p>
                  </div>
                ) : (
                  <canvas
                    ref={canvasRef}
                    className="max-w-full max-h-full"
                    style={{ imageRendering: 'pixelated' }}
                  />
                )}
              </div>
              <div className="mt-4 text-sm text-muted-foreground text-center">
                <p>Grid: <strong>{calculatedGridDimensions.width} × {calculatedGridDimensions.height}</strong> | Aspect: <strong>{getAspectRatioString(calculatedGridDimensions.width, calculatedGridDimensions.height)}</strong></p>
                <p>Total beads: <strong>{getTotalBeadCount(calculatedGridDimensions.width, calculatedGridDimensions.height)}</strong></p>
              </div>
            </Card>
          ) : (
            <Card className="flex-1 p-6 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Upload className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Upload an image to get started</p>
              </div>
            </Card>
          )}
        </div>

        {/* Right Column - Compact Controls */}
        <div className="w-80 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-200px)]">
          {/* Image Upload */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Upload Image
            </h3>
            <ImageUploadSection 
              onImageUpload={handleImageUpload}
              isProcessing={isProcessing}
            />
          </Card>

          {/* Grid Size Selection */}
          {sourceImage && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Grid3x3 className="w-4 h-4" />
                Grid Size
              </h3>
              <GridSizeSelector
                sizes={GRID_SIZES}
                selected={selectedGridSize}
                onSelect={handleGridSizeChange}
                isProcessing={isProcessing}
              />
              {calculatedGridDimensions && (
                <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-muted-foreground">
                  <p>Dimensions: <strong>{calculatedGridDimensions.width}×{calculatedGridDimensions.height}</strong></p>
                  <p>Ratio: <strong>{getAspectRatioString(calculatedGridDimensions.width, calculatedGridDimensions.height)}</strong></p>
                </div>
              )}
            </Card>
          )}

          {/* Export Options */}
          {processedImage && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export
              </h3>
              <div className="space-y-2">
                <Button 
                  onClick={handleExportPNG}
                  variant="default"
                  className="w-full text-sm"
                  size="sm"
                >
                  PNG
                </Button>
                <Button 
                  onClick={handleExportCSV}
                  variant="outline"
                  className="w-full text-sm"
                  size="sm"
                >
                  CSV
                </Button>
              </div>
            </Card>
          )}

          {/* Color Statistics */}
          {processedImage && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">Colors Used</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {Array.from(processedImage.colorStats.entries())
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 10)
                  .map(([code, count]) => {
                    const color = colorIndexRef.current.get(code);
                    return (
                      <div key={code} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          {color && (
                            <div
                              className="w-4 h-4 rounded border border-gray-300"
                              style={{ backgroundColor: color.hex }}
                            />
                          )}
                          <span className="font-medium">{code}</span>
                        </div>
                        <span className="text-muted-foreground">{count}</span>
                      </div>
                    );
                  })}
              </div>
            </Card>
          )}

          {/* Shopify Integration */}
          {processedImage && (
            <ShopifyIntegration
              colorStats={processedImage.colorStats}
              palette={colorIndexRef.current}
            />
          )}
        </div>
      </main>
    </div>
  );
}
