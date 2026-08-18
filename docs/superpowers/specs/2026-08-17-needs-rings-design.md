# Életjel-ringek (Sims-style needs) — 6 real-time decaying rings on Today — design

**Date:** 2026-08-17 · **Driving issue:** `mezo-dhzk` ·
**Status:** approved by Daniel (brainstorm 2026-08-17; UI validated in browser companion,
mockups in `.superpowers/brainstorm/40327-1786975811/content/`)

## Context

Daniel wants a Sims-like "needs" system: the user keeps a personal avatar alive by logging
events. Six metrics decay continuously in real time; logging refills them. The visual surface
is **6 progress rings on the Today screen, on every daypart, directly under the `MezoChip`**.
The system must feel realistic — e.g. eating happens 2–3×/day, so the meal-driven ring must
drain to zero on that cadence.

Everything the rings need already exists as loggable, dual-mode data: meals + water (fuel),
sleep log, workouts/sport/running/activities, check-ins, morning intention, day-close ritual,
habit ticks. XP awarding in real mode is **backend-only** (`gamificationStore.ts` is mock-only
by design, `mezo-huzd`), which forces a small backend slice for the reward part.

## Decisions (brainstorm, in order)

1. **Stakes = B + C** — the rings feed Mezo's voice (nudges in the companion thread) AND are
   gamified (XP + streak), not a purely visual mirror.
2. **The six rings** (house data-viz colors; each with a different natural rhythm):
   🍽️ Energia (sage `--dv-sage`, Fuel) · 💧 Hidratáció (`--dv-sky`) · 😴 Pihenés (`--dv-lav`,
   Sleep) · 💪 Mozgás (`--dv-coral`, Train) · 💗 Lélek (`--dv-rose`) · ⚡ Rend (arany
   `--accent-base`).
3. **Refill model C — mixed, per ring:** additive where reality comes in portions (meals,
   water, soul-acts, habit ticks); set-to-level where the event is singular (sleep log scales
   by hours; a workout fills Mozgás to 100).
4. **Night model B — realistic, per ring:** Energia/Hidratáció decay slowed overnight; Pihenés
   is *set* by the sleep log at wake and doesn't decay at night; Mozgás decays flat 24/7;
   Lélek/Rend carry over `close × 0.4` into the next morning (good days roll forward).
5. **Gamification A — evaluated at day-close (napzárás):** keeping rings alive is rewarded,
   not the act of logging (logs already earn XP elsewhere; no double-pay). Green rings at
   ritual close → per-ring XP; all six green → "Életben tartva" bonus + its own streak.
6. **Mezo voice A — FE-local templated nudges** injected into the companion thread via
   `buildMezoMessages`; deterministic, anti-spam rules; Phase-3 AI can later take over the
   same trigger point.
7. **Architecture — hybrid ("the cheap half of the backend option now"):** the decay/refill
   model lives in exactly ONE place, a pure TS module (mock mode needs it anyway; real mode
   needs client-side extrapolation between polls). The backend gets a small, real slice
   immediately: a day-close snapshot endpoint that stores the client-computed ring values,
   awards the bonus XP server-side via the existing `GamificationService`, and owns the
   streak (no localStorage truth for anything persistent/rewarding). Single-user, owner-only
   app → trusting client-computed values is acceptable. A Java decay model is deliberately
   deferred until push-nudges are on the table and the tuning has settled.

## §1 The model — one pure TS module

`frontend/src/features/today/logic/needs.ts` — no React, no hooks, no I/O. Designed to be
portable 1:1 to Java later.

- **`NEEDS_TUNING`** — a single exported constants table holding every number in §2
  (decay rates per window, refill values, band thresholds, carryover factor, night slowdown).
  Live-tuning happens here and only here.
- **`needsAt(now: Date, inputs: NeedsInputs): NeedState[]`** — the whole system as one pure
  function. `NeedsInputs` carries plain, hook-agnostic data: timestamped refill events per
  ring for today + yesterday (2-day lookback), last night's sleep hours + goal, the sleep
  goal's wake/bed anchors, and the last workout timestamp within 50h.
- **`NeedState`**: `{ key, emoji, label, color, pct, ratePerHour, zeroAt: Date | null,
  band: 'green' | 'yellow' | 'red' | 'critical', lastFill?: { at, label, amount } }`.
- **Carryover recursion is truncated at 2 days:** yesterday's close (needed for Lélek/Rend
  `× 0.4`) is computed from yesterday's events with zero carry-in — the `× 0.4` factor makes
  the deeper past's error geometrically negligible.
- The "awake window" is the sleep goal's wake→bed span (the `dayFace.ts` anchor; mock:
  06:45–23:15), reusing its degenerate-anchor guard behavior.

## §2 Tuning — the numbers (initial, all in `NEEDS_TUNING`)

All rings 0–100%. Decay is per-hour, piecewise by awake/asleep window.

| Ring | Fills | Awake decay | Night rule | Daily arithmetic |
|---|---|---|---|---|
| 🍽️ Energia | main meal log +40, snack +15 | −6/h | −2/h | 3 meals (+95) ≈ 17 awake-h × 6; wake ~30%, hungry again ~6h after a meal |
| 💧 Hidratáció | glass (+250 ml) +12 | −6/h | −2/h | ~8 glasses/day keep it alive; half a day without → critical |
| 😴 Pihenés | sleep log **sets** at wake: `hours / goal × 100` (goal 8h: 8h=100, 6h=75) | −5/h | none (asleep) | reaches ~15–20% by bed — the loop closes |
| 💪 Mozgás | workout/sport/run log → **set 100**; activity log +25 | −2/h | −2/h | full→zero in ~48h — the every-other-day training rhythm |
| 💗 Lélek | check-in +20, morning intention +15, day-close/reflection +25 | −5/h | at wake: `close × 0.4` | ~85% close → next morning starts ~34%, with an earned head start |
| ⚡ Rend | habit tick +12 each | −4/h | at wake: `close × 0.4` | the two chains (~8 ticks) top it out; a skipped day hurts tomorrow too |

**Bands:** 🟢 ≥60 · 🟡 30–59 · 🔴 <30 · **critical** <15 (pulsing halo).
Refills are capped at 100. Meal classification uses the fuel model's existing slot kinds
(`frontend/src/data/fuel/fuelConfig.ts:13` — `SLOT_WEIGHT`): `main` and `postWorkoutMain`
→ +40, `snack` → +15.

**Missing sleep log:** without a last-night sleep record, Pihenés gets no morning set and
simply keeps decaying — logging sleep is what rescues it (honest, motivating; in real mode
`useSleep().lastNight` typically exists).

## §3 UI

Validated in the browser companion (variant **A** + approved sheet):

- **`NeedsRow`** (`features/today/components/NeedsRow.tsx`) — frameless row of 6 rings
  directly under `MezoChip`, rendered on **every daypart** (and unaffected by daypart
  selection). No labels, no numbers: emoji inside a ~46px SVG ring, arc color = the ring's
  domain color, track `rgba(43,33,24,.08)`-equivalent token. **Critical state:** arc turns
  `--error-base` + a soft pulsing halo (reduced-motion: static halo, no pulse — house
  `todayReducedMotion` pattern). Recompute on a 1-minute ticker (wind-down ticker idiom);
  the arc animates between recomputes with a CSS transition.
- **`NeedRingSheet`** (`features/today/sheets/NeedRingSheet.tsx`) — tap any ring → house
  `Sheet` with the approved skeleton, identical for all six: header (large ring + name +
  last fill + current % + `−N%/óra`), forecast strip ("Így **18:10 körül nullázódik**. Egy
  pohár víz (+12%) ~2 órát ad hozzá."), primary CTA (the ring's fastest refill action:
  water → immediate `useWaterActions` log; Energia → LogMealSheet; Mozgás → `/train` link;
  Lélek → first fillable check-in slot; Rend → nothing to shortcut, CTA hidden), "Mi tölti?"
  list (every counting log type with its +%), "Ma" timeline (today's refill events + now
  marker).
- **Rough day (`?day=rough`)**: the anchor melt hides NeedsRow along with everything else
  (anchor mode renders before it — guard order unchanged).
- Skeleton: `TodaySkeleton` gains a matching 6-circle placeholder row.

## §4 Mezo nudges

`features/today/logic/needsNudges.ts` — pure derivation + a localStorage seen-guard
(`mezo.needsnudge.<YYYY-MM-DD>` → set of ring keys, the `seenMessages.ts` idiom).

- **Trigger:** a ring crossing below 30% (red). **Max 1 nudge per ring per day.**
- **Quiet windows:** none during the sleep window and the first hour after wake.
- **Copy:** deterministic Hungarian templates per ring (e.g. 💧 "Délután van, és ma még alig
  ittál — egy pohár víz feltölti."), one sentence, warm, no guilt-tripping.
- **Delivery:** `buildMezoMessages` accepts the derived nudge items and appends them to the
  companion thread as honestly-labelled local bubbles (same visual family as the demo card's
  `meta` label; kind `needs-nudge`, no refs). The chip's unread dot re-arms on a new nudge
  (it gets a later synthetic id). Phase-3 upgrade path: the backend feed can later emit a
  `needs` kind and the local injection point retires.

## §5 Day-close bonus + streak (the backend slice)

**Contract-first** (`api/feature/needs/needs.yml` → merged; backend implements generated
`NeedsApi`):

- `POST /needs/day-close` — body `{ date, rings: { energia, hidratacio, pihenes, mozgas,
  lelek, rend } }` (0–100 integers). Response `{ xpAwarded, allGreen, streakDays }`.
  **Idempotent per date:** a repeat call returns the stored result, never double-awards.
- `GET /needs/summary` — `{ streakDays, lastCloseDate, lastAllGreen }` for display.

**Award rule (server-side, config via `mezo.needs.*` properties):** each ring ≥60 → **+5 XP**;
all six ≥60 → **+30 XP** extra ("Életben tartva") and `streakDays + 1`; any close below →
streak resets to 0 (streak-saver integration deliberately deferred — tune live first).
XP flows through the existing `GamificationService` so level/coins/toast semantics hold.

**Backend domain** `feature/needs/` per house rules: `needs_day` table (UUID PK,
`created_by`, soft delete, `uq_` on `(created_by, date)`), Liquibase changeset
`{ts}_mezo-dhzk_create_needs_day.sql`, entity + repository + service + controller + MapStruct
mapper, `SystemRuntimeErrorException` codes for invalid input. New table → `ResetDatabase`
TRUNCATE list + a `NeedsDayPopulator`.

**Wiring:** the FE calls day-close from the ritual close flow (the same mutation chain that
closes the day), sending `needsAt(now)` values. Mock mode: `awardGamificationEvent` with a
new `NEEDS_CLOSE` XP event type (xpOverride = the same rule computed locally) + streak kept
in the query cache under the needs-summary key (the needs streak is distinct from the app's
daily-activity streak on the gamification profile). The recap (napzárás) surfaces
"🔥 N napja életben" from the summary.

## §6 Data flow & integration seams

- `TodayPage` (composition root, unchanged philosophy): existing hooks already fetched there
  (fuel day, sleep, train, activities, check-ins, intention, ritual, habits) are adapted into
  `NeedsInputs` by a thin `logic/needsInputs.ts` adapter (pure; unit-testable). **No new read
  hooks, no new queries** except the needs summary/close pair.
- History for lookback: yesterday's events come from the same domains' existing day/history
  hooks; where a domain exposes only "today", the adapter degrades gracefully (documented per
  ring in the plan — worst case a carryover ring starts the morning conservative-low).
- The 1-minute ticker lives in `NeedsRow` (self-contained), not in `TodayPage`.
- Cross-feature consumption stays legal: `ritual` imports the pure model for the close call
  (same pattern as Today importing `progression/logic/rewardToast`).

## §7 Testing

- **Model unit tests** (`needs.test.ts`): decay across awake/night boundaries, wrap-aware
  windows, refill caps, sleep-set scaling, Mozgás 48h drain, carryover ×0.4 + 2-day
  truncation, `zeroAt` forecast, band edges (60/30/15).
- **Adapter tests**: hook-shape → `NeedsInputs` mapping, missing-source degradation.
- **Component tests**: `NeedsRow` renders 6 rings with correct arcs/colors, critical pulse +
  reduced-motion static fallback, tap opens the right sheet; `NeedRingSheet` CTA routing per
  ring; skeleton row.
- **Nudge tests**: threshold crossing, 1/ring/day guard, quiet windows, thread injection +
  unread re-arm.
- **Backend IT** (`ApiIntegrationTest`): day-close award matrix (0/3/6 green), idempotency
  (second call → same result, no double XP), streak increment/reset, validation errors,
  ownership; populator + TRUNCATE registration.
- **Gates:** FE both modes green + build; backend focused ITs locally, full suite in CI.

## §8 Out of scope (explicitly deferred)

- Java-side decay model + server-evaluated push nudges (waits for tuning to settle).
- Streak-saver integration for the needs streak.
- Any avatar visual beyond the rings (the plumbob variant was explored and not chosen).
- AI-generated nudge copy (Phase 3 takes over the §4 trigger point).
