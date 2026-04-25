// Pure, framework-free eligibility engine.
//
// Single source of truth for "can the current user act on this teammate
// right now?" given the project schedule, recurring availability, and a
// few cooldowns. Intentionally NO React imports so it stays trivially
// unit-testable and reusable from server-style logic later.

export const GRACE_FRACTION = 0.2;
export const LATE_FRACTION = 0.7;
export const SPARK_COOLDOWN_MS = 60 * 1000;
export const CHEER_COOLDOWN_MS = 5 * 1000;

const MS_PER_MIN = 60 * 1000;
const MS_PER_DAY = 24 * 60 * MS_PER_MIN;

// ---------- Time helpers ----------

function toMs(input) {
  if (input == null) return null;
  if (typeof input === "number") return input;
  if (input instanceof Date) return input.getTime();
  const t = Date.parse(input);
  return Number.isNaN(t) ? null : t;
}

function startOfLocalDay(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function localWeekday(ms) {
  // 0 = Sunday .. 6 = Saturday — matches Postgres dow.
  return new Date(ms).getDay();
}

function localMinutes(ms) {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

// ---------- Availability ----------

// slots: array of { weekday: 0..6, start_minute: 0..1439, end_minute: 1..1440 }
// "when" is a ms epoch.
//
// We treat slots as recurring weekly intervals and check membership.
// (TZ handling is currently best-effort: we use the browser's local TZ.
// The DB stores tz alongside slots so a future enhancement can adjust.)
export function isInAvailability(slots, when) {
  if (!slots || slots.length === 0) {
    // No availability declared = always available. This keeps the demo
    // usable even before anyone configures their calendar.
    return true;
  }
  const w = localWeekday(when);
  const m = localMinutes(when);
  return slots.some(
    (s) => s.weekday === w && m >= s.start_minute && m < s.end_minute
  );
}

// Find the next future availability slot start (ms epoch) given recurring slots.
// Returns null if no slots configured.
export function nextAvailabilityStart(slots, fromMs) {
  if (!slots || slots.length === 0) return null;
  const baseDay = startOfLocalDay(fromMs);
  for (let dayOffset = 0; dayOffset < 8; dayOffset += 1) {
    const dayStart = baseDay + dayOffset * MS_PER_DAY;
    const wd = localWeekday(dayStart);
    const todays = slots
      .filter((s) => s.weekday === wd)
      .sort((a, b) => a.start_minute - b.start_minute);
    for (const slot of todays) {
      const candidate = dayStart + slot.start_minute * MS_PER_MIN;
      if (candidate > fromMs) return candidate;
    }
  }
  return null;
}

// ---------- Window state ----------

// Returns { kind, progress (0..1 inside the window), msToOpen, msToGraceEnd,
// msToWindowEnd } with kind one of:
//   asleep | grace | open | late | working | done | verified | declined | expired
export function windowState(task, when) {
  if (!task) return { kind: "asleep", progress: 0 };

  // Lifecycle states short-circuit the time math.
  if (task.status === "working") return { kind: "working", progress: 1 };
  if (task.status === "done") return { kind: "done", progress: 1 };
  if (task.status === "verified") return { kind: "verified", progress: 1 };
  if (task.status === "declined") return { kind: "declined", progress: 0 };
  if (task.status === "expired") return { kind: "expired", progress: 1 };

  const start = toMs(task.scheduled_start_at);
  const end = toMs(task.scheduled_end_at);
  if (start == null || end == null || end <= start) {
    return { kind: "asleep", progress: 0 };
  }

  if (when < start) {
    return {
      kind: "asleep",
      progress: 0,
      msToOpen: start - when,
      msToGraceEnd: start + (end - start) * GRACE_FRACTION - when,
      msToWindowEnd: end - when,
    };
  }
  if (when >= end) {
    return { kind: "expired", progress: 1, msToWindowEnd: 0 };
  }

  const length = end - start;
  const progress = (when - start) / length;
  const graceEnd = start + length * GRACE_FRACTION;
  const lateStart = start + length * LATE_FRACTION;

  if (when < graceEnd) {
    return {
      kind: "grace",
      progress,
      msToGraceEnd: graceEnd - when,
      msToWindowEnd: end - when,
    };
  }
  if (when < lateStart) {
    return {
      kind: "open",
      progress,
      msToWindowEnd: end - when,
      msToLate: lateStart - when,
    };
  }
  return {
    kind: "late",
    progress,
    msToWindowEnd: end - when,
  };
}

// ---------- Action eligibility ----------
//
// Each helper returns { ok, reason, unlocksAt? } so the UI can show a
// useful tooltip / countdown when the action is locked.

export function canStart(self, selfTask, when) {
  if (!self || !selfTask) {
    return { ok: false, reason: "No task assigned." };
  }
  if (selfTask.status === "working") {
    return { ok: false, reason: "You are already working." };
  }
  if (!["accepted", "idle"].includes(selfTask.status)) {
    return { ok: false, reason: "Task is not in a startable state." };
  }
  const ws = windowState(selfTask, when);
  if (ws.kind === "asleep") {
    return {
      ok: false,
      reason: "Window has not opened yet.",
      unlocksAt: when + (ws.msToOpen ?? 0),
    };
  }
  if (ws.kind === "expired") {
    return { ok: false, reason: "Window has closed." };
  }
  return { ok: true };
}

export function canSpark({
  actor,
  target,
  targetTask,
  targetAvailability,
  lastSparkAt,
  when,
}) {
  if (!actor || !target) return { ok: false, reason: "No target." };
  if (actor.id === target.id) {
    return { ok: false, reason: "Cannot spark yourself." };
  }
  if (target.status !== "idle") {
    return { ok: false, reason: `${target.name} is already ${target.status}.` };
  }

  const sparkLastMs = toMs(lastSparkAt);
  if (sparkLastMs != null) {
    const sinceSpark = when - sparkLastMs;
    if (sinceSpark < SPARK_COOLDOWN_MS) {
      return {
        ok: false,
        reason: "Spark cooldown.",
        unlocksAt: sparkLastMs + SPARK_COOLDOWN_MS,
      };
    }
  }

  if (!targetTask) {
    return {
      ok: false,
      reason: `${target.name} has no active task — nothing to spark.`,
    };
  }

  if (!isInAvailability(targetAvailability, when)) {
    const nextStart = nextAvailabilityStart(targetAvailability, when);
    return {
      ok: false,
      reason: `${target.name} is off-duty.`,
      unlocksAt: nextStart,
    };
  }

  const ws = windowState(targetTask, when);
  switch (ws.kind) {
    case "asleep":
      return {
        ok: false,
        reason: `${target.name}'s window opens later.`,
        unlocksAt: when + (ws.msToOpen ?? 0),
      };
    case "grace":
      return {
        ok: false,
        reason: `Self-start grace — let ${target.name} start on their own.`,
        unlocksAt: when + (ws.msToGraceEnd ?? 0),
      };
    case "open":
    case "late":
      return { ok: true };
    case "expired":
      return { ok: false, reason: `${target.name}'s window has closed.` };
    case "done":
    case "verified":
      return { ok: false, reason: `${target.name} already finished.` };
    default:
      return { ok: false, reason: `${target.name} is busy.` };
  }
}

export function canChallenge({
  actor,
  target,
  targetTask,
  targetAvailability,
  when,
}) {
  if (!actor || !target) return { ok: false, reason: "No target." };
  if (actor.id === target.id) {
    return { ok: false, reason: "Cannot challenge yourself." };
  }
  if (!targetTask) return { ok: false, reason: "No task to challenge." };

  if (!isInAvailability(targetAvailability, when)) {
    const nextStart = nextAvailabilityStart(targetAvailability, when);
    return {
      ok: false,
      reason: `${target.name} is off-duty.`,
      unlocksAt: nextStart,
    };
  }

  const ws = windowState(targetTask, when);
  if (ws.kind === "late" && ["idle", "working"].includes(target.status)) {
    return { ok: true };
  }
  if (ws.kind === "open") {
    return {
      ok: false,
      reason: "Challenge unlocks at 70% of the window.",
      unlocksAt:
        when + (ws.msToLate ?? Math.max(0, (ws.msToWindowEnd ?? 0) * 0.5)),
    };
  }
  if (ws.kind === "grace") {
    return {
      ok: false,
      reason: "Cannot challenge during the self-start grace.",
      unlocksAt: when + (ws.msToGraceEnd ?? 0),
    };
  }
  if (ws.kind === "asleep") {
    return {
      ok: false,
      reason: `${target.name}'s window has not opened.`,
      unlocksAt: when + (ws.msToOpen ?? 0),
    };
  }
  return { ok: false, reason: `${target.name} is not challengeable.` };
}

// Can `actor` claim a passed-and-orphaned task right now?
//
// Rules:
//   - Task must be unassigned and `proposed`.
//   - Actor must NOT be in the task's `passed_by` set (no take-backs).
//   - Actor's calendar must say they're available now (or no calendar
//     declared, which we treat as always-available for demo simplicity).
//   - Window state must NOT be `expired` — once the deadline is gone the
//     task is dead, not orphaned.
export function canClaim({ actor, task, actorAvailability, when }) {
  if (!actor) return { ok: false, reason: "Sign in first." };
  if (!task) return { ok: false, reason: "No task." };
  if (task.assignee_id) {
    return { ok: false, reason: "Already taken." };
  }
  if (task.status !== "proposed") {
    return { ok: false, reason: "Not claimable right now." };
  }
  const passedBy = Array.isArray(task.passed_by) ? task.passed_by : [];
  if (passedBy.includes(actor.id)) {
    return { ok: false, reason: "You already passed this one." };
  }
  if (!isInAvailability(actorAvailability, when)) {
    const nextStart = nextAvailabilityStart(actorAvailability, when);
    return {
      ok: false,
      reason: "You're off-duty.",
      unlocksAt: nextStart,
    };
  }
  const ws = windowState(task, when);
  if (ws.kind === "expired") {
    return { ok: false, reason: "Window has closed." };
  }
  return { ok: true };
}

export function canCheer({ actor, target, targetAvailability, lastCheerAt, when }) {
  if (!actor || !target) return { ok: false, reason: "No target." };
  if (actor.id === target.id) {
    return { ok: false, reason: "Cannot cheer yourself." };
  }
  const lastMs = toMs(lastCheerAt);
  if (lastMs != null && when - lastMs < CHEER_COOLDOWN_MS) {
    return {
      ok: false,
      reason: "Cheer cooldown.",
      unlocksAt: lastMs + CHEER_COOLDOWN_MS,
    };
  }
  if (!isInAvailability(targetAvailability, when)) {
    const nextStart = nextAvailabilityStart(targetAvailability, when);
    return {
      ok: false,
      reason: `${target.name} is off-duty.`,
      unlocksAt: nextStart,
    };
  }
  return { ok: true };
}
