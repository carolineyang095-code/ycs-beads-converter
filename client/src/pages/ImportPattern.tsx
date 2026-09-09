import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Image as ImageIcon, Download, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import ShopifyIntegration from '@/components/ShopifyIntegration';
import NoiseColorRemoval from '@/components/NoiseColorRemoval';
import PatternGridSelector from '@/components/PatternGridSelector';
import PatternColorReview from '@/components/PatternColorReview';
import {
  loadImage,
  drawPixelGrid,
  exportStatsAsCSV,
  ProcessedImage,
} from '@/lib/imageProcessing';
import { exportFullPatternPNG } from '@/lib/exportPattern';
import { createColorIndex, ColorData } from '@/lib/colorMapping';
import {
  GridFrame,
  GridAnalysisResult,
  analyzeGrid,
  buildProcessedImage,
} from '@/lib/patternImport';

type WizardStep = 1 | 2 | 3 | 4;

export default function ImportPattern() {
  const { t } = useTranslation();

  const [step, setStep] = useState<WizardStep>(1);
  const [sourceCanvas, setSourceCanvas] = useState<HTMLCanvasElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [frame, setFrame] = useState<GridFrame | null>(null);
  const [columns, setColumns] = useState(30);
  const [rows, setRows] = useState(30);
  const [mergeThreshold, setMergeThreshold] = useState(12);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<GridAnalysisResult | null>(null);

  const [palette, setPalette] = useState<ColorData[]>([]);
  const [processed, setProcessed] = useState<ProcessedImage | null>(null);
  const [baseProcessed, setBaseProcessed] = useState<ProcessedImage | null>(null);
  const [removedColors, setRemovedColors] = useState<Map<string, string>>(new Map());

  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const paletteIndex = useMemo(() => createColorIndex(palette), [palette]);

  useEffect(() => {
    const loadPalette = async () => {
      try {
        const response = await fetch('/artkal_221.json');
        if (!response.ok) throw new Error('Failed to load color palette');
        const data: ColorData[] = await response.json();
        setPalette(data);
      } catch (err) {
        setError(`Failed to load palette: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };
    loadPalette();
  }, []);

  useEffect(() => {
    if (!processed || !canvasRef.current) return;
    const pixelSize = Math.max(4, Math.min(24, Math.floor(720 / Math.max(processed.gridWidth, processed.gridHeight))));
    try {
      drawPixelGrid(
        canvasRef.current,
        processed.gridWidth,
        processed.gridHeight,
        processed.pixels,
        pixelSize,
        true,
        null,
        processed.backgroundIndices,
        true,
        false
      );
    } catch (err) {
      console.error('Draw error:', err);
    }
  }, [processed]);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    try {
      setError(null);
      const canvas = await loadImage(file);
      setSourceCanvas(canvas);
      setFileName(file.name);
      setFrame({
        x: canvas.width * 0.05,
        y: canvas.height * 0.05,
        width: canvas.width * 0.9,
        height: canvas.height * 0.9,
      });
      setColumns(30);
      setRows(30);
      setAnalysis(null);
      setProcessed(null);
      setBaseProcessed(null);
      setRemovedColors(new Map());
      setStep(2);
    } catch (err) {
      setError(`Failed to load image: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleAnalyze = () => {
    if (!sourceCanvas || !frame || palette.length === 0) return;
    setIsAnalyzing(true);
    try {
      const result = analyzeGrid(sourceCanvas, frame, columns, rows, palette, mergeThreshold);
      setAnalysis(result);
      setStep(3);
    } catch (err) {
      setError(`Analysis error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      toast.error('Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirm = () => {
    if (!analysis) return;
    const result = buildProcessedImage(analysis.groups, analysis.cellColors, columns, rows, paletteIndex);
    setProcessed(result);
    setBaseProcessed(result);
    setRemovedColors(new Map());
    setStep(4);
  };

  const handleRemoveNoiseColor = (code: string, replacementCode: string) => {
    if (!processed) return;
    const newPixels = processed.pixels.map((pixel) => {
      if (pixel.code === code && !pixel.isBackground) {
        const replacement = paletteIndex.get(replacementCode);
        if (replacement) return { ...pixel, code: replacement.code, hex: replacement.hex, rgb: replacement.rgb };
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
      if (basePixel && basePixel.code === code) return { ...basePixel };
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

  const handleExportCSV = () => {
    if (!processed) return;
    exportStatsAsCSV(processed.colorStats, paletteIndex, `${fileName || 'pattern'}-stats.csv`, 'mard');
  };

  const handleExportPNG = () => {
    if (!processed) return;
    exportFullPatternPNG(
      processed.gridWidth,
      processed.gridHeight,
      processed.pixels,
      processed.colorStats,
      paletteIndex,
      processed.backgroundIndices,
      `${fileName || 'pattern'}-import.png`,
      undefined,
      'mard'
    );
  };

  const totalBeads = processed ? Array.from(processed.colorStats.values()).reduce((a, b) => a + b, 0) : 0;
  const totalColors = processed ? processed.colorStats.size : 0;

  const steps: Array<{ id: WizardStep; label: string }> = [
    { id: 1, label: t('import.step1Title') },
    { id: 2, label: t('import.step2Title') },
    { id: 3, label: t('import.step3Title') },
    { id: 4, label: t('import.step4Title') },
  ];

  return (
    <div className="min-h-screen bg-[#F5EFE6]">
      <div className="bg-[#332847] text-white px-4 py-8 sm:px-8 sm:py-10">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-semibold" style={{ fontFamily: '"Caveat", cursive' }}>
            {t('import.pageTitle')}
          </h1>
          <p className="text-[#b8a8d4] text-sm sm:text-base mt-2">{t('import.subtitle')}</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          {steps.map((s, idx) => (
            <div key={s.id} className="flex items-center gap-2">
              <span
                className={`text-xs sm:text-sm font-medium px-3 py-1 rounded-full border ${
                  step === s.id
                    ? 'bg-[#4db8a0] border-[#4db8a0] text-white'
                    : step > s.id
                    ? 'bg-[#E8E3F0] border-[#E8E3F0] text-[#5a4f6a]'
                    : 'bg-white border-[#E8E3F0] text-[#5a4f6a]'
                }`}
              >
                {s.id}. {s.label}
              </span>
              {idx < steps.length - 1 && <span className="text-[#7B6A9B]">›</span>}
            </div>
          ))}
        </div>

        {error && (
          <div className="border-l-4 border-red-400 bg-red-50 text-red-700 text-sm rounded-r-md px-3 py-2">
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="bg-white rounded-xl shadow-sm border border-[#E8E3F0] p-6 space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = '';
              }}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
                isDragging ? 'border-[#4db8a0] bg-[#4db8a0]/5' : 'border-[#E8E3F0] hover:border-[#4db8a0]/50'
              }`}
            >
              <div className="flex flex-col items-center gap-2">
                {fileName ? <ImageIcon className="w-8 h-8 text-[#7B6A9B]" /> : <Upload className="w-8 h-8 text-[#7B6A9B]" />}
                <p className="text-sm text-[#332847]">{fileName || t('import.dropzone')}</p>
              </div>
            </div>
            <p className="text-xs text-[#5a4f6a]">{t('import.tip')}</p>
          </div>
        )}

        {step === 2 && sourceCanvas && frame && (
          <div className="bg-white rounded-xl shadow-sm border border-[#E8E3F0] p-6 space-y-4">
            <PatternGridSelector
              canvas={sourceCanvas}
              frame={frame}
              columns={columns}
              rows={rows}
              onFrameChange={setFrame}
              onColumnsChange={setColumns}
              onRowsChange={setRows}
            />

            <div className="space-y-1.5 max-w-sm">
              <label className="text-xs font-medium text-[#332847]">
                {t('import.threshold')}: {mergeThreshold}
              </label>
              <Slider
                value={[mergeThreshold]}
                onValueChange={(v) => setMergeThreshold(v[0])}
                min={6}
                max={30}
                step={1}
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep(1)} className="border-[#7B6A9B] text-[#7B6A9B]">
                {t('import.back')}
              </Button>
              <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing || palette.length === 0}
                className="bg-[#4db8a0] hover:bg-[#3fa38d] text-white"
              >
                {t('import.analyze')}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && analysis && (
          <div className="bg-white rounded-xl shadow-sm border border-[#E8E3F0] p-6 space-y-4">
            <h2 className="text-sm font-semibold text-[#332847]">
              {t('import.detectedColors')} ({analysis.groups.length})
            </h2>
            <PatternColorReview
              groups={analysis.groups}
              palette={palette}
              onGroupsChange={(groups) => setAnalysis({ ...analysis, groups })}
            />
            <div className="flex items-center gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep(2)} className="border-[#7B6A9B] text-[#7B6A9B]">
                {t('import.back')}
              </Button>
              <Button onClick={handleConfirm} className="bg-[#4db8a0] hover:bg-[#3fa38d] text-white">
                {t('import.confirm')}
              </Button>
            </div>
          </div>
        )}

        {step === 4 && processed && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-[#E8E3F0] p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-4 text-sm text-[#332847]">
                  <span>
                    <span className="font-semibold">{t('import.totalBeads')}:</span> {totalBeads.toLocaleString()}
                  </span>
                  <span>
                    <span className="font-semibold">{t('import.totalColors')}:</span> {totalColors}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ShopifyIntegration colorStats={processed.colorStats} paletteType="mard" />
                  <Button variant="outline" size="sm" onClick={handleExportCSV} className="text-xs gap-1.5 border-[#7B6A9B] text-[#7B6A9B]">
                    <FileDown className="w-3.5 h-3.5" /> CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportPNG} className="text-xs gap-1.5 border-[#7B6A9B] text-[#7B6A9B]">
                    <Download className="w-3.5 h-3.5" /> PNG
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <canvas ref={canvasRef} className="border border-[#E8E3F0] rounded-md" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-[#E8E3F0] p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#5a4f6a] mb-3">
                  {t('import.detectedColors')}
                </h3>
                <div className="space-y-0.5 max-h-80 overflow-y-auto">
                  {Array.from(processed.colorStats.entries())
                    .sort((a, b) => b[1] - a[1])
                    .map(([code, count]) => {
                      const color = paletteIndex.get(code);
                      return (
                        <div key={code} className="flex items-center gap-2 px-2 py-1 rounded text-xs">
                          {color && (
                            <div
                              className="w-4 h-4 rounded-sm border border-gray-300 flex-shrink-0"
                              style={{ backgroundColor: color.hex }}
                            />
                          )}
                          <span className="font-mono font-medium flex-shrink-0 w-10">{code}</span>
                          <span className="text-[#5a4f6a] truncate flex-1">{color?.name}</span>
                          <span className="text-[#332847] font-semibold">{count}</span>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-[#E8E3F0] p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#5a4f6a] mb-3">
                  {t('sidebar.cleanUpStray') /* reuse existing key: noise-color cleanup section title */}
                </h3>
                <NoiseColorRemoval
                  colorStats={processed.colorStats}
                  palette={paletteIndex}
                  threshold={10}
                  onRemoveColor={handleRemoveNoiseColor}
                  onRestoreColor={handleRestoreColor}
                  onRestoreAll={handleRestoreAll}
                  removedColors={removedColors}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
