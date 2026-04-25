import { fmtRelativeWindow } from "../lib/time";

export default function TaskAcceptance({
  task,
  onAccept,
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
  return (
    <div className="rounded-lg border border-amber-500/50 bg-amber-500/5 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-amber-200">
        New task proposed
      </div>
      <div className="mt-0.5 text-sm font-semibold text-zinc-100">
        {task.title}
      </div>
      <div className="mt-1 text-xs text-zinc-400 space-y-0.5">
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
          className="flex-1 rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-900 font-medium px-3 py-1.5 text-xs"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={onDecline}
          disabled={busy}
          className="rounded-md border border-zinc-700 hover:border-red-500/60 text-zinc-400 hover:text-red-300 px-3 py-1.5 text-xs"
        >
          Pass
        </button>
      </div>
    </div>
  );
}
