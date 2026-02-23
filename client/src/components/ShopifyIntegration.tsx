import { useState } from 'react';
import { ShoppingCart, Settings, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ColorData } from '@/lib/colorMapping';
import {
  loadVariantMappingFromStorage,
  saveVariantMappingToStorage,
  ShopifyVariantMapping,
  buildShopifyCartUrl,
  validateVariantMapping,
} from '@/lib/shopifyIntegration';

interface ShopifyIntegrationProps {
  colorStats: Map<string, number>;
  palette: Map<string, ColorData>;
}

export default function ShopifyIntegration({
  colorStats,
  palette,
}: ShopifyIntegrationProps) {
  const [showConfig, setShowConfig] = useState(false);
  const [storeUrl, setStoreUrl] = useState(() => {
    return localStorage.getItem('shopify_store_url') || '';
  });
  const [variantMapping, setVariantMapping] = useState<ShopifyVariantMapping>(() => {
    return loadVariantMappingFromStorage() || {};
  });

  const handleStoreUrlChange = (url: string) => {
    setStoreUrl(url);
    localStorage.setItem('shopify_store_url', url);
  };

  const handleVariantChange = (colorCode: string, variantId: string) => {
    const updated = { ...variantMapping, [colorCode]: variantId };
    setVariantMapping(updated);
    saveVariantMappingToStorage(updated);
  };

  const handleAddToCart = () => {
    if (!storeUrl) {
      toast.error('Please enter your Shopify store URL');
      return;
    }

    const validation = validateVariantMapping(colorStats, variantMapping);
    if (!validation.valid) {
      toast.error(`Missing variant mappings for: ${validation.missingColors.slice(0, 5).join(', ')}${validation.missingColors.length > 5 ? '...' : ''}`);
      return;
    }

    try {
      const cartUrl = buildShopifyCartUrl(storeUrl, colorStats, variantMapping);
      window.open(cartUrl, '_blank');
      toast.success('Cart opened in new tab');
    } catch (error) {
      toast.error(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <ShoppingCart className="w-3.5 h-3.5" /> Shopify Cart
      </h3>

      <div>
        <input
          type="url"
          value={storeUrl}
          onChange={(e) => handleStoreUrlChange(e.target.value)}
          placeholder="https://your-store.myshopify.com"
          className="w-full px-2.5 py-1.5 text-xs border border-input rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <Button
        onClick={() => setShowConfig(!showConfig)}
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-1.5 text-xs h-7"
      >
        <Settings className="w-3 h-3" />
        {showConfig ? 'Hide' : 'Configure'} Variant Mapping
      </Button>

      {showConfig && (
        <div className="space-y-1.5 p-2 bg-gray-50 rounded border border-border max-h-48 overflow-y-auto">
          {Array.from(colorStats.keys()).sort().map((code) => {
            const color = palette.get(code);
            return (
              <div key={code} className="flex gap-1.5 items-center">
                {color && (
                  <div className="w-4 h-4 rounded-sm border border-gray-300 flex-shrink-0" style={{ backgroundColor: color.hex }} />
                )}
                <span className="text-[10px] font-mono w-8 flex-shrink-0">{code}</span>
                <input
                  type="text"
                  value={variantMapping[code] || ''}
                  onChange={(e) => handleVariantChange(code, e.target.value)}
                  placeholder="variant ID"
                  className="flex-1 px-1.5 py-0.5 text-[10px] border border-input rounded bg-white text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            );
          })}
        </div>
      )}

      <Button
        onClick={handleAddToCart}
        variant="default"
        size="sm"
        className="w-full text-xs gap-1.5"
        disabled={!storeUrl}
      >
        <ShoppingCart className="w-3.5 h-3.5" /> Add to Cart
        <ExternalLink className="w-3 h-3" />
      </Button>
    </div>
  );
}
