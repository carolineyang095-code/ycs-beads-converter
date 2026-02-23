import { Button } from '@/components/ui/button';

interface GridSizeSelectorProps {
  sizes: number[];
  selected: number;
  onSelect: (size: number) => void;
  isProcessing?: boolean;
}

/**
 * Grid Size Selector Component
 * Allows user to choose from predefined grid sizes
 */
export default function GridSizeSelector({
  sizes,
  selected,
  onSelect,
  isProcessing = false,
}: GridSizeSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {sizes.map((size) => (
        <Button
          key={size}
          onClick={() => onSelect(size)}
          variant={selected === size ? 'default' : 'outline'}
          disabled={isProcessing}
          className="text-sm"
        >
          {size}×{size}
        </Button>
      ))}
    </div>
  );
}
