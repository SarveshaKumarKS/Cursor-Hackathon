import { PROJECT_KINDS } from "../lib/templates";

export default function ProjectBanner({
  project,
  tasks,
  onNewProject,
  onArchive,
}) {
  if (!project) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-700/70 bg-zinc-900/40 px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-400">
            No active project
          </div>
          <div className="text-sm text-zinc-300">
            Set up a project to break it into tasks and start playing.
          </div>
        </div>
        <button
          type="button"
          onClick={onNewProject}
          className="rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-900 font-medium px-4 py-2 text-sm"
        >
          New project
        </button>
      </div>
    );
  }

  const kindMeta =
    PROJECT_KINDS.find((k) => k.id === project.kind) ?? PROJECT_KINDS[0];
  const total = tasks.length;
  const verified = tasks.filter((t) => t.status === "verified").length;
  const pending = tasks.filter(
    (t) => t.status === "proposed" && t.assignee_id
  ).length;
  const orphanCount = tasks.filter(
    (t) => t.status === "proposed" && !t.assignee_id
  ).length;
  const accepted = tasks.filter((t) =>
    ["accepted", "idle", "working", "done"].includes(t.status)
  ).length;
  const widthPct = total === 0 ? 0 : Math.round((verified / total) * 100);
  const isPlanning = project.status === "planning";

  return (
    <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/60 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-hidden>
            {kindMeta.emoji}
          </span>
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-400">
              {isPlanning ? "Planning" : project.status}
            </div>
            <div className="text-sm font-semibold text-zinc-100">
              {project.name}
            </div>
            {project.goal && (
              <div className="text-xs text-zinc-400 mt-0.5 max-w-md">
                {project.goal}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-zinc-400">
            {verified}/{total} verified
            {isPlanning && pending > 0 ? ` · ${pending} awaiting accept` : ""}
            {!isPlanning && accepted > 0 ? ` · ${accepted} in flight` : ""}
            {orphanCount > 0 ? (
              <span className="ml-1 text-amber-300">
                · {orphanCount} up for grabs
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onNewProject}
            className="rounded-lg border border-zinc-700 hover:border-amber-500/60 text-xs px-3 py-1.5 text-zinc-300"
          >
            + New
          </button>
          <button
            type="button"
            onClick={onArchive}
            className="rounded-lg border border-zinc-700 hover:border-red-500/60 text-xs px-3 py-1.5 text-zinc-400 hover:text-red-300"
          >
            Archive
          </button>
        </div>
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all"
          style={{ width: `${widthPct}%` }}
        />
      </div>
    </div>
  );
}
