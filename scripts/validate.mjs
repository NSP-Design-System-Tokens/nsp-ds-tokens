// The gate. Fails the build on dangling references, incomplete mode coverage,
// naming violations, or unknown types. This is what keeps the system honest as
// it grows: a broken alias or a dark value someone forgot to add stops CI.

import {
  loadMerged,
  eachLeaf,
  listModes,
  isLeaf,
  TIERS,
  COLOR_MODE_GROUPS,
  RESP_MODE_GROUPS,
  LAYOUT_MODE_GROUPS,
} from "./lib/tokens.mjs";
import { checkContrast } from "./lib/contrast.mjs";
import {
  refsIn,
  deriveSemanticOrigins,
  paletteSlotOrigins,
  isValidOrigin,
} from "./lib/origin.mjs";

const merged = loadMerged();
const errors = [];

const TYPES = new Set([
  "color",
  "dimension",
  "number",
  "fontFamily",
  "fontWeight",
  "typography",
  "shadow",
  "string",
  "boolean",
  "duration",
  "cubicBezier",
]);
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$|^\d+\.\d+$/;

// 1. collect every leaf path
const paths = new Set();
eachLeaf(merged, (n, path) => paths.add(path.join(".")));

// 2. per-leaf checks: type, naming, reference integrity (value + modes)
eachLeaf(merged, (n, path) => {
  const id = path.join(".");
  if (!TYPES.has(n.$type)) errors.push(`unknown $type "${n.$type}" at ${id}`);
  for (const seg of path) {
    if (!NAME.test(seg))
      errors.push(`naming: "${seg}" in ${id} is not lower kebab-case`);
  }
  const modes = n.$extensions?.["com.figma.modes"] ?? {};
  const allRefs = [
    ...refsIn(n.$value),
    ...Object.values(modes).flatMap(refsIn),
  ];
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
          errors.push(
            `${label}: ${["", g, ...path].join(".").slice(1)} missing mode "${m}"`,
          );
        }
      }
    });
  }
}
checkAxis(COLOR_MODE_GROUPS, "color mode");
checkAxis(RESP_MODE_GROUPS, "responsive mode");
checkAxis(LAYOUT_MODE_GROUPS, "layout mode");

// 3c. contrast: fg/bg pairs derived from naming convention (text.on-<X> ↔
// surface.<X>; generic text/icon/stroke ↔ page + card). 4.5:1 for text, 3:1
// for stroke/icon. Exemptions (text.disabled, stroke.divider) are explicit in
// lib/contrast.mjs; a rename breaks the exemption on purpose.
const { failures: contrastFails } = checkContrast(merged);
for (const f of contrastFails) {
  errors.push(
    `contrast: ${f.fg} × ${f.bg} (${f.mode}) = ${f.ratio.toFixed(2)} < ${f.threshold}`,
  );
}

// 3b. layering: semantic tokens must not reference color primitives directly.
// The alias tier (palette.*) is the only legal seam between semantic and core
// for color; a semantic {color.*} ref means the palette has been bypassed.
const SEMANTIC_GROUPS = [
  ...(TIERS["3. Color Roles"] ?? []),
  ...(TIERS["4. Spacing"] ?? []),
  ...(TIERS["5. Layout"] ?? []),
  ...(TIERS["6. Type Scale"] ?? []),
];
for (const g of SEMANTIC_GROUPS) {
  if (!(g in merged)) continue;
  eachLeaf(merged[g], (n, path) => {
    const id = [g, ...path].join(".");
    const modes = n.$extensions?.["com.figma.modes"] ?? {};
    const allRefs = [
      ...refsIn(n.$value),
      ...Object.values(modes).flatMap(refsIn),
    ];
    for (const r of allRefs) {
      if (r.startsWith("color."))
        errors.push(
          `layering: semantic token ${id} references primitive {${r}} directly; go through palette.*`,
        );
    }
  });
}

// 4. origin completeness: every leaf under color.* (primitives) and palette.*
// (brand slots) must inherit an $extensions.nsp.origin from an ancestor group.
// Enforces the base vs brand-poli anchor marker (see ROADMAP.md § Fase D3).
function checkOrigin(subtree, rootName) {
  if (!subtree) return;
  const walk = (node, path, inherited) => {
    if (!node || typeof node !== "object") return;
    const origin = node.$extensions?.nsp?.origin ?? inherited;
    if (isLeaf(node)) {
      if (!origin) {
        errors.push(
          `origin: ${[rootName, ...path].join(".")} missing $extensions.nsp.origin`,
        );
      } else if (!isValidOrigin(origin)) {
        errors.push(
          `origin: ${[rootName, ...path].join(".")} unknown origin "${origin}" (allowed: "base" or "brand-*")`,
        );
      }
      return;
    }
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith("$")) continue;
      walk(v, [...path, k], origin);
    }
  };
  walk(subtree, [], null);
}
checkOrigin(merged.color, "color");
checkOrigin(merged.palette, "palette");

// 5. semantic origin integrity: derive origin for every semantic token from the
// palette marker graph. Fail if any semantic token refs a palette slot whose
// origin is not declared (unanchored graph = extraction script would miss it).
const { results: semanticOrigins, errors: semanticUnanchored } =
  deriveSemanticOrigins(merged);
for (const { path, unanchored } of semanticUnanchored) {
  errors.push(
    `origin: semantic ${path} refs palette slot(s) without declared origin: ${unanchored.join(", ")}`,
  );
}

if (errors.length) {
  console.error(`validate: ${errors.length} problem(s)`);
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}
console.log(`validate: ok (${paths.size} tokens)`);

// origin audit: distribution of derived semantic origins (informational)
const originCounts = {};
for (const { origin } of semanticOrigins)
  originCounts[origin] = (originCounts[origin] ?? 0) + 1;
const originSummary = Object.entries(originCounts)
  .map(([k, n]) => `${k}: ${n}`)
  .join(", ");
console.log(
  `origin:  semantic ${semanticOrigins.length} tokens — ${originSummary}`,
);

// 4. warning: unused primitives (dead ramps / stops)
// Collect every path referenced anywhere in the tree, then flag primitives
// that no token points at. Not an error: warnings only. Useful to spot dead
// color ramps or size stops as the system evolves.
const referenced = new Set();
eachLeaf(merged, (n) => {
  const modes = n.$extensions?.["com.figma.modes"] ?? {};
  for (const r of [
    ...refsIn(n.$value),
    ...Object.values(modes).flatMap(refsIn),
  ])
    referenced.add(r);
});
const primitiveGroups = TIERS["1. Primitives"];
const unused = [];
eachLeaf(merged, (n, path) => {
  if (!primitiveGroups.includes(path[0])) return;
  const id = path.join(".");
  if (!referenced.has(id)) unused.push(id);
});
if (unused.length) {
  console.warn(`validate: ${unused.length} unused primitive(s):`);
  for (const id of unused) console.warn("  - " + id);
}
