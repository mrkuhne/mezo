# Diagnózis (on-demand riport) — Design

**Date:** 2026-08-31 · **Status:** approved by user · **bd:** epic `mezo-hqfi`
(children `.1` LogFreshnessProbe · `.2` backend · `.3` experiment link · `.4` frontend)

> Brainstormed with Daniel on 2026-08-31. UI language: Hungarian, labels verbatim;
> this spec is English per repo convention.

## Purpose

The **second report** in mezo, and the first **on-demand** one: a user-triggered
diagnostic that answers a *phenomenon* question with a ranked list of suspects,
each bound to measured evidence and carrying one concrete probe the user can turn
into a tracked experiment.

V1 ships exactly one phenomenon — **fatigue** („Miért vagyok fáradt?") — but the
schema, renderer and evidence machinery are deliberately phenomenon-agnostic, so a
sibling diagnosis is a recipe (collector + suspect catalog + prompt), not a feature
slice.

### Why this one, and why now

The weekly review (`mezo-p2tr`, `/me/week`) already built mezo's report primitive
without naming it: deterministic gather → one strict-JSON LLM call → anchors chosen
**by index** from code-collected candidates → persisted artifact with `generatedAt`
+ `stale` + regenerate → `FeedbackChips` → notification → chat handoff. The d20
follow-up **F6.5** (`mezo-d20.7.6`) adds an eighth slot: the report *proposes*
(`candidateFacts[]`) and the user accepts — making a report interventional, not
just descriptive.

What is missing from that machinery is the **on-demand axis**: everything generates
on cron. Nothing is user-triggered, nothing is quota-bounded, and nothing answers a
question at the moment the user has it. The diagnosis is deliberately the maximal
contrast to the weekly review along every axis that matters — on-demand vs
scheduled, question-scoped vs period-scoped, narrow-and-deep vs broad,
verdict-shaped vs prose — because that contrast is what reveals which parts of the
weekly machinery are genuinely general and which were incidental.

## Decisions taken (with user)

1. **Scope:** one phenomenon (fatigue) in V1, but a phenomenon-agnostic output
   schema and renderer. A second diagnosis must cost days, not weeks.
2. **Follow-through:** a suspect's probe can become a tracked **experiment**
   (`ExperimentEntity`) on one tap — the report is a loop, not a dead end.
3. **Freshness/cost:** persisted artifact + `stale` probe + explicit regenerate —
   the `weekly_review` pattern verbatim. Opening an existing diagnosis is free;
   only generation consumes quota.
4. **Quota V1:** a per-day count limit, not a token budget. Cost-based quota over
   `llmlog` is deferred and must remain a one-line config swap.
5. **Sequencing:** this spec is written now; implementation is scheduled **after**
   the queued d20 Heti slices (F5.9 / `mezo-d20.7.6` F6.5 / `mezo-d20.7.5` F6.6),
   which already compete for the same code.

## 1. Surface

Entry point: a tile on the Mezo hub (`/mezo`), alongside Minták / Kísérletek /
Tudástár — **„Diagnózis — Miért vagyok fáradt?"**.

Routes, following the `mezo/patterns` + `mezo/patterns/:pairKey` sibling idiom
(full-page leaves, no sub-nav chrome):

```
/mezo/diagnozis        → DiagnosisListPage    (past diagnoses, newest first)
/mezo/diagnozis/:id    → DiagnosisDetailPage
```

> **Open micro-decision:** Mezo-tab slugs are English today (`patterns`, `memoir`,
> `knowledge`, `predictions`, `experiments`) with one exception (`memoria`), while
> the Heti handoff proposes Hungarian slugs for new detail pages
> (`/me/week/elemzes`). This spec picks Hungarian (`diagnozis`); switching to
> `diagnosis` is a one-line change and does not affect anything else.

**Detail page**, top-down:

1. **Verdict** — 1–2 Hungarian sentences + a confidence marker
   (`erős` / `mérsékelt` / `gyenge`), plus the window („az elmúlt 14 nap alapján").
2. **Suspects**, ranked, one card each: title → claim → the measured evidence rows
   (each showing value, delta vs baseline, and its Hungarian source label) →
   a **`✓ Próbáljuk ki`** button carrying the probe.
3. **Footer** — `generatedAt` in human language; `↻ Frissítsd` when `stale`;
   `FeedbackChips` with `artifactKind = 'diagnosis'`.

**List page** — the longitudinal layer, and the reason this beats a chat answer:
past diagnoses with their date, verdict first line, and the outcome of any
experiment they spawned („augusztus 12-én is az alvást mondtad — a kísérlet bejött").

Frontend conventions: `features/mezo/pages/` + components under
`features/mezo/components/`, the d20 `shared/ui/mozaik` + `clay` primitives (no new
primitives), pure math in `logic/`, data via `useDualQuery`/`useRealQuery` dual-mode
discipline with honest `realEmpty`.

## 2. Output schema — phenomenon-agnostic, evidence-bound

```
Diagnosis {
  id, phenomenon: 'fatigue', windowDays, generatedAt, stale
  verdict: string                    # 1-2 HU sentences
  confidence: strong | moderate | weak
  suspects: Suspect[]                # 2..4, ranked
  evidence: EvidenceItem[]           # the code-collected candidates, persisted
}

Suspect {
  rank: int
  title: string
  claim: string
  evidenceIndexes: int[]             # indexes into evidence[] — never free text
  strength: strong | moderate | weak
  probe: { text, metricKey, expectedDirection, totalDays }   # expectedDirection: up|down|stable
}

EvidenceItem {
  metricKey: string                  # MetricKey enum name
  labelHu: string                    # MetricKey.labelHu
  sourceHu: string                   # MetricKey.sourceHu — provenance, shown in UI
  value: number, unitHu: string
  baselineValue?: number, delta?: number
  coverageDays: int, windowLabelHu: string
}
```

Two disciplines keep it honest, both proven in the weekly review:

**Evidence is collected in code; the model only selects.** The collector produces a
deterministically ordered candidate list; the model returns **indexes**, never
references or numbers of its own. Ordering is stable (MetricKey enum order) because
the index *is* the contract — reordering the collector is a breaking change to
persisted rows and must not happen silently.

**`metricKey` and `expectedDirection` come from an enumerated catalog** given in the
prompt and whitelist-validated on the way in. This makes `probe` map **1:1 onto
`ExperimentEntity`** (`title`, `hypothesis`, `metricKey`, `expectedDirection`,
`totalDays`) with no translation layer.

**Hard rules:**

- A suspect with empty `evidenceIndexes` is **dropped** — not asked nicely for in
  the prompt.
- Fewer than 2 domains with data in the window → **no diagnosis**; honest 409, never
  an empty or placeholder report. (`weekly_review`'s "unusable answer ⇒ no row".)
- If no suspect survives validation → no row.

## 3. Backend

### 3.1 The suspect catalog already exists

`companion.service.MetricKey` is a 32-entry enum carrying a Hungarian label, a
Hungarian **source** label and a `MetricDomain` for each metric — including derived
sports-science metrics (`ACWR`, `TRAINING_MONOTONY`, `BEDTIME_VARIABILITY`,
`RUN_HR_RECOVERY_S`). It is simultaneously the metric whitelist, the evidence label
source and the provenance string. `MetricSeriesService.series(userId, metric, from,
to)` is the gather primitive.

### 3.2 `FatigueEvidenceCollector` (`feature.proactive`, pure code, no LLM)

For the fatigue-relevant `MetricKey` subset: pull the window (14 days) and the
baseline (the preceding 28 days), compute mean + delta, and **drop any metric
without sufficient coverage** — fewer suspects beats invented ones. Surviving
metrics render as `EvidenceItem`s. Alongside them, the weekly-gather idiom: the
**confirmed patterns** touching fatigue metrics (`PatternService.list` filtered to
`STATUS_CONFIRMED`) and relevant knowledge facts, plus (see §4) the experiments
earlier diagnoses spawned, with their outcomes.

Exact constants (window length, baseline length, coverage threshold, the metric
subset) live in one `DiagnosisProperties` record and are documented in the feature
doc.

Home is `feature.proactive`, which may read `feature.companion`; the reverse is
forbidden by `ArchitectureTest`. This is the same placement the weekly generator
took.

### 3.3 `DiagnosisGenerator`

One **SMART-tier** call (`CallKind.SMART` — per `GeminiCompanionLlm`, the pipeline
tier, never chat turns), strict JSON. On the way in, bounds-check everything:
2–4 suspects; `evidenceIndexes` in range and non-empty; `metricKey` in the
whitelist; `expectedDirection ∈ {up, down, stable}` (the `ExperimentEntity` vocabulary verbatim); `totalDays` in 3..28; text lengths
bounded. Failing suspects are dropped; zero survivors → no row.

The system prompt inherits the weekly generator's prohibitions (numbers may not be
invented; claims must rest on the supplied evidence) and adds one: a suspect must
name the mechanism it proposes, not merely restate a correlation.

### 3.4 `DiagnosisEntity` (`feature.proactive`, `WeeklyReviewEntity` idiom)

`id`, `created_by`, `phenomenon`, `window_days`, `verdict`, `confidence`,
`suspects` (jsonb envelope), **`evidence` (jsonb envelope)**, `generated_at`,
soft-delete. Index on `(created_by, generated_at desc)`. No unique constraint — many
diagnoses accumulate over time; that is the point.

Evidence is **persisted, not recomputed**: the report must show what it was
generated from, or weeks later different numbers would stand next to the same
conclusion.

### 3.5 Endpoints (`api/feature/diagnosis/diagnosis.yml`)

| method | path | notes |
|---|---|---|
| `GET` | `/api/proactive/diagnosis?phenomenon=fatigue` | list, newest first; `[]` = honest empty, never 404 |
| `GET` | `/api/proactive/diagnosis/{id}` | detail incl. `stale` |
| `POST` | `/api/proactive/diagnosis` | generate (`{phenomenon}`) |
| `POST` | `/api/proactive/diagnosis/{id}/suspect/{rank}/experiment` | §4 |

`POST` generate failure modes, both `SystemMessageList` with Hungarian text:
**409** insufficient data („Kettőnél kevesebb területről van adat az elmúlt két
hétben"), **429** quota exceeded (§5).

## 4. Closing the loop — probe → experiment

`ExperimentEntity` already carries `sourcePatternId` (mezo-tk88.2). Same pattern
once more: **`source` + `sourceDiagnosisId`**, with the check-constraint widened by
migration — exactly as `202608271500_mezo-p2tr_feedback_weekly_review_kind.sql` did
for the feedback kind.

`POST …/{id}/suspect/{rank}/experiment` creates an `ExperimentEntity` with
`status=active`, `startDate=today` and the probe fields copied verbatim. **The tap
is the acceptance** — routing through `proposed` and then the existing
`decide(accept)` would be two round-trips for one intent. Duplicate guard: if an
open experiment already exists for the same `metricKey`, no second row is created;
the existing one is returned and the UI says „már fut egy ilyen kísérleted".

**And this is where the loop closes:** regeneration's gather includes the open and
completed experiments spawned by earlier diagnoses, **with their outcomes**. The
second run is not blind — it knows what was tried and whether it worked. A chat
answer is structurally incapable of this.

## 5. Freshness and quota

**`stale`** — the newest log timestamp (sleep, check-in, meal, weight, workout)
after `generatedAt`.

The weekly review already has this probe (`WeeklyReviewService#isStale`), over
weight / sleep / check-in / meal logs. **Extract it into a shared
`LogFreshnessProbe` (`feature.proactive`) parameterised by an arbitrary date
window** — the diagnosis needs a rolling 14-day window, not an ISO week — and move
`WeeklyReviewService` onto it. Best-effort max-timestamp probe; `false` on ANY probe
failure, as today: staleness is a hint, never a reason to fail a read.

> **Correction to an earlier reading of the Heti feature audit (§8.3).** The audit
> lists two probe shortcomings; neither is a bug this epic can fix, and the
> extraction is therefore **behaviour-preserving**, not a fix.
>
> - *Workout logs are not probed.* This is **deliberate and documented** in
>   `WeeklyReviewService#isStale`: `WorkoutSessionEntity.date` is nullable on
>   template rows, so there is no clean date-window read. Carry the same omission
>   and the same rationale forward.
> - *Only `createdAt` is watched, so an edited log never marks stale.* This is not a
>   probe defect: **`OwnedEntity` has no `updatedAt` column at all** — it carries
>   `createdBy`, `isDeleted` and a `@CreationTimestamp createdAt`, nothing else.
>   Making edits observable means adding `@UpdateTimestamp` plus a migration to the
>   sleep / check-in / meal / weight (and any other probed) entities across five
>   domains. That is its own change with its own risk, filed separately; it is out
>   of scope here.

**Quota V1** — `mezo.proactive.diagnosis.max-per-day`, default **3**, counted from
rows generated today **including soft-deleted ones**, so regenerate-spam counts.
Exceeded → 429 with a Hungarian message. Opening an existing diagnosis is always
free; only generation consumes quota. Cost-based quota over `llmlog` is deferred and
must remain a one-line config swap.

## 6. Honest states (contracts)

| state | rule | text |
|---|---|---|
| < 2 domains with data | no diagnosis | „Kettőnél kevesebb területről van adat az elmúlt két hétben — a Mezo nem tippel." |
| no suspect survived validation | no row, same 409 | as above |
| no diagnosis yet | empty list, inviting | „Még nem kérdezted meg. A Mezo az elmúlt két hét adataiból keres okokat." |
| `stale` | badge + regenerate | „Azóta új adatokat logoltál — `↻ Frissítsd`" |
| quota exceeded | 429 | „Ma már háromszor kérdezted meg — holnap újra." |
| probe already running | no duplicate | „Már fut egy ilyen kísérleted." |
| loading / error | skeleton, retryable | never a silent blank (the `useMeWeek` mistake) |

## 7. Testing (house gates)

- **Backend** (`@SpringBootTest`): collector coverage/threshold discipline and
  deterministic ordering; generator with `FakeCompanionLlm`
  (`@ActiveProfiles("companion-fake")`) covering the strict-JSON contract,
  index bounds-checking, whitelist rejection of an unknown `metricKey`, the
  drop-a-suspect path and the zero-survivors → no-row path; the insufficient-data
  409; the quota 429; experiment creation incl. the duplicate guard; `stale` probe
  incl. the edited-log and workout-log cases the weekly probe misses.
  New table registered in `ResetDatabase` **in the same change**;
  `DiagnosisPopulator` under `support/populator/`.
  No class-level `@Transactional` on paths touching `AppNotificationEmitter`.
- **Frontend:** dual-mode hook tests (mock + real via MSW), page tests for both
  pages, the §6 contracts pinned in tests; both test modes + build green.
- **Contract:** regenerate merged `openapi.yml` + FE client; contract-drift CI gate.
- **Visual:** new goldens for the two pages, both platforms.

## 8. Docs

The diagnosis domain is documented as a **new section in `proactive.md`**, not a
new feature doc — the entity, collector and generator all live in
`feature.proactive`, and a separate doc would orphan half the story. Also update
`companion.md` (MetricKey doubling as the suspect catalog and metric whitelist) and
regenerate `docs/CODEMAP.md` in the same change.
`node scripts/lint-docs.mjs` green.

## 9. Non-goals (YAGNI)

- **No second phenomenon.** The schema makes it cheap; V1 does not spend it.
- **No free-form question.** That is chat again — uncacheable, unpriceable, and it
  cannot carry the evidence-index discipline without a deterministic collector.
- **No push notification.** The user triggers it; there is nothing to announce.
- **No chat anchor.** Extending `context: {kind}` plus a `DiagnosisContextRenderer`
  is its own slice; the probe→experiment path already gives the report an
  afterlife. V1.1.
- **No cost-based quota** (§5).
- **No Heti integration** — a link from a low-recovery day into a diagnosis is
  tempting, but the Heti surface is being rebuilt right now (F5.9); revisit after.
- **No backfill** of diagnoses for past windows.

## 10. Sequencing

1. Queued d20 Heti work lands first: F5.9 (FE), F6.5 (`mezo-d20.7.6`, weekly
   `candidateFacts[]`), F6.6 (`mezo-d20.7.5`, persisted weekly score).
2. **`mezo-hqfi.1`** — `LogFreshnessProbe` extraction + weekly review moved onto it
   (small, standalone, behaviour-preserving — can land independently and early).
3. **`mezo-hqfi.2`** — diagnosis backend: collector → generator → entity → endpoints.
4. **`mezo-hqfi.3`** — `ExperimentEntity` source widening + the experiment endpoint.
5. **`mezo-hqfi.4`** — diagnosis frontend: list + detail pages.

Separately filed, deliberately **not** part of this epic: **`mezo-dz3y`** — the chat
quick-question chips (Daniel's original idea). Those produce a normal chat answer,
not an artifact: no persistence, no quota, no pipeline. Keeping them apart is what
keeps this spec about reports.

One bd issue = one `feat/<topic>` branch = one self-PR (CI gate) = `--no-ff` merge.
