import { ShoppingCart, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  buildShopifyCartUrl,
  getTotalBeadCount,
  ShopifyConfig,
} from '@/lib/shopifyIntegration';

interface ShopifyIntegrationProps {
  colorStats: Map<string, number>;
}

// Fixed Shopify configuration as requested
const FIXED_CONFIG: ShopifyConfig = {
  storeUrl: 'https://yayascreativestudio.com/',
  variantId: '57339981201782',
};

export default function ShopifyIntegration({
  colorStats,
}: ShopifyIntegrationProps) {
  const totalBeads = getTotalBeadCount(colorStats);

  const handleAddToCart = () => {
    if (totalBeads === 0) {
      toast.error('No beads to add to cart');
      return;
    }

    try {
      const cartUrl = buildShopifyCartUrl(FIXED_CONFIG, colorStats);
      window.open(cartUrl, '_blank');
      toast.success('Cart opened in a new tab');
    } catch (error) {
      toast.error(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <Button
      onClick={handleAddToCart}
      variant="default"
      size="sm"
      className="text-xs gap-1.5 bg-[#9867DA] hover:bg-[#8558C2] text-white border-none rounded-full px-4"
    >
      <ShoppingCart className="w-3.5 h-3.5" />
      Add to Cart ({totalBeads.toLocaleString()} pcs)
      <ExternalLink className="w-3 h-3 opacity-70" />
    </Button>
  );
}
