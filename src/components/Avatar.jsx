// Themed fighter portraits, rendered as inline SVG.
// Each member gets a unique gradient hex with a thematic glyph.

import { themeFor } from "../lib/avatars";

const SIZE_PRESETS = {
  sm: 36,
  md: 56,
  lg: 76,
};

function Glyph({ kind, accent }) {
  switch (kind) {
    case "flame":
      return (
        <path
          d="M50 20 C 35 38, 32 50, 38 60 C 32 56, 28 50, 30 42 C 22 50, 18 60, 22 70 C 26 80, 38 84, 50 84 C 62 84, 76 80, 78 68 C 80 58, 72 50, 64 48 C 70 42, 68 32, 50 20 Z"
          fill={accent}
          opacity="0.95"
        />
      );
    case "bolt":
      return (
        <path
          d="M58 18 L 32 54 L 48 54 L 40 86 L 70 46 L 54 46 L 62 18 Z"
          fill={accent}
          opacity="0.95"
        />
      );
    case "crystal":
      return (
        <g fill={accent} opacity="0.95">
          <path d="M50 20 L 72 38 L 60 78 L 40 78 L 28 38 Z" />
          <path d="M50 20 L 50 78" stroke="rgba(0,0,0,0.25)" strokeWidth="2" />
          <path d="M28 38 L 72 38" stroke="rgba(0,0,0,0.25)" strokeWidth="2" />
        </g>
      );
    case "shield":
      return (
        <g fill={accent} opacity="0.95">
          <path d="M50 20 L 76 30 L 76 56 C 76 70, 64 80, 50 86 C 36 80, 24 70, 24 56 L 24 30 Z" />
          <path
            d="M50 36 L 50 70 M36 52 L 64 52"
            stroke="rgba(0,0,0,0.35)"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>
      );
    case "sun":
      return (
        <g fill={accent} opacity="0.95">
          <circle cx="50" cy="52" r="14" />
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i * Math.PI) / 4;
            const x1 = 50 + Math.cos(a) * 22;
            const y1 = 52 + Math.sin(a) * 22;
            const x2 = 50 + Math.cos(a) * 32;
            const y2 = 52 + Math.sin(a) * 32;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={accent}
                strokeWidth="4"
                strokeLinecap="round"
              />
            );
          })}
        </g>
      );
    case "eye":
      return (
        <g fill={accent} opacity="0.95">
          <path d="M22 52 C 32 32, 68 32, 78 52 C 68 72, 32 72, 22 52 Z" />
          <circle cx="50" cy="52" r="9" fill="rgba(0,0,0,0.7)" />
          <circle cx="53" cy="49" r="3" fill="white" />
        </g>
      );
    default:
      return null;
  }
}

export default function Avatar({
  name,
  size = "md",
  status = "idle",
  isLeader = false,
  className = "",
}) {
  const t = themeFor(name);
  const px = typeof size === "number" ? size : SIZE_PRESETS[size] ?? 56;
  const gradId = `avgrad-${t.id}-${size}`;
  const breathing = status === "working" ? "avatar-pulsing" : "avatar-breathing";

  return (
    <div
      className={`relative inline-flex shrink-0 ${className}`}
      style={{ width: px, height: px }}
    >
      {isLeader ? (
        <span
          aria-hidden="true"
          className="absolute -inset-1 rounded-[28%] avatar-leader-ring"
        />
      ) : null}
      <svg
        viewBox="0 0 100 100"
        className={`relative ${breathing} drop-shadow-[0_4px_14px_rgba(0,0,0,0.45)]`}
        style={{
          width: "100%",
          height: "100%",
          filter: status === "working" ? `drop-shadow(0 0 14px ${t.glow})` : undefined,
        }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={t.from} />
            <stop offset="100%" stopColor={t.to} />
          </linearGradient>
          <radialGradient id={`${gradId}-shine`} cx="0.3" cy="0.25" r="0.7">
            <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
            <stop offset="60%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        <path
          d="M50 4 L 92 28 L 92 72 L 50 96 L 8 72 L 8 28 Z"
          fill={`url(#${gradId})`}
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="1.5"
        />
        <Glyph kind={t.glyph} accent={t.accent} />
        <path
          d="M50 4 L 92 28 L 92 72 L 50 96 L 8 72 L 8 28 Z"
          fill={`url(#${gradId}-shine)`}
          opacity="0.9"
        />
      </svg>

      {status === "done" ? (
        <>
          <span className="avatar-sparkle avatar-sparkle-a" />
          <span className="avatar-sparkle avatar-sparkle-b" />
          <span className="avatar-sparkle avatar-sparkle-c" />
        </>
      ) : null}
    </div>
  );
}
