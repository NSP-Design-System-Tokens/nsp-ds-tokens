# Design system guide

Opinionated best practices for this token system. Not academic: concrete
defaults with the reasoning, so decisions are made once and reused.

## 1. The tier model (settled)

Four resolution tiers, one-directional:

- **Primitives** — raw ramps and raw scales. No meaning. Never consumed directly.
- **Palette / decision** — assigns primitives to functional roles. The
  per-brand seam.
- **Semantic** — roles by function and state. The only tier product code reads.
- **Component** — thin, only for genuine divergence. Kept minimal on purpose.

The rule that keeps it alive: a component never reads a primitive, and semantic
never reads a primitive. Enforce it in CI, not in code review.

## 2. Color

### Ramps

Author perceptual ramps in OKLCH: constant hue, lightness descending evenly,
chroma peaking mid-ramp. 11 stops (50–950) is the interoperable default (Tailwind,
Radix, Material all land near it). OKLCH matters for accessibility: lightness maps
to perceived contrast, so an even L step is an even contrast step.

Keep only the ramps a role actually uses, plus full ramps for anything that needs
interaction states. Decorative one-offs live in a Figma palette library, not in
tokens.

### Functional color roles (the decision tier)

A complete system names these role families, each backed by a ramp:

- `brand` / `primary` — the identity color
- `secondary` — supporting identity (optional)
- `accent` — a highlight distinct from brand (optional)
- `neutral` — the gray ramp, the workhorse (surfaces, text, borders)
- status: `success`, `warning`, `error` (`danger`), `info`

Status colors are not optional in a product UI: forms, toasts, and validation
need them. Keep their ramps full even if today you use three stops; states arrive.

### Interaction states: the answer to "accent with only default/dark?"

Two stops is not enough. An **interactive** color role needs a full state set,
because a button, link, or chip built on it will need every state. The template:

- `default` — resting fill
- `hover`
- `active` (pressed)
- `disabled`
- `subtle` — low-emphasis background (tint) of the same role
- `on-<role>` — the text/icon color that sits ON the role fill (for contrast)
- `emphasis` — a stronger variant when needed

So `accent` should be `accent.default / hover / active / subtle / on-accent`, not
`default / dark`. "dark" is a value description, not a role: it tells you what the
color looks like, not what it is for. Name by intent, never by appearance. The
same template applies to brand, and to any status color used as a fill.

The `on-<role>` suffix is the key: `text.on-primary` is the text color that goes
ON `surface.primary`; `icon.on-error` goes on `surface.error`. The validator
derives contrast pairs from this naming convention automatically — no
hand-maintained list. When you add `surface.foo`, the correct counterpart is
`text.on-foo` and `icon.on-foo`, not a new exemption.

### Surfaces, text, borders, icons

Semantic color splits into a small, stable set of role groups:

- `surface` — backgrounds: `page`, `card`, `overlay`, `dark`, `disabled`, plus
  status surfaces (`error`, `success`, `warning`)
- `text` — `default`, `subtle`, `disabled`, `placeholder`, plus status variants
  and `on-<surface>` counterparts
- `stroke` — `default`, `divider`, `hover`, `disabled`, `input-focus`, plus
  status variants and `on-dark`
- `icon` — mirrors text roles with status variants and `on-<surface>` counterparts
- `logo` — brand mark in different contexts (`default`, `white`)

Each carries the color mode axis (light/dark).

Status variants (`error`, `success`, `warning`) belong in **every group that
renders them**: surface, text, stroke, icon. A system with `surface.error` but
no `text.error` is half-built. Complete the family or leave it out entirely.

### Surface elevation and the floating container model

The four reading surfaces form an elevation scale. In dark mode, elevation reads as
relative lightness: a surface that appears lighter sits higher in the z-stack. The
scale in luminance order (darkest = lowest):

```
surface.page    L ≈ 0.008  — document floor; everything lives on top of it
surface.card    L ≈ 0.018  — primary content container (most components land here)
surface.raised  L ≈ 0.055  — secondary container: inputs, dropdowns' inner item rows
surface.floating L ≈ 0.127 — top of stack: dropdowns, tooltips, popovers, context menus
```

**`surface.floating` is a positioning container, not a content container.**

Floating surfaces handle _where_ a panel sits in the z-stack (elevation, box-shadow,
border). They do not host readable content directly. Content — text, icons, inputs,
status feedback — lives on an inner `surface.card` or `surface.raised` inside the
floating shell.

Why this matters for contrast:

Chromatic hues (status red, green, orange) have a WCAG luminance of L ≈ 0.10–0.16 at
natural saturation. This is essentially equal to `surface.floating` (L = 0.127). No
stop of a chromatic ramp can achieve 4.5:1 against floating: in the light-text
direction the required luminance is L > 0.75 (washes out the hue entirely); in the
dark-text direction the required luminance is negative (impossible). This is a
physical property of the WCAG formula and these hues, not a calibration gap.

The consequence: status text (validation messages, inline alerts) and status icons
inside a floating panel must sit on an inner `surface.card` or `surface.raised`. The
floating shell carries no readable content — it carries the panel itself.

Practical checklist for floating container design:

- The floating background is `surface.floating`.
- Item rows inside a dropdown or list sit on `surface.raised` (no inner card needed
  for a simple list row; inner card only for richer layouts).
- Status banners or callouts inside a popover sit on `surface.card`.
- Text color for item labels is `text.default` (not `text.subtle` or any chromatic
  role), because item copy must pass on the lowest guaranteed inner surface.
- Inputs inside a floating panel (e.g. a command palette) use `surface.raised` or
  `surface.card` as the input background; the focus ring then passes on that surface.

The contrast gate exempts floating surface pairs where the inner-container model
applies. Entries labeled **PHYSICAL** mark pairs that are mathematically impossible
regardless of token choice. Entries labeled **USAGE (revisable)** mark design
decisions about which content roles appear in floating containers; they are revisable
if the container type evolves. Entries labeled **REAL GAP** identify confirmed cases
where content appears directly on floating and the gate exposes a real contrast
shortfall that needs a design fix.

### The answer to "different stroke for input vs chip?"

No, not at the semantic tier. `stroke.input` and `stroke.chip` are component
tokens, and creating them by default is how a system bloats into hundreds of
near-duplicate tokens nobody can reason about.

The discipline:

1. Define semantic stroke roles by function: `border.default`, `border.strong`,
   `border.focus`, `border.error`.
2. Components use those directly. An input border is `border.default`; on focus,
   `border.focus`; on error, `border.error`. A chip border is also
   `border.default`. They share because they mean the same thing.
3. Introduce a component token (`input.border`, `chip.border`) ONLY when a
   component genuinely diverges from the semantic role, and even then it must
   reference a semantic token, never a primitive. If `input.border` just equals
   `border.default`, delete it.

Test: if you cannot explain why a component token differs from the semantic role
it would otherwise use, it should not exist.

## 3. Typography

### Scale

Use a modular scale from a 16px base (16px is the accessible floor for body text;
never smaller for reading text). A ratio between 1.2 (minor third) and 1.25 (major
third) reads well for UI. Editorial/display sizes can break the ratio and be
hand-set larger for drama.

A practical, complete scale (rem, 16px base):

```
xs   12   (0.75)   captions, legal
sm   14   (0.875)  secondary UI
base 16   (1.0)    body
md   18   (1.125)  lead paragraph
lg   20   (1.25)   h4
xl   24   (1.5)    h3
2xl  30   (1.875)  h2
3xl  36   (2.25)   h1 small
4xl  48   (3.0)    h1
display 64–100     fluid, editorial
```

Do not ship every step as a heading. Map a small set of composite typography
tokens (display, h1–h4, body, body-sm, caption) onto the scale. More than that
and the system encodes decisions nobody made.

### Fluid type

For display and large headings, use `clamp()` so type scales between breakpoints
instead of snapping. Mobile-first: the base is the smallest value, `clamp()` (or
min-width steps) grows it. This system already models responsive sizes as a mode
axis; `clamp()` is the alternative when you want continuous rather than stepped.

### Composite

Typography is a composite token: family + weight + size + line-height +
letter-spacing bundled. Line-height tightens as size grows (1.5 body, 1.1
display). This is also what generates Figma text styles, one per breakpoint.

### The serif myth

"Body must be sans-serif for accessibility" is outdated. On modern displays serifs
are legible and can aid long-form reading. Choose type for the brand; legibility is
governed by size, weight, spacing, and contrast, not serif vs sans.

## 4. Spacing and sizing

### One base unit

Pick 4px as the base unit and build an 8px rhythm on top. 4px gives fine control
for small gaps; 8px multiples give visual consistency. This is the de facto
industry grid.

Recommended spacing scale (px):

```
0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128
```

Name numerically (`space.4`, `space.16`) or by t-shirt (`sm`, `md`, `lg`).
Numeric scales better past ~7 steps; t-shirt reads better with few steps. For a
scale this long, numeric.

### Spacing is not sizing

Keep two separate concerns:

- **spacing** — gaps, padding, margins (the rhythm scale above)
- **sizing** — fixed dimensions: icon sizes, control heights, max-widths, avatar
  sizes

Mixing them into one scale is a common early mistake. An icon that happens to be
16px is not the same concept as 16px of padding, and they will drift apart.

### Semantic spacing (optional, powerful)

For a mature system, add a thin semantic spacing layer: `space.inset.md` (padding
inside a container), `space.stack.md` (vertical gap between stacked elements),
`space.inline.md` (horizontal gap). Components reference these. It lets you retune
density globally. Optional; add it when component padding starts repeating.

## 5. The other scales a complete system has

- **radius** — `none, sm, md, lg, xl, full`, referencing the sizing scale.
- **border-width** — `hairline (1), thin (1.5), thick (2)`.
- **elevation / shadow** — composite tokens. Shadow color must be a low-alpha
  neutral (e.g. `neutral-900 / 8–16%`), never a solid color, or shadows look like
  hard borders. Layer 2–3 shadows per level for realism.
- **z-index** — a named scale (`base, dropdown, sticky, overlay, modal, toast`) so
  stacking is decided once, not guessed per component.
- **motion** — `duration` (fast 120ms, base 200ms, slow 320ms) and `easing`
  (standard, decelerate, accelerate) tokens. Animations should reference these.
- **breakpoints** — a small set (`sm, md, lg, xl`); mobile-first min-width.

## 6. Accessibility, baked in

Current state (2026): WCAG 2.2 AA is the operative legal standard. WCAG 3.0 is a
Working Draft, not final before ~2029–2030, and its APCA contrast model is still
exploratory. Practical stance: conform to WCAG 2.2 AA now, and design so APCA is
easy to adopt later.

### The thresholds that bind today (WCAG 2.2 AA)

- Body text: contrast ratio ≥ 4.5:1 against its background.
- Large text (≥24px, or ≥19px bold): ≥ 3:1.
- UI components and graphical objects (borders of inputs, icons that carry
  meaning): ≥ 3:1.
- Focus indicator: visible and ≥ 3:1 against adjacent colors.

### How to bake it into the tokens, not bolt it on after

1. **Pair semantic tokens intentionally.** Every `text.*` role has an implied
   background. `text.on-brand` must pass on `surface.brand`. `text.default` must
   pass on `surface.page`. Document the approved pairs as a contrast matrix.
2. **Make contrast a build gate, not an audit.** Contrast failures are silent:
   no compile error, invisible in code review unless someone checks manually.
   A gate that derives pairs from naming convention and fails the build closes
   this — no checklist, no "we'll verify at QA." When a pair passes, it passes
   in all declared modes. See `scripts/lib/contrast.mjs` for the implementation;
   `npm run contrast-report` for the human-readable output.

   Exemptions require a statutory reason — not "it was hard to fix" but the
   specific WCAG clause that applies (inactive components, decorative graphics).
   An un-reasoned exemption is a debt with no due date. A rename that breaks an
   exemption is intentional: the exemption belongs to the functional role, not
   to whichever token name happens to sit there today.

3. **OKLCH helps.** Because OKLCH lightness tracks perceived contrast, you can
   target contrast by choosing lightness deltas, and APCA (which is perceptual and
   polarity-aware) will align more naturally later.
4. **Never rely on color alone.** Status is color plus icon or text, so
   color-blind users are covered. This is a token-usage rule, worth stating.

### APCA, forward-looking

APCA scores on an Lc scale (0 to ±106), factoring size, weight, and polarity
(light-on-dark vs dark-on-light). It is not normative yet. If refreshing a system
now, testing key pairs against APCA in addition to WCAG 2.2 is the recommended
hedge; do not replace WCAG 2.2 conformance with it.

## 7. Naming

- Lower kebab-case, no spaces, no doubled segments, consistent casing.
- Name by intent, never appearance (`accent.subtle`, not `accent.light`).
- Structure: `group.role.variant.state` read left to right general to specific.
- Mode names consistent (`light`/`dark`, `base`/`md`/`lg`).
- Enforce with the validator.
- **Name at the level of abstraction you know.** In a boilerplate, the concrete
  use case has not been decided yet. `emphasis` is a claim you can keep;
  `award` or `callout` is a promise you may break. Name the general function
  you are certain of; let product teams specialize at the component layer.

## 7b. Palette slot vs. semantic role

`palette.accent` is a slot — it names a palette position (the accent ramp).
A semantic role named `accent` would carry that slot name into the semantic
layer, making the role mean "the color" rather than "the function." They are
different things and must have different names.

Rule: no semantic group carries the name of a palette slot. `palette.accent`
backs semantic roles named after function (`emphasis`, `callout`, `featured`).
`palette.primary` backs `text.primary`, `surface.primary`, `icon.primary` —
roles that describe where the primary color appears, not what the primary color
is.

Test: if you cannot answer "what does a component use this role **for**?" the
name describes a color, not a function. Rename it.

## 8. Governance: what to include, what to refuse

- Primitives contain only what a role uses, plus full ramps for interactive/status
  roles. Everything else is a Figma palette library, out of the repo.
- Semantic roles are stable across brands; renaming ripples to every consumer.
- Component tokens require justification; default to reusing a semantic token.
- The validator is the contract: dangling refs, missing modes, naming, layering,
  and contrast. Extend the checks; never loosen them to make a build pass.
- Version the package; consumers pin a version.

## Priority order for this boilerplate

1. Complete interaction states for interactive roles (brand, emphasis, status):
   hover, active (pressed), disabled, subtle. The `on-<role>` pattern and status
   family (surface/text/stroke/icon for error/success/warning) are in place;
   hover/active/pressed variants are not.
2. Split spacing from sizing; adopt the 4px-base scale.
3. Set a modular type scale and reduce composites to a named few.
4. Fix shadow color to low-alpha neutral; add elevation levels.
5. Add motion, z-index, border-width scales.
6. _(Done)_ Contrast gate: convention-derived pairs, alpha-composited WCAG
   check, shared lib, explicit allowlist with statutory rationale.
   See `scripts/lib/contrast.mjs` and `npm run contrast-report`.
7. _(Done)_ Collapsed component tokens that merely aliased a semantic role;
   renamed semantic groups whose names described a palette slot, not a function.
