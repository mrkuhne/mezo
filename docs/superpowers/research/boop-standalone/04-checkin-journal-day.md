# 04 — Check-ins, journal, daily intention, close-out, rituals, habits, needs

Issue `mezo-r36n9.9`. Date 2026-11-10. Research only. Most relevant core items: **10, 11, 12**.

## TL;DR

1. **Check-in (item 11 data) is rich and solid**: 14 items on 1-10 scales (+ pain regions, craving kinds, free note), 4 fixed slots/day (06:30/10:00/14:00/20:00), adaptive "question of the day". Endpoints `GET/POST /api/biometrics/checkin` + `GET /checkin/plan` are Boop-ready (iOS spec already lists them for S4).
2. **Item 11 is MISSING**: a check-in stores NO biometric snapshot. `check_in` has no HR/HRV/steps columns and no link to `daily_metric`; wearable data is **daily aggregates only** (steps, resting/avg/min/max HR, active kcal; no HRV, no time-of-day samples), so "watch values at check-in time" needs a new ingest path (timestamped samples) AND a snapshot write at check-in save.
3. **Intention (item 10 goal-of-day)** = one standing creed + up to 3 daily foci (200 chars) + ONE holistic evening answer `yes|partial|no`. Works, but the evening rating is **not per-goal and not linked to anything planned** (no plan-vs-actual).
4. **Evening rating**: three unrelated places — `daily_intention.reflection` (yes/partial/no), check-in item `day` ("A nap mérlege" 1-10, evening slot only), Napzárás prose reflection. No single close-out record; the day score in `DayEvaluationEngine` is deterministic from logs, a separate thing.
5. **Journal text is well used by AI**: embedded into vector memory, text-signal extraction -> hypotheses/quick notices, people-mention detection, life-event extraction, weekly review, profile. Journal has 3 kinds: free prose, gratitude, decisions (with frozen context snapshot + later review).
6. **Napzárás ritual** (6-act, `/ritual`, web-only UI) closes the day: one backend row `ritual_day` (closed_at + prose). The orchestration (recap, loops, harvest) lives in the FE; backend is thin.
7. **Habits** (15 seeded, 2 chains MORNING/EVENING, mostly DERIVED from other logs, XP, formation estimator, AI suggest) and **Needs rings** (6 Sims-like rings simulated ENTIRELY in the web FE, only the closing snapshot is posted) are gamification-flavoured: biggest "clutter" candidates for a clean Boop.
8. **Production reality**: last check-in 2026-10-11, last journal 2026-09-29, last ritual 2026-09-17, last focus 2026-09-07 — usage faded after the Folyadék redesign; the check-in **note** (free text) is the most-used text channel (36/41 rows have one), `mood` is nearly never filled (8/41), `day_rating` 1 row ever.
9. **Item 12 (live re-examination + adjust)** is not in this area: only a nightly deterministic day score + cached LLM prose (`day_review`), and companion flags/rules react AFTER check-in save (`CheckInSavedEvent`). No "adjust food/workout now" loop.
10. Tests are solid for backend (ITs for every feature); ArchUnit/focused ITs not run here.

---

## 1. Scope

Covered: backend `feature/biometrics/checkin`, `journal`, `intention`, `ritual`, `habit`, `needs` (+ touch-points in `companion`, `boop`, `proactive`, `character`/`quest`/`progression` only where they read daily reflection); contracts `api/feature/{checkin,journal,intention,ritual,habit,needs}`; FE `frontend/src/features/{today,ritual,quickinput,me}`; docs `journal.md intention.md ritual.md habit.md needs.md`; ios grep (Boop currently only *reads* check-in/intention through the brief). Read-only prod DB shape queries done (counts/dates only).

## 2. What exists

### 2.1 Check-in 2.0 (`mezo-ck2`) — `backend/.../feature/biometrics/checkin/`
- **Table `check_in`** (`CheckInEntity.java:1-159`): one row per `(user, date, slotTime)`; `state` (done/now/skipped/pending), all answers nullable ("NULL = not answered; askedItems tells skipped from not asked"). Columns: energy, stress, body, mental (core legacy four), **mood, rested, soreness, pain (bool) + pain_regions[] (PainRegion enum) + pain_intensity, motivation, hunger, craving + craving_kinds[] (CravingKind), digestion, connection, day_rating**, `note` (unbounded text), `asked_items[]`, `adaptive_item`, `adaptive_reason`, `quick_exit`, `saved_at`. All scales 1-10 (DB CHECK constraints).
- **14 items** with Hungarian copy in enum `CheckInItem.java:1-95`; core five (energy, mood, stress, body, mental) always first.
- **Slots** are config, not code: `application.yml:2978-3004` (`mezo.checkin.plan`): 06:30 (core5 + rested, soreness, pain, motivation), 10:00 (core5 + motivation, hunger), 14:00 (core5 + hunger, craving, digestion), 20:00 (core5 + soreness, pain, craving, digestion, connection, **day**). `rested` only in 06:30, `day` only in 20:00.
- **Adaptive "question of the day"** (`CheckInPlanService.java`, `AdaptiveItemChooser.java`, `CheckInNeedSource` SPI with sources `AllNonCoreNeedSource`, `DetectorCheckInNeedSource`, `HypothesisCheckInNeedSource`, `PairCheckInNeedSource`, `TrainDayCheckInAdapter`): 80 % "thinnest series someone waits on" / 20 % random (planned-missingness guard), deterministic per (user, date, slot) via SplitMix64 seed, sticky once saved.
- **Endpoints** (`api/feature/checkin/checkin.yml`, `CheckInController.java`): `GET /api/biometrics/checkin?date`, `POST /api/biometrics/checkin` (upsert on slot), `GET /api/biometrics/checkin/plan?date&slotTime`.
- **Event**: `CheckInSavedEvent(userId, date)` -> companion flag evaluator AFTER_COMMIT, async (`CheckInService.java`, `FlagEvaluationListener`).
- **Consumers of check-in data**: `CheckInText` (chat snapshot / daily summary / `get_recovery` tool / meal coach), `ContextSnapshotAssembler.java:703`, `BiometricsTools.get_recovery(scope=checkins)`, `DayScoreService`/`DayEvaluationEngine`, `MetricSeriesService`, `MeWeekService`, `MealCoachContextReader`, `LogFreshnessProbe`, `FeatureAbandonmentDetector`, `CharacterSignalReads`, companion flag rules (`AcuteBadDayRule, PoorRestednessRule, MotivationSlumpRule, PersistentPainRule, RecoveryNeededRule, CravingStreakRule, EnergyDipMealTimingRule, SustainedStressRule, LoggingGapRule`), detectors `CheckinGapDetector/LatencyDetector/SlotDriftDetector`, `CheckInNoteSourceAdapter` (note -> embedding, people-mention catch-up), `QuestEvaluator`.
- **Boop**: `BoopDayAssembler.java:291-320` builds 4 slot chips (done + "energia · hangulat · stressz" summary) for the morning brief; iOS S4 would add native check-in UI "on the existing endpoints" (spec `2026-11-09-boop-ios-v1-design.md:173`).
- **FE**: `today/sheets/CheckInSheet.tsx` (241 l) + `today/sheets/checkin/{ScaleStep,PainStep,CravingStep,CheckInSummary,answerLevel}`, `today/pages/NapCheckinPage.tsx`, `today/logic/checkinItems.ts`; hooks `useCheckins`, `useCheckInPlan`, `useCheckinDayRating`.

### 2.2 Intention — `feature/intention/` (366 l)
- Tables: `intention_creed` (one live row/owner, <=280 chars), `intention_focus` (date, text <=200, cap `focusCap`, default 3), `daily_intention` (date, `reflection` yes|partial|no) (`entity/*.java`).
- `IntentionService.java`: `getDay`, `setCreed`, `addFocus` (409 `INTENTION_FOCUS_CAP`), `removeFocus` (soft delete), `reflect`. Endpoints `/api/intention/*` (`IntentionController.java`). Switch `INTENTION_SWITCH`.
- XP only through HABIT/QUEST tails (`daily_intention` MORNING habit, `intention_reflect` EVENING habit, `growth_intention` quest); first focus of the day only.
- FE: `today/sheets/IntentionSheet.tsx` ("Mi ma a fókuszod?"), `ReflectSheet.tsx` ("Szándékkal élted a napot?"), opened from the Rutin page (`/nap/rutin`) and Napzárás act 4; Mai no longer opens it (docs `intention.md` header, 2026-10-10).
- AI: creed/foci/reflection in chat snapshot (`ContextSnapshotAssembler.java:601-615`), Boop prompt only uses the **creed** (`BoopPrompts.java:117-119`) — daily foci are collected into `BoopDay.Intention` but only the creed is written into the prompt line shown.

### 2.3 Ritual / Napzárás — `feature/ritual/` (289 l)
- Table `ritual_day` (date unique per user, `closed_at`, `reflection_text`). `RitualService.java`: `getDay` (returns the evening window computed from sleep anchor bed time: `opensAt = bed - leadMin`, `prepStartsAt`), `close` (idempotent, **today only**, 409 `RITUAL_NOT_TODAY`), `saveReflection` (today only, blank = clear, trims). Endpoints `GET /api/ritual/day/{date}`, `POST /api/ritual/close`, `POST /api/ritual/reflection`.
- `RitualClosedEvent` -> `ReflectionEmbeddingListener` (embeds prose into memory), also `ReflectionMentionListener` (people).
- FE: `ritual/pages/RitualPage.tsx` — 6-act machine (Arrival, DayStory, Reflection, Loops, Harvest, Release); the day recap (`useDayRecap`), open-loop computation (`logic/openLoops.ts`), harvest stages (`logic/harvestStages.ts`, reads `GET /api/gamification/day/{date}`) are **frontend logic**; close fires when entering act 5. Closed = `closed_at != null`.

### 2.4 Journal — `feature/journal/` (773 l)
- Three record kinds, all soft-delete, switch `JOURNAL_SWITCH`:
  - `journal_entry` (free prose, `occurred_on` = day it is ABOUT, `source` in {quickinput, ritual} — DB CHECK, **no "voice" source**).
  - `gratitude_entry` (<=280 chars, optional LIFE area).
  - `decision_entry` (decision text, server-frozen `context_snapshot` envelope, `review_due`, later `outcome_rating` 1-5 + text). **`DecisionContextEnvelope`** is the only place in the codebase where "what the system knew at write time" is snapshotted — a precedent for item 11.
- Endpoints `api/feature/journal`: `/api/journal` (list range/create), `/{id}` (update/delete), `/decision` (+`/{id}/review`), `/gratitude` (+`/{id}`).
- FE: `me/pages/JournalPage.tsx` (month-grouped notes, gratitude streak, decision card, route `/me/naplo`), `quickinput/QuickLogSurface.tsx` (9-tile quick log; Napló/Check-in/Víz/Súly/Alvás/Sport hosted there; chat row first).
- AI usage: `JournalEmbeddingListener` / `GratitudeEmbeddingListener` / `DecisionEmbeddingListener` (async AFTER_COMMIT -> `memory_embedding`, retrieval by chat memory); `TextSignalListener` + `QuickNoticeService` (Reflexió: extract text signal, same-day "quick notice" observation / proposed hypothesis, gated companion+journal+reflection switches; 37 `text_signal` rows in prod); `MentionDetectionListener`/`PersonExtractionService` (people); `LifeEventExtractionService` (nightly graph phase over journal + ritual reflection + daily summary); `ProfileAssembler` (decision-quality trend); `WeeklyReviewContextSources` (journal clipped); `CharacterSignalReads`; `AnchorResolver` (notifications).

### 2.5 Habits — `feature/habit/` (2428 l, biggest in this area)
- Per-user `habit_chain` (MORNING/EVENING) + `habit_def` (31 rows live in prod incl. edits) lazily seeded from `content/habit-catalog.json`: 9 MORNING (wake_on_time, sunlight*, pushups*, video*, weigh_in, coffee, workout, protein_breakfast, daily_intention), 6 EVENING (caffeine_cutoff, kitchen_close, intention_reflect, evening_ritual, wind_down*, bed_on_time) (* = MANUAL, rest DERIVED from other logs by `HabitEvaluator`).
- `habit_day` rows done/missed/pending (prod: 205 done / 793 missed / 16 pending — most days auto-missed, i.e. a nagging-heavy mechanic).
- `HabitService` (576 l), `HabitCatalogService` (editor CRUD), `HabitFormationEstimator` (lifetime formation/"automaticity" estimate), `HabitJob` nightly close cron + formation-crossing feed notices, `HabitAiService`/`suggestHabits` (propose-only, smart model), `HabitAdminService`, `HabitFrameworkValidator`. Endpoints `/api/habit/day/{date}`, `/{key}/check` (manual, today/yesterday), `/summary`, `/formation/{key}`, `/catalog`, `/chain*`, `/def*`, `/ai/suggest`.
- FE: `me/pages/{HabitPage,HabitEditPage,SzokasaidPage,RutinHubPage,RoutineWizardPage}`, `today/pages/NapRutinPage.tsx`.

### 2.6 Needs ("Életjelek") — `feature/needs/` (284 l)
- Table `needs_day` (6 ring values energia/hidratacio/pihenes/mozgas/lelek/rend, green_count, all_green, xp, streak). `NeedsService.close` (today only, idempotent) awards XP on the recovery LIFE skill; `GET /api/needs/summary`.
- **Ring values are computed in the web FE** (`today/logic/needs.ts` 343 l decay/refill simulation, `needsInputs.ts`, `useNeeds.ts`, `needsNudges.ts`) from meals/water/activity/check-ins (`checkin`, `connectionPerPoint`)/sleep and POSTed; backend trusts the client numbers. Pure-FE game logic.
- Prod: 9 closes, 0 all-green, last 2026-09-17.

### 2.7 Adjacent (not owned, but touches daily reflection)
- `DayScoreService` / `DayEvaluationEngine` -> six deterministic dimensions (nutrition, quality, training, sleep, logging, rhythm); `DayReviewLlmAdapter` + `day_review` cache table = cheap-tier prose over the deterministic score, regenerated on input-hash change (warm-up job 02:30 per `application.yml`). This is the closest existing thing to item 12, but it is *retrospective prose*, not an adjuster.
- Quest/gamification: `growth_intention` quest, `GET /api/gamification/day/{date}` (Harvest), progression XP — only touched via habit/needs/ritual tails.

## 3. How it works (flows)

**Check-in**: 4 slot times (config) -> app asks `GET /checkin/plan` (slot items + 1 adaptive item with a "why" sentence) -> one question at a time (1-10 scale; pain gate -> regions -> intensity; craving scale -> kinds from 4) -> "Most csak ennyi" quick exit after core five -> optional note -> `POST /checkin` upsert (stored as received, nulls kept) -> `CheckInSavedEvent` -> flag rules may raise a flag/notification. Needs ring `lelek`/`energia` get FE-side refills from check-ins. No wearable value is read or stored.

**Day goal / close-out**: morning: creed + up to 3 foci typed (first focus awards habit XP). Evening (>= bed-lead window, or any time via `/ritual`): Napzárás recap -> prose reflection (act 3, shows the 20:00 check-in `day` rating read-only if given) -> open loops -> **close** (`POST /ritual/close`, harvest XP) -> hand-off to sleep-prep routine. The yes/partial/no `reflect` is a separate sheet/pills (Rutin or act 4). Rating vs. plan: only the holistic yes/partial/no on "did you live intentionally" — never evaluated against the foci text, the training/meal plan or the biomarker capacity.

**Journal -> AI**: quickinput/ritual write -> events -> embed (memory retrieval in chat) + text-signal extraction (-> observation/hypothesis) + people mentions; nightly graph life-event extraction; weekly review reads clipped journal text. Journal text is NOT directly placed in the chat system snapshot except via memory retrieval and the weekly review.

## 4. Quality assessment

**Solid**: check-in data model, config-driven plan, deterministic adaptive chooser (unit-tested `AdaptiveItemChooserTest`, `CheckInPlanServiceIT`); null-means-unanswered discipline; ownership from principal; every feature has ITs (`IntentionApiIT/ServiceIT/DerivedIT`, `RitualApiIT/ReflectionEmbeddingIT`, `JournalApiIT/MidnightCrossingIT`, `NeedsApiIT`, `CheckInServiceIT/PlanApiIT`). Journal AI plumbing is the most mature part of the product's memory.

**Half-built / weak**:
- No biometric snapshot at check-in (item 11 absent); `daily_metric` is per-day aggregate (`DailyMetricEntity`: steps, restingHr, avgHr, minHr, maxHr, activeKcal; no HRV, no samples, no timestamps).
- Evening rating is fragmented (3 stores) and not tied to the plan (item 10).
- Journal `source` constraint `quickinput|ritual` — no voice/dictation, no AI-assisted structuring; decision journal has 0 rows in prod (dead in practice).
- Needs rings: decay logic only in the FE and the server trusts client values (cheating is irrelevant single-user, but a native app would have to re-implement or drop it); 0 all-green closes, 9 closes total -> low value.
- Habits: 793 "missed" vs 205 "done" auto-closed rows — a punishment-flavoured mechanic against ADR 0010's tone; 2428 lines of backend for a niche feature.
- `BoopPrompts` writes only the creed, not today's foci (probably unintended).
- Ritual orchestration (recap, open loops, harvest staging) is FE-only; backend `ritual_day` is two columns.
- Doc drift: `intention.md` body still describes `IntentionBanner` (retired); `ritual.md` header lists acts with historical R3 naming — headers were updated 2026-10, bodies partly stale.

**Prod usage (shape only)**: `check_in` 41 rows, 17 distinct days, 2026-08-24 -> 2026-10-11; slot fill 13/12/12/4 (06:30/10:00/14:00/20:00) -> evening check-in rarely done; core energy/stress/body/mental filled in every row, `mood` 8/41 (only asked when adaptive/other), `day_rating` 1, pain 3, `note` 36/41 (**free text is the habit**, 2 quick exits). `journal_entry` 7 (all quickinput, ends 2026-09-29), `gratitude_entry` 16, `decision_entry` 0, `intention_focus` 5 (5 days, ends 2026-09-07), `daily_intention` 1 (yes), `intention_creed` 0, `ritual_day` 9 closed / 7 with prose (ends 2026-09-17), `needs_day` 9. Nothing new since mid-October: the whole daily-reflection loop is dormant; the owner's pull is the 10:00/14:00/morning check-in with a note.

## 5. Reuse for native iOS

- **As-is**: `GET/POST /api/biometrics/checkin` + `/checkin/plan` (whole question engine server-side; the app only renders `CheckInPlanResponse` items/kinds/options — exactly what Boop S4 planned). `/api/intention/*`, `/api/journal` (create/list), `/api/ritual/day|close|reflection` are thin and usable.
- **Needs a Boop-shaped API**: (a) a "day plan + close-out" endpoint that stores goals-of-day as structured items with per-item outcome (today foci are text-only, reflect is holistic); (b) check-in save that attaches a biometric snapshot (see item 11); (c) a combined "evening" call replacing Napzárás' FE recap; (d) journal with `source` including voice/dictation (migration of CHECK constraint).
- **Only in web FE (would move to backend or Swift or be dropped)**: needs-ring simulation (`needs.ts`), Napzárás recap/open-loops/harvest staging, check-in answer-level colouring (`answerLevel.ts`), habit action routing (`habitAction.ts`).
- Drop-for-Boop candidates: needs rings, habit chains + formation estimator + AI habit suggest, Harvest/XP ceremony, gratitude streak tile, decision journal (0 rows).

## 6. Gaps vs. owner's core

- **10 Journal / goal of day / close-out + rating vs. planned goals** — *exists, needs fixing/redesign*: free-text journal and foci exist and are AI-embedded; goal-of-day is text only, rating is holistic yes/partial/no or 1-10 `day`, no per-goal outcome, no link to the day's computed plan/units. Close-out ritual exists in web only.
- **11 Daily check-ins + biometric snapshot** — *check-in exists & good; snapshot MISSING*. Needs: timestamped HR/HRV samples from HealthKit (ring/Watch) ingested to backend (current `wearable` is per-day aggregate), then either a snapshot written at `POST /checkin` (precedent: `DecisionContextEnvelope` frozen snapshot) or a time-window join keyed by `saved_at` (the row already stores `saved_at`, so a join is possible once samples are timestamped). Decide HRV availability on the target watch/ring.
- **12 Live day re-examination + dynamic adjustments** — *missing here*: only nightly deterministic day score + cached LLM narrative (`day_review`) and event-driven flag rules after check-in save; no loop that proposes extra food/shorter workout. Check-in save + `CheckInSavedEvent` is the natural trigger hook.
- Related: **8** (journal/check-in notes are in memory + chat tool `get_recovery`) — exists & good; **7** (day "units" vs capacity) — check-in energy/stress/mental are the only subjective capacity input, no calibration against biomarkers yet; **6** — `rested` (06:30) is the subjective sleep-quality counterpart.

## 7. Open questions / risks

1. Does the owner want to keep the 4-slot, 14-item check-in, or a leaner native one (core five + note + optional adaptive)? Usage says: core + note, mostly morning/midday.
2. Item 11 design: snapshot at save vs. join at query; which metrics (HR, HRV, resting HR delta, steps, sleep stage) given Apple Watch now / ring later; HealthKit background delivery gives timestamped samples but backend table `daily_metric` must be extended (new table of samples, volume decision).
3. Goal-of-day model: structured goals with outcome, or keep text foci + AI judging the evening journal against them? The AI rating-vs-plan needs a stable plan record (training plan/meal plan/goal) — dependent on other mappers' areas.
4. Habit/needs/XP system: drop wholesale for Boop v1 or keep via backend only? Backend habit feed/quest/progression coupling (`HabitEvaluator` reads intention, ritual, meals, weight, workouts) means switching it off needs care; it has its own feature switch (`HABIT_SWITCH`, `NEEDS_SWITCH`).
5. Adaptive question chooser depends on companion detectors/hypotheses (`DetectorCheckInNeedSource` etc.) — if companion domain is simplified, the need sources must still degrade (they have a fallback source).
6. Tone: auto-"missed" habit rows and streaks conflict with a "clean, calm" app; ADR 0010 already says no punishment.
7. Dormant since mid-Oct: confirm whether the owner stopped due to UX friction (likely web redesign churn) before investing in re-porting ritual-style flows.
