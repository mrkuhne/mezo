# Karakter Slice 9 — Gépterem Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Gépterem — the dossier's machine-room: a per-run transparency log (nightly/weekly/monthly/bootstrap) with signal-chain detail pages, week navigation, the data-source inventory and AI-napló links — bd `mezo-1gim.14`, design source = the approved karakter-tab v4.3 prototype.

**Architecture:** One new honesty-spine table, `character_run` — the pipelines currently leave NO trace on a quiet night, so "csendes éjszaka · 0 hívás" would be unknowable; each pipeline writes one idempotent run row (counts + fired detector keys + called expert keys). Two read endpoints serve the FE (`GET /api/character/runs?from&to`, `GET /api/character/run/{id}` with the observations' signal chains). The FE adds the Gépterem tile + five pages in the established Mozaik/character idiom with dual-mode hooks whose mocks mirror the prototype's three seeded weeks.

**Tech Stack:** Liquibase + JPA (S1 idioms), contract-first OpenAPI + regeneration, Spring services (no LLM anywhere in this slice), React + Mozaik primitives + the `features/character` family, dual-mode hooks + msw defaults.

**Design source of truth:** `docs/design_2.0/prototypes/src/karakter-body.html` v4.3 (Gépterem hub + Futások week stepper + run-detail pages + Adatforrások Bekötve|Tervezett + kör mini-pages + Detektorok) and the round log in `docs/design_2.0/2026-08-31-karakter-design-iterations.md`.

## Global Constraints

- Honest states: a run row exists ONLY for runs that actually executed; a day with no row renders as "nincs adat erről az éjszakáról", never as a fabricated quiet night; a quiet night (row with zero counts) renders proudly. No red; ÉRZÉKENY/lavender and terracotta rules as everywhere.
- House idioms: UUID PK, soft delete, `created_by`, typed jsonb envelopes (NEVER a bare `List<String>` with `SqlTypes.JSON` — bd memory `hibernate-list-string-json-array-leak`), Liquibase `{ts}_{bd-id}_{desc}.sql` + `1.0.0_master.yml` changeset, `idx_`/`uq_` prefixes (`scripts/lint-liquibase.mjs`).
- Run-row writes are IDEMPOTENT per `(created_by, kind, day)` with a partial unique index as the DB backstop; writers never throw into their host pipeline (log + continue — the DailySummaryJob isolation idiom).
- Beans: run-log writer + reads on `CHARACTER_SWITCH` only (no LLM); the pipelines' own switch combinations unchanged. The character read endpoints keep working with companion off (S4/S8 precedent, `CharacterApiCompanionOffIT` extended).
- Views import only from `@/data/hooks`; dual-mode hooks with `useDualQuery` + `realStaleTime: DEFAULT_QUERY_STALE_TIME_MS`; 404→null degraded; mock seeds mirror the prototype VERBATIM (3 weeks of runs); default real-mode msw handlers extended (the S8 lesson — `navigation.test.tsx` runs real-mode too).
- FE tests in BOTH modes + `pnpm build`; backend focused Testcontainers ITs only; contract regeneration must leave the tree clean; codemap + docs lint in the same change. A `deadlock detected` TRUNCATE failure is known flakiness (bd `mezo-oou9`) — rerun once.
- New tables join `ResetDatabase`'s TRUNCATE list in the same change (the S1 lesson).
- Conventional commits with bd id `mezo-1gim.14`.

---

### Task 1: The run log — migration, entity, writers

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/{ts}_mezo-1gim.14_create_character_run.sql` (+ `1.0.0_master.yml` changeset)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/entity/CharacterRunEntity.java`, `RunDetectorKeysEnvelope.java`, `RunExpertKeysEnvelope.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/repository/CharacterRunRepository.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterRunLog.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterObservationService.java`, `CharacterConferenceService.java`, `CharacterMonthlyService.java`, `CharacterBootstrapService.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterRunLogIT.java`

**Interfaces:**
- Table `character_run`: house columns + `kind varchar(10)` CHECK `NIGHTLY|WEEKLY|MONTHLY|BOOTSTRAP`, `day date not null` (anchor: the OBSERVED day for nightly; `week_start` for weekly; month first day for monthly; the run date for bootstrap), `observation_count int not null default 0`, `call_count int not null default 0`, `detector_keys jsonb not null` (`RunDetectorKeysEnvelope(List<String> keys)`), `expert_keys jsonb not null` (`RunExpertKeysEnvelope(List<String> keys)`), `conference_id uuid` (soft ref, null for nightly), `generated_at timestamptz not null`. Partial unique `uq_character_run_created_by_kind_day` on `(created_by, kind, day) where is_deleted = false`.
- Produces: `CharacterRunLog.record(UUID owner, String kind, LocalDate day, int observationCount, int callCount, List<String> detectorKeys, List<String> expertKeys, UUID conferenceId)` — idempotent (existing live row for the triple ⇒ no-op), never throws (catch + `log.warn`); `CharacterRunRepository.findByCreatedByAndDayBetweenOrderByDayDescGeneratedAtDesc(UUID, LocalDate, LocalDate)` and `findByIdAndCreatedBy(UUID, UUID)`.

Writer wiring (each in its own try/catch so a run-log failure can never break the pipeline):
- `CharacterObservationService.generateForDay` — after the expert loop, record a `NIGHTLY` row for the day with the fired signals' detector keys, called experts, observation + call counts. **A quiet day records `(0,0,[],[])`** — that row IS the "csendes éjszaka" the design celebrates. NOTE the idempotency interplay: today the quiet path returns before any write — move the run-record BEFORE the early return; catch-up re-processing a day that already has a row skips recording (and the existing per-expert exists-checks remain the observation-level guard).
- `CharacterConferenceService.runWeekly` — on a successful (non-null, newly created) conference: `WEEKLY` row, day = weekStart, counts = consumed observations / LLM calls made (proposal round experts + 2 verdict + portraits — count what the code actually knows; if a precise call count is not cheaply available, record the observation count and expert keys and leave `call_count` 0 with a javadoc note saying the AI-napló is the call-count truth — pick ONE and document).
- `CharacterMonthlyService.run` — `MONTHLY`, day = monthStart, analogous.
- `CharacterBootstrapService.run` — `BOOTSTRAP`, day = `LocalDate.now()`.

- [ ] **Step 1**: failing `CharacterRunLogIT` — (a) nightly quiet day writes a zero row; (b) nightly signal day writes counts + keys; (c) re-run same day = still one row; (d) weekly conference writes its row with `conference_id`; (e) bootstrap writes; (f) unique-index backstop (`saveAndFlush` duplicate → constraint violation); (g) a run-log failure does not break `generateForDay` (e.g. by pre-inserting a conflicting row and asserting the pipeline still completes).
- [ ] **Step 2**: implement; `node scripts/lint-liquibase.mjs` PASS; `cd backend && ./mvnw test -Dtest='CharacterRunLogIT,CharacterObservationServiceIT,CharacterConferenceServiceIT,CharacterMonthlyServiceIT,CharacterBootstrapIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true` green.
- [ ] **Step 3**: commit `feat(character): character_run honesty log written by all four pipelines (mezo-1gim.14)`.

---

### Task 2: Contract + read endpoints

**Files:**
- Modify: `api/feature/character/character.yml` (+ regenerated `api/openapi.yml`, FE client)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/controller/CharacterController.java`, `service/CharacterService.java`
- Test: extend `CharacterApiIT` + `CharacterApiCompanionOffIT`

**Contract:**
- `GET /api/character/runs?from&to` (both required dates, `400` when `to < from` or the span exceeds 62 days — code `CHARACTER_RUN_RANGE_INVALID` + messages.properties) → `200` list of `CharacterRunSummary{id, kind enum, day, observationCount, callCount, detectorKeys[], expertKeys[], conferenceId?}` ordered day desc; `[]` honest empty.
- `GET /api/character/run/{runId}` → `200` `CharacterRunResponse{ summary: CharacterRunSummary, observations: CharacterRunObservation[] }` where `CharacterRunObservation{id, expertKey, dimensionKeys[], text, salience, signals: [{detectorKey, summary, refCount}]}` — refIds are served as a COUNT (the v4.1 "N forrás-hivatkozás" decision; raw ids stay backend-side), observations resolved by `(created_by, day)` for nightly rows and by `consumed_by_conference_id` for conference-kind rows; `404` unknown/foreign (`CHARACTER_RUN_NOT_FOUND`).

- [ ] Steps: failing IT cases (range query incl. the 400s, run detail for a nightly + a weekly row, companion-off case) → implement + regenerate both artifacts → focused ITs green → commit `feat(character): run timeline + run detail endpoints (mezo-1gim.14)`.

---

### Task 3: FE data layer

**Files:**
- Create: `frontend/src/data/character/` additions (API fns + hooks + mock runs), Modify: `characterMock.ts`, `characterHooks.ts`, `frontend/src/data/hooks.ts`, `frontend/src/test/msw/handlers.ts`
- Test: extend `characterHooks.test.tsx`

**Interfaces (Tasks 4–5 rely on these EXACT names):**
- `useCharacterRuns(fromIso: string, toIso: string)` → `{ runs: CharacterRunSummary[], isLoading }`
- `useCharacterRun(id: string | null)` → `{ run: CharacterRunResponse | null, isLoading }` (null id ⇒ disabled)
- Mock: three seeded weeks mirroring the prototype (`GEP_RUNS` — nightly rows incl. two quiet nights, one WEEKLY with conference link, one MONTHLY, one BOOTSTRAP; signal chains verbatim from the v4.1-corrected mock semantics). Default msw handlers: `GET /api/character/runs` → the seeded list filtered by range, `GET /api/character/run/:id` → detail or 404.

- [ ] Steps: failing both-mode hook tests → implement → both-mode green → commit `feat(character): run hooks + prototype-verbatim gépterem mocks (mezo-1gim.14)`.

---

### Task 4: Gépterem hub + Futások + Run pages

**Files:**
- Create: `frontend/src/features/character/pages/GeptermPage.tsx`, `FutasokPage.tsx`, `RunPage.tsx` (+ tests), `frontend/src/features/character/components/RunFlowStrip.tsx`, `SignalChainCard.tsx`
- Modify: `KarakterHubPage.tsx` (the thin full-width Gépterem row per v4.2), `character.css`, `frontend/src/app/router.tsx`, `navigation.test.tsx`

Routes: `/me/karakter/gepterem`, `/me/karakter/gepterem/futasok` (`?start=` ISO Monday, the WeekHub idiom), `/me/karakter/gepterem/futas/:id`. Content per the v4.2/v4.3 prototype: Gépterem hub = hero with the last run's plain-language line + the 4 tiles (Futások/Adatforrások/AI-napló/Detektorok — AI-napló tile navigates to `/me/ai-usage`; read `AiCallFilters` and pass a `?feature=character` URL param IF the filter component reads URL state, otherwise navigate unfiltered and comment the gap honestly); Futások = week stepper + month-jump + day-grouped rows (kind badges, one-line counts) → RunPage = narrative hero (derive the sentence from the run's real counts — the same honest wording rules as the prototype: quiet nights proud, "nincs adat" for missing rows), `RunFlowStrip` (jel → hívás → megfigyelés connected steps), `SignalChainCard`s (numbered two-tone steps, "N forrás-hivatkozás" from `refCount`), called-experts row with PersonaOrbs, conference-kind runs link to the transcript, AI-napló row.

- [ ] Steps: failing tests first (hub tile line, week stepping + month jump, run page for signal/quiet/weekly kinds, missing-row honesty) → implement → both-mode + build green → commit `feat(character): gépterem hub + futások week stepper + run pages (mezo-1gim.14)`.

---

### Task 5: Adatforrások + Detektorok + feed ⚙ + doc/ship-prep

**Files:**
- Create: `frontend/src/features/character/pages/AdatforrasokPage.tsx`, `KorPage.tsx`, `DetektorokPage.tsx` (+ tests), `frontend/src/features/character/inventory.ts` (the static corpus content module)
- Modify: `CharacterFeedPage.tsx` (⚙ navigates to the matching run page — resolve by the feed item's date + kind; when no run row exists, the ⚙ is absent, honest), `router.tsx`, `navigation.test.tsx`, `docs/features/character.md`, `docs/CODEMAP.md`

Routes: `/me/karakter/gepterem/adatforrasok` (+ `?kor=1..4` or `/kor/:n` mini-pages — mirror the prototype's structure), `/me/karakter/gepterem/detektorok`. `inventory.ts` holds the Bekötve content + the four MINDENT-be rounds VERBATIM from the prototype (it IS the `mezo-1gim.15` checklist; a comment says rows flip to bekötve as rounds land) — static FE content by design, with an honest aside-comment that the backend catalog is the runtime truth for what is actually wired. DetektorokPage lists the 5 real detectors with one-line semantics. Doc refresh: `docs/features/character.md` gains the Gépterem section (§FE + the `character_run` table + the two endpoints) — verify every claim against the code.

- [ ] Steps: failing tests → implement → both-mode + build + codemap + docs-lint green + contract-regen tree-clean → commit `feat(character): adatforrások + detektorok + feed ⚙ retarget + doc refresh (mezo-1gim.14)`.

---

### Task 6: Ship

- [ ] Final gates: both-mode full FE suites + build; focused backend ITs; lint-liquibase; codemap/docs lint; visual goldens — the S8 lesson: check whether any EXISTING golden-covered screen changed (the Karakter hub gains the Gépterem row — it is NOT in the SCREENS list per S8, but VERIFY before assuming; regenerate darwin + dispatch linux workflow if any golden screen moved).
- [ ] House flow: push `feat/character-s9-gepterem`, self-PR → CI green → `git pull --rebase` on main → `--no-ff` merge (`ALLOW_MAIN_COMMIT=1`) → push → delete branch → `bd close mezo-1gim.14` → `bd dolt push`.

## Out of scope

`mezo-1gim.15` (the MINDENT-be rounds — next task, per Daniel); run-detail LLM call listing inline (the AI-napló is the call-level truth); URL-filtered AI-napló deep link if the filter component is state-only (noted honestly instead).
