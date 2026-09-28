# Learned expenditure Part 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the weekly summary (dot on Mai → „Heti tanulás” sheet), the „Hogy tanultam?” learning page, day marks with immediate re-chain, the learning switch and the bell notice for learned expenditure (bd `mezo-3n2so`).

**Architecture:** Goal-owned backend: a new `intake_day_mark` table feeds the existing `IntakeDayClassifier`; a re-chain re-runs the weekly step from the marked week forward and recomputes the goal once; the per-user switch lives on `diet_settings` and is read through `DietPreferencesPort` by the resolver (serving) but not by the weekly run (learning continues silently). Five new goal endpoints feed a FE data layer (`useDualQuery`, mock seeds) and four FE surfaces built to the approved prototype.

**Tech Stack:** Spring Boot 3 / JPA / Liquibase / OpenAPI contract-first (`api/feature/*.yml` → generated `GoalApi` + DTOs); React + TanStack Query + Vite, Vitest, Playwright `tests/layout`.

**Spec:** [`docs/superpowers/specs/2026-09-27-learned-expenditure-part2-design.md`](../specs/2026-09-27-learned-expenditure-part2-design.md) (§5 = what the owner sees, §6 = engineering).
**Build target (visual parity reference):** `docs/design_2.0/prototypes/elo/fuel.html` (Artifact https://claude.ai/artifact/EpY5UcqEy9F8sTsboqw43x), owner-approved 2026-09-27 after two rounds. Open it over `python3 -m http.server 8773 --bind 127.0.0.1` from `docs/design_2.0/prototypes` and match it; the prototype's `PROTOTÍPUS` demo rows and side panel are NOT built.

## Global Constraints

- Worktree `/Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/weekly-daily-view-expanded-2cccee`, branch `feat/learned-expenditure-part2`. Absolute paths; never `cd` to the primary repo; no bare `git stash`.
- Commits: conventional subject carrying `(mezo-3n2so)`, trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Backend focused tests: `cd backend && ./mvnw -q test -Dtest=<Class> -Dmezo.test.use-testcontainers=true`. Layer subpackages enforced by `ArchitectureTest`; the cycle store is frozen (no new feature cycle).
- Liquibase: append the changeset at the END of `backend/src/main/resources/db/changelog/1.1.0/1.1.0_master.yml`; never a bare jsonb `?`.
- Contract-first: edit `api/feature/goal/goal.yml` / `api/feature/diet-settings/diet-settings.yml`, then `cd backend && npm run generate:api` (or the repo's documented generate step) and `cd frontend && pnpm generate:api`.
- FE gates: `cd frontend && CI=true pnpm test` AND `CI=true VITE_USE_MOCK=false pnpm test`; `pnpm build`. Unset `VITE_USE_MOCK` = mock.
- FE-facing confidence is lowercase `low|medium|high` (spec §6.5). Hungarian copy exactly as in the prototype.
- Honesty: σ̂ shown next to every learned value; no number for a week without a row; unlogged days take no mark.
- Icons: Titanium sprite symbols only (the prototype uses `t-lens`, `t-hold`, `t-shield`, `t-tick`, `t-ring`, `t-weight`, `t-bowl`, `t-calendar`, `t-steps`, `t-water`, `t-hike`, `t-history`, `t-clock`), rendered through the existing clay `ContentIcon`. No emoji. One accent per glass card; no glass in glass.
- After every merge and before the final push: `node scripts/gen-codemap.mjs`.

## Kész, ha… (done checklist — also in the bd issue acceptance)

**What the owner sees**
- [ ] Mai (today, learning on, un-dismissed worth-saying week): a glowing 8 px dot inside „Miből jön össze?” (sage; amber when holding); dot not tappable; no dot on past days / dismissed / quiet week / learning off.
- [ ] Equation box: Alap row highlighted (tint, ring, dot, „· heti tanulás ›”), whole row ≥ 44 px opens the „Heti tanulás” sheet.
- [ ] Sheet: head + learned line with ±σ̂; step + reason or holding reason; excluded days with „Teljes volt” / „Visszavonom”; live change line after a mark; „Részletek ›” → `/fuel/tanulas`; „Bezárom” dismisses on the server (gone on reload).
- [ ] Bell: one „Heti tanulás: …” item per worth-saying week from the Monday job only → `/fuel/tanulas`.
- [ ] `/fuel/tanulas`: status row (button with dot when a summary exists), week-by-week chart (formula dashed, applied line, ±σ̂ band, gaps, hollow holding markers, tap → week numbers), last 14 days with chips + toggles (none on unlogged), the six explainer sections; empty state and switch-off state as in the prototype; back button.
- [ ] Energy breakdown sheet: one-line summary „Tanult alap · … · ±… kcal” + „Részletek ›” instead of the expandable.
- [ ] Day-log mark line at the bottom of every day's log, all states incl. today's note; „Mit jelent ez?” → `/fuel/tanulas`.
- [ ] Settings „Finomhangolás”: switch „Tanulás a súlyomból és az evésemből” + hint; Mentés then „A keret ±N kcal-lal változott”.
- [ ] 320 px: no horizontal overflow on Mai, sheet, `/fuel/tanulas`, settings. Reduced motion: chart draws final frame, no entrance animation.
- [ ] Every icon from the sprite; no new icon needed (prototype had none).

**Parity**
- [ ] Mai, equation box, breakdown sheet, settings page: every existing control/field still present (reverse parity list in Task 9/10/12 steps); the „Hogy tanultam?” six sections unchanged in content.
- [ ] Learning-off users get the Monday weight-only suggestion again; learning-on behaviour unchanged except marks.

**Gates**
- [ ] Backend focused ITs of Tasks 1–7 green (Testcontainers); `ArchitectureTest` green.
- [ ] FE tests both modes green; `tests/layout` spec for `/fuel/tanulas` at 320 px green; `pnpm build` green.
- [ ] `node scripts/gen-codemap.mjs --check` clean; `node scripts/lint-docs.mjs` 0 errors / 0 stale.

**Docs**
- [ ] `docs/features/goal-engine.md` + `docs/features/fuel.md` updated (Part 2 shipped; stale lines listed in spec §4 fixed); feature index row true; milestone log entry in `docs/milestones/roadmap.md`.

**Shipped**
- [ ] Merged to main, `deploy` workflow green for that commit, new version live on https://46.225.112.172.sslip.io/ (checked in the browser: dot/sheet or its absence is correct for the owner's data, `/fuel/tanulas` renders).
- [ ] Production DB: `diet_settings.learning_enabled` column exists; `intake_day_mark` table exists; `expenditure_estimate.dismissed_at` exists.
- [ ] Living prototype matches production (update + republish if the build deviated); README date updated.

---

## File map

Backend (`backend/src/main/java/io/mrkuhne/mezo/feature/…`):
- Create `goal/entity/IntakeDayMarkEntity.java`, `goal/repository/IntakeDayMarkRepository.java`
- Create `goal/engine/service/WeeklyCardPolicy.java` (pure)
- Create `goal/service/IntakeDayMarkService.java` (mark/clear + re-chain orchestration)
- Create `goal/service/ExpenditureInsightService.java` (weekly card read + dismiss, history, day statuses)
- Create `goal/service/ExpenditureWeekLearnedEvent.java`, `goal/service/ExpenditureWeekNotificationListener.java`
- Modify `goal/entity/ExpenditureEstimateEntity.java` (+`dismissedAt`), `goal/repository/ExpenditureEstimateRepository.java` (+finders)
- Modify `goal/engine/service/ExpenditureLearningService.java` (marks, switch-aware supersede, `rechainFrom`, `dayStatuses`)
- Modify `goal/engine/service/LearnedBaseResolver.java` (+`learningEnabled` param), `GoalPrescriptionCalculator.java` (reorder), `GoalEvaluationService.java` (basis `learned`)
- Modify `goal/engine/service/AdaptiveReviewJob.java` (switch-off path + bell event)
- Modify `goal/engine/service/DietPreferences.java` (+`learningEnabled`), `nutrition/service/DietPreferencesResolver.java`, `nutrition/service/DietSettingsService.java`, `nutrition/entity/DietSettingsEntity.java`, `nutrition/config/DietSettingsProperties.java`, `application.yml`
- Modify `appnotification/domain/AppNotificationKind.java` (+`EXPENDITURE_WEEK`)
- Modify `goal/controller/GoalController.java` (5 endpoints)
- Modify `biometrics/profile/service/BiometricProfileService.java` (Profile TDEE via resolver)
- Create migration `backend/src/main/resources/db/changelog/1.1.0/script/202609272000_mezo-3n2so_learned_expenditure_part2.sql`
- Modify `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java`

Contracts: `api/feature/goal/goal.yml`, `api/feature/diet-settings/diet-settings.yml`.

Frontend (`frontend/src/…`):
- Modify `data/fuel/expenditureApi.ts`, `data/fuel/expenditureHooks.ts`; create `data/fuel/expenditureLearningSeed.ts` (mock state for history / card / days / marks)
- Modify `data/fuel/dietSettingsHooks.ts`, `data/types.ts` (DietSettings + notification kind), `features/notification/logic/category.ts`, `data/notification/feedMock.ts`
- Create `features/fuel/sheets/WeeklyLearningSheet.tsx` (+test), `features/fuel/components/WeeklyLearningDot.tsx`
- Modify `features/fuel/components/FuelEnergyHero.tsx` (dot in „Miből jön össze?” + Alap row highlight in the equation box) (+test)
- Create `features/fuel/pages/LearningPage.tsx` (+test), `features/fuel/components/LearningHistoryChart.tsx` (+test), `features/fuel/components/LearningDaysList.tsx` (+test); route in `app/router.tsx`
- Modify `features/fuel/sheets/EnergyBreakdownSheet.tsx` (HowLearned → summary line + Részletek) (+test)
- Create `features/fuel/components/DayLearningMark.tsx` (+test); mount in `features/fuel/pages/FuelMaiPage.tsx`
- Modify `features/fuel/pages/FuelSettingsPage.tsx` (switch row) (+test)
- Create `frontend/tests/layout/fuel-learning.spec.ts`

---

### Task 1: Schema, entities and the preference field

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.1.0/script/202609272000_mezo-3n2so_learned_expenditure_part2.sql`
- Modify: `backend/src/main/resources/db/changelog/1.1.0/1.1.0_master.yml` (append)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/entity/IntakeDayMarkEntity.java`, `.../goal/repository/IntakeDayMarkRepository.java`
- Modify: `.../goal/entity/ExpenditureEstimateEntity.java`, `.../goal/repository/ExpenditureEstimateRepository.java`
- Modify: `.../goal/engine/service/DietPreferences.java`, `.../nutrition/entity/DietSettingsEntity.java`, `.../nutrition/config/DietSettingsProperties.java`, `.../nutrition/service/DietPreferencesResolver.java`, `.../nutrition/service/DietSettingsService.java` (toPreferences + setSettings), `backend/src/main/resources/application.yml` (`mezo.diet-settings.default-learning-enabled: true`), `GoalEvaluationServiceIT.java:347,368` constructor sites
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java:55` (add `intake_day_mark`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/repository/IntakeDayMarkRepositoryIT.java`

**Interfaces:**
- Produces: `IntakeDayMarkEntity {UUID id; LocalDate day; String status /*COMPLETE|INCOMPLETE*/}` (extends `OwnedEntity`); `IntakeDayMarkRepository.findByCreatedByAndDayBetweenAndDeletedFalse(UUID, LocalDate, LocalDate): List<IntakeDayMarkEntity>`, `findByCreatedByAndDayAndDeletedFalse(UUID, LocalDate): Optional<…>`; `ExpenditureEstimateEntity.dismissedAt: OffsetDateTime`; `ExpenditureEstimateRepository.findByCreatedByAndWeekStartGreaterThanEqualAndDeletedFalseOrderByWeekStartAsc(UUID, LocalDate): List<…>`, `findTop26ByCreatedByAndDeletedFalseOrderByWeekStartDesc(UUID): List<…>`; `DietPreferences.learningEnabled(): boolean` (9th, last component).

- [ ] **Step 1: Migration**

```sql
-- Learned expenditure Part 2 (bd mezo-3n2so, spec 2026-09-27-learned-expenditure-part2-design §6.1).
create table intake_day_mark (
    id          uuid        not null default gen_random_uuid(),
    created_by  uuid        not null,
    is_deleted  boolean     not null default false,
    created_at  timestamptz not null default now(),
    day         date        not null,
    status      varchar(10) not null,
    constraint pk_intake_day_mark_id primary key (id),
    constraint fk_intake_day_mark_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_intake_day_mark_status check (status in ('COMPLETE', 'INCOMPLETE'))
);
create unique index uq_intake_day_mark_user_day on intake_day_mark (created_by, day) where is_deleted = false;

-- The weekly summary's dismissal, per week, cross-device.
alter table expenditure_estimate add column dismissed_at timestamptz;

-- The learning switch (owner decision P3): on by default.
alter table diet_settings add column learning_enabled boolean not null default true;
```

Append to `1.1.0_master.yml` (same shape as the last entry):

```yaml
  - changeSet:
      id: "1.1.0:202609272000_mezo-3n2so_learned_expenditure_part2"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609272000_mezo-3n2so_learned_expenditure_part2.sql
```

Check `OwnedEntity`'s audit columns against the `expenditure_estimate` script before writing the entity; if `OwnedEntity` maps more columns than the ones above (e.g. `updated_at`), add them to the new table exactly as `expenditure_estimate` has them.

- [ ] **Step 2: Entities / repositories / record.** `IntakeDayMarkEntity` copies `ExpenditureEstimateEntity`'s annotations (`@Entity @Table(name="intake_day_mark") @SQLDelete(sql="update intake_day_mark set is_deleted = true where id = ?") @SQLRestriction("is_deleted = false")`). Add `@Column(name = "dismissed_at") private OffsetDateTime dismissedAt;` to `ExpenditureEstimateEntity`. `DietPreferences` gains `boolean learningEnabled` as the last component; `DietPreferencesResolver` passes `e.isLearningEnabled()` / `properties.defaultLearningEnabled()`; `DietSettingsEntity` gets `@NotNull @Column(name="learning_enabled", nullable=false) private Boolean learningEnabled = true;`; `DietSettingsProperties` gets `boolean defaultLearningEnabled`; both IT constructor sites pass `true`.

- [ ] **Step 3: Write the failing IT** `IntakeDayMarkRepositoryIT`: save two marks for user A (2026-09-21 COMPLETE, 2026-09-23 INCOMPLETE) and one for user B; assert `findByCreatedByAndDayBetweenAndDeletedFalse(A, 09-20, 09-27)` returns exactly A's two; assert a second non-deleted row for (A, 09-21) violates the unique index (`DataIntegrityViolationException`). Follow the fixture/user-creation idiom of `ExpenditureLearningServiceIT`.

- [ ] **Step 4: Run** `./mvnw -q test -Dtest=IntakeDayMarkRepositoryIT -Dmezo.test.use-testcontainers=true` → PASS (after Steps 1–2). Also run `-Dtest=ArchitectureTest,GoalEvaluationServiceIT`.

- [ ] **Step 5: Commit** `feat(goal): intake_day_mark, summary dismissal and learning switch columns (mezo-3n2so)`.

---

### Task 2: Marks feed the classifier; the switch gates serving, not learning

**Files:**
- Modify: `.../goal/engine/service/ExpenditureLearningService.java` (inject `IntakeDayMarkRepository`, `DietPreferencesPort`)
- Modify: `.../goal/engine/service/LearnedBaseResolver.java`, `.../goal/engine/service/GoalPrescriptionCalculator.java:77-80`
- Modify: `.../goal/engine/service/GoalEvaluationService.java:65,83,122` (basis `learned`)
- Modify: `.../goal/engine/service/AdaptiveReviewJob.java`
- Test: extend `backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/ExpenditureLearningServiceIT.java`; create `LearnedBaseResolverTest.java` if none exists

**Interfaces:**
- Consumes: Task 1 repository + `DietPreferences.learningEnabled()`.
- Produces: `LearnedBaseResolver.apply(UUID userId, TdeeBootstrapJson formula, boolean learningEnabled)`; `GoalEvaluationService.assemble(..., boolean learnedBase)` (new last parameter; `basis = learnedBase ? "learned" : (adjustment != 0 ? "adaptive" : <existing default>)`); `ExpenditureLearningService.marksBetween(UUID, LocalDate, LocalDate): Map<LocalDate, Boolean>` (package-private helper reused by Task 3/4).

- [ ] **Step 1: Failing ITs** in `ExpenditureLearningServiceIT` (reuse its fixture that yields a learner with a suspicious day in the reviewed week):
  1. `completeMarkMakesSuspiciousDayUsable` — save `COMPLETE` for the suspicious day, `reviewWeek` → the row's `usableDays` is +1 and `excludedDays` no longer contains that date.
  2. `incompleteMarkExcludesUsableDay` — `INCOMPLETE` on a usable day → `excludedDays` contains it with `reason = "marked"`.
  3. `switchOffStillLearnsButKeepsCorrectionOpen` — set `learning_enabled=false` (save a `DietSettingsEntity`), create an open `weekly_correction` suggestion, `reviewWeek` → row written, suggestion still open.
  4. `switchOffServesFormulaPlusAdjustment` — after 3, `recomputeActiveGoal`; the goal's `tdeeBootstrap.baseSource` is not `learned` and `neatBaselineKcal` equals the formula base; switch back on + recompute → `baseSource = learned`, base = latest row's applied (re-railed).
  5. `basisIsLearnedForLearner` — learner with nonzero `balanceAdjustmentKcal` → prescription `basis = "learned"`.

- [ ] **Step 2: Run** → FAIL (marks ignored, supersede happens, basis adaptive).

- [ ] **Step 3: Implement.**
  - In `replay`, replace `Map.of()` with `marksBetween(userId, windowStart.minusDays(e.referenceDays()), weekEnd)`:

```java
Map<LocalDate, Boolean> marksBetween(UUID userId, LocalDate from, LocalDate to) {
    Map<LocalDate, Boolean> out = new HashMap<>();
    for (IntakeDayMarkEntity m : marks.findByCreatedByAndDayBetweenAndDeletedFalse(userId, from, to)) {
        out.put(m.getDay(), "COMPLETE".equals(m.getStatus()));
    }
    return out;
}
```

  - In `decideAndPersist`, guard the supersede: `if (dietPreferences.resolve(userId).learningEnabled()) suggestionService.supersedeOpen(...)`.
  - `LearnedBaseResolver.apply(userId, formula, learningEnabled)`: return `formula` when `!learningEnabled` (first guard).
  - `GoalPrescriptionCalculator.calculate`: resolve `preferences` first, then `learnedBase.apply(userId, bootstrapService.compute(...), preferences.learningEnabled())` — so a draft preview with the switch flipped projects correctly. Pass `LearnedBaseResolver.SOURCE_LEARNED.equals(bootstrap.baseSource())` to `assemble`. Update every other `assemble` / `apply` caller the compiler reports.
  - `AdaptiveReviewJob.run`: per user,

```java
boolean enabled = dietPreferences.resolve(user.getId()).learningEnabled();
Optional<ExpenditureEstimateEntity> row = expenditureLearning.reviewWeek(user.getId(), weekStart.minusWeeks(1));
if (row.isPresent()) learned++;
if ((row.isEmpty() || !enabled) && adaptiveReviewService.reviewUser(user.getId(), weekStart)) proposed++;
```

    (the bell event is added in Task 6). Update the class Javadoc: switch off = silent learning + the weight-only suggestion (owner decision P3).

- [ ] **Step 4: Run** the IT class, `ExpenditureLearningServiceTest`, `GoalEvaluationServiceIT`, `ArchitectureTest` → PASS.

- [ ] **Step 5: Commit** `feat(goal): day marks feed the classifier; learning switch gates serving only (mezo-3n2so)`.

---

### Task 3: Mark service with immediate re-chain

**Files:**
- Modify: `.../goal/engine/service/ExpenditureLearningService.java` (+`rechainFrom`, split `decideAndPersist` side effects, preserve `dismissedAt`)
- Create: `.../goal/service/IntakeDayMarkService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/service/IntakeDayMarkServiceIT.java`

**Interfaces:**
- Consumes: Task 1–2.
- Produces:
  - `ExpenditureLearningService.rechainFrom(UUID userId, LocalDate day): Rechain` where `record Rechain(Integer appliedBefore, Integer appliedAfter, boolean recomputed)` — both `null` when the user has no row.
  - `IntakeDayMarkService.mark(UUID userId, LocalDate day, String status /*COMPLETE|INCOMPLETE*/): MarkResult` and `clear(UUID userId, LocalDate day): MarkResult`, `record MarkResult(LocalDate day, Integer appliedBaseBeforeKcal, Integer appliedBaseAfterKcal, boolean recomputed)`.
  - Exceptions: `ResponseStatusException(CONFLICT)` for a day with no logged kcal; `BAD_REQUEST` for a future day.

- [ ] **Step 1: Failing ITs** (`IntakeDayMarkServiceIT`, fixture: a learner with rows for weeks W1 < W2 < W3 (all completed) and a suspicious day in W1):
  1. `markInOlderWeekRechainsLaterWeeks` — `mark(user, suspiciousDayInW1, COMPLETE)` → rows W1, W2, W3 all rewritten (assert W1 `usableDays` +1; W3 `appliedBaseKcal` equals a fresh chain computed by calling `reviewWeek` W1→W3 in a second identical fixture, or at minimum that W2/W3 `prevApplied` chain is consistent: each row's applied = clamp(prev applied + step)); result `appliedBaseBeforeKcal` = old W3 applied, `appliedBaseAfterKcal` = new W3 applied.
  2. `rechainRecomputesGoalOnce` — spy/count on `GoalEngineService.recomputeActiveGoal` (use `@MockitoSpyBean`) → exactly 1 call.
  3. `markInCurrentWeekSavesOnly` — mark today → no row changes, `recomputed=false`, before == after.
  4. `dismissalSurvivesRechain` — set W3 `dismissedAt`, mark in W1 → W3 `dismissedAt` unchanged.
  5. `unloggedDayConflict` / `futureDayBadRequest`.
  6. `clearRestoresRule` — mark COMPLETE then `clear` → the day is excluded again (`excludedDays` of W1 contains it).
  7. `switchOffRechainStillRuns` — learning off: mark rewrites rows, `recomputed` true only if applied changed; served goal stays formula.

- [ ] **Step 2: Run** → FAIL (classes missing).

- [ ] **Step 3: Implement.**
  - Split `decideAndPersist(…)` into `persistWeek(…)` (everything up to `estimates.save(row)`, no side effects) and the existing side-effect tail. `reviewWeek` keeps calling both. Row upsert must NOT touch `dismissedAt` (it isn't set anywhere, so reusing `rp.thisWeek()` preserves it — assert in test 4).
  - `rechainFrom`:

```java
@Transactional
public Rechain rechainFrom(UUID userId, LocalDate day) {
    LocalDate weekStart = day.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    LocalDate currentWeek = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    Optional<ExpenditureEstimateEntity> latest = estimates.findFirstByCreatedByAndDeletedFalseOrderByWeekStartDesc(userId);
    Integer before = latest.map(ExpenditureEstimateEntity::getAppliedBaseKcal).orElse(null);
    if (latest.isEmpty() || !weekStart.isBefore(currentWeek) || !Boolean.TRUE.equals(props.expenditure().enabled())) {
        return new Rechain(before, before, false);
    }
    List<LocalDate> weeks = new ArrayList<>();
    weeks.add(weekStart);
    estimates.findByCreatedByAndWeekStartGreaterThanEqualAndDeletedFalseOrderByWeekStartAsc(userId, weekStart.plusWeeks(1))
        .forEach(r -> weeks.add(r.getWeekStart()));
    for (LocalDate w : weeks) {
        if (w.isBefore(currentWeek)) {
            replay(userId, w).ifPresent(rp -> {
                if (rp.prev().isPresent() || rp.thisWeek().isPresent()) {
                    persistWeek(userId, w, rp, rp.traced().map(ExpenditureFilter.Traced::estimate), props.expenditure());
                }
            });
        }
    }
    Integer after = estimates.findFirstByCreatedByAndDeletedFalseOrderByWeekStartDesc(userId)
        .map(ExpenditureEstimateEntity::getAppliedBaseKcal).orElse(before);
    boolean changed = !java.util.Objects.equals(before, after);
    if (changed) {
        goalEngineService.recomputeActiveGoal(userId);
    }
    return new Rechain(before, after, changed);
}
```

    (`persistWeek` must see the previous week's freshly re-written row — same transaction, JPA flush on query is default `AUTO`; if the test shows stale reads, call `estimates.flush()` after each `persistWeek`.) The marked week itself with no row and no prior row is skipped (a not-yet learner gains nothing from a re-chain; the next Monday run picks the mark up).
  - `IntakeDayMarkService` (`@Service`, `@Transactional`): validate (`day.isAfter(LocalDate.now())` → 400; `DailyIntakePort.between(user, day, day)` kcal ≤ 0 or absent → 409), upsert/delete the mark (`clear` soft-deletes via repository delete), then `learning.rechainFrom(userId, day)` → `MarkResult`. Lives in `goal/service` (orchestrator over engine + repository, like `ExpenditureExplanationService`).

- [ ] **Step 4: Run** `IntakeDayMarkServiceIT`, `ExpenditureLearningServiceIT`, `ArchitectureTest` → PASS.

- [ ] **Step 5: Commit** `feat(goal): day marks re-chain later weeks and recompute the goal once (mezo-3n2so)`.

---

### Task 4: Read side — weekly summary, history, day statuses

**Files:**
- Create: `.../goal/engine/service/WeeklyCardPolicy.java` (pure) + `WeeklyCardPolicyTest.java`
- Modify: `.../goal/engine/service/ExpenditureLearningService.java` (+`dayStatuses`)
- Create: `.../goal/service/ExpenditureInsightService.java` + `ExpenditureInsightServiceIT.java`

**Interfaces:**
- Produces:
  - `WeeklyCardPolicy.worthSaying(ExpenditureEstimateEntity row): boolean` = `row.getStepKcal() != 0 || !row.getExcludedDays().isEmpty() || "HOLDING".equals(row.getStatus())`.
  - `ExpenditureLearningService.dayStatuses(UUID userId, LocalDate from, LocalDate to): List<DayStatus>`, `record DayStatus(LocalDate date, Integer kcal, String status /*usable|suspicious|marked_incomplete|confirmed_complete|unlogged*/, String mark /*complete|incomplete|null*/)` — runs the classifier live (same kcal source, reference window and fallback as `replay`; fallback ref = latest applied base (or formula) + plan EAT); a `USABLE` day with a `COMPLETE` mark maps to `confirmed_complete`.
  - `ExpenditureInsightService.weeklyCard(UUID): Optional<WeeklyCard>`; `dismiss(UUID, LocalDate weekStart)`; `history(UUID, int limit): History`; `days(UUID, LocalDate from, LocalDate to): List<DayStatus>` (400 if range > 56 days or `to` after today). `record WeeklyCard(ExpenditureEstimateEntity row, int minUsableDays, int minWeighInDays)`; `record History(boolean learningEnabled, List<ExpenditureEstimateEntity> weeks /*ascending*/)`.
  - Card rule (spec §5.1): switch on AND row for `weekStart = this Monday − 7` exists AND `worthSaying` AND `dismissedAt == null`. `minUsableDays`/`minWeighInDays` are the holding thresholds from `GoalEngineProperties.Expenditure` (the „4 és 2” in the copy — read the property names from the record; do not hard-code).

- [ ] **Step 1: Failing tests.** `WeeklyCardPolicyTest`: step≠0 → true; excluded non-empty → true; HOLDING → true; STABLE, step 0, no excluded → false. `ExpenditureInsightServiceIT`: card present for last week's worth-saying row; absent when dismissed, when quiet, when switch off, when the only row is older; `dismiss` sets `dismissedAt` and is owner-scoped (other user's week → no-op/404); `history` ascending, ≤ limit, carries `learningEnabled`; `days` statuses for a fixture with one suspicious, one COMPLETE-marked suspicious (`confirmed_complete`), one INCOMPLETE-marked usable (`marked_incomplete`), one unlogged.

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS (+`ArchitectureTest`).

- [ ] **Step 5: Commit** `feat(goal): weekly summary, history and live day-status reads (mezo-3n2so)`.

---

### Task 5: Contract + controller

**Files:**
- Modify: `api/feature/goal/goal.yml`, `api/feature/diet-settings/diet-settings.yml`
- Modify: `.../goal/controller/GoalController.java`, new `.../goal/mapper/ExpenditureInsightMapper.java`
- Modify: `.../nutrition/service/DietSettingsService.java` (request `learningEnabled` optional → keep stored; response includes it)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/controller/ExpenditureInsightControllerIT.java`; extend the diet-settings controller IT

**Interfaces (goal.yml, next to `/api/goals/expenditure/explanation`; operationIds become `GoalApi` methods):**

| operationId | Method + path | Response |
|---|---|---|
| `getExpenditureHistory` | `GET /api/goals/expenditure/weeks?limit=26` (1..52) | `ExpenditureHistoryResponse {learningEnabled: boolean, weeks: ExpenditureWeek[]}`; `ExpenditureWeek {weekStart: date, status: enum[learning,updated,stable,holding], confidence: enum[low,medium,high], formulaBaseKcal, posteriorBaseKcal, posteriorSdKcal, appliedBaseKcal, stepKcal, usableDays, weighInDays: integer}` |
| `getExpenditureWeeklyCard` | `GET /api/goals/expenditure/weekly-card` | 200 `ExpenditureWeeklyCardResponse {weekStart, weekEnd: date, status, confidence, appliedBaseKcal, posteriorSdKcal, stepKcal, usableDays, weighInDays, minUsableDays, minWeighInDays: integer, excludedDays: ExpenditureExcludedDay[]}` (reuse the existing `ExpenditureExcludedDay` schema) · 204 none |
| `dismissExpenditureWeeklyCard` | `POST /api/goals/expenditure/weekly-card/{weekStart}/dismiss` | 204 |
| `getIntakeDays` | `GET /api/goals/expenditure/days?from=&to=` | `IntakeDayStatus[] {date, kcal: integer nullable, status: enum[usable,suspicious,marked_incomplete,confirmed_complete,unlogged], mark: enum[complete,incomplete] nullable}` |
| `setIntakeDayMark` | `PUT /api/goals/expenditure/days/{date}/mark` body `{status: enum[complete,incomplete]}` | `IntakeDayMarkResult {day: IntakeDayStatus, appliedBaseBeforeKcal: integer nullable, appliedBaseAfterKcal: integer nullable, recomputed: boolean}`; 400 / 409 |
| `clearIntakeDayMark` | `DELETE /api/goals/expenditure/days/{date}/mark` | `IntakeDayMarkResult` |

`diet-settings.yml`: `learningEnabled: boolean` added to the response (required) and to the request (NOT in `required`; absent = keep the stored value).

- [ ] **Step 1:** Edit both YAMLs; regenerate BE and FE API types; compile → `GoalController` fails to implement the new methods.
- [ ] **Step 2: Failing controller ITs** (MockMvc, the existing goal controller IT idiom): each endpoint's happy path + 204 for the card + 400 (range, future) + 409 (unlogged) + owner scoping; diet-settings PUT without `learningEnabled` keeps `false` stored; GET returns it.
- [ ] **Step 3: Implement** controller methods (204 via `ResponseStatusException(HttpStatus.NO_CONTENT)` like `getExpenditureExplanation`; lowercase enums in the mapper: `status.toLowerCase(Locale.ROOT)`), `DietSettingsService.setSettings` writes `req.getLearningEnabled() != null ? … : row.getLearningEnabled()`; `toPreferences(req)` uses the request value or the resolved stored one; `compose` returns it.
- [ ] **Step 4: Run** the ITs + `ArchitectureTest` → PASS.
- [ ] **Step 5: Commit** `feat(api): learned-expenditure part 2 endpoints and learningEnabled (mezo-3n2so)`.

---

### Task 6: Bell notice from the Monday job only

**Files:**
- Modify: `.../appnotification/domain/AppNotificationKind.java` (+`EXPENDITURE_WEEK("expenditure_week", null, "/fuel/tanulas")` with a one-line Javadoc citing mezo-3n2so, feed-only)
- Create: `.../goal/service/ExpenditureWeekLearnedEvent.java` (`record(UUID userId, UUID estimateId, LocalDate weekStart, String status, int stepKcal, int excludedCount)`), `.../goal/service/ExpenditureWeekNotificationListener.java`
- Modify: `.../goal/engine/service/AdaptiveReviewJob.java` (inject `ApplicationEventPublisher`; publish after a present row when `enabled && WeeklyCardPolicy.worthSaying(row)`)
- Test: `ExpenditureWeekNotificationListenerTest.java` (unit, title/body mapping) + one IT that calls the job method directly (bean off in the test profile: instantiate `AdaptiveReviewJob` manually with the real beans, the way existing job tests do — check `backend/src/test` for `AdaptiveReviewJob` usages first) and asserts exactly one `app_notification` row of kind `expenditure_week` after two runs (dedup), and none after `IntakeDayMarkService.mark` or the rollout runner.

Titles (spec §5.2): `step ≠ 0` → „Heti tanulás: +60 kcal” (signed, `%+d`); else HOLDING → „Heti tanulás: kevés adat volt”; else → „Heti tanulás: N nap kimaradt”. Body: „Nézd meg, mit tanultam a múlt hétből.” Deeplink `/fuel/tanulas`, refId = estimate id, dedupKey `expenditure_week:<weekStart>`. The publish happens inside the job's per-user flow; the listener is `@Async @TransactionalEventListener(AFTER_COMMIT)` like `GoalSuggestionNotificationListener` — if the job is not transactional, use `@TransactionalEventListener(fallbackExecution = true)`.

- [ ] Steps: failing tests → run (FAIL) → implement → run (PASS, + `ArchitectureTest`) → commit `feat(goal): weekly learning bell notice from the Monday run (mezo-3n2so)`.

---

### Task 7: Profile TDEE card serves the learned base

**Files:** Modify `.../biometrics/profile/service/BiometricProfileService.java:109-111`; test: extend the profile service/controller IT that covers `tdeeBootstrap`.

- [ ] Failing IT: a learner with an estimate row and switch on → the profile's derived `tdeeBootstrap.neatBaselineKcal` equals the row's applied base (re-railed), not the formula; switch off → formula.
- [ ] Implement: inject `LearnedBaseResolver` and `DietPreferencesPort`; `bootstrap = learnedBase.apply(userId, tdeeBootstrapService.compute(...), dietPreferences.resolve(userId).learningEnabled())`. Run `ArchitectureTest` — the biometrics→goal edge already exists; if the freeze store reports a new violation, stop and report (do not update the store).
- [ ] Commit `fix(biometrics): profile TDEE card shows the served learned base (mezo-3n2so)`.

---

### Task 8: FE data layer

**Files:** `frontend/src/data/fuel/expenditureApi.ts`, `expenditureHooks.ts`, new `expenditureLearningSeed.ts`, `dietSettingsHooks.ts`, `data/types.ts` (`DietSettings.learningEnabled: boolean`), their tests (`expenditureHooks.test.ts` new).

**Interfaces (Produces):**

```ts
export type ExpenditureHistory = components['schemas']['ExpenditureHistoryResponse']
export type ExpenditureWeek = components['schemas']['ExpenditureWeek']
export type ExpenditureWeeklyCard = components['schemas']['ExpenditureWeeklyCardResponse']
export type IntakeDayStatus = components['schemas']['IntakeDayStatus']
export type IntakeDayMarkResult = components['schemas']['IntakeDayMarkResult']

expenditureApi.history(limit?: number): Promise<ExpenditureHistory>
expenditureApi.weeklyCard(): Promise<ExpenditureWeeklyCard | null>     // 204 → null
expenditureApi.dismissWeeklyCard(weekStart: string): Promise<void>
expenditureApi.days(from: string, to: string): Promise<IntakeDayStatus[]>
expenditureApi.setMark(date: string, status: 'complete' | 'incomplete'): Promise<IntakeDayMarkResult>
expenditureApi.clearMark(date: string): Promise<IntakeDayMarkResult>

useExpenditureHistory(): { data: ExpenditureHistory | null; isPending: boolean; isError: boolean }
useExpenditureWeeklyCard(): { card: ExpenditureWeeklyCard | null; isPending: boolean }
useIntakeDays(from: string, to: string): { days: IntakeDayStatus[]; isPending: boolean }
useIntakeDayMark(): { setMark(date, status): Promise<IntakeDayMarkResult>; clearMark(date): Promise<IntakeDayMarkResult>; pending: boolean }
useDismissWeeklyCard(): { dismiss(weekStart: string): Promise<void> }
```

Query keys: `['expenditureHistory']`, `['expenditureWeeklyCard']`, `['intakeDays', from, to]`. After mark/clear/dismiss (real mode) invalidate `fuelDay`, `goals`, `expenditureExplanation`, `expenditureHistory`, `expenditureWeeklyCard`, `intakeDays`; `useDietSettingsActions.onSuccess` additionally invalidates the four expenditure keys. `DIET_SETTINGS_GHOST.learningEnabled = true`.

Mock (`expenditureLearningSeed.ts`): port the prototype's state — 12 weeks with one gap (formula 2 400, applied converging to 2 480, σ 320→150, holding weeks), last-14-days list with every status, a card for the last week with two suspicious excluded days (Sze 1 180, V 1 020) and step +60; mock `setMark`/`clearMark` update the mock state in the query cache and return a deterministic result: COMPLETE on a suspicious day → after = before − 40; INCOMPLETE on a usable day → +40; clear reverses; today → `recomputed:false`, before == after.

- [ ] Failing hook tests (mock mode, `renderHook` with the repo's query-client wrapper): card present; mark COMPLETE → result −40 and the day's status becomes `confirmed_complete` in `useIntakeDays`; dismiss → `useExpenditureWeeklyCard().card === null`. Real mode (`VITE_USE_MOCK=false`, mocked `apiFetch`): 204 → `null`; setMark issues `PUT /api/goals/expenditure/days/2026-09-23/mark` with body `{"status":"complete"}`.
- [ ] Implement; run both modes; commit `feat(fuel): learned-expenditure part 2 data layer (mezo-3n2so)`.

---

### Task 9: Weekly summary — dot, Alap row, sheet

**Files:** create `features/fuel/sheets/WeeklyLearningSheet.tsx` (+test), `features/fuel/components/WeeklyLearningDot.tsx`; modify `features/fuel/components/FuelEnergyHero.tsx` (+test) and whatever renders the „Miből jön össze?” button and the equation box (locate with `grep -rn "Miből jön össze" frontend/src`).

Build to the prototype (open `#mai`, state „Lépett” / „Kizárt nap” / „Kevés adat”, tap „Miből jön össze?” then the Alap row). Rules:
- Visible only when `isToday && card !== null` (card already encodes switch on / worth saying / not dismissed).
- Dot: `span` 8×8, `pointer-events:none`, `aria-hidden`, sage accent (`--dv-*` sage token the prototype uses), amber when `card.status === 'holding'`, glow via `box-shadow`; reduced-motion: no pulse.
- Alap row when a card exists: tinted fill + accent ring + dot + sub-line suffix „· heti tanulás ›”; the whole row is a `<button>` (min-height 44 px, full width) that closes the equation box and opens the sheet. Without a card the Alap row is unchanged (reverse parity: every other row and value in the equation box unchanged).
- Sheet (the app's existing bottom-sheet primitive used by `EnergyBreakdownSheet`): head „Heti tanulás · szept. 21–27.” (format `weekStart`–`weekEnd` with the existing Hungarian date helpers), learned line „Alap {applied} kcal · {word} · ±{σ rounded to 10} kcal” (word: low „Még tanulok”, medium „Közepesen biztos”, high „Biztos” — reuse `learnedBaseFormat.ts` if it already maps these), step line „{+N} kcal a napi keretedben” + reason (up: „a súlyod lassabban nőtt, mint amit a felírt evés alapján vártam”; down: „a súlyod gyorsabban nőtt, mint amit a felírt evés alapján vártam” — copy the prototype's exact strings), holding copy „Kevés adat volt: {usableDays} teljes nap, {weighInDays} mérlegelés — legalább {minUsableDays} és {minWeighInDays} kell. A keret nem változott.”, excluded rows (weekday + date, kcal, reason chip, „Teljes volt” for suspicious / „Visszavonom” for marked), change line after a mark („A keret {±N} kcal-lal változott” / „A keret nem változott”), footer „Részletek ›” (navigate `/fuel/tanulas`) and „Bezárom” (dismiss + close). Error on mark: toast „Nem sikerült menteni, próbáld újra”, row reverts.
- Tests: dot absent on a past day / null card; Alap row opens the sheet; „Teljes volt” calls `setMark(date,'complete')` and renders the change line; „Bezárom” calls `dismiss(weekStart)`; holding copy with numbers from the card.
- [ ] TDD steps → run both modes → commit `feat(fuel): weekly learning dot and summary sheet (mezo-3n2so)`.

---

### Task 10: „Hogy tanultam?” page

**Files:** create `features/fuel/pages/LearningPage.tsx`, `features/fuel/components/LearningHistoryChart.tsx`, `features/fuel/components/LearningDaysList.tsx` (+tests); route `/fuel/tanulas` in `app/router.tsx` (lazy like sibling fuel pages); modify `features/fuel/sheets/EnergyBreakdownSheet.tsx` (`HowLearned` → summary line „Tanult alap · {word} · ±{σ} kcal” + „Részletek ›” → `/fuel/tanulas`; formula users keep „Képlet alapján”) (+test).

Build to the prototype `#tanulas` (states Tanul / Még nincs adat / Kikapcsolva):
- Page shell = the fuel sub-page shell with back button (find the idiom in e.g. `FuelTrendekPage`).
- Status row: switch on → „Tanult alap · {word} · ±{σ} kcal”; when `useExpenditureWeeklyCard().card` exists it is a full-width button with the dot + „· heti összegző ›” opening `WeeklyLearningSheet`. Switch off (`history.learningEnabled === false`) → „Most nem használom — a keret a képletből jön · {formula} kcal” + muted „Közben csendben tovább tanultam: {posterior} ± {σ} kcal”.
- Chart (`LearningHistoryChart`, SVG, one x/y scale): weeks from `history.weeks` placed on a continuous weekly axis from first to last `weekStart`; a missing week = gap (break both lines and the band) with a „nincs adat” label; formula = dashed muted line; applied = accent line; band = posterior ± σ polygon (low opacity accent); holding weeks = hollow markers; tap a week → a detail row (formula, learned ±σ, applied, step, usable days, weigh-ins; holding adds its reason; gap says it has no data and shows no numbers). Reduced motion: no draw animation.
- Days (`LearningDaysList`): `useIntakeDays(today−14, today−1)` newest first; chip text per status: usable „számít”, suspicious „hiányosnak tűnt”, marked_incomplete „te jelölted hiányosnak”, confirmed_complete „te jelölted teljesnek”, unlogged „nincs felírva”; toggle „számít” checked for usable/confirmed_complete; toggling → `setMark(…,'incomplete'|'complete')`, or `clearMark` when it returns the day to its rule state (suspicious→confirmed_complete→toggle off = clear; usable→marked_incomplete→toggle on = clear); toast with the change line. Unlogged rows: no toggle.
- The six sections: render the existing `LearnedBaseExplainer` unchanged below.
- Empty (`history.weeks.length === 0`): „Még nem tanultam — ehhez legalább 10 felírt nap kell az utolsó 4 hétből és heti 2 mérlegelés.”, no chart, no six sections, days still render.
- Tests: three states; gap renders no numbers; toggle calls the right mutation; breakdown sheet link navigates.
- [ ] TDD → both modes → `frontend/tests/layout/fuel-learning.spec.ts` (320 px no horizontal overflow on `/fuel/tanulas`, mock mode; copy an existing layout spec's setup) → commit `feat(fuel): Hogy tanultam? learning page (mezo-3n2so)`.

---

### Task 11: Day-log mark line

**Files:** create `features/fuel/components/DayLearningMark.tsx` (+test); mount at the bottom of the day's food log in `FuelMaiPage.tsx`, before „Logolj bármit” (see prototype `#mai` and a past day). Update the anatomy comment in `FuelMaiPage.tsx:43-54`.

- Data: `useIntakeDays(date, date)`; for today, the status comes from the same call (the endpoint allows `to = today`).
- States (quiet row with a hairline, not glass): usable „Ez a nap számít a tanulásban” · „Hiányos volt”; suspicious „Ez a nap hiányosnak tűnt, kihagytam” · „Teljes volt”; marked_incomplete „Hiányosnak jelölted” · „Visszavonom”; confirmed_complete „Teljesnek jelölted” · „Visszavonom”; unlogged → render nothing; today adds „A mai napot jövő hétfőn számolom bele.”; every state has „Mit jelent ez?” → `/fuel/tanulas`. Copy the prototype's exact strings where they differ from these.
- Tests: each state; unlogged renders null; action calls the right mutation.
- [ ] TDD → both modes → commit `feat(fuel): mark a day complete or incomplete from the day log (mezo-3n2so)`.

---

### Task 12: Settings switch and bell kind

**Files:** `features/fuel/pages/FuelSettingsPage.tsx` (+test), `data/types.ts` (notification kind union + meta: tint sage, icon `t-lens`), `features/notification/logic/category.ts` (add `expenditure_week` to „cel”), `data/notification/feedMock.ts` (one row „Heti tanulás: +60 kcal”).

- Switch row in the „Finomhangolás” card (`:302`): label „Tanulás a súlyomból és az evésemből”, hint „Hetente megtanulom, mennyi energiát használsz valójában”; part of the draft and `dietDirty`; on Mentés success compare today's served kcal before/after (`fuelDay` query value captured before save vs refetched after) and toast „Mentve · A keret {±N} kcal-lal változott” (N = 0 → plain „Mentve”). Reverse parity: every existing settings control still present.
- Tests: toggling makes the form dirty; save sends `learningEnabled:false`; bell row renders with its icon and routes to `/fuel/tanulas`.
- [ ] TDD → both modes → commit `feat(fuel): learning switch in diet settings and weekly bell kind (mezo-3n2so)`.

---

### Task 13: Docs, gates, ship

- [ ] Docs: `docs/features/goal-engine.md` (Part 2: marks, re-chain, switch semantics, endpoints, bell; fix stale line 191 and line 16), `docs/features/fuel.md` (weekly dot/sheet, learning page, day mark, switch; fix :554/:613), feature index `docs/features/README.md` row, milestone entry `docs/milestones/roadmap.md` (2026-09-27/28, „Tanuló energiaigény 2. rész”), `docs/design_2.0/prototypes/elo/README.md` date.
- [ ] `node scripts/gen-codemap.mjs`; `node scripts/lint-docs.mjs` → 0 errors / 0 stale (fix the stale docs it lists that this change touches; report others).
- [ ] Gates: backend focused ITs of Tasks 1–7 + `ArchitectureTest`; FE `CI=true pnpm test`, `CI=true VITE_USE_MOCK=false pnpm test`, `pnpm test:layout` (or the repo's layout command) for the new spec, `pnpm build`.
- [ ] `node scripts/check-beads-backup.mjs --fix` + commit. Merge per AGENTS.md: `git fetch && git checkout --detach origin/main && git merge --no-ff feat/learned-expenditure-part2`, regenerate codemap (merge drops entries), commit if changed, `git push origin HEAD:main`, delete the branch.
- [ ] Watch the `deploy` workflow for the merge commit to green; open the production URL in the in-app browser: Fuel Mai loads, `/fuel/tanulas` renders, settings switch present. DB check:

```bash
export KUBECONFIG=~/.kube/mezo-k3s.yaml
kubectl exec -n mezo postgres-0 -- psql -U mezo -d mezo -c "select column_name from information_schema.columns where table_name in ('diet_settings','expenditure_estimate') and column_name in ('learning_enabled','dismissed_at');" -c "select count(*) from intake_day_mark;"
```

- [ ] Close `mezo-3n2so` with the checklist evidence; report to the owner in Hungarian walking the *Kész, ha…* list.
