// Scaffold a new brand project that extends nsp-tokens.
// Usage: node scripts/create-project.mjs <project-name> [dest-dir]
// Example: node scripts/create-project.mjs wolfhaus ../nsp-tokens-wolfhaus

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const LIB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const [, , name, destArg] = process.argv;

if (!name) {
  console.error(
    "Usage: node scripts/create-project.mjs <project-name> [dest-dir]",
  );
  process.exit(1);
}
if (!/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error(
    `Error: project name must be lowercase kebab-case, got: ${name}`,
  );
  process.exit(1);
}

const dest = resolve(destArg ?? resolve(LIB_ROOT, `../nsp-tokens-${name}`));

if (existsSync(dest)) {
  console.error(`Error: directory already exists: ${dest}`);
  process.exit(1);
}

// Path from the new project to this library (for package.json file: dep)
const relToLib = relative(dest, LIB_ROOT).replace(/\\/g, "/");

// ---- helpers ----------------------------------------------------------------

const write = (rel, content) => {
  const p = resolve(dest, rel);
  mkdirSync(dirname(p), { recursive: true });
  const str =
    typeof content === "string"
      ? content
      : JSON.stringify(content, null, 2) + "\n";
  writeFileSync(p, str);
};

const copyScript = (filename) => {
  write(
    `scripts/${filename}`,
    readFileSync(resolve(LIB_ROOT, "scripts", filename), "utf8"),
  );
};

const ct = (light, dark) => ({
  $type: "color",
  $value: light,
  $extensions: { "com.figma.modes": { light, dark } },
});

// ---- 1. package.json --------------------------------------------------------

write("package.json", {
  name: `nsp-tokens-${name}`,
  version: "0.1.0",
  type: "module",
  description: `${name} brand tokens — extends nsp-tokens base library.`,
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
    "nsp-tokens": `file:${relToLib}`,
  },
});

// ---- 2. .gitignore ----------------------------------------------------------

write(".gitignore", "node_modules/\nbuild/\ndist/\n");

// ---- 3. scripts/lib/ wrappers -----------------------------------------------

write(
  "scripts/lib/tokens.mjs",
  `// Wrapper: re-export everything from nsp-tokens lib, override ROOT + loadMerged
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
} from "nsp-tokens/scripts/lib/tokens.mjs";

import { loadMergedWith } from "nsp-tokens/scripts/lib/tokens.mjs";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const TOKENS_DIR = resolve(ROOT, "tokens");

export function loadMerged() {
  return loadMergedWith([TOKENS_DIR]);
}
`,
);

write(
  "scripts/lib/contrast.mjs",
  `export * from "nsp-tokens/scripts/lib/contrast.mjs";\n`,
);
write(
  "scripts/lib/origin.mjs",
  `export * from "nsp-tokens/scripts/lib/origin.mjs";\n`,
);

// ---- 4. Copy build + validate scripts verbatim from library -----------------

for (const s of [
  "validate.mjs",
  "build-figma.mjs",
  "build-css.mjs",
  "build-preview.mjs",
]) {
  copyScript(s);
}

// ---- 5. tokens/core/color.json — empty brand color scale --------------------
// brand/<name>.json refs {color.<name>.N}: these dangle until filled in here.
// Build will fail with "dangling reference" until the designer adds 12+12 hex.

write("tokens/core/color.json", JSON.stringify({ color: {} }, null, 2) + "\n");

// ---- 6. tokens/brand/<name>.json — palette slots ----------------------------
// primary / secondary / accent → {color.<name>.N}  (dangle until core filled)
// tertiary → {color.mauve.N}  (base neutral — resolves immediately)

const origin = `brand-${name}`;
const hue = `color.${name}`;

function brandSlot(hueRef) {
  const slot = {};
  for (let i = 1; i <= 12; i++)
    slot[String(i)] = { $type: "color", $value: `{${hueRef}.${i}}` };
  slot.default = { $type: "color", $value: `{${hueRef}.9}` };
  slot.subtle = { $type: "color", $value: `{${hueRef}.3}` };
  slot.hover = { $type: "color", $value: `{${hueRef}.10}` };
  slot.$extensions = { nsp: { origin } };
  return slot;
}

function mauveSlot() {
  const slot = {};
  for (let i = 1; i <= 12; i++)
    slot[String(i)] = { $type: "color", $value: `{color.mauve.${i}}` };
  slot.default = { $type: "color", $value: "{color.mauve.9}" };
  slot.$extensions = { nsp: { origin } };
  return slot;
}

write(`tokens/brand/${name}.json`, {
  palette: {
    $extensions: { "com.figma.scoping": [] },
    primary: brandSlot(hue),
    secondary: brandSlot(hue),
    tertiary: mauveSlot(),
    accent: brandSlot(hue),
  },
});

// ---- 7. tokens/semantic/color.json — brand semantic roles -------------------
// Mirrors poli's brand semantic structure. Group-level $extensions omitted:
// base library provides com.figma.scoping; deepMerge can't merge arrays.

write("tokens/semantic/color.json", {
  surface: {
    "primary-xlight": ct("{palette.primary.3}", "{palette.primary.10}"),
    "primary-light": ct("{palette.primary.8}", "{palette.primary.10}"),
    primary: ct("{palette.primary.9}", "{palette.primary.9}"),
    "primary-dark": ct("{palette.primary.10}", "{palette.primary.8}"),
    "primary-hover": ct("{palette.primary.10}", "{palette.primary.8}"),
    secondary: ct("{palette.secondary.3}", "{palette.secondary.3}"),
    "secondary-hover": ct("{palette.secondary.4}", "{palette.secondary.4}"),
    "secondary-active": ct("{palette.secondary.5}", "{palette.secondary.5}"),
    tertiary: ct("{palette.tertiary.3}", "{palette.tertiary.3}"),
    "tertiary-hover": ct("{palette.tertiary.4}", "{palette.tertiary.4}"),
    "tertiary-active": ct("{palette.tertiary.5}", "{palette.tertiary.5}"),
    "tertiary-dark": ct("{palette.neutral.11}", "{palette.neutral.12}"),
    "tertiary-darker": ct("{palette.neutral.12}", "{palette.neutral.11}"),
  },
  text: {
    title: ct("{palette.primary.9}", "{palette.primary.12}"),
    primary: ct("{palette.primary.9}", "{palette.primary.12}"),
    "primary-light": ct("{palette.primary.8}", "{palette.primary.8}"),
    "primary-xlight": ct("{palette.primary.3}", "{palette.primary.3}"),
    "primary-hover": ct("{palette.primary.10}", "{palette.primary.12}"),
    "on-primary": ct("{palette.neutral.0}", "{palette.neutral.0}"),
    "on-secondary": ct("{palette.secondary.12}", "{palette.secondary.12}"),
    "on-tertiary": ct("{palette.tertiary.12}", "{palette.tertiary.12}"),
  },
  stroke: {
    primary: ct("{palette.primary.9}", "{palette.primary.11}"),
    hover: ct("{palette.primary.10}", "{palette.primary.11}"),
  },
  logo: {
    default: ct("{palette.primary.9}", "{palette.primary.8}"),
  },
  icon: {
    primary: ct("{palette.primary.9}", "{palette.primary.12}"),
    "primary-light": ct("{palette.primary.8}", "{palette.primary.11}"),
    "primary-hover": ct("{palette.primary.10}", "{palette.primary.12}"),
    secondary: ct("{palette.secondary.11}", "{palette.secondary.12}"),
    "on-primary": ct("{palette.neutral.0}", "{palette.neutral.0}"),
    "on-secondary": ct("{palette.secondary.12}", "{palette.secondary.12}"),
    "on-tertiary": ct("{palette.tertiary.12}", "{palette.tertiary.12}"),
  },
  "emphasis-brand": {
    default: ct("{palette.primary.8}", "{palette.primary.8}"),
    dark: ct("{palette.primary.10}", "{palette.primary.10}"),
  },
  emphasis: {
    default: ct("{palette.accent.default}", "{palette.accent.subtle}"),
    subtle: ct("{palette.accent.2}", "{palette.accent.4}"),
  },
});

// ---- 8. CLAUDE.md -----------------------------------------------------------

write(
  "CLAUDE.md",
  `# CLAUDE.md — nsp-tokens-${name}

Brand token project for **${name}**. Extends [nsp-tokens](${relToLib}) base library.

## What this is

All spacing, typography, motion, z-index, radius, neutral palette, state palette
(error/success/warning), and base semantic roles live in the base library.
This repo adds only what is ${name}-specific.

## Tier map

\`\`\`
tokens/
  core/color.json    ← ${name} brand color scale (12 steps, light + dark)
  brand/${name}.json ← palette slot aliases: primary, secondary, tertiary, accent
  semantic/color.json← brand semantic roles: surface.primary, text.on-primary, …
\`\`\`

## First-time setup

Before the build can pass you must add the brand color scale:

1. Go to https://www.radix-ui.com/colors/custom
2. Enter the brand hex as "accent color"
3. Copy 12 light hex + 12 dark hex (ignore alpha, p3, contrast/surface/indicator/track)
4. Add to \`tokens/core/color.json\`:

\`\`\`json
{
  "color": {
    "${name}": {
      "\$extensions": { "nsp": { "origin": "brand-${name}" } },
      "1":  { "\$type": "color", "\$value": "#hex-light-1", "\$extensions": { "com.figma.modes": { "light": "#hex-light-1", "dark": "#hex-dark-1" } } },
      "2":  { ... },
      "3":  { ... },
      ...
      "12": { "\$type": "color", "\$value": "#hex-light-12", "\$extensions": { "com.figma.modes": { "light": "#hex-light-12", "dark": "#hex-dark-12" } } }
    }
  }
}
\`\`\`

5. \`npm run build\` — passes when all refs resolve and contrast gate is green.

## Build

\`\`\`bash
npm run validate     # dangling refs, mode coverage, naming, origin check
npm run build        # validate + figma + css + preview
\`\`\`

Outputs: \`dist/figma-variables.json\`, \`dist/figma-styles.json\`,
\`build/css/tokens.css\`, \`build/tailwind/tokens.cjs\`, \`build/preview/index.html\`.

## Rules

1. Never edit \`node_modules/\`, \`build/\`, or \`dist/\`.
2. Brand-specific tokens only: neutral/state palette, base semantic, spacing, type, layout
   all come from the base library and are not duplicated here.
3. Semantic tokens here reference \`palette.*\` slots — never \`color.*\` directly.
4. Origin marker on every color primitive group and palette slot: \`"brand-${name}"\`.
5. \`npm run validate\` must pass before committing.
`,
);

// ---- 9. npm install ---------------------------------------------------------

console.log(`\nScaffolding nsp-tokens-${name} in ${dest}`);
console.log("Running npm install...\n");

try {
  execSync("npm install", { cwd: dest, stdio: "inherit" });
} catch {
  console.error(
    "\nnpm install failed — run it manually in the project directory.",
  );
}

// ---- 10. Next steps ---------------------------------------------------------

console.log(`
Progetto ${name} creato in ${dest}.

Prossimi passi:
  1. Genera la scala brand su https://www.radix-ui.com/colors/custom
  2. Inserisci i 12+12 hex in tokens/core/color.json come color.${name}
  3. Controlla gli slot in tokens/brand/${name}.json (già pre-configurati)
  4. npm run build per verificare
  5. Importa dist/ in Figma col plugin Token Manager
`);
