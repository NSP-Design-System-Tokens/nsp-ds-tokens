// Shared helpers: load the modular source, merge it, and reason about tiers
// and mode axes. Every build script and the validator sit on top of this.

import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const TOKENS_DIR = resolve(ROOT, "tokens");

// top-level key -> Figma collection. One mode axis per collection.
// "1. Primitives" — no modes (raw ramps, atoms)
// "2. Brand"      — no modes (palette roles)
// "3. Color Roles"— light / dark
// "4. Spacing"    — no modes (semantic spacing roles)
// "5. Layout"     — desktop / tablet / mobile
// "6. Type Scale" — base / md / lg
export const TIERS = {
  "1. Primitives": [
    "color",
    "font",
    "spacing",
    "motion",
    "z-index",
    "border-width",
    "radius",
  ],
  "2. Brand": ["palette"],
  "3. Color Roles": [
    "surface",
    "text",
    "stroke",
    "logo",
    "icon",
    "emphasis-brand",
    "emphasis",
    "typography",
    "shadow",
  ],
  "4. Spacing": ["inset", "stack", "inline"],
  "5. Layout": [
    "section-gap",
    "page-margin",
    "section",
    "grid",
    "visible",
    "type-size",
    "breakpoint",
  ],
};

// which top-level groups carry which mode axis
export const COLOR_MODE_GROUPS = [
  "surface",
  "text",
  "stroke",
  "logo",
  "icon",
  "emphasis-brand",
  "emphasis",
];
export const RESP_MODE_GROUPS = [];
export const LAYOUT_MODE_GROUPS = [
  "section-gap",
  "page-margin",
  "grid",
  "visible",
  "section",
  "type-size",
];

export const isLeaf = (n) => n && typeof n === "object" && "$value" in n;

function deepMerge(a, b, path = "") {
  for (const [k, v] of Object.entries(b)) {
    if (
      k in a &&
      isLeaf(a[k]) === false &&
      isLeaf(v) === false &&
      typeof a[k] === "object" &&
      typeof v === "object"
    ) {
      deepMerge(a[k], v, `${path}.${k}`);
    } else if (k in a) {
      throw new Error(`token collision at ${path}.${k} (defined in two files)`);
    } else {
      a[k] = v;
    }
  }
  return a;
}

export function loadMerged() {
  return loadMergedWith([]);
}

// Load base tokens from TOKENS_DIR then merge additional token directories on top.
// Used by brand project repos: loadMergedWith([resolve(brandRoot, "tokens")]).
// Order: base first, then each extra dir in array order. Callers must ensure no
// key collisions between base and extra (extraction script enforces this).
export function loadMergedWith(extraDirs = []) {
  const merged = {};
  for (const dir of [TOKENS_DIR, ...extraDirs]) {
    const files = readdirSync(dir, { recursive: true })
      .filter((f) => f.endsWith(".json"))
      .sort();
    for (const f of files) {
      const data = JSON.parse(readFileSync(resolve(dir, f), "utf8"));
      deepMerge(merged, data, f);
    }
  }
  return merged;
}

export function eachLeaf(tree, cb, path = []) {
  if (isLeaf(tree)) return cb(tree, path);
  if (!tree || typeof tree !== "object") return;
  for (const [k, v] of Object.entries(tree)) {
    if (k.startsWith("$")) continue;
    eachLeaf(v, cb, [...path, k]);
  }
}

export function listModes(subtree) {
  const modes = new Set();
  JSON.stringify(subtree, (k, v) => {
    if (k === "com.figma.modes" && v)
      Object.keys(v).forEach((m) => modes.add(m));
    return v;
  });
  return [...modes];
}

// return a copy of subtree with $value resolved to the given mode
export function pickMode(subtree, mode) {
  const walk = (n) => {
    if (isLeaf(n)) {
      const modes = n.$extensions?.["com.figma.modes"];
      const value = modes && mode in modes ? modes[mode] : n.$value;
      return { $type: n.$type, $value: value };
    }
    const out = {};
    for (const [k, v] of Object.entries(n))
      if (!k.startsWith("$")) out[k] = walk(v);
    return out;
  };
  return walk(subtree);
}

// pull the chosen top-level groups into a fresh tree
export function subtreeOf(merged, groups) {
  const out = {};
  for (const g of groups) if (g in merged) out[g] = merged[g];
  return out;
}
