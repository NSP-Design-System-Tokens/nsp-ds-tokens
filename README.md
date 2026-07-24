# nsp-tokens

Code-first design tokens for Neosperience projects. Modular DTCG source is the
single source of truth; one build feeds Figma and the web. No Tokens Studio, no
bidirectional sync, no editing in Figma.

```
tokens/**/*.json  (modular, DTCG)
   │
   ├─ validate ──────► gate: references, mode coverage, naming, types, origins, contrast
   ├─ build:figma ───► dist/figma-variables.json  + dist/figma-styles.json
   ├─ build:css ─────► build/css/tokens.css       + build/tailwind/tokens.cjs
   └─ build:preview ─► build/preview/index.html
```

## Tiers

```
core/        Primitives   raw ramps + dimensions + font atoms      no modes
brand/       Brand        assigns primitives to palette roles       no modes
semantic/    Semantic     roles by function; composites             color modes: light/dark
responsive/  Responsive   type-size, breakpoints                    resp modes: base/md/lg
```

Resolution runs downward only. Semantic reads `palette.*`, never `color.*` directly. The
CSS is fully chained via `var()` so the responsive cascade is automatic.

## Color scales

Two origins, one rule:

| Category         | Origin               | Scales                                       |
| ---------------- | -------------------- | -------------------------------------------- |
| Neutral + states | Radix as-is          | `mauve`, `red`, `green`, `orange`            |
| Brand identity   | Custom, Radix method | `magenta` (Poli); one scale per future brand |

**Radix as-is** — exact hex from `@radix-ui/colors`, light.1-12 + dark.1-12.

**Custom, Radix method** — 12-step OKLCH scale anchored on the brand identity hex at
step 9. Step 9 = exact brand color. See `docs/DESIGN-SYSTEM-GUIDE.md § Color scale sources`
for the generation recipe.

## Palette roles (three actions)

Every brand maps its primitives to these shared roles in `brand/<name>.json`:

| Role                                | Action                                    | Default mapping (Poli) |
| ----------------------------------- | ----------------------------------------- | ---------------------- |
| `palette.primary`                   | Full brand — primary CTAs, key accents    | magenta                |
| `palette.secondary`                 | Brand soft — secondary surfaces           | pink                   |
| `palette.tertiary`                  | Neutral — structural UI (cards, dividers) | mauve                  |
| `palette.accent`                    | Decorative accent                         | bronze                 |
| `palette.neutral`                   | Greyscale ramp                            | mauve                  |
| `palette.error / success / warning` | Status colors                             | red / green / orange   |

Components read only `semantic.*`. They never know which brand is active.

## Mode axes

- **Color**: `light` in `:root`, `dark` as `[data-theme="dark"]` overrides.
- **Responsive**: mobile `base` in `:root`, `min-width` media queries at `breakpoint` widths
  for `md` and `lg`.

## Contrast gate

286 semantic fg×bg pairs evaluated per mode (WCAG 4.5:1 for text, 3:1 for icon/stroke). 0
failures. Allowlist of exemptions (`text.disabled`, `stroke.divider`) is declared with
rationale in `scripts/lib/contrast.mjs`. Gate runs on every build.

## Origin markers

Every color primitive group and every `palette.*` slot carries `$extensions.nsp.origin`:
`"base"` (shared across all brands) or `"brand-poli"` (Poli-specific, future extraction).

Semantic token origin is derived by reference-graph traversal — not manually declared.
Canonical function: `scripts/lib/origin.mjs`. Validator enforces graph integrity on every
build: a palette slot without a declared origin is a build failure.

## Commands

```bash
npm install
npm run validate       # the gate (references, naming, types, origins, contrast)
npm run build          # validate + all outputs
npm run build:figma    # dist/figma-variables.json + dist/figma-styles.json
npm run build:css      # build/css/tokens.css + build/tailwind/tokens.cjs
npm run build:preview  # build/preview/index.html (4-view gallery)
```

## Using the outputs

**Figma**: Figma Tokens Manager → Import Variables → paste `dist/figma-variables.json`;
then Import Styles → paste `dist/figma-styles.json`; then Match Variables to Styles.
Idempotent.

**Frontend**: import `build/css/tokens.css` at the root; toggle color theme with
`data-theme="dark"`; breakpoints apply automatically. Spread `build/tailwind/tokens.cjs`
into `theme.extend`.

## Configuring a new brand

1. Copy `brand/poli.json` → `brand/<name>.json`.
2. Generate a custom 12-step OKLCH scale for the brand identity color (see guide). Add it
   to `core/color.json`. Mark it `$extensions.nsp.origin: "brand-poli"`.
3. Keep `palette.*` role names identical. Repoint `palette.primary` (and optionally
   `palette.secondary`, `palette.accent`) at the new primitives.
4. `palette.neutral`, `palette.error`, `palette.success`, `palette.warning` can reuse the
   shared Radix scales unchanged.
5. `npm run build` — gate must stay green.

Semantic and Responsive tiers stay untouched. Same components, same classes, swapped
palette.

## Preview

`build/preview/index.html` — self-contained 4-view gallery: Palette, Semantic roles,
Contrast dashboard (WCAG verdicts on real token pairs), Typography & Scales. Self-theming:
the Light/Dark toggle re-themes the page via semantic tokens. Resize to see responsive type
scale.
