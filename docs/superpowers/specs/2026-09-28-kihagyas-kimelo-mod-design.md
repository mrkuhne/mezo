# Kihagyás + kímélő mód — design (programme spec)

- **Date:** 2026-09-28
- **Status:** owner-approved design (brainstorm 2026-09-28); slices S1–S4 each open with a
  short brainstorm + prototype OK in their own session (driver skill: `/kihagyas`).
- **Epic:** `mezo-q4xt2` (slices `mezo-q4xt2.1`–`.4`; `bd list -l epic:mezo-kihagyas`).

## 1. Problem

The owner wants to say, with one tap, "I am skipping this" for a planned **gym workout**, a
planned **sport session** or a planned **meal**, and optionally tell the app **why**. The
reason must be *understood* (illness, stomach bug, injury, travel, fatigue, no time, no
mood) so the app reacts sensibly for the following days: plan, recovery, nutrition, coaching
tone, and statistics that do not punish a legitimate skip.

Today:
- A whole gym workout **cannot** be skipped; only one exercise inside an active session.
- A sport slot can be skipped per date, but only through a proactive advice card; no reason.
- A meal is never stored as skipped; an unlogged slot is computed as `missed` by time.
- No sick / rest / recovery state exists anywhere.

## 2. Owner decisions (2026-09-28): do not re-litigate

1. **AI understands and adapts; it does not judge** (option A of three). The AI never decides
   whether a reason is "legitimate". It maps free text to a fixed reason category (+ a
   duration guess) and **shows its reading for confirmation** ("Úgy értem, beteg vagy —
   jól?"). What happens is decided by **deterministic per-category rules in code**
   (house pattern: *LLM classifies, code decides*, as `TeamChatReplyDecision`).
   The one "validation" the AI adds is a **safety question** for illness: fever or
   chest-level symptoms ("nyak alatti tünet") → the app firmly says no training until it
   passes.
2. **Reason input = quick chips + "Egyéb".** Chips: *Beteg vagyok · Gyomorrontás ·
   Sérülés/fájdalom · Úton vagyok · Fáradt vagyok · Nincs időm · Nincs kedvem · Egyéb*.
   "Egyéb" takes typed or dictated text; only that text goes to the AI. The whole popup is
   skippable ("Most nem mondom") → a reasonless skip.
3. **Serious vs soft reasons.**
   - *Serious* = illness, stomach bug, injury/pain, travel → opens **kímélő mód**.
   - *Soft* = tired, no time, no mood → skips only that one occurrence.
4. **Kímélő mód duration = estimate + daily check.** After a serious reason, one more tap:
   *Csak ma · 2–3 nap · Kb. egy hét · Nem tudom*. Every morning a small card asks "Hogy
   vagy? Jobban / Még nem". "Jobban" ends the mode and starts the return. When the estimate
   runs out the app **asks**; it never silently switches back.
5. **Gym programme after a kímélő period: length-based rule** (TrainerRoad pattern):
   - out 1–2 days → programme continues on the calendar;
   - out ≈ one week → resume where you stopped, the programme end shifts by that much;
   - out > one week → step back one week and rebuild from there;
   - **always** 1–2 lightened sessions on return (a comeback ramp, never straight to full).
6. **Sport:** in kímélő mód planned sport sessions are skipped automatically; none needs to
   be made up and none counts as missed. A single skip removes only that occurrence.
7. **Meals:** a skipped meal leaves the day; its calories are **not** redistributed to other
   meals. In kímélő mód the daily kcal target is replaced by **guidance** (fluids, light
   food; bland-diet suggestions for a stomach bug). Nothing turns red; Fuel's
   adherence-neutral vocabulary rule applies.
8. **Soft reasons: one free pass per week.** The first soft skip of the week does not touch
   streaks / adherence / stats. The second counts as a normal skip, but with no reproach.
   Repeated "nincs kedvem" makes the coach ask, kindly, what is going on.
9. **Memory:** the app remembers what happened ("szeptember végén 5 napig beteg voltál") so
   the coach knows later and weekly recaps do not read it as laziness.
10. **Everything is undoable:** a skip can be withdrawn; kímélő mód can be ended any time.
11. **Four slices, one per fresh session**, each following the frontend change workflow
    (CLAUDE.md): short brainstorm → prototype OK → plan → build → ship.

## 3. Slices

| Slice | Scope | Depends on |
|---|---|---|
| **S1 · Kihagyás gomb + „Miért?” ablak (edzés, sport)** | "Kihagyom" on today's gym hero (next to *Indítsuk*) and on each planned sport occurrence; the reason sheet with chips (Egyéb stored as `OTHER` + raw text, no AI yet); undo; weekly free pass; every consumer of "missed/done/adherence/streak" honours the skip (reason-aware). | — |
| **S2 · Kímélő mód** | Duration question; the persisted recovery period; daily "Hogy vagy?" card (Nap); auto-skip of sport and gym inside the period; coach tone switch; the length-based programme rule + comeback ramp (lightened sessions via the existing day-adjustment overlay); end/undo. | S1 |
| **S3 · Kaja** | "Kihagyom" on unlogged meal slots (stored, no redistribution); kímélő-mód Fuel: target → guidance, stomach-bug bland suggestions; adherence-neutral copy. | S1, S2 |
| **S4 · MI + emlékezet** | "Egyéb" text → cheap-tier LLM classifier `{category, durationGuess, confidence}` with confirm UI and deterministic fallback; illness safety question; skip / kímélő episodes written to memory (knowledge fact / life event) for coach + recaps; repeated-"nincs kedvem" coach nudge. | S1, S2 |

## 4. Architecture sketch (to be refined per slice brainstorm)

- **One skip record, per date, overlay-style** — never a template edit and never a fake
  `workout_session` instance (collides with D5/D6 guards, `getToday` resume and the
  status-agnostic streak query). Candidate: a `planned_skip` table
  `(created_by, date, kind GYM|SPORT|MEAL, target_ref, reason_category, reason_text,
  counts_as_missed, is_deleted…)`, or extending `sport_slot_skip` for SPORT. S1 decides;
  the pattern to copy is `ReadinessChoiceEntity` / `WorkoutDayAdjustmentEntity` /
  `SportSlotSkipEntity` (soft-delete undo, partial unique index).
- **Reason category enum** is the contract between UI, AI and rules:
  `ILLNESS, STOMACH, INJURY, TRAVEL, TIRED, NO_TIME, NO_MOOD, OTHER` + `NONE`.
  Serious/soft and the free-pass rule are functions of the category, in code.
- **Kímélő period** (S2): a dated range row `(start, expected_end, ended_at, category)`;
  every date-specific reader asks one service "is this date protected / skipped?" — S1
  should introduce that **central read** so S2–S3 do not repeat the `mezo-cq06` sweep.
- **LLM** (S4): a consumer-owned port in the owning feature + companion adapter (ADR 0012),
  `LlmCallContext` slug, cheap tier, deterministic fallback to `OTHER` when the adapter is
  absent / budget-degraded / switched off. Feature switch per house pattern.

## 5. Prior art (researcher, 2026-09-28)

- **Oura Rest Mode** — https://support.ouraring.com/hc/en-us/articles/360057065433-Rest-Mode :
  a multi-day state for illness/injury/travel that switches goals and scores off, re-tunes
  messages to recovery, and ramps goals back **gradually** on exit. *Adopted* as kímélő mód
  (serious reasons only), including the gradual return. Auto-suggesting it from sensor data:
  *deferred* (we have no temperature signal).
- **TrainerRoad Adaptive Training** — https://www.trainerroad.com/blog/how-to-adjust-your-training-plan-when-you-miss-workouts/ :
  typed annotations (illness / injury / travel / time off) and a duration-based return rule.
  *Adopted* as decision 5. Their users' top complaint (the "sick" note only deletes workouts,
  no ramp back — https://www.trainerroad.com/forum/t/no-adaptation-in-case-of-sickness/102135)
  is why the comeback ramp is mandatory.
- **MacroFactor adherence-neutral** — https://macrofactor.com/adherence-neutral/ : no shame
  UI, "didn't eat" vs "didn't log" separated, no forced catch-up. *Adopted* for meals
  (decision 7).
- **Duolingo streak freeze** — https://blog.duolingo.com/how-duolingo-streak-builds-habit :
  bounded forgiveness beats rigid rules; the cap does the policing. *Adopted* as the weekly
  free pass (decision 8).
- *Rejected:* the AI checking whether a reason is "true" or asking for proof (shame,
  dishonest logging); free-text-only input (too slow for one tap).

## 6. Codebase terrain (investigator, 2026-09-28)

- **Gym:** `WorkoutSessionEntity` (`status planned|active|completed|skipped`; instances only
  exist once started; only `WorkoutAutoCloseService` writes `skipped`).
  `POST /api/train/workouts/{id}/skip` skips **one exercise** (name misleads).
  `WorkoutService.findPlannedTemplateForDate` = side-effect-free "is a gym day planned?".
  `WorkoutDayAdjustmentEntity` = per-date overlay (the comeback ramp's vehicle).
  `ReadinessCard` + `readiness_choice` = the one-tap-with-undo precedent. Gym hero CTA:
  `TrainTodayPage.tsx` (~l.545); briefing `WorkoutBriefing.tsx` (mezo-mgu2r).
- **Sport:** `sport_schedule_slot` (re-inserted on save → skips keyed by
  `(day_of_week 0=Hét..6=Vas, time, date)`), `sport_event`, `RunningBlockEntity`;
  `sport_slot_skip` + `SportSlotSkipService` (only writer: advice action `skip_sport_slot`
  under the advisory lock).
- **Meals:** plan from `meal_slot_template` (per day type); `buildDayPlan.ts` computes
  `missed|now|pending` by time; nothing persisted. `DayTargetProjector`: only logged
  movement raises the target, so a skipped workout already lowers it.
- **Consumers a skip must honour:** `MissedWorkoutsRule` (companion flag),
  `TrainingStreakCalculator`, `TrainingCommitmentCalculator`, `MesocycleReportService`
  adherence, QuestEvaluator, insights weekly counts, habit, `PlanFeasibilityCalculator`;
  the ~8 FE date readers listed in `train.md` (mezo-cq06 sweep) and backend
  `WorkoutWindowQueryService`, `AnchorResolver`, `TrainTools.sportSlotsOn`,
  `ContextSnapshotAssembler.dayLine`.
- **AI:** `CompanionLlm.complete` (cheap) / `completeSmart`; String output → JSON prompt +
  validator in code; ADR 0012 ports; `LlmCallContext`; $30/30d budget (≥70% forces cheap).
  Closest "ask why → classify → remember" flow: `TeamChatReplyService` / `EXCUSE` offer →
  `team_chat_exception` + `knowledge_fact` with undo. Life events: `LifeEventExtractionService`.
- **UI kit:** `shared/ui/mozaik/GlassBox.tsx` (confirm/menu glass), `<Sheet glass>`;
  Titanium sprite (Check-in 2.0 added `t-pain`, `t-digestion`); no glass in glass.

## 7. Traps

- `TrainingStreakCalculator` uses status-agnostic `findInstanceDates` → auto-closed
  `skipped` instances already extend the streak (being fixed in a separate task — check
  its outcome before S1). Do **not** model a skip as a `skipped` instance.
- No central "is this date skipped?" read exists → every reader filters by hand. S1 builds
  the central read.
- Weekday numbering 0=Hét..6=Vas in slot/skip tables (not ISO).
- ArchUnit: train/meal never import companion; layer subpackages enforced; focused ITs do
  not run ArchUnit.
- New tables join `ResetDatabase`'s TRUNCATE list; jsonb `?` in Liquibase → `jsonb_exists()`.
- Fuel shame-vocabulary tests (`elrontott|túlléptél|hiba|rossz|bukta|kudarc`) apply to all
  skip / kímélő copy.
- Contract fragments under `api/feature/*`, generated `api.gen.ts`; CODEMAP regen after every
  merge; `VITE_USE_MOCK=false` explicitly for the real-mode FE gate.

## 8. Spec delta — S1 (2026-09-28, `mezo-q4xt2.1`)

Brainstorm 2026-09-28 (recon: researcher + investigator). Owner answers in bold.

### 8.1 Decisions
1. **Which occurrences can be skipped: today, the rest of the current week ahead, and the
   last 7 days retroactively** (owner: "harmadik"). A retro skip turns a past "Kimaradt"
   occurrence into "Kihagytam · <ok>", so a forgotten sick day stops reading as a miss.
   Window: `today-7 ≤ date ≤ Sunday of the current ISO week` (Europe/Budapest); the server
   rejects dates outside it (400).
2. **`OTHER` (Egyéb) and `NONE` (Most nem mondom) are soft until S4** (owner: "mehet").
   S4's classifier may later re-categorise an `OTHER` row (the rule is read-time, so a
   re-categorisation retro-fixes every stat).
3. **Skip first, reason after** (Runna / TrainerRoad): "Kihagyom" writes the skip at once
   (category `NONE`), then the reason sheet opens; picking a chip updates the same row;
   "Most nem mondom" closes it. A double tap is idempotent (upsert under a per-user lock).
4. **The skipped occurrence stays visible, muted**, with "Kihagyva · <ok>" and a
   **Visszavonom** action on the card itself (persistent undo, no expiring snackbar only).
   Undo = soft delete; the occurrence returns to its normal state.
5. **Counting rule (read-time, in code — `PlannedSkipPolicy`):**
   - serious (`ILLNESS, STOMACH, INJURY, TRAVEL`) → never counts as missed;
   - soft (`TIRED, NO_TIME, NO_MOOD, OTHER, NONE`) → the **first soft skip of the ISO week
     (gym + sport together, ordered by `created_at`) is covered by the free pass**; later
     soft skips count as missed (copy stays reproach-free).
   - Free pass shown as one quiet line in the reason sheet when it applies ("Ezt a heti
     szabadjegyed fedezi — a sorozatod marad.") and as a small mark on the muted card. No
     separate popup (Duolingo pattern, own sprite icon).
   - "Excused" = serious or pass-covered. Excused skips leave the planned count; counted
     skips stay as planned-but-not-done (exactly today's behaviour for a miss).
6. **Streak (`TrainingStreakCalculator`, week-based):** a week with no session but ≥1 excused
   skip is **bridged**: it neither breaks nor extends the streak.
7. **Quest / habit:** a gym day whose gym is skipped (any category) is treated as a rest day
   by `QuestSelector`; `training_done_today` stays done-only (no neutral tick in S1).
8. **Programme:** a single skip never shifts the mesocycle (calendar-based today, unchanged);
   the length-based rule is S2's.
9. **Surfaces (Edzés domain):** Mai gym hero (a secondary "Kihagyom" beside
   *Indítsuk*; not shown once the workout is done or in progress), non-today gym
   `TodaySessionCard`s and every sport `TodaySessionCard` (planned / today / missed states) get
   "Kihagyom" (past: "Kihagytam"); the Heti agenda shows skipped rows muted. The Nap timeline,
   day orb, notifications and Fuel week keep **hiding** a skipped occurrence (they plan the
   day; unchanged behaviour, now for gym too).
10. **Two new sprite icons:** `t-ill` (thermometer) for ILLNESS, `t-travel` (suitcase) for
    TRAVEL; the rest reuse `t-digestion, t-pain, t-rested, t-clock, t-mood, t-other`, the
    button uses `t-skip`.

### 8.2 Architecture
- **One table `planned_skip`** (Liquibase, `1.1.0`): `id, created_by, is_deleted, created_at,
  updated_at, date, kind (GYM|SPORT), day_of_week smallint null (0=Hét..6=Vas, SPORT only),
  time varchar(5) null (SPORT only), reason_category varchar + CHECK, reason_text text null`;
  partial unique index `(created_by, kind, date, coalesce(day_of_week,-1), coalesce(time,''))
  where is_deleted = false`. A data changeset copies live `sport_slot_skip` rows in as
  `SPORT/NONE`… **but as already-excused history they keep their advice semantics**; after the
  copy `SportSlotSkipService` becomes a facade over `PlannedSkipService` (signatures kept, so
  the advice writer and the 5 backend readers compile unchanged), and `sport_slot_skip` is no
  longer written. Advice-created skips carry category `NONE` + `source='ADVICE'` and are
  always excused (the coach proposed them).
- **Central read** in train: `PlannedSkipService` — `skipsBetween(user, from, to)`,
  `isGymSkipped(user, date)`, `isSportSkipped(user, date, dow, time)`,
  `excusedDates…` via `PlannedSkipPolicy`. Every consumer in §6 + the recon list goes through
  it; S2's kímélő range extends this same service ("protected" dates), S3 adds `MEAL`.
- **API** (fragment `api/feature/train/train-skip.yml`): `GET /api/train/skips?from&to`,
  `PUT /api/train/skips` (upsert `{date, kind, dayOfWeek?, time?, reasonCategory, reasonText?}`
  → skip DTO incl. `excused`, `freePass`), `DELETE /api/train/skips/{id}` (undo). The old
  `GET /api/train/sport-slot-skips` stays (facade) until its FE readers migrate in this slice.
- **Gym "planned" callers** get a skip-aware path (`findPlannedTemplateForDate` itself stays
  pure so `getToday` still resolves a skipped day for undo).
- **FE:** `data/train/skipHooks.ts` (dual-mode, readiness pattern), `features/train/sheets/
  SkipReasonSheet.tsx` (glass sheet, 8 chips + Egyéb text/dictation + Most nem mondom),
  `isSportSlotSkipped` readers switched to the new query (range, not current week only).
- Not switch-gated (plain CRUD, like readiness); no LLM in S1.

### 8.3 Out of S1
Kímélő mód and duration chip (S2); meals (S3); AI for Egyéb, memory, repeated "nincs kedvem"
nudge (S4); one-off `sport_event` skips; the advice card's "applied" state reflecting a user
undo.

### 8.4 Prior art (S1-specific, researcher 2026-09-28)
- Runna — persistent "Skipped" state is the undo: https://support.runna.com/en/articles/15012850-how-and-when-to-skip-a-run-managing-missed-sessions-in-your-training-plan — *adopted* (8.1.4); overflow-menu hiding *rejected*.
- TrainerRoad — skip needs no reason, reason optional afterwards: https://www.trainerroad.com/blog/how-trainerroads-personalized-training-plans-adapt-to-interruptions-and-time-off/ — *adopted* (8.1.3).
- Garmin Coach — no undo once the day passed: https://forums.garmin.com/sports-fitness/running-multisport/f/forerunner-945/251132/daily-suggested-workout-skipping-missing-a-training — *rejected* (retro window 8.1.1); escalate-after-repeats → S2/S4.
- Duolingo streak freeze — quiet day mark, count holds: https://duolingo.deconstructoroffun.com/mechanics/streaks — *adopted* (8.1.5–6), inline line instead of silence.
- No documented skipped-in-week-view style found; muted row + label chosen, strikethrough rejected (reads as deleted).

### 8.5 Codebase terrain (investigator 2026-09-28) — corrections to §6/§7
- **Stale §7:** the streak fix shipped (`mezo-iz4kt`): `TrainingStreakCalculator` uses
  `findCompletedInstanceDates`.
- `sport_slot_skip` has **no undo** and **no REST writer**; the advisory lock belongs to the
  caller (`AdviceApplyService`), writer `proactive/service/SportSlotSkipAdapter.java:44`.
- FE readers all go through `isSportSlotSkipped` (`features/train/logic/weekAgenda.ts:35`):
  weekAgenda, buildProtocol, useDayOrbFill, todayHooks, recapHooks, fuelWeekHooks,
  timelineHooks/deriveBlocks, stackDayHooks, notificationScheduleWriter, NotificationsPage,
  TrainTodayPage; the hook (`trainHooks.ts:221`) fetches the current week only.
- Backend sport readers: `WorkoutWindowQueryService:108,211,293`, `AnchorResolver:194`,
  `PlanFeasibilityCalculator:134`, `TrainTools:410`, `ContextSnapshotAssembler:420`.
- Gym planned/missed sites: `MissedWorkoutsRule:92` (uses `gym_schedule_slot`),
  `TrainingCommitmentCalculator:32-48`, `MesocycleReportService:205-216`,
  `QuestSelector:53,74`, `HabitEvaluator:90`, `AnchorResolver:182`, `TrainTools:372`,
  `ContextSnapshotAssembler:399`, `ProactiveMemoryBlock:145`, `ProactiveChallengeService:59`,
  `JointOveruseRule:83`, `WorkoutWindowQueryService:137`, `ReadinessService:104`.
  "Insights weekly counts" (§6) has no site — dropped.
- Two "planned gym" sources (`gym_schedule_slot` vs meso day labels) — a date-keyed GYM skip
  covers both. Template: readiness (`202609272130_mezo-ck2_readiness_choice.sql`,
  `ReadinessService:77/94`, `train-readiness.yml`, `data/train/readinessHooks.ts`); its
  double-tap race (no lock → 500) must not be copied.

## Slice lessons

(appended by each slice session)
