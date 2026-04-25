// Live activity feed sourced from the tribe_events table.

const KIND_META = {
  spark: { icon: "⚡", color: "text-fuchsia-200", verb: "sparked" },
  vouch: { icon: "✓", color: "text-amber-200", verb: "vouched" },
  cheer: { icon: "🔥", color: "text-rose-200", verb: "cheered" },
  challenge: { icon: "⚔", color: "text-orange-200", verb: "challenged" },
  challenge_won: { icon: "🏆", color: "text-amber-200", verb: "won challenge with" },
  combo_activated: {
    icon: "⚡⚡",
    color: "text-cyan-200",
    verb: "combo activated by",
  },
  crowned: { icon: "👑", color: "text-yellow-200", verb: "was crowned" },
  handoff: { icon: "👑", color: "text-yellow-200", verb: "took the crown from" },
  first_mover: {
    icon: "🥇",
    color: "text-emerald-200",
    verb: "is the First Mover",
  },
};

function relativeTime(iso, now) {
  const t = new Date(iso).getTime();
  const s = Math.max(1, Math.round((now - t) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  return `${h}h`;
}

export default function BattleLog({ events, membersById, now }) {
  return (
    <aside className="rounded-2xl border border-zinc-700/70 bg-black/40 p-5 backdrop-blur">
      <h2 className="mb-3 flex items-center justify-between text-sm font-black uppercase tracking-[0.2em] text-zinc-300">
        Battle Log
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-zinc-400">
          live
        </span>
      </h2>
      {events.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-700 bg-zinc-900/40 p-3 text-center text-xs text-zinc-500">
          No moves yet. The arena is silent.
        </p>
      ) : (
        <ul className="space-y-1.5 max-h-[360px] overflow-auto pr-1">
          {events.map((e) => {
            const meta = KIND_META[e.kind] ?? {
              icon: "•",
              color: "text-zinc-300",
              verb: e.kind,
            };
            const actor = membersById[e.actor_id]?.name ?? "Someone";
            const target = membersById[e.target_id]?.name;
            const xp = e.payload?.xp;
            const multiplier = e.payload?.multiplier;

            return (
              <li
                key={e.id}
                className="group flex items-start gap-2 rounded-md bg-zinc-900/40 px-2.5 py-1.5 text-xs ring-1 ring-zinc-800 transition hover:bg-zinc-900/70"
              >
                <span className={`shrink-0 text-sm ${meta.color}`}>
                  {meta.icon}
                </span>
                <span className="flex-1 leading-snug text-zinc-200">
                  <strong className="font-bold">{actor}</strong>{" "}
                  <span className="text-zinc-400">{meta.verb}</span>
                  {target ? (
                    <>
                      {" "}
                      <strong className="font-bold">{target}</strong>
                    </>
                  ) : null}
                  {xp ? (
                    <span className="ml-1 rounded bg-cyan-500/15 px-1 py-0.5 text-[10px] font-bold text-cyan-200">
                      +{xp} XP
                    </span>
                  ) : null}
                  {multiplier ? (
                    <span className="ml-1 rounded bg-fuchsia-500/20 px-1 py-0.5 text-[10px] font-bold text-fuchsia-100">
                      x{multiplier}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-[10px] uppercase tracking-wider text-zinc-500">
                  {relativeTime(e.created_at, now)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
