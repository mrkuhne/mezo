# Weekly Review (Én / Heti) — Design

**Date:** 2026-08-27 · **bd:** mezo-p2tr · **Status:** approved by user

## Purpose

A new weekly view under the **Én** section: browse any week, see per-day data
(kcal, macros, weight, sleep, check-ins, workouts, XP) plus a **deterministic
daily AI score**, weekly aggregates, an **LLM-generated weekly analysis**
(auto-generated Monday morning, push at 10:00), a deterministic **"AI
discoveries" digest** from the companion stores, and a per-day / per-week
**"talk about it" button** that opens the AI chat with server-side week context
and a Mezo-authored opening message.

It **replaces** the Insights "Heti" tab (`WeeklyPage`).

## Decisions taken (with user)

1. **Generation mode:** automatic weekly job (Monday), push notification at
   10:00, plus a manual "Frissítsd az elemzést" regenerate button when the
   week's data changed after generation.
2. **Placement:** new `Heti` tab under Én; Insights/Heti is removed,
   `/insights/weekly` redirects to the new route.
3. **Daily score:** hybrid — deterministic backend-computed number (0–100),
   the LLM only interprets it in the weekly analysis prose. No LLM-invented
   numbers.
4. **Current week:** shown live (data + scores update as the week runs); AI
   analysis section shows an honest "hétfőn érkezik" ghost until generated.
5. **Chat entry:** Mezo speaks first — a short opening reflection about the
   selected day/week, generated server-side when the anchored conversation is
   created.
6. **Architecture:** approach 1 — live deterministic data endpoint + persisted
   generated analysis artifact (no materialized data snapshot; no
   frontend-composed aggregation).

## 1. UI — new "Heti" tab in Én

- `ME_TABS` gains **Heti** → `/me/week` (child route of `me`, keeps sub-nav).
  Week selection via `?start=<ISO Monday>`; default = current week. Week
  stepper ‹ › with `deriveWeekTitle`-style label; stepping past the newest
  week is disabled.
- Page layout (house `pghead-np lav` header pattern, sections top-down):
  1. **Hero** — weekly score `ScoreRing` (0–100) + delta vs previous week;
     null → „tanulom". `StatStrip` below: avg kcal, avg protein, weight trend,
     avg sleep, check-in ratio, XP.
  2. **Day grid** — small 7-bar day-score mini-chart (hand-rolled SVG, `--dv-*`
     tokens), then 7 expandable day rows (`WeeklyWeightCard` idiom): day name +
     date, day-score badge, key values (kcal, sleep, weight, check-in count).
     Expanded: full macro row vs targets, sleep detail, workouts, subscore
     breakdown ("miből jött össze"), the AI day note from the generated review,
     and a **„Beszélgess a napról"** button.
  3. **AI weekly analysis card** — generated prose + `FeedbackChips`
     (artifact kind `weekly_review`) + **„Beszélgess a hétről"** button.
     Current/ungenerated week → ghost "Hétfő reggel érkezik". If week data
     changed after `generatedAt` → „Frissítsd az elemzést" button
     (regenerate endpoint).
  4. **AI discoveries section** — deterministic reads, never LLM output:
     patterns confirmed/reinforced/promoted this week (links to
     `/insights/patterns/{pairKey}`), new knowledge facts, confirmed
     LIFE_EVENT graph nodes (`occurredOn` in week), the week's memoir (link),
     the week's predictions + outcomes. Empty subsection → not rendered.
  5. **„A következő heted" card** — the existing `weekly_suggestion` prose
     (forward-looking plan), displayed here now that WeeklyPage is gone.
- Frontend conventions: `features/me/pages/WeekPage.tsx` + components under
  `features/me/components/`, pure math in `features/me/logic/`, data hooks via
  `useDualQuery`/`useRealQuery` dual-mode discipline (mock seed + honest
  `realEmpty`), no chart library (inline SVG only).

## 2. Backend data layer (live, deterministic)

- **Contract-first** endpoint `GET /api/me/week/{start}` → `MeWeekResponse`
  (new `api/feature/...` yml → generated DTOs both sides). `{start}` must be
  an ISO Monday (400 otherwise).
- Response shape (names indicative; finalized in the contract):

  ```
  MeWeekResponse {
    start: date
    days: [ MeWeekDay × 7 ]        # start..start+6, always 7 entries
    weekly: {
      score?: int                   # null → „tanulom"
      prevWeekScore?: int
      avgKcal?, avgProteinG?, avgSleepMin?, avgCheckinEnergy?: number
      weightTrend?: { latestKg?, weeklyRateKgPerWeek? }
      checkinRatio?: number         # filled slots / (4 × elapsed days)
      totalXp?: int
    }
  }
  MeWeekDay {
    date: date
    score?: int                     # 0–100, null = „tanulom"
    subscores: { sleep?, fuel?, checkin?, activity?: int }   # 0–100 each
    kcal?, proteinG?, carbsG?, fatG?: number
    kcalTarget?, proteinTargetG?: number
    weightKg?: number
    sleepMin?: int, sleepQuality?: number
    checkinCount: int, checkinEnergyAvg?: number
    workoutCount: int, xp?: int
  }
  ```

- Service home: `feature.companion` (`MeWeekService` + `DayScoreService`),
  composing existing feature reads via `MetricSeriesService` /
  `ContextSnapshotAssembler` idiom. Missing day/metric = absent, never
  zero-filled.
- **Day score** (`DayScoreService`): mean of available domain subscores ×100.
  Subscores (each 0–100, null when the domain has no data that day):
  - `sleep` — duration vs sleep goal, blended with sleep quality when present
  - `fuel` — kcal + protein adherence vs the day's targets
  - `checkin` — filled canonical slots (of 4), blended with avg energy when
    present
  - `activity` — workout logged / XP earned relative to a simple baseline
  Fewer than 2 non-null subscores → day score `null` („tanulom"). Exact
  constants live in one place (`*Properties` record) and are documented in the
  feature doc. This **promotes** the frontend `deriveScore`/`deriveWeekMetrics`
  (`data/insights/weeklyHooks.ts`) to the backend; the frontend copies are
  deleted.
- Weekly score = mean of non-null day scores (≥2 required, else null).

## 3. Weekly analysis generator + notification

- **`WeeklyReviewEntity`** in `feature.proactive` (memoir idiom): `weekStart`
  (ISO Monday), `summary` (text), `dayNotes` (jsonb envelope: date → 1–2
  sentence HU note), `highlights` (jsonb envelope: anchors chosen **by index**
  from code-collected candidates — kinds `Pattern`, `Fact`, `LifeEvent`,
  `Memory`; the model can never invent a reference), `generatedAt`.
  Soft-delete + partial unique `(created_by, week_start) where not deleted`.
- **`WeeklyReviewGenerator` + `WeeklyReviewJob`**, cron
  `mezo.proactive.weekly-review.cron` default `"0 50 6 * * MON"` (after
  predictions 06:30 / experiments 06:45; all inputs exist by then). Pure-code
  gather: `MeWeekService` week data + scores, `pattern_event`s in the week
  (confirmed/reinforced/promoted + snapshot r/n/p deltas), new knowledge facts
  (`createdAt` in week), confirmed LIFE_EVENT nodes (`occurredOn` in week),
  the week's memoir + prediction outcomes, `period_summary(week)` narrative →
  **one** SMART-tier LLM call, strict JSON
  `{summary, dayNotes[], highlightIndexes[]}`. Empty week (no day rows with
  data) → no row, honest absence. Failure → no row, never a placeholder.
- **REST** (`api/feature/proactive`): `GET /api/proactive/weekly-review/{start}`
  (404 when absent; response includes `generatedAt` and a `stale: boolean` —
  true when any of the week's source logs (meal, weight, sleep, check-in,
  workout) has a `createdAt`/`updatedAt` newer than `generatedAt`; best-effort
  max-timestamp probe, false on probe failure) and
  `POST /api/proactive/weekly-review/{start}/regenerate` (soft-delete +
  regenerate synchronously; guarded to completed weeks).
- **AI discoveries** endpoint `GET /api/proactive/weekly-review/{start}/digest`
  → deterministic lists (patterns confirmed/reinforced this week with pairKey +
  title, new facts, life events, memoir presence, predictions + statuses).
  Pure queries, no LLM. (Lives in proactive, which may read companion; the
  reverse dependency is forbidden by `ArchitectureTest`.)
- **Notification:** new `AppNotificationKind.WEEKLY_REVIEW_READY`, deeplink
  `/me/week?start=<weekStart>`, dedup `weekly_review_ready:<weekStart>`; new
  push `NotificationCategory.WEEKLY_REVIEW` anchored **Monday 10:00**, source =
  "weekly_review row exists", body = word-boundary excerpt of `summary`
  (never a new LLM call). The old `WEEKLY` push category is **retired** so
  Monday has exactly one push; `WeeklySuggestionGenerator` itself stays (its
  prose feeds the „A következő heted" card).

## 4. Chat handoff (anchored conversations)

- `create conversation` contract gains optional
  `context: { kind: 'week' | 'day', date }`; stored on the conversation
  entity (nullable columns `context_kind`, `context_date`).
- `ChatService.assembleSystemPrompt` appends a **`[Heti adatok]`** block for
  anchored conversations, rendered server-side by a `WeekContextRenderer`
  (companion; snapshot-assembler style): the anchor week's 7 day rows +
  scores + weekly aggregates + the weekly review `summary`/`dayNotes` when
  present; for `kind=day` the anchored day is marked and expanded. Rendered
  fresh every turn — always current data. Degrades to empty on failure, never
  throws.
- **Mezo opens:** when an anchored conversation is created, the backend
  generates the opening assistant message **synchronously in the create call**
  (one SMART turn with an internal kickoff instruction that is not persisted
  as a visible user message; the assistant message is stored). FE flow:
  button → create anchored conversation (button shows a pending state for the
  few seconds this takes) → navigate `/insights/chat?c=<id>` → the opening
  reflection is already in the message list. On LLM failure the conversation
  is still created (empty) — the user can just type.
- No URL-embedded data payloads; `ChatPage` keeps its `?c=` contract.

## 5. Migration, testing, docs

- Delete Insights `Heti` tab + `WeeklyPage` (+ now-unused weekly derivation in
  `data/insights/weeklyHooks.ts`); add redirect `/insights/weekly` →
  `/me/week` (pushed deeplinks in the wild).
- **Testing (house gates):**
  - Backend: `@SpringBootTest` integration tests — week endpoint shape +
    score math + null discipline (missing domains, „tanulom" thresholds),
    generator with fake LLM (strict-JSON contract, anchor-index validation,
    empty-week absence), regenerate endpoint, notification emit + dedup,
    anchored-conversation prompt block rendering. New tables registered in
    `ResetDatabase`; `*Populator` factories.
  - Frontend: dual-mode hook tests (mock + real via MSW), page tests, both
    test modes + build green.
  - Contract: regenerate merged `openapi.yml` + FE client; contract-drift CI
    gate.
- **Docs:** new section in `docs/features/me.md` (the weekly view + score
  formula), updates to `insights.md` (WeeklyPage removal), `proactive.md`
  (generator, entity, notification), `companion.md` (MeWeekService,
  DayScoreService, `[Heti adatok]` block, anchored conversations);
  `node scripts/lint-docs.mjs` green.

## Non-goals (YAGNI)

- No per-day LLM score (deterministic only).
- No materialized weekly data snapshot table.
- No new chat tool (context comes via the prompt block; existing tools cover
  drill-down).
- No backfill job generating reviews for historical weeks (past weeks show
  data + discoveries; analysis appears only from launch onward, or on manual
  regenerate of a completed week).
- No new push for the retired weekly-suggestion channel.
