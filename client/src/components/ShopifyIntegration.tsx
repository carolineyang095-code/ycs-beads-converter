import { useState } from 'react';
import { ShoppingCart, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ColorData } from '@/lib/colorMapping';
import {
  loadVariantMappingFromStorage,
  saveVariantMappingToStorage,
  ShopifyVariantMapping,
  redirectToShopifyCart,
  validateVariantMapping,
} from '@/lib/shopifyIntegration';

interface ShopifyIntegrationProps {
  colorStats: Map<string, number>;
  palette: Map<string, ColorData>;
}

/**
 * Shopify Integration Component
 * Handles adding items to Shopify cart
 */
export default function ShopifyIntegration({
  colorStats,
  palette,
}: ShopifyIntegrationProps) {
  const [showConfig, setShowConfig] = useState(false);
  const [storeUrl, setStoreUrl] = useState('');
  const [variantMapping, setVariantMapping] = useState<ShopifyVariantMapping>(() => {
    return loadVariantMappingFromStorage() || {};
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  // Handle variant mapping input change
  const handleVariantChange = (colorCode: string, variantId: string) => {
    const updated = { ...variantMapping, [colorCode]: variantId };
    setVariantMapping(updated);
    saveVariantMappingToStorage(updated);
  };

  // Handle add to cart
  const handleAddToCart = () => {
    setValidationError(null);

    if (!storeUrl) {
      setValidationError('Please enter your Shopify store URL');
      return;
    }

    const validation = validateVariantMapping(colorStats, variantMapping);
    if (!validation.valid) {
      setValidationError(
        `Missing variant mappings for colors: ${validation.missingColors.join(', ')}`
      );
      return;
    }

    try {
      redirectToShopifyCart(storeUrl, colorStats, variantMapping);
    } catch (error) {
      setValidationError(
        `Failed to create cart: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <ShoppingCart className="w-5 h-5" />
        Shopify Integration
      </h2>

      {validationError && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
          {validationError}
        </div>
      )}

      <div className="space-y-4">
        {/* Store URL Input */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Shopify Store URL
          </label>
          <input
            type="url"
            value={storeUrl}
            onChange={(e) => setStoreUrl(e.target.value)}
            placeholder="https://your-store.myshopify.com"
            className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Enter your Shopify store URL to enable cart integration
          </p>
        </div>

        {/* Configuration Toggle */}
        <Button
          onClick={() => setShowConfig(!showConfig)}
          variant="outline"
          className="w-full justify-start gap-2"
        >
          <Settings className="w-4 h-4" />
          {showConfig ? 'Hide' : 'Show'} Variant Configuration
        </Button>

        {/* Variant Mapping Configuration */}
        {showConfig && (
          <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-border max-h-64 overflow-y-auto">
            <p className="text-sm font-medium text-foreground">
              Map colors to Shopify variant IDs:
            </p>
            {Array.from(colorStats.keys())
              .sort()
              .map((colorCode) => {
                const color = palette.get(colorCode);
                return (
                  <div key={colorCode} className="flex gap-2 items-center">
                    {color && (
                      <div
                        className="w-6 h-6 rounded border border-gray-300 flex-shrink-0"
                        style={{ backgroundColor: color.hex }}
                      />
                    )}
                    <label className="text-sm text-foreground flex-shrink-0 w-12">
                      {colorCode}
                    </label>
                    <input
                      type="text"
                      value={variantMapping[colorCode] || ''}
                      onChange={(e) => handleVariantChange(colorCode, e.target.value)}
                      placeholder="gid://shopify/ProductVariant/..."
                      className="flex-1 px-2 py-1 text-xs border border-input rounded bg-white text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                );
              })}
            <p className="text-xs text-muted-foreground mt-3">
              Get variant IDs from your Shopify admin panel
            </p>
          </div>
        )}

        {/* Add to Cart Button */}
        <Button
          onClick={handleAddToCart}
          variant="default"
          className="w-full"
          disabled={!storeUrl}
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          Add to Shopify Cart
        </Button>

        <p className="text-xs text-muted-foreground">
          Configure the variant mappings above to enable cart integration
        </p>
      </div>
    </Card>
  );
}
