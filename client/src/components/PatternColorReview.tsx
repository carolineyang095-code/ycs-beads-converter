import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ColorData } from '@/lib/colorMapping';
import { ImportColorGroup } from '@/lib/patternImport';

interface PatternColorReviewProps {
  groups: ImportColorGroup[];
  palette: ColorData[];
  onGroupsChange: (groups: ImportColorGroup[]) => void;
}

const QUALITY_WARNING_THRESHOLD = 40;

export default function PatternColorReview({ groups, palette, onGroupsChange }: PatternColorReviewProps) {
  const { t } = useTranslation();

  const totalBeads = groups
    .filter((g) => !g.isBackground)
    .reduce((sum, g) => sum + g.cellCount, 0);
  const totalColors = new Set(
    groups.filter((g) => !g.isBackground).map((g) => g.matchedCode)
  ).size;

  const updateGroup = (id: number, patch: Partial<ImportColorGroup>) => {
    onGroupsChange(groups.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  };

  const rgbToCss = (rgb: ImportColorGroup['rgb']) => `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;

  return (
    <div className="space-y-3">
      {groups.length > QUALITY_WARNING_THRESHOLD && (
        <div className="border-l-4 border-[#7B6A9B] bg-[#E8E3F0] text-[#332847] text-xs sm:text-sm rounded-r-md px-3 py-2">
          {t('import.qualityWarning')}
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-sm text-[#332847]">
        <span>
          <span className="font-semibold">{t('import.totalBeads')}:</span>{' '}
          {totalBeads.toLocaleString()}
        </span>
        <span>
          <span className="font-semibold">{t('import.totalColors')}:</span>{' '}
          {totalColors}
        </span>
      </div>

      <div className="border border-[#E8E3F0] rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead></TableHead>
              <TableHead>{t('import.cells')}</TableHead>
              <TableHead>{t('import.matchedTo')}</TableHead>
              <TableHead>{t('import.markBackground')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => {
              const matched = palette.find((c) => c.code === group.matchedCode);
              return (
                <TableRow key={group.id}>
                  <TableCell>
                    <div
                      className="w-6 h-6 rounded-sm border border-gray-300"
                      style={{ backgroundColor: rgbToCss(group.rgb) }}
                      title={rgbToCss(group.rgb)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{group.cellCount}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded-sm border border-gray-300 flex-shrink-0"
                        style={{ backgroundColor: matched?.hex || '#FFFFFF' }}
                      />
                      <select
                        className="text-xs border border-[#E8E3F0] rounded-md px-2 py-1 bg-white text-[#332847] focus:outline-none focus:ring-1 focus:ring-[#4db8a0] disabled:opacity-40"
                        value={group.matchedCode}
                        disabled={group.isBackground}
                        onChange={(e) => updateGroup(group.id, { matchedCode: e.target.value })}
                      >
                        {palette.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.code} — {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      checked={group.isBackground}
                      onCheckedChange={(checked) => updateGroup(group.id, { isBackground: checked === true })}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
