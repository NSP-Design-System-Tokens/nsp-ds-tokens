# nsp-tokens

Code-first design tokens for Neosperience projects. Modular DTCG source is the
single source of truth in Git. One build feeds Figma and the web. No Tokens Studio,
no bidirectional sync, no editing in Figma.

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

Resolution flows downward only. Semantic reads `palette.*`, never `color.*` directly.
CSS is fully chained via `var()` — the responsive cascade is automatic.

## Color scales

Two origins, one rule:

| Category         | Origin               | Scales                                       |
| ---------------- | -------------------- | -------------------------------------------- |
| Neutral + states | Radix as-is          | `mauve`, `pink`, `red`, `green`, `orange`    |
| Brand identity   | Custom, Radix method | `magenta` (Poli); one scale per future brand |

**Radix as-is** — exact hex from `@radix-ui/colors`, light.1-12 + dark.1-12.

**Custom, Radix method** — 12-step OKLCH scale anchored on the brand identity hex at
step 9. Step 9 = exact brand color. See `docs/DESIGN-SYSTEM-GUIDE.md § Color scale
sources` for the generation recipe.

## Palette roles (three actions)

Every brand maps its primitives to these shared roles in `brand/<name>.json`:

| Role                                | Action                                    | Default (Poli)   |
| ----------------------------------- | ----------------------------------------- | ---------------- |
| `palette.primary`                   | Full brand — primary CTAs, key accents    | magenta          |
| `palette.secondary`                 | Brand soft — secondary surfaces           | pink             |
| `palette.tertiary`                  | Neutral — structural UI (cards, dividers) | mauve            |
| `palette.accent`                    | Decorative accent                         | bronze           |
| `palette.neutral`                   | Greyscale ramp                            | mauve            |
| `palette.error / success / warning` | Status colors                             | red/green/orange |

Components read only `semantic.*`. They never know which brand is active.

## Dimensional scales

| Scale           | Primitive               | Key convention         | Steps |
| --------------- | ----------------------- | ---------------------- | ----- |
| Spacing         | `spacing.*`             | Multiplier (×4px base) | 32    |
| Font size       | `font.size.*`           | 2xs → 9xl              | 14    |
| Letter spacing  | `font.letter-spacing.*` | tight → widest (em)    | 6     |
| Motion duration | `motion.duration.*`     | instant → slower       | 5     |
| Motion easing   | `motion.easing.*`       | ease-out/in/in-out     | 3     |
| Z-index         | `z-index.*`             | base → toast           | 7     |
| Border width    | `border-width.*`        | hairline/thin/thick    | 3     |

Spacing key = multiplier, not px. `spacing.4` = 4×4px = 16px; `spacing.0.5` = 2px.

Typography composites (11 semantic slots): `display`, `h1`–`h6`, `body-large`,
`body`, `body-small`, `caption`. Each references a `font.size.*` primitive directly
(static, no responsive modes). All include `letterSpacing`.

## Mode axes

- **Color**: `light` in `:root`, `dark` as `[data-theme="dark"]` overrides.
- **Responsive**: mobile `base` in `:root`, `min-width` media queries at `breakpoint`
  widths for `md` and `lg`.

## Contrast gate

326 semantic fg×bg pairs evaluated per mode (WCAG 4.5:1 for text, 3:1 for
icon/stroke). 0 failures. Allowlist of exemptions (`text.disabled`, `stroke.divider`)
declared with rationale in `scripts/lib/contrast.mjs`. Gate runs on every build.

## Origin markers

Every color primitive group and every `palette.*` slot carries
`$extensions.nsp.origin`: `"base"` (shared across brands) or `"brand-poli"`
(Poli-specific, future extraction).

Semantic token origin is derived by reference-graph traversal — not manually declared.
Canonical function: `scripts/lib/origin.mjs`. 31 of 120 semantic tokens resolve to
`brand-poli`; 89 to `base`. Validator enforces graph integrity on every build.

## Commands

```bash
npm install
npm run validate       # gate (references, naming, types, origins, contrast)
npm run build          # validate + all outputs
npm run build:figma    # dist/figma-variables.json + dist/figma-styles.json
npm run build:css      # build/css/tokens.css + build/tailwind/tokens.cjs
npm run build:preview  # build/preview/index.html (4-view gallery)
```

## Using the outputs

**Figma**: Figma Tokens Manager → Import Variables → paste `dist/figma-variables.json`;
Import Styles → paste `dist/figma-styles.json`; Match Variables to Styles. Idempotent.

**Frontend**: import `build/css/tokens.css` at root; toggle color with
`data-theme="dark"`; breakpoints apply automatically. Spread
`build/tailwind/tokens.cjs` into `theme.extend`.

**CSS spacing**: `var(--spacing-4)` = 16px, `var(--spacing-0\.5)` = 2px.
**CSS layout roles**: `var(--inset-md)`, `var(--stack-lg)`, `var(--page-margin-md)`.

## Configuring a new brand

1. Copy `brand/poli.json` → `brand/<name>.json`.
2. Generate a custom 12-step OKLCH scale for the brand identity color (see guide).
   Add it to `core/color.json`. Mark it `$extensions.nsp.origin: "brand-<name>"`.
3. Keep `palette.*` role names identical. Repoint `palette.primary` (and optionally
   `palette.secondary`, `palette.accent`) at the new primitives.
4. `palette.neutral`, `palette.error`, `palette.success`, `palette.warning` reuse the
   shared Radix scales unchanged.
5. `npm run build` — gate must stay green.

Semantic and Responsive tiers stay untouched. Same components, same classes, swapped
palette.

## Preview

`build/preview/index.html` — self-contained 4-view gallery:

- **Palette** — color ramps (light/dark merged) + palette slots grouped by origin
- **Semantic** — color roles (surface/text/stroke/icon/logo/emphasis)
- **Contrast** — WCAG 2.2 AA verdicts on all 326 fg×bg pairs, issues-only default
- **Type & Scales** — typography composites, font size + spacing + motion + z-index

Self-theming: Light/Dark toggle re-themes via semantic tokens.
