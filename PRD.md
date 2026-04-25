# Tribe Leader — Product Requirements Document

> Group accountability turned into a live arena. The crown is earned, not assigned.

---

## 1. Product Vision

Tribe Leader is a real-time, gamified accountability tool for small groups (3–6 people). It replaces nagging, status meetings, and to-do lists with a high-energy social arena where finishing tasks feels public, celebrated, and competitive in a healthy way.

### Pillars

- **Herd momentum.** A teammate moving makes everyone want to move.
- **Fair-play XP.** Self-discipline pays the most, but lifting others pays well too.
- **Real-time social pressure.** Every state change is felt by the whole tribe instantly.
- **UI as the game.** The interface is not a dashboard. It is the playing field.

### Target Demo (Hackathon)

- 4 hardcoded users in a single shared "tribe."
- No authentication. A `Current User` dropdown switches identity.
- Real-time multi-tab demo on a single laptop.

---

## 2. Core Premise (Updated)

The previous version implicitly assumed a "leader." That is wrong.

**No one is born a leader. Everyone starts as a Tribe Member.**

The product opens in a **Pre-Tribe state**:

- All members listed equally.
- No crown anywhere on screen.
- Leaderboard shows: `No Tribe Leader yet — strike first.`
- A glowing CTA invites the first action.

The **first verified task** in the session triggers the **Crowning Ceremony** and produces the first Tribe Leader. From then on, the crown is **dynamic** — it always belongs to whoever currently has the highest XP. It can change hands mid-session, and that handoff is itself a celebrated UI moment.

---

## 3. Roles and States

### Member states

- `idle` — default; eligible to be Sparked.
- `working` — actively executing a task.
- `done` — task complete; awaiting Vouch from a teammate.
- `vouched` — task verified; XP awarded, returns to `idle`.

### Tribe states (drives Tribe Pulse)

- `dormant` — no activity in last 5 minutes.
- `awakening` — at least one member just changed state.
- `active` — 2+ members not idle in last 5 minutes.
- `frenzy` — 3+ state changes within 60 seconds.

### Leader (derived, not stored)

- Pre-Tribe: no leader exists.
- Post-Crowning: `leader = member with max(xp)`. Ties broken by earliest `last_active_at`.

---

## 4. Gameplay Loop

### Base XP rules (preserved)

- **Self-Starter:** moves Idle → Working without being Sparked. On vouch: **+70 XP**.
- **Sparked Worker:** moves Idle → Working after being Sparked. On vouch: **+40 XP**.
- **Spark Issuer:** Sparked a teammate whose task gets vouched: **+30 XP**.
- **Voucher:** verifies a teammate's `done` task: **+15 XP**.

### Micro-mechanics (new, add flavor)

- **First Mover badge.** First member to leave Idle in a session gets a one-time `First Mover` badge on their card. No XP, just bragging rights.
- **Chain Spark.** If a Spark Issuer chains 2+ successful sparks back-to-back, they get a streak counter visible on their card (`x2`, `x3`, ...). The streak resets when they go Working themselves or stay idle for 5 minutes.
- **Crowd Vouch.** If 2+ teammates vouch the same Done task within 30 seconds of each other, every voucher gets a `+5 XP` bonus and a confetti burst.

### Anti-cheese rules

- A user cannot vouch their own task.
- Re-Sparking the same idle teammate within 60 seconds is a no-op (UI shows "Already Sparked").
- XP is only awarded at vouch time, never on state change.

---

## 5. Crowning Ceremony (Hero Moment)

The single most important UI moment of the product.

### Trigger

The very first time a `done` task is vouched in a session, regardless of XP totals.

### Sequence (3.5 seconds total)

1. Screen dims slightly. Tribe Pulse background flashes to `frenzy` gradient.
2. The new leader's card lifts to center, scales up to 1.15x, and gains a golden ring.
3. A crown drops from above and lands on the card with a small bounce.
4. Confetti burst, lightning streak from each teammate's card converges on the leader.
5. Leaderboard recomputes; rank chips animate into place.
6. Banner reads: `<Name> is the first Tribe Leader.`

### Subsequent crown handoffs

After the first ceremony, future leadership swaps use a faster (1.2s) "crown handoff" animation: crown lifts off old leader, arcs across leaderboard, lands on new leader.

---

## 6. UI Design Spec — The UI Is the Game

The interface uses dark-mode "Colosseum" aesthetic: deep midnight blues, emerald + cyan accents, fuchsia for sparks, gold reserved exclusively for the Tribe Leader.

### 6.1 Tribe Pulse (Global Mood Engine)

The whole-page background is a gradient that breathes with group activity.

- `dormant` — slate/zinc, subtle vignette, low motion.
- `awakening` — slow indigo wash that pulses every 4s.
- `active` — electric blue with cyan glow shadow.
- `frenzy` — animated diagonal sweep mixing cyan + fuchsia.

This is the ambient feedback channel. Even without reading a single label, a user can feel whether the tribe is moving.

### 6.2 Member Cards (Tribe Arena)

Each card is a "fighter portrait." Cards are equal-sized and arranged in a responsive grid.

Card anatomy:

- Avatar / monogram on left.
- Name, XP, optional `First Mover`, `x3 Spark Streak` badges.
- State badge top-right with state-specific micro-animation:
  - `idle`: slow shimmer sweep across the badge every 6s.
  - `working`: cyan glow ring breathing at 1.5s cadence.
  - `done`: emerald-lit; small floating sparkle particle.
  - `vouched` (transient, ~1.5s): white flash then return to idle.
- "Sparked by <name>" hint pill if applicable.
- State-aware action buttons at the bottom (see 6.4).

The current user's card is outlined with a cyan inner border so identity is always obvious.

### 6.3 Leaderboard

Right rail panel.

**Pre-Tribe state:**

- Empty crown silhouette at top.
- Caption: `No Tribe Leader yet — strike first.`
- Members listed alphabetically with `0 XP` and no rank numbers.

**Post-Crowning state:**

- Rank chips `#1`, `#2`, ... appear with a stagger.
- Only `#1` shows the crown (gold glyph).
- XP bars fill horizontally; bar fills animate from old XP to new XP.
- On rank change: row slides into new position; brief gold spark on rank-up.

### 6.4 Action Buttons (Where the Game Is Played)

Buttons are not just buttons. Each is a mini-interaction.

- **Start Working (self only, when idle).**
  - Cyan, slight pulse to invite the click.
  - On click: card flashes cyan, status badge animates to `working`.
- **Mark Done (self only, when working).**
  - Emerald.
  - On click: confetti spritz + card lift.
- **Spark (others, when idle).**
  - Fuchsia.
  - Hover charges a lightning bolt icon; click fires a streak from the user's card to the target card across the screen.
  - Disabled with tooltip if same teammate was Sparked in last 60s.
- **Vouch (others, when done).**
  - Gold.
  - **Hold-to-confirm** (600ms press): a circular progress ring fills around the cursor; releasing early cancels.
  - On commit: stamp animation slams onto target card with a `VERIFIED` watermark; XP toast fires.

### 6.5 XP Toasts and Reward Layer

Every XP gain spawns a toast in the bottom-right.

- `+70 XP — Self-Starter`
- `+40 XP — Sparked Worker`
- `+30 XP — Successful Spark`
- `+15 XP — Voucher`
- `+5 XP — Crowd Vouch Bonus`

Toasts stack (max 4 visible), each persists 2.5s, slide in from the right.

### 6.6 Empty / Onboarding State

If there is no recent activity AND no crown has ever been placed:

- Big subtle text in the center of the Arena: `Strike first. Become the first Tribe Leader.`
- The current user's `Start Working` button gets a slow gold halo to draw attention.

### 6.7 Motion and Sound Budget

- Animations under 350ms unless they are hero moments (Crowning, Crown Handoff).
- Reduced-motion preference disables non-essential animations and replaces them with simple opacity transitions.
- Sound is **off by default** with a small toggle in the header. Sounds: Spark zap, Vouch stamp, Crown fanfare.

---

## 7. User Flow Map

```mermaid
flowchart TD
    Start([Open app]) --> Pick[Pick Current User from dropdown]
    Pick --> Pre{First verified task<br/>happened yet?}

    Pre -- No --> PreTribe[Pre-Tribe state<br/>No crown shown]
    Pre -- Yes --> PostTribe[Post-Crowning state<br/>Leader visible]

    PreTribe --> Idle1[All members Idle]
    PostTribe --> Idle1

    Idle1 --> Choose{What does<br/>the user do?}
    Choose -->|Self-start| SelfWork[Move self to Working]
    Choose -->|Spark teammate| SparkAct[Spark idle teammate]
    Choose -->|Wait| Idle1

    SparkAct --> SparkedIdle[Target now flagged<br/>last_sparked_by]
    SparkedIdle --> SparkedMove{Did sparked<br/>teammate move?}
    SparkedMove -- Yes --> SparkedWork[Sparked teammate Working]
    SparkedMove -- No --> Idle1

    SelfWork --> Done1[Move to Done]
    SparkedWork --> Done1

    Done1 --> Vouch{Teammate<br/>holds Vouch?}
    Vouch -- No --> Done1
    Vouch -- Yes --> VerifyXP[Award XP<br/>"Worker + Voucher (+ Spark Issuer)"]

    VerifyXP --> CrownCheck{First verified<br/>task this session?}
    CrownCheck -- Yes --> CrownCeremony["Crowning Ceremony<br/>3.5s hero moment"]
    CrownCheck -- No --> Recompute[Recompute leader<br/>handoff if changed]

    CrownCeremony --> LeaderBoard[Leaderboard updates]
    Recompute --> LeaderBoard

    LeaderBoard --> Reset[Vouched member<br/>returns to Idle]
    Reset --> Idle1
```

---

## 8. Screen Wireframes (Text)

### 8.1 Header

```
[ FAIR PLAY SYSTEM ]
Tribe Leader                     [Pulse: Active]   Current User: [Ari ▼]   [Sound: off]
Real-time accountability through herd momentum.
```

### 8.2 Tribe Arena (grid of member cards)

```
+----------------------------------+   +----------------------------------+
| (avatar) Ari (You)        [IDLE]|   | (avatar) Blaze            [WORK]|
| 0 XP                             |   | 0 XP   First Mover               |
|                                  |   | (cyan glow ring)                 |
| [ Start Working ]                |   |                                  |
+----------------------------------+   +----------------------------------+

+----------------------------------+   +----------------------------------+
| (avatar) Cyra              [DONE]|   | (avatar) Dax              [IDLE]|
| 0 XP   Sparked by Blaze          |   | 0 XP                             |
| (sparkle particle)               |   |                                  |
| [ Vouch (hold)        ]          |   | [ Spark ]                        |
+----------------------------------+   +----------------------------------+
```

### 8.3 Leaderboard — Pre-Tribe

```
+--- LEADERBOARD ----------------------+
|   (empty crown silhouette)           |
|   No Tribe Leader yet — strike first.|
|                                      |
|   Ari    0 XP                        |
|   Blaze  0 XP                        |
|   Cyra   0 XP                        |
|   Dax    0 XP                        |
+--------------------------------------+
```

### 8.4 Leaderboard — Post-Crowning

```
+--- LEADERBOARD ----------------------+
|  #1  (crown) Blaze       70 XP  ###  |
|  #2          Ari         15 XP  #    |
|  #3          Cyra         0 XP       |
|  #3          Dax          0 XP       |
+--------------------------------------+
```

### 8.5 XP Toast Stack (bottom-right)

```
+---------------------------+
| +70 XP — Self-Starter     |
+---------------------------+
| +15 XP — Voucher          |
+---------------------------+
```

---

## 9. Demo Script (60–90 seconds)

Targeted at hackathon judging. Two browser tabs side by side.

1. **0:00** — Open app, both tabs land in Pre-Tribe state. Point out: "No crown anywhere. Nobody is the leader yet."
2. **0:08** — Tab A switches to user `Ari`. Tab B switches to `Blaze`.
3. **0:15** — In Tab A, `Ari` clicks `Spark` on `Blaze`. Lightning streak animates across the screen.
4. **0:22** — In Tab B, `Blaze` clicks `Start Working`. Card glows cyan in both tabs in real time.
5. **0:30** — `Blaze` clicks `Mark Done`.
6. **0:35** — In Tab A, `Ari` holds `Vouch` for 600ms. Stamp animation lands.
7. **0:40** — **Crowning Ceremony fires.** Crown drops on `Blaze`. Confetti.
8. **0:45** — Leaderboard shows `Blaze` with crown at `#1`, `Ari` at `#2` for the voucher bonus.
9. **0:55** — Tab A self-starts on `Ari`, races through Working → Done. Tab B vouches.
10. **1:10** — Crown handoff animation as `Ari` overtakes. Handoff explicitly demonstrates: leader is dynamic.
11. **1:20** — Wrap.

---

## 10. Scope and Non-Goals

### In scope (Hackathon MVP)

- Single tribe, 4 hardcoded demo users.
- No authentication; current user via dropdown.
- Real-time updates via Supabase Realtime.
- Pre-Tribe state and Crowning Ceremony.
- All XP rules, plus First Mover, Chain Spark, Crowd Vouch.
- Tribe Pulse with 4 intensity levels.
- Hold-to-vouch interaction.
- Reduced-motion accessibility fallback.

### Out of scope (post-hackathon)

- Multiple concurrent tribes.
- Account creation, login, invites.
- Push or email notifications.
- Mobile-native app.
- Persistent multi-day rounds, seasonal resets, historical leaderboards.
- Admin tools, moderation.
- Localization beyond English.

---

## 11. Success Criteria

The MVP succeeds if all of the following are visibly true in the live demo:

- The app opens in Pre-Tribe state with **no crown** rendered anywhere.
- The first vouched task triggers the **Crowning Ceremony** exactly once per session.
- All four base XP rules are demonstrably reflected in the UI via toasts and leaderboard updates.
- Tribe Pulse intensity changes within 5 seconds of relevant activity changes.
- Crown handoff occurs when XP rankings flip; no stale crown.
- A user cannot vouch their own task; UI prevents the action.
- All hero animations respect `prefers-reduced-motion`.
- Two-tab real-time demo works without manual refresh.

---

## 12. Open Questions and Future Hooks

- Should leadership be **locked** for the duration of a "round" or always live? Currently spec'd as live.
- Should Chain Spark streaks decay over time, or only reset on user action?
- Add a per-session "round timer" that ends with a final leaderboard freeze and a winner banner?
- Should the Crowning Ceremony repeat (smaller) every time the leader changes, or only the very first time? Currently: full ceremony first time, faster handoff thereafter.
- Sound design: zap, stamp, fanfare. On/off toggle in header.
- Future: per-user emoji avatars and a "trophy room" of past leaders.

---

## 13. Glossary

- **Tribe** — the group of members sharing the same arena.
- **Tribe Member** — every user; default role.
- **Tribe Leader** — derived role: current top XP after first verified task.
- **Spark** — a nudge issued by one idle-teammate-watcher onto an idle teammate.
- **Vouch** — peer verification of a teammate's `done` state.
- **Tribe Pulse** — the ambient background mood reflecting group activity.
- **Crowning Ceremony** — the hero animation when the first leader emerges.
