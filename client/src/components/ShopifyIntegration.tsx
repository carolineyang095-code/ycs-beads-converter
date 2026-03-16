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
      window.open(builderUrl, '_blank', 'noopener,noreferrer');
      toast.success('Redirecting to bead builder...');
    } catch (error) {
      toast.error(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Tiered pricing
  let unitPrice: number;
  let tierLabel: string;
  if (totalBeads >= 8000) {
    unitPrice = 0.015;
    tierLabel = '€0.015 / bead (8000+)';
  } else if (totalBeads >= 3000) {
    unitPrice = 0.018;
    tierLabel = '€0.018 / bead (3000–7999)';
  } else {
    unitPrice = 0.02;
    tierLabel = '€0.02 / bead (0–2999)';
  }
  const estimatedPrice = Math.round(totalBeads * unitPrice);

  return (
    <Button
      onClick={handleBuyAllBeads}
      variant="default"
      size="sm"
      className="text-xs gap-1.5 bg-[#7B6A9B] hover:bg-[#6d5c8a] text-white border-none rounded-full px-4"
    >
      <ShoppingCart className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Buy All Beads for This Pattern ≈ €{estimatedPrice} <span className="opacity-75">({tierLabel})</span></span>
      <ExternalLink className="w-3 h-3 opacity-70 hidden sm:inline" />
    </Button>
  );
}