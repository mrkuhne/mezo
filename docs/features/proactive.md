---
title: Proactive layer (companion feed, weekly prose, predictions, experiments, workout challenges)
type: feature-domain
status: complete
updated: 2026-09-05
tags: [proactive, companion-feed, ai, llm, backend, phase-4]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/feature/proactive
  - api/feature/proactive/proactive.yml
  - backend/src/main/resources/db/changelog/1.0.0/script/202608151200_mezo-gst9_create_companion_message.sql
  - backend/src/main/resources/db/changelog/1.0.0/script/202608151230_mezo-gst9_drop_briefing_heartbeat_note.sql
  - backend/src/main/resources/db/changelog/1.0.0/script/202607071500_mezo-h4wp.4_create_memoir.sql
  - backend/src/main/resources/db/changelog/1.0.0/script/202607071900_mezo-h4wp.7_create_prediction.sql
  - backend/src/main/resources/db/changelog/1.0.0/script/202607072000_mezo-h4wp.8_create_experiment.sql
  - backend/src/main/resources/db/changelog/1.0.0/script/202607072100_mezo-hbwi_create_challenge.sql
  - backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/OverloadChallengeGenerator.java
  - backend/src/main/resources/db/changelog/1.0.0/script/202607280641_mezo-gj42_challenge_overload_type.sql
  - backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/WeeklyReviewGenerator.java
  - backend/src/main/resources/db/changelog/1.0.0/script/202608271200_mezo-p2tr_create_weekly_review.sql
related: [companion, today, insights, train, me, _platform-api-backend, _platform-notifications]
---

# Proactive layer (companion feed, weekly prose, predictions) — Feature Documentation

> One-line: the Phase-4 layer where the companion **speaks first**. **The original B stage (dawn
> briefing) and H stage (in-day heartbeat) were REDESIGNED into a single event/cron-driven
> "companion feed" (`mezo-gst9`, 2026-08-15 design doc,
> [`specs/2026-08-15-companion-feed-design.md`](../superpowers/specs/2026-08-15-companion-feed-design.md)).**
> The old `briefing` + `heartbeat_note` tables and their generators/jobs/read-path staleness
> machinery are GONE (dropped, no data migration — the disposable generated rows were never worth
> preserving). One new table, `companion_message`, holds **nine kinds**: `morning` (dawn cron, the
> briefing's successor — sleep/weight-free by construction, spec §3), `sleep` (fired by a sleep-log
> event), `weight` (fired by a weight-log event), `midday`/`evening` (the heartbeat's two window
> crons, ported near-verbatim), `people` (since
> **Emberek S6**, `mezo-06o0.8`, 2026-09-01 — fired by the dawn cron alongside
> `morning`, gated on this week's mentions existing; §3.x below) — the Emberek section's weekly
> human-circle observation, aggregated per person, never raw quotes — and, since **S4**
> (`mezo-d58h.4`, 2026-09-04), `advice` — the SINGLE daily coaching card, §3/§4/§9 below.
> **`intervention` (W5.2, `mezo-b3pp.19`) and `setup` (S3, `mezo-d58h.3`) are PRE-S4 HISTORY** —
> both stay in the `kind` CHECK so rows written before S4 still deserialize and still count toward
> cooldowns/re-emit windows, but nothing writes either kind any more: `AdviceCardService` is now the
> ONE writer of the coaching card, `InterventionService`/`SetupCheckService` only produce
> candidates it may (or may not) turn into an `advice` row. A `CompanionMessageGenerator` with one method per kind, a
> `CompanionMessageJob` (3 crons: dawn/midday/evening) + a `CompanionMessageEventListener`
> (`@Async` `AFTER_COMMIT` on the sleep/weight log services' own events), and a unified
> `GET /api/proactive/feed?date=` (lazy miss-recovery for the cron kinds, `200 []` honest empty —
> never 404, a list endpoint) replace the old `briefing`/`heartbeat` read paths end to end. The
> **Today MezoChip thread now reads this feed** (`useCompanionFeed`, 60s poll in real mode) — the
> companion's own words, zero demo copy except an honestly-labelled fallback when the day's
> `morning` message hasn't landed yet. **The sleep-triggered "regen" mechanism the old briefing had
> is RETIRED, not ported** — event-triggered generation means the `sleep`/`weight` messages are
> already grounded in fresh data at generation time, so there is nothing left to correct after the
> fact (§9 decision retired-regen). **W1/W2 (`ír rólam hetente`) remain LIVE and UNCHANGED** —
> weeklySuggestion prose + weekly Memoir. **P1/P2 (`előre lát`) remain LIVE and UNCHANGED** —
> pattern-grounded predictions + N=1 experiments. **HBWI (workout challenges) remains LIVE and
> UNCHANGED.**
>
> **W1** — a `weekly_suggestion` table + a **smart-tier** `WeeklySuggestionGenerator`, a
> Monday-06:00 `WeeklySuggestionJob`, and a lazy `GET /api/proactive/weekly-suggestion` the
> **Insights Weekly „heti tervjavaslat" card renders** in real mode (404 = the FE's honest
> placeholder). **W2** — a `memoir` table (title + body + typed-jsonb `anchors`) + a **smart-tier**
> `MemoirGenerator`, a **Sunday-19:00** `MemoirJob`, and a lazy `GET /api/proactive/memoir` (latest;
> since F7.5 `mezo-d20.8.5.1` also **`GET /api/proactive/memoir/archive`** — every persisted memoir
> newest-week-first in one `MemoirArchiveResponse{entries[]}`, NEVER generating, empty list honest —
> the read behind the FE archive shelf ([insights.md §2.3b](insights.md))
> row, else generate the LAST COMPLETED week) the **Insights Memoir tab un-ghosts** in real mode
> (404 = the FE's honest „készül" state). **P1** — a `prediction` table (pattern-grounded, code-set
> validity windows, nullable confidence) + a **smart-tier** `PredictionGenerator`, a weekly
> `PredictionJob` + a **deterministic daily validation** run, and a list `GET
> /api/proactive/prediction` that **un-ghosts the Insights Predictions tab** (real dual-mode,
> „tanulom" on null confidence, honest derived accuracy header). **P2** closes the P stage AND the
> original epic: an `experiment` table (proposed → active → completed | dismissed lifecycle) + a
> **smart-tier** `ExperimentProposalGenerator`, a **write path** (`POST
> /api/proactive/experiment/{id}/decision` L2 accept/dismiss + `POST …/propose`), a deterministic
> `ExperimentOutcomeService` (reusing the shared `MetricWindowEvaluator`), and a two-cron
> `ExperimentJob` — the Insights **Experiments tab un-ghosts** (the LAST `PHASE3_TAB_IDS` ghost).
>
> **Status: backend 🟢 companion feed (morning/sleep/weight/midday/evening/people) + 🟢 the single
> daily `advice` card (S4, `AdviceCardService` + `AdvicePriority`, superseding intervention + setup
> checks) + 🟢 W1 + 🟢 W2 + 🟢 P1
> + 🟢 P2 + 🟢 HBWI · FE 🟢 Today MezoChip thread real (`useCompanionFeed`) + 🟢 W1 (Weekly card
> real, inert buttons hidden in live) + 🟢 W2 (Memoir tab real, demo extras mock-only) + 🟢 P1
> (Predictions tab real, un-ghosted) + 🟢 P2 (Experiments tab real) + 🟢 HBWI (Train challenge
> surface real).** The value stages (companion feed → W weekly prose → P predictions) and the
> original 8-slice map live in the roadmap; this doc tracks **what exists now**. **The proactive
> epic (`mezo-h4wp`, all 8 original slices) is COMPLETE, `mezo-h4wp.6` (H2 Web Push) is COMPLETE**
> — N1 delivery spine + N2 dispatcher + N3 FE-schedule snapshot all shipped 2026-07-29, a real push
> reached Daniel's iPhone from the k3s backend that same day (confirmed), and **`mezo-gst9`
> (2026-08-15) then redesigned the B+H stages into the unified companion feed above, including two
> new push categories (`evening`, and the event-fired `sleep_reaction`/`weight_reaction`) —
> `AnchorResolver`'s five prose anchors now read `companion_message`.** Every prose/forecast
> Insights + Today surface is honest and real, and reaches Daniel's lock screen too — see
> [`_platform-notifications.md`](_platform-notifications.md).

## 1. Summary

The **proactive** layer is Phase-4: instead of answering when asked (the [companion](companion.md)
chat), mezo starts the conversation — a companion feed of daily messages, a weekly memoir,
predictions. It is built on the finished companion stack (V0.3 snapshot + V1.1 facts + V2.2 daily
summaries); the original 8-slice epic (`mezo-h4wp`) shipped a morning briefing (B1.1/B1.2), a
weekly plan-suggestion + Memoir (W1/W2), an in-day heartbeat (H1), predictions (P1) and N=1
experiments (P2). **`mezo-gst9` (2026-08-15) then REDESIGNED the B+H stages** — the dawn briefing's
sleep/weight blind spot (generated before those get logged, so it either omits them or, via the
old regen path, corrects them after the fact) and the heartbeat's separate table were folded into
one **companion feed**: a `companion_message` table + `CompanionMessageGenerator` (morning/sleep/
weight/midday/evening) + `CompanionMessageJob` (3 crons) + `CompanionMessageEventListener` (sleep/
weight log events) + a unified `GET /api/proactive/feed`. W1/W2/P1/P2/HBWI are **unaffected** by
this redesign and remain as shipped.

**The companion feed (`mezo-gst9`) — event/cron-driven, 5 message kinds, one table:**

- **The problem it solves** (design spec §1): the old dawn `BriefingJob` (05:45) ran BEFORE the
  morning sleep-log write, so the briefing either narrated stale (yesterday's) sleep or needed the
  since-retired `refreshIfStale` regen path to correct itself later; the snapshot's `[Profil]` block
  quoted the smoothed EWMA trend as "your weight" instead of the actual weigh-in (fixed separately,
  see [companion.md](companion.md)); and `FuelDayService`'s kcal targets came from static config
  instead of the goal engine (fixed separately, see [fuel.md](fuel.md) §10). The fix: **generate
  each topic's message when its data actually exists**, not on one fixed morning clock.
- **One owned table, `companion_message`** (`entity/CompanionMessageEntity.java`) — UUID PK,
  `created_by`, soft-delete; `message_date date` (the day the message is FOR), `kind varchar(16)`
  (CHECK: `morning`/`sleep`/`weight`/`midday`/`evening` — `CompanionMessageEntity.KIND_*`
  constants), `content jsonb` (the `BriefingContentEnvelope` idiom, renamed
  `CompanionMessageEnvelope{eyebrow, body[], refs[]}`), `generated_at`. **Partial unique index**
  `uq_companion_message_created_by_date_kind … where is_deleted = false` — one LIVE message per
  user+day+kind (a second same-day weigh-in is idempotent, not a new message).
- **`CompanionMessageGenerator`** (`service/CompanionMessageGenerator.java`) — one method per kind,
  the same pure-code-gather → ONE `CompanionLlm.complete` call → defensive-parse → bounds-checked
  ref-resolution → `saveAndFlush` idiom every prior generator in this doc uses:
  - **`generateMorning`** — the briefing's successor. Its gather calls
    `ContextSnapshotAssembler.renderWithoutBiometrics(userId, date)` (NOT `.render`) — sleep/weight
    are stripped **at the source**, not just prompt-forbidden, because a prompt instruction alone
    cannot stop the model from seeing and leaking numbers that are still in the payload (see
    [companion.md](companion.md) for the two-variant assembler). Ref candidates: `Goal`/`Workout`/
    `FuelDay`/`Medication` — deliberately **no** `WeightTrend`/`Sleep` candidate. Gate: empty
    `daily_summary` window (`feed.past-days`) ⇒ no row.
  - **`generateSleepReaction`** — fired ONLY by a fresh sleep log's `SleepLogSavedEvent` — never by
    a cron (mezo-qn3z; see `CompanionMessageJob`). Gate: the user's latest sleep log must be dated
    `>= today - 1` (a backfilled/old log never triggers). Ref candidates: `Sleep`/`Goal`/`Workout`.
    Uses the FULL `render` (sleep IS the topic here).
  - **`generateWeightReaction`** — fired by a fresh weigh-in. Gate: the latest weight log must be
    dated exactly `today`. Ref candidates: `WeightTrend`/`Goal`/`FuelDay`; the payload carries BOTH
    the raw measurement and the `WeightTrendService` EWMA trend, explicitly labelled `mérés` (the
    measurement) vs `trendérték` (the smoothed trend) so the model can't conflate them.
  - **`generateWindow`** (midday/evening) — the heartbeat generator ported near-verbatim: same
    prompt/gather/emptiness-gate, but its `MAI BRIEFING (ne ismételd):` dedupe block is replaced by
    `earlierMessagesBlock` — now built from **any** earlier same-day `companion_message` row
    (morning/sleep/weight/midday), not just the briefing. Flat prose answer (no JSON), code-set
    eyebrow (`Napközi jegyzet`/`Napzárás`). Since mezo-106s the LLM call is tool-calling — the full
    `CompanionToolRegistry` roster (14 tools) on the chat budget, the concrete 2–4-paragraph prompt,
    and the tool-audit refs land in the envelope (`refs` no longer `[]`); the `morning`/`sleep`/
    `weight` kinds keep the tool-free overload.
  - All four share `earlierMessagesBlock` (a "MAI KORÁBBI ÜZENETEK (ne ismételd):" block listing
    every already-persisted message of the day) — the heartbeat's dedupe idiom generalized from one
    source (briefing) to all of them.
- **`CompanionMessageJob`** (`service/CompanionMessageJob.java`) — the old `BriefingJob` +
  `HeartbeatJob` merged into one `@Scheduled`-methods-one-switch bean: `runMorning` (05:45,
  `feed.morning-cron`) generates only the morning message (+ the people-observation branch); the
  sleep reaction is deliberately left out (mezo-qn3z), because at 05:45 tonight's sleep is not
  logged yet and it would narrate yesterday's as tonight's — the "cron előtt logolt alvás" case is
  already covered by the `AFTER_COMMIT` listener at the moment of logging; `runMidday`/`runEvening`
  (12:30/20:30) generate the window kinds. Gated on the usual dual switch **plus** a THIRD,
  `FEED_JOB_SWITCH = mezo.techcore.cron.feed-job.enabled` (replaces the old
  `briefing-job`/`heartbeat-job` switches — now ONE switch for all three crons). Today-only, no
  backfill, idempotent, per-user failures isolated.
- **`CompanionMessageEventListener`** (`service/CompanionMessageEventListener.java`) — the NEW
  trigger the old briefing/heartbeat model never had: `SleepLogService.log`/`WeightLogService.log`
  each publish a `SleepLogSavedEvent`/`WeightLogSavedEvent` (`ApplicationEventPublisher`, right
  before returning, inside the `@Transactional` method) which this listener consumes
  `@TransactionalEventListener(phase = AFTER_COMMIT)` + `@Async` — so it only reacts to a log that
  actually persisted, and never adds LLM latency to the logging request itself (the
  `PushDispatchExecutor` async precedent). Same freshness guards as the generator methods
  (backfilled logs never trigger).
- **The unified read — `GET /api/proactive/feed?date=`** (`service/ProactiveFeedService.java`,
  replacing `GET …/briefing` + `GET …/heartbeat`): returns the day's `companion_message` rows in
  `generated_at` order. For TODAY only, `ensureTodayCronKinds` lazily generates the cron kinds ahead
  of the read (morning always; midday/evening once their fire-time — derived from the SAME cron
  config via `CronExpression`, the old heartbeat idiom — has elapsed). **Event kinds (sleep/weight)
  are NEVER lazily generated here** — only their own events create them. **`200 []` is the honest
  empty state, never a 404** (a list endpoint, the P1/experiment precedent — a change from the old
  single-resource briefing/heartbeat reads, which 404'd). **Miss-recovery never costs the reader the
  messages that already exist** (`mezo-y33b`): each generate is caught and logged, and `getFeed`
  carries **no `@Transactional`** so the catch actually holds — see §9 gotcha *read-path isolation*.
- **The sleep-triggered "regen" mechanism is RETIRED, not ported.** The old
  `ProactiveBriefingService.refreshIfStale` (soft-delete + regenerate a stale briefing, capped
  `regen_count`) existed because the briefing was generated BEFORE sleep data existed and had to be
  corrected after the fact. Event-triggered generation removes the need: the `sleep`/`weight`
  messages are only ever generated once their grounding data already exists, so there is nothing
  stale to detect or a cap to enforce. No successor property, no successor column.
- **The FE swap (Today MezoChip thread)** — `useCompanionFeed()` (`data/today/feedHooks.ts`,
  `['companionFeed', date]`, 60s `refetchInterval` in real mode so cron-kind arrivals and
  event-triggered kinds land without a manual reload; mock mode always `[]` synchronously). `logic/
  mezoMessages.ts`'s `buildMezoMessages({ feed, demoBriefing })` maps each `FeedMessage` 1:1 to a
  thread bubble (kind→id, body→paragraphs, refs carried through); when the feed has **no** `morning`
  kind yet, an honestly-labelled demo card (`meta: 'Demo tartalom'`) is PREPENDED from
  `resolveBriefing(scenario.dayState)` — mock mode's only branch, and real mode's cold-load state
  before the dawn cron/lazy-GET has produced today's morning message. The retired
  `useCompanionNote()`/`CompanionNoteCard` are GONE — the midday/evening messages are just more
  bubbles in the same thread now. See [today.md](today.md) §1/§3.

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
  [insights.md §2.2](insights.md). **As originally shipped at W1** — the Insights Weekly tab
  (`useWeekly`/`WeeklyPage`) was retired outright at `mezo-p2tr`; the SAME suggestion endpoint is now
  read directly by `/me/week`'s `Heti` hub (`WeekHubPage`'s own `useWeekNextSuggestion`, current-week-only) — see
  [insights.md §2.2](insights.md) and [me.md](me.md).

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
  **Prompt v2 (`mezo-uajy`,
  [spec](../superpowers/specs/2026-08-31-memoir-prompt-v2-design.md))** — the four-line
  adjective prompt became a blocked, behaviour-stating voice contract in the chat-persona idiom
  (chronicler-companion: narrates, never grades/moralizes/advises; title rule; **2–4 paragraphs
  separated by `\n\n`**, ~120–220 words; a good/bad tone example; the medication prohibition
  stays). The gather widened to the weekly-review shape: patterns are **narrowed to CONFIRMED +
  the week's event-bearing ones** (rejected rows no longer leak in as anchors), plus
  **life events** (`LifeEvent` anchor candidates), **week PRs** (all-time bests whose
  `bestSet.date` fell in-week via `ExerciseRecordService` — a new cycle-safe `proactive → train`
  read; `PR` anchor candidates), the week's **predictions with status**, and the
  **`WeeklyReviewContextSources` wider context verbatim** (journal, decisions, experiments,
  mention counts, medication-cycle position, week narrative — no anchor candidates). The JSON
  contract is now `{title, body, anchors:[{index, note}]}` (legacy `anchorIndexes` still parsed
  as fallback); **Memory anchor labels are composed server-side** into human HU day labels
  (`MemoirGenerator.memoryLabel`: `aug. 29., szombat — <note≤60>`) so the FE chips stop showing
  raw ISO dates. The fake's `MEMOIR_SENTINEL` went GREEDY (nested `anchors` objects) and its
  default answer speaks the v2 shape; load-bearing prompt lines are pinned by
  `MemoirPromptTest`, the widened gather by `MemoirGeneratorIT`.
  **The week's workout closing notes (`mezo-d20.13`,
  [spec](../superpowers/specs/2026-09-01-edzes-jegyzet-kontextus-design.md))** are the newest
  gather section — `AMIT AZ EDZÉSEK UTÁN ÍRT (a saját szavai, szó szerint)`, one line per
  completed instance in `[weekStart, weekStart+6]` carrying a non-blank `closingNote`
  (`WorkoutSessionRepository.findDoneInstancesBetween`, the same cycle-safe `proactive → train`
  read the week PRs use). They go in **verbatim**: a session is fully describable in numbers, but
  how it FELT exists only in the user's own sentence and is unrecoverable from the data, so
  summarizing it first would strip the numbers, hedges and specifics that are the entire reason it
  is carried — and would make the app assert an interpretation of the user's state it was never
  told. Long notes are **truncated** (`WORKOUT_NOTE_CLIP` 400 per note, `WORKOUT_NOTES_TOTAL_CLIP`
  1200 for the section): a per-entry cap as well as a total, because with only a total one long
  note crowds the rest of the week out entirely. Each note is also a **`WorkoutNote` anchor
  candidate**, so a chapter that leans on one stays traceable in the `Miből íródott` row —
  unattributed echo of a person's own words reads as surveillance, a visible trail reads as
  attention. Custom (saját) workouts are **in** scope: only the custom TEMPLATE row has a null
  `templateSessionId`, its started instance carries one like any other. Reads `closingNote`, never
  `note` (the template day's plan note, a different row of the same table). The FE chip label
  lives in `toolDomains.ts` / `chatRefs.ts` (`Edzés-jegyzet`).
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
  **anniversary card + archive footer are MOCK-ONLY** (unpersisted interactivity =
  false affordance, the W1 button precedent — §9 decision k). The mock-only **reactions row was
  RETIRED at Phase 5 W4.1** (`mezo-b3pp.15`) in favour of a real 👍/👎 `FeedbackChips` row that
  renders in BOTH modes — closes `mezo-kr9v`, and it is what the new `MemoirResponse.id` feeds
  (§4/§9 (a2)). Mock is otherwise the full Phase-1 demo + byte-parity. Details: [insights.md §2.3](insights.md).

**H1 (`mezo-h4wp.5`) — in-app heartbeat (SUPERSEDED by the companion feed, `mezo-gst9`):**

H1 originally shipped a standalone `heartbeat_note` table + `HeartbeatGenerator` + `HeartbeatJob` +
a Today `CompanionNoteCard`. **All of it is retired** — the `midday`/`evening` window kinds now
live in the SAME `companion_message` table/generator/job/read as the morning message (see the
companion-feed block above), and the Today surface is the MezoChip thread, not a separate card.
Nothing below this heading exists in the codebase any more; kept only so the H1 bd-issue history
resolves to something.

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
  index, metric + direction from the offered lists). **S2 (`mezo-tk88.2`)** — `resolveSourcePatternId`
  (same index resolution as `resolveConfidence`) stores the grounding pattern's id on
  `sourcePatternId` (bounds-checked, else null); `PredictionRepository.
  findByCreatedByAndSourcePatternIdAndDeletedFalse` is the pattern-detail page's impact-list read.
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
  a no-op when the cap is met (§9 decision y); zero CONFIRMED patterns ⇒ no proposals. **S2
  (`mezo-tk88.2`)** — the same `resolveSourcePatternId` idiom stores the grounding pattern's id on
  `sourcePatternId` (this generator carries no `confidence` field, so this is the only
  pattern-derived field it persists); `ExperimentRepository.
  findByCreatedByAndSourcePatternIdAndDeletedFalse` is the pattern-detail page's impact-list read.
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
  + `workout_date` + `exercise_id` = the target, `type` = `PR`/`Depth`/`Volume`/**`overload`** (CHECK,
  extended by `202607280641_mezo-gj42` below — the released `202607072100` changeset itself stays
  untouched), `status` =
  `proposed`/`accepted`/`dismissed`/`hit`/`miss`/`inconclusive` (CHECK), structured targets
  `target_weight_kg?`/`target_reps?`/`target_sets?`/`target_rir?`, **`confidence numeric(4,3)`
  NULLABLE** = „tanulom", typed-jsonb `refs`, `outcome text` + **`outcome_good boolean` NULLABLE**
  (null = inconclusive). A **plain** `idx_challenge_session_date` on `(created_by,
  template_session_id, workout_date)` — NOT unique (several challenges per session/day).
- **`ChallengeGenerator`** (smart tier) — **lazy on the prep-read** for **today's** planned session
  (no generation cron): pure-code `gather` (template exercises + per-exercise last-week set / PR
  history / volume-vs-plan; **drop exercises with no history** = the grounding gate; none left ⇒ `[]`).
  **Since `mezo-q7o6` the grounding history is resolved by exercise IDENTITY** (catalog id, else
  exact name — the `ExerciseRecordService` idiom via `findIdentityRowsIncludingDeleted`), not by the
  template row alone: a fresh custom (saját, `mezo-ws2x`) template's first-ever session inherits the
  meso rows' logged-set history, so it can get challenges too (row-only history left first saját
  sessions permanently challenge-less)
  → ONE `completeSmart` (`CHALLENGE_MARKER = "EDZES-KIHIVAS-FELADAT"`) → per proposal: type-required
  target-field validation (PR needs weight+reps, Depth needs `targetRir`, Volume needs `targetSets`;
  missing ⇒ DROP — unevaluatable), pattern-copied-or-null confidence, model-selected `refs` by index,
  capped at `max-per-workout` (default 3). Structured targets required (decision, §9); no fabricated
  confidence/refs. **S2 (`mezo-tk88.2`)** — `resolveSourcePatternId` (same index resolution as
  `resolveConfidence`) stores the grounding pattern's id on `sourcePatternId` beside `confidence`;
  `ChallengeRepository.findByCreatedByAndSourcePatternIdAndDeletedFalse` is the pattern-detail
  page's impact-list read. **Generation guard (`mezo-cd8s`)** — the lazy prep-read never generates once the
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
  „⚔️ Elfogadom" (pre-bxpg: „Vállaljuk") is a real L2 decision, confidence-null reads „tanulom", the `tools` chips are hidden in
  live, and resolved challenges show the outcome chip (✓/◯/◌). Details: [train.md §Active workout](train.md).
- **Progressive Overload Plan 3 (`mezo-gj42`) — a deterministic fourth type, `overload`, no LLM.**
  `OverloadChallengeGenerator` (`feature/proactive/service/OverloadChallengeGenerator.java`, same
  COMPANION+PROACTIVE gate) reads the day's already-computed per-exercise `ProgressionSignal` off
  `WorkoutService.getToday` (no duplicated deload/intensity logic) and picks the **biggest recommended
  jump** — the largest `+kg` (weight lever), else the largest meaningful `+rep` (rep lever, ≥1);
  deload/no-jump/not-today/non-owned-template all resolve to none (honest `[]`). Idempotent per (user,
  template day, date); persists ONE `type='overload'` row (title `"⚡ Túlterhelés · {exercise}"`, `why`
  = the engine's HU rationale, `confidence` always null — deterministic, not learned). **Served as a
  guaranteed +1** — `ProactiveChallengeService.getChallenges` calls it via a SEPARATE
  `overloadChallengeGenerator.generate(...)`, appended to the LLM `ChallengeGenerator`'s output and
  INDEPENDENT of `max-per-workout`, so it's never crowded out. **Gotcha — the `isOwnedTemplate`
  guard:** the generator delegates day-resolution to `getToday`, which **404s** on a non-owned/foreign
  `templateSessionId` (the LLM generator's grounding gate returns `[]` silently for the same case); a
  caught exception can't rescue this because `generate` is itself `@Transactional` and joins the
  ambient tx, so the 404 marks it rollback-only (`UnexpectedRollbackException` on commit).
  `ProactiveChallengeService.isOwnedTemplate` (a faithful mirror of `WorkoutService.
  ownedTemplateOrThrow`) checks ownership BEFORE calling, preserving the documented "honest `[]`, never
  404" contract. **Outcome = a PR mirror** — its own `ChallengeOutcomeEvaluator` case, null-weight
  tolerant: hit ⇔ a logged set with `reps ≥ targetReps AND (targetWeightKg == null OR weight ≥
  targetWeightKg)` (the rep-lever case has no weight target); no logged sets ⇒ inconclusive; flows
  through the SAME accepted-only + completion-gated + `ChallengeJob` backstop path, unchanged.
  **Display:** `ChallengeDisplay.typeLabel(overload) = "⚡ Túlterhelés"`, target `"{kg} kg × {reps}"`
  or, weightless, `"{reps} ismétlés"` — renders through the UNCHANGED `ChallengesCarousel`/
  `ChallengeCard` (FE only added `'overload'` to the `ChallengeType` union + a mock fixture,
  `ch-overload`). `confidence=null` reuses the existing „tanulom" chip (a known minor copy nuance —
  deterministic isn't really "still learning" — deliberately not fixed, keeping `ChallengeCard`
  type-agnostic). **DB:** `ck_challenge_type` extended to `('PR','Depth','Volume','overload')` via
  `202607280641_mezo-gj42_challenge_overload_type.sql` (drop+recreate). **Type catalog is now PR /
  Depth / Volume / overload — `Tempo` still deferred** (no logged tempo to honestly evaluate against).
  Details: [train.md §2](train.md).

**WR (`mezo-p2tr`) — weekly review (Én/Heti): the companion writes a backward-looking narrative over the just-finished week, surfaced on `/me/week`, not Insights.**

Design of record: `.superpowers/sdd/2026-08-27-weekly-review/`. Companion, not proactive, owns the
**data layer** this stage narrates over — `DayScoreService` (deterministic per-day score) +
`MeWeekService` (`GET /api/me/week/{start}`, live for the current week) both live in
`feature/companion` and are documented in full in [`me.md` §4](me.md) — this doc covers only the
**generated narrative** on top of that data, which IS proactive-owned.

- **An eighth owned table** — `weekly_review` (UUID PK, `created_by`, soft-delete; `week_start
  date` = the ISO Monday the review is FOR, `summary text` = the review prose, `day_notes jsonb` =
  a typed envelope of short per-day comments, `highlights jsonb` = a typed envelope of
  code-collected, model-selected refs (the `memoir.anchors` idiom — since `mezo-d20.7.7` each entry
  also carries a nullable `refId`, the id of the pattern/fact/life-event/memoir it was collected
  from, so a citation can be counted against the entity rather than a display label; rows written
  before that slice have none and are never label-matched back), `generated_at`). A **partial**
  unique index (one LIVE review per user+week; soft-delete + reinsert = regeneration, the
  `weekly_suggestion`/`memoir` precedent) — unlike W1, WR **does** ship an on-demand regeneration
  path (below).
- **`WeeklyReviewGenerator`** — the `MemoirGenerator` idiom applied to the week's OWN data instead
  of a single narrative: a **pure-code gather** composes every day's `MeWeekService.renderDayLine`
  (the SAME formatter `WeekContextRenderer`'s `[Heti adatok]` chat block uses, so the review's own
  prose and the chat's anchored context can never disagree on what a day looked like) + the week's
  confirmed/reinforced pattern events + newly-created knowledge facts + active `LIFE_EVENT` graph
  nodes + the week's own memoir (if any) + its predictions, plus a **numbered anchor-candidate
  list** → **ONE smart-tier `CompanionLlm.completeSmart` call** answering strict JSON
  `{summary, dayNotes, anchorIndexes}` (marker `HETI-ELEMZES-FELADAT`) → defensive parse →
  **bounds-checked, deduped index→highlight resolution** (anchors are model-SELECTED, never
  invented — the memoir/prediction ref rule) + day-notes filtered to dates inside the week.
  **Empty week (no day carries ANY logged data) or an unusable answer (blank/null summary) ⇒ NO
  row** (honest absence); existing row ⇒ returned untouched (idempotent, no second LLM call).
- **A Monday-06:50 cron, running BACKWARD** — `WeeklyReviewJob` `@Scheduled` on
  `mezo.proactive.weekly-review.cron` (**`0 50 6 * * MON`**) generates the review for the week that
  **JUST FINISHED** (`weekStart = previousOrSame(MONDAY).minusWeeks(1)`) — the opposite direction
  from `WeeklySuggestionJob`'s forward-looking current-week generation on the same Monday morning;
  the two are deliberately separate jobs (one narrates the past, one plans the future). Gated on a
  THIRD switch `mezo.techcore.cron.weekly-review-job.enabled` (`WEEKLY_REVIEW_JOB_SWITCH`) on top
  of the dual companion+proactive gate; idempotent, per-user failures isolated, no backfill.
- **Three reads/writes** (`api/feature/proactive/proactive.yml`, `WeeklyReviewController`) — all
  three share the SAME `requireMonday` 400 guard (`WEEKLY_REVIEW_START_NOT_MONDAY`), deliberately
  **NOT lazy** on the primary GET (a change from most proactive reads): `GET
  /api/proactive/weekly-review/{start}` returns the row **as-is**, `404 RESOURCE_NOT_FOUND` when
  the job hasn't produced one yet (the job owns generation — a lazy GET here would let a client
  race the cron and generate off a still-in-progress week), plus a `stale: boolean` **best-effort**
  probe (true when a newer weight/sleep/check-in/meal row in the week postdates `generatedAt`;
  `false` on ANY probe failure — staleness is a hint, never a reason to fail the read). `POST
  …/regenerate` soft-deletes the live row (if any) and re-runs the generator, then RE-RUNS the
  same `stale` probe against the fresh row's `generatedAt` (never hardcoded `false` — a log landing
  mid-generation still surfaces honestly) — `409 WEEKLY_REVIEW_WEEK_NOT_COMPLETE` while `weekStart +
  7 days` is still in the future, `404` if the fresh run still yields nothing (empty week). `GET
  …/digest` maps the SAME week-window reads the generator's gather draws candidates from straight
  to DTOs (patterns/newFacts/lifeEvents/memoir boolean/predictions) — `400` on a non-Monday
  `start`, otherwise always `200`, empty lists the honest empty state, independent of whether the
  review row itself exists (`/me/week`'s `WeekDiscoveries` card's source).
- **„A hét tanulságai" — the round's knowledge candidates (`mezo-d20.7.6`)** — until this slice the
  weekly pipeline **never wrote to knowledge** (the generator only read; its single write was the
  review row + the notification). Now the strict-JSON contract gains a fourth field
  **`candidateFacts: [{text, category, evidence}]`** (prompt rule: a candidate may be inferred ONLY
  from the supplied day data / pattern events, and `evidence` must name what it rests on), and
  `WeeklyLessonService` writes the survivors onto the **existing companion candidate flow**
  (`learned_fact` → user decision → `knowledge_fact`) rather than a new write path — deliberately,
  because `FactCandidateService.decide` is the only promoter that publishes
  `KnowledgeFactPromotedEvent`, so an accepted lesson gets its graph node for free
  (`KnowledgeFactService.create` and `PatternService.promote` do not). Provenance: `learned_fact`
  gained `source` (`chat|weekly_review`), `week_start` and `evidence`
  (`derived_from_message_id` stays null for a weekly candidate — its FK is already
  `on delete set null`), and `knowledge_fact` a **fourth** source constant `weekly_review`
  (drop + re-add of `ck_knowledge_fact_source`, the feedback-kind migration idiom), which
  `decide` INHERITS from the candidate — otherwise promotion would claim `chat`. The write carries
  the chat extraction's discipline: bounds-check (blank/over-long text, unknown category),
  normalised dedupe against confirmed facts + **every** existing candidate (a rejected lesson must
  not return next Monday) + the batch, and the `max-candidates-per-turn` ceiling reused as the
  per-round cap. **No usable lesson ⇒ no row** — never a placeholder, and an unknown `evidence`
  stays null. **No per-candidate `FACT_CANDIDATE` notification** (unlike chat extraction): Monday's
  `WEEKLY_REVIEW_READY` already speaks, and the count shows on the Heti tile + the Tudástár inbox
  counter. Read path: **`GET …/{start}/lessons`** returns the week's candidates **with their
  decisions** (the pending inbox only returns undecided ones; a closed week must be reviewable in
  its settled state) — always `200`, empty list = honest empty. `POST …/regenerate` archives the
  week's still-OPEN candidates with the old review and leaves DECIDED ones untouched — a
  regeneration must never undo a user decision.
- **The WIDER gather input (`mezo-d20.7.8`, extended by `mezo-iizd.9`)** —
  `WeeklyReviewContextSources` adds **seven** sources — the six the design spec listed as input and
  the first cut dropped, plus the life-goal block — rendered into the payload **after**
  the predictions block and **before** the numbered anchor list: **journal entries**
  (`occurredOn` in-week, prose clipped to 180 chars, max 7), **decisions** (recorded in-week +
  **reviewed** in-week with their 1–5 rating, text clipped to 140, max 6 combined), **N=1
  experiments** whose `[startDate, startDate+totalDays)` window *intersects* the week (title +
  status + window position or outcome; `proposed` rows never ran, so they are excluded),
  **people mentions** aggregated to a **per-person COUNT** (top 5), the **medication cycle**
  position on the week's first and last day (one line, derived via `MedicationCycleService`), and
  the week's consolidated **`period_summary(week)`** narrative (clipped to 600 — its `03:30 MON`
  consolidation cron runs three hours before the `06:50` review cron on the SAME `weekStart`).
  **The seventh source (`mezo-iizd.9`): `ÉLETCÉLOK · AZ ELMÚLT 7 NAP`** — the life-goal engine's
  ALREADY-COMPUTED per-goal trend off `LifeGoalProgressService#today` (max 5 ACTIVE goals;
  `title [dimension] <arrow-word> · N találat-nap a 7-ből`). Three honesty rules shape it, all
  pinned by `WeeklyReviewContextSourcesIT`: the header names the **trailing-7-day** window it
  actually measures, NOT the reviewed week (`today()`'s `[now-6, now]` sits one day off the
  Monday-06:50 cron's `[D-7, D-1]`; a windowed `today(from, to)` variant is a separate, later
  issue); today's `pillarsHitToday / pillarsTotal` snapshot is dropped as meaningless in a
  retrospective; and a goal with **no data-day at all** renders `ezen a héten még nincs adata`
  instead of a `0 találat-nap` tally — a zero there means "we measured nothing", and a
  measured-looking zero would invite the model to explain a week nobody measured. That last rule
  mirrors the frontend's `goalWeekSentence.ts` verbatim, so one week can never read as a miss in
  the prompt and as silence on the Heti hub. The arrow is rendered as a WORD (`emelkedik` /
  `tartja` / `csúszik` / `kevés adat az irányhoz`) — glyphs are misreadable inside prompt prose.
  See [`lifegoal.md`](lifegoal.md) §5.
  Three disciplines make this a widening rather than a bloat: it is **data only** (the prompt is
  byte-identical and mints no new anchor kinds — the `Pattern|Fact|LifeEvent|Memory` RefTag
  vocabulary is unchanged, and every candidate costs double tokens because it renders in its own
  section *and* in the anchor list); **each source is capped and clipped** at the coarsest
  granularity that still carries its signal, with mention excerpts/tone, gratitude entries,
  `daily_summary` narratives (the `period_summary` rung IS their consolidation), the decision
  `contextSnapshot` and the dose ledger deliberately **left out as noise**; and **an absent source
  renders no scaffolding at all** — no header, no placeholder, an unknown cycle day or ungraded
  review printing the house `–`. Cross-feature edges: `proactive → journal`, `proactive → people`
  and `proactive → medication` are new, all three verified acyclic (ADR 0012 prescribes a
  consumer-owned port where the direct edge would *close* a cycle; `CheckInNoteSourceAdapter` is
  the standing precedent for a plain read when the direction is already safe), so no port was
  minted and the ArchUnit freeze store is unchanged.
- **Notifications** — `AppNotificationKind.WEEKLY_REVIEW_READY` (`/me/week` deeplink, no
  `familyKey` since the push category below already covers the event) fires on generation. The
  `NotificationCategory.WEEKLY_REVIEW` push fires **Monday 10:00, fixed** (`AnchorResolver.
  weeklyReviewAnchor`, looking up `weekStart = date.minusWeeks(1)` — the job ran 06:50 that same
  morning, so the row already exists by 10:00). **This retires the old forward-looking `WEEKLY`
  push category** — `NotificationCategory.WEEKLY` stays in the enum `@Deprecated` (persisted
  `notification_pref` rows still resolve it via `fromKey`) but `AnchorResolver` no longer emits an
  anchor for it; the FE drops the old `weekly` key from its category catalog entirely (a stray
  backend-only `weekly` pref row is filtered out client-side, never rendered) and adds
  **`weekly_review`** with the label **„Heti elemzés"** ([`me.md`](me.md) `Értesítés` §2).
- **Feedback** — `weekly_review` joined `MessageFeedbackEntity`'s artifact-kind CHECK constraint
  (`chat_message|feed_message|weekly_suggestion|weekly_review|memoir|prediction` at the time;
  `day_review` joined afterward, `mezo-jcpt.9` — [`companion.md` §5.7](companion.md) carries the
  current seven-kind enumeration); the
  `WeeklyReviewResponse.id` IS the feedback artifact id, exactly the W2/`(a2)` memoir precedent
  (§9 below) — no per-kind branch anywhere in the feedback surface, just another string the generic
  `POST /api/companion/feedback` accepts.
- **Anchored chat conversations (a SEPARATE, companion-owned mechanism riding the same slice)** —
  `ai_conversation` gained nullable `context_kind`/`context_date` columns;
  `CreateConversationRequest.context {kind: week|day, date}` anchors a new conversation, and
  `WeekContextRenderer` (companion) renders the `[Heti adatok]` block (day lines + weekly
  aggregates +, when found via the `WeekReviewSource` port this doc's `WeekReviewSourceAdapter`
  implements, the review's own summary/day-notes) into every turn's system prompt.
  `ChatService.openingTurn` then fires a server-generated, **assistant-only** first turn (the
  kickoff prompt itself is never persisted as a user message) so Mezo speaks first about the
  anchored day/week. The `/me/week` „Beszélgess a napról/hétről" chips (`useChatHandoff`) are the
  sole FE trigger. Full prompt-assembly detail: [`companion.md`](companion.md); the port/adapter
  split exists purely to keep the dependency **proactive → companion** one-directional (proactive
  already depends on companion elsewhere in this doc; a direct `companion.service →
  proactive.repository` import would close a NEW slice cycle, `ArchitectureTest.
  feature_slices_are_cycle_free`).
- **The FE surface (`/me/week`'s `WeekReviewCard`/`WeekDiscoveries`, `mezo-p2tr`)** — this is a
  **`me`-owned page**, not an Insights tab (unlike every other proactive surface in this doc): it
  RETIRES the old Insights „Heti" tab outright (`useWeekly`/`WeeklyPage` deleted,
  `/insights/weekly` now redirects to `/me/week`, [`insights.md` §2.2](insights.md)) rather than
  un-ghosting a new one. `useWeeklyReview(start)` (dual-mode, `data/me/weeklyReviewHooks.ts`) reads
  the review + digest (404→`null` on the review, never thrown) and drives the regenerate mutation;
  full component anatomy: [`me.md`](me.md) `Heti` §2/§4/§8/§10.

**Status per layer:**

| Layer | State | Notes |
|---|---|---|
| Backend (table + envelope + generator + unified read) | 🟢 `mezo-gst9` | `companion_message` table (5 kinds); behind BOTH `mezo.feature.companion.enabled` AND `mezo.feature.proactive.enabled`; either off ⇒ the whole HTTP surface 404s. |
| Companion-feed generation (morning/sleep/weight/midday/evening) | 🟢 `mezo-gst9` | `CompanionMessageGenerator`, one method per kind; pure-code gather + ONE cheap-tier `CompanionLlm.complete`; morning gather uses `renderWithoutBiometrics` (no sleep/weight leak); sleep/weight gated on a FRESH log existing; midday/evening ported from the retired heartbeat; empty-window/unusable ⇒ no row. |
| Crons (dawn + midday + evening pre-generation) | 🟢 `mezo-gst9` | `CompanionMessageJob` — `runMorning` (05:45) generates the morning message only — the sleep reaction is event-kind (mezo-qn3z); `runMidday`/`runEvening` (12:30/20:30); today-only per user (NO backfill — the lazy GET is the miss-recovery); ONE third switch `feed-job.enabled` for all three (replaces the old `briefing-job`+`heartbeat-job` pair). |
| Event triggers (sleep/weight log → reaction message) | 🟢 `mezo-gst9` | `CompanionMessageEventListener` — `@Async` `@TransactionalEventListener(AFTER_COMMIT)` on `SleepLogSavedEvent`/`WeightLogSavedEvent` (published by `SleepLogService`/`WeightLogService`); backfilled/old logs never trigger. **Replaces the retired sleep-triggered "regen" (`refreshIfStale`)** — see §9. |
| Frontend (Today MezoChip thread) | 🟢 `mezo-gst9` | `useCompanionFeed()` (`['companionFeed', date]`, 60s poll real mode); `buildMezoMessages` maps the feed 1:1 to thread bubbles, prepending an honestly-labelled demo card only while no `morning` kind exists; the retired `CompanionNoteCard`/`useCompanionNote()` are gone. |
| Weekly suggestion (table + generator + Monday cron + lazy read) | 🟢 W1 | `weekly_suggestion` table (ISO-Monday identity, partial unique); smart-tier `WeeklySuggestionGenerator` (gather = snapshot + facts + prior-week summaries + patterns → ONE `completeSmart` call, honest-null); Monday-06:00 `WeeklySuggestionJob` (three-switch, no backfill); `GET /api/proactive/weekly-suggestion` (lazy; 404 = empty prior week). |
| Frontend (Insights Weekly card swap, shipped W1) | 🟢 → moved `mezo-p2tr` | `useWeekly().weeklySuggestion` real (404→null) on the retired `WeeklyPage`; the same endpoint is now read by `/me/week`'s `Heti` hub (`useWeekNextSuggestion`, current week only) — honest placeholder still applies. |
| Memoir (table + generator + Sunday cron + lazy read) | 🟢 W2 | `memoir` table (ISO-Monday identity, partial unique, typed-jsonb `anchors`); smart-tier `MemoirGenerator` (gather = the week's OWN summaries + facts + patterns + numbered anchor candidates → ONE `completeSmart` call, model-selected anchors, honest-null); Sunday-19:00 `MemoirJob` (three-switch, no backfill); `GET /api/proactive/memoir` (no params; latest row else lazy-generate the LAST COMPLETED week; 404 = empty week). |
| Frontend (Insights Memoir tab un-ghost) | 🟢 W2 | `useMemoir()` real (404→null); `memoir` left `PHASE3_TAB_IDS`, `MemoirPage` guard dropped; renders the real memoir + derived week label, else the honest „készül" null-state; anniversary/archive mock-only, and since **W4.1** (`mezo-b3pp.15`) a real 👍/👎 chip row in both modes replaces the retired mock reactions. |
| Predictions (table + generator + validation + weekly/daily job + list read) | 🟢 P1 | `prediction` table (week_start idempotence probe, nullable confidence, CHECK-pinned direction/status); smart-tier `PredictionGenerator` (gather = snapshot + facts + numbered CONFIRMED-pattern candidates + metric catalog → ONE `completeSmart`, code-set windows, pattern-copied confidence, honest-empty); deterministic `PredictionValidationService` (window-vs-prior-7-days, no-data ⇒ stays pending); `PredictionJob` two crons (Mon 06:30 generate + daily 06:15 validate, three-switch); `GET /api/proactive/prediction` (list; lazy current-week; `[]` = honest empty, never 404). |
| Frontend (Insights Predictions tab un-ghost) | 🟢 P1 | `usePredictions()` real (list, `[]` on error); `predictions` left `PHASE3_TAB_IDS`, `PredictionsPage` ghost dropped; renders real cards („tanulom" on null confidence, `✗ Missed` state, accuracy header derived from closed rows), else the honest „still learning" null-state; mock keeps the Phase-1 seed + literal header. |
| Experiments (table + proposal + outcome + write path + two-cron job) | 🟢 P2 | `experiment` table (proposed/active/completed/dismissed lifecycle, nullable start_date/outcome_good); smart-tier `ExperimentProposalGenerator` (cap-gated, CONFIRMED-pattern-grounded); deterministic `ExperimentOutcomeService` (shared `MetricWindowEvaluator`); **write path** `POST …/decision` (L2, 409 on non-proposed) + `POST …/propose`; list `GET` (lazy propose, `[]` = honest); `ExperimentJob` two crons (weekly propose + daily outcome, three-switch). |
| Frontend (Insights Experiments tab un-ghost) | 🟢 P2 | `useExperiments()` + `useExperimentActions()` (mutation accept/dismiss/propose); `experiments` left `PHASE3_TAB_IDS` (now EMPTY — all 7 tabs real); `ExperimentsPage` renders proposed (Elfogadom/Elvetem) / active (progress) / completed (outcome) rows + a real propose CTA, else the honest null-state. |
| Workout challenges (table + generator + set-level evaluator + write path + outcome cron) | 🟢 HBWI | `challenge` table (proposed→accepted/dismissed→hit/miss/inconclusive, nullable confidence, structured targets); lazy-on-prep `ChallengeGenerator`; deterministic set-level `ChallengeOutcomeEvaluator` (NEW, not `MetricWindowEvaluator`); `GET …/challenge?templateSessionId=&date=` (lazy generate + lazy resolve, `[]` = honest) + `POST …/challenge/{id}/decision`; `ChallengeJob` outcome-cron backstop (three-switch). |
| Weekly review (table + generator + Monday-06:50 backward job + read/regenerate/digest) | 🟢 WR (`mezo-p2tr`) | `weekly_review` table (ISO-Monday identity, partial unique, jsonb day-notes + highlights); smart-tier `WeeklyReviewGenerator` (gather = `MeWeekService` day lines + confirmed patterns + new facts + life events + memoir + predictions → ONE `completeSmart`, model-selected highlights, honest-empty); `WeeklyReviewJob` (Mon 06:50, backward — the JUST-FINISHED week, three-switch); `GET/POST` read/regenerate/digest (never lazy on the primary GET, 409 while the week is in progress). `WEEKLY_REVIEW_READY` app-notification + `WEEKLY_REVIEW` Monday-10:00 push (retires the old `WEEKLY` category, kept `@Deprecated`). |
| Anchored chat conversations (`ai_conversation.context_kind/.context_date`) | 🟢 WR (`mezo-p2tr`) | Companion-owned: `WeekContextRenderer`'s `[Heti adatok]` block (via the `WeekReviewSource` port this doc's `WeekReviewSourceAdapter` implements) + `ChatService.openingTurn`'s assistant-only server-generated first turn. Full detail: [companion.md](companion.md). |
| Frontend (`/me/week`'s `WeekReviewCard`/`WeekDiscoveries`, chat handoff) | 🟢 WR (`mezo-p2tr`) | `useWeeklyReview()` (review + digest + regenerate) + `useChatHandoff()`; RETIRES the old Insights „Heti" tab (`/insights/weekly` → `/me/week` redirect) rather than un-ghosting a new one. Full anatomy: [me.md](me.md) `Heti` §2. |
| Frontend (ActiveWorkoutPage challenge surface) | 🟢 HBWI | `useChallenges()`/`useChallengeActions()` (`data/train/challengeHooks.ts`); `ActiveWorkoutPage` prep feeds the live list into `ChallengesCarousel`, accepted map + `decide()` from server status in live (local toggle in mock, byte-parity); `ChallengeCard` honest states — „tanulom" on null confidence, tools hidden in live, `hit/miss/inconclusive` outcome chip + line with the accept/skip row hidden. |
| **Epic status** | ✅ COMPLETE | Original 8 slices shipped (B1.1→B1.2→W1→W2→H1→P1→P2); **H2 Web Push shipped** (N1+N2+N3, `mezo-h4wp.6`, 2026-07-29); **`mezo-gst9` (2026-08-15) then redesigned B1.1/B1.2/H1 into the unified companion feed above** (W1/W2/P1/P2/HBWI unaffected); **`mezo-p2tr` (2026-08-27) then added WR — the backward-looking weekly review** (a post-epic addition, the HBWI precedent: a new proactive-idiom surface layered on top of a finished epic, this one riding the `me`-owned `/me/week` page rather than an Insights tab). Every prose/forecast Insights + Today + `/me/week` surface is honest and real — and reaches the lock screen too. |

**Driver:** `mezo-gst9` (companion feed, the current B/H-stage design) on top of `mezo-h4wp.4`
(W2)/`mezo-h4wp.1`'s spine. **Design of record (current B/H model):**
[`docs/superpowers/specs/2026-08-15-companion-feed-design.md`](../superpowers/specs/2026-08-15-companion-feed-design.md).
**Design of record (W/P/HBWI, and the original — now superseded — B/H design):**
[`docs/superpowers/specs/2026-07-06-proactive-layer-design.md`](../superpowers/specs/2026-07-06-proactive-layer-design.md)
(§2 hybrid generation, §5 weekly suggestion, §6 honest-numbers guardrails, §7 emptiness gate); slice
map [`docs/superpowers/plans/2026-07-06-proactive-roadmap.md`](../superpowers/plans/2026-07-06-proactive-roadmap.md)
§B1.1–§B1.2 + §W1 + §W2. Builds on the [companion](companion.md) stack (snapshot/facts/summaries/patterns).

**Diagnózis — the first ON-DEMAND report (`mezo-hqfi`, backend ✅ / FE ✅).** Everything else in
this domain generates on cron. The diagnosis is user-triggered: it answers a *phenomenon* question
(V1: fatigue — „Miért vagyok fáradt?") with 2–4 ranked suspects, each bound to code-collected
measured evidence the model selects **by index**, and each carrying one probe that becomes a
tracked `ExperimentEntity` on a single call. It reuses the weekly-review artifact machinery
(persisted row + `stale` probe + `FeedbackChips`) and adds the axis that machinery lacked:
on-demand generation under a per-day quota. Details in §4 below.
Design of record: [`docs/superpowers/specs/2026-08-31-diagnosis-report-design.md`](../superpowers/specs/2026-08-31-diagnosis-report-design.md);
plan: [`docs/superpowers/plans/2026-08-31-diagnosis-report-backend.md`](../superpowers/plans/2026-08-31-diagnosis-report-backend.md).

## 2. User-facing behavior

**Live since `mezo-gst9` — the Today MezoChip message thread.** When Daniel opens the app the
`MezoChip`'s preview shows the **latest** companion-feed message, and tapping it opens the full
thread: a **morning** message about his day (never HIS night or weight — sleep/weight-free by
construction, so it can't be stale or wrong about them), a **sleep** reaction the moment he logs
last night, a **weight** reaction the moment he weighs in, and **midday**/**evening** notes at their
usual windows — each with **real reference chips** where the kind carries them (morning/sleep/
weight) and **no label** — zero demo copy, except the one honest exception below. The dawn/midday/
evening crons usually write the cron kinds ahead of time; a missed one lazily generates on the next
GET. The sleep/weight messages are event-triggered — they appear within moments of logging (the FE
polls every 60s and also invalidates on the log's own mutation), not on any fixed clock, so they are
never stale by construction (the point of the whole redesign — see §1).

**The honest fallback.** While the day's `morning` message hasn't landed yet — the proactive/
companion/cron switch is off, generation failed / the narrative window is empty, the read is still
loading, or it's simply too early — the thread's first bubble is the **static Phase-1 demo copy
behind the „Demo tartalom" label** ([today.md](today.md)), prepended by `buildMezoMessages`, the
degraded state rather than the default; once a real `morning` message exists the demo card
disappears. In **mock mode** the thread is always just this one static card (byte-parity with
Phase-1) — the feed itself is always `[]` in mock mode.

See [today.md §2](today.md) for the thread in the context of the full Today screen.

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
készül el."* — never demo fiction. In **live mode the „Évforduló · 1 hónap"
anniversary card and the „Memoir archive · 17 darab" footer are hidden** (unpersisted interactivity /
deferred surfaces = false affordance); **mock mode** keeps the Phase-1 demo (seed memoir + anniversary
+ archive, byte-parity). The Phase-1 **reaction toggles are gone from both modes since W4.1**
(`mezo-b3pp.15`) — a real 👍/👎 chip row took their place, and unlike them it renders live too. See [insights.md §2.3](insights.md) for the tab in
the context of the full Insights sub-nav (Memoir now shows as the 3rd of 5 real-mode tabs).

**H1's separate companion-note card is retired.** The midday nudge / evening closing observation it
introduced — 2-3 sentences grounded in the day's actual state, explicitly told not to repeat the
morning message — now arrive as `midday`/`evening` bubbles in the SAME MezoChip thread described
above, not a second card under the check-in strip. Same honest-absence rule, same window crons, same
lazy miss-recovery — just one thread instead of two surfaces.

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
`tools` — the W1/W2 false-affordance lesson), and **„⚔️ Elfogadom" (pre-bxpg: „Vállaljuk") is a real L2 decision** — it `POST`s
accept/dismiss (`useChallengeActions.decide`) and the accepted state derives from the server `status`
(`accepted | hit | miss`). Once the workout is decided the card shows the **outcome chip + line** and
**hides the accept/skip row**: `hit → ✓ Megerősítve` (success), `miss → ◯ Nem igazolódott` (muted, no
red/no-penalty tone), `inconclusive → ◌ Nem értékelhető` (tertiary) — the same wording as the
Experiments tab. The carousel renders **honest absence** (`null`, no rail) when the live list is empty.
In **mock mode** the Phase-1 seed is byte-preserved: `conf 72%`, the tool chips, and a **local** accept
toggle (no backend). Data via `useChallenges`/`useChallengeActions` (`data/train/challengeHooks.ts`,
unified so `challenges` drives both modes). See [train.md §Active workout](train.md).

## 3. Architecture & data flow

**The unified feed read (`mezo-gst9` — persisted rows · lazy cron-kind miss-recovery · no 404):**

```
GET /api/proactive/feed?date=YYYY-MM-DD        (date optional)
  → ProactiveController.getFeed(date)              controller/ProactiveController.java  (implements ProactiveApi)
      currentUserId.get()  (JWT subject → UUID; techcore/security/CurrentUserId)
  → ProactiveFeedService.getFeed(userId, date)   service/ProactiveFeedService.java  (NO @Transactional — §9 read-path isolation)
      day = date != null ? date : LocalDate.now()          (FE sends its LOCAL date — check-in precedent)
      if day == today: ensureTodayCronKinds(userId, day)   (below — cron-kind miss-recovery ONLY)
      findByCreatedByAndMessageDateOrderByGeneratedAtAsc(userId, day)
      → List<FeedMessageResponse>   (possibly empty — `200 []` is the honest state, NEVER 404)
```

```
ensureTodayCronKinds(userId, day):                   service/ProactiveFeedService.java
  generateQuietly(MORNING)                            ALWAYS attempted (its cron is dawn — always elapsed by any read)
  if elapsed(feed.midday-cron, day):  generateQuietly(MIDDAY)
  if elapsed(feed.evening-cron, day): generateQuietly(EVENING)
  (generateQuietly = try/catch + warn — a failed generate must not cost the reader the rest)
  (elapsed = CronExpression.parse(cron).next(dayStart) has passed "now" — the retired heartbeat's
   window-fire-time idiom, one source of truth for the schedule)
```

**Event kinds (`sleep`/`weight`) are NEVER generated by the read path** — only their own events
create them (below). This is the one behavioral asymmetry vs the old briefing/heartbeat reads: those
were single-resource 404-on-absence; the feed is a list, so absence is simply a shorter array.
**The `advice` card (S4, bd `mezo-d58h.4`, successor to W5.2's `intervention`) follows the SAME
precedent** — `ensureTodayCronKinds` above only ever attempts `morning`/`midday`/`evening`;
`sleep`/`weight`/`advice` are all event-born and share zero code with the cron miss-recovery path.
The trigger differs, though: a flag-sourced advice candidate is fired by
`feature.companion.flags.service.FlagRaisedEvent` (a companion flag raise, §5.8 below), consumed by
`feature.proactive.service.InterventionEventListener` — a SEPARATE listener from this section's
`CompanionMessageEventListener`, not a third method on it, since the trigger event lives in a
different feature package. The listener still calls `InterventionService.deliverForFlag`, which now
ends by handing its picked library entry to `AdviceCardService.deliver` instead of writing the row
itself (§3 below).

**The per-user fan-out (S6, `mezo-qw37.6`) — every cron in this doc.** No job walks
`appUserRepository.findAll()` any more: each one takes `feature/auth/service/UserFanOut` and calls
`userFanOut.forEachActiveUser("<job name>", user -> …)`, which (a) visits only **ACTIVE + onboarded**
accounts (`AppUserRepository.findByStatusAndOnboardedAtIsNotNull` — a disabled or half-onboarded
account gets no generated content and burns no tokens), (b) runs each user's body inside
`LlmActorContext.runAs(user.getId(), …)` so `llm_log_history.created_by` names the user the job ran
for instead of the `Háttér` bucket ([`beta-admin.md`](beta-admin.md) §5), and (c) catches a
`Throwable` per user so one bad account never aborts the run — the jobs keep their own finer-grained
try/catch INSIDE the body on top of it. The pseudocode blocks below write the loop as
`userFanOut.forEachActiveUser(…)`.

**Setup checks (S3, bd `mezo-d58h.3`) sit OUTSIDE this whole read/event picture — cron only, no
listener at all.** Every other kind above is fired either by the lazy feed read (`morning`/`midday`/
`evening`) or by a write event (`sleep`/`weight`/advice's flag-raise path/`people`'s dawn-cron
cousin); a setup CHECK reacts to the user's own CONFIGURATION (a sleep goal that doesn't exist, a
plan that no longer fits the week), and no write announces "the configuration changed" the way
`SleepLogSavedEvent` announces a new log — so there is nothing to hang an on-write listener on, and
`ProactiveFeedService.getFeed`/`ensureTodayCronKinds` never call `SetupCheckService`. The daily
`SetupCheckJob` (`06:10`, `mezo.proactive.setup-checks.cron`, gated on `COMPANION_SWITCH` ∧
`PROACTIVE_SWITCH` ∧ the new `SETUP_CHECK_JOB_SWITCH`) is the WHOLE delivery mechanism — it followed
`FlagSweepJob` onto the S6 fan-out above (`userFanOut.forEachActiveUser`, own per-user try/catch
kept on top) and calls `SetupCheckService.runFor(userId)`:

```
SetupCheckService.runFor(userId):                    service/SetupCheckService.java
  today = LocalDate.now()
  if SleepGoalRepository.findByCreatedByAndDeletedFalse(userId).isEmpty():
      emit(MISSING_SLEEP_GOAL)                        checks are ORDERED, first-wins
  else:
      PlanFeasibilityCalculator.evaluate(userId, today)
        .filter(!verdict.feasible())
        .flatMap(verdict -> emit(PLAN_FEASIBILITY, text-from(verdict)))

emit(userId, checkKey, text):
  if inReEmitWindow(userId, checkKey): return empty   (weekly re-emit window, unchanged below)
  adviceCardService.deliver(userId, AdviceCandidate.fromSetupCheck(checkKey, EYEBROW, [text], text))
                                                       (S4: the day gate + severity comparison now
                                                        live in AdviceCardService, not here — see
                                                        "One card per day" below)
```

**The ghosting trap — why `runFor` reads `SleepGoalRepository` directly instead of going through
`SleepGoalService`/`SleepAnchorResolver`:** both of those fall back to a config-default ghost goal
when no `sleep_goal` row exists for the user, precisely so `GET /api/sleep/goal` **never 404s**
(`SleepGoalService.getGoal` serves the config-default ghost — WAKE 06:00 / 480 min / band 15 →
bed 22:00, from `SleepGoalProperties`) and every other consumer always has something plausible to
render (the FE `useSleepGoal()` ghosts it too — its `realEmpty` is `SLEEP_GOAL_GHOST`, see
[`me.md`](me.md) §4/§9) — which means the missing-row condition is INVISIBLE through
either of them. `SetupCheckService` is the one caller in the codebase that needs to know the row is
actually absent, so it calls `sleepGoalRepository.findByCreatedByAndDeletedFalse(userId).isEmpty()`
straight off the repository, bypassing both ghosting layers.

**`emit`'s `inReEmitWindow(userId, checkKey)` enforces the weekly re-emit window** (`reEmitHours`,
default 168h = 7 days) — the same cooldown idiom `InterventionService` uses for its per-flag-key
cooldown, here keyed on the envelope's `setupKey` field instead of `interventionKey`: it reads
every `advice`- or `setup`-kind row generated for the user inside the window (BOTH kinds, so a
pre-S4 `setup` row still counts) and skips if any of them carries this SAME `checkKey`, so the SAME
check does not repeat inside the window but a DIFFERENT check (e.g. the plan-feasibility card
firing right after the goal card resolves) is unaffected. A `checkKey` surviving the re-emit window
is only a CANDIDATE at this point — whether it actually becomes today's card is `AdviceCardService`'s
call, next.

**One card per day (S4, bd `mezo-d58h.4`, spec §4/§5) — `AdviceCardService` is the ONE writer of
the `advice` kind.** It replaces two independent first-wins gates S1–S3 shipped
(`InterventionService` gating on `kind=intervention`, `SetupCheckService` gating on `kind=setup`)
that, between them, could land TWO cards on the same day — one from a flag raise, one from the
cron. `InterventionService.deliverForFlag` and `SetupCheckService.emit` now do only what is
theirs — the library filter + per-entry cooldown + effectiveness weighting for the former, which
check speaks + the weekly re-emit window for the latter — and both end by building an
`AdviceCandidate` and calling `AdviceCardService.deliver(userId, candidate)`:

```
AdviceCardService.deliver(userId, candidate):        service/AdviceCardService.java   @Transactional
  today = LocalDate.now()
  incumbent = findByCreatedByAndMessageDateAndKind(userId, today, KIND_ADVICE)
  if incumbent present:
      if !AdvicePriority.outranks(candidate.adviceKey(), incumbent.adviceKey()):
          return empty                                 ── candidate does not STRICTLY outrank
                                                            today's card; dropped, incumbent kept
      delete(incumbent); flush()                        ── soft delete — the partial unique index
                                                            (…where is_deleted = false) then allows
                                                            the reinsert below in the SAME tx
      (the superseded card's „Segített?" votes are left dangling BY DESIGN — spec §8.1 names a
       dangling feedback artifact harmless in a single-user app; nothing re-points them)
  prose = adviceProseGenerator.write(userId, candidate)  (§5.2 below)
  saveAndFlush CompanionMessageEntity{kind=advice,
      content = Envelope.advice(eyebrow, prose, candidate.adviceKey(),
                                 candidate.interventionKey(), candidate.setupKey(),
                                 candidate.facts(), candidate.suggestions())}
```

`AdvicePriority.outranks(candidateKey, incumbentKey)` is a pure static lookup over `AdvicePriority.ORDER`
— the spec §4 severity order as an editorial ranking IN CODE, not config (thresholds stay in
`FlagProperties`/`SetupCheckProperties`; this table only says which PROBLEM deserves the day's one
card). Lower rank = more severe; comparison is STRICT (`<`, not `<=`), so a re-raise of the SAME
flag — equal rank — does NOT displace the incumbent and leaves its votes alone. An unmapped key
ranks one past the end of the table and logs a warning rather than throwing (an unmapped key must
never blow up delivery inside `InterventionEventListener`'s catch); `AdvicePriorityTest` asserts
every live `FlagKey` constant has a rank, so the warning path is a last resort, not the normal way a
new key behaves. `AdviceCardService` is deliberately NOT conditioned on `INTERVENTION_SWITCH` —
`SetupCheckService` (which runs without that switch) is one of its two callers, so gating this bean
on the intervention switch would fail the Spring context whenever that switch is off.

**The crons (`mezo-gst9` — `service/CompanionMessageJob.java`):**

```
@Scheduled(cron = "${mezo.proactive.feed.morning-cron}")   05:45 server zone; three-switch bean
  today = LocalDate.now()
  userFanOut.forEachActiveUser("Companion-feed morning", user):   (ACTIVE + onboarded only; body under LlmActorContext.runAs)
     try  companionMessageGenerator.generateMorning(user.id, today)   (TODAY only — no backfill)
     catch → log.warn + continue                                      (per-user isolation)
     try  companionMessageGenerator.generatePeopleObservation(user.id, today)   (Emberek S6,
          mezo-06o0.8 — deliberately only here, not the lazy ensureTodayCronKinds path)
     catch → log.warn + continue                                      (per-user isolation)
     ── no sleep-reaction call here (mezo-qn3z): at 05:45 tonight's sleep isn't logged yet, so the
        generator's >= today-1 freshness gate would pick up YESTERDAY's row and narrate it as
        tonight's; the reaction is event-kind only, see below

@Scheduled(cron = "${mezo.proactive.feed.midday-cron}")   runWindow(MIDDAY)
@Scheduled(cron = "${mezo.proactive.feed.evening-cron}")  runWindow(EVENING)
  (same forEachActiveUser fan-out + per-user try/catch, TODAY only, idempotent)
```

Idempotent (an existing row is returned untouched, no LLM call), so a cron run overlapping the lazy
GET can't double-generate. **No catch-up loop** — a past morning/window is never read, and a missed
run is covered by the lazy GET the next time the app opens (the old briefing/heartbeat §9 decision f
reasoning, unchanged).

**Event triggers (`mezo-gst9` — `service/CompanionMessageEventListener.java`), the NEW half the old
model never had:**

```
SleepLogService.log(...) / WeightLogService.log(...)     @Transactional
  ... persist the row ...
  eventPublisher.publishEvent(new SleepLogSavedEvent(userId, date))   ── right before returning,
                                                                          INSIDE the tx (so AFTER_COMMIT
                                                                          only fires once durable)

CompanionMessageEventListener                            @Async  @TransactionalEventListener(AFTER_COMMIT)
  onSleepLogged(event):
    if event.date().isBefore(today.minusDays(1)) → return    ── backfilled/old log never triggers
    try  generator.generateSleepReaction(event.userId(), today)
    catch → log.warn                                          (never fails the original log request —
                                                                 it already committed)
  onWeightLogged(event):  same shape, gate = event.date().equals(today)
```

`@Async` off the request thread (the `applicationTaskExecutor`, the `PushDispatchExecutor`
precedent) means a slow/failed LLM call never delays or fails the sleep/weight-logging response
itself.

**The generator (`service/CompanionMessageGenerator.java`) — one method per kind, same idiom
throughout (pure-code gather → ONE `CompanionLlm.complete` call → defensive-parse → bounds-checked
ref-resolution → `saveAndFlush`):**

```
generateMorning(userId, date)                           @Transactional
  1. existing row? ⇒ return untouched                   (idempotent; NO LLM call)
  2. gather: past = last feed.past-days daily_summary narratives (newest first)
       past.isEmpty() ⇒ return null                      ── THE EMPTINESS GATE
       payload = ContextSnapshotAssembler.renderWithoutBiometrics(userId, date)   ── NOT .render:
               sleep/weight stripped AT THE SOURCE, not just prompt-forbidden (companion.md)
               + KnowledgeFactService.renderPromptBlock + "KORÁBBI NAPOK" + numbered candidates
       candidates = Goal/Workout/FuelDay/Medication (NO WeightTrend/Sleep) + one Memory per summary
       + missedWorkoutsBlock(userId, date) (S4, spec §4 row 3): a live `missed_workouts` raise's
         OWN frozen `companion_flag_log.payload`, inside the same feed.past-days lookback window —
         "no more blind cheering" — never re-derived, "" when no raise is in-window
  3. companionLlm.complete(MORNING_PROMPT, payload)      ── ONE cheap-tier call
  4. parse(answer) → null/blank eyebrow/empty body ⇒ return null   (unusable answer, NO row)
  5. resolveRefs(refIndexes, candidates)                 bounds-checked, deduped, model-SELECTED only
  6. saveAndFlush CompanionMessageEntity{kind=morning, content envelope, generatedAt=now truncated-µs}

generateSleepReaction(userId, date)                      @Transactional
  1. existing row (kind=sleep, date)? ⇒ return untouched
  2. gate: latest sleep log dated >= date-1 ? else return null   (the grounding event IS the gate —
                                                                    no daily_summary window check)
  3. gather: ContextSnapshotAssembler.render (FULL — sleep IS the topic) + facts +
       earlierMessagesBlock(today's already-persisted messages, "ne ismételd") +
       "MOST RÖGZÍTETT ALVÁS" (duration/quality/awakenings) + Sleep/Goal/Workout candidates
  4-6. same complete → parse → resolveRefs → saveAndFlush shape as morning (SLEEP_PROMPT)

generateWeightReaction(userId, date)                     @Transactional
  1. existing row (kind=weight, date)? ⇒ return untouched
  2. gate: latest weight log dated == date ? else return null
  3. gather: render (FULL) + facts + earlierMessagesBlock + "MOST RÖGZÍTETT MÉRÉS" (the raw kg,
       labelled "mérés:") + WeightTrendService's EWMA trend (labelled "trendérték (EWMA, simított):"
       — the two numbers explicitly distinguished so the model can't conflate a measurement with a
       trend) + WeightTrend/Goal/FuelDay candidates
  4-6. same shape (WEIGHT_PROMPT)

generateWindow(userId, date, kind)                       @Transactional   kind = midday | evening
  1. existing row (kind, date)? ⇒ return untouched
  2. gather: past-days summaries; empty ⇒ return null (same emptiness gate as morning)
       payload = render (FULL) + facts + latest daily_summary + earlierMessagesBlock + "ABLAK: …"
  3. companionLlm.complete(WINDOW_PROMPT, payload, toolRegistry.callbacks(audit),
       toolRegistry.toolContext(userId, audit))   ── tool-calling (mezo-106s), flat prose, NO JSON
  4. blank ⇒ return null
  5. saveAndFlush {kind, content = Envelope(code-set eyebrow, [answer.strip()], audit refs)}
       (eyebrow = "Napközi jegyzet"/"Napzárás" by kind; refs = audit.toRefsEnvelope() →
       Ref(kind, label=id) — empty list when no tool ran)
```

All four share `earlierMessagesBlock(userId, date)`: a `"MAI KORÁBBI ÜZENETEK (ne ismételd):"` block
built from every already-persisted `companion_message` row of the day (any kind) — the old
heartbeat's `MAI BRIEFING` dedupe block, generalized from ONE hardcoded source to all of them. Gather
= pure code (IT-asserted LLM-free), prose = pure LLM (NFR-M-4, unchanged from the old briefing
split). Each kind's prompt (`MORNING_MARKER`/`SLEEP_MARKER`/`WEIGHT_MARKER`/`WINDOW_MARKER` + HU
rules: invent-no-numbers, never suggest med-dose changes) mirrors the companion clinical/honest-
number guardrails the retired briefing prompt carried.

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
  userFanOut.forEachActiveUser("Weekly suggestion", user):        (ACTIVE + onboarded only; body under LlmActorContext.runAs)
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
suggestions, plain prose no markdown, invent-no-numbers, never suggest a medication-dose change)
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
  userFanOut.forEachActiveUser("Memoir", user):                  (ACTIVE + onboarded only; body under LlmActorContext.runAs)
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

**H1's heartbeat read/crons/generator are retired** — folded into the unified feed read
(`GET /api/proactive/feed`) and `CompanionMessageJob`/`generateWindow` documented above (§1/§3
companion-feed block). `midday`/`evening` are now just two more `companion_message` kinds.

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
calls `validateClosedWindows(user, today)` per user. Both fan out via
`userFanOut.forEachActiveUser("Prediction weekly" / "Prediction validation", …)` — ACTIVE + onboarded
accounts only, each body under `LlmActorContext.runAs` (the fan-out note above §3) — and keep their
own per-user try/catch on top; three-switch bean.

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

**Switch-gating.** `ProactiveController`, `ProactiveFeedService`, `CompanionMessageGenerator`,
`CompanionMessageEventListener`, `ProactiveWeeklySuggestionService`, `ProactiveMemoirService`,
`ProactivePredictionService`, `ProactiveExperimentService`, `WeeklySuggestionGenerator`,
`MemoirGenerator`, `PredictionGenerator`, `PredictionValidationService`, `MetricWindowEvaluator`,
`ExperimentProposalGenerator`, `ExperimentOutcomeService`, `ProactiveChallengeService`,
`ChallengeGenerator`, `ChallengeOutcomeEvaluator` (and the mapper via the services) are all
`@ConditionalOnProperty(name = {COMPANION_SWITCH, PROACTIVE_SWITCH}, havingValue = "true")` — **both**
must be `true`. Either off ⇒ no proactive beans ⇒ the whole `/api/proactive/*` surface 404s (there's
no controller to route to). The **six** jobs (`CompanionMessageJob`, `WeeklySuggestionJob`,
`MemoirJob`, `PredictionJob`, `ExperimentJob`, `ChallengeJob` — down from seven since `mezo-gst9`
merged the old `BriefingJob`+`HeartbeatJob` into one) each add a THIRD switch on top. The dual gate
is structural, not a runtime check (§9 gotcha b).

**Ownership.** `CompanionMessageEntity` + `WeeklySuggestionEntity` + `MemoirEntity` +
`PredictionEntity` + `ExperimentEntity` all `extend OwnedEntity` (soft-delete via
`@SQLDelete`/`@SQLRestriction`); `created_by` is stamped from `CurrentUserId.get()` server-side, the
finders (`findByCreatedByAndMessageDateAndKind` / `findByCreatedByAndMessageDateOrderByGeneratedAtAsc`
/ `findByCreatedByAndWeekStart` + `findFirstByCreatedByOrderByWeekStartDesc` for memoir) are owner +
soft-delete scoped. Standard auth spine ([`_platform-api-backend.md`](_platform-api-backend.md); the
companion precedent).

## 4. Data model & API

### Backend tables (companion feed `mezo-gst9` + W1 + W2 + P1 + P2 + HBWI, 🟢)

Migrations `202608151200_mezo-gst9_create_companion_message.sql` +
`202608151230_mezo-gst9_drop_briefing_heartbeat_note.sql` (drops `briefing` + `heartbeat_note` — the
old B1.1/B1.2/B1.2-regen/H1 changesets `202607061100_mezo-h4wp.1_create_briefing.sql` /
`202607070900_mezo-h4wp.2_briefing_regen_count.sql` / `202607071800_mezo-h4wp.5_create_heartbeat_note.sql`
themselves stay untouched — Liquibase changesets are immutable once released, so a drop is a NEW
changeset, not an edit) + `202607071200_mezo-h4wp.3_create_weekly_suggestion.sql` +
`202607071500_mezo-h4wp.4_create_memoir.sql` + `202607071900_mezo-h4wp.7_create_prediction.sql` +
`202607072000_mezo-h4wp.8_create_experiment.sql` + `202607072100_mezo-hbwi_create_challenge.sql`
(all registered in `db/changelog/1.0.0/1.0.0_master.yml`):

- **`companion_message`** (`mezo-gst9`, replaces `briefing` + `heartbeat_note`) — `id uuid pk
  (gen_random_uuid())`, `created_by uuid fk→app_user(id) ON DELETE CASCADE`, `is_deleted boolean not
  null default false`, `created_at timestamptz not null default now()`, `message_date date not null`
  (the day it is FOR — not when generated), `kind varchar(16) not null` (CHECK
  `morning|sleep|weight|midday|evening|intervention|people|setup|advice` — the sixth value,
  `intervention`, is W5.2's, migration `202608241500_mezo-b3pp.19_companion_message_intervention_kind.sql`,
  a CK-swap-only widening; the seventh, `people`, is **Emberek S6**'s (`mezo-06o0.8`), another
  CK-swap-only widening; the eighth, `setup`, is **S3**'s (`mezo-d58h.3`), migration
  `202609040900_mezo-d58h.3_companion_message_setup_kind.sql`, another CK-swap-only widening; the
  ninth, `advice`, is **S4**'s (`mezo-d58h.4`), migration
  `202609041000_mezo-d58h.4_companion_message_advice_kind.sql`, another CK-swap-only widening — see
  the W5.2 subsection below, §3.x for `people`, §3/§9 above for `setup`, and §3 above ("One card per
  day") for `advice`. **`intervention` and `setup` stay in the CHECK only for pre-S4 rows —
  nothing writes either kind any more, `advice` is the one coaching-card kind now written**),
  `content jsonb not null` (the typed envelope, the old
  `BriefingContentEnvelope` idiom renamed `CompanionMessageEnvelope`), `generated_at timestamptz not
  null`. Uniqueness is a **partial unique index**
  `uq_companion_message_created_by_date_kind … where is_deleted = false` (one LIVE message per
  user+day+**kind** — the briefing's precedent, widened by one column; a second same-day weigh-in
  probes this index and finds the existing row, so it's idempotent rather than blocked). **No
  `regen_count`** — the column that made `refreshIfStale` possible has no successor; nothing in this
  table is ever staleness-refreshed (§9 decision retired-regen).
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
  `type varchar(10) not null` (CHECK `PR|Depth|Volume|overload` — extended by the
  `202607280641_mezo-gj42` migration), `status varchar(12) not null default
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

`CompanionMessageEntity` (`entity/CompanionMessageEntity.java`, replaces `BriefingEntity` +
`HeartbeatNoteEntity`) `extends OwnedEntity`, UUID `@GeneratedValue` id, soft-deleted; `messageDate`/
`kind` (the `KIND_MORNING`/`KIND_SLEEP`/`KIND_WEIGHT`/`KIND_MIDDAY`/`KIND_EVENING`/`KIND_INTERVENTION`/`KIND_PEOPLE`/`KIND_SETUP`/`KIND_ADVICE`
— `KIND_INTERVENTION` is W5.2's, `KIND_PEOPLE` is Emberek S6's (`mezo-06o0.8`), `KIND_SETUP` is
S3's (`mezo-d58h.3`), `KIND_ADVICE` is S4's (`mezo-d58h.4`) — constants) +
`generatedAt`, and `content` maps as a typed jsonb via `@JdbcTypeCode(SqlTypes.JSON)` onto
`CompanionMessageEnvelope` (`entity/CompanionMessageEnvelope.java`, renamed from
`BriefingContentEnvelope`) — a record `{String eyebrow, List<String> body, List<Ref> refs,
String interventionKey, String setupKey, String adviceKey, List<String> facts,
List<String> suggestions, List<FeedAction> actions, Applied applied}` with a nested `Ref(String
kind, String label)` (ADR 0006 / `ProvenanceEnvelope` typed-jsonb precedent, unchanged), plus S5's
(`mezo-d58h.5`) trailing `FeedAction(String key, String label, Map<String, Object> params)` and
`Applied(String actionKey, Instant at)`. The envelope **deliberately mirrors the FE
Briefing shape MINUS `confidence` and `tone`** (§9 gotcha c, unchanged — a fabricated-number rule
that predates and outlives the rename). `refs` are code-collected candidates the model selected by
index, never invented — empty for the `midday`/`evening` kinds (the retired heartbeat generator
never collected refs either) and ALWAYS empty for `intervention`/`setup`/`advice` (config text and
deterministic facts have nothing to select refs from). **`actions`/`applied` (S5) are set ONLY on
`kind=advice` rows, and `actions` is ALWAYS rule-provided — `AdviceProseGenerator`'s LLM call never
sees them and never writes them; the model writes prose only.** `actions` is
`AdviceActionCatalog.forCard(userId, adviceKey)`'s output at generation time, capped at two entries
(`AdviceActionCatalogTest` enforces the cap; the `MAX_ACTIONS_PER_CARD` constant on the catalog is
documentation only, not a runtime guard) and empty for every `adviceKey` the catalog does not
recognise; `applied` is `null` until `AdviceApplyService.apply` stamps it (§4 REST endpoints below).
**`interventionKey`** is set on pre-S4
`kind=intervention` rows AND on flag-sourced `kind=advice` rows — it names the
`mezo.companion.interventions[].key` library entry the card came from, so the „Segített?" verdict
rolls up per-entry ([companion.md](companion.md) §4), the per-entry cooldown reads it, and
`AnchorResolver`'s push anchor reads it too (§9 below); `null` on every other row. **`setupKey`** is
set on pre-S4 `kind=setup` rows AND on setup-sourced `kind=advice` rows — it names the check
(`SetupCheckService.CHECK_MISSING_SLEEP_GOAL` = `missing_sleep_goal` or
`CHECK_PLAN_FEASIBILITY` = `plan_feasibility`) so `emit`'s weekly re-emit cooldown can be keyed
per check (§3 above); `null` on every other row. **`adviceKey`/`facts`/`suggestions` (S4, bd
`mezo-d58h.4`) are set ONLY on `kind=advice` rows.** `adviceKey` is the SEVERITY key
`AdvicePriority` ranks — the flag key or the setup-check key — deliberately NOT the same identifier
as `interventionKey` (one flag can be served by several library entries). `facts` is
`AdviceFactRenderer`'s deterministic, numeric lines rendered from the raise's own frozen
`companion_flag_log.payload` (empty for a setup-sourced card, or for a flag with no payload — never
a placeholder). `suggestions` is config text (the library entry's `textHu`, or the setup check's own
text) — the ONLY facts/suggestions `AdviceProseGenerator` is allowed to lean on. The record's
CANONICAL constructor is now the 10-arg `(eyebrow, body, refs, interventionKey, setupKey, adviceKey,
facts, suggestions, actions, applied)` shape (S5, `mezo-d58h.5`); the pre-W5.2 3-arg, the W5.2 4-arg,
the S3 5-arg and the S4 8-arg constructors are ALL kept as overloads delegating to it (with `null`/
`List.of()` for the trailing fields), so every existing writer compiles unchanged. **No `regenCount`
field** — the column that made the old briefing's `refreshIfStale` possible has no successor on this
entity.
**S2's `logging_gap`/`missed_workouts` flag keys ([companion.md](companion.md) §3) finally got
library entries in S4** (`logging_gap_restart`/`logging_gap_sleep_suspicion` and
`missed_workouts_restart` in `mezo.companion.interventions`) — before S4 they raised and delivered
nothing: `InterventionService.deliverForFlag` found no candidates for either key and returned
`Optional.empty()` with an info log line rather than failing.

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
| `GET /api/proactive/feed?date=` | `FeedMessageResponse[]` | 200 · 401 | **Replaces the old `…/briefing` + `…/heartbeat`.** `date` optional (FE sends its LOCAL date; defaults to server today). The day's `companion_message` rows in generation order; for TODAY, cron-kind (morning/midday/evening) miss-recovery lazy-generates ahead of the read — event kinds (sleep/weight) never lazy-generate here. **`200 []` is the honest empty state, NEVER a 404** (a list endpoint — a behavioral change from the single-resource briefing/heartbeat reads it replaces). |
| `POST /api/proactive/advice/{id}/apply` | `FeedMessageResponse` | 200 · 400 · 401 · 404 · 409 | **S5 (`mezo-d58h.5`).** `{actionKey}`. `AdviceApplyService.apply` takes the per-user advisory lock FIRST (`CompanionMessageRepository.lockForDelivery`, the same lock `AdviceCardService.deliver` takes — the documented ordering invariant), then `findByIdAndCreatedBy`; **404 `PROACTIVE_ADVICE_NOT_FOUND`** covers an unknown id, a foreign-user id, AND a superseded card uniformly (`@SQLRestriction("is_deleted = false")` makes a soft-deleted superseded row invisible to this one finder — there is no separate superseded branch). A non-`advice`-kind card ⇒ **409 `PROACTIVE_ADVICE_NOT_ADVICE_CARD`**; an `actionKey` not present in the card's own `content.actions()` ⇒ **409 `PROACTIVE_ADVICE_ACTION_NOT_OFFERED`**. **Idempotent:** if `content.applied()` is already set, the SAME `actionKey` returns the card unchanged with the ORIGINAL `applied.at` (no second port call); a DIFFERENT `actionKey` ⇒ **409 `PROACTIVE_ADVICE_ACTION_CONFLICT`**. Otherwise dispatches to the `AdviceMutationPort` registered for that key (§9 below) and stamps `applied={actionKey, at=now}` on a fresh envelope. |
| `GET /api/proactive/weekly-suggestion?date=` | `WeeklySuggestionResponse` | 200 · 401 · 404 | `date` optional (any day of the wanted week; the week identity is its ISO Monday; defaults to server today). Persisted row or lazy-generate; **404 `RESOURCE_NOT_FOUND`** when the prior week has no `daily_summary` (§9 gotcha d) — the FE keeps its honest placeholder. |
| `GET /api/proactive/memoir` | `MemoirResponse` | 200 · 401 · 404 | **No parameters.** The LATEST persisted memoir, else lazy-generate the LAST COMPLETED week (`previousOrSame(MONDAY).minusWeeks(1)`); **404 `RESOURCE_NOT_FOUND`** when that week has no `daily_summary` (§9 gotcha d) — the FE renders its honest „készül" state. Archive (older rows) is a later slice. |
| `GET /api/proactive/prediction` | `PredictionResponse[]` | 200 · 401 | **No parameters.** ALL live predictions, newest window first; lazily generates the CURRENT week when it has no rows (needs CONFIRMED patterns). **`200 []` is the honest empty state — NEVER a 404** (a list endpoint). |
| `GET /api/proactive/experiment` | `ExperimentResponse[]` | 200 · 401 | **No parameters.** Live experiments (proposed/active/completed, dismissed excluded), newest first; lazily proposes when the user has none. **`200 []` = honest empty, never 404.** |
| `POST /api/proactive/experiment/{id}/decision` | `ExperimentResponse` | 200 · 400 · 401 · 404 · 409 | **L2 accept/dismiss** (`{decision: accept\|dismiss}`). `accept` ⇒ active + start_date=today; `dismiss` ⇒ dismissed. 404 = not-found/foreign; **409 `PROACTIVE_EXPERIMENT_NOT_PROPOSED`** = already decided; 400 = invalid decision value. |
| `POST /api/proactive/experiment/propose` | `ExperimentResponse[]` | 200 · 401 | On-demand proposal (the "+ Új kísérlet javasol Mezo" button). Up to the open-cap; `[]` when the cap is met / no confirmed patterns. |
| `GET /api/proactive/challenge?templateSessionId=&date=` | `ChallengeResponse[]` | 200 · 401 | HBWI. A planned session's live challenges for `date` (dismissed excluded), oldest first. **Lazily generates** when none exist AND `date == today`; **lazily resolves** accepted ones when the instance is done. **`200 []` = honest empty, never 404.** Owner-scoped. |
| `POST /api/proactive/challenge/{id}/decision` | `ChallengeResponse` | 200 · 400 · 401 · 404 · 409 | HBWI. **L2 accept/dismiss** (`{decision: accept\|dismiss}`, `@Pattern ^(accept\|dismiss)$`). `accept` ⇒ `accepted`; `dismiss` ⇒ `dismissed`. 404 `PROACTIVE_CHALLENGE_NOT_FOUND` = not-found/foreign; **409 `PROACTIVE_CHALLENGE_NOT_PROPOSED`** = already decided; 400 = invalid decision value. **No `propose` endpoint** (generation is implicit on the prep-read). |

Schemas: `FeedMessageResponse{id, date, kind, eyebrow, body[], refs[], generatedAt, facts?,
suggestions?, actions?, applied?}`
(replaces `BriefingResponse` + `HeartbeatNoteResponse`) + `FeedRef{kind, label}` — **no `confidence`,
no `tone`** on the wire (§9 gotcha c, unchanged). `kind` is the **9-value** companion-feed enum
(`morning|sleep|weight|midday|evening|intervention|people|setup|advice` — the sixth, `intervention`,
W5.2 bd `mezo-b3pp.19`, added 2026-08-25; the seventh, `people`, Emberek S6 bd `mezo-06o0.8`, added
2026-09-01; the eighth, `setup`, S3 bd `mezo-d58h.3`, added 2026-09-03; the ninth, `advice`, S4 bd
`mezo-d58h.4`, added 2026-09-04 — the SINGLE daily coaching card, successor to `intervention`/
`setup`; both older values stay in the enum for existing rows, nothing writes them any more — the FE
`FeedMessageKind` union carries the same strings); `refs[].kind` is the FE
`RefTag` vocabulary — extended with `Person` for the `people` kind's `Ref("Person", name)`
candidates (§3.x below) — `WeightTrend|Goal|Workout|FuelDay|Medication|Sleep|Memory|Person` —
always `[]` for the `midday`/`evening`/`intervention`/`setup`/`advice` kinds (the retired heartbeat
generator carried no refs either; config text and deterministic facts have no refs to select).
**`facts`/`suggestions` (S4) are OPTIONAL string arrays, present ONLY on `advice` rows** — `facts`
is `AdviceFactRenderer`'s deterministic evidence lines (empty for a setup-sourced card), `suggestions`
is the config text the card's prose was grounded on; the thread card renders `suggestions` as a
suggestion list and `facts` as a „Miből gondolom" evidence list. **Neither `interventionKey` nor
`setupKey`/`adviceKey` reaches the wire** — the FE branches on `kind === 'intervention' || kind ===
'advice'` for the „Segített?" feedback variant ([companion.md](companion.md) §10); the keys only
matter server-side — `interventionKey` for the feedback rollup (§4 below,
[companion.md](companion.md) §4), `setupKey` for the weekly re-emit cooldown (§3 above), `adviceKey`
for `AdvicePriority`'s severity comparison (§3 above).
**`actions`/`applied` (S5) are OPTIONAL, present ONLY on `advice` rows.**
`FeedAction{key, label, params}` — `key` is the 3-value `AdviceActionKey` enum
(`lighten_tomorrow`/`skip_sport_slot`/`shift_sleep_anchor`), `label` is the rule-authored HU button
text, `params` is a free-form object the FE echoes back verbatim in the apply request body (e.g.
`{"minutes": -30}`) — the model never writes any of the three. `FeedApplied{actionKey, at}` mirrors
whichever action was applied and when; `null` until the FE calls apply. `AdviceApplyRequest{actionKey}`
is the apply body, same 3-value enum. The thread card renders the offered `actions` as buttons while
`applied` is null, and swaps to a single applied-state pill once it is set — server-driven, never a
client-side optimistic flip.
`WeeklySuggestionResponse{id, weekStart, prose, generatedAt}` — plain prose, no structured fields.
`MemoirResponse{id, weekStart, title, body, anchors[], generatedAt}` + `MemoirAnchor{kind, label}` —
`anchors[].kind` is the same FE `RefTag` vocabulary (`Memory`/`Pattern` in practice), model-SELECTED
from code-collected candidates, never invented.

**`id` on those three responses is NEW at Phase 5 W4.1 (`mezo-b3pp.15`), and it is REQUIRED.** They
were the only proactive reads that exposed no row id at all — `PredictionResponse`/
`ExperimentResponse`/`ChallengeResponse` always had one because their surfaces write back through it.
The feed/suggestion/memoir surfaces were read-only, so the id had never earned its place; **W4.1's
👍/👎 capture is what earned it** — `message_feedback.artifact_id` is that row id, and without it the
FE has literally nothing to vote on (`feed_message` → `companion_message.id`, `weekly_suggestion` →
`weekly_suggestion.id`, `memoir` → `memoir.id`; predictions ride their existing `id`). The change is
**contract-only**: all three are MapStruct-mapped from entities that already had `id`, so no mapper,
service or query changed. It is a required field rather than optional on purpose — a nullable id
would push a "can this be voted on?" branch into every consumer for a case that cannot occur.
Table + endpoints + semantics: [`companion.md` §4/§5.7](companion.md); the FE side:
[`insights.md` §5.7](insights.md) and [`today.md` §1](today.md).
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

### Diagnosis (on-demand report, `mezo-hqfi`; second phenomenon `mezo-po3y`)

Migration `202608311200_mezo-hqfi_create_diagnosis.sql` creates `diagnosis` — `id`, `created_by`,
`is_deleted`, `created_at`, `phenomenon` (ck: `fatigue`), `window_days`, `verdict`, `confidence`
(ck: `strong|moderate|weak`), `evidence` jsonb, `suspects` jsonb, `generated_at`, plus
`idx_diagnosis_created_by_generated_at`. **Deliberately NO unique index** — unlike `weekly_review`
(one row per week), many diagnoses accumulate per user; that longitudinal list is the feature.
Migration `202608311210_mezo-hqfi_experiment_source_diagnosis.sql` widens `experiment` with
`source` (ck: `proposal|diagnosis`, default `proposal` so pre-existing rows stay honest) and
`source_diagnosis_id` (FK `on delete set null`, partial index) — the `source_pattern_id`
(`mezo-tk88.2`) pattern applied a second time.

`DiagnosisEntity` (`entity/DiagnosisEntity.java`) `extends OwnedEntity`; `evidence` and `suspects`
map as typed jsonb via `@JdbcTypeCode(SqlTypes.JSON)` onto `DiagnosisEvidenceEnvelope`
(`record EvidenceItem(kind, label, detail, sourceHu, metricKey, value, baselineValue, delta,
coverageDays)` — `kind ∈ metric|pattern|fact`, the metric-only fields null for the other two) and
`DiagnosisSuspectsEnvelope` (`record Suspect(rank, title, claim, evidenceIndexes, strength,
probeText, metricKey, expectedDirection, totalDays)` — the probe fields map **1:1 onto
`ExperimentEntity`**, so the hand-off needs no translation layer). **Evidence is persisted, not
recomputed on read:** the report must show the numbers it actually reasoned from, or weeks later a
recomputed window would put different values next to the same conclusion.

**Two phenomena since `mezo-po3y`** — `fatigue` and `sleep`. Everything phenomenon-specific
lives in ONE record, `service/DiagnosisRecipe.java` (wire value, HU label, the prompt's question
sentence, the `MetricKey` subset); the collector and generator take a recipe, the old 2-arg entry
points alias FATIGUE. A third question = one `DiagnosisRecipe` entry + one ck-widening migration
(`202608311500_mezo-po3y_diagnosis_sleep_phenomenon.sql` is the template). The FE mirror is
`features/insights/logic/diagnosisCatalog.ts` (`LIVE_QUESTIONS`/`UPCOMING_QUESTIONS`) — a
question goes live by moving between the two lists. The daily quota stays GLOBAL across
phenomena.

The pipeline is the `WeeklyReviewGenerator` recipe on a rolling window:

1. **`FatigueEvidenceCollector`** (`service/`, PURE CODE, no LLM) — 19 fatigue-relevant
   `MetricKey`s (including the derived `ACWR`, `TRAINING_MONOTONY`, `BEDTIME_VARIABILITY`) read
   through `MetricSeriesService`: the 14-day window mean vs the preceding 28-day baseline, each
   metric **dropped below 7 measured days** (a two-day average is not a finding). Confirmed
   patterns and prompt-included knowledge facts join the same list. Fewer than 2 `MetricDomain`s
   with coverage ⇒ `null`, an honest absence. Ordering is the fixed enum order — **the index IS
   the contract**, so reordering is a breaking change to persisted rows. Every candidate renders
   **exactly once** in one numbered list (unlike the weekly gather, which renders labels twice).
   Prior diagnosis-sourced experiments and their outcomes are appended as CONTEXT ONLY — they
   produce no candidates, because a prior experiment is something not to repeat, not evidence to
   cite. This is what makes a second run non-blind.
2. **`DiagnosisGenerator`** (`service/`, marker `FARADTSAG-DIAGNOZIS-FELADAT`) — ONE SMART-tier
   call, strict JSON `{verdict, confidence, suspects[{title, claim, evidenceIndexes, strength,
   probe{text, metricKey, expectedDirection, totalDays}}]}`. **Drop-on-violation:** empty or
   out-of-range `evidenceIndexes`, an unknown `metricKey`, a direction outside
   `up|down|stable`, or a probe length outside 3..28 kills the WHOLE suspect — an out-of-range
   index is read as a fabrication signal, so the surviving indexes are not silently kept. Zero
   survivors ⇒ **no row**.
3. **`DiagnosisService`** (`service/`) — list/detail/generate + the probe→experiment hand-off.
   `stale` comes from the shared `LogFreshnessProbe` over the row's own window. Reads are FREE;
   only generation consumes `mezo.proactive.diagnosis.max-per-day` (counted from rows generated
   today **including soft-deleted ones**, so the quota cannot be reset by throwing rows away).

**REST** (fragment `api/feature/diagnosis/diagnosis.yml`, tag `Diagnosis` → `DiagnosisApi`;
`DiagnosisController implements DiagnosisApi`):

| Method + path | Returns | Status | Notes |
|---|---|---|---|
| `GET /api/proactive/diagnosis?phenomenon=` | `DiagnosisResponse[]` | 200 · 401 | Newest first. **`200 []` = honest empty, never 404.** |
| `GET /api/proactive/diagnosis/{id}` | `DiagnosisResponse` | 200 · 401 · 404 | Includes the live `stale` flag. 404 = not-found/foreign. |
| `POST /api/proactive/diagnosis` | `DiagnosisResponse` | 201 · 401 · **409** · **429** | 409 `DIAGNOSIS_INSUFFICIENT_DATA` (too few domains, or no suspect survived); 429 `DIAGNOSIS_QUOTA_EXCEEDED`. |
| `POST /api/proactive/diagnosis/{id}/suspect/{rank}/experiment` | `ExperimentResponse` | 201 · 401 · 404 | **The tap IS the acceptance** — creates `status=active`, `startDate=today`, probe fields copied verbatim; NOT routed through `proposed`. Idempotent per metric: an open experiment on the same `metricKey` is returned as-is. |

**Frontend (`mezo-hqfi.4`, ✅)** — `features/insights/pages/DiagnosisListPage.tsx` (the
gold-ringed ask card + the config-driven upcoming-question catalog + past reports) and
`DiagnosisDetailPage.tsx` (verdict + ranked suspects, evidence resolved through
`evidenceIndexes` with `sourceHu` provenance, the probe CTA flipping to the sage
acknowledgement), on `/mezo/diagnozis[/:id]` (Hungarian slug per the spec). Data:
`data/insights/diagnosisApi.ts` + `diagnosisHooks.ts` (dual-mode; 409/429 map to
`insufficient`/`quota` error kinds rendered as product copy) + `diagnosisMock.ts`. The Mezo hub
carries a full-width question tile. Visual goldens `mezo-diagnozis` + `mezo-diagnozis-riport`.

**`LogFreshnessProbe`** (`service/`, `mezo-hqfi.1`) — extracted from `WeeklyReviewService#isStale`
and generalised from an ISO week to an arbitrary `[from, to]`; both the weekly review and the
diagnosis now share it. Behaviour-preserving: same four log sources (weight/sleep/check-in/meal),
same best-effort false-on-any-failure contract. Workout logs stay unprobed — `WorkoutSessionEntity.date`
is nullable on template rows, so there is no clean date-window read. Only `createdAt` is
observable: **`OwnedEntity` has no `updatedAt` column at all**, so an EDITED log cannot mark
anything stale anywhere in the codebase (bd `mezo-hszs`).

### Configuration

`config/ProactiveProperties.java` (`@Validated`, binds `mezo.proactive.*` — nested `weekly` +
`memoir` + `prediction` + `experiment` + `challenge` + **`feed`** records; the old `briefing` +
`heartbeat` nested records are GONE):

- **`feed.past-days`** (`@Min(1) @Max(14)`, default **7**): how many finished days of narrative
  memory the morning/midday/evening gathers read — and doubles as the **emptiness gate** for those
  three kinds (zero summaries ⇒ no row; `sleep`/`weight` use their OWN fresh-log gate instead, not
  this one). Replaces `briefing.past-days`/the retired `heartbeat`'s shared use of it.
- **`feed.morning-cron`** (`@NotBlank`, default `0 45 5 * * *`): the dawn `CompanionMessageJob.
  runMorning` schedule (server zone), before the typical wake — replaces `briefing.cron`.
- **`feed.midday-cron`** (`@NotBlank`, default **`0 30 12 * * *`**) + **`feed.evening-cron`**
  (`@NotBlank`, default **`0 30 20 * * *`**): the two window schedules — replaces `heartbeat.midday-
  cron`/`heartbeat.evening-cron`. The lazy GET derives the window fire-times from these SAME
  expressions — one source of truth (unchanged idiom from the retired heartbeat).
- **No successor to `briefing.regen-cap-per-day`.** The sleep-triggered regen mechanism it capped
  is retired outright (§9 decision retired-regen) — there is nothing left to cap.
- **`weekly.cron`** (`@NotBlank`, default **`0 0 6 * * MON`** — Monday 06:00 server zone): the
  `WeeklySuggestionJob` schedule; the suggestion is FOR the week that is starting (§9 decision j).
- **`memoir.cron`** (`@NotBlank`, default **`0 0 19 * * SUN`** — Sunday 19:00 server zone): the
  `MemoirJob` schedule; the memoir is FOR the week ENDING that Sunday (§9 decision l).
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

**`config/SetupCheckProperties.java` (S3, bd `mezo-d58h.3`) — a SEPARATE `@ConfigurationProperties`
record, prefix `mezo.proactive.setup-checks`, NOT nested inside `ProactiveProperties`** (the
`FlagProperties` precedent — its own already-large sibling is `CompanionProperties`, and this one
is `ProactiveProperties`, so a standalone record avoids growing it further):

- **`cron`** (`@NotBlank`, default **`0 10 6 * * *`** — 06:10 server zone, after the 05:45 morning
  message job so a setup card lands below the briefing): the `SetupCheckJob` schedule.
- **`reEmitHours`** (`@Min(1) @Max(8760)`, default **168** = 7 days): the spec's "at most weekly
  until the configuration contradicts them" cadence — the SAME check does not repeat inside this
  window (§3 above).
- **`planFeasibility`** (`@NotNull @Valid`, nested record) — every threshold the plan-feasibility
  check uses, all config, never code:
  - **`wakeBufferMin`** (`@Min(0) @Max(240)`, default **45**): minutes between waking and actually
    being ready for the morning obligation (shower, breakfast, travel).
  - **`commuteBufferMin`** (`@Min(0) @Max(240)`, default **30**): minutes between an evening sport
    slot ending and actually being home — `sport_schedule_slot` carries free-text location, nothing
    geocoded, so this is one flat number.
  - **`morningCutoffHour`** (`@Min(1) @Max(23)`, default **10**): a gym slot at or before this hour
    counts as a MORNING obligation; later slots are evening training and do not constrain lights-out.
  - **`misfitToleranceMin`** (`@Min(5) @Max(240)`, default **45**): the plan is called infeasible
    only when it misses by MORE than this.
  - **`bedtimeWindowDays`** (`@Min(3) @Max(90)`, default **14**): trailing days of bedtime history
    the observed median is taken over.
  - **`minBedtimeSamples`** (`@Min(2) @Max(30)`, default **4**): fewer logged bedtimes than this in
    the window ⇒ the observed-bedtime half of the check stays silent (the schedule half can still
    speak).

Plus the **seven** techcore job switches (up from six — S3 adds `setup-check-job` alongside the
`mezo-gst9` `feed-job` merge), each the THIRD `@ConditionalOnProperty` on its job bean (on
top of the companion+proactive dual gate; off ⇒ the cron bean does not exist, the lazy GET still
serves): **`feed-job`** (`FEED_JOB_SWITCH` — ALL THREE `CompanionMessageJob` crons, morning +
midday + evening), **`setup-check-job`** (`SETUP_CHECK_JOB_SWITCH`, `mezo.techcore.cron.setup-
check-job.enabled` — off ⇒ no `SetupCheckJob` bean; `SetupCheckService` itself is unaffected, a
direct call still works, the `FlagSweepJob` vs `FlagService` idiom), **`weekly-suggestion-job`**
(`WEEKLY_SUGGESTION_JOB_SWITCH`), **`memoir-job`**
(`MEMOIR_JOB_SWITCH`), **`prediction-job`** (`PREDICTION_JOB_SWITCH` — generation + validation),
**`experiment-job`** (`EXPERIMENT_JOB_SWITCH` — propose + outcome), and **`challenge-job`**
(`CHALLENGE_JOB_SWITCH` — outcome backstop only), all `mezo.techcore.cron.*.enabled`, default `true`.

## 5. Integrations

Proactive is a **Phase-4 domain that reads from companion + the other features, never the reverse**
(the roadmap coupling rule; the frozen ArchUnit cycle rule guards it).

### 5.1 Proactive → Companion (✅ wired — read-only, one-way)
`CompanionMessageGenerator` composes three companion capabilities per kind:
`ContextSnapshotAssembler.render(userId, date)` for `sleep`/`weight`/`midday`/`evening` — but
`.renderWithoutBiometrics(userId, date)` for `morning` (the sleep/weight strip-at-source, see §1) —
`KnowledgeFactService.renderPromptBlock(userId)` (V1.1 top-N facts),
`DailySummaryRepository.findByCreatedByAndSummaryDateGreaterThanEqualOrderBySummaryDateDesc(…)`
(V2.2 narratives, `morning`/`midday`/`evening` only — `sleep`/`weight` are grounded by their own
fresh log instead), and the `CompanionLlm.complete(system, user)` port for each kind's one prose
call — plus one proactive-internal read (`CompanionMessageRepository`, the `earlierMessagesBlock`
same-day dedupe). **W1's `WeeklySuggestionGenerator` adds a fourth companion read** —
`PatternRepository.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(…)` (the V3.1/V3.2 Inbox
rows) — and calls the port's **`completeSmart`** variant (Pro tier) instead of `complete`. **W2's
`MemoirGenerator` composes the same four reads** (summaries + facts + patterns + the `completeSmart`
port) but over the week's OWN window `[weekStart, weekStart+6]` rather than the prior week — no new
companion capability, just a different window. **P1's `PredictionGenerator`** reads snapshot + facts
+ **CONFIRMED patterns only** (`findByCreatedByAndStatusAndDeletedFalse…`, the grounding gate) via
`completeSmart`; **P1's validation + P2's outcome** read `WeightLogRepository` / `SleepLogRepository`
/ `WorkoutSessionRepository.findDoneInstanceDates` (biometrics + train, read-only) via the shared
**`MetricWindowEvaluator`** — the proactive reach beyond companion, still strictly one-way. **P2's
`ExperimentProposalGenerator`** reads CONFIRMED patterns + snapshot + facts via `completeSmart` (the
P1 pattern-grounding gate).
**Contract crossing the seam:** these read methods with explicit `userId` scoping; strictly one-way — no companion code imports
proactive. This one-way rule is why the fake sentinels' markers are literal mirrors rather than
imports (§9 gotcha a).

**S1 close (`mezo-tk88.3`) added the mirror-image seam — proactive DATA reaching companion, still
without a reverse import.** The pattern-detail endpoint (`companion.md` §4) needs the
predictions/experiments/challenges grounded on a pattern (§ above's `sourcePatternId` finders), but
`PatternPairDetailService` lives in `feature.companion`, which must not import `feature.proactive`
(would open a NEW 2-slice cycle on top of the one-way rule above). `PatternImpactService`
(`feature.proactive.service`, §10) implements a companion-owned interface, `PatternImpactSource` —
so the only import crossing the boundary is still proactive → companion (unchanged direction), and
companion reaches proactive's data purely through Spring DI, never a compile-time dependency. See
[`companion.md`](companion.md) §5.5 for the companion-side writeup of the same seam.

**W4.2 (`mezo-b3pp.16`) added a second instance of that same inversion.** The nightly feedback
rollup buckets `feed_message` verdicts by feed slot, which means resolving artifact ids to
`companion_message.kind` — proactive data again, read from `feature.companion`. `FeedMessageKindService`
(`feature.proactive.service`, `COMPANION_SWITCH` only, like `PatternImpactService`) implements the
companion-owned `FeedMessageKindSource` port (`feature.companion.feedback.service`), which also
carries the five feed-slot constants as literal mirrors of `CompanionMessageEntity.KIND_*` — the
same "literal mirror rather than import" rule as the fake sentinels (§9 gotcha a). The lookup is
`userId`-scoped inside the implementation. See [`companion.md`](companion.md) §3 (W4.2 backend
classes) for the companion-side writeup.

### 5.2 Proactive ↔ LLM provider (wired via companion, ADR 0008)
All model access goes through the same `CompanionLlm` port — **cheap tier** (`complete`, one call per
companion-feed message) and **smart tier** (`completeSmart`, one call per weekly suggestion / one per
memoir — the V3.2 Pro-tier routing). Real `GeminiCompanionLlm` / test `FakeCompanionLlm` (the
`[fake-feed-morning:{…}]`/`[fake-feed-sleep:{…}]`/`[fake-feed-weight:{…}]` sentinels for the three
JSON-answering kinds, plus `[fake-heartbeat:…]` (the sentinel string itself wasn't renamed even
though its marker mirror now points at `CompanionMessageGenerator.WINDOW_MARKER`) for midday/
evening's flat-prose answer — plus `[fake-weekly:…]` + `[fake-memoir:{…}]`; the fake's
`completeSmart` delegates to `complete`, so one dispatch covers both tiers). Provider detail is
hidden by the port; proactive adds no new adapter.

**S4's `AdviceProseGenerator` adds one more cheap-tier call, over the candidate's OWN code-gathered
grounding — never a fresh companion snapshot.** `AdviceCardService.deliver` calls
`AdviceProseGenerator.write(userId, candidate)`, which renders `candidate.facts()` +
`candidate.suggestions()` (already deterministic — `AdviceFactRenderer` off the raise's frozen
payload for flag-sourced candidates, config text for setup-sourced ones) into a `TÉNYEK`/`JAVASLATOK`
block and makes ONE `CompanionLlm.complete` call tagged with the `TANACS-KARTYA-FELADAT` marker
(mirrored in `FakeCompanionLlm` the same literal way every other marker is, since a companion→
proactive import would be a new package cycle; `AdviceProseGeneratorIT` asserts the two stay equal).
The prompt asks for 2-3 sentences of HU prose and **forbids numerals outright** — the card shows its
own numbers in the facts list, so the model is asked to describe them in words, never invent a new
fact/number/todo, never suggest a medication-dose change, and answer as plain prose (no markdown/
bullets). `ProseNumberGuard.grounded(prose, grounding)` enforces the "no invented number" rule
deterministically afterwards (the refs-by-index idiom has no analogue for free prose): every numeral
TOKEN in the answer must be a token of the grounding text itself (decimal comma/dot normalised, so a
model answering with either is not punished). **The card is never dropped, only its wording
downgraded** — an exception from the LLM call, a blank answer, or an ungrounded numeral all fall back
to `candidate.fallbackProse()`, the exact config text that shipped pre-S4, so an LLM outage costs the
card's wording, never its delivery.

### 5.3 Proactive ↔ API contract & backend platform (wired)
On the contract-first pipeline ([`_platform-api-backend.md`](_platform-api-backend.md)):
`proactive.yml` → merged `api/openapi.yml` → generated `ProactiveApi` + DTOs (backend) and
`api.gen.ts` types (FE). Drift = compile error.

### 5.4 Proactive → Today FE (✅ `mezo-gst9` wired — dual-mode read, replaces the B1.2+H1 seams)
The Today `MezoChip` message thread ([today.md](today.md)) is the consumer. `useCompanionFeed(date =
localDateString())` (`data/today/feedHooks.ts`, `['companionFeed', date]`) reads `GET
/api/proactive/feed?date=<local>` via `feedApi.get` (`data/today/feedApi.ts`, `toFeedMessages`
wire→`FeedMessage[]`; mock mode returns
`[]` synchronously — no fetch), polled every 60s in real mode (`refetchInterval`) so event-triggered
kinds (sleep/weight) and any missed cron-kind land without a manual reload — the sleep/weight-log
mutations ALSO invalidate `['companionFeed', …]` directly on success, so a fresh log usually shows
up in the thread well before the next poll tick. `logic/mezoMessages.ts`'s `buildMezoMessages({feed,
demoBriefing})` maps each `FeedMessage` 1:1 to a `MezoMessageItem` (kind→id, `body[].text`→
paragraphs, refs pass through) and prepends the labelled demo card (`resolveBriefing(scenario.
dayState)`) only while the feed carries no `morning` kind. `TodayPage.tsx` calls `useCompanionFeed()`
directly (not through `useToday`) and passes the result to `buildMezoMessages`. **`date` is an
explicit opt-in the hub/Today callers never pass** (`mezo-b3pp.36`): `NapMezoPage` is the one caller
that does, feeding it an earlier day when an `intervention` push's `d=` deeplink param names one — a
second, independent `['companionFeed', date]` cache entry, not a duplicate of today's own poll
([today.md](today.md) for the page-side wiring;
[`_platform-notifications.md` §3d](_platform-notifications.md) for why the push can name a day other
than today). **This replaces BOTH**
the old `useBriefing()`/`briefingHooks.ts`/`BriefingCard.tsx` seam (B1.2) **and** the old
`useCompanionNote()`/`heartbeatHooks.ts`/`CompanionNoteCard.tsx` seam (H1) — all now deleted. The
seam type omits `confidence`/`tone` same as before (§9 gotcha c, unchanged). **Since `mezo-b3pp.15`
the row `id` rides through too** (`FeedMessage.id` → `MezoMessageItem.artifactId`), which is what lets
each persisted bubble carry 👍/👎 chips; the demo-briefing card and the Életjel nudges get none,
because neither is a persisted row ([`today.md` §9](today.md)). Mock mode stays `[]`, so those chips
are real-mode-only in practice. **Since W5.2 (bd `mezo-b3pp.19`)** `MezoMessageItem` also carries an
optional `kind: FeedMessageKind` (`buildMezoMessages` copies `m.kind` through) — the ONLY way the FE
distinguishes an `intervention`/`advice` card from any other feed row, since `interventionKey`/
`adviceKey` themselves never reach the wire (§4 above). `MezoMessagesSheet.tsx` uses it to render
„Segített?" instead of the generic feedback label on `kind === 'intervention' || kind === 'advice'`
rows (S4, bd `mezo-d58h.4`, widened the branch to cover the new kind alongside its pre-S4
predecessor), still through the same `useFeedback('feed_message')` chips every other persisted card
uses — no new feedback machinery. **S4 also carries the card's `facts`/`suggestions` (§4 above)
through `MezoMessageItem`** (`buildMezoMessages` copies both straight from `m.facts`/`m.suggestions`)
— `NapMezoPage.tsx` renders `suggestions` as an action-less bullet list and `facts` as a „Miből
gondolom" evidence list, the FE's only consumer of those two optional fields.

### 5.5 Proactive → Insights Weekly FE (✅ W1 wired — real-only read) — **consumer RETIRED, endpoint unaffected (`mezo-p2tr`)**
**As originally shipped at W1:** the Insights Weekly „Mezo · heti tervjavaslat" card
([insights.md §2.2](insights.md)) was the consumer — `useWeekly()` (`data/insights/weeklyHooks.ts`)
fetched `GET /api/proactive/weekly-suggestion?date=<local>` via `weeklySuggestionApi.get`
(`data/insights/weeklySuggestionApi.ts` — **since `mezo-b3pp.15` it returns `{id, prose}`, not a bare
prose string**, so the card had an artifactId for its 👍/👎 chips; `useWeekly` split it into
`weeklySuggestion`/`weeklySuggestionId`, both null on the 404) in a real-only `useQuery`
(`['weeklySuggestion', start]`, `enabled: !mock`, `retry: false`, 404→null) — the one bare `useQuery`
in that otherwise-`useRealQuery` file. The „Elfogad/Hangoljuk" buttons were hidden when `mode !==
'mock'`; mock mode returned the seed prose synchronously (byte-parity).

**Current state:** the Insights Weekly tab (`useWeekly`/`WeeklyPage`) is **retired outright**
(`mezo-p2tr`) — this endpoint has **no dual-mode consumer left**. The SAME `weeklySuggestionApi.get`
client is now called directly by **`/me/week`'s `Heti` hub (`WeekHubPage`)** (its own `useWeekNextSuggestion` helper,
current-week-only, mock branch returns the same `insights.ts` seed) — same wire contract, same
404→honest-placeholder behavior, new home. See [insights.md §2.2](insights.md) and [me.md](me.md).

### 5.6 Proactive → Insights Memoir FE (✅ W2 wired — dual-mode read)
The Insights Memoir tab ([insights.md §2.3](insights.md)) is the consumer. `useMemoir()`
(`data/insights/memoirHooks.ts`) fetches `GET /api/proactive/memoir` via `memoirApi.latest`
(`data/insights/memoirApi.ts`, `toMemoir` wire→FE `Memoir` — the week label derives client-side from
`weekStart` via `isoWeekNumber` + `deriveWeekTitle`, reused from `weeklyHooks`/`fuelWeekHooks`) in a
`['memoir']` `useQuery` (`retry:false`, 404→null). Returns `{ memoir: Memoir | null; anniversaryNote:
string | null; mode }`; real mode maps the server memoir (or null on 404/loading/error, note always
null), mock returns the seed memoir + anniversaryNote synchronously (byte-parity). `MemoirPage`
renders the memoir card or the honest null-state, with anniversary/archive gated behind
`mode === 'mock'`. `memoir` also leaves `PHASE3_TAB_IDS` (`tabs.ts`) so the tab is visible in real mode.
**Since `mezo-b3pp.15`** the FE `Memoir` type — reused unchanged from Phase 1 until now — gains `id`
(`{id, week, title, body, anchors}`) off the new wire field, and the Phase-1 mock-only Like/Love/
Save/Dismiss reaction row is **retired** in favour of a real 👍/👎 `FeedbackChips` row that renders
in BOTH modes (closes `mezo-kr9v`; [`insights.md` §2.3](insights.md)).

### 5.7 (retired — folded into §5.4)
H1's separate `CompanionNoteCard` seam is gone; see §5.4 above (`useCompanionFeed` now covers
midday/evening the same way it covers morning/sleep/weight).

### 5.8 Proactive → Insights Predictions FE (✅ P1 wired — dual-mode read)
The Insights Predictions tab ([insights.md §2.4](insights.md)) is the consumer. `usePredictions()`
(`data/insights/predictionsHooks.ts`, `['predictions']`) fetches `GET /api/proactive/prediction` via
`predictionsApi.list` (`data/insights/predictionsApi.ts`, `toPrediction` wire→FE `Prediction` — the
window label + accuracy header derive client-side; `confidence ?? null`) in real mode ([] on
loading/error — a list never 404s), mock returns the seed. Returns `{predictions, mode}`. `PredictionsPage`
renders the real cards or the honest still-learning null-state; `predictions` also leaves `PHASE3_TAB_IDS`
(`tabs.ts`) so the tab is visible in real mode. The FE `Prediction` type gained a **nullable
`confidence`** and the `missed` status (both honest-state additions). **Since `mezo-b3pp.15`** each
card carries a 👍/👎 `FeedbackChips` row keyed by the prediction's existing `id` — the one W4.1
surface that needed **no** contract change, because predictions already exposed their row id
([`insights.md` §2.6](insights.md)).

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
`train.ts` seed. **Since the mission-briefing prep redesign (`mezo-bxpg`) the hook also surfaces a
`pending: boolean`** (real: the list query's `isPending` — the lazy backend LLM generation still in
flight; mock: always `false`) so `ChallengesCarousel` can render a visible **`"Kihívások generálása…"`
skeleton** instead of a silent empty gap while the proposal is being generated — see
[train.md §Active workout](train.md). `useChallengeActions().decide` POSTs accept/dismiss and
invalidates the list (no-op in mock, a local toggle keeps byte-parity). The accepted state derives
from the server `status` (`accepted|hit|miss`); resolved challenges render the outcome chip (✓/◯/◌).
The FE `Challenge` type gained a **nullable `confidence`**, a `status`, the structured target fields,
and `outcome`/`outcomeGood`.
The proactive→train coupling is strictly one-way (the backend evaluator reads Train repositories; Train
never imports proactive — challenges are NOT in `WorkoutPlan`, sourced separately by the page).

### 5.11 Proactive → Platform notifications, in-app feed (✅ F2 wired — one-way, fire-and-forget)

Every generator/evaluator in this feature that produces user-facing content now also emits an
in-app notification into the platform's `app_notification` outbox at the moment that content
persists (bd `mezo-gzhp.2`): `MemoirGenerator` (`memoir_ready`), `PredictionGenerator` /
`PredictionValidationService` (`prediction_new` / `prediction_outcome`),
`ExperimentProposalGenerator` / `ExperimentOutcomeService` (`experiment_proposed` /
`experiment_closed`), and `ChallengeGenerator` / `ChallengeOutcomeEvaluator` (`challenge_event`, both
the proposed and the closed moment) — each a one-line `AppNotificationEmitter.emit(...)` call. The
call is synchronous but fire-and-forget: the emitter absorbs every failure, so a broken notification
can never break the generator's own persistence. See
[`_platform-notifications.md`](_platform-notifications.md) §3a/§4/§9 for the full producer→kind map,
the dedup-key shapes, and the load-bearing rule that any emit-reachable IT test must drop its
class-level `@Transactional` (the emitter's `REQUIRES_NEW` transaction otherwise FK-deadlocks against
the test's own uncommitted fixtures).

### 5.12 Proactive → Companion, highlight feedback (✅ `mezo-d20.7.7` wired — third port inversion)

The weekly round already names which pattern / fact / life event / memory the week was built on
(`weekly_review.highlights`); until this slice nothing read it back. `HighlightCitationSourceAdapter`
(`feature.proactive.service`) implements the companion-owned `HighlightCitationSource` port — the
same inversion as `PatternImpactSource` (§5.1) and `FeedMessageKindSource`, so the import direction
stays proactive → companion. It answers one question: *in how many of the last
`mezo.proactive.weekly-review.citation-window-weeks` (12) live weekly reviews was this entity
cited?*

Four decisions worth keeping:

- **Derived on read, never accumulated.** The count is a fold over the LIVE `weekly_review` rows,
  not a stored counter. Regeneration therefore cannot double-count (soft-delete + reinsert leaves
  exactly one live row per week — the partial unique index), and a soft-deleted review stops
  contributing immediately instead of leaving an unexplainable bump behind. There is no ledger to
  reconcile and nothing that can drift out of sync with the reviews themselves.
- **Weeks, not mentions** — one review naming the same pattern twice (a confirmed AND a reinforced
  event in the same week are two candidates over one pattern) is one week of evidence.
- **It never becomes a statistic.** `PatternEntity.confidence` stays untouched (and stays NULL for
  statistical rows — honest small-n); a citation cannot promote a pattern or move its status. It is
  exposed as a separate `citedWeeks` field on `PatternResponse`, rendered beside the statistic.
- **It does not widen `reinforcementCount`.** That field means "the USER re-stated this"; the model
  citing its own knowledge is not that — the same call `WeeklyLessonService` made when it refused to
  reinforce on a weekly duplicate (`mezo-d20.7.6`). `KnowledgeFactResponse.citedWeeks` carries it
  separately, and the only place it ACTS is `KnowledgeFactService.renderPromptBlock`, as a
  tie-breaker *under* reinforcement: it can order two equally-confirmed facts, never outrank one the
  user confirmed more often. With the proactive switch off the port is absent and `citedWeeks` is
  `null` — not measurable, never a stand-in zero.

Life-event and memory highlights carry their refId too but feed **nothing** yet, deliberately: a
`LIFE_EVENT` node's state is the user's own (`active`/`ended`), with no salience field a citation
could honestly inform, and a memoir belongs to exactly one week, so "cited in N weeks" over memoirs
is structurally 0-or-1 and carries no information. The refs are recorded so a later loop has data to
work with.

### 5.13 Proactive → People, the `people` companion-message kind (✅ Emberek S6, `mezo-06o0.8` — fourth port inversion)

The Emberek section's weekly human-circle observation is a `companion_message` row like any other
kind (§4 above widened the CHECK from six values to seven), generated by
`CompanionMessageGenerator.generatePeopleObservation(userId, date)` — same
gather → ONE `CompanionLlm.complete` call → defensive-parse → bounds-checked ref-resolution →
`saveAndFlush` idiom every kind in this doc uses, on the SAME Monday-anchored UTC week the
`feature/people` `PersonAffectTrendCalculator` uses (this generator reuses that calculator
directly, so the week boundaries and the affect/direction math can never drift apart between the
companion message and `PersonDetailPage`'s own arc).

- **What the model sees — aggregates, never raw quotes.** The gather step reads this week's
  mentions, groups them per active person, and builds one line per mentioned person: name,
  `relationshipHu`, this week's mention count, `direction` (`up`/`down`/`flat`, Hungarian label),
  and `directionReason` — all off `PersonAffectTrendCalculator`, the exact same values
  `PersonResponse` carries. A person with zero mentions this week is folded into a single
  "CSENDBEN MARADT: A, B, C" line instead of one row each. The payload is this aggregated weekly
  shape only; individual mention excerpts never reach the prompt (unlike the weekly-review
  citation path in §3 above, which DOES quote mention excerpts into its own, separate, once-a-week
  narrative — the two payloads are built independently and never share text).
- **The data gate: no mention this week ⇒ no LLM call, no row.** `generatePeopleObservation`
  returns `null` before ever calling the LLM when this week's mention window is empty for the
  user, or when every mentioned person happens to be a non-active candidate (mentions exist but
  none belong to an active person — an honest gap, not a fabricated image). This is the same
  "empty window ⇒ no row" discipline every other kind in this doc follows.
- **Idempotent on `(created_by, message_date, kind)`**, the same partial-unique-index discipline
  as every other kind — a second same-day call (e.g. a retried cron tick) returns the existing row
  rather than double-generating.
- **Ref candidates are `Ref("Person", name)`** for every active person considered (mentioned or
  silent) — the `Person` `RefTag` this slice added to the FE vocabulary (§4 above).
- **Trigger: the dawn cron only, deliberately NOT the feed's lazy miss-recovery.** `CompanionMessageJob.runMorning`
  calls `generatePeopleObservation` right after the morning message, in its OWN try/catch (a
  people-generation failure must never take down the morning message or any other cron work for
  that user). `ProactiveFeedService.ensureTodayCronKinds` — the `GET /api/proactive/feed` miss-recovery
  that lazily backfills `morning`/`midday`/`evening` when a cron tick was missed — was **deliberately
  left without a `people` branch**: unlike the other cron kinds, adding it there would mean a plain
  `GET /api/people` (via the Mezo band, which reads the SAME feed row through the port below) could
  itself trigger a fresh LLM call on a cache miss, turning an idempotent read into a billable side
  effect. The consequence, accepted on purpose: if the 05:45 cron tick is missed for a user, that
  user's `people` message for the day simply never generates (unlike `morning`, which the feed read
  still lazily recovers) — `PeopleService.derivedMezoNote`'s deterministic fallback (see
  [me.md](me.md)) covers exactly this gap, so the Mezo band is never empty even when the cron
  missed.
- **The `people` kind also surfaces in the Napi Mezo thread — intentional, not a leak.** `getFeed`
  is kind-agnostic (`findByCreatedByAndMessageDateOrderByGeneratedAtAsc` — every live kind for the
  day, in generation order); it was never taught to filter `people` out, and it should not be —
  Daniel seeing "someone's mood turned" alongside his morning/midday/evening notes in one place is
  the intended reading experience, not an accident of a shared table.
- **The port: `PeopleMezoNoteSource`, owned by `feature/people`, implemented here.** `PeopleService`
  needs today's `people` message body to fill `PeopleResponse.mezoNote`, but `feature/people` must
  not import `feature/proactive` (the same cycle risk every prior port in this section exists to
  avoid). `PeopleMezoNoteSource.todaysNote(userId, today)` is declared at the `people` feature
  root; `feature/proactive/service/PeopleMezoNoteAdapter` implements it
  (`@ConditionalOnProperty` on COMPANION ∧ PROACTIVE — with either off, the bean doesn't exist and
  `PeopleService` falls straight to its own deterministic fallback via `ObjectProvider.getIfAvailable`),
  reading the day's `KIND_PEOPLE` row and joining its body paragraphs into one line, `Optional.empty()`
  when blank. This keeps the import direction `proactive → people` (this doc's package depends on
  the `people` feature's port interface only) — the reverse, `people → proactive`, is the one this
  inversion exists to forbid. It is a NEW slice edge (this doc's package now depends on
  `feature/people`'s port interface), verified cycle-free by `ArchitectureTest`'s
  `feature_slices_are_cycle_free`: `people` itself only points outward to
  `auth`/`journal`/`ritual`/`goal`, so nothing closes a loop back through it.

## 6. How to use it (consume)

**Over HTTP** (bearer token from `POST /api/auth/login`; the backend must run with `demodata` so
the owner exists, and BOTH `mezo.feature.companion.enabled=true` + `mezo.feature.proactive.enabled=true`
— the defaults). The `morning`/`midday`/`evening` kinds only generate when at least one
`daily_summary` exists in the `feed.past-days` window; `sleep`/`weight` need a fresh log instead (an
empty feed is `200 []`, never a 404 — see §3). For a keyless local run use the fake adapter and plant
a `[fake-feed-morning:{…}]` sentinel via a check-in note (the `CompanionMessageGeneratorIT` pattern):

```bash
TOKEN=... # from POST /api/auth/login
curl -s "http://localhost:8090/api/proactive/feed?date=2026-08-16" \
  -H "Authorization: Bearer $TOKEN"
# → [ { "date":"2026-08-16", "kind":"morning", "eyebrow":"…", "body":["…"],
#       "refs":[{"kind":"Goal","label":"cél"}], "generatedAt":… },
#     { "date":"2026-08-16", "kind":"sleep", "eyebrow":"…", "body":["…"],
#       "refs":[{"kind":"Sleep","label":"ma éjszakai alvás"}], "generatedAt":… } ]
# → [] (200) when nothing has generated yet — honest empty, NEVER a 404

curl -s "http://localhost:8090/api/proactive/weekly-suggestion?date=2026-07-06" \
  -H "Authorization: Bearer $TOKEN"
# → { "weekStart":"2026-07-06", "prose":"Ezen a héten…", "generatedAt":… }
# → 404 SystemMessageList when the prior week has no daily_summary (the FE's honest placeholder)

curl -s "http://localhost:8090/api/proactive/memoir" \
  -H "Authorization: Bearer $TOKEN"
# → { "weekStart":"2026-06-29", "title":"…", "body":"…", "anchors":[{"kind":"Memory","label":"2026-07-01"}], "generatedAt":… }
# → 404 SystemMessageList when the last completed week has no daily_summary (the FE's honest „készül" state)

curl -s "http://localhost:8090/api/proactive/prediction" \
  -H "Authorization: Bearer $TOKEN"
# → [ { "id":"…", "title":"…", "basis":"…", "confidence":null, "metricKey":"weight_trend",
#       "expectedDirection":"down", "validFrom":"2026-07-07", "validTo":"2026-07-13",
#       "status":"pending", "generatedAt":… } ]
# → [] (200) when there are no confirmed patterns yet (honest empty — NOT a 404)
```

The `sleep`/`weight` kinds don't lazy-generate off this GET at all — they need a `POST
/api/biometrics/sleep`/`POST /api/biometrics/weight` first (or the fake's `[fake-feed-sleep:{…}]`/
`[fake-feed-weight:{…}]` sentinel planted via a check-in note, `CompanionMessageEventIT`'s pattern).
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
**FE consumers:** the Today MezoChip thread (`mezo-gst9`, [today.md](today.md)), the Insights Weekly
card (W1) and the Insights Memoir tab (W2, both [insights.md](insights.md)) all read these endpoints
dual-mode.

## 7. How to extend it

- **`mezo-gst9` shipped (companion feed: 5 kinds, 2 triggers, 1 table) — the current extension
  pattern for anything that speaks first.** `CompanionMessageJob` (`@Scheduled`, three-switch,
  today-only, per-user isolation), `CompanionMessageEventListener` (`@Async`
  `@TransactionalEventListener(AFTER_COMMIT)` on a domain event — the pattern for ANY future
  "reacts to a fresh write" surface, not just sleep/weight), and the dual-mode `useCompanionFeed`
  Today swap are the working templates. **To add a new event-triggered kind:** publish a
  `*SavedEvent` from the owning service's `@Transactional` write method (right before returning),
  add a listener method + a `generate*Reaction` method with its own freshness gate, add the kind to
  the `ck_companion_message_kind` CHECK. **To add a new cron-triggered kind:** add a `*-cron`
  property to `ProactiveProperties.Feed`, a `@Scheduled` method on `CompanionMessageJob`, and widen
  `ensureTodayCronKinds`' elapsed-check in `ProactiveFeedService` for its lazy miss-recovery. **To
  move a cron:** `mezo.proactive.feed.{morning,midday,evening}-cron` (never add a catch-up loop — a
  past day is never read; unchanged from the old briefing/heartbeat reasoning, §9 decision f).
  **There is no successor to `refreshIfStale`/`regen_count`** — do not resurrect a staleness-regen
  path; if a kind needs fresher data, make it event-triggered instead (§9 decision retired-regen).
- **W1 shipped (weekly generator + Monday cron + FE swap) — the smart-tier template:** `WeeklySuggestionGenerator`
  (pure-code `gather` at the smart tier, `completeSmart`, plain-prose output, honest-null),
  `WeeklySuggestionJob` (`@Scheduled`, three-switch, current-week-only, per-user isolation) and the
  real-only FE swap (originally `useWeekly().weeklySuggestion`, now `/me/week`'s `useWeekNextSuggestion`
  post-`mezo-p2tr`) are the working templates for W2/H/P. It is the
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
- **The original proactive epic is COMPLETE (all 8 slices), `mezo-h4wp.6` (H2 Web Push) is
  COMPLETE, and `mezo-gst9` then redesigned the B/H stages into the companion feed.** N1 (delivery
  spine — VAPID + `push_subscription` + the SW push handler), N2 (the per-minute
  `NotificationDispatchJob` + `notification_pref`/`push_log` + categories 1-9), and N3
  (`notification_schedule` + the FE preview header + categories 10-11) all shipped 2026-07-29 — the
  companion-feed/weekly/memoir prose reaches Daniel's iPhone with the app closed, not only the
  in-app surfaces (`AnchorResolver` now reads `companion_message` for five of its seven prose
  categories, two of them NEW — `evening`, `sleep_reaction`, `weight_reaction` — see
  [`_platform-notifications.md`](_platform-notifications.md)). New proactive surfaces belong to the
  deferred-signals epic (spec §1: vulnerable/niggle sources, crisis/drift, opportunity scanner,
  anniversaries) — map it companion-style when picked up. Any new EVENT-triggered surface follows
  the companion-feed pattern above; any new STANDALONE weekly/structured surface: add a sibling
  `*Generator` + table + `*.yml` fragment in `feature/proactive/`, gated on the same dual switch;
  smart-tier narratives reuse the gather idiom, a plain-prose surface follows `weekly_suggestion`, a
  structured one follows `memoir`, a deterministic-verdict one reuses `MetricWindowEvaluator`.
- **Prompt / marker tuning:** the prompts are `CompanionMessageGenerator.MORNING_PROMPT` /
  `SLEEP_PROMPT` / `WEIGHT_PROMPT` / `WINDOW_PROMPT` / `WeeklySuggestionGenerator.PROMPT` /
  `MemoirGenerator.PROMPT` / `PredictionGenerator.PROMPT` / `ExperimentProposalGenerator.PROMPT`
  (keep each `*_MARKER` prefix + its `FakeCompanionLlm` literal mirror in sync — §9 gotcha a); the
  morning ref candidates are `MORNING_CANDIDATES` (Goal/Workout/FuelDay/Medication, deliberately no
  WeightTrend/Sleep) + the per-summary `Memory` refs in `gather`; `SLEEP_CANDIDATES`/
  `WEIGHT_CANDIDATES` are the sleep/weight-kind lists; `midday`/`evening` carry the tool-audit refs
  (mezo-106s — the retired-heartbeat no-refs precedent is superseded); the prediction/experiment
  carry pattern candidates — the prediction resolves them to CONFIDENCE, the experiment only
  uses them for grounding.
- **Never add `confidence`/`tone`** back to the envelope without a real computed source (§9 gotcha c).

## 8. Testing

Integration-first, over the fixed `mezo_test` DB (or Testcontainers); the fake LLM's
`[fake-feed-morning:{…}]`/`[fake-feed-sleep:{…}]`/`[fake-feed-weight:{…}]`/`[fake-heartbeat:…]`
(window kinds) + `[fake-weekly:…]` + `[fake-memoir:{…}]` + `[fake-prediction:{…}]` +
`[fake-experiment:{…}]` sentinels script deterministic answers.

**Companion feed (`mezo-gst9`, replaces the old B/H1 test classes — `BriefingPersistenceIT`/
`BriefingGeneratorIT`/`BriefingJobIT`/`BriefingJobSwitchOffIT`/`BriefingFreshnessIT`/
`HeartbeatPersistenceIT`/`HeartbeatGeneratorIT`/`HeartbeatJobIT`/`HeartbeatJobSwitchOffIT`/
`HeartbeatLazyIT` are ALL DELETED, not renamed):**

- **`CompanionMessagePersistenceIT` (5)** — envelope jsonb round-trip; the partial unique index
  rejects a second LIVE row for the same (user, day, **kind**) but allows another kind the same day;
  soft-delete allows regeneration; owner-scoped finder isolation; the generation-order finder.
- **`CompanionMessageGeneratorIT` (17)** — per kind: `generateMorning` persists when the summary
  window has data / returns null on an empty window / idempotent on a second call;
  `generateSleepReaction` persists when a fresh sleep log exists / returns null without one /
  idempotent / includes the `earlierMessagesBlock` when a morning message already exists;
  `generateWeightReaction` persists when today has a weigh-in / returns null without one;
  `generateWindow` persists for midday / persists for evening / returns null on a blank answer /
  returns null on an empty summary window / idempotent; **Emberek S6** (`mezo-06o0.8`) added
  `generatePeopleObservation` persists a message built from the week's per-person aggregates /
  returns null with no mention this week (the data gate) / idempotent on a second call.
- **`CompanionMessageJobIT` (6)** — `runMorning` generates today's morning message for a user with
  narrative memory / is idempotent / skips a user without memory and still serves others (per-user
  isolation) / does NOT generate the sleep reaction even when a fresh sleep log already exists
  (mezo-qn3z — event-kind only); `runMidday`/`runEvening` each generate their window kind for a
  user with memory.
- **`CompanionMessageJobSwitchOffIT` (2)** — `mezo.techcore.cron.feed-job.enabled=false` ⇒ no
  `CompanionMessageJob` bean (the third switch, now covering all three crons at once).
- **`CompanionMessageEventIT` (4)** — logging fresh sleep creates the sleep-reaction message;
  logging a backfilled sleep date does NOT (freshness guard); logging today's weight creates the
  weight-reaction message; logging a backfilled weight date does NOT. Exercises the REAL
  `@TransactionalEventListener(AFTER_COMMIT)` + `@Async` path end-to-end over HTTP (`ApiIntegrationTest`),
  not a mocked listener.
- **`ProactiveApiFeedIT` (7)** — `GET /api/proactive/feed`: empty list when no messages and no
  narrative memory (honest empty, not 404); returns persisted rows in `generatedAt` order; lazily
  generates the morning message when missing for today; lazily generates elapsed window kinds
  (midday, via a midday-or-later clock override) when missing; does **NOT** generate for a past date;
  **still serves the messages that exist when a lazy generate throws** (`[fake-fail]` planted in the
  check-in note — the §9 read-path-isolation guard; it fails if `getFeed` is made `@Transactional`
  again).
- **`ProactiveApiSwitchOffIT`/`ProactiveApiCompanionOffIT` (feed cases, mezo-8g61)** —
  `GET /api/proactive/feed` 404s (`RESOURCE_NOT_FOUND`) with `mezo.feature.proactive.enabled=false`
  and with `mezo.feature.companion.enabled=false` — the dual-switch `@ConditionalOnProperty`
  bean-absence gating (§9 gotcha b). Meaningful because `ProactiveApiFeedIT` proves the same path
  serves 200 when both switches are on, so the 404 can only come from bean absence. (The classes'
  earlier briefing/heartbeat cases were retired with those endpoints — an unmapped path 404s the
  same way for any URL, so they had stopped proving the gating.)

**W5.2 intervention delivery (`mezo-b3pp.19`, spec §9.2) — the sixth `companion_message` kind,
non-LLM, owned here (`feature.proactive`); the trigger side (`FlagService`/`FlagRaisedEvent`) is
companion's own, [companion.md](companion.md) §8:**

- **`InterventionServiceIT`** — the raise→selection→candidate path: picks the higher-effectiveness
  candidate, an unseen key beats a voted one (`OPTIMISTIC_PRIOR`), a cooled-down key falls through to
  the next-best, every candidate in cooldown delivers nothing, and the REAL
  `@TransactionalEventListener(AFTER_COMMIT)` + `@Async` path delivers end to end (the
  `CompanionMessageEventIT` idiom) as an `advice` row via `AdviceCardService` (S4 — the one-card-per-
  day / supersede behavior itself is `AdviceCardServiceIT`'s, below).
- **`InterventionConfigIT`** — the library binds, covers every flag, and every key is unique.
- **`InterventionSwitchOffIT`** — `mezo.feature.intervention.enabled=false` ⇒ no
  `InterventionService` bean; the flag log itself is unaffected (a `COMPANION_SWITCH`/
  `PROACTIVE_SWITCH` concern, not this switch's).
- **`CompanionMessageInterventionPersistenceIT`** — the sixth kind round-trips with its envelope
  `interventionKey`; an unrecognized `kind` value still trips the widened CHECK.
- Push-anchor + quiet-hours resolution (`InterventionFireMinuteTest`, `AnchorResolverInterventionIT`,
  `NotificationCategoryTest`, `NotificationPrefApiIT`) live under `feature.notification` — see
  [`_platform-notifications.md`](_platform-notifications.md) §8/§3d.
- Commands: `cd backend && ./mvnw clean test -Dtest='CompanionMessageInterventionPersistenceIT,InterventionConfigIT,FlagServiceIT,InterventionServiceIT,InterventionSwitchOffIT,InterventionFireMinuteTest,AnchorResolverInterventionIT,AnchorResolverIT,AnchorResolverFeedIT,NotificationPrefApiIT,NotificationCategoryTest,Feedback*IT' -Dmezo.test.use-testcontainers=true` — the full focused re-run this slice's Task 9 gate runs (`AnchorResolverIT`/`AnchorResolverFeedIT` are regression guards on the shared `AnchorResolver.resolve` entry point, not new W5.2 cases).

**S3 setup checks (bd `mezo-d58h.3`, spec 2026-09-03 §4 setup table) — the eighth `companion_message`
kind, non-LLM (the second config-text kind after `intervention`), cron-only, owned entirely here
(`feature.proactive`; no companion-side trigger to document):**

- **`SetupCheckServiceIT`** — `runFor` emits the missing-sleep-goal card when no `sleep_goal` row
  exists; stays silent when the goal row exists (and the plan is feasible); does not repeat the same
  check inside the re-emit window; emits a new card once the prior one is outside the window. (Each
  emit lands as an `advice` row via `AdviceCardService` since S4 — the day-gate/supersede behavior
  itself is `AdviceCardServiceIT`'s, below.)
- **`PlanFeasibilityIT`** (11 cases) — the plan-feasibility check's own cases, including the
  **day-pairing correction** (S3 whole-branch review, owner decision, same bd id): the sport half
  pairs each evening with the morning that ACTUALLY follows it (weekday `(D + 1) mod 7`, 0=Monday..
  6=Sunday on both `gym_schedule_slot.dayOfWeek`/`sport_schedule_slot.dayOfWeek`), never the
  earliest morning anywhere else in the week — emits when a day-paired evening sport slot pushes
  past its own following morning's required lights-out (the largest-misfit slot binds, and its
  weekday rides along as `Verdict.bindingDay`); emits when the observed median bedtime does instead
  (the bedtime half stays deliberately day-agnostic — judged against the week's tightest morning,
  since a habitual bedtime happens every night — `bindingDay` is null there); stays silent when the
  schedule fits inside `misfitToleranceMin` (including via the WAKE anchor's own wake time filling
  in as the next day's obligation when that day has no gym slot of its own); stays silent — the
  first of the three deliberate silences (spec §7, never estimate) — when there is NO morning
  obligation anywhere in the week and the goal is BED-anchored (nothing to be early FOR at all, the
  day-agnostic gate); stays silent — the regression guard for the bug this correction fixes — when
  a sport slot's OWN following day has no morning obligation and the goal is BED-anchored (the slot
  is skipped rather than compared against some other day's obligation); stays silent — the third
  silence — when there is a morning obligation but neither half has anything to say; covers the
  Sunday→Monday `(6 + 1) mod 7` wrap explicitly; covers the bedtime half binding when there is no
  sport schedule at all (the two halves are not accidentally coupled); the exact-tolerance boundary
  (misfit == `misfitToleranceMin`) is still feasible, not infeasible (`<=`, not `<`); a malformed
  `sport_schedule_slot`/`gym_schedule_slot` row (`"99:99"`) is dropped rather than thrown, in both
  the day-agnostic and the per-day obligation scans; and the missing-goal card wins over a
  feasibility computation when there is no goal at all (checks are ORDERED, first-wins — the second
  silence, though it never reaches `PlanFeasibilityCalculator` at all, since
  `SetupCheckService.runFor` short-circuits on the empty-goal branch first).
- **`SetupCheckPropertiesIT`** — the whole `mezo.proactive.setup-checks.*` tree (including the
  nested `planFeasibility` record) binds from yml.
- **`SetupCheckJobSwitchOffIT`** — `mezo.techcore.cron.setup-check-job.enabled=false` ⇒ no
  `SetupCheckJob` bean; `SetupCheckService` itself is unaffected (a direct call still works).
- Commands: `cd backend && ./mvnw test -Dtest='SetupCheck*IT,PlanFeasibilityIT' -Dmezo.test.use-testcontainers=true -q` — note `ProactiveFeed*IT` does NOT match `ProactiveApiFeedIT` (no glob hits), so it proves nothing about the feed read path staying untouched; run `ProactiveApiFeedIT` explicitly if that needs re-covering.

**S4 advice card (bd `mezo-d58h.4`, spec §4/§5) — the ninth `companion_message` kind, the ONE writer
of the day's coaching card, unifying the W5.2 intervention and S3 setup-check delivery paths above:**

- **`AdvicePriorityTest`** — pure unit test over `AdvicePriority.ORDER`: every live `FlagKey`
  constant plus both `SetupCheckService.CHECK_*` constants has a rank; `outranks` is STRICT (an
  equal rank does not outrank); an unmapped key ranks past the end of the table (logged, not thrown).
- **`AdviceFactRendererTest`** — pure unit test: each mapped `FlagKey` renders its own deterministic
  fact lines off a scripted `FlagPayloadEnvelope`; a null payload or an unmapped key yields `[]`.
  **This reflection guard is what actually enforces the "every `FlagKey` needs a render case"
  contract** (`AdviceFactRenderer`'s `default -> List.of()` degrades silently otherwise, §9 decision
  (ll) above) — when S6's six `FlagKey` constants first landed, the task that added them did not
  run this class, so the guard went red and stayed red for two commits; the fix was for each of the
  six rules' own task to add its own fixture, closing the guard incrementally rather than in one
  sweep at the end.
- **`ProseNumberGuardTest`** — pure unit test: every numeral in grounded prose passes; an invented
  numeral fails; a decimal-comma numeral in the prose matches its decimal-dot form in the grounding
  (and vice versa); blank prose never passes.
- **`AdviceCardServiceIT`** — `deliver`: writes the FIRST candidate of the day as `kind=advice`; a
  candidate that does NOT strictly outrank today's incumbent is dropped (incumbent kept, unchanged);
  a STRICTLY higher-severity candidate supersedes it — soft-deletes the incumbent and inserts the new
  row inside the same transaction (the partial unique index permits it); an equal-severity re-raise
  of the SAME key does not displace the incumbent; the superseded row's feedback stays dangling
  (unreferenced, not cleaned up) — the spec §8.1 contract.
- **`AdviceProseGeneratorIT`** — asserts `ADVICE_MARKER` matches `FakeCompanionLlm`'s mirror; a
  scripted grounded answer is used verbatim; an exception/blank/ungrounded-numeral answer each fall
  back to `candidate.fallbackProse()`. `@ActiveProfiles("companion-fake")` (§9 decision kk trap #3).
- **`CompanionMessageAdvicePersistenceIT`** — the ninth kind round-trips with its envelope
  `adviceKey`/`facts`/`suggestions`; an unrecognized `kind` value still trips the widened CHECK.
- **`CompanionMessageMissedWorkoutsIT`** — `CompanionMessageGenerator.missedWorkoutsBlock` renders
  the fact block from an in-window `missed_workouts` raise's own frozen payload; renders `""` when
  the raise is outside the `feed.past-days` lookback window or there is no raise at all.
- Regression guards on the two silently-dead-until-S4 consumers (§9 decision kk trap #1):
  `AnchorResolverInterventionIT` (push anchor now reads `advice` too) and `FeedbackLearningServiceIT`
  (the effectiveness rollup now reads `advice` too).
- Commands: `cd backend && ./mvnw test -Dtest='AdvicePriorityTest,AdviceFactRendererTest,ProseNumberGuardTest,AdviceCardServiceIT,AdviceProseGeneratorIT,CompanionMessageAdvicePersistenceIT,CompanionMessageMissedWorkoutsIT,InterventionServiceIT,InterventionConfigIT,InterventionSwitchOffIT,SetupCheckServiceIT,SetupCheckJobSwitchOffIT,SetupCheckPropertiesIT,PlanFeasibilityIT,ProactiveApiFeedIT,CompanionMessageGeneratorIT,CompanionMessageJobIT,AnchorResolverInterventionIT,FeedbackLearningServiceIT' -Dmezo.test.use-testcontainers=true -q` — this slice's Task 14 full focused gate.

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

**FE (Vitest + RTL):** `data/today/feedHooks.test.tsx` — wire→`FeedMessage[]` mapping via
`toFeedMessages`, real-mode 60s poll config, mock mode returns `[]` synchronously without fetching
(replaces `briefingHooks.test.tsx`/`heartbeatHooks.test.tsx`, both deleted);
`features/today/logic/mezoMessages.test.ts` — thread building from `{feed, demoBriefing}`: feed
messages map 1:1 in order; the demo card prepends only when the feed has no `morning` kind; the demo
card is absent once a real morning message exists; an empty feed with no demo briefing ⇒ `[]`
(replaces the old briefing-only+heartbeat-note thread-building coverage — `CompanionNoteCard.test.tsx`
is deleted, there is no separate card any more). **W1 (as originally shipped — both files retired
`mezo-p2tr` along with the Insights Weekly tab; the coverage lives on with the `Heti` hub in `features/me/pages/WeekHubPage.test.tsx`, [me.md](me.md)):**
`data/insights/weeklyHooks.test.tsx` (+2) — serves the generated prose when the GET succeeds; keeps
`weeklySuggestion` null on the default 404; `features/insights/pages/WeeklyPage.test.tsx` (+1) —
renders the live prose WITHOUT the inert „Elfogad/Hangoljuk" buttons. **W2:**
`data/insights/memoirHooks.test.tsx` (3) — maps the server memoir with a derived `Hét N …` week label
(anniversaryNote null, mode live); returns null memoir on the default 404; returns the seed +
anniversaryNote without fetching in mock mode; `features/insights/pages/MemoirPage.test.tsx` gains a
real-mode describe (renders the real memoir + anchors, no anniversary/archive; the 404 shows
the honest „készül" placeholder, not demo fiction); `insights.nav.test.tsx` flips Memoir from hidden to
visible (5 real-mode tabs incl. Memoir) — at the time `InsightsSubNav.test.tsx` covered this too, but
that file is since deleted with the component it tested (compact-header redesign, `mezo-ugqb`; the
dropdown-based `SubNavDropdown`/`insights.nav.test.tsx` cover the same visibility behavior now). **P1:**
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
tabs now**). MSW defaults: `/api/proactive/feed` returns `200 []`, `/api/proactive/{weekly-suggestion,memoir}`
return 404, `/api/proactive/prediction` and **`/api/proactive/experiment` return `200 []`**, plus default
`POST …/experiment/{propose,{id}/decision}` handlers (list endpoints' honest default is an empty array).

Test infra: `support/populator/{CompanionMessagePopulator,WeeklySuggestionPopulator,MemoirPopulator,PredictionPopulator,ExperimentPopulator}.java`
(`CompanionMessagePopulator` replaces the deleted `BriefingPopulator`+`HeartbeatNotePopulator`; all
in the `AbstractIntegrationTest` `@Import` list) + `companion_message`, `weekly_suggestion`,
`memoir`, `prediction` and `experiment` in the `ResetDatabase` TRUNCATE list (`briefing`/
`heartbeat_note` dropped from both the schema and the list together). Full backend + FE gates green
at `mezo-gst9` close (BE clean-test green — 1898 tests, 0 failures; FE both modes + build).

**Weekly review (WR, `mezo-p2tr`)** — the `[fake-review:{…}]` sentinel (GREEDY, nested
`dayNotes`/`anchorIndexes` payload — the payload nests objects, so the match must run to the LAST
brace, planted via a memoir title) dispatches on `WEEKLY_REVIEW_MARKER_MIRROR` (§9 gotcha a, the
literal-mirror rule). `feature/companion/service/DayScoreServiceIT.java` pins the day-score formula
per subscore over the engine's **six** dimensions (`nutrition`/`quality`/`training`/`sleep`/`logging`/`rhythm`
— see [me.md](me.md) for the current dimension table) and the 1–10 (not 1–5) normalization. `feature/companion/controller/
MeWeekControllerIT.java` covers the 7-day shape + the `ME_WEEK_START_NOT_MONDAY` 400 +
weekly-aggregate math. `feature/proactive/service/WeeklyReviewGeneratorIT.java` covers the empty-week
no-row gate, the idempotent existing-row short-circuit, bounds-checked anchor resolution, and the
`WEEKLY_REVIEW_READY` notification emission. `feature/proactive/controller/WeeklyReviewControllerIT.java`
covers the never-lazy 404, the `stale` probe (re-probed on `regenerate` too, not hardcoded), the
regenerate 409/404, and the digest's 400-on-non-Monday + otherwise-always-200 contract. `AnchoredConversationIT` (companion) covers `context_kind`/`context_date` persistence, the
assistant-only opening turn, and its swallow-and-log failure path. FE: `frontend/src/data/me/
{meWeekHooks.test.tsx,weeklyReviewHooks.test.ts}`, `frontend/src/features/me/{pages/{WeekHubPage,WeekAnalysisPage,WeekDaysPage,WeekLessonsPage,WeekDiscoveriesPage}.test.tsx,
logic/useChatHandoff.test.ts,components/week/WeekDayTile.test.tsx}` (`WeekReviewCard`/`WeekScoreBars`
have no dedicated component test files — their behavior is covered at the hub/view-page
integration level), `frontend/src/app/router.weeklyRedirect.test.tsx` (the `/insights/weekly →
/me/week` redirect). Full test list: [me.md §8](me.md).

**Owner-zone snapshot (`mezo-ned9`, 2026-09-05):**

- **`service/ContextSnapshotOwnerZoneIT` (3)** — one test per gather that derives its OWN "today"
  for `ContextSnapshotAssembler.render(...)` (`ChallengeGenerator`, `ExperimentProposalGenerator`,
  `WeeklySuggestionGenerator`): the JVM default zone is swapped for a fixed-offset zone sitting one
  calendar day off `MedicationCycleService.MEDICATION_ZONE` (the `LlmCallListMidnightIT` idiom
  applied to the DEFAULT zone, since `MEDICATION_ZONE` is a constant and cannot be moved by a
  property), with two hours of clearance either side of that zone's own midnight so a slow run
  cannot roll the day back. Each test asserts the snapshot header date IS the owner-local day and
  that the `[Gyógyszer]` cycle day equals `MedicationCycleService#deriveToday`'s. Before the fix all
  three failed deterministically (header `2026-09-06` vs `2026-09-05`, `ciklus 4. nap` vs `3.`).

## 9. Decisions, gotchas & deferred

- **(a) All TEN generator markers are literal-mirrored in `FakeCompanionLlm` — keep in sync.** The
  fake dispatches on `MORNING_MARKER_MIRROR` (`"REGGELI-ELIGAZITAS-FELADAT"`), `SLEEP_MARKER_MIRROR`
  (`"ALVAS-REAKCIO-FELADAT"`), `WEIGHT_MARKER_MIRROR` (`"SULY-REAKCIO-FELADAT"`) — the three NEW
  `mezo-gst9` kinds, replacing the single retired `BRIEFING_MARKER_MIRROR` — `WEEKLY_MARKER_MIRROR`
  (`"HETI-TERVJAVASLAT"`), `MEMOIR_MARKER_MIRROR` (`"HETI-MEMOIR-FELADAT"`), `HEARTBEAT_MARKER_MIRROR`
  (`"NAPKOZBENI-JEGYZET-FELADAT"` — the sentinel NAME survives from H1 even though it now mirrors
  `CompanionMessageGenerator.WINDOW_MARKER`, not a `HeartbeatGenerator` that no longer exists),
  `PREDICTION_MARKER_MIRROR` (`"HETI-PREDIKCIO-FELADAT"`), `EXPERIMENT_MARKER_MIRROR`
  (`"N1-KISERLET-FELADAT"`), `CHALLENGE_MARKER_MIRROR` (`"EDZES-KIHIVAS-FELADAT"`, mirroring
  `ChallengeGenerator.CHALLENGE_MARKER`) and — the WR addition, `mezo-p2tr` —
  `WEEKLY_REVIEW_MARKER_MIRROR` (`"HETI-ELEMZES-FELADAT"`, mirroring `WeeklyReviewGenerator.
  WEEKLY_REVIEW_MARKER`, sentinel `[fake-review:{…}]`), **copies** of the generators' `*_MARKER` constants, NOT
  imports — a `companion` → `proactive` import would create a package cycle that the frozen ArchUnit
  rule fails the build on. Each literal pair must be edited together (both carry a comment pointing
  at the other; drift fails the generator IT loudly). The markers are prefix-collision-checked
  (`FakeCompanionLlm` dispatches by `startsWith`): the three `HETI-*` markers all diverge by char 6,
  and `REGGELI-*`/`ALVAS-*`/`SULY-*`/`NAPKOZBENI-*`/`N1-*`/`EDZES-*` share no prefix with any.
  **The prediction, experiment AND challenge sentinel regexes are GREEDY** (`\[fake-…:(\{.*\})]`, DOTALL)
  unlike the memoir's non-greedy one — those payloads (`{"predictions":[{…}]}` / `{"experiments":[{…}]}`
  / the challenge `{…proposals…}`) nest objects, so a non-greedy match would stop at the FIRST inner
  `}` and truncate the JSON. The morning/sleep/weight sentinels (`[fake-feed-morning:{…}]`/
  `[fake-feed-sleep:{…}]`/`[fake-feed-weight:{…}]`) are non-greedy (their JSON is flat, no nesting).
- **(a2) The three read-only responses now expose their row `id` — because feedback needed it, not because the surface did (`mezo-b3pp.15`, Phase 5 W4.1).** `FeedMessageResponse`, `WeeklySuggestionResponse` and `MemoirResponse` were the last proactive reads with no id on the wire: their surfaces only render, never write back, so nothing had ever needed one. W4.1's 👍/👎 capture changed that — `message_feedback.artifact_id` IS that row id. The addition is **contract-only** (all three are MapStruct-mapped from entities that always had `id`) and **required, not optional** — a nullable id would push a "can this be voted on?" branch into every consumer for a case that cannot happen. Consequence worth knowing: the FE's `weeklySuggestionApi.get` stopped returning a bare prose string and now returns `{id, prose}`, so the consumer (originally `useWeekly`, now `/me/week`'s `useWeekNextSuggestion` post-`mezo-p2tr`) carries the id alongside the prose (§5.5). **Proactive owns none of the feedback machinery** — the table, the `/api/companion/feedback` surface and the FE hook are all companion-side ([`companion.md` §4/§5.7](companion.md)); proactive's whole contribution is these three fields.
- **(b) Proactive beans condition on BOTH switches.** Every bean is
  `@ConditionalOnProperty(name = {COMPANION_SWITCH, PROACTIVE_SWITCH}, havingValue = "true")` —
  proactive calls the `CompanionLlm` port, so it presupposes companion. Switch either off ⇒ no beans
  ⇒ `/api/proactive/*` 404s (proven by both switch-off ITs). The gate is structural (bean absence),
  not a runtime 403.
- **(c) `confidence`/`tone` are deliberately absent from the wire.** The FE `Briefing` type carries
  `confidence`/`tone`, but the envelope and `FeedMessageResponse` (the old `BriefingResponse`) omit
  both: an LLM's self-reported confidence is a **fabricated number** (the honest-numbers rule, spec
  §6), and `tone` is dead FE data with no source. Don't reintroduce either without a real computed
  value.
- **(d) Empty summary window ⇒ no row for the cron kinds (a shorter feed array, never a
  fabrication).** No `daily_summary` in `feed.past-days` for `morning`/`midday`/`evening` (or an
  unusable LLM answer — JSON kinds: null/blank eyebrow/empty body; window kinds: blank prose) ⇒
  `generate*` returns null ⇒ that kind simply doesn't appear in the feed array. `sleep`/`weight`
  have their OWN gate instead (a fresh log, not the summary window — decision retired-regen below).
  A generation with no narrative memory to ground it would be fabricated; the honest state is
  "nothing yet" (the FE thread shows fewer bubbles, or the demo fallback while `morning` is absent).
  The weekly suggestion's own emptiness gate (prior week, unrelated table) is unaffected — see (i).
- **(e retired) Staleness was sleep-only in the old briefing, windowed `date >= day-1`, capped
  2/day — RETIRED, see "retired-regen" below.** This decision letter is intentionally left as a
  historical marker; do not reuse it for something unrelated.
- **(f) The crons do NOT backfill — today only.** `CompanionMessageJob` generates only
  `LocalDate.now()` per user, for all three cron kinds. A past day's message is never read (the feed
  read is always for a given day, but only TODAY triggers miss-recovery), so pre-generating history
  would be pure waste; a missed cron run is recovered by the lazy GET the next time the app opens.
  This is the deliberate difference from the companion `DailySummaryJob`'s catch-up=backfill idiom
  (summaries ARE read historically; feed messages are not) — unchanged reasoning from the retired
  `BriefingJob`.
- **(g retired) A failed regeneration used to serve 404 for that request only, restoring the old
  row via transaction rollback — RETIRED with `refreshIfStale`.** See "retired-regen" below; there
  is no regeneration left to fail.
- **(h) FE fallback: the demo card is the honest degraded state, and `briefingVariants` never apply
  to a generated message.** `buildMezoMessages` prepends `resolveBriefing(dayState)` — the labelled
  Phase-1 static card, merged with `briefingVariants` (good/rough tone spread) — ONLY while the feed
  carries no `morning` kind (mock mode: always, since the feed is always `[]`). Those variants shape
  ONLY the fallback card; every generated message renders verbatim. `Briefing.confidence` stayed
  **optional** in `types.ts` (unchanged from B1.2) so the server shape (no confidence) is a valid
  `Briefing` for the fallback path — the demo card shows „Demo tartalom", a real message shows a
  Confidence % only if one is ever set, else nothing (§9 gotcha c / the honest-numbers rule).
- **(retired-regen) The sleep-triggered "regen" mechanism the old briefing had — `refreshIfStale` +
  `regen_count`, capped 2/day, soft-delete + reinsert on a late `sleep_log` — is RETIRED, not
  ported, and there is deliberately no successor decision/property/column.** It existed only because
  the old dawn briefing was generated BEFORE the morning's sleep log could exist, so a late log had
  to trigger a correction. Event-triggered generation (`CompanionMessageEventListener`) removes the
  root cause: `sleep`/`weight` messages are now generated ONLY once their grounding data already
  exists, so there is nothing to detect as stale and nothing to regenerate. Do not re-add a
  staleness check "just in case" — if a future kind needs fresher data than its cron provides, make
  it event-triggered (§7's extension recipe), don't reinvent read-path regen.
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
- **(k) The „Elfogad / Hangoljuk" buttons were hidden in live mode (false affordance), as originally
  shipped.** They never had handlers — accept/tune interactivity is deferred (spec §5). `WeeklyPage`
  rendered them only when `mode === 'mock'`; live mode showed the prose alone (`WeeklyPage.test.tsx`
  pinned their absence in real mode). **Since `mezo-p2tr`** the successor, `/me/week`'s `WeekNextCard`,
  drops the mock-only buttons entirely rather than carrying the conditional forward — the prose +
  feedback chips render the same way in both modes now.
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
- **(p) Two window kinds v1 — explicit config properties, not a dynamic list.** `midday` (eyebrow
  `Napközi jegyzet`, `0 30 12 * * *`) + `evening` (eyebrow `Napzárás`, `0 30 20 * * *`) under
  `mezo.proactive.feed.{midday,evening}-cron` (ported unchanged from the retired
  `mezo.proactive.heartbeat.*`, just relocated). The roadmap's "config window list" is satisfied by
  two named crons — a dynamic window list would need programmatic scheduling for zero current
  benefit (YAGNI); adding a third window is a §7 recipe.
- **(q) Same-day overlap-dedupe is prompt-level, and now covers every kind, not just the
  morning message.** `earlierMessagesBlock` injects every already-persisted `companion_message` row
  of the day under `MAI KORÁBBI ÜZENETEK (ne ismételd):` and each kind's prompt forbids repeating
  it — deterministic, zero infra, the retired heartbeat's `MAI BRIEFING` idiom generalized from ONE
  hardcoded source (the briefing) to ALL earlier same-day messages (morning/sleep/weight/midday). If
  today has no earlier message the block is simply absent.
- **(r) The lazy path derives window fire-times from the SAME job crons (`CronExpression`), only
  for TODAY, only the elapsed windows; no staleness/regen for ANY kind (not just the window ones).**
  One source of truth for the schedule (`ProactiveFeedService.elapsed`, unchanged idiom from the
  retired `ProactiveHeartbeatService.latestElapsedWindow`); a past date never lazy-generates (a
  window message is grounded in the day's live state — generating yesterday's "midday" note today
  would be fiction); a missed window's message simply appears once the next lazy GET runs. No cap,
  no regen anywhere in the feed model (decision retired-regen) — the next window is hours away
  regardless (the W1/W2 YAGNI reasoning at intra-day cadence, unchanged).
- **(s) The morning/midday/evening emptiness gate reuses `feed.past-days` — but `sleep`/`weight`
  do NOT.** One knob answers "does the companion have narrative memory of Daniel yet" for the three
  cron kinds; a cron-kind message with zero `daily_summary` grounding would be generic filler (the
  honest-absence rule). `sleep`/`weight` instead gate on a FRESH log existing (their OWN grounding
  event) — narrative-memory emptiness is irrelevant to them, they're reacting to a just-logged fact,
  not summarizing a history. The snapshot itself always renders (`nincs adat` absences), so the
  cron-kind gate must come from the summaries specifically.
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

**Companion feed (`mezo-gst9`) additional decisions:**

- **(cc-feed) The event-fired push categories deviate from the design spec's literal wording —
  DELIBERATELY.** Spec §8 (`2026-08-15-companion-feed-design.md`) says the event kinds
  (`sleep`/`weight`) get "közvetlen dispatch" — a direct `PushDispatchExecutor` call right after
  generation, since they have no fixed daily slot to anchor on. The SHIPPED implementation instead
  anchors them on **the row's own `generatedAt` minute** (`AnchorResolver.sleepReactionAnchor`/
  `weightReactionAnchor`) and rides the EXISTING per-minute `NotificationDispatchJob` spine — the
  same spine every other category (gym, medication, briefing/morning, …) already uses — rather than
  a second, parallel dispatch path. This is a superset of the spec's intent ("push shortly after
  generation") that gets pref/dedup/catch-up **for free** from the shared spine instead of
  reimplementing them for one-off direct dispatch (the self-review note that flagged this before
  Task 10 shipped it). Two NEW preference categories exist as specified — `SLEEP_REACTION`,
  `WEIGHT_REACTION` (plus a third, `EVENING`, replacing the old `midday`-adjacent heartbeat-closing
  category) — see [`_platform-notifications.md`](_platform-notifications.md) for the full 14-category
  catalog and `AnchorResolver`'s per-category anchor rules.
- **(dd-feed) The event listener never touches the logging request's own transaction or response.**
  `@TransactionalEventListener(phase = AFTER_COMMIT)` fires ONLY after `SleepLogService.log`/
  `WeightLogService.log`'s transaction has already committed (so a rolled-back log never spawns a
  reaction message), and `@Async` moves the LLM call off the request thread entirely (the
  `applicationTaskExecutor`, the `PushDispatchExecutor` precedent) — a slow Gemini call adds ZERO
  latency to "how long did saving my sleep log take", and a failed generation (caught + logged
  inside the listener) can never surface as an error on that request either. This is why the feed
  message can lag the log by a few hundred ms to a couple of seconds in practice, which the FE's
  60s poll + mutation-triggered invalidation both account for (§5.4).

- **(ee-feed) Read-path isolation: `getFeed` carries NO `@Transactional`, and that is what makes its
  try/catch real** (`mezo-y33b`). The lazy miss-recovery calls generators that are themselves
  `@Transactional`; under an ambient transaction they would JOIN it, so a failed generate marks the
  whole read rollback-only and the reader gets `UnexpectedRollbackException` **no matter how the call
  is wrapped** — the exact trap recorded for `OverloadChallengeGenerator` below. Unannotated, each
  generate opens its own transaction, `generateQuietly` catches + warns, and the read still returns
  everything already persisted. The realistic trigger is a lost insert race (the FE's 60s poll and
  the cron both find a kind missing, both insert, the loser trips
  `uq_companion_message_created_by_date_kind`) — previously a transient 500 on an otherwise perfectly
  serviceable feed. Dropping `@Transactional` is safe here because every mapped column is a basic or
  jsonb attribute: there is no lazy association to walk with `open-in-view` off.
  `ProactiveApiFeedIT.testGetFeed_shouldStillServeExistingMessages_whenLazyGenerationThrows` is the
  guard and fails the moment `@Transactional` returns.

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
  Tempo deferred** (no tempo is logged, so it can't be honestly evaluated) — extended in Plan 3
  (`mezo-gj42`) to add `overload` (deterministic, always emits complete weight/rep targets, so no
  validation-drop needed).
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

- **(ii) `intervention` is the sixth `companion_message` kind, but it does not extend
  `CompanionMessageGenerator` and never calls `CompanionLlm` (W5.2, bd `mezo-b3pp.19`, spec §9.2).**
  Every prior kind is generator-produced: pure-code gather → one LLM call → parse → save. The card's
  full text is `mezo.companion.interventions[].textHu` — config, chosen by
  `feature.proactive.service.InterventionService`'s selection algorithm, never composed by a model.
  Recorded here as a deliberate architectural break from the "one method per kind on
  `CompanionMessageGenerator`" pattern this doc otherwise holds to: `InterventionService` is its own
  class specifically so nobody mistakes it for an eighth generator method and reaches for
  `CompanionLlm` inside it. The table shape didn't need to change (the CHECK widened, nothing else)
  — see §4's W5.2 subsection and [companion.md](companion.md) §4/§9 for the full selection math and
  the two shipped decisions (`channel: push` ≡ `both`; one card/day, first raise wins).
- **(jj) `setup` is the eighth `companion_message` kind (S3, bd `mezo-d58h.3`) — cron-only, checks
  CONFIGURATION rather than a day's data, and is silent by design far more often than it speaks
  (spec §7: never estimate).** Three deliberate silence conditions, all in
  `PlanFeasibilityCalculator.evaluate` except the first:
  1. **No sleep goal at all** — owned entirely by the missing-sleep-goal check (§3 above), so the
     feasibility calculator never even runs (`SetupCheckService.runFor` short-circuits first).
  2. **No morning gym slot ANYWHERE in the week AND a BED-anchored goal** — a BED anchor states
     when to go to bed, not what to be up FOR, so there is no obligation to be early for; inventing
     one would be an estimate. This gate stays day-agnostic (see the correction below) — it asks
     whether the week has ANY morning worth being early for at all.
  3. **Neither half has anything to say** — the sport half now also counts as having nothing to say
     when EVERY sport slot's own following day lacks a morning obligation (the day-pairing
     correction below); `minBedtimeSamples` (default 4) honest-gates the bedtime half's median;
     below it, that half stays quiet even though the sport half still could speak (and vice versa).

  **Day-pairing correction (S3 whole-branch review, owner decision, same bd id):** the check
  originally measured the LATEST evening sport slot anywhere in the week against the EARLIEST
  morning obligation anywhere in the week — spec §4 row 6 stated the rule day-agnostically and the
  first implementation faithfully built it, but on a real Mon–Fri-gym / Fri-Sat-volleyball
  schedule that measured a Friday-night session against Monday's gym slot and asserted a conflict
  that did not exist. The owner decided: **the sport half pairs each evening with the morning that
  actually follows it** — weekday `(D + 1) mod 7`, 0=Monday..6=Sunday on both
  `gym_schedule_slot.dayOfWeek` and `sport_schedule_slot.dayOfWeek` (NOT `DayOfWeek.getValue()`); a
  sport slot whose following day has no obligation at all (BED-anchored goal, no gym slot that day)
  is skipped rather than compared against an unrelated day; the slot with the largest per-day
  misfit binds, and its weekday rides along on `Verdict.bindingDay` so the card can name the actual
  evening. **The bedtime half is deliberately NOT day-paired** — asymmetric with the sport half ON
  PURPOSE: an observed median bedtime is a nightly habit, not tied to one weekday, so it is still
  judged against the week's tightest morning exactly as before this correction (`bindingDay` stays
  null for the bedtime source).

  **The midnight frame:** every time operand the calculator compares — the required lights-out, the
  evening sport end, the observed median bedtime — is minutes-from-midnight with anything before
  noon shifted `+1440` (`shiftedMinutes`), so a 00:30 bedtime reads as LATER than a 22:15 lights-out
  rather than 21h45m earlier. `MetricKey.BEDTIME_HOUR`'s own extractor already applies the identical
  shift to its values, so the median-bedtime half's numbers drop straight into the same arithmetic
  with no re-shifting at the call site.

  **Adding a `companion_message` kind (four mirrored changes) is a smaller ritual than adding a
  `FlagKey` (FIVE, [companion.md](companion.md) §9)** — `setup` touched all four: the entity's
  `KIND_*` string constant, the `ck_companion_message_kind` CHECK-widening migration, the
  `FeedMessageResponse.kind` contract enum (`api/openapi.yml` → `api.gen.ts`), and the FE
  `FeedMessageKind` union. There is no `@Pattern`-regex mirror to keep in step for a message kind
  the way a `FlagKey` needs two (§9 above, companion.md) — nothing else re-derives or validates a
  `companion_message.kind` string independently.

  See §4's data-model subsection and §3 above for the full delivery mechanics ("Setup checks sit
  OUTSIDE this whole read/event picture") and the ghosting-trap rationale.
- **(kk) `advice` is the ninth `companion_message` kind (S4, bd `mezo-d58h.4`, spec §4/§5) — the
  SINGLE daily coaching card, unifying `intervention` and `setup` behind one writer,
  `AdviceCardService`, and one severity table, `AdvicePriority`.** See "One card per day" in §3
  above for the gate/supersede mechanics and §4 above for the envelope shape; recorded here are the
  traps this slice exists because of:
  - **The coaching card's kind changed from `intervention`/`setup` to `advice`, and TWO consumers
    filter on the kind string directly — `AnchorResolver.interventionAnchors` (the push anchor) and
    `FeedMessageKindService.interventionKeysByIds` (the W4.2 effectiveness rollup).** Both went
    SILENTLY dead the moment S4's writers stopped writing `intervention`/`setup` rows — no
    exception, no failing test, just a push that never fires and a rollup that never accumulates —
    because both read `companion_message.kind` by string equality rather than through any shared
    enum. Both were updated in THIS slice to read `Stream.of(KIND_ADVICE, KIND_INTERVENTION)` (or
    `KIND_ADVICE`/`KIND_SETUP` respectively) instead of the single old kind; any FUTURE kind change
    on this table must update both together, the same way this one had to.
  - **Adding a `companion_message` kind needs FIVE mirrored changes:** the entity's `KIND_*`
    constant, a NEW Liquibase changeset widening `ck_companion_message_kind` (changesets are
    immutable, so this is always a new changeset, never an edit), the `FeedMessageResponse.kind`
    contract enum, the FE `FeedMessageKind` union, and `FeedMessageKindSource`'s hand-duplicated
    `KIND_*` literal (kept as a literal on purpose — a companion→proactive import would be a new
    package cycle, §5.1 above). (jj) above counted four for `setup`; `FeedMessageKindSource` was the
    fifth even then — S4 is the slice that made the omission visible, since `advice` is the first
    kind whose `FeedMessageKindSource` mirror this doc explicitly tracked from day one.
  - **An IT that reaches `AdviceProseGenerator`'s LLM call needs `@ActiveProfiles("companion-fake")`**
    — without it, Spring wires the REAL chat model instead of `FakeCompanionLlm`, which either hits
    a live provider in a test run or fails to resolve depending on config. `AdviceProseGeneratorIT`
    and every IT that exercises `AdviceCardService.deliver` end-to-end carry the profile.
  - **`AdviceCardService.deliver`'s supersede path soft-deletes the incumbent `advice` row and
    leaves its „Segített?" votes dangling** — nothing re-points `message_feedback.artifact_id` at
    the new row, so a vote cast on a superseded card becomes an orphaned feedback row. This is the
    SAME dangling-artifact contract spec §8.1 already accepts for `FeedMessageKindSource` lookups
    (a single-user app has nobody to confuse), not a new risk this slice introduces — recorded here
    because supersession is the first place `companion_message` rows are soft-deleted WHILE having
    live feedback attached to them.
- **(ll) S5 (bd `mezo-d58h.5`) gives the advice card a mutation set — buttons that DO something,
  not just prose.** `AdviceActionCatalog.forCard(userId, adviceKey)` decides what a card offers, at
  GENERATION time, per `adviceKey`; round 1 offers exactly one action, `shift_sleep_anchor` on a
  `sleep_debt` card, `params={"minutes": -30}`, and ONLY when a `sleep_goal` row actually exists —
  read via `SleepGoalRepository` directly, never through `SleepGoalService`/`SleepAnchorResolver`
  (both of those ghost a config default when no row exists, the same ghosting trap §3 already
  documents for `SetupCheckService`'s missing-sleep-goal check). **S6 (bd `mezo-d58h.6`) adds the
  epic's other two offers**, both on cards the round-2 detection rules ([companion.md](companion.md)
  §3) raise: `joint_overuse` offers `lighten_tomorrow` (`params={"delta": -1}`, no precondition —
  `LightenTomorrowAdapter`'s own existence-check-then-insert against `workout_day_adjustment` is its
  idempotence, so the catalog need not gate on anything); `ignored_nudge` OFFERS THE SAME
  `shift_sleep_anchor` action `sleep_debt` already does, same `params`/label, with the identical
  `sleep_goal`-row gate RE-CHECKED in the catalog rather than trusted from the rule three files
  away — even though `ignored_nudge`'s own rule gate already guarantees a row exists by the time it
  can ever raise, the catalog holds its own precondition locally on purpose. Actions are capped at
  two per card (`AdviceActionCatalogTest`; the `MAX_ACTIONS_PER_CARD` constant on the catalog is
  documentation, not an enforced runtime cap). **Actions are ALWAYS rule-provided, never
  model-provided** — the catalog runs independently of `AdviceProseGenerator`'s LLM call, so a
  hallucinated action can never reach the wire.
  - **`POST /api/proactive/advice/{id}/apply`** (`AdviceApplyService.apply`, REST row above) takes
    the per-user advisory lock FIRST — same lock, same ordering `AdviceCardService.deliver` already
    uses — then resolves the card via the SAME `findByIdAndCreatedBy` finder the read path uses, so
    unknown/foreign/superseded all collapse to one 404 with no separate supersede branch to keep in
    sync. Dispatch is a `Map<String, AdviceMutationPort>` built from `List<AdviceMutationPort>` at
    construction; **a second bean registered for the same `actionKey()` fails Spring context
    startup**, not a runtime 500 — `AdviceApplyServiceIT`'s enumeration guard additionally asserts
    every `AdviceActionKey` resolves to EXACTLY one port, so a new action key with no adapter yet is
    a test failure, not a silent gap.
  - **Idempotence is inconsistent BY DESIGN across the three ports, and that inconsistency is
    intentional, not an oversight worth normalizing:** `shift_sleep_anchor` and `skip_sport_slot`
    inherit idempotence from their OWN target's existence check (`SleepGoalService.shiftAnchor`
    reads the one goal row it already owns; `SportSlotSkipService.skip` does an
    existence-check-then-insert against the slot-identity unique index); `lighten_tomorrow` has no
    natural existing-row check to lean on, so `LightenTomorrowAdapter` implements its own
    existence-check-then-insert against `workout_day_adjustment`'s `(created_by, date)` unique index.
    `AdviceApplyService` itself ALSO enforces idempotence one layer up, at the envelope: re-applying
    the SAME `actionKey` after `applied` is already set never reaches a port at all — the two layers
    overlap on purpose (the envelope check is the fast, uniform path; the port-level checks are the
    ones that hold under a genuine race, since two concurrent applies for the same never-yet-applied
    card can both pass the envelope check before either commits).
  - **The three mutations never write a template or a schedule.** `shift_sleep_anchor` moves
    `sleep_goal.anchor_time`, refusing (409) rather than inventing a goal, because a card action must
    change something the user already committed to, never create a new commitment from a button tap
    (`SleepGoalService.setGoal` upserts and was deliberately NOT reused here). `skip_sport_slot`
    writes a `sport_slot_skip` row keyed on the slot's IDENTITY (`day_of_week`, `time`, `date`) rather
    than `sport_schedule_slot.id`, because a schedule save fully replaces its slot rows and their ids
    churn — an id-keyed skip would silently detach from the slot it was meant to skip the next time
    the schedule was edited. `lighten_tomorrow` writes a `workout_day_adjustment` row applied at READ
    time rather than touching the workout template, because gym exercises hang off the weekday
    template row with no per-instance override, and the only existing template-write path re-creates
    exercise rows with new UUIDs — writing the template would both lighten every future occurrence of
    that weekday AND orphan already-logged sets. Full read-path and overlay detail for the latter two
    lives in [`train.md`](train.md) (Sport / volleyball section for the skip; Workout execution for
    the lighten overlay) since both belong to train's data model, not proactive's — the mutation
    adapters are the only proactive-owned code that reaches into them, via the `AdviceMutationPort`
    seam (same port-inversion shape as the companion tool ports, §5.12/§5.13).
  - **`params` crosses jsonb, so a numeric param can arrive as `Integer`, `Long`, `Double` or
    `BigDecimal`** depending on how it was serialized — every adapter that reads a numeric param
    coerces via `instanceof Number` rather than assuming a fixed boxed type, or a legitimate `-30`
    written as one numeric subtype fails to parse when it round-trips as another.
- **Epic complete, H2 Web Push shipped with it, and `mezo-gst9` then redesigned the B/H stages.**
  All eight original slices shipped (B1.1→B1.2→W1→W2→H1→P1→P2), **H2 (`mezo-h4wp.6`) shipped** — N1
  (delivery spine) + N2 (dispatcher + `notification_pref`/`push_log` + categories 1-9) + N3
  (`notification_schedule` + preview header + categories 10-11) all shipped 2026-07-29, a real push
  reached Daniel's iPhone from the k3s backend that same day (confirmed) — and **`mezo-gst9`
  (2026-08-15) then folded B1.1/B1.2/H1 into the companion feed** (14 categories now, three added:
  `evening`/`sleep_reaction`/`weight_reaction`). Full detail:
  [`_platform-notifications.md`](_platform-notifications.md). `PHASE3_TAB_IDS` is now empty. The
  D′ score constants (`SLEEP_TARGET_H`/`KCAL_BAND`/`WEIGHT_RATE_EPSILON`) were **not** promoted to
  backend config (still FE consts — a small follow-up bd issue, see [insights.md §9](insights.md)).

- **(mm) The three self-dating gathers render the snapshot for the OWNER-local day, not the JVM
  default's (`mezo-ned9`, the `mezo-8h2s` follow-up).** `ChallengeGenerator.gather`,
  `ExperimentProposalGenerator.gather` and `WeeklySuggestionGenerator.gather` are the only proactive
  callers that mint their own "today" for `ContextSnapshotAssembler.render(userId, today)`; all
  three passed a zero-arg `LocalDate.now()`, which is the JVM default zone — **UTC on CI and in the
  k3s containers**, while every other medication read derives its day in
  `MedicationCycleService.MEDICATION_ZONE` (`Europe/Budapest`). Between the two midnights the
  `[Gyógyszer]` block in the LLM payload therefore showed a cycle day one off the one the Fuel
  screen shows — the model contradicting the UI on the user's own medication. All three now pass
  `LocalDate.now(MedicationCycleService.MEDICATION_ZONE)`.
  **Deliberately the WHOLE snapshot, not just the medication block:** `render(userId, today)` uses
  that one date for every block (fuel intake day, training day, recovery, check-in freshness…), so
  the fix shifts the whole snapshot's day for these three generators. That is the correct scope —
  these payloads describe *the owner's day*, and an owner-local medication day inside a UTC-dated
  snapshot would be a worse, internally inconsistent state than either uniform choice. `medication`
  is imported from `proactive` on the existing precedent (`WeeklyReviewContextSources` already does;
  `medication` imports no other feature, so `feature_slices_are_cycle_free` stays satisfied).
  **Not unified:** `PredictionGenerator:158` passes a `weekStart` (a deliberate week anchor, not a
  "today") and is untouched; `CompanionMessageGenerator` and `ChatService` receive their date from
  callers further up (the crons/jobs and the chat turn), which still derive it in the default zone —
  a wider "one owner zone for every job-minted today" sweep is out of this slice's scope.

## 10. Key files

**API contract**
- `api/feature/proactive/proactive.yml` — 9 endpoints (**feed** (replaces briefing + heartbeat) +
  weekly-suggestion + memoir + prediction + experiment list/propose/decide + **challenge
  list/decide**) + schemas (`FeedMessageResponse`/`FeedRef` replace `BriefingResponse`/`BriefingRef`
  and `HeartbeatNoteResponse`; …+ `ExperimentResponse`, `ExperimentDecisionRequest`,
  `ChallengeResponse`, `ChallengeRef`, `ChallengeDecisionRequest`) (tag `Proactive` →
  `ProactiveApi`); registered in `api/generate/merge.yml` → merged `api/openapi.yml` →
  `api.gen.ts` + `io.mrkuhne.mezo.api.*`. **`mezo-b3pp.15` (contract-only):** `FeedMessageResponse`,
  `WeeklySuggestionResponse` and `MemoirResponse` each gained a **required `id`** — the W4.1 feedback
  artifactId (§4/§9 (a2)); no mapper, service or query changed.

**Backend — controller / services / mapper**
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/controller/ProactiveController.java` — `implements ProactiveApi` (`getFeed` replaces `getBriefing`+`getHeartbeat`; …+ `getPredictions` + `getExperiments`/`proposeExperiments`/`decideExperiment` + **`getChallenges`/`decideChallenge`**), JWT ownership, dual-switch-gated.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ProactiveFeedService.java` — `mezo-gst9` the unified feed read path (persisted rows in `generatedAt` order · `ensureTodayCronKinds` lazy miss-recovery for morning/midday/evening only · `200 []` = honest, never 404); replaces `ProactiveBriefingService` + `ProactiveHeartbeatService` (both DELETED).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/CompanionMessageGenerator.java` — `mezo-gst9` the spine: `generateMorning`/`generateSleepReaction`/`generateWeightReaction`/`generateWindow`, each pure-code `gather` + one `CompanionLlm.complete` + parse + ref resolution; `MORNING_MARKER`/`SLEEP_MARKER`/`WEIGHT_MARKER`/`WINDOW_MARKER` + their `*_PROMPT`s + `MORNING_CANDIDATES`/`SLEEP_CANDIDATES`/`WEIGHT_CANDIDATES` + `earlierMessagesBlock`; replaces `BriefingGenerator` + `HeartbeatGenerator` (both DELETED). **Emberek S6** (`mezo-06o0.8`) added `generatePeopleObservation` + `PEOPLE_MARKER`/`PEOPLE_PROMPT` alongside them (§5.13).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/CompanionMessageJob.java` — `mezo-gst9` `runMorning` (05:45, morning message only — the sleep reaction is event-kind, mezo-qn3z) + `runMidday`/`runEvening` (12:30/20:30), one THIRD switch (`FEED_JOB_SWITCH`) for all three; replaces `BriefingJob` + `HeartbeatJob` (both DELETED). **Emberek S6** (`mezo-06o0.8`) added a `generatePeopleObservation` call into `runMorning`, its own try/catch (§5.13).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/PeopleMezoNoteAdapter.java` — **Emberek S6** (`mezo-06o0.8`) implements `feature/people`'s `PeopleMezoNoteSource` port (§5.13): joins today's `people` message body into one line for `PeopleResponse.mezoNote`, `Optional.empty()` when blank/absent; `@ConditionalOnProperty` on COMPANION ∧ PROACTIVE.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/CompanionMessageEventListener.java` — `mezo-gst9` NEW: `@Async` `@TransactionalEventListener(AFTER_COMMIT)` on `SleepLogSavedEvent`/`WeightLogSavedEvent`, each gated on log freshness before calling the matching `generate*Reaction`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ProactiveWeeklySuggestionService.java` — **W1** the weekly read path (ISO-Monday week · persisted row or lazy-generate; null ⇒ 404).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ProactiveMemoirService.java` — **W2** the memoir read path (latest row · else lazy-generate the LAST COMPLETED week; null ⇒ 404).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ProactivePredictionService.java` — **P1** the prediction list read path (all live rows · lazy current-week; `[]` = honest, never 404).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ProactiveExperimentService.java` — **P2** the experiment read + WRITE path (list · lazy propose · `decide` with the 404/409 guards · `propose`).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/WeeklySuggestionJob.java` — **W1** Monday-06:00 `@Scheduled` cron (current-week only, per-user isolation, three-switch-gated).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/MemoirJob.java` — **W2** Sunday-19:00 `@Scheduled` cron (the week ending that Sunday, per-user isolation, three-switch-gated).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/PredictionJob.java` — **P1** two `@Scheduled` crons (Mon-06:30 `runWeekly` generate + daily-06:15 `runValidation`, per-user isolation, three-switch-gated).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/PredictionValidationService.java` — **P1** deterministic window-close validation, now delegating to `MetricWindowEvaluator`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/MetricWindowEvaluator.java` — **P1+P2 SHARED** pure-code metric window-vs-baseline verdict (weight/sleep/training, epsilon-banded, code-formatted; no-data ⇒ null).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ExperimentJob.java` — **P2** two `@Scheduled` crons (Mon-06:45 `runPropose` + daily-06:20 `runOutcome`, per-user isolation, three-switch-gated).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ExperimentOutcomeService.java` — **P2** deterministic outcome eval (active window-closed → completed via `MetricWindowEvaluator`; null = inconclusive).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ProactiveChallengeService.java` — **HBWI** the challenge read + WRITE path (`getChallenges` = list · lazy generate (`date==today`) · lazy resolve accepted; `decide` with the 404/409 guards; dismissed excluded).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ChallengeGenerator.java` — **HBWI** lazy-on-prep smart-tier generator: pure-code `gather` (template exercises + per-exercise history, grounding-gate drop) + one `CompanionLlm.completeSmart` + strict-JSON parse + type-required-target validation + pattern-copied/null confidence + model-selected refs + `max-per-workout` cap; `CHALLENGE_MARKER = "EDZES-KIHIVAS-FELADAT"` + `PROMPT`. **S2 (`mezo-tk88.2`)** `resolveSourcePatternId` also persists the grounding pattern id on `sourcePatternId`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ChallengeOutcomeEvaluator.java` — **HBWI** NEW set-level LLM-free evaluator (`evaluate` one accepted challenge / `evaluateDue` all accepted whose day passed): reads `exercise_set` rows FK'd to the template exercise → PR/Depth/Volume/overload hit/miss (`overload` = the null-weight-tolerant PR mirror); no logged sets ⇒ inconclusive (`outcome_good null`).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ChallengeJob.java` — **HBWI** single `@Scheduled` outcome-backstop cron (daily 06:25 `runOutcome` → `evaluateDue`, per-user isolation, three-switch-gated `CHALLENGE_JOB_SWITCH`); NO propose cron.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/WeeklySuggestionGenerator.java` — **W1** pure-code `gather` (snapshot + facts + prior-week summaries + patterns) + one `CompanionLlm.completeSmart` + plain-prose output; `WEEKLY_SUGGESTION_MARKER` + `PROMPT`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/MemoirGenerator.java` — **W2** pure-code `gather` (the week's OWN summaries + facts + patterns + numbered anchor candidates) + one `CompanionLlm.completeSmart` + strict-JSON `{title, body, anchorIndexes}` parse + `resolveAnchors` (bounds-checked, deduped, model-selected); `MEMOIR_MARKER` + `PROMPT` + the `MemoirGather` record.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/PredictionGenerator.java` — **P1** pure-code `gather` (snapshot + facts + numbered CONFIRMED-pattern candidates + metric catalog) + one `CompanionLlm.completeSmart` + strict-JSON `{predictions:[…]}` parse + code-set windows + `resolveConfidence` (pattern-copied, null-safe) + catalog/enum validation + `max-per-week` cap; `PREDICTION_MARKER` + `PROMPT` + `VALID_METRICS`/`VALID_DIRECTIONS`. **S2 (`mezo-tk88.2`)** `resolveSourcePatternId` also persists the grounding pattern id on `sourcePatternId`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ExperimentProposalGenerator.java` — **P2** pure-code `gather` (snapshot + facts + CONFIRMED-pattern candidates + catalog) + one `completeSmart` + strict-JSON `{experiments:[…]}` parse + `clampDays` + catalog/enum validation + open-cap gate; `EXPERIMENT_MARKER` + `PROMPT`. **S2 (`mezo-tk88.2`)** `resolveSourcePatternId` persists the grounding pattern id on `sourcePatternId` (the only pattern-derived field this generator stores).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/mapper/ProactiveMapper.java` — entity → generated `api.dto` (`toFeedResponse` replaces `toBriefingResponse`+`toHeartbeatResponse`; …+ `toPredictionResponse` + `toExperimentResponse` + **`toChallengeResponse`** (`exerciseName`→`exercise`, `refs.refs()`→`List<ChallengeRef>`, derived `typeLabel`/`target` via `@Mapping(expression=…)`); Instant → UTC OffsetDateTime, BigDecimal → Double default methods).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/mapper/ChallengeDisplay.java` — **HBWI** the static `typeLabel`/`target` derivation helpers, deliberately OUTSIDE the `@Mapper` interface (§9 gotcha hh — a String→String default method there would be auto-selected as an implicit converter for every String property).

**Backend — entity / repo / config**
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/{CompanionMessageEntity,CompanionMessageEnvelope}.java` — `mezo-gst9` the owned entity (`messageDate`/`kind`/`generatedAt` + `content` typed jsonb) + envelope (`Ref` nested); replaces `{BriefingEntity,BriefingContentEnvelope}` + `HeartbeatNoteEntity` (all DELETED).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/WeeklySuggestionEntity.java` — **W1** the owned entity (flat `weekStart`/`prose`/`generatedAt`, no jsonb).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/{MemoirEntity,MemoirAnchorsEnvelope}.java` — **W2** the owned entity (`weekStart`/`title`/`body`/`generatedAt` + `anchors` typed jsonb) + the `MemoirAnchorsEnvelope{List<Anchor(kind,label)>}` record.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/PredictionEntity.java` — **P1** the owned entity (flat `weekStart`/`title`/`basis`/`confidence?`/`metricKey`/`expectedDirection`/`validFrom`/`validTo`/`status`/`actual?`/`generatedAt`/**`sourcePatternId?`** (S2, `mezo-tk88.2`, loose ref, `ON DELETE SET NULL`)) + the status/direction/metric constants (metric+direction SHARED).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/ExperimentEntity.java` — **P2** the owned entity (flat `title`/`hypothesis`/`status`(@Pattern)/`metricKey`/`expectedDirection`(@Pattern)/`startDate?`/`totalDays`/`outcome?`/`outcomeGood?`/`generatedAt`/**`sourcePatternId?`** (S2, `mezo-tk88.2`)) + the lifecycle constants.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/{ChallengeEntity,ChallengeRefsEnvelope}.java` — **HBWI** the owned entity (`templateSessionId`/`workoutDate`/`exerciseId`/`exerciseName`/`type`/`status`/`risk`/`title`/`why`/`glory`/structured targets/`confidence?`/`outcome?`/`outcomeGood?`/`generatedAt`/**`sourcePatternId?`** (S2, `mezo-tk88.2`) + `refs` typed jsonb) + the `ChallengeRefsEnvelope{List<Ref(kind,label)>}` record; carries the `TYPE_*`/`STATUS_*`/`RISK_*` constants.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/repository/CompanionMessageRepository.java` — `mezo-gst9` `findByCreatedByAndMessageDateAndKind` + `findByCreatedByAndMessageDateOrderByGeneratedAtAsc` (owner + soft-delete scoped); replaces `BriefingRepository` + `HeartbeatNoteRepository` (both DELETED).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/repository/WeeklySuggestionRepository.java` — **W1** `findByCreatedByAndWeekStart` (owner + soft-delete scoped).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/repository/MemoirRepository.java` — **W2** `findByCreatedByAndWeekStart` + `findFirstByCreatedByOrderByWeekStartDesc` (owner + soft-delete scoped).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/repository/PredictionRepository.java` — **P1** `existsByCreatedByAndWeekStart` + `findByCreatedByOrderByValidFromDescGeneratedAtDesc` + `findByCreatedByAndStatusAndValidToBefore` + **`findByCreatedByAndSourcePatternIdAndDeletedFalse`** (S2, `mezo-tk88.2` — the pattern-detail impact list, a later slice consumes it) (owner + soft-delete scoped).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/repository/ExperimentRepository.java` — **P2** `findByIdAndCreatedByAndDeletedFalse` + `findByCreatedByAndStatusInOrderByGeneratedAtDesc` + `findByCreatedByAndStatusOrderByGeneratedAtDesc` + `countByCreatedByAndStatusIn` + **`findByCreatedByAndSourcePatternIdAndDeletedFalse`** (S2, `mezo-tk88.2`) (owner + soft-delete scoped).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/repository/ChallengeRepository.java` — **HBWI** `findByCreatedByAndTemplateSessionIdAndWorkoutDate…` (the session/day list) + `findByIdAndCreatedBy…` (decide) + the accepted-due finder for `evaluateDue` + **`findByCreatedByAndSourcePatternIdAndDeletedFalse`** (S2, `mezo-tk88.2`) (owner + soft-delete scoped).
- `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/weight/repository/WeightLogRepository.java` — **P1** added `findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc` (the validation window read; sleep already had the sibling).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/config/ProactiveProperties.java` — `mezo.proactive.{weekly.cron, memoir.cron, prediction.*, experiment.{propose-cron,outcome-cron,max-open,min-days,max-days}, challenge.{outcome-cron,max-per-workout}, feed.{morning-cron,midday-cron,evening-cron,past-days}}` (@Validated, nested records; the old `briefing`/`heartbeat` nested records are GONE).
- `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/service/SleepLogSavedEvent.java` + `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/weight/service/WeightLogSavedEvent.java` — `mezo-gst9` NEW: the `{userId, date}` events `SleepLogService.log`/`WeightLogService.log` publish (see [me.md §5.3](me.md)).
- `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` — `PROACTIVE_SWITCH` + the SIX job switches (`FEED`/`WEEKLY_SUGGESTION`/`MEMOIR`/`PREDICTION`/`EXPERIMENT`/**`CHALLENGE`**`_JOB_SWITCH` — `FEED_JOB_SWITCH = mezo.techcore.cron.feed-job.enabled` replaces the old `BRIEFING`+`HEARTBEAT` pair) (+ the companion `COMPANION_SWITCH` they pair with).
- `backend/src/main/resources/application.yml` — `mezo.feature.proactive.enabled` + `mezo.proactive.{feed.{morning-cron: "0 45 5 * * *", midday-cron: "0 30 12 * * *", evening-cron: "0 30 20 * * *", past-days: 7}, …, experiment.*, challenge.{outcome-cron: "0 25 6 * * *", max-per-workout: 3}}` + `mezo.techcore.cron.{feed-job,…,experiment-job,challenge-job}.enabled`.
- `backend/src/main/resources/messages.properties` — **P2** `PROACTIVE_EXPERIMENT_NOT_FOUND` (404) + `PROACTIVE_EXPERIMENT_NOT_PROPOSED` (409); **HBWI** `PROACTIVE_CHALLENGE_NOT_FOUND` (404) + `PROACTIVE_CHALLENGE_NOT_PROPOSED` (409).

**Backend — LLM fake (companion side, additive)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java` — the mirrors + sentinels (`mezo-gst9`: morning/sleep/weight replace the single old briefing mirror; weekly/memoir/heartbeat(window)/prediction/experiment + `CHALLENGE_MARKER_MIRROR = "EDZES-KIHIVAS-FELADAT"` + `[fake-challenge:{…}]` GREEDY/DOTALL + **S4's `ADVICE_MARKER_MIRROR = "TANACS-KARTYA-FELADAT"`**, asserted equal to `AdviceProseGenerator.ADVICE_MARKER` by `AdviceProseGeneratorIT`) (literals; §9 gotcha a) — the challenge default returns a valid proposals payload planted via a check-in note. **No `intervention`/`setup` marker/mirror** (W5.2/S3) — neither kind ever called `CompanionLlm`, so there was nothing for the fake to dispatch; `advice` (S4) is the first config-text-descended kind that DOES call it, for wording only.

**Backend — intervention delivery (W5.2, `mezo-b3pp.19` — §3/§4/§9, spec §9.2; the trigger side, `FlagService`/`FlagRaisedEvent`, is companion's own — see [companion.md](companion.md) §10)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/InterventionEventListener.java` — `@Async @TransactionalEventListener(AFTER_COMMIT)` on `FlagRaisedEvent`; never propagates. Final-review fix (mezo-b3pp.19): catches `DataIntegrityViolationException` BEFORE the generic `Exception` and logs it at info, no stack trace — two concurrent same-day raises legitimately race the check-then-insert on the one-card-per-day partial unique index (that race now lives inside `AdviceCardService.deliver`, S4, not `InterventionService.deliverForFlag`; the class javadoc still names the pre-S4 location), and the loser hitting that index is expected, not a bug; the generic `Exception` catch (warn + stack trace) still covers real failures.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/InterventionService.java` — `deliverForFlag(userId, flagKey)`: the library filter + per-key cooldown off recent card envelope keys (reading BOTH `advice`/`intervention` kinds, S4) + `OPTIMISTIC_PRIOR = 1.5` + max-effectiveness pick, then hands the picked entry + `AdviceFactRenderer.render(…)` facts to `AdviceCardService.deliver` (S4) — the one-card-per-day gate and the severity comparison moved OUT of this class in S4 (§9 decision kk). No `CompanionLlm` call anywhere in the class (§9 decision ii).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/{CompanionMessageEntity,CompanionMessageEnvelope}.java` — `KIND_INTERVENTION` + `interventionKey` (both above, W5.2 additions to the `mezo-gst9` entity/envelope).
- `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` — `INTERVENTION_SWITCH` (`mezo.feature.intervention.enabled`).
- `backend/src/main/resources/db/changelog/1.0.0/script/202608241500_mezo-b3pp.19_companion_message_intervention_kind.sql` — the `kind` CHECK widening (CK-swap only).
- Tests: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/{InterventionServiceIT,InterventionConfigIT,InterventionSwitchOffIT,CompanionMessageInterventionPersistenceIT}.java` — §8.
- The intervention library/config (`mezo.companion.interventions`, `CompanionProperties.Intervention`) and the raise-side `FlagRaisedEvent`/`FlagService` are companion's own — [companion.md](companion.md) §4/§10. The push anchor (`AnchorResolver.interventionAnchors`, reading BOTH `advice`/`intervention` kinds since S4 — §9 decision kk), the `INTERVENTION` category, and quiet hours (`mezo.notification.quiet-hours`) are notification's own — [`_platform-notifications.md`](_platform-notifications.md) §10.

**Backend — setup checks (S3, `mezo-d58h.3` — §3/§4/§9; cron-only, no trigger side to cross-reference)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/config/SetupCheckProperties.java` — the standalone `mezo.proactive.setup-checks.*` record (§4 above): `cron`, `reEmitHours`, nested `planFeasibility`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/SetupCheckService.java` — `runFor(userId)`: checks first-wins (`CHECK_MISSING_SLEEP_GOAL` reading `SleepGoalRepository` directly — the ghosting trap, §3 — then `CHECK_PLAN_FEASIBILITY`), `emit`'s weekly re-emit cooldown keyed on the envelope's `setupKey` (reading BOTH `advice`/`setup` kinds, S4), then hands the winning check to `AdviceCardService.deliver` (S4) — the day gate and severity comparison live there now, not here (§9 decision kk).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/PlanFeasibilityCalculator.java` — `evaluate(userId, today)`: the sport half is DAY-PAIRED (each `sport_schedule_slot` on weekday `D` is measured against `earliestMorningObligation((D + 1) mod 7)`, the morning that actually follows it, not the week's earliest — S3 whole-branch-review correction, owner decision, same bd id; see the class javadoc for the full rationale) and picks the largest-misfit slot, carrying its weekday as `Verdict.bindingDay`; the bedtime half stays deliberately day-agnostic, compared against the week's tightest morning (`bindingDay` null there) since a habitual bedtime happens every night; the three silences (§9 decision jj), now including "every sport slot's following day has no morning obligation"; the midnight-shift arithmetic (`shiftedMinutes`/`toLocalTime`).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/SetupCheckJob.java` — the daily `@Scheduled(cron = "${mezo.proactive.setup-checks.cron}")` bean, per-user try/catch, gated on `COMPANION_SWITCH` ∧ `PROACTIVE_SWITCH` ∧ `SETUP_CHECK_JOB_SWITCH`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/{CompanionMessageEntity,CompanionMessageEnvelope}.java` — `KIND_SETUP` + `setupKey` (both above, S3 additions to the `mezo-gst9` entity/envelope; the envelope's canonical constructor is now the 5-arg form, §4 above).
- `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` — `SETUP_CHECK_JOB_SWITCH` (`mezo.techcore.cron.setup-check-job.enabled`).
- `backend/src/main/resources/db/changelog/1.0.0/script/202609040900_mezo-d58h.3_companion_message_setup_kind.sql` — the `kind` CHECK widening to eight values (CK-swap only).
- Tests: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/{SetupCheckServiceIT,PlanFeasibilityIT,SetupCheckPropertiesIT,SetupCheckJobSwitchOffIT}.java` — §8.
- The `setup` kind (pre-S4 rows only) reaches the wire through the SAME `FeedMessageResponse.kind`/`FeedMessageKind` mirrors every other kind uses (§4 above; `api/openapi.yml` → `api.gen.ts`, and the FE `frontend/src/data/types.ts` union).

**Backend — advice card (S4, `mezo-d58h.4` — §3/§4/§9 decision kk; the ONE writer of the coaching card)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdviceCardService.java` — `deliver(userId, candidate)`: the day gate + `AdvicePriority.outranks` severity comparison + soft-delete-and-reinsert supersession, then `AdviceProseGenerator.write` + `saveAndFlush`. NOT conditioned on `INTERVENTION_SWITCH` (`SetupCheckService` is one of its two callers and runs without that switch).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdvicePriority.java` — `ORDER` (the spec §4 severity order as a pure static `List<String>`, editorial ranking IN CODE, not config) + `rankOf`/`outranks` (strict `<`, unmapped key ranks last + logs a warning).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdviceCandidate.java` — the candidate record `InterventionService`/`SetupCheckService` build (`adviceKey`, `interventionKey?`, `setupKey?`, `eyebrow`, `facts`, `suggestions`, `fallbackProse`) + its `fromFlag`/`fromSetupCheck` factories.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdviceFactRenderer.java` — `render(flagKey, payload)`: deterministic numeric fact lines per `FlagKey`, off the raise's own frozen `FlagPayloadEnvelope` (never re-derives a rule); unmapped key or null payload ⇒ `[]`, never a placeholder.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdviceProseGenerator.java` — `write(userId, candidate)`: renders `facts`+`suggestions` into a grounding block, ONE cheap-tier `CompanionLlm.complete` call (`ADVICE_MARKER = "TANACS-KARTYA-FELADAT"`, the numbers-forbidden HU prompt), `ProseNumberGuard.grounded` check; exception/blank/ungrounded ⇒ `candidate.fallbackProse()` (§5.2 above).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ProseNumberGuard.java` — `grounded(prose, grounding)`: every numeral TOKEN in `prose` must be a token of `grounding` (decimal comma/dot normalised); pure, static, no I/O.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/{CompanionMessageEntity,CompanionMessageEnvelope}.java` — `KIND_ADVICE` + `adviceKey`/`facts`/`suggestions` (S4 additions to the `mezo-gst9` entity/envelope; the envelope's canonical constructor is now the 8-arg form, §4 above) + `CompanionMessageEnvelope.advice(…)` factory.
- `backend/src/main/resources/db/changelog/1.0.0/script/202609041000_mezo-d58h.4_companion_message_advice_kind.sql` — the `kind` CHECK widening to nine values (CK-swap only).
- `backend/src/main/java/io/mrkuhne/mezo/feature/notification/service/AnchorResolver.java` — `interventionAnchors` reads `Stream.of(KIND_ADVICE, KIND_INTERVENTION)` (S4; §9 decision kk trap #1).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/FeedMessageKindService.java` + `backend/src/main/java/io/mrkuhne/mezo/feature/companion/feedback/service/FeedMessageKindSource.java` — `interventionKeysByIds` filters on `KIND_INTERVENTION` OR `KIND_ADVICE` (S4; §9 decision kk trap #1); the port's `KIND_ADVICE` literal is the fifth mirror a new kind needs (§9 decision kk trap #2).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/CompanionMessageGenerator.java` — `missedWorkoutsBlock(userId, date)` (S4, package-private): the morning prompt's `missed_workouts` fact block, off the raise's own frozen payload inside the `feed.past-days` window (§3 above).
- `backend/src/main/resources/application.yml` — `mezo.companion.interventions[]` gained `logging_gap_restart`/`logging_gap_sleep_suspicion`/`missed_workouts_restart` entries (S4) — before this slice those two flag keys raised and delivered nothing.
- Tests: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/{AdvicePriorityTest,AdviceFactRendererTest,ProseNumberGuardTest,AdviceCardServiceIT,AdviceProseGeneratorIT,CompanionMessageAdvicePersistenceIT,CompanionMessageMissedWorkoutsIT}.java` + `AnchorResolverInterventionIT`/`FeedbackLearningServiceIT` (regression guards on the two trap-fixed consumers) — §8.

**Backend — advice card actions (S5, `mezo-d58h.5` — §4/§9 decision ll; the mutation set behind the card's buttons)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdviceActionCatalog.java` — `forCard(userId, adviceKey)`: decides what a generated card offers, per key; `SHIFT_SLEEP_ANCHOR` on `sleep_debt` (round 1) AND `ignored_nudge` (S6), both gated on `SleepGoalRepository.findByCreatedByAndDeletedFalse` being non-empty (repository-direct read, the ghosting trap); `LIGHTEN_TOMORROW` on `joint_overuse` (S6), no precondition; every offer additionally checked against the actually-registered `AdviceMutationPort` set so a switched-off port never gets offered with nothing to apply it; `MAX_ACTIONS_PER_CARD = 2` (documentation constant, enforced by test not runtime).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/AdviceActionKey.java` — the 3-value string-constant catalog (`LIGHTEN_TOMORROW`/`SKIP_SPORT_SLOT`/`SHIFT_SLEEP_ANCHOR`) + `ALL`, the enumeration `AdviceApplyServiceIT`'s port guard iterates.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdviceMutationPort.java` — the port interface (`actionKey()`, `apply(userId, params)`) every mutation adapter implements; keeps `feature.proactive` from importing `feature.train`/`feature.biometrics` directly for anything but this one seam.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdviceApplyService.java` — `apply(userId, id, actionKey)`: advisory-lock-first (§9 decision ll), `findByIdAndCreatedBy` (unknown/foreign/superseded ⇒ one 404), not-advice-kind ⇒ 409, action-not-offered ⇒ 409, already-applied-different-action ⇒ 409, already-applied-same-action ⇒ idempotent no-op returning the original `applied.at`, else dispatches to the matching `AdviceMutationPort` and stamps `applied`. Groups its injected `List<AdviceMutationPort>` by key at construction; a duplicate registration for one key throws at Spring context startup, not at request time.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/SleepAnchorShiftAdapter.java` — `shift_sleep_anchor` port: bounds `params.minutes` (`instanceof Number`, `[-120, 120]`) then delegates to `SleepGoalService.shiftAnchor`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/SportSlotSkipAdapter.java` — `skip_sport_slot` port: validates `dayOfWeek`/`time`/`date` params then delegates to `SportSlotSkipService.skip` (train-owned, [train.md](train.md)).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/LightenTomorrowAdapter.java` — `lighten_tomorrow` port: no params (fixed `DEFAULT_DELTA = -1` for `tomorrow = today + 1`), existence-check-then-insert against `workout_day_adjustment`'s own unique index (its OWN idempotence, since it has no pre-existing row to lean on — §9 decision ll).
- `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/service/SleepGoalService.java` — `shiftAnchor(userId, minutes)` (S5 addition): refuses 409 `SLEEP_GOAL_NOT_SET` with no row (deliberately NOT `setGoal`'s upsert); `LocalTime.plusMinutes` wraps mod-24h natively.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/controller/ProactiveController.java` — `applyAdviceAction` (`POST .../advice/{id}/apply`, REST table above).
- `api/feature/proactive/proactive.yml` — the `POST /api/proactive/advice/{id}/apply` operation + `FeedAction`/`FeedApplied`/`AdviceApplyRequest` schemas + `FeedMessageResponse.actions`/`.applied` (both optional).
- Tests: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/{AdviceActionCatalogTest,AdviceApplyServiceIT,SleepAnchorShiftAdapterIT,SportSlotSkipAdapterIT,LightenTomorrowAdapterIT}.java` — §8; `AdviceApplyServiceIT` carries the port-enumeration guard.
- FE: `frontend/src/features/today/pages/NapMezoPage.tsx` (the action-buttons block: `m.actions?.length` gate, applied-state pill replacing the buttons once `m.applied` is set — server-driven, not local state — and an inline `role="alert"` error that leaves the card intact on a failed apply); `frontend/src/data/today/adviceHooks.ts` (`useAdviceActions`, the `ACTION_INVALIDATES` per-action-key map — `skip_sport_slot` invalidates the sport-slot-skips query, `lighten_tomorrow` invalidates today's workout query — plus always invalidating the companion feed itself; no-ops in mock mode).

**Frontend — Today consumer (`mezo-gst9`, replaces the B1.2 briefing seam + the H1 companion-note seam)**
- `frontend/src/data/today/feedApi.ts` — `feedApi.get(date)` + `toFeedMessages` (wire→`FeedMessage[]`); replaces `briefingApi.ts` + `heartbeatApi.ts` (both DELETED).
- `frontend/src/data/today/feedHooks.ts` — `useCompanionFeed()` (`['companionFeed', date]`; dual-mode: mock `[]` synchronous, real GET with 60s `refetchInterval`); re-exported by `data/hooks.ts`; replaces `briefingHooks.ts` + `heartbeatHooks.ts` (both DELETED).
- `frontend/src/features/today/logic/mezoMessages.ts` — `buildMezoMessages({feed, demoBriefing})`: maps each `FeedMessage` to a thread bubble, prepends the labelled demo card only while no `morning` kind exists. **W5.2:** `MezoMessageItem` gains an optional `kind: FeedMessageKind`, copied straight from `m.kind`, so `MezoMessagesSheet.tsx` can render the „Segített?" variant on `kind === 'intervention' || kind === 'advice'` (§5.4 above). **S4:** also copies `facts`/`suggestions` through onto `MezoMessageItem`.
- `frontend/src/features/today/components/MezoMessagesSheet.tsx` — the „Segített?" label branch, `kind === 'intervention' || kind === 'advice'` (S4 widened the W5.2 branch); every other kind keeps the generic feedback label. Same `useFeedback('feed_message')` chips either way — no new feedback machinery ([companion.md](companion.md) §5.7).
- `frontend/src/features/today/pages/NapMezoPage.tsx` — S4: renders `m.suggestions` as an action-less bullet list and `m.facts` as the „Miből gondolom" evidence list when either is present.
- `frontend/src/features/today/pages/TodayPage.tsx` — calls `useCompanionFeed()` directly and passes the result + `resolveBriefing(scenario.dayState)` into `buildMezoMessages`; renders `MezoChip`/`MezoMessagesSheet` (see [today.md](today.md)); the retired `BriefingCard.tsx`/`CompanionNoteCard.tsx` are DELETED.
- `frontend/src/data/types.ts` — `FeedMessage{kind, eyebrow, body, refs, generatedAt}` (NEW);
  `FeedMessageKind` gained `'intervention'` as its sixth value (W5.2, `mezo-b3pp.19`);
  `Briefing.confidence?` stays optional (used only by the demo-fallback path now); the
  `CompanionNote` interface is DELETED (no successor type — feed messages ARE `FeedMessage`, no
  separate note shape).

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
- **DELETED (`mezo-p2tr`):** `frontend/src/data/insights/weeklyHooks.ts`'s `useWeekly().weeklySuggestion` real-only `useQuery` and `frontend/src/features/insights/pages/WeeklyPage.tsx` (rendered the prose or the honest placeholder; „Elfogad/Hangoljuk" hidden when `mode !== 'mock'`, §9 decision k) — both retired with the Insights Weekly tab.
- `frontend/src/features/me/pages/WeekHubPage.tsx` (`useWeekNextSuggestion`) + `frontend/src/features/me/components/WeekNextCard.tsx` — the **current** consumer of this endpoint, post-`mezo-p2tr` ([me.md](me.md)).

**Frontend — Insights Memoir consumer (W2)**
- `frontend/src/data/insights/memoirApi.ts` — `memoirApi.latest()` + `toMemoir` (wire → FE `Memoir`; the `Hét N · …` week label derives client-side via `isoWeekNumber`/`deriveWeekTitle`).
- `frontend/src/data/insights/memoirHooks.ts` — `useMemoir(): MemoirView` (`['memoir']`; mock = seed + anniversaryNote no-fetch, real GET or null on 404, note null); re-exported by `data/hooks.ts`.
- `frontend/src/features/insights/pages/MemoirPage.tsx` — guard dropped; renders the real memoir card + anchors, else the honest „készül" null-state; reactions/anniversary/archive gated on `mode === 'mock'` (§9 decision o).
- `frontend/src/features/insights/pages/tabs.ts` — `PHASE3_TAB_IDS = {predictions, experiments}` (memoir un-ghosted at W2).

**Backend — migrations**
- `backend/src/main/resources/db/changelog/1.0.0/script/202608151200_mezo-gst9_create_companion_message.sql` (the new table) + `202608151230_mezo-gst9_drop_briefing_heartbeat_note.sql` (drops the two retired tables — a NEW changeset, the old `202607061100_mezo-h4wp.1_create_briefing.sql`/`202607070900_mezo-h4wp.2_briefing_regen_count.sql`/`202607071800_mezo-h4wp.5_create_heartbeat_note.sql` stay untouched, immutable) + `{…,202607071900_mezo-h4wp.7_create_prediction,202607072000_mezo-h4wp.8_create_experiment}.sql` (all in `1.0.0_master.yml`).

**Backend — tests**
- `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/{CompanionMessagePersistenceIT,CompanionMessageGeneratorIT,CompanionMessageJobIT,CompanionMessageJobSwitchOffIT,CompanionMessageEventIT,ProactiveApiFeedIT}.java` — `mezo-gst9`, replacing the DELETED `{Briefing,Heartbeat}{PersistenceIT,GeneratorIT,JobIT,JobSwitchOffIT},BriefingFreshnessIT,HeartbeatLazyIT`.
- `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/{…P1 classes…,ExperimentPersistenceIT,ExperimentProposalGeneratorIT,ExperimentOutcomeIT,ExperimentJobIT,ExperimentJobSwitchOffIT,ProactiveApiExperimentIT}.java`
- `backend/src/test/java/io/mrkuhne/mezo/support/populator/{CompanionMessagePopulator,WeeklySuggestionPopulator,MemoirPopulator,PredictionPopulator,ExperimentPopulator}.java` (`CompanionMessagePopulator` replaces the deleted `BriefingPopulator`+`HeartbeatNotePopulator`) + `support/ResetDatabase.java` (`companion_message` in the TRUNCATE list, `briefing`/`heartbeat_note` removed from it).
- FE: `frontend/src/data/today/feedHooks.test.tsx` + `frontend/src/features/today/logic/mezoMessages.test.ts` (replace `briefingHooks.test.tsx`/`heartbeatHooks.test.tsx`/`CompanionNoteCard.test.tsx`, all DELETED), `…P1 tests…`, `frontend/src/data/insights/experimentsHooks.test.tsx`, `frontend/src/features/insights/pages/{ExperimentsPage.test.tsx,insights.nav.test.tsx}` (`InsightsSubNav.test.tsx` deleted with the component, compact-header redesign `mezo-ugqb`), `frontend/src/test/msw/handlers.ts` (`/api/proactive/feed` → `200 []`, weekly-suggestion/memoir → 404, prediction/experiment `200 []` + experiment POST handlers).

**Weekly review — WR (`mezo-p2tr`)**
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/{WeeklyReviewEntity,WeeklyReviewDayNotesEnvelope,WeeklyReviewHighlightsEnvelope}.java` — the owned entity (`weekStart`/`summary`/`generatedAt` + two typed jsonb envelopes).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/WeeklyReviewGenerator.java` — pure-code `gather` (the week's `MeWeekService.renderDayLine`s + confirmed pattern events + new facts + life events + memoir + predictions + a numbered anchor-candidate list) + one `CompanionLlm.completeSmart` + strict-JSON `{summary, dayNotes, anchorIndexes, candidateFacts}` parse + bounds-checked/deduped highlight resolution; `WEEKLY_REVIEW_MARKER = "HETI-ELEMZES-FELADAT"` + `PROMPT`; hands `candidateFacts` to `WeeklyLessonService` (mezo-d20.7.6).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/WeeklyLessonService.java` (mezo-d20.7.6) — „A hét tanulságai": `propose` (bounds-check + normalised dedupe against confirmed facts and EVERY existing candidate + the reused `max-candidates-per-turn` cap, writing `learned_fact` rows with `source=weekly_review`/`week_start`/`evidence`, no notification), `list` (the week's candidates WITH their decisions) and `archiveOpen` (the regenerate policy: decided candidates survive, open ones are archived with the review).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/WeeklyReviewJob.java` — the backward-looking Monday-06:50 `@Scheduled` cron (`weekStart = previousOrSame(MONDAY).minusWeeks(1)`, three-switch-gated `WEEKLY_REVIEW_JOB_SWITCH`, no backfill).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/WeeklyReviewService.java` — the read/regenerate service (`find`/`getResponse` with the `stale` best-effort probe; `regenerate` soft-delete + re-generate + RE-PROBES `stale` against the fresh row, 409 while the week is in progress).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/WeeklyReviewDigestService.java` — the week-window-refs read (400 on a non-Monday `start` via the controller's shared `requireMonday`, otherwise always 200; `WeeklyReviewWeekWindow`-shared reads, mapped straight to DTOs; an event whose backing pattern is missing/deleted logs a warn and drops the orphan ref).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/WeeklyReviewWeekWindow.java` — the shared window-query helper (`since`/`until`/`patternEvents`/`facts`/`lifeEvents`) both the generator's gather and the digest service read through, so they can never disagree on the candidate set.
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/WeekReviewSourceAdapter.java` — implements companion's `WeekReviewSource` port (plain repository read + map, deliberately NOT `WeeklyReviewGenerator`, to keep `companion → proactive` out of the dependency graph entirely).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/repository/WeeklyReviewRepository.java` — `findByCreatedByAndWeekStart` (owner + soft-delete scoped).
- `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/controller/ProactiveController.java` — `getWeeklyReview`/`regenerateWeeklyReview`/`getWeeklyReviewDigest`/`getWeeklyReviewLessons` (`requireMonday` 400 guard shared across all four).
- **Companion-owned (the data layer + chat anchoring this stage narrates over/rides on) — see [me.md §4](me.md) and [companion.md](companion.md), not restated here:** `feature/companion/service/{DayScoreService,MeWeekService,WeekContextRenderer}.java`, `feature/companion/controller/MeWeekController.java`, `feature/companion/WeekReviewSource.java`, `feature/companion/service/{ChatService,ConversationService}.java`, `ai_conversation.context_kind`/`.context_date`.
- Contract: `api/feature/proactive/proactive.yml` (weekly-review paths + `WeeklyReview*` schemas), `api/feature/me-week/me-week.yml`, `api/feature/companion/companion.yml` (`CreateConversationRequest.context`).
- Migrations: `...202608271200_mezo-p2tr_create_weekly_review.sql`, `...202608271500_mezo-p2tr_feedback_weekly_review_kind.sql`, `...202608271800_mezo-p2tr_ai_conversation_context.sql`, `...202608291100_mezo-d20.7.6_learned_fact_weekly_source.sql` (learned_fact `source`/`week_start`/`evidence` + the fourth `knowledge_fact` source).
- Tests: `feature/proactive/service/WeeklyReviewGeneratorIT.java`, `feature/proactive/service/WeeklyLessonServiceIT.java`, `feature/proactive/controller/WeeklyReviewControllerIT.java`, `support/populator/{WeeklyReviewPopulator,LearnedFactPopulator}.java`; companion-side `feature/companion/service/DayScoreServiceIT.java`, `feature/companion/controller/MeWeekControllerIT.java`, `AnchoredConversationIT`.
- FE consumer: `frontend/src/data/me/{weeklyReviewApi.ts,weeklyReviewHooks.ts,weeklyReviewMock.ts}`, `frontend/src/features/me/{pages/{WeekHubPage,WeekAnalysisPage,WeekDaysPage,WeekLessonsPage,WeekDiscoveriesPage}.tsx,components/{WeekReviewCard,WeekDiscoveries}.tsx,logic/useChatHandoff.ts}` — full anatomy [me.md](me.md) `Heti` §2/§10. **RETIRED alongside this slice:** the Insights Weekly consumer block just above (`useWeekly`/`WeeklyPage`) — WR does not extend it, it replaces it.

**Docs (link, don't duplicate)**
- Weekly review design of record (WR): `.superpowers/sdd/2026-08-27-weekly-review/`
- Companion-feed design spec (current B/H model): [`docs/superpowers/specs/2026-08-15-companion-feed-design.md`](../superpowers/specs/2026-08-15-companion-feed-design.md)
- Original proactive-layer design spec (W/P/HBWI, and the now-superseded original B/H design): [`docs/superpowers/specs/2026-07-06-proactive-layer-design.md`](../superpowers/specs/2026-07-06-proactive-layer-design.md)
- Roadmap (8 slices): [`docs/superpowers/plans/2026-07-06-proactive-roadmap.md`](../superpowers/plans/2026-07-06-proactive-roadmap.md)
- Companion stack it builds on: [`companion.md`](companion.md)
- Roadmap/milestone log: [`docs/milestones/roadmap.md`](../milestones/roadmap.md)

**Backend — diagnosis (`mezo-hqfi`)**
- `api/feature/diagnosis/diagnosis.yml` — 4 endpoints (list / detail / generate / start-experiment)
  + schemas (`DiagnosisResponse`, `DiagnosisSuspect`, `DiagnosisEvidenceItem`,
  `DiagnosisGenerateRequest`), tag `Diagnosis` → `DiagnosisApi`; registered in `api/generate/merge.yml`.
- `feature/proactive/config/DiagnosisProperties.java` — window / baseline / coverage / min-domains / quota.
- `feature/proactive/service/FatigueEvidenceCollector.java` — the pure-code gather.
- `feature/proactive/service/DiagnosisGenerator.java` — the one SMART call + bounds-checking.
- `feature/proactive/service/DiagnosisService.java` — reads, quota, `stale`, probe→experiment.
- `feature/proactive/service/LogFreshnessProbe.java` — the shared stale probe (also used by the weekly review).
- `feature/proactive/entity/DiagnosisEntity.java` + `DiagnosisEvidenceEnvelope.java` + `DiagnosisSuspectsEnvelope.java`.
- `feature/proactive/repository/DiagnosisRepository.java` — reads + the native quota count (counts soft-deleted).
- `feature/proactive/controller/DiagnosisController.java` — `implements DiagnosisApi`.
- Migrations `202608311200_mezo-hqfi_create_diagnosis.sql`, `202608311210_mezo-hqfi_experiment_source_diagnosis.sql`.
- Tests: `LogFreshnessProbeIT`, `FatigueEvidenceCollectorIT`, `DiagnosisGeneratorIT`,
  `DiagnosisControllerIT`, `DiagnosisExperimentIT`; factory `support/populator/DiagnosisPopulator.java`.
- Design: [`docs/superpowers/specs/2026-08-31-diagnosis-report-design.md`](../superpowers/specs/2026-08-31-diagnosis-report-design.md) ·
  plan: [`docs/superpowers/plans/2026-08-31-diagnosis-report-backend.md`](../superpowers/plans/2026-08-31-diagnosis-report-backend.md)
