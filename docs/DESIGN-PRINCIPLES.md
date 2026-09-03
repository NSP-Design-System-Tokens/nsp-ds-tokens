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
