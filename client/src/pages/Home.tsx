import { useState, useRef, useEffect } from 'react';
import { Upload, Download, Grid3x3, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import ImageUploadSection from '@/components/ImageUploadSection';
import GridSizeSelector from '@/components/GridSizeSelector';
import CanvasPreview from '@/components/CanvasPreview';
import ColorStatistics from '@/components/ColorStatistics';
import ShopifyIntegration from '@/components/ShopifyIntegration';
import { loadImage, resizeImageToGrid, processImageToGrid, drawPixelGrid, exportGridAsPNG, exportStatsAsCSV, getTotalBeadCount } from '@/lib/imageProcessing';
import { createColorIndex } from '@/lib/colorMapping';
import { ColorData, ProcessedImage } from '@/lib/imageProcessing';

const GRID_SIZES = [30, 50, 80, 120, 200];

/**
 * Home Page - Main Perler Bead Converter Interface
 * 
 * Design: Minimalist Craft Studio
 * - Two-column asymmetric layout: controls (left) + preview (right)
 * - Clean white background with dynamic accents from bead palette
 * - Smooth transitions and real-time updates
 */
export default function Home() {
  const [palette, setPalette] = useState<ColorData[]>([]);
  const [selectedGridSize, setSelectedGridSize] = useState<number>(30);
  const [sourceImage, setSourceImage] = useState<HTMLCanvasElement | null>(null);
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
      // Auto-process with current grid size
      processImage(canvas, selectedGridSize);
    } catch (err) {
      setError(`Failed to load image: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Process image with selected grid size
  const processImage = (canvas: HTMLCanvasElement, gridSize: number) => {
    if (palette.length === 0) {
      setError('Color palette not loaded');
      return;
    }

    try {
      setIsProcessing(true);
      // Resize image to grid size using nearest neighbor
      const resizedCanvas = resizeImageToGrid(canvas, gridSize, gridSize);
      // Process to create pixel grid with color mapping
      const processed = processImageToGrid(resizedCanvas, gridSize, gridSize, palette);
      setProcessedImage(processed);
      
      // Draw on canvas
      if (canvasRef.current) {
        drawPixelGrid(canvasRef.current, gridSize, gridSize, processed.pixels, 15, true);
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
      processImage(sourceImage, size);
    }
  };

  // Export as PNG
  const handleExportPNG = () => {
    if (canvasRef.current) {
      exportGridAsPNG(canvasRef.current, `perler-pattern-${selectedGridSize}x${selectedGridSize}.png`);
    }
  };

  // Export as CSV
  const handleExportCSV = () => {
    if (processedImage && colorIndexRef.current) {
      exportStatsAsCSV(processedImage.colorStats, colorIndexRef.current, `perler-stats-${selectedGridSize}x${selectedGridSize}.csv`);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="container py-6">
          <h1 className="text-4xl font-bold text-foreground font-playfair">
            Perler Bead Pattern Converter
          </h1>
          <p className="text-muted-foreground mt-2">
            Convert any image into a perler bead pattern with Artkal 221 color mapping
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Controls */}
          <div className="lg:col-span-1 space-y-6">
            {/* Image Upload */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload Image
              </h2>
              <ImageUploadSection 
                onImageUpload={handleImageUpload}
                isProcessing={isProcessing}
              />
            </Card>

            {/* Grid Size Selection */}
            {sourceImage && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Grid3x3 className="w-5 h-5" />
                  Grid Size
                </h2>
                <GridSizeSelector
                  sizes={GRID_SIZES}
                  selected={selectedGridSize}
                  onSelect={handleGridSizeChange}
                  isProcessing={isProcessing}
                />
              </Card>
            )}

            {/* Export Options */}
            {processedImage && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  Export
                </h2>
                <div className="space-y-3">
                  <Button 
                    onClick={handleExportPNG}
                    variant="default"
                    className="w-full"
                  >
                    Export as PNG
                  </Button>
                  <Button 
                    onClick={handleExportCSV}
                    variant="outline"
                    className="w-full"
                  >
                    Export as CSV
                  </Button>
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

          {/* Right Column - Preview & Statistics */}
          <div className="lg:col-span-2 space-y-6">
            {/* Canvas Preview */}
            {sourceImage && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Pattern Preview</h2>
                <CanvasPreview
                  canvasRef={canvasRef}
                  gridSize={selectedGridSize}
                  isProcessing={isProcessing}
                />
              </Card>
            )}

            {/* Color Statistics */}
            {processedImage && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Color Statistics</h2>
                <ColorStatistics
                  colorStats={processedImage.colorStats}
                  palette={colorIndexRef.current}
                  totalBeads={getTotalBeadCount(selectedGridSize, selectedGridSize)}
                />
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
