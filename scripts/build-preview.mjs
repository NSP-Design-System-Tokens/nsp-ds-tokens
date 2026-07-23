// Build: build/css/tokens.css -> build/preview/index.html
// Tabbed preview: Palette · Semantic · Contrast · Type & Scales.
// Contrast view defaults to issues-only (borderline + fail).
// Dark/light toggle is global — independent of active view.
// Pair enumeration identical to validate gate (shared checkContrast()).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT, loadMerged } from "./lib/tokens.mjs";
import { checkContrast, CONTRAST_EXEMPT } from "./lib/contrast.mjs";

const css = readFileSync(resolve(ROOT, "build/css/tokens.css"), "utf8");
const rootBlock = css.match(/:root\s*\{([\s\S]*?)\n\}/)[1];
const vars = [...rootBlock.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map((m) => ({
  name: m[1],
  value: m[2].trim(),
}));

const pick = (re) => vars.filter((v) => re.test(v.name));
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function splitFamily(name, prefix) {
  const rest = name.slice(prefix.length).split("-");
  let i = rest.findIndex((s) => /^\d/.test(s));
  if (i === -1) i = rest.length;
  return {
    family: rest.slice(0, i).join("-") || "base",
    stop: rest.slice(i).join("-"),
  };
}

function groupBy(list, keyFn) {
  const map = new Map();
  for (const v of list) {
    const k = keyFn(v);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(v);
  }
  return [...map.entries()];
}

const stopSort = (a, b) => {
  const na = parseInt(a, 10),
    nb = parseInt(b, 10);
  if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
  if (!isNaN(na) && isNaN(nb)) return -1;
  if (isNaN(na) && !isNaN(nb)) return 1;
  return a.localeCompare(b);
};

const chip = (v) => `<div class="chip">
  <div class="sw" style="background:var(--${v.name})"></div>
  <div class="lbl">${v.name}</div><div class="val">${v.value}</div></div>`;

const subsec = (id, title, count, chips) => `<div class="subsec" id="${id}">
  <h3>${title} <span class="count">· ${count}</span></h3>
  <div class="row">${chips.join("")}</div></div>`;

const sec = (id, title, inner) =>
  `<section id="${id}"><h2>${title}</h2>${inner}</section>`;

// --- primitives -------------------------------------------------------------
const primFamilies = groupBy(
  pick(/^color-/),
  (v) => splitFamily(v.name, "color-").family,
).sort(([a], [b]) => a.localeCompare(b));

const primSubs = primFamilies.map(([family, list]) => {
  const id = `sub-color-${slug(family)}`;
  const sorted = list
    .slice()
    .sort((a, b) =>
      stopSort(
        splitFamily(a.name, "color-").stop,
        splitFamily(b.name, "color-").stop,
      ),
    );
  return {
    id,
    family,
    count: sorted.length,
    html: subsec(id, family, sorted.length, sorted.map(chip)),
  };
});
const primInner = primSubs.map((s) => s.html).join("");

// --- brand palette ----------------------------------------------------------
const palFamilyOf = (name) => name.slice("palette-".length).split("-")[0];
const palStopOf = (name) =>
  name.slice("palette-".length).split("-").slice(1).join("-");
const palFamilies = groupBy(pick(/^palette-/), (v) => palFamilyOf(v.name)).sort(
  ([a], [b]) => a.localeCompare(b),
);

const palSubs = palFamilies.map(([family, list]) => {
  const id = `sub-palette-${slug(family)}`;
  const sorted = list
    .slice()
    .sort((a, b) => stopSort(palStopOf(a.name), palStopOf(b.name)));
  return {
    id,
    family,
    count: sorted.length,
    html: subsec(id, family, sorted.length, sorted.map(chip)),
  };
});
const palInner = palSubs.map((s) => s.html).join("");

// --- semantic ---------------------------------------------------------------
const SEMANTIC_ROLES = [
  "surface",
  "text",
  "stroke",
  "logo",
  "icon",
  "emphasis-brand",
  "emphasis",
  "border",
];
const semClaimed = new Set();
const semanticGroups = SEMANTIC_ROLES.map((role) => {
  const list = pick(new RegExp(`^${role}-`)).filter(
    (v) => !semClaimed.has(v.name),
  );
  list.forEach((v) => semClaimed.add(v.name));
  return [role, list];
}).filter(([, list]) => list.length);

const semSubs = semanticGroups.map(([role, list]) => {
  const id = `sub-semantic-${slug(role)}`;
  return {
    id,
    role,
    count: list.length,
    html: subsec(id, role, list.length, list.map(chip)),
  };
});
const semInner = semSubs.map((s) => s.html).join("");

// --- typography -------------------------------------------------------------
const typeNames = [
  ...new Set(
    pick(/^typography-.*-font-size$/).map((v) =>
      v.name.replace(/^typography-(.*)-font-size$/, "$1"),
    ),
  ),
];
const typeSamples = typeNames
  .map(
    (n) => `<div class="type-row">
  <span style="font-family:var(--typography-${n}-font-family);font-weight:var(--typography-${n}-font-weight);font-size:var(--typography-${n}-font-size);line-height:var(--typography-${n}-line-height)">${n}</span>
  <span class="val">size var(--typography-${n}-font-size)</span></div>`,
  )
  .join("");

// --- shadows ----------------------------------------------------------------
const shadowVars = pick(/^shadow-/);
const shadows = shadowVars.map(
  (v) => `<div class="chip">
  <div class="shbox" style="box-shadow:var(--${v.name})"></div>
  <div class="lbl">${v.name}</div></div>`,
);

// --- sizing -----------------------------------------------------------------
const sizeVars = pick(/^size-/)
  .slice()
  .sort((a, b) => parseFloat(a.value) - parseFloat(b.value));
const sizeBars = sizeVars.map(
  (v) =>
    `<div class="bar-row"><div class="bar-lbl">${v.name.replace("size-", "")}</div>
  <div class="bar" style="width:var(--${v.name})"></div><div class="bar-val">${v.value}</div></div>`,
);

// --- contrast ---------------------------------------------------------------
const merged = loadMerged();
const { results, failures } = checkContrast(merged);

const ctComfortable = results.filter(
  (r) => r.status === "ok" && r.ratio >= r.threshold * 1.15,
);
const ctBorderline = results.filter(
  (r) => r.status === "ok" && r.ratio < r.threshold * 1.15,
);
const ctExempt = results.filter((r) => r.status === "exempt");

function hasIssues(byBg) {
  for (const modes of byBg.values())
    for (const r of Object.values(modes))
      if (
        r &&
        (r.status === "FAIL" ||
          (r.status === "ok" && r.ratio < r.threshold * 1.15))
      )
        return true;
  return false;
}

function ctSwatch(group, fgHex, bgHex) {
  const base = `width:36px;height:26px;border-radius:3px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:${bgHex}`;
  if (group === "text")
    return `<div style="${base}"><span style="color:${fgHex};font-size:13px;font-weight:600;line-height:1;font-family:ui-sans-serif,sans-serif">Aa</span></div>`;
  if (group === "stroke")
    return `<div style="${base};outline:2px solid ${fgHex};outline-offset:-2px"></div>`;
  return `<div style="${base}"><div style="width:12px;height:12px;border-radius:50%;background:${fgHex}"></div></div>`;
}

function ctExemptLabel(r) {
  const pairKey = `${r.fg} × ${r.bg}`;
  const reason = CONTRAST_EXEMPT[r.fg] || CONTRAST_EXEMPT[pairKey] || "";
  if (reason.includes("PHYSICAL")) return ["physical", reason];
  if (reason.includes("1.4.3")) return ["inactive", reason];
  if (reason.includes("decorative") || reason.includes("brand-tinted"))
    return ["decorative", reason];
  if (reason.includes("USAGE")) return ["usage", reason];
  return ["exempt", reason];
}

function ctCell(group, r) {
  if (!r) return `<div class="ct-cell ct-na"></div>`;
  const swatch = ctSwatch(group, r.fgHex, r.bgHex);
  if (r.status === "exempt") {
    const [label, reason] = ctExemptLabel(r);
    const esc = reason.replace(/"/g, "'");
    return `<div class="ct-cell ct-exempt" title="${esc}">${swatch}<span class="ct-ratio">${label}</span></div>`;
  }
  if (r.status === "FAIL")
    return `<div class="ct-cell ct-fail">${swatch}<span class="ct-ratio">${r.ratio.toFixed(2)}:1</span></div>`;
  if (r.ratio >= r.threshold * 1.15)
    return `<div class="ct-cell ct-ok">${swatch}<span class="ct-ratio">${r.ratio.toFixed(2)}:1</span></div>`;
  return `<div class="ct-cell ct-borderline">${swatch}<span class="ct-ratio">${r.ratio.toFixed(2)}:1 ⚠</span></div>`;
}

const CT_GROUPS = ["text", "icon", "stroke"];
const ctData = new Map(CT_GROUPS.map((g) => [g, new Map()]));
for (const r of results) {
  const group = r.fg.split(".")[0];
  if (!ctData.has(group)) continue;
  const byFg = ctData.get(group);
  if (!byFg.has(r.fg)) byFg.set(r.fg, new Map());
  const byBg = byFg.get(r.fg);
  if (!byBg.has(r.bg)) byBg.set(r.bg, {});
  byBg.get(r.bg)[r.mode] = r;
}

const ctGroupsHtml = CT_GROUPS.map((group) => {
  const byFg = ctData.get(group);
  if (!byFg || byFg.size === 0) return "";
  const id = `sub-contrast-${group}`;
  const groupHasIssues = [...byFg.values()].some(hasIssues);
  const tokenBlocks = [...byFg.entries()]
    .map(([fgName, byBg]) => {
      const tokenHasIssues = hasIssues(byBg);
      const rows = [...byBg.entries()]
        .map(
          ([bgName, modes]) => `<div class="ct-row">
        <div class="ct-bg-label">${bgName}</div>
        ${ctCell(group, modes.light)}
        ${ctCell(group, modes.dark)}
      </div>`,
        )
        .join("");
      return `<div class="ct-token" data-issues="${tokenHasIssues}">
      <div class="ct-token-name">${fgName}</div>
      <div class="ct-mode-hdr">
        <div></div>
        <div class="ct-mode-lbl">light</div>
        <div class="ct-mode-lbl">dark</div>
      </div>
      ${rows}
    </div>`;
    })
    .join("");
  return `<div class="subsec" id="${id}" data-issues="${groupHasIssues}">
  <h3>${group} <span class="count">· ${byFg.size} tokens</span></h3>
  <div class="ct-group">${tokenBlocks}</div>
</div>`;
}).join("");

// Summary: in issues-only mode show borderline+fail badges + hidden note.
// .ct-s-ok and .ct-s-exempt are hidden by CSS until show-all is toggled.
const ctSummary = `<div class="ct-summary">
  <span class="ct-s ct-s-ok">${ctComfortable.length} ok</span>
  <span class="ct-s ct-s-borderline">${ctBorderline.length} borderline</span>
  <span class="ct-s ct-s-fail">${failures.length} fail</span>
  <span class="ct-s ct-s-exempt">${ctExempt.length} exempt</span>
  <span class="ct-meta" id="ct-note">&nbsp;· ${ctComfortable.length} ok · ${ctExempt.length} exempt hidden</span>
  <button class="ct-toggle" id="ct-toggle" onclick="toggleContrast()">show all ${results.length}</button>
</div>`;

const contrastInner = ctSummary + ctGroupsHtml;

// --- views ------------------------------------------------------------------
const viewPalette = `<div class="view active" id="view-palette">
  ${sec("sec-primitives", "Primitives — color ramps", primInner)}
  ${sec("sec-brand", "Brand — palette slots", palInner)}
</div>`;

const viewSemantic = `<div class="view" id="view-semantic">
  ${sec("sec-semantic", "Semantic — roles (toggle affects these)", semInner)}
</div>`;

const viewContrast = `<div class="view" id="view-contrast">
  ${sec("sec-contrast", "Contrast — WCAG 2.2 AA verdicts (same pairs as validate gate)", contrastInner)}
</div>`;

const viewScales = `<div class="view" id="view-scales">
  ${sec("sec-typography", `Typography · ${typeNames.length} — resize to see responsive scale`, `<div class="stack">${typeSamples}</div>`)}
  ${sec("sec-elevation", `Elevation · ${shadowVars.length} — shadows`, `<div class="row">${shadows.join("")}</div>`)}
  ${sec("sec-sizing", "Sizing", `<div class="stack">${sizeBars.join("")}</div>`)}
</div>`;

// --- html -------------------------------------------------------------------
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
  html { scroll-behavior: smooth; }
  body { margin:0; font-family: ui-sans-serif, system-ui, sans-serif;
    background: var(--surface-page); color: var(--text-default); transition: background .2s, color .2s; }
  header { position: sticky; top:0; z-index:20; display:flex; align-items:center; justify-content:space-between;
    padding:16px 32px; background: var(--surface-page); border-bottom:1px solid var(--stroke-default); }
  header h1 { font-size:18px; margin:0; letter-spacing:.02em; }
  .toggle { border:1px solid var(--stroke-default); background: var(--surface-card); color: var(--text-default);
    padding:8px 16px; border-radius:8px; cursor:pointer; font-size:14px; }

  .layout { display: grid; grid-template-columns: 200px 1fr; max-width: 1400px; margin: 0 auto; }
  nav.index { position: sticky; top: 72px; align-self: start; padding: 24px 16px;
    max-height: calc(100vh - 72px); overflow-y: auto; border-right:1px solid var(--stroke-divider); }
  nav.index ul { list-style: none; margin: 0; padding: 0; }
  nav.index li { margin-bottom: 2px; }
  .nav-btn { background: none; border: none; border-left: 3px solid transparent;
    cursor: pointer; font-size: 12px; font-weight: 600; text-transform: uppercase;
    letter-spacing: .08em; color: var(--text-subtle); text-align: left; width: 100%;
    padding: 8px 0 8px 12px; display: block; font-family: inherit; transition: color .15s; }
  .nav-btn.nav-active { color: var(--text-default); border-left-color: var(--text-primary); }
  .nav-btn:hover { color: var(--text-default); }

  .view { display: none; }
  .view.active { display: block; }

  main { padding:32px 40px; min-width: 0; }
  section { margin-bottom:56px; }
  h2 { font-size:13px; text-transform:uppercase; letter-spacing:.08em; color: var(--text-subtle);
    margin:0 0 20px; font-weight:600; border-bottom:1px solid var(--stroke-divider); padding-bottom:8px; }
  .subsec { margin-bottom:28px; }
  .subsec h3 { font-size:12px; text-transform:uppercase; letter-spacing:.05em; color: var(--text-default);
    margin:0 0 12px; font-weight:600; opacity:.75; }
  .subsec h3 .count { font-weight: 400; opacity: .6; margin-left: 4px; font-size: 11px; }
  .row { display:flex; flex-wrap:wrap; gap:14px; }
  .chip { width:132px; }
  .sw { width:132px; height:56px; border-radius:6px; border:1px solid var(--stroke-divider); }
  .shbox { width:132px; height:56px; border-radius:6px; background: var(--surface-card); }
  .lbl { font-size:11px; margin-top:6px; word-break:break-all; }
  .val { font-size:10px; color: var(--text-subtle); word-break:break-all; }
  .stack { display:flex; flex-direction:column; gap:14px; }
  .bar-row { display:flex; align-items:center; gap:16px; }
  .bar-lbl { width:64px; font-size:12px; }
  .bar { height:14px; background: var(--surface-primary); border-radius:2px; min-width:1px; }
  .bar-val { font-size:11px; color: var(--text-subtle); }
  .type-row { display:flex; align-items:baseline; justify-content:space-between; gap:24px;
    border-bottom:1px solid var(--stroke-divider); padding-bottom:12px; }
  .type-row .val { font-size:11px; white-space:nowrap; color: var(--text-subtle); }

  /* contrast ---------------------------------------------------------------- */
  .ct-summary { display:flex; align-items:center; gap:10px; margin-bottom:24px; flex-wrap:wrap; }
  .ct-s { font-size:12px; font-weight:600; padding:4px 12px; border-radius:12px; border:1.5px solid; }
  .ct-s-ok         { border-color: var(--text-success); color: var(--text-success); }
  .ct-s-borderline { border-color: var(--text-warning); color: var(--text-warning); }
  .ct-s-exempt     { border-color: var(--stroke-default); color: var(--text-subtle); }
  .ct-s-fail       { border-color: var(--text-error); color: var(--text-error); }
  .ct-meta   { font-size:11px; color: var(--text-subtle); }
  .ct-toggle { background: none; border: 1px solid var(--stroke-default); color: var(--text-subtle);
    padding: 4px 10px; border-radius: 8px; cursor: pointer; font-size: 11px; font-family: inherit; }
  .ct-toggle:hover { color: var(--text-default); border-color: var(--stroke-hover); }

  /* issues-only mode: hide ok+exempt badges, show hidden note */
  #view-contrast:not(.show-all) .ct-s-ok,
  #view-contrast:not(.show-all) .ct-s-exempt { display: none; }
  #view-contrast:not(.show-all) #ct-note { display: inline; }
  #view-contrast.show-all #ct-note { display: none; }

  /* filter tokens and groups that have no issues */
  #view-contrast:not(.show-all) .subsec[data-issues="false"] { display: none; }
  #view-contrast:not(.show-all) .ct-token[data-issues="false"] { display: none; }

  .ct-group { display:flex; flex-wrap:wrap; gap:16px 24px; }
  .ct-token { min-width:340px; flex:0 1 340px; margin-bottom:4px; }
  .ct-token-name { font-size:12px; font-weight:600; margin-bottom:4px; color:var(--text-default); }
  .ct-mode-hdr { display:grid; grid-template-columns:150px 1fr 1fr; gap:4px; margin-bottom:2px; }
  .ct-mode-lbl { font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:var(--text-subtle); padding-left:6px; }
  .ct-row { display:grid; grid-template-columns:150px 1fr 1fr; align-items:center; gap:4px; margin-bottom:3px; }
  .ct-bg-label { font-size:10px; color:var(--text-subtle); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .ct-cell { display:flex; align-items:center; gap:6px; padding:3px 6px; border-radius:4px; min-height:30px; }
  .ct-ratio { font-size:11px; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .ct-ok         { background:rgba(0,161,69,0.10); }
  .ct-borderline { background:rgba(180,140,0,0.12); }
  .ct-fail       { background:rgba(204,0,43,0.10); }
  .ct-exempt     { background:rgba(120,120,120,0.08); color:var(--text-subtle); }

  @media (max-width: 900px) {
    .layout { grid-template-columns: 1fr; }
    nav.index { position: static; max-height: none; border-right: none;
      border-bottom: 1px solid var(--stroke-divider); padding: 12px 24px; }
    nav.index ul { display: flex; gap: 4px; }
    .nav-btn { border-left: none; border-bottom: 3px solid transparent;
      padding: 8px 10px; width: auto; }
    .nav-btn.nav-active { border-bottom-color: var(--text-primary); }
  }
</style>
</head>
<body>
<header><h1>nsp-tokens</h1><button class="toggle" id="t">Dark</button></header>
<div class="layout">
<nav class="index">
  <ul>
    <li><button class="nav-btn nav-active" data-view="palette"  onclick="switchView('palette')">Palette</button></li>
    <li><button class="nav-btn"            data-view="semantic" onclick="switchView('semantic')">Semantic</button></li>
    <li><button class="nav-btn"            data-view="contrast" onclick="switchView('contrast')">Contrast</button></li>
    <li><button class="nav-btn"            data-view="scales"   onclick="switchView('scales')">Type &amp; Scales</button></li>
  </ul>
</nav>
<main>
${viewPalette}
${viewSemantic}
${viewContrast}
${viewScales}
</main>
</div>
<script>
  function switchView(name) {
    document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
    document.querySelectorAll('.nav-btn').forEach(function(b) { b.classList.remove('nav-active'); });
    document.getElementById('view-' + name).classList.add('active');
    document.querySelector('.nav-btn[data-view="' + name + '"]').classList.add('nav-active');
    window.scrollTo(0, 0);
  }

  function toggleContrast() {
    var v = document.getElementById('view-contrast');
    var btn = document.getElementById('ct-toggle');
    if (v.classList.toggle('show-all')) {
      btn.textContent = 'issues only';
    } else {
      btn.textContent = 'show all ${results.length}';
    }
  }

  var r = document.documentElement, b = document.getElementById('t');
  b.addEventListener('click', function() {
    var d = r.getAttribute('data-theme') === 'dark';
    r.setAttribute('data-theme', d ? 'light' : 'dark');
    b.textContent = d ? 'Dark' : 'Light';
  });
</script>
</body>
</html>
`;

mkdirSync(resolve(ROOT, "build/preview"), { recursive: true });
writeFileSync(resolve(ROOT, "build/preview/index.html"), html);
console.log("preview-> build/preview/index.html");
