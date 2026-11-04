# SOURA — Design System

> **Concept: “Mauritania, seen by its own people.”**
> SOURA (صورة, *image*) is a photography magazine first and a directory second.
> The photographs are the loudest thing on every page; the interface is the
> paper they are printed on.

This document is the source of truth. Tokens live in `src/styles.css`
(`@theme` + CSS custom properties); components live in `src/components/ui`.
If a value is not here, it should not be in the code.

---

## 1. Principles

1. **Images dominate.** Full‑bleed where possible, no rounded corners on
   photographs, no drop shadows, no frames. Captions are set like a magazine
   credit line, never as a card.
2. **Editorial asymmetry.** Sections use offset 12‑column compositions (7/5,
   8/4, 5/7 with an empty column) instead of identical card grids.
3. **Quiet chrome, one loud accent.** Neutral night/sand surfaces, with a
   single accent (*Braise*) reserved for primary actions, focus and
   active states.
4. **Designed for few photos.** Every list has an editorial empty state.
   Sparse content must read as *curated*, not *missing*.
5. **Arabic is a first‑class script**, not a mirrored afterthought: its own
   typefaces, its own line heights, no letter‑spacing, no uppercase.
6. **Fast by default.** No layout shift (every image ships width/height and a
   blur placeholder), motion is CSS‑only and disabled under
   `prefers-reduced-motion`.

What we deliberately avoid: purple gradients, glassmorphism, emoji icons,
stock marketing phrases, identical card grids, flags or national emblems as
decoration, camels/palm‑tree/tent “desert” ornaments.

---

## 2. Colour

Inspired by four places: **Adrar sandstone**, **Saharan dunes at dusk**,
**the Atlantic at Banc d’Arguin**, and **the night sky over the Tagant**.

### 2.1 Raw palette

| Token | Hex | Source |
|---|---|---|
| `night-950` | `#0B0D11` | Night sky (dark page) |
| `night-900` | `#12151B` | Raised surface |
| `night-850` | `#181C23` | Surface |
| `night-800` | `#1F242D` | Surface 2 / inputs |
| `night-700` | `#2B313C` | Hairlines on dark |
| `dune-50` | `#F5EFE6` | Dune at noon (light page) |
| `dune-25` | `#FBF8F3` | Raised (light) |
| `dune-100` | `#ECE3D5` | Surface (light) |
| `dune-200` | `#E1D3BE` | Surface 2 (light) |
| `dune-400` | `#B3946A` | Dune at dusk (decorative) |
| `sandstone-400` | `#D9935F` | Adrar sandstone (on dark) |
| `sandstone-700` | `#8E4C27` | Adrar sandstone (on light) |
| `atlantic-300` | `#7FC4BA` | Atlantic (on dark) |
| `atlantic-700` | `#1E6A61` | Atlantic (on light) |
| **`braise-500`** | **`#FF5B35`** | **The accent: last light on the erg** |
| `braise-400` | `#FF7A55` | Accent as text on dark |
| `braise-800` | `#B23A17` | Accent as text on light |

### 2.2 Semantic tokens

Dark is the default theme (`<html data-theme="dark">`); light is a refined
alternative selected by the user (stored in `localStorage`, never a cookie).

| Semantic | Dark | Light | Use |
|---|---|---|---|
| `--bg` | night‑950 | dune‑50 | Page |
| `--bg-raised` | night‑900 | dune‑25 | Header, menus, dialogs |
| `--surface` | night‑850 | dune‑100 | Panels, inputs |
| `--surface-2` | night‑800 | dune‑200 | Hover / selected rows |
| `--line` | ink @ 12% | ink @ 12% | Hairlines |
| `--line-strong` | ink @ 26% | ink @ 28% | Input borders, outlines |
| `--ink` | `#F3ECE2` | `#17130E` | Body text |
| `--ink-muted` | `#B5ACA0` | `#5A5046` | Secondary text |
| `--ink-subtle` | `#8C8478` | `#6B6155` | Metadata, ≥ 4.5:1 |
| `--accent` | braise‑500 | braise‑500 | Primary fills |
| `--accent-ink` | `#170A05` | `#170A05` | Text on accent |
| `--accent-text` | braise‑400 | braise‑800 | Accent used as text |
| `--sea` | atlantic‑300 | atlantic‑700 | Links in long text, success |
| `--sand` | sandstone‑400 | sandstone‑700 | Eyebrows, map |
| `--focus` | braise‑400 | braise‑800 | Focus ring |
| `--ok` / `--warn` / `--danger` | `#7FC4BA` / `#E9B44C` / `#FF7B72` | `#1E6A61` / `#8A5A00` / `#B4231A` | Status |

### 2.3 Measured contrast (WCAG 2.2)

| Pair | Ratio | Passes |
|---|---|---|
| ink on bg (dark) | 16.6 | AAA |
| ink‑muted on bg (dark) | 8.7 | AAA |
| ink‑subtle on bg (dark) | 5.3 | AA |
| accent‑text on bg (dark) | 7.6 | AAA |
| accent‑ink on accent | 6.3 | AA |
| ink on bg (light) | 16.2 | AAA |
| ink‑muted on bg (light) | 6.9 | AA |
| accent‑text on bg (light) | 5.2 | AA |
| accent‑text on surface (light) | 4.7 | AA |
| sea on bg (light) | 5.6 | AA |
| white on photo scrim (≥ 55% black) | ≥ 7 | AA |

Text over photographs is always set on a gradient scrim
(`--scrim: linear-gradient(to top, rgb(0 0 0 / .72), transparent 60%)`) and
never relies on the photo for contrast.

---

## 3. Typography

| Role | Latin | Arabic |
|---|---|---|
| Display | **Fraunces** (variable: `opsz`, `wght`) | **Markazi Text** (variable `wght`) |
| Text / UI | **Schibsted Grotesk** (variable `wght`) | **IBM Plex Sans Arabic** (400/500/600) |

* Fraunces is used at high optical size (`opsz` 96–144) for headlines: soft,
  warm, editorial — a magazine masthead rather than a tech brand.
* Schibsted Grotesk was drawn for a news publisher: neutral, sturdy at small
  sizes, good on low‑DPI phones.
* Markazi Text is a contemporary Naskh with real editorial colour; it carries
  headlines with the same authority as Fraunces.
* IBM Plex Sans Arabic pairs with the grotesk for UI and long reading.
* All fonts are self‑hosted (`@fontsource`, OFL), split by `unicode-range`, so
  French pages never download Arabic glyphs and vice versa.

### 3.1 Scale (fluid, mobile‑first)

| Token | Size | Line height | Notes |
|---|---|---|---|
| `display-2xl` | `clamp(3.25rem, 1.6rem + 7.2vw, 9rem)` | 0.92 | Hero only |
| `display-xl` | `clamp(2.6rem, 1.5rem + 4.6vw, 6rem)` | 0.95 | Page titles |
| `display-lg` | `clamp(2.1rem, 1.4rem + 2.8vw, 4rem)` | 1.0 | Section titles |
| `display-md` | `clamp(1.7rem, 1.3rem + 1.6vw, 2.6rem)` | 1.08 | Sub‑sections |
| `title` | `1.375rem` | 1.25 | Card titles, dialog titles |
| `body-lg` | `1.125rem` | 1.6 | Lead paragraphs |
| `body` | `1rem` | 1.6 | Default |
| `small` | `0.875rem` | 1.5 | Metadata |
| `micro` | `0.75rem` | 1.4 | Eyebrows, letter‑spaced `0.16em`, uppercase (Latin only) |

### 3.2 Arabic rules (`:lang(ar)`)

* Line height +0.15 on body, +0.1 on display (Arabic ascenders/descenders).
* Font size ×1.08 for text styles (Naskh reads smaller at equal size).
* `letter-spacing: 0` and `text-transform: none` everywhere — tracking breaks
  joining, and Arabic has no case.
* Numerals: Western Arabic digits (0–9) — the common usage in Mauritania.
* Eyebrows switch from uppercase tracking to a heavier weight.

---

## 4. Space, grid, shape

* Base unit 4px. Steps: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128.
* `--gutter`: `clamp(1rem, 0.5rem + 2.5vw, 3rem)` (16px minimum on phones).
* `--section`: `clamp(4rem, 3rem + 6vw, 10rem)` vertical rhythm between sections.
* Grid: 4 columns < 640px, 8 columns < 1024px, 12 columns above; max content
  width 1440px, full‑bleed allowed for imagery.
* Radius: `0` for photographs, `2px` for inputs and buttons, `999px` for
  chips only. No other radii.
* Elevation: none. Separation comes from hairlines (`--line`) and surface steps.

---

## 5. Motion

| Token | Value |
|---|---|
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` |
| `--dur-1` | 150ms (hover, press) |
| `--dur-2` | 320ms (reveals, menus) |
| `--dur-3` | 700ms (image hover scale, hero) |

* **Page transitions**: View Transitions API (router `defaultViewTransition`),
  cross‑fade 220ms; photos shared between grid and detail morph via
  `view-transition-name`. Falls back to instant navigation.
* **Reveals**: sections fade/translate 12px once when 15% visible
  (IntersectionObserver adds `data-in`). Content is visible without JS.
* **Image hover**: 1.03 scale over `--dur-3`, caption slides in. Disabled on
  touch (`@media (hover: hover)`).
* `prefers-reduced-motion: reduce` → all transitions/animations ≤ 1ms, view
  transitions disabled.
* Never animate layout‑affecting properties; only `opacity` and `transform`.

---

## 6. Core components (`src/components/ui`)

| Component | Notes |
|---|---|
| `Button` / `ButtonLink` | `primary` (accent fill), `secondary` (outline), `ghost`, `danger`; sizes `sm`/`md`/`lg`; min target 44×44px; visible focus ring. |
| `Field` | Label + control + hint + error, wired with `aria-describedby` / `aria-invalid`. Wraps `Input`, `Textarea`, `Select`. |
| `Checkbox`, `RadioGroup` | Native inputs restyled with `accent-color`; whole label is the hit area. |
| `StatusBadge` | `pending`, `approved`, `rejected`, `hidden`, `processing`, `removed`; colour + text + icon (never colour alone). |
| `Chip` | Filter pills (links with `aria-current`). |
| `Eyebrow` | Section index + label, e.g. `01 — Régions`. |
| `SectionHeader` | Eyebrow, display title, optional aside, asymmetric layout. |
| `Photo` | `<picture>` with AVIF + WebP `srcset`, explicit `width`/`height`, blur placeholder background, `loading`/`fetchpriority` control. |
| `PhotoTile` | Photo + credit line overlay (title, author, region) on hover/focus; whole tile is one link. |
| `Masonry` | CSS multi‑column masonry (no JS, no CLS), `break-inside: avoid`. |
| `EmptyState` | Large display line, short body, one action. No illustrations. |
| `Notice` | Inline info/warn/danger messages with `role="status"`/`"alert"`. |
| `Dialog` | Native `<dialog>` with focus return. |
| `Icon` | Inline SVG line icons, 1.5px stroke, `currentColor`, `aria-hidden` unless labelled. |
| `SiteHeader`, `SiteFooter`, `SkipLink`, `LanguageSwitcher`, `ThemeToggle` | Global chrome. |

### Wordmark
`SOURA` set in Fraunces 600 (opsz 144) beside `صورة` in Markazi Text 600 —
both scripts side by side, deliberately, on every page.

---

## 7. Imagery rules

* Public images are server‑generated derivatives only (WebP + AVIF), EXIF/GPS
  stripped, with a credit mark; the detail preview carries a visible
  watermark and a limited long edge (1600px).
* Every image has `alt` text, required before approval.
* Aspect ratio is preserved; crops only for Open Graph cards (1200×630).
* Blur placeholders are 24px WebP data URIs (≈ 300 bytes).

---

## 8. Accessibility checklist (WCAG 2.2 AA)

* Skip link to `#main`; landmarks: `header`, `nav`, `main`, `footer`.
* Focus visible on every interactive element (`:focus-visible`, 2px ring,
  2px offset, ≥ 3:1).
* Targets ≥ 24×24 CSS px (we aim for 44).
* Forms: labels, inline errors announced via `role="alert"`, no
  placeholder‑only labels.
* `lang` and `dir` set on `<html>` per locale; logical CSS properties
  (`ms-*`, `pe-*`, `start`/`end`) so RTL mirrors automatically.
* Colour is never the only signal (status badges have text + icon).
