import { fmtRelativeWindow } from "../lib/time";

// Up-for-grabs rail. Shows tasks that have been passed (or never accepted)
// and are now sitting in the bounty pool. Each row gets a glowing chip
// showing the stacked bounty XP and a Claim button that's gated by
// eligibility (passers can't claim their own pass; off-duty members are
// blocked too).
export default function OrphanTaskRail({
  tasks,
  membersById,
  eligibilityByTask,
  onClaim,
  busy,
}) {
  if (!tasks || tasks.length === 0) return null;

  return (
    <section className="rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-zinc-900/60 to-zinc-900/80 p-5 backdrop-blur">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-amber-200">
          <span className="text-base">⚑</span>
          Up for grabs
        </h2>
        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">
          {tasks.length} open
        </span>
      </header>

      <ul className="space-y-2">
        {tasks.map((task) => {
          const eligibility = eligibilityByTask?.get?.(task.id) ?? {
            ok: false,
            reason: "Sign in to claim.",
          };
          const passers = (task.passed_by ?? [])
            .map((id) => membersById?.[id]?.name)
            .filter(Boolean);
          const startMs = task.scheduled_start_at
            ? Date.parse(task.scheduled_start_at)
            : null;
          const endMs = task.scheduled_end_at
            ? Date.parse(task.scheduled_end_at)
            : null;

          return (
            <li
              key={task.id}
              className="orphan-row group relative flex items-start justify-between gap-3 rounded-xl border border-amber-500/25 bg-black/40 px-3 py-2.5 transition hover:border-amber-400/60"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-zinc-100">
                    {task.title}
                  </span>
                  <span
                    className="bounty-chip"
                    title="Bounty stacked from each pass — paid as a one-shot bonus to the claimer who completes it."
                  >
                    +{task.bounty_xp ?? 0} XP
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-zinc-400">
                  {startMs && endMs ? (
                    <span>
                      Window:{" "}
                      <span className="text-zinc-200">
                        {fmtRelativeWindow(startMs)} – {fmtRelativeWindow(endMs)}
                      </span>
                    </span>
                  ) : null}
                  {passers.length > 0 && (
                    <span>
                      Passed by{" "}
                      <span className="text-zinc-300">{passers.join(", ")}</span>
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                disabled={busy || !eligibility.ok}
                onClick={() => onClaim(task)}
                title={eligibility.ok ? "Take this on for the bounty" : eligibility.reason}
                className="shrink-0 rounded-md bg-amber-400 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-zinc-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
              >
                Claim
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
