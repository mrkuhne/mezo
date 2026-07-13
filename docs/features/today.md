---
title: Today
type: feature-domain
status: mixed
updated: 2026-07-13
tags: [today, biometrics, frontend, data-layer]
key_files:
  - frontend/src/features/today
  - frontend/src/data/today
  - frontend/src/data/me/biometricsApi.ts
  - api/feature/checkin/checkin.yml
  - backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/checkin
related: [_platform-data-layer, _platform-design-system, me, insights, train, growth]
---

# Today — Feature Documentation

> The daily home / morning-briefing screen at route `/today` (tab "Ma"), the PWA's default landing page. **Status: 🟢/🔶 mixed** — since **Slice T** (`mezo-t16y.3`, 2026-07-04) every section is real in real mode (deterministic composition over existing real reads) or an explicit honest state. Since **proactive B1.2** (`mezo-h4wp.2`, 2026-07-06) even the **briefing prose** is real: the card renders the companion's own generated morning words when present ([proactive.md](proactive.md)), and the static „Demo tartalom" card survives only as the **honest fallback** (loading / 404 / switch off). Since the **Napív S3 Today re-composition** (`mezo-8141`, 2026-07-13) the screen was rebuilt hero-first: a daypart-aware `GreetingHeader` + `DayArc` visual replace the old Retatrutide phase bar and date/meso header, the workout teaser (or, on rest days, the day's volleyball session) is the hero, and the daily-quests/activity-log cards relocated to `/me/growth` — Today keeps only a one-row `GrowthTodayRow` summary.

## 1. Summary

**Today** ("Ma") is mezo's daily aggregation surface — the screen the user sees first every morning. It stacks the day's signals into one vertical scroll, in this order: a brand row (✨ = the only Insights entry point), a **daypart-aware greeting** (name + reta day inline), a **day-arc** visual (check-in beats + workout/sleep markers + a "sun" progress dot along the day), the **hero** — the workout teaser on a training day, or the day's **volleyball** session on a rest day — a collapsible AI **"Reggeli briefing"** card, conditional **companion-note** and **vulnerability** cards, the **"Heartbeat"** 4×/day check-in strip, the volleyball session again as a secondary row **only** when it wasn't already the hero, a **quick-stats** row, a **fuel timeline preview**, and a one-row **Growth** summary linking to `/me/growth`. On a "rough" day the whole screen is replaced by **AnchorMode**, a warm-palette, low-demand recovery view.

Status per layer:
- **FE mock:** ✅ complete — all sections render synchronously from static data; URL-driven scenarios (`?day=`, `?niggle=`, `?vulnerable=`, `?retaDay=`); the demo copy (prediction line, "Stacked day" AI note) renders only in mock mode.
- **FE real:** ✅ **Slice T** (`mezo-t16y.3`) — deterministic composition over EXISTING real reads, zero new backend: header from the real date + active meso, workout teaser from Train's today session (hidden on rest days), volleyball from the real sport schedule, quick-stats from sleep/weight (HRV cell dropped — no source), check-in strip **reads** today's server rows, fuel preview real since P5, reta day real since mezo-d94. Since **proactive B1.2** (`mezo-h4wp.2`) the **briefing prose is real too** (`useBriefing` → `useToday`): the generated card when present, the „Demo tartalom" static card only as the honest fallback.
- **Backend:** ✅ check-in (`feature/biometrics/checkin`) only. It lives **inside the biometrics feature** server-side (alongside weight/sleep), not a "today" package. The generated briefing is served by the `feature/proactive` package ([proactive.md](proactive.md)) — Today READS it via `useBriefing`, there is no "today" briefing backend; predictions remain 🟣 proactive-epic (P stage).

Driving design: [`docs/superpowers/specs/2026-06-03-mezo-today-design.md`](../superpowers/specs/2026-06-03-mezo-today-design.md) (Phase-1) and the honest-completion slice [`specs/2026-07-04-today-honest-completion-design.md`](../superpowers/specs/2026-07-04-today-honest-completion-design.md) + [`plans/2026-07-04-today-honest-completion.md`](../superpowers/plans/2026-07-04-today-honest-completion.md). No dedicated ADR exists for Today.

## 2. User-facing behavior

- **Open the app →** lands on `/today` (index route redirects there; `router.tsx:46`). Mock data renders synchronously, no spinner.
- **Greeting + day arc (Napív S3, `mezo-8141`):** `GreetingHeader` shows the day label + date + `Reta D{n}` inline, and a daypart-driven headline (`Szép reggelt` / `Szia` / `Szép estét`, `shared/lib/daypart.ts`). Directly under it `DayArc` draws an SVG arc with one dot per check-in beat (colored by state) + a workout marker (hidden on rest days, `workoutTime === null`) + a "sun" dot at the current wall-clock progress along the day (`role="img"`, `aria-label="A napod íve"`). Both are pure presentational components fed from the same `useToday()`/`useTodayScenario()`/`useCheckins()` data TodayPage already holds — no new hooks. The old **Retatrutide 7-day phase bar** and the **date/mesocycle header** (`RetaPhaseSection.tsx`/`DateMesoHeader.tsx`) were removed from Today in this slice — the reta day now lives in the greeting line only, and the W/D + phase-chip meso context (Train-domain info) is not surfaced on Today anymore (available on the Train tab). The full 7-segment `RetaPhaseBar` still renders elsewhere (Fuel "Mai" + the Gyógyszer/medication page).
- **Hero (workout or volleyball):** on a training day the `WorkoutTeaser` is the hero (unchanged card, same props). On a **rest day** (`workout` falsy) the day's `VolleyballCard` — the same secondary-row component, no new hero variant — renders in the hero slot instead **if** a session is flagged `today`; a session already shown as hero is **never** repeated further down. When there IS a workout, a same-day volleyball session (if any) shows again as its usual secondary row, after the check-in strip.
- **Reggeli briefing card:** in real mode it renders the companion's **generated** morning prose + real reference chips when a server briefing exists (no label); when there is none yet — loading, no narrative memory (404), or the companion/proactive switch is off — it falls back to the **static demo card behind the „Demo tartalom" label**. Mock mode always shows the static card. Behavior detail in [proactive.md §2](proactive.md). Since the **Napív S3** collapse (`mezo-8141`, 2026-07-13) the card is **collapsed by default**: only the eyebrow header + the first paragraph (2-line CSS clamp, `.brief`/`.brief-clamp`) plus a **`bővebben`** button — no refs row, no confidence/demo chip. Tapping `bővebben` expands to the full card (all paragraphs, refs row, confidence/demo chip, `összecsuk` to re-collapse); local `useState`, resets to collapsed on remount.
- **Companion note card (H1, real mode only):** rendered right after the briefing card, above the vulnerability card and the check-in strip, a `CompanionNoteCard` shows the companion's **in-day note** — a midday nudge („Mezo · napközbeni jegyzet") or an evening closing („Mezo · napzárás") — when `useCompanionNote()` has one. **Honest absence:** before the first window, without narrative memory, or on 404 there is simply **no card**; mock mode never shows one (Phase-1 byte-parity). Detail in [proactive.md §2](proactive.md).
- **Growth summary row (Napív S3, `mezo-8141`):** the day's daily-quests card and activity-log card **relocated to `/me/growth`** (`GrowthPage.tsx`'s "Ma" block) — see [growth.md](growth.md) for that domain. Today keeps only `GrowthTodayRow`, a one-row `🌱 Növekedés ma` summary (`{done}/{total} küldetés · +{xp} XP`) linking to `/me/growth`; it consumes `useDailyQuests`/`useActivities` directly (not via `DailyQuestsCard`) and **ghosts** (renders `null`) when both sources are empty — real mode must not show anything before the backend has data for today.
- **Scenario deep-links** (no production UI — URL search params only, parsed by `useTodayScenario`):
  - `?day=good|medium|rough` (default `medium`). `rough` → AnchorMode full-screen replaces the normal stack.
  - `?niggle=on|off` (default `on`) → toggles the amber niggle banner inside the workout teaser.
  - `?vulnerable=on|off` (default `off`) → shows the "sebezhetőbb hangnem" `VulnerabilityCard`.
  - `?retaDay=N` (1–7, clamped; top priority in both modes) → moves the greeting line's `Reta D{n}` text (since the Napív S3 removal of the on-page phase bar). With no override, the **base** is the derived medication cycle in real mode (`useMedication().cycle.retaDay`, falling back to `today.retaDay = 3` when 0/no-dose) and `today.retaDay = 3` in mock mode (mezo-d94).
- **Check-in ("Heartbeat" strip):** tap a slot (4 slots: `06:30 · 10:00 · 14:00 · 20:00`) → opens `CheckInSheet`, a 5-step wizard. Four dimensions — Energia / Stressz / Testi / Mentális tisztaság — on a 1–10 scale with auto-advance; each shows a reactive "Mezo · azonnali olvasat" observation (`CheckInObservation`). The final step is a summary + optional one-line note. **Mentés** → the strip flips the slot optimistically (`done` + average-score badge + N/4 counter) and, in real mode, `POST`s then invalidates the day query. In **real mode the strip also READS** `GET /api/biometrics/checkin?date=today` (Slice T): saved slots survive a reload; a slot with no server row derives its state from wall-clock — current window → `now` (koppints), past → `skipped` (—), future → `pending` (·). Since the **Napív S3** restyle (Task 6, `mezo-8141`) the section header reads **`Hogy vagy ma?`** + the `N/4` counter (`.secthead-np`, replacing the old mono "Heartbeat · 4×/nap" eyebrow) above a row of pill-shaped `.beat` buttons (`.beat.done`/`.beat.now` colored, `.beat.now` pulses via `::after`); behavior/props are unchanged; the same `checkins` array also feeds `DayArc`'s beat dots. The **quick-stats row** got the same header treatment (**`Ma eddig`**) and its cells became `.scard` mini-ring cards (`QuickStat.tsx`, `shared/ui/`): a 34×34 SVG ring (`--warm` track + a colored progress arc — alvás/hrv → `--lav`, súly/fehérje → `--sage`, kcal → `--coral`) next to the label/value. Only **alvás** derives a real fill % (vs. a hardcoded 8h natural target, since no goal-sleep hook is consumed here); every other cell (súly, hrv, and the not-yet-emitted kcal/fehérje) renders a full ring as a decorative chip — no new hook consumption, no fabricated targets.
- **Cross-slice navigation:** the `WorkoutTeaser` card and its **"Indítsuk"** CTA both `navigate('/train')`; the fuel preview "Fuel → Terv" eyebrow is **visual only**; the `VolleyballCard` chevron is visual; `GrowthTodayRow` links to `/me/growth`. The header row (`BrandRow.tsx`) carries a direct `<Link to="/insights" aria-label="Insights">` ✨ button — since the Napív S3 removal of `InsightsTeaser`, this ✨ is the **only** way Insights is reached from Today (the bottom tab bar also dropped its Insights tab, `mezo-8141`).
- **AnchorMode:** the `Kilépés` chip calls `navigate('/today')`, dropping the `?day=rough` param and returning to the normal screen.

## 3. Architecture & data flow

The single FE↔data boundary is `frontend/src/data/hooks.ts`. Since Slice T every Today hook is dual-mode via `isMockMode()`: mock returns the byte-identical Phase-1 statics; real **composes existing real reads** (`buildDayPlan` precedent — no new backend).

```
TodayPage.tsx (composition root)
  ├─ useTodayScenario()    todayHooks.ts   — URL params (+ real-mode retaDay from useMedication().cycle) → TodayScenario
  ├─ useToday()            todayHooks.ts   — { today, user, briefing, briefingDemo, workout, workoutTime,
  │                                           prediction, volleyballSessions, volleyballNote, fuelToday }
  │     briefing = useBriefing() (composed); briefingDemo = serverBriefing == null
  │     mock: statics · real: useTrain() → today session (workout, null=rest day), active meso (header
  │     chips), gym slot time, sport schedule sessions; real date labels; prediction/volleyballNote = null
  ├─ useCheckins()         checkinHooks.ts — real READ (['checkins', date] → listForDay) overlaid on the 4
  │                                           canonical slots + local optimistic layer + save mutation
  ├─ useBriefing()         briefingHooks.ts — real GET /api/proactive/briefing?date=<local> → Briefing|null
  │                                           (404/switch-off/loading → null); mock: null synchronously (no fetch)
  ├─ useCompanionNote()    heartbeatHooks.ts — real GET /api/proactive/heartbeat?date=<local> → CompanionNote|null
  │                                           (H1; 404/loading → null ⇒ NO card); mock: null synchronously
  ├─ resolveBriefing(ds)   todayHooks.ts   — the FALLBACK card: briefing ⊕ briefingVariants[ds] (static both
  │                                           modes) — used at TodayPage:35 only when useToday().briefing is null
  ├─ useFuelPreview()      todayHooks.ts   — slices the dual-mode useFuelTimeline() plan
  └─ useQuickStats()       todayHooks.ts   — mock: 3 static cells · real: useSleep()+useWeight() derived,
                                              NO HRV cell (rendered inside QuickStatsRow)

useInsightsTeaser() (todayHooks.ts) is ORPHANED since the Napív S3 removal of InsightsTeaser.tsx
(mezo-8141) — still exported by the data/hooks.ts barrel but no longer consumed anywhere (§9).

Check-in real path (read + write since Slice T):
  useQuery(['checkins', date]) → checkinApi.listForDay → GET /api/biometrics/checkin?date=…
  saveCheckIn(idx, data) → optimistic local layer → checkinApi.save → POST /api/biometrics/checkin
    → CheckInService.save (@Transactional upsert on createdBy+date+slotTime) → check_in (Postgres)
    → onSuccess invalidates ['checkins', date] → strip reconciles with the server
```

Key behavioral facts (the Today hooks live in `data/today/todayHooks.ts` + `data/today/checkinHooks.ts`, re-exported by the `hooks.ts` barrel):
- `useTodayScenario`: `dayState` falls back to `'medium'` for anything other than `good`/`rough`; `anchorMode = dayState === 'rough'`. The `retaDay` base derives from `useMedication().cycle.retaDay` in real mode (falling back to `today.retaDay` when 0), `today.retaDay` in mock mode, with the `?retaDay=` URL override on top (mezo-d94). The URL demo params **survive in real mode by design** (documented dev affordance). **Called in three places** — `TodayPage`, `AppLayout` (warm canvas), and `FuelPlanPage`/`FuelMaiPage` — so both `anchorMode` consumers must derive it identically, and every consumer issues a `['medication']` query (tests need a `QueryClientProvider`).
- `useToday` (real): header = full-HU weekday (`huWeekdayFull`) + `huMonthDay(localDateString())`; `workoutType`/`workout` = `useTrain().workout` (today's planned session, `null` on rest days → `TodayPage` swaps the hero to volleyball); `user.weekInMeso`/`today.mesoPhase`/`user.mesoLabel` derive from `activeMeso` same as before, but since Napív S3 (`mezo-8141`) **no Today component reads them anymore** (they were only consumed by the removed `DateMesoHeader`) — kept on the `TodayData` shape for signature stability, unused; `dayInWeek` = ISO weekday (Mon=1); `workoutTime` = today's gym slot from `gymSchedule.weeklyTimes` — fed to both `WorkoutTeaser`'s eyebrow AND `DayArc`'s workout marker (same value, `null` hides both); `volleyballSessions` = `sport.schedule.volleyball.sessions` (real `today:true` derived from the weekday); **`briefing` = `useBriefing()`** (the generated server briefing or `null`), **`briefingDemo = serverBriefing == null`** (so demo=false only when a real briefing is present, proactive B1.2 — mezo-h4wp.2); `prediction`/`volleyballNote` = `null` (demo copy lives in `data/today/today.ts`, mock-only). The identity statics inside `user` (name/handle/…) are not rendered by Today — the `useProfile` decision belongs to Slice E.
- `GreetingHeader`/`DayArc` (pure, no own hooks): `GreetingHeader({ today, user, retaDay, now? })` picks the daypart from `daypartNow(now)` (`shared/lib/daypart.ts`); `DayArc({ checkins, workoutTime, now? })` derives its dot positions from `features/today/logic/dayArc.ts` (`buildArcPoints`/`arcProgress`/`pointXY`, pure + unit-tested). Both take `now` as an optional override for tests; default `new Date()`.
- `useBriefing` (`data/today/briefingHooks.ts`): real mode `useQuery(['briefing', localDateString()])` → `briefingApi.get` (`GET /api/proactive/briefing?date=`), 404→`null`, `retry:false`; mock mode returns `null` synchronously via `initialData` (no fetch, no loading frame → byte-parity with the pre-B1.2 fallback). Composed into `useToday`, re-exported by the `data/hooks.ts` barrel.
- `resolveBriefing`: the **static fallback only** — `TodayPage:35` renders `useToday().briefing ?? resolveBriefing(scenario.dayState)`, so `resolveBriefing` (and `briefingVariants`) shape the card ONLY when no server briefing exists. `briefingVariants.medium` is `null`, so `medium` returns the base `briefing`; `good`/`rough` spread their `Partial<Briefing>` over the base. A generated briefing is rendered verbatim (variants never apply to it).
- `useCheckins`: base slots = mock seed (mock) | `buildDaySlots(serverRows, now)` (real — exported for tests); a `Record<idx, Partial<CheckinSlot>>` optimistic layer sits on top in both modes; `saveCheckIn` sets the layer and in real mode POSTs (`date = localDateString()` local-tz, `slotTime`, `state` defaulting `'done'`, dims, note), then invalidates `['checkins', date]`. Write errors surface via the global mutation-cache toast + `console.error`.
- `useFuelPreview`: **composes `useFuelTimeline()`** (Fuel P5, mezo-9ys) — finds the `now` slot in that plan, returns 3 visible slots from there plus the next incomplete `nextStack`. Dual-mode via the composed timeline, so Today's preview and the Fuel "Mai" view never diverge.
- `useQuickStats` (real): sleep = `sleepLog` last entry duration + delta vs the previous night; weight = `weightLog` last value + delta vs the previous entry; missing data → `—` value with empty delta; **the HRV cell does not exist in real mode** (no data source — strip philosophy).
- `useInsightsTeaser` (real): first `status === 'proposed'` pattern (fallback: first row) from `usePatterns()`; `confidence` absent → „tanulom" eyebrow; none/degraded → `null`. **Orphaned since `mezo-8141`** (§9) — no component renders its result anymore; the hook still works and is unit-tested, just unconsumed.

## 4. Data model & API

### Frontend types (`frontend/src/data/types.ts`)
- `DayState = 'good'|'medium'|'rough'` (:6)
- `CheckinValues { energy, stress, body, mental }` (:7); `CheckinState = 'done'|'now'|'skipped'|'pending'` (:8)
- `CheckinSlot { time, state, values|null, note|null, savedAt? }` (:9)
- `Briefing { eyebrow, body: BriefingPara[], refs: BriefingRef[], confidence?, tone? }` (:12) — `confidence?` went **optional** at proactive B1.2 (server briefings carry none — the fabricated-number rule); `tone?` is **dead data** (set, never read; see §9).
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
- **→ Insights (`/insights`)** — *navigation only*, since the Napív S3 removal of `InsightsTeaser` (`mezo-8141`). No live-data teaser remains on Today; the sole entry point is the ✨ `<Link>` in `BrandRow.tsx`. `useInsightsTeaser` (the hook that used to back the teaser) is now orphaned — see §9.
- **→ Biometrics backend (real)** — `useCheckins` reads (`listForDay`) + writes (`save`) `feature/biometrics/checkin`; `useQuickStats` reads the sleep + weight logs (`useSleep`/`useWeight` — same cache keys as the Me tab). Server-side the check-in is a sibling of weight/sleep inside the biometrics feature, not a Today package. Since companion V0.3 the **latest check-in is also read into every chat turn's context snapshot** ([`companion.md`](companion.md) §5.5) via the `CheckInRepository.findFirstByCreatedByAndDeletedFalseOrderByDateDescSlotTimeDesc` finder — read-only, one-directional (companion → biometrics).
- **→ Growth (`/me/growth`, quests + activity log, `mezo-df7q` / `mezo-jzca` / relocated `mezo-8141`)** — *live shared data + navigation*. `DailyQuestsCard`/`ActivityLogCard` (+ `ActivityLogSheet`) — consuming `useDailyQuests`/`useQuestActions`/`useActivities`/`useActivityActions`, `data/quest/` + `data/activity/`, keys `['dailyQuests', date]`/`['activities', date]` — now mount on **`GrowthPage.tsx`**'s "Ma" block (cross-feature import of the SAME component files under `features/today/components/` — they did not move); the read itself still triggers server-side lazy quest generation + DERIVED evaluation, and both surfaces' completion payloads still feed the global `LevelUpProvider` overlay via `useLevelUp` (now only reachable through `GrowthPage`, which wraps `LevelUpProvider` in its tests — production mounts it once in `AppLayout`). Today itself only renders **`GrowthTodayRow`**, which reads `useDailyQuests`/`useActivities` directly (`features/today/logic/growthToday.ts` derives `{done, total, xp}`) and links to `/me/growth`; it never calls `useLevelUp` and never opens `ActivityLogSheet`. Domain doc: [growth.md](growth.md).
- **← AppLayout / shell** — `AppLayout.tsx` calls `useTodayScenario()` **itself** and passes `anchor = scenario.anchorMode && pathname.startsWith('/today')` to `PhoneFrame` (warm canvas). The contract here is the shared `TodayScenario.anchorMode` boolean: the layout's canvas and the screen's content must agree (both derive it from the same hook). The `QuickInputSheet` (`features/quickinput/`) is referenced by the original Today design but **owned by the shell**, not Today — since the Napív redesign (`mezo-8141`) it's a 6-tile quick-log grid mounted by `TabBar`'s center FAB (`aria-label="Gyors logolás"`), not by anything in Today itself.
- **Shared UI primitives consumed:** `RetaPhaseBar`, `QuickStat` (`shared/ui/`), plus `Eyebrow`, `PageTitle`, `Chip`, `RefTag`, `Sheet`, `Icon`/`BrandGlyph`, `CtaPrimary`, and `SafeMarkdown` (renders briefing `**bold**` without `dangerouslySetInnerHTML`).

## 6. How to use it (consume)

Mount the screen (already wired at `frontend/src/app/router.tsx:47`):

```tsx
import { TodayPage } from '@/features/today/pages/TodayPage'
// route: { path: 'today', element: <TodayPage /> }
```

Pull data through the boundary in `@/data/hooks`:

```tsx
import { useToday, useCheckins, useTodayScenario, useFuelPreview, useQuickStats, resolveBriefing } from '@/data/hooks'

const scenario = useTodayScenario()                  // { dayState, retaDay, niggle, vulnerable, anchorMode }
const {
  today, user, briefing, briefingDemo,               // briefingDemo: true in real mode → honest label
  workout, workoutTime, prediction,                  // workout: Workout | WorkoutPlan | null (null = rest day, hero swaps to volleyball)
  volleyballSessions, volleyballNote, fuelToday,     // prediction/volleyballNote: demo copy, null in real mode
} = useToday()
const briefing = resolveBriefing(scenario.dayState)  // Briefing (variant merged over base)
const { visible, nextStack } = useFuelPreview()      // 3 upcoming FuelSlots + next incomplete stack
const stats = useQuickStats()                        // QuickStatItem[] — real: sleep+weight, no HRV
// useInsightsTeaser also exists on the barrel but is orphaned since mezo-8141 — no component renders it (§9).

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
5. Add a colocated `*.test.tsx`.
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
- `TodayPage.test.tsx` — composition-level tests: the Napív render order (greeting `h1`, `DayArc`'s `role="img"`, hero workout text, briefing, check-in strip, quick stats), the removed sections' absence (reta phase bar / meso date header / insights teaser text), the `?day=rough`/`?vulnerable=on` scenarios, and — since `mezo-8141` — the **hero-slot swap**: `useToday` is mocked (`vi.mock('@/data/hooks', ...)`, only that one hook; `useTodayScenario`/`useCheckins`/etc. stay real via `importOriginal`) so a rest day (`workout: null`) deterministically renders the day's volleyball session in the hero slot and a workout day renders it once, only as the secondary row — regression-guards the "never both" invariant.
- `GreetingHeader.test.tsx` (daypart headline + `Reta D{n}` text across morning/afternoon/evening `now` overrides), `DayArc.test.tsx` (one `.arc-dot` per check-in + workout marker present/absent, one `.arc-sun`, point labels), `GrowthTodayRow.test.tsx` (done/total/xp derivation from `useDailyQuests`/`useActivities`, the empty-both ghost, `/me/growth` link) — its pure derivation lives in `logic/growthToday.test.ts`.
- `CheckInStrip.test.tsx` (4 slots, N/4 count, `onCheckIn(idx)`), `CheckInSheet.test.tsx` (dimension advance, **save calls `onSave` with `state:'done'`**), `BriefingCard.test.tsx`, `WorkoutTeaser.test.tsx`, `FuelTimelinePreview.test.tsx`, `AnchorModeView.test.tsx`, and `components/{topSections,bottomSections,conditionalCards}.test.tsx`. Since `mezo-8141` `topSections.test.tsx` covers only `BrandRow` (its `RetaPhaseSection`/`DateMesoHeader` cases were removed with those components) and `bottomSections.test.tsx` covers only `QuickStatsRow` (its `InsightsTeaser` cases were removed with that component). `bottomSections.test.tsx` is mode-stubbed (`vi.stubEnv`): mock asserts the 3 static cells, real asserts the MSW-derived sleep/weight values and the **absent HRV cell**. `conditionalCards.test.tsx` covers `VolleyballCard` null-vs-session and note-vs-no-note (the "Stacked day" row is prop-driven) + `VulnerabilityCard`.
- `data/today/todayHooks.test.tsx` — mock byte-parity (statics returned by reference) + real composition off the MSW Train fixtures (workout title, meso chips, `MAV` phase, 5 schedule sessions, null demo copy).
- `data/today/checkinHooks.test.tsx` — `buildDaySlots` wall-clock derivation + server-row overlay (pure), real-mode hydration from `listForDay`, and the existing save-POST/mock-no-fetch pair.

**Parity (Playwright @440×956)** — Pixel-parity vs the Phase-1 prototype retired 2026-07-13 by the Napív redesign (mezo-8141); visual self-baselines return in S8.

**Backend IT** — `backend/src/test/java/io/mrkuhne/mezo/feature/biometrics/BiometricsContractIT.java:49–68`: `testSaveCheckIn_shouldUpsertSameSlot_whenPostedTwice` (POST the same slot twice → same `id`, state updates to `skipped`; GET by date → 1 row). Extends `ApiIntegrationTest` against real Postgres; `check_in` is in `support/ResetDatabase.java:39`.

**Commands:**
```bash
cd frontend && pnpm test                       # real mode (default)
cd frontend && VITE_USE_MOCK=true pnpm test    # mock mode — both MUST be green
cd backend  && ./mvnw clean test               # ITs against the fixed mezo_test DB (compose up)
```

## 9. Decisions, gotchas & deferred

- **Decisions:** Phase-1 design in [`specs/2026-06-03-mezo-today-design.md`](../superpowers/specs/2026-06-03-mezo-today-design.md); the honest-completion decisions (check-in read-model, briefing „Demo tartalom" label vs trim, HRV cell drop, demo params surviving real mode) in [`specs/2026-07-04-today-honest-completion-design.md`](../superpowers/specs/2026-07-04-today-honest-completion-design.md). No dedicated ADR in `docs/decisions/`.
- **GOTCHA — `VolleyballCard` never renders in MOCK mode's default screen.** `TodayPage` does `volleyballSessions.find(s => s.today)`, and no mock session carries `today:true` — the card is exercised in mock only via tests. In **real mode** `today:true` derives from the weekday in `toSportSchedule` (`trainHooks.ts`), so the card appears on real schedule days — **in the hero slot on a rest day, or as the secondary row after the check-in strip on a training day, never both** (`mezo-8141`).
- **GOTCHA — `useInsightsTeaser` is orphaned** since the Napív S3 removal of `InsightsTeaser.tsx` (`mezo-8141`, 2026-07-13): still exported by `todayHooks.ts` / the `data/hooks.ts` barrel, but no component consumes it anymore. Candidate for deletion in a future cleanup (X-slice exit audit) alongside the `fuelToday` gotcha below.
- **GOTCHA — `useToday()`'s meso fields (`today.mesoPhase`, `user.weekInMeso`, `user.dayInWeek`, `user.mesoLabel`) are unconsumed by any Today component** since `DateMesoHeader.tsx` was removed (`mezo-8141`) — kept on the `TodayData` shape only for signature stability (Train still reads the equivalent data from `useTrain()` directly).
- **GOTCHA — `briefing.tone` is dead data.** Set in `briefingVariants` (`energetic` / `supportive`) but `BriefingCard` never reads it. (The only consumed `tone` is the in-sheet `CheckInObservation` tone, computed locally.)
- **GOTCHA — niggle-banner copy is hardcoded** in `WorkoutTeaser.tsx`, decoupled from `workout.niggleWarning.detail` (mock-only surface: real workouts carry no `niggleWarning`, so the banner never renders in real mode).
- **GOTCHA — `useToday().fuelToday` is the mock seed in both modes.** No component consumes it (the fuel preview goes through `useFuelPreview`); it is kept only for hook-signature stability — flag for the Phase-2 exit audit (X slice) cleanup.
- **Real-mode check-in derivation:** a past slot with no server row renders `skipped` (—) — an honest "missed", not `pending`; the current window is `now`; the strip reconciles with the server after every save (invalidate), so multi-device/day-reload states converge.
- **Local-date correctness:** the day read + `saveCheckIn` use `localDateString()` (`Intl en-CA`, local tz) — deliberately not UTC slicing, so evening entries don't shift to the next day. See `shared/lib/dates.ts`.
- **Scenario duplication:** `useTodayScenario` is called in both `TodayPage` and `AppLayout`; both must derive `anchorMode` consistently for the warm canvas and the content to match.
- **Known console noise (pre-existing, `mezo-edrv`):** `useGoal`'s queryFn-less `['weightLog']` read-only query floods the console with TanStack errors on every Today load (mounted via `useFuelTimeline`); present before Slice T on the baseline too.
- **Generated briefing shipped (proactive B1.2, `mezo-h4wp.2`).** The briefing card is now real in real mode (`useBriefing` → `useToday`, `briefing: Briefing | null`, fallback at `TodayPage:35`); the „Demo tartalom" static card is only the honest fallback (loading / 404 / switch off) and the mock-mode card. `resolveBriefing` + `briefingVariants` shape ONLY that fallback, never a generated briefing. `Briefing.confidence` went optional to model the server shape. Full behavior + backend in [proactive.md](proactive.md).
- **Deferred / proactive-epic:** real predictions (`prediction` stays null), real niggle/vulnerable sources, AnchorMode triggered by real signals, HRV (needs a data source first). (`QuickInputSheet` was re-mounted by the Napív redesign, `mezo-8141` — see [_platform-design-system.md](_platform-design-system.md).)

## 10. Key files

**Frontend — screen + components** (`frontend/src/features/today/`):
- `TodayPage.tsx` — composition root, AnchorMode branch, hero-slot swap (workout vs. rest-day volleyball), `CheckInSheet` wiring. Since Napív S3 (`mezo-8141`) the render order is: `BrandRow` → `GreetingHeader` → `DayArc` → hero (`WorkoutTeaser` | rest-day `VolleyballCard`) → `BriefingCard` → `CompanionNoteCard`? → `VulnerabilityCard`? → `CheckInStrip` → secondary `VolleyballCard`? → `QuickStatsRow` → `FuelTimelinePreview` → `GrowthTodayRow` → `CheckInSheet`?.
- `CheckInStrip.tsx` / `CheckInSheet.tsx` (incl. `CHECKIN_DIMS`, `CheckInObservation`) / `AnchorModeView.tsx` — heartbeat strip, wizard sheet, recovery view.
- `components/`: `BrandRow.tsx` (brand wordmark + search chip + the Insights ✨ entry point, `mezo-8141`), `GreetingHeader.tsx` (daypart greeting + reta day, `mezo-8141` — replaces `RetaPhaseSection.tsx`/`DateMesoHeader.tsx`, both **deleted**), `DayArc.tsx` (SVG day-progress arc over `logic/dayArc.ts`, `mezo-8141`), `BriefingCard.tsx`, `CompanionNoteCard.tsx` (H1 — the in-day heartbeat note; data from `data/today/heartbeatHooks.ts`, see [proactive.md](proactive.md)), `WorkoutTeaser.tsx`, `VolleyballCard.tsx`, `VulnerabilityCard.tsx`, `FuelTimelinePreview.tsx`, `QuickStatsRow.tsx`, `GrowthTodayRow.tsx` (one-row Growth summary over `logic/growthToday.ts`, `mezo-8141` — replaces the on-page `InsightsTeaser.tsx`'s old slot; `DailyQuestsCard.tsx`/`ActivityLogCard.tsx` **stay in this directory but now mount on `GrowthPage.tsx`**, see [growth.md](growth.md)). **Deleted (`mezo-8141`):** `RetaPhaseSection.tsx`, `DateMesoHeader.tsx`, `InsightsTeaser.tsx` (+ their inline tests in `topSections.test.tsx`/`bottomSections.test.tsx`).
- `logic/`: `dayArc.ts` (+ test) — pure arc-point/progress math for `DayArc`; `growthToday.ts` (+ test) — pure `{done,total,xp}` derivation for `GrowthTodayRow`.

**Frontend — data & lib:**
- `frontend/src/data/today/todayHooks.ts` (+ `todayHooks.test.tsx`) — `useTodayScenario`, `resolveBriefing`, `useToday`, `useFuelPreview`, `useQuickStats`, `useInsightsTeaser` (orphaned since `mezo-8141`, §9); `checkinHooks.ts` (+ test, incl. `buildDaySlots`) — `useCheckins`; `briefingHooks.ts` (+ test) — `useBriefing` (proactive B1.2) + `briefingApi.ts` (`toBriefing` wire→`Briefing`); all re-exported by the `data/hooks.ts` barrel.
- `frontend/src/data/today/today.ts` (incl. `workoutPrediction`, `volleyballNote`), `checkins.ts`, `kindMeta.ts`, `types.ts` (`TodayMeta`/`UserMeta`/`WorkoutPrediction`/`QuickStatItem`/`InsightsTeaserItem`), `fuel.ts` (`fuelToday`).
- `frontend/src/data/me/biometricsApi.ts` (`checkinApi`), `data/_client/mode.ts`, `shared/lib/dates.ts`, `data/_client/api.ts` (`apiFetch`/`setToken`), `shared/lib/safeMarkdown.tsx`.
- `frontend/src/shared/ui/RetaPhaseBar.tsx`, `QuickStat.tsx` — shared primitives.
- `frontend/src/app/AppLayout.tsx` (anchor wiring), `router.tsx:47`, `PhoneFrame.tsx`.

**API contract:** `api/feature/checkin/checkin.yml` → `api/openapi.yml` → `frontend/src/data/_client/api.gen.ts` + backend `io.mrkuhne.mezo.api` (`CheckInApi`, `CheckInResponse`, `SaveCheckInRequest`).

**Backend** (`backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/checkin/`): `controller/CheckInController.java`, `service/CheckInService.java`, `entity/CheckInEntity.java`, `repository/CheckInRepository.java`, `mapper/CheckInMapper.java`. Migration `backend/src/main/resources/db/changelog/1.0.0/script/202606101320_mezo-v67_create_check_in.sql`. Tests `backend/src/test/java/io/mrkuhne/mezo/feature/biometrics/BiometricsContractIT.java`, `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java:39` (top-level test `support/`, not under biometrics).

**Docs:** [`docs/superpowers/specs/2026-06-03-mezo-today-design.md`](../superpowers/specs/2026-06-03-mezo-today-design.md), [`docs/superpowers/plans/2026-06-03-today-slice1.md`](../superpowers/plans/2026-06-03-today-slice1.md); house standards in [`docs/references/`](../references/).
