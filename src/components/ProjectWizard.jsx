import { useEffect, useMemo, useState } from "react";
import { PROJECT_KINDS, templateFor } from "../lib/templates";
import { fmtRelativeWindow, toLocalInputValue, fromLocalInputValue } from "../lib/time";

// Helper: a Date set to the next round half-hour from now.
function defaultStart() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + (30 - (d.getMinutes() % 30)), 0, 0);
  return d;
}

function defaultEnd(start, durationMin = 30) {
  return new Date(start.getTime() + durationMin * 60 * 1000);
}

function emptyTask(members, idx) {
  const start = defaultStart();
  const assignee = members[idx % Math.max(members.length, 1)];
  return {
    title: "",
    assignee_id: assignee?.id ?? "",
    scheduled_start: toLocalInputValue(start),
    scheduled_end: toLocalInputValue(defaultEnd(start)),
    deadline: toLocalInputValue(new Date(start.getTime() + 24 * 60 * 60 * 1000)),
  };
}

export default function ProjectWizard({
  open,
  onClose,
  members,
  currentUserId,
  onLaunch,
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("cleaning");
  const [goal, setGoal] = useState("");
  const [tasks, setTasks] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    const titles = templateFor("cleaning");
    // Reset the wizard form whenever the modal is reopened. Acceptable
    // cascading: only runs on the open-transition.
    /* eslint-disable react-hooks/set-state-in-effect */
    setStep(0);
    setName("");
    setKind("cleaning");
    setGoal("");
    setTasks(
      (titles.length ? titles : ["Task 1"]).map((title, i) => ({
        ...emptyTask(members, i),
        title,
      }))
    );
    setErr("");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, members]);

  const kindMeta = useMemo(
    () => PROJECT_KINDS.find((k) => k.id === kind) ?? PROJECT_KINDS[0],
    [kind]
  );

  function applyKind(nextKind) {
    setKind(nextKind);
    const titles = templateFor(nextKind);
    if (titles.length) {
      setTasks(
        titles.map((title, i) => ({
          ...emptyTask(members, i),
          title,
        }))
      );
    } else if (tasks.length === 0) {
      setTasks([emptyTask(members, 0)]);
    }
  }

  function updateTask(idx, patch) {
    setTasks((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  }

  function addTask() {
    setTasks((prev) => [...prev, emptyTask(members, prev.length)]);
  }

  function removeTask(idx) {
    setTasks((prev) => prev.filter((_, i) => i !== idx));
  }

  function validate() {
    if (!name.trim()) return "Project needs a name.";
    if (!tasks.length) return "Add at least one task.";
    for (const t of tasks) {
      if (!t.title.trim()) return "Every task needs a title.";
      if (!t.assignee_id) return `Pick an assignee for "${t.title}".`;
      if (!t.scheduled_start || !t.scheduled_end)
        return `Pick a work window for "${t.title}".`;
      const s = fromLocalInputValue(t.scheduled_start);
      const e = fromLocalInputValue(t.scheduled_end);
      if (!s || !e || e.getTime() <= s.getTime())
        return `End must be after start for "${t.title}".`;
    }
    return "";
  }

  async function handleLaunch() {
    const message = validate();
    if (message) {
      setErr(message);
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const payload = tasks.map((t) => ({
        title: t.title.trim(),
        assignee_id: t.assignee_id,
        scheduled_start_at: fromLocalInputValue(t.scheduled_start).toISOString(),
        scheduled_end_at: fromLocalInputValue(t.scheduled_end).toISOString(),
        deadline_at: t.deadline
          ? fromLocalInputValue(t.deadline).toISOString()
          : null,
      }));
      await onLaunch({
        name: name.trim(),
        kind,
        goal: goal.trim() || null,
        creator: currentUserId,
        tasks: payload,
      });
      onClose();
    } catch (e) {
      console.error(e);
      setErr(e?.message ?? "Failed to launch project.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-700/60 bg-zinc-900/95 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-400">
              New Project · Step {step + 1} of 4
            </div>
            <div className="text-lg font-semibold mt-0.5">
              {step === 0 && "Set the goal"}
              {step === 1 && "Pick the tasks"}
              {step === 2 && "Assign + schedule"}
              {step === 3 && "Review & launch"}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 text-sm"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
          {step === 0 && (
            <div className="space-y-4">
              <label className="block">
                <span className="text-xs uppercase tracking-wider text-zinc-400">
                  Project name
                </span>
                <input
                  className="mt-1 w-full rounded-lg bg-zinc-800/80 border border-zinc-700 px-3 py-2 outline-none focus:border-amber-500"
                  placeholder="Saturday apartment cleanup"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <div>
                <span className="text-xs uppercase tracking-wider text-zinc-400">
                  Kind
                </span>
                <div className="mt-1 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PROJECT_KINDS.map((k) => (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => applyKind(k.id)}
                      className={`rounded-lg border px-3 py-2 text-sm transition ${
                        kind === k.id
                          ? "border-amber-500 bg-amber-500/10 text-amber-200"
                          : "border-zinc-700 bg-zinc-800/40 hover:border-zinc-600"
                      }`}
                    >
                      <span className="mr-1">{k.emoji}</span>
                      {k.label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="text-xs uppercase tracking-wider text-zinc-400">
                  Shared goal (optional)
                </span>
                <textarea
                  rows={2}
                  className="mt-1 w-full rounded-lg bg-zinc-800/80 border border-zinc-700 px-3 py-2 outline-none focus:border-amber-500"
                  placeholder="What does done look like for this project?"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                />
              </label>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-zinc-400">
                {kindMeta.emoji} <span className="text-zinc-200">{kindMeta.label}</span> · edit, add, or remove tasks.
              </p>
              <div className="space-y-2">
                {tasks.map((t, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-6 text-zinc-500 text-sm">{idx + 1}.</span>
                    <input
                      className="flex-1 rounded-lg bg-zinc-800/80 border border-zinc-700 px-3 py-2 outline-none focus:border-amber-500"
                      value={t.title}
                      placeholder="Task title"
                      onChange={(e) => updateTask(idx, { title: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => removeTask(idx)}
                      className="text-zinc-500 hover:text-red-400 text-sm px-2"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addTask}
                  className="text-sm text-amber-300 hover:text-amber-200"
                >
                  + Add task
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              {tasks.map((t, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-zinc-700/70 bg-zinc-800/40 p-3"
                >
                  <div className="text-sm font-medium text-zinc-100">
                    {t.title || `Task ${idx + 1}`}
                  </div>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <label>
                      <span className="text-zinc-400">Assignee</span>
                      <select
                        className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-2 py-1.5"
                        value={t.assignee_id}
                        onChange={(e) =>
                          updateTask(idx, { assignee_id: e.target.value })
                        }
                      >
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="text-zinc-400">Deadline (optional)</span>
                      <input
                        type="datetime-local"
                        className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-2 py-1.5"
                        value={t.deadline}
                        onChange={(e) =>
                          updateTask(idx, { deadline: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span className="text-zinc-400">Window starts</span>
                      <input
                        type="datetime-local"
                        className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-2 py-1.5"
                        value={t.scheduled_start}
                        onChange={(e) =>
                          updateTask(idx, { scheduled_start: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span className="text-zinc-400">Window ends</span>
                      <input
                        type="datetime-local"
                        className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-2 py-1.5"
                        value={t.scheduled_end}
                        onChange={(e) =>
                          updateTask(idx, { scheduled_end: e.target.value })
                        }
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3 text-sm">
              <div className="rounded-xl border border-zinc-700/70 bg-zinc-800/40 p-3">
                <div className="text-zinc-400 text-xs uppercase tracking-wider">
                  Project
                </div>
                <div className="text-zinc-100 font-medium">
                  {kindMeta.emoji} {name || "Untitled"}
                </div>
                {goal && <div className="text-zinc-400 text-xs mt-1">{goal}</div>}
              </div>
              <div className="space-y-2">
                {tasks.map((t, idx) => {
                  const m = members.find((x) => x.id === t.assignee_id);
                  const startMs = t.scheduled_start
                    ? fromLocalInputValue(t.scheduled_start)?.getTime()
                    : null;
                  return (
                    <div
                      key={idx}
                      className="rounded-lg border border-zinc-700/60 bg-zinc-900/40 p-3 flex items-start justify-between"
                    >
                      <div>
                        <div className="text-zinc-100 font-medium">
                          {t.title || `Task ${idx + 1}`}
                        </div>
                        <div className="text-xs text-zinc-400 mt-0.5">
                          {m?.name ?? "Unassigned"} · {fmtRelativeWindow(startMs)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-zinc-500">
                After launch, each assignee will see an Accept prompt on their
                card. Once everyone accepts, the project goes live and Spark
                gating kicks in.
              </p>
            </div>
          )}

          {err && (
            <div className="mt-3 text-sm text-red-300 bg-red-950/40 border border-red-900/40 rounded-lg px-3 py-2">
              {err}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-zinc-800 flex items-center justify-between">
          <button
            type="button"
            onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}
            className="text-sm text-zinc-400 hover:text-zinc-100"
            disabled={busy}
          >
            {step === 0 ? "Cancel" : "Back"}
          </button>
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(3, s + 1))}
              className="rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-900 font-medium px-4 py-2 text-sm"
              disabled={busy}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLaunch}
              disabled={busy}
              className="rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-900 font-medium px-4 py-2 text-sm"
            >
              {busy ? "Launching…" : "Launch project"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
