# Changelog

All notable changes to this project will be documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.2.0] — 2026-07-24

### Structural changes (same tier model, deeper architecture)

**Color primitives — Radix migration**

- All color ramps (`mauve`, `red`, `green`, `orange`) unified to Radix 1-12 step
  numbering. Replaced custom Tailwind-style 50/100/…/950 naming in the primitive tier.
- `grey` renamed `mauve` (Radix neutral with violet undertone), `gold` renamed `bronze`
  (Radix bronze scale). `magenta` renamed from `poli-magenta` to reflect key–value
  structure.
- `black-alpha` replaces the previous grey alpha ramp. `pink` added as a standalone
  Radix scale for Poli secondary.

**Brand scale — custom Radix method**

- `magenta` (Poli primary identity) generated as a 12-step OKLCH scale anchored on the
  brand hex at step 9. Step 9 = exact brand color, guaranteed. Steps 1-8 and 10-12
  derived via Radix lightness/chroma curve. Documented in
  `docs/DESIGN-SYSTEM-GUIDE.md § Color scale sources`.

**Palette model — three actions**

- `palette.primary` — full brand (magenta). Primary CTAs and key UI accents.
- `palette.secondary` — brand soft (pink). Secondary surfaces and softer brand moments.
- `palette.tertiary` — neutral (mauve). Structural UI (cards, containers, dividers).
- `palette.accent` — bronze. Decorative accents.

**Contrast gate — permanent, allowlist-based**

- 326 semantic fg×bg pairs evaluated per mode (light + dark). 0 failures.
- Allowlist of exemptions (`text.disabled`, `stroke.divider`) declared with rationale
  in `scripts/lib/contrast.mjs`. A rename breaks the exemption on purpose.

**Origin markers — machine-readable library/brand boundary**

- `$extensions.nsp.origin: "base" | "brand-poli"` added to every color primitive group
  and every `palette.*` slot. Marks the future extraction boundary: `brand-poli` nodes
  migrate to a per-project repo in Fase D3; `base` nodes remain in the library.
- Semantic token origin is **derived** via reference-graph traversal, not manually
  marked. Canonical function: `scripts/lib/origin.mjs:deriveLeafOrigin()`.
  31 of 120 semantic tokens resolve to `brand-poli`; 89 to `base`.
- Validator enforces: (a) every primitive and palette slot must carry a declared origin;
  (b) no semantic token may ref a palette slot without declared origin (unanchored
  graph = extraction miss).

**Dimensional scales — spacing, typography, motion, z-index, border-width**

- `spacing` — 32-step scale, base 4px. Key = multiplier (`spacing.4` = 16px,
  `spacing.0.5` = 2px). Dense at small sizes (half-steps 0.5/1.5/2.5/3.5), then
  whole steps to 12, then skips to 96 (= 384px). Semantic roles in separate top-level
  keys: `inset`, `stack`, `inline`, `section-gap`, `page-margin`.
- `font.size` — 14 raw primitive steps (2xs=11px → 9xl=128px) anchored to the
  Tailwind/Radix type-size convention.
- `font.letter-spacing` — 6 steps in em: tight (−0.05em) → widest (+0.1em).
- Typography composites — 11 semantic slots only (display, h1–h6, body-large, body,
  body-small, caption). Each composite references `{font.size.*}` directly (static).
  Scale names (2xs, 3xl, etc.) are primitive labels, not composite names.
  Figma output: 11 static text styles (was 50 with per-mode duplication).
- `motion.duration` — 5 steps: instant (0ms), fast (150ms), normal (300ms),
  slow (500ms), slower (800ms). DTCG `duration` type.
- `motion.easing` — 3 cubic-bezier curves: ease-out, ease-in, ease-in-out.
  DTCG `cubicBezier` type; CSS emitter wraps in `cubic-bezier(…)`.
- `z-index` — 7 named levels: base (0), raised (1), dropdown (10), sticky (20),
  overlay (30), modal (40), toast (50). DTCG `number` type.
- `border-width` — 3 named widths: hairline (1px), thin (2px), thick (4px).
  DTCG `dimension` type.

**Preview — 4-view structured gallery**

- Palette view: Primitives color ramps (light/dark merged per hue) + Brand palette
  slots grouped by origin (brand-poli vs base).
- Semantic roles view: surface/text/stroke/icon/logo/emphasis color roles.
- Contrast dashboard: WCAG 2.2 AA verdicts on all 326 semantic fg×bg pairs,
  issues-only default, mode-sensitive (light/dark toggle synced).
- Type & Scales view: Typography (all 11 composites with live letter-spacing),
  Font Size Scale (14 steps), Letter Spacing (6 steps), Spacing Scale (32 bars),
  Semantic Spacing Roles, Motion (duration + easing), Z-Index, Border Width,
  Elevation (shadows), Sizing.
- Self-theming: Light/Dark toggle re-themes the page via semantic tokens.

**Declared technical debt — Fase D**

Three refactors bundled for one dedicated iteration (see `ROADMAP.md § Fase D`):

- D1: Fuse `color.<hue>.light.*` / `color.<hue>.dark.*` into a single mode-aware scale.
- D2: Renumber `palette.*` from Tailwind-style to Radix 1-12; rework ~200 semantic refs.
- D3: Extract Poli brand tokens (`magenta`, `bronze`, `pink`, identity palette slots +
  their 31 semantic consumers) from the library into a per-project repo. Script
  selection criterion: `origin === "brand-poli"` via `deriveLeafOrigin()`.

---

## [0.1.0] — 2026-07

Initial release. Modular DTCG source, four-tier architecture (Primitives → Brand →
Semantic → Responsive), dual mode axes (color light/dark, responsive base/md/lg),
CSS custom property output with chained `var()`, Figma variables + text styles export,
Tailwind preset.
