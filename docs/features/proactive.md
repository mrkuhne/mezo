---
title: Proactive layer (briefing, weekly prose, heartbeat, predictions, experiments, workout challenges)
type: feature-domain
status: complete
updated: 2026-07-11
tags: [proactive, briefing, ai, llm, backend, phase-4]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/feature/proactive
  - api/feature/proactive/proactive.yml
  - backend/src/main/resources/db/changelog/1.0.0/script/202607061100_mezo-h4wp.1_create_briefing.sql
  - backend/src/main/resources/db/changelog/1.0.0/script/202607071500_mezo-h4wp.4_create_memoir.sql
  - backend/src/main/resources/db/changelog/1.0.0/script/202607071800_mezo-h4wp.5_create_heartbeat_note.sql
  - backend/src/main/resources/db/changelog/1.0.0/script/202607071900_mezo-h4wp.7_create_prediction.sql
  - backend/src/main/resources/db/changelog/1.0.0/script/202607072000_mezo-h4wp.8_create_experiment.sql
  - backend/src/main/resources/db/changelog/1.0.0/script/202607072100_mezo-hbwi_create_challenge.sql
related: [companion, today, insights, train, _platform-api-backend]
---

# Proactive layer (briefing, weekly prose, heartbeat, predictions) — Feature Documentation

> One-line: the Phase-4 layer where the companion **speaks first**. The **B stage is complete** and
> the **W stage („ír rólam hetente") is now COMPLETE — W1 (weeklySuggestion prose) + W2 (weekly
> Memoir) are both LIVE**. The morning briefing runs end-to-end: a `feature/proactive` package
> (behind `mezo.feature.proactive.enabled`, dual-gated with the companion switch) with a `briefing`
> table, a pure-code+one-LLM-call `BriefingGenerator`, a dawn `BriefingJob` cron, sleep-triggered
> capped regeneration on the read path, and a `GET /api/proactive/briefing` the **Today card now
> renders** — the companion's own morning words, zero demo copy (the „Demo tartalom" label survives
> only as the honest fallback). **W1** adds a second surface: a `weekly_suggestion` table + a
> **smart-tier** `WeeklySuggestionGenerator`, a Monday-06:00 `WeeklySuggestionJob`, and a lazy
> `GET /api/proactive/weekly-suggestion` the **Insights Weekly „heti tervjavaslat" card now renders**
> in real mode (404 = the FE's honest placeholder). **W2** adds a third surface: a `memoir` table
> (title + body + typed-jsonb `anchors`) + a **smart-tier** `MemoirGenerator`, a **Sunday-19:00**
> `MemoirJob`, and a lazy `GET /api/proactive/memoir` (latest row, else generate the LAST COMPLETED
> week) the **Insights Memoir tab now un-ghosts** in real mode (404 = the FE's honest „készül"
> state). **H1** opens the H stage („napközben is jelen van"): a `heartbeat_note` table (user+day+
> window identity) + a **cheap-tier** `HeartbeatGenerator`, a two-window `HeartbeatJob` (midday
> 12:30 nudge + evening 20:30 closing, config crons), and a lazy `GET /api/proactive/heartbeat`
> that generates the **latest already-elapsed window** of today on a miss — the **Today page gains
> a `CompanionNoteCard`** (honest absence: no card). **P1** opens the P stage („előre lát"): a
> `prediction` table (pattern-grounded, code-set validity windows, nullable confidence) + a
> **smart-tier** `PredictionGenerator`, a weekly `PredictionJob` + a **deterministic daily
> validation** run, and a list `GET /api/proactive/prediction` that **un-ghosts the Insights
> Predictions tab** (real dual-mode, „tanulom" on null confidence, honest derived accuracy header).
> **Status: backend 🟢 B1.2 + 🟢 W1 + 🟢 W2 + 🟢 H1 + 🟢 P1 · FE 🟢 B1.2 (Today card real) +
> 🟢 W1 (Weekly card real, inert buttons hidden in live) + 🟢 W2 (Memoir tab real, demo extras
> mock-only) + 🟢 H1 (CompanionNoteCard on Today) + 🟢 P1 (Predictions tab real, un-ghosted) —
> with the briefing the IDENT-3 in-app rhythm (≥3 touches/day) is delivered and the first Insights
> forecast surface is honest.** The four value stages (B briefing → W weekly prose → H heartbeat →
> P predictions) and the 8-slice map live in the roadmap; this doc tracks **what exists now**.
>
> **P2** closes the P stage AND the whole epic („előre lát" complete): an `experiment` table
> (proposed → active → completed | dismissed lifecycle) + a **smart-tier** `ExperimentProposalGenerator`,
> a **write path** (`POST /api/proactive/experiment/{id}/decision` L2 accept/dismiss + `POST …/propose`),
> a deterministic `ExperimentOutcomeService` (reusing the shared `MetricWindowEvaluator`), and a
> two-cron `ExperimentJob` — the Insights **Experiments tab un-ghosts** (the LAST `PHASE3_TAB_IDS`
> ghost). **The proactive epic (`mezo-h4wp`, all 8 slices B1.1→B1.2→W1→W2→H1→P1→P2, plus H2 Web Push
> deferred) is COMPLETE** — every prose/forecast Insights surface is honest and real.

## 1. Summary

The **proactive** layer is Phase-4: instead of answering when asked (the [companion](companion.md)
chat), mezo starts the conversation — a morning briefing, a weekly memoir, an in-app heartbeat,
predictions. It is built on the finished companion stack (V0.3 snapshot + V1.1 facts + V2.2 daily
summaries) in 8 slices (epic `mezo-h4wp`); **B1.1 (`mezo-h4wp.1`) shipped the briefing spine;
B1.2 (`mezo-h4wp.2`) took it live — dawn cron, sleep-triggered freshness, and the Today FE swap;
W1 (`mezo-h4wp.3`) opened the W stage — the smart-tier weekly plan-suggestion, live on the Insights
Weekly card; W2 (`mezo-h4wp.4`) closed the W stage — the smart-tier weekly Memoir, un-ghosting the
Insights Memoir tab; H1 (`mezo-h4wp.5`) opened the H stage — the cheap-tier in-day heartbeat notes
on a new Today card; P1 (`mezo-h4wp.7`) opened the P stage — pattern-grounded predictions with
deterministic validation; P2 (`mezo-h4wp.8`) closed the P stage AND the epic — N=1 experiments with
an L2 accept/dismiss write path, un-ghosting the last Insights tab.**

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

**W1 (`mezo-h4wp.3`) — weekly plan-suggestion prose (the W stage opens):**

- **A second owned table** — `weekly_suggestion` (UUID PK, `created_by`, soft-delete; `week_start
  date` = the **ISO Monday** the suggestion is FOR, `prose text` = plain HU, `generated_at`). A
  **partial** unique index (one LIVE suggestion per user+week; soft-delete + reinsert = regeneration,
  the `briefing` precedent) — but W1 has **no regeneration path** (weekly cadence, §9 decision i).
- **`WeeklySuggestionGenerator`** — the same hybrid idiom, one tier up: a **pure-code gather**
  composes the V0.3 `ContextSnapshotAssembler` (current state) + V1.1 facts block + **the prior
  week's `daily_summary` narratives (strictly BEFORE `week_start`)** + the confirmed/monitored
  pattern list → **ONE smart-tier `CompanionLlm.completeSmart` (Gemini Pro) call** → plain HU prose
  (3-5 sentences, 2-3 actionable suggestions, invent-no-numbers, never suggest a med-dose change),
  `strip()`ped and persisted. **Empty prior week OR blank answer ⇒ NO row** (honest absence);
  existing row ⇒ returned untouched (idempotent, no LLM call). Gather = pure code, prose = pure LLM
  (NFR-M-4) — the briefing split at the smart tier. **Since gamified-growth E3 (`mezo-6ng8`)** the
  gather also appends the growth-domain **`NÖVEKEDÉS` block** (`GrowthDigestBlock.render`, feature/quest→progression
  aggregate — quest ratio + LIFE XP + activity count + savings; `""` on an empty week) for the
  **PRIOR** week (`weekStart.minusWeeks(1)`), so the plan prose can reflect the week's growth. See [`growth.md` §5](growth.md).
- **A Monday-dawn cron** — `WeeklySuggestionJob` `@Scheduled` on `mezo.proactive.weekly.cron`
  (**`0 0 6 * * MON`** — Monday 06:00 server zone) pre-generates the **CURRENT** week's suggestion
  per user (gathered from the just-finished previous week — §9 decision j). Gated on a THIRD switch
  `mezo.techcore.cron.weekly-suggestion-job.enabled` (`WEEKLY_SUGGESTION_JOB_SWITCH`) on top of the
  dual gate; idempotent, per-user failures isolated; **no backfill** (a past week's suggestion is
  never read — the lazy GET is the miss-recovery).
- **A lazy read** — `GET /api/proactive/weekly-suggestion?date=` (contract fragment
  `proactive.yml`): the week = `previousOrSame(MONDAY)` of `date ?? today`; persisted row or
  lazy-generate; `null` ⇒ **404 `RESOURCE_NOT_FOUND`** (no prior-week narrative memory — the honest
  empty state the FE placeholder covers).
- **Fake sentinel** — `FakeCompanionLlm` gained a `[fake-weekly:…]` sentinel dispatched on a
  **literal mirror** of `WEEKLY_SUGGESTION_MARKER` (`WEEKLY_MARKER_MIRROR` — the package-cycle rule,
  §9 gotcha a); the fake's `completeSmart` default delegates to `complete`, so the marker dispatch
  covers the smart-tier IT path (real smart routing = the V3.2-proven `GeminiCompanionLlm.completeSmart`).
- **The FE swap (Insights Weekly card real)** — `useWeekly().weeklySuggestion`
  (`data/insights/weeklyHooks.ts`) fetches the GET in real mode (`['weeklySuggestion', start]`,
  404→null); the Weekly card renders the generated prose when present, else the D′ honest placeholder
  *"A társ heti tervjavaslata hamarosan."*; the inert **„Elfogad / Hangoljuk"** buttons are **hidden
  in live mode** (false affordance — §9 decision k), mock keeps them + byte-parity. Details:
  [insights.md §2.2](insights.md).

**W2 (`mezo-h4wp.4`) — weekly Memoir (the W stage closes):**

- **A third owned table** — `memoir` (UUID PK, `created_by`, soft-delete; `week_start date` = the
  **ISO Monday** the memoir is FOR, `title varchar(200)`, `body text` = the HU narrative prose,
  `anchors jsonb` = a **typed jsonb envelope** `MemoirAnchorsEnvelope{List<Anchor(kind,label)>}`,
  `generated_at`). A **partial** unique index (one LIVE memoir per user+week; soft-delete + reinsert
  = regeneration, the `briefing`/`weekly_suggestion` precedent) — but W2 has **no regeneration path**
  (weekly cadence, the W1 precedent).
- **`MemoirGenerator`** — the same hybrid idiom at the smart tier, back to a **structured** output:
  a **pure-code gather** composes **the week's own `daily_summary` narratives** (`[weekStart,
  weekStart+6]` — the week ENDING, not the prior week) + the V1.1 facts block + the pattern list,
  plus a **numbered anchor-candidate list** (one `Memory` candidate per included summary + one
  `Pattern` candidate per pattern) → **ONE smart-tier `CompanionLlm.completeSmart` (Gemini Pro)
  call** answering a **strict-JSON** contract `{title, body, anchorIndexes}` → defensive parse →
  **bounds-checked, deduped index→anchor resolution** (the model SELECTS anchors by index, can never
  invent one — the briefing ref rule). **Empty week OR unusable answer (null/blank title/body) ⇒ NO
  row** (honest absence); existing row ⇒ returned untouched (idempotent, no LLM call). Gather = pure
  code, prose = pure LLM (NFR-M-4) — the briefing structure at the weekly-suggestion tier. **Since
  gamified-growth E3 (`mezo-6ng8`)** the gather also appends the **`NÖVEKEDÉS` block**
  (`GrowthDigestBlock.render`) for the **CURRENT** week (`weekStart`, the week being memoir'd), so the
  narrative can name the week's quests/LIFE XP/savings. See [`growth.md` §5](growth.md).
- **A Sunday-evening cron** — `MemoirJob` `@Scheduled` on `mezo.proactive.memoir.cron`
  (**`0 0 19 * * SUN`** — Sunday 19:00 server zone, the old PRD journey 5.8) pre-generates the memoir
  for the week **ENDING that Sunday** (its Monday = `previousOrSame(MONDAY)` of "now"). At 19:00 the
  Mon–Sat summaries exist; Sunday's own summary is born at the next dawn and is accepted as absent
  (§9 decision l). Gated on a THIRD switch `mezo.techcore.cron.memoir-job.enabled`
  (`MEMOIR_JOB_SWITCH`) on top of the dual gate; idempotent, per-user failures isolated; **no
  backfill**.
- **A lazy read** — `GET /api/proactive/memoir` (**no parameters**): the **latest** persisted row
  (`findFirstByCreatedByOrderByWeekStartDesc`), else lazy-generate the **LAST COMPLETED week**
  (`previousOrSame(MONDAY).minusWeeks(1)`); `null` ⇒ **404 `RESOURCE_NOT_FOUND`** (no narrative
  memory — the honest „készül" state the FE placeholder covers). Archive (older rows) is a later
  slice.
- **Fake sentinel** — `FakeCompanionLlm` gained a `[fake-memoir:{…}]` sentinel dispatched on a
  **literal mirror** of `MEMOIR_MARKER` (`MEMOIR_MARKER_MIRROR = "HETI-MEMOIR-FELADAT"` — the
  package-cycle rule, §9 gotcha a). **The sentinel rides a daily-summary NARRATIVE, not a check-in
  note** — the memoir gather is a PAST-week composition with no snapshot, so the check-in channel
  the briefing/weekly ITs use is unavailable here (§9 gotcha m).
- **The FE swap (Insights Memoir tab un-ghosts)** — a new dual-mode `useMemoir()`
  (`data/insights/memoirHooks.ts`, `['memoir']`) reads the GET in real mode (404→null); `memoir`
  leaves `PHASE3_TAB_IDS` so the tab shows in real mode; `MemoirPage` drops its `PhaseTeaserCard`
  guard and renders the real memoir card (title/body + `RefTag` anchors) with a client-derived week
  label `Hét N · …`, else the honest null-state *"Az első memoir a hét zárásakor készül el."*. The
  **reactions row + anniversary card + archive footer are MOCK-ONLY** (unpersisted interactivity =
  false affordance, the W1 button precedent — §9 decision k). Mock keeps the full Phase-1 demo +
  byte-parity. Details: [insights.md §2.3](insights.md).

**H1 (`mezo-h4wp.5`) — in-app heartbeat (the H stage opens):**

- **A fourth owned table** — `heartbeat_note` (UUID PK, `created_by`, soft-delete; `note_date date`,
  **`window_key varchar(16)`** = `midday`/`evening` (NOT `window` — reserved word), `kind
  varchar(16)` = `nudge`/`closing`, `content text`, `generated_at`). A **partial** unique index
  (one LIVE note per user+day+window); DB CHECKs pin both vocabularies. **No regeneration path**
  (a note is written once — the W1/W2 YAGNI reasoning at window cadence, §9 decision r).
- **`HeartbeatGenerator`** — the weekly-suggestion prose idiom at the **CHEAP tier**: a pure-code
  gather composes the V0.3 snapshot (today's actual state: fuel progress, training, check-ins) +
  V1.1 facts + the latest `daily_summary` + **today's persisted briefing body under a `MAI BRIEFING
  (ne ismételd):` block** (overlap-dedupe, §9 decision q) + the window instruction (`ABLAK: dél
  (nudge)` / `este (closing)`) → **ONE `CompanionLlm.complete` call** (Flash — the tier policy) →
  flat HU prose. **Emptiness gate:** zero `daily_summary` in the shared `briefing.past-days` window
  ⇒ NO row (§9 decision s); blank answer ⇒ NO row; existing row ⇒ returned untouched (idempotent).
- **A two-window cron** — `HeartbeatJob` with **two `@Scheduled` methods** on
  `mezo.proactive.heartbeat.midday-cron` (12:30, nudge) and `evening-cron` (20:30, closing), gated
  on a THIRD switch `mezo.techcore.cron.heartbeat-job.enabled` (`HEARTBEAT_JOB_SWITCH`); today-only,
  idempotent, per-user failures isolated, **no backfill** (a past window is never read).
- **A lazy read** — `GET /api/proactive/heartbeat?date=`: the day's **latest** persisted note
  (evening beats midday by `generated_at`); for **TODAY** the latest **already-elapsed** window
  lazy-generates when missing — the window fire-times are derived from the SAME cron expressions
  via Spring `CronExpression` (no duplicated time config, §9 decision r); past dates never
  generate. `null` ⇒ **404 `RESOURCE_NOT_FOUND`** (honest absence).
- **Fake sentinel** — `FakeCompanionLlm` gained `[fake-heartbeat:…]` (bare string) dispatched on
  `HEARTBEAT_MARKER_MIRROR = "NAPKOZBENI-JEGYZET-FELADAT"` (literal mirror, §9 gotcha a); planted
  via a **check-in note** (the gather renders the snapshot, so the briefing/weekly channel works).
- **The FE surface (Today CompanionNoteCard)** — a new dual-mode `useCompanionNote()`
  (`data/today/heartbeatHooks.ts`, `['heartbeat', date]`, 404→null, mock always null);
  `TodayPage` renders **`CompanionNoteCard`** (deliberately NOT named `Heartbeat*` — the check-in
  strip owns that copy) after the check-in strip, **only when a note exists** — honest absence is
  simply no card; mock mode = Phase-1 byte-parity (never a card).

**P1 (`mezo-h4wp.7`) — predictions + validation (the P stage opens):**

- **A fifth owned table** — `prediction` (UUID PK, `created_by`, soft-delete; `week_start date` =
  the generation week (the idempotence probe — a NON-unique index, n rows/week), `title
  varchar(200)`, `basis text`, **`confidence numeric(4,3)` NULLABLE** (COPIED from the grounding
  pattern — null = „tanulom"), `metric_key varchar(40)` (the deterministic v1 catalog),
  `expected_direction varchar(8)` (`up`/`down`/`stable`, CHECK-pinned), `valid_from`/`valid_to date`
  (the CODE-set window), `status varchar(10)` (`pending`/`validated`/`missed`, CHECK-pinned),
  `actual text` (the code-formatted outcome), `generated_at`). No partial-unique — a week holds
  several predictions.
- **`PredictionGenerator`** — the memoir structured smart-tier idiom: a pure-code gather composes
  the V0.3 snapshot (next-week context) + facts + a **numbered CONFIRMED-pattern candidate list** +
  the fixed metric catalog → **ONE smart-tier `completeSmart` call** answering strict-JSON
  `{predictions:[{title, basis, patternIndex, metricKey, expectedDirection}]}` → defensive parse →
  per row: **code-set window** `[weekStart, weekStart+6]`, **pattern-copied confidence** (bounds-
  checked `patternIndex` → the pattern's `confidence`, else null — never invented), catalog/enum
  validation (invalid `metricKey`/`expectedDirection` ⇒ row dropped as unvalidatable), capped at
  `max-per-week`. **Emptiness gate = zero CONFIRMED patterns** ⇒ empty list (never a fabricated
  forecast); existing week ⇒ empty (idempotent, no LLM call). The model only SELECTS (pattern by
  index, metric + direction from the offered lists).
- **`PredictionValidationService`** — pure-code, LLM-free: for each `pending` row whose window has
  closed (`valid_to < today`), compares the window's metric average/count against the **preceding 7
  days** and flips to `validated`/`missed` with a code-formatted HU `actual`. The v1 metric catalog
  (§9 decision t): `weight_trend` (avg `weight_log.weightKg`, epsilon `weight-epsilon-kg`),
  `sleep_avg` (avg `sleep_log.durationH`, epsilon `sleep-epsilon-h`), `training_volume` (count of
  done gym instances via `findDoneInstanceDates`). **No data in either compare window ⇒ stays
  `pending`** (honest — no fabricated verdict).
- **Two crons** — `PredictionJob` (the H1 two-methods-one-switch idiom): `runWeekly` on
  `mezo.proactive.prediction.cron` (Mon 06:30) generates the current week; `runValidation` on
  `validation-cron` (daily 06:15) closes expired windows. Gated on a THIRD switch
  `mezo.techcore.cron.prediction-job.enabled` (`PREDICTION_JOB_SWITCH`); per-user isolated, no
  backfill.
- **A list read** — `GET /api/proactive/prediction` (NO params): ALL live rows ordered `valid_from
  desc, generated_at desc`; lazily generates the CURRENT week when it has no rows (the weekly-
  suggestion idiom). **An empty array is the honest empty state — NOT a 404** (a list endpoint).
- **Fake sentinel** — `FakeCompanionLlm` gained `[fake-prediction:{…}]` dispatched on
  `PREDICTION_MARKER_MIRROR = "HETI-PREDIKCIO-FELADAT"` (literal mirror, §9 gotcha a); **GREEDY
  regex** (unlike memoir — the payload `{"predictions":[{…}]}` nests objects, so the match must run
  to the LAST brace); planted via a check-in note (the gather renders the snapshot).
- **The FE surface (Insights Predictions un-ghosts)** — a new dual-mode `usePredictions()`
  (`data/insights/predictionsHooks.ts`, `['predictions']`) returns a view object `{predictions[],
  mode}`; real mode maps the list ([] on loading/error — a list never 404s), mock returns the seed.
  `predictions` leaves `PHASE3_TAB_IDS` (`tabs.ts`); `PredictionsPage` drops its `PhaseTeaserCard`
  ghost, renders the real cards with **„tanulom" on null confidence** (never a fabricated %), the
  `✗ Missed` status, and an **honest accuracy header derived from CLOSED rows** (absent when none
  closed) — the mock keeps its Phase-1 literal `2 validated · 60-day acc 68%`; an empty live list ⇒
  the honest „still learning" null-state. Details: [insights.md §2.4](insights.md).

**P2 (`mezo-h4wp.8`) — N=1 experiments (the P stage + the epic close):**

- **A sixth owned table** — `experiment` (UUID PK, `created_by`, soft-delete; `title varchar(200)`,
  `hypothesis text`, `status varchar(10)` = `proposed`/`active`/`completed`/`dismissed` (CHECK +
  entity `@Pattern`), `metric_key`/`expected_direction` (the shared catalog), **`start_date date`
  NULLABLE** (null until accepted), `total_days int`, `outcome text` NULLABLE, **`outcome_good
  boolean` NULLABLE** (null = completed-but-inconclusive), `generated_at`). A plain
  `idx_experiment_created_by_status` (not unique — several live rows).
- **`ExperimentProposalGenerator`** — the PredictionGenerator idiom: pure-code gather (snapshot +
  facts + numbered CONFIRMED-pattern candidates + the metric catalog) → **ONE smart-tier
  `completeSmart`** → strict-JSON `{experiments:[{title, hypothesis, patternIndex, metricKey,
  expectedDirection, totalDays}]}` → per row catalog/enum validation (invalid ⇒ dropped) +
  `clampDays` to `[min-days, max-days]`. **Bounded by the OPEN cap** (`max-open` proposed+active) —
  a no-op when the cap is met (§9 decision y); zero CONFIRMED patterns ⇒ no proposals.
- **`ExperimentOutcomeService`** — deterministic, LLM-free: for each `active` experiment whose window
  closed (`start_date + total_days <= today`), the shared **`MetricWindowEvaluator`** compares the
  experiment window `[start, start+total-1]` vs the equally-long baseline before start → `completed`
  with a code-formatted `outcome`; direction match ⇒ `outcome_good=true` else `false`; **no data ⇒
  `outcome_good=null`** (honest "Nem értékelhető", §9 decision aa).
- **The write path (L2)** — `POST /api/proactive/experiment/{id}/decision {decision: accept|dismiss}`
  (the companion `PatternService.decide` idiom): fetch-owned-or-404 → **proposed-state guard (409
  `PROACTIVE_EXPERIMENT_NOT_PROPOSED`)** → `accept` sets `active` + `start_date=today`, `dismiss` sets
  `dismissed`. Plus **`POST /api/proactive/experiment/propose`** — the on-demand propose the "+ Új
  kísérlet javasol Mezo" button fires (now REAL in live mode).
- **A list read** — `GET /api/proactive/experiment`: proposed+active+completed rows (dismissed
  excluded), newest first; lazily proposes when the user has none; `200 []` = honest empty (never
  404, the P1 precedent).
- **Two crons** — `ExperimentJob` (`runPropose` weekly Mon 06:45 + `runOutcome` daily 06:20), one
  third switch `mezo.techcore.cron.experiment-job.enabled` (`EXPERIMENT_JOB_SWITCH`).
- **Fake sentinel** — `[fake-experiment:{…}]` (GREEDY) dispatched on `EXPERIMENT_MARKER_MIRROR =
  "N1-KISERLET-FELADAT"` (§9 gotcha a).
- **Shared evaluator (DRY)** — the metric-window comparison was **extracted from
  `PredictionValidationService` into `MetricWindowEvaluator`**; P1 validation and P2 outcome now share
  one implementation (the P1 ITs guard the refactor — §9 the MetricWindowEvaluator note).
- **The FE surface (Insights Experiments un-ghosts — the last ghost)** — `useExperiments()` (list,
  `[]`→null-state) + `useExperimentActions()` (`useMutation` accept/dismiss/propose, invalidates the
  list). `ExperimentsPage` drops its ghost; renders proposed rows with **Elfogadom/Elvetem** buttons,
  active rows with a day counter + progress, completed rows with the outcome (good/not-good/
  inconclusive chips), and the propose CTA (real in live). `experiments` leaves `PHASE3_TAB_IDS`
  (now EMPTY). Details: [insights.md §2.7](insights.md).

**HBWI (`mezo-hbwi`) — workout challenges (a NEW workout-scoped proactive surface):**

A separate epic from `mezo-h4wp` (the standing Insights experiments): the **workout-scoped sibling of
the P2 N=1 experiments**. Same proactive L2 idiom (grounded proposal → L2 decision → deterministic
outcome → un-ghost), but bound to **one planned workout session on one date**, evaluated at the
**set** level (not a daily metric window) — which forces **structured targets** and a **new, separate
evaluator**. Design of record:
[`docs/superpowers/specs/2026-07-07-workout-challenges-design.md`](../superpowers/specs/2026-07-07-workout-challenges-design.md).

- **A seventh owned table** — `challenge` (UUID PK, `created_by`, soft-delete; `template_session_id`
  + `workout_date` + `exercise_id` = the target, `type` = `PR`/`Depth`/`Volume` (CHECK), `status` =
  `proposed`/`accepted`/`dismissed`/`hit`/`miss`/`inconclusive` (CHECK), structured targets
  `target_weight_kg?`/`target_reps?`/`target_sets?`/`target_rir?`, **`confidence numeric(4,3)`
  NULLABLE** = „tanulom", typed-jsonb `refs`, `outcome text` + **`outcome_good boolean` NULLABLE**
  (null = inconclusive). A **plain** `idx_challenge_session_date` on `(created_by,
  template_session_id, workout_date)` — NOT unique (several challenges per session/day).
- **`ChallengeGenerator`** (smart tier) — **lazy on the prep-read** for **today's** planned session
  (no generation cron): pure-code `gather` (template exercises + per-exercise last-week set / PR
  history / volume-vs-plan; **drop exercises with no history** = the grounding gate; none left ⇒ `[]`)
  → ONE `completeSmart` (`CHALLENGE_MARKER = "EDZES-KIHIVAS-FELADAT"`) → per proposal: type-required
  target-field validation (PR needs weight+reps, Depth needs `targetRir`, Volume needs `targetSets`;
  missing ⇒ DROP — unevaluatable), pattern-copied-or-null confidence, model-selected `refs` by index,
  capped at `max-per-workout` (default 3). Structured targets required (decision, §9); no fabricated
  confidence/refs. **Generation guard (`mezo-cd8s`)** — the lazy prep-read never generates once the
  day's instance is **`completed`** (`ProactiveChallengeService.instanceCompleted` via
  `findFirstByCreatedByAndTemplateSessionIdAndDateOrderByCreatedAtDesc`): a finished workout is over,
  so no new proposal appears post-hoc.
- **`ChallengeOutcomeEvaluator`** (NEW, set-level, LLM-free — **not** the shared `MetricWindowEvaluator`)
  — for each `accepted` challenge whose day has a done/past instance: reads the logged `exercise_set`
  rows FK'd to the **template** exercise (no template→instance mapping — sets attach directly to the
  template exercise, `WorkoutService.java:204`), then PR = ∃ set ≥ target weight AND reps · Depth =
  last-set RIR ≤ target · Volume = logged-set count ≥ target → `hit`/`miss`; **no logged sets ⇒
  `inconclusive`** (`outcome_good null`, never a fabricated miss). A **completed** instance with no
  logged sets resolves `inconclusive` **immediately** (`mezo-cd8s`) — it never waits out the day; only
  an in-progress/not-started instance today is left `accepted`.
- **The write path (L2)** — `GET /api/proactive/challenge?templateSessionId=&date=` (lazy generate +
  lazy resolve; `200 []` = honest, never 404) + `POST /api/proactive/challenge/{id}/decision
  {decision: accept|dismiss}` (fetch-owned-or-404 → **proposed-state guard 409
  `PROACTIVE_CHALLENGE_NOT_PROPOSED`** → mutate). **No `propose` endpoint** (unlike experiments —
  challenges are generated implicitly by the prep-read). `ChallengeResponse` carries the structured
  targets on the wire — `targetWeightKg?`/`targetReps?`/`targetSets?`/`targetRir?` (additive nullable,
  `mezo-cd8s`), MapStruct-mapped by name from the entity — feeding the FE pre-finish outcome preview.
- **One cron** — `ChallengeJob.runOutcome` (`challenge.outcome-cron`, daily 06:25) is an **outcome
  backstop only** (resolves accepted challenges whose day passed even if the user never re-opened);
  third switch `CHALLENGE_JOB_SWITCH = mezo.techcore.cron.challenge-job.enabled`. No propose cron.
- **Fake sentinel** — `[fake-challenge:{…}]` (GREEDY — nested payload) dispatched on
  `CHALLENGE_MARKER_MIRROR = "EDZES-KIHIVAS-FELADAT"` (§9 gotcha a), planted via a check-in note.
- **The FE surface (`ActiveWorkoutPage` challenge carousel un-mocks)** — `useChallenges()` +
  `useChallengeActions()` (`data/train/challengeHooks.ts`); the prep carousel renders the live list,
  „Vállaljuk" is a real L2 decision, confidence-null reads „tanulom", the `tools` chips are hidden in
  live, and resolved challenges show the outcome chip (✓/◯/◌). Details: [train.md §Active workout](train.md).

**Status per layer:**

| Layer | State | Notes |
|---|---|---|
| Backend (table + envelope + generator + lazy read) | 🟢 B1.2 | Behind BOTH `mezo.feature.companion.enabled` AND `mezo.feature.proactive.enabled`; either off ⇒ the whole HTTP surface 404s. |
| Briefing generation | 🟢 B1.2 | Pure-code gather + ONE cheap-tier `CompanionLlm.complete`, strict-JSON, model-selected refs, empty-window/unusable ⇒ 404. |
| Cron (dawn pre-generation) | 🟢 B1.2 | `BriefingJob` 05:45, today-only per user (NO backfill — the lazy GET is the miss-recovery), failures isolated; third switch `briefing-job.enabled`. |
| Read-path freshness (sleep-triggered regen) | 🟢 B1.2 | `refreshIfStale`: late `sleep_log` (`date >= day-1`, after `generated_at`) ⇒ soft-delete + regenerate, `regen_count` cap 2/day; failed regen ⇒ 404 + rollback restores the old row. |
| Frontend (Today card swap) | 🟢 B1.2 | Today renders the generated briefing (real ref chips, no label); „Demo tartalom" survives only as the honest fallback. |
| Weekly suggestion (table + generator + Monday cron + lazy read) | 🟢 W1 | `weekly_suggestion` table (ISO-Monday identity, partial unique); smart-tier `WeeklySuggestionGenerator` (gather = snapshot + facts + prior-week summaries + patterns → ONE `completeSmart` call, honest-null); Monday-06:00 `WeeklySuggestionJob` (three-switch, no backfill); `GET /api/proactive/weekly-suggestion` (lazy; 404 = empty prior week). |
| Frontend (Insights Weekly card swap) | 🟢 W1 | `useWeekly().weeklySuggestion` real (404→null); the Weekly card renders the generated prose, else the honest placeholder; „Elfogad/Hangoljuk" hidden in live. |
| Memoir (table + generator + Sunday cron + lazy read) | 🟢 W2 | `memoir` table (ISO-Monday identity, partial unique, typed-jsonb `anchors`); smart-tier `MemoirGenerator` (gather = the week's OWN summaries + facts + patterns + numbered anchor candidates → ONE `completeSmart` call, model-selected anchors, honest-null); Sunday-19:00 `MemoirJob` (three-switch, no backfill); `GET /api/proactive/memoir` (no params; latest row else lazy-generate the LAST COMPLETED week; 404 = empty week). |
| Frontend (Insights Memoir tab un-ghost) | 🟢 W2 | `useMemoir()` real (404→null); `memoir` left `PHASE3_TAB_IDS`, `MemoirPage` guard dropped; renders the real memoir + derived week label, else the honest „készül" null-state; reactions/anniversary/archive mock-only. |
| Heartbeat (table + generator + window crons + lazy read) | 🟢 H1 | `heartbeat_note` table (user+day+`window_key` partial unique, `kind` nudge/closing); **cheap-tier** `HeartbeatGenerator` (gather = snapshot + facts + latest summary + today's-briefing dedupe block + window instruction → ONE `complete` call, honest-null); `HeartbeatJob` two `@Scheduled` windows (midday/evening crons, three-switch, no backfill); `GET /api/proactive/heartbeat` (lazy latest-elapsed-window for TODAY only; 404 = honest absence). |
| Frontend (Today CompanionNoteCard) | 🟢 H1 | `useCompanionNote()` real (404→null, mock always null — Phase-1 parity); `TodayPage` renders `CompanionNoteCard` after the check-in strip only when a note exists (honest absence = no card). |
| Predictions (table + generator + validation + weekly/daily job + list read) | 🟢 P1 | `prediction` table (week_start idempotence probe, nullable confidence, CHECK-pinned direction/status); smart-tier `PredictionGenerator` (gather = snapshot + facts + numbered CONFIRMED-pattern candidates + metric catalog → ONE `completeSmart`, code-set windows, pattern-copied confidence, honest-empty); deterministic `PredictionValidationService` (window-vs-prior-7-days, no-data ⇒ stays pending); `PredictionJob` two crons (Mon 06:30 generate + daily 06:15 validate, three-switch); `GET /api/proactive/prediction` (list; lazy current-week; `[]` = honest empty, never 404). |
| Frontend (Insights Predictions tab un-ghost) | 🟢 P1 | `usePredictions()` real (list, `[]` on error); `predictions` left `PHASE3_TAB_IDS`, `PredictionsPage` ghost dropped; renders real cards („tanulom" on null confidence, `✗ Missed` state, accuracy header derived from closed rows), else the honest „still learning" null-state; mock keeps the Phase-1 seed + literal header. |
| Experiments (table + proposal + outcome + write path + two-cron job) | 🟢 P2 | `experiment` table (proposed/active/completed/dismissed lifecycle, nullable start_date/outcome_good); smart-tier `ExperimentProposalGenerator` (cap-gated, CONFIRMED-pattern-grounded); deterministic `ExperimentOutcomeService` (shared `MetricWindowEvaluator`); **write path** `POST …/decision` (L2, 409 on non-proposed) + `POST …/propose`; list `GET` (lazy propose, `[]` = honest); `ExperimentJob` two crons (weekly propose + daily outcome, three-switch). |
| Frontend (Insights Experiments tab un-ghost) | 🟢 P2 | `useExperiments()` + `useExperimentActions()` (mutation accept/dismiss/propose); `experiments` left `PHASE3_TAB_IDS` (now EMPTY — all 7 tabs real); `ExperimentsPage` renders proposed (Elfogadom/Elvetem) / active (progress) / completed (outcome) rows + a real propose CTA, else the honest null-state. |
| Workout challenges (table + generator + set-level evaluator + write path + outcome cron) | 🟢 HBWI | `challenge` table (proposed→accepted/dismissed→hit/miss/inconclusive, nullable confidence, structured targets); lazy-on-prep `ChallengeGenerator`; deterministic set-level `ChallengeOutcomeEvaluator` (NEW, not `MetricWindowEvaluator`); `GET …/challenge?templateSessionId=&date=` (lazy generate + lazy resolve, `[]` = honest) + `POST …/challenge/{id}/decision`; `ChallengeJob` outcome-cron backstop (three-switch). |
| Frontend (ActiveWorkoutPage challenge surface) | 🟢 HBWI | `useChallenges()`/`useChallengeActions()` (`data/train/challengeHooks.ts`); `ActiveWorkoutPage` prep feeds the live list into `ChallengesCarousel`, accepted map + `decide()` from server status in live (local toggle in mock, byte-parity); `ChallengeCard` honest states — „tanulom" on null confidence, tools hidden in live, `hit/miss/inconclusive` outcome chip + line with the accept/skip row hidden. |
| **Epic status** | ✅ COMPLETE | All 8 slices shipped (B1.1→B1.2→W1→W2→H1→P1→P2); **H2 Web Push deferred** (pure delivery infra — see the roadmap). Every prose/forecast Insights + Today surface is honest and real. |

**Driver:** `mezo-h4wp.4` (W2, on `mezo-h4wp.1`'s spine; W1 = `mezo-h4wp.3`, B1.2 = `mezo-h4wp.2`). **Design of record:**
[`docs/superpowers/specs/2026-07-06-proactive-layer-design.md`](../superpowers/specs/2026-07-06-proactive-layer-design.md)
(§2 hybrid generation, §3-§4 briefing data model, §5 weekly suggestion, §6 honest-numbers guardrails,
§7 emptiness gate); slice map
[`docs/superpowers/plans/2026-07-06-proactive-roadmap.md`](../superpowers/plans/2026-07-06-proactive-roadmap.md)
§B1.1–§B1.2 + §W1 + §W2. Builds on the [companion](companion.md) stack (snapshot/facts/summaries/patterns).

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

**Live since W1 — the Insights Weekly „Mezo · heti tervjavaslat" card.** On the Insights → Weekly
sub-tab the plan-suggestion card now shows **the companion's own generated prose** for the week that
is starting — 2-3 concrete, actionable suggestions grounded in the just-finished previous week's
narrative memory, HIS confirmed facts, and HIS detected patterns. The Monday cron has usually already
written it; if not, the first GET of the week generates it on the spot (lazy fallback). When there is
no prior-week narrative memory yet (404) the card keeps the **honest placeholder** *"A társ heti
tervjavaslata hamarosan."* — never a fabricated plan. In **live mode the inert „Elfogad / Hangoljuk"
buttons are hidden** (they never did anything — false affordance); **mock mode** keeps the seed prose
+ both buttons (byte-parity). See [insights.md §2.2](insights.md) for the card in the context of the
full Weekly review (the D′ score + item rows are unchanged).

**Live since W2 — the Insights Memoir tab.** The Memoir sub-tab, a real-mode ghost until now, shows
**the companion's own weekly story** — a short literary HU narrative about Daniel's week grounded in
HIS finished-week daily summaries, HIS confirmed facts, and HIS detected patterns, with **real anchor
chips** (the code-collected, model-selected `Memory`/`Pattern` refs) and a **client-derived week
label** (`Hét N · …`). The Sunday-evening cron has usually already written the week's memoir; if not,
the first GET generates the **last completed week** on the spot (lazy fallback). When there is no
narrative memory yet (404) the tab shows the **honest null-state** *"Az első memoir a hét zárásakor
készül el."* — never demo fiction. In **live mode the reaction toggles, the „Évforduló · 1 hónap"
anniversary card, and the „Memoir archive · 17 darab" footer are hidden** (unpersisted interactivity /
deferred surfaces = false affordance); **mock mode** keeps the full Phase-1 demo (seed memoir +
reactions + anniversary + archive, byte-parity). See [insights.md §2.3](insights.md) for the tab in
the context of the full Insights sub-nav (Memoir now shows as the 3rd of 5 real-mode tabs).

**Live since H1 — the Today companion-note card.** During the day a new card appears under the
check-in strip: at midday a short **nudge** for the rest of the day, in the evening a **closing**
observation — 2-3 sentences grounded in the day's actual state (fuel progress, training, check-ins),
explicitly instructed not to repeat the morning briefing. The window crons usually pre-write it; if
one was missed, the first GET of the day generates the latest elapsed window on the spot. **Honest
absence:** before the first window, with no narrative memory, or on failure there is simply **no
card** (never placeholder fiction); mock mode never shows one (Phase-1 byte-parity). See
[today.md §2](today.md).

**Live since P1 — the Insights Predictions tab.** The Predictions sub-tab, a real-mode ghost until
now, shows **pattern-grounded weekly forecasts** — each a short claim (e.g. „a hét testsúlya csökken")
with a `basis`, a validity-window label, and a status chip (`◐ Pending` / `✓ Validated` / `✗ Missed`).
Confidence is shown **only when it exists** (copied from the grounding pattern); a statistical pattern
carries none, so the card reads **„tanulom"** rather than a fabricated %. The accuracy header is
**derived from closed rows** (validated / (validated+missed)) and is absent until at least one window
has closed. The Monday cron writes the week's batch from the user's CONFIRMED patterns; a daily
validation run judges each closed window against reality (deterministically, where the metric allows).
When there are no confirmed patterns yet the tab shows the **honest still-learning null-state** — never
demo fiction. In **mock mode** the tab keeps the Phase-1 seed + the literal accuracy header. See
[insights.md §2.4](insights.md).

**Live since P2 — the Insights Experiments tab.** The last real-mode ghost un-ghosts: the companion
**proposes N=1 experiments** on Daniel's own data (grounded in his CONFIRMED patterns), each a
`◇ Javaslat` card with **Elfogadom / Elvetem** buttons. Accepting starts the experiment (`◐ Aktív`,
a day counter + progress bar over its window); at the window's close the daily cron writes the
deterministic outcome — `✓ Megerősítve`, `◯ Nem igazolódott`, or `◌ Nem értékelhető` (honest, when
there's no data). The **„+ Új kísérlet javasol Mezo"** button now really proposes (a `POST …/propose`,
bounded by the open-cap). When there are no experiments yet the tab shows the **honest still-learning
null-state** — never demo fiction. In **mock mode** the tab keeps the Phase-1 seed (active + completed
cards, the inert propose CTA). See [insights.md §2.7](insights.md).

**Live since HBWI — the pre-workout challenge carousel (`ActiveWorkoutPage`, `/train/session` prep).**
The companion **proposes per-exercise micro-challenges** (PR/Depth/Volume) on the prep screen before
„Kezdjük el". Each `ChallengeCard` (`features/train/components/ChallengeCard.tsx`) is honest: confidence
reads **„tanulom"** on null (no fabricated %), the **tool-transparency chips are gone** (live sends no
`tools` — the W1/W2 false-affordance lesson), and **„Vállaljuk" is a real L2 decision** — it `POST`s
accept/dismiss (`useChallengeActions.decide`) and the accepted state derives from the server `status`
(`accepted | hit | miss`). Once the workout is decided the card shows the **outcome chip + line** and
**hides the accept/skip row**: `hit → ✓ Megerősítve` (success), `miss → ◯ Nem igazolódott` (muted, no
red/no-penalty tone), `inconclusive → ◌ Nem értékelhető` (tertiary) — the same wording as the
Experiments tab. The carousel renders **honest absence** (`null`, no rail) when the live list is empty.
In **mock mode** the Phase-1 seed is byte-preserved: `conf 72%`, the tool chips, and a **local** accept
toggle (no backend). Data via `useChallenges`/`useChallengeActions` (`data/train/challengeHooks.ts`,
unified so `challenges` drives both modes). See [train.md §Active workout](train.md).

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

**The weekly-suggestion read (W1 — persisted row · lazy generate; NO staleness/regen):**

```
GET /api/proactive/weekly-suggestion?date=YYYY-MM-DD    (date optional)
  → ProactiveController.getWeeklySuggestion(date)         controller/ProactiveController.java  (implements ProactiveApi)
      currentUserId.get()  (JWT subject → UUID)
  → ProactiveWeeklySuggestionService.getWeeklySuggestion(userId, date)   service:34  @Transactional
      weekStart = previousOrSame(MONDAY) of (date != null ? date : LocalDate.now())   (ISO-Monday week identity)
      findByCreatedByAndWeekStart(userId, weekStart)
        .orElseGet(() -> generator.generate(userId, weekStart))          persisted row, else lazy-generate
      null ⇒ throw SystemRuntimeErrorException(RESOURCE_NOT_FOUND, 404)   (no prior-week narrative memory)
      → mapper.toWeeklySuggestionResponse(suggestion)                     (Instant → UTC OffsetDateTime)
```

**The Monday cron (W1 — `service/WeeklySuggestionJob.java`):**

```
@Scheduled(cron = "${mezo.proactive.weekly.cron}")   0 0 6 * * MON (Monday 06:00 server zone); three-switch bean
  weekStart = previousOrSame(MONDAY) of LocalDate.now()   (the CURRENT week — its Monday IS today)
  for each appUserRepository.findAll():
     try  generator.generate(user.id, weekStart)          (current week only — no backfill)
     catch → log.warn + continue                          (per-user isolation)
```

Idempotent (an existing row is returned untouched, no LLM call). **No catch-up loop and no
staleness/regeneration path at all** — a weekly suggestion is written once at Monday dawn (or lazily
on first open) and stands for the week (§9 decision i/j).

**The weekly generator (`service/WeeklySuggestionGenerator.java`):**

```
generate(userId, weekStart)                             WeeklySuggestionGenerator.java:59  @Transactional
  1. existing row? ⇒ return untouched                   (idempotent; NO LLM call)
  2. gather(userId, weekStart)                           WeeklySuggestionGenerator.java:84  PURE CODE, LLM-free
       priorWeek = daily_summary with summaryDate in [weekStart-7, weekStart)   (STRICTLY before week_start)
       priorWeek.isEmpty() ⇒ return null                 ── THE EMPTINESS GATE (§9 gotcha d)
       payload = ContextSnapshotAssembler.render(now)     (V0.3 current state — six HU blocks)
               + KnowledgeFactService.renderPromptBlock   (V1.1 top-N confirmed facts)
               + "ELŐZŐ HÉT NAPJAI" prior-week narratives (newest first)
               + "MINTÁK" confirmed/monitored pattern titles + status (omitted when none)
  3. companionLlm.completeSmart(PROMPT, payload)          ── ONE SMART-tier call (WEEKLY_SUGGESTION_MARKER prompt, Gemini Pro)
  4. prose null / blank ⇒ return null                     ── unusable answer, NO row (§9 gotcha d)
  5. saveAndFlush WeeklySuggestionEntity{prose=strip(), generatedAt=now truncated-to-µs}
```

The prompt (`WEEKLY_SUGGESTION_MARKER "HETI-TERVJAVASLAT"` + HU rules: 3-5 sentences, 2-3 actionable
suggestions, plain prose no markdown, invent-no-numbers, never suggest a retatrutid/med-dose change)
mirrors the briefing guardrails at the smart tier. The gather composes patterns via the companion
`PatternRepository` (the V3.1/V3.2 Inbox rows) — a fourth companion read on top of the briefing's three.

**The memoir read (W2 — latest row · lazy-generate the last completed week; NO staleness/regen):**

```
GET /api/proactive/memoir                               (NO parameters)
  → ProactiveController.getMemoir()                      controller/ProactiveController.java  (implements ProactiveApi)
      currentUserId.get()  (JWT subject → UUID)
  → ProactiveMemoirService.getMemoir(userId)             service/ProactiveMemoirService.java:36  @Transactional
      findFirstByCreatedByOrderByWeekStartDesc(userId)   the LATEST persisted memoir
        .orElseGet(() -> generator.generate(userId,
             now.with(previousOrSame(MONDAY)).minusWeeks(1)))   ── else lazily generate the LAST COMPLETED week
      null ⇒ throw SystemRuntimeErrorException(RESOURCE_NOT_FOUND, 404)   (no narrative memory)
      → mapper.toMemoirResponse(memoir)                  (anchors.anchors → List<MemoirAnchor>; Instant → UTC OffsetDateTime)
```

**The Sunday cron (W2 — `service/MemoirJob.java`):**

```
@Scheduled(cron = "${mezo.proactive.memoir.cron}")   0 0 19 * * SUN (Sunday 19:00 server zone); three-switch bean
  weekStart = previousOrSame(MONDAY) of LocalDate.now()   (the week ENDING this Sunday — its Monday)
  for each appUserRepository.findAll():
     try  generator.generate(user.id, weekStart)          (that week only — no backfill)
     catch → log.warn + continue                          (per-user isolation)
  log.info "Memoir run for {weekStart}: {n} memoir(s) present"
```

Idempotent (an existing row is returned untouched, no LLM call). **No catch-up loop and no
staleness/regeneration path** — a memoir is written once at Sunday dusk (or lazily on first open) and
stands (§9 decision l, the W1 reasoning). NOTE the cron writes the week ENDING this Sunday, whereas
the lazy GET fallback writes the LAST COMPLETED week (`.minusWeeks(1)`) — the cron is proactive at the
week's close, the lazy path is a recovery for a user whose cron never ran (§9 decision n).

**The memoir generator (`service/MemoirGenerator.java`):**

```
generate(userId, weekStart)                             MemoirGenerator.java:65  @Transactional
  1. existing row? ⇒ return untouched                   (idempotent; NO LLM call)
  2. gather(userId, weekStart)                           MemoirGenerator.java:95  PURE CODE, LLM-free
       week = daily_summary with summaryDate in [weekStart, weekStart+6]   (the week ENDING)
       week.isEmpty() ⇒ return null                      ── THE EMPTINESS GATE (§9 gotcha d)
       payload = "A HÉT NAPJAI" the week's narratives (newest first)
               + KnowledgeFactService.renderPromptBlock  (V1.1 top-N confirmed facts)
               + "MINTÁK" pattern titles + status (omitted when none)
               + "HORGONY-JELÖLTEK" numbered candidate list (index: [kind] label)
       candidates = one Memory anchor per summary + one Pattern anchor per pattern
  3. companionLlm.completeSmart(PROMPT, payload)          ── ONE SMART-tier call (MEMOIR_MARKER prompt, Gemini Pro)
  4. parse(answer)                                        first-{ to last-} defensive JSON → ParsedMemoir
       null / blank title / blank body ⇒ return null      ── unusable answer, NO row (§9 gotcha d)
  5. resolveAnchors(anchorIndexes, candidates)            bounds-checked, order-preserving, deduped
       (model SELECTS by index; out-of-range/dupes dropped — can never invent an anchor)
  6. saveAndFlush MemoirEntity{title, body, anchors envelope, generatedAt=now truncated-to-µs}
```

The prompt (`MEMOIR_MARKER "HETI-MEMOIR-FELADAT"` + HU rules: short literary weekly memoir from the
week's facts only, one concrete observation + one gentle remark, invent-no-numbers, never suggest a
med-dose change) mirrors the briefing/weekly guardrails at the smart tier, and — like the briefing —
carries a typed jsonb anchor envelope (unlike the weekly suggestion's flat prose). The gather reuses
the same companion reads as the weekly generator (summaries + facts + patterns) but over the week's
OWN window, not the prior week.

**The heartbeat read (H1 — latest note · lazy latest-elapsed-window; NO staleness/regen):**

```
GET /api/proactive/heartbeat?date=YYYY-MM-DD           (date optional)
  → ProactiveController.getHeartbeat(date)              controller/ProactiveController.java  (implements ProactiveApi)
  → ProactiveHeartbeatService.getHeartbeat(userId, date)   service/ProactiveHeartbeatService.java:47  @Transactional
      day = date != null ? date : LocalDate.now()
      if day == today:
        latestElapsedWindow(day)                        CronExpression.parse(midday/evening cron).next(day start)
          — windows whose fire-time ≤ now, take the latest; missing note ⇒ generator.generate(userId, day, key)
      findFirstByCreatedByAndNoteDateOrderByGeneratedAtDesc(userId, day)   the day's newest note
      null ⇒ throw SystemRuntimeErrorException(RESOURCE_NOT_FOUND, 404)    (honest absence)
      → mapper.toHeartbeatResponse(note)                (noteDate→date, windowKey→window)
```

**The window crons (H1 — `service/HeartbeatJob.java`):** two `@Scheduled` methods (`runMidday` on
`mezo.proactive.heartbeat.midday-cron`, `runEvening` on `evening-cron`), each looping
`appUserRepository.findAll()` with per-user try/catch — the MemoirJob idiom; three-switch bean;
idempotent; today-only, no backfill.

**The heartbeat generator (`service/HeartbeatGenerator.java`):** `generate(userId, day, windowKey)`
— existing row ⇒ untouched; `gather` (PURE CODE: snapshot + facts + latest summary + briefing
dedupe block + `ABLAK:` instruction; empty past-days summary window ⇒ null) → ONE **cheap-tier**
`companionLlm.complete(PROMPT, payload)` (`HEARTBEAT_MARKER`) → blank ⇒ null, else persisted
`HeartbeatNoteEntity` (kind derived from the window: evening→closing, else nudge).

**The prediction read (P1 — list · lazy current-week; NO 404):**

```
GET /api/proactive/prediction                          (NO parameters)
  → ProactiveController.getPredictions()                controller/ProactiveController.java  (implements ProactiveApi)
  → ProactivePredictionService.getPredictions(userId)   service/ProactivePredictionService.java:33  @Transactional
      weekStart = previousOrSame(MONDAY) of today
      if !existsByCreatedByAndWeekStart(userId, weekStart):
        generator.generate(userId, weekStart)           (lazy current-week batch; empty = honest)
      findByCreatedByOrderByValidFromDescGeneratedAtDesc(userId).map(toPredictionResponse)
      → List<PredictionResponse>   (possibly empty — a list endpoint never 404s)
```

**The two crons (P1 — `service/PredictionJob.java`):** `runWeekly` on `mezo.proactive.prediction.cron`
(Mon 06:30) generates the current week per user; `runValidation` on `validation-cron` (daily 06:15)
calls `validateClosedWindows(user, today)` per user. Both loop `appUserRepository.findAll()` with
per-user try/catch; three-switch bean.

**The generator (`service/PredictionGenerator.java`):** `generate(userId, weekStart)` — existing week
⇒ empty (idempotent); `gather` (PURE CODE: snapshot + facts + numbered CONFIRMED-pattern candidates +
metric catalog; zero confirmed patterns ⇒ null gate) → ONE **smart-tier** `completeSmart` (`PREDICTION_MARKER`)
→ strict-JSON `{predictions:[…]}` parse → per row code-set window + pattern-copied confidence + catalog/
enum validation (invalid ⇒ dropped) + `max-per-week` cap.

**The validation (`service/PredictionValidationService.java`, LLM-free):** `validateClosedWindows` →
for each pending row with `valid_to < today`, `evaluate` the metric over `[validFrom, validTo]` vs the
preceding 7 days (weight/sleep avg with epsilon bands; training-volume count); direction match ⇒
`validated`, else `missed`, with a code-formatted `actual`; no data ⇒ stays pending.

**The experiment write + read path (P2):**

```
GET /api/proactive/experiment                          (NO parameters)
  → ProactiveController.getExperiments()                controller/ProactiveController.java
  → ProactiveExperimentService.getExperiments(userId)   service/ProactiveExperimentService.java  @Transactional
      if no OPEN (proposed|active) rows: generator.propose(userId)   (lazy first proposal; empty = honest)
      findByCreatedByAndStatusInOrderByGeneratedAtDesc([proposed,active,completed]).map(toExperimentResponse)
      → List<ExperimentResponse>   (dismissed excluded; `[]` = honest, never 404)

POST /api/proactive/experiment/{id}/decision  {decision: accept|dismiss}
  → decideExperiment(id, request) → ProactiveExperimentService.decide(userId, id, request)
      findByIdAndCreatedByAndDeletedFalse → orElseThrow(404 PROACTIVE_EXPERIMENT_NOT_FOUND)
      status != proposed ⇒ throw 409 PROACTIVE_EXPERIMENT_NOT_PROPOSED
      accept ⇒ status=active + start_date=today ; dismiss ⇒ status=dismissed ; else 400
      → mapper.toExperimentResponse(saveAndFlush)

POST /api/proactive/experiment/propose
  → proposeExperiments() → generator.propose(userId).map(toExperimentResponse)   (cap-gated; `[]` when met)
```

**The workout-challenge write + read path (`mezo-hbwi`):** a per-exercise PR/Depth/Volume micro-challenge
keyed on `(created_by, template_session_id, workout_date)`; L2 accept/dismiss; deterministic set-level
outcome (`hit | miss | inconclusive`). Same decide idiom as experiments (fetch-owned-or-404 → proposed
guard 409 → mutate → saveAndFlush).

```
GET /api/proactive/challenge?templateSessionId={uuid}&date={date}
  → ProactiveController.getChallenges()                 controller/ProactiveController.java
  → ProactiveChallengeService.getChallenges(userId, templateSessionId, date)   service/ProactiveChallengeService.java  @Transactional
      rows = findByCreatedByAndTemplateSessionIdAndWorkoutDateOrderByGeneratedAtAsc(...)
      if rows empty AND date == today: rows = ChallengeGenerator.generate(...)   (lazy first proposal)
      for each accepted row: ChallengeOutcomeEvaluator.evaluate(row, today)      (lazy resolve when instance done)
      → rows filter(status != dismissed).map(toChallengeResponse)   (`[]` = honest, never 404)

POST /api/proactive/challenge/{id}/decision  {decision: accept|dismiss}
  → decideChallenge(id, request) → ProactiveChallengeService.decide(userId, id, request)
      findByIdAndCreatedBy → orElseThrow(404 PROACTIVE_CHALLENGE_NOT_FOUND)
      status != proposed ⇒ throw 409 PROACTIVE_CHALLENGE_NOT_PROPOSED
      accept ⇒ status=accepted ; dismiss ⇒ status=dismissed ; else 400 VALIDATION_INVALID_VALUE(decision)
      → mapper.toChallengeResponse(saveAndFlush)
```

**The challenge outcome backstop (`service/ChallengeJob.java`):** single cron `runOutcome`
(`challenge.outcome-cron`, daily 06:25) loops users → `ChallengeOutcomeEvaluator.evaluateDue` (resolves
every accepted challenge whose day passed — catches ones the lazy GET never re-opened); three-switch bean
(`CHALLENGE_JOB_SWITCH = mezo.techcore.cron.challenge-job.enabled`).

**The challenge mapper (`mapper/ProactiveMapper.toChallengeResponse` + `mapper/ChallengeDisplay`):**
`exerciseName`→`exercise`, `refs.refs()`→`List<ChallengeRef>`, and derived `typeLabel`/`target` via
`@Mapping(expression=…)` into `ChallengeDisplay` **static** helpers. The helpers live OUT of the
`@Mapper` interface on purpose: a `String→String` default method there would be auto-selected by MapStruct
as an implicit converter for EVERY String property (corrupting the sibling responses) — §9 gotcha.

**The two crons (P2 — `service/ExperimentJob.java`):** `runPropose` (`experiment.propose-cron`, Mon
06:45) loops users → `generator.propose`; `runOutcome` (`experiment.outcome-cron`, daily 06:20) loops
users → `outcomeService.evaluateClosed`; three-switch bean.

**The proposal generator (`service/ExperimentProposalGenerator.java`):** the PredictionGenerator idiom
— open-cap check → `gather` (CONFIRMED patterns → null gate) → ONE `completeSmart` → strict-JSON parse
→ per row catalog/enum validation + `clampDays` → persisted `proposed` rows.

**The outcome eval (`service/ExperimentOutcomeService.java`, LLM-free):** each active window-closed
row → the shared `MetricWindowEvaluator` over `[start, start+total-1]` vs the equal baseline before
start → `completed` + `outcome`/`outcome_good` (null = inconclusive).

**Switch-gating.** `ProactiveController`, `ProactiveBriefingService`, `ProactiveWeeklySuggestionService`,
`ProactiveMemoirService`, `ProactiveHeartbeatService`, `ProactivePredictionService`,
`ProactiveExperimentService`, `BriefingGenerator`, `WeeklySuggestionGenerator`, `MemoirGenerator`,
`HeartbeatGenerator`, `PredictionGenerator`, `PredictionValidationService`, `MetricWindowEvaluator`,
`ExperimentProposalGenerator`, `ExperimentOutcomeService`, `ProactiveChallengeService`,
`ChallengeGenerator`, `ChallengeOutcomeEvaluator` (and the mapper via the services) are all
`@ConditionalOnProperty(name = {COMPANION_SWITCH, PROACTIVE_SWITCH}, havingValue = "true")` — **both**
must be `true`. Either off ⇒ no proactive beans ⇒ the whole `/api/proactive/*` surface 404s (there's
no controller to route to). The seven jobs (`BriefingJob`, `WeeklySuggestionJob`, `MemoirJob`,
`HeartbeatJob`, `PredictionJob`, `ExperimentJob`, `ChallengeJob`) each add a THIRD switch on top. The dual gate is
structural, not a runtime check (§9 gotcha b).

**Ownership.** `BriefingEntity` + `WeeklySuggestionEntity` + `MemoirEntity` + `HeartbeatNoteEntity` + `PredictionEntity` + `ExperimentEntity` all `extend OwnedEntity`
(soft-delete via `@SQLDelete`/`@SQLRestriction`); `created_by` is stamped from `CurrentUserId.get()`
server-side, the finders (`findByCreatedByAndBriefingDate` / `findByCreatedByAndWeekStart` /
`findByCreatedByAndWeekStart` + `findFirstByCreatedByOrderByWeekStartDesc` for memoir) are owner +
soft-delete scoped. Standard auth spine ([`_platform-api-backend.md`](_platform-api-backend.md); the
companion precedent).

## 4. Data model & API

### Backend tables (B1.1 + B1.2 + W1 + W2 + H1 + P1 + P2 + HBWI, 🟢)

Migrations `202607061100_mezo-h4wp.1_create_briefing.sql` + `202607070900_mezo-h4wp.2_briefing_regen_count.sql`
+ `202607071200_mezo-h4wp.3_create_weekly_suggestion.sql` + `202607071500_mezo-h4wp.4_create_memoir.sql`
+ `202607071800_mezo-h4wp.5_create_heartbeat_note.sql` + `202607071900_mezo-h4wp.7_create_prediction.sql`
+ `202607072000_mezo-h4wp.8_create_experiment.sql` + `202607072100_mezo-hbwi_create_challenge.sql`
(all registered in `db/changelog/1.0.0/1.0.0_master.yml`):

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
- **`weekly_suggestion`** (W1) — `id uuid pk (gen_random_uuid())`, `created_by uuid fk→app_user(id)
  ON DELETE CASCADE`, `is_deleted boolean default false`, `created_at timestamptz default now()`,
  `week_start date not null` (the **ISO Monday** the suggestion is FOR), `prose text not null` (plain
  HU), `generated_at timestamptz not null`. Uniqueness is a **partial unique index**
  `uq_weekly_suggestion_created_by_week_start … where is_deleted = false` (one LIVE suggestion per
  user+week; the `briefing` partial-unique precedent — a soft-deleted row could be regenerated, but
  W1 has no regen path). **No `content` envelope, no `regen_count`** — a weekly suggestion is flat
  prose written once (§9 decision i).
- **`memoir`** (W2) — `id uuid pk (gen_random_uuid())`, `created_by uuid fk→app_user(id) ON DELETE
  CASCADE`, `is_deleted boolean default false`, `created_at timestamptz default now()`, `week_start
  date not null` (the **ISO Monday** the memoir is FOR), `title varchar(200) not null`, `body text
  not null` (the HU narrative), `anchors jsonb not null` (the typed envelope), `generated_at
  timestamptz not null`. Uniqueness is a **partial unique index**
  `uq_memoir_created_by_week_start … where is_deleted = false` (one LIVE memoir per user+week; the
  `briefing`/`weekly_suggestion` partial-unique precedent — a soft-deleted row could be regenerated,
  but W2 has no regen path). **Has a jsonb envelope (like `briefing`) but no `regen_count`** — a
  memoir is written once, structured but not staleness-refreshed (§9 decision l).
- **`heartbeat_note`** (H1) — `id uuid pk (gen_random_uuid())`, `created_by uuid fk→app_user(id)
  ON DELETE CASCADE`, `is_deleted boolean default false`, `created_at timestamptz default now()`,
  `note_date date not null`, `window_key varchar(16) not null` (**`midday`/`evening`** — the column
  is NOT named `window`, a reserved word; DB CHECK pins the vocabulary), `kind varchar(16) not null`
  (`nudge`/`closing`, CHECK-pinned), `content text not null` (plain HU prose), `generated_at
  timestamptz not null`. Uniqueness is a **partial unique index**
  `uq_heartbeat_note_created_by_note_date_window_key … where is_deleted = false` (one LIVE note per
  user+day+window). **Flat prose like `weekly_suggestion`, no envelope, no `regen_count`** — a note
  is written once per window (§9 decision r).
- **`prediction`** (P1) — `id uuid pk`, `created_by uuid fk→app_user(id) ON DELETE CASCADE`,
  `is_deleted`/`created_at`, `week_start date not null` (the generation week — a **plain index**
  `idx_prediction_created_by_week_start`, NOT unique: a week holds several predictions), `title
  varchar(200)`, `basis text`, **`confidence numeric(4,3)` NULLABLE** (copied from the grounding
  pattern; null = „tanulom"), `metric_key varchar(40) not null`, `expected_direction varchar(8) not
  null` (CHECK `up|down|stable`), `valid_from`/`valid_to date not null` (code-set window), `status
  varchar(10) not null default 'pending'` (CHECK `pending|validated|missed`), `actual text`,
  `generated_at timestamptz not null`. **No partial-unique** (multiple live rows per week is the
  point); the daily validation job mutates `status`/`actual` in place.
- **`experiment`** (P2) — `id uuid pk`, `created_by uuid fk→app_user(id) ON DELETE CASCADE`,
  `is_deleted`/`created_at`, `title varchar(200)`, `hypothesis text`, `status varchar(10) not null
  default 'proposed'` (CHECK `proposed|active|completed|dismissed` + entity `@Pattern` — the guard
  fires at bean-validation before the DB CHECK, the PatternEntity template), `metric_key varchar(40)`,
  `expected_direction varchar(8)` (CHECK `up|down|stable`), **`start_date date` NULLABLE** (null until
  accepted), `total_days int`, `outcome text` NULLABLE, **`outcome_good boolean` NULLABLE** (null =
  completed-but-inconclusive), `generated_at`. `idx_experiment_created_by_status` (plain, NOT unique).
- **`challenge`** (HBWI) — `id uuid pk`, `created_by uuid fk→app_user(id) ON DELETE CASCADE`,
  `is_deleted`/`created_at`, `template_session_id uuid not null fk→workout_session(id)` (the planned
  session), `workout_date date not null` (scopes a re-used weekly template to one day), `exercise_id
  uuid not null fk→exercise(id)` (the **TEMPLATE** exercise the challenge targets — logged sets FK
  straight back to it, no instance mapping), `exercise_name varchar(120)` (denormalized at generation),
  `type varchar(10) not null` (CHECK `PR|Depth|Volume`), `status varchar(12) not null default
  'proposed'` (CHECK `proposed|accepted|dismissed|hit|miss|inconclusive`), `risk varchar(4) default
  'low'` (CHECK `low|mid`, qualitative — not a fabricated number), `title`/`why`/`glory`, the
  **structured targets** `target_weight_kg numeric(6,2)?` / `target_reps int?` / `target_sets int?` /
  `target_rir int?` (subset used per type), **`confidence numeric(4,3)` NULLABLE** (pattern-copied or
  null = „tanulom"), `refs jsonb not null default '[]'` (the typed envelope), `outcome text` +
  **`outcome_good boolean` NULLABLE** (null = inconclusive), `generated_at`. **`idx_challenge_session_date`
  on `(created_by, template_session_id, workout_date) where is_deleted = false` — a PLAIN index, NOT
  unique** (several challenges per session/day; the generator's idempotence probe is "does this
  (user, session, date) already have any live row?").

### Entities + envelope

`BriefingEntity` (`entity/BriefingEntity.java`) `extends OwnedEntity`, UUID `@GeneratedValue` id,
soft-deleted; `content` maps as a typed jsonb via `@JdbcTypeCode(SqlTypes.JSON)` onto
`BriefingContentEnvelope` (`entity/BriefingContentEnvelope.java`) — a record
`{String eyebrow, List<String> body, List<Ref> refs}` with a nested `Ref(String kind, String
label)` (ADR 0006 / `ProvenanceEnvelope` typed-jsonb precedent). The envelope **deliberately
mirrors the FE Briefing shape MINUS `confidence` and `tone`** (§9 gotcha c). `refs` are code-
collected candidates the model selected by index, never invented.

`WeeklySuggestionEntity` (`entity/WeeklySuggestionEntity.java`) `extends OwnedEntity`, UUID
`@GeneratedValue` id, soft-deleted; three flat columns `{LocalDate weekStart, String prose, Instant
generatedAt}` — **no jsonb** (the suggestion is plain prose, no structured refs; the FE maps
`wire → string`).

`MemoirEntity` (`entity/MemoirEntity.java`) `extends OwnedEntity`, UUID `@GeneratedValue` id,
soft-deleted; `{LocalDate weekStart, String title (length 200), String body (text), Instant
generatedAt}` + `anchors` mapped as a typed jsonb via `@JdbcTypeCode(SqlTypes.JSON)` onto
`MemoirAnchorsEnvelope` (`entity/MemoirAnchorsEnvelope.java`) — a record `{List<Anchor> anchors}`
with a nested `Anchor(String kind, String label)` (the `BriefingContentEnvelope`/`ProvenanceEnvelope`
typed-jsonb precedent). `anchors` are code-collected candidates the model selected by index, never
invented; `kind` is the FE `RefTag` vocabulary (`Memory`/`Pattern` in practice). The memoir is the
briefing's structured-envelope shape at the weekly-suggestion smart tier.

`HeartbeatNoteEntity` (`entity/HeartbeatNoteEntity.java`) `extends OwnedEntity`, UUID
`@GeneratedValue` id, soft-deleted; flat columns `{LocalDate noteDate, String windowKey, String
kind, String content, Instant generatedAt}` — **no jsonb** (plain prose, the `weekly_suggestion`
shape). Carries the window/kind vocabulary constants (`WINDOW_MIDDAY`/`WINDOW_EVENING`/
`KIND_NUDGE`/`KIND_CLOSING`).

`PredictionEntity` (`entity/PredictionEntity.java`) `extends OwnedEntity`, UUID `@GeneratedValue` id,
soft-deleted; flat columns `{LocalDate weekStart, String title, String basis, BigDecimal confidence
(nullable, precision 4 scale 3), String metricKey, String expectedDirection, LocalDate validFrom,
LocalDate validTo, String status, String actual (nullable), Instant generatedAt}` — no jsonb. Carries
the status/direction/metric vocabulary constants (`STATUS_PENDING`/`VALIDATED`/`MISSED`,
`DIRECTION_UP`/`DOWN`/`STABLE`, `METRIC_WEIGHT_TREND`/`SLEEP_AVG`/`TRAINING_VOLUME`) — the metric +
direction constants are SHARED (P2's experiment + the `MetricWindowEvaluator` reference them).

`ExperimentEntity` (`entity/ExperimentEntity.java`) `extends OwnedEntity`, UUID `@GeneratedValue` id,
soft-deleted; flat columns `{String title, String hypothesis, String status (@Pattern), String
metricKey, String expectedDirection (@Pattern), LocalDate startDate (nullable), Integer totalDays,
String outcome (nullable), Boolean outcomeGood (nullable), Instant generatedAt}` — no jsonb. Carries
the lifecycle constants (`STATUS_PROPOSED`/`ACTIVE`/`COMPLETED`/`DISMISSED`); reuses `PredictionEntity`'s
metric/direction constants.

`ChallengeEntity` (`entity/ChallengeEntity.java`) `extends OwnedEntity`, UUID `@GeneratedValue` id,
soft-deleted; `{UUID templateSessionId, LocalDate workoutDate, UUID exerciseId, String exerciseName,
String type, String status, String risk, String title/why/glory, BigDecimal targetWeightKg
(nullable), Integer targetReps/targetSets/targetRir (nullable), BigDecimal confidence (nullable,
precision 4 scale 3), String outcome (nullable), Boolean outcomeGood (nullable), Instant
generatedAt}` + `refs` mapped as a typed jsonb via `@JdbcTypeCode(SqlTypes.JSON)` onto
`ChallengeRefsEnvelope` (`entity/ChallengeRefsEnvelope.java`) — a record `{List<Ref> refs}` with a
nested `Ref(String kind, String label)` (the `BriefingContentEnvelope`/`MemoirAnchorsEnvelope`
typed-jsonb precedent; refs are model-SELECTED by index, never invented). Carries the vocabulary
constants (`TYPE_PR`/`DEPTH`/`VOLUME`, `STATUS_PROPOSED`/`ACCEPTED`/`DISMISSED`/`HIT`/`MISS`/`INCONCLUSIVE`,
`RISK_LOW`/`MID`).

### REST endpoints (contract-first — tag `Proactive` → `ProactiveApi`)

Fragment `api/feature/proactive/proactive.yml`; `ProactiveController implements ProactiveApi`.
Every non-2xx returns `SystemMessageList`. The paths are protected (401 without a token).

| Method + path | Returns | Status | Notes |
|---|---|---|---|
| `GET /api/proactive/briefing?date=` | `BriefingResponse` | 200 · 401 · 404 | `date` optional (FE sends its LOCAL date; defaults to server today). Persisted row or lazy-generate; **404 `RESOURCE_NOT_FOUND`** when no `daily_summary` in the past-days window (§9 gotcha d). |
| `GET /api/proactive/weekly-suggestion?date=` | `WeeklySuggestionResponse` | 200 · 401 · 404 | `date` optional (any day of the wanted week; the week identity is its ISO Monday; defaults to server today). Persisted row or lazy-generate; **404 `RESOURCE_NOT_FOUND`** when the prior week has no `daily_summary` (§9 gotcha d) — the FE keeps its honest placeholder. |
| `GET /api/proactive/memoir` | `MemoirResponse` | 200 · 401 · 404 | **No parameters.** The LATEST persisted memoir, else lazy-generate the LAST COMPLETED week (`previousOrSame(MONDAY).minusWeeks(1)`); **404 `RESOURCE_NOT_FOUND`** when that week has no `daily_summary` (§9 gotcha d) — the FE renders its honest „készül" state. Archive (older rows) is a later slice. |
| `GET /api/proactive/heartbeat?date=` | `HeartbeatNoteResponse` | 200 · 401 · 404 | `date` optional (FE sends its LOCAL date; defaults to server today). The day's LATEST note; for TODAY the latest already-elapsed window lazy-generates when missing (§9 decision r); past dates never generate. **404 `RESOURCE_NOT_FOUND`** = honest absence — the Today card simply stays absent. |
| `GET /api/proactive/prediction` | `PredictionResponse[]` | 200 · 401 | **No parameters.** ALL live predictions, newest window first; lazily generates the CURRENT week when it has no rows (needs CONFIRMED patterns). **`200 []` is the honest empty state — NEVER a 404** (a list endpoint). |
| `GET /api/proactive/experiment` | `ExperimentResponse[]` | 200 · 401 | **No parameters.** Live experiments (proposed/active/completed, dismissed excluded), newest first; lazily proposes when the user has none. **`200 []` = honest empty, never 404.** |
| `POST /api/proactive/experiment/{id}/decision` | `ExperimentResponse` | 200 · 400 · 401 · 404 · 409 | **L2 accept/dismiss** (`{decision: accept\|dismiss}`). `accept` ⇒ active + start_date=today; `dismiss` ⇒ dismissed. 404 = not-found/foreign; **409 `PROACTIVE_EXPERIMENT_NOT_PROPOSED`** = already decided; 400 = invalid decision value. |
| `POST /api/proactive/experiment/propose` | `ExperimentResponse[]` | 200 · 401 | On-demand proposal (the "+ Új kísérlet javasol Mezo" button). Up to the open-cap; `[]` when the cap is met / no confirmed patterns. |
| `GET /api/proactive/challenge?templateSessionId=&date=` | `ChallengeResponse[]` | 200 · 401 | HBWI. A planned session's live challenges for `date` (dismissed excluded), oldest first. **Lazily generates** when none exist AND `date == today`; **lazily resolves** accepted ones when the instance is done. **`200 []` = honest empty, never 404.** Owner-scoped. |
| `POST /api/proactive/challenge/{id}/decision` | `ChallengeResponse` | 200 · 400 · 401 · 404 · 409 | HBWI. **L2 accept/dismiss** (`{decision: accept\|dismiss}`, `@Pattern ^(accept\|dismiss)$`). `accept` ⇒ `accepted`; `dismiss` ⇒ `dismissed`. 404 `PROACTIVE_CHALLENGE_NOT_FOUND` = not-found/foreign; **409 `PROACTIVE_CHALLENGE_NOT_PROPOSED`** = already decided; 400 = invalid decision value. **No `propose` endpoint** (generation is implicit on the prep-read). |

Schemas: `BriefingResponse{date, eyebrow, body[], refs[], generatedAt}` +
`BriefingRef{kind, label}` — **no `confidence`, no `tone`** on the wire (§9 gotcha c). `refs[].kind`
is the FE `RefTag` vocabulary (`WeightTrend|Goal|Workout|FuelDay|Medication|Sleep|Memory`).
`WeeklySuggestionResponse{weekStart, prose, generatedAt}` — plain prose, no structured fields.
`MemoirResponse{weekStart, title, body, anchors[], generatedAt}` + `MemoirAnchor{kind, label}` —
`anchors[].kind` is the same FE `RefTag` vocabulary (`Memory`/`Pattern` in practice), model-SELECTED
from code-collected candidates, never invented.
`HeartbeatNoteResponse{date, window, kind, content, generatedAt}` — flat prose; `window` on the
wire maps from the entity's `windowKey`.
`PredictionResponse{id, title, basis, confidence?, metricKey, expectedDirection, validFrom, validTo,
status, actual?, generatedAt}` — `confidence` nullable on the wire (the FE renders „tanulom" on null;
the `BigDecimal → Double` mapper default); the FE derives its `date` window label + accuracy header
client-side.
`ExperimentResponse{id, title, hypothesis, status, metricKey, expectedDirection, startDate?, totalDays,
outcome?, outcomeGood?, generatedAt}` + `ExperimentDecisionRequest{decision}` — `startDate`/`outcome`/
`outcomeGood` nullable on the wire; the FE derives the `day` counter client-side and maps
`outcomeGood: null → undefined`.
`ChallengeResponse{id, exerciseId, exercise, type, typeLabel, status, target, confidence?, risk, why,
glory, refs[], outcome?, outcomeGood?, generatedAt}` + `ChallengeRef{kind, label}` +
`ChallengeDecisionRequest{decision}` — **`typeLabel` (HU label) and `target` (display string) are
DERIVED in code** from the structured target fields (via `ChallengeDisplay` static helpers on the
mapper, §3 / §9 gotcha), not stored; `confidence`/`outcome`/`outcomeGood` nullable on the wire
(`confidence` null ⇒ the FE renders „tanulom").

### Configuration

`config/ProactiveProperties.java` (`@Validated`, binds `mezo.proactive.*` — nested `briefing` +
`weekly` + `memoir` + `heartbeat` + `prediction` + `experiment` + `challenge` records):

- **`briefing.past-days`** (`@Min(1) @Max(14)`, default **7**): how many finished days of narrative
  memory the briefing gather reads — and doubles as the **emptiness gate** (zero summaries ⇒ 404).
- **`briefing.cron`** (`@NotBlank`, default `0 45 5 * * *`): the dawn `BriefingJob` schedule (server
  zone), before the typical wake.
- **`briefing.regen-cap-per-day`** (`@Min(0) @Max(5)`, default **2**): the per-user+day ceiling on
  sleep-triggered regenerations (`refreshIfStale`); 0 = never regenerate.
- **`weekly.cron`** (`@NotBlank`, default **`0 0 6 * * MON`** — Monday 06:00 server zone): the
  `WeeklySuggestionJob` schedule; the suggestion is FOR the week that is starting (§9 decision j).
- **`memoir.cron`** (`@NotBlank`, default **`0 0 19 * * SUN`** — Sunday 19:00 server zone): the
  `MemoirJob` schedule; the memoir is FOR the week ENDING that Sunday (§9 decision l).
- **`heartbeat.midday-cron`** (`@NotBlank`, default **`0 30 12 * * *`**) + **`heartbeat.evening-cron`**
  (`@NotBlank`, default **`0 30 20 * * *`**): the two H1 window schedules (§9 decision p). The lazy
  GET derives the window fire-times from these SAME expressions — one source of truth (§9 decision r).
- **`prediction.cron`** (`@NotBlank`, default **`0 30 6 * * MON`**) + **`prediction.validation-cron`**
  (`@NotBlank`, default **`0 15 6 * * *`**) + **`prediction.max-per-week`** (`@Min(1) @Max(10)`, default
  **3**) + **`prediction.weight-epsilon-kg`** (`@DecimalMin("0.0")`, default **0.1**) +
  **`prediction.sleep-epsilon-h`** (default **0.25**): the P1 generation/validation schedules, the
  per-week cap, and the stable-band epsilons for the deterministic direction verdicts (§9 decisions t/u).
  **The epsilons are reused by `MetricWindowEvaluator` for P2 outcomes too.**
- **`experiment.propose-cron`** (`@NotBlank`, default **`0 45 6 * * MON`**) + **`experiment.outcome-cron`**
  (`@NotBlank`, default **`0 20 6 * * *`**) + **`experiment.max-open`** (`@Min(1) @Max(10)`, default **3**)
  + **`experiment.min-days`**/**`max-days`** (`@Min(1) @Max(60)`, defaults **3**/**28**): the P2 proposal/
  outcome schedules, the OPEN-experiment cap, and the clamp bounds for the model-proposed window (§9
  decisions y/z).
- **`challenge.outcome-cron`** (`@NotBlank`, default **`0 25 6 * * *`** — daily 06:25, after the P2
  outcome run) + **`challenge.max-per-workout`** (`@Min(1) @Max(6)`, default **3**): the HBWI
  outcome-backstop schedule and the per-workout proposal cap. **No propose/generation cron** —
  challenges are generated lazily on the prep-read (§9 challenge decision).

Plus the seven techcore job switches, each the THIRD `@ConditionalOnProperty` on its job bean (on top
of the companion+proactive dual gate; off ⇒ the cron bean does not exist, the lazy GET still serves):
**`briefing-job`** (`BRIEFING_JOB_SWITCH`), **`weekly-suggestion-job`** (`WEEKLY_SUGGESTION_JOB_SWITCH`),
**`memoir-job`** (`MEMOIR_JOB_SWITCH`), **`heartbeat-job`** (`HEARTBEAT_JOB_SWITCH` — one switch for
BOTH windows), **`prediction-job`** (`PREDICTION_JOB_SWITCH` — generation + validation),
**`experiment-job`** (`EXPERIMENT_JOB_SWITCH` — propose + outcome), and **`challenge-job`**
(`CHALLENGE_JOB_SWITCH` — outcome backstop only), all `mezo.techcore.cron.*.enabled`, default `true`.

## 5. Integrations

Proactive is a **Phase-4 domain that reads from companion + the other features, never the reverse**
(the roadmap coupling rule; the frozen ArchUnit cycle rule guards it).

### 5.1 Proactive → Companion (✅ B1.1 + W1 wired — read-only, one-way)
The briefing generator composes three companion capabilities directly:
`ContextSnapshotAssembler.render(userId, date)` (V0.3 today-block),
`KnowledgeFactService.renderPromptBlock(userId)` (V1.1 top-N facts),
`DailySummaryRepository.findByCreatedByAndSummaryDateGreaterThanEqualOrderBySummaryDateDesc(…)`
(V2.2 narratives), and the `CompanionLlm.complete(system, user)` port for the one prose call.
**W1's `WeeklySuggestionGenerator` adds a fourth read** — `PatternRepository.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(…)`
(the V3.1/V3.2 Inbox rows) — and calls the port's **`completeSmart`** variant (Pro tier) instead of
`complete`. **W2's `MemoirGenerator` composes the same four reads** (summaries + facts + patterns +
the `completeSmart` port) but over the week's OWN window `[weekStart, weekStart+6]` rather than the
prior week — no new companion capability, just a different window. **H1's `HeartbeatGenerator`**
reuses the briefing's three reads (snapshot + facts + summaries) via the CHEAP-tier `complete` —
plus one proactive-internal read (`BriefingRepository`, the dedupe block). **P1's `PredictionGenerator`**
reads snapshot + facts + **CONFIRMED patterns only** (`findByCreatedByAndStatusAndDeletedFalse…`, the
grounding gate) via `completeSmart`; **P1's validation + P2's outcome** read
`WeightLogRepository` / `SleepLogRepository` / `WorkoutSessionRepository.findDoneInstanceDates`
(biometrics + train, read-only) via the shared **`MetricWindowEvaluator`** — the proactive reach
beyond companion, still strictly one-way. **P2's `ExperimentProposalGenerator`** reads CONFIRMED
patterns + snapshot + facts via `completeSmart` (the P1 pattern-grounding gate).
**Contract crossing the seam:** these read methods with explicit `userId` scoping; strictly one-way — no companion code imports
proactive. This one-way rule is why the fake sentinels' markers are literal mirrors rather than
imports (§9 gotcha a).

### 5.2 Proactive ↔ LLM provider (wired via companion, ADR 0008)
All model access goes through the same `CompanionLlm` port — **cheap tier** (`complete`, one call per
briefing) and **smart tier** (`completeSmart`, one call per weekly suggestion / one per memoir — the
V3.2 Pro-tier routing). Real `GeminiCompanionLlm` / test `FakeCompanionLlm` (the `[fake-briefing:{…}]`
+ `[fake-weekly:…]` + `[fake-memoir:{…}]` sentinels; the fake's `completeSmart` delegates to
`complete`, so one dispatch covers both tiers). Provider detail is hidden by the port; proactive adds
no new adapter.

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

### 5.5 Proactive → Insights Weekly FE (✅ W1 wired — real-only read)
The Insights Weekly „Mezo · heti tervjavaslat" card ([insights.md §2.2](insights.md)) is the
consumer. `useWeekly()` (`data/insights/weeklyHooks.ts`) fetches `GET /api/proactive/weekly-suggestion?date=<local>`
via `weeklySuggestionApi.get` (`data/insights/weeklySuggestionApi.ts`, `wire → w.prose` string) in a
real-only `useQuery` (`['weeklySuggestion', start]`, `enabled: !mock`, `retry: false`, 404→null) —
the one bare `useQuery` in that otherwise-`useRealQuery` file (commented as such). `weeklySuggestion:
string | null` joins the D′ `WeeklyView`; the card renders the prose or the honest placeholder, and
the „Elfogad/Hangoljuk" buttons are hidden when `mode !== 'mock'`. Mock mode: `useWeekly` returns the
seed prose synchronously (the query is disabled) ⇒ byte-parity.

### 5.6 Proactive → Insights Memoir FE (✅ W2 wired — dual-mode read)
The Insights Memoir tab ([insights.md §2.3](insights.md)) is the consumer. `useMemoir()`
(`data/insights/memoirHooks.ts`) fetches `GET /api/proactive/memoir` via `memoirApi.latest`
(`data/insights/memoirApi.ts`, `toMemoir` wire→FE `Memoir` — the week label derives client-side from
`weekStart` via `isoWeekNumber` + `deriveWeekTitle`, reused from `weeklyHooks`/`fuelWeekHooks`) in a
`['memoir']` `useQuery` (`retry:false`, 404→null). Returns `{ memoir: Memoir | null; anniversaryNote:
string | null; mode }`; real mode maps the server memoir (or null on 404/loading/error, note always
null), mock returns the seed memoir + anniversaryNote synchronously (byte-parity). `MemoirPage`
renders the memoir card or the honest null-state, with reactions/anniversary/archive gated behind
`mode === 'mock'`. The FE `Memoir` type (`{week, title, body, anchors}`) is reused **unchanged** from
Phase 1. `memoir` also leaves `PHASE3_TAB_IDS` (`tabs.ts`) so the tab is visible in real mode.

### 5.7 Proactive → Today FE, companion note (✅ H1 wired — dual-mode read)
The Today `CompanionNoteCard` is the consumer. `useCompanionNote()` (`data/today/heartbeatHooks.ts`,
`['heartbeat', date]`) reads `GET /api/proactive/heartbeat?date=<local>` via `heartbeatApi.get`
(`data/today/heartbeatApi.ts`, wire→FE `CompanionNote{window, kind, text}`), 404→null, `retry:false`;
mock mode returns null synchronously (no fetch — the Phase-1 Today has no such card, byte-parity).
`TodayPage.tsx` calls the hook directly (not through `useToday` — the card is independent of the
composed Today payload) and renders the card after the check-in strip only when the note exists.

### 5.8 Proactive → Insights Predictions FE (✅ P1 wired — dual-mode read)
The Insights Predictions tab ([insights.md §2.4](insights.md)) is the consumer. `usePredictions()`
(`data/insights/predictionsHooks.ts`, `['predictions']`) fetches `GET /api/proactive/prediction` via
`predictionsApi.list` (`data/insights/predictionsApi.ts`, `toPrediction` wire→FE `Prediction` — the
window label + accuracy header derive client-side; `confidence ?? null`) in real mode ([] on
loading/error — a list never 404s), mock returns the seed. Returns `{predictions, mode}`. `PredictionsPage`
renders the real cards or the honest still-learning null-state; `predictions` also leaves `PHASE3_TAB_IDS`
(`tabs.ts`) so the tab is visible in real mode. The FE `Prediction` type gained a **nullable
`confidence`** and the `missed` status (both honest-state additions).

### 5.9 Proactive → Insights Experiments FE (✅ P2 wired — dual-mode read + write)
The Insights Experiments tab ([insights.md §2.7](insights.md)) is the consumer, and the FIRST
proactive surface with a WRITE. `useExperiments()` (`data/insights/experimentsHooks.ts`,
`['experiments']`) fetches `GET /api/proactive/experiment` via `experimentsApi.list` (`experimentsApi.ts`,
`toExperiment` wire→FE — the `day` counter derives client-side, `outcomeGood: null → undefined`) in
real mode (`[]` on error), mock returns the seed. `useExperimentActions()` mirrors the companion
`usePatternActions` `useMutation`+`invalidateQueries` idiom: `decide(id, 'accept'|'dismiss')` POSTs the
decision, `propose()` POSTs the on-demand proposal, both invalidate `['experiments']` (no-ops in mock).
`ExperimentsPage` renders the real cards + L2 buttons or the honest null-state; `experiments` leaves
`PHASE3_TAB_IDS` — **now EMPTY, so all seven Insights tabs are real**. The FE `Experiment` type gained
the `proposed`/`dismissed` statuses.

### 5.10 Proactive → Train ActiveWorkoutPage FE (✅ HBWI wired — dual-mode read + write)
The **workout-scoped** consumer (NOT Insights): the `ActiveWorkoutPage` prep carousel
([train.md §Active workout](train.md)). Unlike every other proactive surface, the FE hook lives in the
CONSUMING feature's data folder — `useChallenges(templateSessionId|null, date)` +
`useChallengeActions()` (`data/train/challengeHooks.ts`, `['challenges', templateSessionId, date]`).
In real mode `useChallenges` fetches `GET /api/proactive/challenge?templateSessionId=&date=` via
`challengeApi.list` (`data/train/challengeApi.ts`, `toChallenge` wire→FE `Challenge` — `confidence ??
null`, `outcomeGood: null → undefined`), disabled until a `templateSessionId` exists; mock returns the
`train.ts` seed. `useChallengeActions().decide` POSTs accept/dismiss and invalidates the list (no-op in
mock, a local toggle keeps byte-parity). The accepted state derives from the server `status`
(`accepted|hit|miss`); resolved challenges render the outcome chip (✓/◯/◌). The FE `Challenge` type
gained a **nullable `confidence`**, a `status`, the structured target fields, and `outcome`/`outcomeGood`.
The proactive→train coupling is strictly one-way (the backend evaluator reads Train repositories; Train
never imports proactive — challenges are NOT in `WorkoutPlan`, sourced separately by the page).

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

curl -s "http://localhost:8090/api/proactive/weekly-suggestion?date=2026-07-06" \
  -H "Authorization: Bearer $TOKEN"
# → { "weekStart":"2026-07-06", "prose":"Ezen a héten…", "generatedAt":… }
# → 404 SystemMessageList when the prior week has no daily_summary (the FE's honest placeholder)

curl -s "http://localhost:8090/api/proactive/memoir" \
  -H "Authorization: Bearer $TOKEN"
# → { "weekStart":"2026-06-29", "title":"…", "body":"…", "anchors":[{"kind":"Memory","label":"2026-07-01"}], "generatedAt":… }
# → 404 SystemMessageList when the last completed week has no daily_summary (the FE's honest „készül" state)

curl -s "http://localhost:8090/api/proactive/heartbeat" \
  -H "Authorization: Bearer $TOKEN"
# → { "date":"2026-07-07", "window":"midday", "kind":"nudge", "content":"…", "generatedAt":… }
# → 404 SystemMessageList before the first window / without narrative memory (honest absence — no card)

curl -s "http://localhost:8090/api/proactive/prediction" \
  -H "Authorization: Bearer $TOKEN"
# → [ { "id":"…", "title":"…", "basis":"…", "confidence":null, "metricKey":"weight_trend",
#       "expectedDirection":"down", "validFrom":"2026-07-07", "validTo":"2026-07-13",
#       "status":"pending", "generatedAt":… } ]
# → [] (200) when there are no confirmed patterns yet (honest empty — NOT a 404)
```

The prediction generator needs at least one CONFIRMED `pattern`; for a keyless local run plant a
`[fake-prediction:{…}]` sentinel via a check-in note (the `PredictionGeneratorIT` pattern).

```bash
curl -s "http://localhost:8090/api/proactive/experiment" -H "Authorization: Bearer $TOKEN"
# → [ { "id":"…","title":"…","hypothesis":"…","status":"proposed","metricKey":"sleep_avg",
#       "expectedDirection":"up","startDate":null,"totalDays":7,"outcome":null,"outcomeGood":null,… } ]
# → [] (200) when there are no confirmed patterns (honest empty — NOT a 404)

curl -s -X POST "http://localhost:8090/api/proactive/experiment/$ID/decision" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"decision":"accept"}'
# → { …, "status":"active", "startDate":"2026-07-07", … }  (409 if the row is not proposed)
```

The experiment proposal, like predictions, needs a CONFIRMED pattern; the `[fake-experiment:{…}]`
sentinel is planted via a check-in note (the `ExperimentProposalGeneratorIT` pattern).

The weekly suggestion needs at least one `daily_summary` in the **prior** week; for a keyless local
run plant a `[fake-weekly:…]` sentinel via a prior-week check-in note (the `WeeklySuggestionGeneratorIT`
pattern). The **memoir** needs a `daily_summary` inside the last completed week — and because its
gather is a PAST-week composition with no snapshot, the `[fake-memoir:{…}]` sentinel is planted via a
daily-summary NARRATIVE, not a check-in note (the `MemoirGeneratorIT` pattern — §9 gotcha m).
**FE consumers:** the Today card (B1.2, [today.md](today.md)), the Insights Weekly card (W1) and the
Insights Memoir tab (W2, both [insights.md](insights.md)) all read these endpoints dual-mode.

## 7. How to extend it

- **B1.2 shipped (cron + staleness + FE swap) — the extension pattern:** the dawn `BriefingJob`
  (`@Scheduled`, three-switch, today-only, per-user isolation), the read-path `refreshIfStale`
  (soft-delete + regenerate on a late `sleep_log`, `regen_count` cap), and the dual-mode `useBriefing`
  Today swap are the working templates for the next stages. **To tune freshness:** widen the staleness
  trigger beyond sleep (more `existsBy…` probes in `refreshIfStale`) or raise `regen-cap-per-day`.
  **To move the cron:** `mezo.proactive.briefing.cron` (never add a catch-up loop — a past morning is
  never read; §9 decision f).
- **W1 shipped (weekly generator + Monday cron + FE swap) — the smart-tier template:** `WeeklySuggestionGenerator`
  (pure-code `gather` at the smart tier, `completeSmart`, plain-prose output, honest-null),
  `WeeklySuggestionJob` (`@Scheduled`, three-switch, current-week-only, per-user isolation) and the
  real-only `useWeekly().weeklySuggestion` swap are the working templates for W2/H/P. It is the
  briefing template minus the jsonb envelope/refs and minus any staleness machinery.
- **W2 shipped (memoir generator + Sunday cron + FE un-ghost) — the structured smart-tier template:**
  `MemoirGenerator` (pure-code `gather` over the week's OWN summaries + facts + patterns + numbered
  anchor candidates, `completeSmart`, **strict-JSON `{title, body, anchorIndexes}` with
  model-selected typed-jsonb anchors**, honest-null), `MemoirJob` (`@Scheduled`, three-switch,
  that-week-only, per-user isolation) and the dual-mode `useMemoir` un-ghost (drop the
  `PHASE3_TAB_IDS` entry + the page's `PhaseTeaserCard` guard) are the working templates for a
  structured weekly narrative — it is the weekly-suggestion smart tier PLUS the briefing's jsonb
  envelope. It is also the recipe for un-ghosting the remaining Insights tabs (predictions/experiments
  in P): drop from `PHASE3_TAB_IDS`, remove the page guard, render real data + the honest null-state,
  keep unpersisted extras mock-only.
- **H1 shipped (heartbeat generator + two window crons + Today card) — the cheap-tier in-day
  template:** `HeartbeatGenerator` (snapshot-grounded gather + briefing dedupe + window
  instruction, `complete`, flat prose, honest-null), `HeartbeatJob` (two `@Scheduled` methods on
  config crons under ONE switch) and the `CronExpression`-derived lazy-elapsed-window read
  (`ProactiveHeartbeatService.latestElapsedWindow`) are the template for any future intra-day
  surface. **To add a window:** extend the `Heartbeat` properties record + a third `@Scheduled`
  method + the service's window list (and widen the DB CHECK on `window_key`).
- **P1 shipped (prediction generator + validation + weekly/daily job + list read + tab un-ghost) —
  the deterministic-forecast template:** `PredictionGenerator` (smart-tier gather over CONFIRMED
  patterns + a fixed metric catalog, code-set windows, pattern-copied confidence, honest-empty),
  `PredictionValidationService` (pure-code window-vs-baseline verdict, no-data ⇒ pending),
  `PredictionJob` (two `@Scheduled` methods under one switch), the list `GET` (lazy current-week,
  `[]` = honest), and the `usePredictions` un-ghost are the template for **P2 (experiments)**: a
  `proposed`/`active`/`completed` lifecycle reuses the same gather + a `POST …/decision` L2-accept
  (the spec §5.2 shape). **To extend the metric catalog:** add a `METRIC_*` constant + a `case` in
  `PredictionValidationService.evaluate` + widen the generator's `VALID_METRICS` (the model only
  selects from the catalog it's shown).
- **P2 shipped (experiment domain + write path + un-ghost) — the epic-closing template.** The
  `MetricWindowEvaluator` (shared by P1 validation + P2 outcome) is the pattern for any future
  deterministic metric verdict; `ExperimentProposalGenerator` mirrors `PredictionGenerator`; the
  **write path** (`ProactiveExperimentService.decide` — fetch-owned-or-404 → state-guard 409 →
  mutate, the companion `PatternService` idiom) is the template for any future proactive L2 surface.
  **The `PHASE3_TAB_IDS` set is now empty** — every Insights tab is real.
- **The proactive epic is COMPLETE (all 8 slices).** The only deferred item is **H2 Web Push** (pure
  delivery infra — VAPID SealedSecret on k3s + `push_subscription` + the SW push handler; the content
  it would deliver, the heartbeat/briefing, already exists). New proactive surfaces belong to the
  deferred-signals epic (spec §1: vulnerable/niggle sources, crisis/drift, opportunity scanner,
  anniversaries) — map it companion-style when picked up. Any new surface: add a sibling `*Generator`
  + table + `*.yml` fragment in `feature/proactive/`, gated on the same dual switch; smart-tier
  narratives reuse the gather idiom, a plain-prose surface follows `weekly_suggestion`, a structured
  one follows `briefing`/`memoir`, a deterministic-verdict one reuses `MetricWindowEvaluator`.
- **Prompt / marker tuning:** the prompts are `BriefingGenerator.PROMPT` /
  `WeeklySuggestionGenerator.PROMPT` / `MemoirGenerator.PROMPT` / `HeartbeatGenerator.PROMPT` /
  `PredictionGenerator.PROMPT` / `ExperimentProposalGenerator.PROMPT` (keep each `*_MARKER` prefix +
  its `FakeCompanionLlm` literal mirror in sync — §9 gotcha a); briefing ref candidates are
  `SNAPSHOT_CANDIDATES` + the per-summary `Memory` refs in `gather` (the weekly suggestion and the
  heartbeat carry no refs; the prediction/experiment carry pattern candidates — the prediction
  resolves them to CONFIDENCE, the experiment only uses them for grounding).
- **Never add `confidence`/`tone`** back to the envelope without a real computed source (§9 gotcha c).

## 8. Testing

Integration-first, over the fixed `mezo_test` DB (or Testcontainers); the fake LLM's
`[fake-briefing:{…}]` + `[fake-weekly:…]` + `[fake-memoir:{…}]` + `[fake-heartbeat:…]` +
`[fake-prediction:{…}]` + `[fake-experiment:{…}]` sentinels script deterministic answers. **~103
tests across 31 classes** — the B/W/H/P1 classes plus the P2 additions:

**B (briefing):**

- **`BriefingPersistenceIT` (4)** — envelope jsonb round-trip; the partial-unique index rejects a
  second LIVE row for the same day; soft-delete allows regeneration; owner-scoped finder isolation.
- **`BriefingGeneratorIT` (6)** — gather composes snapshot+facts+summaries+candidates when data
  exists; gather returns null on an empty window; generate persists the scripted envelope; generate
  returns the existing row without an LLM call; generate returns null on non-parseable JSON; generate
  drops out-of-range (hallucinated) ref indexes.
- **`ProactiveApiIT` (9)** — HTTP briefing: lazy-generate + idempotent re-GET; `date` param honored for
  a past date; 404 when no narrative memory; 401 without a token. **+ W1 weekly-suggestion (2):**
  lazy-generate when the prior week has memory; 404 when no prior-week memory. **+ W2 memoir (3):**
  returns the latest persisted row; lazily generates the last completed week (the fake's un-scripted
  „Fake memoir" default); 404 when no memoir and no memory.
- **`ProactiveApiSwitchOffIT` (3)** — `mezo.feature.proactive.enabled=false` ⇒ 404 for briefing,
  weekly-suggestion **and** memoir (bean absence).
- **`ProactiveApiCompanionOffIT` (1)** — `mezo.feature.companion.enabled=false` ⇒ 404 (dual gate).
- **`BriefingJobIT` (3, B1.2)** — the dawn run generates today's briefing when the user has narrative
  memory; is idempotent when a briefing already exists; skips a user without memory and still serves
  the others (per-user failure isolation).
- **`BriefingJobSwitchOffIT` (1, B1.2)** — `mezo.techcore.cron.briefing-job.enabled=false` ⇒ no
  `BriefingJob` bean (the third switch).
- **`BriefingFreshnessIT` (4, B1.2)** — `refreshIfStale` regenerates when a sleep log arrived after
  generation; serves the existing row when no late input; stops regenerating once the cap is reached;
  serves 404 **and preserves the old row** when regeneration fails (the rollback path).

**W (weekly suggestion, W1):**

- **`WeeklySuggestionPersistenceIT` (3)** — save/reload round-trip; the partial-unique index rejects a
  second LIVE row for the same week; owner-scoped finder isolation.
- **`WeeklySuggestionGeneratorIT` (5)** — gather composes prior-week summaries + facts + snapshot when
  data exists; gather returns null when the prior week is empty; generate persists the scripted prose
  (via the `[fake-weekly:…]` sentinel — exercising the smart-tier dispatch); generate returns the
  existing row without an LLM call; generate returns null on a blank answer.
- **`WeeklySuggestionJobIT` (2)** — the Monday run generates the current week's suggestion when the
  prior week has memory; is idempotent when a suggestion already exists.
- **`WeeklySuggestionJobSwitchOffIT` (1)** — `mezo.techcore.cron.weekly-suggestion-job.enabled=false`
  ⇒ no `WeeklySuggestionJob` bean (the third switch).

**W (memoir, W2):**

- **`MemoirPersistenceIT` (3)** — the `anchors` jsonb-envelope round-trip; the partial-unique index
  rejects a second LIVE row for the same week (`uq_memoir_created_by_week_start`); the latest-first
  owner-scoped finder (`findFirstByCreatedByOrderByWeekStartDesc`) returns the newest own row.
- **`MemoirGeneratorIT` (5)** — gather composes the week's summaries `[weekStart, weekStart+6]` + a
  `Memory` candidate per summary + the `HORGONY-JELÖLTEK` block, and EXCLUDES the prior Sunday
  (window boundary); gather returns null on an empty week; generate persists the scripted memoir (via
  a `[fake-memoir:{…}]` sentinel planted in a daily-summary NARRATIVE — the gather has no snapshot, so
  the check-in-note channel is unavailable; §9 gotcha m); generate returns the existing row without an
  LLM call; generate returns null on non-parseable JSON.
- **`MemoirJobIT` (2)** — the Sunday run generates the current week's memoir when the user has
  narrative memory; is idempotent when a memoir already exists.
- **`MemoirJobSwitchOffIT` (1)** — `mezo.techcore.cron.memoir-job.enabled=false` ⇒ no `MemoirJob`
  bean (the third switch).

**H (heartbeat, H1):**

- **`HeartbeatPersistenceIT` (3)** — round-trip; the partial-unique index rejects a second LIVE row
  for the same (user, day, window) but allows another window the same day; the latest-first
  owner-scoped finder returns the own newest note.
- **`HeartbeatGeneratorIT` (5)** — gather composes snapshot + latest summary + the `MAI BRIEFING`
  dedupe block + the `ABLAK:` instruction; gather returns null without narrative memory; generate
  persists the scripted note (via a `[fake-heartbeat:…]` check-in-note sentinel — the gather HAS a
  snapshot, unlike the memoir §9 gotcha m) with the window-derived kind; generate is idempotent;
  generate returns null on a blank answer.
- **`HeartbeatJobIT` (2)** — the midday run writes a nudge for a user with memory; the evening run
  is idempotent. **`HeartbeatJobSwitchOffIT` (1)** — the third switch ⇒ no `HeartbeatJob` bean.
- **`HeartbeatLazyIT` (2)** — with midnight-override crons the GET lazy-generates the LATEST
  elapsed window (evening) for today; 404 without memory. **`ProactiveApiIT` (+3)** — persisted
  latest note wins (evening beats midday); a PAST date never lazy-generates (404 despite memory);
  401 without a token. **`ProactiveApiSwitchOffIT` (+1)** — heartbeat 404 when proactive off.

**P (predictions, P1):**

- **`PredictionPersistenceIT` (3)** — round-trip with null confidence + code-set window; the status
  CHECK rejects a bad status; the owner-scoped ordered finder returns own rows newest-window-first.
- **`PredictionGeneratorIT` (6)** — gather composes snapshot + numbered candidates + the metric
  catalog when a CONFIRMED pattern exists; gather null when only a PROPOSED pattern exists (grounding
  gate); generate persists scripted rows with code-set windows + pattern-copied (null) confidence via
  `[fake-prediction:{…}]` in a check-in note; drops a row with an invalid `metricKey`; idempotent
  (second call empty, count unchanged); unparseable JSON ⇒ empty list.
- **`PredictionValidationIT` (4)** — a weight-down prediction validates when the window avg dropped
  past epsilon; flips to missed on the wrong direction; stays pending with no window data; an
  still-open window (`valid_to ≥ today`) is untouched.
- **`PredictionJobIT` (2)** — the weekly run generates for a user with a confirmed pattern; the
  validation run closes a due window. **`PredictionJobSwitchOffIT` (1)** — the third switch ⇒ no bean.
- **`ProactiveApiIT` (+3)** — the list returns rows newest-window-first with null confidence on the
  wire; `200 []` when no rows and no confirmed patterns (honest empty, never 404); 401 without a
  token. **`ProactiveApiSwitchOffIT` (+1)** — prediction 404 when proactive off (bean absence).

**P (experiments, P2):**

- **`ExperimentPersistenceIT` (3)** — round-trip a proposed row (null startDate/outcomeGood); the
  entity `@Pattern` rejects a bad status (`ConstraintViolationException`, before the DB CHECK); the
  live finder excludes dismissed + scopes to owner.
- **`ExperimentProposalGeneratorIT` (5)** — gather composes snapshot + candidates + catalog with a
  CONFIRMED pattern; null with only a proposed pattern (grounding gate); propose persists a scripted
  row with `clampDays` (90→28) via a `[fake-experiment:{…}]` check-in note; a no-op when the open cap
  (3 active) is met; unparseable ⇒ empty.
- **`ExperimentOutcomeIT` (4)** — a sleep-up experiment whose window closed + sleep rose → completed,
  outcomeGood true, "Beigazolódott"; wrong direction → false, "Nem igazolódott"; no data → null,
  "Nem értékelhető"; a still-open window untouched.
- **`ExperimentJobIT` (2)** — the propose run creates a row for a confirmed-pattern user; the outcome
  run completes a due experiment. **`ExperimentJobSwitchOffIT` (1)** — the third switch ⇒ no bean.
- **`ProactiveApiExperimentIT` (8)** — list `[]` without patterns; lazy-propose with a confirmed
  pattern; accept → active (startDate set) then re-decide → **409**; dismiss → drops from the list;
  404 on a random id; 400 on an invalid decision; propose persists; 401 without a token.
  **`ProactiveApiSwitchOffIT` (+2)** — experiment list + decision 404 when proactive off.
- **`PredictionValidationIT` (4, unchanged)** — re-run against the extracted `MetricWindowEvaluator`
  to prove the refactor is behavior-identical.

**FE (Vitest + RTL):** `data/today/briefingHooks.test.tsx` (3) — wire→`Briefing` mapping (no
confidence), 404→null, mock null without fetching; `features/today/components/BriefingCard.test.tsx`
adds a generated-briefing-no-label case; `data/today/todayHooks.test.tsx` adds real-mode
server-briefing (`briefingDemo=false`) + default-404 fallback (`briefingDemo=true`) cases. **W1:**
`data/insights/weeklyHooks.test.tsx` (+2) — serves the generated prose when the GET succeeds; keeps
`weeklySuggestion` null on the default 404; `features/insights/pages/WeeklyPage.test.tsx` (+1) —
renders the live prose WITHOUT the inert „Elfogad/Hangoljuk" buttons. **W2:**
`data/insights/memoirHooks.test.tsx` (3) — maps the server memoir with a derived `Hét N …` week label
(anniversaryNote null, mode live); returns null memoir on the default 404; returns the seed +
anniversaryNote without fetching in mock mode; `features/insights/pages/MemoirPage.test.tsx` gains a
real-mode describe (renders the real memoir + anchors, no reactions/anniversary/archive; the 404 shows
the honest „készül" placeholder, not demo fiction); `insights.nav.test.tsx` flips Memoir from hidden to
visible (5 real-mode tabs incl. Memoir) — at the time `InsightsSubNav.test.tsx` covered this too, but
that file is since deleted with the component it tested (compact-header redesign, `mezo-ugqb`; the
dropdown-based `SubNavDropdown`/`insights.nav.test.tsx` cover the same visibility behavior now). **H1:**
`data/today/heartbeatHooks.test.tsx` (3) — maps the wire note to `CompanionNote`; null on the
default 404; mock null without fetching (byte-parity);
`features/today/components/CompanionNoteCard.test.tsx` (2) — nudge/closing eyebrow copy. **P1:**
`data/insights/predictionsHooks.test.tsx` (3) — maps wire rows preserving null confidence + the
derived window label; `[]` on the default empty array; mock seed without fetching;
`features/insights/pages/PredictionsPage.test.tsx` gains a real-mode describe (real cards + „tanulom"
on null confidence + derived accuracy header, no `hamarosan`; empty array → the honest null-state);
`insights.nav.test.tsx` flips Predictions from hidden to visible. **P2:**
`data/insights/experimentsHooks.test.tsx` (3) — maps a proposed wire row (day 0, outcomeGood
undefined); `[]` on the default; mock seed without fetching;
`features/insights/pages/ExperimentsPage.test.tsx` gains a real-mode describe (a proposed row +
Elfogadom/Elvetem, clicking Elfogadom POSTs the decision; the empty-array null-state);
`insights.nav.test.tsx` flips Experiments from hidden to visible (**all 7
tabs now**). MSW defaults: `/api/proactive/{briefing,weekly-suggestion,memoir,heartbeat}` return 404,
`/api/proactive/prediction` and **`/api/proactive/experiment` return `200 []`**, plus default
`POST …/experiment/{propose,{id}/decision}` handlers (list endpoints' honest default is an empty array).

Test infra: `support/populator/{BriefingPopulator,WeeklySuggestionPopulator,MemoirPopulator,HeartbeatNotePopulator,PredictionPopulator,ExperimentPopulator}.java`
(aggregate factories, all in the `AbstractIntegrationTest` `@Import` list) + `briefing`,
`weekly_suggestion`, `memoir`, `heartbeat_note`, `prediction` and `experiment` in the `ResetDatabase`
TRUNCATE list. Full backend + FE gates green at P2 close (BE clean-test green, FE both modes + build).

## 9. Decisions, gotchas & deferred

- **(a) All SEVEN generator markers are literal-mirrored in `FakeCompanionLlm` — keep in sync.** The
  fake dispatches on `BRIEFING_MARKER_MIRROR` (`"REGGELI-BRIEFING-FELADAT"`), `WEEKLY_MARKER_MIRROR`
  (`"HETI-TERVJAVASLAT"`), `MEMOIR_MARKER_MIRROR` (`"HETI-MEMOIR-FELADAT"`), `HEARTBEAT_MARKER_MIRROR`
  (`"NAPKOZBENI-JEGYZET-FELADAT"`), `PREDICTION_MARKER_MIRROR` (`"HETI-PREDIKCIO-FELADAT"`),
  `EXPERIMENT_MARKER_MIRROR` (`"N1-KISERLET-FELADAT"`) and the SEVENTH `CHALLENGE_MARKER_MIRROR`
  (`"EDZES-KIHIVAS-FELADAT"`, mirroring `ChallengeGenerator.CHALLENGE_MARKER`), **copies** of the seven
  generators' `*_MARKER` constants, NOT imports — a `companion` → `proactive` import would create a
  package cycle that the frozen ArchUnit rule fails the build on. Each literal pair must be edited
  together (both carry a comment pointing at the other; drift fails the generator IT loudly). The
  markers are prefix-collision-checked (`FakeCompanionLlm` dispatches by `startsWith`): the three
  `HETI-*` markers all diverge by char 6, and `NAPKOZBENI-*`/`N1-*`/`EDZES-*` share no prefix with any.
  **The prediction, experiment AND challenge sentinel regexes are GREEDY** (`\[fake-…:(\{.*\})]`, DOTALL)
  unlike the memoir's non-greedy one — those payloads (`{"predictions":[{…}]}` / `{"experiments":[{…}]}`
  / the challenge `{…proposals…}`) nest objects, so a non-greedy match would stop at the FIRST inner
  `}` and truncate the JSON.
- **(b) Proactive beans condition on BOTH switches.** Every bean is
  `@ConditionalOnProperty(name = {COMPANION_SWITCH, PROACTIVE_SWITCH}, havingValue = "true")` —
  proactive calls the `CompanionLlm` port, so it presupposes companion. Switch either off ⇒ no beans
  ⇒ `/api/proactive/*` 404s (proven by both switch-off ITs). The gate is structural (bean absence),
  not a runtime 403.
- **(c) `confidence`/`tone` are deliberately absent from the wire.** The FE `Briefing` type carries
  `confidence`/`tone`, but the envelope and `BriefingResponse` omit both: an LLM's self-reported
  confidence is a **fabricated number** (the honest-numbers rule, spec §6), and `tone` is dead FE
  data with no source. Don't reintroduce either without a real computed value.
- **(d) Empty summary window ⇒ 404 by design (both surfaces).** No `daily_summary` in the briefing's
  `past-days` window / the weekly suggestion's **prior week** (or an unusable LLM answer — briefing:
  null/blank eyebrow/empty body; weekly: null/blank prose) ⇒ `generate` returns null ⇒ the service
  throws 404. A generation with no narrative memory to ground it would be fabricated; the honest state
  is "nothing yet" (the FE renders the placeholder). The briefing v1 emptiness gate (spec §7) — **B1.2
  may loosen it** (e.g. a first-day briefing from the snapshot alone).
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
- **(i) W1 has NO weekly staleness / regeneration path — YAGNI.** Unlike the briefing (which sleep
  can invalidate mid-day, §9 decision e), a weekly suggestion is written once at Monday dawn (or
  lazily on first open) and stands for the whole week. There is no `refreshIfStale`, no `regen_count`,
  no cap — the weekly cadence makes intra-week regeneration pointless. The `weekly_suggestion` partial
  unique still supports soft-delete + reinsert should a future slice want it, but nothing triggers it.
- **(j) The weekly cron is Monday 06:00, for the week just starting.** `mezo.proactive.weekly.cron`
  = `0 0 6 * * MON`; the job gathers from the **finished previous week's** `daily_summary` narratives
  and writes the suggestion FOR the current week (whose Monday is today). Monday-morning (not Sunday
  night) so the whole previous week is already summarized when it runs. Like the briefing cron it does
  **not** backfill — a past week's suggestion is never read (§9 decision f, same reasoning).
- **(k) The „Elfogad / Hangoljuk" buttons are hidden in live mode (false affordance).** They never
  had handlers — accept/tune interactivity is deferred (spec §5). Rather than show dead buttons on a
  real generated suggestion, `WeeklyPage` renders them only when `mode === 'mock'`; live mode shows
  the prose alone. (`WeeklyPage.test.tsx` pins their absence in real mode.)
- **(l) W2 memoir has NO staleness / regeneration path, and the Sunday-19:00 cron writes the week it
  is ENDING — YAGNI + old-journey 5.8.** Like the weekly suggestion (§9 decision i), a memoir is
  written once (at Sunday dusk, or lazily on first open) and stands — no `refreshIfStale`, no
  `regen_count`, no cap. The cron is `0 0 19 * * SUN` (`mezo.proactive.memoir.cron`, the old PRD
  journey 5.8), gathering the week ENDING that Sunday (its Monday = `previousOrSame(MONDAY)` of now).
  Sunday evening (not Monday morning) so the memoir lands while the week is fresh; the trade-off is
  that **Sunday's own `daily_summary` is not yet born** (it is written at the next dawn) — accepted:
  the memoir covers Mon–Sat, one missing day out of seven, and re-running would need a regen path the
  slice deliberately omits. Like the other crons it does **not** backfill.
- **(m) The `[fake-memoir:{…}]` sentinel rides a daily-summary NARRATIVE, not a check-in note — the
  memoir gather has no snapshot.** The briefing/weekly ITs plant their fake sentinel in a check-in
  note that the `ContextSnapshotAssembler` echoes into the prompt. The memoir gather is a PAST-week
  composition (summaries + facts + patterns) with **no snapshot**, so that channel is unavailable;
  the memoir IT plants the sentinel in a `daily_summary` NARRATIVE instead (summaries are free text
  and ARE in the gather). Flagged in the `MemoirGeneratorIT` Javadoc. This is the one structural
  difference from the B/W1 fake-scripting pattern.
- **(n) The Sunday cron writes the week ENDING this Sunday; the lazy GET writes the LAST COMPLETED
  week — deliberately different windows.** `MemoirJob.run()` uses `previousOrSame(MONDAY)` of now (the
  current week, ending this Sunday), because at Sunday 19:00 that week is what just closed. The lazy
  GET fallback (`ProactiveMemoirService`) uses `previousOrSame(MONDAY).minusWeeks(1)` (the LAST
  COMPLETED week), because a user opening the app mid-week whose cron never ran wants the most recent
  FULLY finished week, not the in-progress one. Both are correct for their trigger; the GET always
  returns the LATEST persisted row first, so once the cron has run the lazy path is a pure miss-recovery.
- **(o) Memoir reactions + anniversary card + archive footer are MOCK-ONLY (false affordance).** The
  four reaction toggles are backed by component-local `useState` and never persist; the „Évforduló ·
  1 hónap" anniversary card and „Memoir archive · 17 darab" footer have no backend at all. Rather than
  show dead affordances on a real generated memoir, `MemoirPage` renders all three only when `mode ===
  'mock'` (the W1 „Elfogad/Hangoljuk" precedent, §9 decision k). **Follow-up filed:** persisted memoir
  reactions as a companion signal (the controller files the bd issue at close-out); the anniversary
  card + archive are a deferred epic (spec §1).
- **(p) Two heartbeat windows v1 — explicit config records, not a dynamic list.** `midday` (kind
  `nudge`, `0 30 12 * * *`) + `evening` (kind `closing`, `0 30 20 * * *`) under
  `mezo.proactive.heartbeat.*`. The roadmap's "config window list" is satisfied by two named crons —
  a dynamic window list would need programmatic scheduling for zero current benefit (YAGNI); adding
  a third window is a §7 recipe.
- **(q) Briefing overlap-dedupe is prompt-level.** The gather injects today's persisted briefing
  body under `MAI BRIEFING (ne ismételd):` and the prompt forbids repeating it — deterministic,
  zero infra. If today has no briefing the block is simply absent.
- **(r) The lazy path derives window fire-times from the SAME job crons (`CronExpression`), only
  for TODAY, only the LATEST elapsed window; no staleness/regen.** One source of truth for the
  schedule; a past date never lazy-generates (a heartbeat is grounded in the day's live state —
  generating yesterday's "midday" note today would be fiction); a missed window is simply absent
  once the next window's note exists (the GET serves the day's newest). No `refreshIfStale`, no
  cap — the next window is hours away (the W1/W2 YAGNI reasoning at intra-day cadence).
- **(s) The heartbeat emptiness gate reuses `briefing.past-days`.** One knob answers "does the
  companion have narrative memory of Daniel yet" for both daily surfaces; a heartbeat with zero
  `daily_summary` grounding would be generic filler (the honest-absence rule). The snapshot itself
  always renders (`nincs adat` absences), so the gate must come from the summaries.
- **(t) The metric catalog is 3 deterministic keys, each window-avg/count vs the prior 7 days.**
  `weight_trend` (avg `weight_log.weightKg`), `sleep_avg` (avg `sleep_log.durationH`),
  `training_volume` (count of done gym instances via `findDoneInstanceDates` — sport excluded v1).
  Direction is epsilon-banded (`weight-epsilon-kg` 0.1, `sleep-epsilon-h` 0.25, volume integer
  compare). The catalog is deliberately cut so EVERY prediction is machine-checkable — there is no
  L2/soft-outcome judging in v1 (the spec's "deterministically where possible" — here, everywhere).
  The model may only pick a `metricKey` from this list; an off-catalog value drops the row.
- **(u) Window semantics + the deviation from the spec table.** Every prediction's window is
  CODE-set to its generation week `[weekStart, weekStart+6]`; the daily validation evaluates
  `pending` rows with `valid_to < today`. **No data in either compare window ⇒ the row stays
  `pending`** (skipped, honest). The `prediction` table adds two columns the spec §3 row didn't
  name: `week_start` (the idempotence probe — a week generates once) and `expected_direction` (the
  machine-checkable claim — without a direction the deterministic close has nothing to judge against).
- **(v) Grounding gate + drop-vs-null rules.** The emptiness gate is **zero CONFIRMED patterns**
  (only confirmed patterns ground a forecast — a `proposed` pattern does NOT count). A row whose
  `patternIndex` is out of range keeps `confidence = null` („tanulom") rather than being dropped
  (the claim can still be validated); but an invalid `metricKey`/`expectedDirection` DROPS the row
  (an unvalidatable claim is fiction). Confidence is always COPIED from the pattern, never invented —
  and statistical patterns carry no confidence, so most v1 predictions read „tanulom".
- **(w) The read is a LIST — `200 []`, never a 404.** Unlike the single-resource briefing/weekly/
  memoir/heartbeat surfaces (404 = honest absence), predictions is a collection: the honest empty
  state is an empty array, so the FE renders its still-learning null-state from `[]` rather than a
  caught 404. The lazy path generates the CURRENT week on an empty-week GET (the weekly-suggestion
  idiom); once the Monday cron has run it is a pure miss-recovery. The FE derives the accuracy header
  from CLOSED rows only (absent when none closed) — never the mock's hard-coded literal in live mode.
- **(x) Propose trigger = BOTH cron + button.** A weekly `ExperimentJob.runPropose` (Mon 06:45) AND
  the "+ Új kísérlet javasol Mezo" button (`POST …/propose`) — the button is REAL in live mode (the
  W1/W2 false-affordance lesson, inverted: rather than hide a dead button, wire it). Mock keeps it
  inert (the seed has no propose backend).
- **(y) Propose cap on OPEN experiments.** `propose` is a no-op when the user already has `max-open`
  (default 3) `proposed`+`active` rows — bounds both the cron and the button so the tab never floods.
  The grounding gate is the same as predictions: zero CONFIRMED patterns ⇒ no proposals.
- **(z) Lifecycle + the write-path guards.** `proposed` →(accept)→ `active` (start_date=today) |
  →(dismiss)→ `dismissed`; `active` →(outcome cron)→ `completed`. `decide` fetches owned-or-404, then
  **guards the proposed state — re-deciding a non-proposed row is a 409** (`PROACTIVE_EXPERIMENT_NOT_PROPOSED`);
  an invalid decision value is a 400. `dismissed` rows are excluded from the list read (gone from the
  UI, status preserved). `total_days` is model-proposed, clamped to `[min-days, max-days]`.
- **(aa) Outcome eval + the nullable `outcome_good`.** The daily run evaluates `active` windows that
  have closed (`start + total <= today`) via the shared `MetricWindowEvaluator` (experiment window vs
  the equal baseline before start). A direction match ⇒ `outcome_good=true` else `false`; **no data
  in a compare window ⇒ `completed` with `outcome_good=null`** (honest "Nem értékelhető" — a boolean
  column made nullable precisely to represent an inconclusive-but-terminal experiment). The FE maps
  null → undefined and renders three distinct chips.
- **(bb) `MetricWindowEvaluator` is the DRY seam between P1 and P2.** The weight/sleep/training
  window-vs-baseline comparison (avg/count, epsilon-banded direction, code-formatted text) was
  **extracted from `PredictionValidationService` into `MetricWindowEvaluator`** — P1 validation
  (baseline = the 7 days before the window) and P2 outcome (baseline = the equal span before start)
  both call `evaluate(userId, metricKey, winFrom, winTo, baseFrom, baseTo)`, differing only in the
  bounds they pass. The extraction is behavior-preserving; `PredictionValidationIT` re-runs green
  against it (the regression guard). The epsilon config still lives under `mezo.proactive.prediction.*`.

**Workout challenges (HBWI — a separate epic on the proactive template):**

- **(cc) Backend lives in `feature/proactive`, the FE hook in `data/train`.** Challenges are the
  "companion speaks first" surface for workouts, so the backend follows every other proactive surface
  (`/api/proactive/challenge`, `CompanionLlm` generation, the dual switch gate); the FE hook goes in
  the CONSUMING feature's data folder (`data/train/challengeHooks.ts`), the briefing-hook precedent.
  The proactive→train dependency already exists (the evaluator reads Train repositories), never the
  reverse.
- **(dd) Identity = `(created_by, template_session_id, workout_date)`; target = the TEMPLATE
  `exercise_id`; generated LAZILY on the prep-read (option B), `date == today` only, NO generation
  cron.** This preserves the pre-start UX (challenges visible before „Kezdjük el"). Because starting a
  workout does NOT copy exercises into the instance — logged `exercise_set`s FK straight back to the
  template exercise (`WorkoutService.java:204`) — a challenge storing the template exercise id needs
  **no template→instance mapping** at evaluation. `workout_date` scopes a re-used weekly template to
  one day. The idempotence probe is "any live row for this (user, session, date)?" (not a unique
  index — several challenges per session/day).
- **(ee) Structured targets, not free prose.** Deterministic set-level eval needs typed numbers, so
  the entity carries `target_weight_kg?/target_reps?/target_sets?/target_rir?` and the display string
  (`target`, `typeLabel`) is DERIVED in code (`ChallengeDisplay`). A proposal missing its type's
  required fields (PR: weight+reps · Depth: `targetRir` · Volume: `targetSets`) is **dropped** as
  unevaluatable (the P1 "drop unvalidatable rows" precedent). Type catalog **v1 = PR/Depth/Volume;
  Tempo deferred** (no tempo is logged, so it can't be honestly evaluated).
- **(ff) A NEW set-level `ChallengeOutcomeEvaluator` — NOT the shared `MetricWindowEvaluator`.** A
  challenge is judged from `exercise_set` rows (weight/reps/rir/count), not a daily metric window, so
  the P1/P2 evaluator does not apply. Only `accepted` challenges are ever evaluated; **no logged sets
  ⇒ `inconclusive`** (`outcome_good null`), never a fabricated miss (the honest-absence gate). Trigger
  is **lazy on the GET read + the daily `ChallengeJob` backstop** (no `feature/train` → `feature/proactive`
  coupling).
- **(gg) No `propose` endpoint (unlike experiments).** Challenges are generated implicitly by the
  prep-read GET; there is no "+ propose more" affordance in the workout UI, and the only cron is the
  outcome backstop (`ChallengeJob.runOutcome`) — no propose cron. Confidence is pattern-copied or null
  („tanulom", never fabricated); the `tools` transparency chips are hidden in live (kept in mock) — the
  W1/W2 false-affordance lesson.
- **(hh) The challenge mapper's derived helpers live OUTSIDE the `@Mapper`.** `typeLabel`/`target` are
  computed by `ChallengeDisplay` **static** methods referenced via `@Mapping(expression=…)`. A
  `String→String` default method inside the `@Mapper` interface would be auto-selected by MapStruct as
  an implicit converter for EVERY String property and corrupt the sibling responses — hence the helpers
  are a separate class.

- **Epic complete — only H2 Web Push deferred.** All eight slices shipped
  (B1.1→B1.2→W1→W2→H1→P1→P2). **H2 (Web Push)** stays deferred — pure delivery infra (VAPID
  SealedSecret on k3s, `push_subscription`, the SW push handler); the content it would push (heartbeat,
  briefing-ready) already exists, so it can slide indefinitely. `PHASE3_TAB_IDS` is now empty. The
  D′ score constants (`SLEEP_TARGET_H`/`KCAL_BAND`/`WEIGHT_RATE_EPSILON`) were **not** promoted to
  backend config (still FE consts — a small follow-up bd issue, see [insights.md §9](insights.md)).

## 10. Key files

**API contract**
- `api/feature/proactive/proactive.yml` — 10 endpoints (briefing + weekly-suggestion + memoir +
  heartbeat + prediction + experiment list/propose/decide + **challenge list/decide**) + 12 schemas
  (…+ `ExperimentResponse`, `ExperimentDecisionRequest`, **`ChallengeResponse`, `ChallengeRef`,
  `ChallengeDecisionRequest`**) (tag `Proactive` → `ProactiveApi`); registered in `api/generate/merge.yml`
  → merged `api/openapi.yml` → `api.gen.ts` + `io.mrkuhne.mezo.api.*`.

**Backend — controller / services / mapper**
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/controller/ProactiveController.java` — `implements ProactiveApi` (…+ `getPredictions` + `getExperiments`/`proposeExperiments`/`decideExperiment` + **`getChallenges`/`decideChallenge`**), JWT ownership, dual-switch-gated.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ProactiveBriefingService.java` — the briefing read path (persisted row · `refreshIfStale` · lazy-generate; null ⇒ 404).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ProactiveWeeklySuggestionService.java` — **W1** the weekly read path (ISO-Monday week · persisted row or lazy-generate; null ⇒ 404).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ProactiveMemoirService.java` — **W2** the memoir read path (latest row · else lazy-generate the LAST COMPLETED week; null ⇒ 404).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ProactiveHeartbeatService.java` — **H1** the heartbeat read path (day's latest note · lazy latest-elapsed-window via `CronExpression`; null ⇒ 404).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ProactivePredictionService.java` — **P1** the prediction list read path (all live rows · lazy current-week; `[]` = honest, never 404).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ProactiveExperimentService.java` — **P2** the experiment read + WRITE path (list · lazy propose · `decide` with the 404/409 guards · `propose`).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/BriefingJob.java` — **B1.2** dawn `@Scheduled` cron (today-only, per-user isolation, three-switch-gated).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/WeeklySuggestionJob.java` — **W1** Monday-06:00 `@Scheduled` cron (current-week only, per-user isolation, three-switch-gated).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/MemoirJob.java` — **W2** Sunday-19:00 `@Scheduled` cron (the week ending that Sunday, per-user isolation, three-switch-gated).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/HeartbeatJob.java` — **H1** two `@Scheduled` window crons (midday nudge + evening closing, per-user isolation, three-switch-gated).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/PredictionJob.java` — **P1** two `@Scheduled` crons (Mon-06:30 `runWeekly` generate + daily-06:15 `runValidation`, per-user isolation, three-switch-gated).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/PredictionValidationService.java` — **P1** deterministic window-close validation, now delegating to `MetricWindowEvaluator`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/MetricWindowEvaluator.java` — **P1+P2 SHARED** pure-code metric window-vs-baseline verdict (weight/sleep/training, epsilon-banded, code-formatted; no-data ⇒ null).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ExperimentJob.java` — **P2** two `@Scheduled` crons (Mon-06:45 `runPropose` + daily-06:20 `runOutcome`, per-user isolation, three-switch-gated).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ExperimentOutcomeService.java` — **P2** deterministic outcome eval (active window-closed → completed via `MetricWindowEvaluator`; null = inconclusive).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ProactiveChallengeService.java` — **HBWI** the challenge read + WRITE path (`getChallenges` = list · lazy generate (`date==today`) · lazy resolve accepted; `decide` with the 404/409 guards; dismissed excluded).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ChallengeGenerator.java` — **HBWI** lazy-on-prep smart-tier generator: pure-code `gather` (template exercises + per-exercise history, grounding-gate drop) + one `CompanionLlm.completeSmart` + strict-JSON parse + type-required-target validation + pattern-copied/null confidence + model-selected refs + `max-per-workout` cap; `CHALLENGE_MARKER = "EDZES-KIHIVAS-FELADAT"` + `PROMPT`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ChallengeOutcomeEvaluator.java` — **HBWI** NEW set-level LLM-free evaluator (`evaluate` one accepted challenge / `evaluateDue` all accepted whose day passed): reads `exercise_set` rows FK'd to the template exercise → PR/Depth/Volume hit/miss; no logged sets ⇒ inconclusive (`outcome_good null`).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ChallengeJob.java` — **HBWI** single `@Scheduled` outcome-backstop cron (daily 06:25 `runOutcome` → `evaluateDue`, per-user isolation, three-switch-gated `CHALLENGE_JOB_SWITCH`); NO propose cron.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/BriefingGenerator.java` — the spine: pure-code `gather` + one `CompanionLlm.complete` + strict-JSON parse + ref resolution; `BRIEFING_MARKER` + `PROMPT` + `SNAPSHOT_CANDIDATES`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/WeeklySuggestionGenerator.java` — **W1** pure-code `gather` (snapshot + facts + prior-week summaries + patterns) + one `CompanionLlm.completeSmart` + plain-prose output; `WEEKLY_SUGGESTION_MARKER` + `PROMPT`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/MemoirGenerator.java` — **W2** pure-code `gather` (the week's OWN summaries + facts + patterns + numbered anchor candidates) + one `CompanionLlm.completeSmart` + strict-JSON `{title, body, anchorIndexes}` parse + `resolveAnchors` (bounds-checked, deduped, model-selected); `MEMOIR_MARKER` + `PROMPT` + the `MemoirGather` record.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/HeartbeatGenerator.java` — **H1** pure-code `gather` (snapshot + facts + latest summary + `MAI BRIEFING` dedupe block + `ABLAK:` instruction) + one **cheap-tier** `CompanionLlm.complete` + flat prose; `HEARTBEAT_MARKER` + `PROMPT`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/PredictionGenerator.java` — **P1** pure-code `gather` (snapshot + facts + numbered CONFIRMED-pattern candidates + metric catalog) + one `CompanionLlm.completeSmart` + strict-JSON `{predictions:[…]}` parse + code-set windows + `resolveConfidence` (pattern-copied, null-safe) + catalog/enum validation + `max-per-week` cap; `PREDICTION_MARKER` + `PROMPT` + `VALID_METRICS`/`VALID_DIRECTIONS`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ExperimentProposalGenerator.java` — **P2** pure-code `gather` (snapshot + facts + CONFIRMED-pattern candidates + catalog) + one `completeSmart` + strict-JSON `{experiments:[…]}` parse + `clampDays` + catalog/enum validation + open-cap gate; `EXPERIMENT_MARKER` + `PROMPT`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/mapper/ProactiveMapper.java` — entity → generated `api.dto` (…+ `toPredictionResponse` + `toExperimentResponse` + **`toChallengeResponse`** (`exerciseName`→`exercise`, `refs.refs()`→`List<ChallengeRef>`, derived `typeLabel`/`target` via `@Mapping(expression=…)`); Instant → UTC OffsetDateTime, BigDecimal → Double default methods).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/mapper/ChallengeDisplay.java` — **HBWI** the static `typeLabel`/`target` derivation helpers, deliberately OUTSIDE the `@Mapper` interface (§9 gotcha hh — a String→String default method there would be auto-selected as an implicit converter for every String property).

**Backend — entity / repo / config**
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/{BriefingEntity,BriefingContentEnvelope}.java` — the owned entity + typed jsonb envelope (`Ref` nested).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/WeeklySuggestionEntity.java` — **W1** the owned entity (flat `weekStart`/`prose`/`generatedAt`, no jsonb).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/{MemoirEntity,MemoirAnchorsEnvelope}.java` — **W2** the owned entity (`weekStart`/`title`/`body`/`generatedAt` + `anchors` typed jsonb) + the `MemoirAnchorsEnvelope{List<Anchor(kind,label)>}` record.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/HeartbeatNoteEntity.java` — **H1** the owned entity (flat `noteDate`/`windowKey`/`kind`/`content`/`generatedAt`) + the window/kind constants.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/PredictionEntity.java` — **P1** the owned entity (flat `weekStart`/`title`/`basis`/`confidence?`/`metricKey`/`expectedDirection`/`validFrom`/`validTo`/`status`/`actual?`/`generatedAt`) + the status/direction/metric constants (metric+direction SHARED).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/ExperimentEntity.java` — **P2** the owned entity (flat `title`/`hypothesis`/`status`(@Pattern)/`metricKey`/`expectedDirection`(@Pattern)/`startDate?`/`totalDays`/`outcome?`/`outcomeGood?`/`generatedAt`) + the lifecycle constants.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/{ChallengeEntity,ChallengeRefsEnvelope}.java` — **HBWI** the owned entity (`templateSessionId`/`workoutDate`/`exerciseId`/`exerciseName`/`type`/`status`/`risk`/`title`/`why`/`glory`/structured targets/`confidence?`/`outcome?`/`outcomeGood?`/`generatedAt` + `refs` typed jsonb) + the `ChallengeRefsEnvelope{List<Ref(kind,label)>}` record; carries the `TYPE_*`/`STATUS_*`/`RISK_*` constants.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/repository/BriefingRepository.java` — `findByCreatedByAndBriefingDate` (owner + soft-delete scoped).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/repository/WeeklySuggestionRepository.java` — **W1** `findByCreatedByAndWeekStart` (owner + soft-delete scoped).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/repository/MemoirRepository.java` — **W2** `findByCreatedByAndWeekStart` + `findFirstByCreatedByOrderByWeekStartDesc` (owner + soft-delete scoped).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/repository/HeartbeatNoteRepository.java` — **H1** `findByCreatedByAndNoteDateAndWindowKey` + `findFirstByCreatedByAndNoteDateOrderByGeneratedAtDesc` (owner + soft-delete scoped).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/repository/PredictionRepository.java` — **P1** `existsByCreatedByAndWeekStart` + `findByCreatedByOrderByValidFromDescGeneratedAtDesc` + `findByCreatedByAndStatusAndValidToBefore` (owner + soft-delete scoped).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/repository/ExperimentRepository.java` — **P2** `findByIdAndCreatedByAndDeletedFalse` + `findByCreatedByAndStatusInOrderByGeneratedAtDesc` + `findByCreatedByAndStatusOrderByGeneratedAtDesc` + `countByCreatedByAndStatusIn` (owner + soft-delete scoped).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/repository/ChallengeRepository.java` — **HBWI** `findByCreatedByAndTemplateSessionIdAndWorkoutDate…` (the session/day list) + `findByIdAndCreatedBy…` (decide) + the accepted-due finder for `evaluateDue` (owner + soft-delete scoped).
- `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/weight/repository/WeightLogRepository.java` — **P1** added `findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc` (the validation window read; sleep already had the sibling).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/config/ProactiveProperties.java` — `mezo.proactive.{briefing.*, weekly.cron, memoir.cron, heartbeat.*, prediction.*, experiment.{propose-cron,outcome-cron,max-open,min-days,max-days}, challenge.{outcome-cron,max-per-workout}}` (@Validated, nested records).
- `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/repository/SleepLogRepository.java` — **B1.2** `existsBy…DateGreaterThanEqualAndCreatedAtAfter` staleness probe (plain finder, no proactive dependency).
- `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` — `PROACTIVE_SWITCH` + the seven job switches (`BRIEFING`/`WEEKLY_SUGGESTION`/`MEMOIR`/`HEARTBEAT`/`PREDICTION`/`EXPERIMENT`/**`CHALLENGE`**`_JOB_SWITCH` = `mezo.techcore.cron.challenge-job.enabled`) (+ the companion `COMPANION_SWITCH` they pair with).
- `backend/src/main/resources/application.yml` — `mezo.feature.proactive.enabled` + `mezo.proactive.{…, experiment.*, challenge.{outcome-cron: "0 25 6 * * *", max-per-workout: 3}}` + `mezo.techcore.cron.{…,experiment-job,challenge-job}.enabled`.
- `backend/src/main/resources/messages.properties` — **P2** `PROACTIVE_EXPERIMENT_NOT_FOUND` (404) + `PROACTIVE_EXPERIMENT_NOT_PROPOSED` (409); **HBWI** `PROACTIVE_CHALLENGE_NOT_FOUND` (404) + `PROACTIVE_CHALLENGE_NOT_PROPOSED` (409).

**Backend — LLM fake (companion side, additive)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java` — the seven mirrors + sentinels (briefing/weekly/memoir/heartbeat/prediction/experiment + **`CHALLENGE_MARKER_MIRROR = "EDZES-KIHIVAS-FELADAT"` + `[fake-challenge:{…}]`** GREEDY/DOTALL) (literals; §9 gotcha a) — the challenge default returns a valid proposals payload planted via a check-in note.

**Frontend — Today consumer (B1.2)**
- `frontend/src/data/today/briefingApi.ts` — `briefingApi.get` + `toBriefing` (wire→`Briefing`, no confidence).
- `frontend/src/data/today/briefingHooks.ts` — `useBriefing()` (dual-mode; mock null no-fetch, real GET or null on 404); re-exported by `data/hooks.ts`.
- `frontend/src/data/today/todayHooks.ts` — `useToday` composes `useBriefing` (`briefing`, `briefingDemo`); `frontend/src/features/today/{pages/TodayPage.tsx,components/BriefingCard.tsx}` — render + three-state label; `frontend/src/data/types.ts` — `Briefing.confidence?` optional.

**Frontend — Today companion-note consumer (H1)**
- `frontend/src/data/today/heartbeatApi.ts` — `heartbeatApi.get(date)` + `toCompanionNote` (wire→`CompanionNote{window, kind, text}`).
- `frontend/src/data/today/heartbeatHooks.ts` — `useCompanionNote()` (dual-mode; mock null no-fetch, real GET or null on 404); re-exported by `data/hooks.ts`.
- `frontend/src/features/today/components/CompanionNoteCard.tsx` — the in-day note card (nudge/closing eyebrow copy); rendered by `TodayPage.tsx` after the check-in strip only when a note exists.
- `frontend/src/data/types.ts` — the `CompanionNote` interface.

**Frontend — Train ActiveWorkoutPage consumer (HBWI)**
- `frontend/src/data/train/challengeApi.ts` — `challengeApi.{list,decide}` + `toChallenge` (wire→FE `Challenge`; `confidence ?? null`, `outcomeGood: null→undefined`).
- `frontend/src/data/train/challengeHooks.ts` — `useChallenges(templateSessionId|null, date)` (dual-mode: mock seed / real GET, disabled until a `templateSessionId` exists) + `useChallengeActions()` (`useMutation` accept/dismiss, invalidates `['challenges', templateSessionId, date]`); both re-exported by `data/hooks.ts`.
- `frontend/src/features/train/ActiveWorkoutPage.tsx` — the prep carousel feeds `useChallenges(todaySession.templateSessionId, localToday)` (not `W.challenges`); `accepted` map + `decide()` derive from the server `status` in live (local toggle in mock).
- `frontend/src/features/train/components/{ChallengesCarousel,ChallengeCard}.tsx` — honest render: „tanulom" on null confidence, `tools` chips hidden in live, `hit/miss/inconclusive` outcome chip + line with the accept/skip row hidden.
- `frontend/src/data/types.ts` — `Challenge` gained `confidence?: number | null`, `status`, the structured target fields, `outcome?`/`outcomeGood?`.

**Frontend — Insights Experiments consumer (P2)**
- `frontend/src/data/insights/experimentsApi.ts` — `experimentsApi.{list,decide,propose}` + `toExperiment` (wire→FE; `day` derived client-side, `outcomeGood: null→undefined`).
- `frontend/src/data/insights/experimentsHooks.ts` — `useExperiments()` (list; `[]`→null-state) + `useExperimentActions()` (`useMutation` decide/propose + `invalidateQueries(['experiments'])`); both re-exported by `data/hooks.ts`.
- `frontend/src/features/insights/pages/ExperimentsPage.tsx` — ghost dropped; proposed (Elfogadom/Elvetem) / active (progress) / completed (outcome chips) rows + a real propose CTA, else the honest null-state.
- `frontend/src/features/insights/pages/tabs.ts` — `PHASE3_TAB_IDS` now **EMPTY** (Experiments un-ghosted at P2 — all 7 tabs real).
- `frontend/src/data/types.ts` — `ExperimentStatus` gained `proposed`/`dismissed`; `Experiment.outcomeGood?` documents the inconclusive case.

**Frontend — Insights Predictions consumer (P1)**
- `frontend/src/data/insights/predictionsApi.ts` — `predictionsApi.list()` + `toPrediction` (wire→FE `Prediction`; `confidence ?? null`; the window label + accuracy header derive client-side via `Intl` HU short-month).
- `frontend/src/data/insights/predictionsHooks.ts` — `usePredictions(): PredictionsView` (`['predictions']`; mock = seed no-fetch, real = list or `[]`); re-exported by `data/hooks.ts`.
- `frontend/src/features/insights/pages/PredictionsPage.tsx` — ghost dropped; renders the real cards („tanulom" on null confidence, `✗ Missed`, derived accuracy header), else the honest still-learning null-state; mock keeps the seed + literal header.
- `frontend/src/features/insights/pages/tabs.ts` — `PHASE3_TAB_IDS = {experiments}` (predictions un-ghosted at P1).
- `frontend/src/data/types.ts` — `Prediction.confidence` went **`number | null`** + the `missed` status.

**Frontend — Insights Weekly consumer (W1)**
- `frontend/src/data/insights/weeklySuggestionApi.ts` — `weeklySuggestionApi.get(date)` (wire → `w.prose` string).
- `frontend/src/data/insights/weeklyHooks.ts` — `useWeekly().weeklySuggestion` real-only `useQuery` (`['weeklySuggestion', start]`, `enabled:!mock`, `retry:false`, 404→null); the one bare `useQuery` in the file.
- `frontend/src/features/insights/pages/WeeklyPage.tsx` — renders the prose or the honest placeholder; „Elfogad/Hangoljuk" hidden when `mode !== 'mock'` (§9 decision k).

**Frontend — Insights Memoir consumer (W2)**
- `frontend/src/data/insights/memoirApi.ts` — `memoirApi.latest()` + `toMemoir` (wire → FE `Memoir`; the `Hét N · …` week label derives client-side via `isoWeekNumber`/`deriveWeekTitle`).
- `frontend/src/data/insights/memoirHooks.ts` — `useMemoir(): MemoirView` (`['memoir']`; mock = seed + anniversaryNote no-fetch, real GET or null on 404, note null); re-exported by `data/hooks.ts`.
- `frontend/src/features/insights/pages/MemoirPage.tsx` — guard dropped; renders the real memoir card + anchors, else the honest „készül" null-state; reactions/anniversary/archive gated on `mode === 'mock'` (§9 decision o).
- `frontend/src/features/insights/pages/tabs.ts` — `PHASE3_TAB_IDS = {predictions, experiments}` (memoir un-ghosted at W2).

**Backend — migrations**
- `backend/src/main/resources/db/changelog/1.0.0/script/{…,202607071900_mezo-h4wp.7_create_prediction,202607072000_mezo-h4wp.8_create_experiment}.sql` (all in `1.0.0_master.yml`).

**Backend — tests**
- `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/{…P1 classes…,ExperimentPersistenceIT,ExperimentProposalGeneratorIT,ExperimentOutcomeIT,ExperimentJobIT,ExperimentJobSwitchOffIT,ProactiveApiExperimentIT}.java`
- `backend/src/test/java/io/mrkuhne/mezo/support/populator/{…,PredictionPopulator,ExperimentPopulator}.java` + `support/ResetDatabase.java` (`…prediction, experiment` in the TRUNCATE list).
- FE: `…P1 tests…`, `frontend/src/data/insights/experimentsHooks.test.tsx`, `frontend/src/features/insights/pages/{ExperimentsPage.test.tsx,insights.nav.test.tsx}` (`InsightsSubNav.test.tsx` deleted with the component, compact-header redesign `mezo-ugqb`), `frontend/src/test/msw/handlers.ts` (four defaults 404 + prediction/experiment `200 []` + experiment POST handlers).

**Docs (link, don't duplicate)**
- Design spec: [`docs/superpowers/specs/2026-07-06-proactive-layer-design.md`](../superpowers/specs/2026-07-06-proactive-layer-design.md)
- Roadmap (8 slices): [`docs/superpowers/plans/2026-07-06-proactive-roadmap.md`](../superpowers/plans/2026-07-06-proactive-roadmap.md)
- Companion stack it builds on: [`companion.md`](companion.md)
- Roadmap/milestone log: [`docs/milestones/roadmap.md`](../milestones/roadmap.md)
