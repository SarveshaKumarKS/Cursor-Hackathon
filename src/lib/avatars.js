// Themed fighter portraits for each demo member. Hand-tuned palettes;
// fall back to a deterministic theme by name hash for any other names.

export const THEMES = {
  phoenix: {
    id: "phoenix",
    name: "Phoenix",
    from: "#fb923c",
    to: "#f43f5e",
    accent: "#fde68a",
    glow: "rgba(251, 146, 60, 0.55)",
    glyph: "flame",
  },
  storm: {
    id: "storm",
    name: "Storm",
    from: "#22d3ee",
    to: "#4f46e5",
    accent: "#a5f3fc",
    glow: "rgba(34, 211, 238, 0.55)",
    glyph: "bolt",
  },
  frost: {
    id: "frost",
    name: "Frost",
    from: "#a78bfa",
    to: "#e879f9",
    accent: "#f5d0fe",
    glow: "rgba(232, 121, 249, 0.55)",
    glyph: "crystal",
  },
  forge: {
    id: "forge",
    name: "Forge",
    from: "#34d399",
    to: "#0d9488",
    accent: "#a7f3d0",
    glow: "rgba(52, 211, 153, 0.55)",
    glyph: "shield",
  },
  sun: {
    id: "sun",
    name: "Sun",
    from: "#fbbf24",
    to: "#f97316",
    accent: "#fef3c7",
    glow: "rgba(251, 191, 36, 0.55)",
    glyph: "sun",
  },
  shadow: {
    id: "shadow",
    name: "Shadow",
    from: "#818cf8",
    to: "#1e1b4b",
    accent: "#c7d2fe",
    glow: "rgba(129, 140, 248, 0.55)",
    glyph: "eye",
  },
};

const NAMED = {
  Ari: "phoenix",
  Blaze: "storm",
  Cyra: "frost",
  Dax: "forge",
};

const ORDER = ["phoenix", "storm", "frost", "forge", "sun", "shadow"];

export function themeFor(name) {
  if (NAMED[name]) return THEMES[NAMED[name]];
  let h = 0;
  for (let i = 0; i < (name || "").length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return THEMES[ORDER[h % ORDER.length]];
}
