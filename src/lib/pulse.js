// Tribe Pulse computation: dormant -> awakening -> active -> frenzy.
// Pulse drives the global background gradient of the arena.

export const PULSE = {
  dormant: "dormant",
  awakening: "awakening",
  active: "active",
  frenzy: "frenzy",
};

const FIVE_MINUTES = 5 * 60 * 1000;
const SIXTY_SECONDS = 60 * 1000;
const AWAKENING_WINDOW = 8 * 1000;

export function computePulse({ members, recentEvents, now }) {
  if (!members || members.length === 0) return PULSE.dormant;

  const lastActivity = members.reduce((max, m) => {
    const t = new Date(m.last_active_at).getTime() || 0;
    return Math.max(max, t);
  }, 0);

  const sinceLast = now - lastActivity;
  if (sinceLast > FIVE_MINUTES) return PULSE.dormant;

  const recentChanges = (recentEvents || []).filter(
    (e) => now - e.at <= SIXTY_SECONDS
  );
  if (recentChanges.length >= 3) return PULSE.frenzy;

  const activeCount = members.filter((m) => {
    const t = new Date(m.last_active_at).getTime() || 0;
    return m.status !== "idle" && now - t <= FIVE_MINUTES;
  }).length;
  if (activeCount >= 2) return PULSE.active;

  if (sinceLast <= AWAKENING_WINDOW) return PULSE.awakening;
  return PULSE.awakening;
}

export function pulseLabel(pulse) {
  switch (pulse) {
    case PULSE.frenzy:
      return "Frenzy";
    case PULSE.active:
      return "Active";
    case PULSE.awakening:
      return "Awakening";
    default:
      return "Dormant";
  }
}

export function pulseBackgroundClass(pulse) {
  switch (pulse) {
    case PULSE.frenzy:
      return "pulse-frenzy";
    case PULSE.active:
      return "pulse-active";
    case PULSE.awakening:
      return "pulse-awakening";
    default:
      return "pulse-dormant";
  }
}
