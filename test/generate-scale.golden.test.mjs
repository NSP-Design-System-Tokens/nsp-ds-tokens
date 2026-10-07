import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateScale,
  computeOnColor,
  computeOnColorPair,
  pickTextStep,
  pickIconStep,
  buildColorTree,
  brandSlot,
  ghostSlot,
  graySlot,
  contrastRatio,
} from "../scripts/lib/generate-scale.mjs";

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures");
const load = (name) => JSON.parse(readFileSync(resolve(DIR, name), "utf8"));

function round(v, d = 6) {
  if (typeof v === "number") return Math.round(v * 10 ** d) / 10 ** d;
  if (Array.isArray(v)) return v.map((x) => round(x, d));
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.entries(v).map(([k, x]) => [k, round(x, d)]),
    );
  return v;
}

// ── Andrea reale: #004B93 / #2989CC ──────────────────────────────────────────

describe("andrea-reale", () => {
  const fix = load("andrea-reale.json");

  describe("primary #004B93", () => {
    const scale = generateScale("#004B93");

    it("scale matches fixture", () => {
      assert.deepStrictEqual(scale, fix.primary.scale);
    });

    it("on-color step 9 light", () => {
      assert.deepStrictEqual(
        round(computeOnColor(scale.lightSteps[8], "light")),
        fix.primary.onColor.step9Light,
      );
    });

    it("on-color step 9 dark", () => {
      assert.deepStrictEqual(
        round(computeOnColor(scale.darkSteps[8], "dark")),
        fix.primary.onColor.step9Dark,
      );
    });

    it("text step", () => {
      assert.deepStrictEqual(
        round(pickTextStep(scale.lightSteps)),
        fix.primary.textStep,
      );
    });

    it("icon step", () => {
      assert.deepStrictEqual(
        round(pickIconStep(scale.lightSteps)),
        fix.primary.iconStep,
      );
    });

    it("hover ratio step 8 vs 9 — dark mode nearly invisible (< 1.1)", () => {
      const r = contrastRatio(scale.darkSteps[7], scale.darkSteps[8]);
      assert.ok(r < 1.1, `expected < 1.1, got ${r.toFixed(4)}`);
      assert.strictEqual(round(r), fix.hoverContrast.primary.darkStep8vs9);
    });

    it("hover ratio step 8 vs 9 — light mode visible (> 2)", () => {
      const r = contrastRatio(scale.lightSteps[7], scale.lightSteps[8]);
      assert.ok(r > 2.0, `expected > 2.0, got ${r.toFixed(4)}`);
      assert.strictEqual(round(r), fix.hoverContrast.primary.lightStep8vs9);
    });
  });

  describe("secondary #2989CC", () => {
    const scale = generateScale("#2989CC");

    it("scale matches fixture", () => {
      assert.deepStrictEqual(scale, fix.secondary.scale);
    });

    it("on-color step 9 light", () => {
      assert.deepStrictEqual(
        round(computeOnColor(scale.lightSteps[8], "light")),
        fix.secondary.onColor.step9Light,
      );
    });

    it("on-color step 9 dark", () => {
      assert.deepStrictEqual(
        round(computeOnColor(scale.darkSteps[8], "dark")),
        fix.secondary.onColor.step9Dark,
      );
    });

    it("on-secondary (step 3 light)", () => {
      assert.deepStrictEqual(
        round(computeOnColor(scale.lightSteps[2], "light")),
        fix.secondary.onColor.step3Light,
      );
    });

    it("on-secondary (step 3 dark)", () => {
      assert.deepStrictEqual(
        round(computeOnColor(scale.darkSteps[2], "dark")),
        fix.secondary.onColor.step3Dark,
      );
    });

    it("on-secondary step 9 light — below 4.5 (expected ~4.30, exemption case)", () => {
      const on = computeOnColor(scale.lightSteps[8], "light");
      assert.ok(on.ratio < 4.5, `expected < 4.5, got ${on.ratio.toFixed(2)}`);
      assert.ok(on.ratio > 4.0, `expected > 4.0, got ${on.ratio.toFixed(2)}`);
    });

    it("on-secondary step 9 dark — passes with canonical neutrals", () => {
      const on = computeOnColor(scale.darkSteps[8], "dark");
      assert.ok(on.ratio >= 4.5, `expected >= 4.5, got ${on.ratio.toFixed(2)}`);
    });

    it("hover ratio step 8 vs 9 — light mode nearly invisible (< 1.15)", () => {
      const r = contrastRatio(scale.lightSteps[7], scale.lightSteps[8]);
      assert.ok(r < 1.15, `expected < 1.15, got ${r.toFixed(4)}`);
      assert.strictEqual(round(r), fix.hoverContrast.secondary.lightStep8vs9);
    });

    it("hover ratio step 8 vs 9 — dark mode visible (> 2)", () => {
      const r = contrastRatio(scale.darkSteps[7], scale.darkSteps[8]);
      assert.ok(r > 2.0, `expected > 2.0, got ${r.toFixed(4)}`);
      assert.strictEqual(round(r), fix.hoverContrast.secondary.darkStep8vs9);
    });
  });
});

// ── Gamut limit: #0000ff ─────────────────────────────────────────────────────

describe("gamut-limit #0000ff", () => {
  const fix = load("gamut-limit.json");
  const scale = generateScale("#0000ff");

  it("scale matches fixture", () => {
    assert.deepStrictEqual(scale, fix.scale);
  });

  it("on-color step 9 light", () => {
    assert.deepStrictEqual(
      round(computeOnColor(scale.lightSteps[8], "light")),
      fix.onColor.step9Light,
    );
  });

  it("on-color step 9 dark", () => {
    assert.deepStrictEqual(
      round(computeOnColor(scale.darkSteps[8], "dark")),
      fix.onColor.step9Dark,
    );
  });

  it("all steps are valid 7-char hex", () => {
    for (const hex of [...scale.lightSteps, ...scale.darkSteps]) {
      assert.match(hex, /^#[0-9a-f]{6}$/, `invalid hex: ${hex}`);
    }
  });
});

// ── Neutro puro: graySlot ────────────────────────────────────────────────────

describe("gray-tertiary (graySlot)", () => {
  const fix = load("gray-tertiary.json");

  it("graySlot output matches fixture", () => {
    assert.deepStrictEqual(graySlot("base"), fix.slot);
  });

  it("refs palette.neutral, not color.gray", () => {
    const slot = graySlot("base");
    for (let i = 1; i <= 12; i++) {
      assert.ok(
        slot[String(i)].$value.startsWith("{palette.neutral."),
        `step ${i} should ref palette.neutral`,
      );
    }
  });
});

// ── Tertiary brand-colorato ──────────────────────────────────────────────────

describe("tertiary-brand #e85d04", () => {
  const fix = load("tertiary-brand.json");
  const scale = generateScale("#e85d04");

  it("scale matches fixture (same generateScale as primary/secondary)", () => {
    assert.deepStrictEqual(scale, fix.scale);
  });

  it("on-color uses same computeOnColor as primary/secondary", () => {
    assert.deepStrictEqual(
      round(computeOnColor(scale.lightSteps[8], "light")),
      fix.onColor.step9Light,
    );
    assert.deepStrictEqual(
      round(computeOnColor(scale.darkSteps[8], "dark")),
      fix.onColor.step9Dark,
    );
  });

  it("brandSlot output matches fixture", () => {
    assert.deepStrictEqual(brandSlot("color.tertiary", "brand"), fix.slot);
  });
});

// ── computeOnColorPair ──────────────────────────────────────────────────────

describe("computeOnColorPair", () => {
  it("primary #004B93 — both modes pass", () => {
    const scale = generateScale("#004B93");
    const pair = round(
      computeOnColorPair(scale.lightSteps[8], scale.darkSteps[8]),
    );
    assert.deepStrictEqual(pair, {
      lightHex: "#fcfcfc",
      darkHex: "#eeeeee",
      lightRef: "{palette.neutral.1}",
      darkRef: "{palette.neutral.12}",
      lightRatio: 8.431233,
      darkRatio: 7.455409,
      lightPassed: true,
      darkPassed: true,
    });
  });

  it("secondary #2989CC — light below 4.5 (exemption case)", () => {
    const scale = generateScale("#2989CC");
    const pair = round(
      computeOnColorPair(scale.lightSteps[8], scale.darkSteps[8]),
    );
    assert.deepStrictEqual(pair, {
      lightHex: "#202020",
      darkHex: "#111111",
      lightRef: "{palette.neutral.12}",
      darkRef: "{palette.neutral.1}",
      lightRatio: 4.301787,
      darkRatio: 4.985554,
      lightPassed: false,
      darkPassed: true,
    });
  });

  it("gamut-limit #0000ff — both modes pass", () => {
    const scale = generateScale("#0000ff");
    const pair = round(
      computeOnColorPair(scale.lightSteps[8], scale.darkSteps[8]),
    );
    assert.deepStrictEqual(pair, {
      lightHex: "#fcfcfc",
      darkHex: "#eeeeee",
      lightRef: "{palette.neutral.1}",
      darkRef: "{palette.neutral.12}",
      lightRatio: 8.375166,
      darkRatio: 7.405831,
      lightPassed: true,
      darkPassed: true,
    });
  });

  it("tertiary #e85d04 — both modes pass", () => {
    const scale = generateScale("#e85d04");
    const pair = round(
      computeOnColorPair(scale.lightSteps[8], scale.darkSteps[8]),
    );
    assert.deepStrictEqual(pair, {
      lightHex: "#202020",
      darkHex: "#111111",
      lightRef: "{palette.neutral.12}",
      darkRef: "{palette.neutral.1}",
      lightRatio: 4.654172,
      darkRatio: 5.39395,
      lightPassed: true,
      darkPassed: true,
    });
  });

  it("agrees with individual computeOnColor calls", () => {
    const scale = generateScale("#004B93");
    const pair = computeOnColorPair(scale.lightSteps[8], scale.darkSteps[8]);
    const light = computeOnColor(scale.lightSteps[8], "light");
    const dark = computeOnColor(scale.darkSteps[8], "dark");
    assert.strictEqual(pair.lightHex, light.hex);
    assert.strictEqual(pair.darkHex, dark.hex);
    assert.strictEqual(pair.lightRef, light.ref);
    assert.strictEqual(pair.darkRef, dark.ref);
    assert.strictEqual(pair.lightRatio, light.ratio);
    assert.strictEqual(pair.darkRatio, dark.ratio);
    assert.strictEqual(pair.lightPassed, light.passed);
    assert.strictEqual(pair.darkPassed, dark.passed);
  });
});
