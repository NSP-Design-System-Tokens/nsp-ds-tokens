// Interactive brand project generator.
// Generates a complete brand token project from hex color(s), no manual JSON editing.
//
// Usage (interactive):   node scripts/create-project.mjs
// Usage (non-interactive): node scripts/create-project.mjs <name> <primaryHex> [secondaryHex] [accentHex]

import { createInterface } from "node:readline/promises";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { oklch, formatHex, clampChroma, parse } from "culori";
import { contrast } from "./lib/contrast.mjs";

const LIB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ── Color scale generation ───────────────────────────────────────────────────
//
// 12-step OKLCH scale anchored at the brand hex (step 9 = exact input).
// Chroma ramps toward step 9 and tapers on 10–12; lightness follows the
// Radix perceptual curve. Source: docs/DESIGN-SYSTEM-GUIDE.md § Regenerating.

function generateScale(anchorHex) {
  const base = oklch(anchorHex);
  if (!base) throw new Error(`Cannot parse color: ${anchorHex}`);

  const LIGHT_L = [
    0.985,
    0.97,
    0.94,
    0.91,
    0.87,
    0.82,
    0.74,
    0.63,
    base.l,
    base.l - 0.05,
    base.l - 0.12,
    base.l - 0.22,
  ];
  const DARK_L = [
    0.1,
    0.14,
    0.19,
    0.24,
    0.28,
    0.32,
    0.37,
    0.4,
    base.l,
    base.l + 0.06,
    base.l + 0.18,
    base.l + 0.32,
  ];

  const mkStep = (l, c, h) =>
    formatHex(clampChroma({ mode: "oklch", l, c, h }, "oklch"));

  const lightSteps = LIGHT_L.map((l, i) =>
    mkStep(l, base.c * (i < 8 ? 0.6 + i * 0.05 : 1), base.h),
  );
  const darkSteps = DARK_L.map((l, i) =>
    mkStep(l, base.c * (i < 8 ? 0.5 + i * 0.08 : 1), base.h),
  );

  // Force exact anchor at step 9 (index 8) to avoid OKLCH↔hex rounding drift.
  const anchor = formatHex(anchorHex);
  lightSteps[8] = anchor;
  darkSteps[8] = anchor;

  return { lightSteps, darkSteps, anchor };
}

function buildColorTree(lightSteps, darkSteps, origin) {
  const tree = { $extensions: { nsp: { origin } } };
  for (let i = 0; i < 12; i++) {
    tree[String(i + 1)] = {
      $type: "color",
      $value: lightSteps[i],
      $extensions: {
        "com.figma.modes": { light: lightSteps[i], dark: darkSteps[i] },
      },
    };
  }
  return tree;
}

// ── on-color selection ───────────────────────────────────────────────────────

// Pick the on-color (text/icon) for a solid fill at step 9.
// Returns { lightRef, darkRef, hex, ratio, passed } where lightRef/darkRef are
// palette refs that work in each mode.
//
// For white text: neutral.0 (always #fff) works the same in both modes.
// For dark text:  neutral.12 in LIGHT mode = mauve.12.light = near-black ✓
//                 neutral.1  in DARK mode  = mauve.1.dark   = near-black ✓
// (Radix dark scale inverts: step 1 = darkest, step 12 = lightest.)
function pickOnColor(step9Hex) {
  const WHITE = "#ffffff";
  const BLACK = "#000000";
  const ratioWhite = contrast(WHITE, step9Hex);
  const ratioBlack = contrast(BLACK, step9Hex);
  if (ratioWhite >= 4.5)
    return {
      lightRef: "{palette.neutral.0}",
      darkRef: "{palette.neutral.0}",
      hex: WHITE,
      ratio: ratioWhite,
      passed: true,
    };
  if (ratioBlack >= 4.5)
    return {
      lightRef: "{palette.neutral.12}",
      darkRef: "{palette.neutral.1}",
      hex: BLACK,
      ratio: ratioBlack,
      passed: true,
    };
  // Neither passes — warn and pick the better option.
  if (ratioWhite >= ratioBlack)
    return {
      lightRef: "{palette.neutral.0}",
      darkRef: "{palette.neutral.0}",
      hex: WHITE,
      ratio: ratioWhite,
      passed: false,
    };
  return {
    lightRef: "{palette.neutral.12}",
    darkRef: "{palette.neutral.1}",
    hex: BLACK,
    ratio: ratioBlack,
    passed: false,
  };
}

// Pick the best step from the primary scale for brand text on light backgrounds
// (surface.page / surface.card). Tests text threshold 4.5:1 on white.
// Returns { step (1-based), hex, passed }.
function pickTextStep(lightSteps) {
  const WHITE = "#ffffff";
  // Steps 9→12 in order; step 9 = identity anchor (works for most dark brands),
  // 11-12 for medium brands. For very light colors (yellow, lime), none may pass.
  for (const idx of [8, 9, 10, 11]) {
    const hex = lightSteps[idx];
    if (contrast(hex, WHITE) >= 4.5)
      return { step: idx + 1, hex, passed: true };
  }
  // Fallback: use step 12 (best available) even if it doesn't pass.
  return { step: 12, hex: lightSteps[11], passed: false };
}

// Pick the best step for icon/stroke (threshold 3.0:1).
function pickIconStep(lightSteps) {
  const WHITE = "#ffffff";
  for (const idx of [8, 9, 10, 11, 7]) {
    const hex = lightSteps[idx];
    if (contrast(hex, WHITE) >= 3.0)
      return { step: idx + 1, hex, passed: true };
  }
  return { step: 12, hex: lightSteps[11], passed: false };
}

// ── readline helpers ─────────────────────────────────────────────────────────

async function prompt(rl, question, validate) {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const answer = (await rl.question(question)).trim();
    if (!validate) return answer;
    const err = validate(answer);
    if (!err) return answer;
    console.error(`  ✗ ${err}`);
  }
}

function validateName(v) {
  if (!v) return "Name is required";
  if (!/^[a-z][a-z0-9-]*$/.test(v))
    return "Name must be lowercase kebab-case (letters, digits, hyphens)";
  return null;
}

function validateHex(v) {
  if (!v) return null; // optional
  if (!parse(v)) return `Cannot parse "${v}" — use a hex value like #2563eb`;
  return null;
}

function validateRequiredHex(v) {
  if (!v) return "Color hex is required";
  return validateHex(v);
}

// ── token builders ───────────────────────────────────────────────────────────

const ct = (light, dark) => ({
  $type: "color",
  $value: light,
  $extensions: { "com.figma.modes": { light, dark } },
});

function brandSlot(hueRef, origin) {
  const slot = {};
  for (let i = 1; i <= 12; i++)
    slot[String(i)] = { $type: "color", $value: `{${hueRef}.${i}}` };
  slot.default = { $type: "color", $value: `{${hueRef}.9}` };
  slot.subtle = { $type: "color", $value: `{${hueRef}.3}` };
  slot.hover = { $type: "color", $value: `{${hueRef}.10}` };
  slot.$extensions = { nsp: { origin } };
  return slot;
}

function mauveSlot(origin) {
  const slot = {};
  for (let i = 1; i <= 12; i++)
    slot[String(i)] = { $type: "color", $value: `{color.mauve.${i}}` };
  slot.default = { $type: "color", $value: "{color.mauve.9}" };
  slot.$extensions = { nsp: { origin } };
  return slot;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    const [, , argName, argPrimary, argSecondary, argAccent] = process.argv;

    console.log(
      "\n── nsp-ds-tokens project generator ─────────────────────────\n",
    );

    // 1. Gather inputs
    const name =
      argName ??
      (await prompt(rl, "Project name (kebab-case): ", validateName));

    const nameErr = validateName(name);
    if (nameErr) {
      console.error(`✗ ${nameErr}`);
      process.exit(1);
    }

    const dest = resolve(LIB_ROOT, `../nsp-ds-tokens-${name}`);
    if (existsSync(dest)) {
      console.error(`✗ Directory already exists: ${dest}`);
      process.exit(1);
    }

    const primaryHex =
      argPrimary ??
      (await prompt(rl, "Primary brand color (#hex): ", validateRequiredHex));

    const secondaryRaw =
      argSecondary !== undefined
        ? argSecondary
        : await prompt(
            rl,
            "Secondary color (#hex, or Enter = same as primary): ",
            validateHex,
          );

    const accentRaw =
      argAccent !== undefined
        ? argAccent
        : await prompt(
            rl,
            "Accent color (#hex, or Enter = same as primary): ",
            validateHex,
          );

    const secondaryHex = secondaryRaw || primaryHex;
    const accentHex = accentRaw || primaryHex;

    // 2. Generate scales
    console.log("\nGenerating color scales...");

    const primaryScale = generateScale(primaryHex);
    const secondaryScale =
      secondaryHex === primaryHex ? primaryScale : generateScale(secondaryHex);
    const accentScale =
      accentHex === primaryHex
        ? primaryScale
        : accentHex === secondaryHex
          ? secondaryScale
          : generateScale(accentHex);

    // Scale key = the sub-key under "color" in core/color.json
    const primaryKey = name;
    const secondaryKey =
      secondaryScale === primaryScale ? name : `${name}-secondary`;
    const accentKey =
      accentScale === primaryScale
        ? name
        : accentScale === secondaryScale
          ? secondaryKey
          : `${name}-accent`;

    // Palette ref prefixes used in brand slots (e.g. "color.wolfhaus")
    const primaryRef = `color.${primaryKey}`;
    const secondaryRef = `color.${secondaryKey}`;
    const accentRef = `color.${accentKey}`;

    const origin = `brand-${name}`;

    console.log(`  ✓ ${primaryRef}: step 9 = ${primaryScale.anchor}`);
    if (secondaryScale !== primaryScale)
      console.log(`  ✓ ${secondaryRef}: step 9 = ${secondaryScale.anchor}`);
    if (accentScale !== primaryScale && accentScale !== secondaryScale)
      console.log(`  ✓ color.${accentKey}: step 9 = ${accentScale.anchor}`);

    // 3. Auto-select on-color (text/icon ON the solid primary fill = step 9).
    const onPrimary = pickOnColor(primaryScale.anchor);

    // 3b. Auto-select step for brand text/icon on light page/card backgrounds.
    //     Step 9 works for most dark brands; light brands (yellow, lime) may need
    //     step 11-12, or may still fail (inherent color limitation → build warns).
    const textSel = pickTextStep(primaryScale.lightSteps);
    const iconSel = pickIconStep(primaryScale.lightSteps);

    console.log("\nAuto-selected on-color:");
    console.log(
      `  on-primary: ${onPrimary.hex} (${onPrimary.ratio.toFixed(2)}:1` +
        ` on ${primaryScale.anchor}) ${onPrimary.passed ? "✓" : "⚠ below 4.5:1"}`,
    );
    console.log(
      `  brand text step: ${textSel.step} (${textSel.hex}) ${textSel.passed ? "✓" : "⚠ no step achieves 4.5:1 on white"}`,
    );
    if (!textSel.passed)
      console.warn(
        `  ⚠ Primary color is too light for accessible text on white.\n` +
          `    text.primary/text.title will use step ${textSel.step} (best available).\n` +
          `    Consider using a darker primary or adding contrast exemptions.`,
      );

    // 4. on-secondary: surface.secondary = palette.secondary.3 (ghost/tint, step 3).
    //    Dark text (step 12) on a light tint always achieves ≥ 4.5:1; no dynamic
    //    selection needed. (pickOnColor tests step 9 solid fill — wrong surface here.)
    const onSecondaryRef = "{palette.secondary.12}";

    // 5. Write files
    console.log("\nWriting token files...");

    const write = (rel, content) => {
      const p = resolve(dest, rel);
      mkdirSync(dirname(p), { recursive: true });
      const str =
        typeof content === "string"
          ? content
          : JSON.stringify(content, null, 2) + "\n";
      writeFileSync(p, str);
    };

    const relToLib = relative(dest, LIB_ROOT).replace(/\\/g, "/");

    const copyScript = (filename) =>
      write(
        `scripts/${filename}`,
        readFileSync(resolve(LIB_ROOT, "scripts", filename), "utf8"),
      );

    // package.json
    write("package.json", {
      name: `nsp-ds-tokens-${name}`,
      version: "0.1.0",
      type: "module",
      description: `${name} brand tokens — extends nsp-ds-tokens base library.`,
      scripts: {
        validate: "node scripts/validate.mjs",
        "contrast-report": "node scripts/validate.mjs",
        "build:figma": "node scripts/build-figma.mjs",
        "build:css": "node scripts/build-css.mjs",
        "build:preview": "node scripts/build-preview.mjs",
        build:
          "npm run validate && npm run build:figma && npm run build:css && npm run build:preview",
      },
      dependencies: {
        culori: "^4.0.1",
        "nsp-ds-tokens": `file:${relToLib}`,
      },
    });

    // .gitignore
    write(".gitignore", "node_modules/\nbuild/\ndist/\n");

    // scripts/lib/ wrappers
    write(
      "scripts/lib/tokens.mjs",
      `// Wrapper: re-export everything from nsp-ds-tokens lib, override ROOT + loadMerged
// so all build and validate scripts operate on base+brand merged tree.

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export {
  isLeaf,
  eachLeaf,
  listModes,
  pickMode,
  subtreeOf,
  TIERS,
  COLOR_MODE_GROUPS,
  RESP_MODE_GROUPS,
  LAYOUT_MODE_GROUPS,
} from "nsp-ds-tokens/scripts/lib/tokens.mjs";

import { loadMergedWith } from "nsp-ds-tokens/scripts/lib/tokens.mjs";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const TOKENS_DIR = resolve(ROOT, "tokens");

export function loadMerged() {
  return loadMergedWith([TOKENS_DIR]);
}
`,
    );
    write(
      "scripts/lib/contrast.mjs",
      `export * from "nsp-ds-tokens/scripts/lib/contrast.mjs";\n`,
    );
    write(
      "scripts/lib/origin.mjs",
      `export * from "nsp-ds-tokens/scripts/lib/origin.mjs";\n`,
    );

    // Copy build + validate scripts verbatim from library
    for (const s of [
      "validate.mjs",
      "build-figma.mjs",
      "build-css.mjs",
      "build-preview.mjs",
    ])
      copyScript(s);

    // tokens/core/color.json — generated brand scales (real hex values)
    const colorJson = { color: {} };
    colorJson.color[primaryKey] = buildColorTree(
      primaryScale.lightSteps,
      primaryScale.darkSteps,
      origin,
    );
    if (secondaryScale !== primaryScale) {
      colorJson.color[secondaryKey] = buildColorTree(
        secondaryScale.lightSteps,
        secondaryScale.darkSteps,
        origin,
      );
    }
    if (accentScale !== primaryScale && accentScale !== secondaryScale) {
      colorJson.color[accentKey] = buildColorTree(
        accentScale.lightSteps,
        accentScale.darkSteps,
        origin,
      );
    }
    write("tokens/core/color.json", colorJson);

    // tokens/brand/<name>.json — palette slots
    write(`tokens/brand/${name}.json`, {
      palette: {
        $extensions: { "com.figma.scoping": [] },
        primary: brandSlot(primaryRef, origin),
        secondary: brandSlot(secondaryRef, origin),
        tertiary: mauveSlot(origin),
        accent: brandSlot(accentRef, origin),
      },
    });

    // tokens/semantic/color.json — brand semantic roles.
    // All refs go through palette.* (layering rule).
    // text/icon steps are auto-selected; on-primary uses mode-specific refs.
    const ps = (n) => `{palette.primary.${n}}`;
    const ts = textSel.step;
    const th = Math.min(ts + 1, 12); // text hover step
    const is_ = iconSel.step;
    const ih = Math.min(is_ + 1, 12); // icon hover step
    write("tokens/semantic/color.json", {
      surface: {
        "primary-xlight": ct(ps(3), ps(10)),
        "primary-light": ct(ps(8), ps(10)),
        primary: ct(ps(9), ps(9)),
        "primary-dark": ct(ps(10), ps(8)),
        "primary-hover": ct(ps(10), ps(8)),
        secondary: ct("{palette.secondary.3}", "{palette.secondary.3}"),
        "secondary-hover": ct("{palette.secondary.4}", "{palette.secondary.4}"),
        "secondary-active": ct(
          "{palette.secondary.5}",
          "{palette.secondary.5}",
        ),
        tertiary: ct("{palette.tertiary.3}", "{palette.tertiary.3}"),
        "tertiary-hover": ct("{palette.tertiary.4}", "{palette.tertiary.4}"),
        "tertiary-active": ct("{palette.tertiary.5}", "{palette.tertiary.5}"),
        "tertiary-dark": ct("{palette.neutral.11}", "{palette.neutral.12}"),
        "tertiary-darker": ct("{palette.neutral.12}", "{palette.neutral.11}"),
      },
      text: {
        title: ct(ps(ts), ps(12)),
        primary: ct(ps(ts), ps(12)),
        "primary-light": ct(ps(8), ps(8)), // decorative, exempt from contrast
        "primary-xlight": ct(ps(3), ps(3)), // decorative, exempt from contrast
        "primary-hover": ct(ps(th), ps(12)),
        "on-primary": ct(onPrimary.lightRef, onPrimary.darkRef),
        "on-secondary": ct(onSecondaryRef, onSecondaryRef),
        "on-tertiary": ct("{palette.tertiary.12}", "{palette.tertiary.12}"),
      },
      stroke: {
        primary: ct(ps(is_), ps(11)),
        hover: ct(ps(ih), ps(11)),
      },
      logo: {
        default: ct(ps(9), ps(8)),
      },
      icon: {
        primary: ct(ps(is_), ps(12)),
        "primary-light": ct(ps(8), ps(11)), // decorative, exempt
        "primary-hover": ct(ps(ih), ps(12)),
        secondary: ct("{palette.secondary.11}", "{palette.secondary.12}"),
        "on-primary": ct(onPrimary.lightRef, onPrimary.darkRef),
        "on-secondary": ct(onSecondaryRef, onSecondaryRef),
        "on-tertiary": ct("{palette.tertiary.12}", "{palette.tertiary.12}"),
      },
      "emphasis-brand": {
        default: ct(ps(8), ps(8)),
        dark: ct(ps(10), ps(10)),
      },
      emphasis: {
        default: ct("{palette.accent.default}", "{palette.accent.subtle}"),
        subtle: ct("{palette.accent.2}", "{palette.accent.4}"),
      },
    });

    // CLAUDE.md
    const colorLines = [
      `- Primary (step 9): \`${primaryScale.anchor}\``,
      ...(secondaryScale !== primaryScale
        ? [`- Secondary (step 9): \`${secondaryScale.anchor}\``]
        : []),
      ...(accentScale !== primaryScale && accentScale !== secondaryScale
        ? [`- Accent (step 9): \`${accentScale.anchor}\``]
        : []),
      `- text.on-primary: \`${onPrimary.hex}\` (${onPrimary.ratio.toFixed(2)}:1 on primary.9)`,
    ].join("\n");

    write(
      "CLAUDE.md",
      `# CLAUDE.md — nsp-ds-tokens-${name}

Brand token project for **${name}**. Extends [nsp-ds-tokens](${relToLib}) base library.

## What this is

All spacing, typography, motion, z-index, radius, neutral palette, state palette
(error/success/warning), and base semantic roles live in the base library.
This repo adds only what is ${name}-specific.

## Tier map

\`\`\`
tokens/
  core/color.json     ← ${name} brand color scale (12 steps, light + dark)
  brand/${name}.json  ← palette slot aliases: primary, secondary, tertiary, accent
  semantic/color.json ← brand semantic roles: surface.primary, text.on-primary, …
\`\`\`

## Colors

${colorLines}

## Build

\`\`\`bash
npm run validate     # dangling refs, mode coverage, naming, origin check
npm run build        # validate + figma + css + preview
\`\`\`

Outputs: \`dist/figma-variables.json\`, \`dist/figma-styles.json\`,
\`build/css/tokens.css\`, \`build/tailwind/tokens.cjs\`, \`build/preview/index.html\`.

## Rules

1. Never edit \`node_modules/\`, \`build/\`, or \`dist/\`.
2. Brand-specific tokens only: neutral/state palette, base semantic, spacing, type,
   layout all come from the base library and are not duplicated here.
3. Semantic tokens reference \`palette.*\` slots — never \`color.*\` directly.
4. Origin marker on every color primitive group and palette slot: \`"${origin}"\`.
5. \`npm run validate\` must pass before committing.
`,
    );

    console.log("  ✓ Token files written");

    // 6. npm install
    console.log("\nRunning npm install...");
    try {
      execSync("npm install", { cwd: dest, stdio: "inherit" });
    } catch {
      console.error(
        "✗ npm install failed — run it manually in the project directory.",
      );
      process.exit(1);
    }

    // 7. build + gate
    console.log("\nRunning npm run build...");
    let buildOutput = "";
    let buildPassed = false;
    try {
      buildOutput = execSync("npm run build 2>&1", {
        cwd: dest,
        encoding: "utf8",
      });
      buildPassed = true;
    } catch (e) {
      buildOutput = e.stdout ?? String(e.message);
    }

    // Always print build output
    process.stdout.write(buildOutput);

    if (buildPassed) {
      console.log(`\n✓ Project ${name} ready at ${dest}`);
      console.log(`\nNext steps:`);
      console.log(`  cd ${dest}`);
      console.log(`  npm run build:preview   # open build/preview/index.html`);
      console.log(`  # Import dist/ in Figma via Token Manager plugin`);
    } else {
      // Parse contrast failures for a focused error message
      const contrastLines = buildOutput
        .split("\n")
        .filter((l) => l.includes("contrast:"))
        .map((l) => l.trim());

      if (contrastLines.length > 0) {
        console.error(
          `\n⚠ Build failed: ${contrastLines.length} contrast issue(s).`,
        );
        console.error(
          "  Adjust palette slot steps in tokens/semantic/color.json,",
        );
        console.error(
          "  or add exemptions to scripts/lib/contrast.mjs (CONTRAST_EXEMPT).",
        );
      } else {
        console.error(`\n✗ Build failed. Check output above.`);
      }
      console.error(`Project directory: ${dest}`);
      process.exit(1);
    }
  } finally {
    rl.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
