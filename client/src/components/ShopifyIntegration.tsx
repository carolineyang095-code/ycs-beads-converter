import { ShoppingCart, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  buildBeadBuilderUrl,
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

  const handleBuyAllBeads = () => {
    if (totalBeads === 0) {
      toast.error('No beads to buy');
      return;
    }

    try {
      const builderUrl = buildBeadBuilderUrl(colorStats);
      // Same-tab navigation for smoother flow
      window.location.href = builderUrl;
      toast.success('Redirecting to bead builder...');
    } catch (error) {
      toast.error(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <Button
      onClick={handleBuyAllBeads}
      variant="default"
      size="sm"
      className="text-xs gap-1.5 bg-[#7B6A9B] hover:bg-[#6d5c8a] text-white border-none rounded-full px-4"
    >
      <ShoppingCart className="w-3.5 h-3.5" />
      Buy All Beads for This Pattern ({totalBeads.toLocaleString()} pcs)
      <ExternalLink className="w-3 h-3 opacity-70" />
    </Button>
  );
}