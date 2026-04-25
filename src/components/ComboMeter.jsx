// Top-of-screen combo meter. Fills as vouches stack within 60s. When 3+ land
// in the window, the tribe gets a 30-second 2x XP multiplier.

export default function ComboMeter({
  comboCount = 0,
  multiplierActive,
  multiplierRemainingMs,
  comboWindowRemainingMs,
}) {
  const segments = [0, 1, 2];
  const filled = Math.min(comboCount, 3);

  return (
    <div
      className={`mb-5 overflow-hidden rounded-2xl border px-4 py-3 backdrop-blur transition ${
        multiplierActive
          ? "border-fuchsia-400/70 bg-gradient-to-r from-fuchsia-500/20 via-purple-500/15 to-cyan-500/20 shadow-[0_0_30px_rgba(232,121,249,0.45)] combo-active"
          : "border-zinc-700/60 bg-black/30"
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-black uppercase tracking-[0.25em] ${
              multiplierActive ? "text-fuchsia-100" : "text-zinc-300"
            }`}
          >
            Tribe Combo
          </span>
          {multiplierActive ? (
            <span className="rounded-full bg-fuchsia-500/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-fuchsia-50 ring-1 ring-fuchsia-300/70 animate-pulse">
              x2 ACTIVE · {Math.ceil(multiplierRemainingMs / 1000)}s
            </span>
          ) : null}
        </div>

        <div className="flex flex-1 items-center gap-1.5">
          {segments.map((i) => (
            <div
              key={i}
              className={`h-2 flex-1 rounded-full transition-all duration-500 ${
                i < filled
                  ? multiplierActive
                    ? "bg-gradient-to-r from-fuchsia-300 via-cyan-200 to-fuchsia-300 shadow-[0_0_8px_rgba(232,121,249,0.7)]"
                    : "bg-gradient-to-r from-cyan-400 to-cyan-600"
                  : "bg-zinc-800"
              }`}
            />
          ))}
        </div>

        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          {multiplierActive
            ? "All vouches double until timer runs out"
            : comboCount === 0
              ? "Land 3 vouches in 60s for x2 XP"
              : `${comboCount}/3 · resets in ${Math.max(0, Math.ceil(comboWindowRemainingMs / 1000))}s`}
        </span>
      </div>
    </div>
  );
}
