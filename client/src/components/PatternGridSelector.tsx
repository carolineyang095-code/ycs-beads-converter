import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { GridFrame } from '@/lib/patternImport';

interface PatternGridSelectorProps {
  canvas: HTMLCanvasElement;
  frame: GridFrame;
  columns: number;
  rows: number;
  onFrameChange: (frame: GridFrame) => void;
  onColumnsChange: (columns: number) => void;
  onRowsChange: (rows: number) => void;
}

type DragMode =
  | 'move'
  | 'resize-n' | 'resize-s' | 'resize-e' | 'resize-w'
  | 'resize-ne' | 'resize-nw' | 'resize-se' | 'resize-sw';

const HANDLE_SIZE = 10;
const MIN_SIZE = 20; // in original-image px

const CURSOR_BY_MODE: Record<DragMode, string> = {
  move: 'move',
  'resize-n': 'ns-resize',
  'resize-s': 'ns-resize',
  'resize-e': 'ew-resize',
  'resize-w': 'ew-resize',
  'resize-ne': 'nesw-resize',
  'resize-sw': 'nesw-resize',
  'resize-nw': 'nwse-resize',
  'resize-se': 'nwse-resize',
};

export default function PatternGridSelector({
  canvas,
  frame,
  columns,
  rows,
  onFrameChange,
  onColumnsChange,
  onRowsChange,
}: PatternGridSelectorProps) {
  const { t } = useTranslation();
  const imgRef = useRef<HTMLImageElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [cursor, setCursor] = useState('default');

  const dragState = useRef<{
    mode: DragMode;
    startClientX: number;
    startClientY: number;
    startFrame: GridFrame;
  } | null>(null);

  const imgSrc = useMemo(() => canvas.toDataURL('image/png'), [canvas]);
  const scale = displaySize.width > 0 ? displaySize.width / canvas.width : 0;

  const measure = useCallback(() => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    setDisplaySize({ width: rect.width, height: rect.height });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const clampFrame = useCallback((f: GridFrame): GridFrame => {
    let width = Math.max(MIN_SIZE, Math.min(f.width, canvas.width));
    let height = Math.max(MIN_SIZE, Math.min(f.height, canvas.height));
    const x = Math.max(0, Math.min(f.x, canvas.width - width));
    const y = Math.max(0, Math.min(f.y, canvas.height - height));
    return { x, y, width, height };
  }, [canvas.width, canvas.height]);

  // Draw grid lines + frame + drag handles on top of the image.
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || scale === 0) return;
    overlay.width = displaySize.width;
    overlay.height = displaySize.height;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const dx = frame.x * scale;
    const dy = frame.y * scale;
    const dw = frame.width * scale;
    const dh = frame.height * scale;

    ctx.strokeStyle = 'rgba(77, 184, 160, 0.65)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 1; c < columns; c++) {
      const x = dx + (dw / columns) * c;
      ctx.moveTo(x, dy);
      ctx.lineTo(x, dy + dh);
    }
    for (let r = 1; r < rows; r++) {
      const y = dy + (dh / rows) * r;
      ctx.moveTo(dx, y);
      ctx.lineTo(dx + dw, y);
    }
    ctx.stroke();

    ctx.strokeStyle = '#4db8a0';
    ctx.lineWidth = 2;
    ctx.strokeRect(dx, dy, dw, dh);

    const points: Array<[number, number]> = [
      [dx, dy], [dx + dw / 2, dy], [dx + dw, dy],
      [dx, dy + dh / 2], [dx + dw, dy + dh / 2],
      [dx, dy + dh], [dx + dw / 2, dy + dh], [dx + dw, dy + dh],
    ];
    ctx.fillStyle = '#4db8a0';
    points.forEach(([px, py]) => {
      ctx.fillRect(px - HANDLE_SIZE / 2, py - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
    });
  }, [displaySize, frame, columns, rows, scale]);

  const hitTest = useCallback((offsetX: number, offsetY: number): DragMode | null => {
    const dx = frame.x * scale;
    const dy = frame.y * scale;
    const dw = frame.width * scale;
    const dh = frame.height * scale;

    const near = (px: number, py: number) =>
      Math.abs(offsetX - px) <= HANDLE_SIZE && Math.abs(offsetY - py) <= HANDLE_SIZE;

    if (near(dx, dy)) return 'resize-nw';
    if (near(dx + dw, dy)) return 'resize-ne';
    if (near(dx, dy + dh)) return 'resize-sw';
    if (near(dx + dw, dy + dh)) return 'resize-se';
    if (near(dx + dw / 2, dy)) return 'resize-n';
    if (near(dx + dw / 2, dy + dh)) return 'resize-s';
    if (near(dx, dy + dh / 2)) return 'resize-w';
    if (near(dx + dw, dy + dh / 2)) return 'resize-e';

    if (offsetX >= dx && offsetX <= dx + dw && offsetY >= dy && offsetY <= dy + dh) return 'move';
    return null;
  }, [frame, scale]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!overlayRef.current || scale === 0) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const mode = hitTest(e.clientX - rect.left, e.clientY - rect.top);
    if (!mode) return;

    dragState.current = {
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startFrame: { ...frame },
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragState.current) return;
      const { mode, startClientX, startClientY, startFrame } = dragState.current;
      const dxNatural = (moveEvent.clientX - startClientX) / scale;
      const dyNatural = (moveEvent.clientY - startClientY) / scale;

      const next: GridFrame = { ...startFrame };

      if (mode === 'move') {
        next.x = startFrame.x + dxNatural;
        next.y = startFrame.y + dyNatural;
      } else {
        if (mode.includes('w')) {
          next.x = startFrame.x + dxNatural;
          next.width = startFrame.width - dxNatural;
        }
        if (mode.includes('e')) {
          next.width = startFrame.width + dxNatural;
        }
        if (mode.includes('n')) {
          next.y = startFrame.y + dyNatural;
          next.height = startFrame.height - dyNatural;
        }
        if (mode.includes('s')) {
          next.height = startFrame.height + dyNatural;
        }
      }

      onFrameChange(clampFrame(next));
    };

    const handleMouseUp = () => {
      dragState.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleHoverMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragState.current || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const mode = hitTest(e.clientX - rect.left, e.clientY - rect.top);
    setCursor(mode ? CURSOR_BY_MODE[mode] : 'default');
  };

  const updateFrameField = (field: keyof GridFrame) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    if (Number.isNaN(value)) return;
    onFrameChange(clampFrame({ ...frame, [field]: value }));
  };

  return (
    <div className="space-y-3">
      <div className="relative inline-block max-w-full select-none" style={{ touchAction: 'none' }}>
        <img
          ref={imgRef}
          src={imgSrc}
          alt="Pattern to import"
          onLoad={measure}
          className="block max-w-full h-auto rounded-md border border-[#E8E3F0]"
        />
        <canvas
          ref={overlayRef}
          className="absolute inset-0"
          style={{ cursor }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleHoverMove}
        />
      </div>

      <p className="text-xs text-[#5a4f6a]">{t('import.gridHint')}</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <label className="text-xs text-[#5a4f6a] space-y-1 block">
          <span className="block font-medium text-[#332847]">{t('import.columns')}</span>
          <Input
            type="number"
            min={2}
            value={columns}
            onChange={(e) => onColumnsChange(Math.max(2, Math.round(Number(e.target.value)) || columns))}
          />
        </label>
        <label className="text-xs text-[#5a4f6a] space-y-1 block">
          <span className="block font-medium text-[#332847]">{t('import.rows')}</span>
          <Input
            type="number"
            min={2}
            value={rows}
            onChange={(e) => onRowsChange(Math.max(2, Math.round(Number(e.target.value)) || rows))}
          />
        </label>
        <label className="text-xs text-[#5a4f6a] space-y-1 block">
          <span className="block font-medium text-[#332847]">X (px)</span>
          <Input type="number" value={Math.round(frame.x)} onChange={updateFrameField('x')} />
        </label>
        <label className="text-xs text-[#5a4f6a] space-y-1 block">
          <span className="block font-medium text-[#332847]">Y (px)</span>
          <Input type="number" value={Math.round(frame.y)} onChange={updateFrameField('y')} />
        </label>
        <label className="text-xs text-[#5a4f6a] space-y-1 block">
          <span className="block font-medium text-[#332847]">W (px)</span>
          <Input type="number" value={Math.round(frame.width)} onChange={updateFrameField('width')} />
        </label>
        <label className="text-xs text-[#5a4f6a] space-y-1 block">
          <span className="block font-medium text-[#332847]">H (px)</span>
          <Input type="number" value={Math.round(frame.height)} onChange={updateFrameField('height')} />
        </label>
      </div>
    </div>
  );
}
