# Tribe Leader

> Group accountability turned into a live arena. The crown is earned, not assigned.

A real-time, gamified accountability tool for small groups. No leader is assigned —
the very first vouched task triggers the **Crowning Ceremony**, and the crown
dynamically follows whoever currently holds the most XP.

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
3. In the Supabase SQL editor (or via the Supabase MCP), apply both migrations
   in order:
   - `supabase/tribe_leader_schema.sql` — base table + 4 demo members.
   - `supabase/tribe_leader_v2.sql` — v2 features (Pre-Tribe meta, First Mover,
     Spark cooldown, Spark streak, Crowd Vouch, `reset_tribe_session()` RPC).
4. Start the app:
   ```bash
   npm run dev
   ```
5. Open in two browser tabs side by side. Switch the **Current User**
   dropdown in each tab to drive the demo.

## Demo flow (PRD §9)

1. Both tabs land in **Pre-Tribe state** (no crown anywhere).
2. Tab A picks `Ari`. Tab B picks `Blaze`.
3. Tab A sparks `Blaze` — fuchsia lightning streak across the screen.
4. Tab B clicks `Start Working` — cyan glow ring on the card in real time.
5. Tab B clicks `Mark Done`.
6. Tab A holds the gold `Vouch` button for 600ms — the ring fills and slams a
   `VERIFIED` stamp.
7. **Crowning Ceremony** fires once: crown drops, confetti, gold streaks
   converge from every card on the new leader.
8. Subsequent leader changes use the faster **Crown Handoff** animation.

## XP rules

| Event | XP |
| --- | --- |
| Self-Starter (idle → working without spark, then vouched) | **+70** |
| Sparked Worker (idle → working after spark, then vouched) | **+40** |
| Successful Spark Issuer | **+30** |
| Voucher | **+15** |
| Crowd Vouch Bonus (2+ vouches on same task within 30s) | **+5** |

## Anti-cheese

- A user cannot vouch their own task (UI hides the action).
- Re-Sparking the same idle teammate within 60s is a no-op (button shows
  `Sparked (Ns)` countdown).
- XP is awarded only at vouch time.

## Tribe Pulse

The whole-page background reflects group activity:

- `dormant` — no activity in last 5 minutes.
- `awakening` — at least one member just changed state.
- `active` — 2+ members not idle.
- `frenzy` — 3+ state changes within 60 seconds (animated cyan + fuchsia sweep).

## Reset between demo runs

Click the `Reset` button in the header — it calls the
`public.reset_tribe_session()` Postgres function which wipes XP, badges,
and the Crowning Ceremony state.

## Accessibility

- All hero animations respect `prefers-reduced-motion: reduce`.
- Sound is **off by default**; toggle in the header.
- Status states are conveyed via badge text, not color alone.

## Project structure

```
src/
  App.jsx                  Top-level orchestrator
  components/
    Header.jsx             Title, Pulse badge, user dropdown, Sound + Reset
    MemberCard.jsx         Fighter portrait + state animations + hold-to-vouch
    Leaderboard.jsx        Pre-Tribe / Post-Crowning rail
    Toasts.jsx             Bottom-right XP toast stack
    SparkStreaks.jsx       SVG lightning between cards
    Confetti.jsx           Confetti particles
    CrowningCeremony.jsx   Hero overlay
  lib/
    supabase.js            Supabase client
    pulse.js               Pulse computation + class names
    sound.js               WebAudio tones
    xp.js                  XP rule constants + toast labels
supabase/
  tribe_leader_schema.sql  Base table
  tribe_leader_v2.sql      v2 features + reset RPC
```
