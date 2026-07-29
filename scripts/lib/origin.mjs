// Canonical origin derivation from the palette marker graph.
// Single source of truth used by validate.mjs (integrity check) and the
// future D3 extraction script. Do not duplicate this logic elsewhere.
//
// Anchoring rule (declared): every palette slot carries $extensions.nsp.origin
// ("base" | "brand-poli"). Only palette slots are marked; everything above
// derives from them via reference graph traversal.
//
// Derivation rule (computed): a token is "brand-poli" if any of its direct
// palette.* refs (across $value and all mode values) resolves to a slot whose
// declared origin is "brand-poli". Otherwise "base". If a ref points to a slot
// with no declared origin, the graph is unanchored — validator fails.

import { isLeaf, TIERS } from "./tokens.mjs";

// Kept for compatibility; prefer isValidOrigin() for open-ended brand checks.
export const VALID_ORIGINS = new Set(["base", "brand-poli"]);

// Accepts "base" or any "brand-*" string (e.g. "brand-wolfhaus", "brand-test").
export function isValidOrigin(origin) {
  return (
    origin === "base" ||
    (typeof origin === "string" && origin.startsWith("brand-"))
  );
}
const SEMANTIC_GROUPS = [
  ...(TIERS["3. Color Roles"] ?? []),
  ...(TIERS["4. Spacing"] ?? []),
  ...(TIERS["5. Layout"] ?? []),
  ...(TIERS["6. Type Scale"] ?? []),
];

export function refsIn(val) {
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
}

// Build a map of palette slot name → declared origin (null = missing marker).
export function paletteSlotOrigins(merged) {
  const map = {};
  const palette = merged.palette;
  if (!palette) return map;
  for (const [slot, node] of Object.entries(palette)) {
    if (node && typeof node === "object" && !("$value" in node)) {
      map[slot] = node.$extensions?.nsp?.origin ?? null;
    }
  }
  return map;
}

// Derive origin for one leaf. Returns:
//   { origin: "base"|"brand-poli", unanchored: string[] }
// unanchored = palette slot names referenced but missing declared origin.
export function deriveLeafOrigin(leaf, slotOrigins) {
  const modes = leaf.$extensions?.["com.figma.modes"] ?? {};
  const allRefs = [
    ...refsIn(leaf.$value),
    ...Object.values(modes).flatMap(refsIn),
  ];

  let origin = "base";
  const unanchored = [];

  for (const r of allRefs) {
    if (!r.startsWith("palette.")) continue;
    const slot = r.split(".")[1];
    if (!(slot in slotOrigins)) continue; // ref to palette leaf, not slot group
    const declared = slotOrigins[slot];
    if (declared === null) {
      if (!unanchored.includes(slot)) unanchored.push(slot);
    } else if (declared === "brand-poli") {
      origin = "brand-poli";
    }
  }

  return { origin, unanchored };
}

// Walk all semantic groups in merged, derive origin per leaf.
// Returns:
//   results: [{ path: string, origin: "base"|"brand-poli" }]
//   errors:  [{ path: string, unanchored: string[] }]  — unanchored slot refs
export function deriveSemanticOrigins(merged) {
  const slotOrigins = paletteSlotOrigins(merged);
  const results = [];
  const errors = [];

  function walk(node, path) {
    if (!node || typeof node !== "object") return;
    if (isLeaf(node)) {
      const { origin, unanchored } = deriveLeafOrigin(node, slotOrigins);
      results.push({ path, origin });
      if (unanchored.length) errors.push({ path, unanchored });
      return;
    }
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith("$")) continue;
      walk(v, path ? `${path}.${k}` : k);
    }
  }

  for (const g of SEMANTIC_GROUPS) {
    if (g in merged) walk(merged[g], g);
  }

  return { results, errors };
}
