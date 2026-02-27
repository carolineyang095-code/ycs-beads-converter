/**
 * Shopify Integration Library
 * 
 * Business logic: There is ONE product with ONE variant (Fuse beads).
 * - Quantity = total bead count (sum of all colors)
 * - Breakdown attribute = "A3:10; A4:122; A5:22" format showing per-color counts
 * 
 * Shopify cart URL format:
 *   /cart/add?id={variantId}&quantity={totalBeads}&properties[Breakdown]={breakdown}
 */

export interface ShopifyConfig {
  storeUrl: string;
  variantId: string; // Single variant ID for the fuse beads product
}

/**
 * Build the color breakdown string
 * Format: "A01:10; A04:122; B05:22"
 */
export function buildBreakdownString(colorStats: Map<string, number>): string {
  const entries: string[] = [];
  const sorted = Array.from(colorStats.entries())
    .filter(([code]) => code !== 'BG') // Exclude BG from breakdown
    .sort((a, b) => a[0].localeCompare(b[0]));
  for (const [code, count] of sorted) {
    if (count > 0) {
      entries.push(`${code}:${count}`);
    }
  }
  return entries.join('; ');
}

/**
 * Calculate total bead count from color stats
 */
export function getTotalBeadCount(colorStats: Map<string, number>): number {
  let total = 0;
  colorStats.forEach((count, code) => {
    if (code !== 'BG') { // Exclude BG from total count
      total += count;
    }
  });
  return total;
}

/**
 * Build a Shopify cart URL with single product, total quantity, and breakdown attribute
 * 
 * Uses Shopify's /cart/add endpoint with line item properties:
 *   /cart/add?id={variantId}&quantity={total}&properties[Breakdown]={breakdown}
 */
export function buildShopifyCartUrl(
  config: ShopifyConfig,
  colorStats: Map<string, number>
): string {
  const totalBeads = getTotalBeadCount(colorStats);
  if (totalBeads === 0) {
    throw new Error('No beads to add to cart');
  }

  const breakdown = buildBreakdownString(colorStats);
  
  const baseUrl = config.storeUrl.endsWith('/') ? config.storeUrl : config.storeUrl + '/';
  
  // Build URL with line item properties
  // Shopify supports properties[Key]=Value format for cart attributes
  const params = new URLSearchParams();
  params.append('id', config.variantId);
  params.append('quantity', totalBeads.toString());
  params.append('properties[Breakdown]', breakdown);

  return `${baseUrl}cart/add?${params.toString()}`;
}

/**
 * Load Shopify config from localStorage
 */
export function loadShopifyConfig(): ShopifyConfig | null {
  try {
    const stored = localStorage.getItem('shopify_config');
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Failed to load Shopify config from storage:', error);
    return null;
  }
}

/**
 * Save Shopify config to localStorage
 */
export function saveShopifyConfig(config: ShopifyConfig): void {
  try {
    localStorage.setItem('shopify_config', JSON.stringify(config));
  } catch (error) {
    console.error('Failed to save Shopify config to storage:', error);
  }
}