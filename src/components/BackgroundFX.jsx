// Animated ember/dust particles drifting up across the arena background.
// Pure CSS animation; particle positions are deterministic per mount.

import { useMemo } from "react";

function buildEmbers(count, seed) {
  const out = [];
  let s = seed || 7;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = 0; i < count; i++) {
    out.push({
      id: i,
      left: rnd() * 100,
      size: 2 + rnd() * 3,
      duration: 9 + rnd() * 14,
      delay: rnd() * -22,
      drift: -25 + rnd() * 50,
      hue: rnd() < 0.5 ? "#22d3ee" : rnd() < 0.7 ? "#e879f9" : "#fbbf24",
    });
  }
  return out;
}

export default function BackgroundFX({ count = 36 }) {
  const embers = useMemo(() => buildEmbers(count, 1337), [count]);
  return (
    <div className="bg-fx" aria-hidden="true">
      <div className="bg-grid" />
      <div className="bg-vignette" />
      {embers.map((e) => (
        <span
          key={e.id}
          className="ember"
          style={{
            left: `${e.left}%`,
            width: `${e.size}px`,
            height: `${e.size}px`,
            background: e.hue,
            boxShadow: `0 0 ${e.size * 4}px ${e.hue}`,
            animationDuration: `${e.duration}s`,
            animationDelay: `${e.delay}s`,
            "--drift": `${e.drift}vw`,
          }}
        />
      ))}
    </div>
  );
}
