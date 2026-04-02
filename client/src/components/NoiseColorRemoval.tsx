import { useState } from 'react';
import { RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { ColorData, euclideanDistance } from '@/lib/colorMapping';

interface NoiseColorRemovalProps {
  colorStats: Map<string, number>;
  palette: Map<string, ColorData>;
  threshold?: number;
  onRemoveColor: (code: string, replacementCode: string) => void;
  onRestoreColor: (code: string) => void;
  onRestoreAll: () => void;
  removedColors: Map<string, string>;
}

function findClosestUsedColor(
  targetCode: string,
  colorStats: Map<string, number>,
  palette: Map<string, ColorData>
): string | null {
  const targetColor = palette.get(targetCode);
  if (!targetColor) return null;

  let closestCode: string | null = null;
  let minDist = Infinity;

  colorStats.forEach((_count, code) => {
    if (code === targetCode) return;
    const color = palette.get(code);
    if (!color) return;
    const dist = euclideanDistance(targetColor.rgb, color.rgb);
    if (dist < minDist) {
      minDist = dist;
      closestCode = code;
    }
  });

  return closestCode;
}

export default function NoiseColorRemoval({
  colorStats,
  palette,
  threshold = 10,
  onRemoveColor,
  onRestoreColor,
  onRestoreAll,
  removedColors,
}: NoiseColorRemovalProps) {
  const { t } = useTranslation();
  const [showRemoved, setShowRemoved] = useState(false);

  const totalBeads = Array.from(colorStats.values()).reduce((a, b) => a + b, 0);

  const noiseColors = Array.from(colorStats.entries())
    .filter(([_, count]) => count < threshold)
    .sort((a, b) => a[1] - b[1]);

  const handleRemove = (code: string) => {
    const replacement = findClosestUsedColor(code, colorStats, palette);
    if (replacement) {
      onRemoveColor(code, replacement);
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-center">
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {t('noise.clickToRemove', { count: totalBeads.toLocaleString() })}
        </p>
      </div>

      {noiseColors.length > 0 ? (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {noiseColors.map(([code, count]) => {
            const color = palette.get(code);
            const replacement = findClosestUsedColor(code, colorStats, palette);
            const replacementColor = replacement ? palette.get(replacement) : null;
            return (
              <div
                key={code}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[#EDE7DA] cursor-pointer transition-colors group"
                onClick={() => handleRemove(code)}
                title={`Click to replace ${code} with ${replacement || '?'}`}
              >
                <div className="flex items-center gap-1.5 flex-1">
                  {color && (
                    <div
                      className="w-5 h-5 rounded-sm border border-gray-300 flex-shrink-0"
                      style={{ backgroundColor: color.hex }}
                    />
                  )}
                  <span className="text-xs font-mono font-semibold text-foreground">{code}</span>
                </div>
                <span className="text-xs text-muted-foreground">{t('noise.pcs', { count })}</span>
                {replacementColor && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] text-muted-foreground">→</span>
                    <div
                      className="w-3.5 h-3.5 rounded-sm border border-gray-300"
                      style={{ backgroundColor: replacementColor.hex }}
                    />
                    <span className="text-[10px] font-mono text-muted-foreground">{replacement}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[10px] text-center text-muted-foreground py-2">
          {t('noise.noNoise', { threshold })}
        </p>
      )}

      {removedColors.size > 0 && (
        <div className="border-t border-border pt-2">
          <button
            onClick={() => setShowRemoved(!showRemoved)}
            className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-medium text-foreground hover:bg-[#EDE7DA] rounded-md transition-colors"
          >
            <span>{t('noise.excludedColors', { count: removedColors.size })}</span>
            {showRemoved ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showRemoved && (
            <div className="space-y-1 mt-1 max-h-36 overflow-y-auto">
              {Array.from(removedColors.entries()).map(([code, replacement]) => {
                const color = palette.get(code);
                const replacementColor = palette.get(replacement);
                return (
                  <div key={code} className="flex items-center gap-2 px-2 py-1">
                    <div className="flex items-center gap-1.5 flex-1">
                      {color && (
                        <div
                          className="w-4 h-4 rounded-sm border border-gray-300 flex-shrink-0"
                          style={{ backgroundColor: color.hex }}
                        />
                      )}
                      <span className="text-[11px] font-mono text-foreground">{code}</span>
                      <span className="text-[10px] text-muted-foreground">→</span>
                      {replacementColor && (
                        <div
                          className="w-3.5 h-3.5 rounded-sm border border-gray-300"
                          style={{ backgroundColor: replacementColor.hex }}
                        />
                      )}
                      <span className="text-[10px] font-mono text-muted-foreground">{replacement}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-5 px-2 text-[10px] border-purple-200 hover:bg-purple-50"
                      style={{ color: '#9867DA' }}
                      onClick={() => onRestoreColor(code)}
                    >
                      {t('noise.restore')}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          <Button
            size="sm"
            variant="default"
            className="w-full mt-2 text-xs h-7"
            onClick={onRestoreAll}
          >
            <RotateCcw className="w-3 h-3 mr-1" /> {t('noise.restoreAll')}
          </Button>
        </div>
      )}
    </div>
  );
}
