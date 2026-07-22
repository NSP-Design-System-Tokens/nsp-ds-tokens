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

  // Usage constraints — not WCAG exemptions but usage restrictions.
  //
  // surface.floating (dropdowns, tooltips, popovers, context menus) is a
  // POSITIONING container. Its luminance sits in a physical dead zone:
  // neutral.700 L≈0.127 makes 4.5:1 impossible for any chromatic color
  // (saturated status hues peak at L≈0.10–0.16, matching the surface).
  //
  // Rule: text on floating surfaces uses an INNER surface.card container.
  // Floating sets position; card sets the reading background. Components that
  // place text directly on surface.floating must use text.default only.

  // Muted/secondary text — reduced contrast is the intent; not for elevated surfaces.
  "text.subtle × surface.floating":
    "usage constraint — secondary text not for floating; use text.default on floating containers",
  "text.placeholder × surface.floating":
    "usage constraint — placeholder text not for floating; use text.default on floating containers",

  // Brand-chromatic text — decorative/identity role; not placed in floating contexts.
  "text.title × surface.floating":
    "usage constraint — brand heading not placed on floating surfaces; floating uses inner surface.card for rich content",
  "text.primary × surface.floating":
    "usage constraint — brand primary text not placed on floating surfaces; floating uses inner surface.card for rich content",
  "text.primary-hover × surface.floating":
    "usage constraint — brand hover state not placed on floating surfaces; floating uses inner surface.card for rich content",

  // Status text — chromatic status hues have L≈0.10–0.16, matching floating L=0.127;
  // no status stop achieves 4.5:1 here (physics, not calibration). Status text
  // inside floating containers (validation tooltips, status popovers) sits on an
  // inner surface.card, not directly on surface.floating.
  "text.error × surface.floating":
    "usage constraint — status text on floating uses inner surface.card; floating is positioning only",
  "text.success × surface.floating":
    "usage constraint — status text on floating uses inner surface.card; floating is positioning only",
  "text.warning × surface.floating":
    "usage constraint — status text on floating uses inner surface.card; floating is positioning only",

  // Brand icons and strokes — same positioning constraint as brand text.
  "icon.primary × surface.floating":
    "usage constraint — brand icon on floating uses inner surface.card container",
  "icon.primary-light × surface.floating":
    "brand-tinted decorative icon variant on floating — arbitrary surface context, contrast is consumer's responsibility",
  "stroke.primary × surface.floating":
    "usage constraint — brand focus stroke on floating uses inner surface.card container",
  "stroke.hover × surface.floating":
    "usage constraint — brand hover stroke on floating uses inner surface.card container",
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

  for (const group of ["text", "icon", "stroke"]) {
    const bucket = merged[group] ?? {};
    for (const name of Object.keys(bucket)) {
      if (name.startsWith("on-")) {
        const bgName = name.slice(3);
        if (!surfaceHas(bgName)) continue;
        for (const mode of modes)
          pairs.push({ fg: `${group}.${name}`, bg: `surface.${bgName}`, mode });
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
