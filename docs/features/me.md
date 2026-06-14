---
title: Me Area
type: feature-domain
status: mixed
updated: 2026-06-14
tags: [me, biometrics, frontend, backend, data-layer]
key_files:
  - frontend/src/features/me
  - frontend/src/data/hooks.ts
  - frontend/src/lib/biometricsApi.ts
  - api/feature/weight/weight.yml
  - api/feature/sleep/sleep.yml
  - backend/src/main/java/io/mrkuhne/mezo/feature/biometrics
related: [_platform-data-layer, _platform-design-system, today, insights]
---

# Me Area — Feature Documentation

> The profile + personal-biometrics + relationships hub. **Mixed status:** `Cél` (weight) and `Alvás` (sleep) are ✅ Phase-2 backed (the `biometrics` backend feature); `Profil`, `Emberek` (People) and `Tudás` (Knowledge) are 🔶 mock-only. Lives under the `/me` tab (`MeScreen`, Hungarian sub-nav `Profil` / `Cél` / `Alvás` / `Emberek` / `Tudás`).

## 1. Summary

The **Me** area is the user's personal hub: who they are (`Profil`), their long-term body-weight goal and trend (`Cél`), their sleep log (`Alvás`), the people they track (`Emberek`), and a knowledge facts surface (`Tudás`). It exists as the "self & relationships" counterpart to the activity-focused tabs (Today, Train, Fuel, Insights).

**Status per layer:**

| Sub-feature | Route | FE mock | FE real | Backend |
|---|---|---|---|---|
| `Profil` | `/me` (index) | ✅ | n/a (no endpoint) | 🔶 none (latent `user_profiles` table, unexposed) |
| `Cél` (weight + goal) | `/me/goals` | ✅ | ✅ weight log | ✅ `weight_log` (goal/trends still mock) |
| `Alvás` (sleep) | `/me/sleep` | ✅ | ✅ sleep log | ✅ `sleep_log` (trends/target still mock) |
| `Emberek` (People) | `/me/people` | ✅ | n/a (no endpoint) | 🔶 none |
| `Tudás` (Knowledge) | `/me/knowledge` | ✅ | n/a | 🔶 Insights-domain data (see §5.5 — out of Me scope) |

Only the *log arrays* (`weightLog`, `sleepLog`) swap mock↔real; goal, trends, target, factors, insights, linked mesocycles, people, and patterns are **always mock**, even in real mode — they describe the Phase-3 AI brain that does not yet compute them.

Specs of record: **[`docs/superpowers/specs/2026-06-08-me-domain-sheets-design.md`](../superpowers/specs/2026-06-08-me-domain-sheets-design.md)** (the sheets/log design, issue `mezo-k0i`) and **[`docs/superpowers/specs/2026-06-10-phase2-backend-design.md`](../superpowers/specs/2026-06-10-phase2-backend-design.md)** (backend slice map; biometrics = Slice A, issue `mezo-v67`).

## 2. User-facing behavior

`MeScreen` (`frontend/src/features/me/MeScreen.tsx`) renders the `MeSubNav` tab strip plus an `<Outlet>`, and owns the `SettingsSheet` open/close state, passing `openSettings` down via outlet context (`MeOutletContext = { openSettings: () => void }`).

### `Profil` (`views/ProfileView.tsx`) — 🔶 mock-only
Read-only dashboard: concentric avatar + `user.name`/`handle`, member/streak/mesocycle stats (`ProfileStat`), an "Identity goal" card (`identityGoal.quote`), "Aktív területek" PERMA-style bars (`areas`), two `EntryCard` shortcuts that `navigate('/me/knowledge')` and `navigate('/me/people')`, quick-setting rows, and a version footer. The gear chip calls `onOpenSettings()` → `SettingsSheet` (theme toggle via `useTheme` + a read-only notification overview).

### `Cél` (`views/GoalsView.tsx`) — ✅ weight backed
The long-term weight goal. A tappable goal hero (kg progress track start→target, tempo/projection stats, identity frame) opens **`EditGoalSheet`** — **display-only by deliberate decision** (no goal write contract yet). The `+Súly` chip opens **`WeightLogSheet`** (±0.1/±0.5 stepper, note ≤200 chars, a contextual "mezo observation" line) → `logWeight`. A period toggle (`7d` / `30d` / `all`) feeds `WeightChart`. Below: two `TrendCell`s (7d/4w), Mezo `InsightCard`s, `FactorCard`s + a decorative `ToolChipRow`, and linked-mesocycle cards (`LinkedMesoCard`).

### `Alvás` (`views/SleepView.tsx`) — ✅ sleep backed
Last-night hero (duration vs target, quality/10, awakenings, meal-to-sleep). **Ghost-guard (`SleepView.tsx:35-43`):** when `!lastNight`, renders "Még nincs alvásadat." — this is the canonical real-mode empty-backend path. The `+Log` chip opens **`SleepLogSheet`** (2× `TimePicker`, computed `duration` via `computeDuration`, a 1–10 quality grid, awakenings 0–4+, note) → `logSleep`. Trend chart (`7d` / `14d`), weekly `SleepCell`s, insights, factors, and last-7-nights log rows (`SleepLogRow`).

### `Emberek` (`views/PeopleView.tsx`) — 🔶 mock-only
Weekly "relational credit" hero, the **"Mizu Velünk" monthly 1:1 ritual** card (`RitualCard` from `summary.ritualUpcoming`), an attention strip, a person grid (`PersonCard`, tap → **`PersonDetailSheet`**), a mentions feed with an `all`/`week`/`flagged` filter, Mezo relation-pattern cards, and an **"IDENT-5 · belső kör" privacy footer** (`PeopleView.tsx:143-157` — names never leave the device). The `+Log` (mic) chip opens **`PersonLogSheet`** → `logMention`. From `PersonDetailSheet`, "Log most" nests into `PersonLogSheet` with that person prechosen (`prechosen` state, `PeopleView.tsx:36,159-178`).

### `Tudás` (`views/KnowledgeView.tsx`) — 🔶 Insights-domain (out of Me scope)
Renders knowledge facts from `useKnowledge`. The route lives under `/me/knowledge` for navigation convenience but the data belongs to the Insights domain — see §5.5.

## 3. Architecture & data flow

The single FE↔data boundary is **`frontend/src/data/hooks.ts`**. Each hook branches on `isMockMode()` (`frontend/src/lib/mode.ts` — `import.meta.env.VITE_USE_MOCK !== 'false'`, **default mock**). Views import only from `@/data/hooks`, never deeper.

```
GoalsView ─ useGoals() ──┬─ mock:  initialWeightLog (initialData, sync)
(hooks.ts:80)            └─ real:  weightApi.list ──► GET  /api/biometrics/weight
                                   weightApi.log  ──► POST /api/biometrics/weight
                                        │
                          WeightLogController (implements api WeightApi)
                            └─ WeightLogService ─ WeightLogRepository
                                 (extends OwnedRepository<WeightLogEntity>)
                                   └─ table weight_log  (created_by = CurrentUserId.get())
```

**Weight (`useGoals`, `hooks.ts:80-102`):**
- *read* — `useQuery(['weightLog'])`, `queryFn = mock ? () => initialWeightLog : weightApi.list`. Mock seeds `initialData` synchronously (parity with the old Phase-1 `useState`); **real mode has no `initialData`** → `[]` until the fetch resolves.
- *write* — `useMutation`, `mutationFn = mock ? (emulate WeightEntry) : weightApi.log`. `onSuccess`: mock → `qc.setQueryData(['weightLog'], append)`; real → `qc.invalidateQueries(['weightLog'])` (re-fetches server truth).
- `weightApi` (`frontend/src/lib/biometricsApi.ts:13-23`): `GET/POST /api/biometrics/weight` over `apiFetch`. POST body `{date, weightKg, note}` typed `satisfies LogWeightRequest`.

**Sleep (`useSleep`, `hooks.ts:104-129`):** identical shape via `sleepApi` (`biometricsApi.ts:25-39`), `GET/POST /api/biometrics/sleep`. `useSleep` exposes `lastNight = sleepLog[sleepLog.length-1]` — this **silently depends on the date-ascending ordering** the backend `OwnedRepository.findAllOwned` guarantees.

**Profile / People (mock-only):** `useProfile()` (`hooks.ts:76-78`) returns static objects (`user` from `data/today.ts`; `identityGoal`/`areas`/`quickSettings`/`notifSettings`/`appVersion` from `data/me.ts`) — **no query, no network in either mode.** `usePeople()` (`hooks.ts:131-150`) uses `useState(initialMentions)` and a `logMention` `useCallback` that builds a `Mention` client-side (`crypto.randomUUID()`, `hu-HU` time label) and prepends it — **no network call in either mode.**

**Backend ownership path:** `WeightLogEntity`/`SleepLogEntity` extend `OwnedEntity` (`techcore/persistence/OwnedEntity.java`); the owner is resolved server-side in the controller (`currentUserId.get()` — injected `CurrentUserId` bean, JWT subject → UUID) and passed into `service.log(createdBy, req)`, which stamps it onto the entity (`e.setCreatedBy(createdBy)`), never from the client. `OwnedRepository.findAllOwned(createdBy)` filters `created_by` + `is_deleted=false`, ordered `date ASC`.

## 4. Data model & API

### Backend tables (Phase-2, ✅)
- **`weight_log`** (`backend/src/main/resources/db/changelog/1.0.0/script/202606101300_mezo-v67_create_weight_log.sql`): `id uuid pk`, `created_by uuid fk→app_user`, `date date`, `weight_kg numeric(5,2)`, `note varchar(500)`, `is_deleted`, `created_at`; index `idx_weight_log_created_by_date`.
- **`sleep_log`** (`...202606101310_mezo-v67_create_sleep_log.sql`): `id`, `created_by`, `date`, `bedtime/wakeup varchar(5)`, `duration_h numeric(4,2)`, `quality int` (`ck_sleep_log_quality_range 1..10`), `awakenings int`, `notes varchar(500)`, soft-delete cols.
- **`user_profiles`** (`UserProfileEntity`, `feature/auth/entity/UserProfileEntity.java`): `created_by uuid pk`, `handle`, `birth_date`, `member_since`, `streak_days`, `updated_at`. **Seeded in demodata (`OwnerSeedData.java`) but has NO controller/endpoint** — the FE profile screen does not read it; this is latent infrastructure for a future profile endpoint.

### Entities
`WeightLogEntity` / `SleepLogEntity` (`feature/biometrics/{weight,sleep}/entity/`) both `extends OwnedEntity` (`created_by`, `is_deleted`, `created_at`), soft-delete via `@SQLDelete`/`@SQLRestriction`, UUID `@GeneratedValue` id.

### REST endpoints (contract-first — `api/feature/weight/weight.yml`, `api/feature/sleep/sleep.yml`)
- `GET /api/biometrics/weight` → `WeightLogResponse[]` (`{id, date, value, note}`, date-asc). Mapper renames `weightKg → value` (`WeightLogMapper`).
- `POST /api/biometrics/weight` — `LogWeightRequest {date, weightKg (>0, ≤999.99), note}` → 201.
- `GET /api/biometrics/sleep` → `SleepLogResponse[]` (`{id, date, bedtime, wakeup, duration, quality, awakenings, mealToSleep, notes}`). Mapper (`SleepLogMapper.java`) maps `durationH → duration` and **`mealToSleep` is a hardcoded `constant = "0"`** (the Fuel seam — §5.3).
- `POST /api/biometrics/sleep` — `LogSleepRequest {date, bedtime, wakeup, durationH, quality (1–10), awakenings, note}` → 201.
- 401 on all → `SystemMessageList`. There is **no** goal, mention, or profile endpoint.

### FE types (`frontend/src/data/types.ts:140-287`)
Domain types: `WeightEntry`, `WeightTrends`, `Goal`/`GoalKind`, `LinkedMeso`, `SleepEntry`, `SleepTrends`, `PersonEntry`, `Mention`, `PeopleSummary`, `RelationPattern`, `Affect`, and profile shapes `IdentityGoalCard`/`AreaRow`/`QuickSettingRow`/`NotifSetting`. **Durable write-contract DTOs:** `WeightLogInput`, `SleepLogInput`, `MentionLogInput` — these survive into Phase 2 as the REST request shapes (the design spec calls this out; the weight/sleep ones are already live, `MentionLogInput` is the pinned future People POST shape).

### Mock data (mock-only sub-features)
`data/me.ts` (profile cards/settings), `data/people.ts` (`peopleSummary`, `people`, `initialMentions`, `relationPatterns`, plus `affectColor`/`affectLabel` helpers), and the always-mock `goal`/`weightTrends`/`linkedMesocycles` (`data/goals.ts`) and `sleepTrends` (`data/sleep.ts`). When People graduates to Phase-2, `initialMentions`/`people` are where the backend will plug in (see §7).

## 5. Integrations

The Me area's seams are mostly **conceptual/narrative** in the mock (illustrating the Phase-3 pattern engine) with a few **wired** code paths. Be precise about which is which.

### 5.1 Today ↔ Me (wired)
`useProfile()` re-exports the same `user: UserMeta` object defined in `data/today.ts` (imported into `hooks.ts`). The whole `biometrics` backend feature is shared: Today's check-ins (`useCheckins` → `checkinApi`, `POST /api/biometrics/checkin`) are siblings of Me's weight/sleep under one backend package `feature/biometrics/{weight,sleep,checkin}` and one API client file `frontend/src/lib/biometricsApi.ts`. **Contract crossing the seam:** `UserMeta` (profile), `CheckInResponse`/`SaveCheckInRequest` (Today). `user.mesoLabel`/streak shown in `ProfileView` come from Today's mock.

### 5.2 Train ↔ `Cél` (mock narrative)
`Goal.mesocycles: string[]` holds meso IDs (`meso-hyp-04`…) resolved via `linkedMesocycles` (`data/goals.ts`) and rendered by `LinkedMesoCard`. These IDs are **mock strings, not joined** to the real Train backend (`feature/train`) — a Phase-2+ join point. **Contract that would cross when wired:** a mesocycle id/label pair.

### 5.3 Fuel ↔ `Alvás` (deferred seam — explicit)
`SleepLogResponse.mealToSleep` is hardcoded `0` (`SleepLogMapper.java`, `constant = "0"`) "until Fuel lands." This is *the* documented future seam where Fuel meal-timing feeds the sleep view's meal-to-sleep stat. Sleep `FactorCard`s ("Kitchen close 21:30", magnézium stack) are narrative only today.

### 5.4 People ↔ everything (mock narrative)
`Mention.tiedTo: {kind, label}` ties a mention to a `checkin`/`meal`/`sleep`/`sport`/`event` (`data/people.ts`); `RelationPattern` cross-references sleep/snack/energy. All mock strings — illustrative of the Phase-3 pattern engine, **no real joins**.

### 5.5 Insights / Knowledge ↔ Me (route overlap — known duplication)
`/me/knowledge` and `/insights/knowledge` both render knowledge facts (`useKnowledge`, `data/knowledge.ts`). `ProfileView`'s `EntryCard` deep-links to `/me/knowledge`. **`Tudás` is Insights-domain data, not Me-owned** — treat it as a navigation alias, document it under the Insights feature doc, not here.

### 5.6 Shared design primitives & ToolChipRow
All views compose the same `frontend/src/components/ui/` primitives + the "Deep Current v2" tokens (`frontend/src/styles/prototype.css`); sheets use the shared `Sheet`. The `ToolChipRow`/`FACTOR_TOOLS`/`PATTERN_TOOLS` `Tool[]` declared per view (e.g. `get_weight_log`, `computeWeightFactors`) name the *intended* Phase-3 AI tool calls and render **decoratively — they are not executed.**

## 6. How to use it (consume)

Import the hook from `@/data/hooks` (never deeper) and destructure. Always ghost-guard real mode (empty arrays / `lastNight === undefined` on first paint).

```tsx
import { useGoals, useSleep, usePeople } from '@/data/hooks'

function Example() {
  const { goal, weightLog, weightTrends, linkedMesocycles, logWeight } = useGoals()
  const { sleepLog, sleepTrends, lastNight, logSleep } = useSleep()
  const { summary, people, mentions, patterns, logMention } = usePeople()

  if (!lastNight) return <p>Még nincs alvásadat.</p>   // canonical real-mode guard

  logWeight({ date: '2026-06-14', weightKg: 82.4, note: null })  // WeightLogInput
  logSleep({ date: '2026-06-14', bedtime: '23:10', wakeup: '06:40',
             durationH: 7.5, quality: 8, awakenings: 1, note: null })  // SleepLogInput
  // ...
}
```

Notes:
- `useProfile()` returns `{ user, identityGoal, areas, quickSettings, notifSettings, version }` (all static).
- Mutations are **fire-and-forget** — `logWeight`/`logSleep`/`logMention` call `mutation.mutate(input)` and surface no promise or loading flag to the caller today.
- `GoalsView` tolerates an empty `weightLog` because `WeightChart` handles `[]`; `SleepView` must guard `lastNight` explicitly.
- Run modes: mock (no backend) — `VITE_USE_MOCK=true pnpm dev`; real (default) — needs the backend on `:8090` with the `demodata` profile (owner seed makes login work; **weight/sleep start empty — they are NOT seeded**).

## 7. How to extend it

### Add a field to weight or sleep (contract-first — mandatory order)
1. Edit the contract fragment `api/feature/weight/weight.yml` (request + response schema). Follow **[`docs/references/api_contract_conventions.md`](../references/api_contract_conventions.md)** — never hand-write boundary DTOs.
2. Regenerate: `cd api/generate && npm run generate:api` (merge → `api/openapi.yml`); `cd frontend && pnpm generate:api` (→ `src/lib/api.gen.ts`); backend Java DTOs regenerate in `./mvnw generate-sources`.
3. Backend: add the column via a **new** Liquibase changeset `{YYYYMMDDHHMM}_{bd-id}_{desc}.sql` (never edit released ones — **[`docs/references/liquibase_conventions.md`](../references/liquibase_conventions.md)**); add the field to `WeightLogEntity`; map it in `WeightLogService.log` + `WeightLogMapper` per **[`docs/references/spring_patterns.md`](../references/spring_patterns.md)**.
4. FE: extend the request build in `biometricsApi.ts`, the input type in `types.ts`, and the sheet UI.
5. Tests: extend `WeightLogServiceIT` (integration-first — **[`docs/references/testing_standards.md`](../references/testing_standards.md)** + **[`docs/references/integration_test_framework.md`](../references/integration_test_framework.md)**) and the FE `goalsHooks.test.tsx` MSW handler. **Both FE modes must stay green.**

### Promote People to Phase-2 (the big lift)
Create `api/feature/people/people.yml` (mention + person endpoints), a `feature/people/{entity,repository,service,controller,mapper}` set extending `OwnedEntity`/`OwnedRepository`, Liquibase `person`/`mention` tables, then swap `usePeople` from `useState` to `useQuery`/`useMutation` mirroring `useGoals`. The durable `MentionLogInput` already pins the POST shape. Per **[`docs/references/integration_test_framework.md`](../references/integration_test_framework.md)**: **add the new tables to the `ResetDatabase` TRUNCATE list and add a populator.**

### Swap a mock-only hook to real (the pattern)
`useGoals`/`useSleep` are the templates: a `useQuery` with `queryFn = mock ? () => mockSeed : api.list`, `initialData` only in mock; a `useMutation` whose `onSuccess` does `setQueryData` in mock and `invalidateQueries` in real. Keep the hook's returned shape unchanged so views don't move.

### Make `EditGoal` writable / add a Goal backend
Currently `EditGoalSheet` is **display-only by deliberate decision** (spec §"EditGoal stays display-only"). A goal write contract is a separate bd issue — start from `api/feature/goal/goal.yml` and a new `feature/goal` package.

Obligations that apply to every change here: **contract-first** for any boundary DTO, **dual-mode** parity (mock + real), and **both FE test modes green** plus the backend ITs. House standards: **[`docs/references/`](../references/)** (`java_package_structure`, `spring_patterns`, `error_handling`, `liquibase_conventions`, `testing_standards`, `integration_test_framework`, `configuration_conventions`, `api_contract_conventions`).

## 8. Testing

**Backend (integration-first, Postgres):**
- `backend/src/test/java/io/mrkuhne/mezo/feature/biometrics/weight/WeightLogServiceIT.java` extends `AbstractIntegrationTest`, data via `DatabasePopulator.populateUser`. Covers per-user ownership isolation (`testList_shouldReturnOnlyOwnRows_whenTwoUsersLog`) and date-ascending ordering + soft-delete exclusion, with a raw `jdbcTemplate` count proving the physical row survives (`testFindAllOwned_shouldExcludeSoftDeletedRows_whenRowDeleted`).
- `backend/src/test/java/.../biometrics/sleep/SleepLogServiceIT.java` — the sleep counterpart.
- Convention `test{Method}_should{Result}_when{Condition}`, AssertJ only, `@Transactional`, no mocks/H2.

**Frontend (Vitest + MSW, both modes):**
- `data/goalsHooks.test.tsx` / `data/sleepHooks.test.tsx`: real-mode (`vi.stubEnv('VITE_USE_MOCK','false')`) — assert `useQuery` loads from MSW and that `logWeight`/`logSleep` POST and the entry appears after invalidation (server-truth re-fetch). Sleep asserts `durationH` mapping and `lastNight` recompute.
- `data/meData.test.tsx`, `meData2.test.tsx`, `meHooks.test.tsx`: mock-data shape/hook tests (profile, people).
- Per-sheet: `WeightLogSheet.test.tsx`, `SleepLogSheet.test.tsx`, `EditGoalSheet.test.tsx`, `PersonLogSheet.test.tsx`, `PersonDetailSheet.test.tsx`, `SettingsSheet.test.tsx`. Per-view: `GoalsView.test.tsx`, `SleepView.test.tsx`, `ProfileView.test.tsx`, `PeopleView.test.tsx`. Plus `MeScreen.test.tsx`, `MeSubNav.test.tsx`, `TimePicker.test.tsx`, shared-card tests, and `app/navigation.test.tsx` (exercises `/me` + the settings theme toggle).

**Commands:**
```bash
# Backend (compose Postgres up)
cd backend && ./mvnw clean test
# Frontend — BOTH modes must be green
cd frontend && pnpm test                       # real (default)
cd frontend && VITE_USE_MOCK=true pnpm test     # mock
cd frontend && pnpm parity                      # Playwright parity screenshots
```

## 9. Decisions, gotchas & deferred

- **Spec of record:** [`docs/superpowers/specs/2026-06-08-me-domain-sheets-design.md`](../superpowers/specs/2026-06-08-me-domain-sheets-design.md) (`mezo-k0i`). Key decisions: **bubble-up local state** (mirrors `useCheckins`, no store); **no date picker** in sheets (`date` is stamped to "today" by the mutator but is part of the durable contract because Phase 2 persists it); **voice CTA is decorative**; **EditGoal display-only**; **PersonDetail → PersonLog nesting**.
- **Backend was issue `mezo-v67`** — auth + weight + sleep + checkin shipped together as biometrics Slice A (changeset filenames carry `mezo-v67`).
- **`mealToSleep` is a stub `0`** (`SleepLogMapper.java` constant + contract note) — the live Fuel→Sleep seam (§5.3).
- **`SleepEntry` type over-promises nullability:** the domain type claims `bedtime`/`duration`/… are always present, but the contract/DB allow null; `sleepApi.list`/`log` use an explicit `as Promise<SleepEntry[]>` cast (`biometricsApi.ts:28-38`) flagged "until normalized (see mezo bd issue)." A latent FE↔BE type mismatch to fix.
- **`OwnedRepository.findAllOwned` requires a `date` field** (JPQL `order by e.date asc`); both weight/sleep have one. `useSleep.lastNight` silently depends on this ordering — a date-less owned entity would need its own finder.
- **Belt-and-braces soft delete:** `findAllOwned` filters `deleted=false` AND each entity carries `@SQLRestriction` — intentional, keep both.
- **Mock-only, no backend:** `Profil` (the `user_profiles` table exists but is unexposed), `Emberek`/People, and all goal/trend/factor/insight/pattern/linked-meso data and `ToolChipRow`s.
- **Deferred to Phase 3** (Spring AI, pgvector, RAG — see [`docs/milestones/roadmap.md`](../milestones/roadmap.md)): the pattern engine that the factors/insights/relation-patterns *describe* but do not compute; the Fuel→Sleep `mealToSleep` join; the Train→`Cél` mesocycle join; a People backend; an editable goal/profile.

## 10. Key files

**Frontend — views / routing / screen**
- `frontend/src/features/me/MeScreen.tsx` — tab strip + outlet + `SettingsSheet` state owner
- `frontend/src/features/me/MeSubNav.tsx` — `Profil`/`Cél`/`Alvás`/`Emberek`/`Tudás` sub-nav
- `frontend/src/features/me/views/{ProfileView,GoalsView,SleepView,PeopleView,KnowledgeView}.tsx` — the five views
- `frontend/src/app/router.tsx:36-40,88-98` — Me routes + `ProfileRoute` wrapper

**Frontend — sheets & components**
- `frontend/src/features/me/{WeightLogSheet,EditGoalSheet,SleepLogSheet,PersonLogSheet,PersonDetailSheet,SettingsSheet}.tsx` — log/detail/settings sheets
- `frontend/src/features/me/components/{WeightChart,SleepChart,SleepLogRow,TrendCell,SleepCell,FactorCard,InsightCard,LinkedMesoCard,RitualCard,PersonCard,MentionRow,RelationPatternCard,ConcentricAvatar,ProfileStat,EntryCard,TimePicker,...}.tsx` — view-local cards/charts

**Frontend — data layer**
- `frontend/src/data/hooks.ts` — the boundary (`useProfile`:76, `useGoals`:80, `useSleep`:104, `usePeople`:131)
- `frontend/src/data/{me,goals,sleep,people}.ts` — mock data + people affect helpers
- `frontend/src/data/types.ts:140-287` — Me domain types + write-contract input DTOs
- `frontend/src/lib/biometricsApi.ts` — `weightApi`/`sleepApi`/`checkinApi` clients
- `frontend/src/lib/mode.ts` (`isMockMode`), `frontend/src/lib/api.ts` (`apiFetch`)

**API contract**
- `api/feature/weight/weight.yml`, `api/feature/sleep/sleep.yml` → merged `api/openapi.yml` → `frontend/src/lib/api.gen.ts` + `io.mrkuhne.mezo.api.*`

**Backend**
- `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/weight/{controller/WeightLogController,service/WeightLogService,repository/WeightLogRepository,entity/WeightLogEntity,mapper/WeightLogMapper}.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/{...SleepLog*}.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/auth/entity/UserProfileEntity.java` + `feature/auth/OwnerSeedData.java` — profile seed, no endpoint
- techcore: `persistence/{OwnedEntity,OwnedRepository}.java`, `security/CurrentUserId.java`
- Liquibase: `backend/src/main/resources/db/changelog/1.0.0/script/202606101300_mezo-v67_create_weight_log.sql`, `...202606101310_mezo-v67_create_sleep_log.sql`
- Tests: `backend/src/test/java/io/mrkuhne/mezo/feature/biometrics/{weight/WeightLogServiceIT,sleep/SleepLogServiceIT}.java`

**Docs (link, don't duplicate)**
- Spec: [`docs/superpowers/specs/2026-06-08-me-domain-sheets-design.md`](../superpowers/specs/2026-06-08-me-domain-sheets-design.md); Phase-2: [`docs/superpowers/specs/2026-06-10-phase2-backend-design.md`](../superpowers/specs/2026-06-10-phase2-backend-design.md)
- References: [`docs/references/`](../references/) (`api_contract_conventions`, `liquibase_conventions`, `spring_patterns`, `testing_standards`, `integration_test_framework`, `java_package_structure`, `error_handling`, `configuration_conventions`)
- Roadmap: [`docs/milestones/roadmap.md`](../milestones/roadmap.md)
