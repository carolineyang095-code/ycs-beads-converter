import { RefObject } from 'react';

interface CanvasPreviewProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  gridSize: number;
  isProcessing?: boolean;
}

/**
 * Canvas Preview Component
 * Displays the pixel grid pattern
 */
export default function CanvasPreview({
  canvasRef,
  gridSize,
  isProcessing = false,
}: CanvasPreviewProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-full bg-gray-50 rounded-lg p-4 border border-border overflow-auto max-h-96">
        {isProcessing ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="mt-2 text-muted-foreground">Processing image...</p>
            </div>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="mx-auto border border-border rounded"
            style={{ imageRendering: 'pixelated' }}
          />
        )}
      </div>
      <div className="text-sm text-muted-foreground text-center">
        <p>Grid: {gridSize} × {gridSize}</p>
        <p>Total beads: {gridSize * gridSize}</p>
      </div>
    </div>
  );
}
