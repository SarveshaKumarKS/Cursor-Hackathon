// Right-rail leaderboard. Pre-Tribe shows alphabetical members with no rank.
// Post-Crowning shows ranked rows, animated XP bars, and a single gold crown.

function rankRows(members, isPreTribe) {
  if (isPreTribe) {
    return [...members]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((m) => ({ ...m, rank: null }));
  }
  const sorted = [...members].sort(
    (a, b) =>
      b.xp - a.xp ||
      new Date(a.last_active_at).getTime() - new Date(b.last_active_at).getTime()
  );

  let lastXp = null;
  let lastRank = 0;
  return sorted.map((m, i) => {
    const rank = m.xp === lastXp ? lastRank : i + 1;
    lastXp = m.xp;
    lastRank = rank;
    return { ...m, rank };
  });
}

export default function Leaderboard({ members, isPreTribe }) {
  const rows = rankRows(members, isPreTribe);
  const maxXp = Math.max(1, ...rows.map((r) => r.xp));

  return (
    <aside className="rounded-2xl border border-zinc-700/70 bg-black/40 p-5 backdrop-blur">
      <h2 className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-zinc-300">
        Leaderboard
      </h2>

      {isPreTribe ? (
        <div className="mb-4 rounded-xl border border-dashed border-amber-400/40 bg-amber-500/5 p-4 text-center">
          <div className="mb-2 text-4xl opacity-50" aria-hidden="true">
            👑
          </div>
          <p className="text-sm font-bold text-amber-200">
            No Tribe Leader yet
          </p>
          <p className="mt-1 text-xs uppercase tracking-wider text-amber-300/80">
            Strike first.
          </p>
        </div>
      ) : null}

      <ol className="space-y-2">
        {rows.map((m) => {
          const widthPct = isPreTribe ? 0 : Math.round((m.xp / maxXp) * 100);
          const isLeader = !isPreTribe && m.rank === 1;
          return (
            <li
              key={m.id}
              className={`relative overflow-hidden rounded-lg border px-3 py-2 transition-[transform,background] ${
                isLeader
                  ? "border-amber-400/70 bg-amber-500/10 leader-ring"
                  : "border-zinc-700/70 bg-zinc-900/60"
              }`}
            >
              <div className="relative z-10 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-bold">
                  {isPreTribe ? (
                    <span className="w-8 text-zinc-500">—</span>
                  ) : (
                    <span
                      className={`inline-flex h-6 w-8 items-center justify-center rounded-md text-xs font-black ${
                        isLeader
                          ? "bg-amber-400 text-amber-950"
                          : "bg-zinc-800 text-zinc-300"
                      }`}
                    >
                      #{m.rank}
                    </span>
                  )}
                  {isLeader ? (
                    <span
                      className="text-amber-300 drop-shadow-[0_0_8px_rgba(244,196,48,0.7)]"
                      aria-label="Tribe Leader"
                    >
                      👑
                    </span>
                  ) : null}
                  <span className="text-zinc-100">{m.name}</span>
                </span>
                <span className="font-mono text-sm font-bold text-cyan-300">
                  {m.xp} XP
                </span>
              </div>

              {!isPreTribe ? (
                <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-800">
                  <div
                    className={`h-full rounded-full transition-[width] duration-700 ${
                      isLeader
                        ? "bg-gradient-to-r from-amber-300 to-amber-500"
                        : "bg-gradient-to-r from-cyan-400 to-cyan-600"
                    }`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="mt-5 space-y-1 rounded-lg border border-zinc-700/60 bg-zinc-900/60 p-3 text-[11px] text-zinc-400">
        <p>
          <span className="font-bold text-cyan-300">+70</span> Self-Starter
        </p>
        <p>
          <span className="font-bold text-cyan-300">+40</span> Sparked Worker
        </p>
        <p>
          <span className="font-bold text-fuchsia-300">+30</span> Successful Spark
        </p>
        <p>
          <span className="font-bold text-amber-300">+15</span> Voucher
        </p>
        <p>
          <span className="font-bold text-yellow-200">+5</span> Crowd Vouch Bonus
        </p>
      </div>
    </aside>
  );
}
