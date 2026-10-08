# Design Principles

Architectural decisions that are deliberate and must not be "fixed."
Each section states the rule, the reasoning, and the accepted trade-off.

---

## Brand coherence over WCAG escalation

### Rule

Brand-chromatic tokens that function as primary identity signals — currently
`text.title`, `text.primary`, and `icon.primary` — are **fixed at step 11** in
both light and dark modes. They do not auto-escalate to step 12 to meet WCAG
contrast thresholds, regardless of how the brand's color palette is configured.

### Reasoning

Radix step 11 is the "accessible text" step: it is calibrated to meet 4.5:1 on
pure-white backgrounds for every scale in the system. It is the correct step for
brand-identity text on standard reading surfaces.

Step 12 is near-black — almost always mauve or a very dark version of the brand
hue. Forcing step 12 for primary text on a magenta brand, for example, would
produce text that reads as near-black magenta instead of magenta. The brand
identity is lost. The correct response to a palette with very light step 11 is
to adjust the palette, not to silently swap the token to a visually incoherent
step.

The previous `pickTextStep` / `pickIconStep` algorithms did escalate to step 12
when step 11 failed the 4.5:1 threshold. That behavior was removed in this system
because it produced inconsistent results across brand palettes and obscured the
real issue (an undertoned palette) with a silent visual patch.

### Accepted trade-off

Brands with extremely light identity colors (high-lightness, low-chroma step 11)
may produce sub-AA title text in light mode. This is accepted. The correct fix
is to regenerate the brand's color scale so that step 11 achieves ≥4.5:1 on
`surface.page` — not to change which step `text.title` uses.

Dark mode is not affected: Radix dark step 11 reliably passes on dark reading
surfaces.

### Scope

This principle applies only to tokens that carry the brand's **chromatic
identity**: `text.title`, `text.primary`, `icon.primary` (and their
`brand-generated` counterparts in per-project repos built with
`create-nsp-project`).

It does **not** apply to neutral or utility tokens (`text.default`, `icon.default`,
`text.subtle`, etc.) — those are accessibility-first and use whatever Radix step
meets the threshold.

### Implementation

`create-nsp-project/index.mjs` generates these tokens as `ct(ps(11), ps(11))`
(step 11 both modes). The `pickTextStep` / `pickIconStep` helper functions still
exist in the scaffold but are only used for interaction-state derivatives
(`text.primary-hover`, `icon.primary-hover`, `stroke.primary`) where a one-step
escalation from the base is expected and the visual result remains coherent.

---

## Surface naming convention: full vs subtle

### Rule

Surface token names encode the kind of surface they represent:

- **Bare name** `surface.<color>` is reserved for a **full-color surface** — the
  anchor of that color in the surface layer. It exists only when a color genuinely
  has a full-color surface. Today only `primary` qualifies (`surface.primary`).

- **Subtle suffix** `surface.<color>-subtle` is used for a **soft-tint surface** —
  a muted, low-chroma background derived from that color. Interaction states follow
  the same suffix chain: `surface.<color>-subtle-hover`,
  `surface.<color>-subtle-active`.

- **On-tokens follow their surface.** When a surface is named `-subtle`, every
  `on-` foreground token follows suit: `text.on-<color>-subtle`,
  `icon.on-<color>-subtle`. If the surface renames, the on-tokens rename with it.

- **No full surface → no bare name.** A color that does not have a full-color
  surface does not get the bare `surface.<color>` token. It only has the `-subtle`
  variants. Its strong anchor step remains available as foreground (icons, text) and
  in `palette.*`, but not as a surface.

### Reasoning

Primary is the dominant brand color: its full-color surface (step 9) carries
buttons, CTAs, and hero panels — contexts where the identity hue must be
unmistakable. Secondary and tertiary serve as supporting tints — subtle backgrounds
that visually group or layer content without competing with primary. Encoding this
distinction in the name makes the hierarchy self-documenting: `surface.primary` is
a strong statement; `surface.secondary-subtle` is a quiet backdrop. No designer or
developer needs to guess which surface is bold and which is muted.

### Scope

This convention applies to every semantic surface token (`surface.*`), current and
future. It does not affect palette primitives (`palette.*`), foreground tokens
(`text.*`, `icon.*`) except the `on-` companions described above, or border tokens.

### Examples

| Color     | Full surface      | Subtle surface             | On-token (subtle)          |
| --------- | ----------------- | -------------------------- | -------------------------- |
| primary   | `surface.primary` | `surface.primary-subtle`   | `text.on-primary-subtle`   |
| secondary | —                 | `surface.secondary-subtle` | `text.on-secondary-subtle` |
| tertiary  | —                 | `surface.tertiary-subtle`  | `text.on-tertiary-subtle`  |
