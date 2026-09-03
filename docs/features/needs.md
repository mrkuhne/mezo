---
title: Needs
type: feature-domain
status: done
updated: 2026-08-30
tags: [today, ritual, growth, gamification, frontend, data-layer, backend]
key_files:
  - frontend/src/features/today/logic/needs.ts
  - frontend/src/features/today/pages/EletjelPage.tsx
  - frontend/src/data/needs
  - api/feature/needs/needs.yml
  - backend/src/main/java/io/mrkuhne/mezo/feature/needs
related: [today, ritual, _platform-data-layer, growth]
---

# Needs — Életjel-ringek (Sims-style Needs)

> Six real-time decaying "life-sign" rings. Since the Design 2.0 re-face (mezo-d20.2.6) the Nap
> hub carries them as ONE segmented six-arc ring tile, which opens the **Életjel page**
> (`/nap/eletjel`) with a need tile per ring — plus a thin day-close backend slice.
> **Status: ✅ done** (FE pure engine + UI + nudges; backend day-close/summary + progression XP).

## 1. Summary

**Életjel-ringek** ("life-sign rings") is a Sims-like needs system: six metrics — 🍽️ Energia,
💧 Hidratáció, 😴 Pihenés, 💪 Mozgás, 💗 Lélek, ⚡ Rend — decay continuously in real time and
refill from data the app already collects (meals, water, sleep log, workouts/sport/running/
activities, check-ins, morning intention, day-close reflection, habit ticks). The rings feed two
stakes at once: **B** — Mezo's voice (threaded nudges when a ring goes red) and **C** —
gamification (bonus XP + a dedicated streak, evaluated once per day at Napzárás close, not on
every log — logs already earn XP elsewhere, no double-pay).

Driving design spec (the WHY + every tuning number):
[`docs/superpowers/specs/2026-08-17-needs-rings-design.md`](../superpowers/specs/2026-08-17-needs-rings-design.md).
Driving bd issue: `mezo-dhzk`.

Status per layer: **FE pure engine + UI ✅** (deterministic, portable-to-Java-later `needs.ts`
+ `NeedsRow`/`NeedRingSheet` + nudges), **FE real ✅** (`useNeeds` composes existing app hooks,
no new reads except the needs-summary/close pair), **FE mock ✅** (same engine, mock inputs),
**Backend ✅** (`feature/needs/` — day-close snapshot + award + streak, gated
`mezo.feature.needs.enabled`). **Deliberately deferred:** a Java port of the decay model +
server-evaluated push nudges (§9).

## 2. User-facing behavior

- **`NeedsRow`** (`frontend/src/features/today/components/NeedsRow.tsx`) — a frameless row of
  six ring buttons directly under `MezoChip` — the ring's visible outer diameter is 46px, drawn
  into a `PAD`-larger SVG box (`RING`/`PAD` in the component) so neither the stroke's outer edge
  nor the critical halo lands on the viewBox boundary, where antialiasing clipped them flat
  (mezo-1bu2). Wired at
  `frontend/src/features/today/pages/TodayPage.tsx:449`. Renders on **every** daypart, unaffected
  by which daypart is selected — the ring state is daypart-independent, like the message thread.
  No numeric labels on the row itself; each ring's arc = `pct`, color = the ring's own token
  (`NEED_META`, `needs.ts:94-101`), track `var(--divider)`. **Critical band** (`pct < 15`): the
  arc switches to `var(--error-base)` plus a soft pulsing halo (`.td-need-halo`, neutralized
  under the house `todayReducedMotion` pattern — static halo, no pulse). Recomputes on a
  60-second ticker (`useMinuteTick`, §3) — the arc itself animates between recomputes via a CSS
  `stroke-dashoffset` transition, so it never looks like it "jumps."
- **Tap a ring → `NeedRingSheet`** (`frontend/src/features/today/sheets/NeedRingSheet.tsx`,
  opened via `setNeedSheet`/`needSheet` state, `TodayPage.tsx:161,491-497`) — the house `Sheet`,
  identical skeleton for all six rings: a large ring + name + last-fill line + current `%` +
  `−N%/óra`; a forecast strip ("Így **18:10 körül nullázódik**. Egy pohár víz (+12%) ~2 órát ad
  hozzá.", `forecastText`, `NeedRingSheet.tsx:70-80`); a primary CTA — the ring's fastest refill
  action, dispatched by `TodayPage`'s `onNeedCta` (`TodayPage.tsx:189-198`): 🍽️ Energia →
  `LogMealSheet`, 💧 Hidratáció → an immediate `+250 ml` water log, 😴 Pihenés → `SleepLogSheet`,
  💪 Mozgás → `navigate('/train')`, 💗 Lélek → the first fillable check-in slot, ⚡ Rend → **no
  CTA** (`CTA_LABEL` has no `rend` entry — nothing on Today shortcuts a habit tick directly); a
  "MI TÖLTI?" static list of every counting log type + its `%`; a "MA" timeline of today's fill
  events plus a "most" (now) marker, placed proportionally across the day's own wake→bed span.
- **Mezo thread nudges** — a ring crossing into red/critical appends a templated Hungarian bubble
  (`NUDGE_COPY`, `needsNudges.ts:17-24`) to the end of the `MezoChip` thread (`buildMezoMessages`'s
  `nudges` param, `TodayPage.tsx:418-420`) with eyebrow "Életjel" and meta "Életjel-figyelő" —
  same visual family as the demo briefing card, kind `needs-nudge`, no `RefTag` refs. A fresh
  nudge is a **new message id**, so it re-arms the chip's unread coral dot exactly like a new
  briefing/feed message would.
- **Rough day (`?day=rough`)** — the anchor melt hides `NeedsRow` along with the rest of the
  normal panel (anchor mode's early return in `TodayPage` renders before the row).
- **Napzárás recap** — `RitualPage`'s Harvest act (act 5 since `mezo-b3pp.2`, act 4 before it) shows "🛟 N napja életben" from
  `useNeedsSummary()` when the needs streak is > 0 (`HarvestStep.tsx:155-159`) — see §5.

## 3. Architecture & data flow

**One pure TS module is the whole system** — no React, no hooks, no I/O, designed to be ported
1:1 to Java later if push-nudges are ever server-evaluated (§9's deferred item).

```
TodayPage (composition root)
  ├─ useMinuteTick()                 — a `Date` that re-renders once/minute (useMinuteTick.ts)
  ├─ useNeeds(tick)                  — composes existing app hooks → RawNeedsData → needsAt()
  │     ├─ buildNeedsEvents(raw)     — needsInputs.ts: RawNeedsData → Record<NeedKey, NeedEvent[]>
  │     └─ needsAt(now, inputs)      — needs.ts: pure decay/refill/carryover simulation → NeedState[]
  ├─ NeedsRow(states, onOpen)        — presentational, one SVG ring per NeedState
  ├─ NeedRingSheet(state, ...)       — presentational, tap-opened detail
  ├─ deriveNudges(states, ...)       — needsNudges.ts: red/critical crossing → thread bubbles
  │     └─ nudgeSeen.ts              — localStorage "shown today" guard (`shownNudges`/`markNudgeShown`)
  └─ onEnteringRitualAct4: RitualPage calls
        useRitualActions(date).close(ringsOf(states))   — needsInputs.ts's ringsOf(): NeedState[] → wire shape
              mock: applyMockNeedsClose (data/needs/needsHooks.ts)
              real: POST /api/needs/day-close → NeedsController → NeedsService → NeedsDayRepository
                       → (xp > 0) ProgressionService.applyNeeds → recovery LIFE skill XP
```

- **`needs.ts`** (`frontend/src/features/today/logic/needs.ts:277` `needsAt`) — the whole
  system as one pure function of `(now: Date, inputs: NeedsInputs)`. Each ring is simulated
  chronologically from a wake boundary 24h before `now`'s current wake period (baseline 0 there
  — deeper history is negligible under decay + the `× 0.4` carry factor) up through every
  wake/bed crossing and logged event to `now`, clamping to `[0,100]` at every step
  (`simulateRing`, `needs.ts:194-237`). `NEEDS_TUNING` (`needs.ts:55-92`) is the single exported
  constants table — every decay rate, refill amount, band threshold, and the carry factor live
  **only** here; tune the system by editing this object. `forecastZeroAt` (`needs.ts:241-275`)
  projects a ring forward (no future events assumed) up to 24h to find its next zero-crossing for
  the sheet's forecast strip. Wake/bed window math is wrap-aware (`isAwakeAt`/`nextCrossing`,
  `needs.ts:142-157`) — an overnight-awake window (bed < wake) still resolves correctly, the same
  idiom `dayFace.ts` uses.
- **`needsInputs.ts`** (`frontend/src/features/today/logic/needsInputs.ts`) — the
  app-data → `NeedsInputs` adapter. `buildNeedsEvents(raw: RawNeedsData)` (`needsInputs.ts:192`)
  turns a snapshot of already-fetched hook data into per-ring `NeedEvent[]`, one small pure
  function per ring (`mealEvents`, `waterEvents`, `sleepEvent`, `workoutEvents`, `lelekEvents`,
  `rendEvents`) — every source is read defensively, a missing/empty source degrades to an empty
  event list, never a throw (the engine still needs *some* answer before every hook has
  resolved). `ringsOf(states: NeedState[]): NeedsRingsWire` (`needsInputs.ts:205`) does the
  reverse mapping — live ring state → the wire shape the day-close call sends.
- **`useNeeds.ts`** (`frontend/src/features/today/logic/useNeeds.ts`) — composes the app's
  *existing* data hooks (`useSleepGoal`, `useFuelDay` ×2, `useSleep`, `useTrain`, `useRunning`,
  `useActivities` ×2, `useCheckins`, `useIntentionDay` ×2, `useRitualDay`, `useHabitDay` ×2, all
  from `@/data/hooks`, never a per-domain deep import) into `RawNeedsData`, adapts it via
  `buildNeedsEvents`, and calls `needsAt`. **No new read hooks, no new queries** beyond what
  Today already fetched elsewhere on the page. `isPending` reflects **only** the sleep-goal
  read — the one value the sim cannot run without (it anchors the whole wake/bed window); every
  other source degrades to "no events" while pending rather than blocking the render.
- **`useMinuteTick.ts`** (`frontend/src/features/today/logic/useMinuteTick.ts`) — since `mezo-atry`
  a **single module-level clock** behind `useSyncExternalStore`, not a per-mount `setInterval`: one
  60s interval runs while at least one subscriber is mounted, and every consumer gets the SAME
  `Date` instance (so memos over it are stable, and two live consumers can no longer sit up to 60s
  out of phase). Consumers today: `EletjelPage`, `NapHubPage`, `useDayFace` (the shell header) and
  `MezoThreadProvider`.
- **`needsNudges.ts`** (`frontend/src/features/today/logic/needsNudges.ts`) — pure derivation,
  `deriveNudges(states, now, wakeTime, bedTime, shown)` (`needsNudges.ts:65`): the day's shown
  nudges (from `nudgeSeen.ts`) pass through unchanged (`fresh: false`), newly red/critical rings
  not yet shown join as `fresh: true`, unless the current moment is "quiet" (`isQuiet`,
  `needsNudges.ts:50-57`: inside the sleep window, wrap-aware, OR within the first hour after
  wake — a local re-implementation of the wrap-aware minute-of-day check, not exported from
  `needs.ts`, per the brief). The caller (`TodayPage`) persists fresh entries once
  (`markNudgeShown`) and appends `toNudgeMessage(n)` items to the thread via
  `buildMezoMessages`'s `nudges` param.
- **`nudgeSeen.ts`** (`frontend/src/shared/lib/nudgeSeen.ts`) — the localStorage seen-guard,
  keyed **by date** (`mezo.needsnudge.<YYYY-MM-DD>`), mirroring `shared/lib/seenMessages.ts`'s
  idiom exactly: the key goes stale on its own at midnight, no cleanup, every access defensive
  (a thrown `localStorage` — private mode, quota — degrades to "nothing shown yet" rather than
  crashing the screen).

## 4. Data model & API

**FE types** — `NeedKey`/`NeedBand`/`NeedEvent`/`NeedsInputs`/`NeedState`/`NEEDS_TUNING`/
`NEED_META` all live in `needs.ts` (view/logic types, outside `data/types.ts` per the frontend
conventions — this is pure `features/` logic, not a domain type). `RawNeedsData` lives in
`needsInputs.ts`.

**Contract** ([`api/feature/needs/needs.yml`](../../api/feature/needs/needs.yml), tag `Needs` →
generated `NeedsApi`, `NeedsController implements NeedsApi`):

| Method + path | Operation | Returns | Errors |
|---|---|---|---|
| `POST /api/needs/day-close` (`{date, rings}`) | `closeNeedsDay` | `NeedsCloseResponse{date, xpAwarded, greenCount, allGreen, streakDays}` — **idempotent per date**, a repeat call returns the stored result, never double-awards | 400 validation, 409 `NEEDS_NOT_TODAY` |
| `GET /api/needs/summary` | `getNeedsSummary` | `NeedsSummaryResponse{streakDays, lastCloseDate?, lastAllGreen?}` — zeros when no close exists yet | 401 |

`NeedsRings` (wire): six required integers 0–100, one per ring key. FE client
`frontend/src/data/needs/needsApi.ts` (`needsApi.close`/`needsApi.summary`); FE hooks
`frontend/src/data/needs/needsHooks.ts` — `useNeedsSummary()` (a `useDualQuery`, mock and
real-empty both `{streakDays: 0}`) and `applyMockNeedsClose(qc, date, rings)` (the mock mirror of
the backend award rule, lives beside the query key so it is unit-testable and reusable from the
ritual mock arm — `data/` never imports from `features/`, so the three award constants
(`GREEN`/`PER_RING_XP`/`ALL_GREEN_BONUS`, `needsHooks.ts:29-31`) are duplicated local constants
mirroring `mezo.needs.*`, not an import of `NEEDS_TUNING.bands.green`).

**Backend** (`backend/src/main/java/io/mrkuhne/mezo/feature/needs/`, gated
`mezo.feature.needs.enabled` — `FeaturesConfiguration.NEEDS_SWITCH`, off ⇒ 404, no needs beans):
`NeedsController` (thin delegation, ownership from `CurrentUserId`) → `NeedsService.close`/
`.summary` → `NeedsDayRepository`. `NeedsService.close` (`service/NeedsService.java:42-99`)
rejects a non-today date (409 `NEEDS_NOT_TODAY`), is idempotent (an existing row for the date
short-circuits to `mapper.toCloseResponse`, no re-award), otherwise computes `greenCount` (rings
`≥ NeedsProperties.greenThreshold`), `allGreen`, `xp = greenCount × perRingXp + (allGreen ?
allGreenBonusXp : 0)`, and the streak by reading **yesterday's** row (`+1` if it was all-green,
else reset to `1`; no prior row or not-all-green today → `0`). Persists one `NeedsDayEntity`
row, then — if `xp > 0` and the progression gate is available — calls
`ProgressionService.applyNeeds(userId, new NeedsSignal(needsDayId, xp, label, date))`
(`ProgressionService.java:207`), which always routes the XP onto the **`recovery`** LIFE skill
(hardcoded in `applyNeeds`, not the ring key) through the shared idempotent award tail (source
`NEEDS`).

**Table `needs_day`** — one live row per `(created_by, needs_date)`. Migration
[`202608171200_mezo-dhzk_create_needs_day.sql`](../../backend/src/main/resources/db/changelog/1.0.0/script/202608171200_mezo-dhzk_create_needs_day.sql):
UUID PK, `created_by`/`is_deleted` (`OwnedEntity` + `@SQLRestriction`/`@SQLDelete`), `needs_date`,
six `int` ring columns (`ck_` 0–100 each), `green_count`, `all_green`, `xp_awarded`,
`streak_days`, partial unique `uq_needs_day_user_date` on `(created_by, needs_date)`. A second
migration,
[`202608180300_mezo-dhzk_needs_source_type.sql`](../../backend/src/main/resources/db/changelog/1.0.0/script/202608180300_mezo-dhzk_needs_source_type.sql),
additively relaxes the released `level_up_event.source_type` CHECK to admit `'NEEDS'` alongside
`GYM/SPORT/RUN/QUEST/ACTIVITY/HABIT` — the shared progression ledger, not a new table (no
duplicate XP ledger, the `ritual.md` `D6` precedent). `needs_day` is in the `ResetDatabase`
TRUNCATE list (`backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java:40`); test data
via `support/populator/NeedsPopulator.java`.

**Config** (`mezo.needs.*`, `NeedsProperties`, `@Validated`, never `@Value`):
`green-threshold: 60`, `per-ring-xp: 5`, `all-green-bonus-xp: 30` (`application.yml:1004-1007`) —
mirrors `NEEDS_TUNING.bands.green` / the mock award constants; keep the three in sync by hand if
tuning changes (§7).

## 5. Integrations

- **← Fuel** — meal logs (`FuelDay.meals`, both today + yesterday) refill Energia (`mainMeal`
  `+40` / `snack` `+15`, classified off the fuel slot kinds, `fuelConfig.ts:13`); water volume
  (`FuelDay.consumed.water`) is converted to synthetic, evenly-spaced glass events (`+12` each)
  refilling Hidratáció — `needsInputs.ts`'s `waterEvents`/`spacedWaterEvents` place N synthetic
  events across the day rather than reading individual log timestamps (Fuel tracks a volume
  total, not per-glass timestamps).
- **← Me/Sleep** — the latest sleep log entry **sets** Pihenés at wake
  (`hours / goal × 100`, `sleepEvent`, `needsInputs.ts:92-101`); no sleep log for today/yesterday
  → no set event, Pihenés simply keeps decaying (the honest "logging sleep is what rescues it"
  design decision, spec §2).
- **← Train (gym/sport/running) + Growth (activity log)** — a completed gym workout, sport
  session, or run **sets** Mozgás to 100; an activity-log entry **adds** `+25`
  (`workoutEvents`, `needsInputs.ts:105-135`). **Honest gotcha:** gym and run events ARE filtered
  to `{today, yesterday}` (`relevantDays`), but **sport-session events are not** — every session
  in `train.sport.sessions` becomes a `set 100` event regardless of date. A single stale, far-past
  sport session can therefore surface as Mozgás's `lastFill` even when nothing was logged
  recently. This was a deliberate, reasoned-safe choice from review (single-user app, `sport.sessions`
  is a small bounded list, and the ring itself still decays correctly since the *simulation
  window* only looks back 24h from the current wake boundary — a stale event outside that window
  never actually affects `pct`, only the displayed `lastFill` label can look stale). Fixing it
  cleanly needs Train to expose session dates pre-filtered or the adapter to accept a date
  cutoff — filed as a future cleanup, not blocking.
- **← Today/Check-in, Intention, Ritual** — a `done` check-in slot adds `+20` to Lélek; setting a
  morning focus adds `+15`; the evening reflection adds `+25`; **yesterday's** ritual close (if
  `closed && closedAt`) also adds `+25` to Lélek at that instant (`lelekEvents`,
  `needsInputs.ts:151-170`) — the spec's "close × 0.4 carries into tomorrow" rule is realized
  structurally by the engine's own carry transform at the wake boundary, not by this adapter.
- **← Habit** — every `done` habit tick (today + yesterday) adds `+12` to Rend
  (`rendEvents`/`habitEvents`, `needsInputs.ts:172-188`).
- **↔ Ritual** — `RitualPage` (`frontend/src/features/ritual/pages/RitualPage.tsx:44-45,76`)
  snapshots `useNeeds(tickNow)` at a **single stable instant** captured on mount (not a value
  that drifts mid-ritual as the sim decays), and passes `ringsOf(states)` into
  `useRitualActions(date).close(rings)` on **entering the Harvest act** (the same call that closes
  the day and awards the ritual's own HABIT XP) — `frontend/src/data/ritual/ritualHooks.ts:71`
  `close`. The trigger is entry into Harvest, not an ordinal: that act was 4 as built and is **5**
  since `mezo-b3pp.2` inserted the prose-reflection act at 3, with no change to this seam. Real
  mode: the needs award is **best-effort** — `needsApi.close` failures are swallowed so a needs
  outage never blocks the napzárás itself (`ritualHooks.ts:44-53`); a fire-and-forget
  `['needsSummary']` invalidation follows. Mock mode: `applyMockNeedsClose` runs inside the same
  not-yet-closed branch, after the ritual's own award, so it too can never double-fire on a
  re-close (belt-and-braces on top of its own `lastCloseDate` guard). The Harvest act reads
  `useNeedsSummary()` to show "🛟 N napja életben" (§2).
- **→ Growth/Progression** — day-close XP always lands on the **`recovery`** LIFE skill
  (`ProgressionService.applyNeeds`, hardcoded target, not per-ring) through the shared idempotent
  award tail (source `NEEDS`) — see [growth.md](growth.md) for the LIFE skill band this feeds.
- **→ Today** — `NeedsRow` mounts under `MezoChip` on every daypart; nudges append to the same
  thread `MezoChip`/`MezoMessagesSheet` render — see [today.md §1](today.md#1-summary)/
  [§2](today.md#2-user-facing-behavior).
- **Shared UI consumed:** the house `Sheet` (`NeedRingSheet`), `--dv-*`/`--accent-base` data-viz
  color tokens (`NEED_META`), `--error-base` (critical band), the `todayReducedMotion` guard
  pattern (critical-band halo).

## 6. How to use it (consume)

```ts
// The engine — pure, no I/O:
import { needsAt, NEEDS_TUNING, type NeedState } from '@/features/today/logic/needs'
const states: NeedState[] = needsAt(new Date(), { wakeTime, bedTime, events })

// The live composition (React):
import { useNeeds } from '@/features/today/logic/useNeeds'
import { useMinuteTick } from '@/features/today/logic/useMinuteTick'
const tick = useMinuteTick()
const { states, isPending } = useNeeds(tick)

// Nudges:
import { deriveNudges, toNudgeMessage } from '@/features/today/logic/needsNudges'
import { shownNudges, markNudgeShown } from '@/shared/lib/nudgeSeen'

// The day-close snapshot + streak read — go through @/data/hooks, never needsApi directly:
import { useNeedsSummary, useRitualActions } from '@/data/hooks'
import { ringsOf } from '@/features/today/logic/needsInputs'
await useRitualActions(date).close(ringsOf(states))   // rings is optional — close() alone still closes the day
```

`NeedsRow`/`NeedRingSheet` are pure presentational components — pass them `NeedState[]`/
`NeedState` plus callbacks, no hooks inside either (mirrors `MezoChip`'s doctrine). Never import
`needsApi`/`needsHooks` internals directly from a component — go through `@/data/hooks` for
`useNeedsSummary`; `ringsOf`/`buildNeedsEvents` are logic helpers, imported directly from
`features/today/logic/needsInputs`, same as any other pure `logic/` module.

## 7. How to extend it

- **Add a 7th ring:** extend `NeedKey`, add its `RingTuning` to `NEEDS_TUNING.rings` and its
  `NEED_META` entry (`needs.ts`), add a refill amount to `NEEDS_TUNING.refill` if it has a
  portioned fill, write the adapter function in `needsInputs.ts` (`buildNeedsEvents`), add it to
  `NeedsRingsWire`/`NeedsRings` in **both** `api/feature/needs/needs.yml` (contract-first) and
  regenerate (`cd api/generate && npm run generate:api`), add its column to `needs_day`
  (new Liquibase changeset, never modify the two released ones), and extend `NeedsService.close`'s
  `values[]`/`NeedsDayEntity`/`NeedsMapper`. Table-test the new ring in `needs.test.ts` (decay,
  band edges) and `needsInputs.test.ts` (adapter mapping + malformed-input safety).
- **Change tuning:** edit `NEEDS_TUNING` in `needs.ts` — it is the **single** source of every
  number in the spec's §2 table. If a threshold/award number also has a backend mirror
  (`green-threshold`/`per-ring-xp`/`all-green-bonus-xp` in `application.yml`'s `mezo.needs.*`, and
  the duplicated `GREEN`/`PER_RING_XP`/`ALL_GREEN_BONUS` constants in
  `frontend/src/data/needs/needsHooks.ts`), update all three by hand — there is no shared import
  across the `data/`↔`features/` boundary or the FE↔BE boundary for these (documented drift,
  §4/§9).
- **Port the decay model to Java** (deferred, §9): `needs.ts` was written to be portable 1:1 —
  the whole engine is `(now, inputs) → NeedState[]`, no closures over React/browser state, one
  constants table. When push-nudges need server-side evaluation, translate `needs.ts` +
  `needsInputs.ts`'s adapter logic into a Java service reading the same domain sources
  server-side, keep `NEEDS_TUNING`'s numbers as the single source of truth to port from.
- House standards: contract-first (`docs/references/api_contract_conventions.md`), backend per
  `docs/references/*.md`, dual-mode hook recipe in
  [`_platform-data-layer.md`](_platform-data-layer.md).

## 8. Testing

- **Model unit tests** (`frontend/src/features/today/logic/needs.test.ts`) — `bandOf` edges,
  additive refill + awake decay, refill clamp at 100, night slowdown, `sleepSet` scaling, flat
  24/7 decay (Mozgás), `carry` transform (Lélek/Rend), the `zeroAt` forecast (incl. crossing
  wake/bed boundaries within the horizon), `ratePerHour`, `lastFill`, `todayFills`, and the
  top-level `needsAt` composition.
- **Adapter tests** (`frontend/src/features/today/logic/needsInputs.test.ts`) — one `describe`
  per ring's `buildNeedsEvents` mapping (meals, water, sleep, workouts+activity, check-ins+
  intention+ritual, habit ticks), `ringsOf`'s wire mapping, and a dedicated "malformed/missing
  sources never throw" suite (the defensive-adapter contract).
- **Live-composition test** (`frontend/src/features/today/logic/useNeeds.test.tsx`) — mock-mode
  hook composition end to end.
- **Component tests** — `frontend/src/features/today/components/NeedsRow.test.tsx` (6 rings
  render, correct arcs/colors, critical pulse + reduced-motion static fallback, tap opens the
  right sheet) and `frontend/src/features/today/sheets/NeedRingSheet.test.tsx` (CTA routing per
  ring, forecast strip, MI TÖLTI?/MA sections).
- **Nudge tests** (`frontend/src/features/today/logic/needsNudges.test.ts`) — threshold crossing,
  the shown-set passthrough, quiet-window suppression (sleep + first hour after wake),
  `toNudgeMessage` shape.
- **Needs-hooks tests** (`frontend/src/data/needs/needsHooks.test.tsx`) — `useNeedsSummary` mock
  + real, `applyMockNeedsClose`'s award/streak/idempotency rules.
- **Ritual-integration coverage** — `frontend/src/data/ritual/ritualHooks.test.tsx` asserts the
  `close(rings)` → `NEEDS_CLOSE` gamification event wiring and that omitting `rings` never fires
  it.
- **Backend ITs** (`backend/src/test/java/io/mrkuhne/mezo/feature/needs/`, extend
  `ApiIntegrationTest`/`AbstractIntegrationTest` + real Postgres, data via `NeedsPopulator`):
  `NeedsApiIT` — the full award matrix (`testCloseNeedsDay_shouldAwardZeroXp_whenNoRingGreen`,
  `...shouldAwardPerRingXp_whenThreeGreen`, `...shouldAwardBonus_whenAllGreen`,
  `...shouldContinueStreak_whenYesterdayAllGreen`, `...shouldResetStreak_whenNotAllGreen`,
  `...shouldBeIdempotent_whenCalledTwice`, `...shouldReject_whenNotToday`,
  `...shouldReject_whenRingOutOfRange`, `testGetNeedsSummary_shouldReturnZeros_whenNoClose`,
  `...shouldReturnLatest_whenCloses`); `NeedsEntityIT` — DDL round-trip + the
  `(created_by, needs_date)` unique index (`testSave_shouldRoundTrip_whenValidRow`,
  `testUniqueIndex_shouldReject_whenDuplicateDate`).
- **Gate:** `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`;
  `cd backend && ./mvnw clean test -Dtest='Needs*IT'` locally, full suite in CI.

## 9. Decisions, gotchas & deferred

- **Decision — architecture "hybrid": one pure engine, a thin real backend slice now.** The
  decay/refill model lives in exactly one place (mock mode needs it anyway; real mode needs
  client-side extrapolation between polls) — a Java port is deliberately deferred until
  push-nudges are on the table and the tuning has settled (design spec §1, §8).
  Single-user/owner-only app → trusting client-computed ring values at day-close is an accepted
  trade (design spec, "Architecture" decision).
- **Decision — award at day-close, not per-log.** Logs already earn XP elsewhere (meal logging,
  habit ticks, etc.); rewarding "keeping the rings alive" at Napzárás avoids double-paying the
  same signal (design spec decision 5).
- **Gotcha — sport-session events are not day-filtered (§5).** `needsInputs.ts`'s `workoutEvents`
  filters gym and run completions to `{today, yesterday}` but maps **every** entry in
  `train.sport.sessions` unconditionally — a far-past sport session can surface as Mozgás's
  `lastFill` even with no recent activity. Reasoned-safe (the 24h simulation window means it
  cannot inflate `pct`, only the displayed label), not yet cleaned up.
- **Gotcha — three independent copies of the award numbers.** `NEEDS_TUNING.bands.green`
  (`needs.ts`), `mezo.needs.*` (`application.yml`/`NeedsProperties`), and the local
  `GREEN`/`PER_RING_XP`/`ALL_GREEN_BONUS` constants in `frontend/src/data/needs/needsHooks.ts`
  all encode the same `60`/`5`/`30` — the `data/` ↔ `features/` import boundary and the FE ↔ BE
  boundary both block a single source of truth here. A tuning change must edit all three by hand
  (§7).
- **Deferred (design spec §8, out of scope for this slice):** a Java-side decay model +
  server-evaluated push nudges (waits for tuning to settle); a streak-saver integration for the
  needs streak (any close below all-green resets to 0 today, no grace); any avatar visual beyond
  the six rings (a plumbob-style avatar was explored and not chosen); AI-generated nudge copy
  (Phase 3 can take over `needsNudges.ts`'s trigger point without touching `NeedsRow`/
  `NeedRingSheet`).

## 10. Key files

- **FE engine** (`frontend/src/features/today/logic/`): `needs.ts` (the pure decay/refill sim,
  `NEEDS_TUNING`) · `needsInputs.ts` (`buildNeedsEvents`/`ringsOf`, the app-data adapter) ·
  `useNeeds.ts` (live composition) · `useMinuteTick.ts` (the 60s ticker) · `needsNudges.ts`
  (`deriveNudges`/`toNudgeMessage`).
- **FE UI:** `frontend/src/features/today/components/NeedsRow.tsx` ·
  `frontend/src/features/today/sheets/NeedRingSheet.tsx` · `frontend/src/shared/lib/nudgeSeen.ts`
  (the localStorage seen-guard).
- **FE data** (`frontend/src/data/needs/`): `needsApi.ts` (REST client) · `needsHooks.ts`
  (`useNeedsSummary`, `applyMockNeedsClose`) — barrel-exported from `data/hooks.ts`.
- **Contract:** `api/feature/needs/needs.yml` (tag `Needs`, 2 endpoints, `NeedsRings`/
  `NeedsCloseRequest`/`NeedsCloseResponse`/`NeedsSummaryResponse`).
- **Backend** (`backend/src/main/java/io/mrkuhne/mezo/feature/needs/`): `controller/
  NeedsController.java` · `service/NeedsService.java` (award + streak rule) · `entity/
  NeedsDayEntity.java` · `repository/NeedsDayRepository.java` · `mapper/NeedsMapper.java` ·
  `config/NeedsProperties.java` (`mezo.needs.*`). Switch:
  `FeaturesConfiguration.NEEDS_SWITCH`. Consumes `io.mrkuhne.mezo.feature.progression.needs.
  NeedsSignal` → `ProgressionService.applyNeeds` (the `recovery` LIFE skill route).
- **Migrations:** `backend/src/main/resources/db/changelog/1.0.0/script/
  202608171200_mezo-dhzk_create_needs_day.sql` (`needs_day` table) ·
  `202608180300_mezo-dhzk_needs_source_type.sql` (`level_up_event.source_type` CHECK += `NEEDS`).
  Message: `NEEDS_NOT_TODAY` in `messages.properties`.
- **Ritual integration:** `frontend/src/features/ritual/pages/RitualPage.tsx` (snapshots
  `useNeeds`, calls `close(ringsOf(states))` on entering the Harvest act — act 5 since
  `mezo-b3pp.2`) ·
  `frontend/src/data/ritual/ritualHooks.ts` (`close(rings?)`) ·
  `frontend/src/features/ritual/components/HarvestStep.tsx` (`useNeedsSummary` recap line).
- **Tests:** `frontend/src/features/today/logic/{needs,needsInputs,useNeeds,needsNudges}.test.{ts,tsx}`
  · `frontend/src/features/today/components/NeedsRow.test.tsx` ·
  `frontend/src/features/today/sheets/NeedRingSheet.test.tsx` ·
  `frontend/src/data/needs/needsHooks.test.tsx` ·
  `backend/src/test/java/io/mrkuhne/mezo/feature/needs/{NeedsApiIT,NeedsEntityIT}.java` ·
  `backend/src/test/java/io/mrkuhne/mezo/support/populator/NeedsPopulator.java`.
- **Docs:** spec
  [`docs/superpowers/specs/2026-08-17-needs-rings-design.md`](../superpowers/specs/2026-08-17-needs-rings-design.md).
