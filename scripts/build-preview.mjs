// Build: build/css/tokens.css -> build/preview/index.html
// Self-contained gallery. Parses :root so names always match the build. Styles
// itself with the semantic tokens; the toggle re-themes for real. Typography
// composites render as live sample lines; shadows as elevated cards.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT } from "./lib/tokens.mjs";

const css = readFileSync(resolve(ROOT, "build/css/tokens.css"), "utf8");
const rootBlock = css.match(/:root\s*\{([\s\S]*?)\n\}/)[1];
const vars = [...rootBlock.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map((m) => ({
  name: m[1], value: m[2].trim(),
}));

const isColor = (v) => /^#|^oklch|^rgb|^var\(--(color|palette|surface|text|border)/.test(v);
const pick = (re) => vars.filter((v) => re.test(v.name));

const chip = (v) => `<div class="chip"><div class="sw" style="background:var(--${v.name})"></div>
  <div class="lbl">${v.name}</div><div class="val">${v.value}</div></div>`;
const sec = (title, chips) => `<section><h2>${title}</h2><div class="row">${chips.join("")}</div></section>`;

const primitives = pick(/^color-/).map(chip);
const palette = pick(/^palette-/).map(chip);
const semantic = pick(/^(surface|text|border)-/).map(chip);

const sizeBars = pick(/^size-/).map((v) => `<div class="bar-row"><div class="bar-lbl">${v.name.replace("size-", "")}</div>
  <div class="bar" style="width:var(--${v.name})"></div><div class="bar-val">${v.value}</div></div>`);

const typeNames = [...new Set(pick(/^typography-.*-font-size$/).map((v) => v.name.replace(/^typography-(.*)-font-size$/, "$1")))];
const typeSamples = typeNames.map((n) => `<div class="type-row">
  <span style="font-family:var(--typography-${n}-font-family);font-weight:var(--typography-${n}-font-weight);font-size:var(--typography-${n}-font-size);line-height:var(--typography-${n}-line-height)">${n}</span>
  <span class="val">size var(--typography-${n}-font-size)</span></div>`).join("");

const shadows = pick(/^shadow-/).map((v) => `<div class="chip">
  <div class="shbox" style="box-shadow:var(--${v.name})"></div><div class="lbl">${v.name}</div></div>`);

const body = [
  sec("Primitives — palette", primitives),
  sec("Brand — palette slots", palette),
  sec("Semantic — roles (toggle affects these)", semantic),
  `<section><h2>Typography — composites (resize the window to see the responsive scale)</h2>
    <div class="stack">${typeSamples}</div></section>`,
  sec("Elevation — shadows", shadows),
  `<section><h2>Sizing</h2><div class="stack">${sizeBars.join("")}</div></section>`,
].join("\n");

const html = `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>nsp-tokens preview</title>
<style>
${css}
</style>
<style>
  * { box-sizing: border-box; }
  body { margin:0; font-family: ui-sans-serif, system-ui, sans-serif;
    background: var(--surface-page); color: var(--text-default); transition: background .2s, color .2s; }
  header { position: sticky; top:0; z-index:10; display:flex; align-items:center; justify-content:space-between;
    padding:16px 32px; background: var(--surface-page); border-bottom:1px solid var(--border-default); }
  header h1 { font-size:18px; margin:0; letter-spacing:.02em; }
  .toggle { border:1px solid var(--border-default); background: var(--surface-raised); color: var(--text-default);
    padding:8px 16px; border-radius:8px; cursor:pointer; font-size:14px; }
  main { max-width:1000px; margin:0 auto; padding:32px; }
  section { margin-bottom:48px; }
  h2 { font-size:13px; text-transform:uppercase; letter-spacing:.08em; color: var(--text-muted);
    margin:0 0 16px; font-weight:600; }
  .row { display:flex; flex-wrap:wrap; gap:16px; }
  .chip { width:132px; }
  .sw { width:132px; height:60px; border-radius:8px; border:1px solid var(--border-default); }
  .shbox { width:132px; height:60px; border-radius:8px; background: var(--surface-raised); }
  .lbl { font-size:12px; margin-top:8px; word-break:break-all; }
  .val { font-size:11px; color: var(--text-muted); word-break:break-all; }
  .stack { display:flex; flex-direction:column; gap:16px; }
  .bar-row { display:flex; align-items:center; gap:16px; }
  .bar-lbl { width:56px; font-size:13px; }
  .bar { height:16px; background: var(--surface-brand); border-radius:2px; min-width:1px; }
  .bar-val { font-size:12px; color: var(--text-muted); }
  .type-row { display:flex; align-items:baseline; justify-content:space-between; gap:24px;
    border-bottom:1px solid var(--border-default); padding-bottom:12px; }
  .type-row .val { font-size:12px; white-space:nowrap; }
</style>
</head>
<body>
<header><h1>nsp-tokens</h1><button class="toggle" id="t">Dark</button></header>
<main>
${body}
</main>
<script>
  const r=document.documentElement,b=document.getElementById("t");
  b.addEventListener("click",()=>{const d=r.getAttribute("data-theme")==="dark";
    r.setAttribute("data-theme",d?"light":"dark");b.textContent=d?"Dark":"Light";});
</script>
</body>
</html>
`;

mkdirSync(resolve(ROOT, "build/preview"), { recursive: true });
writeFileSync(resolve(ROOT, "build/preview/index.html"), html);
console.log("preview-> build/preview/index.html");
