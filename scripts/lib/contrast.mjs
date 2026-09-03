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

// Source of truth: scripts/lib/contrast-exemptions.js (see that file for all
// entries and per-entry rationale). figma-token-manager/code.js consumes the
// same data via figma-token-manager/scripts/sync-exemptions.mjs.
import { CONTRAST_EXEMPT } from "./contrast-exemptions.js";
export { CONTRAST_EXEMPT };

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
