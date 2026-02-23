# Perler Bead Pattern Converter

A browser-based tool that converts any image into a perler bead pattern using the Artkal 221 color palette. All processing happens client-side — no server uploads required.

## Features (V2)

### Image Processing
- **Upload**: Supports JPG, PNG, WebP via drag-and-drop or click-to-select
- **Dynamic Grid**: Slider-based grid sizing (10–250) with automatic aspect ratio preservation
- **Nearest Neighbor Scaling**: Maintains pixel-art style during downscaling
- **Color Mapping**: Maps each pixel to the closest Artkal 221 palette color using RGB Euclidean distance

### Color Merging & Background Removal
- **BFS Region Merging**: Merges small color regions (below a user-defined threshold) into neighboring colors, reducing noise
- **Background Detection**: Flood-fill from image edges identifies and dims background pixels
- **Color Exclusion**: Right-click any color in the statistics panel to exclude it; pixels are remapped to the next closest color

### Editing Tools
- **Brush**: Paint individual pixels with a selected palette color
- **Eraser**: Remove pixels (set to white/background)
- **Eyedropper**: Pick a color from the canvas for use with the brush
- **Click-to-Highlight**: Click any color in the statistics panel to highlight matching pixels on the canvas
- **Hover Info**: Hover over any pixel to see its color code, hex value, and grid position

### Statistics & Export
- **Color Statistics**: Shows each color code, count, and percentage with visual progress bars
- **PNG Export**: Download the pattern as a standard PNG image
- **Coded PNG Export**: Download with color codes overlaid on each pixel
- **CSV Export**: Download color statistics as a spreadsheet

### Shopify Integration
- **Store URL Configuration**: Enter your Shopify store URL
- **Variant Mapping**: Map each Artkal color code to a Shopify product variant ID
- **Cart Generation**: Creates a pre-filled Shopify cart URL with all required colors and quantities
- **Persistent Config**: Store URL and variant mappings are saved in localStorage

## Getting Started

### Install Dependencies
```bash
pnpm install
```

### Run Development Server
```bash
pnpm dev
```

### Build for Production
```bash
pnpm build
```

## Code Structure

```
client/
  src/
    pages/
      Home.tsx              # Main converter page with full layout
    components/
      ImageUploadSection.tsx # Drag-and-drop image upload
      ColorStatistics.tsx    # Color usage table
      ShopifyIntegration.tsx # Shopify cart integration panel
      CanvasPreview.tsx      # Canvas preview
      GridSizeSelector.tsx   # Grid size buttons
    lib/
      colorMapping.ts       # Color algorithms: Euclidean distance, BFS merge, background detection, color exclusion
      imageProcessing.ts    # Image loading, grid processing, canvas drawing, export
      shopifyIntegration.ts # Shopify cart URL builder, variant mapping
  public/
    artkal_221.json         # Artkal 221 color palette (291 colors)
```

## Building the Color Palette

The `artkal_221.json` file was generated from `colorSystemMapping.json`, which maps color codes across multiple bead systems (MARD, COCO, 漫漫, 盼盼, 咪小窝). Each entry contains:

```json
{
  "code": "C01",
  "name": "白色",
  "hex": "#FFFFFF",
  "rgb": { "r": 255, "g": 255, "b": 255 }
}
```

To regenerate from a new mapping file:
```bash
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('colorSystemMapping.json', 'utf-8'));
const result = Object.entries(data).map(([hex, codes]) => ({
  code: codes.MARD,
  name: codes.MARD,
  hex: hex,
  rgb: {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16)
  }
})).sort((a, b) => a.code.localeCompare(b.code));
fs.writeFileSync('client/public/artkal_221.json', JSON.stringify(result, null, 2));
"
```

## Shopify Variant Mapping

To configure the Shopify integration:

1. In your Shopify admin, find each product variant ID for your bead colors
2. In the app, click "Configure Variant Mapping"
3. Enter the variant ID for each color code used in your pattern
4. Click "Add to Cart" to generate a pre-filled cart URL

The mapping format:
```json
{
  "C01": "gid://shopify/ProductVariant/12345678901234",
  "C02": "gid://shopify/ProductVariant/12345678901235"
}
```

Cart URL format:
```
https://your-store.myshopify.com/cart/add?id=variant_id&quantity=qty&id=variant_id&quantity=qty
```

## Color Mapping Algorithm

1. **Grid Resizing**: Image is resized to the selected grid size using nearest-neighbor interpolation
2. **Dominant Color**: For each grid cell, the most frequent RGB color is determined
3. **Distance Calculation**: Euclidean distance from dominant color to each palette color:
   ```
   distance = sqrt((r1-r2)² + (g1-g2)² + (b1-b2)²)
   ```
4. **Closest Match**: The palette color with the minimum distance is selected
5. **BFS Merge** (optional): Small regions are merged into neighboring colors
6. **Background Detection** (optional): Flood-fill from edges identifies background

## Next Steps / Extensible Features

### Advanced Color Algorithms
- **CIEDE2000**: More perceptually accurate color distance than Euclidean RGB
- **K-Means Clustering**: Reduce color count before palette mapping
- **Floyd-Steinberg Dithering**: Error diffusion for smoother gradients

### User Custom Palettes
- Allow users to upload custom palette JSON files
- Support multiple bead brands (Hama, Perler, Artkal)

### Enhanced Editing
- Undo/redo history stack
- Rectangular selection tool
- Fill tool (flood fill with selected color)

### Performance
- Web Worker for heavy processing (large grids)
- Progressive rendering for 200×200+ grids

## Technical Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS 4 + shadcn/ui components
- **Canvas API**: HTML5 Canvas for image processing
- **Build**: Vite + esbuild
- **Package Manager**: pnpm

## References

- [Zippland Perler Bead Generator](https://github.com/nicx519y/perler-bead-generator) — Algorithm reference
- [Artkal Beads Official Site](https://www.artkalbeads.com/)
- [Shopify Cart API Documentation](https://shopify.dev/docs/api/storefront)

---

**Version**: 2.0.0
**Last Updated**: February 2026
