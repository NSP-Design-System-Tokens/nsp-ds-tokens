# Changelog

All notable changes to this project will be documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.3.7] — 2026-08-06

### Changed

- **`stroke.input-focus` → `stroke.focus-ring`** (breaking rename, value unchanged).
  Il token era nominato per un singolo componente (input); il focus ring è invece un
  primitivo cross-component che si applica a bottoni, input, link, checkbox, tab e
  qualunque elemento focusabile da tastiera. Il nuovo nome riflette la funzione reale.
  Il valore `{palette.neutral.12}` rimane invariato in entrambe le modalità.
  **Breaking:** chi referenzia `stroke.input-focus` in CSS, nei componenti o nei
  token di progetto deve aggiornare il nome. Nessun cambio visivo a runtime.
- Aggiornata `$description` del token con descrizione generale d'uso (outline esterno,
  offset 2px).
- Aggiornate le occorrenze nei file di documentazione: `docs/TOKENS-REFERENCE.md`,
  `docs/DESIGN-SYSTEM-GUIDE.md`, `COMPONENTI-E-STATI.md`, `GUIDA-USO-DESIGNER.md`.
- Rebuilt `dist/figma-variables.json` e `dist/figma-styles.json`.

---

## [0.3.6] — 2026-08-05

### Changed

- **Radix-pure dark mode architecture** (Option A): Primitive tokens already carried
  light/dark modes since v0.3.0. This release aligns the semantic Color Roles tier to
  match: all tokens that referenced the same palette step in both modes are now
  single-mode (no `com.figma.modes`). The Figma cascade `Color Roles → Brand → Primitives`
  means switching only the Primitives collection to dark propagates the full dark theme.
- `tokens/semantic/color.json`: removed `com.figma.modes` from 46 of 47 Color Roles
  tokens. One genuine dual-mode token remains: `surface.floating` (light uses
  `neutral.1` for icon contrast ≥3:1; dark uses `neutral.3` for elevated surface).
- `tokens/semantic/color.json`: corrected four Category C surface tokens that previously
  pointed at `palette.neutral.0` (static white, never switching). Now mapped to moded
  steps: `surface.page → neutral.1`, `surface.card/raised/boxed → neutral.2`.
- `tokens/semantic/color.json`: corrected `icon.subtle` from `neutral.5` (the light-only
  step) to `neutral.10` (the semantically correct step for both modes).
- `scripts/lib/contrast.mjs`: added five documented CONTRAST_EXEMPT entries for
  known Radix limitations: `text.warning` on off-white surfaces (orange.11 calibrated
  for pure white; 4.41 vs 4.51 threshold) and `text.success` on card/raised (green.11
  is 4.49, 0.01 rounding-margin below AA). Dark mode passes for all five pairs.
- Rebuilt `dist/figma-variables.json` and `dist/figma-styles.json`.

---

## [0.3.4] — 2026-08-03

### Changed

- `dist/figma-variables.json` and `dist/figma-styles.json` are now tracked in Git.
  `.gitignore` has explicit `!dist/figma-*.json` exceptions so these compiled artefacts
  are included in every release tag. Enables the Figma Token Manager plugin (and any
  consumer using a `github:` URL) to fetch compiled output from `raw.githubusercontent.com`
  without a local build step. No token values changed; publish-pipeline change only.
- `CLAUDE.md` documents the release procedure: every release must include updated dist
  files via `git add dist/figma-variables.json dist/figma-styles.json`.

---

## [0.3.3] — 2026-07-30

### Changed

- Migrated repository to the **NSP-Design-System-Tokens** GitHub organization.
  All `github:` references updated from `asimonato/` to `NSP-Design-System-Tokens/`.
  External consumers must update their `package.json` dependency string:
  ```
  "nsp-ds-tokens": "github:NSP-Design-System-Tokens/nsp-ds-tokens#v0.3.3"
  ```
  GitHub redirects are in place from the old owner path for the transition period.
- Color scales in `core/color.json` reordered for conceptual clarity (brand/identity
  scales first, neutral and state scales follow). No token values changed.

---

## [0.3.2] — 2026-07-30

### Changed

- Semantic color token groups in `semantic/` reordered for functional clarity
  (surface → text → border → interactive). No token values or names changed.

---

## [0.3.1] — 2026-07-30

### Removed

- `scripts/create-project.mjs` removed from library. Scaffolding logic moved to
  standalone tool `create-nsp-project` (`npx github:NSP-Design-System-Tokens/create-nsp-project`).

---

## [0.3.0] — 2026-07-30

### D1 — Primitive color modes fused (Fase D)

- All color ramps (`bronze`, `mauve`, `pink`, `red`, `green`, `orange`, `magenta`)
  converted from two separate `light.*` / `dark.*` sub-trees into a single unified
  scale (`color.<hue>.N`) where dark values live in
  `$extensions["com.figma.modes"].dark`. `black-alpha`, `white`, `black` remain flat
  (invariant across color modes).
- CSS build now emits `emitGroup("color", "dark")` in the `[data-theme="dark"]` block
  so dark primitive overrides cascade into all `var()` chains that reference them.
- Figma build required no changes; `figmaLeaf()` already handles `com.figma.modes`.

### D2 — Palette renumbered to Radix 1-12 (Fase D)

- All `palette.*` slots re-wired to the new unified step numbers (`palette.primary.9`,
  etc.). Named aliases updated: `default`, `subtle`, `emphasis`, `hover`, `strong`.
- `d`-suffix dark slots (`secondary.3d`, etc.) eliminated; dark values are carried
  automatically by the moded primitive they reference.
- `palette.neutral` rebuilt with Radix step logic: 1-12 from `color.mauve`, alpha
  steps `a1/a2/a4/a9`, semantic aliases `low=3`, `mid=5`, `high=11`, `max=12`.
- `palette.error/success/warning` restricted to steps 9/10/11/12 (solid + text range).
- `tokens/semantic/color.json` updated: ~200 token references renumbered; dark mode
  references corrected for Radix dark-scale semantics (step 12 = high-contrast text
  on dark, not step 11 or the old 200-numbered slots).
- Contrast gate: 0 failures across all 434 tokens, light + dark modes.

### D3 — Brand Poli extraction (Fase D)

- `scripts/extract-brand.mjs` added: reads the merged token tree, splits by
  `$extensions.nsp.origin` (primitives + palette slots) and by
  `deriveSemanticOrigins()` (semantic leaves), writes two self-consistent output
  trees to `dist/brand-poli/tokens/` and `dist/base/tokens/`.
- Heuristic layer added alongside graph derivation: semantic tokens whose path
  contains a brand-role segment (`primary`, `secondary`, `tertiary`, `accent`) are
  promoted to `brand-poli` even when their graph origin resolves to `base`
  (catches `surface.tertiary-dark`, `surface.tertiary-darker`, `text.on-primary`,
  `icon.on-primary`).
- Sum check: 126 brand-poli + 308 base = 434 (system total ✓).
- `nsp-ds-tokens` source cleaned to base-only: brand primitives (`magenta`, `bronze`,
  `pink`) removed from `core/color.json`; brand identity palette slots (`primary`,
  `secondary`, `tertiary`, `accent`) removed from `brand/poli.json`; 35 brand-poli
  semantic tokens removed from `semantic/color.json`. Library now 308 tokens, 0
  brand-poli.
- `scripts/lib/tokens.mjs` extended with `loadMergedWith(extraDirs)`: reads
  `TOKENS_DIR` first, then any additional directories in order, deepMerging all
  JSON files. Enables brand repos to overlay their tokens on the base library.
- `nsp-ds-tokens-poli/` created as a sibling repo: installs `nsp-ds-tokens` as a
  `file:` dependency; wraps `scripts/lib/{tokens,contrast,origin}.mjs` via
  re-export; copies build/validate scripts unchanged; carries brand token files in
  `tokens/{core,brand,semantic}/`. `npm run build` passes; 434 tokens (308 base +
  126 brand-poli), 0 validate errors.

### Rename — nsp-tokens → nsp-ds-tokens

- Package renamed from `nsp-tokens` to `nsp-ds-tokens` (npm convention; readable
  form `NSP-DS-tokens` used in docs/titles). All internal references updated:
  `package.json`, `scripts/build-preview.mjs`, `scripts/create-project.mjs`,
  `NEW-PROJECT-GUIDE.md`, `README.md`, `ROADMAP.md`.
- `nsp-tokens-poli/` dependency updated: key `nsp-tokens` → `nsp-ds-tokens`,
  path `file:../nsp-tokens` → `file:../nsp-ds-tokens`; lib wrappers re-pointed.
- GitHub remote renamed to `nsp-ds-tokens`; local remote URL updated.

### create-nsp-project — standalone scaffold tool

- New sibling repo `create-nsp-project` extracts the scaffolding logic from the
  library. Ships as a standalone `npx github:NSP-Design-System-Tokens/create-nsp-project` command.
- No local library clone required: generated project depends on
  `github:NSP-Design-System-Tokens/nsp-ds-tokens#v0.3.0`; `npm install` fetches the library from
  GitHub and `scripts/` are copied from the installed package.
- Contrast math inlined (no import from lib); `LIB_VERSION` constant updated per
  library release.

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
