// Build: modular source -> build/css/tokens.css + build/tailwind/tokens.cjs
//
// Fully chained: each tier references the tier below via var(), so the layer
// structure is visible in the output and responsive font sizes cascade for
// free. Two axes: color (light in :root, dark under [data-theme="dark"]) and
// responsive (mobile base in :root, min-width media queries bump type sizes).
// Composites are expanded (typography -> the four font-* custom properties,
// shadow -> a box-shadow string).

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT, loadMerged, eachLeaf, listModes } from "./lib/tokens.mjs";

const merged = loadMerged();

const refToVar = (v) =>
  String(v).replace(
    /\{([^}]+)\}/g,
    (_, p) => `var(--${p.replace(/\./g, "-")})`,
  );
const scalar = (v) => (typeof v === "string" ? refToVar(v) : String(v));
const bpWidth = (mode) => merged.breakpoint?.[mode]?.$value;

// emit `--group-path: value` for every leaf in a group, at an optional mode
function emitGroup(group, mode) {
  const tree = merged[group];
  if (!tree) return [];
  const lines = [];
  eachLeaf(tree, (n, path) => {
    const name = [group, ...path].join("-");
    const v =
      mode && n.$extensions?.["com.figma.modes"]?.[mode] !== undefined
        ? n.$extensions["com.figma.modes"][mode]
        : n.$value;
    const cssValue =
      n.$type === "cubicBezier" && Array.isArray(v)
        ? `cubic-bezier(${v.join(", ")})`
        : scalar(v);
    lines.push(`  --${name}: ${cssValue};`);
  });
  return lines;
}

// typography composite -> four expanded custom properties per token
function emitTypography() {
  const lines = [];
  for (const [name, node] of Object.entries(merged.typography ?? {})) {
    const c = node.$value;
    const map = {
      fontFamily: "font-family",
      fontWeight: "font-weight",
      fontSize: "font-size",
      lineHeight: "line-height",
      letterSpacing: "letter-spacing",
    };
    for (const [key, css] of Object.entries(map)) {
      if (c[key] !== undefined)
        lines.push(`  --typography-${name}-${css}: ${scalar(c[key])};`);
    }
  }
  return lines;
}

// shadow composite -> box-shadow string; $value may be a single object or an
// array of layers (DTCG allows both). Layers join with ", " for multi-shadow.
function emitShadow(mode) {
  const lines = [];
  for (const [name, node] of Object.entries(merged.shadow ?? {})) {
    const modes = node.$extensions?.["com.figma.modes"];
    const value = mode && modes && mode in modes ? modes[mode] : node.$value;
    if (!value) continue;
    const layers = Array.isArray(value) ? value : [value];
    const css = layers
      .map(
        (l) =>
          `${l.offsetX} ${l.offsetY} ${l.blur} ${l.spread} ${refToVar(l.color)}`,
      )
      .join(", ");
    lines.push(`  --shadow-${name}: ${css};`);
  }
  return lines;
}

const block = (sel, lines) => `${sel} {\n${lines.join("\n")}\n}`;

// --- :root : primitives + palette + base sizes + light semantic + composites ---
const rootLines = [
  ...emitGroup("color"),
  ...emitGroup("size"),
  ...emitGroup("font"),
  ...emitGroup("spacing"),
  ...emitGroup("motion"),
  ...emitGroup("z-index"),
  ...emitGroup("border-width"),
  ...emitGroup("radius"),
  ...emitGroup("palette"),
  ...emitGroup("type-size", "base"),
  ...emitGroup("breakpoint"),
  ...emitGroup("grid", "mobile"),
  ...emitGroup("surface", "light"),
  ...emitGroup("text", "light"),
  ...emitGroup("stroke", "light"),
  ...emitGroup("logo", "light"),
  ...emitGroup("icon", "light"),
  ...emitGroup("emphasis-brand", "light"),
  ...emitGroup("emphasis", "light"),
  ...emitGroup("inset"),
  ...emitGroup("stack"),
  ...emitGroup("inline"),
  ...emitGroup("section-gap"),
  ...emitGroup("page-margin"),
  ...emitGroup("section", "mobile"),
  ...emitTypography(),
  ...emitShadow("light"),
];

// --- dark : semantic color overrides only ---
const darkLines = [
  ...emitGroup("surface", "dark"),
  ...emitGroup("text", "dark"),
  ...emitGroup("stroke", "dark"),
  ...emitGroup("logo", "dark"),
  ...emitGroup("icon", "dark"),
  ...emitGroup("emphasis-brand", "dark"),
  ...emitGroup("emphasis", "dark"),
  ...emitShadow("dark"),
];

// --- mobile-first media queries for responsive type sizes ---
const respModes = listModes(merged["type-size"]).filter((m) => m !== "base");
respModes.sort(
  (a, b) => (parseFloat(bpWidth(a)) || 0) - (parseFloat(bpWidth(b)) || 0),
);
const queries = respModes
  .filter((m) => bpWidth(m))
  .map(
    (m) =>
      `@media (min-width: ${bpWidth(m)}) {\n${block(":root", emitGroup("type-size", m)).replace(/^/gm, "  ")}\n}`,
  );

// --- mobile-first media queries for layout tokens (grid + section) ---
// prefer breakpoint.threshold.* (CSS switch point) over breakpoint.* (Figma frame)
const layoutBpWidth = (mode) => {
  const thresh = merged.breakpoint?.threshold?.[mode]?.$value;
  const direct = merged.breakpoint?.[mode]?.$value;
  const v = thresh !== undefined ? thresh : direct;
  if (v === undefined) return null;
  return typeof v === "number" ? `${v}px` : v;
};
const layoutGroups = ["grid", "section"];
const layoutModes = ["tablet", "desktop"]; // ascending breakpoint order
const layoutQueries = layoutModes
  .filter((m) => layoutBpWidth(m))
  .map((m) => {
    const inner = layoutGroups.flatMap((g) => emitGroup(g, m));
    return `@media (min-width: ${layoutBpWidth(m)}) {\n${block(":root", inner).replace(/^/gm, "  ")}\n}`;
  });

const css =
  [
    "/* Generated. Edit tokens/, not this file. */",
    block(":root", rootLines),
    block('[data-theme="dark"]', darkLines),
    ...queries,
    ...layoutQueries,
  ].join("\n\n") + "\n";

mkdirSync(resolve(ROOT, "build/css"), { recursive: true });
writeFileSync(resolve(ROOT, "build/css/tokens.css"), css);
console.log("css    -> build/css/tokens.css");

// --- tailwind preset: var() maps ---
const colors = {},
  spacing = {},
  fontSize = {};
const collect = (group, bag, strip) =>
  eachLeaf(merged[group] ?? {}, (n, path) => {
    const full = [group, ...path].join("-");
    bag[strip ? path.join("-") : full] = `var(--${full})`;
  });
for (const g of [
  "color",
  "palette",
  "surface",
  "text",
  "stroke",
  "logo",
  "icon",
  "emphasis-brand",
  "emphasis",
])
  collect(g, colors, false);
collect("size", spacing, true);
collect("spacing", spacing, true);
collect("type-size", fontSize, true);

mkdirSync(resolve(ROOT, "build/tailwind"), { recursive: true });
writeFileSync(
  resolve(ROOT, "build/tailwind/tokens.cjs"),
  "// Generated. Spread into tailwind.config theme.extend.\nmodule.exports = " +
    JSON.stringify({ colors, spacing, fontSize }, null, 2) +
    ";\n",
);
console.log("css    -> build/tailwind/tokens.cjs");
