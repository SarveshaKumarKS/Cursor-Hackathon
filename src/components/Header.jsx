import { pulseLabel } from "../lib/pulse";

const PULSE_BADGE_CLASSES = {
  dormant: "bg-zinc-700/70 text-zinc-300 ring-1 ring-zinc-500/60",
  awakening: "bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-400/70",
  active:
    "bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400/70 shadow-[0_0_30px_rgba(34,211,238,0.45)]",
  frenzy:
    "bg-fuchsia-500/30 text-fuchsia-50 ring-1 ring-fuchsia-300/80 shadow-[0_0_30px_rgba(232,121,249,0.55)] animate-pulse",
};

export default function Header({
  pulse,
  members,
  currentUserId,
  onCurrentUserChange,
  soundOn,
  onToggleSound,
  onResetSession,
  onNewProject,
  onEditAvailability,
}) {
  return (
    <header className="mb-6 rounded-2xl border border-zinc-700/70 bg-black/40 p-5 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-fuchsia-300">
            Fair Play System
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-cyan-300 sm:text-4xl">
            Tribe Leader
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Real-time accountability through herd momentum.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider transition ${PULSE_BADGE_CLASSES[pulse] ?? PULSE_BADGE_CLASSES.dormant}`}
          >
            Pulse: {pulseLabel(pulse)}
          </span>

          <label className="flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-400">
            Current User
            <select
              value={currentUserId}
              onChange={(e) => onCurrentUserChange(e.target.value)}
              className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm font-semibold text-zinc-100 outline-none ring-cyan-500 focus:ring-2"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>

          {onNewProject ? (
            <button
              type="button"
              onClick={onNewProject}
              className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold uppercase tracking-wide text-amber-950 hover:bg-amber-400"
              title="Set up a new project"
            >
              + New project
            </button>
          ) : null}

          {onEditAvailability ? (
            <button
              type="button"
              onClick={onEditAvailability}
              className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-xs font-bold uppercase tracking-wide text-zinc-300 transition hover:border-cyan-400/60 hover:text-cyan-200"
              title="Edit your weekly availability"
            >
              Availability
            </button>
          ) : null}

          <button
            type="button"
            onClick={onToggleSound}
            className={`rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wide transition ${
              soundOn
                ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-100"
                : "border-zinc-600 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
            }`}
            title="Toggle sound"
          >
            Sound: {soundOn ? "On" : "Off"}
          </button>

          <button
            type="button"
            onClick={onResetSession}
            className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-xs font-bold uppercase tracking-wide text-zinc-400 transition hover:border-rose-400/60 hover:text-rose-200"
            title="Reset XP, badges, and ceremony state"
          >
            Reset
          </button>
        </div>
      </div>
    </header>
  );
}
