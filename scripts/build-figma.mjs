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

// Figma variable names cannot contain ".". Decimal keys like "0.5" must become "0-5".
// Apply the same transform inside alias strings so references still resolve.
const figKey = (k) => (/^\d+\.\d+$/.test(k) ? k.replace(".", "-") : k);
const sanitizeAliases = (v) =>
  typeof v === "string"
    ? v.replace(
        /\{([^}]+)\}/g,
        (_, p) => `{${p.replace(/(\d+)\.(\d+)/g, "$1-$2")}}`,
      )
    : v;

// Figma treats the first mode in a collection as the default shown to the designer.
// Designers work desktop/light-first, so we reorder modes before writing the Figma
// dist. CSS output (build-css.mjs) keeps mobile/light-first — the two outputs serve
// opposite conventions: Figma = desktop-first, CSS = mobile-first.
const FIGMA_MODE_ORDER = ["desktop", "tablet", "mobile", "light", "dark"];
function reorderModesForFigma(modes) {
  const out = {};
  for (const k of FIGMA_MODE_ORDER) if (k in modes) out[k] = modes[k];
  for (const [k, v] of Object.entries(modes)) if (!(k in out)) out[k] = v;
  return out;
}

// Walk merged from root along path, returning the last declared com.figma.scoping array.
// Group-level $extensions["com.figma.scoping"] is inherited by all descendant leaves.
function resolveScopes(path) {
  let node = merged;
  let scopes = null;
  for (const seg of path) {
    const ext = node?.$extensions?.["com.figma.scoping"];
    if (Array.isArray(ext)) scopes = ext;
    node = node?.[seg];
  }
  const leafExt = node?.$extensions?.["com.figma.scoping"];
  if (Array.isArray(leafExt)) scopes = leafExt;
  return scopes;
}

// convert one leaf to its Figma shape (by $type)
function figmaLeaf(node, scopes) {
  const conv = (val, type) => {
    if (typeof val === "string" && val.startsWith("{"))
      return sanitizeAliases(val);
    if (type === "color") return toHex(val);
    if (type === "dimension") return toNum(val);
    if (type === "fontWeight")
      return typeof val === "string" ? parseFloat(val) : val;
    return val;
  };
  const type = node.$type;
  const figType = FIGMA_TYPE_MAP[type] ?? type;
  const out = { $type: figType, $value: conv(node.$value, type) };
  if (scopes !== null) out.scopes = scopes;
  const modes = node.$extensions?.["com.figma.modes"];
  if (modes) {
    const m = {};
    for (const [k, v] of Object.entries(reorderModesForFigma(modes)))
      m[k] = conv(v, type);
    out.$extensions = { "com.figma.modes": m };
  }
  return out;
}

// path starts at group name so resolveScopes can walk from merged root
function convertTree(tree, path = []) {
  if (isLeaf(tree)) return figmaLeaf(tree, resolveScopes(path));
  const out = {};
  for (const [k, v] of Object.entries(tree))
    if (!k.startsWith("$")) out[figKey(k)] = convertTree(v, [...path, k]);
  return out;
}

// --- variables: regroup tiers into $collections, excluding composites ---
// motion excluded: duration + cubicBezier have no Figma Variable equivalent
const EXCLUDE = new Set(["typography", "shadow", "motion"]);
const collections = {};
for (const [tier, groups] of Object.entries(TIERS)) {
  const bucket = {};
  for (const g of groups) {
    if (g in merged && !EXCLUDE.has(g)) bucket[g] = convertTree(merged[g], [g]);
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

// resolve a composite property: skip resolution for raw literal strings (textCase, textDecoration)
const resolveOrLiteral = (val, mode) =>
  typeof val === "string" && val.startsWith("{") ? resolve1(val, mode) : val;

const textStyles = [];
for (const [name, node] of Object.entries(merged.typography ?? {})) {
  const c = node.$value;
  const family = resolve1(c.fontFamily);
  const weight = resolve1(c.fontWeight);
  const lh = resolve1(c.lineHeight);
  for (const mode of modesOf(c.fontSize)) {
    const size = toNum(resolve1(c.fontSize, mode));
    // letterSpacing stored as em (e.g. "0.025em") → convert to px relative to fontSize
    const lsRaw = resolveOrLiteral(c.letterSpacing, mode);
    const lsPx = lsRaw ? parseFloat(lsRaw) * size : 0;
    textStyles.push({
      name: `${cap(name)}/${mode ? cap(mode) : "Default"}`,
      fontFamily: family,
      fontStyle: WEIGHT[weight] ?? "Regular",
      fontSize: size,
      lineHeight: typeof lh === "number" ? `${Math.round(lh * 100)}%` : "AUTO",
      letterSpacing: `${lsPx.toFixed(2)}px`,
      textDecoration: resolveOrLiteral(c.textDecoration, mode) ?? "NONE",
      textCase: resolveOrLiteral(c.textCase, mode) ?? "ORIGINAL",
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
