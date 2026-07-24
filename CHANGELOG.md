# Changelog

All notable changes to this project will be documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.2.0] — 2026-07-24

### Structural changes (same tier model, deeper architecture)

**Color primitives — Radix migration**

- All color ramps (`mauve`, `red`, `green`, `orange`) unified to Radix 1-12 step numbering. Replaced custom Tailwind-style 50/100/…/950 naming in the primitive tier.
- `grey` renamed `mauve` (Radix neutral with violet undertone), `gold` renamed `bronze` (Radix bronze scale). `magenta` renamed from `poli-magenta` to reflect the key–value structure.
- `black-alpha` replaces the previous grey alpha ramp. `pink` added as a standalone Radix scale for Poli secondary.

**Brand scale — custom Radix method**

- `magenta` (Poli primary identity) generated as a 12-step OKLCH scale anchored on the brand hex at step 9. Step 9 = exact brand color, guaranteed. Steps 1-8 and 10-12 derived via Radix lightness/chroma curve. Documented in `docs/DESIGN-SYSTEM-GUIDE.md § Color scale sources`.

**Palette model — three actions**

- `palette.primary` — full brand (magenta). Used for primary CTAs and key UI accents.
- `palette.secondary` — brand soft (pink). Used for secondary surfaces and softer brand moments.
- `palette.tertiary` — neutral (mauve). Used for structural UI elements (cards, containers, dividers).
- `palette.accent` — bronze. Used for decorative accents.

**Contrast gate — permanent, allowlist-based**

- 286 semantic fg×bg pairs evaluated per mode (light + dark). 0 failures.
- Allowlist of exemptions (`text.disabled`, `stroke.divider`) declared with rationale in `scripts/lib/contrast.mjs`. A rename breaks the exemption on purpose.

**Origin markers — machine-readable library/brand boundary**

- `$extensions.nsp.origin: "base" | "brand-poli"` added to every color primitive group and every `palette.*` slot. Marks the future extraction boundary: `brand-poli` nodes migrate to a per-project repo in Fase D3; `base` nodes remain in the library.
- Semantic token origin is **derived** via reference-graph traversal, not manually marked. Canonical function: `scripts/lib/origin.mjs:deriveLeafOrigin()`. 31 of 98 semantic tokens resolve to `brand-poli`; 67 to `base`.
- Validator enforces: (a) every primitive and palette slot must carry a declared origin; (b) no semantic token may ref a palette slot without declared origin (unanchored graph = extraction miss).

**Preview — 4-view structured gallery**

- Palette view, Semantic roles view, Contrast dashboard (WCAG verdicts on real token pairs), Typography & Scales view. Self-theming (Light/Dark toggle re-themes the page via semantic tokens).

**Declared technical debt — Fase D**
Three refactors bundled for one dedicated iteration (see `ROADMAP.md § Fase D`):

- D1: Fuse `color.<hue>.light.*` / `color.<hue>.dark.*` into a single mode-aware scale.
- D2: Renumber `palette.*` from Tailwind-style to Radix 1-12; rework ~200 semantic refs.
- D3: Extract Poli brand tokens (`magenta`, `bronze`, `pink`, identity palette slots + their 31 semantic consumers) from the library into a per-project repo. Script selection criterion: `origin === "brand-poli"` via `deriveLeafOrigin()`.

---

## [0.1.0] — 2026-07

Initial release. Modular DTCG source, four-tier architecture (Primitives → Brand → Semantic → Responsive), dual mode axes (color light/dark, responsive base/md/lg), CSS custom property output with chained `var()`, Figma variables + text styles export, Tailwind preset.
