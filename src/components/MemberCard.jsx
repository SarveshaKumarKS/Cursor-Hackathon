import { useEffect, useRef, useState } from "react";
import Avatar from "./Avatar";
import TaskAcceptance from "./TaskAcceptance";
import { fmtCountdown, fmtRelativeWindow } from "../lib/time";

const STATUS_BADGE = {
  idle: "bg-zinc-700/70 text-zinc-200 ring-1 ring-zinc-500/60 badge-idle",
  working: "bg-cyan-500/25 text-cyan-100 ring-1 ring-cyan-400/70 badge-working",
  done: "bg-emerald-500/25 text-emerald-100 ring-1 ring-emerald-400/70 badge-done",
};

const WINDOW_BADGE = {
  asleep: "bg-zinc-800/70 text-zinc-400 ring-1 ring-zinc-700",
  grace: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/60",
  open: "bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/60",
  late: "bg-orange-500/20 text-orange-100 ring-1 ring-orange-400/70",
  working: "bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/60",
  done: "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/60",
  verified: "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/60",
  expired: "bg-red-500/15 text-red-200 ring-1 ring-red-400/60",
  declined: "bg-zinc-800/60 text-zinc-500 ring-1 ring-zinc-700",
};

const HOLD_MS = 600;
const CHEER_OPTIONS = ["🔥", "⚡", "💪", "🚀", "👏"];

function VouchHoldRing({ progress }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - progress);
  return (
    <span className="hold-ring">
      <svg viewBox="0 0 50 50">
        <circle
          cx="25"
          cy="25"
          r={r}
          stroke="rgba(244,196,48,0.18)"
          strokeWidth="3"
          fill="none"
        />
        <circle
          cx="25"
          cy="25"
          r={r}
          stroke="rgba(244,196,48,0.95)"
          strokeWidth="3"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            filter: "drop-shadow(0 0 6px rgba(244,196,48,0.7))",
            transition: "stroke-dashoffset 30ms linear",
          }}
        />
      </svg>
    </span>
  );
}

function ChallengeBanner({ challengerName, secondsLeft }) {
  return (
    <div className="challenge-banner mb-3 flex items-center justify-between rounded-lg border border-orange-400/60 px-2.5 py-1.5 text-[11px] uppercase tracking-wider text-orange-100 ring-1 ring-orange-400/40">
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true">⚔</span>
        Challenged by{" "}
        <strong className="text-orange-200">{challengerName}</strong>
      </span>
      <span className="font-mono font-black text-orange-50">
        {secondsLeft}s
      </span>
    </div>
  );
}

function WindowBadge({ kind, msToOpen, msToGraceEnd, msToWindowEnd, nextStartMs }) {
  if (!kind) return null;
  let label = kind;
  if (kind === "asleep" && msToOpen != null) {
    label = `Opens in ${fmtCountdown(msToOpen)}`;
  } else if (kind === "asleep" && nextStartMs) {
    label = `Off · ${fmtRelativeWindow(nextStartMs)}`;
  } else if (kind === "grace" && msToGraceEnd != null) {
    label = `Grace · ${fmtCountdown(msToGraceEnd)}`;
  } else if (kind === "open" && msToWindowEnd != null) {
    label = `Open · ${fmtCountdown(msToWindowEnd)} left`;
  } else if (kind === "late" && msToWindowEnd != null) {
    label = `Late · ${fmtCountdown(msToWindowEnd)} left`;
  } else if (kind === "expired") {
    label = "Window closed";
  } else if (kind === "working") {
    label = "Working";
  } else if (kind === "done") {
    label = "Done — needs vouch";
  } else if (kind === "verified") {
    label = "Verified";
  } else if (kind === "declined") {
    label = "Passed";
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${WINDOW_BADGE[kind] ?? WINDOW_BADGE.asleep}`}
    >
      {label}
    </span>
  );
}

function lockedLabel(prefix, eligibility) {
  if (eligibility?.ok) return null;
  if (eligibility?.unlocksInMs != null && eligibility.unlocksInMs > 0) {
    return `${prefix} ${fmtCountdown(eligibility.unlocksInMs)}`;
  }
  return prefix;
}

export default function MemberCard({
  member,
  task,
  windowInfo,
  isCurrent,
  isLeader,
  isPreTribe,
  sparkIssuer,
  challenger,
  challengeSecondsLeft,
  sparkEligibility,
  challengeEligibility,
  cheerEligibility,
  startEligibility,
  showCtaHalo,
  flashingVouched,
  showVerifiedStamp,
  onStartWorking,
  onMarkDone,
  onSpark,
  onVouch,
  onCheer,
  onChallenge,
  onAcceptTask,
  onPassTask,
  onDeclineTask,
  onDemoMarkDone,
  cardRef,
  busy,
  enterIndex = 0,
}) {
  const [holdProgress, setHoldProgress] = useState(0);
  const [showCheers, setShowCheers] = useState(false);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, gx: 50, gy: 50 });
  const holdState = useRef({ rafId: null, startedAt: 0, fired: false });
  const containerRef = useRef(null);

  useEffect(() => {
    const ref = holdState;
    return () => {
      if (ref.current.rafId) cancelAnimationFrame(ref.current.rafId);
    };
  }, []);

  function startHold() {
    if (busy) return;
    holdState.current.startedAt = performance.now();
    holdState.current.fired = false;
    const tick = () => {
      const t = performance.now() - holdState.current.startedAt;
      const p = Math.min(1, t / HOLD_MS);
      setHoldProgress(p);
      if (p >= 1 && !holdState.current.fired) {
        holdState.current.fired = true;
        onVouch?.();
        cancelHold();
        return;
      }
      holdState.current.rafId = requestAnimationFrame(tick);
    };
    holdState.current.rafId = requestAnimationFrame(tick);
  }

  function cancelHold() {
    if (holdState.current.rafId) {
      cancelAnimationFrame(holdState.current.rafId);
      holdState.current.rafId = null;
    }
    setHoldProgress(0);
  }

  function handleMouseMove(e) {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setTilt({
      rx: (0.5 - y) * 6,
      ry: (x - 0.5) * 8,
      gx: x * 100,
      gy: y * 100,
    });
  }

  function handleMouseLeave() {
    setTilt({ rx: 0, ry: 0, gx: 50, gy: 50 });
    setShowCheers(false);
  }

  const setRefs = (node) => {
    containerRef.current = node;
    if (typeof cardRef === "function") cardRef(node);
    else if (cardRef) cardRef.current = node;
  };

  const isAsleep = windowInfo?.kind === "asleep";
  const isGrace = windowInfo?.kind === "grace";
  const isLate = windowInfo?.kind === "late";

  const sparkLabel = sparkEligibility?.ok
    ? "Spark ⚡"
    : (lockedLabel("Spark", sparkEligibility) ?? "Spark locked");
  const challengeLabel = challengeEligibility?.ok
    ? "Challenge ⚔"
    : (lockedLabel("Challenge", challengeEligibility) ?? "Challenge locked");
  const cheerLabel = cheerEligibility?.ok ? "🔥" : "⏳";

  // Show TaskAcceptance only for the assignee of a proposed task.
  const showAcceptance =
    isCurrent && task?.status === "proposed" && onAcceptTask && onDeclineTask;

  return (
    <article
      ref={setRefs}
      data-member-id={member.id}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        "--rx": `${tilt.rx}deg`,
        "--ry": `${tilt.ry}deg`,
        "--gx": `${tilt.gx}%`,
        "--gy": `${tilt.gy}%`,
        animationDelay: `${enterIndex * 70}ms`,
      }}
      className={`tilt-card card-enter relative rounded-xl border p-4 ${
        isLeader
          ? "border-amber-300/80 bg-gradient-to-br from-amber-950/30 to-zinc-900/60 leader-ring"
          : isCurrent
            ? "border-cyan-400/60 bg-cyan-950/20 current-user-ring"
            : "border-zinc-700/70 bg-zinc-900/55"
      } ${flashingVouched ? "card-vouched-flash" : ""} ${isAsleep ? "card-asleep" : ""} ${isGrace ? "card-grace" : ""} ${isLate ? "card-late" : ""}`}
    >
      <span className="tilt-card-glare" />

      {challenger && challengeSecondsLeft > 0 ? (
        <ChallengeBanner
          challengerName={challenger.name}
          secondsLeft={challengeSecondsLeft}
        />
      ) : null}

      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar
            name={member.name}
            size="md"
            status={member.status}
            isLeader={isLeader && !isPreTribe}
          />
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-zinc-50">
              {member.name}
              {isCurrent ? (
                <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-200 ring-1 ring-cyan-400/60">
                  You
                </span>
              ) : null}
              {isLeader && !isPreTribe ? (
                <span
                  aria-label="Tribe Leader"
                  className="text-amber-300 drop-shadow-[0_0_10px_rgba(244,196,48,0.7)]"
                >
                  👑
                </span>
              ) : null}
            </h3>
            <p className="text-sm font-bold tracking-wide text-cyan-300">
              {member.xp} XP
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {member.first_mover ? (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-200 ring-1 ring-emerald-400/50">
                  First Mover
                </span>
              ) : null}
              {member.spark_streak >= 2 ? (
                <span className="rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-fuchsia-200 ring-1 ring-fuchsia-400/60">
                  Spark x{member.spark_streak}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <span
          className={`relative inline-block overflow-hidden rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${STATUS_BADGE[member.status] ?? STATUS_BADGE.idle}`}
        >
          {member.status}
        </span>
      </div>

      {/* Task panel — title + window state */}
      {task && task.status !== "proposed" ? (
        <div className="mb-3 rounded-lg border border-zinc-700/60 bg-zinc-800/30 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-zinc-100 truncate">
              {task.title}
            </div>
            <WindowBadge
              kind={windowInfo?.kind}
              msToOpen={windowInfo?.msToOpen}
              msToGraceEnd={windowInfo?.msToGraceEnd}
              msToWindowEnd={windowInfo?.msToWindowEnd}
              nextStartMs={windowInfo?.nextStartMs}
            />
          </div>
          {task.deadline_at ? (
            <div className="mt-0.5 text-[11px] text-zinc-400">
              Deadline {fmtRelativeWindow(Date.parse(task.deadline_at))}
            </div>
          ) : null}
        </div>
      ) : null}

      {showAcceptance ? (
        <div className="mb-3">
          <TaskAcceptance
            task={task}
            busy={busy}
            onAccept={onAcceptTask}
            onPass={onPassTask}
            onDecline={onDeclineTask}
          />
        </div>
      ) : null}

      {/* Pass-it shortcut for assignees who already accepted/are working
          but realize they can't finish — drops the task into the orphan
          pool with a +10 bounty stack. */}
      {isCurrent &&
      task &&
      onPassTask &&
      ["accepted", "working", "idle"].includes(task.status) ? (
        <button
          type="button"
          disabled={busy}
          onClick={onPassTask}
          title="Drop this with a +10 bounty so anyone free can pick it up."
          className="mb-3 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-amber-300/80 transition hover:text-amber-200 disabled:opacity-50"
        >
          <span aria-hidden>↻</span> Pass it
        </button>
      ) : null}

      {sparkIssuer ? (
        <p className="mb-3 inline-block rounded-full bg-fuchsia-500/10 px-2.5 py-1 text-[11px] font-semibold text-fuchsia-200 ring-1 ring-fuchsia-400/40">
          Sparked by {sparkIssuer.name}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {isCurrent && member.status === "idle" && task && task.status !== "proposed" ? (
          <button
            type="button"
            disabled={busy || !startEligibility?.ok}
            onClick={onStartWorking}
            title={startEligibility?.ok ? "Start your task" : startEligibility?.reason}
            className={`rounded-lg bg-cyan-500 px-3.5 py-2 text-sm font-black uppercase tracking-wide text-cyan-950 shadow-[0_0_18px_rgba(34,211,238,0.45)] transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50 ${showCtaHalo ? "cta-halo" : ""}`}
          >
            {startEligibility?.ok ? "Start Working" : "Window not open"}
          </button>
        ) : null}

        {isCurrent && member.status === "working" ? (
          <button
            type="button"
            disabled={busy}
            onClick={onMarkDone}
            className="rounded-lg bg-emerald-500 px-3.5 py-2 text-sm font-black uppercase tracking-wide text-emerald-950 shadow-[0_0_18px_rgba(52,211,153,0.45)] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Mark Done
          </button>
        ) : null}

        {!isCurrent && member.status === "idle" ? (
          <>
            <button
              type="button"
              disabled={busy || !sparkEligibility?.ok}
              onClick={onSpark}
              title={sparkEligibility?.reason ?? "Send a Spark"}
              className={`rounded-lg px-3.5 py-2 text-sm font-black uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-60 ${
                sparkEligibility?.ok
                  ? "bg-fuchsia-500 text-fuchsia-950 shadow-[0_0_18px_rgba(232,121,249,0.55)] hover:bg-fuchsia-400"
                  : "bg-zinc-700 text-zinc-300"
              }`}
            >
              {!sparkEligibility?.ok && <span aria-hidden>🔒 </span>}
              {sparkLabel}
            </button>
            <button
              type="button"
              disabled={busy || !!challenger || !challengeEligibility?.ok}
              onClick={onChallenge}
              title={
                challenger
                  ? "Already challenged"
                  : (challengeEligibility?.reason ??
                    "Challenge: 90s to land Done. +25 XP each on success.")
              }
              className={`rounded-lg border px-3.5 py-2 text-sm font-black uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-50 ${
                challengeEligibility?.ok
                  ? "border-orange-400/60 bg-orange-500/10 text-orange-100 hover:bg-orange-500/25"
                  : "border-zinc-700 bg-zinc-800/40 text-zinc-400"
              }`}
            >
              {!challengeEligibility?.ok && <span aria-hidden>🔒 </span>}
              {challengeLabel}
            </button>
          </>
        ) : null}

        {!isCurrent && member.status === "done" ? (
          <span className="relative inline-block">
            <button
              type="button"
              disabled={busy}
              onPointerDown={startHold}
              onPointerUp={cancelHold}
              onPointerLeave={cancelHold}
              onPointerCancel={cancelHold}
              className="rounded-lg bg-amber-400 px-3.5 py-2 text-sm font-black uppercase tracking-wide text-amber-950 shadow-[0_0_18px_rgba(244,196,48,0.55)] transition hover:bg-amber-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ position: "relative" }}
            >
              Vouch (hold)
              {holdProgress > 0 ? <VouchHoldRing progress={holdProgress} /> : null}
            </button>
          </span>
        ) : null}

        {!isCurrent ? (
          <div className="relative ml-auto">
            <button
              type="button"
              disabled={busy || !cheerEligibility?.ok}
              onClick={() => setShowCheers((v) => !v)}
              title={cheerEligibility?.reason ?? "Send a hype reaction"}
              className="btn-cheer rounded-full border border-zinc-600 bg-zinc-900/80 px-2.5 py-1.5 text-base transition hover:border-rose-400/60 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {cheerLabel}
            </button>
            {showCheers && cheerEligibility?.ok ? (
              <div className="absolute right-0 top-full z-30 mt-2 flex gap-1 rounded-xl border border-zinc-700 bg-zinc-950/95 p-1.5 shadow-2xl ring-1 ring-zinc-800 backdrop-blur">
                {CHEER_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setShowCheers(false);
                      onCheer?.(emoji);
                    }}
                    className="btn-cheer rounded-md px-2 py-1 text-xl transition hover:bg-zinc-800"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {onDemoMarkDone &&
      member.status !== "done" &&
      member.status !== "verified" ? (
        <button
          type="button"
          disabled={busy}
          onClick={onDemoMarkDone}
          title="Demo shortcut: instantly mark this member done so anyone can vouch."
          className="mt-3 w-full rounded-md border border-dashed border-zinc-600 bg-zinc-900/40 px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-zinc-400 transition hover:border-emerald-400/60 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Demo · Mark Done
        </button>
      ) : null}

      {showVerifiedStamp ? <span className="verified-stamp">VERIFIED</span> : null}
    </article>
  );
}
