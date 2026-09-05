# Proactive Coaching Round 2 · S1 — Protocol Lapse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `protocol_lapse` flag — the round-2 spec's item (11) — so that a supplement/protocol item that has genuinely been a habit and has now been missed on **two consecutive due days** produces one gentle, grace-window advice card, and nothing else ever does.

**Architecture:** Slice S1 of `docs/superpowers/specs/2026-09-05-proactive-coaching-round2-design.md` §a / §(11). One new `FlagRule` in `companion/flags/service/rule/`, called by the existing fixed-order `FlagEvaluator` sweep, with cross-feature repository reads (fuel `protocol`/`protocol_item`/`supplement_intake`, pantry names, train gym dates) in the accepted `MissedWorkoutsRule`/`LoggingGapRule` style. Delivery is entirely unchanged: `FlagRaisedEvent` → `InterventionEventListener` → intervention library → advice card, day gate and severity contest included.

**Tech Stack:** Spring Boot backend (`backend/`), Liquibase SQL changesets, JUnit ITs extending `AbstractIntegrationTest`. **No frontend work in this slice.**

**Driving issue:** `mezo-d58h.7.1` (child of `mezo-d58h.7`). Branch: `feat/proactive-round2-s1-protocol-lapse`.

---

## Prerequisite: the spec is not on main yet

`docs/superpowers/specs/2026-09-05-proactive-coaching-round2-design.md` exists only as commit `c657f6e28` on the local branch `claude/mezo-d58h-round-2-64873e`. It has not been pushed and is not on `origin/main`.

- [ ] **Before Task 1:** cherry-pick it onto the S1 branch —
  `git cherry-pick c657f6e28` — so the plan's own reference resolves and the spec ships with the first slice that implements it. If it has already landed on main by the time you start, skip this (check with `git log origin/main --oneline -- docs/superpowers/specs/2026-09-05-proactive-coaching-round2-design.md`).

---

## The one thing that makes this slice dangerous

**"Due day" is not a column.** There is no schedule, frequency or due-date anywhere on `protocol_item` — an item is a pantry item placed in a zone (`slot_key`). Expectation is *derived*, and getting the derivation wrong is how this rule fabricates misses and scolds an innocent user. The derivation is already solved once in this codebase and **must be copied, not re-invented**: `feature/character/detector/StackSkipPatternDetector.java:113-121` (`expectedOn`) plus `CharacterSignalReads.gatherStack` at `:448-467`.

Three bounds, all load-bearing:

| Bound | Rule | What breaks without it |
|---|---|---|
| Peri-workout zones (`pre_workout`, `post_workout`) are due **only on a day with a completed gym session** | `StackSkipPatternDetector.expectedOn` | Every rest day reads as a miss; a 3-day-a-week trainee is permanently "lapsing" |
| The scan starts no earlier than the item's own `startedOn` (its `created_at` as a local date) | `StackSkipPatternDetector` §2 | An item added yesterday is announced as having been missed all week |
| The window ends **YESTERDAY**, never today | `MissedWorkoutsRule` (review fix `mezo-d58h.2`) | The 05:05 sweep calls an evening supplement "missed" before the evening has happened — and the card's whole tone ("resume today and the streak lives") is nonsense if today is already counted against you |

The second danger is the **five runtime-only mirrors** every new `FlagKey` needs (bd memory `adding-a-flagkey-needs-five-mirrored-changes`); three of them fail only at runtime and one fails at Spring context startup. Task 2 does all of them at once.

---

## Decisions already made — do not re-litigate

- **Per-item cooldown lives in the RULE, not in `FlagService`.** The spec asks for "cooldown 7 days per item", but `FlagService.evaluateAndLog` only knows per-*key* cooldowns (`existsRaiseSince(userId, flagKey, since)`), and widening that to a payload-aware gate would touch every rule. Instead: the key-level cooldown is a short **24h**, and `ProtocolLapseRule` itself reads its own recent `protocol_lapse` raises out of `companion_flag_log` and skips any item raised within `per-item-cooldown-days` (7). A rule reading the flag log has precedent — `AllHealthyRule` does it through `existsProblemRaiseSince`. The effect is exactly the spec's: one item is never re-announced within a week, while a *different* item lapsing tomorrow can still speak.
- **One item per raise.** Among all qualifying items, the raise names the one with the longest current missed-due-day streak; ties break on the lower `item_order`. Same "offender key alone" shape as `StackSkipPatternDetector`.
- **The item's NAME is frozen into the payload at raise time.** `AdviceFactRenderer` is a pure static renderer over `FlagPayloadEnvelope` — it has no repositories and must not grow any. The rule resolves the pantry catalog name once and stores it.
- **Severity rank: last of the flag block, directly after `late_eating`.** A missed supplement is the gentlest signal in the set and its copy is explicitly a grace-window nudge, so it must never displace a sleep-debt or bad-day card. This adds `FlagKey.PROTOCOL_LAPSE` at the end of the flag run in `AdvicePriority.ORDER`, immediately **before** `SetupCheckService.CHECK_MISSING_SLEEP_GOAL`. The existing round-1 order does not change at all.
- **`protocol_lapse` STAYS COUNTED in `existsProblemRaiseSince`** (i.e. it does *not* join the `all_healthy` exclusion list). The carve-outs there (`logging_gap`, `ignored_nudge`, `joint_overuse`) all share one argument: the signal is about the app's own data/nudging, or fires on a conjunction the user did nothing to earn. This rule is the opposite — it fires only after the user built a real ≥60% habit and then broke it twice running. That is a genuine behaviour signal, like `missed_workouts`. Write that reasoning into the query's javadoc as an extension of the existing argument, do not replace it.
- **Channel is `feed`, not `both`.** No push for a supplement miss; the spec's whole tone decision forbids escalation here.
- **No frontend, no contract, no new endpoint.** The card is delivered by machinery that already exists end to end.

---

## Global Constraints

- **Honesty gate is the default**: too little data, no active protocol, no items, no prior habit ⇒ `Optional.empty()`. Every gate gets its own silence test.
- **An unlogged day is never "compliant" and never "violating."** A day that is not *due* is skipped entirely (it never enters the denominator); a due day with no intake row IS a miss — that is the whole detection, and it is legitimate here precisely because `supplement_intake` is an append-only ledger where absence really does mean "not taken".
- **Every threshold is config** (`FlagProperties`, Bean-Validation ranges, `application.yml` defaults). No numbers in the rule class.
- `FlagEvaluator` has **no `List<FlagRule>` injection** — add a field and a call line in the fixed order. `AllHealthyRule` stays last and stays gated on `raises.isEmpty()`.
- Liquibase changesets are immutable; the new file is timestamped after the newest existing one (`202609051200_mezo-el0t_weekly_score_cache_invalidation.sql`) and registered in `1.0.0_master.yml`. CI's `lint` job runs `node scripts/lint-liquibase.mjs`.
- `companion_flag_log.flag_key` is `varchar(24)`; `protocol_lapse` is 14 characters — it fits.
- ArchUnit (CI): the rule lives in `companion/flags/service/rule`, constructor DI only, no class-level `@Transactional`, no `@Value`. The directions this rule needs — `companion → fuel`, `companion → pantry`, `companion → train` — **all already exist** (`companion/tools/FuelTools.java` for fuel+pantry, `MissedWorkoutsRule` for train), so no port inversion is required. Do not take that on trust: run the ArchUnit test.
- Backend runs REQUIRE `-Dmezo.test.use-testcontainers=true`, and Maven's OWN exit code — never a pipeline's. "Tests run: 0", or a `-Dtest` filter matching nothing, is a FAILURE to report, not a pass.
- Run everything from this worktree root; never `cd` to the primary repo. Commit subjects carry `(mezo-d58h.7.1)` plus the `Co-Authored-By:` trailer. Regenerate `docs/CODEMAP.md` in the same change as any new file, and AFTER any docs edit.

---

## File Structure

| File | Responsibility |
|---|---|
| `companion/flags/service/FlagKey.java` (M) | `PROTOCOL_LAPSE` constant |
| `companion/flags/config/FlagProperties.java` (M) | `ProtocolLapse` record + `CooldownHours.protocolLapse` + `forFlag` arm |
| `companion/flags/entity/CompanionFlagLogEntity.java` (M) | `@Pattern` mirror |
| `companion/config/CompanionProperties.java` (M) | `Intervention.flag` `@Pattern` mirror |
| `db/changelog/1.0.0/script/202609051600_mezo-d58h.7.1_flag_key_protocol_lapse.sql` (C) + `1.0.0_master.yml` (M) | DB CHECK mirror |
| `companion/flags/entity/FlagPayloadEnvelope.java` (M) | `ProtocolLapse` record + factory (**and the 13 existing factories' null lists**) |
| `companion/flags/repository/CompanionFlagLogRepository.java` (M) | recent-raises finder for the per-item cooldown + `existsProblemRaiseSince` javadoc |
| `companion/flags/service/rule/ProtocolLapseRule.java` (C) | the rule |
| `companion/flags/service/FlagEvaluator.java` (M) | one field + one call line |
| `proactive/service/AdvicePriority.java` (M) | one `ORDER` entry |
| `proactive/service/AdviceFactRenderer.java` (M) | one switch arm + one private renderer |
| `application.yml` (M) | threshold block, cooldown, intervention entry |
| `support/populator/ProtocolPopulator.java` (M, test) | `createProtocolItemAt` backdating seam |
| `feature/companion/flags/FlagEvaluatorProtocolLapseIT.java` (C, test) | the rule's ITs |
| `FlagPropertiesIT`, `CompanionFlagLogPersistenceIT`, `AdvicePriorityTest`, `AdviceFactRendererTest` (M, test) | mirrors + enumeration guards |
| `docs/features/companion.md`, `docs/features/proactive.md`, `docs/CODEMAP.md` (M) | docs |

---

### Task 1: the test seam for a backdated protocol item

**Files:**
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/ProtocolPopulator.java`

**Why first:** `ProtocolItemEntity.createdAt` is `@CreationTimestamp` on `OwnedEntity`, so a populator-built item is always "started today". The rule bounds its scan below by `startedOn`, and its prior-habit gate needs **≥7 due days of history** — so without a backdating seam *every* IT in Task 6 is structurally unable to fire, and the rule would look correct while being untestable. `TrainPopulator.createGymSlotAt:604` is the precedent (native `update … set created_at`), and `FlagLogPopulator.raiseAt` is the same idiom.

**Interfaces:**
- Produces: `ProtocolItemEntity createProtocolItemAt(UUID owner, UUID protocolId, UUID pantryItemId, String slotKey, String restDayFallback, Instant createdAt)`

- [ ] **Step 1: Add the `EntityManager` field and the method.** `ProtocolPopulator` has no `EntityManager` today; add the field-injected `@PersistenceContext` one exactly as `FlagLogPopulator` does (the house exception to constructor DI), and the `@Transactional` method:

```java
    /** JPA-managed shared EntityManager — the {@code created_at} backdate needs a native update;
     *  field-injected {@code @PersistenceContext} is the house exception to constructor DI
     *  (see {@code FlagLogPopulator}). */
    @PersistenceContext
    private EntityManager em;

    /** A protocol item with a controlled {@code created_at} — the protocol_lapse rule bounds its
     *  scan below by the item's own start date, so an item that "started today" can never have a
     *  history ({@code TrainPopulator.createGymSlotAt} precedent). */
    @Transactional
    public ProtocolItemEntity createProtocolItemAt(
        UUID owner, UUID protocolId, UUID pantryItemId, String slotKey, String restDayFallback,
        Instant createdAt) {
        ProtocolItemEntity item = createProtocolItem(owner, protocolId, pantryItemId, slotKey, restDayFallback);
        em.createNativeQuery("update protocol_item set created_at = :at where id = :id")
            .setParameter("at", createdAt).setParameter("id", item.getId()).executeUpdate();
        em.clear();
        return protocolItemRepository.findById(item.getId()).orElseThrow();
    }
```

- [ ] **Step 2: Prove the seam works** — add the assertion to an existing fuel/protocol IT that already autowires `ProtocolPopulator` (find one with `grep -rl ProtocolPopulator backend/src/test`); if none reads protocol items directly, create `backend/src/test/java/io/mrkuhne/mezo/support/populator/ProtocolPopulatorIT.java`. Either way it asserts the returned entity's `getCreatedAt()` is the backdated instant:

```java
    @Test
    void backdated_protocol_item_keeps_its_created_at() {
        UUID owner = userPopulator.createUser().getId();
        UUID pantry = pantryItemPopulator.createSupplement(owner, "Magnézium").getId();
        UUID protocolId = protocolPopulator.createActiveProtocol(owner).getId();
        Instant thirtyDaysAgo = LocalDate.now().minusDays(30)
            .atStartOfDay(ZoneId.systemDefault()).toInstant();

        ProtocolItemEntity item = protocolPopulator.createProtocolItemAt(
            owner, protocolId, pantry, "morning", null, thirtyDaysAgo);

        assertThat(item.getCreatedAt()).isEqualTo(thirtyDaysAgo);
    }
```

- [ ] **Step 3: Run it.** `./mvnw -Dmezo.test.use-testcontainers=true -Dtest=<the IT you put it in> test`. Expected: PASS. "Tests run: 0" means the `-Dtest` filter matched nothing — that is a failure, not a pass.

- [ ] **Step 4: Commit** — `test(fuel): backdating seam for protocol items (mezo-d58h.7.1)`

---

### Task 2: the flag key and every mirror, at once

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagKey.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/config/FlagProperties.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/entity/CompanionFlagLogEntity.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java`
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202609051600_mezo-d58h.7.1_flag_key_protocol_lapse.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdvicePriority.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/repository/CompanionFlagLogRepository.java`
- Modify: `backend/src/main/resources/application.yml` (cooldown only)
- Test: `FlagPropertiesIT`, `CompanionFlagLogPersistenceIT`, `AdvicePriorityTest`

**Interfaces:**
- Produces: `FlagKey.PROTOCOL_LAPSE == "protocol_lapse"`; `FlagProperties.CooldownHours.protocolLapse()`; `forFlag("protocol_lapse") == 24`.

- [ ] **Step 1: Write the failing tests first.** `AdvicePriorityTest.testOrder_shouldCoverEveryLiveFlagKey` already fails by reflection the moment the constant exists without a rank — no edit needed there. Add to `CompanionFlagLogPersistenceIT` (follow its existing `rawInsert` cases):

```java
    /** Round 2 S1 (mezo-d58h.7.1): the widened CHECK accepts protocol_lapse. */
    @Test
    void testRawInsert_shouldAcceptProtocolLapse() {
        UUID owner = userPopulator.createUser().getId();
        flagLogPopulator.rawInsert(owner, FlagKey.PROTOCOL_LAPSE, FlagKey.SOURCE_SWEEP);
        assertThat(repository.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(owner))
            .extracting(CompanionFlagLogEntity::getFlagKey)
            .contains(FlagKey.PROTOCOL_LAPSE);
    }
```

and to `FlagPropertiesIT`:

```java
    /** Round 2 S1 (mezo-d58h.7.1): key-level cooldown is deliberately SHORT (24h) — the 7-day
     *  "per item" cooldown the spec asks for lives inside ProtocolLapseRule, so a DIFFERENT item
     *  lapsing tomorrow is not starved by the first one's raise. */
    @Test
    void binds_the_protocol_lapse_cooldown() {
        assertThat(properties.cooldownHours().protocolLapse()).isEqualTo(24);
        assertThat(properties.cooldownHours().forFlag(FlagKey.PROTOCOL_LAPSE)).isEqualTo(24);
    }
```

- [ ] **Step 2: Run them — they must fail** (`FlagKey.PROTOCOL_LAPSE` does not compile yet; that is the expected first failure).

- [ ] **Step 3: Add all five mirrors.**

  1. `FlagKey.java`:
```java
    /** Round 2 S1 (bd mezo-d58h.7.1, spec 2026-09-05 §(11)): a protocol item missed on two
     *  consecutive due days after a real habit existed. */
    public static final String PROTOCOL_LAPSE = "protocol_lapse";
```
  2. `FlagProperties.CooldownHours`: add `@Min(1) @Max(8760) int protocolLapse` as the last component and `case "protocol_lapse" -> protocolLapse;` to `forFlag`.
  3. The changeset (drop + re-add, exactly the `mezo-d58h.6` file's shape):
```sql
-- Proactive coaching round 2, slice S1 (mezo-d58h.7.1, spec 2026-09-05 §(11)): the protocol_lapse
-- detection needs the companion_flag_log.flag_key CHECK widened. Liquibase changesets are
-- immutable — this replaces the constraint created by
-- 202609041200_mezo-d58h.6_flag_key_batch_b.sql rather than editing it.
alter table companion_flag_log
    drop constraint ck_companion_flag_log_flag_key;

alter table companion_flag_log
    add constraint ck_companion_flag_log_flag_key check (flag_key in
        ('sustained_stress', 'sleep_debt', 'momentum_at_risk', 'recovery_needed', 'all_healthy',
         'logging_gap', 'missed_workouts', 'acute_bad_day', 'load_fuel_mismatch',
         'rapid_weight_loss', 'joint_overuse', 'ignored_nudge', 'late_eating', 'protocol_lapse'));
```
     registered at the end of `1.0.0_master.yml`:
```yaml
  - changeSet:
      id: "1.0.0:202609051600_mezo-d58h.7.1_flag_key_protocol_lapse"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609051600_mezo-d58h.7.1_flag_key_protocol_lapse.sql
```
  4. `CompanionFlagLogEntity.flagKey`'s `@Pattern` — append `|protocol_lapse`.
  5. `CompanionProperties.Intervention.flag`'s `@Pattern` — append `|protocol_lapse`. **This one fails at Spring context startup**, not at runtime, the moment Task 5 adds the intervention entry.

- [ ] **Step 4: Add the `AdvicePriority.ORDER` entry.** `FlagKey.PROTOCOL_LAPSE` goes immediately after `FlagKey.LATE_EATING` and before `SetupCheckService.CHECK_MISSING_SLEEP_GOAL`. Nothing else moves. Extend the class javadoc with one sentence explaining why it sits at the tail of the flag block (gentlest signal, grace-window copy — it must never displace a health card).

- [ ] **Step 5: Add the cooldown default** to `application.yml` under `mezo.companion.flags.cooldown-hours`, with the comment explaining the split:
```yaml
        # Round 2 S1 (mezo-d58h.7.1): deliberately SHORT. The spec's "7 days per item" cooldown is
        # enforced inside ProtocolLapseRule against its own past raises' payloads; this key-level
        # value only stops the same evaluation repeating within a day, so a DIFFERENT item lapsing
        # tomorrow still gets a delivery window.
        protocol-lapse: 24
```

- [ ] **Step 6: Add the per-item-cooldown finder** to `CompanionFlagLogRepository` (used by Task 4) and extend `existsProblemRaiseSince`'s javadoc with the "stays counted" reasoning from the Decisions section — **the query itself does not change**:
```java
    /** Round 2 S1 (mezo-d58h.7.1): the raises of one flag since {@code since}, newest first — the
     *  seam ProtocolLapseRule uses to enforce a PER-ITEM cooldown out of its own frozen payloads,
     *  which FlagService's per-KEY gate cannot express. */
    List<CompanionFlagLogEntity> findByCreatedByAndFlagKeyAndDeletedFalseAndCreatedAtGreaterThanEqualOrderByCreatedAtDesc(
        UUID createdBy, String flagKey, Instant since);
```

- [ ] **Step 7: Run the gate.** `./mvnw -Dmezo.test.use-testcontainers=true -Dtest='FlagPropertiesIT,CompanionFlagLogPersistenceIT,AdvicePriorityTest,FlagServiceIT,FlagEvaluator*IT' test` plus `node scripts/lint-liquibase.mjs`. Expected: all PASS.

- [ ] **Step 8: Commit** — `feat(companion): protocol_lapse flag key and every mirror (mezo-d58h.7.1)`

---

### Task 3: the rule's config block

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/config/FlagProperties.java`
- Modify: `backend/src/main/resources/application.yml`
- Test: `FlagPropertiesIT`

**Interfaces:**
- Produces: `FlagProperties.protocolLapse()` returning `ProtocolLapse(int consecutiveMissedDays, int historyWindowDays, int minHistoryDueDays, double minHistoryAdherence, int perItemCooldownDays)`

- [ ] **Step 1: Write the failing binding test** in `FlagPropertiesIT`:

```java
    /** Round 2 S1 (mezo-d58h.7.1, spec 2026-09-05 §(11)). */
    @Test
    void binds_the_protocol_lapse_thresholds() {
        assertThat(properties.protocolLapse().consecutiveMissedDays()).isEqualTo(2);
        assertThat(properties.protocolLapse().historyWindowDays()).isEqualTo(30);
        assertThat(properties.protocolLapse().minHistoryDueDays()).isEqualTo(7);
        assertThat(properties.protocolLapse().minHistoryAdherence()).isEqualTo(0.60);
        assertThat(properties.protocolLapse().perItemCooldownDays()).isEqualTo(7);
    }
```

- [ ] **Step 2: Run it — expected FAIL** ("cannot find symbol: protocolLapse").

- [ ] **Step 3: Add the record and the component.** New component on `FlagProperties` after `lateEating`:
```java
    @NotNull @Valid ProtocolLapse protocolLapse
```
and the nested record:
```java
    /** Spec 2026-09-05 §(11): a protocol item missed on consecutive DUE days, but only where a
     *  real habit existed first. "Due" is derived, never stored — see {@code ProtocolLapseRule}. */
    public record ProtocolLapse(
        /** Fire only on the Nth consecutive missed due day; N-1 misses are implicit grace days. */
        @Min(2) @Max(14) int consecutiveMissedDays,
        /** How far back the prior-habit adherence is measured, ending the day before the miss run. */
        @Min(7) @Max(90) int historyWindowDays,
        /** Honest small-n gate: fewer DUE days than this inside the history window ⇒ no habit to
         *  lose, so no flag (a freshly added item can never lapse). */
        @Min(1) @Max(90) int minHistoryDueDays,
        /** Taken/due ratio in the history window at or above which a live streak is credited. */
        @DecimalMin("0.0") @DecimalMax("1.0") double minHistoryAdherence,
        /** The spec's per-ITEM cooldown, enforced inside the rule against its own past raises —
         *  FlagService's cooldown is per key and cannot express this. */
        @Min(1) @Max(90) int perItemCooldownDays
    ) {
    }
```

- [ ] **Step 4: Add the YAML defaults** under `mezo.companion.flags`, after the `late-eating` block:
```yaml
      protocol-lapse:
        # Round 2 S1 (mezo-d58h.7.1, spec 2026-09-05 §(11)). The FIRST missed due day is an
        # implicit grace day and never speaks — Duolingo's streak-freeze pattern, adopted
        # deliberately: this card's job is "resume today and the streak lives", not "you broke it".
        consecutive-missed-days: 2
        # A habit must have EXISTED before it can lapse: >=7 due days of history at >=60%
        # adherence inside the 30 days before the miss run. A brand-new item is silent by
        # construction, and so is an item that was never really taken.
        history-window-days: 30
        min-history-due-days: 7
        min-history-adherence: 0.60
        # Per-ITEM re-announce guard, enforced in the rule (see the cooldown-hours comment).
        per-item-cooldown-days: 7
```

- [ ] **Step 5: Run** `-Dtest=FlagPropertiesIT`. Expected: PASS.

- [ ] **Step 6: Commit** — `feat(companion): protocol_lapse thresholds in config (mezo-d58h.7.1)`

---

### Task 4: the payload record

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/entity/FlagPayloadEnvelope.java`
- Test: `AdviceFactRendererTest` (fixture only; the renderer arm is Task 5)

**Watch out:** the envelope is a 13-component record where **every one of the 13 static factories passes a positional null list**. Adding a 14th component means editing all 13 of those lines. Miss one and it will not compile — which is the safe failure, so just work through them.

**Interfaces:**
- Produces:
```java
FlagPayloadEnvelope.ProtocolLapse(
    String pantryItemId, String itemName, String slotKey,
    int consecutiveMissedDueDays, int threshold,
    List<String> missedDueDates, String lastTakenDate,
    int historyDueDays, int historyTakenDays,
    double historyAdherence, double minHistoryAdherence)
FlagPayloadEnvelope.protocolLapse(ProtocolLapse p)
```

- [ ] **Step 1: Add the record** as the 14th component (`ProtocolLapse protocolLapse`) with its javadoc:
```java
    /** Round 2 S1 (mezo-d58h.7.1, spec 2026-09-05 §(11)). {@code pantryItemId} is the offending
     *  item's id as a STRING (jsonb keys and values are text, and the per-item cooldown compares
     *  it as text); {@code itemName} is frozen at raise time so {@code AdviceFactRenderer} — a
     *  pure static renderer with no repositories — can name the supplement. Dates are ISO-8601
     *  strings. {@code lastTakenDate} is null when the item was never taken inside the history
     *  window (which the prior-habit gate makes impossible in practice, but the payload does not
     *  assume the gate). */
    public record ProtocolLapse(
        String pantryItemId, String itemName, String slotKey,
        int consecutiveMissedDueDays, int threshold,
        List<String> missedDueDates, String lastTakenDate,
        int historyDueDays, int historyTakenDays,
        double historyAdherence, double minHistoryAdherence) {
    }
```

- [ ] **Step 2: Add the factory** and extend all 13 existing factories with a trailing `, null`:
```java
    public static FlagPayloadEnvelope protocolLapse(ProtocolLapse p) {
        return new FlagPayloadEnvelope(null, null, null, null, null, null, null, null, null, null, null, null, null, p);
    }
```

- [ ] **Step 3: Add the fixture** to `AdviceFactRendererTest.fixtureFor` so the reflection guard `testRender_shouldCoverEveryLiveFlagKey` has something to render:
```java
            case FlagKey.PROTOCOL_LAPSE -> FlagPayloadEnvelope.protocolLapse(
                new FlagPayloadEnvelope.ProtocolLapse("11111111-1111-1111-1111-111111111111",
                    "Magnézium", "evening", 2, 2,
                    List.of("2026-09-03", "2026-09-04"), "2026-09-02", 14, 12, 0.857, 0.60));
```

- [ ] **Step 4: Run** `-Dtest=AdviceFactRendererTest`. Expected: **FAIL** on the enumeration guard, because `protocol_lapse` has no renderer arm yet and renders empty. That failure is the handoff to Task 5 — do not paper over it.

- [ ] **Step 5: Commit** — `feat(companion): protocol_lapse payload envelope (mezo-d58h.7.1)`

---

### Task 5: the fact renderer arm and the intervention entry

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdviceFactRenderer.java`
- Modify: `backend/src/main/resources/application.yml`
- Test: `AdviceFactRendererTest`

**Interfaces:**
- Consumes: `FlagPayloadEnvelope.ProtocolLapse` (Task 4).

- [ ] **Step 1: Write the failing renderer test:**

```java
    /** Round 2 S1 (mezo-d58h.7.1): the facts name the item, the two missed days and the habit the
     *  user actually had — the card's copy leans on all three ("a sorozat nem veszett el"). */
    @Test
    void testRender_shouldRenderProtocolLapseFacts() {
        FlagPayloadEnvelope payload = FlagPayloadEnvelope.protocolLapse(
            new FlagPayloadEnvelope.ProtocolLapse("11111111-1111-1111-1111-111111111111",
                "Magnézium", "evening", 2, 2,
                List.of("2026-09-03", "2026-09-04"), "2026-09-02", 14, 12, 0.857, 0.60));

        List<String> facts = AdviceFactRenderer.render(FlagKey.PROTOCOL_LAPSE, payload);

        assertThat(facts).anySatisfy(f -> assertThat(f).contains("Magnézium"));
        assertThat(facts).anySatisfy(f -> assertThat(f).contains("2026-09-04"));
        assertThat(facts).anySatisfy(f -> assertThat(f).contains("2026-09-02"));
        assertThat(facts).anySatisfy(f -> assertThat(f).contains("86"));
    }
```

- [ ] **Step 2: Run it — expected FAIL** (empty list from the `default ->` arm).

- [ ] **Step 3: Add the switch arm and the renderer.** Arm, after `case FlagKey.LATE_EATING`:
```java
            case FlagKey.PROTOCOL_LAPSE -> protocolLapse(payload.protocolLapse());
```
Renderer (Hungarian locale, decimal comma, same shape as its siblings):
```java
    private static List<String> protocolLapse(FlagPayloadEnvelope.ProtocolLapse p) {
        if (p == null) {
            return List.of();
        }
        List<String> facts = new ArrayList<>();
        facts.add("Kiegészítő: %s%s".formatted(p.itemName(),
            p.slotKey() == null ? "" : " (%s zóna)".formatted(p.slotKey())));
        facts.add("Kimaradt %d egymást követő tervezett napon: %s"
            .formatted(p.consecutiveMissedDueDays(), String.join(", ", p.missedDueDates())));
        facts.add(p.lastTakenDate() == null
            ? "Az ablakon belül nincs rögzített bevétel"
            : "Utoljára ekkor volt bevéve: %s".formatted(p.lastTakenDate()));
        facts.add("Előtte %d tervezett napból %d teljesült (%s%%, küszöb: %s%%)"
            .formatted(p.historyDueDays(), p.historyTakenDays(),
                String.format(HU, "%.0f", p.historyAdherence() * 100),
                String.format(HU, "%.0f", p.minHistoryAdherence() * 100)));
        return facts;
    }
```

- [ ] **Step 4: Add the intervention-library entry** at the end of `mezo.companion.interventions` in `application.yml`:
```yaml
      # Round 2 S1 (mezo-d58h.7.1, spec 2026-09-05 §(11)): a kiegészítő két egymás utáni tervezett
      # napon kimaradt, de előtte valódi szokás volt. A hangnem szándékosan grace-window (Duolingo
      # streak-freeze): a sorozat ÉL, csak folytatni kell. channel: feed — egy kimaradt kiegészítő
      # nem érdemel pusht. A konkrét készítmény nevét a tények blokk mondja meg, nem ez a szöveg.
      - key: protocol_lapse_resume
        flag: protocol_lapse
        channel: feed
        text-hu: "Az egyik kiegészítőd két egymás utáni tervezett napon kimaradt — pedig előtte hetekig stabilan ment. A sorozat nem veszett el: vedd be ma, és onnantól ott folytatod, ahol abbahagytad. Ha viszont szándékosan hagytad el, nyugodtan vedd ki a stackből, és nem szólok érte többet."
        cooldown-hours: 168
        quiet-hours-exempt: false
```

- [ ] **Step 5: Run** `-Dtest='AdviceFactRendererTest,CompanionPropertiesIT'` — and start the context at least once (any IT does it) to prove the `Intervention.flag` `@Pattern` widening from Task 2 actually took, since a missed widening kills startup here and nowhere earlier. Expected: PASS.

- [ ] **Step 6: Commit** — `feat(proactive): protocol_lapse facts and intervention copy (mezo-d58h.7.1)`

---

### Task 6: the rule

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/rule/ProtocolLapseRule.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagEvaluator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/FlagEvaluatorProtocolLapseIT.java`

**Interfaces:**
- Consumes: `FlagProperties.protocolLapse()` (Task 3), `FlagPayloadEnvelope.protocolLapse(...)` (Task 4), `CompanionFlagLogRepository.findByCreatedByAndFlagKeyAndDeletedFalseAndCreatedAtGreaterThanEqualOrderByCreatedAtDesc` (Task 2), `ProtocolPopulator.createProtocolItemAt` (Task 1).
- Produces: `Optional<FlagRaise>` carrying `FlagKey.PROTOCOL_LAPSE`.

**Read first:** `StackSkipPatternDetector.java` (the due-day derivation), `MissedWorkoutsRule.java` (the window-ends-yesterday and created-at-clamp shapes), `LateEatingRule.java` (the class javadoc/trap-documentation standard this repo holds rules to).

**The algorithm, once, precisely:**

1. `protocolRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active")` → empty ⇒ `Optional.empty()`.
2. `protocolItemRepository.findByProtocolIdAndDeletedFalseOrderByItemOrderAsc(protocol.getId())` → empty ⇒ `Optional.empty()`.
3. `to = today.minusDays(1)`; `from = to.minusDays(cfg.historyWindowDays() + cfg.consecutiveMissedDays())` — wide enough to hold both the miss run and the history window behind it.
4. Gym dates: `workoutSessionRepository.findDoneInstanceDates(userId, from, to)` into a `Set<LocalDate>`.
5. Intakes: `supplementIntakeRepository.findByCreatedByAndDeletedFalseAndTakenDateGreaterThanEqualOrderByTakenDateAscTakenAtAsc(userId, from)`, upper-bounded to `to` **in memory** (the finder bounds only below — the `CharacterSignalReads.gatherStack` precedent), collected into `Map<LocalDate, Set<UUID>> takenByDate`.
6. Suppressed items: read `protocol_lapse` raises since `Instant.now().minus(cfg.perItemCooldownDays(), ChronoUnit.DAYS)` and collect each row's `payload().protocolLapse().pantryItemId()` (null-safe on both) into a `Set<String>`.
7. Per item, skipped if suppressed:
   - `startedOn` = `item.getCreatedAt().atZone(ZoneId.systemDefault()).toLocalDate()` (null `createdAt` ⇒ skip the item).
   - **Miss run:** walk backwards from `to`; skip non-due days entirely; stop at the first due day that HAS an intake, or when the day drops below `startedOn`. Count the leading due days with no intake. `< cfg.consecutiveMissedDays()` ⇒ this item does not qualify.
   - **Prior habit:** let `historyEnd` be the last due day strictly before the miss run's earliest missed day. Walk back from `historyEnd` to `max(historyEnd.minusDays(cfg.historyWindowDays() - 1), startedOn)`, counting due days and taken days. Require `dueDays >= cfg.minHistoryDueDays()` and `taken / due >= cfg.minHistoryAdherence()`.
8. Offender: the qualifying item with the longest miss run; tie-break the lower `item_order` (iteration is already in that order, so keep a strict `>` comparison).
9. Name: `pantryItemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc(userId)` → id→`getCatalog().getName()` map, defaulting to `"ismeretlen kiegészítő"` (the `CharacterSignalReads` default).
10. Raise with the full payload.

Due-day predicate, copied deliberately:
```java
    /** Copied from {@code StackSkipPatternDetector.expectedOn} (character), on purpose and not
     *  shared: a peri-workout item on a rest day is not a miss — it either displaces to its
     *  {@code restDayFallback} zone or is deliberately dropped. Extracting a shared helper would
     *  put a fuel-domain rule in a third feature; the duplication is one predicate and both copies
     *  name each other. */
    private static boolean dueOn(ProtocolItemEntity item, LocalDate date, Set<LocalDate> gymDates) {
        if (item.getSlotKey() != null && PERI_WORKOUT_ZONES.contains(item.getSlotKey())) {
            return gymDates.contains(date);
        }
        return true;
    }
```
with `private static final Set<String> PERI_WORKOUT_ZONES = Set.of("pre_workout", "post_workout");`

The class carries `@Component @RequiredArgsConstructor @ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")` and a javadoc that states the three bounds (peri-workout, `startedOn`, window-ends-yesterday) and the per-item-cooldown decision in the `LateEatingRule` "Trap N" style.

- [ ] **Step 1: Write the failing ITs.** New `FlagEvaluatorProtocolLapseIT extends AbstractIntegrationTest`, following `FlagEvaluatorLateEatingIT`'s idiom (a `keys(owner)` helper over `evaluator.evaluate(owner)`, a `payload(owner)` helper, populator fixtures). Autowire `FlagEvaluator`, `UserPopulator`, `PantryItemPopulator`, `ProtocolPopulator`, `SupplementIntakePopulator`, `TrainPopulator`, `FlagLogPopulator`, and `ProtocolRepository` (the last test re-reads the owner's active protocol id).

Shared fixture helper — an item started 40 days ago, taken on every due day in `[start, throughDay]`:

```java
    private static final LocalDate TODAY = LocalDate.now();

    private record Fixture(UUID owner, UUID pantryItemId) {}

    /** An item in a NON-peri zone (due every day), started 40 days ago, with intakes logged on
     *  every day from 30 days ago through {@code lastTaken} inclusive. */
    private Fixture habitItem(String name, String slotKey, LocalDate lastTaken) {
        UUID owner = userPopulator.createUser().getId();
        UUID pantry = pantryItemPopulator.createSupplement(owner, name).getId();
        UUID protocolId = protocolPopulator.createActiveProtocol(owner).getId();
        protocolPopulator.createProtocolItemAt(owner, protocolId, pantry, slotKey, null,
            TODAY.minusDays(40).atStartOfDay(ZoneId.systemDefault()).toInstant());
        for (LocalDate d = TODAY.minusDays(30); !d.isAfter(lastTaken); d = d.plusDays(1)) {
            supplementIntakePopulator.createIntake(owner, pantry, d, slotKey);
        }
        return new Fixture(owner, pantry);
    }
```

The nine tests:

```java
    /** The detection: due yesterday and the day before, missed both, after a month of taking it. */
    @Test
    void raises_on_the_second_consecutive_missed_due_day() {
        Fixture f = habitItem("Magnézium", "evening", TODAY.minusDays(3));

        assertThat(keys(f.owner())).contains(FlagKey.PROTOCOL_LAPSE);
        assertThat(payload(f.owner())).hasValueSatisfying(p -> {
            assertThat(p.itemName()).isEqualTo("Magnézium");
            assertThat(p.consecutiveMissedDueDays()).isEqualTo(2);
            assertThat(p.missedDueDates())
                .containsExactly(TODAY.minusDays(2).toString(), TODAY.minusDays(1).toString());
            assertThat(p.lastTakenDate()).isEqualTo(TODAY.minusDays(3).toString());
        });
    }

    /** ONE missed day is an implicit grace day — the rule never speaks on it. */
    @Test
    void stays_silent_on_a_single_missed_due_day() {
        Fixture f = habitItem("Magnézium", "evening", TODAY.minusDays(2));

        assertThat(keys(f.owner())).doesNotContain(FlagKey.PROTOCOL_LAPSE);
    }

    /** Today is still in progress: an item taken through yesterday, with nothing logged today,
     *  is NOT lapsing. This is the window-ends-yesterday bound. */
    @Test
    void stays_silent_when_only_today_is_missing() {
        Fixture f = habitItem("Magnézium", "evening", TODAY.minusDays(1));

        assertThat(keys(f.owner())).doesNotContain(FlagKey.PROTOCOL_LAPSE);
    }

    /** A freshly added item has no habit to lose: started 3 days ago, missed the last two, but
     *  fewer than min-history-due-days of history exist. */
    @Test
    void stays_silent_when_the_item_is_too_new_to_have_a_habit() {
        UUID owner = userPopulator.createUser().getId();
        UUID pantry = pantryItemPopulator.createSupplement(owner, "Kreatin").getId();
        UUID protocolId = protocolPopulator.createActiveProtocol(owner).getId();
        protocolPopulator.createProtocolItemAt(owner, protocolId, pantry, "morning", null,
            TODAY.minusDays(3).atStartOfDay(ZoneId.systemDefault()).toInstant());
        supplementIntakePopulator.createIntake(owner, pantry, TODAY.minusDays(3), "morning");

        assertThat(keys(owner)).doesNotContain(FlagKey.PROTOCOL_LAPSE);
    }

    /** A habit that never really existed: 30 due days, taken on only 9 of them (30%), then two
     *  misses. Below min-history-adherence ⇒ silence. */
    @Test
    void stays_silent_when_prior_adherence_was_below_the_threshold() {
        UUID owner = userPopulator.createUser().getId();
        UUID pantry = pantryItemPopulator.createSupplement(owner, "Cink").getId();
        UUID protocolId = protocolPopulator.createActiveProtocol(owner).getId();
        protocolPopulator.createProtocolItemAt(owner, protocolId, pantry, "evening", null,
            TODAY.minusDays(40).atStartOfDay(ZoneId.systemDefault()).toInstant());
        for (int i = 3; i <= 30; i += 3) {
            supplementIntakePopulator.createIntake(owner, pantry, TODAY.minusDays(i), "evening");
        }

        assertThat(keys(owner)).doesNotContain(FlagKey.PROTOCOL_LAPSE);
    }

    /** No active protocol at all is setup-check territory, never a lapse. */
    @Test
    void stays_silent_when_there_is_no_active_protocol() {
        UUID owner = userPopulator.createUser().getId();

        assertThat(keys(owner)).doesNotContain(FlagKey.PROTOCOL_LAPSE);
    }

    /** A peri-workout item is not DUE on a rest day, so two trainingless days are not two misses.
     *  The fixture logs no completed workouts at all. */
    @Test
    void stays_silent_when_the_missed_days_were_rest_days_for_a_peri_workout_item() {
        Fixture f = habitItem("BCAA", "post_workout", TODAY.minusDays(3));

        assertThat(keys(f.owner())).doesNotContain(FlagKey.PROTOCOL_LAPSE);
    }

    /** The per-ITEM cooldown: a raise for this item 3 days ago suppresses it, even though the
     *  key-level cooldown (24h) has long expired. */
    @Test
    void stays_silent_when_the_same_item_was_already_announced_inside_the_per_item_cooldown() {
        Fixture f = habitItem("Magnézium", "evening", TODAY.minusDays(3));
        flagLogPopulator.raiseAt(f.owner(), FlagKey.PROTOCOL_LAPSE, FlagKey.SOURCE_SWEEP,
            FlagPayloadEnvelope.protocolLapse(new FlagPayloadEnvelope.ProtocolLapse(
                f.pantryItemId().toString(), "Magnézium", "evening", 2, 2,
                List.of(), null, 14, 12, 0.857, 0.60)),
            Instant.now().minus(3, ChronoUnit.DAYS));

        assertThat(keys(f.owner())).doesNotContain(FlagKey.PROTOCOL_LAPSE);
    }

    /** ...but a DIFFERENT item is not suppressed by that raise — this is why the key-level
     *  cooldown is 24h and the 7-day guard is per item. */
    @Test
    void still_raises_for_a_different_item_inside_the_per_item_cooldown() {
        Fixture f = habitItem("Magnézium", "evening", TODAY.minusDays(3));
        UUID other = pantryItemPopulator.createSupplement(f.owner(), "D3-vitamin").getId();
        UUID protocolId = protocolRepository
            .findByCreatedByAndStatusAndDeletedFalse(f.owner(), "active").orElseThrow().getId();
        protocolPopulator.createProtocolItemAt(f.owner(), protocolId, other, "morning", null,
            TODAY.minusDays(40).atStartOfDay(ZoneId.systemDefault()).toInstant());
        for (LocalDate d = TODAY.minusDays(30); !d.isAfter(TODAY.minusDays(3)); d = d.plusDays(1)) {
            supplementIntakePopulator.createIntake(f.owner(), other, d, "morning");
        }
        flagLogPopulator.raiseAt(f.owner(), FlagKey.PROTOCOL_LAPSE, FlagKey.SOURCE_SWEEP,
            FlagPayloadEnvelope.protocolLapse(new FlagPayloadEnvelope.ProtocolLapse(
                f.pantryItemId().toString(), "Magnézium", "evening", 2, 2,
                List.of(), null, 14, 12, 0.857, 0.60)),
            Instant.now().minus(3, ChronoUnit.DAYS));

        assertThat(payload(f.owner())).hasValueSatisfying(p ->
            assertThat(p.itemName()).isEqualTo("D3-vitamin"));
    }
```

- [ ] **Step 2: Run them — expected FAIL.** Every test that expects a raise fails; the silence tests will pass vacuously (the rule does not exist), which is exactly why the raise tests must exist first.

- [ ] **Step 3: Write `ProtocolLapseRule`** to the algorithm above, then add the field and the call line to `FlagEvaluator`. Place the call **after `lateEatingRule`** and before `sustainedStressRule`, matching the severity intent (the evaluator's order is documentation as much as behaviour; `AllHealthyRule` stays last inside the `raises.isEmpty()` guard):
```java
    private final ProtocolLapseRule protocolLapseRule;
    ...
        protocolLapseRule.evaluate(userId, today).ifPresent(raises::add);
```

- [ ] **Step 4: Run** `./mvnw -Dmezo.test.use-testcontainers=true -Dtest=FlagEvaluatorProtocolLapseIT test`. Expected: all nine PASS. If the rest-day test is the one that fails, you took the peri-workout branch out — re-read `dueOn`.

- [ ] **Step 5: Run the neighbours** — `-Dtest='FlagEvaluator*IT,FlagServiceIT,FlagEvaluationListenerIT,AdviceCardServiceIT'` — the new call line runs for every user in every existing flag IT, so a rule that throws (rather than returning empty) on a user with no protocol shows up here, not in Task 6's own file.

- [ ] **Step 6: Commit** — `feat(companion): protocol_lapse detection (mezo-d58h.7.1)`

---

### Task 7: the switch-off proof

**Files:**
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/ProtocolLapseRuleSwitchOffIT.java`

Per the house pattern (`FlagSweepJobSwitchOffIT`), the `COMPANION_SWITCH` guard on the rule bean must be proven, not assumed.

- [ ] **Step 1: Write it:**
```java
/** Round 2 S1 (mezo-d58h.7.1): companion switch off ⇒ no protocol-lapse rule bean, so the whole
 *  detection is genuinely absent rather than silently evaluating. */
@TestPropertySource(properties = FeaturesConfiguration.COMPANION_SWITCH + "=false")
class ProtocolLapseRuleSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;

    @Test
    void testContext_shouldHaveNoRuleBean_whenCompanionSwitchOff() {
        assertThat(context.getBeanProvider(ProtocolLapseRule.class).getIfAvailable()).isNull();
    }
}
```
**Check first** how the sibling switch-off ITs spell the property — `FeaturesConfiguration.COMPANION_SWITCH` is a constant; if it cannot be used inside the annotation, inline the literal exactly as the existing switch-off ITs do.

- [ ] **Step 2: Run it.** Expected: PASS.

- [ ] **Step 3: Commit** — `test(companion): protocol_lapse switch-off proof (mezo-d58h.7.1)`

---

### Task 8: docs + CODEMAP + the full gate

**Files:**
- Modify: `docs/features/companion.md` — the flag-rule list around `:1553` (`LateEatingRule`'s entry is the template), the config-keys table at `:3839`, the detections table at `:3928`, and the `existsProblemRaiseSince` note at `:3943`.
- Modify: `docs/features/proactive.md` — the intervention library / advice-card sections (the new `protocol_lapse_resume` entry and its severity rank).
- Modify: `docs/CODEMAP.md` (generated).

**Edit the right sections; never append a changelog.** Bump both files' frontmatter `updated:` to the day you ship.

- [ ] **Step 1:** Write the docs. Say explicitly, in `companion.md`, that "due day" is derived (peri-workout ⇒ gym days only; bounded below by the item's `created_at`; window ends yesterday) and that the per-item cooldown lives inside the rule while the key-level cooldown is 24h — those three facts are what a future reader will otherwise re-derive wrong.
- [ ] **Step 2:** `node scripts/gen-codemap.mjs` then `node scripts/gen-codemap.mjs --check` — **in that order**, and after the docs edits (a frontmatter bump drifts the map).
- [ ] **Step 3:** `node scripts/lint-liquibase.mjs`.
- [ ] **Step 4:** Full backend suite: `./mvnw clean test -Dmezo.test.use-testcontainers=true`, reading **Maven's own exit code**. Report the real numbers.
- [ ] **Step 5: Commit** — `docs(companion,proactive): document the protocol_lapse detection (mezo-d58h.7.1)`

---

### Task 9: ship

- [ ] Push the branch, open the self-PR, wait for CI green (`gh pr checks --watch`; "no checks reported" means the PR is CONFLICTING — merge `origin/main` into the branch and push).
- [ ] `git pull --rebase` on main **before** merging, then merge the feature branch with `--no-ff` and push main directly. Never `cd` to the primary repo — use a temp branch off `origin/main` inside this worktree.
- [ ] If main moved, regenerate the CODEMAP on the merge commit.
- [ ] Delete the branch; `bd close mezo-d58h.7.1`; `bd dolt push`; `git status` must show up to date with origin.
- [ ] Hand off: S2 is the hydration prompt fact + the 15:00 checkpoint — a different genre (prompt facts, not cards), so nothing from this slice is a prerequisite beyond the spec itself now being on main.

---

## Self-review notes (for the executor)

- **Spec coverage:** §a (flag-rule genre, the full round-1 recipe) → Tasks 2-7. §(11)'s trigger logic — 2 consecutive missed due days, ≥7 days of history at ≥60%, grace-day silence, 7-day per-item cooldown, empty protocol ⇒ silence, "streak still lives" tone → Task 3 (thresholds), Task 5 (copy), Task 6 (logic + one test per clause). §"Error handling and edge cases" — silence by default, the CHECK widening, the switch-off IT, `AdvicePriority` mandatory extension → Tasks 2, 6, 7. §"Testing strategy" per-rule IT shape (fires / grace day / too-little-data silence / cooldown / switch-off) → Tasks 6 and 7, one test each. **Not in this slice, by the spec's own slicing:** items (9), (12), (13), (15), (17), (18) — S2 through S6.
- **One spec detail deliberately reinterpreted:** the spec says "no `SupplementIntakeEntity` row for the due day", which is what the rule does — but the spec never defines *due day*, because no schedule column exists. The definition above (peri-workout ⇒ gym days, everything else daily, bounded by `startedOn`) is imported wholesale from `StackSkipPatternDetector`, the only place in the codebase that has already answered this question. If the executor finds a *different* answer already live somewhere, that one wins — say so in the task report rather than shipping two derivations.
- **The riskiest steps**, in order: Task 6 (three derived bounds, any one of which fabricates misses if dropped); Task 2 (five mirrors, three runtime-only and one context-startup-only); Task 4 (a 14th envelope component means editing 13 unrelated factory lines — compile-safe, but tedious enough to invite a shortcut).
- **If a step's verbatim code does not compile against the file you are editing, the FILE wins** — read it, adapt, and say so in your task report. Everything here was read from this worktree on 2026-09-05.
