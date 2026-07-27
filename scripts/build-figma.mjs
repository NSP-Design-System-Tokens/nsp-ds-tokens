// Adapter: modular source -> dist/figma-variables.json + dist/figma-styles.json
//
// Figma Variables are sRGB and hold raw numbers, and cannot hold composite
// tokens. So: colors -> hex, dimensions -> unitless numbers, typography and
// shadow are dropped from variables. Typography composites instead become Figma
// text styles (one per responsive mode), which is how a composite crosses into
// Figma. Aliases are kept; the plugin resolves them.

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { parse, formatHex, clampChroma } from "culori";
import { ROOT, loadMerged, isLeaf, TIERS } from "./lib/tokens.mjs";

const merged = loadMerged();

const toHex = (v) => {
  if (typeof v !== "string" || v.startsWith("{")) return v;
  if (/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) return v;
  return formatHex(clampChroma(parse(v), "oklch"));
};
const toNum = (v) => (typeof v === "string" ? parseFloat(v) : v);

// Figma Variables accept only: color, number, boolean, string.
// Map DTCG types that have a direct Figma equivalent; the rest are excluded upstream.
const FIGMA_TYPE_MAP = {
  dimension: "number", // strip unit, keep value
  fontFamily: "string", // font name is a string variable
  fontWeight: "number", // numeric weight (300-900)
};

// convert one leaf to its Figma shape (by $type)
function figmaLeaf(node) {
  const conv = (val, type) => {
    if (typeof val === "string" && val.startsWith("{")) return val; // alias
    if (type === "color") return toHex(val);
    if (type === "dimension") return toNum(val);
    if (type === "fontWeight")
      return typeof val === "string" ? parseFloat(val) : val;
    return val;
  };
  const type = node.$type;
  const figType = FIGMA_TYPE_MAP[type] ?? type;
  const out = { $type: figType, $value: conv(node.$value, type) };
  const modes = node.$extensions?.["com.figma.modes"];
  if (modes) {
    const m = {};
    for (const [k, v] of Object.entries(modes)) m[k] = conv(v, type);
    out.$extensions = { "com.figma.modes": m };
  }
  return out;
}

function convertTree(tree) {
  if (isLeaf(tree)) return figmaLeaf(tree);
  const out = {};
  for (const [k, v] of Object.entries(tree))
    if (!k.startsWith("$")) out[k] = convertTree(v);
  return out;
}

// --- variables: regroup tiers into $collections, excluding composites ---
// motion excluded: duration + cubicBezier have no Figma Variable equivalent
const EXCLUDE = new Set(["typography", "shadow", "motion"]);
const collections = {};
for (const [tier, groups] of Object.entries(TIERS)) {
  const bucket = {};
  for (const g of groups) {
    if (g in merged && !EXCLUDE.has(g)) bucket[g] = convertTree(merged[g]);
  }
  if (Object.keys(bucket).length) collections[tier] = bucket;
}

mkdirSync(resolve(ROOT, "dist"), { recursive: true });
writeFileSync(
  resolve(ROOT, "dist/figma-variables.json"),
  JSON.stringify({ $collections: collections }, null, 2) + "\n",
);
console.log("figma  -> dist/figma-variables.json");

// --- text styles: resolve each typography composite, one style per mode ---
function getLeaf(path) {
  return path.split(".").reduce((o, k) => (o ? o[k] : undefined), merged);
}
function resolve1(ref, mode) {
  const leaf = getLeaf(ref.replace(/[{}]/g, ""));
  if (!leaf) return undefined;
  const modes = leaf.$extensions?.["com.figma.modes"];
  const val = modes && mode in modes ? modes[mode] : leaf.$value;
  return typeof val === "string" && val.startsWith("{")
    ? resolve1(val, mode)
    : val;
}
function modesOf(ref) {
  const leaf = getLeaf(ref.replace(/[{}]/g, ""));
  const m = leaf?.$extensions?.["com.figma.modes"];
  return m ? Object.keys(m) : [null];
}

const WEIGHT = {
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "SemiBold",
  700: "Bold",
};
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const textStyles = [];
for (const [name, node] of Object.entries(merged.typography ?? {})) {
  const c = node.$value;
  const family = resolve1(c.fontFamily);
  const weight = resolve1(c.fontWeight);
  const lh = resolve1(c.lineHeight);
  for (const mode of modesOf(c.fontSize)) {
    const size = toNum(resolve1(c.fontSize, mode));
    textStyles.push({
      name: `${cap(name)}/${mode ? cap(mode) : "Default"}`,
      fontFamily: family,
      fontStyle: WEIGHT[weight] ?? "Regular",
      fontSize: size,
      lineHeight: typeof lh === "number" ? `${Math.round(lh * 100)}%` : "AUTO",
      letterSpacing: "0px",
      textDecoration: "NONE",
      textCase: "ORIGINAL",
    });
  }
}

// --- grid styles: one per layout mode ---
const modeCap = (s) => s[0].toUpperCase() + s.slice(1);
const resolveNum = (refOrVal, mode) => {
  const v =
    typeof refOrVal === "string" && refOrVal.startsWith("{")
      ? resolve1(refOrVal, mode)
      : refOrVal;
  return typeof v === "string" ? parseFloat(v) : v;
};
const gridStyles = [];
for (const mode of ["desktop", "tablet", "mobile"]) {
  const g = merged.grid;
  if (!g) break;
  const colNode = g.columns;
  const gutNode = g.gutter;
  const marNode = g.margin;
  const pick = (node) =>
    node.$extensions?.["com.figma.modes"]?.[mode] ?? node.$value;
  gridStyles.push({
    name: `Grid/${modeCap(mode)}`,
    pattern: "COLUMNS",
    alignment: "STRETCH",
    count: resolveNum(pick(colNode), mode),
    gutterSize: resolveNum(pick(gutNode), mode),
    offset: resolveNum(pick(marNode), mode),
  });
}

writeFileSync(
  resolve(ROOT, "dist/figma-styles.json"),
  JSON.stringify({ textStyles, colorStyles: [], gridStyles }, null, 2) + "\n",
);
console.log(
  `figma  -> dist/figma-styles.json (${textStyles.length} text styles, ${gridStyles.length} grid styles)`,
);
