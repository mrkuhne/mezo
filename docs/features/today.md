---
title: Today
type: feature-domain
status: mixed
updated: 2026-07-04
tags: [today, biometrics, frontend, data-layer]
key_files:
  - frontend/src/features/today
  - frontend/src/data/today
  - frontend/src/data/me/biometricsApi.ts
  - api/feature/checkin/checkin.yml
  - backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/checkin
related: [_platform-data-layer, _platform-design-system, me, insights, train]
---

# Today — Feature Documentation

> The daily home / morning-briefing screen at route `/today` (tab "Ma"), the PWA's default landing page. **Status: 🟢/🔶 mixed** — since **Slice T** (`mezo-t16y.3`, 2026-07-04) every section is real in real mode (deterministic composition over existing real reads) or an explicit honest state; the one deliberate exception is the **briefing prose**, which stays static demo copy behind an honest „Demo tartalom" label until the proactive epic ships the generated briefing.

## 1. Summary

**Today** ("Ma") is mezo's daily aggregation surface — the screen the user sees first every morning. It stacks the day's signals into one vertical scroll: a brand row, a **Retatrutide** 7-day medication-phase bar, the date/mesocycle header, an AI **"Reggeli briefing"** card, the **"Heartbeat"** 4×/day check-in strip, a **workout teaser** that links to Train, conditional **volleyball** and **vulnerability** cards, a **fuel timeline preview**, a **quick-stats** row, and an **insights teaser**. On a "rough" day the whole screen is replaced by **AnchorMode**, a warm-palette, low-demand recovery view.

Status per layer:
- **FE mock:** ✅ complete — all sections render synchronously from static data; URL-driven scenarios (`?day=`, `?niggle=`, `?vulnerable=`, `?retaDay=`); the demo copy (prediction line, "Stacked day" AI note) renders only in mock mode.
- **FE real:** ✅ **Slice T** (`mezo-t16y.3`) — deterministic composition over EXISTING real reads, zero new backend: header from the real date + active meso, workout teaser from Train's today session (hidden on rest days), volleyball from the real sport schedule, quick-stats from sleep/weight (HRV cell dropped — no source), check-in strip **reads** today's server rows, insights teaser from the real patterns inbox (hidden when none/degraded), fuel preview real since P5, reta phase real since mezo-d94. The **briefing prose stays static** with a „Demo tartalom" label in real mode (generated briefing = proactive epic).
- **Backend:** ✅ check-in (`feature/biometrics/checkin`) only. It lives **inside the biometrics feature** server-side (alongside weight/sleep), not a "today" package. Briefing generation/predictions remain 🟣 proactive-epic (Spring AI + RAG).

Driving design: [`docs/superpowers/specs/2026-06-03-mezo-today-design.md`](../superpowers/specs/2026-06-03-mezo-today-design.md) (Phase-1) and the honest-completion slice [`specs/2026-07-04-today-honest-completion-design.md`](../superpowers/specs/2026-07-04-today-honest-completion-design.md) + [`plans/2026-07-04-today-honest-completion.md`](../superpowers/plans/2026-07-04-today-honest-completion.md). No dedicated ADR exists for Today.

## 2. User-facing behavior

- **Open the app →** lands on `/today` (index route redirects there; `router.tsx:46`). Mock data renders synchronously, no spinner.
- **Scenario deep-links** (no production UI — URL search params only, parsed by `useTodayScenario`):
  - `?day=good|medium|rough` (default `medium`). `rough` → AnchorMode full-screen replaces the normal stack.
  - `?niggle=on|off` (default `on`) → toggles the amber niggle banner inside the workout teaser.
  - `?vulnerable=on|off` (default `off`) → shows the "sebezhetőbb hangnem" `VulnerabilityCard`.
  - `?retaDay=N` (1–7, clamped; top priority in both modes) → moves the reta phase bar's active segment and its phase descriptor. With no override, the **base** is the derived medication cycle in real mode (`useMedication().cycle.retaDay`, falling back to `today.retaDay = 3` when 0/no-dose) and `today.retaDay = 3` in mock mode (mezo-d94).
- **Check-in ("Heartbeat" strip):** tap a slot (4 slots: `06:30 · 10:00 · 14:00 · 20:00`) → opens `CheckInSheet`, a 5-step wizard. Four dimensions — Energia / Stressz / Testi / Mentális tisztaság — on a 1–10 scale with auto-advance; each shows a reactive "Mezo · azonnali olvasat" observation (`CheckInObservation`). The final step is a summary + optional one-line note. **Mentés** → the strip flips the slot optimistically (`done` + average-score badge + N/4 counter) and, in real mode, `POST`s then invalidates the day query. In **real mode the strip also READS** `GET /api/biometrics/checkin?date=today` (Slice T): saved slots survive a reload; a slot with no server row derives its state from wall-clock — current window → `now` (tap), past → `skipped` (—), future → `pending` (•).
- **Cross-slice navigation:** the `WorkoutTeaser` card and its **"Indítsuk"** CTA both `navigate('/train')`; the `InsightsTeaser` card navigates to `/insights` (Slice T). The fuel preview "Fuel → Terv" eyebrow is **visual only**; the `VolleyballCard` chevron is visual.
- **AnchorMode:** the `Kilépés` chip calls `navigate('/today')`, dropping the `?day=rough` param and returning to the normal screen.

## 3. Architecture & data flow

The single FE↔data boundary is `frontend/src/data/hooks.ts`. Since Slice T every Today hook is dual-mode via `isMockMode()`: mock returns the byte-identical Phase-1 statics; real **composes existing real reads** (`buildDayPlan` precedent — no new backend).

```
TodayPage.tsx (composition root)
  ├─ useTodayScenario()    todayHooks.ts   — URL params (+ real-mode retaDay from useMedication().cycle) → TodayScenario
  ├─ useToday()            todayHooks.ts   — { today, user, briefing, briefingDemo, workout, workoutTime,
  │                                           prediction, volleyballSessions, volleyballNote, fuelToday }
  │     mock: statics · real: useTrain() → today session (workout, null=rest day), active meso (header
  │     chips), gym slot time, sport schedule sessions; real date labels; prediction/volleyballNote = null
  ├─ useCheckins()         checkinHooks.ts — real READ (['checkins', date] → listForDay) overlaid on the 4
  │                                           canonical slots + local optimistic layer + save mutation
  ├─ resolveBriefing(ds)   todayHooks.ts   — briefing ⊕ briefingVariants[ds] (static both modes)
  ├─ useFuelPreview()      todayHooks.ts   — slices the dual-mode useFuelTimeline() plan
  ├─ useQuickStats()       todayHooks.ts   — mock: 3 static cells · real: useSleep()+useWeight() derived,
  │                                           NO HRV cell (rendered inside QuickStatsRow)
  └─ useInsightsTeaser()   todayHooks.ts   — mock: static demo · real: top proposed usePatterns() row or
                                              null → card hidden (rendered inside InsightsTeaser)

Check-in real path (read + write since Slice T):
  useQuery(['checkins', date]) → checkinApi.listForDay → GET /api/biometrics/checkin?date=…
  saveCheckIn(idx, data) → optimistic local layer → checkinApi.save → POST /api/biometrics/checkin
    → CheckInService.save (@Transactional upsert on createdBy+date+slotTime) → check_in (Postgres)
    → onSuccess invalidates ['checkins', date] → strip reconciles with the server
```

Key behavioral facts (the Today hooks live in `data/today/todayHooks.ts` + `data/today/checkinHooks.ts`, re-exported by the `hooks.ts` barrel):
- `useTodayScenario`: `dayState` falls back to `'medium'` for anything other than `good`/`rough`; `anchorMode = dayState === 'rough'`. The `retaDay` base derives from `useMedication().cycle.retaDay` in real mode (falling back to `today.retaDay` when 0), `today.retaDay` in mock mode, with the `?retaDay=` URL override on top (mezo-d94). The URL demo params **survive in real mode by design** (documented dev affordance). **Called in three places** — `TodayPage`, `AppLayout` (warm canvas), and `FuelPlanPage`/`FuelMaiPage` — so both `anchorMode` consumers must derive it identically, and every consumer issues a `['medication']` query (tests need a `QueryClientProvider`).
- `useToday` (real): header = full-HU weekday (`huWeekdayFull`) + `huMonthDay(localDateString())`; `workoutType`/`workout` = `useTrain().workout` (today's planned session, `null` on rest days → `TodayPage` hides the teaser); `user.weekInMeso` = `activeMeso.currentWeek`, `today.mesoPhase` = `phaseCurve[currentWeek-1]`, `user.mesoLabel` = `activeMeso.title` (no meso → empty → `DateMesoHeader` hides the chips); `dayInWeek` = ISO weekday (Mon=1); `workoutTime` = today's gym slot from `gymSchedule.weeklyTimes`; `volleyballSessions` = `sport.schedule.volleyball.sessions` (real `today:true` derived from the weekday); `briefingDemo: true`; `prediction`/`volleyballNote` = `null` (demo copy lives in `data/today/today.ts`, mock-only). The identity statics inside `user` (name/handle/…) are not rendered by Today — the `useProfile` decision belongs to Slice E.
- `resolveBriefing`: `briefingVariants.medium` is `null`, so `medium` returns the base `briefing`; `good`/`rough` spread their `Partial<Briefing>` over the base.
- `useCheckins`: base slots = mock seed (mock) | `buildDaySlots(serverRows, now)` (real — exported for tests); a `Record<idx, Partial<CheckinSlot>>` optimistic layer sits on top in both modes; `saveCheckIn` sets the layer and in real mode POSTs (`date = localDateString()` local-tz, `slotTime`, `state` defaulting `'done'`, dims, note), then invalidates `['checkins', date]`. Write errors surface via the global mutation-cache toast + `console.error`.
- `useFuelPreview`: **composes `useFuelTimeline()`** (Fuel P5, mezo-9ys) — finds the `now` slot in that plan, returns 3 visible slots from there plus the next incomplete `nextStack`. Dual-mode via the composed timeline, so Today's preview and the Fuel "Mai" view never diverge.
- `useQuickStats` (real): sleep = `sleepLog` last entry duration + delta vs the previous night; weight = `weightLog` last value + delta vs the previous entry; missing data → `—` value with empty delta; **the HRV cell does not exist in real mode** (no data source — strip philosophy).
- `useInsightsTeaser` (real): first `status === 'proposed'` pattern (fallback: first row) from `usePatterns()`; `confidence` absent → „tanulom" eyebrow; none/degraded → `null` and the card hides. The card navigates to `/insights` on click (both modes).

## 4. Data model & API

### Frontend types (`frontend/src/data/types.ts`)
- `DayState = 'good'|'medium'|'rough'` (:6)
- `CheckinValues { energy, stress, body, mental }` (:7); `CheckinState = 'done'|'now'|'skipped'|'pending'` (:8)
- `CheckinSlot { time, state, values|null, note|null, savedAt? }` (:9)
- `Briefing { eyebrow, body: BriefingPara[], refs: BriefingRef[], confidence, tone? }` (:10–12) — note `tone?` is **dead data** (set, never read; see §9).
- `Workout { title, tag, durationEst, exercises: WorkoutExercise[], niggleWarning }` (:13–15)
- `VolleyballSession { day, time, duration, court, intensity, role, today?, flex? }` (:16)
- `TodayMeta`, `UserMeta` (:80–81), `TodayScenario { dayState, retaDay, niggle, vulnerable, anchorMode }` (:91)
- `FuelSlot` / `FuelPlanToday` (:19–36) — consumed by the fuel preview.

### Mock data
- `frontend/src/data/today/today.ts` — `today`, `user`, `briefing`, `briefingVariants` (`good` / `medium = null` / `rough`), `workout`, `volleyballSessions` (5 sessions, **none flagged `today:true`** — see §9), the mock-only demo copy `workoutPrediction` + `volleyballNote` (Slice T — previously hardcoded in the components), re-exports `fuelToday`.
- `frontend/src/data/today/checkins.ts` — `initialCheckins`: 4 slots `06:30 done · 10:00 done · 14:00 now · 20:00 pending`.
- `frontend/src/data/fuel/fuel.ts` — `fuelToday = fuelPlan.today` (shared with the Fuel area).

### Backend check-in (the only real piece)
Contract fragment: [`api/feature/checkin/checkin.yml`](../../api/feature/checkin/checkin.yml) → merged into `api/openapi.yml` → FE types in `frontend/src/data/_client/api.gen.ts`, BE interfaces/DTOs in `io.mrkuhne.mezo.api`.

| Method + path | Operation | Returns | Consumed by FE? |
|---|---|---|---|
| `GET /api/biometrics/checkin?date=YYYY-MM-DD` | `listCheckInsForDay` | `CheckInResponse[]` | **Yes** (Slice T) — `useCheckins`'s `['checkins', date]` query hydrates the strip |
| `POST /api/biometrics/checkin` | `saveCheckIn` | `CheckInResponse` (**200**, upsert — not 201) | Yes, real mode only |

Request `SaveCheckInRequest { date, slotTime, state (regex `done\|now\|skipped\|pending`), energy/stress/body/mental (1–10), note }`.

Backend (`backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/checkin/`):
- `controller/CheckInController.java` — implements generated `CheckInApi`; injects `CurrentUserId` (server-side principal).
- `service/CheckInService.java` — `listForDay` (derived query, ordered by `slot_time`); `save` is a `@Transactional` upsert via `findByCreatedByAndDateAndSlotTime(...).orElseGet(CheckInEntity::new)`, sets `createdBy` from the principal and `savedAt = Instant.now()`. Comment notes no concurrency guard (single-user; revisit with `ON CONFLICT` for multi-device).
- `entity/CheckInEntity.java` — `extends OwnedEntity`; UUID PK (`@GeneratedValue`); soft delete `@SQLDelete`/`@SQLRestriction("is_deleted = false")`; columns `date`, `slot_time(5)`, `state(10)`, `energy/stress/body/mental` (nullable `Integer`), `note(500)`, `saved_at`.
- `repository/CheckInRepository.java` — `extends OwnedRepository<CheckInEntity>`; two derived queries.
- `mapper/CheckInMapper.java` — MapStruct; custom `Instant → OffsetDateTime` (UTC).
- Migration `backend/src/main/resources/db/changelog/1.0.0/script/202606101320_mezo-v67_create_check_in.sql` — table `check_in` with `pk_check_in_id`, `fk_check_in_created_by_app_user_id` (ON DELETE CASCADE), `uq_check_in_created_by_date_slot`, `ck_check_in_state` CHECK, `idx_check_in_created_by_date`. **No `@Profile("demodata")` seed** for check-ins (owner seed only).
- FE client `frontend/src/data/me/biometricsApi.ts:41–45` — `checkinApi.listForDay` / `checkinApi.save`; types `CheckInResponse` / `SaveCheckInBody` from `api.gen.ts`. (Today uses **only** `checkinApi` from this shared biometrics client; the `weightApi.trend` method G5 `mezo-g1u` added to the same file belongs to `useWeight` and does not touch Today.)

## 5. Integrations

Today is an **aggregation surface** — its value is in the seams to the other domains. Most are navigation-only or shared-data; only one is a live backend integration.

- **→ Train (`/train`)** — *live shared data + navigation* (Slice T). In real mode `useToday` composes `useTrain()`: the teaser renders Train's today session (`WorkoutPlan`), the header chips the active meso, the eyebrow time the weekly gym slot, and `volleyballSessions` the real sport schedule — the same TanStack cache entries the Train tab uses. `WorkoutTeaser` card click and the **"Indítsuk"** CTA both `navigate('/train')`. Mock mode keeps its own static `workout` (seam type `Workout | WorkoutPlan`). The niggle banner renders only when `workout.niggleWarning` exists (mock-only today — real niggle sources are proactive-epic); its copy is **hardcoded in `WorkoutTeaser.tsx`**, independent of `niggleWarning.detail`.
- **→ Fuel (`/fuel`)** — *shared data*. `FuelTimelinePreview` consumes `useFuelPreview`, which composes the **same dual-mode `useFuelTimeline()` plan the Fuel "Mai" view renders** (mock: `fuelPlan.today`; real: the `buildDayPlan` composition) — so the two never diverge (seam types `FuelSlot` / `FuelPlanToday`). It uses the shared `KIND_META` constant from `data/kindMeta.ts` (also used by Fuel). The "Fuel → Terv" eyebrow is **not** a nav link in current code.
- **→ Insights (`/insights`)** — *live shared data + navigation* (Slice T). `useInsightsTeaser` surfaces the top proposed pattern from the real `usePatterns()` inbox (the companion V3.1 surface); the card deep-links to `/insights` and hides when there is no pattern / the switch-off 404 degraded state.
- **→ Biometrics backend (real)** — `useCheckins` reads (`listForDay`) + writes (`save`) `feature/biometrics/checkin`; `useQuickStats` reads the sleep + weight logs (`useSleep`/`useWeight` — same cache keys as the Me tab). Server-side the check-in is a sibling of weight/sleep inside the biometrics feature, not a Today package. Since companion V0.3 the **latest check-in is also read into every chat turn's context snapshot** ([`companion.md`](companion.md) §5.5) via the `CheckInRepository.findFirstByCreatedByAndDeletedFalseOrderByDateDescSlotTimeDesc` finder — read-only, one-directional (companion → biometrics).
- **← AppLayout / shell** — `AppLayout.tsx` calls `useTodayScenario()` **itself** and passes `anchor = scenario.anchorMode && pathname.startsWith('/today')` to `PhoneFrame` (warm canvas). The contract here is the shared `TodayScenario.anchorMode` boolean: the layout's canvas and the screen's content must agree (both derive it from the same hook). The `QuickInputSheet` ("Gyors rögzítés", `features/quickinput/`) is referenced by the Today design but **owned by the shell**, not Today; its global mic Fab trigger was removed, so the sheet is currently unmounted.
- **Shared UI primitives consumed:** `RetaPhaseBar`, `QuickStat` (`shared/ui/`), plus `Eyebrow`, `PageTitle`, `Chip`, `RefTag`, `Sheet`, `Icon`/`BrandGlyph`, `CtaPrimary`, and `SafeMarkdown` (renders briefing `**bold**` without `dangerouslySetInnerHTML`).

## 6. How to use it (consume)

Mount the screen (already wired at `frontend/src/app/router.tsx:47`):

```tsx
import { TodayPage } from '@/features/today/pages/TodayPage'
// route: { path: 'today', element: <TodayPage /> }
```

Pull data through the boundary in `@/data/hooks`:

```tsx
import { useToday, useCheckins, useTodayScenario, useFuelPreview, useQuickStats, useInsightsTeaser, resolveBriefing } from '@/data/hooks'

const scenario = useTodayScenario()                  // { dayState, retaDay, niggle, vulnerable, anchorMode }
const {
  today, user, briefing, briefingDemo,               // briefingDemo: true in real mode → honest label
  workout, workoutTime, prediction,                  // workout: Workout | WorkoutPlan | null (null = hide teaser)
  volleyballSessions, volleyballNote, fuelToday,     // prediction/volleyballNote: demo copy, null in real mode
} = useToday()
const briefing = resolveBriefing(scenario.dayState)  // Briefing (variant merged over base)
const { visible, nextStack } = useFuelPreview()      // 3 upcoming FuelSlots + next incomplete stack
const stats = useQuickStats()                        // QuickStatItem[] — real: sleep+weight, no HRV
const teaser = useInsightsTeaser()                   // InsightsTeaserItem | null — null hides the card

const { checkins, saveCheckIn } = useCheckins()      // CheckinSlot[4] (real: server rows ⊕ wall-clock) + saver
saveCheckIn(idx, { state: 'done', values, note, savedAt }) // optimistic; real also POSTs + invalidates the day read
```

`useTodayScenario` is safe to call anywhere under the router (it only reads search params), so scenarios can be driven by links: `/today?day=rough`, `/today?niggle=off`, `/today?retaDay=5`.

## 7. How to extend it

**Add a new Today section/card (FE-only, mock):**
1. Create the component under `frontend/src/features/today/components/`.
2. Add a typed slice to `data/today/today.ts` (or a new `data/*.ts`) + its type in `data/types.ts`.
3. Expose it through a hook in `data/hooks.ts` (extend `useToday` or add a focused hook like `useFuelPreview`).
4. Render it in `TodayPage.tsx` (mind the AnchorMode early-return at line 23 — sections after it only show on non-rough days).
5. Add a colocated `*.test.tsx` and a parity variant in `tests/parity/foundation.spec.ts`.
Follow the design in [`docs/superpowers/specs/2026-06-03-mezo-today-design.md`](../superpowers/specs/2026-06-03-mezo-today-design.md).

**Promote a mock Today section to a real backend (the check-in is the working template):**
1. **Contract-first** — see [`docs/references/api_contract_conventions.md`](../references/api_contract_conventions.md). Add `api/feature/<name>/<name>.yml`, merge with `cd api/generate && npm run generate:api`, regenerate FE types `cd frontend && pnpm generate:api`. Never hand-write boundary DTOs.
2. **Backend** — see [`docs/references/java_package_structure.md`](../references/java_package_structure.md) and [`spring_patterns.md`](../references/spring_patterns.md). `feature/<area>/<name>/{controller,service,repository,entity,mapper}` implementing the generated `<Tag>Api`; entity `extends OwnedEntity` (UUID PK, soft delete); `CurrentUserId` set server-side.
3. **Migration** — see [`docs/references/liquibase_conventions.md`](../references/liquibase_conventions.md). `{YYYYMMDDHHMM}_{bd-id}_<desc>.sql` with explicit `pk_/fk_/uq_/ck_/idx_` names; register in the master changelog; seed in Java `@Profile("demodata")`, never SQL.
4. **Tests** — see [`docs/references/testing_standards.md`](../references/testing_standards.md) and [`integration_test_framework.md`](../references/integration_test_framework.md). Extend `ApiIntegrationTest` (verb helpers, `ownerAuthHeaders()`); **add the new table to `support/ResetDatabase.java`'s TRUNCATE list** (`check_in` is already at :39).
5. **FE swap (dual-mode obligation):** add a `*Api.ts` client mirroring `data/me/biometricsApi.ts`; in the hook, branch on `isMockMode()` with TanStack Query — mock seeds synchronously via `initialData`, real loads (mirror `useWeight` in `weightHooks.ts` / `useSleep`). Both `pnpm test` (real default) **and** `VITE_USE_MOCK=true pnpm test` must stay green.

**Adding a new quick-stat cell:** extend `useQuickStats` in `todayHooks.ts` — mock adds a static `QuickStatItem`, real derives it from an existing real read; never add a cell whose real value would be fabricated (the HRV precedent: no source → no cell).

## 8. Testing

**Unit (Vitest + RTL, colocated under `frontend/src/features/today/` and `frontend/src/data/today/`):**
- `TodayPage.test.tsx`, `CheckInStrip.test.tsx` (4 slots, N/4 count, `onCheckIn(idx)`), `CheckInSheet.test.tsx` (dimension advance, **save calls `onSave` with `state:'done'`**), `BriefingCard.test.tsx`, `WorkoutTeaser.test.tsx`, `FuelTimelinePreview.test.tsx`, `AnchorModeView.test.tsx`, and `components/{topSections,bottomSections,conditionalCards}.test.tsx`. `bottomSections.test.tsx` is mode-stubbed (`vi.stubEnv`): mock asserts the 3 static cells + static teaser, real asserts the MSW-derived sleep/weight values, the **absent HRV cell**, and the teaser's top-pattern content. `conditionalCards.test.tsx` covers `VolleyballCard` null-vs-session and note-vs-no-note (the "Stacked day" row is prop-driven).
- `data/today/todayHooks.test.tsx` — mock byte-parity (statics returned by reference) + real composition off the MSW Train fixtures (workout title, meso chips, `MAV` phase, 5 schedule sessions, null demo copy).
- `data/today/checkinHooks.test.tsx` — `buildDaySlots` wall-clock derivation + server-row overlay (pure), real-mode hydration from `listForDay`, and the existing save-POST/mock-no-fetch pair.

**Parity (Playwright @440×956)** — `frontend/tests/parity/foundation.spec.ts:82–114`: variants `today-default`, `today-good`, `today-rough-anchor`, `today-niggle-off`, `today-vulnerable`, plus the `checkin sheet` (clicks the `tap` slot) and `quickinput sheet`. Compared against the prototype `prototype-today.png`.

**Backend IT** — `backend/src/test/java/io/mrkuhne/mezo/feature/biometrics/BiometricsContractIT.java:49–68`: `testSaveCheckIn_shouldUpsertSameSlot_whenPostedTwice` (POST the same slot twice → same `id`, state updates to `skipped`; GET by date → 1 row). Extends `ApiIntegrationTest` against real Postgres; `check_in` is in `support/ResetDatabase.java:39`.

**Commands:**
```bash
cd frontend && pnpm test                       # real mode (default)
cd frontend && VITE_USE_MOCK=true pnpm test    # mock mode — both MUST be green
cd backend  && ./mvnw clean test               # ITs against the fixed mezo_test DB (compose up)
```

## 9. Decisions, gotchas & deferred

- **Decisions:** Phase-1 design in [`specs/2026-06-03-mezo-today-design.md`](../superpowers/specs/2026-06-03-mezo-today-design.md); the honest-completion decisions (check-in read-model, briefing „Demo tartalom" label vs trim, HRV cell drop, demo params surviving real mode) in [`specs/2026-07-04-today-honest-completion-design.md`](../superpowers/specs/2026-07-04-today-honest-completion-design.md). No dedicated ADR in `docs/decisions/`.
- **GOTCHA — `VolleyballCard` never renders in MOCK mode's default screen.** `TodayPage` does `volleyballSessions.find(s => s.today)`, and no mock session carries `today:true` — the card is exercised in mock only via tests. In **real mode** `today:true` derives from the weekday in `toSportSchedule` (`trainHooks.ts`), so the card appears on real schedule days.
- **GOTCHA — `briefing.tone` is dead data.** Set in `briefingVariants` (`energetic` / `supportive`) but `BriefingCard` never reads it. (The only consumed `tone` is the in-sheet `CheckInObservation` tone, computed locally.)
- **GOTCHA — niggle-banner copy is hardcoded** in `WorkoutTeaser.tsx`, decoupled from `workout.niggleWarning.detail` (mock-only surface: real workouts carry no `niggleWarning`, so the banner never renders in real mode).
- **GOTCHA — `useToday().fuelToday` is the mock seed in both modes.** No component consumes it (the fuel preview goes through `useFuelPreview`); it is kept only for hook-signature stability — flag for the Phase-2 exit audit (X slice) cleanup.
- **Real-mode check-in derivation:** a past slot with no server row renders `skipped` (—) — an honest "missed", not `pending`; the current window is `now`; the strip reconciles with the server after every save (invalidate), so multi-device/day-reload states converge.
- **Local-date correctness:** the day read + `saveCheckIn` use `localDateString()` (`Intl en-CA`, local tz) — deliberately not UTC slicing, so evening entries don't shift to the next day. See `shared/lib/dates.ts`.
- **Scenario duplication:** `useTodayScenario` is called in both `TodayPage` and `AppLayout`; both must derive `anchorMode` consistently for the warm canvas and the content to match.
- **Known console noise (pre-existing, `mezo-edrv`):** `useGoal`'s queryFn-less `['weightLog']` read-only query floods the console with TanStack errors on every Today load (mounted via `useFuelTimeline`); present before Slice T on the baseline too.
- **Deferred / proactive-epic:** generated briefing prose (the „Demo tartalom" card), real predictions (`prediction` stays null), real niggle/vulnerable sources, AnchorMode triggered by real signals, HRV (needs a data source first), QuickInputSheet re-mount.

## 10. Key files

**Frontend — screen + components** (`frontend/src/features/today/`):
- `TodayPage.tsx` — composition root, AnchorMode branch, `CheckInSheet` wiring.
- `CheckInStrip.tsx` / `CheckInSheet.tsx` (incl. `CHECKIN_DIMS`, `CheckInObservation`) / `AnchorModeView.tsx` — heartbeat strip, wizard sheet, recovery view.
- `components/`: `BrandRow.tsx`, `RetaPhaseSection.tsx`, `DateMesoHeader.tsx`, `BriefingCard.tsx`, `WorkoutTeaser.tsx`, `VolleyballCard.tsx`, `VulnerabilityCard.tsx`, `FuelTimelinePreview.tsx`, `QuickStatsRow.tsx`, `InsightsTeaser.tsx`.

**Frontend — data & lib:**
- `frontend/src/data/today/todayHooks.ts` (+ `todayHooks.test.tsx`) — `useTodayScenario`, `resolveBriefing`, `useToday`, `useFuelPreview`, `useQuickStats`, `useInsightsTeaser`; `checkinHooks.ts` (+ test, incl. `buildDaySlots`) — `useCheckins`; all re-exported by the `data/hooks.ts` barrel.
- `frontend/src/data/today/today.ts` (incl. `workoutPrediction`, `volleyballNote`), `checkins.ts`, `kindMeta.ts`, `types.ts` (`TodayMeta`/`UserMeta`/`WorkoutPrediction`/`QuickStatItem`/`InsightsTeaserItem`), `fuel.ts` (`fuelToday`).
- `frontend/src/data/me/biometricsApi.ts` (`checkinApi`), `data/_client/mode.ts`, `shared/lib/dates.ts`, `data/_client/api.ts` (`apiFetch`/`setToken`), `shared/lib/safeMarkdown.tsx`.
- `frontend/src/shared/ui/RetaPhaseBar.tsx`, `QuickStat.tsx` — shared primitives.
- `frontend/src/app/AppLayout.tsx` (anchor wiring), `router.tsx:47`, `PhoneFrame.tsx`.
- `frontend/tests/parity/foundation.spec.ts:82–114` — parity variants.

**API contract:** `api/feature/checkin/checkin.yml` → `api/openapi.yml` → `frontend/src/data/_client/api.gen.ts` + backend `io.mrkuhne.mezo.api` (`CheckInApi`, `CheckInResponse`, `SaveCheckInRequest`).

**Backend** (`backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/checkin/`): `controller/CheckInController.java`, `service/CheckInService.java`, `entity/CheckInEntity.java`, `repository/CheckInRepository.java`, `mapper/CheckInMapper.java`. Migration `backend/src/main/resources/db/changelog/1.0.0/script/202606101320_mezo-v67_create_check_in.sql`. Tests `backend/src/test/java/io/mrkuhne/mezo/feature/biometrics/BiometricsContractIT.java`, `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java:39` (top-level test `support/`, not under biometrics).

**Docs:** [`docs/superpowers/specs/2026-06-03-mezo-today-design.md`](../superpowers/specs/2026-06-03-mezo-today-design.md), [`docs/superpowers/plans/2026-06-03-today-slice1.md`](../superpowers/plans/2026-06-03-today-slice1.md); house standards in [`docs/references/`](../references/).
