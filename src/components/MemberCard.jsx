import { useEffect, useRef, useState } from "react";
import Avatar from "./Avatar";

const STATUS_BADGE = {
  idle: "bg-zinc-700/70 text-zinc-200 ring-1 ring-zinc-500/60 badge-idle",
  working: "bg-cyan-500/25 text-cyan-100 ring-1 ring-cyan-400/70 badge-working",
  done: "bg-emerald-500/25 text-emerald-100 ring-1 ring-emerald-400/70 badge-done",
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

export default function MemberCard({
  member,
  isCurrent,
  isLeader,
  isPreTribe,
  sparkIssuer,
  challenger,
  challengeSecondsLeft,
  sparkCooldownRemaining,
  cheerCooldownRemaining,
  showCtaHalo,
  flashingVouched,
  showVerifiedStamp,
  onStartWorking,
  onMarkDone,
  onSpark,
  onVouch,
  onCheer,
  onChallenge,
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

  const sparkDisabled = sparkCooldownRemaining > 0;
  const sparkTitle = sparkDisabled
    ? `Already Sparked. Try again in ${sparkCooldownRemaining}s`
    : "Send a Spark";

  const setRefs = (node) => {
    containerRef.current = node;
    if (typeof cardRef === "function") cardRef(node);
    else if (cardRef) cardRef.current = node;
  };

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
      } ${flashingVouched ? "card-vouched-flash" : ""}`}
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

      {sparkIssuer ? (
        <p className="mb-3 inline-block rounded-full bg-fuchsia-500/10 px-2.5 py-1 text-[11px] font-semibold text-fuchsia-200 ring-1 ring-fuchsia-400/40">
          Sparked by {sparkIssuer.name}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {isCurrent && member.status === "idle" ? (
          <button
            type="button"
            disabled={busy}
            onClick={onStartWorking}
            className={`rounded-lg bg-cyan-500 px-3.5 py-2 text-sm font-black uppercase tracking-wide text-cyan-950 shadow-[0_0_18px_rgba(34,211,238,0.45)] transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50 ${showCtaHalo ? "cta-halo" : ""}`}
          >
            Start Working
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
              disabled={busy || sparkDisabled}
              onClick={onSpark}
              title={sparkTitle}
              className={`rounded-lg px-3.5 py-2 text-sm font-black uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-50 ${
                sparkDisabled
                  ? "bg-zinc-700 text-zinc-300"
                  : "bg-fuchsia-500 text-fuchsia-950 shadow-[0_0_18px_rgba(232,121,249,0.55)] hover:bg-fuchsia-400"
              }`}
            >
              {sparkDisabled ? `Sparked (${sparkCooldownRemaining}s)` : "Spark ⚡"}
            </button>
            <button
              type="button"
              disabled={busy || !!challenger}
              onClick={onChallenge}
              title={
                challenger
                  ? "Already challenged"
                  : "Challenge: 90s to land Done. +25 XP each on success."
              }
              className="rounded-lg border border-orange-400/60 bg-orange-500/10 px-3.5 py-2 text-sm font-black uppercase tracking-wide text-orange-100 transition hover:bg-orange-500/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Challenge ⚔
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
              disabled={busy || cheerCooldownRemaining > 0}
              onClick={() => setShowCheers((v) => !v)}
              title={
                cheerCooldownRemaining > 0
                  ? `Wait ${cheerCooldownRemaining}s before cheering again`
                  : "Send a hype reaction"
              }
              className="btn-cheer rounded-full border border-zinc-600 bg-zinc-900/80 px-2.5 py-1.5 text-base transition hover:border-rose-400/60 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {cheerCooldownRemaining > 0 ? "⏳" : "🔥"}
            </button>
            {showCheers && cheerCooldownRemaining === 0 ? (
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

      {showVerifiedStamp ? <span className="verified-stamp">VERIFIED</span> : null}
    </article>
  );
}
