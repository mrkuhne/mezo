---
title: Proactive layer (briefing, weekly prose, heartbeat, predictions)
type: feature-domain
status: in-progress
updated: 2026-07-06
tags: [proactive, briefing, ai, llm, backend, phase-4]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/feature/proactive
  - api/feature/proactive/proactive.yml
  - backend/src/main/resources/db/changelog/1.0.0/script/202607061100_mezo-h4wp.1_create_briefing.sql
related: [companion, today, insights, _platform-api-backend]
---

# Proactive layer (briefing, weekly prose, heartbeat, predictions) — Feature Documentation

> One-line: the Phase-4 layer where the companion **speaks first**. The **B stage is complete** —
> the morning briefing is LIVE end-to-end: a `feature/proactive` package (behind
> `mezo.feature.proactive.enabled`, dual-gated with the companion switch) with a `briefing` table,
> a pure-code+one-LLM-call `BriefingGenerator`, a dawn `BriefingJob` cron, sleep-triggered capped
> regeneration on the read path, and a `GET /api/proactive/briefing` the **Today card now renders**
> — the companion's own morning words, zero demo copy (the „Demo tartalom" label survives only as
> the honest fallback). **Status: backend 🟢 B1.2 (table + generator + dawn cron + hybrid freshness
> + lazy read) · FE 🟢 B1.2 (Today card real, honest fallback) — the v1 exit criterion is met.**
> The four value stages (B briefing → W weekly prose → H heartbeat → P predictions) and the 8-slice
> map live in the roadmap; this doc tracks **what exists now**.

## 1. Summary

The **proactive** layer is Phase-4: instead of answering when asked (the [companion](companion.md)
chat), mezo starts the conversation — a morning briefing, a weekly memoir, an in-app heartbeat,
predictions. It is built on the finished companion stack (V0.3 snapshot + V1.1 facts + V2.2 daily
summaries) in 8 slices (epic `mezo-h4wp`); **B1.1 (`mezo-h4wp.1`) shipped the briefing spine;
B1.2 (`mezo-h4wp.2`) took it live — dawn cron, sleep-triggered freshness, and the Today FE swap.**

**B1.1 (`mezo-h4wp.1`) — skeleton + briefing spine:**

- **A new package** — `feature/proactive/` is born, every bean `@ConditionalOnProperty` on **BOTH**
  `mezo.feature.companion.enabled` AND `mezo.feature.proactive.enabled` (the generator calls the
  `CompanionLlm` port, so proactive presupposes companion — §9 gotcha b). Switch either off ⇒ no
  beans ⇒ the whole `/api/proactive/*` surface 404s.
- **One owned table** — `briefing` (UUID PK, `created_by`, soft-delete; `content` is a **typed
  jsonb envelope** `BriefingContentEnvelope{eyebrow, body[], refs[]}`, `generated_at` = the
  staleness anchor B1.2 will read). Uniqueness is a **partial** unique index (one LIVE briefing per
  user+day; a soft-deleted row doesn't block regeneration — B1.2's staleness path = soft-delete +
  insert, the `daily_summary` precedent).
- **`BriefingGenerator`** — the spine: a **pure-code gather** composes the shipped companion reads
  (V0.3 `ContextSnapshotAssembler` + V1.1 `KnowledgeFactService` facts block + last-`past-days`
  `daily_summary` narratives) plus a **numbered ref-candidate list** (6 static snapshot candidates
  + one `Memory` candidate per summary) → **ONE cheap-tier `CompanionLlm.complete` call** answering
  a **strict-JSON** contract `{eyebrow, body[], refIndexes[]}` → defensive parse → **bounds-checked,
  deduped index→ref resolution** (the model SELECTS refs by index, can never invent one). Gather =
  pure code, prose = pure LLM (NFR-M-4). **Empty summary window OR unusable answer ⇒ NO row**
  (honest absence, never a fabricated briefing); existing row ⇒ returned untouched (idempotent).
- **A lazy read** — `GET /api/proactive/briefing?date=` (contract fragment `proactive.yml`):
  persisted row, or lazy-generate on the spot; `null` ⇒ **404 `RESOURCE_NOT_FOUND`** (the honest
  empty-window state). `date` optional, defaults to the server's today.
- **Fake sentinel** — `FakeCompanionLlm` gained a `[fake-briefing:{…}]` sentinel dispatched on a
  **literal mirror** of `BRIEFING_MARKER` (`BRIEFING_MARKER_MIRROR`; a companion→proactive import
  would be a package cycle — §9 gotcha a).
- **FE untouched** — the real briefing FE swap is B1.2; the Today card still renders static demo
  copy behind the „Demo tartalom" label.

**B1.2 (`mezo-h4wp.2`) — cron + hybrid freshness + FE swap (the flagship goes live):**

- **A dawn cron** — `BriefingJob` (`service/BriefingJob.java`) `@Scheduled` on
  `mezo.proactive.briefing.cron` (05:45 server zone) pre-generates **TODAY's** briefing per user
  before the typical wake. Gated on a THIRD switch on top of the dual gate —
  `mezo.techcore.cron.briefing-job.enabled` (`BRIEFING_JOB_SWITCH`) — off ⇒ no bean.
  **Deliberately NO multi-day backfill** (a past morning's briefing is never read; the lazy GET is
  the miss-recovery), idempotent (an existing row is returned untouched, no LLM call), per-user
  failures isolated so one bad user never kills the run (§9 decision f).
- **Sleep-triggered capped regeneration** — the read path (`ProactiveBriefingService.refreshIfStale`)
  now refreshes a stale briefing: if a `sleep_log` with `date >= day-1` was `created_at` AFTER the
  briefing's `generated_at`, last night's sleep-first input (FR-2.1.1) was missing from the prose ⇒
  **soft-delete + regenerate**, carrying `regen_count + 1`, capped at `regen-cap-per-day` (2). The
  cap is checked FIRST (a hard ceiling); a failed regeneration serves 404 for THAT request and its
  `@Transactional` rollback restores the old row intact — the next request retries (§9 decision g).
  New `SleepLogRepository` exists-probe finder; no new table (the `regen_count` column is the only
  schema add).
- **The FE swap (Today card real)** — `useBriefing()` (`data/today/briefingHooks.ts`) reads the GET
  for the FE's LOCAL day; `useToday` composes it (`briefing: Briefing | null`, `briefingDemo =
  serverBriefing == null`). The Today card renders the generated prose + REAL ref chips with **no
  label**; the „Demo tartalom" label survives only as the **honest fallback** (loading / 404 /
  switch off → `resolveBriefing` static card at `TodayPage.tsx:35`). Mock mode returns null
  synchronously ⇒ byte-identical Phase-1 fallback (§9 decision h). The FE `Briefing.confidence` went
  **optional** (server briefings carry none — the fabricated-number rule; §9 gotcha c).

**Status per layer:**

| Layer | State | Notes |
|---|---|---|
| Backend (table + envelope + generator + lazy read) | 🟢 B1.2 | Behind BOTH `mezo.feature.companion.enabled` AND `mezo.feature.proactive.enabled`; either off ⇒ the whole HTTP surface 404s. |
| Briefing generation | 🟢 B1.2 | Pure-code gather + ONE cheap-tier `CompanionLlm.complete`, strict-JSON, model-selected refs, empty-window/unusable ⇒ 404. |
| Cron (dawn pre-generation) | 🟢 B1.2 | `BriefingJob` 05:45, today-only per user (NO backfill — the lazy GET is the miss-recovery), failures isolated; third switch `briefing-job.enabled`. |
| Read-path freshness (sleep-triggered regen) | 🟢 B1.2 | `refreshIfStale`: late `sleep_log` (`date >= day-1`, after `generated_at`) ⇒ soft-delete + regenerate, `regen_count` cap 2/day; failed regen ⇒ 404 + rollback restores the old row. |
| Frontend (Today card swap) | 🟢 B1.2 | Today renders the generated briefing (real ref chips, no label); „Demo tartalom" survives only as the honest fallback. |
| Weekly prose / heartbeat / predictions | ⛔ later slices | W/H/P stages — see the roadmap. |

**Driver:** `mezo-h4wp.2` (B1.2, on `mezo-h4wp.1`'s spine). **Design of record:**
[`docs/superpowers/specs/2026-07-06-proactive-layer-design.md`](../superpowers/specs/2026-07-06-proactive-layer-design.md)
(§2 hybrid generation, §3-§4 briefing data model, §6 honest-numbers guardrails, §7 emptiness gate);
slice map [`docs/superpowers/plans/2026-07-06-proactive-roadmap.md`](../superpowers/plans/2026-07-06-proactive-roadmap.md)
§B1.1–§B1.2. Builds on the [companion](companion.md) stack (snapshot/facts/summaries).

## 2. User-facing behavior

**Live since B1.2 — the Today „Reggeli briefing" card.** When Daniel opens the app in the morning
the card shows **the companion's own generated prose** about HIS night and HIS day, with **real
reference chips** (the code-collected, model-selected `refs` — Sleep/Goal/Workout/… tags) and **no
label** — zero demo copy. The dawn cron has usually already written it; if not, the first GET of the
day generates it on the spot (lazy fallback), and a late-arriving sleep log triggers one capped
regeneration so the prose reflects last night.

**The honest fallback.** When there is no generated briefing — the proactive/companion/cron switch
is off, generation failed / the narrative window is empty (404), or the read is still loading — the
card falls back to the **static Phase-1 demo copy behind the „Demo tartalom" label**
([today.md](today.md)), the degraded state rather than the default. In **mock mode** the card is
always this static card (byte-parity with Phase-1). The label is now the exception, not the rule.

See [today.md §2](today.md) for the card in the context of the full Today screen.

## 3. Architecture & data flow

**The briefing read (B1.2 — persisted row · refresh-if-stale · lazy generate):**

```
GET /api/proactive/briefing?date=YYYY-MM-DD    (date optional)
  → ProactiveController.getBriefing(date)         controller/ProactiveController.java:24  (implements ProactiveApi)
      currentUserId.get()  (JWT subject → UUID; techcore/security/CurrentUserId)
  → ProactiveBriefingService.getBriefing(userId, date)   service/ProactiveBriefingService.java:41  @Transactional
      day = date != null ? date : LocalDate.now()          (FE sends its LOCAL date — check-in precedent)
      findByCreatedByAndBriefingDate(userId, day)          persisted row?
        ├─ present ⇒ refreshIfStale(userId, day, existing)  (B1.2 — sleep-triggered capped regen)
        └─ empty   ⇒ briefingGenerator.generate(userId, day) (lazy generation)
      null ⇒ throw SystemRuntimeErrorException(RESOURCE_NOT_FOUND, 404)   (honest empty-window / failed-regen state)
      → mapper.toBriefingResponse(briefing)                (Instant → UTC OffsetDateTime)
```

**The dawn cron (B1.2 — `service/BriefingJob.java`):**

```
@Scheduled(cron = "${mezo.proactive.briefing.cron}")   05:45 server zone; three-switch bean
  today = LocalDate.now()
  for each appUserRepository.findAll():
     try  briefingGenerator.generate(user.id, today)   (TODAY only — no multi-day backfill)
     catch → log.warn + continue                        (per-user isolation; one bad user never kills the run)
```

Idempotent (an existing row is returned untouched, no LLM call), so a cron run that overlaps the
lazy GET can't double-generate. There is **no catch-up loop** — a past morning is never read, and a
missed run is covered by the lazy GET the next time the app opens (§9 decision f).

**Refresh-if-stale (B1.2 — `ProactiveBriefingService.refreshIfStale`, service:62):**

```
refreshIfStale(userId, day, existing):
  cap = properties.briefing().regenCapPerDay()          (2)
  if existing.regenCount >= cap        → return existing  ── HARD CEILING, checked FIRST
  lateSleep = sleepLogRepository.existsBy…DateGreaterThanEqualAndCreatedAtAfter(
                 userId, day.minusDays(1), existing.generatedAt)   ── sleep_log date >= day-1, created after generation
  if !lateSleep                        → return existing  ── fresh enough
  nextCount = existing.regenCount + 1
  delete(existing); flush()            ── @SQLDelete soft-delete; flush frees the partial-unique slot BEFORE insert
  fresh = briefingGenerator.generate(userId, day)
  if fresh == null                     → return null      ── regen failed ⇒ getBriefing throws 404 ⇒ @Transactional
                                                              rollback UNDOES the delete+flush → old row restored,
                                                              next request retries (§9 decision g)
  fresh.setRegenCount(nextCount); return fresh
```

**The generator (`service/BriefingGenerator.java`):**

```
generate(userId, date)                                  BriefingGenerator.java:87  @Transactional
  1. existing row? ⇒ return untouched                   (idempotent; NO LLM call)
  2. gather(userId, date)                                BriefingGenerator.java:120  PURE CODE, LLM-free
       past = last past-days daily_summary narratives (newest first)
       past.isEmpty() ⇒ return null                      ── THE EMPTINESS GATE (§9 gotcha d)
       payload = ContextSnapshotAssembler.render(V0.3)   (six HU blocks, nincs adat absences)
               + KnowledgeFactService.renderPromptBlock (V1.1 top-N confirmed facts)
               + "KORÁBBI NAPOK" past-summary narratives
               + "HIVATKOZÁS-JELÖLTEK" numbered candidate list (index: [kind] label)
       candidates = 6 static snapshot Refs + one Memory Ref per summary
  3. companionLlm.complete(PROMPT, payload)              ── ONE cheap-tier call (BRIEFING_MARKER prompt)
  4. parse(answer)                                       first-{ to last-} defensive JSON → ParsedBriefing
       null / blank eyebrow / empty body ⇒ return null   ── unusable answer, NO row (§9 gotcha d)
  5. resolveRefs(refIndexes, candidates)                 bounds-checked, order-preserving, deduped
       (model SELECTS by index; out-of-range/dupes dropped — can never invent a ref)
  6. saveAndFlush BriefingEntity{content envelope, generatedAt=now truncated-to-µs}
       (µs truncation matches Postgres timestamptz precision — keeps the B1.2 idempotence assert stable)
```

Gather = pure code (IT-asserted LLM-free), prose = pure LLM — the companion V2.2 summary-generator
split (NFR-M-4). The prompt (`BRIEFING_MARKER` + HU rules: lead with poor sleep, multi-horizon,
close with 2-3 focus points, invent-no-numbers, never suggest med-dose changes) mirrors the
companion clinical/honest-number guardrails.

**Switch-gating.** `ProactiveController`, `ProactiveBriefingService`, `BriefingGenerator` (and the
mapper via the services) are all `@ConditionalOnProperty(name = {COMPANION_SWITCH, PROACTIVE_SWITCH},
havingValue = "true")` — **both** must be `true`. Either off ⇒ no proactive beans ⇒ the whole
`/api/proactive/*` surface 404s (there's no controller to route to). The dual gate is structural,
not a runtime check (§9 gotcha b).

**Ownership.** `BriefingEntity extends OwnedEntity` (soft-delete via `@SQLDelete`/`@SQLRestriction`);
`created_by` is stamped from `CurrentUserId.get()` server-side, the finder is
`findByCreatedByAndBriefingDate` (owner + soft-delete scoped). Standard auth spine
([`_platform-api-backend.md`](_platform-api-backend.md); the companion precedent).

## 4. Data model & API

### Backend table (B1.1 + B1.2, 🟢)

Migrations `202607061100_mezo-h4wp.1_create_briefing.sql` + `202607070900_mezo-h4wp.2_briefing_regen_count.sql`
(both registered in `db/changelog/1.0.0/1.0.0_master.yml`):

- **`briefing`** — `id uuid pk (gen_random_uuid())`, `created_by uuid fk→app_user(id) ON DELETE
  CASCADE`, `is_deleted boolean default false`, `created_at timestamptz default now()`,
  `briefing_date date not null` (the morning it is FOR — not when generated), `content jsonb not
  null` (the typed envelope), `generated_at timestamptz not null` (the staleness anchor
  `refreshIfStale` compares against), **`regen_count int not null default 0`** (B1.2 — how many
  sleep-triggered regenerations this day's briefing has had; the read path stops at
  `regen-cap-per-day`). Uniqueness is a **partial unique index**
  `uq_briefing_created_by_briefing_date … where is_deleted = false` (one LIVE briefing per user+day;
  a soft-deleted row doesn't block regeneration — the staleness path soft-deletes + reinserts,
  carrying `regen_count + 1`) which doubles as the lookup index.

### Entity + envelope

`BriefingEntity` (`entity/BriefingEntity.java`) `extends OwnedEntity`, UUID `@GeneratedValue` id,
soft-deleted; `content` maps as a typed jsonb via `@JdbcTypeCode(SqlTypes.JSON)` onto
`BriefingContentEnvelope` (`entity/BriefingContentEnvelope.java`) — a record
`{String eyebrow, List<String> body, List<Ref> refs}` with a nested `Ref(String kind, String
label)` (ADR 0006 / `ProvenanceEnvelope` typed-jsonb precedent). The envelope **deliberately
mirrors the FE Briefing shape MINUS `confidence` and `tone`** (§9 gotcha c). `refs` are code-
collected candidates the model selected by index, never invented.

### REST endpoint (contract-first — tag `Proactive` → `ProactiveApi`)

Fragment `api/feature/proactive/proactive.yml`; `ProactiveController implements ProactiveApi`.
Every non-2xx returns `SystemMessageList`. The path is protected (401 without a token).

| Method + path | Returns | Status | Notes |
|---|---|---|---|
| `GET /api/proactive/briefing?date=` | `BriefingResponse` | 200 · 401 · 404 | `date` optional (FE sends its LOCAL date; defaults to server today). Persisted row or lazy-generate; **404 `RESOURCE_NOT_FOUND`** when no `daily_summary` in the past-days window (§9 gotcha d). |

Schemas: `BriefingResponse{date, eyebrow, body[], refs[], generatedAt}` +
`BriefingRef{kind, label}` — **no `confidence`, no `tone`** on the wire (§9 gotcha c). `refs[].kind`
is the FE `RefTag` vocabulary (`WeightTrend|Goal|Workout|FuelDay|Medication|Sleep|Memory`).

### Configuration

`config/ProactiveProperties.java` (`@Validated`, binds `mezo.proactive.briefing.*`):

- **`past-days`** (`@Min(1) @Max(14)`, default **7**): how many finished days of narrative memory the
  gather reads — and doubles as the **emptiness gate** (zero summaries in the window ⇒ no briefing ⇒ 404).
- **`cron`** (`@NotBlank`, default `0 45 5 * * *`): the dawn `BriefingJob` schedule (server zone), before
  the typical wake.
- **`regen-cap-per-day`** (`@Min(0) @Max(5)`, default **2**): the per-user+day ceiling on
  sleep-triggered regenerations (`refreshIfStale`); 0 = never regenerate.

Plus the techcore job switch **`mezo.techcore.cron.briefing-job.enabled`** (`FeaturesConfiguration.BRIEFING_JOB_SWITCH`,
default `true`) — the third `@ConditionalOnProperty` on the `BriefingJob` bean, on top of the
companion+proactive dual gate; off ⇒ the cron bean does not exist (the lazy GET still serves).

## 5. Integrations

Proactive is a **Phase-4 domain that reads from companion + the other features, never the reverse**
(the roadmap coupling rule; the frozen ArchUnit cycle rule guards it).

### 5.1 Proactive → Companion (✅ B1.1 wired — read-only, one-way)
The generator composes three companion capabilities directly:
`ContextSnapshotAssembler.render(userId, date)` (V0.3 today-block),
`KnowledgeFactService.renderPromptBlock(userId)` (V1.1 top-N facts),
`DailySummaryRepository.findByCreatedByAndSummaryDateGreaterThanEqualOrderBySummaryDateDesc(…)`
(V2.2 narratives), and the `CompanionLlm.complete(system, user)` port for the one prose call.
**Contract crossing the seam:** these read methods with explicit `userId` scoping; strictly one-way
— no companion code imports proactive. This one-way rule is why the fake sentinel's marker is a
literal mirror rather than an import (§9 gotcha a).

### 5.2 Proactive ↔ LLM provider (wired via companion, ADR 0008)
All model access goes through the same `CompanionLlm` port (cheap tier — one `complete` call per
briefing). Real `GeminiCompanionLlm` / test `FakeCompanionLlm` (the `[fake-briefing:{…}]`
sentinel). Provider detail is hidden by the port; proactive adds no new adapter.

### 5.3 Proactive ↔ API contract & backend platform (wired)
On the contract-first pipeline ([`_platform-api-backend.md`](_platform-api-backend.md)):
`proactive.yml` → merged `api/openapi.yml` → generated `ProactiveApi` + DTOs (backend) and
`api.gen.ts` types (FE). Drift = compile error.

### 5.4 Proactive → Today FE (✅ B1.2 wired — dual-mode read)
The Today „Reggeli briefing" card ([today.md](today.md)) is the consumer. `useBriefing()`
(`data/today/briefingHooks.ts`) reads `GET /api/proactive/briefing?date=<local>` via
`briefingApi.get` (`data/today/briefingApi.ts`, `toBriefing` wire→`Briefing`), and `useToday`
composes it into `briefing: Briefing | null` + `briefingDemo = serverBriefing == null`. `TodayPage`
renders the generated prose when present, else `resolveBriefing` behind the „Demo tartalom" label.
Mock mode: `useBriefing` returns null synchronously (no fetch) ⇒ the static fallback (byte-parity).
The seam type is the FE `Briefing` **minus** `confidence`/`tone` (the wire omits both — §9 gotcha c;
`Briefing.confidence` is now optional to model that).

## 6. How to use it (consume)

**Over HTTP** (bearer token from `POST /api/auth/login`; the backend must run with `demodata` so
the owner exists, and BOTH `mezo.feature.companion.enabled=true` + `mezo.feature.proactive.enabled=true`
— the defaults). A briefing only generates when at least one `daily_summary` exists in the past-days
window; for a keyless local run use the fake adapter and plant a `[fake-briefing:{…}]` sentinel via a
check-in note (the `BriefingGeneratorIT` pattern):

```bash
TOKEN=... # from POST /api/auth/login
curl -s "http://localhost:8090/api/proactive/briefing?date=2026-07-06" \
  -H "Authorization: Bearer $TOKEN"
# → { "date":"2026-07-06", "eyebrow":"…", "body":["…"], "refs":[{"kind":"Sleep","label":"regeneráció"}], "generatedAt":… }
# → 404 SystemMessageList when there is no daily_summary in the window (honest empty state)
```

There is no FE consumer yet — B1.2 wires the Today card.

## 7. How to extend it

- **B1.2 shipped (cron + staleness + FE swap) — the extension pattern:** the dawn `BriefingJob`
  (`@Scheduled`, three-switch, today-only, per-user isolation), the read-path `refreshIfStale`
  (soft-delete + regenerate on a late `sleep_log`, `regen_count` cap), and the dual-mode `useBriefing`
  Today swap are the working templates for the next stages. **To tune freshness:** widen the staleness
  trigger beyond sleep (more `existsBy…` probes in `refreshIfStale`) or raise `regen-cap-per-day`.
  **To move the cron:** `mezo.proactive.briefing.cron` (never add a catch-up loop — a past morning is
  never read; §9 decision f).
- **New proactive surface (W/H/P):** add a sibling `*Generator` + table + `*.yml` fragment in
  `feature/proactive/`, gated on the same dual switch. Weekly prose (W) reuses the same gather idiom
  at the smart tier (`CompanionLlm.completeSmart`).
- **Prompt / ref-candidate tuning:** the prompt is `BriefingGenerator.PROMPT` (keep the
  `BRIEFING_MARKER` prefix + its `FakeCompanionLlm` literal mirror in sync — §9 gotcha a); ref
  candidates are `SNAPSHOT_CANDIDATES` + the per-summary `Memory` refs in `gather`.
- **Never add `confidence`/`tone`** back to the envelope without a real computed source (§9 gotcha c).

## 8. Testing

Integration-first, over the fixed `mezo_test` DB (or Testcontainers); the fake LLM's
`[fake-briefing:{…}]` sentinel scripts deterministic answers. **24 tests across 8 classes** — the
B1.1 five plus three B1.2 classes:

- **`BriefingPersistenceIT` (4)** — envelope jsonb round-trip; the partial-unique index rejects a
  second LIVE row for the same day; soft-delete allows regeneration; owner-scoped finder isolation.
- **`BriefingGeneratorIT` (6)** — gather composes snapshot+facts+summaries+candidates when data
  exists; gather returns null on an empty window; generate persists the scripted envelope; generate
  returns the existing row without an LLM call; generate returns null on non-parseable JSON; generate
  drops out-of-range (hallucinated) ref indexes.
- **`ProactiveApiIT` (4)** — HTTP: lazy-generate + idempotent re-GET; `date` param honored for a past
  date; 404 when no narrative memory; 401 without a token.
- **`ProactiveApiSwitchOffIT` (1)** — `mezo.feature.proactive.enabled=false` ⇒ 404 (bean absence).
- **`ProactiveApiCompanionOffIT` (1)** — `mezo.feature.companion.enabled=false` ⇒ 404 (dual gate).
- **`BriefingJobIT` (3, B1.2)** — the dawn run generates today's briefing when the user has narrative
  memory; is idempotent when a briefing already exists; skips a user without memory and still serves
  the others (per-user failure isolation).
- **`BriefingJobSwitchOffIT` (1, B1.2)** — `mezo.techcore.cron.briefing-job.enabled=false` ⇒ no
  `BriefingJob` bean (the third switch).
- **`BriefingFreshnessIT` (4, B1.2)** — `refreshIfStale` regenerates when a sleep log arrived after
  generation; serves the existing row when no late input; stops regenerating once the cap is reached;
  serves 404 **and preserves the old row** when regeneration fails (the rollback path).

**FE (Vitest + RTL):** `data/today/briefingHooks.test.tsx` (3) — wire→`Briefing` mapping (no
confidence), 404→null, mock null without fetching; `features/today/components/BriefingCard.test.tsx`
adds a generated-briefing-no-label case; `data/today/todayHooks.test.tsx` adds real-mode
server-briefing (`briefingDemo=false`) + default-404 fallback (`briefingDemo=true`) cases; MSW default
`/api/proactive/briefing` handler returns 404.

Test infra: `support/populator/BriefingPopulator.java` (the aggregate factory) + `briefing` in the
`ResetDatabase` TRUNCATE list. Full backend + FE gates green at B1.2 close (BE clean-test green, FE
both modes).

## 9. Decisions, gotchas & deferred

- **(a) `BRIEFING_MARKER` is literal-mirrored in `FakeCompanionLlm` — keep in sync.** The fake
  dispatches on `BRIEFING_MARKER_MIRROR` (`"REGGELI-BRIEFING-FELADAT"`), a **copy** of
  `BriefingGenerator.BRIEFING_MARKER`, NOT an import — a `companion` → `proactive` import would
  create a package cycle that the frozen ArchUnit rule fails the build on. The two literals must be
  edited together (both carry a comment pointing at the other).
- **(b) Proactive beans condition on BOTH switches.** Every bean is
  `@ConditionalOnProperty(name = {COMPANION_SWITCH, PROACTIVE_SWITCH}, havingValue = "true")` —
  proactive calls the `CompanionLlm` port, so it presupposes companion. Switch either off ⇒ no beans
  ⇒ `/api/proactive/*` 404s (proven by both switch-off ITs). The gate is structural (bean absence),
  not a runtime 403.
- **(c) `confidence`/`tone` are deliberately absent from the wire.** The FE `Briefing` type carries
  `confidence`/`tone`, but the envelope and `BriefingResponse` omit both: an LLM's self-reported
  confidence is a **fabricated number** (the honest-numbers rule, spec §6), and `tone` is dead FE
  data with no source. Don't reintroduce either without a real computed value.
- **(d) Empty summary window ⇒ 404 by design.** No `daily_summary` in the `past-days` window (or an
  unusable LLM answer — null/blank eyebrow/empty body) ⇒ `generate` returns null ⇒ the service
  throws 404. A briefing with no narrative memory to ground it would be fabricated; the honest state
  is "no briefing yet". This is the v1 emptiness gate (spec §7) — **B1.2 may loosen it** (e.g. a
  first-day briefing from the snapshot alone).
- **(e) Staleness is sleep-only in v1, windowed `date >= day-1`, capped 2/day.** The only key input
  that triggers a regeneration is a `sleep_log` (FR-2.1.1 — the briefing leads with the night); the
  window is `date >= day-1` so a log entered just after midnight for "last night" still counts, and
  `created_at > generated_at` is what makes it "late". The cap (`regen-cap-per-day`, 2) is checked
  FIRST as a hard ceiling — an unstable input can't loop the LLM. Widening the trigger set (fuel,
  check-ins) is a future tuning knob (§7), deliberately NOT in v1.
- **(f) The cron does NOT backfill — today only.** `BriefingJob` generates only `LocalDate.now()`
  per user. A past morning's briefing is never read (the card shows TODAY), so pre-generating history
  would be pure waste; a missed cron run is recovered by the lazy GET the next time the app opens.
  This is the deliberate difference from the companion `DailySummaryJob`'s catch-up=backfill idiom
  (summaries ARE read historically; briefings are not).
- **(g) A failed regeneration serves 404 for THAT request only — the old row survives.** In
  `refreshIfStale`, the soft-delete + flush happen inside `getBriefing`'s `@Transactional`; if the
  regeneration returns null (unusable LLM answer), the service throws 404, which **rolls the whole
  transaction back** — undoing the delete+flush and restoring the old row intact. Only that one
  request 404s; the next request retries. There is never a permanently blank morning from a transient
  LLM failure. (`BriefingFreshnessIT.testGetBriefing_shouldServe404AndPreserveOldRow_whenRegenerationFails`
  pins this.)
- **(h) FE fallback: the static card is the honest degraded state, and `briefingVariants` never
  apply to a generated briefing.** `useToday` renders the server briefing when present; on null (mock,
  loading, 404, switch off) it falls back to `resolveBriefing(dayState)` — the labelled Phase-1 static
  card, merged with `briefingVariants` (good/rough tone spread). Those variants shape ONLY the fallback;
  a generated briefing is rendered verbatim. `Briefing.confidence` went **optional** in `types.ts` so
  the server shape (no confidence) is a valid `Briefing` — the card shows „Demo tartalom" in demo mode,
  a Confidence % only if a real confidence is ever set, else nothing (§9 gotcha c / the honest-numbers rule).
- **Deferred to W/H/P:** weekly prose + Memoir (W), in-app heartbeat + Web Push (H), predictions +
  N=1 experiments (P) — later slices, see the roadmap. B1.2 closed the B stage (v1 exit criterion).

## 10. Key files

**API contract**
- `api/feature/proactive/proactive.yml` — 1 endpoint + 2 schemas (tag `Proactive` → `ProactiveApi`);
  registered in `api/generate/merge.yml` → merged `api/openapi.yml` → `api.gen.ts` + `io.mrkuhne.mezo.api.*`.

**Backend — controller / services / mapper**
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/controller/ProactiveController.java` — `implements ProactiveApi`, JWT ownership, dual-switch-gated.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ProactiveBriefingService.java` — the read path (persisted row · `refreshIfStale` · lazy-generate; null ⇒ 404).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/BriefingJob.java` — **B1.2** dawn `@Scheduled` cron (today-only, per-user isolation, three-switch-gated).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/BriefingGenerator.java` — the spine: pure-code `gather` + one `CompanionLlm.complete` + strict-JSON parse + ref resolution; `BRIEFING_MARKER` + `PROMPT` + `SNAPSHOT_CANDIDATES`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/mapper/ProactiveMapper.java` — entity → generated `api.dto` (Instant → UTC OffsetDateTime).

**Backend — entity / repo / config**
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/{BriefingEntity,BriefingContentEnvelope}.java` — the owned entity + typed jsonb envelope (`Ref` nested).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/repository/BriefingRepository.java` — `findByCreatedByAndBriefingDate` (owner + soft-delete scoped).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/config/ProactiveProperties.java` — `mezo.proactive.briefing.{past-days, cron, regen-cap-per-day}` (@Validated).
- `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/repository/SleepLogRepository.java` — **B1.2** `existsBy…DateGreaterThanEqualAndCreatedAtAfter` staleness probe (plain finder, no proactive dependency).
- `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` — `PROACTIVE_SWITCH` + `BRIEFING_JOB_SWITCH` (+ the companion `COMPANION_SWITCH` they pair with).
- `backend/src/main/resources/application.yml` — `mezo.feature.proactive.enabled` + `mezo.proactive.briefing.{past-days,cron,regen-cap-per-day}` + `mezo.techcore.cron.briefing-job.enabled`.

**Backend — LLM fake (companion side, additive)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java` — `BRIEFING_MARKER_MIRROR` (literal) + `[fake-briefing:{…}]` sentinel (§9 gotcha a).

**Frontend — Today consumer (B1.2)**
- `frontend/src/data/today/briefingApi.ts` — `briefingApi.get` + `toBriefing` (wire→`Briefing`, no confidence).
- `frontend/src/data/today/briefingHooks.ts` — `useBriefing()` (dual-mode; mock null no-fetch, real GET or null on 404); re-exported by `data/hooks.ts`.
- `frontend/src/data/today/todayHooks.ts` — `useToday` composes `useBriefing` (`briefing`, `briefingDemo`); `frontend/src/features/today/{pages/TodayPage.tsx,components/BriefingCard.tsx}` — render + three-state label; `frontend/src/data/types.ts` — `Briefing.confidence?` optional.

**Backend — migrations**
- `backend/src/main/resources/db/changelog/1.0.0/script/202607061100_mezo-h4wp.1_create_briefing.sql` + `202607070900_mezo-h4wp.2_briefing_regen_count.sql` (both in `1.0.0_master.yml`).

**Backend — tests**
- `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/{BriefingPersistenceIT,BriefingGeneratorIT,ProactiveApiIT,ProactiveApiSwitchOffIT,ProactiveApiCompanionOffIT,BriefingJobIT,BriefingJobSwitchOffIT,BriefingFreshnessIT}.java`
- `backend/src/test/java/io/mrkuhne/mezo/support/populator/BriefingPopulator.java` + `support/ResetDatabase.java` (`briefing` in the TRUNCATE list).
- FE: `frontend/src/data/today/{briefingHooks.test.tsx,todayHooks.test.tsx}`, `frontend/src/features/today/components/BriefingCard.test.tsx`, `frontend/src/test/msw/handlers.ts` (default 404).

**Docs (link, don't duplicate)**
- Design spec: [`docs/superpowers/specs/2026-07-06-proactive-layer-design.md`](../superpowers/specs/2026-07-06-proactive-layer-design.md)
- Roadmap (8 slices): [`docs/superpowers/plans/2026-07-06-proactive-roadmap.md`](../superpowers/plans/2026-07-06-proactive-roadmap.md)
- Companion stack it builds on: [`companion.md`](companion.md)
- Roadmap/milestone log: [`docs/milestones/roadmap.md`](../milestones/roadmap.md)
