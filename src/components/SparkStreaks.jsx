// Lightning streaks rendered between member cards on Spark and on Crowning.
// Each streak is an SVG path that draws-on then fades.

export default function SparkStreaks({ streaks }) {
  if (!streaks.length) return null;
  return (
    <svg className="streak-host" aria-hidden="true">
      <defs>
        <linearGradient id="sparkGradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#e879f9" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
        <linearGradient id="goldGradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffd66e" />
          <stop offset="100%" stopColor="#f4c430" />
        </linearGradient>
      </defs>
      {streaks.map((s) => {
        const midX = (s.x1 + s.x2) / 2 + (s.curve ?? 0);
        const midY = (s.y1 + s.y2) / 2 - 60;
        const d = `M ${s.x1} ${s.y1} Q ${midX} ${midY} ${s.x2} ${s.y2}`;
        return (
          <path
            key={s.id}
            d={d}
            className="streak-line"
            style={
              s.gold
                ? {
                    stroke: "url(#goldGradient)",
                    filter:
                      "drop-shadow(0 0 10px rgba(244, 196, 48, 0.85))",
                  }
                : undefined
            }
          />
        );
      })}
    </svg>
  );
}
