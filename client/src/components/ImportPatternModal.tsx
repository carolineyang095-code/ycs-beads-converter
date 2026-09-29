import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { X } from 'lucide-react';
import PatternGridSelector from '@/components/PatternGridSelector';
import PatternColorReview from '@/components/PatternColorReview';
import { createColorIndex, ColorData } from '@/lib/colorMapping';
import { ProcessedImage } from '@/lib/imageProcessing';
import {
  GridFrame,
  GridAnalysisResult,
  analyzeGrid,
  buildProcessedImage,
} from '@/lib/patternImport';

interface ImportPatternModalProps {
  imageSrc: string;
  palette: ColorData[];
  onConfirm: (result: ProcessedImage) => void;
  onCancel: () => void;
}

type ModalStep = 'grid' | 'review';

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Failed to get canvas context')); return; }
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

export default function ImportPatternModal({ imageSrc, palette, onConfirm, onCancel }: ImportPatternModalProps) {
  const { t } = useTranslation();

  const [step, setStep] = useState<ModalStep>('grid');
  const [sourceCanvas, setSourceCanvas] = useState<HTMLCanvasElement | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [frame, setFrame] = useState<GridFrame | null>(null);
  const [columns, setColumns] = useState(30);
  const [rows, setRows] = useState(30);
  const [mergeThreshold, setMergeThreshold] = useState(12);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<GridAnalysisResult | null>(null);

  const paletteIndex = useMemo(() => createColorIndex(palette), [palette]);

  useEffect(() => {
    let cancelled = false;
    loadImageFromDataUrl(imageSrc)
      .then((canvas) => {
        if (cancelled) return;
        setSourceCanvas(canvas);
        setFrame({
          x: canvas.width * 0.05,
          y: canvas.height * 0.05,
          width: canvas.width * 0.9,
          height: canvas.height * 0.9,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(`Failed to load image: ${err instanceof Error ? err.message : 'Unknown error'}`);
      });
    return () => { cancelled = true; };
  }, [imageSrc]);

  const handleAnalyze = () => {
    if (!sourceCanvas || !frame || palette.length === 0) return;
    setIsAnalyzing(true);
    try {
      const result = analyzeGrid(sourceCanvas, frame, columns, rows, palette, mergeThreshold);
      setAnalysis(result);
      setStep('review');
    } catch (err) {
      setLoadError(`Analysis error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirm = () => {
    if (!analysis) return;
    const result = buildProcessedImage(analysis.groups, analysis.cellColors, columns, rows, paletteIndex);
    onConfirm(result);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6">
      <div className="relative w-full max-w-3xl bg-background rounded-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">{t('import.pageTitle')}</h3>
          <Button variant="ghost" size="icon" onClick={onCancel} className="h-8 w-8">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loadError && (
            <div className="border-l-4 border-red-400 bg-red-50 text-red-700 text-sm rounded-r-md px-3 py-2">
              {loadError}
            </div>
          )}

          {step === 'grid' && sourceCanvas && frame && (
            <>
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
                <Slider value={[mergeThreshold]} onValueChange={(v) => setMergeThreshold(v[0])} min={6} max={30} step={1} />
              </div>
            </>
          )}

          {step === 'review' && analysis && (
            <>
              <h4 className="text-sm font-semibold text-[#332847]">
                {t('import.detectedColors')} ({analysis.groups.length})
              </h4>
              <PatternColorReview
                groups={analysis.groups}
                palette={palette}
                onGroupsChange={(groups) => setAnalysis({ ...analysis, groups })}
              />
            </>
          )}
        </div>

        <div className="p-4 border-t flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>
            {t('crop.cancel')}
          </Button>
          {step === 'grid' && (
            <Button onClick={handleAnalyze} disabled={isAnalyzing || palette.length === 0 || !sourceCanvas}>
              {t('import.analyze')}
            </Button>
          )}
          {step === 'review' && (
            <>
              <Button variant="outline" onClick={() => setStep('grid')}>
                {t('import.back')}
              </Button>
              <Button onClick={handleConfirm}>
                {t('import.confirm')}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
