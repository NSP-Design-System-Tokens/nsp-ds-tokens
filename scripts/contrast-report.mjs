// Human-readable contrast report. Uses the same logic as the validator via
// scripts/lib/contrast.mjs — one source of truth for both the gate and the
// summary. Run: `npm run contrast-report` (or `node scripts/contrast-report.mjs`).

import { loadMerged } from "./lib/tokens.mjs";
import { checkContrast, CONTRAST_EXEMPT } from "./lib/contrast.mjs";

const merged = loadMerged();
const { results, failures } = checkContrast(merged);

const pad = (s, w) => String(s).padEnd(w);
console.log(
  pad("fg", 28) +
    pad("bg", 22) +
    pad("mode", 6) +
    pad("fg#", 11) +
    pad("bg#", 11) +
    pad("ratio", 7) +
    pad("th", 5) +
    "status",
);
console.log("-".repeat(105));
for (const r of results) {
  console.log(
    pad(r.fg, 28) +
      pad(r.bg, 22) +
      pad(r.mode, 6) +
      pad(r.fgHex, 11) +
      pad(r.bgHex, 11) +
      pad(r.ratio.toFixed(2), 7) +
      pad(r.threshold, 5) +
      r.status,
  );
}

const exemptCount = results.filter((r) => r.status === "exempt").length;
const okCount = results.filter((r) => r.status === "ok").length;
console.log("");
console.log(
  `Total pairs: ${results.length}  |  ok: ${okCount}  |  exempt: ${exemptCount}  |  FAIL: ${failures.length}`,
);
if (exemptCount) {
  console.log("");
  console.log("Exempt entries (with rationale):");
  const exemptSeen = new Set();
  for (const r of results) {
    if (r.status !== "exempt") continue;
    const pairKey = `${r.fg} × ${r.bg}`;
    const fgReason = CONTRAST_EXEMPT[r.fg];
    const pairReason = CONTRAST_EXEMPT[pairKey];
    if (fgReason && !exemptSeen.has(r.fg)) {
      exemptSeen.add(r.fg);
      console.log(`  [global] ${r.fg}: ${fgReason}`);
    } else if (pairReason && !exemptSeen.has(pairKey)) {
      exemptSeen.add(pairKey);
      console.log(`  [pair]   ${pairKey}: ${pairReason}`);
    }
  }
}
if (failures.length) process.exit(1);
