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
/**
 * Convert Artkal colorStats to MARD colorStats using artkal_mard_map.json
 * Merges counts if two Artkal codes map to the same MARD code.
 */
export async function convertArtkalToMardStats(
  colorStats: Map<string, number>
): Promise<Map<string, number>> {
  const response = await fetch('/artkal_mard_map.json');
  if (!response.ok) throw new Error('Failed to load Artkal→MARD mapping');
  // artkal_mard_map.json is an object: { "AC01": { artkalCode, mardCode, ... }, ... }
  const mapData: Record<string, { artkalCode: string; mardCode: string }> = await response.json();
  const mardStats = new Map<string, number>();

  colorStats.forEach((count, artkalCode) => {
    if (artkalCode === 'BG' || count === 0) return;
    const entry = mapData[artkalCode];
    if (entry && entry.mardCode) {
      mardStats.set(entry.mardCode, (mardStats.get(entry.mardCode) || 0) + count);
    } else {
      // No mapping found — keep original code as fallback
      mardStats.set(artkalCode, (mardStats.get(artkalCode) || 0) + count);
    }
  });
  return mardStats;
}

/**
 * Build a redirect URL to the Shopify bead-builder page with encoded selections
 *
 * Payload format:
 *   { v: 1, selections: { A01: 25, A02: 6, ... } }
 * 
 * URL format:
 *   https://yayascreativestudio.com/pages/bead-builder?from=tools&bb={base64url_payload}
 */
export function buildBeadBuilderUrl(
  colorStats: Map<string, number>
): string {
  const selections: Record<string, number> = {};
  
  colorStats.forEach((count, code) => {
    if (code !== 'BG' && count > 0) {
      selections[code] = count;
    }
  });

  const payload = {
    v: 1,
    selections
  };

  // Convert to JSON and then to Base64URL
  const jsonStr = JSON.stringify(payload);
  
  // Modern UTF-8 safe Base64 encoding
  const encoder = new TextEncoder();
  const data = encoder.encode(jsonStr);
  // Use a more compatible way to convert Uint8Array to binary string
  const binary = Array.from(data).map(byte => String.fromCharCode(byte)).join('');
  const base64 = btoa(binary);
  
  // Convert Base64 to Base64URL (URL-safe)
  const base64url = base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `https://yayascreativestudio.com/pages/bead-builder?from=tools&bb=${base64url}`;
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