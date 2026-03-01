import { useRef, useState } from 'react';
import { Upload, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageUploadSectionProps {
  onImageUpload: (file: File) => void;
  isProcessing?: boolean;
}

export default function ImageUploadSection({
  onImageUpload,
  isProcessing = false,
}: ImageUploadSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileSelect = (file: File) => {
    if (file.type.startsWith('image/')) {
      setFileName(file.name);
      onImageUpload(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
        isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
      }`}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
        className="hidden"
      />
      {fileName ? (
        <div className="flex items-center gap-2 justify-center">
          <ImageIcon className="w-4 h-4 text-primary" />
          <span className="text-xs text-foreground truncate max-w-[180px]">{fileName}</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1.5">
          <Upload className="w-6 h-6 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Drop image or click to select
          </p>
          <p className="text-[10px] text-muted-foreground">JPG, PNG, WebP</p>
        </div>
      )}
    </div>
  );
}