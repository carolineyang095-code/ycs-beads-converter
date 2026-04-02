import { useState, useRef, useEffect, useCallback } from 'react';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import { Button } from '@/components/ui/button';
import { X, Check, Lock, Unlock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CropModalProps {
  imageSrc: string;
  onConfirm: (croppedImage: HTMLCanvasElement) => void;
  onCancel: () => void;
}

export default function CropModal({ imageSrc, onConfirm, onCancel }: CropModalProps) {
  const { t } = useTranslation();
  const imageRef = useRef<HTMLImageElement>(null);
  const cropperRef = useRef<Cropper | null>(null);
  const [isLocked, setIsLocked] = useState(true);

  // Initialize Cropper when image loads
  const handleImageLoad = useCallback(() => {
    if (!imageRef.current) return;

    // Destroy previous instance if any
    if (cropperRef.current) {
      cropperRef.current.destroy();
    }

    cropperRef.current = new Cropper(imageRef.current, {
      aspectRatio: 1, // Default 1:1
      viewMode: 1,    // Restrict crop box within canvas
      dragMode: 'move',
      autoCropArea: 0.8,
      responsive: true,
      restore: false,
      guides: true,
      center: true,
      highlight: true,
      cropBoxMovable: true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: false,
      minCropBoxWidth: 50,
      minCropBoxHeight: 50,
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cropperRef.current) {
        cropperRef.current.destroy();
        cropperRef.current = null;
      }
    };
  }, []);

  // Toggle aspect ratio lock
  const handleToggleLock = () => {
    const newLocked = !isLocked;
    setIsLocked(newLocked);
    if (cropperRef.current) {
      cropperRef.current.setAspectRatio(newLocked ? 1 : NaN);
    }
  };

  // Confirm crop
  const handleConfirm = () => {
    if (!cropperRef.current) return;

    const croppedCanvas = cropperRef.current.getCroppedCanvas({
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
    });

    if (croppedCanvas) {
      onConfirm(croppedCanvas);
    }
  };

  // Cancel crop
  const handleCancel = () => {
    if (cropperRef.current) {
      cropperRef.current.destroy();
      cropperRef.current = null;
    }
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6">
      <div className="relative w-full max-w-2xl bg-background rounded-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">{t('crop.title')}</h3>
          <Button variant="ghost" size="icon" onClick={handleCancel} className="h-8 w-8">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Cropper Container */}
        <div className="relative flex-1 min-h-[300px] sm:min-h-[400px] bg-muted overflow-hidden">
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Crop source"
            onLoad={handleImageLoad}
            style={{ display: 'block', maxWidth: '100%' }}
          />
        </div>

        {/* Controls */}
        <div className="p-4 space-y-3 bg-background border-t">
          {/* Ratio Toggle */}
          <div className="flex items-center gap-3">
            <Button
              variant={isLocked ? 'default' : 'outline'}
              size="sm"
              onClick={handleToggleLock}
              className="gap-2 text-xs"
            >
              {isLocked ? (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  {t('crop.locked')}
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  {t('crop.freeRatio')}
                </>
              )}
            </Button>
            <span className="text-[10px] text-muted-foreground">
              {t('crop.dragHint')}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <Button variant="outline" onClick={handleCancel}>
              {t('crop.cancel')}
            </Button>
            <Button onClick={handleConfirm} className="gap-2">
              <Check className="w-4 h-4" />
              {t('crop.confirm')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}