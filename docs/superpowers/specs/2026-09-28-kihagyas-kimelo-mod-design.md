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
10. **Running sessions are in S1 too** (owner, 2026-09-28, after the prototype: "igen"): a
    prescribed run of the active running block gets the same "Kihagyom / Kihagytam" and
    counting rule; kind `RUN`, keyed by `(date, session_key)`.
11. **Prototype + icons approved** (owner, 2026-09-28: "tetszik"). **Two new sprite icons:** `t-ill` (thermometer) for ILLNESS, `t-travel` (suitcase) for
    TRAVEL; the rest reuse `t-digestion, t-pain, t-rested, t-clock, t-mood, t-other`, the
    button uses `t-skip`.

### 8.2 Architecture
- **One table `planned_skip`** (Liquibase, `1.1.0`): `id, created_by, is_deleted, created_at,
  updated_at, date, kind (GYM|SPORT|RUN), day_of_week smallint null (0=Hét..6=Vas, SPORT only),
  time varchar(5) null (SPORT only), session_key varchar(64) null (RUN only), reason_category varchar + CHECK, reason_text text null`;
  partial unique index `(created_by, kind, date, coalesce(day_of_week,-1), coalesce(time,''),
  coalesce(session_key,''))`
  `where is_deleted = false`. **`sport_slot_skip` stays** (planning refinement 2026-09-28): the
  advice writer keeps writing it, and the central read is the **union** of both tables — an
  advice row reads as `SPORT / NONE / source=ADVICE`, always excused (the coach proposed it),
  and is undoable through the same DELETE. `SportSlotSkipService.isSkipped/skipsBetween` answer
  the union, so its 5 backend readers become user-skip-aware with no change of their own. No
  data migration, no populator churn.
- **Central read** in train: `PlannedSkipService` — `skipsBetween(user, from, to)`,
  `isGymSkipped(user, date)`, `isSportSkipped(user, date, dow, time)`,
  `excusedDates…` via `PlannedSkipPolicy`. Every consumer in §6 + the recon list goes through
  it; S2's kímélő range extends this same service ("protected" dates), S3 adds `MEAL`.
- **API** (fragment `api/feature/train/train-skip.yml`): `GET /api/train/skips?from&to`,
  `PUT /api/train/skips` (upsert `{date, kind, dayOfWeek?, time?, sessionKey?, reasonCategory, reasonText?}`
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

## 9. Spec delta — S2 (2026-09-29, `mezo-q4xt2.2`)

Brainstorm 2026-09-29 (recon: researcher + investigator). Owner answers in bold.

### 9.1 Decisions
1. **Entry points: the skip sheet + a "Nem vagyok jól" entry on the Nap hub** (owner: "B").
   - Skip sheet: picking a serious chip (`ILLNESS, STOMACH, INJURY, TRAVEL`) reveals one more
     row, *Csak ma · 2–3 nap · Kb. egy hét · Nem tudom*. Tapping one opens the period.
     Leaving it untapped keeps S1 behaviour (a plain excused skip, no period).
   - Nap hub: a quiet "Nem vagyok jól" entry opens a glass sheet with the 4 serious chips plus
     the duration row. This works on a rest day with nothing to skip.
   - A retro serious skip (`date < today`) may open a period too; its start = the skip date.
2. **Duration → `expected_end`:** Csak ma = start; 2–3 nap = start+2; Kb. egy hét = start+6;
   Nem tudom = null. The estimate only drives copy. The period never ends on its own (§2.4).
3. **While a period is active** (start ≤ date, not ended), every planned gym day, sport slot
   occurrence and prescribed run on a date inside it reads as **skipped, source `RECOVERY`,
   excused** (never missed, outside the free-pass race, streak-bridged). It is
   open-ended forward: dates up to today and the rest of the visible window are covered
   until the period ends.
4. **"Ma mégis edzek"** (owner: "A") on a recovery-skipped occurrence **releases that one
   date** (gym + sport + run of that day) without ending the period. It is undoable.
5. **Daily card "Hogy vagy?"** on the Nap hub, next to `NapzarasCard`, while a period is active:
   *Jobban / Még nem*.
   - "Még nem" hides the card for today (stored as `last_check_date`).
   - Once `expected_end < today`, the copy changes ("A becsült idő letelt — hogy vagy?"),
     with the same buttons.
   - The card also carries the entry to end the period by mistake ("Tévedés volt").
6. **"Jobban" ends the period** with `ended_on = today` (the first day back). Days out
   `d = ended_on − start_date`.
   - **Programme rule (code, pure `RecoveryReturnPolicy`):**
     - `d ≤ 2` → CONTINUE (no calendar change).
     - `3 ≤ d ≤ 9` → RESUME: shift the active meso's `startDate`/`endDate` forward by whole
       weeks so that `weekOf(today) == weekOf(start_date)` (the interrupted week is replayed).
     - `d ≥ 10` → STEP_BACK: the same shift so that `weekOf(today) == max(1, weekOf(start_date) − 1)`.
       Each muscle's `currentSets` reverts to its value for that week (from the volume log's
       rollover provenance), and `volumeRecompute.lastRun` is reset to that week. If the history
       is missing, sets stay and the comeback ramp carries it.
     - Whole-week shifts keep the weekday template aligned with `MesoWeeks` buckets. The
       applied shift (days, previous start/end, previous sets) is stored on the period row, so
       undo is exact.
     - Running blocks keep their calendar (out of scope). No active meso → no programme change.
   - **Comeback ramp** (owner: "A", automatic): the first **1** (`d ≤ 2`) or **2** (`d ≥ 3`)
     gym sessions *completed after* `ended_on` are lightened, i.e. the ramp is counted by
     sessions, not dates. Lightened = per exercise `sets − ceil(sets/3)` (min 1), `holdOnly`
     (no load increase), RIR target never below 3. The first prescribed run after `ended_on`
     shows half duration at an easy effort (display-level note on the run card). The ramp is
     computed at read time in `getToday` from the period row. It writes no
     `workout_day_adjustment` rows, so it never collides with the advice "lighten tomorrow".
   - **"Kikapcsolom a könnyítést"** sets `comeback_waived`. The hero shows a
     "Visszatérő edzés · 1/2" pill with that action.
7. **Undo:**
   - "Jobban" can be withdrawn the same day ("Mégsem vagyok jól"): the period reopens and the
     programme shift is reverted.
   - "Tévedés volt" soft-deletes the whole period, reverting any shift. Occurrences return to
     their S1 state (their own `planned_skip` rows stay).
   - One active period at a time: a new serious reason while active only updates the category
     and the estimate.
8. **Coach tone:**
   - `ContextSnapshotAssembler.trainBlock` gets a line "Kímélő mód aktív: <kategória>, <n>. nap,
     becslés: …" (or "Visszatérés: <k>/<N> könnyített edzés"). Never in the cached
     `stableSystemPrompt`.
   - `FlagEvaluator` silences the training-pressure rules while active (MissedWorkouts,
     MomentumAtRisk, JointOveruse, IgnoredNudge) with a new `UnavailableReason.RECOVERY_MODE`.
   - **S1 gap fixed here:** `MomentumAtRiskRule.missedPlannedGymDays` becomes skip-aware
     (excused dates are not missed).
9. **Surfaces:**
   - Edzés Mai: the gym hero shows a `SkippedBlock` variant "Kímélő mód · <n>. nap" with
     *Ma mégis edzek*, *Jobban vagyok*. Sport/run cards are muted "Kímélő mód".
   - Heti: period days muted with the recovery mark.
   - Nap hub: the Hogy vagy? card + the entry.
   - The Nap timeline, orb, notifications and Fuel week keep hiding skipped occurrences (S1 rule).
   - **Meals are untouched (S3).**
10. **Icons:** reuse `t-ill`, `t-digestion`, `t-pain`, `t-travel` for the categories and `t-skip`.
    A "kímélő" mark (a sheltering leaf/shield) is decided at the prototype. If it is new, it goes
    on the "Új ikonok" sheet.

### 9.2 Architecture
- **Table `recovery_period`** (train, Liquibase `1.1.0`):
  - columns: `id, created_by, is_deleted, created_at, updated_at, category (CHECK serious 4),
    start_date, expected_end null, ended_on null, last_check_date null, comeback_waived bool,
    shift_days int default 0, prev_start/prev_end date null, prev_sets jsonb null, shift_meso_id uuid null`;
  - partial unique index `idx_recovery_period_one_open` on `(created_by) where is_deleted = false
    and ended_on is null`.
- **Table `recovery_day_release`** `(id, created_by, is_deleted, …, period_id, date)`, unique
  per `(period_id, date) where not deleted`: the "Ma mégis edzek" rows.
- **`RecoveryPeriodService`** (train/service, depends only on its repositories, so both
  `PlannedSkipService` and `SportSlotSkipService` can inject it without a cycle):
  - `protectedDates(user, from, to)`: period days minus released days;
  - `active(user)`, `open`, `update`, `checkIn(NOT_YET)`, `better`, `undoBetter`, `discard`,
    `release(date)`, `unrelease(date)`, `waiveComeback`;
  - writes take `PlannedSkipLock`.
- **Central read extended, not duplicated (S1 lesson 1):**
  - `PlannedSkipService.verdictsBetween` adds virtual RECOVERY verdicts for protected dates.
    GYM: one per protected date with a planned template. SPORT/RUN: the `isSportSkipped` /
    `runSkipsOf` / `isGymSkipped` helpers also answer `true` on protected dates.
  - `SportSlotSkipService.isSkipped/skipsBetween` consult `protectedDates`. The exact-key
    `contains(SkipKey)` sites in `WorkoutWindowQueryService` switch to a date-aware predicate
    so a whole protected date matches.
  - `bridgedWeeks` covers weeks whose planned sessions were all protected.
- **Programme shift + ramp:**
  - `RecoveryReturnPolicy` (pure, unit-tested) decides CONTINUE/RESUME/STEP_BACK plus the
    ramp size.
  - `RecoveryReturnService` applies/reverts the meso shift (the only writer of meso dates
    outside `stampRun`).
  - `WorkoutService.getToday` applies the ramp (sets, `holdOnly`, RIR floor) when today's gym
    is within the ramp.
- **API** (fragment `api/feature/train/train-recovery.yml`):
  - `GET /api/train/recovery` (active or last-ended-today period + ramp state);
  - `PUT /api/train/recovery` (open/update `{category, estimate, startDate?}`);
  - `POST /api/train/recovery/check-in` `{answer: BETTER|NOT_YET}`;
  - `POST /api/train/recovery/undo-better`;
  - `DELETE /api/train/recovery` (Tévedés volt);
  - `PUT|DELETE /api/train/recovery/releases/{date}`;
  - `POST /api/train/recovery/waive-comeback`.
  - `PlannedSkipResponse.source` gains `RECOVERY`. Virtual rows carry no id, so the FE never
    calls `DELETE /skips/{id}` for them.
- **FE:**
  - `data/train/recoveryHooks.ts` (dual-mode, `useDualQuery`, mock cache; invalidations copy
    `skipHooks.invalidateAfterWrite` + the meso/today queries);
  - `plannedSkips.ts` learns protected dates; `skipWindow` extends to the period;
  - `SkipReasonSheet` gets the duration row;
  - `features/today/components/KimeloCard.tsx` + `NemVagyokJolSheet`;
  - `SkippedBlock` gets the recovery variant.
- Not switch-gated (plain CRUD like S1). No LLM.

### 9.3 Out of S2
Meals and kcal guidance (S3); the Egyéb classifier, the fever/chest safety question, memory
episodes and the "nincs kedvem" nudge (S4); running-block calendar shift; asking the comeback
pace (automatic by owner decision).

### 9.4 Prior art (S2-specific, researcher 2026-09-29)
- **Oura Rest Mode:** https://support.ouraring.com/hc/en-us/articles/360057065433-Rest-Mode
  - *Adopted:* the day view is kept, with the mode shown on it; a daily "still apply?" card;
    manual end only; goals ramp back gradually.
  - *Not adopted:* ramp length = mode length (capped 7 days), replaced by a session count.
- **Runna "Not feeling 100%":** https://support.runna.com/en/articles/12809806-feeling-unwell-how-to-adapt-your-training-plan
  - *Adopted:* when the window ends it asks and never snaps back.
  - *Rejected (owner, 9.1.6):* choosing a comeback pace.
- **Runna plan realignment:** https://support.runna.com/en/articles/10026375-how-to-use-the-plan-realignment-feature
  - *Adopted:* extend the end date when there is no fixed deadline; it is ours by default,
    because a meso has no race.
  - *Rejected:* their "can't be undone" warning; ours is reversible.
- **RP sick/return guidance:** https://rpstrength.com/blogs/articles/gym-return-guide
  - *Adopted:* ≈⅓ fewer sets and a higher RIR for the lightened sessions; step back or restart
    after mid-meso illness.
- **Runna return after illness:** https://support.runna.com/en/articles/6846127-returning-to-running-after-illness
  - *Adopted:* the first run is about half duration at an easy effort.
  - *Rejected:* the full 4-stage ladder, too long for 1–2 sessions.
- Not found: Whoop, TrainerRoad and Apple UI details (only marketing copy).

### 9.5 Codebase terrain (investigator 2026-09-29)
- Central read: `PlannedSkipService.verdictsBetween:126`, `PlannedSkipPolicy.judge:99`
  (`Row.adviceBacked` = precedent for an always-excused source), helpers `excusedDates:179`,
  `isGymSkipped:231`, `runSkipsOf:215`, `bridgedWeeks:238` (already used by the streak, so the
  train.md "unused" note is stale).
- **Bypass:** `SportSlotSkipService.isSkipped:52/skipsBetween:66` read the repository directly
  (cycle), and feed `AnchorResolver:205`, `PlanFeasibilityCalculator:134`, `TrainTools:416`,
  `ContextSnapshotAssembler:424`, `WorkoutWindowQueryService:239`. The exact-key matching at
  `WorkoutWindowQueryService:239,453,523` needs a date-aware predicate.
- Meso calendar: weekday-keyed template (`WorkoutService:458`) plus `MesoWeeks.weekOf`
  (`(days/7)+1`, clamped). Dates are written only in `TrainService.stampRun:222`; no
  pause/shift concept exists. Volume rollover `VolumeProgressionService.rolloverIfDue:123` is
  idempotent on `lastRun`. `ContextSnapshotAssembler:303` duplicates the week math.
- `workout_day_adjustment` has only `set_delta −3..0`, no API, and its only writer is the
  advice `LightenTomorrowAdapter` (a collision risk), so the ramp is computed at read time
  instead. Load lever: `SetRecommendationService.prescribe(..., holdOnly)`.
- Tone: `ContextSnapshotAssembler.render:153`/`trainBlock:294`, not `ChatService.stableSystemPrompt:486`
  (cached). Flags: `FlagEvaluator:79-103`. **`MomentumAtRiskRule:90-108` is not skip-aware**
  (an S1 gap).
- Nap host: `NapHubPage.tsx:62` (`NapzarasCard` slot). Precedent: readiness GET/POST/DELETE,
  but use `PlannedSkipLock` (readiness has a double-tap 500).
- Traps: ArchUnit (the period lives in train); `ResetDatabase:50-52`; `idx_` index prefix;
  contract regen widens `PlannedSkip.source`; the FE `skipWindow` must stretch to the period.

## Slice lessons

(appended by each slice session)

### S1 (2026-09-29, `mezo-q4xt2.1`)

1. **The central read is `PlannedSkipService.verdictsBetween`** (train). It unions `planned_skip`
   with the legacy advice table `sport_slot_skip`; a USER SPORT row wins over its ADVICE twin and
   is judged `adviceBacked` (excused, no free pass, out of the pass race). S2's protected ranges
   and S3's `MEAL` extend this one method — never add a second "is it skipped?" read.
2. **Verdicts are read-time and need whole ISO weeks.** `verdictsBetween` widens to Mon–Sun before
   `PlannedSkipPolicy.judge`; changing a reason never touches `created_at`, so it cannot move the
   free pass. The FE `judge()` in `plannedSkips.ts` is a mock-only mirror of the Java policy.
3. **"Planned gym" has more consumers than `findPlannedTemplateForDate` callers.** Switching to
   `findPlannedTemplateForDateUnlessSkipped` was not enough: `AnchorResolver` (generic "Edzés"
   anchor from a bare gym slot) and `WorkoutWindowQueryService` (gym + run windows that feed Fuel
   meal scoring and the meal coach) needed their own checks, as did the companion day lines for
   runs. `getToday` stays skip-blind on purpose (undo needs it).
4. **Counting consumers:** streak bridges a week with ≥1 excused skip; commitment and the
   missed-workouts flag drop excused days (a trained day beats a skip); meso adherence subtracts
   only excused skips that fall on a non-empty template day, and `completionPct` stays uncapped.
5. **FE:** one query (`usePlannedSkips`, window today−7…Sunday) feeds `useTrain().plannedSkips`;
   `deriveBlocks` covers the Nap timeline, stack, notifications and their writer; `todayHooks`,
   `useDayOrbFill`, `recapHooks`, `fuelWeekHooks` have their own gym/run logic and were patched
   individually. Shared query keys live in `data/train/queryKeys.ts` (breaks a hooks cycle).
   Real-mode skip writes invalidate week workouts, streak/progression, meso report, quests and
   the Fuel day.
6. **New sprite icons go into `docs/design_2.0/assets/titanium-custom.svg` + the generator** — a
   guard test rejects hand-pasting into the generated sprite outputs.
7. **Living prototypes are shared by parallel sessions.** The Edzés artifact was republished by
   another slice after ours; always `read` before publishing and merge, never overwrite.
8. Backend ITs: the fixed local DB had a drifted changeset; run every IT with
   `-Dmezo.test.use-testcontainers=true`.
