# nsp-tokens

Code-first design tokens. Modular DTCG source is the single source of truth; one
build feeds Figma and the web. No Tokens Studio, no bidirectional sync.

```
tokens/**/*.json  (modular, DTCG)
   │
   ├─ validate ──────► gate: references, mode coverage, naming, types
   ├─ build:figma ───► dist/figma-variables.json  + dist/figma-styles.json
   ├─ build:css ─────► build/css/tokens.css       + build/tailwind/tokens.cjs
   └─ build:preview ─► build/preview/index.html
```

## Tiers

1. **Primitives** (`core/`) — raw ramps, dimensions, font atoms. No meaning.
2. **Brand** (`brand/`) — `palette.*` roles mapping primitives to brand slots.
   The multi-brand seam: only this tier changes per client.
3. **Semantic** (`semantic/`) — `surface`, `text`, `border`, plus `typography`
   and `shadow` composites. The only tier components consume. Color modes
   (light/dark) live here.
4. **Responsive** (`responsive/`) — `type-size` (mobile-first) and `breakpoint`
   widths.

Resolution runs downward only; the CSS is fully chained so the structure is
visible and responsive sizes cascade.

## Two mode axes

- **Color**: `light` in `:root`, `dark` as `[data-theme="dark"]` overrides.
- **Responsive**: mobile `base` in `:root`, `min-width` media queries at the
  `breakpoint` widths for `md` and `lg`.

## DTCG + composites

Full DTCG typing in the source. `typography` and `shadow` are composite tokens:
CSS expands typography into `--typography-<name>-font-*` (font-size chained to the
responsive `type-size`), and emits `shadow` as a `box-shadow`. Typography also
becomes Figma text styles, one per breakpoint, in `figma-styles.json`.

## Commands

```bash
npm install
npm run validate       # the gate
npm run build          # validate + all outputs
npm run build:figma    # variables + styles
npm run build:css      # css + tailwind preset
npm run build:preview  # visual gallery
```

## Using the outputs

**Figma**: Figma Tokens Manager → Import Variables, paste
`dist/figma-variables.json`; then Import Styles, paste `dist/figma-styles.json`;
then Match Variables to Styles to bind them. Idempotent.

**Frontend**: import `build/css/tokens.css` at the root; toggle color theme with
`data-theme="dark"`; breakpoints apply automatically. Spread
`build/tailwind/tokens.cjs` into `theme.extend`.

## Preview

`build/preview/index.html` is a self-contained gallery: palette, brand slots,
semantic roles, typography composites rendered as live text, shadows, sizing. It
themes itself with the semantic tokens, so the Light/Dark button re-themes the
page. Resize the window to see the responsive type scale.

## Adding a brand

Copy `brand/poli.json`, keep the `palette.*` role names, repoint them at the new
primitives. Semantic and Responsive stay identical.
