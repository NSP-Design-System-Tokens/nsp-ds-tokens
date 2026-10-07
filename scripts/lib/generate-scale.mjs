// Canonical OKLCH scale generator. ESM, zero external dependencies.
// Hand-rolled OKLCH engine with binary-search gamut clamping.
// computeOnColor: Opzione A corretta — real neutral grays, dark-mode fallback.

// ── Hex parse/format ─────────────────────────────────────────────────────────

function parseHex(hex) {
  const h = hex.replace(/^#/, "");
  let r,
    g,
    b,
    a = 1;
  if (h.length === 3 || h.length === 4) {
    r = parseInt(h[0] + h[0], 16) / 255;
    g = parseInt(h[1] + h[1], 16) / 255;
    b = parseInt(h[2] + h[2], 16) / 255;
    if (h.length === 4) a = parseInt(h[3] + h[3], 16) / 255;
  } else if (h.length === 6 || h.length === 8) {
    r = parseInt(h.slice(0, 2), 16) / 255;
    g = parseInt(h.slice(2, 4), 16) / 255;
    b = parseInt(h.slice(4, 6), 16) / 255;
    if (h.length === 8) a = parseInt(h.slice(6, 8), 16) / 255;
  } else {
    throw new Error(`Invalid hex: ${hex}`);
  }
  return { r, g, b, a };
}

function toHex(r, g, b) {
  const cl = (v) => Math.max(0, Math.min(1, v));
  const byte = (v) =>
    Math.round(cl(v) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

function normalizeHex(hex) {
  const { r, g, b } = parseHex(hex);
  return toHex(r, g, b);
}

// ── sRGB gamma ───────────────────────────────────────────────────────────────

function linearize(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function gammaEncode(c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

// ── OKLab ↔ linear sRGB ─────────────────────────────────────────────────────

function linearRGBtoOKLab(r, g, b) {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

function oklabToLinearRGB(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

// ── OKLCH ↔ OKLab ────────────────────────────────────────────────────────────

function oklchToOKLab(l, c, h) {
  const hRad = (h * Math.PI) / 180;
  return { L: l, a: c * Math.cos(hRad), b: c * Math.sin(hRad) };
}

function oklabToOKLCH(L, a, b) {
  const C = Math.sqrt(a * a + b * b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c: C, h };
}

// ── Conversions ──────────────────────────────────────────────────────────────

export function hexToOKLCH(hex) {
  const { r, g, b } = parseHex(hex);
  const lab = linearRGBtoOKLab(linearize(r), linearize(g), linearize(b));
  return oklabToOKLCH(lab.L, lab.a, lab.b);
}

function oklchToLinearRGB(l, c, h) {
  const { L, a, b } = oklchToOKLab(l, c, h);
  return oklabToLinearRGB(L, a, b);
}

function inGamut(r, g, b) {
  const E = 1e-6;
  return (
    r >= -E && r <= 1 + E && g >= -E && g <= 1 + E && b >= -E && b <= 1 + E
  );
}

function clampChroma(l, c, h) {
  let rgb = oklchToLinearRGB(l, c, h);
  if (inGamut(rgb.r, rgb.g, rgb.b)) return c;
  let lo = 0,
    hi = c;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    rgb = oklchToLinearRGB(l, mid, h);
    if (inGamut(rgb.r, rgb.g, rgb.b)) lo = mid;
    else hi = mid;
  }
  return lo;
}

export function formatHexOKLCH(l, c, h) {
  const cc = clampChroma(l, c, h);
  const rgb = oklchToLinearRGB(l, cc, h);
  return toHex(gammaEncode(rgb.r), gammaEncode(rgb.g), gammaEncode(rgb.b));
}

// ── Contrast math ────────────────────────────────────────────────────────────

export function composeOver(fg, bg) {
  let br = bg.r,
    bgc = bg.g,
    bb = bg.b;
  if (bg.a < 1) {
    br = bg.a * br + (1 - bg.a);
    bgc = bg.a * bgc + (1 - bg.a);
    bb = bg.a * bb + (1 - bg.a);
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

export function contrastRatio(fgHex, bgHex) {
  const fg = parseHex(fgHex);
  const bg = parseHex(bgHex);
  const fgEff = composeOver(fg, bg);
  const bgEff =
    bg.a < 1
      ? composeOver(bg, { r: 1, g: 1, b: 1, a: 1 })
      : { r: bg.r, g: bg.g, b: bg.b };
  const l1 = luminance(fgEff);
  const l2 = luminance(bgEff);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

// ── Neutral values from tokens/core/color.json ───────────────────────────────
//   gray.1:  light=#fcfcfc  dark=#111111  → palette.neutral.1
//   gray.12: light=#202020  dark=#eeeeee  → palette.neutral.12
//   white:   #ffffff                      → palette.neutral.0

export const NEUTRALS = {
  light: {
    light: { hex: "#fcfcfc", ref: "{palette.neutral.1}" },
    dark: { hex: "#202020", ref: "{palette.neutral.12}" },
  },
  dark: {
    light: { hex: "#eeeeee", ref: "{palette.neutral.12}" },
    dark: { hex: "#111111", ref: "{palette.neutral.1}" },
  },
  fallback: { hex: "#ffffff", ref: "{palette.neutral.0}" },
};

// ── computeOnColor (Opzione A corretta) ──────────────────────────────────────

export function computeOnColor(backgroundHex, mode) {
  const cands = NEUTRALS[mode];
  const rLight = contrastRatio(cands.light.hex, backgroundHex);
  const rDark = contrastRatio(cands.dark.hex, backgroundHex);

  let chosen, ratio;
  if (rLight >= rDark) {
    chosen = cands.light;
    ratio = rLight;
  } else {
    chosen = cands.dark;
    ratio = rDark;
  }

  const passed = ratio >= 4.5;

  if (mode === "dark" && !passed) {
    const rFallback = contrastRatio(NEUTRALS.fallback.hex, backgroundHex);
    if (rFallback > ratio) {
      return {
        hex: NEUTRALS.fallback.hex,
        ref: NEUTRALS.fallback.ref,
        ratio: rFallback,
        passed: rFallback >= 4.5,
        fallback: true,
      };
    }
  }

  return { hex: chosen.hex, ref: chosen.ref, ratio, passed, fallback: false };
}

// ── Scale generation ─────────────────────────────────────────────────────────

export function generateScale(anchorHex) {
  const base = hexToOKLCH(anchorHex);

  const LIGHT_L = [
    0.985,
    0.97,
    0.94,
    0.91,
    0.87,
    0.82,
    0.74,
    0.63,
    base.l,
    base.l - 0.05,
    base.l - 0.12,
    base.l - 0.22,
  ];
  const DARK_L = [
    0.1,
    0.14,
    0.19,
    0.24,
    0.28,
    0.32,
    0.37,
    0.4,
    base.l,
    base.l + 0.06,
    base.l + 0.18,
    base.l + 0.32,
  ];

  const lightSteps = LIGHT_L.map((l, i) =>
    formatHexOKLCH(l, base.c * (i < 8 ? 0.6 + i * 0.05 : 1), base.h),
  );
  const darkSteps = DARK_L.map((l, i) =>
    formatHexOKLCH(l, base.c * (i < 8 ? 0.5 + i * 0.08 : 1), base.h),
  );

  const anchor = normalizeHex(anchorHex);
  lightSteps[8] = anchor;
  darkSteps[8] = anchor;

  return { lightSteps, darkSteps, anchor };
}

// ── Step selection ───────────────────────────────────────────────────────────

export function pickTextStep(lightSteps) {
  const SURFACE_CARD = "#f9f9f9";
  const candidates = [8, 9, 10, 11];
  let best = null;
  for (const idx of candidates) {
    const hex = lightSteps[idx];
    const r = contrastRatio(hex, SURFACE_CARD);
    if (r >= 4.5) return { step: idx + 1, hex, ratio: r, passed: true };
    if (!best || r > best.ratio) best = { idx, hex, ratio: r };
  }
  return {
    step: best.idx + 1,
    hex: best.hex,
    ratio: best.ratio,
    passed: false,
  };
}

export function pickIconStep(lightSteps) {
  const candidates = [8, 9, 10, 11, 7];
  let best = null;
  for (const idx of candidates) {
    const hex = lightSteps[idx];
    const r = contrastRatio(hex, "#ffffff");
    if (r >= 3.0) return { step: idx + 1, hex, ratio: r, passed: true };
    if (!best || r > best.ratio) best = { idx, hex, ratio: r };
  }
  return {
    step: best.idx + 1,
    hex: best.hex,
    ratio: best.ratio,
    passed: false,
  };
}

// ── Token tree builders ──────────────────────────────────────────────────────

export function buildColorTree(lightSteps, darkSteps, origin) {
  const tree = { $extensions: { nsp: { origin } } };
  for (let i = 0; i < 12; i++) {
    tree[String(i + 1)] = {
      $type: "color",
      $value: lightSteps[i],
      $extensions: {
        "com.figma.modes": { light: lightSteps[i], dark: darkSteps[i] },
      },
    };
  }
  return tree;
}

export function brandSlot(hueRef, origin) {
  const slot = {};
  for (let i = 1; i <= 12; i++)
    slot[String(i)] = { $type: "color", $value: `{${hueRef}.${i}}` };
  slot.default = { $type: "color", $value: `{${hueRef}.9}` };
  slot.subtle = { $type: "color", $value: `{${hueRef}.3}` };
  slot.hover = { $type: "color", $value: `{${hueRef}.10}` };
  slot.$extensions = { nsp: { origin } };
  return slot;
}

export function ghostSlot(hueRef, origin) {
  const slot = {};
  for (let i = 1; i <= 12; i++)
    slot[String(i)] = { $type: "color", $value: `{${hueRef}.${i}}` };
  slot.default = { $type: "color", $value: `{${hueRef}.3}` };
  slot.hover = { $type: "color", $value: `{${hueRef}.4}` };
  slot.active = { $type: "color", $value: `{${hueRef}.5}` };
  slot.text = { $type: "color", $value: `{${hueRef}.11}` };
  slot.$extensions = { nsp: { origin } };
  return slot;
}

export function graySlot(origin) {
  const slot = {};
  for (let i = 1; i <= 12; i++)
    slot[String(i)] = { $type: "color", $value: `{palette.neutral.${i}}` };
  slot.default = { $type: "color", $value: "{palette.neutral.9}" };
  slot.$extensions = { nsp: { origin } };
  return slot;
}
