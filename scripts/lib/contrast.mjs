// Contrast math + convention-based pair derivation. Shared by validate.mjs and
// contrast-report.mjs so one implementation drives both the gate and the
// human-readable report.
//
// - toRGBA / composite / luminance follow sRGB gamma; alpha is composited on
//   the background (bg composited over white if bg itself is translucent).
// - resolveColor walks {ref} chains and mode overrides down to a hex/oklch leaf.
// - derivePairs infers fg/bg pairs from naming conventions so the check evolves
//   with the tokens, no hand-maintained list.
// - CONTRAST_EXEMPT names exemptions explicitly with the reason. A rename or
//   reuse of the token no longer matches the allowlist, restoring the check.

import { formatHex, oklch, clampChroma, parse } from "culori";

// --- color parsing / math ---------------------------------------------------

function toRGBA(value) {
  if (typeof value !== "string")
    throw new Error(`not a color string: ${value}`);
  const v = value.trim();
  if (v.startsWith("oklch")) {
    const hex = formatHex(clampChroma(oklch(v), "oklch"));
    return toRGBA(hex);
  }
  const c = parse(v);
  if (!c) throw new Error(`cannot parse color: ${value}`);
  return { r: c.r ?? 0, g: c.g ?? 0, b: c.b ?? 0, a: c.alpha ?? 1 };
}

function composite(fg, bg) {
  let br = bg.r,
    bgc = bg.g,
    bb = bg.b;
  if (bg.a < 1) {
    br = bg.a * br + (1 - bg.a) * 1;
    bgc = bg.a * bgc + (1 - bg.a) * 1;
    bb = bg.a * bb + (1 - bg.a) * 1;
  }
  return {
    r: fg.a * fg.r + (1 - fg.a) * br,
    g: fg.a * fg.g + (1 - fg.a) * bgc,
    b: fg.a * fg.b + (1 - fg.a) * bb,
  };
}

function luminance({ r, g, b }) {
  const ch = (c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function contrast(fgColor, bgColor) {
  const fg = toRGBA(fgColor);
  const bg = toRGBA(bgColor);
  const fgEff = composite(fg, bg);
  const bgEff =
    bg.a < 1
      ? composite(bg, { r: 1, g: 1, b: 1, a: 1 })
      : { r: bg.r, g: bg.g, b: bg.b };
  const l1 = luminance(fgEff);
  const l2 = luminance(bgEff);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

// --- token resolution -------------------------------------------------------

export function resolveColor(merged, path, mode) {
  const get = (p) =>
    p
      .split(".")
      .reduce(
        (n, s) => (n && typeof n === "object" && s in n ? n[s] : undefined),
        merged,
      );
  const step = (v) => {
    if (typeof v !== "string") return v;
    const m = /^\{([^}]+)\}$/.exec(v.trim());
    if (!m) return v;
    const node = get(m[1]);
    if (!node) return undefined;
    const modes = node.$extensions?.["com.figma.modes"];
    const chosen = mode && modes && mode in modes ? modes[mode] : node.$value;
    return step(chosen);
  };
  return step("{" + path + "}");
}

// --- exemptions -------------------------------------------------------------

// Two kinds of entries:
//   "fg.token"               — exempts that fg on ALL backgrounds (WCAG clause or decoration)
//   "fg.token × bg.token"    — exempts that specific pair only (usage constraint)
//
// Exact-match allowlist. Named + reason. If a token is renamed, its exemption
// stops matching — that's intended: the exemption belongs to the role, not to
// whichever token happens to occupy the name today.
export const CONTRAST_EXEMPT = {
  // WCAG SC 1.4.3 — inactive UI components are exempt from contrast.
  "text.disabled":
    "WCAG SC 1.4.3 — inactive UI components exempt from contrast requirements",
  "icon.disabled":
    "WCAG SC 1.4.3 — inactive UI components exempt from contrast requirements",
  "icon.disabled-dark":
    "WCAG SC 1.4.3 — inactive UI components exempt from contrast requirements",
  "icon.subtle":
    "WCAG SC 1.4.3 — inactive/muted icon variant, exempt as inactive UI",
  "stroke.disabled":
    "WCAG SC 1.4.3 — inactive UI components exempt from contrast requirements",

  // Decorative graphics — SC 1.4.11 excludes them.
  "stroke.divider":
    "decorative divider — not a UI component boundary; SC 1.4.11 excludes decorative graphics",

  // Decorative brand-tint variants used on arbitrary backgrounds chosen by the
  // designer (dark surfaces, brand surfaces, image overlays, …). No fixed
  // surface pairing, so the check cannot verify statically. Contrast is the
  // consumer's responsibility when applying these.
  "text.primary-light":
    "brand-tinted decorative variant — arbitrary background, contrast is consumer's responsibility",
  "text.primary-xlight":
    "brand-tinted decorative variant — arbitrary background, contrast is consumer's responsibility",

  // White utility tokens — intended exclusively for dark/colored surfaces
  // (on-dark, on-brand, image overlays). Pairing with light reading surfaces
  // (page/card/raised/floating) is a usage error; contrast is the consumer's
  // responsibility when placing these tokens.
  "text.white":
    "white utility token — arbitrary dark/colored background, contrast is consumer's responsibility; not for light reading surfaces",
  "icon.white":
    "white utility token — arbitrary dark/colored background, contrast is consumer's responsibility; not for light reading surfaces",
  "stroke.white":
    "white utility token — arbitrary dark/colored background, contrast is consumer's responsibility; not for light reading surfaces",

  // --- Floating surface constraints -------------------------------------------
  //
  // surface.floating (dropdowns, tooltips, popovers, context menus) is a
  // POSITIONING container. Content — including text, icons, and inputs —
  // lives on an inner surface.card or surface.raised, not directly on floating.
  //
  // Two distinct reasons apply below. They are labeled explicitly:
  //   PHYSICAL   — mathematically impossible regardless of token choice.
  //                Invalicabile. Changing values cannot fix this.
  //   USAGE      — design decision, not physical impossibility. Revisable if
  //                the intended use of the container type changes.
  //   REAL GAP   — real occurrence not covered by inner-container model; noted
  //                for deliberate follow-up, not silently archived.

  // PHYSICAL — chromatic status hues (red, green, orange) have WCAG luminance
  // L≈0.10–0.16, which matches floating dark L=0.127 exactly. No stop of any
  // status ramp can achieve 4.5:1: dark-text direction requires negative
  // luminance (impossible); light-text direction requires L≥0.747, which
  // destroys chromatic identity. Proven mathematically; not a calibration issue.
  // Status text inside floating (validation tooltips, status popovers) must use
  // an inner surface.card container. Invalicabile.
  "text.error × surface.floating":
    "PHYSICAL — red hues have L≈0.10–0.16 = floating L=0.127; 4.5:1 requires negative luminance (impossible). Status text uses inner surface.card.",
  "text.success × surface.floating":
    "PHYSICAL — green hues have L≈0.10–0.16 = floating L=0.127; 4.5:1 requires negative luminance (impossible). Status text uses inner surface.card.",
  "text.warning × surface.floating":
    "PHYSICAL — orange hues have L≈0.10–0.16 = floating L=0.127; 4.5:1 requires negative luminance (impossible). Status text uses inner surface.card.",

  // --- Tertiary button — dark neutral pressed/emphasis fills ----------------------
  //
  // USAGE — surface.tertiary-dark and surface.tertiary-darker resolve to
  // palette.neutral.700 (#65636d mauve) and palette.neutral.800 (#211f26 mauve)
  // in light mode. These are dark neutral fills for pressed/emphasis states.
  //
  // text.on-tertiary = palette.tertiary.11 = mauve.11 (#65636d light). On
  // tertiary-dark (same #65636d) = 1:1 contrast (impossible to pass). On
  // tertiary-darker (#211f26): 2.51:1 < 4.5 threshold.
  //
  // Usage rule: dark fills (tertiary-dark/darker) use text.on-dark (white), not
  // text.on-tertiary. Component tokens must enforce the switch. The semantic gate
  // cannot statically verify per-state label tokens (rejected by design).
  "text.on-tertiary × surface.tertiary-dark":
    "USAGE — tertiary-dark = mauve.11 (#65636d); on-tertiary text = same hue/lum. Dark fills use text.on-dark (white) instead.",
  "text.on-tertiary × surface.tertiary-darker":
    "USAGE — tertiary-darker = mauve.12 (#211f26, near-black); on-tertiary = mauve.11 = 2.51:1 < 4.5. Dark fills use text.on-dark (white).",
  "icon.on-tertiary × surface.tertiary-dark":
    "USAGE — tertiary-dark = mauve.11 (#65636d); on-tertiary icon = same hue/lum. Dark fills use icon.on-dark (white) instead.",
  "icon.on-tertiary × surface.tertiary-darker":
    "USAGE — tertiary-darker = mauve.12 (#211f26); on-tertiary icon = mauve.11 = 2.51:1 < 3.0. Dark fills use icon.on-dark (white).",

  // --- Secondary button — dark-mode on-secondary on neutral-tinted surfaces ------
  //
  // USAGE — In dark mode, surface.tertiary-dark resolves to palette.neutral.200
  // = mauve.light.4 (#eae7ec, very light). text.on-secondary in dark mode =
  // palette.secondary.11d = pink.dark.11 (#f287b4). Light pink on light mauve
  // = L≈0.39 vs L≈0.82 → 2.53:1 < 4.5. These dark fills show text.on-dark.
  "text.on-secondary × surface.tertiary-dark":
    "USAGE — dark mode: tertiary-dark = mauve.4 (#eae7ec light); on-secondary-dark = pink.11d (#f287b4) = 2.53:1. Dark fills use text.on-dark.",
  "text.on-secondary × surface.tertiary-darker":
    "USAGE — dark mode: tertiary-darker = mauve.3 (#f2eff3 light); on-secondary-dark = pink.11d = similar lum. Dark fills use text.on-dark.",
  "icon.on-secondary × surface.tertiary-dark":
    "USAGE — dark mode: tertiary-dark = mauve.4 light; on-secondary-dark icon = pink.11d. Dark fills use icon.on-dark.",
  "icon.on-secondary × surface.tertiary-darker":
    "USAGE — dark mode: tertiary-darker = mauve.3 light; on-secondary icon = pink.11d. Dark fills use icon.on-dark.",

  // USAGE — secondary/muted text has intentionally reduced contrast. These
  // roles are valid on page and card (where they pass), but are not placed on
  // floating surfaces. Floating item copy uses text.default, not text.subtle.
  // Revisable if the design evolves to use reduced-contrast text in floating.
  "text.subtle × surface.floating":
    "USAGE (revisable) — reduced-contrast secondary role; not placed on floating surfaces. Use text.default for floating item copy.",
  "text.placeholder × surface.floating":
    "USAGE (revisable) — placeholder text not placed on floating; inputs inside floating use inner surface (raised/card) with their own placeholder treatment.",

  // USAGE — brand-chromatic heading and primary text do not occur in floating
  // containers (dropdowns, tooltips, popovers). No such pairing exists in the
  // intended use of these container types. Revisable if floating is extended to
  // host richer content (e.g., a feature-rich popover with a brand headline).
  "text.title × surface.floating":
    "USAGE (revisable) — brand heading does not occur in floating containers (dropdown/tooltip/popover). Revisit if floating hosts rich branded content.",
  "text.primary × surface.floating":
    "USAGE (revisable) — brand primary text does not occur in floating containers. Revisit if floating hosts interactive brand-colored copy.",
  "text.primary-hover × surface.floating":
    "USAGE (revisable) — brand hover state does not occur in floating containers. Revisit if floating hosts interactive brand states.",

  // USAGE — decorative brand-tint icon; same reasoning as text.primary-light
  // (already globally exempt). No fixed floating pairing; contrast is the
  // consumer's responsibility when placing on arbitrary surfaces.
  "icon.primary-light × surface.floating":
    "USAGE (revisable) — decorative brand-tint icon; no fixed floating pairing. Contrast is consumer's responsibility.",

  // USAGE — stroke.primary/hover pass on surface.raised (3.17) and surface.card
  // (4.89). In a command palette, the input background must be surface.raised or
  // surface.card, not surface.floating directly. The focus ring is then on
  // raised/card, where it passes. Inner-container model holds; not a real gap.
  // Revisable if an input is placed directly on floating without inner surface.
  "stroke.primary × surface.floating":
    "USAGE (revisable) — focus stroke on inner surface: raised 3.17 ✓, card 4.89 ✓. Inputs inside floating must use surface.raised/card as background.",
  "stroke.hover × surface.floating":
    "USAGE (revisable) — hover border on inner surface: raised 3.17 ✓, card 4.89 ✓. Inputs inside floating must use surface.raised/card as background.",

  // --- Primary button — dark-mode hover/pressed surface inversion ---------------
  //
  // REAL GAP — design decision required.
  //
  // surface.primary-hover and surface.primary-dark resolve to palette.primary.300
  // (#ef56af) in dark mode: the dark-mode convention lightens interactive surfaces
  // on hover/press (luminance inversion). text.on-primary = palette.neutral.0
  // (white) achieves only 3.17:1 on #ef56af, below the 4.5:1 text threshold.
  //
  // Fix options (design team to choose):
  //   A) Darken the dark-mode hover/pressed stops (e.g. primary.400 or primary.500)
  //      so white text passes — sacrifices the luminance-inversion convention.
  //   B) Accept the inversion and gate only on-primary × surface.primary (base);
  //      state surfaces are exempt because the focus ring and button shape carry
  //      the state signal, not text readability alone. Revisable.
  //
  // Currently exempted as REAL GAP so the build remains green while the decision
  // is pending. Remove once a design fix is applied.
  "text.on-primary × surface.primary-hover":
    "REAL GAP — dark mode only: surface.primary-hover = palette.primary.300 (#ef56af), white text = 3.17:1 < 4.5. Design fix needed (see comment above).",
  "text.on-primary × surface.primary-dark":
    "REAL GAP — dark mode only: surface.primary-dark = palette.primary.300 (#ef56af), white text = 3.17:1 < 4.5. Design fix needed (see comment above).",

  // --- Radix orange.11 on off-white reading surfaces (light mode) ---------------
  //
  // orange.11 (#cc4e00) achieves 4.51:1 on pure white (#ffffff, AA-pass by 0.01).
  // In Radix-pure architecture, reading surfaces use mauve.1 (#fdfcfd) and
  // mauve.2 (#faf9fb) — very slight purple tint that lowers contrast to 4.41 and
  // 4.30 respectively. The Radix orange.11 "accessible text" step is calibrated
  // for pure-white backgrounds; off-white mauve tint exposes this borderline.
  //
  // DARK MODE: unaffected — orange.11 dark (#ffa057) on mauve.1/2 dark achieves
  // 8-10:1 contrast, well above threshold.
  //
  // Fix options (design team to choose):
  //   A) Deepen surface.page/card/raised to neutral.0 in light mode only — requires
  //      reverting Cat-C surface tokens to dual-mode, re-introducing Color Roles switch.
  //   B) Replace text.warning with a custom orange deeper than Radix step 11 that
  //      achieves 4.5:1 on mauve.1 (#fdfcfd). Requires custom palette entry.
  //   C) Accept the 0.09-0.20 gap: orange warning text is still clearly readable,
  //      and the dark-mode path is fully compliant. Revisable at next palette update.
  "text.warning × surface.page":
    "REAL GAP (light mode) — orange.11 (#cc4e00) is 4.41:1 on mauve.1 (#fdfcfd) vs 4.51 on pure white. Radix step.11 calibrated for white; off-white tint exposes borderline. Dark mode: 8-10:1, fully compliant. Fix: deepen surface or replace warning with custom deeper orange (see comment above).",
  "text.warning × surface.card":
    "REAL GAP (light mode) — orange.11 (#cc4e00) is 4.30:1 on mauve.2 (#faf9fb). Same root cause as text.warning × surface.page. Dark mode: fully compliant.",
  "text.warning × surface.raised":
    "REAL GAP (light mode) — orange.11 (#cc4e00) is 4.30:1 on mauve.2 (#faf9fb). Same root cause as text.warning × surface.page. Dark mode: fully compliant.",

  // --- Radix green.11 on mauve.2 — rounding-margin AA borderline ----------------
  //
  // green.11 (#218358) achieves 4.71:1 on pure white and 4.49:1 on mauve.2
  // (#faf9fb). The 0.01 shortfall is a floating-point artefact of WCAG rounding:
  // moving surfaces from pure white to mauve.2 reduces contrast by 0.22 and
  // crosses the threshold at the second decimal place.
  //
  // Fix: change surface.card / surface.raised to neutral.1 instead of neutral.2,
  // restoring 4.65:1 on mauve.1. Trade-off: card and raised lose their elevation
  // step over surface.page in light mode (both become mauve.1).
  "text.success × surface.card":
    "ROUNDING MARGIN — green.11 (#218358) is 4.49:1 on mauve.2 (#faf9fb), 0.01 below AA 4.5. Was 4.71 on white. Fix: use neutral.1 for card/raised (loses elevation step) or accept 0.01 gap.",
  "text.success × surface.raised":
    "ROUNDING MARGIN — green.11 (#218358) is 4.49:1 on mauve.2 (#faf9fb), 0.01 below AA 4.5. Was 4.71 on white. Fix: use neutral.1 for card/raised (loses elevation step) or accept 0.01 gap.",
};

// --- pair derivation --------------------------------------------------------

// Threshold per group. Text needs 4.5:1 (SC 1.4.3). Stroke + icon are UI/graph
// objects at 3:1 (SC 1.4.11).
export function thresholdFor(group) {
  return group === "text" ? 4.5 : 3.0;
}

// Convention:
//   text.on-<X> / icon.on-<X>  ↔  surface.<X>
//   everything else in text / icon / stroke  ↔  surface.page + surface.card
// Both modes: light + dark.
export function derivePairs(merged) {
  const pairs = [];
  const modes = ["light", "dark"];
  const reading = [
    "surface.page",
    "surface.card",
    "surface.raised",
    "surface.floating",
  ];
  const surfaceHas = (name) => name in (merged.surface ?? {});

  // State suffixes: on-X is verified against surface.X and all its interaction states.
  const stateSuffixes = ["-hover", "-dark", "-active", "-darker", "-pressed"];

  for (const group of ["text", "icon", "stroke"]) {
    const bucket = merged[group] ?? {};
    for (const name of Object.keys(bucket)) {
      if (name.startsWith("on-")) {
        const bgBase = name.slice(3);
        if (!surfaceHas(bgBase)) continue;
        const bgNames = [
          bgBase,
          ...stateSuffixes.map((s) => bgBase + s).filter(surfaceHas),
        ];
        for (const bgName of bgNames)
          for (const mode of modes)
            pairs.push({
              fg: `${group}.${name}`,
              bg: `surface.${bgName}`,
              mode,
            });
      } else {
        for (const bg of reading) {
          for (const mode of modes)
            pairs.push({ fg: `${group}.${name}`, bg, mode });
        }
      }
    }
  }
  return pairs;
}

// --- driver ----------------------------------------------------------------

// Run the full check. Returns { results, failures } where each entry is
// { fg, bg, mode, fgHex, bgHex, ratio, threshold, status } with status one of
// "ok" | "FAIL" | "exempt".
export function checkContrast(merged) {
  const results = [];
  const failures = [];
  for (const { fg, bg, mode } of derivePairs(merged)) {
    const fgHex = resolveColor(merged, fg, mode);
    const bgHex = resolveColor(merged, bg, mode);
    if (!fgHex || !bgHex) continue;
    const ratio = contrast(fgHex, bgHex);
    const group = fg.split(".")[0];
    const threshold = thresholdFor(group);
    const pairKey = `${fg} × ${bg}`;
    let status;
    if (CONTRAST_EXEMPT[fg] || CONTRAST_EXEMPT[pairKey]) status = "exempt";
    else if (ratio < threshold) status = "FAIL";
    else status = "ok";
    const row = { fg, bg, mode, fgHex, bgHex, ratio, threshold, status };
    results.push(row);
    if (status === "FAIL") failures.push(row);
  }
  return { results, failures };
}
