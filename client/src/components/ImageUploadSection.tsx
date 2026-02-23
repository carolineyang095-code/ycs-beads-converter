import { useRef } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageUploadSectionProps {
  onImageUpload: (file: File) => void;
  isProcessing?: boolean;
}

/**
 * Image Upload Component
 * Supports drag-and-drop and click-to-select
 */
export default function ImageUploadSection({
  onImageUpload,
  isProcessing = false,
}: ImageUploadSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    if (file.type.startsWith('image/')) {
      onImageUpload(file);
    } else {
      alert('Please select a valid image file (JPG, PNG, WebP)');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleInputChange}
        className="hidden"
      />
      
      <div className="flex flex-col items-center gap-3">
        <Upload className="w-8 h-8 text-muted-foreground" />
        <div>
          <p className="font-medium text-foreground">
            Drag and drop your image here
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            or click to select (JPG, PNG, WebP)
          </p>
        </div>
        <Button
          onClick={() => fileInputRef.current?.click()}
          variant="outline"
          disabled={isProcessing}
          className="mt-2"
        >
          {isProcessing ? 'Processing...' : 'Select Image'}
        </Button>
      </div>
    </div>
  );
}
