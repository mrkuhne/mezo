# Proactive Coaching S5 — Mutation Set Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the S4 advice card up to two action buttons whose parameters the rule provides, and three narrow, idempotent mutations behind them: shift the bedtime anchor, skip one sport slot on one date, and lighten tomorrow's gym targets by one set per exercise.

**Architecture:** Slice S5 of `docs/superpowers/specs/2026-09-03-proactive-coaching-round1-design.md` §6. The card gains two trailing jsonb components (`actions`, `applied`) and ONE apply endpoint that dispatches on the action key — not three endpoints, because the card, the idempotency and the applied-write-back are identical for all three and only the effect differs. Each effect is a small, reversible row in its own table; **no mutation edits a template or a schedule in place.** The two train mutations are read-time overlays: a `sport_slot_skip` row hides one dated occurrence of a recurring slot, and a `workout_day_adjustment` row lowers the target set count for one date without touching the mesocycle.

**Tech Stack:** Spring Boot backend (`backend/`), Liquibase SQL changesets, contract-first OpenAPI fragments (`api/feature/*/*.yml`), MapStruct, React/TS frontend, JUnit ITs extending `AbstractIntegrationTest`.

## Size warning — read this before starting

This slice is roughly **two S4-sized slices**. It creates two tables, one endpoint, three effects, six backend read-path filters and two frontend filter sites. The task list below is split into **Phase 1 (the card's action framework + the sleep-anchor mutation)** and **Phase 2 (the two train mutations)**, and the phase boundary is a genuine seam: Phase 1 is independently shippable, independently CI-gateable, and leaves the card working with one real action. If the executing session wants to land this as two PRs on the same bd issue, split at the end of Task 8 — the branch is green there. Landing it as one PR is also fine; the phases exist so the work can be *paused* safely, not because they must be separate.

## Decisions already made — do not re-litigate

These three were escalated to the owner on 2026-09-04 because the spec contradicted the code. The owner chose; the spec text is superseded on these points.

- **"Lighten tomorrow" is a per-date ADJUSTMENT ROW applied at read time, not a template edit.** The spec says "−1 target set per exercise on tomorrow's planned workout instance, through the existing prescription-recompute path (`updateBlock` recompute idiom)". Two halves of that are wrong against the code:
  - Exercises hang off the weekday TEMPLATE row (`workout_session` with `templateSessionId == null`), never off an instance, and **no per-instance exercise override exists anywhere in this repo**. Writing the template would lighten every future occurrence of that weekday, not tomorrow. It would also mean going through `TrainService.replaceDayExercises`, which soft-deletes and re-inserts every exercise row with **new UUIDs**, orphaning any already-logged `exercise_set` rows.
  - `updateBlock` is `RunningService.updateBlock` — a running-block write that triggers a goal-EAT prescription recompute through `GoalRecomputePort`. It has nothing to do with gym set targets, and **there is no gym-side recompute to go through**. Do not go looking for one.
  So: a new `workout_day_adjustment (created_by, date, set_delta)` row, applied where the day's targets are assembled for reading. The template is never touched, exercise UUIDs never change, logged sets are never orphaned, and undo is a row delete.
- **The sport skip is keyed by `(day_of_week, time, date)`, NOT by slot id.** The spec says `sport_slot_skip (slot id + date)`. But `sport_schedule_slot` rows are **full-replaced on every schedule save** (`PUT /api/train/sport-schedule` soft-deletes every row and re-inserts the week — see `SportScheduleSlotEntity`'s own javadoc), so slot ids churn. A skip holding a slot id would silently point at a dead row the first time the user edits their schedule, and would then do nothing, forever, with no error. Keying on the slot's IDENTITY (weekday + clock time) survives that. Consequence to accept deliberately: if the user MOVES a slot to a different time, the skip does not follow it — correct, because that is a different session.
- **"Today/briefing/feasibility respect it" covers every DATE-SPECIFIC read path plus the frontend**, and deliberately excludes the week-aggregate one. In scope: `WorkoutWindowQueryService` (both methods), `AnchorResolver` (push anchoring — a skipped slot must not still ping the user), `TrainTools` + `ContextSnapshotAssembler` (the companion's prompt), `PlanFeasibilityCalculator`, and the FE's `weekAgenda.ts`. Out of scope: `WeeklyScheduledActivityService`, which feeds the goal engine's weekly EAT projection — one skipped day is a rounding error there, and recomputing the goal prescription is the most sensitive path in the app.

## Assumptions this plan makes (flagged, not escalated)

- **`PlanFeasibilityCalculator` has no date.** `evaluate(userId, today)` uses `today` only for the bedtime-median lookback; `worstSportCandidate` reasons over the recurring weekly pattern, so there is no dated occurrence to match a skip against. This plan resolves it as: **a slot on weekday D is checked against the NEXT occurrence of D on or after `today`** (`today.plusDays(Math.floorMod(D - todayDow, 7))`). That is the week the feasibility card is talking about. If that reading is wrong, only Task 12 changes.
- **The advice card's actions are produced by the rule, not the model** (spec §5). Round 1 has no rule that emits an action — `joint_overuse` (lighten) and `ignored_nudge` (anchor shift) are S6 rules. So in S5 the action list is populated by a small per-adviceKey mapping in the delivery path, and S6's rules will replace that mapping with payload-derived parameters. Task 4 builds it so S6 can hand it real parameters without changing the envelope or the endpoint.
- **`getWorkoutDetail` (the past-instance review) does NOT get the lighten delta.** It renders what a completed session's template said; a delta is about a future day's target.

## Global Constraints

- **Contract-first.** Write/extend the YAML fragment (`api/feature/proactive/proactive.yml`, `api/feature/train/train.yml`) FIRST, then regenerate: `cd api/generate && npm run generate:api` then `cd frontend && pnpm generate:api`. `api/openapi.yml` and `frontend/src/data/_client/api.gen.ts` are GENERATED and committed — never hand-edit them, or the `contract-drift` CI job fails. Schema names become generated class names; `operationId` becomes the controller method name; the `tag` picks the generated `*Api` interface the controller must implement.
- **Adding a trailing component to `CompanionMessageEnvelope` is jsonb-safe; removing one is not.** All three convenience constructors delegate to the canonical constructor with explicit `null`s — when the arity grows, every one of those `this(...)` calls needs the new trailing arguments appended, or the file will not compile. That compile error is the guard; do not work around it by widening a constructor's meaning.
- **`sleep_goal` reality, against the spec's wording:** the anchor is a `String` column constrained to `"WAKE"` or `"BED"` (not `"BEDTIME"`), and `anchor_time` is a `varchar(5)` `"HH:mm"` string, not a time column. Shift it with `LocalTime.parse(...).plusMinutes(n)` and reformat with the existing `HH_MM` formatter — `LocalTime` wraps mod-24h, so crossing midnight needs no special case. Never do string math on `HH:mm`.
- **Never detect a missing sleep goal through `SleepGoalService` or `SleepAnchorResolver`** — both ghost a config default, so the missing-row condition is invisible through them. Read `SleepGoalRepository.findByCreatedByAndDeletedFalse(userId)` directly. Related: `SleepGoalService.setGoal` is an UPSERT — calling it for a user with no row silently creates one, which the spec's "only offered when a goal row exists" forbids. The new shift method must guard first.
- **The advisory-lock invariant.** `AdviceCardService.deliver` takes `CompanionMessageRepository.lockForDelivery(userId)` (a transaction-scoped `pg_advisory_xact_lock`) before reading today's card. Its javadoc states the real invariant: *no writer may acquire a `companion_message` row lock before that advisory lock in the same transaction*, or the two form a lock-ordering cycle. The apply path writes a `companion_message` row. It must therefore either take the advisory lock first too, or never run inside a transaction that also calls `deliver`. This plan takes the lock (Task 3) — it is one line and it makes the apply path safe against a concurrent supersede.
- **A superseded card is soft-deleted.** Every read through `@SQLRestriction("is_deleted = false")` stops seeing it. So "apply the action on card X" can legitimately find that X is no longer live — that is a 404 (the card was replaced by a more severe one), not a 500.
- **Backend test runs REQUIRE `-Dmezo.test.use-testcontainers=true`.** A `-Dtest` glob that matches no file runs nothing and still exits 0 — "Tests run: 0" is a FAILURE. Also: never read a pipeline's exit code for a Maven run (`./mvnw ... | tail` reports `tail`'s status); write the output to a file and grep the summary, or check `${PIPESTATUS[0]}`.
- **An IT that reaches the advice delivery path reaches the LLM** and needs `@ActiveProfiles("companion-fake")` at class level, or Spring wires the real chat model. This bit four ITs in S4.
- **Frontend tests must pass in BOTH modes:** `pnpm test`, then `VITE_USE_MOCK=false pnpm test`, then `pnpm build`. `VITE_USE_MOCK` unset means MOCK, so a bare `pnpm test` runs mock twice and the real-mode gate is vacuous. In mock mode, a mutation hook is a no-op that skips cache invalidation (the `useExperimentActions` pattern).
- **ArchUnit (CI, not focused local runs):** `controllers_implement_generated_api`, `controllers_live_in_controller_packages`, `services_live_in_service_packages`, `entities_live_in_entity_packages`, `repositories_live_in_repository_packages`, `no_field_injection`, `no_class_level_transactional`, `no_spring_value_annotation`, `no_raw_generic_exceptions_outside_techcore` (throw `SystemRuntimeErrorException` with a `SystemMessage`, never a raw `IllegalStateException`), and the FROZEN `feature_slices_are_cycle_free`. **`proactive → train`, `proactive → biometrics`, `notification → train` and `companion → train` all already exist** (verified imports), so nothing this slice needs is a new edge. A `train → proactive` import would be a brand-new cycle and would fail outright — if train-side code ever needs to know about a proactive concept, invert it through a port the way `GoalRecomputePort` does.
- Liquibase changesets are immutable; new files must be timestamped after `202609041020`, registered in `1.0.0_master.yml`.
- Run every command from the repo root of THIS worktree; never `cd` to the primary repo (it has `main` checked out).
- Commit messages: conventional subject + `(mezo-d58h.5)` + a `Co-Authored-By:` trailer.
- After creating/moving files: `node scripts/gen-codemap.mjs`, committed in the same change, and regenerated AFTER any docs edit, never before.

## File Structure

| File | Responsibility |
|---|---|
| **Phase 1** | |
| `proactive/entity/CompanionMessageEnvelope.java` (M) | trailing `actions` + `applied`, with nested `Action` / `Applied` records |
| `proactive/entity/AdviceActionKey.java` (C) | the three action keys as constants + the enumeration guard's source of truth |
| `proactive/repository/CompanionMessageRepository.java` (M) | `findByIdAndCreatedBy` |
| `proactive/service/AdviceActionCatalog.java` (C) | adviceKey → offered actions (S6 replaces the parameters with payload-derived ones) |
| `proactive/service/AdviceApplyService.java` (C) | load card → validate the action is offered → dispatch → write `applied` back; idempotent |
| `proactive/service/AdviceMutationPort.java` (C) | the seam each effect implements, so the apply service never imports a feature slice directly |
| `proactive/service/SleepAnchorShiftAdapter.java` (C) | the `shift_sleep_anchor` effect |
| `biometrics/sleep/service/SleepGoalService.java` (M) | a guarded `shiftAnchor` that refuses to create a row |
| `proactive/controller/ProactiveController.java` (M) | `applyAdviceAction` |
| `api/feature/proactive/proactive.yml` (M) | `FeedMessageResponse.actions`/`applied`, the apply path, its request/response schemas |
| `proactive/mapper/ProactiveMapper.java` (M) | map the two new envelope components |
| `frontend/src/data/types.ts`, `data/today/feedApi.ts`, `data/today/adviceHooks.ts` (C), `features/today/logic/mezoMessages.ts`, `features/today/pages/NapMezoPage.tsx`, `styles/prototype.css` (M) | action buttons + applied state |
| **Phase 2** | |
| `db/changelog/.../2026090501??_mezo-d58h.5_sport_slot_skip.sql` (C) | the skip table |
| `train/entity/SportSlotSkipEntity.java`, `train/repository/SportSlotSkipRepository.java` (C) | its entity + finder |
| `train/service/SportSlotSkipService.java` (C) | `isSkipped(userId, dayOfWeek, time, date)` + `skipsBetween(...)`, the ONE predicate every read path calls |
| `train/service/WorkoutWindowQueryService.java` (M) | both read paths honour the skip |
| `notification/service/AnchorResolver.java` (M) | a skipped slot raises no push anchor |
| `companion/tools/TrainTools.java`, `companion/service/ContextSnapshotAssembler.java` (M) | the companion's prompt honours the skip (two independent filter sites) |
| `proactive/service/PlanFeasibilityCalculator.java` (M) | the feasibility verdict honours the skip |
| `proactive/service/SportSlotSkipAdapter.java` (C) | the `skip_sport_slot` effect |
| `db/changelog/.../2026090502??_mezo-d58h.5_workout_day_adjustment.sql` (C) | the lighten table |
| `train/entity/WorkoutDayAdjustmentEntity.java`, `train/repository/WorkoutDayAdjustmentRepository.java` (C) | its entity + finder |
| `train/service/WorkoutService.java` (M) | the delta applied to the day's targets |
| `proactive/service/LightenTomorrowAdapter.java` (C) | the `lighten_tomorrow` effect |
| `api/feature/train/train.yml` (M) | the skip-list read endpoint |
| `frontend/src/features/train/logic/weekAgenda.ts`, `data/train/trainHooks.ts` (M) | the FE agenda honours the skip |
| `docs/features/proactive.md`, `docs/features/train.md` (M) | the two new overlays and the apply path |

---

## Phase 1 — the card's action framework + the sleep-anchor mutation

### Task 1: `actions` and `applied` on the envelope

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/CompanionMessageEnvelope.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/AdviceActionKey.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/CompanionMessagePopulator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/CompanionMessageAdvicePersistenceIT.java`

**Interfaces:**
- Produces: `CompanionMessageEnvelope.Action(String key, String label, Map<String, Object> params)`, `CompanionMessageEnvelope.Applied(String actionKey, Instant at)`, the two new record components `actions()` / `applied()`, a widened `advice(...)` factory, `AdviceActionKey.{LIGHTEN_TOMORROW, SKIP_SPORT_SLOT, SHIFT_SLEEP_ANCHOR, ALL}`, and `CompanionMessagePopulator.createAdviceWithActions(...)`.

- [ ] **Step 1: Write the failing round-trip test**

Append to the existing `CompanionMessageAdvicePersistenceIT` (it already has `companionMessageRepository`, `companionMessagePopulator`, `userPopulator` autowired):

```java
    @Test
    void testEnvelope_shouldRoundTripActionsAndApplied() {
        UUID owner = userPopulator.createUser().getId();

        CompanionMessageEntity saved = companionMessagePopulator.createAdviceWithActions(
            owner, LocalDate.now(), "sleep_debt", "sleep_recover_tonight",
            "Mezo · észrevétel", "Ma este feküdj le korábban.",
            List.of("Alvásadósság: 1,6 óra/éjszaka"), List.of("Told előre a villanyoltást."),
            List.of(new CompanionMessageEnvelope.Action(
                AdviceActionKey.SHIFT_SLEEP_ANCHOR, "Horgony −30 perc", Map.of("minutes", -30))),
            null, Instant.now());

        CompanionMessageEnvelope content = companionMessageRepository
            .findById(saved.getId()).orElseThrow().getContent();
        assertThat(content.actions()).hasSize(1);
        assertThat(content.actions().get(0).key()).isEqualTo(AdviceActionKey.SHIFT_SLEEP_ANCHOR);
        assertThat(content.actions().get(0).params()).containsEntry("minutes", -30);
        assertThat(content.applied()).isNull();
    }

    /** The pre-S5 advice rows on main carry neither component — trailing additions deserialize to
     *  null, which is what lets this slice ship without a data migration. */
    @Test
    void testEnvelope_shouldDeserializeAPreS5AdviceRowWithNullActionFields() {
        UUID owner = userPopulator.createUser().getId();
        CompanionMessageEntity legacy = companionMessagePopulator.createAdvice(
            owner, LocalDate.now(), "sleep_debt", "sleep_recover_tonight", "Mezo · észrevétel",
            "régi kártya", List.of("tény"), List.of("javaslat"), Instant.now());

        CompanionMessageEnvelope content = companionMessageRepository
            .findById(legacy.getId()).orElseThrow().getContent();
        assertThat(content.actions()).isNull();
        assertThat(content.applied()).isNull();
    }
```

Add the imports it needs: `io.mrkuhne.mezo.feature.proactive.entity.AdviceActionKey`, `java.util.Map`.

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backend && ./mvnw test -Dtest='CompanionMessageAdvicePersistenceIT' -Dmezo.test.use-testcontainers=true
```

Expected: compilation failure — `Action`, `AdviceActionKey` and `createAdviceWithActions` do not exist.

- [ ] **Step 3: Add the action-key constants**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/AdviceActionKey.java`:

```java
package io.mrkuhne.mezo.feature.proactive.entity;

import java.util.List;

/**
 * The mutation-set action keys (S5, bd mezo-d58h.5, spec 2026-09-03 §6) — string constants, not an
 * enum, for the same reason {@code FlagKey} is: they live in jsonb and in a contract enum, and a
 * Java enum would tempt a {@code valueOf} that throws on an old row's retired key.
 *
 * <p>{@link #ALL} exists so the dispatch layer and its tests can enumerate the set without
 * hand-copying it — the epic's recurring defect is an enumeration nobody re-derives. Adding a key
 * here means: this list, the {@code AdviceMutationPort} implementation that serves it, the contract
 * enum on the apply request, and the FE union. {@code AdviceApplyServiceIT} asserts every key in
 * {@link #ALL} resolves to a port, so a forgotten adapter fails a test rather than a user's tap.
 */
public final class AdviceActionKey {

    /** Lower tomorrow's gym targets by one working set per exercise (min 1). */
    public static final String LIGHTEN_TOMORROW = "lighten_tomorrow";
    /** Hide one dated occurrence of a recurring sport slot. */
    public static final String SKIP_SPORT_SLOT = "skip_sport_slot";
    /** Move the sleep goal's anchor time by ±N minutes. */
    public static final String SHIFT_SLEEP_ANCHOR = "shift_sleep_anchor";

    public static final List<String> ALL =
        List.of(LIGHTEN_TOMORROW, SKIP_SPORT_SLOT, SHIFT_SLEEP_ANCHOR);

    private AdviceActionKey() {
    }
}
```

- [ ] **Step 4: Extend the envelope**

In `CompanionMessageEnvelope.java`: add the two trailing components, the two nested records, append `null, null` to **all three** convenience constructors' `this(...)` calls, and widen the `advice(...)` factory. Keep every existing javadoc paragraph; add one for the new components explaining that `actions` is rule-provided (never model-written) and `applied` is written by the apply path, not by delivery.

```java
public record CompanionMessageEnvelope(String eyebrow, List<String> body, List<Ref> refs,
                                       String interventionKey, String setupKey,
                                       String adviceKey, List<String> facts,
                                       List<String> suggestions,
                                       List<Action> actions, Applied applied) {
```

```java
    /**
     * One offered action button (S5, spec §6). {@code params} is ALWAYS rule-provided — the model
     * writes prose only and can never invent an action or a parameter. The map is deliberately
     * loose ({@code Map<String, Object>}) because each action key has its own parameter shape and
     * the apply layer validates its own; a typed union here would need a new envelope component per
     * action, which is exactly the churn trailing-component safety exists to avoid.
     */
    public record Action(String key, String label, Map<String, Object> params) {
    }

    /** Stamped by the apply path when an action actually took effect — the card's own record that
     *  it has been acted on, and what makes a re-tap a no-op rather than a second mutation. */
    public record Applied(String actionKey, Instant at) {
    }
```

```java
    /** The S5 advice shape — with the rule's offered actions. {@code applied} always starts null:
     *  delivery never pre-applies anything. */
    public static CompanionMessageEnvelope advice(String eyebrow, String prose, String adviceKey,
                                                  String interventionKey, String setupKey,
                                                  List<String> facts, List<String> suggestions,
                                                  List<Action> actions) {
        return new CompanionMessageEnvelope(eyebrow, List.of(prose), List.of(),
            interventionKey, setupKey, adviceKey, List.copyOf(facts), List.copyOf(suggestions),
            List.copyOf(actions), null);
    }
```

Keep the existing 7-arg `advice(...)` as an overload delegating with `List.of()` for actions, so `AdviceCardService` compiles untouched until Task 4 wires the catalog. Add `import java.time.Instant;` and `import java.util.Map;`.

- [ ] **Step 5: Add the populator factory**

In `CompanionMessagePopulator`, after `createAdvice`, add `createAdviceWithActions(...)` taking the same arguments plus `List<CompanionMessageEnvelope.Action> actions` and `CompanionMessageEnvelope.Applied applied`, building the envelope through the canonical constructor so a test can seed an already-applied card. Have `createAdvice` delegate to it with `List.of(), null` so there is one construction site.

- [ ] **Step 6: Run the tests**

```bash
cd backend && ./mvnw test -Dtest='CompanionMessageAdvicePersistenceIT,AdviceCardServiceIT,CompanionMessagePersistenceIT' -Dmezo.test.use-testcontainers=true
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(proactive): carry advice actions and applied state in the envelope (mezo-d58h.5)"
```

---

### Task 2: the actions and applied state on the wire

**Files:**
- Modify: `api/feature/proactive/proactive.yml`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/mapper/ProactiveMapper.java`
- Modify: `frontend/src/data/types.ts`, `frontend/src/data/today/feedApi.ts`, `frontend/src/features/today/logic/mezoMessages.ts`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/ProactiveApiFeedIT.java`, `frontend/src/features/today/logic/mezoMessages.test.ts`

**Interfaces:**
- Produces: `FeedMessageResponse.actions` (array of `FeedAction {key, label, params}`) and `.applied` (`FeedApplied {actionKey, at}`), both optional; the FE `FeedMessage.actions?` / `.applied?` and the same two on `MezoMessageItem`.

- [ ] **Step 1: Write the failing backend test**

Add to `ProactiveApiFeedIT`, matching how that class already drives the endpoint (read it first — it uses the HTTP layer, not the service):

```java
    @Test
    void testGetFeed_shouldExposeTheAdviceCardsActions() {
        UUID owner = userPopulator.createUser().getId();
        companionMessagePopulator.createAdviceWithActions(owner, LocalDate.now(), "sleep_debt",
            "sleep_recover_tonight", "Mezo · észrevétel", "kártya szöveg",
            List.of("tény"), List.of("javaslat"),
            List.of(new CompanionMessageEnvelope.Action(
                AdviceActionKey.SHIFT_SLEEP_ANCHOR, "Horgony −30 perc", Map.of("minutes", -30))),
            null, Instant.now());

        // …drive GET /api/proactive/feed exactly as the neighbouring tests do, then assert the
        // first row's actions[0].key is "shift_sleep_anchor", its label is present, and applied is
        // absent/null.
    }
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backend && ./mvnw test -Dtest='ProactiveApiFeedIT' -Dmezo.test.use-testcontainers=true
```

Expected: compilation failure — the generated DTO has no `getActions()`.

- [ ] **Step 3: Extend the contract**

In `api/feature/proactive/proactive.yml`, add two schemas and reference them from `FeedMessageResponse.properties` (after `suggestions`, and NOT in `required`):

```yaml
    FeedAction:
      type: object
      required: [key, label]
      properties:
        key:
          type: string
          description: Which mutation the button applies (S5, mezo-d58h.5). The apply endpoint dispatches on this.
          enum: [lighten_tomorrow, skip_sport_slot, shift_sleep_anchor]
        label:
          type: string
          description: The button's Hungarian caption — rule-provided, never model-written.
        params:
          type: object
          additionalProperties: true
          description: The mutation's parameters, ALWAYS produced by the deterministic rule (spec §6). The model can never invent an action or a number.
    FeedApplied:
      type: object
      required: [actionKey, at]
      properties:
        actionKey: { type: string }
        at: { type: string, format: date-time }
```

```yaml
        actions:
          type: array
          description: Up to two action buttons offered by this advice card (S5, mezo-d58h.5). Present only on advice rows.
          items: { $ref: '#/components/schemas/FeedAction' }
        applied:
          $ref: '#/components/schemas/FeedApplied'
```

- [ ] **Step 4: Map them**

On `ProactiveMapper.toFeedResponse`, next to the S4 `facts`/`suggestions` mappings:

```java
    @Mapping(target = "actions", source = "content.actions")
    @Mapping(target = "applied", source = "content.applied")
```

MapStruct needs a mapping for the nested records too — add `FeedAction toFeedAction(CompanionMessageEnvelope.Action action);` and `FeedApplied toFeedApplied(CompanionMessageEnvelope.Applied applied);` alongside the existing `toFeedRef`. If MapStruct cannot map `Map<String, Object>` → the generated `params` type, write a `default` method for it rather than loosening the envelope.

- [ ] **Step 5: Regenerate and run**

```bash
cd api/generate && npm run generate:api
cd ../../frontend && pnpm generate:api
cd ../backend && ./mvnw test -Dtest='ProactiveApiFeedIT' -Dmezo.test.use-testcontainers=true
```

- [ ] **Step 6: Carry the fields through the FE data layer**

`types.ts`: add `FeedAction` / `FeedApplied` interfaces and `actions?: FeedAction[]` / `applied?: FeedApplied` to `FeedMessage`. `feedApi.ts`: pass both through in the `wire.map`. `mezoMessages.ts`: add the same two optional fields to `MezoMessageItem` and carry them in `feedToMessageItem`, with a javadoc line saying they exist only on advice feed rows (demo/nudge items never have them).

- [ ] **Step 7: Extend the FE test**

Add a case to `mezoMessages.test.ts` proving an advice row's `actions` and `applied` reach the thread item, copying the file's real fixture style.

- [ ] **Step 8: Run everything**

```bash
cd backend && ./mvnw test -Dtest='ProactiveApiFeedIT,AdviceCardServiceIT' -Dmezo.test.use-testcontainers=true
cd ../frontend && pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(proactive): surface advice actions and applied state on the wire (mezo-d58h.5)"
```

---

### Task 3: the apply seam — `AdviceMutationPort` + `AdviceApplyService`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdviceMutationPort.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdviceApplyService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/repository/CompanionMessageRepository.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/AdviceApplyServiceIT.java`

**Interfaces:**
- Consumes: `CompanionMessageEnvelope.Action` / `.Applied`, `AdviceActionKey.ALL`, `CompanionMessageRepository.lockForDelivery`.
- Produces: `interface AdviceMutationPort { String actionKey(); void apply(UUID userId, Map<String, Object> params); }`; `AdviceApplyService.apply(UUID userId, UUID cardId, String actionKey)` → the updated `CompanionMessageEntity`; `CompanionMessageRepository.findByIdAndCreatedBy(UUID id, UUID createdBy)`.

The port exists so the apply service never imports a feature slice: each effect lives in its own adapter (Tasks 5, 13, 17), Spring injects them as a `List<AdviceMutationPort>`, and the service dispatches by key. That also makes the enumeration guard trivial — every key in `AdviceActionKey.ALL` must resolve to exactly one port.

- [ ] **Step 1: Write the failing IT**

Create `AdviceApplyServiceIT` with `@ActiveProfiles("companion-fake")` (the apply path itself makes no LLM call, but the class seeds cards through the populator and lives beside services that do — match `AdviceCardServiceIT`). Cover:

1. applying an offered action stamps `applied` with the action key and a timestamp, and returns the updated row;
2. **idempotence** — applying the same action twice returns the SAME `applied.at` and the effect runs only once (assert on the effect's own side table, seeded via a test-only port if no real adapter exists yet, or defer this test to Task 5 and note it here);
3. an action key the card does not OFFER is rejected (409) — a client cannot invoke a mutation the rule never put on the card;
4. a card id belonging to another user is a 404 (owner-scoped lookup, the `ExperimentRepository.findByIdAndCreatedByAndDeletedFalse` precedent);
5. a SUPERSEDED (soft-deleted) card is a 404 — it was replaced by a more severe card, and applying its action would act on advice the user is no longer being shown;
6. every key in `AdviceActionKey.ALL` resolves to exactly one registered `AdviceMutationPort` (the enumeration guard — assert on the injected `List<AdviceMutationPort>`).

Test 6 will FAIL until all three adapters exist. That is deliberate: it is the regression that catches a forgotten adapter. Mark it `@Disabled` with a comment naming Task 17 as the task that turns it on, and REMOVE the `@Disabled` in Task 17 — do not leave it disabled.

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backend && ./mvnw test -Dtest='AdviceApplyServiceIT' -Dmezo.test.use-testcontainers=true
```

- [ ] **Step 3: Add the owner-scoped finder**

```java
    /** Owner-scoped load for the S5 apply path (the {@code ExperimentRepository} precedent): a card
     *  belonging to someone else, or one superseded into {@code is_deleted = true}, simply is not
     *  found — the caller turns that into a 404 rather than leaking existence. */
    Optional<CompanionMessageEntity> findByIdAndCreatedBy(UUID id, UUID createdBy);
```

- [ ] **Step 4: Write the port and the service**

```java
package io.mrkuhne.mezo.feature.proactive.service;

import java.util.Map;
import java.util.UUID;

/**
 * One advice-card action's effect (S5, bd mezo-d58h.5, spec §6). The seam exists so
 * {@link AdviceApplyService} dispatches without importing {@code feature.train} or
 * {@code feature.biometrics} for each new mutation: adapters live beside it in
 * {@code feature.proactive}, and only they cross the slice boundary (a direction that already
 * exists — the reverse would be a new cycle).
 *
 * <p>Implementations MUST be idempotent on their own terms: {@link AdviceApplyService} already
 * refuses a second apply of the same action on the same card, but a rule may offer the same action
 * on a later day's card, and applying it twice must not double the effect.
 */
public interface AdviceMutationPort {

    /** The {@code AdviceActionKey} this port serves. Exactly one port per key. */
    String actionKey();

    /** Applies the effect. Params come from the card's own rule-provided action; validate them
     *  here — a client can call the endpoint with any card the rule wrote, so treat the values as
     *  bounded input, not as trusted. */
    void apply(UUID userId, Map<String, Object> params);
}
```

`AdviceApplyService.apply(userId, cardId, actionKey)`:

1. `companionMessageRepository.lockForDelivery(userId)` FIRST (the advisory-lock invariant: this method writes a `companion_message` row, so it must not acquire that row's lock before the advisory lock);
2. load via `findByIdAndCreatedBy`, else 404 `PROACTIVE_ADVICE_NOT_FOUND`;
3. reject a non-advice kind with 409;
4. find the requested key among `content.actions()`, else 409 `PROACTIVE_ADVICE_ACTION_NOT_OFFERED`;
5. if `content.applied() != null`: if it names the SAME key, return the row unchanged (idempotent no-op — log at info); if a DIFFERENT key, 409 (one action per card);
6. dispatch to the port for the key, else 500-shaped `SystemRuntimeErrorException` naming the missing adapter (this is a wiring bug, not a user error);
7. rebuild the envelope with `applied = new Applied(key, Instant.now().truncatedTo(ChronoUnit.MICROS))` — every other component copied unchanged — and `saveAndFlush`.

Method-level `@Transactional`. Throw only `SystemRuntimeErrorException` with `SystemMessage` codes (ArchUnit forbids raw runtime exceptions outside techcore).

- [ ] **Step 5: Run, then commit**

```bash
cd backend && ./mvnw test -Dtest='AdviceApplyServiceIT' -Dmezo.test.use-testcontainers=true
git add -A && git commit -m "feat(proactive): advice apply seam with idempotent applied write-back (mezo-d58h.5)"
```

---

### Task 4: the action catalog — what each card offers

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdviceActionCatalog.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdviceCardService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/service/AdviceActionCatalogTest.java`, `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/AdviceCardServiceIT.java`

Round 1 has no rule that emits actions (`joint_overuse` and `ignored_nudge` are S6), so the catalog maps `adviceKey` → the actions that make sense for it, with rule-independent default parameters. Keep it small and honest:

- `sleep_debt` → `shift_sleep_anchor` with `{"minutes": -30}` (bring lights-out forward half an hour), offered ONLY when a `sleep_goal` row exists — the spec makes card 4 its prerequisite. The catalog therefore needs the repository read, not the ghosting service.
- `missing_sleep_goal` → no actions (its own card is the prerequisite; there is nothing to shift yet).
- everything else → no actions.

Cap the list at two per card (spec §5: "up to 2 action buttons"), and assert that cap in the test. `AdviceCardService.deliver` calls the catalog and passes the result into the widened `advice(...)` factory.

Write the unit test against the catalog directly (it is a small Spring bean over one repository), plus one `AdviceCardServiceIT` case proving a delivered `sleep_debt` card carries the action when a goal row exists and carries none when it does not.

- [ ] Run: `cd backend && ./mvnw test -Dtest='AdviceActionCatalogTest,AdviceCardServiceIT,InterventionServiceIT,SetupCheckServiceIT' -Dmezo.test.use-testcontainers=true`
- [ ] Commit: `feat(proactive): offer rule-provided actions on the advice card (mezo-d58h.5)`

---

### Task 5: the sleep-anchor shift effect

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/service/SleepGoalService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/SleepAnchorShiftAdapter.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/biometrics/SleepGoalShiftIT.java` (match the existing sleep IT package/naming — read the directory first), and the idempotence case in `AdviceApplyServiceIT`

**Interfaces:**
- Produces: `SleepGoalService.shiftAnchor(UUID userId, int minutes)` → `SleepGoalResponse`, which **refuses to create a row**; `SleepAnchorShiftAdapter implements AdviceMutationPort` serving `AdviceActionKey.SHIFT_SLEEP_ANCHOR`.

```java
    /**
     * Moves the anchor by {@code minutes} (negative = earlier) WITHOUT creating a goal (S5, bd
     * mezo-d58h.5). Deliberately not {@link #setGoal}: that one upserts, so calling it for a user
     * with no row would silently invent a goal — and the spec makes the missing-sleep-goal card the
     * prerequisite for ever offering this action. The missing-row condition is invisible through
     * {@code getGoal}/{@code SleepAnchorResolver} (both ghost a config default), so this reads the
     * repository directly.
     *
     * <p>{@code anchor_time} is an {@code HH:mm} string; {@link LocalTime} arithmetic wraps mod-24h,
     * so a shift across midnight needs no special case — but string math on it would be a bug.
     */
    @Transactional
    public SleepGoalResponse shiftAnchor(UUID userId, int minutes) {
        SleepGoalEntity row = repository.findByCreatedByAndDeletedFalse(userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("SLEEP_GOAL_NOT_SET").build(), HttpStatus.CONFLICT));
        row.setAnchorTime(LocalTime.parse(row.getAnchorTime()).plusMinutes(minutes).format(HH_MM));
        repository.save(row);
        return compose(row.getTargetMinutes(), row.getAnchor(), row.getAnchorTime(),
            row.getRegularityBandMin());
    }
```

Bound `minutes` in the adapter (reject anything outside ±120 with a validation `SystemMessage`) — the params map is loose by design, so the adapter is where the contract on values lives.

Tests: shift earlier; shift later; a shift crossing midnight (e.g. `00:15` −30 → `23:45`) asserting the wrapped value; **no goal row → 409 and no row created** (assert the repository is still empty afterwards — this is the sharpest test in the task); an out-of-range `minutes` rejected. Then turn on the idempotence case in `AdviceApplyServiceIT`: applying twice shifts the anchor ONCE.

- [ ] Run: `cd backend && ./mvnw test -Dtest='SleepGoalShiftIT,AdviceApplyServiceIT,SleepGoal*IT' -Dmezo.test.use-testcontainers=true` (verify each named class exists first — a glob that matches nothing exits 0)
- [ ] Commit: `feat(biometrics): guarded sleep-anchor shift behind the advice apply seam (mezo-d58h.5)`

---

### Task 6: the apply endpoint

**Files:** `api/feature/proactive/proactive.yml`, `backend/.../proactive/controller/ProactiveController.java`, `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/ProactiveApiAdviceApplyIT.java`

Copy the `decideExperiment` shape exactly (it is the house example): path-param id, a small request body, owner-scoped load, `SystemRuntimeErrorException` for 404/409, mapper back to the response.

```yaml
  /api/proactive/advice/{id}/apply:
    post:
      tags: [Proactive]
      operationId: applyAdviceAction
      summary: Apply one of the advice card's offered actions (S5, mezo-d58h.5)
      description: >-
        Applies the named action and stamps `applied` onto the card. Idempotent: re-applying the
        SAME action returns the card unchanged with its original `applied` timestamp and runs no
        second mutation. A card that has been superseded by a higher-severity card is gone (404),
        and an action the card does not offer is refused (409) — a client can never invoke a
        mutation the rule did not put there.
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: uuid }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/AdviceApplyRequest' }
      responses:
        '200': { description: The card with its applied state, content: { application/json: { schema: { $ref: '#/components/schemas/FeedMessageResponse' } } } }
        '400': { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '401': { description: Missing or invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: No such live advice card for this user (it may have been superseded), content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '409': { description: The card does not offer this action, or a different action was already applied, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
```

with

```yaml
    AdviceApplyRequest:
      type: object
      required: [actionKey]
      properties:
        actionKey:
          type: string
          enum: [lighten_tomorrow, skip_sport_slot, shift_sleep_anchor]
```

Regenerate both artifacts. The IT drives the endpoint over HTTP: happy path, idempotent re-apply, not-offered 409, other-user 404, superseded 404.

- [ ] Run the IT + `ProactiveApiFeedIT` + the FE build (the generated client changed).
- [ ] Commit: `feat(proactive): POST /api/proactive/advice/{id}/apply (mezo-d58h.5)`

---

### Task 7: the FE action buttons

**Files:** `frontend/src/data/today/adviceHooks.ts` (C), `frontend/src/features/today/pages/NapMezoPage.tsx`, `frontend/src/styles/prototype.css`, and their tests

Copy `useExperimentActions` (`frontend/src/data/insights/experimentsHooks.ts`) exactly for the hook shape, including the mock guard — in mock mode the mutation is a no-op and `onSuccess` skips invalidation, because the mock feed is `[]` and there is nothing to update.

In `NapMezoPage.renderCard`, render the buttons directly above the „Segített?" block, gated on `m.kind === 'advice' && m.actions?.length`. When `m.applied` is set, render the applied state instead of the buttons (the action's label plus a „megcsinálva" marker) — do not render disabled buttons; a tapped action is a completed thing, not a greyed-out one. On failure, surface the error next to the card and leave it intact (spec §7: "mutation failure ⇒ card intact, button surfaces the error, no partial application").

Tests: buttons render for an advice card with actions; tapping calls the hook with the right key; an applied card renders the applied state and NO buttons; a non-advice card renders neither. Both FE modes + build.

- [ ] Commit: `feat(today): advice-card action buttons and applied state (mezo-d58h.5)`

**Phase 1 ends here — the branch is green and shippable.**

---

## Phase 2 — the two train mutations

### Task 8: the `sport_slot_skip` table

**Files:** a new Liquibase changeset (timestamp > `202609041020`) + `1.0.0_master.yml`; `train/entity/SportSlotSkipEntity.java`; `train/repository/SportSlotSkipRepository.java`; `train/service/SportSlotSkipService.java`; a persistence IT; `backend/src/test/java/io/mrkuhne/mezo/support/populator/SportSlotSkipPopulator.java`

```sql
-- Proactive coaching S5 (mezo-d58h.5, spec 2026-09-03 §6): one dated occurrence of a RECURRING
-- sport slot, hidden. Deliberately keyed on the slot's IDENTITY (weekday + clock time), NOT on
-- sport_schedule_slot.id: that table is FULL-REPLACED on every schedule save (soft-delete +
-- re-insert), so an id-keyed skip would point at a dead row after the user's first schedule edit
-- and silently stop working. Moving a slot to another time therefore does not carry its skip along
-- — correct, because that is a different session.
create table sport_slot_skip (
    id          uuid        not null default gen_random_uuid(),
    created_by  uuid        not null,
    is_deleted  boolean     not null default false,
    created_at  timestamptz not null default now(),
    day_of_week smallint    not null,
    time        varchar(5)  not null,
    date        date        not null,
    constraint pk_sport_slot_skip_id primary key (id),
    constraint fk_sport_slot_skip_created_by_app_user_id
        foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_sport_slot_skip_day_of_week check (day_of_week between 0 and 6)
);
-- One skip per (user, slot identity, date); the partial index mirrors the soft-delete convention.
create unique index uq_sport_slot_skip_slot_date
    on sport_slot_skip (created_by, day_of_week, time, date) where is_deleted = false;
create index ix_sport_slot_skip_date on sport_slot_skip (created_by, date) where is_deleted = false;
```

`SportSlotSkipService` is the ONE predicate every read path calls, so the skip semantics live in a single place:

```java
    /** Is this recurring slot hidden on this date? The slot is identified by weekday + clock time
     *  (see the changeset for why, not by row id). */
    @Transactional(readOnly = true)
    public boolean isSkipped(UUID userId, int dayOfWeek, String time, LocalDate date) { … }

    /** Every skip in [from, to] — the batch read for the FE and for any path that already holds a
     *  week's worth of slots (one query instead of one per slot per day). */
    @Transactional(readOnly = true)
    public Set<SkipKey> skipsBetween(UUID userId, LocalDate from, LocalDate to) { … }
```

The `day_of_week` convention is **0 = Monday … 6 = Sunday** (the legacy slot-table convention, NOT ISO). Every call site converts with `date.getDayOfWeek().getValue() - 1`. Put that sentence in the entity's javadoc — `AnchorResolver` already carries a "Trap #1" comment about exactly this and it has bitten before.

Persistence IT: the unique index rejects a duplicate; the DB CHECK rejects `day_of_week = 7`; a soft-deleted skip stops matching.

- [ ] Commit: `feat(train): sport_slot_skip — one dated occurrence of a recurring slot (mezo-d58h.5)`

---

### Tasks 9-12: make every read path respect the skip

One task per call site, each with its own test, because each is a different consumer with a different failure mode. **Do all four before wiring the button** (Task 13) — a skip that only half-applies is worse than no skip, because the user sees the slot vanish from one surface and still get pinged by another.

- [ ] **Task 9 — `WorkoutWindowQueryService`** (`feature/train`, same slice, no import question). Two sites: `addSportWindows`'s `sportRepo…filter(s -> s.getDayOfWeek() == dow)` and `hasScheduledTrainingOn`'s `sportScheduled` predicate. The second one matters more than it looks: it drives `FuelDayService`'s training-day kcal pick, so a skipped session must also stop inflating the day's fuel target. Extend `WorkoutWindowQueryServiceIT`.
- [ ] **Task 10 — `AnchorResolver`** (`feature/notification` → train import already exists). In `gymAnchors`' sport loop, skip the slot for that date. Without this the user taps "skip tonight" and still gets a push for it. Add the test to whichever `AnchorResolver*IT` matches the trigger (read all five first; do not default to the base class).
- [ ] **Task 11 — the companion's prompt, TWO independent filter sites** (`feature/companion` → train import already exists): `TrainTools.sportSlotsOn` and `ContextSnapshotAssembler.dayLine`'s inline `sport.stream().filter(...)`. They already duplicate the weekday-match logic and both carry comments warning about exactly this drift. Update both, or the AI will tell the user about a session they skipped. Extend `CompanionToolsRenderIT` and `ContextSnapshotAssemblerIT`.
- [ ] **Task 12 — `PlanFeasibilityCalculator`** (`feature/proactive` → train import already exists). This one has no date (see Assumptions): resolve each slot's weekday to its next occurrence on or after `evaluate`'s `today`, and drop the slot if that date is skipped. Extend `PlanFeasibilityIT` with a case proving a skipped Friday session stops binding Saturday's lights-out.

Each task: failing test first, then the filter, then the named IT green, then commit.

---

### Task 13: the `skip_sport_slot` effect + the FE agenda

**Files:** `proactive/service/SportSlotSkipAdapter.java`; `api/feature/train/train.yml` (a `GET /api/train/sport-slot-skips?from=&to=` list endpoint — `200 []` never 404, the list-endpoint precedent); the train controller + service; `frontend/src/data/train/trainHooks.ts`; `frontend/src/features/train/logic/weekAgenda.ts`

The adapter validates its params (`dayOfWeek` 0-6, `time` matching `^([01]\d|2[0-3]):[0-5]\d$`, `date` today-or-later) and inserts the skip, treating an existing skip for the same key as a no-op (its own idempotence, per the port's contract).

The FE needs the week's skips to filter `buildWeekAgenda`'s `sportSlots` — hence the read endpoint. Apply the filter at `weekAgenda.ts`'s existing per-date predicate (`sportSlots.filter((x) => x.day === d && (!x.date || x.date === date))`), extended with the skip check; `VolleyballSession` already carries `day` and `time`, which is exactly the skip key. Mock mode returns `[]` skips.

- [ ] Commit: `feat(train): apply and respect sport-slot skips end to end (mezo-d58h.5)`

---

### Task 14: the `workout_day_adjustment` table

**Files:** a new Liquibase changeset + registration; `train/entity/WorkoutDayAdjustmentEntity.java`; `train/repository/WorkoutDayAdjustmentRepository.java`; a persistence IT; a populator

```sql
-- Proactive coaching S5 (mezo-d58h.5, spec 2026-09-03 §6 item 1, as corrected by the owner on
-- 2026-09-04): a READ-TIME overlay that lowers one date's gym targets. Deliberately NOT a template
-- edit: exercises hang off the weekday TEMPLATE row, so writing them would lighten every future
-- occurrence of that weekday, and the only existing write path (replaceDayExercises) soft-deletes
-- and re-inserts every exercise with NEW UUIDs, orphaning already-logged exercise_set rows.
-- One row per user per date; undo is a delete.
create table workout_day_adjustment (
    id         uuid        not null default gen_random_uuid(),
    created_by uuid        not null,
    is_deleted boolean     not null default false,
    created_at timestamptz not null default now(),
    date       date        not null,
    set_delta  smallint    not null,
    constraint pk_workout_day_adjustment_id primary key (id),
    constraint fk_workout_day_adjustment_created_by_app_user_id
        foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_workout_day_adjustment_set_delta check (set_delta between -3 and 0)
);
create unique index uq_workout_day_adjustment_user_date
    on workout_day_adjustment (created_by, date) where is_deleted = false;
```

The CHECK bounds the delta to a lightening of at most three sets — the mutation set is deliberately narrow, and a bound in the schema is what stops a future caller from turning this into an arbitrary set editor.

- [ ] Commit: `feat(train): workout_day_adjustment — a read-time per-date target overlay (mezo-d58h.5)`

---

### Task 15: apply the delta where the day's targets are assembled

**Files:** `train/service/WorkoutService.java`; `companion/tools/TrainTools.java`; `companion/service/ContextSnapshotAssembler.java`; `WorkoutServiceIT` (or the right existing IT — read the directory), `CompanionToolsRenderIT`, `ContextSnapshotAssemblerIT`

**This step has one sharp trap.** `WorkoutService.getToday` computes `effectiveSets` via `effectiveWorkingSets(...)`, which reads each template exercise's `workingSets` as the **weighting for distributing the muscle group's weekly volume target across exercises**. Subtracting the delta before that runs would corrupt the whole week's proportional split. The delta must be applied **after** `effectiveWorkingSets` returns, on the final per-exercise number:

```java
int effective = effectiveSets.getOrDefault(e.getId(), e.getWorkingSets());
effective = Math.max(1, effective + dayDelta);   // dayDelta ≤ 0; never below one working set
t.setWorkingSets(effective);
```

Apply it BEFORE the `setRecommendationService.prescribe(createdBy, e, deloadWeek, effective)` call on the next line, so the prescription (warmup ramp, working weight/reps) reflects the lightened session rather than contradicting it.

`getToday` is pinned to `LocalDate.now()`, so a delta written today for tomorrow simply takes effect when tomorrow arrives — no future-day endpoint is needed, and none exists. But the companion's two prose paths (`TrainTools.dayContentLine`, `ContextSnapshotAssembler.dayLine`) DO render a future day ("Holnap (terv)") straight from the template's raw `workingSets`, so they must apply the delta too or the AI will contradict the card the user just tapped. Both read exercises directly, not through `getToday` — two more filter sites, same duplication trap as the sport-slot ones.

Do NOT touch `getWorkoutDetail` (past-instance review).

- [ ] Commit: `feat(train): apply the per-date lighten delta to the day's targets (mezo-d58h.5)`

---

### Task 16: the `lighten_tomorrow` effect + the enumeration guard

**Files:** `proactive/service/LightenTomorrowAdapter.java`; `AdviceApplyServiceIT`

The adapter writes a `workout_day_adjustment` row for `LocalDate.now().plusDays(1)` with `set_delta = -1` (the param may carry a different delta; validate it against the schema's `-3..0` bound). Idempotent: an existing row for that date is a no-op, not a second decrement.

Then **remove the `@Disabled`** from `AdviceApplyServiceIT`'s enumeration test and watch it pass with all three ports registered. That test is this slice's structural guard, exactly as `AdvicePriorityTest`'s reflection test is S4's.

- [ ] Commit: `feat(proactive): lighten-tomorrow effect + the action-port enumeration guard (mezo-d58h.5)`

---

### Task 17: docs + CODEMAP + the full focused gate

Update `docs/features/proactive.md` (the apply path, the action catalog, idempotence, the superseded-card 404) and `docs/features/train.md` (the two overlays, why neither edits a template or a schedule, and the complete list of read paths that honour the skip — that list IS the contract). Edit the wrong sections; do not append a changelog. Bump both docs' frontmatter `updated:`.

Then, in this order: `node scripts/gen-codemap.mjs` → `node scripts/gen-codemap.mjs --check` (must exit 0) → the full focused backend gate (every IT this slice touched, with Maven's own exit code checked) → both FE modes → `pnpm build`.

- [ ] Commit: `docs(proactive,train): document the S5 mutation set + regenerate the codemap (mezo-d58h.5)`

---

### Task 18: ship

Push, open the self-PR, wait for CI green (`gh pr checks --watch`), then merge `--no-ff` from a temp branch off `origin/main` (never `cd` to the primary repo), regenerate the CODEMAP on the merge commit if `origin/main` moved, push to main, delete the branch, `bd close mezo-d58h.5`, `bd dolt push`.

If `gh pr checks` reports "no checks reported", the PR is CONFLICTING — merge `origin/main` into the branch, resolve, push, and CI starts.

---

## Self-review notes (for the executor)

- **Spec coverage:** §6's three endpoints are served by ONE endpoint plus three ports — a deliberate simplification, since the card lookup, the idempotence and the applied write-back are identical and only the effect differs. §6's "each application writes `applied` back onto the card and is idempotent (re-applying is a no-op returning the applied state)" is Task 3. §6's ArchUnit cycle checkpoint is covered by the Global Constraints and by CI. The spec's own text on mutation 1 and on the skip key is **superseded** by the owner's decisions recorded at the top.
- **The three riskiest steps**, in order: Task 15's ordering against `effectiveWorkingSets` (getting it wrong corrupts a whole week's volume split, silently); Tasks 9-12 as a set (a half-applied skip is worse than none); and Task 3's advisory-lock ordering (the apply path writes a `companion_message` row, so it inherits S4's lock invariant).
- **If a step's verbatim code does not compile against the file you are editing, the FILE wins** — read it, adapt, and say so in your task report. Every quoted body here was read from the tree at `origin/main` on 2026-09-04, after S4 merged.
