# Companion V3.1 — Statistical patterns + Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the system surfaces real correlations from Daniel's own data and he judges them — a nightly Pearson-correlation job over a configured catalog of per-day metric pairs persists honest `pattern` rows (`kind=statistical`, small-n ⇒ `confidence=null`), an Inbox API exposes them, and the PatternsPage goes real dual-mode with Confirm/Monitor/Reject as a persisted L2 decision surface.

**Architecture:** three clean layers. (1) **Series extraction** — `MetricSeriesService` builds per-day `Map<LocalDate, Double>` series from EXISTING feature reads (one-way coupling, the snapshot/digest precedent). (2) **Pure math** — `PearsonCorrelation` (static: r, n, two-sided p via the incomplete-beta t-test; unit-tested against known fixtures, no Spring). (3) **The job + inbox** — `PatternDetectionJob` (nightly cron, the V2.2 scheduler idiom) pairs series from the config catalog, applies the min-n gate, and upserts one `pattern` row per pair key (stats refresh on `proposed`/`monitoring`; `confirmed`/`rejected` rows are never auto-touched — V3.3 adds confirmed-recurrence reinforcement); `CompanionController` grows `GET /api/companion/pattern` + `POST …/pattern/{id}/decision` (the fact-candidate decision idiom). FE: `patternsApi/patternsHooks` dual-mode conversion of PatternsPage (the knowledge V1.2 recipe), PatternCard's local decision state lifted into a persisted mutation.

**Tech Stack:** Spring Boot 4 `@Scheduled` (existing `SchedulingConfiguration`), Liquibase (one new table), contract-first OpenAPI fragment regen (BE `CompanionApi` + FE `api.gen.ts`), TanStack Query dual-mode FE, Vitest/MSW.

**Driver:** bd `mezo-fnnq.12` · roadmap §V3.1 · spec §8 · living doc `docs/features/companion.md`.

## Global Constraints

- Branch `feat/companion-v31`; conventional commits carrying `(mezo-fnnq.12)`.
- Gates: BE `./mvnw clean test` + FE `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` (FE touched!).
- Contract-first: `api/feature/companion/companion.yml` BEFORE code; merge + `pnpm generate:api`.
- V3.1 is **independent of the chat runtime** (roadmap): no LLM call anywhere — pure math + persistence. `confidence` stays `null` for statistical patterns (honest small-n; the FE renders "tanulom").
- Switches: job under `mezo.techcore.cron.pattern-detection-job.enabled` (the configuration_conventions reference example, verbatim) + everything companion-gated; values under `mezo.companion.patterns.*` (`min-n`, `lookback-days`, metric-pair catalog as a `@Validated` list).
- New table → `ResetDatabase` TRUNCATE + `PatternPopulator` + `@Import`, same change.
- FE: hooks from `@/data/hooks` only; `useDualQuery` bootstrap with `degraded`/`mode`; mock seeds stay; **PatternCard: `critique` becomes optional** (statistical rows have none until V3.2) — render the critique bars only when present, an "r=…, n=…" evidence line for statistical rows; decision buttons call the persisted mutation in real mode (mock keeps local state).
- Tests: correlation math = pure unit tests (known r/p fixtures); series extraction + job idempotence + decision API = ITs; FE both modes.

## Decisions locked (V3.1)

1. **Pattern identity = `(kind, pair_key)` upsert** — the nightly job refreshes `r/n/p/evidence` on `proposed`/`monitoring` rows and NEVER touches `confirmed`/`rejected` (no auto-resurrect; V3.3 hooks confirmed-recurrence into fact reinforcement). `pair_key` is a stable config key (e.g. `sleep-quality~next-day-rpe`).
2. **p-value in code** — two-sided t-test via the regularized incomplete beta function (compact continued-fraction implementation, pure static math, fixture-tested). `confidence = null` always in V3.1 (the 4-factor critique score is V3.2's job); the surfacing gate is `n >= min-n` (default 8) — patterns below it aren't persisted at all.
3. **Metric-pair catalog v1 (8 pairs, config-listed, each `{key, category, label, metric-a, metric-b, lag-days}`):** sleep-quality→next-day training effort (lag 1) · sleep-duration→next-day training effort (lag 1) · late-meal-hour→same-night sleep quality · reta-cycle-day→daily kcal · sport-load→next-day gym volume (lag 1) · daily kcal→next-morning weight delta (lag 1) · check-in stress→sleep quality · water→check-in energy. Metric extractors are a fixed enum in code (`MetricKey`); the catalog wires pairs of them — config can trim/re-lag pairs without code.
4. **Metrics are per-day scalars**; a pair's sample = dates where BOTH series (after lag shift) have values inside `lookback-days` (default 60). Multi-row days aggregate deterministically (avg check-in scores, sum volume/kcal, max sleep row).
5. **Decision surface mirrors the fact-candidate idiom**: `POST /api/companion/pattern/{id}/decision {decision: confirm|monitor|reject}` — repeatable transitions allowed between the three user states (unlike facts: a pattern is a standing judgement, not a one-shot); status CHECK constraint `proposed|monitoring|confirmed|rejected`.
6. **FE category mapping** — the catalog assigns each pair a `physiology|trigger|response` category (the FE's existing `PatternCategory`); `categoryLabel` = the HU label from the catalog. `evidence[]` = deterministic strings (`"r=0.62"`, `"n=14 nap"`, `"p=0.03"`, window).
7. **`recentlyConfirmed`** in the FE bootstrap = the newest confirmed patterns' titles (real mode); mock keeps its seed.
8. **PatternsPage keeps `MIN_PATTERN_CONFIDENCE` filtering for mock/AI rows only** — statistical rows (null confidence) always list (they passed the n-gate server-side).

## File map

**Backend main:** `feature/companion/` → `entity/PatternEntity.java` (+`PatternCritiqueEnvelope` jsonb, empty until V3.2), `repository/PatternRepository.java`, `service/MetricSeriesService.java`, `service/PearsonCorrelation.java` (static math), `service/PatternDetectionService.java` (pairing + upsert), `service/PatternDetectionJob.java` (cron), `service/PatternService.java` (list + decision), `controller/CompanionController.java` (new generated ops), `config/CompanionProperties.java` (+Patterns group incl. pair catalog), `FeaturesConfiguration` (+PATTERN_DETECTION_JOB_SWITCH), `application.yml` (+patterns + cron blocks), migration `{ts}_mezo-fnnq.12_create_pattern.sql`.

**Contract:** `api/feature/companion/companion.yml` — `PatternResponse`, `PatternDecisionRequest`, `GET /api/companion/pattern`, `POST /api/companion/pattern/{id}/decision`.

**Backend test:** `PearsonCorrelationTest` (pure unit), `MetricSeriesServiceIT`, `PatternDetectionServiceIT` (upsert/idempotence/n-gate/frozen-states), `CompanionPatternApiIT` (+switch-off), `PatternPopulator` + growth rules; `CompanionPropertiesIT` (+patterns binding).

**Frontend:** `data/insights/patternsApi.ts` + `patternsHooks.ts` (new, dual-mode), `data/types.ts` (critique optional, +status/statistical fields), `features/insights/pages/PatternsPage.tsx` + `components/PatternCard.tsx` (hook wiring + conditional critique + decision mutation), `src/test/msw/handlers.ts` (+pattern fixtures); tests: `patternsHooks.test.tsx`, `PatternsPage.test.tsx`/`PatternCard.test.tsx` (extended both modes).

**Docs:** `companion.md` (V3.1 block, status row, §4 table+contract+config, §5 seam), `insights.md` (PatternsPage real), roadmap phases+milestone, this plan.

---

### Task 1: contract + migration + entity/repo/populator
- [ ] Fragment: `PatternResponse {id, kind, category, title, mechanism?, evidence[], confidence?, critique?, status, updatedAt}` + decision op; merge + regen FE/BE.
- [ ] Migration: `pattern` table (house columns; `kind` CHECK, `status` CHECK, `pair_key` + `uq_pattern_kind_pair_key` partial `where is_deleted=false`, `category` CHECK, `title`, `mechanism`, `evidence` jsonb, `r`/`n`/`p` numerics, `confidence` numeric null, `critique` jsonb, `promoted_fact_id` uuid) + registration.
- [ ] Entity (+jsonb envelopes) / repository / populator / TRUNCATE / `@Import`; round-trip IT.

### Task 2: math + series
- [ ] `PearsonCorrelation.correlate(double[], double[]) → {r, n, p}` + incbeta; unit fixtures (known values, degenerate: constant series → null).
- [ ] `MetricSeriesService.series(userId, MetricKey, from, to) → Map<LocalDate, Double>` for the 10 metric keys; `MetricSeriesServiceIT` over populator-seeded days.

### Task 3: detection + job + API
- [ ] `PatternDetectionService.detect(userId)`: catalog pairs → lag-align → n-gate → upsert (frozen-state rule); `PatternDetectionJob` cron loop (per-user isolation, V2.2 idiom).
- [ ] `PatternService.list/decide` + controller ops; ITs (API + switch-off + job idempotence + decision transitions).

### Task 4: FE dual-mode conversion
- [ ] `patternsApi.ts` (wire→FE mapping incl. critique-optional), `patternsHooks.ts` (`usePatterns` bootstrap `{patterns, recentlyConfirmed, degraded, mode}`, `usePatternActions.decide`); export from `data/hooks.ts`.
- [ ] `PatternsPage`/`PatternCard` wiring (decision mutation real / local mock; conditional critique; r/n evidence line; degraded + loading states).
- [ ] MSW fixtures + both-mode tests; `pnpm build`.

### Task 5: gates + docs + close
- [ ] BE+FE gates green; lint-docs + lint-liquibase.
- [ ] `companion.md` + `insights.md` + roadmap; review workflow → fixes → `--no-ff` merge → push → live verify → `bd close mezo-fnnq.12`.
