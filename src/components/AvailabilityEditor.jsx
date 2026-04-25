import { useEffect, useState } from "react";
import { WEEKDAY_LABELS, WEEKDAY_LONG, minuteToClockLabel } from "../lib/time";

function timeToMinute(t) {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minuteToTime(m) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export default function AvailabilityEditor({
  open,
  onClose,
  member,
  initialSlots,
  onSave,
}) {
  const [slots, setSlots] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    // Initialise the editable form state from the latest snapshot whenever
    // the modal is opened. Cascading is fine — only fires on open transition.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSlots(
      (initialSlots ?? []).map((s) => ({
        weekday: s.weekday,
        start: minuteToTime(s.start_minute),
        end: minuteToTime(s.end_minute),
      }))
    );
    setErr("");
  }, [open, initialSlots]);

  function addSlot(weekday) {
    setSlots((prev) => [
      ...prev,
      { weekday, start: "18:00", end: "21:00" },
    ]);
  }

  function removeSlot(idx) {
    setSlots((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateSlot(idx, patch) {
    setSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  async function handleSave() {
    for (const s of slots) {
      const sm = timeToMinute(s.start);
      const em = timeToMinute(s.end);
      if (em <= sm) {
        setErr(`End must be after start on ${WEEKDAY_LONG[s.weekday]}.`);
        return;
      }
    }
    setBusy(true);
    setErr("");
    try {
      const payload = slots.map((s) => ({
        weekday: s.weekday,
        start_minute: timeToMinute(s.start),
        end_minute: timeToMinute(s.end),
      }));
      await onSave(member.id, payload);
      onClose();
    } catch (e) {
      console.error(e);
      setErr(e?.message ?? "Failed to save availability.");
    } finally {
      setBusy(false);
    }
  }

  if (!open || !member) return null;

  const slotsByDay = WEEKDAY_LABELS.map((_, weekday) =>
    slots
      .map((s, idx) => ({ ...s, idx }))
      .filter((s) => s.weekday === weekday)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-700/60 bg-zinc-900/95 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-400">
              Availability
            </div>
            <div className="text-lg font-semibold mt-0.5">
              When is {member.name} available?
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">
              Spark and Challenge are locked outside these windows.
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

        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto space-y-3">
          {WEEKDAY_LABELS.map((label, weekday) => (
            <div
              key={weekday}
              className="rounded-xl border border-zinc-700/60 bg-zinc-800/40 p-3"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-zinc-200">
                  {WEEKDAY_LONG[weekday]}
                </div>
                <button
                  type="button"
                  onClick={() => addSlot(weekday)}
                  className="text-xs text-amber-300 hover:text-amber-200"
                >
                  + Add slot
                </button>
              </div>
              {slotsByDay[weekday].length === 0 && (
                <div className="text-xs text-zinc-500 mt-1">Off</div>
              )}
              <div className="mt-2 space-y-2">
                {slotsByDay[weekday].map((s) => (
                  <div key={s.idx} className="flex items-center gap-2 text-xs">
                    <input
                      type="time"
                      value={s.start}
                      className="rounded bg-zinc-900 border border-zinc-700 px-2 py-1"
                      onChange={(e) => updateSlot(s.idx, { start: e.target.value })}
                    />
                    <span className="text-zinc-500">–</span>
                    <input
                      type="time"
                      value={s.end}
                      className="rounded bg-zinc-900 border border-zinc-700 px-2 py-1"
                      onChange={(e) => updateSlot(s.idx, { end: e.target.value })}
                    />
                    <span className="text-zinc-500 ml-2 hidden sm:inline">
                      {minuteToClockLabel(timeToMinute(s.start))} ·{" "}
                      {minuteToClockLabel(timeToMinute(s.end))}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeSlot(s.idx)}
                      className="ml-auto text-zinc-500 hover:text-red-400"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {err && (
            <div className="text-sm text-red-300 bg-red-950/40 border border-red-900/40 rounded-lg px-3 py-2">
              {err}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-zinc-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-400 hover:text-zinc-100"
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-900 font-medium px-4 py-2 text-sm"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
