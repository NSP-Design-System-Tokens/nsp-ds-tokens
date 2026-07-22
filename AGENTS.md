# Repository Guidelines

## Project Structure & Module Organization

Code-first design tokens. Single source of truth: `source.tokens.json`. Generated files are downstream — never edit them.

```
source.tokens.json          <- single source of truth ($collections, OKLCH, raw numbers)
        |
        |-- build:figma  --------> dist/figma-import.json     (hex, sRGB, unitless)
        |
        |-- build:sd-input ------> build/sd/*.tokens.json      (DTCG, split by mode)
                                        |
                                        +-- build:css --------> build/css/tokens.css
                                                                build/tailwind/tokens.cjs
```

Two token layers inside `source.tokens.json`:

- **Primitives** collection: raw scales, no semantic meaning (`color.orange.500`, `spacing.md`)
- **Semantic** collection: role aliases that reference primitives (`surface.brand`, `text.default`), with `Light`/`Dark` modes via `$extensions["com.figma.modes"]`

Components (Figma or frontend) consume Semantic only, never Primitives directly.

## Build Commands

> **Note:** `package.json` is not yet present. The commands below are the intended interface once the build system is wired up.

```bash
npm install
npm run build          # all three steps
npm run build:figma    # dist/figma-import.json  (hex, for Figma Tokens Manager plugin)
npm run build:sd-input # build/sd/*.tokens.json  (DTCG, per mode)
npm run build:css      # build/css/tokens.css + build/tailwind/tokens.cjs

CHAIN=1 npm run build  # semantic tokens reference primitives via var() instead of inlining
```

## Authoring Conventions

**Colors**: always OKLCH strings in the source (`oklch(L C H)`). The Figma adapter converts to hex with chroma clamp. The CSS adapter keeps OKLCH. Never hardcode hex in `source.tokens.json`.

**Numbers**: raw unitless values in the source. The SD adapter adds `px` to `spacing`, `radius`, and `font-size` only. Do **not** add units to `line-height`, `font-weight`, or `opacity`.

**Aliases**: use `{dot.path}` notation (e.g. `{color.orange.500}`). Collection name is dropped safely because resolution is by trailing path.

**Color scales**: 11 stops — `50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950`. Hue roughly constant, lightness descending, chroma peaking mid-range. Verify perceptual evenness.

**Semantic role names** (`surface.brand`, `text.default`, etc.) are stable across brands — never rename without checking all consumers.

## Adding a Brand

Preferred for agency clients: copy `source.tokens.json` to a per-brand file, keep `Semantic` keys identical, change only primitive values and aliases, wire separate build targets (`dist/figma-import.<brand>.json`, `build/css/<brand>/tokens.css`). Do not collapse into a Brand mode unless brands must coexist in one Figma document.

## What Not to Do

- Never edit files under `build/` or `dist/` — fix the source and rebuild
- Do not introduce Tokens Studio or its set/theme files
- Do not add a color transform to the SD build (OKLCH must survive into CSS)
- Do not add units to `line-height`, `font-weight`, or `opacity` in the source
