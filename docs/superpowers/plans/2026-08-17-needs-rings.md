# Életjel-ringek (Sims-style needs) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Six real-time decaying "needs" rings (🍽️💧😴💪💗⚡) on the Today screen under the MezoChip, refilled by existing logs, with Mezo nudges in the companion thread and a server-side day-close XP bonus + "Életben tartva" streak.

**Architecture:** The decay/refill model is ONE pure TS module (`needs.ts`) consumed by a presentational `NeedsRow` + `NeedRingSheet` on Today and by the ritual close flow. Nudges are FE-local templated bubbles injected into `buildMezoMessages`. The backend gets a small contract-first `needs` domain: `POST /api/needs/day-close` stores the client-computed snapshot, awards XP via `ProgressionService`, and owns the streak; `GET /api/needs/summary` reads it back.

**Tech Stack:** React 19 + TS + TanStack Query (dual-mode hooks), vitest + RTL; Spring Boot 4 + JPA + Liquibase + MapStruct, OpenAPI contract-first, Testcontainers/fixed-PG ITs.

**Spec:** `docs/superpowers/specs/2026-08-17-needs-rings-design.md` · **Driving bd issue:** `mezo-dhzk` · **Branch:** `claude/sims-metrics-system-357035` (already checked out; commit everything here).

## Global Constraints

- Read `docs/references/frontend_conventions.md` before any `frontend/src` code; `docs/references/{java_package_structure,spring_patterns,error_handling,liquibase_conventions,testing_standards,integration_test_framework,configuration_conventions,api_contract_conventions}.md` before the matching backend/contract work. Non-negotiable house standards.
- Frontend: features import data hooks from `@/data/hooks` ONLY; deep absolute `@/*` imports, no `../`, no new barrels; tests colocated; components presentational, `TodayPage` is the composition root; never introduce a `*Screen`/`*View`.
- Both FE modes must stay green: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`.
- Backend: constructor DI (`@RequiredArgsConstructor`), method-level `@Transactional`, UUID PKs, `OwnedEntity` base (`created_by`, `is_deleted`, `created_at`), soft delete via `@SQLDelete`/`@SQLRestriction`, no `@Value` (use `@Validated` `*Properties` records, auto-bound via `@ConfigurationPropertiesScan`), errors via `SystemRuntimeErrorException` + `SystemMessage.error("CODE")` + `messages.properties`.
- Backend tests: integration-first, `test{Method}_should{Result}_when{Condition}`, AssertJ only, extend `ApiIntegrationTest`/`AbstractIntegrationTest`, data via populators, no mocks/H2. Local runs: `cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true` (this machine's memory rule) — ALWAYS `clean`.
- Contract-first: edit `api/feature/needs/needs.yml` BEFORE code; register in `api/generate/merge.yml`; regen: `cd api/generate && npm run generate:api`, then `cd frontend && pnpm generate:api`; backend Java types regen in `./mvnw generate-sources`/`test`. Never hand-write boundary DTOs.
- Conventional commits carrying the bd id, e.g. `feat(today): needs decay model (mezo-dhzk)`; end every commit message with the `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` trailer.
- Hungarian user-facing copy; code/comments English unless the surrounding file says otherwise.
- All tuning numbers live ONLY in `NEEDS_TUNING` (FE) and `mezo.needs.*` properties (BE) — no magic numbers at call sites.

## File Structure (created → C / modified → M)

```
frontend/src/features/today/logic/needs.ts                 C  pure model: types, NEEDS_TUNING, engine, needsAt
frontend/src/features/today/logic/needs.test.ts            C
frontend/src/features/today/logic/needsInputs.ts           C  pure adapters: hook data → NeedsInputs
frontend/src/features/today/logic/needsInputs.test.ts      C
frontend/src/features/today/logic/useNeeds.ts              C  hook: data hooks → adapter → needsAt
frontend/src/features/today/logic/useNeeds.test.tsx        C
frontend/src/features/today/logic/useMinuteTick.ts         C  60s ticker hook (wind-down idiom)
frontend/src/features/today/logic/needsNudges.ts           C  nudge derivation + templates
frontend/src/features/today/logic/needsNudges.test.ts      C
frontend/src/features/today/logic/mezoMessages.ts          M  accept + append nudge bubbles
frontend/src/features/today/logic/mezoMessages.test.ts     M
frontend/src/shared/lib/nudgeSeen.ts                       C  localStorage day-guard (seenMessages idiom)
frontend/src/shared/lib/nudgeSeen.test.ts                  C
frontend/src/features/today/components/NeedsRow.tsx        C  presentational ring row
frontend/src/features/today/components/NeedsRow.test.tsx   C
frontend/src/features/today/sheets/NeedRingSheet.tsx       C  detail sheet
frontend/src/features/today/sheets/NeedRingSheet.test.tsx  C
frontend/src/features/today/pages/TodayPage.tsx            M  compose: tick, needs, nudges, row, sheet dispatch
frontend/src/features/today/pages/TodaySkeleton.tsx        M  + needs placeholder row
frontend/src/features/today/todayTapTargets.test.ts        M  + .td-need 44px rule
frontend/src/styles/prototype.css                          M  + .td-needs/.td-need block (Today section, EOF)
frontend/src/data/types.ts                                 M  SportSession + isoDate
frontend/src/data/train/trainHooks.ts                      M  toSportSession carries isoDate
frontend/src/data/gamification/gamificationTypes.ts        M  XpEventType + 'NEEDS_CLOSE'
frontend/src/data/gamification/xpValues.ts                 M  XP_VALUES/DAILY_CAPS + NEEDS_CLOSE
frontend/src/data/needs/needsApi.ts                        C  apiFetch wrappers (generated types)
frontend/src/data/needs/needsHooks.ts                      C  useNeedsSummary (dual-mode)
frontend/src/data/needs/needsHooks.test.tsx                C
frontend/src/data/hooks.ts                                 M  re-export useNeedsSummary
frontend/src/data/ritual/ritualHooks.ts                    M  close(rings?) + needs award (both arms)
frontend/src/data/ritual/ritualHooks.test.tsx              M
frontend/src/features/ritual/pages/RitualPage.tsx          M  pass needs snapshot to close()
frontend/src/features/ritual/components/HarvestStep.tsx    M  "🛟 N napja életben" line
api/feature/needs/needs.yml                                C  contract fragment
api/generate/merge.yml                                     M  register fragment
backend/src/main/resources/db/changelog/1.0.0/script/202608171200_mezo-dhzk_create_needs_day.sql  C
backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml                                    M
backend/src/main/java/io/mrkuhne/mezo/feature/needs/entity/NeedsDayEntity.java                    C
backend/src/main/java/io/mrkuhne/mezo/feature/needs/repository/NeedsDayRepository.java            C
backend/src/main/java/io/mrkuhne/mezo/feature/needs/service/NeedsService.java                     C
backend/src/main/java/io/mrkuhne/mezo/feature/needs/controller/NeedsController.java               C
backend/src/main/java/io/mrkuhne/mezo/feature/needs/mapper/NeedsMapper.java                       C
backend/src/main/java/io/mrkuhne/mezo/feature/needs/config/NeedsProperties.java                   C
backend/src/main/java/io/mrkuhne/mezo/feature/progression/needs/NeedsSignal.java                  C
backend/src/main/java/io/mrkuhne/mezo/feature/progression/service/ProgressionService.java         M  applyNeeds
backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java           M  NEEDS_SWITCH
backend/src/main/resources/application.yml                                                        M  switch + mezo.needs
backend/src/main/resources/messages.properties                                                    M  NEEDS_* codes
backend/src/test/java/io/mrkuhne/mezo/support/populator/NeedsPopulator.java                       C
backend/src/test/java/io/mrkuhne/mezo/support/AbstractIntegrationTest.java                        M  @Import + populator
backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java                                  M  TRUNCATE + needs_day
backend/src/test/java/io/mrkuhne/mezo/feature/needs/NeedsApiIT.java                               C
docs/features/needs.md                                     C  new living feature doc
docs/features/today.md                                     M  §1/§2/§3 additions
docs/features/ritual.md                                    M  close flow addition
```

---

### Task 1: Pure model — `needs.ts`

**Files:**
- Create: `frontend/src/features/today/logic/needs.ts`
- Test: `frontend/src/features/today/logic/needs.test.ts`

**Interfaces (Produces — later tasks rely on these exact names):**

```ts
export type NeedKey = 'energia' | 'hidratacio' | 'pihenes' | 'mozgas' | 'lelek' | 'rend'
export type NeedBand = 'green' | 'yellow' | 'red' | 'critical'

export interface NeedEvent {
  at: Date
  kind: 'add' | 'set'      // additive refill vs set-to-value (workout=100, sleep-set)
  amount: number           // 'add': +pct; 'set': absolute pct
  label: string            // HU, for the sheet timeline ("+250 ml", "Ebéd", "Edzés")
}

export interface NeedsInputs {
  wakeTime: string         // 'HH:mm' from SleepGoal.wakeTime
  bedTime: string          // 'HH:mm' from SleepGoal.bedTime
  events: Record<NeedKey, NeedEvent[]>  // yesterday-wake → now, any order (engine sorts)
}

export interface NeedState {
  key: NeedKey
  emoji: string            // 🍽️ 💧 😴 💪 💗 ⚡
  label: string            // Energia · Hidratáció · Pihenés · Mozgás · Lélek · Rend
  color: string            // CSS var name: 'var(--dv-sage)' | 'var(--dv-sky)' | 'var(--dv-lav)'
                           //   | 'var(--dv-coral)' | 'var(--dv-rose)' | 'var(--accent-base)'
  pct: number              // 0..100, rounded to integer
  ratePerHour: number      // current decay rate, positive number (display as −N%/óra)
  zeroAt: Date | null      // forecast within next 24h at current rates, else null
  band: NeedBand
  lastFill: { at: Date; label: string } | null   // latest event ≤ now
  todayFills: { at: Date; label: string }[]      // today's events (at ≥ today wake, ≤ now) — the sheet's "MA" timeline
}

export const NEEDS_TUNING: {
  rings: Record<NeedKey, {
    awakeRate: number      // %/h while awake
    nightRate: number      // %/h while asleep (0 = paused)
    wakeTransform: 'none' | 'carry' | 'sleepSet'  // applied at the wake boundary
  }>
  carryFactor: number      // 0.4
  bands: { green: number; red: number; critical: number }  // 60 / 30 / 15
  refill: {
    mainMeal: number; snack: number        // 40 / 15
    waterGlassMl: number; waterGlass: number  // 250 / 12
    activity: number                        // 25
    checkin: number; intention: number; reflection: number  // 20 / 15 / 25
    habitTick: number                       // 12
  }
}

export function needsAt(now: Date, inputs: NeedsInputs): NeedState[]  // always 6, fixed order above
export function bandOf(pct: number): NeedBand
export const NEED_META: Record<NeedKey, { emoji: string; label: string; color: string }>
```

**Engine semantics (implement exactly):**

- Ring values are simulated chronologically from **yesterday's wake** (baseline value at sim start: `0` for every ring — the ×0.4/decay makes deeper history negligible per spec §1) to `now`, walking segment boundaries: wake/bed crossings (from `wakeTime`/`bedTime`, wrap-aware: bed < wake means bed belongs to the next calendar day) and event timestamps, in time order.
- Per segment: `value -= rate × hours`, clamp to `[0,100]` after every step and every event.
- At each **wake boundary**: `carry` → `value ×= carryFactor`; `sleepSet` → if a `set` event exists at that wake (the adapter emits sleep-set events AT wake time), it applies as a normal `set` event (the transform enum exists so pihenes has `nightRate: 0` + documents intent; no extra math here beyond the event).
- `set` events: `value = amount` (then clamp). `add`: `value += amount`.
- `ratePerHour`: the ring's rate for the segment containing `now` (awake vs night).
- `zeroAt`: project forward from `now` with no future events, walking wake/bed boundaries, up to +24h; the instant value reaches 0, else `null` (also `null` if already 0 — the sheet shows the CTA instead).
- `pct` rounded with `Math.round`.

**Tuning values (from spec §2):**

```ts
export const NEEDS_TUNING = {
  rings: {
    energia:    { awakeRate: 6, nightRate: 2, wakeTransform: 'none' },
    hidratacio: { awakeRate: 6, nightRate: 2, wakeTransform: 'none' },
    pihenes:    { awakeRate: 5, nightRate: 0, wakeTransform: 'sleepSet' },
    mozgas:     { awakeRate: 2, nightRate: 2, wakeTransform: 'none' },
    lelek:      { awakeRate: 5, nightRate: 0, wakeTransform: 'carry' },
    rend:       { awakeRate: 4, nightRate: 0, wakeTransform: 'carry' },
  },
  carryFactor: 0.4,
  bands: { green: 60, red: 30, critical: 15 },
  refill: { mainMeal: 40, snack: 15, waterGlassMl: 250, waterGlass: 12, activity: 25,
            checkin: 20, intention: 15, reflection: 25, habitTick: 12 },
} as const
```

`NEED_META`: energia 🍽️ 'Energia' 'var(--dv-sage)' · hidratacio 💧 'Hidratáció' 'var(--dv-sky)' · pihenes 😴 'Pihenés' 'var(--dv-lav)' · mozgas 💪 'Mozgás' 'var(--dv-coral)' · lelek 💗 'Lélek' 'var(--dv-rose)' · rend ⚡ 'Rend' 'var(--accent-base)'.

- [ ] **Step 1: Write failing tests** — `needs.test.ts` with helpers `const d = (s: string) => new Date(s)` (ISO with explicit time, e.g. `'2026-08-17T12:00:00'`), `wake='06:45'`, `bed='23:15'`, `const empty = (): Record<NeedKey, NeedEvent[]> => ({ energia: [], hidratacio: [], pihenes: [], mozgas: [], lelek: [], rend: [] })`. Cases (each an exact assertion — worked values below are the ground truth, derived from the engine semantics):

```ts
// 1. bandOf edges
expect(bandOf(60)).toBe('green'); expect(bandOf(59)).toBe('yellow')
expect(bandOf(30)).toBe('yellow'); expect(bandOf(29)).toBe('red')
expect(bandOf(15)).toBe('red');  expect(bandOf(14)).toBe('critical')

// 2. additive refill + awake decay (hidratacio): events today 08:00 +12, 10:00 +12; now 12:00.
// Sim from yesterday 06:45 value 0 → stays 0 (clamp) through yesterday+night.
// Today 06:45→08:00 stays 0, +12 → 08:00→10:00: 12−(2h×6)=0 (clamped), +12 at 10:00 →
// 10:00→12:00: 12−12=0. pct === 0, band 'critical'.

// 3. same but denser: +12 at 10:00, 11:00, 11:30, now 12:00 →
// 10:00→11:00: 12−6=6; +12=18; 11:00→11:30: 18−3=15; +12=27; 11:30→12:00: 27−3=24 → pct 24, band 'red'.

// 4. clamp at 100: energia, events today 07:00 set? no — add +40 ×3 at 07:00,07:10,07:20, now 07:30
// → 40,80,cap 100 (minus minutes of decay: 07:00→07:10 −1, 07:10→07:20 −1 … compute exactly:
// 07:00 +40=40; →07:10 40−1=39; +40=79; →07:20 79−1=78; +40=100(cap 118→100); →07:30 −1=99.

// 5. night slowdown (energia): yesterday 19:00 +40 (value 40 after clamp path: 0 all day →
// +40 at 19:00) → 19:00→23:15 awake: 40−(4.25×6)=14.5 → night 23:15→06:45 (7.5h×2=15) → 0 (clamp).
// now today 06:45 → pct 0. With yesterday 21:00 +40 instead: 21:00→23:15: 40−13.5=26.5;
// night −15 → 11.5; today 06:45 now → pct 12 (rounded), band 'critical'.

// 6. sleepSet (pihenes): event {at: today 06:45, kind:'set', amount:75, label:'6,0 óra alvás'};
// now 12:45 → 75 − (6h×5) = 45 → band 'yellow'. No night decay: with now = today 06:44
// (1 min before wake set), value from yesterday: 0 (no events) → 0.

// 7. mozgas set-100 + flat 24/7 decay: event yesterday 18:00 set 100; now today 18:00 → 100−48=52.
// now today 06:00 → 100−24=76. Plus an activity add +25 today 08:00, now 12:00:
// 100−(14h×2)=72 → +25=97 → 97−(4×2)=89.

// 8. carry (lelek): yesterday events: checkin +20 at 08:00, 12:00, 16:00, 20:00; reflection +25 at 22:00.
// yesterday sim: 06:45→08:00 0; +20 → 08:00→12:00: 20−20=0; +20 → 12:00→16:00: 0; +20 →
// 16:00→20:00: 0; +20 → 20:00→22:00: 20−10=10; +25=35 → 22:00→23:15: 35−6.25=28.75 →
// night rate 0 → wake ×0.4 = 11.5 → today 06:45→10:45 (4h×5=20) → 0 (clamp); now 10:45 pct 0.
// (Documents WHY yesterday must be good AND today must act — the intended pressure.)

// 9. zeroAt forecast: hidratacio value 24 at now 12:00 (case 3) → rate 6 →
// zeroAt = 16:00 same day. pihenes at 45, now 12:45, rate 5 → 9h → but bed 23:15 caps awake:
// 12:45+9h=21:45 < bed → zeroAt 21:45. energia at 12 at 22:00 → 22:00→23:15 −7.5 → 4.5 at bed
// → night rate 2 → +2.25h → zeroAt ≈ 01:30 next day (assert getHours()===1, getMinutes()===30).
// value 0 → zeroAt null.

// 10. ratePerHour: energia now awake → 6; now at 02:00 (night) → 2; pihenes at night → 0.

// 11. lastFill: latest event ≤ now with its label; [] → null.

// 12. needsAt returns all 6 in fixed order energia..rend; NEED_META colors match spec.
```

- [ ] **Step 2: Run tests, verify they fail** — `cd frontend && pnpm vitest run src/features/today/logic/needs.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement `needs.ts`** per the semantics above. Keep the engine private (`simulate(ring, events, from, now, anchors)`); export only the interface block. No React imports.
- [ ] **Step 4: Run tests** — same command → PASS. If a worked value disagrees, re-derive by hand ON PAPER from the semantics; the semantics win, fix whichever side is wrong (test comments show the derivations).
- [ ] **Step 5: Commit** — `feat(today): needs decay model — pure engine + tuning (mezo-dhzk)`

---

### Task 2: Adapter + hooks — `needsInputs.ts`, `useNeeds.ts`, `useMinuteTick.ts`

**Files:**
- Create: `frontend/src/features/today/logic/needsInputs.ts`, `needsInputs.test.ts`, `useNeeds.ts`, `useNeeds.test.tsx`, `useMinuteTick.ts`
- Modify: `frontend/src/data/types.ts` (SportSession), `frontend/src/data/train/trainHooks.ts` (toSportSession)

**Interfaces:**
- Consumes: `NeedsInputs`, `NeedEvent`, `NEEDS_TUNING`, `needsAt` from Task 1; existing hooks via `@/data/hooks`.
- Produces:
  - `buildNeedsEvents(raw: RawNeedsData): Record<NeedKey, NeedEvent[]>` (pure) and the `RawNeedsData` type below.
  - `useNeeds(now: Date): { states: NeedState[]; isPending: boolean }`
  - `useMinuteTick(): Date` (60_000ms `setInterval` state, the `useWindDownPhase` idiom — `useState(() => new Date())` + `useEffect` with empty deps + cleanup).

**Adapter rules (pure, exhaustively unit-tested):**

```ts
export interface RawNeedsData {
  todayIso: string; yesterdayIso: string        // localDateString / addDays(-1)
  wakeTime: string; bedTime: string             // SleepGoal
  fuelToday: FuelDay; fuelYesterday: FuelDay
  sleepLog: SleepEntry[]                        // full history; goalMinutes: number
  goalMinutes: number
  gymDoneDates: string[]                        // ISO dates (this week)
  completedTodayWorkout: { date: string } | null
  sportSessions: { isoDate: string; time: string }[]   // needs the isoDate addition below
  runSessions: { date: string }[]
  activitiesToday: ActivityEntry[]; activitiesYesterday: ActivityEntry[]
  checkinsToday: CheckinSlot[]                  // today only (hook is date-less)
  intentionToday: IntentionDay; intentionYesterday: IntentionDay
  ritualYesterday: RitualDay
  habitsToday: HabitItem[]; habitsYesterday: HabitItem[]
}
```

- 🍽️ meals: for each `FuelMeal` in both days, `at = new Date(m.loggedAt)`; classify snack iff `m.slot.toLowerCase().includes('snack')` → `+refill.snack`, else `+refill.mainMeal` (the logged `slot` is a HU display string — 'Reggeli · 09:15…', 'Snack'; per spec §2 note). Label = first word of `m.slot`.
- 💧 water: `consumed.water` (ml, day total, NO timestamps) per day → `floor(ml / waterGlassMl)` synthetic `add` events of `+waterGlass`, evenly spaced between that day's wake and (`today`: `now`; `yesterday`: bed). Label `'+250 ml'`.
- 😴 sleep: find `SleepEntry` with `entry.date === todayIso` else the latest entry with `date === yesterdayIso`… simpler and correct: take `sleepLog` filtered to `date ∈ {todayIso, yesterdayIso}`, use the LATEST as last night. If found: one `set` event at **today's wake time**, `amount = Math.min(100, Math.round(entry.duration / (goalMinutes/60) × 100))`, label `'{duration} óra alvás'` (HU decimal comma, 1 frac digit). None found → no event (ring keeps decaying — spec §2).
- 💪 workouts: `set 100` events — for each ISO date in `gymDoneDates` ∪ `{completedTodayWorkout?.date}` ∪ `runSessions[].date` (dates within yesterday/today only): synthetic time **12:00** local (`new Date(iso + 'T12:00:00')`, day-resolution honesty per spec deviation note); for sport sessions: `new Date(s.isoDate + 'T' + s.time + ':00')` (real wall-clock). Label 'Edzés'/'Futás'/'Sport'. Activities: `add +refill.activity` at `createdAt` if present else `occurredOn + 'T12:00:00'`, label 'Aktivitás'.
- 💗 lélek: today — each `CheckinSlot` with `state === 'done'`: `add +checkin` at `savedAt ?? todayIso+'T'+slot.time+':00'`, label 'Check-in'; `intentionToday.foci.length > 0` → one `add +intention` at today wake+15min (no timestamp on the model — deterministic synthetic), label 'Szándék'; `intentionToday.reflection !== null` → `add +reflection` at today 21:00 synthetic, label 'Reflexió'. Yesterday (checkins unreachable — spec §6 degradation): only `intentionYesterday` (same rules on yesterday's clock) + `ritualYesterday.closed` → `add +reflection` at `closedAt`, label 'Napzárás'.
- ⚡ rend: each `HabitItem` with `status === 'done'` in each day's list: `add +habitTick` at `doneAt ?? that-day 12:00`, label = `h.title`.
- Malformed/missing pieces (`undefined` lastNight, empty lists, null sleep goal times) → empty arrays / no events; NEVER throw.

**`useNeeds(now)`** composes (all from `@/data/hooks`): `useSleepGoal`, `useFuelDay(today)`, `useFuelDay(yesterday)`, `useSleep`, `useTrain`, `useRunning`, `useActivities(today)`, `useActivities(yesterday)`, `useCheckins`, `useIntentionDay(today)`, `useIntentionDay(yesterday)`, `useRitualDay(yesterday)`, `useHabitDay(today)`, `useHabitDay(yesterday)` → `buildNeedsEvents` → `needsAt(now, …)` in a `useMemo` keyed on `[now, …data]`. `isPending` = sleepGoal pending only (everything else degrades to no-events).

**SportSession isoDate:** in `frontend/src/data/types.ts` add `isoDate: string` to `SportSession` (after `date`, comment `// ISO day — the raw wire date; `date` is the HU display string`). In `frontend/src/data/train/trainHooks.ts` `toSportSession` (:141-148) add `isoDate: r.date,`. Fix any mock seed `SportSession` literals that now miss `isoDate` (search `sport:` literals in `data/train/*.ts` mocks; set a plausible ISO for each, matching its display date).

- [ ] **Step 1: Write failing adapter tests** — `needsInputs.test.ts`: meal classification ('Snack' → 15, 'Reggeli · 09:15 · post-workout' → 40), water 1240ml → 4 events evenly spaced wake→now, sleep-set math (6h/480min goal → set 75 at wake), gym date → set-100 at 12:00, sport at real `isoDate+time`, lélek yesterday = intention+ritual only, rend from `doneAt`, missing-source cases produce `[]`.
- [ ] **Step 2: Run** `pnpm vitest run src/features/today/logic/needsInputs.test.ts` → FAIL.
- [ ] **Step 3: Implement** `needsInputs.ts` + the `types.ts`/`trainHooks.ts` isoDate addition.
- [ ] **Step 4: Run adapter tests** → PASS; also `pnpm vitest run src/data/train` → PASS (isoDate didn't break train tests; fix literals if it did).
- [ ] **Step 5: Write failing hook test** — `useNeeds.test.tsx` with `renderHook` + `makeHookWrapper()` from `@/test/queryWrapper`, `vi.stubEnv('VITE_USE_MOCK','true')`, fake `Date` only (`vi.useFakeTimers({ toFake: ['Date'] })`, setSystemTime 12:00): asserts 6 states, mock-seed-driven values are finite 0..100, not all zero (mock fuel/habit seeds guarantee events).
- [ ] **Step 6: Implement `useNeeds.ts` + `useMinuteTick.ts`**, run hook test → PASS.
- [ ] **Step 7: Commit** — `feat(today): needs inputs adapter + useNeeds/useMinuteTick (mezo-dhzk)`

---

### Task 3: `NeedsRow` + CSS + TodayPage insertion + skeleton

**Files:**
- Create: `frontend/src/features/today/components/NeedsRow.tsx`, `NeedsRow.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (append inside Today section — it MUST stay the last section, so append at EOF), `frontend/src/features/today/pages/TodayPage.tsx`, `TodaySkeleton.tsx`, `frontend/src/features/today/todayTapTargets.test.ts`

**Interfaces:**
- Consumes: `NeedState`, `NeedKey`, `NEED_META` (Task 1); `useNeeds`, `useMinuteTick` (Task 2).
- Produces: `NeedsRow({ states, onOpen }: { states: NeedState[]; onOpen: (key: NeedKey) => void })` — presentational, no data hooks (house rule: TodayPage is the composition root).

**Markup:** `<div class="td-needs" role="group" aria-label="Életjelek">` → per state one `<button type="button" class="td-need np-press" aria-label="{label} {pct}%{band==='critical' ? ', kritikus' : ''}" onClick={() => onOpen(key)}>` containing an inline SVG (size 46, stroke 4.5, r = (46−4.5)/2):
- track circle `stroke="var(--divider)"`,
- arc circle `stroke={band === 'critical' ? 'var(--error-base)' : color}`, `strokeLinecap="round"`, `strokeDasharray={C}`, `strokeDashoffset={C × (1 − pct/100)}` (`C = 2πr`), `transform="rotate(-90 23 23)"`, `style={{ transition: 'stroke-dashoffset 400ms var(--ease-out)' }}`,
- critical only: halo circle `class="td-need-halo"` (r + 3.5, stroke `var(--error-base)`, strokeWidth 2, fill none),
- `<text x="23" y="29" textAnchor="middle" fontSize="15">{emoji}</text>`.

**CSS (append at EOF of prototype.css, still inside the Today section):**

```css
/* ── Életjel-ringek (mezo-dhzk) ── */
.td-needs { display: flex; justify-content: space-between; padding: 0 var(--sp-4); margin: 0 0 16px; }
.td-need { display: grid; place-items: center; min-width: 44px; min-height: 44px;
           border-radius: var(--r-full); }
:where(.td-need) .td-need-halo { animation: td-need-pulse 2s var(--ease-in-out) infinite; }
@keyframes td-need-pulse { 0%, 100% { opacity: .25; } 50% { opacity: .7; } }
```
and inside the existing `@media (prefers-reduced-motion: reduce)` block (there is one in the file — extend it, or add a new one AFTER the active rule): `.td-need-halo { animation: none; opacity: .45; }`. (Cascade rule from `todayReducedMotion.test.ts`: active selector wrapped in `:where()`, declared before the override — done above. Only `:root`-declared tokens used — `todayCssTokens.test.ts` scans the Today block.)

**Tap-target guard:** in `todayTapTargets.test.ts` add, following the existing `ruleBody`/`pxDeclaration` helpers:

```ts
test('needs rings are 44px tap targets', () => {
  const body = ruleBody(css, '.td-need')
  expect(pxDeclaration(body, 'min-width')).toBeGreaterThanOrEqual(44)
  expect(pxDeclaration(body, 'min-height')).toBeGreaterThanOrEqual(44)
})
```

**TodayPage wiring (minimal in this task):** below the hook block (before the :265 anchor guard) add `const tick = useMinuteTick()`, `const needs = useNeeds(tick)`, `const [needSheet, setNeedSheet] = useState<NeedKey | null>(null)`; in the JSX insert directly under `<MezoChip …/>` (line ~395): `<NeedsRow states={needs.states} onOpen={setNeedSheet} />`. (`needSheet` renders nothing yet — Task 4 adds the sheet host; keep the state now so the wiring commits once.) Anchor guard (`scenario.anchorMode`) returns before the row — rough day hides it for free.

**Skeleton:** in `TodaySkeleton.tsx` insert after the chip line: `<div className="td-skel td-skel-needs"><Skeleton height={46} /></div>`; CSS: none needed beyond existing `.td-skel` margins — add `.td-skel-needs` to the skeleton CSS block at EOF (`.td-skel-needs { … }` may reuse the same rule shape as `.td-skel-chip`); update `TodaySkeleton.test.tsx` class assertions (`.td-skel-needs` present).

- [ ] **Step 1: Write failing component test** — `NeedsRow.test.tsx` (pure props, MezoChip.test.tsx pattern, no mocks): fixture factory `state(key, pct, band)`; asserts 6 `button`s in order with `aria-label` 'Energia 45%' etc.; critical state renders `.td-need-halo` + aria suffix ', kritikus'; arc stroke uses `var(--error-base)` when critical, `NEED_META.color` otherwise; click fires `onOpen('hidratacio')`.
- [ ] **Step 2: Run** `pnpm vitest run src/features/today/components/NeedsRow.test.tsx` → FAIL.
- [ ] **Step 3: Implement** `NeedsRow.tsx` + CSS block.
- [ ] **Step 4: Run** component test + `pnpm vitest run src/features/today/todayTapTargets.test.ts src/features/today/todayCssTokens.test.ts src/features/today/todayReducedMotion.test.ts` → all PASS.
- [ ] **Step 5: Wire TodayPage + skeleton**, run `pnpm vitest run src/features/today/pages` → PASS (fix any TodayPage test snapshot expectations that count children; the page tests assert behaviors, not snapshots — expect no breakage, verify).
- [ ] **Step 6: Both-mode gate for the touched area** — `pnpm vitest run src/features/today && VITE_USE_MOCK=true pnpm vitest run src/features/today` → PASS.
- [ ] **Step 7: Commit** — `feat(today): NeedsRow — 6 életjel-ring a MezoChip alatt (mezo-dhzk)`

---

### Task 4: `NeedRingSheet` + CTA dispatch

**Files:**
- Create: `frontend/src/features/today/sheets/NeedRingSheet.tsx`, `NeedRingSheet.test.tsx`
- Modify: `frontend/src/features/today/pages/TodayPage.tsx`, `frontend/src/styles/prototype.css` (sheet block)

**Interfaces:**
- Consumes: `NeedState`, `NEED_META`, `NEEDS_TUNING` (Task 1).
- Produces: `NeedRingSheet({ state, onClose, onCta }: { state: NeedState; onClose: () => void; onCta: (key: NeedKey) => void })`.

**Layout (approved mockup, house `Sheet`):** `<Sheet onClose={onClose} labelledBy="need-sheet-title">{(close) => …}` with `.td-sheet-h` header (`<h2 id="need-sheet-title">{label}</h2>` + `Kész` button) — then:
- header row: 64px SVG ring (same math as NeedsRow, stroke 6) + `{label}` + last-fill line (`Utolsó log: {HH:mm} · {lastFill.label}` or `Ma még nincs log`) + right-aligned `{pct}%` (color `var(--error-base)` when red/critical, else `var(--text-primary)`) over `−{ratePerHour}%/óra`.
- forecast strip (`.td-need-cast`): when `zeroAt` → `Így {HH:mm} körül nullázódik.` + refill hint per ring (from `NEEDS_TUNING.refill`, e.g. hidratacio: `Egy pohár víz (+12%) ~2 órát ad hozzá.` — hours = `refill.waterGlass / ring.awakeRate` rounded); when `pct === 0` → `Lemerült — töltsd fel egy loggal.`
- primary CTA `<button class="td-cta">` per ring (labels): energia `🍽️ Étkezés logolása` · hidratacio `💧 +250 ml — Logolás` · pihenes `😴 Alvás logolása` · mozgas `💪 Irány a Train` · lelek `💗 Check-in` · rend → NO CTA (render nothing). `onClick={() => { onCta(state.key); close() }}`.
- "MI TÖLTI?" list (`.td-need-fills`, hairline rows like the mockup): static per-ring rows from `NEEDS_TUNING.refill` — energia: `Főétkezés +40% · Snack +15%`; hidratacio: `Egy pohár víz (250 ml) +12%`; pihenes: `Éjszakai alvás — az órák aránya a célhoz`; mozgas: `Edzés/sport/futás → 100% · Aktivitás +25%`; lelek: `Check-in +20% · Reggeli szándék +15% · Reflexió/napzárás +25%`; rend: `Habit-pipa +12%`.
- "MA" timeline (`.td-need-tl`): today's events from… **not available on `NeedState`** — extend Task 1's `NeedState` with `todayFills: { at: Date; label: string }[]` (events with `at >= today wake`, ≤ now) — add to the Task-1 interface NOW if executing in order (it is listed here so Task 1's implementer includes it: **`NeedState.todayFills` is part of the Task 1 contract**). Render dots at proportional `left` across wake→bed with `HH:mm` labels + a "most" marker; ≤0 fills → single muted line `Ma még nincs log.`

**CTA dispatch in TodayPage** (reusing EXISTING sheet states, no new sheets):

```ts
const onNeedCta = (key: NeedKey) => {
  if (key === 'energia') setMealOpen({})
  else if (key === 'hidratacio') logWater(250)              // useWaterActions(date) — already called
  else if (key === 'pihenes') setSleepOpen(true)
  else if (key === 'mozgas') navigate('/train')
  else if (key === 'lelek') { const idx = checkins.findIndex(isFillableSlot); if (idx >= 0) setCheckInIdx(idx) }
}
```
Sheet host (with the other sheet hosts at :423+): `{needSheet && <NeedRingSheet state={needs.states.find(s => s.key === needSheet)!} onClose={() => setNeedSheet(null)} onCta={onNeedCta} />}`.

**CSS:** `.td-need-cast`, `.td-need-fills`, `.td-need-tl` blocks appended after Task 3's block (recess strip / hairline list / relative-positioned dots; reuse `--surface-recess`, `--divider`, `--r-lg`; no new tokens).

- [ ] **Step 1: Write failing sheet test** — props-driven (state fixture): renders name+pct, forecast shows `zeroAt` HH:mm, CTA per ring label table, `rend` has no CTA button, CTA click calls `onCta('hidratacio')` and closes, timeline shows fill labels, `pct === 0` shows the lemerült copy. (jsdom + house Sheet portals to body — assert via `screen`.)
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (including the `todayFills` addition to `needs.ts` + a test for it in `needs.test.ts` if Task 1 shipped without it). **Step 4: Run** sheet test + `pnpm vitest run src/features/today` → PASS.
- [ ] **Step 5: TodayPage dispatch test** — extend `TodayPage.dispatch.test.tsx` pattern: click 💧 ring → sheet opens; CTA click → water mutation fired (spy via mocked `useWaterActions` in the hoisted mock map).
- [ ] **Step 6: Run** `pnpm vitest run src/features/today/pages` → PASS. **Step 7: Commit** — `feat(today): NeedRingSheet — részletező + gyors-CTA (mezo-dhzk)`

---

### Task 5: Nudges into the Mezo thread

**Files:**
- Create: `frontend/src/features/today/logic/needsNudges.ts`, `needsNudges.test.ts`, `frontend/src/shared/lib/nudgeSeen.ts`, `nudgeSeen.test.ts`
- Modify: `frontend/src/features/today/logic/mezoMessages.ts`, `mezoMessages.test.ts`, `frontend/src/features/today/pages/TodayPage.tsx`

**Interfaces:**
- Consumes: `NeedState`, `NeedKey`, `NeedBand` (Task 1); `MezoMessageItem` (existing).
- Produces:
  - `nudgeSeen.ts`: `shownNudges(date: string): { key: NeedKey; at: string }[]` and `markNudgeShown(date: string, key: NeedKey, at: string): void` — localStorage key `mezo.needsnudge.<date>`, JSON array, try/catch like `seenMessages.ts`.
  - `needsNudges.ts`: `NUDGE_COPY: Record<NeedKey, string>` and
    `deriveNudges(states: NeedState[], now: Date, wakeTime: string, bedTime: string, shown: { key: NeedKey; at: string }[]): { key: NeedKey; at: string; fresh: boolean }[]`
    — returns ALL of today's nudge entries (already-shown ones from `shown` pass through with `fresh: false`; newly triggered ones appended with `at = now.toISOString()`, `fresh: true`). Trigger: `band === 'red' || band === 'critical'`, not already shown, and NOT quiet (quiet = night window bed→wake, wrap-aware, OR now < wake+1h). Max one per ring per day falls out of the shown-set.
  - `mezoMessages.ts`: `buildMezoMessages({ feed, demoBriefing, nudges }: { …; nudges?: MezoMessageItem[] })` — appends `nudges` after the feed items (thread stays oldest-first by construction: nudge `time` is today).
  - `needsNudges.ts` also exports `toNudgeMessage(n: { key: NeedKey; at: string }): MezoMessageItem` — `id: 'nudge-' + key + '-' + at`, `eyebrow: 'Életjel'`, `time: HH:mm(at)`, `paragraphs: [NUDGE_COPY[key]]`, `refs: []`, `meta: 'Életjel-figyelő'`.

**Copy (HU, one sentence, warm, no guilt — final):**

```ts
export const NUDGE_COPY: Record<NeedKey, string> = {
  energia:    '🍽️ Ideje enni valamit — az utolsó étkezésed régen volt, az Energia-ringed leapadt.',
  hidratacio: '💧 Ma még alig ittál — egy pohár víz máris feltölti a Hidratáció-ringet.',
  pihenes:    '😴 A tegnapi éjszaka kevés volt — ma este érdemes korábban zárni.',
  mozgas:     '💪 Két napja nem mozdultál nagyot — egy edzés vagy séta újra feltölt.',
  lelek:      '💗 Rég néztél magadra — egy gyors check-in feltölti a Lélek-ringet.',
  rend:       '⚡ A láncaid ma még üresek — egy-két pipa visszahozza a Rendet.',
}
```

**TodayPage wiring:** after `needs`: read `shownNudges(date)` into state; `const nudgeEntries = deriveNudges(needs.states, tick, sleepGoal.wakeTime, sleepGoal.bedTime, shown)`; `useEffect`: for each `fresh` entry → `markNudgeShown(date, key, at)` + update the state set (consume-once, the quest-effect idiom at :155). `messages = buildMezoMessages({ feed, demoBriefing…, nudges: nudgeEntries.map(toNudgeMessage) })`. The existing `latestId` mechanics re-arm the chip's unread dot automatically (a nudge id is new → dot on).

- [ ] **Step 1: failing tests** — `nudgeSeen.test.ts` (roundtrip, corrupt JSON → `[]`); `needsNudges.test.ts`: red at 15:00 → fresh nudge; same ring already in `shown` → passes through `fresh:false` (no dupe); yellow → none; 02:00 (night) and wake+30min → suppressed; `toNudgeMessage` shape. `mezoMessages.test.ts`: nudges append after feed, omitted param → unchanged behavior.
- [ ] **Step 2: Run** the three test files → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: TodayPage integration test** — in `TodayPage.test.tsx` style with fake `Date` at 16:00 + mock-seed data producing a red hidratáció (stub `useFuelDay` water to 0 via the hoisted-mock pattern if seeds are too full — the dispatch-test file shows the idiom): chip badge count grows by 1, opening the sheet shows the 💧 bubble with meta 'Életjel-figyelő'; re-render → still exactly one.
- [ ] **Step 6: Run** `pnpm vitest run src/features/today` both modes → PASS. **Step 7: Commit** — `feat(today): needs nudges a Mezo-szálban (mezo-dhzk)`

---

### Task 6: API contract — `needs.yml` + generation

**Files:**
- Create: `api/feature/needs/needs.yml`
- Modify: `api/generate/merge.yml` (append `- inputFile: ../feature/needs/needs.yml` at the end of the inputs list), regenerate `api/openapi.yml` + `frontend/src/data/_client/api.gen.ts`

**Contract (write exactly; mirrors checkin.yml idioms — SystemMessageList refs, upsert-200):**

```yaml
openapi: 3.0.3
info: { title: mezo needs fragment, version: 1.0.0 }
tags:
  - name: Needs
    description: Életjel-ringek — day-close snapshot, bonus XP, "Életben tartva" streak
paths:
  /api/needs/day-close:
    post:
      tags: [Needs]
      operationId: closeNeedsDay
      summary: Store the day's ring snapshot, award bonus XP, advance the streak (Needs). Idempotent per date — repeat calls return the stored result.
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/NeedsCloseRequest' }
      responses:
        '200':
          description: Stored (idempotent — 200 on repeat, no double award)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/NeedsCloseResponse' }
        '400':
          description: Validation error
          content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } }
        '409':
          description: Not today (NEEDS_NOT_TODAY)
          content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } }
  /api/needs/summary:
    get:
      tags: [Needs]
      operationId: getNeedsSummary
      summary: Latest needs close — streak + last close date (Needs)
      responses:
        '200':
          description: Summary (zeros when no close exists yet)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/NeedsSummaryResponse' }
components:
  schemas:
    NeedsRings:
      type: object
      required: [energia, hidratacio, pihenes, mozgas, lelek, rend]
      properties:
        energia:    { type: integer, minimum: 0, maximum: 100 }
        hidratacio: { type: integer, minimum: 0, maximum: 100 }
        pihenes:    { type: integer, minimum: 0, maximum: 100 }
        mozgas:     { type: integer, minimum: 0, maximum: 100 }
        lelek:      { type: integer, minimum: 0, maximum: 100 }
        rend:       { type: integer, minimum: 0, maximum: 100 }
    NeedsCloseRequest:
      type: object
      required: [date, rings]
      properties:
        date:  { type: string, format: date }
        rings: { $ref: '#/components/schemas/NeedsRings' }
    NeedsCloseResponse:
      type: object
      required: [date, xpAwarded, greenCount, allGreen, streakDays]
      properties:
        date:       { type: string, format: date }
        xpAwarded:  { type: integer }
        greenCount: { type: integer }
        allGreen:   { type: boolean }
        streakDays: { type: integer }
    NeedsSummaryResponse:
      type: object
      required: [streakDays]
      properties:
        streakDays:    { type: integer }
        lastCloseDate: { type: string, format: date }
        lastAllGreen:  { type: boolean }
```

- [ ] **Step 1:** Write `needs.yml`, register in `merge.yml`.
- [ ] **Step 2:** `cd api/generate && npm run generate:api` → `api/openapi.yml` contains `/api/needs/day-close` (grep it). `cd frontend && pnpm generate:api` → `api.gen.ts` has `NeedsCloseResponse` (grep).
- [ ] **Step 3:** `cd backend && ./mvnw clean generate-sources -q` (or let the next task's test run do it) → generated `io.mrkuhne.mezo.api.controller.NeedsApi` exists under `backend/target/generated-sources`.
- [ ] **Step 4:** `cd frontend && pnpm build` → still green (types only added).
- [ ] **Step 5: Commit** — `feat(api): needs day-close + summary contract (mezo-dhzk)`

---

### Task 7: Backend persistence — migration, entity, repository, populator

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202608171200_mezo-dhzk_create_needs_day.sql`; `feature/needs/entity/NeedsDayEntity.java`; `feature/needs/repository/NeedsDayRepository.java`; `backend/src/test/java/io/mrkuhne/mezo/support/populator/NeedsPopulator.java`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append changeSet at end); `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java` (add `needs_day` to the TRUNCATE list, :40-47); `backend/src/test/java/io/mrkuhne/mezo/support/AbstractIntegrationTest.java` (add `NeedsPopulator.class` to `@Import`)

**SQL (exact):**

```sql
-- needs_day: one live row per user+date = the day's Életjel-ring snapshot at Napzárás,
-- with the awarded bonus XP and the "Életben tartva" streak as of that close (mezo-dhzk).
create table needs_day (
    id          uuid        not null default gen_random_uuid(),
    created_by  uuid        not null,
    is_deleted  boolean     not null default false,
    created_at  timestamptz not null default now(),
    needs_date  date        not null,
    energia     int         not null,
    hidratacio  int         not null,
    pihenes     int         not null,
    mozgas      int         not null,
    lelek       int         not null,
    rend        int         not null,
    green_count int         not null,
    all_green   boolean     not null,
    xp_awarded  int         not null,
    streak_days int         not null,
    constraint pk_needs_day primary key (id),
    constraint fk_needs_day_created_by_app_user_id
        foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_needs_day_energia    check (energia    between 0 and 100),
    constraint ck_needs_day_hidratacio check (hidratacio between 0 and 100),
    constraint ck_needs_day_pihenes    check (pihenes    between 0 and 100),
    constraint ck_needs_day_mozgas     check (mozgas     between 0 and 100),
    constraint ck_needs_day_lelek      check (lelek      between 0 and 100),
    constraint ck_needs_day_rend       check (rend       between 0 and 100)
);
create unique index uq_needs_day_user_date
    on needs_day (created_by, needs_date) where is_deleted = false;
```

changeSet entry (append at end of `1.0.0_master.yml`, mirroring the intention entry shape): id `"1.0.0:202608171200_mezo-dhzk_create_needs_day"`, author `daniel.kuhne`, sqlFile relativeToChangelogFile path `script/202608171200_mezo-dhzk_create_needs_day.sql`.

**Entity** — mirror `RitualDayEntity`/`IntentionFocusEntity`: `@Getter @Setter @Entity @Table(name="needs_day") @SQLDelete(sql = "update needs_day set is_deleted = true where id = ?") @SQLRestriction("is_deleted = false") public class NeedsDayEntity extends OwnedEntity` with `@Id @GeneratedValue @Column(columnDefinition="uuid") UUID id`, `@Column(name="needs_date", nullable=false) LocalDate needsDate`, six `@Column(nullable=false) int energia…rend`, `@Column(name="green_count", nullable=false) int greenCount`, `@Column(name="all_green", nullable=false) boolean allGreen`, `@Column(name="xp_awarded", nullable=false) int xpAwarded`, `@Column(name="streak_days", nullable=false) int streakDays`.

**Repository** — `public interface NeedsDayRepository extends JpaRepository<NeedsDayEntity, UUID>` with derived finders: `Optional<NeedsDayEntity> findByCreatedByAndNeedsDateAndDeletedFalse(UUID createdBy, LocalDate needsDate)` and `Optional<NeedsDayEntity> findFirstByCreatedByAndDeletedFalseOrderByNeedsDateDesc(UUID createdBy)`.

**Populator** — `@TestComponent @RequiredArgsConstructor public class NeedsPopulator` with the repository injected and one factory: `public NeedsDayEntity needsDay(UUID owner, LocalDate date, int[] rings, int greenCount, boolean allGreen, int xp, int streak)` → builds, `setCreatedBy(owner)`, `saveAndFlush`.

- [ ] **Step 1:** Write SQL + master registration + entity + repository + populator + the ResetDatabase/AbstractIntegrationTest registrations.
- [ ] **Step 2:** Write a failing entity IT — `backend/src/test/java/io/mrkuhne/mezo/feature/needs/NeedsEntityIT.java extends AbstractIntegrationTest`: `testSave_shouldRoundTrip_whenValidRow` (populator insert → repository find by user+date, AssertJ on all fields) and `testUniqueIndex_shouldReject_whenDuplicateDate` (`assertThatThrownBy` on second saveAndFlush → `DataIntegrityViolationException`).
- [ ] **Step 3:** `cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest=NeedsEntityIT` → PASS (migration applied + entity mapped).
- [ ] **Step 4: Commit** — `feat(needs): needs_day table + entity + repository (mezo-dhzk)`

---

### Task 8: Backend service, controller, ProgressionService.applyNeeds, ITs

**Files:**
- Create: `feature/needs/service/NeedsService.java`, `feature/needs/controller/NeedsController.java`, `feature/needs/mapper/NeedsMapper.java`, `feature/needs/config/NeedsProperties.java`, `feature/progression/needs/NeedsSignal.java`, `backend/src/test/java/io/mrkuhne/mezo/feature/needs/NeedsApiIT.java`
- Modify: `ProgressionService.java`, `FeaturesConfiguration.java`, `application.yml`, `messages.properties`

**Pieces (exact):**

- `FeaturesConfiguration`: `public static final String NEEDS_SWITCH = "mezo.feature.needs.enabled";`
- `application.yml`: under the `mezo.feature:` block add `needs: { enabled: true }` (follow the file's existing style); at the tuning area add
  ```yaml
  # Binds feature/needs/config/NeedsProperties — Életjel day-close award rule (mezo-dhzk)
  mezo:
    needs:
      green-threshold: 60
      per-ring-xp: 5
      all-green-bonus-xp: 30
  ```
  (merge into the existing `mezo:` root — do NOT create a second root key.)
- `NeedsProperties`: `@Validated @ConfigurationProperties(prefix = "mezo.needs") public record NeedsProperties(@Min(1) @Max(100) int greenThreshold, @PositiveOrZero int perRingXp, @PositiveOrZero int allGreenBonusXp) {}` (auto-bound via `@ConfigurationPropertiesScan`).
- `messages.properties`: `NEEDS_NOT_TODAY=Az életjel-zárás csak a mai napra rögzíthető.`
- `NeedsSignal` (in `feature/progression/needs/`, mirroring `HabitSignal`): `public record NeedsSignal(UUID needsDayId, int xp, String label, LocalDate occurredOn) {}`
- `ProgressionService.applyNeeds` (place after `applyHabit`, mirror `applyActivity`'s shape; source constant `private static final String SOURCE_NEEDS = "NEEDS";` beside the existing SOURCE_* constants):
  ```java
  /** Needs day-close bonus → LIFE XP on the recovery skill through the shared idempotent tail (source NEEDS). */
  @Transactional
  public LevelUpResult applyNeeds(UUID createdBy, NeedsSignal signal) {
      Map<String, Long> deltas = new LinkedHashMap<>();
      Map<String, String> kinds = new LinkedHashMap<>();
      if (signal.xp() > 0) {
          deltas.put("recovery", (long) signal.xp());
          kinds.put("recovery", "LIFE");
      }
      return award(createdBy, SOURCE_NEEDS, signal.needsDayId(), deltas, kinds,
          signal.label(), null, null, signal.occurredOn());
  }
  ```
- `NeedsService` — `@Service @RequiredArgsConstructor @ConditionalOnProperty(name = FeaturesConfiguration.NEEDS_SWITCH, havingValue = "true")`; fields: repository, `NeedsProperties props`, `ObjectProvider<ProgressionService> progressionGate` + `ProgressionService progressionService` (copy `HabitService`'s gate idiom at `HabitService.java:301-305` — inspect it first: it uses one `ObjectProvider` field; mirror exactly what compiles there).
  - `@Transactional public NeedsCloseResponse close(UUID userId, NeedsCloseRequest req)`:
    1. `if (!req.getDate().equals(LocalDate.now())) throw new SystemRuntimeErrorException(SystemMessage.error("NEEDS_NOT_TODAY").build(), HttpStatus.CONFLICT);`
    2. idempotency: existing row for (user, date) → return `mapper.toCloseResponse(existing)`.
    3. compute: `int[] values = {rings.getEnergia(), …}`; `greenCount = count(v >= props.greenThreshold())`; `allGreen = greenCount == 6`; `xp = greenCount * props.perRingXp() + (allGreen ? props.allGreenBonusXp() : 0)`.
    4. streak: `prev = repository.findByCreatedByAndNeedsDateAndDeletedFalse(userId, req.getDate().minusDays(1))`; `streakDays = allGreen ? (prev.filter(NeedsDayEntity::isAllGreen).map(p -> p.getStreakDays() + 1).orElse(1)) : 0`.
    5. persist entity (`saveAndFlush`), then if `xp > 0` and the progression gate resolves: `progressionService.applyNeeds(userId, new NeedsSignal(row.getId(), xp, "Életjelek — életben tartva", req.getDate()))`.
    6. return response via mapper.
  - `@Transactional(readOnly = true) public NeedsSummaryResponse summary(UUID userId)` — latest row → `{streakDays, lastCloseDate, lastAllGreen}`; none → `{streakDays: 0}` (builder, other fields null).
- `NeedsController` — `@RestController @RequiredArgsConstructor @ConditionalOnProperty(name = FeaturesConfiguration.NEEDS_SWITCH, havingValue = "true") public class NeedsController implements NeedsApi` delegating `closeNeedsDay(NeedsCloseRequest request)` → `needsService.close(currentUserId.get(), request)` and `getNeedsSummary()` → `needsService.summary(currentUserId.get())`.
- `NeedsMapper` — hand-written `@Component` (IntentionMapper idiom): `toCloseResponse(NeedsDayEntity)` and `toSummaryResponse(NeedsDayEntity | null)` using the generated DTO builders.

- [ ] **Step 1: Write failing `NeedsApiIT extends ApiIntegrationTest`** (owner flow via `ownerAuthHeaders()`; request bodies as `Map.of(…)` or the generated DTOs; **use `LocalDate.now()` for date** — the endpoint rejects non-today, so yesterday-rows for streak tests must be inserted via `NeedsPopulator` directly):
  - `testCloseNeedsDay_shouldAwardZeroXp_whenNoRingGreen` — all rings 10 → `xpAwarded 0, greenCount 0, allGreen false, streakDays 0`.
  - `testCloseNeedsDay_shouldAwardPerRingXp_whenThreeGreen` — 3 rings 60+, 3 below → `xpAwarded 15, greenCount 3, allGreen false`.
  - `testCloseNeedsDay_shouldAwardBonus_whenAllGreen` — all 60+ → `xpAwarded 60, allGreen true, streakDays 1`.
  - `testCloseNeedsDay_shouldContinueStreak_whenYesterdayAllGreen` — populator inserts yesterday `allGreen=true, streakDays=4` → today all-green close → `streakDays 5`.
  - `testCloseNeedsDay_shouldResetStreak_whenNotAllGreen` — yesterday allGreen streak 4; today 5 green → `streakDays 0`.
  - `testCloseNeedsDay_shouldBeIdempotent_whenCalledTwice` — same body twice → identical responses AND progression XP awarded once (assert via `GET /api/progression/profile` or the `level_up_event` table through the repository — simplest: second response equals first and `getForBody` summary streak unchanged; XP single-award is guaranteed by the award tail's idempotency on sourceRefId, but assert response equality at minimum).
  - `testCloseNeedsDay_shouldReject_whenNotToday` — date yesterday → 409 + `assertHasRequestError(body, "NEEDS_NOT_TODAY")` (use `exchangeForResponse` to grab the raw body).
  - `testCloseNeedsDay_shouldReject_whenRingOutOfRange` — energia 130 → 400.
  - `testGetNeedsSummary_shouldReturnZeros_whenNoClose` / `…shouldReturnLatest_whenCloses` (populator rows two days).
- [ ] **Step 2:** `./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest=NeedsApiIT` → FAIL (404/beans missing).
- [ ] **Step 3:** Implement all pieces above.
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5:** Focused neighbors: `-Dtest='NeedsApiIT,RitualApiIT,IntentionApiIT'` → PASS (no context/config regressions). Full suite is CI's job (16 GB rule does not apply on this 128 GB machine, but stay focused locally; CI is authoritative).
- [ ] **Step 6: Commit** — `feat(needs): day-close award + streak + summary API (mezo-dhzk)`

---

### Task 9: FE close wiring — mock award, real call, ritual surfaces

**Files:**
- Create: `frontend/src/data/needs/needsApi.ts`, `needsHooks.ts`, `needsHooks.test.tsx`
- Modify: `frontend/src/data/gamification/gamificationTypes.ts`, `xpValues.ts`, `frontend/src/data/ritual/ritualHooks.ts`, `ritualHooks.test.tsx` (create if missing), `frontend/src/data/hooks.ts`, `frontend/src/features/ritual/pages/RitualPage.tsx`, `frontend/src/features/ritual/components/HarvestStep.tsx`

**Pieces:**

- `gamificationTypes.ts`: extend `XpEventType` union with `'NEEDS_CLOSE'`. `xpValues.ts`: `NEEDS_CLOSE: 0` in `XP_VALUES` (xp always via override), `NEEDS_CLOSE: 1` in `DAILY_CAPS`.
- `needsApi.ts` (satisfies idiom, `fuelSettingsApi.ts` shape):
  ```ts
  import { apiFetch } from '@/data/_client/api'
  import type { components } from '@/data/_client/api.gen'
  export type NeedsRingsWire = components['schemas']['NeedsRings']
  type CloseReq = components['schemas']['NeedsCloseRequest']
  export type NeedsCloseResult = components['schemas']['NeedsCloseResponse']
  export type NeedsSummary = components['schemas']['NeedsSummaryResponse']
  export const needsApi = {
    close: (date: string, rings: NeedsRingsWire): Promise<NeedsCloseResult> =>
      apiFetch<NeedsCloseResult>('/api/needs/day-close', {
        method: 'POST', body: JSON.stringify({ date, rings } satisfies CloseReq) }),
    summary: (): Promise<NeedsSummary> => apiFetch<NeedsSummary>('/api/needs/summary'),
  }
  ```
- `needsHooks.ts`: `export const NEEDS_SUMMARY_KEY = ['needsSummary'] as const`; `useNeedsSummary(): { data: NeedsSummary; isPending: boolean }` via `useDualQuery` — `mockData: { streakDays: 0 }`, `realFetch: needsApi.summary`, `realEmpty: { streakDays: 0 }`. Re-export from `data/hooks.ts`: `export { useNeedsSummary } from '@/data/needs/needsHooks'`.
- Mock close-award helper IN `needsHooks.ts` (kept beside the key, exported for ritualHooks):
  ```ts
  export function applyMockNeedsClose(qc: QueryClient, date: string, rings: NeedsRingsWire): void
  ```
  — computes `greenCount` (≥60 — mirror `NEEDS_TUNING.bands.green` by importing it from `@/features/today/logic/needs`… **NO: data/ must not import from features/. Duplicate the three award numbers as local constants** `const GREEN = 60, PER_RING_XP = 5, ALL_GREEN_BONUS = 30` with a comment `// mirrors mezo.needs.* (application.yml) + NEEDS_TUNING.bands.green — keep in sync`), `xp = greenCount*5 + (allGreen ? 30 : 0)`; reads prev `NEEDS_SUMMARY_KEY` cache → new streak (same rule as backend: allGreen ? (prevAllGreenYesterday? — mock has no yesterday row; use `prev.streakDays + 1` when allGreen, else 0); writes `{ streakDays, lastCloseDate: date, lastAllGreen: allGreen }` to the cache; if `xp > 0` → `awardGamificationEvent(qc, { type: 'NEEDS_CLOSE', date, xpOverride: xp })`. Idempotency guard: if `prev.lastCloseDate === date` return (no double award on ritual re-close).
- `ritualHooks.ts` `useRitualActions(date)`: change `close` mutation to accept an optional payload — `mutationFn: async (rings?: NeedsRingsWire): Promise<RitualDay>`:
  - mock arm: existing behavior, plus AFTER the ritual award: `if (rings) applyMockNeedsClose(qc, date, rings)`.
  - real arm: existing `ritualApi.close(date)`, plus `if (rings) { try { await needsApi.close(date, rings) } catch { /* needs award must never block the napzárás */ } }` before the invalidations; add `qc.invalidateQueries({ queryKey: NEEDS_SUMMARY_KEY })` to the fire-and-forget group.
  - The hook's return type stays `{ close: (rings?: NeedsRingsWire) => Promise<RitualDay>; pending }` — existing no-arg callers stay valid.
- `RitualPage.tsx`: add `const tickNow = useState(() => new Date())[0]` + `const { states } = useNeeds(tickNow)` (import `useNeeds` from `@/features/today/logic/useNeeds` — cross-feature logic import, the `rewardToast` precedent) and in the act-4 effect call `close(ringsOf(states))` where `ringsOf` maps the 6 `NeedState.pct` into `{ energia, hidratacio, pihenes, mozgas, lelek, rend }` (write it inline in RitualPage or export from `needsInputs.ts` as `export const ringsOf = (states: NeedState[]): NeedsRingsWire => …` — export it from `needsInputs.ts`, tested there).
- `HarvestStep.tsx`: `const { data: needsSummary } = useNeedsSummary()` (from `@/data/hooks`) and after the 🔥 streak line (~:151) add, only when `needsSummary.streakDays > 0`: `<div className="rz-streak np-anim" style={{ animationDelay: … same stage + 200 }}>🛟 {needsSummary.streakDays} napja életben</div>`.

- [ ] **Step 1: failing tests** — `needsHooks.test.tsx` (`renderHook` + `QueryWrapper`): mock summary defaults `{streakDays: 0}`; `applyMockNeedsClose` with all-green rings → summary cache `{streakDays: 1, lastAllGreen: true}` and gamification profile XP grew by 60; second call same date → unchanged (idempotent); 3-green → +15, streak 0. `ritualHooks.test.tsx`: mock-mode `close(rings)` closes the day AND applies the needs award; `close()` (no arg) still works.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** all pieces. **Step 4: Run** the new tests + `pnpm vitest run src/data src/features/ritual` → PASS.
- [ ] **Step 5:** Full FE gates both modes: `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` → PASS.
- [ ] **Step 6: Commit** — `feat(ritual): needs snapshot a napzárásban + Életben tartva streak (mezo-dhzk)`

---

### Task 10: Docs (mandatory — work is not done without it)

**Files:**
- Create: `docs/features/needs.md`
- Modify: `docs/features/today.md`, `docs/features/ritual.md`

Follow `docs/features/README.md` §5 (the 10-section template; read it first) and the `knowledge-base` skill's conventions (frontmatter: `title: Needs`, `type: feature-domain`, `status: done`, `updated: <today>`, `key_files` listing `frontend/src/features/today/logic/needs.ts`, `frontend/src/features/today/components/NeedsRow.tsx`, `frontend/src/data/needs`, `api/feature/needs/needs.yml`, `backend/src/main/java/io/mrkuhne/mezo/feature/needs`; `related: [today, ritual, _platform-data-layer, growth]`).

- `needs.md` content: the 6 rings + tuning table (link the spec for rationale), the pure-engine architecture (§ file map with `file:line` pointers), nudge rules, day-close award + streak (backend §4/§5), how to extend (add a ring / change tuning / port to Java), test map.
- `today.md`: §1 add the NeedsRow bullet between MezoChip and DaypartPanel; §2 add ring-tap → sheet behavior + nudge bubbles in the Mezo thread; §3 add the three new logic modules to the module list.
- `ritual.md`: close-flow section gains the needs snapshot call + HarvestStep line.

- [ ] **Step 1:** Write/update the three docs. **Step 2:** `node scripts/lint-docs.mjs` → clean (fix any orphan/link/staleness flags). **Step 3: Commit** — `docs(features): needs living doc + today/ritual updates (mezo-dhzk)`

---

### Task 11: Gates, PR, CI, merge, deploy

- [ ] **Step 1:** Full local gates one more time from a clean tree: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`; `cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true` (this machine runs the full suite fine — memory note in project memories).
- [ ] **Step 2:** `bd update mezo-dhzk --claim` if not yet claimed; `git pull --rebase origin main` onto the branch? — NO: merge `origin/main` INTO the feature branch if main moved (`git fetch origin && git merge origin/main`, resolve `.beads/issues.jsonl` by taking either side), per the project memory about conflicted PRs running no CI.
- [ ] **Step 3:** `git push -u origin claude/sims-metrics-system-357035` → `gh pr create --fill --title "feat(today): Életjel-ringek — Sims-style needs (mezo-dhzk)"` with a body summarizing spec §§ and ending with the 🤖 Generated with [Claude Code](https://claude.com/claude-code) line.
- [ ] **Step 4:** Wait for CI green (`gh pr checks --watch`). CI is the authoritative full-suite gate. Fix-forward on failures; a CONFLICTING PR runs NO checks — re-merge main if that happens.
- [ ] **Step 5:** On green: `git checkout main && git pull --rebase && git merge --no-ff claude/sims-metrics-system-357035 && bd dolt push && git push` (pull-rebase BEFORE the merge, push directly after — never rebase after merging). Verify `git status` = up to date. Delete the branch (`git push origin -d …`, `git branch -d …`). `bd close mezo-dhzk`.
- [ ] **Step 6: Deploy** — read `docs/infrastructure/deployment-k3s-argocd.md` FIRST (mandatory trigger), then follow exactly what it prescribes for shipping main to the cluster (ArgoCD sync / image pipeline as documented there). Verify the deployment per that doc's checks.

## Self-Review Notes (done)

- Spec coverage: §1→T1, §2→T1/T2, §3→T3/T4, §4→T5, §5→T6/T7/T8/T9, §6→T2/T9, §7→every task's tests, §8 untouched. Deviations from spec (documented in-plan): water = day-total synthetic events; gym/run day-resolution with synthetic noon; `NeedState.todayFills` added for the sheet timeline; mock award constants duplicated in `data/` (layer rule) with a keep-in-sync comment.
- Type consistency: `NeedsRingsWire`/`NeedsCloseResult` names used identically in T6/T9; `NeedState`/`NeedKey`/`NEEDS_TUNING` identical across T1–T5; `close(rings?)` optionality preserved for legacy callers.
