import { useState } from 'react';
import { ShoppingCart, Settings, ExternalLink, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ColorData } from '@/lib/colorMapping';
import {
  loadShopifyConfig,
  saveShopifyConfig,
  buildShopifyCartUrl,
  getTotalBeadCount,
  buildBreakdownString,
  ShopifyConfig,
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
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [config, setConfig] = useState<ShopifyConfig>(() => {
    const saved = loadShopifyConfig();
    return saved || { storeUrl: '', variantId: '' };
  });

  const totalBeads = getTotalBeadCount(colorStats);
  const breakdownStr = buildBreakdownString(colorStats);

  const handleConfigChange = (field: keyof ShopifyConfig, value: string) => {
    const updated = { ...config, [field]: value };
    setConfig(updated);
    saveShopifyConfig(updated);
  };

  const handleAddToCart = () => {
    if (!config.storeUrl) {
      toast.error('请输入 Shopify 商店 URL');
      return;
    }
    if (!config.variantId) {
      toast.error('请输入产品 Variant ID');
      return;
    }

    try {
      const cartUrl = buildShopifyCartUrl(config, colorStats);
      window.open(cartUrl, '_blank');
      toast.success('购物车已在新标签页打开');
    } catch (error) {
      toast.error(`失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <ShoppingCart className="w-3.5 h-3.5" /> 购物车
      </h3>

      {/* Total bead count summary */}
      <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Package className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-medium text-blue-900">Fuse Beads</span>
          </div>
          <span className="text-sm font-bold text-blue-700">{totalBeads.toLocaleString()} 颗</span>
        </div>
        <div className="mt-1 text-[10px] text-blue-600">
          {colorStats.size} 种颜色
        </div>
      </div>

      {/* Breakdown toggle */}
      <Button
        onClick={() => setShowBreakdown(!showBreakdown)}
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-1.5 text-xs h-7"
      >
        <Package className="w-3 h-3" />
        {showBreakdown ? '收起' : '展开'}色号明细
      </Button>

      {showBreakdown && (
        <div className="space-y-1 p-2 bg-gray-50 rounded border border-border max-h-48 overflow-y-auto">
          {Array.from(colorStats.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([code, count]) => {
              const color = palette.get(code);
              const pct = totalBeads > 0 ? ((count / totalBeads) * 100).toFixed(1) : '0';
              return (
                <div key={code} className="flex items-center gap-1.5 py-0.5">
                  {color && (
                    <div
                      className="w-3.5 h-3.5 rounded-sm border border-gray-300 flex-shrink-0"
                      style={{ backgroundColor: color.hex }}
                    />
                  )}
                  <span className="text-[10px] font-mono w-7 flex-shrink-0 text-foreground">{code}</span>
                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(2, (count / totalBeads) * 100)}%`,
                        backgroundColor: color?.hex || '#888',
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-mono w-8 text-right text-foreground">{count}</span>
                  <span className="text-[10px] text-muted-foreground w-10 text-right">{pct}%</span>
                </div>
              );
            })}
        </div>
      )}

      {/* Breakdown string preview */}
      {breakdownStr && (
        <div className="p-2 bg-gray-50 rounded border border-border">
          <div className="text-[10px] text-muted-foreground mb-1">Breakdown:</div>
          <div className="text-[10px] font-mono text-foreground break-all leading-relaxed max-h-16 overflow-y-auto">
            {breakdownStr}
          </div>
        </div>
      )}

      {/* Config toggle */}
      <Button
        onClick={() => setShowConfig(!showConfig)}
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-1.5 text-xs h-7"
      >
        <Settings className="w-3 h-3" />
        {showConfig ? '收起' : '展开'} Shopify 配置
      </Button>

      {showConfig && (
        <div className="space-y-2 p-2 bg-gray-50 rounded border border-border">
          <div>
            <label className="text-[10px] text-muted-foreground block mb-0.5">商店 URL</label>
            <input
              type="url"
              value={config.storeUrl}
              onChange={(e) => handleConfigChange('storeUrl', e.target.value)}
              placeholder="https://your-store.myshopify.com"
              className="w-full px-2 py-1 text-xs border border-input rounded bg-white text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-0.5">Variant ID</label>
            <input
              type="text"
              value={config.variantId}
              onChange={(e) => handleConfigChange('variantId', e.target.value)}
              placeholder="e.g. 12345678901234"
              className="w-full px-2 py-1 text-xs border border-input rounded bg-white text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Shopify 产品的 Variant ID（数字）
            </div>
          </div>
        </div>
      )}

      <Button
        onClick={handleAddToCart}
        variant="default"
        size="sm"
        className="w-full text-xs gap-1.5"
        disabled={!config.storeUrl || !config.variantId}
      >
        <ShoppingCart className="w-3.5 h-3.5" /> 加入购物车 ({totalBeads.toLocaleString()} 颗)
        <ExternalLink className="w-3 h-3" />
      </Button>
    </div>
  );
}
