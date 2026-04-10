# YCS_BRAND_SKILL.md
# Yaya's Creative Studio — Brand & Copywriting Reference
# Claude should read this file before writing any copy, designing any page section,
# or producing any content for yayascreativestudio.com or tools.yayascreativestudio.com.

---

## 1. Brand Identity

**Full name:** Yaya's Creative Studio (YCS)
**Location:** Paris / Bagnolet, France
**Business type:** Craft supply micro-enterprise + digital tools + (upcoming) physical studio

**Core positioning:** "Mindful Making" — adult therapeutic handcraft as a lifestyle practice.
- This is NOT a children's brand.
- This is NOT a kawaii brand (even though some patterns are kawaii-style).
- The customer is an adult who finds calm, focus, and self-expression through making things by hand.

**Brand tagline (trilingual, finalized, do not alter):**
- 🇨🇳 造物之间，心有归处
- 🇫🇷 Entre les mains, le cœur se pose.
- 🇬🇧 To make is to come home.

**Hero copy (Shopify, finalized):**
"Turn any image into something you made with your own hands."

---

## 2. Brand Voice & Tone

**Overall feel:** Warm, calm, confident, artisanal. Never corporate, never childish, never overly promotional.

**English:** Clear and inviting. Slightly poetic but always practical. Avoid filler phrases.

**French:** Natural, local-sounding French. Avoid anglicisms. No em dashes (—) — they read as an AI writing tell. No point médian (fier·e) — too polarizing for the French market. Sentence flow should feel like a real French person wrote it.

**Chinese:** Warm and grounded. Not overly commercial. Suits a lifestyle/craft context.

---

## 3. Terminology Rules

### French
| ✅ Use | ❌ Never use | Context |
|--------|-------------|---------|
| modèle | patron | fuse bead pattern |
| perles à repasser | Hama, Artkal (in product titles) | generic product term |
| feutrage à l'aiguille | — | needle felting |
| gabarit | patron, modèle | needle felting template/outline |
| L'Habitué(e) | Le Régulier | crafter persona card |
| Atelier libre / Open Studio | — | in-person bead session name |

### Chinese
| ✅ Use | ❌ Never use | Context |
|--------|-------------|---------|
| 拼豆 | 珠子 | fuse beads |
| 图纸 | — | bead pattern |
| 羊毛毡 / 针毡 | — | needle felting |

### English
- "fuse beads" preferred over "perler beads" (Perler is a brand; we target European market)
- Do not mention competitor brand names (Hama, Artkal) in product titles
- Artkal and MARD can be referenced in technical/compatibility contexts only

---

## 4. Design System

Apply consistently to all Shopify pages and blog posts.

**Fonts:**
- Headings: Caveat (handwritten, weight 600)
- Body: Dosis (weight 500, slightly larger than default for readability)
- Chinese text: override with system sans-serif via CSS variable in theme.liquid

**Colors:**
| Name | Hex | Usage |
|------|-----|-------|
| Deep purple | #332847 | Hero backgrounds, primary headings |
| Purple accent | #7B6A9B | Accents, borders, highlights |
| Light purple | #b8a8d4 | Subtle backgrounds |
| Muted purple | #5a4f6a | Secondary text |
| Warm white | #F5EFE6 | Page background, card fill |
| Border/bg | #E8E3F0 | Card borders, section dividers |
| Teal | #4db8a0 | CTAs, positive accents |
| Pink | #c47a9a | Soft accents, highlights |

**Page section style:**
- Deep purple hero banner with colorful bead-dot decoration
- White feature cards with subtle shadow
- Left-border callout boxes (purple left border, light purple background)

---

## 5. Product Catalog Context

**Core product:** 2.6mm mini fuse beads
**Palette:** MARD internal system, 221 colors, Artkal-compatible
**Palette code format:** MARD two-letter codes (e.g. C01, A12)
**Product URL format:** `/products/artkal-fuse-bead-mard-[lowercase code]`

**Pricing tiers (Bead Builder):**
- < 1500 beads: €0.02/bead
- 1500–3000 beads: €0.018/bead
- 3000+ beads: €0.016/bead

---

## 6. Crafter Persona Cards

Four customer personas (use these names exactly):

| EN | FR | ZH |
|----|----|----|
| The Collector | La Collectionneuse | 收藏家 |
| The Creator | La Créatrice | 创作者 |
| The Regular | L'Habitué(e) | 常客 |
| The Gift-Giver | La Chineuse de Cadeaux | 送礼达人 |

---

## 7. Multilingual Page Rules

- Shopify store: trilingual EN / FR / ZH
- Tools site: bilingual EN / FR (i18next)
- Always provide all required language versions when writing copy
- French is primary for the European market; do not treat it as secondary
- "Kawaii" should not appear as the first or defining category label — it does not represent the full brand

---

## 8. Blog Post Structure (YCS Creation Showcase)

Standard blog post structure:
1. Hero image
2. Badges (difficulty, bead count, color count)
3. EN/FR language toggle
4. Color chip grid (swatch + MARD code + quantity, linking to product pages)
5. Bead Builder CTA
6. Credit / attribution

Template reference: `ycs-blog-template-giyu.html`

---

## 9. SEO Guidelines

**Shopify store targets:** "fuse bead" product terms
**Tools site targets:** "perler bead pattern maker" and related long-tail keywords

**Pattern page SEO title format:** "Kawaii [Subject] Fuse Bead Pattern – Free Download" (~58 chars)
**Pattern meta description:** ~159 chars, include: free, color count, bead count, Artkal & MARD compatible

---

## 10. What NOT to Do

- Never use "patron" for pattern in French
- Never use "珠子" for fuse beads in Chinese
- Never name competitor brands in product titles
- Never use em dash (—) in French copy
- Never use point médian (·) in French copy
- Never position YCS as a children's or kawaii-first brand
- Never use "Perler bead" as the generic term (it's a brand name)
- Do not treat Artkal as an internal product — it's a compatibility reference only
