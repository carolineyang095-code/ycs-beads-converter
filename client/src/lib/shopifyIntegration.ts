/**
 * Shopify Integration Library
 * Handles shopping cart creation and product variant mapping
 */

export interface ShopifyVariantMapping {
  [colorCode: string]: string; // colorCode -> variantId
}

export interface CartItem {
  variantId: string;
  quantity: number;
}

/**
 * Default Shopify variant mapping
 * This should be configured based on your actual Shopify store
 * Format: color code -> variant ID
 */
export const DEFAULT_VARIANT_MAPPING: ShopifyVariantMapping = {
  // Example mappings - replace with your actual variant IDs
  // 'A01': 'gid://shopify/ProductVariant/12345678901234',
  // 'A02': 'gid://shopify/ProductVariant/12345678901235',
};

/**
 * Build a Shopify cart URL with pre-filled items
 * Uses the Shopify Cart API format
 */
export function buildShopifyCartUrl(
  storeUrl: string,
  colorStats: Map<string, number>,
  variantMapping: ShopifyVariantMapping
): string {
  const cartItems: CartItem[] = [];

  colorStats.forEach((count, colorCode) => {
    const variantId = variantMapping[colorCode];
    if (variantId) {
      cartItems.push({
        variantId,
        quantity: count,
      });
    }
  });

  if (cartItems.length === 0) {
    throw new Error('No valid product variants found for the selected colors');
  }

  // Build the cart URL using Shopify's cart API
  // Format: /cart/add?id=variant_id&quantity=qty&id=variant_id&quantity=qty
  const params = new URLSearchParams();
  for (const item of cartItems) {
    params.append('id', item.variantId);
    params.append('quantity', item.quantity.toString());
  }

  const baseUrl = storeUrl.endsWith('/') ? storeUrl : storeUrl + '/';
  return `${baseUrl}cart/add?${params.toString()}`;
}

/**
 * Alternative: Build a Shopify Storefront API cart creation payload
 * This is useful if you want to create a cart via API instead of URL redirect
 */
export function buildStorefrontCartPayload(
  colorStats: Map<string, number>,
  variantMapping: ShopifyVariantMapping
): Array<{ variantId: string; quantity: number }> {
  const items: Array<{ variantId: string; quantity: number }> = [];

  colorStats.forEach((count, colorCode) => {
    const variantId = variantMapping[colorCode];
    if (variantId) {
      items.push({
        variantId,
        quantity: count,
      });
    }
  });

  return items;
}

/**
 * Redirect to Shopify cart with pre-filled items
 */
export function redirectToShopifyCart(
  storeUrl: string,
  colorStats: Map<string, number>,
  variantMapping: ShopifyVariantMapping
): void {
  try {
    const cartUrl = buildShopifyCartUrl(storeUrl, colorStats, variantMapping);
    window.location.href = cartUrl;
  } catch (error) {
    console.error('Failed to create Shopify cart URL:', error);
    throw error;
  }
}

/**
 * Validate variant mapping configuration
 */
export function validateVariantMapping(
  colorStats: Map<string, number>,
  variantMapping: ShopifyVariantMapping
): {
  valid: boolean;
  missingColors: string[];
  mappedColors: string[];
} {
  const missingColors: string[] = [];
  const mappedColors: string[] = [];

  colorStats.forEach((_count, colorCode) => {
    if (variantMapping[colorCode]) {
      mappedColors.push(colorCode);
    } else {
      missingColors.push(colorCode);
    }
  });

  return {
    valid: missingColors.length === 0,
    missingColors,
    mappedColors,
  };
}

/**
 * Generate a configuration template for variant mapping
 */
export function generateVariantMappingTemplate(
  colorCodes: string[]
): ShopifyVariantMapping {
  const template: ShopifyVariantMapping = {};
  for (const code of colorCodes) {
    template[code] = ''; // Empty - to be filled by user
  }
  return template;
}

/**
 * Load variant mapping from localStorage
 */
export function loadVariantMappingFromStorage(): ShopifyVariantMapping | null {
  try {
    const stored = localStorage.getItem('shopify_variant_mapping');
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Failed to load variant mapping from storage:', error);
    return null;
  }
}

/**
 * Save variant mapping to localStorage
 */
export function saveVariantMappingToStorage(
  mapping: ShopifyVariantMapping
): void {
  try {
    localStorage.setItem('shopify_variant_mapping', JSON.stringify(mapping));
  } catch (error) {
    console.error('Failed to save variant mapping to storage:', error);
  }
}
