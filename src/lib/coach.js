// Action coach. Given current state, returns a ranked list of hints for
// the current user telling them what to do RIGHT NOW. Pure, no React.

import {
  canCheer,
  canChallenge,
  canSpark,
  canStart,
  isInAvailability,
  nextAvailabilityStart,
  windowState,
} from "./eligibility";
import { fmtCountdown, fmtRelativeWindow } from "./time";

const PRIORITY = {
  vouch_now: 100,
  self_start: 90,
  challenge_now: 80,
  spark_now: 70,
  spark_unlocks: 50,
  cheer_working: 40,
  asleep: 20,
  waiting: 10,
};

export function buildCoachHints({
  currentUserId,
  members,
  tasksByMember,
  availabilityByMember,
  cheerCooldowns,
  when,
  maxHints = 3,
}) {
  const me = members.find((m) => m.id === currentUserId);
  if (!me) return [];

  const myTask = tasksByMember.get(currentUserId) ?? null;
  const hints = [];

  // 1. Self-card prompts.
  if (myTask) {
    const ws = windowState(myTask, when);
    const startCheck = canStart(me, myTask, when);

    if (myTask.status === "done") {
      hints.push({
        kind: "waiting",
        text: `You're done — wait for a teammate to vouch.`,
        priority: PRIORITY.waiting,
      });
    } else if (myTask.status === "working") {
      hints.push({
        kind: "waiting",
        text: `Working on "${myTask.title}". Mark done when finished.`,
        priority: PRIORITY.waiting,
      });
    } else if (ws.kind === "grace" && startCheck.ok) {
      hints.push({
        kind: "self_start",
        text: `Self-start now — Spark unlocks for teammates in ${fmtCountdown(ws.msToGraceEnd)}.`,
        targetId: currentUserId,
        priority: PRIORITY.self_start,
      });
    } else if (ws.kind === "open" && startCheck.ok) {
      hints.push({
        kind: "self_start",
        text: `Window open. Start "${myTask.title}" for +XP.`,
        targetId: currentUserId,
        priority: PRIORITY.self_start,
      });
    } else if (ws.kind === "asleep") {
      hints.push({
        kind: "waiting",
        text: `Your task starts ${fmtRelativeWindow(myTask.scheduled_start_at ? Date.parse(myTask.scheduled_start_at) : null)}.`,
        priority: PRIORITY.waiting,
      });
    }
  }

  // 2. Teammate prompts.
  for (const target of members) {
    if (target.id === currentUserId) continue;
    const task = tasksByMember.get(target.id);
    const targetAvail = availabilityByMember.get(target.id) ?? [];
    const lastCheer = cheerCooldowns?.[target.id] ?? null;
    const cheerCheck = canCheer({
      actor: me,
      target,
      targetAvailability: targetAvail,
      lastCheerAt: lastCheer,
      when,
    });
    const sparkCheck = canSpark({
      actor: me,
      target,
      targetTask: task,
      targetAvailability: targetAvail,
      lastSparkAt: me.last_sparked_at,
      when,
    });
    const challengeCheck = canChallenge({
      actor: me,
      target,
      targetTask: task,
      targetAvailability: targetAvail,
      when,
    });

    if (target.status === "done") {
      hints.push({
        kind: "vouch_now",
        text: `${target.name} finished${task ? ` "${task.title}"` : ""} — vouch now!`,
        targetId: target.id,
        priority: PRIORITY.vouch_now,
      });
      continue;
    }

    if (challengeCheck.ok) {
      hints.push({
        kind: "challenge_now",
        text: `${target.name} is past 70% — challenge for +25 XP.`,
        targetId: target.id,
        priority: PRIORITY.challenge_now,
      });
      continue;
    }

    if (sparkCheck.ok) {
      hints.push({
        kind: "spark_now",
        text: `Spark ${target.name} — they're idle in their window.`,
        targetId: target.id,
        priority: PRIORITY.spark_now,
      });
      continue;
    }

    if (target.status === "working" && cheerCheck.ok) {
      hints.push({
        kind: "cheer_working",
        text: `${target.name} is working — send a cheer.`,
        targetId: target.id,
        priority: PRIORITY.cheer_working,
      });
      continue;
    }

    if (sparkCheck.reason?.startsWith("Self-start grace")) {
      hints.push({
        kind: "spark_unlocks",
        text: `Spark for ${target.name} unlocks in ${fmtCountdown((sparkCheck.unlocksAt ?? when) - when)}.`,
        priority: PRIORITY.spark_unlocks,
      });
      continue;
    }

    if (!isInAvailability(targetAvail, when)) {
      const next = nextAvailabilityStart(targetAvail, when);
      if (next) {
        hints.push({
          kind: "asleep",
          text: `${target.name} is off until ${fmtRelativeWindow(next)}.`,
          priority: PRIORITY.asleep,
        });
      }
    }
  }

  return hints
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxHints);
}
