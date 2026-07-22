// The gate. Fails the build on dangling references, incomplete mode coverage,
// naming violations, or unknown types. This is what keeps the system honest as
// it grows: a broken alias or a dark value someone forgot to add stops CI.

import {
  loadMerged, eachLeaf, listModes, isLeaf,
  COLOR_MODE_GROUPS, RESP_MODE_GROUPS,
} from "./lib/tokens.mjs";

const merged = loadMerged();
const errors = [];

const TYPES = new Set([
  "color", "dimension", "number", "fontFamily", "fontWeight",
  "typography", "shadow", "string", "boolean", "duration", "cubicBezier",
]);
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// 1. collect every leaf path
const paths = new Set();
eachLeaf(merged, (n, path) => paths.add(path.join(".")));

const refsIn = (val) => {
  const acc = [];
  const scan = (v) => {
    if (typeof v === "string") {
      for (const m of v.matchAll(/\{([^}]+)\}/g)) acc.push(m[1]);
    } else if (v && typeof v === "object") {
      Object.values(v).forEach(scan);
    }
  };
  scan(val);
  return acc;
};

// 2. per-leaf checks: type, naming, reference integrity (value + modes)
eachLeaf(merged, (n, path) => {
  const id = path.join(".");
  if (!TYPES.has(n.$type)) errors.push(`unknown $type "${n.$type}" at ${id}`);
  for (const seg of path) {
    if (!NAME.test(seg)) errors.push(`naming: "${seg}" in ${id} is not lower kebab-case`);
  }
  const modes = n.$extensions?.["com.figma.modes"] ?? {};
  const allRefs = [...refsIn(n.$value), ...Object.values(modes).flatMap(refsIn)];
  for (const r of allRefs) {
    if (!paths.has(r)) errors.push(`dangling reference {${r}} at ${id}`);
  }
});

// 3. mode coverage per axis
function checkAxis(groups, label) {
  for (const g of groups) {
    if (!(g in merged)) continue;
    const union = listModes(merged[g]);
    if (!union.length) continue;
    eachLeaf(merged[g], (n, path) => {
      const modes = n.$extensions?.["com.figma.modes"];
      if (!modes) return; // static token in a moded group is allowed
      for (const m of union) {
        if (!(m in modes)) {
          errors.push(`${label}: ${["", g, ...path].join(".").slice(1)} missing mode "${m}"`);
        }
      }
    });
  }
}
checkAxis(COLOR_MODE_GROUPS, "color mode");
checkAxis(RESP_MODE_GROUPS, "responsive mode");

if (errors.length) {
  console.error(`validate: ${errors.length} problem(s)`);
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}
console.log(`validate: ok (${paths.size} tokens)`);
