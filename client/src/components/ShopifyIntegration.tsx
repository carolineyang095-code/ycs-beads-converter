import { ShoppingCart, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const totalBeads = getTotalBeadCount(colorStats);

  const handleBuyAllBeads = async () => {
    if (totalBeads === 0) {
      toast.error(t('toast.noBeadsToBuy'));
      return;
    }

    try {
      let statsForShopify = colorStats;
      if (paletteType === 'artkal') {
        statsForShopify = await convertArtkalToMardStats(colorStats);
      }
      const builderUrl = buildBeadBuilderUrl(statsForShopify);
      window.open(builderUrl, '_blank', 'noopener,noreferrer');
      toast.success(t('toast.redirecting'));
    } catch (error) {
      toast.error(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Tiered pricing
  let unitPrice: number;
  if (totalBeads >= 8000) {
    unitPrice = 0.015;
  } else if (totalBeads >= 3000) {
    unitPrice = 0.018;
  } else {
    unitPrice = 0.02;
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
      <span className="hidden sm:inline">{t('shopify.buyAllBeads', { price: estimatedPrice })}</span>
      <ExternalLink className="w-3 h-3 opacity-70 hidden sm:inline" />
    </Button>
  );
}