// Shared helpers: load the modular source, merge it, and reason about tiers
// and mode axes. Every build script and the validator sit on top of this.

import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const TOKENS_DIR = resolve(ROOT, "tokens");

// top-level key -> Figma collection. Order is meaningful (numbered in Figma).
export const TIERS = {
  "1. Primitives": [
    "color",
    "size",
    "font",
    "spacing",
    "motion",
    "z-index",
    "border-width",
    "radius",
  ],
  "2. Brand": ["palette"],
  "3. Semantic": [
    "surface",
    "text",
    "stroke",
    "logo",
    "icon",
    "emphasis-brand",
    "emphasis",
    "typography",
    "shadow",
    "inset",
    "stack",
    "inline",
    "section-gap",
    "page-margin",
    "section",
  ],
  "4. Responsive": ["type-size", "breakpoint", "grid", "visible"],
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
export const RESP_MODE_GROUPS = ["type-size"];
export const LAYOUT_MODE_GROUPS = ["grid", "visible", "section"];

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
  const files = readdirSync(TOKENS_DIR, { recursive: true })
    .filter((f) => f.endsWith(".json"))
    .sort();
  const merged = {};
  for (const f of files) {
    const data = JSON.parse(readFileSync(resolve(TOKENS_DIR, f), "utf8"));
    deepMerge(merged, data, f);
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
