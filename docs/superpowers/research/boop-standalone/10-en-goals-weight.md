# 10 — Én (me/profile), goals, weight, body composition, life goals, gamification clutter

## TL;DR

1. **Weight goal is the crown jewel and it is backend-complete**: `goal` row (cut/bulk/maintain + window + target) → `GoalEngineService.evaluate` → persisted `prescription` (segmented kcal/protein/macros per goal-week) + feasibility verdict + soft guards. All maths is server-side Java (EWMA trend, Mifflin/Katch BMR, NEAT, scheduled-EAT, Kalman "learned expenditure"). Boop can consume it with ~0 logic ported.
2. **Weight tracking is thin but correct**: `weight_log` (date, kg, note), EWMA (half-life 10 d) + OLS weekly rate + `dataSufficiency`, served at `GET /api/biometrics/weight/trend`. Prod: 40 rows / 40 distinct days, 2026-08-24 → 11-09 (+1 row of the 2nd account). Manual entry only: **HealthKit body mass / body fat is NOT read by iOS** (`HealthKitReader` reads sleep, steps, active energy, ... no body types). "Body composition" = one nullable `body_fat_pct` on the profile; no history.
3. **Goal ↔ meals is wired and real**: the active goal's segment becomes the day's kcal/macro target (`DayTargetProjector`), Fuel meal scoring and the meal-coach prompt (`MealCoachContextReader`/`MealCoachPrompt`) use it; the companion `get_goal` tool exposes it to chat. **Goal ↔ training is wired weakly**: gym/sport/running EAT feeds TDEE; mesocycle/running-block links (`goal_plan_link`) only add segment boundaries + guards (zero kcal delta by design). No training prescription flows back from the goal.
4. **No "pre-calibrated diet plan" concept exists** (allowed-recipes-for-4-weeks, several plans, plan rules in chat). `DietSettings` is only macro split/protein tier/preferences. Core item 3's plan bundle is **missing**, not just unfinished. (Other mappers own meal/train; verified none in my area.)
5. **Learned expenditure** (Kalman 3-state) + weekly adaptive suggestions are sophisticated, running in prod (8 `expenditure_estimate` rows). Keep the engine; the web UI around it (Hogy tanultam, week cards, day marks) is surface a Boop could shrink to one weekly sentence.
6. **Clutter verdicts — DROP for standalone Boop**: gamification (XP/levels/coins/titles/perks/skills), daily quests, achievements/badges, growth hub, life-goals (PERMAH pillars/signals/ha-akkor) as a *product*, tutorial ("kalauz"), screen telemetry UI, 23-category web-push catalog. Evidence: 194/238 quests expired, 37 completed; `/me/growth*`, `/nap/kuldetesek` ≈ 2 views each in 2 months; `owned_title` 0 rows; level-up events 304 for one user.
7. **Entanglement warning**: progression/quest/gamification are called from train, needs, habit, activity, lifegoal, proactive, companion, character. Dropping them is a *Boop-API-surface* decision (don't expose), not a backend deletion — ripping them out of the monolith is a separate, risky refactor.
8. **KEEP / needed**: profile (sex, height, birthdate, body fat, activity level), weight log + trend, active weight goal + overview + feasibility preview, medication (feeds meal-coach prompt; 0 rows in prod though), notification **concept** (but Web Push only — no APNs anywhere), auth (JWT login/register/invite exists, iOS already uses it), language switch.
9. **Én page minimal needs** (Boop): identity/account, weight (log + trend + goal progress/ETA), goal (target, pace, today's kcal/protein), body profile edit, sleep target anchors, notification prefs, sign-out. Everything else on today's Én hub is optional.
10. **Biggest risks**: (a) goal engine has hidden dependencies on Train (WeeklyScheduledActivityService, OneRepMax) and Sleep — a "clean" Boop that drops Train still needs EAT inputs from somewhere (HealthKit active energy could replace it); (b) FE-only logic (weight ETA, period/week grouping, moving average, plan tolerance band) must be re-done in Swift or moved to a Boop endpoint; (c) no APNs; (d) body-composition data (smart scale) not collected.

---

## 1. Scope

Covered (read code, not only docs): backend `feature/goal` (incl. `engine/`), `biometrics/{weight,profile}`, `lifegoal`, `progression`, `gamification`, `quest`, `medication`, `people`, `notification`, `appnotification`, `auth`, `telemetry`, `tutorial`, `character` (sizing + role only; deep audit belongs to the AI/konzílium mapper), plus `nutrition`/`meal` readers of the goal. Frontend `features/{me,settings,progression,character,tutorial,notification,admin}`, `data/me/weightHooks.ts`, router (`app/router.tsx`). iOS `ios/Boop` + `ios/BoopKit` for what already exists. Docs: `goal-engine.md`, `me.md`, `settings.md`, `growth.md`, `lifegoal.md`, `_platform-notifications.md`, `character.md`, `tutorial.md`. Prod DB: row counts, date ranges, status shapes only (no values copied).

Controllers implement OpenAPI-generated interfaces, so the endpoint inventory below comes from `api/feature/<x>/*.yml` (the source of truth), not `@RequestMapping`.

## 2. What exists

### 2.1 Weight & body (biometrics)

| Thing | Where | Notes |
|---|---|---|
| `weight_log` (id, date, `weight_kg` numeric(5,2), note≤500, soft delete) | `feature/biometrics/weight/entity/WeightLogEntity.java` | multiple weigh-ins per day allowed (collapsed to daily mean by trend) |
| `GET/POST /api/biometrics/weight`, `GET /api/biometrics/weight/trend` | `api/feature/weight/weight.yml`; `WeightLogService.log` | **no PUT/DELETE** — a wrong entry cannot be edited or removed via API |
| `WeightTrendService.computeTrend` | `biometrics/weight/service/WeightTrendService.java` | EWMA, α = 1−0.5^(1/10); OLS weekly rate (whole window + trailing 28 d); `%BW/week`; `dataSufficiency` none/provisional/full (full = span ≥21 d AND ≥4 logs/week). Exposed also via `techcore.query.WeightTrendQuery` (used by `BoopDayAssembler` for the morning brief) |
| Side effects of a weigh-in | `WeightLogService.log` | recomputes the active goal in-transaction; publishes `WeightLogSavedEvent` → companion "weight_reaction" message (+ push category `weight_reaction`) |
| `biometric_profile` (sex M/F, `height_cm`, `birth_date`, `body_fat_pct`, `activity_level` DESK/MIXED/PHYSICAL) | `biometrics/profile/entity/BiometricProfileEntity.java`; `GET/PUT /api/biometrics/profile` | one row per owner; GET never 404s (empty profile). Upsert recomputes the active goal. Returns `tdeeBootstrap` too |
| Body composition | only `body_fat_pct` | **single scalar, no history, no lean mass, no scale import**. Prod: 2 profile rows, `body_fat_pct` filled in 1/2, `activity_level` filled 1/2 |
| Weight-adjacent: `check_in`, sleep anchors/goal | `biometrics/checkin`, `biometrics/sleep` | other mappers |

iOS today: onboarding collects profile + first weight (`ios/BoopKit/Sources/BoopCore/OnboardingModel.swift`, `ios/Boop/Onboarding/{ProfileStep,WeightStep,RulerDial}.swift`) then calls `onboarding-complete`. Morning brief carries `weight {kg, trendKg}` (`Brief.swift:64`). The Én tab is a placeholder (`WebOnlyTabView` with `.en` + `EnAccountSection` = name/email/sign-out).

### 2.2 The weight goal ("Cél") and the goal engine

Entity `goal` (`feature/goal/entity/GoalEntity.java`): `title`, `trajectory` cut|bulk|maintain, `guards` text[] (strength|muscle), `status` planned|active|archived (single active per owner, enforced in `GoalService.activateGoal`), `start_date`, `target_date`, `start_weight_kg`, `target_weight_kg` (null for maintain), `rate_target_pct_per_week` (server-derived, never client input), `identity_frame`, Fuel day-planner fields (`meals_per_day` 3–6, `wake_time`, `bed_time`), engine outputs `tdee_bootstrap` + `prescription` (jsonb), `segment_overrides` (accepted deload→maintenance weeks), `balance_adjustment_kcal` (accepted adaptive corrections).

Sibling tables: `goal_plan_link` (goal ↔ mesocycle | running_block over goal-weeks `start_week..end_week`), `goal_suggestion` (+ payload/fingerprint), `expenditure_estimate` (weekly learned-base rows + `explanation` jsonb), `intake_day_mark` (day excluded from learning).

Endpoints (`api/feature/goal/goal.yml`): `GET/POST /api/goals`; `GET/PUT/DELETE /api/goals/{id}`; `POST …/activate`, `…/archive`, `…/evaluate`; `GET …/overview` (the one state-led read model the web hub renders); `GET …/timeline`; `POST …/plans`, `DELETE …/plans/{linkId}`; `GET …/suggestions`, `…/suggestions/{id}/preview`, `…/accept`, `…/dismiss`; `POST /api/goals/feasibility-preview` (stateless wizard check, suggests a realistic date); `GET /api/goals/expenditure/{explanation|weeks|weekly-card|days}`, `POST …/weekly-card/{weekStart}/dismiss`, `PUT/DELETE …/days/{date}/mark`.

Engine services (all `feature/goal/engine/service/`): `GoalEngineService` (orchestrator, only transactional link), `TdeeBootstrapService` (Katch-McArdle if body fat known else Mifflin-St Jeor; `TDEE = BMR×NEAT + weekly scheduled EAT`), `GoalProjectionService` (433 loc; week-by-week segments), `GoalEvaluationService` (feasibility + protein + prescription assembly), `GoalFeasibilityService` (rate bands, date suggestion), `GuardEvaluationService` (strength e1RM trend, per-muscle weekly sets, rate-cap; WARN only), `ExpenditureLearningService` + `ExpenditureFilter` (3-state Kalman: tissue, water, base kcal) + `IntakeDayClassifier`/`ExpenditureStepPolicy`/`LearnedBaseResolver`/`ExpenditureExplainer`, `AdaptiveReviewJob`/`AdaptiveReviewService`/`AdaptiveCorrectionService` (Monday weekly job), `GoalPrescriptionCalculator`. `GoalInvariantValidator` (cut: target<start, bulk: target>start, maintain: no target, ≥7-day window). Config `mezo.goal.*` in `GoalEngineProperties`.

Recompute triggers (per `goal-engine.md` §3, all same-transaction, graceful on missing profile): goal activated, plan attached/detached, weigh-in logged, biometric profile changed, diet settings saved (+ others added later: sleep target, learning switch).

Notifications from goal: `GoalSuggestionNotificationListener` (kind `goal_suggestion`), `ExpenditureWeekNotificationListener` (`expenditure_week`).

Consumers outside the goal package (the "linked" web): `nutrition/service/DayTargetProjector.java` (segment → day kcal/macros incl. BMR floor, kímélő-mód clamp), `meal/service/FuelDayService.java`, `meal/service/MealCoachContextReader.java` (+`MealCoachPrompt`: body, goal trajectory + guards, weight as of the meal day, sleep, medication, check-ins), `proactive/service/{PlanFeasibilityCalculator,SetupCheckService,AdviceActionCatalog,WeightDecompositionInputsAssembler,FeedEvidenceAssembler}`, `companion/tools/GoalTools.java` (`get_goal`, scopes progress|recept|timeline|guards|feasibility), `companion/flags/.../RapidWeightLossRule`, `LateEatingRule`, `quest/QuestSelector` (adaptive banding), `lifegoal/engine/WeightGoalSignalSource`, `character/CharacterSignalReads`, `pantry` (goal read).

Web screens: `/me/goals/weight` (`GoalsPage`: `GoalCourseHero` + mosaic), `/diet`, `/segment`, `/plans`, `/guards`, `/suggestions/:id`, `/new` (`GoalPlannerPage` wizard), `/settings/me/goal` (`GoalSettingsPage`, `GoalSettingsEditor`), `/fuel/tanulas` (Hogy tanultam).

### 2.3 Én hub and Me area (web)

`/me` `EnHubPage` = identity strip (name, title chip, Lv/XP/streak/coin) → week hero → Életvonal (12-week weight curve + sleep band) → Célok állása → tiles Fejlődés + Emberek. Tabs: Hol tartok (`/me`, owns `/me/week`, `/me/growth`, `/me/people`, `/me/ertesitesek`), Test (`/me/weight` + `/me/sleep`), Célok (`/me/goals`), Napló (`/me/naplo`). 88 page files under `features/me/pages`, 178 src files / 16.8k loc / 146 test files in `features/me`.

Pages in `features/me/pages`: `WeightPage` (hero, stat strip, 7d/30d/90d/1y chips, trend chart with plan line ±1 kg band, weekly cards), `SleepPage`/`NightPage`, `Week*` (hub, analysis, days, lessons, discoveries), `Growth*` (hub, skills, journal, awards), `People*` (hub, jelöltek, kör, emlékek, heti, person detail), `Celok/Cel/CelWizard/Jelek` (life goals), `Goal*` (weight goal pages above), `Habit*/Rutin*/Chain*/Szokasaid` (routine — Nap domain now), `Journal`, `NotificationFeed`, `Notifications` (prefs), `Beallitasok`.

### 2.4 Settings (web)

`features/settings` (10 files, 358 loc — tiny; most editors live elsewhere): routes `/settings` (hub), `/settings/{general,notifications,account}`, `/settings/me` (+`/biometrics`, `/sleep`, `/goal`), `/settings/train` (+`/gym`, `/sport`), `/settings/fuel` (+`/slots`), `/settings/nap`, `/settings/mezo` (+`/about`, `/communication`, `/context` — the personal-context text the AI reads). Account page: change password, language (hu/en, `PUT /api/auth/me/language`).

### 2.5 Auth / account (`feature/auth`, `api/feature/auth`)

`POST /api/auth/{login,register,change-password,onboarding-complete}`, `GET/PUT /api/auth/me`, `PUT /api/auth/me/language`. `app_user`: email, password_hash, name, role OWNER/USER, status ACTIVE/DISABLED, `timezone` (stored, "not yet consulted by today logic"), `language` hu|en, `onboarded_at`, `must_change_password`, `last_seen_at`, `tokens_valid_from` (revocation watermark). Invite-gated registration (`invite` table, `InviteService`, `AdminController`: invites, users, reset-password, status). Prod: 2 users, 1 invite. `PromptPersona`/`PersonaContext`/`UserLanguage` inject name/language into AI prompts. Admin FE: 47 files / 6.7k loc (accounts, users, cost, features, memory, data) — owner-only tooling.

### 2.6 Life goals (`feature/lifegoal`, 3.1k loc backend, 21 tests)

PERMAH-tagged goals measured by 1–5 "pillars" from a closed **32-entry signal catalog** (`catalog/SignalCatalog.java`: sleep, kcal/protein/water, gym volume, ACWR, check-ins, habits, ritual, daily XP, activity categories, social mentions, rings, plus a `weight_goal` pseudo-signal). `LifeGoalScorer` + 5 `SignalSource` adapters, nightly `LifeGoalEvalJob`, ha–akkor (if–then) triggers (`LifeGoalTriggerService/Rules`), AI-propose (`LifeGoalProposeService`, `LifeGoalTemplateProposer`), pillar-hit XP (`LifeGoalXpService` → progression), chat/morning prompt block + `get_life_goals` tool. Endpoints: `/api/life-goals{,/signals,/propose,/today,/{id},/{id}/status,/{id}/pillars,/{id}/progress,/{id}/evaluate}`. **Prod: 1 life goal, 4 pillars (created once, 2026-09-04).** Web: `/me/goals` (Célok hub), `/me/goals/:id`, `/me/goals/new`, `/me/goals/signals`.

### 2.7 Gamification / progression / quests / growth (the clutter cluster)

- `feature/progression` (1.6k loc, 20 tests): `ProgressionService` (585 loc) XP engine over skills (BODY/FUELBIO/LIFE bands), `skill_progress`, `level_up_event`, `perk_unlock`, `PerkCatalog`, `TraitCalculator` (discipline %, consistency weeks), `AchievementService` (badges), `GrowthWeekService`. Endpoints `GET /api/progression/{profile,growth-week/{date},achievements}`. Prod: `skill_progress` 32, `perk_unlock` 2, `level_up_event` 304.
- `feature/gamification` (868 loc, 7 tests): account level curve, **coins**, titles shop (`buy/equip`), "streak saver". `GET /api/gamification/{profile,day/{date}}`, `POST …/title/{key}/{buy|equip}`, `…/saver/buy`. Prod: `coin_event` 86, `owned_title` **0**, 1 profile.
- `feature/quest` (1.1k loc, 10 tests): 3 daily slots (BODY+FUELBIO+GROWTH), `QuestSelector` (deterministic catalog), `QuestJob`, `QuestFlavor` (AI copy), reroll. `GET /api/quest/day/{date}`, `POST …/{id}/reroll`, `GET …/history`. Prod `daily_quest`: 238 rows → **completed 37, expired 194, offered 6, rerolled 1**.
- `feature/activity` (not in my list but part of Growth): free-text activity log, AI-categorised to LIFE skills.
- Web: `features/progression` (LevelUpProvider/Screen toasts), `/me/growth{,/skillek,/naplo,/kituntetesek}`, `/nap/kuldetesek`, Én identity strip chips. ADR 0010 governs the philosophy ("XP is feedback, not payment").

### 2.8 Medication (`feature/medication`, 703 loc, 4 tests)

`medication` (name, active_ingredient, route, cadence, default dose/unit, cycle jsonb, active) + `medication_dose`; `POST/GET /api/medication`, `PUT /{id}`, `POST /{id}/dose`, `DELETE /{id}/dose/{doseId}`. Feeds `MealCoachContextReader.medicationLabel` and push category `medication`. **Prod: 0 rows in both tables** — never used. No dedicated web page found under `features/me` (surfaced elsewhere/seed).

### 2.9 People (`feature/people`, 2.1k loc, 11 tests)

`person`, `mention`, `person_fact` (AI-extracted facts with candidate/accept/undo), mention detection from journal/reflection text (`MentionDetectionService`, listeners), affect trend per person (`PersonAffectTrendCalculator`), graph-edge/mezo-note sources. `/api/people{,/facts,/{id}/mentions,/{id}/facts/{factId},/{id}/facts/seen,/{id}/decision}`. Prod: 11 persons, 34 mentions, 11 facts (all created 2026-09-08…10-01, nothing since). Relevance to core item 7 (social-battery scoring): this is the only structured "who is in my life" data; the calendar scorer could reuse names, but it is not required.

### 2.10 Notifications (`feature/notification`, `feature/appnotification`)

- **Push**: **Web Push only** (`PushSender`, `push_subscription` = browser endpoints, VAPID). `grep -i apns` over backend/ios/docs: zero hits. `NotificationCategory` enum: **23 categories** (briefing, gym, medication, ritual, lights_out, memoir, weekly_review, wind_down, midday, checkin, fuel_slot, evening, sleep_reaction, weight_reaction, pattern, knowledge, prediction, experiment, challenge, memory, decision_review, intervention, …) resolved by a 707-loc `AnchorResolver` + `NotificationDispatchJob`/`DueEvaluator`; per-user `notification_pref`, `notification_schedule`, `push_log`. Prod: 6 subscriptions, 5 pref rows, **1,924 push_log rows**.
- **In-app feed**: `AppNotificationKind` (~25 kinds incl. goal_suggestion, expenditure_week, life_goal_plan, habit_formation, team_edition…), `app_notification` (455 rows). Deeplinks are **web paths** (`/me/goals/weight/suggestions`, `/insights/...`) — useless to an iOS client as-is.
- Endpoints: `POST/DELETE /api/notification/subscription`, `POST /test`, `GET/PUT /pref`, `GET /feed`, `POST /feed/read-all`, `POST /feed/{id}/read`, `PUT /schedule`.

### 2.11 Telemetry & tutorial

- `telemetry`: `POST /api/telemetry/screen-events` (batch cap, per-user token bucket, clamp), `screen_event` table (**3,484 rows**, 1 user, 2026-09-08 → today), retention job. Feeds admin usage views. Useful precedent for "what does the owner actually open".
- `tutorial`: per-route 5-card "kalauz" sheets; `tutorial_progress` jsonb per user (`GET/PUT/DELETE /api/tutorial/progress`). Prod: 1 row. FE `features/tutorial` 1.7k loc, backend 203 loc, 2 tests.

### 2.12 Character / konzílium (sizing only — not audited here)

`feature/character` is **21k loc, 95 test files** (largest feature outside train/meal): team of 5 named characters (Alvás/Mozgás/Étkezés/Közérzet/Mezo), dossier/claims/revisions, weekly "konzílium" conferences (core item 9), team wall editions (`TeamEditionService`, `EditionCandidateCollector` 505 loc), team chat with ügy/flags/apply-actions (`/api/character/team-chat*`), bootstrap, council, maturity history. FE `features/character` 3.8k loc + big `/mezo/*` tree. This is both the core-9 asset and the largest "persona clutter" candidate; see the AI mapper's report for the verdict. From my area's point of view: the **personas (names, voices, wall, editions)** are presentation; the **cross-examination run** is the asset.

## 3. How it works (main flows)

**Weight in → goal out.** User (web `WeightLogSheet` / iOS `WeightStep`) `POST /api/biometrics/weight` → row saved → `GoalEngineService.recomputeActiveGoal` re-runs `evaluate` for the single active goal in the same transaction → event → companion reaction + optional push. Read paths: `/weight/trend` (EWMA series, latest trend kg, weekly rate, last-4w rate, sufficiency) and `GET /goals/{id}/overview`.

**Engine evaluate** (`GoalEngineService.evaluate`): ownership gate → `GoalInvariantValidator.isCoherent` (incoherent legacy row: clear artefacts, return) → guards (strength e1RM, muscle volume, rate cap) → profile (missing → graceful "profil szükséges" prescription) → weekly scheduled EAT from Train (`WeeklyScheduledActivityService`: gym+sport+running, net activity energy at moderate band ÷ 7) → `TdeeBootstrapService` (BMR×NEAT + EAT; learned base from `expenditure_estimate` replaces BMR×NEAT via `LearnedBaseResolver` when present) → trend → `GoalProjectionService` (walks goal-weeks, splits segments where running on/off or meso phase class changes; kcal = TDEE ± rate×7700/7, rails/BMR floor) → `GoalEvaluationService.assemble` → `goal.prescription` + feasibility verdict + protein target. **Target date and calorie implication**: the owner enters target weight + pace (kg/week); date is derived from the current baseline; `rate_target_pct_per_week = |start−target|/start/weeks` is stored server-side; kcal/day per segment is TDEE minus/plus the implied balance; `feasibility-preview` suggests `start + ceil(weeksAtCap)` if the pace exceeds the cap (bands: warn 0.7–1.0 %BW/wk, cap beyond). Maintain = no target, no ETA.

**Goal → meals.** `DayTargetProjector.project(segment, base, …)` turns the covering segment into `DailyTargets` (kcal, P, C, F, `source="goal"`), clamped by a BMR floor and by kímélő-mód. `FuelDayService.dailyTargets` → 5-arg `MealScoringService.scoreMeal` judges every logged meal's macros against that target; `MealCoachPrompt` writes "NAPI CÉLOK" + remaining budget + a PERSON block (body, goal trajectory + guards, weight-as-of-day, sleep, medication, check-ins) into the AI meal evaluation. So meal evaluation against the weight goal (core item 3, first half) **works today**.

**Goal → training.** Only indirectly: (1) scheduled gym/sport/run EAT raises TDEE → higher kcal budget; (2) `goal_plan_link` ties a mesocycle/running block to goal-weeks → a deload week becomes a segment boundary and a *suggestion* ("make this week maintenance", `MesoLifecycleSuggestionListener`/`GoalSuggestionTriggerService`); (3) strength/muscle guards read workout data and WARN. There is no reverse flow (goal does not generate or adjust a training plan). Core item 5 is therefore half-true: nutrition ↔ weight ↔ training energy are coordinated numerically; sport plans are not authored *from* the goal context.

**Weekly adaptation.** Monday `AdaptiveReviewJob`: per user, `ExpenditureLearningService.reviewWeek` runs first (Kalman learns the real base from logged intake + movement + weight; day classifier drops unlogged/suspicious days; step policy: dead-band 30 kcal, ±150 max, half step on a new direction; rails ±35 %, ≥1.1×BMR; upsert `expenditure_estimate`; supersede open correction suggestion; recompute goal). If the user is not a learner it falls through to the old suggest+accept `weekly_correction`. Bell `expenditure_week` + the "Heti tanulás" card on web.

**Gamification loop (what Boop would NOT want).** Almost every logged thing (workout, sport, run, habit, needs ring, activity entry, quest completion, life-goal pillar hit) publishes a signal → `ProgressionService` awards XP to a skill → level-up events → `GamificationAccountAdapter` pays coins → toasts/ chips on Én. Quests are derived-evaluated offers that expire quietly.

## 4. Quality assessment

**Solid**
- Goal engine: very deep, config-driven, documented, 44 test files in `feature/goal`; invariants enforced server-side with typed field errors; EWMA trend is correct and well-commented; learned-expenditure is a serious, research-backed design and **is live** (8 weekly rows in prod).
- Weight trend/`dataSufficiency` semantic is honest (provisional vs full), reused by brief, goal, lifegoal scorer.
- Meal ↔ goal bridge is real and consistent ("one served-target rule").
- Auth: JWT + revocation watermark + invites + must-change-password; iOS already authenticates against it.

**Half-built / drifting**
- **Dead code acknowledged in docs**: `GoalOverviewService` day-type branch (`trainingDayKcal/restDayKcal` always null since `mezo-tb3s2`); `dayTypeShiftKcal` accepted-but-ignored; `NotificationCategory.WEEKLY` retired but kept; `proteinMonitored` always false; `sleepTargetH` emitted but unconsumed; Profile TDEE card still shows formula base for learners (`mezo-qnsl9`).
- **Weight API gaps**: no update/delete of a weigh-in; no unit/time-of-day; no source tag (manual vs Health); same-day multiples silently averaged.
- **Body composition** effectively absent (scalar only) although `GoalEngine` prefers Katch-McArdle when it is known.
- Prod goal hygiene: 4 goal rows, only 1 live (a cut and a bulk were soft-deleted, one maintain archived, one maintain active since 2026-10-06; the 3 "active" rows by status include deleted ones — the single-active invariant holds among live rows). The owner currently sits on **maintain**, i.e. the cut flow (the thing the engine is best at) has little recent exercise; plan links 3, suggestions 6 (last 2026-09-26), one intake-day mark.
- `timezone` stored but "not yet consulted".
- Notifications: 23-category catalog + 707-loc resolver is heavy for a single user and is **web-push-shaped end to end** (subscription = browser endpoint, deeplinks = web routes, FE-written categories `checkin`/`fuel_slot` computed from FE snapshots).

**Real usage evidence (prod, screen_event, 1 user, 2026-09-08→11-10, views):** `/nap` 429, `/fuel` 422, `/mezo` 172, `/me` 98, `/me/week` 35, `/me/weight` 34, `/settings` 29, **`/me/goals/weight` 28**, `/me/goals` 14, `/me/goals/weight/diet` 8, `/me/people*` ≈ 60 total, `/me/sleep` 12, `/me/naplo` 10, `/settings/me/goal` 4, `/me/growth` **2**, `/me/growth/skillek` **2**, `/nap/kuldetesek` **2**, `/me/goals/signals` 2, `/me/goals/new` (life) ≈ 0, `/me/ertesitesek` 1, `/settings/notifications` 6. The weight goal and weight page are actually used; the entire gamification/quest/growth cluster is essentially unused by its only user, matching 194/238 expired quests.

**Test coverage:** goal 44 test files, lifegoal 21, progression 20, quest 10, gamification 7, people 11, notification 20, appnotification 5, auth 17, telemetry 4, tutorial 2, medication 4, character 95. FE: `features/me` 146 test files. Coverage is not the issue; relevance is.

## 5. Reuse for native iOS

**Call as-is (generated Swift client already in `ios/BoopKit/Sources/BoopAPI/openapi.yaml`, which already contains BiometricProfile, weight, goals):**
- `GET/PUT /api/biometrics/profile`, `GET/POST /api/biometrics/weight`, `GET /api/biometrics/weight/trend`.
- `GET /api/goals` (+ `/{id}/overview` for the status/ETA/today-kcal read model), `POST /api/goals`, `/activate`, `/archive`, `POST /api/goals/feasibility-preview`.
- Auth (`login/register/me/change-password/language/onboarding-complete`).
- `GET/PUT /api/notification/pref` (the preference rows), feed endpoints if the feed is kept.

**Needs a Boop-shaped API (recommended):**
- A **`/api/boop/en` (or `/boop/weight`) read model**: latest weight, trend kg, weekly rate, ETA weeks, goal (kind, start/target, pace), today's target kcal/protein, feasibility verdict, last 12 weeks series — assembled server-side. Today the web client derives `etaWeeks`, `progressPct`, `groupByWeek`, `movingAverage`, plan line + ±1 kg tolerance (`frontend/src/features/me/logic/weightStats.ts`) and per-period stats client-side; the overview endpoint covers the goal side but not the history/plan-line side. `BoopDayAssembler.weight()` already shows the pattern.
- **Weigh-in edit/delete** and a `source` field (`manual|healthkit`) once HealthKit weight lands (needed for dedupe).
- **Push**: APNs registration endpoint + sender (backend sends only Web Push). Category set should shrink to what Boop actually pings (morning brief, evening close, check-in nudge, goal suggestion); deeplinks must become app routes.
- A **goal "wizard" in one call** (profile + target + pace → preview → create+activate) — the web does it across `GoalPlannerPage` + multiple requests.

**Logic that lives only in the web frontend (would need moving or porting):** weight period/week aggregation, ETA, progress %, moving average, plan trajectory band, `buildTdeeBreakdown.ts` (energy breakdown sheet), `goalOverviewCopy`/`goalWeekSentence` (Hungarian copy generation from overview state), `scoreBand`. Everything numeric of consequence (TDEE, projection, feasibility, guards, learning) is already backend.

**Do not expose to Boop:** `/api/progression/*`, `/api/gamification/*`, `/api/quest/*`, `/api/life-goals/*`, `/api/tutorial/*`, `/api/telemetry/*`, admin, people (unless the calendar/social scorer wants names), `/api/character/*` beyond what the AI mapper decides.

## 6. Gaps vs. the owner's core

- **1 (collect every metric from Health):** *missing for my area.* iOS `HealthKitReader` reads sleep, steps, active energy… but **not body mass, body fat %, lean mass, BMI, waist**; weight is manual-only (`WeightStep`, web sheet). To fix: add `bodyMass`/`bodyFatPercentage`/`leanBodyMass` to the reader + backend ingest (`wearable`) + a dedupe/`source` on `weight_log`. Biggest single gap in this area.
- **2 (meals + AI eval, allergen flags):** nothing in my area; confirmed **no allergen/intolerance model** anywhere I touched (grep for lactose/gluten hits only seed/people text). Owned by the meal/pantry mapper.
- **3 (weight goal; meal evaluation vs goal; plans; AI context; long-term effects):** *weight goal + meal evaluation = exists & good.* **Pre-calibrated diet plans (restricted recipe/ingredient sets for N weeks, several plans, plan rules in chat) = missing.** `DietSettings` is split/protein/preferences only. Training/running plans live in Train and attach to the goal as links (works, needs-fixing level: zero-delta mesocycles confuse users, doc admits it). "AI personal trainer + dietitian" chat sees the goal via `get_goal` tool + meal prompt; the active *plan's rules* concept doesn't exist yet. Long-term ingredient/biomarker effects: not in this area (effect tracking belongs to the memory/AI mapper).
- **4 (sport plans/mesocycles/guided logging):** not mine; the goal's guards read that data.
- **5 (sport plans coordinated with meal plan and weight goal):** *exists, partial.* Numerical coordination (EAT → kcal budget, meso phase → segments, deload → maintenance suggestion, strength/muscle guards) is real and tested; no flow where the goal/diet plan *authors or adjusts* the training plan. Needs a deliberate Boop-level "plan bundle" (diet + training + weight goal as one object) on top.
- **6 (sleep):** not mine; note the goal engine only emits `sleepTargetH`, nothing consumes it.
- **7 (calendar AI scoring):** people/mentions are the only reusable piece here; otherwise not mine.
- **8/9 (one AI, konzílium):** `character` = 21k loc asset *and* persona overhead; goal data reaches the AI through `GoalTools`, `LifeGoalCompanionAdapter`, `ContextSnapshotAssembler`. Verdict deferred to the AI mapper; from here: keep the cross-check run, drop the persona theatre (names, wall editions, team-chat ügy mechanics).
- **10/11/12:** check-in/journal/day rating mapped elsewhere. Note the weight goal's one-sentence status and `weight_reaction` message are the natural day-adjust hooks.

### Drop / keep verdicts for a clean standalone Boop

| Feature | Verdict | Why |
|---|---|---|
| Weight log + trend + goal + engine + feasibility + overview | **KEEP (core)** | used (28 views/2 mo), real, backend-only maths |
| Learned expenditure + weekly review | **KEEP the engine, hide the UI** | live in prod; surface as one weekly sentence, not a history page + day marks |
| Goal plan links / segment pages / guards pages / suggestion preview pages | **SIMPLIFY** | keep suggestions as single accept/dismiss card; drop segment rail & plan-lane pages |
| Biometric profile | **KEEP** | engine input; already in iOS onboarding |
| Body-fat history / composition | **ADD** (via HealthKit) | missing today |
| Gamification (XP, levels, coins, titles, streak saver), perks, skills, achievements, growth hub, level-up toasts | **DROP** | unused (owned_title 0, growth pages ~2 views), ADR-0010 itself says XP is garnish |
| Daily quests | **DROP** | 194/238 expired |
| Activity log (free-text → LIFE skill XP) | **DROP** (as XP); the free-text part overlaps journaling (core 10) | |
| Life goals (PERMAH pillars, 32-signal catalog, ha–akkor, nightly eval) | **DROP as a product**; fold "a goal for the day" (core 10) into the day plan | 1 goal ever created; heavy 3.1k loc |
| Tutorial / kalauz | **DROP** | 1 row; a native app onboards once |
| People / emberek / facts | **OPTIONAL** | only if calendar/social-battery scoring (core 7) wants names |
| Medication | **OPTIONAL / defer** | 0 rows; only feeds the meal prompt |
| Screen telemetry | **KEEP server side, trim** | cheap, is how we measured real usage; no UI needed |
| Notification: pref model + feed | **KEEP concept, REBUILD transport** | needs APNs + 4–6 categories, not 23 |
| Admin / invites | **KEEP backend; no iOS UI** | single-owner tooling |
| Character personas/wall/editions | **defer to AI mapper** | |

## 7. Open questions / risks

1. **Goal engine's Train dependency.** `TDEE` needs weekly EAT from `WeeklyScheduledActivityService`; if Boop's Train is rebuilt, either keep this port or switch EAT to HealthKit active energy. Decision needed before any engine refactor.
2. **Do we remove gamification from the backend or just from the Boop surface?** Removal means touching train, needs, habit, activity, lifegoal, proactive, companion, character (the signal ports). Recommend: hide, don't delete, until the web app is retired.
3. **Plan bundle (core 3/5) has no backend home.** Is a "plan" a new aggregate (diet rules + recipe/ingredient whitelist + training + goal) or an extension of `goal`? Biggest design decision in this area; touches meal/pantry/train owners.
4. **Source of truth for weight**: HealthKit body mass vs manual. Needs dedupe policy and an edit/delete API; the EWMA currently averages same-day entries blindly (a scale + a manual entry would skew it).
5. **Active goal is maintain; cut path exercised rarely** → the cut-specific flows (feasibility, guards, adaptive) have had little real use since September; treat their UX as unproven.
6. **Doc/code drift**: `goal-engine.md` still describes dead day-type branches and lists `GoalEngineService.java:83`-style anchors that I did not re-verify line by line; the "single active goal" invariant looks violated by status alone in prod (3 "active" rows) but two are soft-deleted — a delete path (`DELETE /goals/{id}`) that does not also archive is worth a look.
7. **Push infrastructure**: APNs key/cert, device-token table, per-category scheduling — none exists; and notification deeplinks/paths embed the web IA, which the standalone re-plan intends to leave behind.
8. **Hungarian-only copy is generated in FE** for goal state (`goalOverviewCopy`, `goalWeekSentence`); a Swift app needs the same sentences from the server (also needed for the hu/en switch the web now has).
9. **Privacy**: telemetry and `screen_event` store per-screen usage; if Boop is ever multi-user, decide retention and consent (job exists).
