import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { X, Check, ZoomIn, ZoomOut } from 'lucide-react';

interface CropModalProps {
  imageSrc: string;
  onConfirm: (croppedImage: HTMLCanvasElement) => void;
  onCancel: () => void;
}

export default function CropModal({ imageSrc, onConfirm, onCancel }: CropModalProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  // ✅ NEW: lock/unlock aspect ratio
  const [lockRatio, setLockRatio] = useState(true);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;

    try {
      const image = new Image();
      image.src = imageSrc;
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = croppedAreaPixels.width;
      canvas.height = croppedAreaPixels.height;

      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height
      );

      onConfirm(canvas);
    } catch (e) {
      console.error('Error cropping image:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6">
      <div className="relative w-full max-w-2xl bg-background rounded-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Crop Image</h3>
          <Button variant="ghost" size="icon" onClick={onCancel} className="h-8 w-8">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Cropper Container */}
        <div className="relative flex-1 min-h-[300px] sm:min-h-[400px] bg-muted">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            // ✅ change here: square by default, free when unlocked
            aspect={lockRatio ? 1 : undefined}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
          />
        </div>

        {/* Controls */}
        <div className="p-4 space-y-4 bg-background border-t">
          {/* ✅ NEW: lock ratio toggle */}
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">Lock ratio (1:1)</div>
              <div className="text-xs text-muted-foreground">
                Turn off to crop freely (any rectangle).
              </div>
            </div>
            <Switch checked={lockRatio} onCheckedChange={setLockRatio} />
          </div>

          <div className="flex items-center gap-4">
            <ZoomOut className="w-4 h-4 text-muted-foreground" />
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.1}
              onValueChange={(vals) => setZoom(vals[0])}
              className="flex-1"
            />
            <ZoomIn className="w-4 h-4 text-muted-foreground" />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} className="gap-2">
              <Check className="w-4 h-4" />
              Confirm Crop
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}