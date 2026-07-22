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
  String(v).replace(/\{([^}]+)\}/g, (_, p) => `var(--${p.replace(/\./g, "-")})`);
const scalar = (v) => (typeof v === "string" ? refToVar(v) : String(v));
const bpWidth = (mode) => merged.breakpoint?.[mode]?.$value;

// emit `--group-path: value` for every leaf in a group, at an optional mode
function emitGroup(group, mode) {
  const tree = merged[group];
  if (!tree) return [];
  const lines = [];
  eachLeaf(tree, (n, path) => {
    const name = [group, ...path].join("-");
    const v = mode && n.$extensions?.["com.figma.modes"]?.[mode] !== undefined
      ? n.$extensions["com.figma.modes"][mode]
      : n.$value;
    lines.push(`  --${name}: ${scalar(v)};`);
  });
  return lines;
}

// typography composite -> four expanded custom properties per token
function emitTypography() {
  const lines = [];
  for (const [name, node] of Object.entries(merged.typography ?? {})) {
    const c = node.$value;
    const map = { fontFamily: "font-family", fontWeight: "font-weight", fontSize: "font-size", lineHeight: "line-height" };
    for (const [key, css] of Object.entries(map)) {
      if (c[key] !== undefined) lines.push(`  --typography-${name}-${css}: ${scalar(c[key])};`);
    }
  }
  return lines;
}

// shadow composite -> a single box-shadow string
function emitShadow() {
  const lines = [];
  for (const [name, node] of Object.entries(merged.shadow ?? {})) {
    const s = node.$value;
    lines.push(`  --shadow-${name}: ${s.offsetX} ${s.offsetY} ${s.blur} ${s.spread} ${refToVar(s.color)};`);
  }
  return lines;
}

const block = (sel, lines) => `${sel} {\n${lines.join("\n")}\n}`;

// --- :root : primitives + palette + base sizes + light semantic + composites ---
const rootLines = [
  ...emitGroup("color"), ...emitGroup("size"), ...emitGroup("font"),
  ...emitGroup("palette"),
  ...emitGroup("type-size", "base"), ...emitGroup("breakpoint"),
  ...emitGroup("surface", "light"), ...emitGroup("text", "light"), ...emitGroup("border", "light"),
  ...emitTypography(), ...emitShadow(),
];

// --- dark : semantic color overrides only ---
const darkLines = [
  ...emitGroup("surface", "dark"), ...emitGroup("text", "dark"), ...emitGroup("border", "dark"),
];

// --- mobile-first media queries for responsive type sizes ---
const respModes = listModes(merged["type-size"]).filter((m) => m !== "base");
respModes.sort((a, b) => (parseFloat(bpWidth(a)) || 0) - (parseFloat(bpWidth(b)) || 0));
const queries = respModes
  .filter((m) => bpWidth(m))
  .map((m) => `@media (min-width: ${bpWidth(m)}) {\n${block(":root", emitGroup("type-size", m)).replace(/^/gm, "  ")}\n}`);

const css = [
  "/* Generated. Edit tokens/, not this file. */",
  block(":root", rootLines),
  block('[data-theme="dark"]', darkLines),
  ...queries,
].join("\n\n") + "\n";

mkdirSync(resolve(ROOT, "build/css"), { recursive: true });
writeFileSync(resolve(ROOT, "build/css/tokens.css"), css);
console.log("css    -> build/css/tokens.css");

// --- tailwind preset: var() maps ---
const colors = {}, spacing = {}, fontSize = {};
const collect = (group, bag, strip) =>
  eachLeaf(merged[group] ?? {}, (n, path) => {
    const full = [group, ...path].join("-");
    bag[strip ? path.join("-") : full] = `var(--${full})`;
  });
for (const g of ["color", "palette", "surface", "text", "border"]) collect(g, colors, false);
collect("size", spacing, true);
collect("type-size", fontSize, true);

mkdirSync(resolve(ROOT, "build/tailwind"), { recursive: true });
writeFileSync(
  resolve(ROOT, "build/tailwind/tokens.cjs"),
  "// Generated. Spread into tailwind.config theme.extend.\nmodule.exports = " +
    JSON.stringify({ colors, spacing, fontSize }, null, 2) + ";\n"
);
console.log("css    -> build/tailwind/tokens.cjs");
