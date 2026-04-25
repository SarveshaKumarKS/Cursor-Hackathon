import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./lib/supabase";
import { computePulse, pulseBackgroundClass, PULSE } from "./lib/pulse";
import { TOAST_LABELS, XP } from "./lib/xp";
import { sounds } from "./lib/sound";
import {
  canCheer,
  canChallenge,
  canSpark,
  canStart,
  isInAvailability,
  nextAvailabilityStart,
  windowState,
} from "./lib/eligibility";
import { buildCoachHints } from "./lib/coach";

import Header from "./components/Header";
import MemberCard from "./components/MemberCard";
import Leaderboard from "./components/Leaderboard";
import Toasts from "./components/Toasts";
import Confetti from "./components/Confetti";
import SparkStreaks from "./components/SparkStreaks";
import CrowningCeremony from "./components/CrowningCeremony";
import BackgroundFX from "./components/BackgroundFX";
import CheerReactions from "./components/CheerReactions";
import BattleLog from "./components/BattleLog";
import ComboMeter from "./components/ComboMeter";
import ProjectBanner from "./components/ProjectBanner";
import ProjectWizard from "./components/ProjectWizard";
import AvailabilityEditor from "./components/AvailabilityEditor";
import CoachStrip from "./components/CoachStrip";

const SPARK_COOLDOWN_MS = 60 * 1000;
const CROWD_VOUCH_WINDOW_MS = 30 * 1000;
const FRENZY_WINDOW_MS = 60 * 1000;
const TOAST_TTL_MS = 2500;
const VOUCHED_FLASH_MS = 1500;
const VERIFIED_STAMP_MS = 700;
const CEREMONY_MS = 3500;
const HANDOFF_MS = 1200;
const CHEER_COOLDOWN_MS = 5 * 1000;
const CHEER_TTL_MS = 1700;
const CHALLENGE_DURATION_MS = 90 * 1000;
const CHALLENGE_BONUS_XP = 25;
const COMBO_WINDOW_MS = 60 * 1000;
const COMBO_MULTIPLIER_MS = 30 * 1000;
const COMBO_THRESHOLD = 3;
const EVENTS_LIMIT = 50;
const BATTLE_LOG_LIMIT = 30;

function leaderIdFor(list) {
  if (!list.length) return null;
  const sorted = [...list].sort(
    (a, b) =>
      b.xp - a.xp ||
      new Date(a.last_active_at).getTime() -
        new Date(b.last_active_at).getTime()
  );
  if (sorted[0].xp <= 0) return null;
  return sorted[0].id;
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function rectCenter(node) {
  if (!node) return null;
  const r = node.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// Module-level wrappers keep the React purity lint quiet for time access
// inside async event handlers (these never run during render).
const nowMs = () => Date.now();
const isoNow = () => new Date().toISOString();
const isoIn = (ms) => new Date(nowMs() + ms).toISOString();

function isWithinWindow(ts, windowMs) {
  if (!ts) return false;
  return nowMs() - new Date(ts).getTime() < windowMs;
}

function futureRemaining(ts) {
  if (!ts) return 0;
  return Math.max(0, new Date(ts).getTime() - nowMs());
}

export default function App() {
  const [members, setMembers] = useState([]);
  const [meta, setMeta] = useState(null);
  const [events, setEvents] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("tribe-current-user-id") ?? "";
  });
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [loadError, setLoadError] = useState("");
  const [soundOn, setSoundOn] = useState(false);

  const [toasts, setToasts] = useState([]);
  const [streaks, setStreaks] = useState([]);
  const [cheerReactions, setCheerReactions] = useState([]);
  const [cheerCooldowns, setCheerCooldowns] = useState({});
  const [confettiTrigger, setConfettiTrigger] = useState(null);
  const [recentEvents, setRecentEvents] = useState([]);
  const [flashingVouchedId, setFlashingVouchedId] = useState(null);
  const [verifiedStampId, setVerifiedStampId] = useState(null);
  const [ceremonyName, setCeremonyName] = useState(null);

  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [projectWonName, setProjectWonName] = useState(null);

  const cardRefs = useRef(new Map());
  const setCardRef = useCallback(
    (id) => (node) => {
      if (node) cardRefs.current.set(id, node);
      else cardRefs.current.delete(id);
    },
    []
  );

  const previousLeaderRef = useRef(null);
  const previousMetaFirstVouchRef = useRef(null);
  const ceremonyFiredRef = useRef(false);
  const previousMembersRef = useRef([]);
  const currentUserIdRef = useRef(currentUserId);

  // -------- Toasts --------

  const pushToast = useCallback((kind, subtitle) => {
    const id = uid();
    const label = TOAST_LABELS[kind] ?? kind;
    setToasts((prev) => {
      const next = [...prev, { id, kind, label, subtitle }];
      return next.slice(-4);
    });
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_TTL_MS);
  }, []);

  // -------- Streaks helpers --------

  const fireStreak = useCallback((from, to, opts = {}) => {
    if (!from || !to) return;
    const id = uid();
    const curve = Math.random() * 80 - 40;
    setStreaks((prev) => [
      ...prev,
      { id, x1: from.x, y1: from.y, x2: to.x, y2: to.y, curve, ...opts },
    ]);
    setTimeout(() => {
      setStreaks((prev) => prev.filter((s) => s.id !== id));
    }, opts.ttl ?? 700);
  }, []);

  const triggerCrowningStreaks = useCallback(
    (leaderId) => {
      const leaderCenter = rectCenter(cardRefs.current.get(leaderId));
      if (!leaderCenter) return;
      for (const [id, node] of cardRefs.current.entries()) {
        if (id === leaderId) continue;
        fireStreak(rectCenter(node), leaderCenter, { gold: true, ttl: 1500 });
      }
    },
    [fireStreak]
  );

  // -------- Cheer overlay helpers --------

  const spawnCheerAtCard = useCallback((targetId, emoji) => {
    const node = cardRefs.current.get(targetId);
    if (!node) return;
    const r = node.getBoundingClientRect();
    const id = uid();
    const drift = -36 + Math.random() * 72;
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 4;
    setCheerReactions((prev) => [...prev, { id, emoji, x, y, drift }]);
    setTimeout(() => {
      setCheerReactions((prev) => prev.filter((c) => c.id !== id));
    }, CHEER_TTL_MS);
  }, []);

  // -------- Realtime payload handlers --------

  const handleMemberPayload = useCallback((payload) => {
    if (payload.eventType === "UPDATE" && payload.new && payload.old) {
      const before = payload.old;
      const after = payload.new;

      if (before.status !== after.status) {
        setRecentEvents((prev) => {
          const t = nowMs();
          const trimmed = prev.filter((e) => t - e.at < FRENZY_WINDOW_MS);
          return [...trimmed, { at: t, id: after.id }];
        });
      }

      if (before.status === "done" && after.status === "idle") {
        setFlashingVouchedId(after.id);
        setTimeout(() => setFlashingVouchedId(null), VOUCHED_FLASH_MS);
        setVerifiedStampId(after.id);
        setTimeout(() => setVerifiedStampId(null), VERIFIED_STAMP_MS);
      }
    }

    setMembers((prev) => {
      if (payload.eventType === "DELETE") {
        return prev.filter((m) => m.id !== payload.old.id);
      }
      const incoming = payload.new;
      const next = [...prev];
      const idx = next.findIndex((m) => m.id === incoming.id);
      if (idx >= 0) next[idx] = { ...next[idx], ...incoming };
      else next.push(incoming);
      return next;
    });
  }, []);

  const handleMetaPayload = useCallback((payload) => {
    if (payload.eventType === "DELETE") return;

    // Cross-tab reset detection: if every reset marker just became null,
    // a Reset just happened elsewhere — clear local UI state too.
    const after = payload.new;
    const before = payload.old;
    const isResetSnapshot =
      after &&
      after.first_vouch_at == null &&
      after.first_mover_id == null &&
      after.last_voucher_id == null &&
      after.last_vouch_at == null &&
      (after.combo_count ?? 0) === 0 &&
      after.combo_multiplier_until == null;
    const wasNonReset =
      before &&
      (before.first_vouch_at != null ||
        before.first_mover_id != null ||
        before.last_voucher_id != null ||
        before.last_vouch_at != null ||
        (before.combo_count ?? 0) !== 0 ||
        before.combo_multiplier_until != null);
    if (isResetSnapshot && wasNonReset) {
      ceremonyFiredRef.current = false;
      previousLeaderRef.current = null;
      previousMetaFirstVouchRef.current = null;
      previousMembersRef.current = [];
      setEvents([]);
      setRecentEvents([]);
      setFlashingVouchedId(null);
      setVerifiedStampId(null);
      setStreaks([]);
      setCheerReactions([]);
    }

    setMeta(after);
  }, []);

  const handleEventPayload = useCallback(
    (payload) => {
      if (payload.eventType !== "INSERT") return;
      const e = payload.new;
      setEvents((prev) => [e, ...prev].slice(0, EVENTS_LIMIT));

      // Skip echoing local actions back to the actor's own tab — those
      // already played their animation immediately on click.
      const isSelfActor = e.actor_id === currentUserIdRef.current;

      if (e.kind === "cheer" && e.target_id && e.payload?.emoji && !isSelfActor) {
        requestAnimationFrame(() => {
          spawnCheerAtCard(e.target_id, e.payload.emoji);
        });
      }

      if (e.kind === "spark" && e.actor_id && e.target_id && !isSelfActor) {
        requestAnimationFrame(() => {
          const from = rectCenter(cardRefs.current.get(e.actor_id));
          const to = rectCenter(cardRefs.current.get(e.target_id));
          fireStreak(from, to);
        });
      }
    },
    [spawnCheerAtCard, fireStreak]
  );

  // -------- Data fetching --------

  const fetchAll = useCallback(async () => {
    const [membersRes, metaRes, eventsRes, projectsRes, tasksRes, availRes] =
      await Promise.all([
        supabase.from("tribe_members").select("*"),
        supabase.from("tribe_meta").select("*").eq("id", 1).maybeSingle(),
        supabase
          .from("tribe_events")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(EVENTS_LIMIT),
        supabase
          .from("projects")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("tasks")
          .select("*")
          .order("scheduled_start_at", { ascending: true }),
        supabase.from("member_availability").select("*"),
      ]);

    if (membersRes.error) {
      console.error("Failed to fetch members:", membersRes.error);
      setLoadError(membersRes.error.message ?? "Failed to load members.");
      return;
    }
    if (metaRes.error) {
      console.error("Failed to fetch meta:", metaRes.error);
      setLoadError(metaRes.error.message ?? "Failed to load meta.");
      return;
    }
    if (eventsRes.error) {
      console.error("Failed to fetch events:", eventsRes.error);
    }
    if (projectsRes.error)
      console.error("Failed to fetch projects:", projectsRes.error);
    if (tasksRes.error)
      console.error("Failed to fetch tasks:", tasksRes.error);
    if (availRes.error)
      console.error("Failed to fetch availability:", availRes.error);

    setMembers(membersRes.data ?? []);
    setMeta(
      metaRes.data ?? {
        id: 1,
        first_vouch_at: null,
        first_mover_id: null,
        last_vouch_target_id: null,
        last_voucher_id: null,
        last_vouch_at: null,
        combo_count: 0,
        combo_last_at: null,
        combo_multiplier_until: null,
        active_project_id: null,
      }
    );
    setEvents(eventsRes.data ?? []);
    setProjects(projectsRes.data ?? []);
    setTasks(tasksRes.data ?? []);
    setAvailability(availRes.data ?? []);
    setLoadError("");
    setCurrentUserId((prev) => prev || membersRes.data?.[0]?.id || "");
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
    if (currentUserId) {
      window.localStorage.setItem("tribe-current-user-id", currentUserId);
    }
  }, [currentUserId]);

  // -------- Realtime subscription --------

  // Generic upsert/delete handler for the new project-side tables. We just
  // refetch the relevant slice on change — the volume here is tiny.
  const handleProjectsPayload = useCallback((payload) => {
    setProjects((prev) => {
      if (payload.eventType === "DELETE") {
        return prev.filter((p) => p.id !== payload.old.id);
      }
      const incoming = payload.new;
      const idx = prev.findIndex((p) => p.id === incoming.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...incoming };
        return next;
      }
      return [incoming, ...prev];
    });
  }, []);

  const handleTasksPayload = useCallback((payload) => {
    setTasks((prev) => {
      if (payload.eventType === "DELETE") {
        return prev.filter((t) => t.id !== payload.old.id);
      }
      const incoming = payload.new;
      const idx = prev.findIndex((t) => t.id === incoming.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...incoming };
        return next;
      }
      return [...prev, incoming];
    });
  }, []);

  const handleAvailabilityPayload = useCallback((payload) => {
    setAvailability((prev) => {
      if (payload.eventType === "DELETE") {
        return prev.filter((a) => a.id !== payload.old.id);
      }
      const incoming = payload.new;
      const idx = prev.findIndex((a) => a.id === incoming.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...incoming };
        return next;
      }
      return [...prev, incoming];
    });
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("tribe-leader-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tribe_members" },
        handleMemberPayload
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tribe_meta" },
        handleMetaPayload
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tribe_events" },
        handleEventPayload
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        handleProjectsPayload
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        handleTasksPayload
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "member_availability" },
        handleAvailabilityPayload
      )
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await fetchAll();
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    fetchAll,
    handleMemberPayload,
    handleMetaPayload,
    handleEventPayload,
    handleProjectsPayload,
    handleTasksPayload,
    handleAvailabilityPayload,
  ]);

  // -------- Detect XP deltas to fire toasts --------

  useEffect(() => {
    const prevById = new Map(
      previousMembersRef.current.map((m) => [m.id, m])
    );
    for (const m of members) {
      const prev = prevById.get(m.id);
      if (!prev) continue;
      const delta = m.xp - prev.xp;
      if (delta > 0 && m.id === currentUserId) {
        // Match the largest known reward first; multiplier x2 doubles them.
        if (delta === XP.selfStarter * 2) pushToast("selfStarter", "x2 Combo");
        else if (delta === XP.selfStarter) pushToast("selfStarter");
        else if (delta === XP.sparkedWorker * 2)
          pushToast("sparkedWorker", "x2 Combo");
        else if (delta === XP.sparkedWorker) pushToast("sparkedWorker");
        else if (delta === XP.sparkIssuer * 2)
          pushToast("sparkIssuer", "x2 Combo");
        else if (delta === XP.sparkIssuer) pushToast("sparkIssuer");
        else if (delta === CHALLENGE_BONUS_XP)
          pushToast("voucher", "+25 Challenge Won");
        else if (delta === XP.voucher * 2 + XP.crowdVouchBonus) {
          pushToast("voucher", "x2 Combo");
          pushToast("crowdVouchBonus");
        } else if (delta === XP.voucher * 2) pushToast("voucher", "x2 Combo");
        else if (delta === XP.voucher + XP.crowdVouchBonus) {
          pushToast("voucher");
          pushToast("crowdVouchBonus");
        } else if (delta === XP.voucher) pushToast("voucher");
        else if (delta === XP.crowdVouchBonus) pushToast("crowdVouchBonus");
        else pushToast("voucher", `+${delta} XP earned`);
      }
    }
    previousMembersRef.current = members;
  }, [members, currentUserId, pushToast]);

  // -------- Crowning Ceremony / Crown Handoff --------

  useEffect(() => {
    const prev = previousMetaFirstVouchRef.current;
    const cur = meta?.first_vouch_at ?? null;
    if (cur && !prev && !ceremonyFiredRef.current) {
      const id = leaderIdFor(members);
      const leader = members.find((m) => m.id === id);
      if (leader) {
        ceremonyFiredRef.current = true;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCeremonyName(leader.name);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setConfettiTrigger(uid());
        sounds.crown(soundOn);
        triggerCrowningStreaks(leader.id);
        setTimeout(() => setCeremonyName(null), CEREMONY_MS);
      }
    }
    previousMetaFirstVouchRef.current = cur;
  }, [meta, members, soundOn, triggerCrowningStreaks]);

  useEffect(() => {
    const leaderId = leaderIdFor(members);
    const previousLeaderId = previousLeaderRef.current;
    const hadCeremony = ceremonyFiredRef.current && previousLeaderId;

    if (
      leaderId &&
      previousLeaderId &&
      leaderId !== previousLeaderId &&
      hadCeremony
    ) {
      const fromCenter = rectCenter(cardRefs.current.get(previousLeaderId));
      const toCenter = rectCenter(cardRefs.current.get(leaderId));
      fireStreak(fromCenter, toCenter, { gold: true, ttl: HANDOFF_MS });
      sounds.crown(soundOn);
      setConfettiTrigger(uid());
    }

    previousLeaderRef.current = leaderId;
  }, [members, soundOn, fireStreak]);

  // -------- Heartbeat --------

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  // -------- Derived values --------

  const sortedMembers = useMemo(() => {
    return [...members].sort(
      (a, b) =>
        b.xp - a.xp ||
        new Date(a.last_active_at).getTime() -
          new Date(b.last_active_at).getTime()
    );
  }, [members]);

  const membersById = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m])),
    [members]
  );

  const currentUser = membersById[currentUserId] ?? null;
  const isPreTribe = !meta?.first_vouch_at;
  const leaderId = isPreTribe ? null : leaderIdFor(members);

  const pulse = useMemo(
    () => computePulse({ members, recentEvents, now }),
    [members, recentEvents, now]
  );

  const multiplierActive =
    !!meta?.combo_multiplier_until &&
    new Date(meta.combo_multiplier_until).getTime() > now;
  const multiplierRemainingMs = futureRemaining(meta?.combo_multiplier_until);
  const comboCount = meta?.combo_count ?? 0;
  const comboWindowRemainingMs = meta?.combo_last_at
    ? Math.max(
        0,
        new Date(meta.combo_last_at).getTime() + COMBO_WINDOW_MS - now
      )
    : 0;

  function sparkRemaining(member) {
    if (!member.last_sparked_at) return 0;
    const elapsed = now - new Date(member.last_sparked_at).getTime();
    if (elapsed >= SPARK_COOLDOWN_MS) return 0;
    return Math.max(1, Math.ceil((SPARK_COOLDOWN_MS - elapsed) / 1000));
  }

  function challengeSecondsLeft(member) {
    if (!member.challenge_expires_at) return 0;
    const t = new Date(member.challenge_expires_at).getTime();
    if (t <= now) return 0;
    return Math.ceil((t - now) / 1000);
  }

  // -------- Project / task / availability derived values --------

  const activeProject = useMemo(() => {
    if (!meta?.active_project_id) return null;
    return projects.find((p) => p.id === meta.active_project_id) ?? null;
  }, [meta, projects]);

  const activeProjectTasks = useMemo(() => {
    if (!activeProject) return [];
    return tasks.filter((t) => t.project_id === activeProject.id);
  }, [tasks, activeProject]);

  // Map: member_id -> their current task in the active project (most relevant).
  // We pick the first non-verified/declined task scheduled the soonest.
  const tasksByMember = useMemo(() => {
    const map = new Map();
    if (!activeProject) return map;
    const sortedTasks = [...activeProjectTasks].sort(
      (a, b) =>
        Date.parse(a.scheduled_start_at) - Date.parse(b.scheduled_start_at)
    );
    for (const t of sortedTasks) {
      if (!t.assignee_id) continue;
      if (["verified", "declined", "expired"].includes(t.status)) {
        if (!map.has(t.assignee_id)) map.set(t.assignee_id, t);
        continue;
      }
      // Replace any earlier "completed" placeholder with the live task.
      map.set(t.assignee_id, t);
    }
    return map;
  }, [activeProject, activeProjectTasks]);

  const availabilityByMember = useMemo(() => {
    const map = new Map();
    for (const slot of availability) {
      if (!map.has(slot.member_id)) map.set(slot.member_id, []);
      map.get(slot.member_id).push(slot);
    }
    return map;
  }, [availability]);

  // Per-member eligibility snapshots used by MemberCard. Computed once per
  // tick (the heartbeat updates `now` every second).
  const eligibilityByMember = useMemo(() => {
    const map = new Map();
    if (!currentUser) return map;
    for (const m of members) {
      const task = tasksByMember.get(m.id) ?? null;
      const targetAvail = availabilityByMember.get(m.id) ?? [];
      const ws = task ? windowState(task, now) : { kind: null };
      const slotStart = !isInAvailability(targetAvail, now)
        ? nextAvailabilityStart(targetAvail, now)
        : null;
      const sparkRes = canSpark({
        actor: currentUser,
        target: m,
        targetTask: task,
        targetAvailability: targetAvail,
        lastSparkAt: currentUser.last_sparked_at,
        when: now,
      });
      const challengeRes = canChallenge({
        actor: currentUser,
        target: m,
        targetTask: task,
        targetAvailability: targetAvail,
        when: now,
      });
      // cheerCooldowns stores the unlock-at time, so the last-cheer time
      // is unlock - cooldown. Falls back to null when no cheer happened.
      const lastCheerAt = cheerCooldowns[m.id]
        ? cheerCooldowns[m.id] - CHEER_COOLDOWN_MS
        : null;
      const cheerRes = canCheer({
        actor: currentUser,
        target: m,
        targetAvailability: targetAvail,
        lastCheerAt,
        when: now,
      });
      const startRes = canStart(m, task, now);

      const withRemaining = (res) => {
        if (!res || res.ok) return res;
        if (res.unlocksAt != null) {
          return { ...res, unlocksInMs: Math.max(0, res.unlocksAt - now) };
        }
        return res;
      };

      map.set(m.id, {
        task,
        windowInfo: {
          ...ws,
          nextStartMs: slotStart,
        },
        sparkEligibility: withRemaining(sparkRes),
        challengeEligibility: withRemaining(challengeRes),
        cheerEligibility: withRemaining(cheerRes),
        startEligibility: withRemaining(startRes),
      });
    }
    return map;
  }, [
    currentUser,
    members,
    tasksByMember,
    availabilityByMember,
    cheerCooldowns,
    now,
  ]);

  const coachHints = useMemo(
    () =>
      buildCoachHints({
        currentUserId,
        members,
        tasksByMember,
        availabilityByMember,
        cheerCooldowns,
        when: now,
      }),
    [currentUserId, members, tasksByMember, availabilityByMember, cheerCooldowns, now]
  );

  // -------- Mutations --------

  async function updateMember(id, patch) {
    const { error } = await supabase
      .from("tribe_members")
      .update({ ...patch, last_active_at: isoNow() })
      .eq("id", id);
    if (error) throw error;
  }

  async function updateMeta(patch) {
    const { error } = await supabase
      .from("tribe_meta")
      .update(patch)
      .eq("id", 1);
    if (error) throw error;
  }

  async function insertEvent({
    kind,
    actor_id = null,
    target_id = null,
    payload = {},
  }) {
    const { error } = await supabase.from("tribe_events").insert({
      kind,
      actor_id,
      target_id,
      payload,
    });
    if (error) console.error("insertEvent failed:", error);
  }

  async function moveSelfToWorking() {
    if (!currentUser || currentUser.status !== "idle") return;
    const myTask = tasksByMember.get(currentUser.id);
    setBusy(true);
    try {
      // First-mover bookkeeping happens regardless of project mode — it's
      // the once-per-session badge on tribe_meta.
      const patch = {};
      if (currentUser.spark_streak > 0) patch.spark_streak = 0;
      const noOneHasMoved = members.every((m) => !m.first_mover);
      if (noOneHasMoved && !meta?.first_mover_id) {
        patch.first_mover = true;
      }

      if (myTask) {
        // RPC also sets member.status='working' and stamps started_at.
        const { error } = await supabase.rpc("start_task", { p_task: myTask.id });
        if (error) throw error;
        if (Object.keys(patch).length) {
          await updateMember(currentUser.id, patch);
        }
      } else {
        await updateMember(currentUser.id, { ...patch, status: "working" });
      }

      if (patch.first_mover) {
        await updateMeta({ first_mover_id: currentUser.id });
        await insertEvent({
          kind: "first_mover",
          actor_id: currentUser.id,
          target_id: currentUser.id,
        });
      }
    } catch (e) {
      console.error("moveSelfToWorking failed:", e);
      pushToast("voucher", e?.message ?? "Could not start.");
    } finally {
      setBusy(false);
    }
  }

  async function moveSelfToDone() {
    if (!currentUser || currentUser.status !== "working") return;
    const myTask = tasksByMember.get(currentUser.id);
    setBusy(true);
    try {
      if (myTask && myTask.status === "working") {
        const { error } = await supabase.rpc("complete_task", {
          p_task: myTask.id,
        });
        if (error) throw error;
      } else {
        await updateMember(currentUser.id, { status: "done" });
      }
    } catch (e) {
      console.error("moveSelfToDone failed:", e);
    } finally {
      setBusy(false);
    }
  }

  async function sparkTeammate(target) {
    if (!currentUser) return;
    if (target.id === currentUser.id) return;
    if (target.status !== "idle") return;
    if (sparkRemaining(target) > 0) return;

    // Calendar-aware gate: refuse the spark and tell the user why.
    const elig = eligibilityByMember.get(target.id)?.sparkEligibility;
    if (elig && !elig.ok) {
      pushToast("voucher", elig.reason ?? "Spark locked.");
      return;
    }

    setBusy(true);
    try {
      await updateMember(target.id, {
        last_sparked_by: currentUser.id,
        last_sparked_at: isoNow(),
      });
      sounds.spark(soundOn);
      const fromCenter = rectCenter(cardRefs.current.get(currentUser.id));
      const toCenter = rectCenter(cardRefs.current.get(target.id));
      fireStreak(fromCenter, toCenter);
      await insertEvent({
        kind: "spark",
        actor_id: currentUser.id,
        target_id: target.id,
      });
    } catch (e) {
      console.error("spark failed:", e);
    } finally {
      setBusy(false);
    }
  }

  async function challengeTeammate(target) {
    if (!currentUser) return;
    if (target.id === currentUser.id) return;
    if (target.status !== "idle") return;
    if (challengeSecondsLeft(target) > 0) return;

    const elig = eligibilityByMember.get(target.id)?.challengeEligibility;
    if (elig && !elig.ok) {
      pushToast("voucher", elig.reason ?? "Challenge locked.");
      return;
    }

    setBusy(true);
    try {
      await updateMember(target.id, {
        challenge_from: currentUser.id,
        challenge_expires_at: isoIn(CHALLENGE_DURATION_MS),
      });
      await insertEvent({
        kind: "challenge",
        actor_id: currentUser.id,
        target_id: target.id,
      });
    } catch (e) {
      console.error("challenge failed:", e);
    } finally {
      setBusy(false);
    }
  }

  async function cheerTeammate(target, emoji) {
    if (!currentUser) return;
    if (target.id === currentUser.id) return;
    const t = nowMs();
    if ((cheerCooldowns[target.id] || 0) > t) return;

    const elig = eligibilityByMember.get(target.id)?.cheerEligibility;
    if (elig && !elig.ok) {
      pushToast("voucher", elig.reason ?? "Cheer locked.");
      return;
    }

    setCheerCooldowns((prev) => ({
      ...prev,
      [target.id]: t + CHEER_COOLDOWN_MS,
    }));
    spawnCheerAtCard(target.id, emoji);
    await insertEvent({
      kind: "cheer",
      actor_id: currentUser.id,
      target_id: target.id,
      payload: { emoji },
    });
  }

  async function vouchForDoneTask(target) {
    if (!currentUser) return;
    if (target.id === currentUser.id) return;
    setBusy(true);
    try {
      const eligibleCrowdVouch =
        target.status !== "done" &&
        meta?.last_vouch_target_id === target.id &&
        meta?.last_voucher_id !== currentUser.id &&
        isWithinWindow(meta?.last_vouch_at, CROWD_VOUCH_WINDOW_MS);

      if (target.status === "done") {
        const t = nowMs();
        const isMultiplierActive =
          !!meta?.combo_multiplier_until &&
          new Date(meta.combo_multiplier_until).getTime() > t;
        const mult = isMultiplierActive ? 2 : 1;

        const baseWorker = target.last_sparked_by
          ? XP.sparkedWorker
          : XP.selfStarter;
        const workerXp = baseWorker * mult;
        const voucherXp = XP.voucher * mult;
        const sparkIssuerXp = (target.last_sparked_by ? XP.sparkIssuer : 0) * mult;

        const challengeActive =
          target.challenge_from &&
          target.challenge_expires_at &&
          new Date(target.challenge_expires_at).getTime() > t;
        const challenger = challengeActive
          ? membersById[target.challenge_from]
          : null;

        const updates = {};
        const ensure = (id) =>
          (updates[id] = updates[id] || { xpDelta: 0, patch: {} });

        ensure(target.id);
        updates[target.id].xpDelta += workerXp;
        updates[target.id].patch = {
          ...updates[target.id].patch,
          status: "idle",
          last_sparked_by: null,
          challenge_from: null,
          challenge_expires_at: null,
        };

        ensure(currentUser.id);
        updates[currentUser.id].xpDelta += voucherXp;

        if (target.last_sparked_by) {
          const issuer = membersById[target.last_sparked_by];
          if (issuer) {
            ensure(issuer.id);
            updates[issuer.id].xpDelta += sparkIssuerXp;
            updates[issuer.id].patch.spark_streak =
              (issuer.spark_streak || 0) + 1;
          }
        }

        if (challenger && challenger.id !== currentUser.id) {
          ensure(challenger.id);
          updates[challenger.id].xpDelta += CHALLENGE_BONUS_XP;
          ensure(target.id);
          updates[target.id].xpDelta += CHALLENGE_BONUS_XP;
        }

        // Pre/post leader for handoff event detection.
        const preLeader = leaderIdFor(members);
        const projected = members.map((m) => {
          const u = updates[m.id];
          if (!u) return m;
          return { ...m, xp: m.xp + u.xpDelta };
        });
        const postLeader = leaderIdFor(projected);

        await Promise.all(
          Object.entries(updates).map(([id, u]) => {
            const m = membersById[id];
            if (!m) return Promise.resolve();
            return updateMember(id, {
              ...u.patch,
              xp: m.xp + u.xpDelta,
            });
          })
        );

        const lastAt = meta?.combo_last_at
          ? new Date(meta.combo_last_at).getTime()
          : 0;
        const within = t - lastAt < COMBO_WINDOW_MS;
        const newCount = within ? (meta?.combo_count || 0) + 1 : 1;
        const reachedThreshold = newCount >= COMBO_THRESHOLD;
        const newUntil = reachedThreshold
          ? isoIn(COMBO_MULTIPLIER_MS)
          : (meta?.combo_multiplier_until ?? null);

        const isFirstVouch = !meta?.first_vouch_at;
        const stamp = isoNow();

        await updateMeta({
          first_vouch_at: meta?.first_vouch_at ?? stamp,
          last_vouch_target_id: target.id,
          last_voucher_id: currentUser.id,
          last_vouch_at: stamp,
          combo_count: newCount,
          combo_last_at: stamp,
          combo_multiplier_until: newUntil,
        });

        sounds.vouch(soundOn);

        await insertEvent({
          kind: "vouch",
          actor_id: currentUser.id,
          target_id: target.id,
          payload: {
            xp: voucherXp,
            multiplier: mult > 1 ? mult : undefined,
          },
        });

        if (isFirstVouch && postLeader) {
          await insertEvent({
            kind: "crowned",
            actor_id: currentUser.id,
            target_id: postLeader,
          });
        } else if (
          preLeader &&
          postLeader &&
          preLeader !== postLeader
        ) {
          await insertEvent({
            kind: "handoff",
            actor_id: postLeader,
            target_id: preLeader,
          });
        }

        if (
          newCount === COMBO_THRESHOLD &&
          (!meta?.combo_multiplier_until ||
            new Date(meta.combo_multiplier_until).getTime() < t)
        ) {
          await insertEvent({
            kind: "combo_activated",
            actor_id: currentUser.id,
            target_id: target.id,
            payload: { multiplier: 2 },
          });
          setConfettiTrigger(uid());
        }

        if (challenger && challenger.id !== currentUser.id) {
          await insertEvent({
            kind: "challenge_won",
            actor_id: challenger.id,
            target_id: target.id,
            payload: { xp: CHALLENGE_BONUS_XP },
          });
        }

        // If the target was working a real task, flip it to verified
        // server-side and check whether this completes the project.
        const targetTask = tasksByMember.get(target.id);
        if (targetTask && targetTask.status === "done") {
          const { data, error: vouchErr } = await supabase.rpc("vouch_task", {
            p_task: targetTask.id,
            p_voucher: currentUser.id,
          });
          if (vouchErr) {
            console.error("vouch_task RPC failed:", vouchErr);
          } else {
            const row = Array.isArray(data) ? data[0] : data;
            if (row?.out_project_completed) {
              const proj = activeProject;
              if (proj) {
                setProjectWonName(proj.name);
                setConfettiTrigger(uid());
                sounds.crown(soundOn);
                setTimeout(() => setProjectWonName(null), CEREMONY_MS);
                await insertEvent({
                  kind: "project_won",
                  actor_id: currentUser.id,
                  target_id: target.id,
                  payload: { project_id: proj.id, name: proj.name },
                });
              }
            }
          }
        }
      } else if (eligibleCrowdVouch) {
        const updates = [];
        updates.push(
          updateMember(currentUser.id, {
            xp: currentUser.xp + XP.crowdVouchBonus,
          })
        );
        const otherId = meta.last_voucher_id;
        const other = membersById[otherId];
        if (other && otherId !== currentUser.id) {
          updates.push(
            updateMember(other.id, { xp: other.xp + XP.crowdVouchBonus })
          );
        }
        await Promise.all(updates);
        await updateMeta({
          last_voucher_id: currentUser.id,
          last_vouch_at: isoNow(),
        });
        setConfettiTrigger(uid());
        sounds.vouch(soundOn);
      }
    } catch (e) {
      console.error("vouch failed:", e);
    } finally {
      setBusy(false);
    }
  }

  async function launchProject({ name, kind, goal, creator, tasks: payload }) {
    const { error } = await supabase.rpc("create_project_with_tasks", {
      p_name: name,
      p_kind: kind,
      p_goal: goal,
      p_creator: creator,
      p_tasks: payload,
    });
    if (error) throw error;
    pushToast("voucher", `${name} launched · ${payload.length} tasks proposed`);
    await fetchAll();
  }

  async function archiveActiveProject() {
    if (!activeProject) return;
    if (
      !confirm(
        `Archive "${activeProject.name}"? It will be moved out of the active slot but kept in history.`
      )
    )
      return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("archive_project", {
        p_project: activeProject.id,
      });
      if (error) throw error;
      pushToast("voucher", `${activeProject.name} archived`);
    } catch (e) {
      console.error("archive failed:", e);
      pushToast("voucher", e?.message ?? "Archive failed.");
    } finally {
      setBusy(false);
    }
  }

  async function acceptTask(taskId) {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("accept_task", { p_task: taskId });
      if (error) throw error;
    } catch (e) {
      console.error("accept_task failed:", e);
      pushToast("voucher", e?.message ?? "Could not accept.");
    } finally {
      setBusy(false);
    }
  }

  async function declineTask(taskId) {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("decline_task", { p_task: taskId });
      if (error) throw error;
    } catch (e) {
      console.error("decline_task failed:", e);
      pushToast("voucher", e?.message ?? "Could not decline.");
    } finally {
      setBusy(false);
    }
  }

  // Demo helper: fast-forward any member to 'done' regardless of who's
  // currently selected, walking the task through the proper RPC chain so
  // Vouch still works afterward. Useful for solo demos.
  async function demoMarkDone(member) {
    if (!member) return;
    if (member.status === "done" || member.status === "verified") return;

    const memberTask = tasksByMember.get(member.id);
    setBusy(true);
    try {
      if (memberTask) {
        if (memberTask.status === "accepted" || memberTask.status === "idle") {
          const { error } = await supabase.rpc("start_task", {
            p_task: memberTask.id,
          });
          if (error) throw error;
        }
        if (
          memberTask.status === "working" ||
          memberTask.status === "accepted" ||
          memberTask.status === "idle"
        ) {
          const { error } = await supabase.rpc("complete_task", {
            p_task: memberTask.id,
          });
          if (error) throw error;
        }
      } else {
        if (member.status === "idle") {
          await updateMember(member.id, { status: "working" });
        }
        await updateMember(member.id, { status: "done" });
      }
      pushToast("voucher", `${member.name} marked done (demo)`);
    } catch (e) {
      console.error("demoMarkDone failed:", e);
      pushToast("voucher", e?.message ?? "Demo Done failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAvailability(memberId, slots) {
    const { error } = await supabase.rpc("set_availability", {
      p_member: memberId,
      p_slots: slots,
    });
    if (error) throw error;
    pushToast("voucher", "Availability saved");
  }

  function handleCoachClick(hint) {
    if (!hint?.targetId) return;
    const node = cardRefs.current.get(hint.targetId);
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      node.classList.add("coach-flash");
      setTimeout(() => node.classList.remove("coach-flash"), 1100);
    }
    if (hint.kind === "self_start" && hint.targetId === currentUserId) {
      moveSelfToWorking();
    } else if (hint.kind === "vouch_now") {
      const target = membersById[hint.targetId];
      if (target) vouchForDoneTask(target);
    } else if (hint.kind === "spark_now") {
      const target = membersById[hint.targetId];
      if (target) sparkTeammate(target);
    } else if (hint.kind === "challenge_now") {
      const target = membersById[hint.targetId];
      if (target) challengeTeammate(target);
    } else if (hint.kind === "cheer_working") {
      const target = membersById[hint.targetId];
      if (target) cheerTeammate(target, "🔥");
    }
  }

  async function resetSession() {
    if (!confirm("Reset the tribe? This wipes XP, badges, log, and ceremony state."))
      return;
    setBusy(true);
    try {
      ceremonyFiredRef.current = false;
      previousLeaderRef.current = null;
      previousMetaFirstVouchRef.current = null;
      previousMembersRef.current = [];
      const { error } = await supabase.rpc("reset_tribe_session");
      if (error) throw error;
      await fetchAll();
    } catch (e) {
      console.error("reset failed:", e);
    } finally {
      setBusy(false);
    }
  }

  // -------- Render --------

  const showCtaHaloOnCurrent =
    isPreTribe && pulse === PULSE.dormant && currentUser?.status === "idle";

  return (
    <main
      className={`relative min-h-screen text-zinc-100 transition-all duration-700 ${pulseBackgroundClass(pulse)}`}
    >
      <BackgroundFX />

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-7">
        <Header
          pulse={pulse}
          members={sortedMembers}
          currentUserId={currentUserId}
          onCurrentUserChange={setCurrentUserId}
          soundOn={soundOn}
          onToggleSound={() => setSoundOn((v) => !v)}
          onResetSession={resetSession}
          onNewProject={() => setWizardOpen(true)}
          onEditAvailability={() => setAvailabilityOpen(true)}
        />

        <div className="mt-4">
          <ProjectBanner
            project={activeProject}
            tasks={activeProjectTasks}
            onNewProject={() => setWizardOpen(true)}
            onArchive={archiveActiveProject}
          />
        </div>

        <CoachStrip hints={coachHints} onHintClick={handleCoachClick} />

        <ComboMeter
          comboCount={comboCount}
          multiplierActive={multiplierActive}
          multiplierRemainingMs={multiplierRemainingMs}
          comboWindowRemainingMs={comboWindowRemainingMs}
        />

        {loadError ? (
          <div className="mb-6 rounded-xl border border-red-500/60 bg-red-950/40 px-4 py-3 text-sm text-red-100">
            <p className="font-bold">Data load error</p>
            <p className="mt-1 text-red-200">
              {loadError}. Apply{" "}
              <code className="rounded bg-red-900 px-1 py-0.5">
                supabase/tribe_leader_schema.sql
              </code>
              ,{" "}
              <code className="rounded bg-red-900 px-1 py-0.5">
                tribe_leader_v2.sql
              </code>
              ,{" "}
              <code className="rounded bg-red-900 px-1 py-0.5">
                tribe_leader_v3.sql
              </code>
              , and{" "}
              <code className="rounded bg-red-900 px-1 py-0.5">
                tribe_leader_v4.sql
              </code>{" "}
              in this Supabase project.
            </p>
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-12">
          <div className="rounded-2xl border border-zinc-700/70 bg-black/35 p-5 backdrop-blur lg:col-span-7">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-300">
                Tribe Arena
              </h2>
              {isPreTribe ? (
                <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-200 ring-1 ring-amber-400/40">
                  Pre-Tribe
                </span>
              ) : null}
            </div>

            {isPreTribe ? (
              <p className="mb-5 text-center text-sm font-semibold uppercase tracking-[0.2em] text-amber-200/80">
                Strike first. Become the first Tribe Leader.
              </p>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              {sortedMembers.map((member, idx) => {
                const isCurrent = currentUser?.id === member.id;
                const isLeader = !isPreTribe && member.id === leaderId;
                const sparkIssuer = member.last_sparked_by
                  ? membersById[member.last_sparked_by]
                  : null;
                const challenger = member.challenge_from
                  ? membersById[member.challenge_from]
                  : null;
                const elig = eligibilityByMember.get(member.id) ?? {};
                const showSelfStartHalo =
                  isCurrent &&
                  member.status === "idle" &&
                  (elig.windowInfo?.kind === "grace" ||
                    elig.windowInfo?.kind === "open" ||
                    (showCtaHaloOnCurrent && !elig.task));
                return (
                  <MemberCard
                    key={member.id}
                    member={member}
                    task={elig.task}
                    windowInfo={elig.windowInfo}
                    isCurrent={isCurrent}
                    isLeader={isLeader}
                    isPreTribe={isPreTribe}
                    sparkIssuer={sparkIssuer}
                    challenger={challenger}
                    challengeSecondsLeft={challengeSecondsLeft(member)}
                    sparkEligibility={elig.sparkEligibility}
                    challengeEligibility={elig.challengeEligibility}
                    cheerEligibility={elig.cheerEligibility}
                    startEligibility={
                      elig.task ? elig.startEligibility : { ok: true }
                    }
                    showCtaHalo={showSelfStartHalo}
                    flashingVouched={flashingVouchedId === member.id}
                    showVerifiedStamp={verifiedStampId === member.id}
                    onStartWorking={moveSelfToWorking}
                    onMarkDone={moveSelfToDone}
                    onSpark={() => sparkTeammate(member)}
                    onVouch={() => vouchForDoneTask(member)}
                    onCheer={(emoji) => cheerTeammate(member, emoji)}
                    onChallenge={() => challengeTeammate(member)}
                    onAcceptTask={
                      isCurrent && elig.task?.status === "proposed"
                        ? () => acceptTask(elig.task.id)
                        : undefined
                    }
                    onDeclineTask={
                      isCurrent && elig.task?.status === "proposed"
                        ? () => declineTask(elig.task.id)
                        : undefined
                    }
                    onDemoMarkDone={() => demoMarkDone(member)}
                    cardRef={setCardRef(member.id)}
                    busy={busy}
                    enterIndex={idx}
                  />
                );
              })}
            </div>
          </div>

          <div className="space-y-6 lg:col-span-3">
            <Leaderboard members={members} isPreTribe={isPreTribe} />
          </div>

          <div className="space-y-6 lg:col-span-2">
            <BattleLog
              events={events.slice(0, BATTLE_LOG_LIMIT)}
              membersById={membersById}
              now={now}
            />
          </div>
        </section>

        <footer className="mt-8 text-center text-xs uppercase tracking-[0.25em] text-zinc-500">
          The crown is earned, not assigned.
        </footer>
      </div>

      <Toasts toasts={toasts} />
      <SparkStreaks streaks={streaks} />
      <Confetti trigger={confettiTrigger} />
      <CheerReactions reactions={cheerReactions} />
      {ceremonyName ? <CrowningCeremony leaderName={ceremonyName} /> : null}
      {projectWonName ? (
        <CrowningCeremony leaderName={`PROJECT WON · ${projectWonName}`} />
      ) : null}

      <ProjectWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        members={members}
        currentUserId={currentUserId}
        onLaunch={launchProject}
      />

      <AvailabilityEditor
        open={availabilityOpen}
        onClose={() => setAvailabilityOpen(false)}
        member={currentUser}
        initialSlots={availabilityByMember.get(currentUserId) ?? []}
        onSave={saveAvailability}
      />
    </main>
  );
}
