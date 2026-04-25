// Floating emoji reactions over a target's card.
// Each reaction lives ~1.6s and drifts upward.

export default function CheerReactions({ reactions }) {
  if (!reactions.length) return null;
  return (
    <div className="cheer-host" aria-hidden="true">
      {reactions.map((r) => (
        <span
          key={r.id}
          className="cheer"
          style={{
            left: `${r.x}px`,
            top: `${r.y}px`,
            "--cheer-drift": `${r.drift}px`,
          }}
        >
          {r.emoji}
        </span>
      ))}
    </div>
  );
}
