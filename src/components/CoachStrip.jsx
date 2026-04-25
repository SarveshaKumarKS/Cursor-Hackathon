const KIND_STYLES = {
  vouch_now: "border-emerald-500/60 bg-emerald-500/10 text-emerald-200",
  self_start: "border-amber-500/60 bg-amber-500/10 text-amber-200",
  challenge_now: "border-orange-500/60 bg-orange-500/10 text-orange-200",
  spark_now: "border-yellow-500/60 bg-yellow-500/10 text-yellow-100",
  spark_unlocks: "border-zinc-700/60 bg-zinc-800/40 text-zinc-300",
  cheer_working: "border-pink-500/50 bg-pink-500/10 text-pink-200",
  asleep: "border-zinc-700/60 bg-zinc-900/60 text-zinc-400",
  waiting: "border-zinc-700/60 bg-zinc-800/30 text-zinc-300",
};

const KIND_ICON = {
  vouch_now: "✅",
  self_start: "🚀",
  challenge_now: "⚔",
  spark_now: "⚡",
  spark_unlocks: "⏳",
  cheer_working: "🔥",
  asleep: "💤",
  waiting: "•",
};

export default function CoachStrip({ hints, onHintClick }) {
  if (!hints?.length) return null;
  return (
    <div className="coach-strip mt-3 mb-4">
      <div className="flex flex-wrap gap-2">
        {hints.map((h, idx) => {
          const clickable = !!h.targetId && !!onHintClick;
          const cls = KIND_STYLES[h.kind] ?? KIND_STYLES.waiting;
          return (
            <button
              key={`${h.kind}-${idx}`}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onHintClick(h)}
              className={`coach-pill flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${cls} ${
                clickable ? "hover:scale-[1.02] cursor-pointer" : "cursor-default"
              }`}
            >
              <span aria-hidden>{KIND_ICON[h.kind] ?? "•"}</span>
              <span>{h.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
