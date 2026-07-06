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

> One-line: the Phase-4 layer where the companion **speaks first**. B1.1 ships only the **morning
> briefing spine** — a new `feature/proactive` package (behind `mezo.feature.proactive.enabled`,
> dual-gated with the companion switch) with a `briefing` table, a pure-code+one-LLM-call
> `BriefingGenerator`, and a lazy `GET /api/proactive/briefing`. **Status: backend 🟢 B1.1
> (table + generator + lazy read) · FE ⛔ until B1.2 (the Today card still shows static demo
> copy behind the „Demo tartalom" label) · cron ⛔ B1.2 (generation is on-open lazy only, no
> `@Scheduled` yet).** The four value stages (B briefing → W weekly prose → H heartbeat →
> P predictions) and the 8-slice map live in the roadmap; this doc tracks **what exists now**.

## 1. Summary

The **proactive** layer is Phase-4: instead of answering when asked (the [companion](companion.md)
chat), mezo starts the conversation — a morning briefing, a weekly memoir, an in-app heartbeat,
predictions. It is built on the finished companion stack (V0.3 snapshot + V1.1 facts + V2.2 daily
summaries) in 8 slices (epic `mezo-h4wp`); **B1.1 (`mezo-h4wp.1`) shipped the briefing spine.**

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

**Status per layer:**

| Layer | State | Notes |
|---|---|---|
| Backend (table + envelope + generator + lazy read) | 🟢 B1.1 | Behind BOTH `mezo.feature.companion.enabled` AND `mezo.feature.proactive.enabled`; either off ⇒ the whole HTTP surface 404s. |
| Briefing generation | 🟢 B1.1 | Lazy-on-open only: pure-code gather + ONE cheap-tier `CompanionLlm.complete`, strict-JSON, model-selected refs, empty-window/unusable ⇒ 404. |
| Cron (dawn pre-generation) | ⛔ B1.2 | No `@Scheduled` yet — generation happens on the first GET of the day. |
| Frontend (Today card swap) | ⛔ B1.2 | Today still shows static demo copy behind „Demo tartalom". |
| Weekly prose / heartbeat / predictions | ⛔ later slices | W/H/P stages — see the roadmap. |

**Driver:** `mezo-h4wp.1` (B1.1). **Design of record:**
[`docs/superpowers/specs/2026-07-06-proactive-layer-design.md`](../superpowers/specs/2026-07-06-proactive-layer-design.md)
(§2 hybrid generation, §3-§4 briefing data model, §6 honest-numbers guardrails, §7 emptiness gate);
slice map [`docs/superpowers/plans/2026-07-06-proactive-roadmap.md`](../superpowers/plans/2026-07-06-proactive-roadmap.md)
§B1.1. Builds on the [companion](companion.md) stack (snapshot/facts/summaries).

## 2. User-facing behavior

**None yet — B1.1 is backend-only.** The Today card that will eventually host the briefing still
renders **static demo copy behind the „Demo tartalom" label** ([today.md](today.md)); the FE swap
(consume the real endpoint, drop the label, render an honest empty/degraded state) is B1.2. The
only externally observable surface is the HTTP endpoint (§4) — reachable but not wired into any
page.

## 3. Architecture & data flow

**The lazy briefing read (B1.1 — the only path):**

```
GET /api/proactive/briefing?date=YYYY-MM-DD    (date optional)
  → ProactiveController.getBriefing(date)         controller/ProactiveController.java:24  (implements ProactiveApi)
      currentUserId.get()  (JWT subject → UUID; techcore/security/CurrentUserId)
  → ProactiveBriefingService.getBriefing(userId, date)   service/ProactiveBriefingService.java:32
      day = date != null ? date : LocalDate.now()          (FE sends its LOCAL date — check-in precedent)
      findByCreatedByAndBriefingDate(userId, day)          persisted row?
        └─ empty ⇒ briefingGenerator.generate(userId, day) (lazy generation)
      null ⇒ throw SystemRuntimeErrorException(RESOURCE_NOT_FOUND, 404)   (honest empty-window state)
      → mapper.toBriefingResponse(briefing)                (Instant → UTC OffsetDateTime)
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

### Backend table (B1.1, 🟢)

Migration `202607061100_mezo-h4wp.1_create_briefing.sql` (registered in `db/changelog/1.0.0/1.0.0_master.yml`):

- **`briefing`** — `id uuid pk (gen_random_uuid())`, `created_by uuid fk→app_user(id) ON DELETE
  CASCADE`, `is_deleted boolean default false`, `created_at timestamptz default now()`,
  `briefing_date date not null` (the morning it is FOR — not when generated), `content jsonb not
  null` (the typed envelope), `generated_at timestamptz not null` (B1.2's staleness anchor).
  Uniqueness is a **partial unique index** `uq_briefing_created_by_briefing_date … where is_deleted
  = false` (one LIVE briefing per user+day; a soft-deleted row doesn't block regeneration —
  B1.2's staleness path soft-deletes + reinserts) which doubles as the lookup index.

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

`mezo.proactive.briefing.past-days` (`config/ProactiveProperties.java`, `@Validated`,
`@Min(1) @Max(14)`, default **7**): how many finished days of narrative memory the gather reads —
and doubles as the **emptiness gate** (zero summaries in the window ⇒ no briefing ⇒ 404).

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

### 5.4 Proactive → Today FE (⛔ B1.2)
The Today card ([today.md](today.md)) is the intended consumer; the real dual-mode swap (endpoint
+ honest empty state, drop the „Demo tartalom" label) is B1.2. No FE change in B1.1.

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

- **B1.2 (cron + staleness + FE swap):** add a dawn `@Scheduled` job (the companion
  `DailySummaryJob` precedent — techcore `SchedulingConfiguration`, catch-up = pre-generation) that
  calls `BriefingGenerator.generate` per user before they open the app; add a **staleness** check
  (regenerate when `generated_at` is older than the day's fresh signals) via **soft-delete + insert**
  — the partial unique index already supports it. Then swap the Today card to the real endpoint.
- **New proactive surface (W/H/P):** add a sibling `*Generator` + table + `*.yml` fragment in
  `feature/proactive/`, gated on the same dual switch. Weekly prose (W) reuses the same gather idiom
  at the smart tier (`CompanionLlm.completeSmart`).
- **Prompt / ref-candidate tuning:** the prompt is `BriefingGenerator.PROMPT` (keep the
  `BRIEFING_MARKER` prefix + its `FakeCompanionLlm` literal mirror in sync — §9 gotcha a); ref
  candidates are `SNAPSHOT_CANDIDATES` + the per-summary `Memory` refs in `gather`.
- **Never add `confidence`/`tone`** back to the envelope without a real computed source (§9 gotcha c).

## 8. Testing

Integration-first, over the fixed `mezo_test` DB (or Testcontainers); the fake LLM's
`[fake-briefing:{…}]` sentinel scripts deterministic answers. **16 tests across 5 classes:**

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

Test infra: `support/populator/BriefingPopulator.java` (the aggregate factory) + `briefing` in the
`ResetDatabase` TRUNCATE list. Full backend gate green (**747/747** at B1.1 close).

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
- **Deferred to B1.2+:** the dawn pre-generation cron, staleness/regeneration (soft-delete + insert
  on the partial index), the Today FE swap (drop „Demo tartalom"). W/H/P value stages are later
  slices — see the roadmap.

## 10. Key files

**API contract**
- `api/feature/proactive/proactive.yml` — 1 endpoint + 2 schemas (tag `Proactive` → `ProactiveApi`);
  registered in `api/generate/merge.yml` → merged `api/openapi.yml` → `api.gen.ts` + `io.mrkuhne.mezo.api.*`.

**Backend — controller / services / mapper**
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/controller/ProactiveController.java` — `implements ProactiveApi`, JWT ownership, dual-switch-gated.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ProactiveBriefingService.java` — the read path (persisted row or lazy-generate; null ⇒ 404).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/BriefingGenerator.java` — the spine: pure-code `gather` + one `CompanionLlm.complete` + strict-JSON parse + ref resolution; `BRIEFING_MARKER` + `PROMPT` + `SNAPSHOT_CANDIDATES`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/mapper/ProactiveMapper.java` — entity → generated `api.dto` (Instant → UTC OffsetDateTime).

**Backend — entity / repo / config**
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/{BriefingEntity,BriefingContentEnvelope}.java` — the owned entity + typed jsonb envelope (`Ref` nested).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/repository/BriefingRepository.java` — `findByCreatedByAndBriefingDate` (owner + soft-delete scoped).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/config/ProactiveProperties.java` — `mezo.proactive.briefing.past-days` (@Validated).
- `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` — `PROACTIVE_SWITCH` (+ the companion `COMPANION_SWITCH` it pairs with).
- `backend/src/main/resources/application.yml` — `mezo.feature.proactive.enabled` + `mezo.proactive.briefing.past-days`.

**Backend — LLM fake (companion side, additive)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java` — `BRIEFING_MARKER_MIRROR` (literal) + `[fake-briefing:{…}]` sentinel (§9 gotcha a).

**Backend — migration**
- `backend/src/main/resources/db/changelog/1.0.0/script/202607061100_mezo-h4wp.1_create_briefing.sql` (in `1.0.0_master.yml`).

**Backend — tests**
- `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/{BriefingPersistenceIT,BriefingGeneratorIT,ProactiveApiIT,ProactiveApiSwitchOffIT,ProactiveApiCompanionOffIT}.java`
- `backend/src/test/java/io/mrkuhne/mezo/support/populator/BriefingPopulator.java` + `support/ResetDatabase.java` (`briefing` in the TRUNCATE list).

**Docs (link, don't duplicate)**
- Design spec: [`docs/superpowers/specs/2026-07-06-proactive-layer-design.md`](../superpowers/specs/2026-07-06-proactive-layer-design.md)
- Roadmap (8 slices): [`docs/superpowers/plans/2026-07-06-proactive-roadmap.md`](../superpowers/plans/2026-07-06-proactive-roadmap.md)
- Companion stack it builds on: [`companion.md`](companion.md)
- Roadmap/milestone log: [`docs/milestones/roadmap.md`](../milestones/roadmap.md)
