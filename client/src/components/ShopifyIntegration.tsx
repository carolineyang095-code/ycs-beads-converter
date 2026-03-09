import { ShoppingCart, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  buildBeadBuilderUrl,
  getTotalBeadCount,
  convertArtkalToMardStats,
  ShopifyConfig,
} from '@/lib/shopifyIntegration';

interface ShopifyIntegrationProps {
  colorStats: Map<string, number>;
  paletteType?: 'mard' | 'artkal';
}

// Fixed Shopify configuration as requested
const FIXED_CONFIG: ShopifyConfig = {
  storeUrl: 'https://yayascreativestudio.com/',
  variantId: '57339981201782',
};

export default function ShopifyIntegration({
  colorStats,
  paletteType = 'mard',
}: ShopifyIntegrationProps) {
  const totalBeads = getTotalBeadCount(colorStats);

  const handleBuyAllBeads = async () => {
    if (totalBeads === 0) {
      toast.error('No beads to buy');
      return;
    }

    try {
      let statsForShopify = colorStats;
      if (paletteType === 'artkal') {
        statsForShopify = await convertArtkalToMardStats(colorStats);
      }
      const builderUrl = buildBeadBuilderUrl(statsForShopify);
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
      Buy All Beads for This Pattern ≈ €{Math.round(totalBeads * 0.02)}
      <ExternalLink className="w-3 h-3 opacity-70" />
    </Button>
  );
}