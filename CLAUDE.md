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


# AGENTS.md

Guidelines for AI agents working in this repository.

## Repository Overview

This repository contains **Agent Skills** for AI agents following the [Agent Skills specification](https://agentskills.io/specification.md). Skills install to `.agents/skills/` (the cross-agent standard). This repo also serves as a **Claude Code plugin marketplace** via `.claude-plugin/marketplace.json`.

- **Name**: Marketing Skills
- **GitHub**: [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills)
- **Creator**: Corey Haines
- **License**: MIT

## Repository Structure

```
marketingskills/
├── .claude-plugin/
│   └── marketplace.json   # Claude Code plugin marketplace manifest
├── skills/                # Agent Skills
│   └── skill-name/
│       └── SKILL.md       # Required skill file
├── tools/
│   ├── clis/              # Zero-dependency Node.js CLI tools (51 tools)
│   ├── composio/          # Composio integration layer (quick start + toolkit mapping)
│   ├── integrations/      # API integration guides per tool
│   └── REGISTRY.md        # Tool index with capabilities
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

## Build / Lint / Test Commands

**Skills** are content-only (no build step). Verify manually:
- YAML frontmatter is valid
- `name` field matches directory name exactly
- `name` is 1-64 chars, lowercase alphanumeric and hyphens only
- `description` is 1-1024 characters

**CLI tools** (`tools/clis/*.js`) are zero-dependency Node.js scripts (Node 18+). Verify with:
```bash
node --check tools/clis/<name>.js   # Syntax check
node tools/clis/<name>.js           # Show usage (no args = help)
node tools/clis/<name>.js <cmd> --dry-run  # Preview request without sending
```

## Agent Skills Specification

Skills follow the [Agent Skills spec](https://agentskills.io/specification.md).

### Required Frontmatter

```yaml
---
name: skill-name
description: What this skill does and when to use it. Include trigger phrases.
---
```

### Frontmatter Field Constraints

| Field         | Required | Constraints                                                      |
|---------------|----------|------------------------------------------------------------------|
| `name`        | Yes      | 1-64 chars, lowercase `a-z`, numbers, hyphens. Must match dir.   |
| `description` | Yes      | 1-1024 chars. Describe what it does and when to use it.          |
| `license`     | No       | License name (default: MIT)                                      |
| `metadata`    | No       | Key-value pairs (author, version, etc.)                          |

### Name Field Rules

- Lowercase letters, numbers, and hyphens only
- Cannot start or end with hyphen
- No consecutive hyphens (`--`)
- Must match parent directory name exactly

**Valid**: `page-cro`, `email-sequence`, `ab-test-setup`
**Invalid**: `Page-CRO`, `-page`, `page--cro`

### Optional Skill Directories

```
skills/skill-name/
├── SKILL.md        # Required - main instructions (<500 lines)
├── references/     # Optional - detailed docs loaded on demand
├── scripts/        # Optional - executable code
└── assets/         # Optional - templates, data files
```

## Writing Style Guidelines

### Structure

- Keep `SKILL.md` under 500 lines (move details to `references/`)
- Use H2 (`##`) for main sections, H3 (`###`) for subsections
- Use bullet points and numbered lists liberally
- Short paragraphs (2-4 sentences max)

### Tone

- Direct and instructional
- Second person ("You are a conversion rate optimization expert")
- Professional but approachable

### Formatting

- Bold (`**text**`) for key terms
- Code blocks for examples and templates
- Tables for reference data
- No excessive emojis

### Clarity Principles

- Clarity over cleverness
- Specific over vague
- Active voice over passive
- One idea per section

### Description Field Best Practices

The `description` is critical for skill discovery. Include:
1. What the skill does
2. When to use it (trigger phrases)
3. Related skills for scope boundaries

```yaml
description: When the user wants to optimize conversions on any marketing page. Use when the user says "CRO," "conversion rate optimization," "this page isn't converting." For signup flows, see signup-flow-cro.
```

## Claude Code Plugin

This repo also serves as a plugin marketplace. The manifest at `.claude-plugin/marketplace.json` lists all skills for installation via:

```bash
/plugin marketplace add coreyhaines31/marketingskills
/plugin install marketing-skills
```

See [Claude Code plugins documentation](https://code.claude.com/docs/en/plugins.md) for details.

## Git Workflow

### Branch Naming

- New skills: `feature/skill-name`
- Improvements: `fix/skill-name-description`
- Documentation: `docs/description`

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat: add skill-name skill`
- `fix: improve clarity in page-cro`
- `docs: update README`

### Pull Request Checklist

- [ ] `name` matches directory name exactly
- [ ] `name` follows naming rules (lowercase, hyphens, no `--`)
- [ ] `description` is 1-1024 chars with trigger phrases
- [ ] `SKILL.md` is under 500 lines
- [ ] No sensitive data or credentials

## Tool Integrations

This repository includes a tools registry for agent-compatible marketing tools.

- **Tool discovery**: Read `tools/REGISTRY.md` to see available tools and their capabilities
- **Integration details**: See `tools/integrations/{tool}.md` for API endpoints, auth, and common operations
- **MCP-enabled tools**: ga4, stripe, mailchimp, google-ads, resend, zapier, zoominfo, clay, supermetrics, coupler, outreach, crossbeam, introw, composio
- **Composio** (integration layer): Adds MCP access to OAuth-heavy tools without native MCP servers (HubSpot, Salesforce, Meta Ads, LinkedIn Ads, Google Sheets, Slack, etc.). See `tools/integrations/composio.md`

### Registry Structure

```
tools/
├── REGISTRY.md              # Index of all tools with capabilities
└── integrations/            # Detailed integration guides
    ├── ga4.md
    ├── stripe.md
    ├── rewardful.md
    └── ...
```

### When to Use Tools

Skills reference relevant tools for implementation. For example:
- `referral-program` skill → rewardful, tolt, dub-co, mention-me guides
- `analytics-tracking` skill → ga4, mixpanel, segment guides
- `email-sequence` skill → customer-io, mailchimp, resend guides
- `paid-ads` skill → google-ads, meta-ads, linkedin-ads guides

For tools without native MCP servers (HubSpot, Salesforce, Meta Ads, LinkedIn Ads, Google Sheets, Slack, Notion), Composio provides MCP access via a single server. See `tools/integrations/composio.md` for setup and `tools/composio/marketing-tools.md` for the full toolkit mapping.

## Checking for Updates

When using any skill from this repository:

1. **Once per session**, on first skill use, check for updates:
   - Fetch `VERSIONS.md` from GitHub: https://raw.githubusercontent.com/coreyhaines31/marketingskills/main/VERSIONS.md
   - Compare versions against local skill files

2. **Only prompt if meaningful**:
   - 2 or more skills have updates, OR
   - Any skill has a major version bump (e.g., 1.x to 2.x)

3. **Non-blocking notification** at end of response:
   ```
   ---
   Skills update available: X marketing skills have updates.
   Say "update skills" to update automatically, or run `git pull` in your marketingskills folder.
   ```

4. **If user says "update skills"**:
   - Run `git pull` in the marketingskills directory
   - Confirm what was updated

## Skill Categories

See `README.md` for the current list of skills organized by category. When adding new skills, follow the naming patterns of existing skills in that category.

## Claude Code-Specific Enhancements

These patterns are **Claude Code only** and must not be added to `SKILL.md` files directly, as skills are designed to be cross-agent compatible (Codex, Cursor, Windsurf, etc.). Apply them locally in your own project's `.claude/skills/` overrides instead.

### Dynamic content injection with `!`command``

Claude Code supports embedding shell commands in SKILL.md using `` !`command` `` syntax. When the skill is invoked, Claude Code runs the command and injects the output inline — the model sees the result, not the instruction.

**Most useful application: auto-inject the product marketing context file**

Instead of every skill telling the agent "go check if `.agents/product-marketing-context.md` exists and read it," you can inject it automatically:

```markdown
Product context: !`cat .agents/product-marketing-context.md 2>/dev/null || echo "No product context file found — ask the user about their product before proceeding."`
```

Place this at the top of a skill's body (after frontmatter) to make context available immediately without any file-reading step.

**Other useful injections:**

```markdown
# Inject today's date for recency-sensitive skills
Today's date: !`date +%Y-%m-%d`

# Inject current git branch (useful for workflow skills)
Current branch: !`git branch --show-current 2>/dev/null`

# Inject recent commits for context
Recent commits: !`git log --oneline -5 2>/dev/null`
```

**Why this is Claude Code-only**: Other agents that load skills will see the literal `` !`command` `` string rather than executing it, which would appear as garbled instructions. Keep cross-agent skill files free of this syntax.
