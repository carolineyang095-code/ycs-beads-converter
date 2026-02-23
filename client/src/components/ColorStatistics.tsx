import { useState } from 'react';
import { ColorData } from '@/lib/colorMapping';

interface ColorStatisticsProps {
  colorStats: Map<string, number>;
  palette: Map<string, ColorData>;
  totalBeads: number;
}

/**
 * Color Statistics Component
 * Displays a table of color usage statistics
 */
export default function ColorStatistics({
  colorStats,
  palette,
  totalBeads,
}: ColorStatisticsProps) {
  const [highlightedColor, setHighlightedColor] = useState<string | null>(null);

  // Sort colors by code
  const sortedColors = Array.from(colorStats.entries())
    .sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-lg p-4 border border-border">
          <p className="text-sm text-muted-foreground">Total Beads</p>
          <p className="text-2xl font-bold text-foreground">{totalBeads}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 border border-border">
          <p className="text-sm text-muted-foreground">Unique Colors</p>
          <p className="text-2xl font-bold text-foreground">{colorStats.size}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 border border-border">
          <p className="text-sm text-muted-foreground">Coverage</p>
          <p className="text-2xl font-bold text-foreground">100%</p>
        </div>
      </div>

      {/* Color Table */}
      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-border">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-foreground">Color</th>
              <th className="px-4 py-2 text-left font-semibold text-foreground">Code</th>
              <th className="px-4 py-2 text-left font-semibold text-foreground">Hex</th>
              <th className="px-4 py-2 text-right font-semibold text-foreground">Count</th>
              <th className="px-4 py-2 text-right font-semibold text-foreground">%</th>
            </tr>
          </thead>
          <tbody>
            {sortedColors.map(([code, count]) => {
              const color = palette.get(code);
              const percentage = ((count / totalBeads) * 100).toFixed(1);
              const isHighlighted = highlightedColor === code;

              return (
                <tr
                  key={code}
                  className={`border-b border-border hover:bg-gray-50 cursor-pointer transition-colors ${
                    isHighlighted ? 'bg-primary/10' : ''
                  }`}
                  onMouseEnter={() => setHighlightedColor(code)}
                  onMouseLeave={() => setHighlightedColor(null)}
                >
                  <td className="px-4 py-2">
                    {color && (
                      <div
                        className="w-6 h-6 rounded border border-gray-300"
                        style={{ backgroundColor: color.hex }}
                        title={color.hex}
                      />
                    )}
                  </td>
                  <td className="px-4 py-2 font-medium text-foreground">{code}</td>
                  <td className="px-4 py-2 text-muted-foreground font-mono">{color?.hex}</td>
                  <td className="px-4 py-2 text-right font-medium text-foreground">{count}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{percentage}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
