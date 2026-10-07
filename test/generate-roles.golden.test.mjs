import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateScale,
  computeOnColorPair,
  pickTextStep,
  pickIconStep,
} from "../scripts/lib/generate-scale.mjs";
import { expandRoles, ROLE_MAP } from "../scripts/lib/generate-roles.mjs";

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures");
const load = (name) => JSON.parse(readFileSync(resolve(DIR, name), "utf8"));

function computeExpanderInputs(primaryHex, secondaryHex) {
  const ps = generateScale(primaryHex);
  const ss = secondaryHex ? generateScale(secondaryHex) : null;

  const onPrimary = computeOnColorPair(ps.lightSteps[8], ps.darkSteps[8]);
  const onPrimaryHover = computeOnColorPair(ps.lightSteps[9], ps.darkSteps[7]);
  const onPrimaryActive = computeOnColorPair(
    ps.lightSteps[10],
    ps.darkSteps[6],
  );

  const primaryHoverDiffers =
    onPrimary.lightRef !== onPrimaryHover.lightRef ||
    onPrimary.darkRef !== onPrimaryHover.darkRef;
  const primaryActiveDiffers =
    onPrimary.lightRef !== onPrimaryActive.lightRef ||
    onPrimary.darkRef !== onPrimaryActive.darkRef;

  const onSecondary = ss
    ? computeOnColorPair(ss.lightSteps[2], ss.darkSteps[2])
    : computeOnColorPair(ps.lightSteps[2], ps.darkSteps[2]);

  return {
    onPrimary,
    onPrimaryHover: primaryHoverDiffers ? onPrimaryHover : null,
    onPrimaryActive: primaryActiveDiffers ? onPrimaryActive : null,
    onSecondary,
    textStep: pickTextStep(ps.lightSteps).step,
    iconStep: pickIconStep(ps.lightSteps).step,
    secondaryIconStep: ss
      ? pickIconStep(ss.lightSteps).step
      : pickIconStep(ps.lightSteps).step,
  };
}

// ── Andrea reale: #004B93 / #2989CC (with secondary) ───────────────────────

describe("roles andrea-reale (with secondary)", () => {
  const inputs = computeExpanderInputs("#004B93", "#2989CC");
  const result = expandRoles({
    ...inputs,
    hasSecondary: true,
    hasAccent: false,
  });
  const golden = load("roles-andrea-reale.json");

  it("expander output matches golden fixture", () => {
    assert.deepStrictEqual(result, golden);
  });

  it("renamed tokens use -subtle suffix", () => {
    assert.ok(result.surface["secondary-subtle"]);
    assert.ok(result.surface["secondary-subtle-hover"]);
    assert.ok(result.surface["secondary-subtle-active"]);
    assert.ok(result.surface["tertiary-subtle"]);
    assert.ok(result.surface["tertiary-subtle-hover"]);
    assert.ok(result.surface["tertiary-subtle-active"]);
    assert.ok(result.text["on-secondary-subtle"]);
    assert.ok(result.icon["on-secondary-subtle"]);
  });

  it("old names are absent", () => {
    assert.ok(!result.surface["secondary"]);
    assert.ok(!result.surface["secondary-hover"]);
    assert.ok(!result.surface["tertiary"]);
    assert.ok(!result.surface["tertiary-hover"]);
    assert.ok(!result.text["on-secondary"]);
    assert.ok(!result.icon["on-secondary"]);
  });

  it("primary surface refs unchanged", () => {
    assert.equal(result.surface["primary"].$value, "{palette.primary.9}");
    assert.equal(
      result.surface["primary-hover"].$extensions["com.figma.modes"].dark,
      "{palette.primary.8}",
    );
  });

  it("secondary-subtle refs match secondary palette step 3/4/5", () => {
    assert.equal(
      result.surface["secondary-subtle"].$value,
      "{palette.secondary.3}",
    );
    assert.equal(
      result.surface["secondary-subtle-hover"].$value,
      "{palette.secondary.4}",
    );
    assert.equal(
      result.surface["secondary-subtle-active"].$value,
      "{palette.secondary.5}",
    );
  });

  it("no emphasis when hasAccent is false", () => {
    assert.ok(!result.emphasis);
  });
});

// ── Primary only (no secondary) ────────────────────────────────────────────

describe("roles primary-only (no secondary)", () => {
  const inputs = computeExpanderInputs("#004B93", null);
  const result = expandRoles({
    ...inputs,
    hasSecondary: false,
    hasAccent: false,
  });
  const golden = load("roles-primary-only.json");

  it("expander output matches golden fixture", () => {
    assert.deepStrictEqual(result, golden);
  });

  it("no secondary surface tokens", () => {
    assert.ok(!result.surface["secondary-subtle"]);
    assert.ok(!result.surface["secondary-subtle-hover"]);
    assert.ok(!result.surface["secondary-subtle-active"]);
  });

  it("no secondary on-color tokens", () => {
    assert.ok(!result.text["on-secondary-subtle"]);
    assert.ok(!result.icon["on-secondary-subtle"]);
  });

  it("no icon.secondary", () => {
    assert.ok(!result.icon["secondary"]);
  });

  it("tertiary tokens still present", () => {
    assert.ok(result.surface["tertiary-subtle"]);
    assert.ok(result.surface["tertiary-subtle-hover"]);
    assert.ok(result.surface["tertiary-subtle-active"]);
  });

  it("primary tokens still present", () => {
    assert.ok(result.surface["primary"]);
    assert.ok(result.text["title"]);
    assert.ok(result.text["on-primary"]);
    assert.ok(result.icon["primary"]);
    assert.ok(result.stroke["primary"]);
  });
});

// ── ROLE_MAP consistency ────────────────────────────────────────────────────

describe("ROLE_MAP", () => {
  it("is frozen", () => {
    assert.ok(Object.isFrozen(ROLE_MAP));
  });

  it("every entry with slot has step or light/dark", () => {
    for (const [group, entries] of Object.entries(ROLE_MAP)) {
      for (const [name, def] of Object.entries(entries)) {
        if (def.slot) {
          const hasStep = "step" in def;
          const hasPerMode = "light" in def && "dark" in def;
          assert.ok(
            hasStep || hasPerMode,
            `${group}.${name} has slot but no step or light/dark`,
          );
        }
      }
    }
  });
});
