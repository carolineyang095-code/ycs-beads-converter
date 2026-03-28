# Yaya's Creative Studio — Fuse Bead Pattern Converter

A browser-based tool that converts any image into a fuse bead pattern using the MARD 221-color palette and Artkal C-Mini palette. All image processing happens client-side — no server uploads required.

**Live site:** [tools.yayascreativestudio.com](https://tools.yayascreativestudio.com)

---

## Features

### Image Processing
- **Upload**: Supports JPG, PNG, WebP via drag-and-drop or click-to-select
- **Dynamic Grid**: Slider-based grid sizing with automatic aspect ratio preservation
- **Dominant Color Mapping**: For each grid cell, finds the most frequent RGB value, then maps to the nearest palette color using RGB Euclidean distance
- **Dual Palette Support**: MARD 221-color palette and Artkal C-Mini palette, with cross-palette color mapping

### Color Merging & Background Removal
- **BFS Region Merging**: Merges small color regions (below a user-defined threshold) into neighboring colors, reducing noise
- **Background Detection**: Flood-fill from image edges identifies and dims background pixels
- **Color Exclusion**: Click any color in the statistics panel to exclude it; pixels remap to the next closest color
- **Batch Color Replace**: Replace all instances of one color across the entire canvas at once

### Canvas Editing Tools
- **Brush**: Paint individual pixels with a selected palette color
- **Eraser**: Remove pixels (set to background)
- **Eyedropper**: Pick a color from the canvas for use with the brush
- **Canvas Panning**: Drag to pan around large patterns
- **Mobile & iPad Support**: Full Apple Pencil support and touch input via Pointer Events API (`touch-action: none`)
- **Hover Info**: Hover over any pixel to see its color code, hex value, and grid position

### Statistics & Export
- **Color Statistics**: Shows each color code, count, and percentage
- **Click-to-Highlight**: Click any color in the statistics panel to highlight matching pixels on the canvas
- **PNG Export**: Download the pattern as a standard PNG image
- **Coded PNG Export**: Download with color codes overlaid on each pixel
- **CSV Export**: Download color statistics as a spreadsheet
- **Tiered Pricing Display**: Shows estimated bead cost based on quantity tiers

### Project Management
- **Save & Load**: Save current patterns as named projects and reload them in a future session

### Pattern Library
- Curated free fuse bead patterns browseable directly in the tool
- Each pattern links to color breakdown and Shopify Bead Builder for direct purchase

### Shopify Integration
- **Bead Builder**: Links directly to the YCS store bead builder with quantities pre-filled based on pattern color statistics

---

## Code Structure

```
client/
  public/
    assets/
      patterns/         # Pattern preview images (.png)
    patterns/           # Individual pattern pages (static HTML)
  src/
    lib/
      colorMapping.ts   # Euclidean distance, BFS merge, background detection, color exclusion
      imageProcessing.ts # Image loading, grid processing, canvas drawing, export
    ...

shared/                 # Shared types and utilities

colorSystemMapping.json # Source color data: hex → MARD / COCO / 漫漫 / 盼盼 / 咪小窝 mappings
```

---

## Color Mapping Algorithm

1. **Grid Resizing**: Image is divided into N×M cells based on selected grid size
2. **Dominant Color**: For each cell, the most frequent RGB value is identified (ignoring transparent pixels)
3. **Distance Calculation**: Euclidean distance from the dominant color to each palette color:
   ```
   distance = sqrt((r1-r2)² + (g1-g2)² + (b1-b2)²)
   ```
4. **Closest Match**: The palette color with the minimum distance is selected
5. **BFS Region Merge** (optional): Small connected regions are merged into neighboring dominant colors
6. **Background Detection** (optional): Flood-fill from all edge cells identifies external background

---

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

---

## Technical Stack

- **Frontend**: Vite + TypeScript + HTML/JS (static)
- **Styling**: Tailwind CSS
- **Canvas API**: HTML5 Canvas for all image processing and drawing
- **Deployment**: Vercel (static hosting)
- **Package Manager**: pnpm

---

## License

This project is licensed under [AGPL-3.0](./LICENSE), in accordance with the license of the upstream project it is derived from.

---

## Attribution

Core image processing algorithms (dominant color mapping, BFS region merging, flood-fill background detection) and the `colorSystemMapping.json` color data were adapted from [Zippland/perler-beads](https://github.com/Zippland/perler-beads) by [Zippland](https://github.com/Zippland), licensed under [AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.html).

This project has since been significantly extended with a new frontend architecture (Vite + static HTML/JS), dual palette support (MARD 221 + Artkal C-Mini), canvas editing tools, Apple Pencil support, project management, pattern library, and Shopify integration. The tool itself remains free to use at [tools.yayascreativestudio.com](https://tools.yayascreativestudio.com).

---

## References

- [Zippland/perler-beads](https://github.com/Zippland/perler-beads) — Original algorithm design and color mapping data (AGPL-3.0)
- [Artkal Beads Official Site](https://www.artkalbeads.com/)
- [Shopify Cart API Documentation](https://shopify.dev/docs/api/storefront)

---

**Last Updated**: March 2026
