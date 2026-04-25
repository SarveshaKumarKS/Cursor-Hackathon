# Tribe Leader

> Group accountability turned into a live arena. The crown is earned, not assigned.

A real-time, gamified accountability tool for small groups. No leader is assigned —
the very first vouched task triggers the **Crowning Ceremony**, and the crown
dynamically follows whoever currently holds the most XP.

The v4 release adds a persistent **project board**, **calendar-aware** Spark /
Challenge gating, and a **Coach strip** that tells each player the right action
right now. v6 layers on **Pass & Pick Up**: any assignee who can't deliver can
drop their task into a public bounty pool, and a free teammate can step up to
claim it for an extra one-shot **Stepped Up** XP bonus.

## Stack

- React 19 + Vite
- Tailwind CSS v4
- Supabase (Postgres + Realtime)
- Vanilla CSS keyframes for hero animations
- WebAudio for spark / vouch / crown sounds

## Quick start

1. Install deps:
   ```bash
   npm install
   ```
2. Set env vars in `.env`:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
3. In the Supabase SQL editor (or via the Supabase MCP), apply the migrations
   in order:
   - `supabase/tribe_leader_schema.sql` — base table + 4 demo members.
   - `supabase/tribe_leader_v2.sql` — Pre-Tribe meta, First Mover, Spark
     cooldown, Spark streak, Crowd Vouch, `reset_tribe_session()` RPC.
   - `supabase/tribe_leader_v3.sql` — combo multiplier, challenge mechanic,
     `tribe_events` log.
   - `supabase/tribe_leader_v4.sql` — projects, tasks, member availability,
     and the calendar-aware RPCs (`create_project_with_tasks`, `accept_task`,
     `start_task`, `complete_task`, `vouch_task`, `archive_project`,
     `set_availability`).
   - `supabase/tribe_leader_v5.sql` — `create_project_with_tasks` now claims
     the active slot when none is set, so a freshly launched project is
     immediately visible to assignees.
   - `supabase/tribe_leader_v6.sql` — Pass & Pick Up bounty system:
     `bounty_xp` / `passed_at` / `passed_by` / `original_assignee_id` columns
     plus `pass_task` and `claim_task` RPCs. `reset_tribe_session()` zeroes
     bounty state and restores the original assignee on rewind.
4. Start the app:
   ```bash
   npm run dev
   ```
5. Open in two browser tabs side by side. Switch the **Current User**
   dropdown in each tab to drive the demo.

## Project flow (v4)

1. **Set availability.** From the header click `Availability` and add weekly
   slots per weekday (e.g. Sat 14:00–17:00). This is recurring; tasks must be
   scheduled inside availability to feel "Open" to the player.
2. **Create a project.** Click `+ New project` to launch the 4-step wizard:
   1. Name + kind (`cleaning` / `coding` / `gym` / `custom`) + goal.
   2. Pick a template and edit the task list.
   3. Per task: pick assignee, scheduled start/end, deadline.
   4. Review & launch — the project enters `planning`, tasks land as `proposed`.
3. **Accept, Pass, or Decline tasks.** Each member sees their proposed task on
   their own card with three verbs:
   - **Accept** — own it.
   - **Pass** — drop it into the public bounty pool with a stacking **+10 XP**
     bonus (capped at +30). The task becomes an orphan visible in the **Up
     for grabs** rail at the top of the board.
   - **Decline** — kill it for this run. No bounty, slot is forfeit.

   When all proposed tasks are resolved, the project flips to `active` and is
   set as the tribe's `active_project_id`. Passing during `accepted` or
   `working` is also supported via the small `↻ Pass it` link on the card.
4. **Live windows.** Each task has a window. The state machine drives Spark,
   Challenge, Cheer eligibility — see below.
5. **Verify.** Tasks go `working → done → verified`. When the last task is
   verified, `vouch_task` returns `out_project_completed: true` and the
   **Project Won** ceremony fires. Click `Archive` to clear the slot for a new
   project.

## Calendar-aware eligibility

Per teammate target T at time `now`:

```
Asleep   — outside T's availability or scheduled window.
           Spark / Challenge LOCKED. Card visually dimmed (zzz).
Grace    — first 20% of the window. Spark LOCKED to protect Self-Starter XP;
           T's own card glows with a strong "Self-start now" CTA.
Open     — grace elapsed, T still idle. Spark UNLOCKED (subject to 60s actor
           cooldown).
Late     — window progress ≥ 70% and T still idle. Challenge UNLOCKED
           (+25 XP if challenged-and-vouched in time). Card pulses red-orange.
Working  — T pressed Start. Spark/Challenge no longer relevant.
Done     — T pressed Mark Done. Vouch available to anyone but T.
Verified — at least one vouch. Counts toward project completion.
```

Cheer is allowed in any non-Asleep state (5s cooldown). All buttons display
their current lock reason and a countdown — e.g. `Spark unlocks 0:24` or
`Asleep · Tue 6:00pm`. The complete decision logic lives in
[`src/lib/eligibility.js`](src/lib/eligibility.js) — pure, no React, easy to
unit-test.

## Coach strip

A horizontal pill row above the board surfaces up to **3 ranked hints** for the
current user, generated by [`src/lib/coach.js`](src/lib/coach.js):

- `Window open. Self-start now for +10 XP.`
- `Spark unlocks for Ari in 0:24`
- `Blaze finished Vacuum — vouch them!`
- `Cyra is off until Tue 6:00pm`

Click an actionable pill to scroll to the relevant card and (where applicable)
trigger the action.

## XP rules

| Event | XP |
| --- | --- |
| Self-Starter (idle → working without spark, then vouched) | **+70** |
| Sparked Worker (idle → working after spark, then vouched) | **+40** |
| Successful Spark Issuer | **+30** |
| Voucher | **+15** |
| Crowd Vouch Bonus (2+ vouches on same task within 30s) | **+5** |
| Successful Challenge (challenged-and-vouched in time) | **+25** |
| Stepped Up bounty (claim and complete an orphan, per-pass) | **+10** (cap +30) |

XP is multiplied by the live tribe combo multiplier when actions land in quick
succession.

## Anti-cheese

- A user cannot vouch their own task (UI hides the action).
- Re-Sparking the same idle teammate within 60s is a no-op.
- **Spark is locked during a teammate's grace period** so it cannot be used
  to deny their Self-Starter XP.
- **Spark is locked while a teammate is Asleep** (outside availability or
  before their scheduled window starts) — even if the project is active.
- XP is awarded only at vouch time.
- **Pass-then-claim-back is blocked.** Once a player passes a task they are
  recorded in `passed_by` and the DB rejects any attempt by the same player
  to claim that task — bounty farming via self-pass is impossible.

## Tribe Pulse

The whole-page background reflects group activity:

- `dormant` — no activity in last 5 minutes.
- `awakening` — at least one member just changed state.
- `active` — 2+ members not idle.
- `frenzy` — 3+ state changes within 60 seconds.

## Reset between demo runs

Click the `Reset` button in the header — it calls the
`public.reset_tribe_session()` Postgres function which wipes XP, badges,
the events log, and the Crowning Ceremony state. Project records are kept,
but tasks in the active project rewind to `accepted` (and `current_task_id` is
cleared) so the same project can be replayed without rebuilding it.

## Accessibility

- All hero animations respect `prefers-reduced-motion: reduce`.
- Sound is **off by default**; toggle in the header.
- Status states are conveyed via badge text, not color alone.
- Locked buttons surface their reason as text + tooltip, not just opacity.

## Demo script (90 seconds, two tabs)

1. Tab A picks `Ari`, Tab B picks `Blaze`. Click `Availability` in each and
   add a slot covering "now" (e.g. today, current hour ± 30 min).
2. Tab A: `+ New project` → `Apartment Clean`. Edit task list, assign one task
   to Ari (now → +20 min) and one to Blaze. Launch.
3. Both tabs see proposed tasks on their card → click `Accept`. Project flips
   to `active`, banner appears, Coach strip lights up.
4. Inside the **Grace** window: Ari's card glows "Self-start now". Spark on
   Ari is **locked** with `Spark unlocks 0:24`. Click Start Working before the
   countdown ends → Self-Starter path.
5. Blaze waits past 20% of their window → Spark on Blaze unlocks for Ari.
   Tab A clicks Spark → fuchsia streak. Tab B clicks Start Working.
6. Tab B `Mark Done` → Tab A holds Vouch 600ms → Verified.
7. **Pass beat.** Add a third task assigned to a teammate who's "off" — say
   Cyra. In Cyra's tab click `Pass`. The task slides up into the **Up for
   grabs** rail at the top of the board with a glowing `+10 XP` chip, and
   Battle Log records `Cyra passed the baton on "Trash + recycling"`.
8. **Claim beat.** In Ari's tab the Coach strip now shows
   `"Trash + recycling" is up for grabs — claim for +10 bonus XP`. Click
   `Claim` (or the coach pill). Battle Log records `Ari claimed …` and the
   task drops onto Ari's card as `accepted`.
9. Ari starts → marks done → someone vouches. Worker XP is
   `Self-Starter (+70) + Stepped Up (+10) = +80`, with two stacked toasts.
10. Repeat for the remaining tasks. The final vouch fires **Project Won** —
    confetti, crown, gold streaks. Tab A clicks `Archive`.
11. Click `Reset` to clear XP/log; bounty state is zeroed and original
    assignees are restored, so the same project can be replayed.

## Project structure

```
src/
  App.jsx                       Top-level orchestrator
  components/
    Header.jsx                  Title, Pulse badge, user dropdown,
                                  Sound, Reset, +New project, Availability
    MemberCard.jsx              Fighter portrait, task panel, window badge,
                                  gated Spark/Challenge/Start, hold-to-vouch
    Leaderboard.jsx             Pre-Tribe / Post-Crowning rail
    Toasts.jsx                  Bottom-right XP toast stack
    SparkStreaks.jsx            SVG lightning between cards
    Confetti.jsx                Confetti particles
    CrowningCeremony.jsx        Hero overlay (also Project Won)
    BattleLog.jsx               Live event feed
    ComboMeter.jsx              Tribe combo multiplier
    BackgroundFX.jsx            Animated ember particle field
    CheerReactions.jsx          Floating emoji cheers
    ProjectBanner.jsx           Active project name + progress + archive
    ProjectWizard.jsx           4-step project creation modal
    AvailabilityEditor.jsx      Per-weekday recurring slots editor
    CoachStrip.jsx              Ranked hints row
    TaskAcceptance.jsx          Per-task Accept/Pass/Decline trio inside cards
    OrphanTaskRail.jsx          "Up for grabs" rail with bounty chips + Claim
  lib/
    supabase.js                 Supabase client
    pulse.js                    Pulse computation + class names
    sound.js                    WebAudio tones
    xp.js                       XP rule constants + toast labels (+ Stepped Up)
    avatars.js                  Per-member SVG avatars
    eligibility.js              windowState + canSpark/Challenge/Cheer/Start/Claim
    coach.js                    Ranked coach hints for current user (incl. claim)
    templates.js                Task templates per project kind
    time.js                     Time formatting / weekday helpers
supabase/
  tribe_leader_schema.sql       Base table
  tribe_leader_v2.sql           v2 features + reset RPC
  tribe_leader_v3.sql           Combo + challenge + events log
  tribe_leader_v4.sql           Projects, tasks, availability, calendar RPCs
  tribe_leader_v5.sql           create_project_with_tasks claims active slot
  tribe_leader_v6.sql           Pass / Claim / bounty RPCs + reset extension
```
