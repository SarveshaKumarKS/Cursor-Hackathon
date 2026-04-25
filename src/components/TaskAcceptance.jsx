import { fmtRelativeWindow } from "../lib/time";

// Three-button verdict: Accept / Pass / Decline.
//
// Pass and Decline differ on purpose: Pass orphans the task with a
// stacking bounty so a teammate can step up; Decline kills the task for
// this run and forfeits the slot. The wording on the buttons is meant
// to make that contrast obvious without a tooltip dance.
export default function TaskAcceptance({
  task,
  onAccept,
  onPass,
  onDecline,
  busy,
}) {
  if (!task) return null;
  const startMs = task.scheduled_start_at
    ? Date.parse(task.scheduled_start_at)
    : null;
  const endMs = task.scheduled_end_at
    ? Date.parse(task.scheduled_end_at)
    : null;
  const deadlineMs = task.deadline_at ? Date.parse(task.deadline_at) : null;
  const bounty = task.bounty_xp ?? 0;

  return (
    <div className="rounded-lg border border-amber-500/50 bg-amber-500/5 px-3 py-2">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-amber-200">
        <span>New task proposed</span>
        {bounty > 0 && (
          <span className="bounty-chip" title="Stacked bounty from earlier passes.">
            +{bounty} XP
          </span>
        )}
      </div>
      <div className="mt-0.5 text-sm font-semibold text-zinc-100">
        {task.title}
      </div>
      <div className="mt-1 space-y-0.5 text-xs text-zinc-400">
        <div>
          Window: <span className="text-zinc-200">{fmtRelativeWindow(startMs)}</span>{" "}
          – {fmtRelativeWindow(endMs)}
        </div>
        {deadlineMs && (
          <div>
            Deadline:{" "}
            <span className="text-zinc-200">{fmtRelativeWindow(deadlineMs)}</span>
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={onAccept}
          disabled={busy}
          className="flex-1 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-zinc-900 transition hover:bg-emerald-400 disabled:opacity-50"
        >
          Accept
        </button>
        {onPass ? (
          <button
            type="button"
            onClick={onPass}
            disabled={busy}
            title="Drop this with a +10 bounty so anyone free can pick it up."
            className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:border-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
          >
            Pass
          </button>
        ) : null}
        <button
          type="button"
          onClick={onDecline}
          disabled={busy}
          title="Kill this task for this run — no bounty, slot is forfeit."
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-red-500/60 hover:text-red-300 disabled:opacity-50"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
