---
title: Today
type: feature-domain
status: mock-only
updated: 2026-06-18
tags: [today, biometrics, frontend, data-layer]
key_files:
  - frontend/src/features/today
  - frontend/src/data/hooks.ts
  - frontend/src/data/today.ts
  - frontend/src/lib/biometricsApi.ts
  - api/feature/checkin/checkin.yml
  - backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/checkin
related: [_platform-data-layer, _platform-design-system, me, insights]
---

# Today — Feature Documentation

> The daily home / morning-briefing screen at route `/today` (tab "Ma"), the PWA's default landing page. **Status: 🔶 mock-only** — every section is static mock data, with **one** real Phase-2 seam: the check-in *save* (`POST /api/biometrics/checkin`, ✅ done).

## 1. Summary

**Today** ("Ma") is mezo's daily aggregation surface — the screen the user sees first every morning. It stacks the day's signals into one vertical scroll: a brand row, a **Retatrutide** 7-day medication-phase bar, the date/mesocycle header, an AI **"Reggeli briefing"** card, the **"Heartbeat"** 4×/day check-in strip, a **workout teaser** that links to Train, conditional **volleyball** and **vulnerability** cards, a **fuel timeline preview**, a **quick-stats** row, and an **insights teaser**. On a "rough" day the whole screen is replaced by **AnchorMode**, a warm-palette, low-demand recovery view.

Status per layer:
- **FE mock:** ✅ complete — all sections render synchronously from static data; URL-driven scenarios (`?day=`, `?niggle=`, `?vulnerable=`, `?retaDay=`).
- **FE real:** 🔶 only the check-in *write* path exists. The strip never *reads* server rows (no `listForDay` consumer). Briefing, workout, volleyball, fuel preview, quick-stats, insights teaser, reta phase, and the scenario are mock with no real-mode swap.
- **Backend:** ✅ check-in (`feature/biometrics/checkin`) only. It lives **inside the biometrics feature** server-side (alongside weight/sleep), not a "today" package. Everything else is 🟣 Phase-3 (real briefing/predictions/insights need Spring AI + RAG).

Driving design: [`docs/superpowers/specs/2026-06-03-mezo-today-design.md`](../superpowers/specs/2026-06-03-mezo-today-design.md) (approved brainstorm) and the slice plan [`docs/superpowers/plans/2026-06-03-today-slice1.md`](../superpowers/plans/2026-06-03-today-slice1.md). No dedicated ADR exists for Today.

## 2. User-facing behavior

- **Open the app →** lands on `/today` (index route redirects there; `router.tsx:46`). Mock data renders synchronously, no spinner.
- **Scenario deep-links** (no production UI — URL search params only, parsed by `useTodayScenario`):
  - `?day=good|medium|rough` (default `medium`). `rough` → AnchorMode full-screen replaces the normal stack.
  - `?niggle=on|off` (default `on`) → toggles the amber niggle banner inside the workout teaser.
  - `?vulnerable=on|off` (default `off`) → shows the "sebezhetőbb hangnem" `VulnerabilityCard`.
  - `?retaDay=N` (1–7, clamped; default from `today.retaDay = 3`) → moves the reta phase bar's active segment and its phase descriptor.
- **Check-in ("Heartbeat" strip):** tap a slot (4 slots: `06:30 · 10:00 · 14:00 · 20:00`) → opens `CheckInSheet`, a 5-step wizard. Four dimensions — Energia / Stressz / Testi / Mentális tisztaság — on a 1–10 scale with auto-advance; each shows a reactive "Mezo · azonnali olvasat" observation (`CheckInObservation`). The final step is a summary + optional one-line note. **Mentés** → the strip updates its local state (a slot flips to `done`, an average-score badge appears, the N/4 counter increments) and, in **real mode only**, fires a fire-and-forget `POST` to the backend.
- **Cross-slice navigation:** the `WorkoutTeaser` card and its **"Indítsuk"** CTA both `navigate('/train')`. The fuel preview "Fuel → Terv" eyebrow and the insights "Insights → Patterns" chip are **visual only** (not links in current code). The `VolleyballCard` chevron is visual.
- **AnchorMode:** the `Kilépés` chip calls `navigate('/today')`, dropping the `?day=rough` param and returning to the normal screen.

## 3. Architecture & data flow

The single FE↔data boundary is `frontend/src/data/hooks.ts`. For Today, `isMockMode()` (`@/lib/mode`, reads `VITE_USE_MOCK !== 'false'`) is consulted **only inside `useCheckins`** — every other Today hook returns mock unconditionally.

```
TodayScreen.tsx (composition root)
  ├─ useTodayScenario()   hooks.ts:21  — URL params → TodayScenario { dayState, retaDay, niggle, vulnerable, anchorMode }
  ├─ useToday()           hooks.ts:37  — { today, user, briefing, workout, volleyballSessions, fuelToday }  (mock, no real swap)
  ├─ useCheckins()        hooks.ts:41  — useState(initialCheckins) + useMutation(checkinApi.save)
  ├─ resolveBriefing(ds)  hooks.ts:32  — briefing ⊕ briefingVariants[ds]
  └─ useFuelPreview()     hooks.ts:67  — slices fuelToday.slots (mock only)

Real path — CHECK-IN SAVE ONLY (write-only):
  saveCheckIn(idx, data)               hooks.ts:48
    └─(real mode)→ mutation.mutate(SaveCheckInBody)
        → checkinApi.save              lib/biometricsApi.ts:43
        → apiFetch POST /api/biometrics/checkin   (Bearer token via lib/api.ts setToken)
        → CheckInController.saveCheckIn (implements generated CheckInApi)
        → CheckInService.save           — @Transactional upsert on (createdBy, date, slotTime)
        → CheckInRepository (OwnedRepository) → check_in table (Postgres)
        → CheckInMapper.toResponse → CheckInResponse   ← result DISCARDED on the FE
```

Key behavioral facts (all in `hooks.ts`):
- `useTodayScenario` (21–30): `dayState` falls back to `'medium'` for anything other than `good`/`rough`; `anchorMode = dayState === 'rough'`. **Called in two places** — `TodayScreen` (branch to AnchorMode) and `AppLayout` (passes `anchor` to `PhoneFrame` for the warm canvas) — so both must derive `anchorMode` identically.
- `resolveBriefing` (32–35): `briefingVariants.medium` is `null`, so `medium` returns the base `briefing`; `good`/`rough` spread their `Partial<Briefing>` over the base.
- `useCheckins` (41–65): local `useState`; `saveCheckIn` updates the slot in place, and in real mode builds a `SaveCheckInBody` (`date = localDateString()` local-tz, `slotTime = slot.time`, `state` defaulting to `'done'`, the four dims, the note) and fires `mutation.mutate`. On error it only `console.error`s — no UI rollback, no toast. The `CheckInResponse` (with the server `id`) is **discarded**; the strip is never reconciled with the server.
- `useFuelPreview` (67–74): finds the `now` slot, returns 3 visible slots from there plus the next incomplete `nextStack` for the AI note line. Pure mock.

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
- `frontend/src/data/today.ts` — `today`, `user`, `briefing`, `briefingVariants` (`good` / `medium = null` / `rough`), `workout`, `volleyballSessions` (5 sessions, **none flagged `today:true`** — see §9), re-exports `fuelToday`.
- `frontend/src/data/checkins.ts` — `initialCheckins`: 4 slots `06:30 done · 10:00 done · 14:00 now · 20:00 pending`.
- `frontend/src/data/fuel.ts` — `fuelToday = fuelPlan.today` (shared with the Fuel area).

### Backend check-in (the only real piece)
Contract fragment: [`api/feature/checkin/checkin.yml`](../../api/feature/checkin/checkin.yml) → merged into `api/openapi.yml` → FE types in `frontend/src/lib/api.gen.ts`, BE interfaces/DTOs in `io.mrkuhne.mezo.api`.

| Method + path | Operation | Returns | Consumed by FE? |
|---|---|---|---|
| `GET /api/biometrics/checkin?date=YYYY-MM-DD` | `listCheckInsForDay` | `CheckInResponse[]` | **No** — `checkinApi.listForDay` exists but is never called |
| `POST /api/biometrics/checkin` | `saveCheckIn` | `CheckInResponse` (**200**, upsert — not 201) | Yes, real mode only |

Request `SaveCheckInRequest { date, slotTime, state (regex `done\|now\|skipped\|pending`), energy/stress/body/mental (1–10), note }`.

Backend (`backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/checkin/`):
- `controller/CheckInController.java` — implements generated `CheckInApi`; injects `CurrentUserId` (server-side principal).
- `service/CheckInService.java` — `listForDay` (derived query, ordered by `slot_time`); `save` is a `@Transactional` upsert via `findByCreatedByAndDateAndSlotTime(...).orElseGet(CheckInEntity::new)`, sets `createdBy` from the principal and `savedAt = Instant.now()`. Comment notes no concurrency guard (single-user; revisit with `ON CONFLICT` for multi-device).
- `entity/CheckInEntity.java` — `extends OwnedEntity`; UUID PK (`@GeneratedValue`); soft delete `@SQLDelete`/`@SQLRestriction("is_deleted = false")`; columns `date`, `slot_time(5)`, `state(10)`, `energy/stress/body/mental` (nullable `Integer`), `note(500)`, `saved_at`.
- `repository/CheckInRepository.java` — `extends OwnedRepository<CheckInEntity>`; two derived queries.
- `mapper/CheckInMapper.java` — MapStruct; custom `Instant → OffsetDateTime` (UTC).
- Migration `backend/src/main/resources/db/changelog/1.0.0/script/202606101320_mezo-v67_create_check_in.sql` — table `check_in` with `pk_check_in_id`, `fk_check_in_created_by_app_user_id` (ON DELETE CASCADE), `uq_check_in_created_by_date_slot`, `ck_check_in_state` CHECK, `idx_check_in_created_by_date`. **No `@Profile("demodata")` seed** for check-ins (owner seed only).
- FE client `frontend/src/lib/biometricsApi.ts:41–45` — `checkinApi.listForDay` / `checkinApi.save`; types `CheckInResponse` / `SaveCheckInBody` from `api.gen.ts`.

## 5. Integrations

Today is an **aggregation surface** — its value is in the seams to the other domains. Most are navigation-only or shared-data; only one is a live backend integration.

- **→ Train (`/train`)** — *navigation + own mock copy*. `WorkoutTeaser` card click and the **"Indítsuk"** CTA both `navigate('/train')`. Today **consumes its own mock `workout`** (`data/today.ts`, seam type `Workout`), **not** the Train backend (mesocycles / workout-execution). No live data crosses; navigation only. The niggle-banner copy ("Cable Pull-Around előrébb, Lat Pulldown pronated") is **hardcoded in `WorkoutTeaser.tsx`**, independent of `workout.niggleWarning.detail`.
- **→ Fuel (`/fuel`)** — *shared data*. `FuelTimelinePreview` consumes `fuelToday` (= `fuelPlan.today`), the **same object the Fuel area renders**, sliced down by `useFuelPreview` (seam types `FuelSlot` / `FuelPlanToday`). It uses the shared `KIND_META` constant from `data/kindMeta.ts` (also used by Fuel). The "Fuel → Terv" eyebrow is **not** a nav link in current code.
- **→ Insights (`/insights`)** — *visual teaser only*. `InsightsTeaser` is fully hardcoded copy ("Új minta · 0.85 konfidencia"); no hook, no nav link. Phase-3 territory.
- **→ Biometrics backend (real)** — *the only live integration*. `useCheckins` → `checkinApi.save` → `feature/biometrics/checkin`. The contract crossing the seam is `SaveCheckInRequest` → `CheckInResponse`. Server-side the check-in is a sibling of weight/sleep inside the biometrics feature, not a Today package.
- **← AppLayout / shell** — `AppLayout.tsx` calls `useTodayScenario()` **itself** and passes `anchor = scenario.anchorMode && pathname.startsWith('/today')` to `PhoneFrame` (warm canvas). The contract here is the shared `TodayScenario.anchorMode` boolean: the layout's canvas and the screen's content must agree (both derive it from the same hook). The global `QuickInputSheet` ("Gyors rögzítés" Fab, `features/quickinput/`) is referenced by the Today design but **owned by the shell**, not Today.
- **Shared UI primitives consumed:** `RetaPhaseBar`, `QuickStat` (`components/ui/`), plus `Eyebrow`, `PageTitle`, `Chip`, `RefTag`, `Sheet`, `Icon`/`BrandGlyph`, `CtaPrimary`, and `SafeMarkdown` (renders briefing `**bold**` without `dangerouslySetInnerHTML`).

## 6. How to use it (consume)

Mount the screen (already wired at `frontend/src/app/router.tsx:47`):

```tsx
import { TodayScreen } from '@/features/today/TodayScreen'
// route: { path: 'today', element: <TodayScreen /> }
```

Pull data through the boundary in `@/data/hooks`:

```tsx
import { useToday, useCheckins, useTodayScenario, useFuelPreview, resolveBriefing } from '@/data/hooks'

const scenario = useTodayScenario()                  // { dayState, retaDay, niggle, vulnerable, anchorMode }
const { today, user, briefing, workout, volleyballSessions, fuelToday } = useToday()
const briefing = resolveBriefing(scenario.dayState)  // Briefing (variant merged over base)
const { visible, nextStack } = useFuelPreview()       // 3 upcoming FuelSlots + next incomplete stack

const { checkins, saveCheckIn } = useCheckins()       // CheckinSlot[4] + saver
saveCheckIn(idx, { state: 'done', values, note, savedAt }) // mock = local-only; real = also POSTs
```

`useTodayScenario` is safe to call anywhere under the router (it only reads search params), so scenarios can be driven by links: `/today?day=rough`, `/today?niggle=off`, `/today?retaDay=5`.

## 7. How to extend it

**Add a new Today section/card (FE-only, mock):**
1. Create the component under `frontend/src/features/today/components/`.
2. Add a typed slice to `data/today.ts` (or a new `data/*.ts`) + its type in `data/types.ts`.
3. Expose it through a hook in `data/hooks.ts` (extend `useToday` or add a focused hook like `useFuelPreview`).
4. Render it in `TodayScreen.tsx` (mind the AnchorMode early-return at line 23 — sections after it only show on non-rough days).
5. Add a colocated `*.test.tsx` and a parity variant in `tests/parity/foundation.spec.ts`.
Follow the design in [`docs/superpowers/specs/2026-06-03-mezo-today-design.md`](../superpowers/specs/2026-06-03-mezo-today-design.md).

**Promote a mock Today section to a real backend (the check-in is the working template):**
1. **Contract-first** — see [`docs/references/api_contract_conventions.md`](../references/api_contract_conventions.md). Add `api/feature/<name>/<name>.yml`, merge with `cd api/generate && npm run generate:api`, regenerate FE types `cd frontend && pnpm generate:api`. Never hand-write boundary DTOs.
2. **Backend** — see [`docs/references/java_package_structure.md`](../references/java_package_structure.md) and [`spring_patterns.md`](../references/spring_patterns.md). `feature/<area>/<name>/{controller,service,repository,entity,mapper}` implementing the generated `<Tag>Api`; entity `extends OwnedEntity` (UUID PK, soft delete); `CurrentUserId` set server-side.
3. **Migration** — see [`docs/references/liquibase_conventions.md`](../references/liquibase_conventions.md). `{YYYYMMDDHHMM}_{bd-id}_<desc>.sql` with explicit `pk_/fk_/uq_/ck_/idx_` names; register in the master changelog; seed in Java `@Profile("demodata")`, never SQL.
4. **Tests** — see [`docs/references/testing_standards.md`](../references/testing_standards.md) and [`integration_test_framework.md`](../references/integration_test_framework.md). Extend `ApiIntegrationTest` (verb helpers, `ownerAuthHeaders()`); **add the new table to `support/ResetDatabase.java`'s TRUNCATE list** (`check_in` is already at :39).
5. **FE swap (dual-mode obligation):** add a `*Api.ts` client mirroring `lib/biometricsApi.ts`; in the hook, branch on `isMockMode()` with TanStack Query — mock seeds synchronously via `initialData`, real loads (mirror `useWeight` in `weightHooks.ts` / `useSleep`). Both `pnpm test` (real default) **and** `VITE_USE_MOCK=true pnpm test` must stay green.

**Specifically: make Today's check-in strip hydrate from the server** (it currently doesn't — write-only): wire `checkinApi.listForDay(localDateString())` into `useCheckins` as a `useQuery` whose `initialData` is `initialCheckins` in mock mode, and reconcile each `saveCheckIn` with the returned `CheckInResponse` (currently discarded) instead of `console.error`-on-fail only.

## 8. Testing

**Unit (Vitest + RTL, colocated under `frontend/src/features/today/`):**
- `TodayScreen.test.tsx`, `CheckInStrip.test.tsx` (4 slots, N/4 count, `onCheckIn(idx)`), `CheckInSheet.test.tsx` (dimension advance, **save calls `onSave` with `state:'done'`**), `BriefingCard.test.tsx`, `WorkoutTeaser.test.tsx`, `FuelTimelinePreview.test.tsx`, `AnchorModeView.test.tsx`, and `components/{topSections,bottomSections,conditionalCards}.test.tsx`. `conditionalCards.test.tsx` covers `VolleyballCard` null-vs-session by **injecting an explicit `today:true` session** (the default mock has none — see §9). Scenario/check-in hook parsing is covered through these.

**Parity (Playwright @440×956)** — `frontend/tests/parity/foundation.spec.ts:82–114`: variants `today-default`, `today-good`, `today-rough-anchor`, `today-niggle-off`, `today-vulnerable`, plus the `checkin sheet` (clicks the `tap` slot) and `quickinput sheet`. Compared against the prototype `prototype-today.png`.

**Backend IT** — `backend/src/test/java/io/mrkuhne/mezo/feature/biometrics/BiometricsContractIT.java:49–68`: `testSaveCheckIn_shouldUpsertSameSlot_whenPostedTwice` (POST the same slot twice → same `id`, state updates to `skipped`; GET by date → 1 row). Extends `ApiIntegrationTest` against real Postgres; `check_in` is in `support/ResetDatabase.java:39`.

**Commands:**
```bash
cd frontend && pnpm test                       # real mode (default)
cd frontend && VITE_USE_MOCK=true pnpm test    # mock mode — both MUST be green
cd backend  && ./mvnw clean test               # ITs against the fixed mezo_test DB (compose up)
```

## 9. Decisions, gotchas & deferred

- **Decisions:** design in [`docs/superpowers/specs/2026-06-03-mezo-today-design.md`](../superpowers/specs/2026-06-03-mezo-today-design.md), plan in [`docs/superpowers/plans/2026-06-03-today-slice1.md`](../superpowers/plans/2026-06-03-today-slice1.md). No dedicated ADR in `docs/decisions/` (only `0001-deploy-on-k3s-argocd-learning-track.md` exists).
- **GOTCHA — `VolleyballCard` never renders by default.** `TodayScreen.tsx:25` does `volleyballSessions.find(s => s.today)`, but **no session in `today.ts`'s `volleyballSessions` array has `today:true`** — the `today:true` flag only lives on train-area data (`fuelWeek.ts`'s `gymSchedule` `{ day:'Csü', …, today:true }`, `train.ts`'s `gymSchedule`, and computed in `trainHooks.ts`), never on a `VolleyballSession`. So on the live default screen the card is always absent; it is exercised only in tests with an injected `today:true` session.
- **GOTCHA — the check-in strip is write-only against the server.** No `listForDay` consumer: the strip always starts from `initialCheckins` and never reflects previously-saved server rows. The real-mode POST is fire-and-forget; on error it only `console.error`s (no rollback/toast), and the `CheckInResponse` (with the server `id`) is discarded.
- **GOTCHA — `briefing.tone` is dead data.** Set in `briefingVariants` (`energetic` / `supportive`) but `BriefingCard` never reads it. (The only consumed `tone` is the in-sheet `CheckInObservation` tone, computed locally.)
- **GOTCHA — niggle-banner copy is hardcoded** in `WorkoutTeaser.tsx`, decoupled from `workout.niggleWarning.detail`.
- **Local-date correctness:** `saveCheckIn` uses `localDateString()` (`Intl en-CA`, local tz) — deliberately not UTC slicing, so evening entries don't shift to the next day. See `lib/dates.ts`.
- **Scenario duplication:** `useTodayScenario` is called in both `TodayScreen` and `AppLayout`; both must derive `anchorMode` consistently for the warm canvas and the content to match.
- **Deferred / Phase-3:** real briefing generation (Spring AI / RAG), real predictions, real insights/patterns, real fuel/quick-stats data, AnchorMode triggered by real signals. `QuickStatsRow` values ("7.2h / 78.6kg / 64ms") and `InsightsTeaser` are fully hardcoded.

## 10. Key files

**Frontend — screen + components** (`frontend/src/features/today/`):
- `TodayScreen.tsx` — composition root, AnchorMode branch, `CheckInSheet` wiring.
- `CheckInStrip.tsx` / `CheckInSheet.tsx` (incl. `CHECKIN_DIMS`, `CheckInObservation`) / `AnchorModeView.tsx` — heartbeat strip, wizard sheet, recovery view.
- `components/`: `BrandRow.tsx`, `RetaPhaseSection.tsx`, `DateMesoHeader.tsx`, `BriefingCard.tsx`, `WorkoutTeaser.tsx`, `VolleyballCard.tsx`, `VulnerabilityCard.tsx`, `FuelTimelinePreview.tsx`, `QuickStatsRow.tsx`, `InsightsTeaser.tsx`.

**Frontend — data & lib:**
- `frontend/src/data/hooks.ts` (lines 21–74 are Today) — `useTodayScenario`, `resolveBriefing`, `useToday`, `useCheckins`, `useFuelPreview`.
- `frontend/src/data/today.ts`, `checkins.ts`, `kindMeta.ts`, `types.ts` (:6–16, :80–91), `fuel.ts` (`fuelToday`).
- `frontend/src/lib/biometricsApi.ts` (`checkinApi`), `lib/mode.ts`, `lib/dates.ts`, `lib/api.ts` (`apiFetch`/`setToken`), `lib/safeMarkdown.tsx`.
- `frontend/src/components/ui/RetaPhaseBar.tsx`, `QuickStat.tsx` — shared primitives.
- `frontend/src/app/AppLayout.tsx` (anchor wiring), `router.tsx:47`, `PhoneFrame.tsx`.
- `frontend/tests/parity/foundation.spec.ts:82–114` — parity variants.

**API contract:** `api/feature/checkin/checkin.yml` → `api/openapi.yml` → `frontend/src/lib/api.gen.ts` + backend `io.mrkuhne.mezo.api` (`CheckInApi`, `CheckInResponse`, `SaveCheckInRequest`).

**Backend** (`backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/checkin/`): `controller/CheckInController.java`, `service/CheckInService.java`, `entity/CheckInEntity.java`, `repository/CheckInRepository.java`, `mapper/CheckInMapper.java`. Migration `backend/src/main/resources/db/changelog/1.0.0/script/202606101320_mezo-v67_create_check_in.sql`. Tests `backend/src/test/java/io/mrkuhne/mezo/feature/biometrics/BiometricsContractIT.java`, `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java:39` (top-level test `support/`, not under biometrics).

**Docs:** [`docs/superpowers/specs/2026-06-03-mezo-today-design.md`](../superpowers/specs/2026-06-03-mezo-today-design.md), [`docs/superpowers/plans/2026-06-03-today-slice1.md`](../superpowers/plans/2026-06-03-today-slice1.md); house standards in [`docs/references/`](../references/).
