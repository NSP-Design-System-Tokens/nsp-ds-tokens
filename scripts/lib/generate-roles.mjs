// Declarative brand role map + DTCG expander — Option A rename.
// Source of truth for brand-generated semantic color roles.
// Extracted from create-nsp-project/index.mjs:918-982.

const ct = (light, dark) => ({
  $type: "color",
  $value: light,
  $extensions: { "com.figma.modes": { light, dark } },
});

const ref = (slot, step) => `{palette.${slot}.${step}}`;

// ── Role map ────────────────────────────────────────────────────────────────
// name → { slot, step | light/dark [, gate] }
//   step:       same step both modes (symmetric).
//   light/dark: per-mode steps.
//   gate:       emit only when that palette is present.
//
// Dynamic roles (on-color refs, computed steps) are not in the map —
// they depend on contrast analysis at generation time.

export const ROLE_MAP = Object.freeze({
  surface: {
    primary: { slot: "primary", light: 9, dark: 9 },
    "primary-hover": { slot: "primary", light: 10, dark: 8 },
    "primary-active": { slot: "primary", light: 11, dark: 7 },
    "primary-light": { slot: "primary", light: 8, dark: 10 },
    "primary-xlight": { slot: "primary", light: 3, dark: 10 },
    "secondary-subtle": { slot: "secondary", step: 3, gate: "secondary" },
    "secondary-subtle-hover": { slot: "secondary", step: 4, gate: "secondary" },
    "secondary-subtle-active": {
      slot: "secondary",
      step: 5,
      gate: "secondary",
    },
    "tertiary-subtle": { slot: "tertiary", step: 3 },
    "tertiary-subtle-hover": { slot: "tertiary", step: 4 },
    "tertiary-subtle-active": { slot: "tertiary", step: 5 },
  },
  text: {
    title: { slot: "primary", step: 11 },
    primary: { slot: "primary", step: 11 },
  },
  icon: {
    primary: { slot: "primary", step: 11 },
    "primary-light": { slot: "primary", light: 8, dark: 11 },
  },
  emphasis: {
    default: {
      light: "{palette.accent.default}",
      dark: "{palette.accent.subtle}",
      gate: "accent",
    },
    subtle: {
      light: "{palette.accent.2}",
      dark: "{palette.accent.4}",
      gate: "accent",
    },
  },
});

/**
 * @param {Object} opts
 * @param {{ lightRef: string, darkRef: string }} opts.onPrimary
 * @param {{ lightRef: string, darkRef: string }|null} [opts.onPrimaryHover]
 * @param {{ lightRef: string, darkRef: string }|null} [opts.onPrimaryActive]
 * @param {{ lightRef: string, darkRef: string }} opts.onSecondary
 * @param {number} opts.textStep
 * @param {number} opts.iconStep
 * @param {number} opts.secondaryIconStep
 * @param {boolean} opts.hasSecondary
 * @param {boolean} opts.hasAccent
 * @returns {Object} DTCG token tree for brand semantic/color.json
 */
export function expandRoles({
  onPrimary,
  onPrimaryHover = null,
  onPrimaryActive = null,
  onSecondary,
  textStep,
  iconStep,
  secondaryIconStep,
  hasSecondary,
  hasAccent,
}) {
  const textHoverStep = Math.min(textStep + 1, 12);
  const iconHoverStep = Math.min(iconStep + 1, 12);

  const m = (group, name) => {
    const d = ROLE_MAP[group][name];
    if (d.slot)
      return ct(ref(d.slot, d.step ?? d.light), ref(d.slot, d.step ?? d.dark));
    return ct(d.light, d.dark);
  };

  const surface = {
    primary: m("surface", "primary"),
    "primary-hover": m("surface", "primary-hover"),
    "primary-active": m("surface", "primary-active"),
    "primary-light": m("surface", "primary-light"),
    "primary-xlight": m("surface", "primary-xlight"),
    ...(hasSecondary
      ? {
          "secondary-subtle": m("surface", "secondary-subtle"),
          "secondary-subtle-hover": m("surface", "secondary-subtle-hover"),
          "secondary-subtle-active": m("surface", "secondary-subtle-active"),
        }
      : {}),
    "tertiary-subtle": m("surface", "tertiary-subtle"),
    "tertiary-subtle-hover": m("surface", "tertiary-subtle-hover"),
    "tertiary-subtle-active": m("surface", "tertiary-subtle-active"),
  };

  const text = {
    title: m("text", "title"),
    primary: m("text", "primary"),
    "primary-hover": ct(ref("primary", textHoverStep), ref("primary", 12)),
    "on-primary": ct(onPrimary.lightRef, onPrimary.darkRef),
    ...(onPrimaryHover
      ? {
          "on-primary-hover": ct(
            onPrimaryHover.lightRef,
            onPrimaryHover.darkRef,
          ),
        }
      : {}),
    ...(onPrimaryActive
      ? {
          "on-primary-active": ct(
            onPrimaryActive.lightRef,
            onPrimaryActive.darkRef,
          ),
        }
      : {}),
    ...(hasSecondary
      ? {
          "on-secondary-subtle": ct(onSecondary.lightRef, onSecondary.darkRef),
        }
      : {}),
  };

  const stroke = {
    primary: ct(ref("primary", iconStep), ref("primary", 11)),
    hover: ct(ref("primary", iconHoverStep), ref("primary", 11)),
  };

  const icon = {
    primary: m("icon", "primary"),
    "primary-hover": ct(ref("primary", iconHoverStep), ref("primary", 12)),
    "primary-light": m("icon", "primary-light"),
    ...(hasSecondary
      ? {
          secondary: ct(
            ref("secondary", secondaryIconStep),
            ref("secondary", 12),
          ),
        }
      : {}),
    "on-primary": ct(onPrimary.lightRef, onPrimary.darkRef),
    ...(onPrimaryHover
      ? {
          "on-primary-hover": ct(
            onPrimaryHover.lightRef,
            onPrimaryHover.darkRef,
          ),
        }
      : {}),
    ...(onPrimaryActive
      ? {
          "on-primary-active": ct(
            onPrimaryActive.lightRef,
            onPrimaryActive.darkRef,
          ),
        }
      : {}),
    ...(hasSecondary
      ? {
          "on-secondary-subtle": ct(onSecondary.lightRef, onSecondary.darkRef),
        }
      : {}),
  };

  const tree = { surface, text, stroke, icon };

  if (hasAccent) {
    tree.emphasis = {
      default: m("emphasis", "default"),
      subtle: m("emphasis", "subtle"),
    };
  }

  return tree;
}
