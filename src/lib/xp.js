// Centralized XP rules for Tribe Leader.

export const XP = {
  selfStarter: 70,
  sparkedWorker: 40,
  sparkIssuer: 30,
  voucher: 15,
  crowdVouchBonus: 5,
  steppedUp: 10,
};

// Bounty bookkeeping for pass / claim. Each pass adds STEP_UP_BONUS to
// the task's bounty stack, capped at STEP_UP_CAP. Mirrors the SQL guard
// in tasks_bounty_cap so the UI can preview the next bounty before the
// RPC round-trips.
export const STEP_UP_BONUS = 10;
export const STEP_UP_CAP = 30;

export const TOAST_LABELS = {
  selfStarter: `+${XP.selfStarter} XP — Self-Starter`,
  sparkedWorker: `+${XP.sparkedWorker} XP — Sparked Worker`,
  sparkIssuer: `+${XP.sparkIssuer} XP — Successful Spark`,
  voucher: `+${XP.voucher} XP — Voucher`,
  crowdVouchBonus: `+${XP.crowdVouchBonus} XP — Crowd Vouch Bonus`,
  steppedUp: `+${XP.steppedUp} XP — Stepped Up`,
};
