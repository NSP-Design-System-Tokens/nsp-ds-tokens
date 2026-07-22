# CLAUDE.md

Handoff for Claude Code. Read before touching anything.

## What this is

Code-first design tokens for Neosperience projects. Modular DTCG source is the
single source of truth in Git. One build produces Figma inputs and web outputs.
No Tokens Studio, no bidirectional sync, no editing in Figma.

## Golden rules

1. `tokens/**/*.json` is the only place tokens are authored. Never edit `build/`
   or `dist/`.
2. `npm run validate` must pass. The build runs it first and fails on any error.
3. Resolution flows downward only. A tier never references a tier above it.

## Tiers (bottom to top)

```
core/        Primitives   raw ramps + dimensions + font atoms      no modes
brand/       Brand        assigns primitives to roles (palette.*)  no modes
semantic/    Semantic     roles by function; composites            color modes: light/dark
responsive/  Responsive   type-size, breakpoints                    resp modes: base/md/lg
```

- Primitives are meaningless raw values. Nobody consumes them directly.
- Brand (`palette.*`) is the multi-brand seam: it maps ramps to roles
  (`palette.brand.default`, `palette.neutral.high`). Only this tier changes per
  brand.
- Semantic (`surface`, `text`, `border`, `typography`, `shadow`) is the only tier
  components read. It references `palette.*`, never `color.*` directly.
- Responsive holds `type-size` (mobile-first modes) and `breakpoint` widths.

## Two mode axes

- **Color** on semantic color roles: `light` / `dark`. CSS emits `:root` +
  `[data-theme="dark"]` overrides.
- **Responsive** on `type-size`: `base` (mobile) / `md` / `lg`. CSS emits base in
  `:root` and `min-width` media queries (mobile-first) at the `breakpoint` widths.

Modes live in `$extensions["com.figma.modes"]`; `$value` mirrors the base mode.

## Full DTCG typing

Author with real `$type`: `color`, `dimension` (string with unit, e.g. `"16px"`),
`fontFamily`, `fontWeight`, `number`, `typography` (composite), `shadow`
(composite). The Figma adapter downgrades to what Figma allows (dimension ->
unitless number, composites -> styles). Do not let Figma's limits shape the
source.

## Composites

- `typography` bundles fontFamily / fontWeight / fontSize / lineHeight as refs.
  CSS expands each into `--typography-<name>-font-*`. `font-size` references the
  `type-size` token, so the responsive cascade is automatic. Figma cannot hold a
  composite, so the Figma adapter emits one text style per responsive mode
  (`Display/Base`, `Display/Md`, `Display/Lg`) into `figma-styles.json`.
- `shadow` bundles color/offset/blur/spread. CSS emits a `box-shadow` string.
  Figma effect styles are not imported by the plugin, so shadow is web-only for
  now; expose decomposed number/color variables if Figma needs them.

## Color space

Existing brand palettes stay in exact hex. New palettes may be authored in OKLCH;
the Figma adapter converts them to hex (sRGB) while CSS keeps OKLCH. Existing hex
is never round-tripped through OKLCH.

## Chaining

The CSS is always chained: every tier references the one below via `var()`. This
keeps the structure visible and is required for the responsive cascade. Do not
add an inline mode; it would break the cascade.

## Build

```bash
npm install
npm run validate   # gate: references, mode coverage, naming, types
npm run build      # validate + figma + css + preview
```

Outputs: `dist/figma-variables.json`, `dist/figma-styles.json`,
`build/css/tokens.css`, `build/tailwind/tokens.cjs`, `build/preview/index.html`.

## The validator is the contract

`scripts/validate.mjs` fails the build on: dangling `{references}`, a moded token
missing a mode its axis requires, names that are not lower kebab-case, unknown
`$type`. When you add tokens, keep it green. Extend the checks rather than
loosening them.

## Adding a brand

Copy `brand/poli.json` to `brand/<name>.json`, keep `palette.*` role names
identical, point them at the new brand's primitives. Semantic and Responsive stay
untouched. Wire per-brand build targets. Same components, same classes, swapped
palette.

## Scaling from the example

The source is a compact, faithful slice of the real Poli tokens. To full size:
add the remaining palette families and stops in `core/color.json`, the full
`palette.*` roles, the complete semantic roles, and more typography/shadow
composites. Keep every rule above and keep the validator green.

## Do not

- Introduce Tokens Studio or any Figma-first sync.
- Reference a primitive from a component or a semantic-from-primitive shortcut.
- Round-trip existing hex through OKLCH.
- Edit generated files, or loosen the validator to make a build pass.
