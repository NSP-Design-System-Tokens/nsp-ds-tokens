// D3 extraction: read merged source, split by origin, write two inspection trees.
//
// Outputs (read-only — does NOT touch tokens/):
//   dist/brand-poli/tokens/  — brand-poli primitives + palette slots + semantic leaves
//   dist/base/tokens/        — everything else (self-consistent base library)
//
// Uses deriveLeafOrigin / deriveSemanticOrigins from lib/origin.mjs (canonical,
// same function the validator uses — no duplicate logic).

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT, loadMerged, isLeaf, eachLeaf } from "./lib/tokens.mjs";
import {
  paletteSlotOrigins,
  deriveSemanticOrigins,
  refsIn,
} from "./lib/origin.mjs";

const merged = loadMerged();

// --- Build origin maps ---
const slotOrigins = paletteSlotOrigins(merged); // palette.slotName → "base"|"brand-poli"|null
const { results: semanticOrigins } = deriveSemanticOrigins(merged);

// Set of "group.key.key..." paths for brand-poli semantic leaves (graph-derived)
const brandPoliSemanticPaths = new Set(
  semanticOrigins.filter((r) => r.origin === "brand-poli").map((r) => r.path),
);

// Brand role names derived from palette slot origins (only brand-poli slots).
// Does NOT include base slot names (neutral, error, success, warning) — those must
// never promote a token that happens to contain "neutral" in its name.
const brandRoleNames = Object.entries(slotOrigins)
  .filter(([, o]) => o === "brand-poli")
  .map(([slot]) => slot); // ["primary", "secondary", "tertiary", "accent"]

// Heuristic: a semantic token is brand-poli if any segment of its path contains
// a brand role name as a substring (catches "tertiary-dark", "on-primary", etc.).
// Rationale: the graph only sees referenced values; meaning-by-name is a stronger
// signal when a token's semantic existence depends on a brand role.
function isHeuristicBrandPoli(path) {
  return path
    .split(".")
    .some((seg) => brandRoleNames.some((r) => seg.includes(r)));
}

// Combined predicate: graph OR heuristic
function isBrandPoliSemantic(path) {
  return brandPoliSemanticPaths.has(path) || isHeuristicBrandPoli(path);
}

// --- Helpers ---
function originOfColorEntry(node) {
  return node && node.$extensions && node.$extensions.nsp
    ? node.$extensions.nsp.origin
    : null;
}

// Split top-level color entries (hues + leaf atoms like white/black)
function splitColor(colorTree) {
  const brand = {};
  const base = {};
  for (const [k, v] of Object.entries(colorTree)) {
    if (k.startsWith("$")) continue;
    const origin = originOfColorEntry(v);
    (origin === "brand-poli" ? brand : base)[k] = v;
  }
  return { brand, base };
}

// Split palette slots by declared origin
function splitPalette(paletteTree) {
  const brand = {};
  const base = {};
  if (paletteTree.$extensions) {
    brand.$extensions = paletteTree.$extensions;
    base.$extensions = paletteTree.$extensions;
  }
  for (const [slot, node] of Object.entries(paletteTree)) {
    if (slot.startsWith("$")) continue;
    const origin = slotOrigins[slot];
    (origin === "brand-poli" ? brand : base)[slot] = node;
  }
  return { brand, base };
}

// Split a semantic group tree: keep only leaves whose "group.path" is (or isn't) in the set
function splitSemanticGroup(groupName, groupTree) {
  const prefix = groupName + ".";

  function keep(predicate, node, path = []) {
    if (!node || typeof node !== "object") return null;
    if (isLeaf(node)) {
      return predicate(prefix + path.join(".")) ? node : null;
    }
    const out = {};
    let hasChild = false;
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith("$")) {
        out[k] = v; // preserve $extensions, $type, etc. at group level
        continue;
      }
      const child = keep(predicate, v, [...path, k]);
      if (child !== null) {
        out[k] = child;
        hasChild = true;
      }
    }
    return hasChild ? out : null;
  }

  const brand = keep((p) => isBrandPoliSemantic(p), groupTree);
  const base = keep((p) => !isBrandPoliSemantic(p), groupTree);
  return { brand, base };
}

// --- Split all layers ---
const { brand: colorBrand, base: colorBase } = splitColor(merged.color ?? {});
const { brand: paletteBrand, base: paletteBase } = splitPalette(
  merged.palette ?? {},
);

const SEMANTIC_GROUPS = [
  "surface",
  "text",
  "stroke",
  "logo",
  "icon",
  "emphasis-brand",
  "emphasis",
];
const semanticBrand = {};
const semanticBase = {};
for (const g of SEMANTIC_GROUPS) {
  if (!(g in merged)) continue;
  const { brand, base } = splitSemanticGroup(g, merged[g]);
  if (brand) semanticBrand[g] = brand;
  if (base) semanticBase[g] = base;
}

// Brand semantic groups must NOT carry group-level $extensions (e.g. com.figma.scoping).
// Base already provides them; deepMerge cannot handle array values (integer index collision).
for (const tree of Object.values(semanticBrand)) {
  delete tree.$extensions;
}

// --- Count leaves ---
function count(tree) {
  let n = 0;
  eachLeaf(tree, () => n++);
  return n;
}
function countAll(obj) {
  return Object.values(obj).reduce((s, t) => s + count(t), 0);
}

// Non-color tokens all go to base unchanged
const NON_SPLIT_BASE_GROUPS = [
  "font",
  "spacing",
  "motion",
  "z-index",
  "border-width",
  "radius",
  "type-size",
  "breakpoint",
  "grid",
  "section-gap",
  "page-margin",
  "section",
  "visible",
  "inset",
  "stack",
  "inline",
  "typography",
  "shadow",
];

const brandCounts = {
  "color primitives": count(colorBrand),
  "palette slots": count(paletteBrand),
  "semantic tokens": countAll(semanticBrand),
};
const baseCounts = {
  "color primitives": count(colorBase),
  "palette slots": count(paletteBase),
  "semantic tokens": countAll(semanticBase),
};
for (const g of NON_SPLIT_BASE_GROUPS) {
  if (g in merged) baseCounts[g] = count(merged[g]);
}

const totalBrand = Object.values(brandCounts).reduce((a, b) => a + b, 0);
const totalBase = Object.values(baseCounts).reduce((a, b) => a + b, 0);
let totalSystem = 0;
eachLeaf(merged, () => totalSystem++);

// --- Reference integrity checks ---
// BASE: must have zero refs to brand-poli palette slots
const brandPoliSlots = new Set(
  Object.entries(slotOrigins)
    .filter(([, o]) => o === "brand-poli")
    .map(([s]) => `palette.${s}`),
);
const baseDanglingRefs = [];
function scanBaseRefs(tree, groupName) {
  eachLeaf(tree, (n, path) => {
    const modes = (n.$extensions && n.$extensions["com.figma.modes"]) ?? {};
    const allRefs = [
      ...refsIn(n.$value),
      ...Object.values(modes).flatMap(refsIn),
    ];
    for (const r of allRefs) {
      const top2 = r.split(".").slice(0, 2).join(".");
      if (brandPoliSlots.has(top2)) {
        baseDanglingRefs.push(`${groupName}.${path.join(".")} → {${r}}`);
      }
    }
  });
}
scanBaseRefs(colorBase, "color");
scanBaseRefs(paletteBase, "palette");
for (const [g, tree] of Object.entries(semanticBase)) scanBaseRefs(tree, g);

// BRAND: refs to base color primitives (expected cross-repo refs)
const baseColorGroups = new Set(Object.keys(colorBase));
const crossRepoRefs = new Set();
function scanCrossRepoRefs(tree, groupName) {
  eachLeaf(tree, (n, path) => {
    const modes = (n.$extensions && n.$extensions["com.figma.modes"]) ?? {};
    const allRefs = [
      ...refsIn(n.$value),
      ...Object.values(modes).flatMap(refsIn),
    ];
    for (const r of allRefs) {
      const top = r.split(".")[0];
      if (top === "color" && baseColorGroups.has(r.split(".")[1]))
        crossRepoRefs.add(r.split(".").slice(0, 2).join("."));
    }
  });
}
scanCrossRepoRefs(paletteBrand, "palette");
for (const [g, tree] of Object.entries(semanticBrand))
  scanCrossRepoRefs(tree, g);

// --- Write outputs ---
const outBrand = resolve(ROOT, "dist/brand-poli");
const outBase = resolve(ROOT, "dist/base");
for (const d of [
  `${outBrand}/tokens/core`,
  `${outBrand}/tokens/brand`,
  `${outBrand}/tokens/semantic`,
  `${outBase}/tokens/core`,
  `${outBase}/tokens/brand`,
  `${outBase}/tokens/semantic`,
])
  mkdirSync(d, { recursive: true });

const write = (path, data) =>
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");

// brand-poli
write(`${outBrand}/tokens/core/color.json`, { color: colorBrand });
write(`${outBrand}/tokens/brand/poli.json`, { palette: paletteBrand });
write(`${outBrand}/tokens/semantic/color.json`, semanticBrand);

// base
write(`${outBase}/tokens/core/color.json`, { color: colorBase });
write(`${outBase}/tokens/brand/poli.json`, { palette: paletteBase });
write(`${outBase}/tokens/semantic/color.json`, semanticBase);

// --- Collect heuristic promotions (tokens graph missed, heuristic caught) ---
const heuristicPromoted = semanticOrigins
  .filter((r) => r.origin === "base" && isHeuristicBrandPoli(r.path))
  .map((r) => r.path);

// --- Report ---
console.log("=== D3 Extraction Report ===\n");

console.log("brand-poli tokens (→ dist/brand-poli/):");
for (const [k, n] of Object.entries(brandCounts))
  console.log(`  ${k.padEnd(22)}: ${n}`);
console.log(`  ${"TOTAL".padEnd(22)}: ${totalBrand}`);

console.log("\nbase library tokens (→ dist/base/):");
for (const [k, n] of Object.entries(baseCounts))
  console.log(`  ${k.padEnd(22)}: ${n}`);
console.log(`  ${"TOTAL".padEnd(22)}: ${totalBase}`);

console.log(
  `\nsum check: ${totalBrand} + ${totalBase} = ${totalBrand + totalBase} (system total: ${totalSystem}) — ${totalBrand + totalBase === totalSystem ? "OK ✓" : "MISMATCH ✗"}`,
);

console.log("\nheuristic promotions (graph=base, heuristic=brand-poli):");
if (heuristicPromoted.length === 0) {
  console.log("  none");
} else {
  for (const p of heuristicPromoted) console.log(`  + ${p}`);
}

console.log("\nref integrity:");
if (baseDanglingRefs.length === 0) {
  console.log("  base → brand-poli refs : 0 (base is self-consistent ✓)");
} else {
  console.log(
    `  base → brand-poli refs : ${baseDanglingRefs.length} UNEXPECTED:`,
  );
  for (const r of baseDanglingRefs) console.log(`    ! ${r}`);
}
if (crossRepoRefs.size === 0) {
  console.log("  brand cross-repo refs  : 0");
} else {
  console.log(
    `  brand cross-repo refs  : ${crossRepoRefs.size} (expected — palette.* → base color primitives):`,
  );
  for (const r of [...crossRepoRefs].sort()) console.log(`    ~ ${r}`);
}
