---
title: Proactive layer (briefing, weekly prose, heartbeat, predictions)
type: feature-domain
status: in-progress
updated: 2026-07-07
tags: [proactive, briefing, ai, llm, backend, phase-4]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/feature/proactive
  - api/feature/proactive/proactive.yml
  - backend/src/main/resources/db/changelog/1.0.0/script/202607061100_mezo-h4wp.1_create_briefing.sql
  - backend/src/main/resources/db/changelog/1.0.0/script/202607071200_mezo-h4wp.3_create_weekly_suggestion.sql
  - backend/src/main/resources/db/changelog/1.0.0/script/202607071500_mezo-h4wp.4_create_memoir.sql
  - backend/src/main/resources/db/changelog/1.0.0/script/202607071800_mezo-h4wp.5_create_heartbeat_note.sql
  - backend/src/main/resources/db/changelog/1.0.0/script/202607071900_mezo-h4wp.7_create_prediction.sql
related: [companion, today, insights, _platform-api-backend]
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
deterministic validation, un-ghosting the Insights Predictions tab.**

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
  (NFR-M-4) — the briefing split at the smart tier.
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
  code, prose = pure LLM (NFR-M-4) — the briefing structure at the weekly-suggestion tier.
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
| Experiments | ⛔ later slice | P2 — see the roadmap. |

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

**Switch-gating.** `ProactiveController`, `ProactiveBriefingService`, `ProactiveWeeklySuggestionService`,
`ProactiveMemoirService`, `ProactiveHeartbeatService`, `ProactivePredictionService`, `BriefingGenerator`,
`WeeklySuggestionGenerator`, `MemoirGenerator`, `HeartbeatGenerator`, `PredictionGenerator`,
`PredictionValidationService` (and the mapper via the services) are all
`@ConditionalOnProperty(name = {COMPANION_SWITCH, PROACTIVE_SWITCH}, havingValue = "true")` — **both**
must be `true`. Either off ⇒ no proactive beans ⇒ the whole `/api/proactive/*` surface 404s (there's
no controller to route to). The five jobs (`BriefingJob`, `WeeklySuggestionJob`, `MemoirJob`,
`HeartbeatJob`, `PredictionJob`) each add a THIRD switch on top. The dual gate is structural, not a
runtime check (§9 gotcha b).

**Ownership.** `BriefingEntity` + `WeeklySuggestionEntity` + `MemoirEntity` + `HeartbeatNoteEntity` + `PredictionEntity` all `extend OwnedEntity`
(soft-delete via `@SQLDelete`/`@SQLRestriction`); `created_by` is stamped from `CurrentUserId.get()`
server-side, the finders (`findByCreatedByAndBriefingDate` / `findByCreatedByAndWeekStart` /
`findByCreatedByAndWeekStart` + `findFirstByCreatedByOrderByWeekStartDesc` for memoir) are owner +
soft-delete scoped. Standard auth spine ([`_platform-api-backend.md`](_platform-api-backend.md); the
companion precedent).

## 4. Data model & API

### Backend tables (B1.1 + B1.2 + W1 + W2 + H1 + P1, 🟢)

Migrations `202607061100_mezo-h4wp.1_create_briefing.sql` + `202607070900_mezo-h4wp.2_briefing_regen_count.sql`
+ `202607071200_mezo-h4wp.3_create_weekly_suggestion.sql` + `202607071500_mezo-h4wp.4_create_memoir.sql`
+ `202607071800_mezo-h4wp.5_create_heartbeat_note.sql` + `202607071900_mezo-h4wp.7_create_prediction.sql`
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
`DIRECTION_UP`/`DOWN`/`STABLE`, `METRIC_WEIGHT_TREND`/`SLEEP_AVG`/`TRAINING_VOLUME`).

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

### Configuration

`config/ProactiveProperties.java` (`@Validated`, binds `mezo.proactive.*` — nested `briefing` +
`weekly` + `memoir` + `heartbeat` + `prediction` records):

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

Plus the five techcore job switches, each the THIRD `@ConditionalOnProperty` on its job bean (on top
of the companion+proactive dual gate; off ⇒ the cron bean does not exist, the lazy GET still serves):
**`mezo.techcore.cron.briefing-job.enabled`** (`BRIEFING_JOB_SWITCH`),
**`mezo.techcore.cron.weekly-suggestion-job.enabled`** (`WEEKLY_SUGGESTION_JOB_SWITCH`),
**`mezo.techcore.cron.memoir-job.enabled`** (`MEMOIR_JOB_SWITCH`),
**`mezo.techcore.cron.heartbeat-job.enabled`** (`HEARTBEAT_JOB_SWITCH` — one switch for BOTH
windows), and **`mezo.techcore.cron.prediction-job.enabled`** (`PREDICTION_JOB_SWITCH` — one switch
for BOTH the weekly generation and the daily validation), all default `true`.

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
grounding gate) via `completeSmart`; **P1's `PredictionValidationService`** additionally reads
`WeightLogRepository` / `SleepLogRepository` / `WorkoutSessionRepository.findDoneInstanceDates`
(biometrics + train, read-only) — the first proactive reach beyond companion, still strictly one-way.
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
- **New proactive surface (P2):** add a sibling `*Generator` + table + `*.yml` fragment in
  `feature/proactive/`, gated on the same dual switch. Smart-tier narratives reuse W1/W2/P1's gather
  idiom (`CompanionLlm.completeSmart`); a plain-prose surface follows `weekly_suggestion` (flat
  columns), a structured one follows `briefing`/`memoir` (typed jsonb envelope).
- **Prompt / marker tuning:** the prompts are `BriefingGenerator.PROMPT` /
  `WeeklySuggestionGenerator.PROMPT` / `MemoirGenerator.PROMPT` / `HeartbeatGenerator.PROMPT` /
  `PredictionGenerator.PROMPT` (keep each `*_MARKER` prefix + its `FakeCompanionLlm` literal mirror
  in sync — §9 gotcha a); briefing ref candidates are `SNAPSHOT_CANDIDATES` + the per-summary
  `Memory` refs in `gather` (the weekly suggestion and the heartbeat carry no refs; the prediction
  carries pattern candidates but resolves them to CONFIDENCE, not refs).
- **Never add `confidence`/`tone`** back to the envelope without a real computed source (§9 gotcha c).

## 8. Testing

Integration-first, over the fixed `mezo_test` DB (or Testcontainers); the fake LLM's
`[fake-briefing:{…}]` + `[fake-weekly:…]` + `[fake-memoir:{…}]` + `[fake-heartbeat:…]` +
`[fake-prediction:{…}]` sentinels script deterministic answers. **85 tests across 26 classes** — the
B1.1 five, three B1.2 classes, the W1 additions, the W2 additions, the H1 additions, plus the P1
additions:

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
the honest „készül" placeholder, not demo fiction); `InsightsSubNav.test.tsx` + `insights.nav.test.tsx`
flip Memoir from hidden to visible (5 real-mode tabs incl. Memoir). **H1:**
`data/today/heartbeatHooks.test.tsx` (3) — maps the wire note to `CompanionNote`; null on the
default 404; mock null without fetching (byte-parity);
`features/today/components/CompanionNoteCard.test.tsx` (2) — nudge/closing eyebrow copy. **P1:**
`data/insights/predictionsHooks.test.tsx` (3) — maps wire rows preserving null confidence + the
derived window label; `[]` on the default empty array; mock seed without fetching;
`features/insights/pages/PredictionsPage.test.tsx` gains a real-mode describe (real cards + „tanulom"
on null confidence + derived accuracy header, no `hamarosan`; empty array → the honest null-state);
`InsightsSubNav.test.tsx` + `insights.nav.test.tsx` flip Predictions from hidden to visible. MSW
defaults: `/api/proactive/briefing`, `/api/proactive/weekly-suggestion`, `/api/proactive/memoir`,
`/api/proactive/heartbeat` return 404, and **`/api/proactive/prediction` returns `200 []`** (a list
endpoint's honest default is an empty array, not a 404).

Test infra: `support/populator/{BriefingPopulator,WeeklySuggestionPopulator,MemoirPopulator,HeartbeatNotePopulator,PredictionPopulator}.java`
(aggregate factories, all in the `AbstractIntegrationTest` `@Import` list) + `briefing`,
`weekly_suggestion`, `memoir`, `heartbeat_note` and `prediction` in the `ResetDatabase` TRUNCATE list.
Full backend + FE gates green at P1 close (BE clean-test green, FE both modes + build).

## 9. Decisions, gotchas & deferred

- **(a) All FIVE generator markers are literal-mirrored in `FakeCompanionLlm` — keep in sync.** The
  fake dispatches on `BRIEFING_MARKER_MIRROR` (`"REGGELI-BRIEFING-FELADAT"`), `WEEKLY_MARKER_MIRROR`
  (`"HETI-TERVJAVASLAT"`), `MEMOIR_MARKER_MIRROR` (`"HETI-MEMOIR-FELADAT"`), `HEARTBEAT_MARKER_MIRROR`
  (`"NAPKOZBENI-JEGYZET-FELADAT"`) and `PREDICTION_MARKER_MIRROR` (`"HETI-PREDIKCIO-FELADAT"`),
  **copies** of `BriefingGenerator.BRIEFING_MARKER` / `WeeklySuggestionGenerator.WEEKLY_SUGGESTION_MARKER` /
  `MemoirGenerator.MEMOIR_MARKER` / `HeartbeatGenerator.HEARTBEAT_MARKER` /
  `PredictionGenerator.PREDICTION_MARKER`, NOT imports — a `companion` → `proactive` import would
  create a package cycle that the frozen ArchUnit rule fails the build on. Each literal pair must be
  edited together (both carry a comment pointing at the other; drift fails the generator IT loudly).
  The markers are prefix-collision-checked (`FakeCompanionLlm` dispatches by `startsWith`): the three
  `HETI-*` markers (`TERVJAVASLAT`/`MEMOIR-FELADAT`/`PREDIKCIO-FELADAT`) all diverge by char 6, and
  `NAPKOZBENI-*` shares no prefix with any. **The prediction sentinel regex is GREEDY**
  (`\[fake-prediction:(\{.*\})]`) unlike the memoir's non-greedy one — the prediction payload
  `{"predictions":[{…}]}` nests objects, so a non-greedy match would stop at the FIRST inner `}` and
  truncate the JSON.
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
- **Deferred to H2/P2:** Web Push delivery (H2 — VAPID + `push_subscription` + SW handler), N=1
  experiments (P2 — the `proposed`/`active`/`completed` lifecycle + L2 accept) — later slices, see
  the roadmap. P1 delivers the first honest Insights forecast surface; the Experiments tab is the
  last remaining `PHASE3_TAB_IDS` ghost. The D′ score constants
  (`SLEEP_TARGET_H`/`KCAL_BAND`/`WEIGHT_RATE_EPSILON`) were **not** promoted to backend config in
  W1/W2 (still FE consts — a small follow-up bd issue, see [insights.md §9](insights.md)).

## 10. Key files

**API contract**
- `api/feature/proactive/proactive.yml` — 5 endpoints (briefing + weekly-suggestion + memoir +
  heartbeat + prediction) + 7 schemas (`BriefingResponse`, `BriefingRef`, `WeeklySuggestionResponse`,
  `MemoirResponse`, `MemoirAnchor`, `HeartbeatNoteResponse`, `PredictionResponse`) (tag `Proactive` →
  `ProactiveApi`); registered in `api/generate/merge.yml` → merged `api/openapi.yml` → `api.gen.ts` +
  `io.mrkuhne.mezo.api.*`.

**Backend — controller / services / mapper**
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/controller/ProactiveController.java` — `implements ProactiveApi` (`getBriefing` + `getWeeklySuggestion` + `getMemoir` + `getHeartbeat` + **`getPredictions`**), JWT ownership, dual-switch-gated.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ProactiveBriefingService.java` — the briefing read path (persisted row · `refreshIfStale` · lazy-generate; null ⇒ 404).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ProactiveWeeklySuggestionService.java` — **W1** the weekly read path (ISO-Monday week · persisted row or lazy-generate; null ⇒ 404).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ProactiveMemoirService.java` — **W2** the memoir read path (latest row · else lazy-generate the LAST COMPLETED week; null ⇒ 404).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ProactiveHeartbeatService.java` — **H1** the heartbeat read path (day's latest note · lazy latest-elapsed-window via `CronExpression`; null ⇒ 404).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ProactivePredictionService.java` — **P1** the prediction list read path (all live rows · lazy current-week; `[]` = honest, never 404).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/BriefingJob.java` — **B1.2** dawn `@Scheduled` cron (today-only, per-user isolation, three-switch-gated).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/WeeklySuggestionJob.java` — **W1** Monday-06:00 `@Scheduled` cron (current-week only, per-user isolation, three-switch-gated).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/MemoirJob.java` — **W2** Sunday-19:00 `@Scheduled` cron (the week ending that Sunday, per-user isolation, three-switch-gated).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/HeartbeatJob.java` — **H1** two `@Scheduled` window crons (midday nudge + evening closing, per-user isolation, three-switch-gated).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/PredictionJob.java` — **P1** two `@Scheduled` crons (Mon-06:30 `runWeekly` generate + daily-06:15 `runValidation`, per-user isolation, three-switch-gated).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/PredictionValidationService.java` — **P1** pure-code deterministic window-close validation (metric-vs-prior-7-days, no-data ⇒ pending).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/BriefingGenerator.java` — the spine: pure-code `gather` + one `CompanionLlm.complete` + strict-JSON parse + ref resolution; `BRIEFING_MARKER` + `PROMPT` + `SNAPSHOT_CANDIDATES`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/WeeklySuggestionGenerator.java` — **W1** pure-code `gather` (snapshot + facts + prior-week summaries + patterns) + one `CompanionLlm.completeSmart` + plain-prose output; `WEEKLY_SUGGESTION_MARKER` + `PROMPT`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/MemoirGenerator.java` — **W2** pure-code `gather` (the week's OWN summaries + facts + patterns + numbered anchor candidates) + one `CompanionLlm.completeSmart` + strict-JSON `{title, body, anchorIndexes}` parse + `resolveAnchors` (bounds-checked, deduped, model-selected); `MEMOIR_MARKER` + `PROMPT` + the `MemoirGather` record.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/HeartbeatGenerator.java` — **H1** pure-code `gather` (snapshot + facts + latest summary + `MAI BRIEFING` dedupe block + `ABLAK:` instruction) + one **cheap-tier** `CompanionLlm.complete` + flat prose; `HEARTBEAT_MARKER` + `PROMPT`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/PredictionGenerator.java` — **P1** pure-code `gather` (snapshot + facts + numbered CONFIRMED-pattern candidates + metric catalog) + one `CompanionLlm.completeSmart` + strict-JSON `{predictions:[…]}` parse + code-set windows + `resolveConfidence` (pattern-copied, null-safe) + catalog/enum validation + `max-per-week` cap; `PREDICTION_MARKER` + `PROMPT` + `VALID_METRICS`/`VALID_DIRECTIONS`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/mapper/ProactiveMapper.java` — entity → generated `api.dto` (`toBriefingResponse` + `toWeeklySuggestionResponse` + `toMemoirResponse`/`toMemoirAnchor` + `toHeartbeatResponse` (`noteDate`→`date`, `windowKey`→`window`) + **`toPredictionResponse`** (direct field map); Instant → UTC OffsetDateTime, **BigDecimal → Double** default methods).

**Backend — entity / repo / config**
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/{BriefingEntity,BriefingContentEnvelope}.java` — the owned entity + typed jsonb envelope (`Ref` nested).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/WeeklySuggestionEntity.java` — **W1** the owned entity (flat `weekStart`/`prose`/`generatedAt`, no jsonb).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/{MemoirEntity,MemoirAnchorsEnvelope}.java` — **W2** the owned entity (`weekStart`/`title`/`body`/`generatedAt` + `anchors` typed jsonb) + the `MemoirAnchorsEnvelope{List<Anchor(kind,label)>}` record.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/HeartbeatNoteEntity.java` — **H1** the owned entity (flat `noteDate`/`windowKey`/`kind`/`content`/`generatedAt`) + the window/kind constants.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/PredictionEntity.java` — **P1** the owned entity (flat `weekStart`/`title`/`basis`/`confidence?`/`metricKey`/`expectedDirection`/`validFrom`/`validTo`/`status`/`actual?`/`generatedAt`) + the status/direction/metric constants.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/repository/BriefingRepository.java` — `findByCreatedByAndBriefingDate` (owner + soft-delete scoped).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/repository/WeeklySuggestionRepository.java` — **W1** `findByCreatedByAndWeekStart` (owner + soft-delete scoped).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/repository/MemoirRepository.java` — **W2** `findByCreatedByAndWeekStart` + `findFirstByCreatedByOrderByWeekStartDesc` (owner + soft-delete scoped).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/repository/HeartbeatNoteRepository.java` — **H1** `findByCreatedByAndNoteDateAndWindowKey` + `findFirstByCreatedByAndNoteDateOrderByGeneratedAtDesc` (owner + soft-delete scoped).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/repository/PredictionRepository.java` — **P1** `existsByCreatedByAndWeekStart` + `findByCreatedByOrderByValidFromDescGeneratedAtDesc` + `findByCreatedByAndStatusAndValidToBefore` (owner + soft-delete scoped).
- `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/weight/repository/WeightLogRepository.java` — **P1** added `findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc` (the validation window read; sleep already had the sibling).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/config/ProactiveProperties.java` — `mezo.proactive.{briefing.{past-days,cron,regen-cap-per-day}, weekly.cron, memoir.cron, heartbeat.{midday-cron,evening-cron}, prediction.{cron,validation-cron,max-per-week,weight-epsilon-kg,sleep-epsilon-h}}` (@Validated, nested records).
- `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/repository/SleepLogRepository.java` — **B1.2** `existsBy…DateGreaterThanEqualAndCreatedAtAfter` staleness probe (plain finder, no proactive dependency).
- `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` — `PROACTIVE_SWITCH` + `BRIEFING_JOB_SWITCH` + `WEEKLY_SUGGESTION_JOB_SWITCH` + `MEMOIR_JOB_SWITCH` + `HEARTBEAT_JOB_SWITCH` + **`PREDICTION_JOB_SWITCH`** (+ the companion `COMPANION_SWITCH` they pair with).
- `backend/src/main/resources/application.yml` — `mezo.feature.proactive.enabled` + `mezo.proactive.{briefing.*, weekly.cron, memoir.cron, heartbeat.*, prediction.*}` + `mezo.techcore.cron.{briefing-job,weekly-suggestion-job,memoir-job,heartbeat-job,prediction-job}.enabled`.

**Backend — LLM fake (companion side, additive)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java` — `BRIEFING_MARKER_MIRROR` + `[fake-briefing:{…}]`, `WEEKLY_MARKER_MIRROR` + `[fake-weekly:…]`, `MEMOIR_MARKER_MIRROR` + `[fake-memoir:{…}]`, `HEARTBEAT_MARKER_MIRROR` + `[fake-heartbeat:…]`, and **`PREDICTION_MARKER_MIRROR` + `[fake-prediction:{…}]`** (GREEDY regex) sentinels (literals; §9 gotcha a) — the prediction default returns one valid `{"predictions":[{…}]}` row.

**Frontend — Today consumer (B1.2)**
- `frontend/src/data/today/briefingApi.ts` — `briefingApi.get` + `toBriefing` (wire→`Briefing`, no confidence).
- `frontend/src/data/today/briefingHooks.ts` — `useBriefing()` (dual-mode; mock null no-fetch, real GET or null on 404); re-exported by `data/hooks.ts`.
- `frontend/src/data/today/todayHooks.ts` — `useToday` composes `useBriefing` (`briefing`, `briefingDemo`); `frontend/src/features/today/{pages/TodayPage.tsx,components/BriefingCard.tsx}` — render + three-state label; `frontend/src/data/types.ts` — `Briefing.confidence?` optional.

**Frontend — Today companion-note consumer (H1)**
- `frontend/src/data/today/heartbeatApi.ts` — `heartbeatApi.get(date)` + `toCompanionNote` (wire→`CompanionNote{window, kind, text}`).
- `frontend/src/data/today/heartbeatHooks.ts` — `useCompanionNote()` (dual-mode; mock null no-fetch, real GET or null on 404); re-exported by `data/hooks.ts`.
- `frontend/src/features/today/components/CompanionNoteCard.tsx` — the in-day note card (nudge/closing eyebrow copy); rendered by `TodayPage.tsx` after the check-in strip only when a note exists.
- `frontend/src/data/types.ts` — the `CompanionNote` interface.

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
- `backend/src/main/resources/db/changelog/1.0.0/script/{202607061100_mezo-h4wp.1_create_briefing,202607070900_mezo-h4wp.2_briefing_regen_count,202607071200_mezo-h4wp.3_create_weekly_suggestion,202607071500_mezo-h4wp.4_create_memoir,202607071800_mezo-h4wp.5_create_heartbeat_note,202607071900_mezo-h4wp.7_create_prediction}.sql` (all in `1.0.0_master.yml`).

**Backend — tests**
- `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/{BriefingPersistenceIT,BriefingGeneratorIT,ProactiveApiIT,ProactiveApiSwitchOffIT,ProactiveApiCompanionOffIT,BriefingJobIT,BriefingJobSwitchOffIT,BriefingFreshnessIT,WeeklySuggestionPersistenceIT,WeeklySuggestionGeneratorIT,WeeklySuggestionJobIT,WeeklySuggestionJobSwitchOffIT,MemoirPersistenceIT,MemoirGeneratorIT,MemoirJobIT,MemoirJobSwitchOffIT,HeartbeatPersistenceIT,HeartbeatGeneratorIT,HeartbeatJobIT,HeartbeatJobSwitchOffIT,HeartbeatLazyIT,PredictionPersistenceIT,PredictionGeneratorIT,PredictionValidationIT,PredictionJobIT,PredictionJobSwitchOffIT}.java`
- `backend/src/test/java/io/mrkuhne/mezo/support/populator/{BriefingPopulator,WeeklySuggestionPopulator,MemoirPopulator,HeartbeatNotePopulator,PredictionPopulator}.java` + `support/ResetDatabase.java` (`briefing` + `weekly_suggestion` + `memoir` + `heartbeat_note` + `prediction` in the TRUNCATE list).
- FE: `frontend/src/data/today/{briefingHooks.test.tsx,heartbeatHooks.test.tsx,todayHooks.test.tsx}`, `frontend/src/features/today/components/{BriefingCard.test.tsx,CompanionNoteCard.test.tsx}`, `frontend/src/data/insights/{weeklyHooks.test.tsx,memoirHooks.test.tsx,predictionsHooks.test.tsx}`, `frontend/src/features/insights/pages/{WeeklyPage.test.tsx,MemoirPage.test.tsx,PredictionsPage.test.tsx,InsightsSubNav.test.tsx,insights.nav.test.tsx}`, `frontend/src/test/msw/handlers.ts` (four proactive defaults 404 + prediction `200 []`).

**Docs (link, don't duplicate)**
- Design spec: [`docs/superpowers/specs/2026-07-06-proactive-layer-design.md`](../superpowers/specs/2026-07-06-proactive-layer-design.md)
- Roadmap (8 slices): [`docs/superpowers/plans/2026-07-06-proactive-roadmap.md`](../superpowers/plans/2026-07-06-proactive-roadmap.md)
- Companion stack it builds on: [`companion.md`](companion.md)
- Roadmap/milestone log: [`docs/milestones/roadmap.md`](../milestones/roadmap.md)
