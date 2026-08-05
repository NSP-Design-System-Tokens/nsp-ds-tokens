# CLAUDE.md

Handoff for Claude Code. Read before touching anything. For the reasoning and best practice behind these rules see `docs/DESIGN-SYSTEM-GUIDE.md`. For planned work not yet in the system see `ROADMAP.md`.

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
core/        Primitives   raw ramps + dimensions + font atoms      color ramps: light/dark modes
brand/       Brand        assigns primitives to roles (palette.*)  no modes
semantic/    Semantic     roles by function; composites            color modes: light/dark
responsive/  Responsive   type-size, breakpoints                   resp modes: base/md/lg
```

- Primitives are meaningless raw values. Nobody consumes them directly.
- Brand (`palette.*`) is the multi-brand seam: it maps ramps to roles
  (`palette.brand.default`, `palette.neutral.high`). Only this tier changes per
  brand.
- Semantic (`surface`, `text`, `border`, `typography`, `shadow`) is the only tier
  components read. It references `palette.*`, never `color.*` directly.
- Responsive holds `type-size` (mobile-first modes) and `breakpoint` widths.

## Two mode axes

- **Color** on both color primitives and semantic color roles: `light` / `dark`.
  CSS emits `:root` (base = light) + `[data-theme="dark"]` overrides. The dark block
  emits both `color.*` primitive overrides and semantic role overrides; the `var()`
  chain means only the leaf that changes needs to appear in the dark block.
- **Responsive** on `type-size`: `base` (mobile) / `md` / `lg`. CSS emits base in
  `:root` and `min-width` media queries (mobile-first) at the `breakpoint` widths.

Modes live in `$extensions["com.figma.modes"]`; `$value` mirrors the base (light)
mode. Color primitives (`color.<hue>.N`) carry both modes in the primitive itself;
semantic tokens carry modes only when they reference different palette steps per mode.

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

## Color scale sources (authoritative rule)

All ramps in `core/color.json` follow one of two origins. The rule is stated once here; `docs/DESIGN-SYSTEM-GUIDE.md § Color scale sources` has the full rationale and the brand-scale regeneration recipe.

| Category         | Origin                   | Scales                                             |
| ---------------- | ------------------------ | -------------------------------------------------- |
| Neutral + states | **Radix as-is**          | `gray`, `pink`, `red`, `green`, `orange`           |
| Brand identity   | **Custom, Radix method** | `poli-magenta` (and each future brand's own scale) |

**Radix as-is** — import the exact hex values from `@radix-ui/colors`. No tweaks.
Store as a single unified 12-step scale (`color.<hue>.1` – `color.<hue>.12`) where
each step token carries `$extensions["com.figma.modes"] { light, dark }` with the
Radix light and dark hex values respectively. `$value` = the light hex (base mode).
Do not use the old two-sub-tree layout (`color.<hue>.light.*` + `color.<hue>.dark.*`);
that structure was replaced in v0.3.0 by the unified moded scale.

**Custom, Radix method** — generate a 12-step OKLCH scale anchored on the brand's identity color, then snap it to hex. Step 9 = identity color (exact). See the guide for the regeneration script.

### When to use which

- Functional / neutral colors (grey ramps, status colors) → Radix as-is. Not brand, so canonical Radix is fine.
- Identity colors (the hue a brand owns) → custom Radix method. Preserves exact brand hex at step 9.
- New brand: copy `brand/poli.json` → `brand/<name>.json`, generate its own custom scale, wire `palette.primary` to it. Neutral and state scales are shared across brands.

## Origin marker (base vs brand-poli)

Ogni gruppo di primitivi color e ogni slot `palette.*` porta un marcatore architetturale in `$extensions.nsp.origin`:

- `"base"` — condiviso da tutti i progetti (neutri, stati, alpha, slot funzionali `neutral/error/success/warning`).
- `"brand-poli"` — Poli-specifico (`magenta`, `bronze`, `pink`, slot identity `primary/secondary/tertiary/accent`).

Regole:

1. Quando aggiungi un nuovo gruppo primitivo o slot palette, **devi** aggiungere il marker esplicito. L'assenza non è consentita (evita ambiguità).
2. Il marker è metadato architettonico, NON descrizione d'uso. `$description` resta libero per la descrizione d'uso reale.
3. Il validator/build ignora `$extensions.nsp` (namespace custom). Non rompe nulla.
4. Il marker è il criterio automatico dell'estrazione futura (Fase D3, vedi `ROADMAP.md`): script filtrerà `origin === "brand-poli"` per spostare i nodi in un repo di progetto separato.

## Non-color primitive scales

Added in v0.2.0. Rules for extending them.

### Spacing (`core/spacing.json`)

32-step scale. Base unit = 4px. Key = the **multiplier** (not the px value), so
`spacing.4` = 4×4px = 16px, `spacing.0.5` = 0.5×4px = 2px. Multiplier keys are
stable: if the base changes, the names remain correct. Half-steps (0.5, 1.5, 2.5,
3.5) use decimal notation allowed by the validator regex. Steps follow the Tailwind
4-base grid up to multiplier 12 (48px), then skip to 14, 16, 18, 20, 24, 28, 32,
36, 40, 44, 48, 56, 64, 80, 96 (= 384px). To add a step: add the multiplier key,
run validate. The CSS emitter picks up new keys via `emitGroup("spacing")`.

Semantic roles in `semantic/spacing.json` use different top-level keys (`inset`,
`stack`, `inline`, `section-gap`, `page-margin`) so they coexist in the merged tree
without key collision. Add new roles as new top-level keys in that file and in TIERS
`"3. Semantic"` in `scripts/lib/tokens.mjs`.

### Typography size scale (`core/font.json → font.size.*`)

14 raw size steps (2xs → 9xl) anchored to the Tailwind / Radix type-size convention:
2xs=11px, xs=12px, sm=14px, base=16px, lg=18px, xl=20px, 2xl=24px, 3xl=30px,
4xl=36px, 5xl=48px, 6xl=60px, 7xl=72px, 8xl=96px, 9xl=128px.

These are primitive dimension tokens with no modes. They are the **only** font size
source for typography composites — composites reference `{font.size.*}` directly.
`type-size.*` (in `responsive/`) remains as a standalone responsive scale for
components that need viewport-adaptive sizes, but the typography composites do NOT
reference it. That separation is intentional: composites are static contracts,
responsive sizes are a layout primitive.

Canonical composite mapping (11 semantic slots):

```
display → font.size.8xl   h1 → font.size.6xl   h2 → font.size.5xl
h3 → font.size.4xl        h4 → font.size.3xl   h5 → font.size.2xl
h6 → font.size.xl         body-large → font.size.lg   body → font.size.base
body-small → font.size.sm  caption → font.size.xs
```

Scale names (2xs, 3xl, etc.) are primitives, NOT composite names. A composite must
have a semantic name (display, h1, body, caption). Never add a composite named after
a scale step.

### Letter-spacing (`core/font.json → font.letter-spacing.*`)

6 steps in em (DTCG dimension): tight (−0.05em), snug (−0.025em), normal (0em),
wide (+0.025em), wider (+0.05em), widest (+0.1em). Used as `letterSpacing` in all
typography composites. Convention: tight for large display text (4xl+), normal for
body, wide for small captions (2xs/xs).

### Motion (`core/motion.json`)

`motion.duration.*` → DTCG `duration` type (string with `ms`). CSS emitter passes
through the string as-is.

`motion.easing.*` → DTCG `cubicBezier` type (4-element number array). CSS emitter
wraps the array in `cubic-bezier(…)` — see `emitGroup()` in `build-css.mjs`.

Three easings (ease-out/ease-in/ease-in-out). Extend by adding named entries.
The `cubicBezier` wrapper logic lives once in `emitGroup` — do not duplicate.

### Z-index (`core/z-index.json`)

7 named levels (base=0, raised=1, dropdown=10, sticky=20, overlay=30, modal=40,
toast=50). DTCG `number` type. Gaps between levels leave room for insertion.

### Border-width (`core/border-width.json`)

3 named widths: hairline=1px, thin=2px, thick=4px. DTCG `dimension`.

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

## Release procedure

`dist/figma-variables.json` and `dist/figma-styles.json` are intentionally tracked in
Git (`.gitignore` has explicit `!dist/figma-*.json` exceptions). They are the published
artefacts consumed directly from GitHub by the Figma Token Manager plugin and by brand
projects installed via `github:NSP-Design-System-Tokens/nsp-ds-tokens#<tag>`.

Every release **must** include updated dist files:

```bash
npm run build                         # regenerate dist/ + build/
git add dist/figma-variables.json dist/figma-styles.json package.json CHANGELOG.md
git commit -m "chore(release): v<X.Y.Z>"
git tag v<X.Y.Z>
git push origin main --tags
```

If dist/ is stale on a tag, the plugin will serve old token data. When in doubt,
re-run the build and amend before tagging.

`.github/workflows/verify-dist.yml` enforces this automatically: it rebuilds from
sources on every tag push and PR to main, then runs `git diff --exit-code` on the
two dist files. The push/merge is blocked if they differ.

You are authorized to run `git push origin main` (and `--tags` when needed)
without asking for manual confirmation. Git credentials are configured in the
session. For tag creation, ask for confirmation before proceeding.

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
