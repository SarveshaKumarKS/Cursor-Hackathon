import { useMemo } from "react";

const COLORS = ["#22d3ee", "#e879f9", "#f4c430", "#34d399", "#a78bfa", "#fb7185"];

function buildPieces(seed, count) {
  const pieces = [];
  for (let i = 0; i < count; i++) {
    const r1 = Math.random();
    const r2 = Math.random();
    const r3 = Math.random();
    const r4 = Math.random();
    pieces.push({
      id: `${seed}-${i}`,
      left: r1 * 100,
      delay: r2 * 250,
      duration: 1500 + r3 * 1100,
      color: COLORS[i % COLORS.length],
      rotate: r4 * 360,
    });
  }
  return pieces;
}

function Burst({ trigger, count }) {
  const pieces = useMemo(() => buildPieces(trigger, count), [trigger, count]);
  return (
    <>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti"
          style={{
            left: `${p.left}vw`,
            background: p.color,
            animationDelay: `${p.delay}ms`,
            animationDuration: `${p.duration}ms`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </>
  );
}

export default function Confetti({ trigger, count = 90 }) {
  if (trigger == null) return null;
  return (
    <div className="confetti-host" aria-hidden="true">
      <Burst key={trigger} trigger={trigger} count={count} />
    </div>
  );
}
