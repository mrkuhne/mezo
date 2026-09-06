# Proactive Coaching Round 2 · S6 — Midday Energy Dip vs Meal Timing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `energy_dip_meal_timing` flag — the round-2 spec's item (15), the last deferred detection — so that a user whose early-afternoon energy reliably tracks *when* (or *whether*) they ate that morning gets **one correlation card, roughly once a month at most**, phrased as an observation about their own data and never as a causal claim or an instruction.

**Architecture:** Slice S6 of `docs/superpowers/specs/2026-09-05-proactive-coaching-round2-design.md` §a / §(15). One new `FlagRule` in `companion/flags/service/rule/`, called by the existing fixed-order `FlagEvaluator` sweep, with cross-feature repository reads (biometrics `check_in`, meal `meal`) in the accepted `LoggingGapRule`/`MealRhythmDriftRule` style. Delivery is entirely unchanged: `FlagRaisedEvent` → `InterventionEventListener` → intervention library → advice card, day gate and severity contest included.

**Tech Stack:** Spring Boot backend (`backend/`), Liquibase SQL changesets, JUnit ITs extending `AbstractIntegrationTest`. **No frontend work in this slice, no contract change, no new endpoint.**

**Driving issue:** `mezo-d58h.7.7` (child of `mezo-d58h.7`). Branch: `feat/proactive-round2-s6-energy-dip`.

---

## The four things that make this slice dangerous

**1. This rule makes a CORRELATION claim, and correlation claims are the easiest thing in the system to turn into a lie.** Everything below — the minimum group sizes, the median-of-medians, the superiority guard, the 30-day cooldown — exists to keep the card from saying "eating earlier gives you energy". The rule may only ever report *what the user's own log looks like when split two ways*. The intervention copy in this plan is written that way on purpose (`jellemzően`, `azokon a napokon`, never `mert` / `ezért` / `attól`), and the fact lines name both group sizes so the reader can see how thin the sample is. Do not "tighten" that copy into advice.

**2. The spec's day gate says "AND a logged morning meal", and taken literally it destroys the spec's own fallback.** The spec asks for a fallback split on *breakfast present/absent* — impossible if every day in the sample is required to carry a morning meal, since the "absent" group would always be empty. **Resolution (decided, do not re-litigate): the day-level gate is "the day carries at least one logged meal of ANY kind".** That is what the gate is actually *for*: it is the adherence-neutral proof that the day's meal log is not simply missing, so "no breakfast row" can honestly be read as "did not eat breakfast" rather than "did not log". The per-arm gates then do the real work — the lunch arm needs a lunch row with a wall-clock time, the breakfast arm needs the day to have meal data at all. This is a deliberate, documented deviation from the spec's wording in service of the spec's intent; §9 of `docs/features/companion.md` records it in Task 6.

**3. A median split can be degenerate, and a degenerate split invents a finding.** If every lunch in the window is logged at 13:00, the median is 13:00, "strictly before the median" is empty and "at or after" is everything — a 0-vs-N split that any naive delta computation will happily read as a huge difference (or crash on an empty median). The rule therefore requires, per arm: `minGroupDays` days on **each** side, and — for the lunch arm only — that the two groups' own median lunch times are at least `minLunchSplitSeparationMinutes` apart. Failing either is exactly the spec's "lunch times don't vary" condition, and the ONLY thing that unlocks the breakfast fallback.

**4. Two medians differing is not a pattern.** With n≈5 per group, two medians a point apart happen by accident constantly. The consistency requirement the spec words as "differ by at least 1 full point consistently" is implemented as the **common-language effect size** (the Mann–Whitney probability of superiority): the share of all cross-group day pairs in which the higher group's day really is higher (ties count half), oriented so it always lands in `[0.5, 1.0]`. It must reach `minSuperiority` (0.70). This is the direct analogue of S4's `minSameDirectionShare` — same job, right statistic for two independent groups.

And the standing trap: a new `FlagKey` needs **five runtime-only mirrors** (bd memory `adding-a-flagkey-needs-five-mirrored-changes`) plus, since `mezo-6269.1`, a **sixth** on `companion_flag_trace`, plus `FlagCatalog` (`mezo-d58h.7.1`). Task 1 does all of them at once, and three reflection-driven guards (`AdvicePriorityTest`, `FlagCatalogTest`, `InterventionConfigIT`) will fail the build until every one is in place — that is the design, not a nuisance.

---

## Decisions already made — do not re-litigate

- **One flag key, two split MODES, one payload record with a `splitMode` discriminator** (`"lunch_time"` / `"breakfast_presence"`), the `meal_rhythm_drift` `subType` precedent. The breakfast mode is a FALLBACK: it is only attempted when the lunch split is unusable.
- **The day's afternoon energy is the MEDIAN of that day's check-ins inside the window**, not the first one. Several afternoon check-ins are a richer reading of the same afternoon, and a median is what the rest of this rule speaks in.
- **The afternoon window is inclusive on both ends** and configured as whole HOURS (`afternoon-from-hour: 11`, `afternoon-to-hour: 16`): a `slotTime` of `16:00` counts, `16:15` does not. Hours, not `HH:mm` strings, because Bean Validation can range-check an int and cannot range-check a time string.
- **`slotTime` is a wall-clock `HH:mm` string** on `check_in` and `loggedAt` is an instant read in the system zone (`MealRhythmDriftRule`'s convention, the spec's timezone note). No UTC conversion games, no `LateEatingRule` +24 shift — nothing here compares across midnight: an afternoon check-in and a lunch cannot wrap.
- **The day's lunch time is the EARLIEST `meal` row with `slot = "lunch"` that day** (S4's "a plan slot names one eating event" precedent).
- **Group A is always the one the spec's sentence starts with** — `earlier_lunch` in lunch mode, `with_breakfast` in breakfast mode — so the payload reads the same way the card does. `higherGroup` names which of A/B actually came out higher, so the renderer never has to re-derive it.
- **Window ends YESTERDAY, never today** (`MissedWorkoutsRule` / `ProtocolLapseRule` / `MealRhythmDriftRule`). Today's afternoon may not have happened yet.
- **Cooldown is key-level 720 hours (30 days)** — the spec's "effectively a one-off insight card". The intervention-library entry's own `cooldown-hours` **MUST also be 720**: `InterventionService.deliverForFlag` applies the LIBRARY entry's per-key cooldown, and a mismatch silently overrides the design (the `protocol_lapse` whole-branch review lesson, repeated in S4).
- **Severity rank: directly after `meal_rhythm_drift`, still ahead of the setup checks.** It is the least urgent flag in the system — an insight, not a signal — but it is still a statement about the user's body, so it stays inside the flag block rather than dropping below the setup cards.
- **`energy_dip_meal_timing` stays COUNTED in `existsProblemRaiseSince`** (it does NOT join the `all_healthy` carve-out list). Like `late_eating` and `meal_rhythm_drift` it is a genuine observation about the user's own days, not a data gap or an app-side failure — and with a 30-day cooldown it can block the quiet window at most once a month. No repository change at all.
- **Channel is `feed`.** An insight card never pushes.
- **No per-rule cooldown of its own.** Unlike S1's per-ITEM cooldown, there is one subject here (the user's own afternoons), so `FlagService`'s key-level cooldown expresses the whole design. Do not build a payload-reading cooldown.
- **No frontend, no contract, no new endpoint, no new cron.** The card ships on machinery that already exists end to end.

---

## Global Constraints

- **Honesty gate is the default**: too few qualifying days, no usable split ⇒ `FlagVerdict.unavailable(...)` with a named `UnavailableReason`; a usable split that simply does not separate ⇒ `FlagVerdict.clear(...)` with the observed delta. Never a raise, never a fabricated clear. Every gate gets its own silence test.
- **An unlogged day is never "compliant" and never "violating."** A day with an afternoon check-in but no meal rows at all does not enter the sample in either direction.
- **Every threshold is config** (`FlagProperties`, Bean-Validation ranges, `application.yml` defaults). No numbers in the rule class.
- `FlagEvaluator` has **no `List<FlagRule>` injection** — add a field and a call line in the fixed order, immediately after `mealRhythmDriftRule`. `AllHealthyRule` stays last.
- Liquibase changesets are immutable; the two new files are timestamped after the newest existing one (`202609061800_mezo-d58h.7.5_knowledge_fact_source_question.sql`) and registered in `1.0.0_master.yml`. CI's `lint` job runs `node scripts/lint-liquibase.mjs`.
- `companion_flag_log.flag_key` / `companion_flag_trace.flag_key` are `varchar(24)`; `energy_dip_meal_timing` is 22 characters — it fits.
- ArchUnit (CI): the rule lives in `companion/flags/service/rule`, constructor DI only, no class-level `@Transactional`, no `@Value`. The directions this rule needs — `companion → biometrics` (`LoggingGapRule` reads `CheckInRepository`) and `companion → meal` (`LoggingGapRule`, `MealRhythmDriftRule`) — **both already exist**, so no port inversion is required. Do not take that on trust: run the ArchUnit test.
- Backend runs REQUIRE `-Dmezo.test.use-testcontainers=true`, and Maven's OWN exit code — never a pipeline's. "Tests run: 0", or a `-Dtest` filter matching nothing, is a FAILURE to report, not a pass.
- Run everything from this worktree root; never `cd` to the primary repo. Commit subjects carry `(mezo-d58h.7.7)` plus the `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` trailer. Regenerate `docs/CODEMAP.md` (`node scripts/gen-codemap.mjs`) in the same change as any new file, and AFTER any docs edit.

---

## File Structure

| File | Responsibility |
|---|---|
| `companion/flags/service/FlagKey.java` (M) | `ENERGY_DIP_MEAL_TIMING` constant |
| `companion/flags/config/FlagProperties.java` (M) | `EnergyDipMealTiming` record + `CooldownHours.energyDipMealTiming` + `forFlag` arm |
| `companion/flags/entity/CompanionFlagLogEntity.java` (M) | `@Pattern` mirror |
| `companion/flags/entity/CompanionFlagTraceEntity.java` (M) | `@Pattern` mirror |
| `companion/config/CompanionProperties.java` (M) | `Intervention.flag` `@Pattern` mirror |
| `db/.../202609062000_mezo-d58h.7.7_flag_key_energy_dip.sql` (C) + `..._2100_..._trace_...sql` (C) + `1.0.0_master.yml` (M) | the two DB CHECK mirrors |
| `companion/flags/service/FlagCatalog.java` (M) | label + domain |
| `proactive/service/AdvicePriority.java` (M) | one `ORDER` entry |
| `companion/flags/entity/FlagPayloadEnvelope.java` (M) | `EnergyDipMealTiming` record + factory (**and the 15 existing factories' null lists**) |
| `companion/flags/service/UnavailableReason.java` (M) | two new honesty-gate members |
| `companion/flags/service/rule/EnergyDipMealTimingRule.java` (C) | the rule |
| `companion/flags/service/FlagEvaluator.java` (M) | one field + one call line |
| `companion/flags/service/FlagFactRenderer.java` (M) | one switch arm + one private renderer |
| `application.yml` (M) | threshold block, cooldown, intervention entry |
| `feature/companion/flags/FlagEvaluatorEnergyDipIT.java` (C, test) | the rule's ITs |
| `feature/companion/flags/EnergyDipMealTimingRuleSwitchOffIT.java` (C, test) | switch-off proof |
| `FlagPropertiesIT`, `CompanionFlagLogPersistenceIT`, `FlagFactRendererTest`, `InterventionServiceIT` (M, test) | mirrors + delivery proof |
| `docs/features/companion.md`, `docs/features/proactive.md`, `docs/CODEMAP.md` (M) | docs |

**Nothing new is needed in the test populators.** `CheckInPopulator.createCheckIn(owner, date, slotTime, energy, stress, note)` and `MealPopulator.createBareMealAt(owner, mealDate, slot, localTime)` (added by S4) already express every fixture this slice needs — a check-in at a chosen slot on a chosen past day, and a meal at a chosen wall-clock time.

---

### Task 0: branch + issue

- [ ] **Step 1: Claim the issue and cut the branch.**

```bash
bd update mezo-d58h.7.7 --claim && git switch -c feat/proactive-round2-s6-energy-dip
```

---

### Task 1: the key and all seven of its mirrors

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagKey.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/entity/CompanionFlagLogEntity.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/entity/CompanionFlagTraceEntity.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagCatalog.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdvicePriority.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/config/FlagProperties.java`
- Modify: `backend/src/main/resources/application.yml`
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202609062000_mezo-d58h.7.7_flag_key_energy_dip.sql`
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202609062100_mezo-d58h.7.7_flag_key_trace_energy_dip.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/FlagPropertiesIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/CompanionFlagLogPersistenceIT.java`

**Why one task:** the three reflection guards (`AdvicePriorityTest`, `FlagCatalogTest`, `InterventionConfigIT`) go red the instant the `FlagKey` constant exists and stay red until label, rank and library entry all exist. Splitting this would mean deliberately committing a red build.

**Interfaces:**
- Produces: `FlagKey.ENERGY_DIP_MEAL_TIMING` (`"energy_dip_meal_timing"`)
- Produces: `FlagProperties.EnergyDipMealTiming` with accessors `windowDays()`, `minQualifyingDays()`, `afternoonFromHour()`, `afternoonToHour()`, `minGroupDays()`, `minEnergyDelta()`, `minSuperiority()`, `minLunchSplitSeparationMinutes()`
- Produces: `FlagProperties.CooldownHours.energyDipMealTiming()` = 720

- [ ] **Step 1: Write the failing config test.** In `FlagPropertiesIT`, append after `binds_the_meal_rhythm_drift_thresholds_and_cooldown`:

```java
    /** Round 2 S6 (mezo-d58h.7.7): the 30-day insight cadence lives in TWO places that must agree —
     *  this key-level cooldown and the energy_dip_timing_insight library entry's own cooldown-hours
     *  (InterventionService.deliverForFlag applies the LIBRARY value, so a mismatch silently
     *  overrides the design — the protocol_lapse review lesson, repeated in S4). */
    @Test
    void binds_the_energy_dip_meal_timing_thresholds_and_cooldown() {
        assertThat(properties.energyDipMealTiming().windowDays()).isEqualTo(30);
        assertThat(properties.energyDipMealTiming().minQualifyingDays()).isEqualTo(10);
        assertThat(properties.energyDipMealTiming().afternoonFromHour()).isEqualTo(11);
        assertThat(properties.energyDipMealTiming().afternoonToHour()).isEqualTo(16);
        assertThat(properties.energyDipMealTiming().minGroupDays()).isEqualTo(4);
        assertThat(properties.energyDipMealTiming().minEnergyDelta()).isEqualTo(1.0);
        assertThat(properties.energyDipMealTiming().minSuperiority()).isEqualTo(0.70);
        assertThat(properties.energyDipMealTiming().minLunchSplitSeparationMinutes()).isEqualTo(45);
        assertThat(properties.cooldownHours().energyDipMealTiming()).isEqualTo(720);
        assertThat(properties.cooldownHours().forFlag(FlagKey.ENERGY_DIP_MEAL_TIMING)).isEqualTo(720);
    }
```

And in `CompanionFlagLogPersistenceIT`, next to the S4 raw-insert assertion (around line 152), add:

```java
        // Round 2 S6 (mezo-d58h.7.7): the widened CHECK accepts energy_dip_meal_timing too.
        flagLogPopulator.rawInsert(owner, FlagKey.ENERGY_DIP_MEAL_TIMING, FlagKey.SOURCE_SWEEP);
```

(extend the same assertion's expected-keys list in that test with `FlagKey.ENERGY_DIP_MEAL_TIMING` — read the surrounding lines and mirror exactly how S4's key was added.)

- [ ] **Step 2: Run them — they must fail.**

```bash
./mvnw -f backend/pom.xml -Dmezo.test.use-testcontainers=true -Dtest='FlagPropertiesIT+CompanionFlagLogPersistenceIT' test
```

Expected: compilation failure on `FlagKey.ENERGY_DIP_MEAL_TIMING` / `energyDipMealTiming()`.

- [ ] **Step 3: Add the `FlagKey` constant.** After the `MEAL_RHYTHM_DRIFT` block in `FlagKey.java`:

```java
    /** Round 2 S6 (bd mezo-d58h.7.7, spec 2026-09-05 §(15)): the user's early-afternoon energy
     *  tracks WHEN (or whether) they ate that morning — a correlation observed in the user's own
     *  log, never a causal claim. 22 chars: inside the varchar(24) both CHECKed columns use. */
    public static final String ENERGY_DIP_MEAL_TIMING = "energy_dip_meal_timing";
```

- [ ] **Step 4: Mirror it in the two entity `@Pattern`s and in `CompanionProperties`.** In `CompanionFlagLogEntity.java:42` and `CompanionFlagTraceEntity.java:44`, extend the regex tail:

```java
        + "|joint_overuse|ignored_nudge|late_eating|protocol_lapse|meal_rhythm_drift"
        + "|energy_dip_meal_timing")
```

and in `CompanionProperties.java:230`, the same:

```java
            + "|meal_rhythm_drift|energy_dip_meal_timing") String flag,
```

- [ ] **Step 5: Add the two Liquibase changesets.** Create `backend/src/main/resources/db/changelog/1.0.0/script/202609062000_mezo-d58h.7.7_flag_key_energy_dip.sql`:

```sql
-- Proactive coaching round 2, slice S6 (mezo-d58h.7.7, spec 2026-09-05 §(15)): the
-- energy_dip_meal_timing detection needs the companion_flag_log.flag_key CHECK widened. Liquibase
-- changesets are immutable — this replaces the constraint created by
-- 202609061600_mezo-d58h.7.4_flag_key_meal_rhythm_drift.sql rather than editing it.
alter table companion_flag_log
    drop constraint ck_companion_flag_log_flag_key;

alter table companion_flag_log
    add constraint ck_companion_flag_log_flag_key check (flag_key in
        ('sustained_stress', 'sleep_debt', 'momentum_at_risk', 'recovery_needed', 'all_healthy',
         'logging_gap', 'missed_workouts', 'acute_bad_day', 'load_fuel_mismatch',
         'rapid_weight_loss', 'joint_overuse', 'ignored_nudge', 'late_eating', 'protocol_lapse',
         'meal_rhythm_drift', 'energy_dip_meal_timing'));
```

and `202609062100_mezo-d58h.7.7_flag_key_trace_energy_dip.sql`:

```sql
-- Proactive coaching round 2, slice S6 (mezo-d58h.7.7, spec 2026-09-05 §(15)): the same widening
-- on the coaching-observer trace table (mezo-6269.1), whose CHECK is a separate constraint.
-- Liquibase changesets are immutable — this replaces the constraint created by
-- 202609061700_mezo-d58h.7.4_flag_key_trace_meal_rhythm_drift.sql rather than editing it.
alter table companion_flag_trace
    drop constraint ck_companion_flag_trace_flag_key;

alter table companion_flag_trace
    add constraint ck_companion_flag_trace_flag_key check (flag_key in
        ('sustained_stress', 'sleep_debt', 'momentum_at_risk', 'recovery_needed', 'all_healthy',
         'logging_gap', 'missed_workouts', 'acute_bad_day', 'load_fuel_mismatch',
         'rapid_weight_loss', 'joint_overuse', 'ignored_nudge', 'late_eating', 'protocol_lapse',
         'meal_rhythm_drift', 'energy_dip_meal_timing'));
```

Register both at the END of `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`:

```yaml
  - changeSet:
      id: "1.0.0:202609062000_mezo-d58h.7.7_flag_key_energy_dip"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609062000_mezo-d58h.7.7_flag_key_energy_dip.sql
  - changeSet:
      id: "1.0.0:202609062100_mezo-d58h.7.7_flag_key_trace_energy_dip"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609062100_mezo-d58h.7.7_flag_key_trace_energy_dip.sql
```

- [ ] **Step 6: Add the catalog entry.** In `FlagCatalog.java`'s static block, immediately after the `MEAL_RHYTHM_DRIFT` line:

```java
        // Round 2 S6 (bd mezo-d58h.7.7): afternoon energy vs. meal timing — a Meal/Fuel-side
        // observation, hence the nutrition domain (the actionable half of the correlation is
        // WHEN the user eats). Insertion order again mirrors AdvicePriority.ORDER, where it sits
        // directly after meal_rhythm_drift.
        ENTRIES.put(FlagKey.ENERGY_DIP_MEAL_TIMING, new Entry("Délutáni energia", DOMAIN_NUTRITION));
```

- [ ] **Step 7: Add the severity rank.** In `AdvicePriority.java`, insert into `ORDER` directly after `FlagKey.MEAL_RHYTHM_DRIFT`:

```java
        FlagKey.ENERGY_DIP_MEAL_TIMING,
```

and add to the class javadoc, after the S4 paragraph:

```java
 * <p>Round 2 S6 (bd mezo-d58h.7.7): {@link FlagKey#ENERGY_DIP_MEAL_TIMING} sits immediately after
 * {@code meal_rhythm_drift} — the least urgent FLAG in the table (an insight about a correlation,
 * not a signal about a state), but still a statement about the user's own body, so it stays inside
 * the flag block rather than dropping below the setup checks.
```

- [ ] **Step 8: Add the config record and cooldown.** In `FlagProperties.java`, add the component to the record header after `mealRhythmDrift`:

```java
    @NotNull @Valid MealRhythmDrift mealRhythmDrift,

    @NotNull @Valid EnergyDipMealTiming energyDipMealTiming
```

the nested record after `MealRhythmDrift`:

```java
    /** Spec 2026-09-05 §(15): does the user's early-afternoon energy track WHEN (or whether) they
     *  ate that morning? A correlation report, never a causal claim — see
     *  {@code EnergyDipMealTimingRule}. The most cautious rule in the set: every gate here exists
     *  to keep a coincidence from becoming a card. */
    public record EnergyDipMealTiming(
        /** Rolling window (days, ending YESTERDAY — today's afternoon may not have happened). */
        @Min(14) @Max(120) int windowDays,
        /** Honest small-n gate: days carrying BOTH an afternoon energy value and any logged meal. */
        @Min(5) @Max(120) int minQualifyingDays,
        /** The "early afternoon" band, INCLUSIVE on both ends, matched against the check-in's
         *  {@code slot_time} wall clock: 11 and 16 mean a 16:00 check-in counts and 16:15 does not.
         *  Hours rather than HH:mm strings so Bean Validation can range-check them. */
        @Min(0) @Max(23) int afternoonFromHour,
        @Min(1) @Max(23) int afternoonToHour,
        /** Minimum days on EACH side of the split. Below this the two medians are anecdote. */
        @Min(3) @Max(60) int minGroupDays,
        /** The spec's "at least 1 full point": the required |median − median| on the 1–10 energy scale. */
        @DecimalMin("0.5") @DecimalMax("5.0") double minEnergyDelta,
        /** The spec's "consistently": the common-language effect size (Mann–Whitney probability of
         *  superiority, ties counting half), oriented to the higher group so it lands in [0.5, 1.0]. */
        @DecimalMin("0.5") @DecimalMax("1.0") double minSuperiority,
        /** The lunch arm's anti-degeneracy gate: the two groups' own median lunch times must be at
         *  least this far apart, or the "split" is noise and the breakfast fallback takes over —
         *  this IS the spec's "when lunch times don't vary". */
        @Min(15) @Max(240) int minLunchSplitSeparationMinutes
    ) {
    }
```

the cooldown field after `mealRhythmDrift`:

```java
        @Min(1) @Max(8760) int mealRhythmDrift,
        @Min(1) @Max(8760) int energyDipMealTiming
```

and the `forFlag` arm after the `meal_rhythm_drift` case:

```java
                case "energy_dip_meal_timing" -> energyDipMealTiming;
```

- [ ] **Step 9: Add the YAML defaults.** In `application.yml`, after the `meal-rhythm-drift:` block (ends `min-slot-planned-days: 10`) and BEFORE `cooldown-hours:`:

```yaml
      energy-dip-meal-timing:
        # Round 2 S6 (mezo-d58h.7.7, spec 2026-09-05 §(15)). The most cautious rule in the set: it
        # reports a CORRELATION in the user's own log and nothing else. 30 days of window because
        # a day only qualifies when it carries BOTH an early-afternoon check-in and meal data —
        # a 14-day window would almost never reach ten such days.
        window-days: 30
        min-qualifying-days: 10
        # The "early afternoon" band, inclusive: a 16:00 check-in counts, 16:15 does not.
        afternoon-from-hour: 11
        afternoon-to-hour: 16
        # Four days per side is the floor the spec names. Below it two medians are anecdote.
        min-group-days: 4
        # A full point apart on the 1-10 energy scale, AND consistently so: 70% of the cross-group
        # day pairs must actually run that way (Mann-Whitney probability of superiority). The
        # direct analogue of meal-rhythm-drift's min-same-direction-share.
        min-energy-delta: 1.0
        min-superiority: 0.70
        # Anti-degeneracy: if the two lunch groups' own medians sit closer than this, lunch times
        # "don't vary" in the spec's sense and the breakfast-presence fallback takes over.
        min-lunch-split-separation-minutes: 45
```

and in `cooldown-hours:`, after `meal-rhythm-drift: 336`:

```yaml
        # Round 2 S6 (mezo-d58h.7.7): the spec's 30 days — "effectively a one-off insight card".
        # MUST match the energy_dip_timing_insight library entry's own cooldown-hours (the
        # protocol_lapse review lesson: InterventionService.deliverForFlag applies the LIBRARY
        # entry's cooldown, so a mismatch silently overrides this value).
        energy-dip-meal-timing: 720
```

- [ ] **Step 10: Add the intervention-library entry.** In `application.yml`, after the `meal_rhythm_adjust` entry and before the `profile:` block:

```yaml
      # Round 2 S6 (mezo-d58h.7.7, spec 2026-09-05 §(15)): a KORRELÁCIÓ a saját naplódban, nem ok-
      # okozat. A szöveg szándékosan nem mond okot és nem ír elő semmit ("jellemzően", "azokon a
      # napokon") — a csoportok mérete és a két medián a tények blokkban van, hogy látszódjon,
      # milyen vékony a minta. channel: feed — egy megfigyelés sosem érdemel pusht.
      # cooldown-hours 720 == cooldown-hours.energy-dip-meal-timing (lásd ott).
      - key: energy_dip_timing_insight
        flag: energy_dip_meal_timing
        channel: feed
        text-hu: "Végignéztem az elmúlt hetek délutáni bejelentkezéseit, és van egy együttjárás: az egyik fajta napodon jellemzően magasabb délutáni energiát rögzítettél, mint a másikon. Ez nem magyarázat, csak egy mintázat a saját naplódban — lehet mögötte az étkezés időzítése, de lehet, hogy mindkettő ugyanannak a napnak a következménye. Ha érdekel, figyeld meg pár napig tudatosan."
        cooldown-hours: 720
        quiet-hours-exempt: false
```

- [ ] **Step 11: Run the mirror tests and the three reflection guards.**

```bash
./mvnw -f backend/pom.xml -Dmezo.test.use-testcontainers=true \
  -Dtest='FlagPropertiesIT+CompanionFlagLogPersistenceIT+AdvicePriorityTest+FlagCatalogTest+InterventionConfigIT' test
```

Expected: PASS, with a non-zero "Tests run" count. A "Tests run: 0" line is a FAILURE — the filter matched nothing.

- [ ] **Step 12: Commit.**

```bash
git add -A && git commit -m "feat(companion): register the energy_dip_meal_timing flag key (mezo-d58h.7.7)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: the payload shape and the honesty reasons

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/entity/FlagPayloadEnvelope.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/UnavailableReason.java`

**Interfaces:**
- Produces: `FlagPayloadEnvelope.EnergyDipMealTiming` (17 components, listed below) and the factory `FlagPayloadEnvelope.energyDipMealTiming(EnergyDipMealTiming p)`
- Produces: `UnavailableReason.NOT_ENOUGH_ENERGY_MEAL_DAYS`, `UnavailableReason.NO_USABLE_SPLIT`

- [ ] **Step 1: Add the payload record.** In `FlagPayloadEnvelope.java`, add the 16th component to the outer record header (after `MealRhythmDrift mealRhythmDrift`):

```java
    MealRhythmDrift mealRhythmDrift,
    EnergyDipMealTiming energyDipMealTiming
```

and the nested record after `MealRhythmDrift`:

```java
    /** Round 2 S6 (mezo-d58h.7.7, spec 2026-09-05 §(15)). {@code splitMode} is
     *  {@code "lunch_time"} or {@code "breakfast_presence"} and decides whether the two lunch-time
     *  fields are populated. Group A is ALWAYS the leading half of the sentence the card tells —
     *  the earlier-lunch days, or the days with a logged breakfast — and {@code groupALabel} /
     *  {@code groupBLabel} freeze those names ({@code "earlier_lunch"}/{@code "later_lunch"},
     *  {@code "with_breakfast"}/{@code "without_breakfast"}) so the renderer never re-derives them.
     *  {@code higherGroup} ({@code "A"} or {@code "B"}) says which side actually came out higher;
     *  {@code energyDelta} is the ABSOLUTE median difference and {@code superiority} the
     *  Mann–Whitney probability of superiority ORIENTED to that higher group, so it always lands
     *  in {@code [0.5, 1.0]}. Times are {@code HH:mm} wall clock in the system zone. */
    public record EnergyDipMealTiming(
        String splitMode, String groupALabel, String groupBLabel,
        int windowDays, int qualifyingDays, int minQualifyingDays,
        int groupADays, int groupBDays, int minGroupDays,
        double groupAMedianEnergy, double groupBMedianEnergy,
        double energyDelta, double minEnergyDelta,
        double superiority, double minSuperiority,
        String higherGroup,
        String groupAMedianLunchTime, String groupBMedianLunchTime) {
    }
```

- [ ] **Step 2: Extend every existing factory's null list by one, and add the new factory.** All fifteen existing factories now need one more trailing `null`. The new one:

```java
    public static FlagPayloadEnvelope energyDipMealTiming(EnergyDipMealTiming p) {
        return new FlagPayloadEnvelope(null, null, null, null, null, null, null, null, null, null,
            null, null, null, null, null, p);
    }
```

- [ ] **Step 3: Add the two `UnavailableReason` members.** At the end of the enum:

```java
    /** energy_dip_meal_timing: fewer days carrying BOTH an early-afternoon check-in energy value
     *  and any logged meal than {@code min-qualifying-days}. A day with an afternoon check-in but
     *  no meal data at all is neither "ate late" nor "skipped breakfast" — it is unknown. */
    NOT_ENOUGH_ENERGY_MEAL_DAYS,
    /** energy_dip_meal_timing: neither split produced two groups of at least {@code min-group-days}
     *  (the lunch arm additionally needs the two groups' median lunch times to be
     *  {@code min-lunch-split-separation-minutes} apart) — nothing could be compared, as opposed to
     *  comparing and finding no difference. */
    NO_USABLE_SPLIT
```

- [ ] **Step 4: Compile.**

```bash
./mvnw -f backend/pom.xml -q -DskipTests compile
```

Expected: BUILD SUCCESS. (A missed `null` in one of the fifteen factories shows up here as an arity error.)

- [ ] **Step 5: Commit.**

```bash
git add -A && git commit -m "feat(companion): the energy_dip_meal_timing payload shape and honesty reasons (mezo-d58h.7.7)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: the rule — TDD, tests first

**Files:**
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/FlagEvaluatorEnergyDipIT.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/rule/EnergyDipMealTimingRule.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagEvaluator.java`

**Interfaces:**
- Consumes: `FlagKey.ENERGY_DIP_MEAL_TIMING`, `FlagProperties.EnergyDipMealTiming`, `FlagPayloadEnvelope.EnergyDipMealTiming`, `UnavailableReason.NOT_ENOUGH_ENERGY_MEAL_DAYS` / `NO_USABLE_SPLIT` (Tasks 1–2)
- Consumes: `CheckInRepository.findByCreatedByAndDeletedFalseAndDateBetween(UUID, LocalDate, LocalDate)`, `MealRepository.findByCreatedByAndDeletedFalseAndMealDateBetweenOrderByMealDateAsc(UUID, LocalDate, LocalDate)`
- Produces: `EnergyDipMealTimingRule implements FlagRule`, wired as the 15th call in `FlagEvaluator.evaluate`

- [ ] **Step 1: Write the failing IT.** Create `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/FlagEvaluatorEnergyDipIT.java`:

```java
package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagEvaluator;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagOutcome;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.flags.service.UnavailableReason;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Round 2 S6 (mezo-d58h.7.7, spec 2026-09-05 §(15)): afternoon energy vs. meal timing — the
 * CORRELATION rule. See {@code EnergyDipMealTimingRule}'s javadoc for the four bounds this file
 * proves: the day gate (an afternoon check-in AND meal data), the degenerate-split guard, the
 * breakfast fallback, and the consistency (superiority) requirement on top of the median delta.
 */
class FlagEvaluatorEnergyDipIT extends AbstractIntegrationTest {

    @Autowired private FlagEvaluator evaluator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private MealPopulator mealPopulator;

    private static final LocalDate TODAY = LocalDate.now();

    private static FlagVerdict verdictFor(List<FlagVerdict> verdicts, String flagKey) {
        return verdicts.stream().filter(v -> flagKey.equals(v.flagKey())).findFirst().orElseThrow();
    }

    private FlagVerdict verdict(UUID owner) {
        return verdictFor(evaluator.evaluate(owner), FlagKey.ENERGY_DIP_MEAL_TIMING);
    }

    private Optional<FlagPayloadEnvelope.EnergyDipMealTiming> payload(UUID owner) {
        FlagVerdict v = verdict(owner);
        return v.outcome() == FlagOutcome.RAISED
            ? Optional.of(v.payload().energyDipMealTiming()) : Optional.empty();
    }

    /** One closed day, {@code daysAgo} back: an afternoon check-in at 14:00 with {@code energy},
     *  a lunch at {@code lunch} (null ⇒ no lunch row) and optionally a breakfast at 07:30. */
    private void day(UUID owner, int daysAgo, int energy, LocalTime lunch, boolean breakfast) {
        LocalDate d = TODAY.minusDays(daysAgo);
        checkInPopulator.createCheckIn(owner, d, "14:00", energy, 3, null);
        if (breakfast) {
            mealPopulator.createBareMealAt(owner, d, "breakfast", LocalTime.of(7, 30));
        }
        if (lunch != null) {
            mealPopulator.createBareMealAt(owner, d, "lunch", lunch);
        }
    }

    /** The detection: six early-lunch days at energy 8 against six late-lunch days at energy 5. */
    @Test
    void raises_when_afternoon_energy_tracks_the_lunch_time_split() {
        UUID owner = userPopulator.createUser().getId();
        for (int i = 1; i <= 6; i++) {
            day(owner, i, 8, LocalTime.of(12, 0), true);
        }
        for (int i = 7; i <= 12; i++) {
            day(owner, i, 5, LocalTime.of(14, 30), true);
        }

        assertThat(verdict(owner).outcome()).isEqualTo(FlagOutcome.RAISED);
        assertThat(payload(owner)).hasValueSatisfying(p -> {
            assertThat(p.splitMode()).isEqualTo("lunch_time");
            assertThat(p.groupALabel()).isEqualTo("earlier_lunch");
            assertThat(p.groupADays()).isEqualTo(6);
            assertThat(p.groupBDays()).isEqualTo(6);
            assertThat(p.groupAMedianEnergy()).isEqualTo(8.0);
            assertThat(p.groupBMedianEnergy()).isEqualTo(5.0);
            assertThat(p.energyDelta()).isEqualTo(3.0);
            assertThat(p.superiority()).isEqualTo(1.0);
            assertThat(p.higherGroup()).isEqualTo("A");
            assertThat(p.groupAMedianLunchTime()).isEqualTo("12:00");
            assertThat(p.groupBMedianLunchTime()).isEqualTo("14:30");
            assertThat(p.qualifyingDays()).isEqualTo(12);
        });
    }

    /** The rule reports a correlation in EITHER direction — later lunches can be the better days,
     *  and the card must be able to say so. */
    @Test
    void raises_with_group_b_higher_when_the_later_lunch_days_are_the_better_ones() {
        UUID owner = userPopulator.createUser().getId();
        for (int i = 1; i <= 6; i++) {
            day(owner, i, 4, LocalTime.of(12, 0), true);
        }
        for (int i = 7; i <= 12; i++) {
            day(owner, i, 8, LocalTime.of(14, 30), true);
        }

        assertThat(payload(owner)).hasValueSatisfying(p -> {
            assertThat(p.higherGroup()).isEqualTo("B");
            assertThat(p.energyDelta()).isEqualTo(4.0);
            assertThat(p.superiority()).isEqualTo(1.0);
        });
    }

    /** A usable split that simply does not separate is a CLEAR, not a raise and not an
     *  unavailable: the rule genuinely looked and found the two halves the same. */
    @Test
    void stays_clear_when_the_two_groups_are_less_than_a_full_point_apart() {
        UUID owner = userPopulator.createUser().getId();
        int[] early = {7, 7, 7, 6, 6, 6};   // median 6.5
        int[] late = {6, 6, 6, 6, 6, 6};    // median 6.0 ⇒ delta 0.5 < 1.0
        for (int i = 0; i < 6; i++) {
            day(owner, i + 1, early[i], LocalTime.of(12, 0), true);
        }
        for (int i = 0; i < 6; i++) {
            day(owner, i + 7, late[i], LocalTime.of(14, 30), true);
        }

        FlagVerdict v = verdict(owner);
        assertThat(v.outcome()).isEqualTo(FlagOutcome.CLEAR);
        assertThat(v.clear().metric()).isEqualTo("energy_delta");
        assertThat(v.clear().observed()).isEqualTo(0.5);
        assertThat(v.clear().threshold()).isEqualTo(1.0);
    }

    /** The consistency gate: the medians ARE a point apart, but the groups overlap almost
     *  completely, so the superiority share never reaches 70% and the rule stays quiet. */
    @Test
    void stays_clear_when_the_medians_differ_but_the_groups_overlap() {
        UUID owner = userPopulator.createUser().getId();
        int[] early = {9, 9, 9, 2, 2, 2, 2};  // median 2 … wide spread, both directions
        int[] late = {9, 9, 9, 1, 1, 1, 1};
        for (int i = 0; i < 7; i++) {
            day(owner, i + 1, early[i], LocalTime.of(12, 0), true);
        }
        for (int i = 0; i < 7; i++) {
            day(owner, i + 8, late[i], LocalTime.of(14, 30), true);
        }

        assertThat(verdict(owner).outcome()).isEqualTo(FlagOutcome.CLEAR);
    }

    /** The honesty gate: nine qualifying days is under the ten the spec requires. */
    @Test
    void stays_unavailable_below_the_minimum_number_of_qualifying_days() {
        UUID owner = userPopulator.createUser().getId();
        for (int i = 1; i <= 5; i++) {
            day(owner, i, 8, LocalTime.of(12, 0), true);
        }
        for (int i = 6; i <= 9; i++) {
            day(owner, i, 4, LocalTime.of(14, 30), true);
        }

        FlagVerdict v = verdict(owner);
        assertThat(v.outcome()).isEqualTo(FlagOutcome.UNAVAILABLE);
        assertThat(v.reason()).isEqualTo(UnavailableReason.NOT_ENOUGH_ENERGY_MEAL_DAYS);
    }

    /** A day with an afternoon check-in but NO logged meal at all is unknown, not a data point:
     *  twelve such days still leave the sample empty. */
    @Test
    void never_counts_a_day_whose_meals_were_not_logged() {
        UUID owner = userPopulator.createUser().getId();
        for (int i = 1; i <= 12; i++) {
            checkInPopulator.createCheckIn(owner, TODAY.minusDays(i), "14:00", 8, 3, null);
        }

        assertThat(verdict(owner).reason()).isEqualTo(UnavailableReason.NOT_ENOUGH_ENERGY_MEAL_DAYS);
    }

    /** Only the 11:00–16:00 band counts: a morning and an evening check-in say nothing about the
     *  early afternoon, however many of them there are. */
    @Test
    void ignores_check_ins_outside_the_early_afternoon_band() {
        UUID owner = userPopulator.createUser().getId();
        for (int i = 1; i <= 12; i++) {
            LocalDate d = TODAY.minusDays(i);
            checkInPopulator.createCheckIn(owner, d, "09:00", 9, 3, null);
            checkInPopulator.createCheckIn(owner, d, "18:00", 2, 3, null);
            mealPopulator.createBareMealAt(owner, d, "lunch", LocalTime.of(12, 0));
        }

        assertThat(verdict(owner).reason()).isEqualTo(UnavailableReason.NOT_ENOUGH_ENERGY_MEAL_DAYS);
    }

    /** The spec's fallback: every lunch is at 13:00, so the lunch split is degenerate — and the
     *  breakfast-presence split takes over. */
    @Test
    void falls_back_to_breakfast_presence_when_the_lunch_times_do_not_vary() {
        UUID owner = userPopulator.createUser().getId();
        for (int i = 1; i <= 6; i++) {
            day(owner, i, 8, LocalTime.of(13, 0), true);
        }
        for (int i = 7; i <= 12; i++) {
            day(owner, i, 5, LocalTime.of(13, 0), false);
        }

        assertThat(payload(owner)).hasValueSatisfying(p -> {
            assertThat(p.splitMode()).isEqualTo("breakfast_presence");
            assertThat(p.groupALabel()).isEqualTo("with_breakfast");
            assertThat(p.groupBLabel()).isEqualTo("without_breakfast");
            assertThat(p.groupADays()).isEqualTo(6);
            assertThat(p.groupBDays()).isEqualTo(6);
            assertThat(p.higherGroup()).isEqualTo("A");
            assertThat(p.groupAMedianLunchTime()).isNull();
            assertThat(p.groupBMedianLunchTime()).isNull();
        });
    }

    /** Neither arm can split: one lunch time, and every day has a breakfast. Nothing was compared,
     *  which is NOT the same claim as "compared and found nothing". */
    @Test
    void stays_unavailable_when_no_split_is_usable() {
        UUID owner = userPopulator.createUser().getId();
        for (int i = 1; i <= 12; i++) {
            day(owner, i, 8, LocalTime.of(13, 0), true);
        }

        FlagVerdict v = verdict(owner);
        assertThat(v.outcome()).isEqualTo(FlagOutcome.UNAVAILABLE);
        assertThat(v.reason()).isEqualTo(UnavailableReason.NO_USABLE_SPLIT);
    }

    /** The minimum group size bites before the delta does: eleven early-lunch days against three
     *  late ones is a lopsided split, not a comparison. */
    @Test
    void stays_unavailable_when_one_side_of_the_split_is_too_small() {
        UUID owner = userPopulator.createUser().getId();
        for (int i = 1; i <= 11; i++) {
            day(owner, i, 8, LocalTime.of(12, 0), true);
        }
        for (int i = 12; i <= 14; i++) {
            day(owner, i, 3, LocalTime.of(14, 30), true);
        }

        assertThat(verdict(owner).reason()).isEqualTo(UnavailableReason.NO_USABLE_SPLIT);
    }

    /** Today is not in the window: an in-progress afternoon must not tip a verdict. */
    @Test
    void never_reads_today() {
        UUID owner = userPopulator.createUser().getId();
        for (int i = 1; i <= 5; i++) {
            day(owner, i, 8, LocalTime.of(12, 0), true);
        }
        for (int i = 6; i <= 9; i++) {
            day(owner, i, 4, LocalTime.of(14, 30), true);
        }
        day(owner, 0, 4, LocalTime.of(14, 30), true); // TODAY — must not become the 10th day

        assertThat(verdict(owner).reason()).isEqualTo(UnavailableReason.NOT_ENOUGH_ENERGY_MEAL_DAYS);
    }
}
```

- [ ] **Step 2: Run it — it must fail.**

```bash
./mvnw -f backend/pom.xml -Dmezo.test.use-testcontainers=true -Dtest=FlagEvaluatorEnergyDipIT test
```

Expected: FAIL — `verdictFor(...).orElseThrow()` finds no verdict for the key, because no rule produces one yet.

- [ ] **Step 3: Write the rule.** Create `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/rule/EnergyDipMealTimingRule.java`:

```java
package io.mrkuhne.mezo.feature.companion.flags.service.rule;

import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRule;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.flags.service.UnavailableReason;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Round 2 S6 (mezo-d58h.7.7, spec 2026-09-05 §(15)): does the user's EARLY-AFTERNOON energy track
 * WHEN — or whether — they ate that morning? The most cautious rule in the set, and the only one
 * that reports a CORRELATION rather than a state.
 *
 * <p>Over a {@code windowDays} window ending YESTERDAY, a day QUALIFIES when it carries both a
 * check-in with an energy value inside the {@code [afternoonFromHour, afternoonToHour]} band
 * (inclusive, matched on the {@code slot_time} wall clock) and at least one logged meal of any
 * kind. The day's afternoon energy is the MEDIAN of its in-band check-ins. Fewer than
 * {@code minQualifyingDays} such days ⇒ silence.
 *
 * <p>The qualifying days are then split in two, and the two groups' median energies compared:
 * <ul>
 *   <li><b>lunch_time</b> (primary) — days carrying a lunch row, split at the median lunch minute:
 *       group A is strictly before it, group B at or after. Usable only when BOTH groups reach
 *       {@code minGroupDays} AND their own median lunch times are at least
 *       {@code minLunchSplitSeparationMinutes} apart.</li>
 *   <li><b>breakfast_presence</b> (fallback, only when the lunch split is unusable — the spec's
 *       "when lunch times don't vary") — group A is the days with a logged {@code breakfast} row,
 *       group B the days without one. Usable when both reach {@code minGroupDays}.</li>
 * </ul>
 *
 * <p>It raises only when the two medians are at least {@code minEnergyDelta} apart AND the
 * separation is CONSISTENT: the Mann–Whitney probability of superiority (the share of cross-group
 * day pairs running the higher group's way, ties counting half, oriented to that higher group)
 * must reach {@code minSuperiority}. Two medians differing with n≈5 a side is a coincidence; this
 * is the direct analogue of {@code MealRhythmDriftRule}'s same-direction share.
 *
 * <p><b>Bound 1 — the card may only report, never explain.</b> The intervention copy and
 * {@code FlagFactRenderer}'s lines state what the two groups look like and how big they are. No
 * causal word appears anywhere in this feature, and the group sizes are always shown so the reader
 * can see how thin the sample is.
 *
 * <p><b>Bound 2 — the day gate is "the day has meal data", not "the day has a morning meal".</b>
 * The spec's §(15) wording says "AND a logged morning meal", but taken literally that empties the
 * spec's OWN breakfast-present/absent fallback: a day without breakfast could never enter the
 * sample. The gate's real job is adherence neutrality — proving the day's meal log is not simply
 * missing, so "no breakfast row" can honestly be read as "did not eat breakfast" rather than "did
 * not log". Hence: any logged meal qualifies the day, and each arm applies its own stricter need
 * (a lunch row with a time; a day with meal data at all).
 *
 * <p><b>Bound 3 — a median split can be degenerate.</b> If every lunch sits at 13:00 the "before
 * the median" side is empty, and a naive delta would read a 0-vs-N split as an enormous finding.
 * Both the per-group minimum and the lunch-time separation gate exist for that case, and failing
 * either is exactly what unlocks the fallback.
 *
 * <p><b>Bound 4 — nothing here crosses midnight.</b> An early-afternoon check-in and a lunch are
 * plain minutes-of-day; {@code MealRhythmDriftRule}'s circular difference and
 * {@code LateEatingRule}'s +24 shift are both deliberately absent, because neither problem exists
 * in this band. Times are wall clock in the system zone throughout, per the spec's timezone note.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class EnergyDipMealTimingRule implements FlagRule {

    static final String SPLIT_LUNCH_TIME = "lunch_time";
    static final String SPLIT_BREAKFAST_PRESENCE = "breakfast_presence";

    private static final String LABEL_EARLIER_LUNCH = "earlier_lunch";
    private static final String LABEL_LATER_LUNCH = "later_lunch";
    private static final String LABEL_WITH_BREAKFAST = "with_breakfast";
    private static final String LABEL_WITHOUT_BREAKFAST = "without_breakfast";
    private static final String GROUP_A = "A";
    private static final String GROUP_B = "B";
    private static final String SLOT_LUNCH = "lunch";
    private static final String SLOT_BREAKFAST = "breakfast";

    private final CheckInRepository checkInRepository;
    private final MealRepository mealRepository;
    private final FlagProperties properties;

    @Override
    public FlagVerdict evaluate(UUID userId, LocalDate today) {
        FlagProperties.EnergyDipMealTiming cfg = properties.energyDipMealTiming();

        // The window ends YESTERDAY: today's afternoon may not have happened at sweep time.
        LocalDate to = today.minusDays(1);
        LocalDate from = to.minusDays(cfg.windowDays() - 1L);

        Map<LocalDate, List<Integer>> afternoonEnergies = new HashMap<>();
        int fromMinute = cfg.afternoonFromHour() * 60;
        int toMinute = cfg.afternoonToHour() * 60;
        for (CheckInEntity c : checkInRepository
                .findByCreatedByAndDeletedFalseAndDateBetween(userId, from, to)) {
            if (c.getDate() == null || c.getEnergy() == null) {
                continue;
            }
            Integer minute = minuteOfDay(c.getSlotTime());
            if (minute == null || minute < fromMinute || minute > toMinute) {
                continue;
            }
            afternoonEnergies.computeIfAbsent(c.getDate(), d -> new ArrayList<>()).add(c.getEnergy());
        }

        Map<LocalDate, DayMeals> mealsByDay = new HashMap<>();
        for (MealEntity meal : mealRepository
                .findByCreatedByAndDeletedFalseAndMealDateBetweenOrderByMealDateAsc(userId, from, to)) {
            if (meal.getMealDate() == null) {
                continue;
            }
            DayMeals day = mealsByDay.computeIfAbsent(meal.getMealDate(), d -> new DayMeals());
            day.anyMeal = true;
            if (SLOT_BREAKFAST.equals(meal.getSlot())) {
                day.breakfast = true;
            }
            if (SLOT_LUNCH.equals(meal.getSlot()) && meal.getLoggedAt() != null) {
                LocalTime at = meal.getLoggedAt().atZone(ZoneId.systemDefault()).toLocalTime();
                int minute = at.getHour() * 60 + at.getMinute();
                // A plan slot names ONE eating event: the earliest lunch row is the day's lunch.
                day.lunchMinute = day.lunchMinute == null ? minute : Math.min(day.lunchMinute, minute);
            }
        }

        List<Day> days = new ArrayList<>();
        for (Map.Entry<LocalDate, List<Integer>> e : afternoonEnergies.entrySet()) {
            DayMeals meals = mealsByDay.get(e.getKey());
            if (meals == null || !meals.anyMeal) {
                continue; // no meal data ⇒ neither "ate late" nor "skipped breakfast", just unknown
            }
            days.add(new Day(median(e.getValue()), meals.lunchMinute, meals.breakfast));
        }
        if (days.size() < cfg.minQualifyingDays()) {
            return FlagVerdict.unavailable(FlagKey.ENERGY_DIP_MEAL_TIMING,
                UnavailableReason.NOT_ENOUGH_ENERGY_MEAL_DAYS);
        }

        Split split = lunchTimeSplit(cfg, days);
        if (split == null) {
            split = breakfastPresenceSplit(cfg, days);
        }
        if (split == null) {
            return FlagVerdict.unavailable(FlagKey.ENERGY_DIP_MEAL_TIMING,
                UnavailableReason.NO_USABLE_SPLIT);
        }

        double medianA = median(split.groupA());
        double medianB = median(split.groupB());
        double delta = Math.abs(medianA - medianB);
        boolean aIsHigher = medianA >= medianB;
        double superiority = orientedSuperiority(split.groupA(), split.groupB(), aIsHigher);

        if (delta < cfg.minEnergyDelta() || superiority < cfg.minSuperiority()) {
            // Genuinely compared and found nothing — the honest number is the delta itself.
            return FlagVerdict.clear(FlagKey.ENERGY_DIP_MEAL_TIMING, new FlagVerdict.ClearEvidence(
                "energy_delta", delta, cfg.minEnergyDelta(), split.mode()));
        }
        return FlagVerdict.raised(FlagKey.ENERGY_DIP_MEAL_TIMING,
            FlagPayloadEnvelope.energyDipMealTiming(new FlagPayloadEnvelope.EnergyDipMealTiming(
                split.mode(), split.labelA(), split.labelB(),
                cfg.windowDays(), days.size(), cfg.minQualifyingDays(),
                split.groupA().size(), split.groupB().size(), cfg.minGroupDays(),
                medianA, medianB,
                delta, cfg.minEnergyDelta(),
                superiority, cfg.minSuperiority(),
                aIsHigher ? GROUP_A : GROUP_B,
                clock(split.medianLunchA()), clock(split.medianLunchB()))));
    }

    /** Primary split: the days with a lunch time, halved at their own median lunch minute. Null
     *  when either side is too small or the two halves sit closer than the separation floor —
     *  the spec's "lunch times don't vary", and the ONLY thing that unlocks the fallback. */
    private Split lunchTimeSplit(FlagProperties.EnergyDipMealTiming cfg, List<Day> days) {
        List<Day> withLunch = days.stream().filter(d -> d.lunchMinute() != null).toList();
        if (withLunch.size() < cfg.minGroupDays() * 2) {
            return null;
        }
        double medianLunch = median(withLunch.stream().map(d -> d.lunchMinute()).toList());
        List<Double> earlierEnergy = new ArrayList<>();
        List<Double> laterEnergy = new ArrayList<>();
        List<Integer> earlierLunch = new ArrayList<>();
        List<Integer> laterLunch = new ArrayList<>();
        for (Day d : withLunch) {
            if (d.lunchMinute() < medianLunch) {
                earlierEnergy.add(d.energy());
                earlierLunch.add(d.lunchMinute());
            } else {
                laterEnergy.add(d.energy());
                laterLunch.add(d.lunchMinute());
            }
        }
        if (earlierEnergy.size() < cfg.minGroupDays() || laterEnergy.size() < cfg.minGroupDays()) {
            return null;
        }
        double medianEarlier = median(earlierLunch);
        double medianLater = median(laterLunch);
        if (medianLater - medianEarlier < cfg.minLunchSplitSeparationMinutes()) {
            return null; // the two halves are the same lunch time wearing two hats
        }
        return new Split(SPLIT_LUNCH_TIME, LABEL_EARLIER_LUNCH, LABEL_LATER_LUNCH,
            earlierEnergy, laterEnergy, medianEarlier, medianLater);
    }

    /** Fallback split: breakfast logged that day, or not. No time is involved, so no separation
     *  gate — only the per-group minimum. */
    private Split breakfastPresenceSplit(FlagProperties.EnergyDipMealTiming cfg, List<Day> days) {
        List<Double> withBreakfast = days.stream().filter(d -> d.breakfast()).map(d -> d.energy()).toList();
        List<Double> withoutBreakfast = days.stream().filter(d -> !d.breakfast()).map(d -> d.energy()).toList();
        if (withBreakfast.size() < cfg.minGroupDays() || withoutBreakfast.size() < cfg.minGroupDays()) {
            return null;
        }
        return new Split(SPLIT_BREAKFAST_PRESENCE, LABEL_WITH_BREAKFAST, LABEL_WITHOUT_BREAKFAST,
            new ArrayList<>(withBreakfast), new ArrayList<>(withoutBreakfast), null, null);
    }

    /** The common-language effect size (Mann–Whitney probability of superiority): the share of all
     *  cross-group day pairs in which the HIGHER group's day really is higher, ties counting half.
     *  Oriented to that higher group, so the result always lands in {@code [0.5, 1.0]} and a value
     *  of 1.0 means every single day of one group beat every single day of the other. */
    static double orientedSuperiority(List<Double> groupA, List<Double> groupB, boolean aIsHigher) {
        double wins = 0.0;
        for (Double a : groupA) {
            for (Double b : groupB) {
                if (a > b) {
                    wins += 1.0;
                } else if (a.doubleValue() == b.doubleValue()) {
                    wins += 0.5;
                }
            }
        }
        double share = wins / (groupA.size() * (double) groupB.size());
        return aIsHigher ? share : 1.0 - share;
    }

    /** {@code check_in.slot_time} is an {@code HH:mm} wall-clock string; a malformed one is
     *  missing data, never a data point. */
    private static Integer minuteOfDay(String slotTime) {
        if (slotTime == null) {
            return null;
        }
        try {
            LocalTime at = LocalTime.parse(slotTime);
            return at.getHour() * 60 + at.getMinute();
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    /** Plain median (mean of the two middle values on an even count) — the chrononutrition
     *  quantile convention {@code MealRhythmDriftRule} already uses: one outlier day must not
     *  move a verdict. */
    private static double median(List<? extends Number> values) {
        List<Double> sorted = values.stream().map(Number::doubleValue)
            .sorted(Comparator.naturalOrder()).toList();
        int n = sorted.size();
        if (n == 0) {
            return 0.0;
        }
        return n % 2 == 1 ? sorted.get(n / 2) : (sorted.get(n / 2 - 1) + sorted.get(n / 2)) / 2.0;
    }

    private static String clock(Double minuteOfDay) {
        if (minuteOfDay == null) {
            return null;
        }
        int m = (int) Math.round(minuteOfDay);
        return "%02d:%02d".formatted((m / 60) % 24, m % 60);
    }

    /** One qualifying day, reduced to the three things the split needs. */
    private record Day(double energy, Integer lunchMinute, boolean breakfast) {
    }

    /** Per-day meal facts accumulated from the window's meal rows — mutable on purpose, it never
     *  leaves this class. */
    private static final class DayMeals {
        private boolean anyMeal;
        private boolean breakfast;
        private Integer lunchMinute;
    }

    /** A usable two-group split: the mode, the two group labels, the two energy samples and (in
     *  lunch mode only) the two groups' own median lunch minutes. */
    private record Split(String mode, String labelA, String labelB,
                         List<Double> groupA, List<Double> groupB,
                         Double medianLunchA, Double medianLunchB) {
    }
}
```

**Note on access style:** `Day` and `Split` are records, so every read of them above is an accessor call (`split.groupA()`, `d.lunchMinute()`). `DayMeals` is deliberately a plain mutable final class — it is accumulated field by field while scanning the meal rows — so `day.anyMeal` / `day.breakfast` / `day.lunchMinute` are field access there, exactly as written.

- [ ] **Step 4: Wire it into `FlagEvaluator`.** Add the import, the field after `mealRhythmDriftRule`:

```java
    private final EnergyDipMealTimingRule energyDipMealTimingRule;
```

and the call line directly after the `mealRhythmDriftRule` one:

```java
        verdicts.add(energyDipMealTimingRule.evaluate(userId, today));
```

Update the `evaluate` javadoc's count from "15 entries" to "16 entries".

- [ ] **Step 5: Run the IT until green.**

```bash
./mvnw -f backend/pom.xml -Dmezo.test.use-testcontainers=true -Dtest=FlagEvaluatorEnergyDipIT test
```

Expected: PASS, 11 tests run. If `stays_clear_when_the_medians_differ_but_the_groups_overlap` raises instead, check the orientation of `orientedSuperiority` — with those samples the share must land between 0.5 and 0.7.

- [ ] **Step 6: Commit.**

```bash
git add -A && git commit -m "feat(companion): energy_dip_meal_timing — afternoon energy vs meal timing (mezo-d58h.7.7)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: the card — facts, delivery and the switch-off proof

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagFactRenderer.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagFactRendererTest.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/InterventionServiceIT.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/EnergyDipMealTimingRuleSwitchOffIT.java`

**Interfaces:**
- Consumes: `FlagPayloadEnvelope.EnergyDipMealTiming` (Task 2), `FlagKey.ENERGY_DIP_MEAL_TIMING` (Task 1)
- Produces: three Hungarian fact lines per raise, rendered from the frozen payload alone

- [ ] **Step 1: Write the failing renderer test.** In `FlagFactRendererTest`, append (mirroring how the `protocol_lapse` case in that file is written):

```java
    /** Round 2 S6 (mezo-d58h.7.7): the lines name BOTH group sizes on purpose — the reader has to
     *  be able to see how thin the sample is — and never use a causal word. */
    @Test
    void rendersTheEnergyDipCorrelationWithBothGroupSizes() {
        FlagPayloadEnvelope payload = FlagPayloadEnvelope.energyDipMealTiming(
            new FlagPayloadEnvelope.EnergyDipMealTiming(
                "lunch_time", "earlier_lunch", "later_lunch",
                30, 12, 10,
                6, 6, 4,
                8.0, 5.0,
                3.0, 1.0,
                1.0, 0.70,
                "A",
                "12:00", "14:30"));

        List<String> facts = FlagFactRenderer.render(FlagKey.ENERGY_DIP_MEAL_TIMING, payload);

        assertThat(facts).hasSize(3);
        assertThat(facts.get(0)).contains("12:00").contains("14:30");
        assertThat(facts.get(1)).contains("8").contains("5");
        assertThat(facts).noneMatch(f -> f.contains("mert") || f.contains("ezért"));
    }

    /** The fallback mode has no lunch times to name — the line must still be a whole sentence. */
    @Test
    void rendersTheBreakfastPresenceModeWithoutLunchTimes() {
        FlagPayloadEnvelope payload = FlagPayloadEnvelope.energyDipMealTiming(
            new FlagPayloadEnvelope.EnergyDipMealTiming(
                "breakfast_presence", "with_breakfast", "without_breakfast",
                30, 14, 10,
                7, 7, 4,
                7.0, 5.0,
                2.0, 1.0,
                0.86, 0.70,
                "A",
                null, null));

        List<String> facts = FlagFactRenderer.render(FlagKey.ENERGY_DIP_MEAL_TIMING, payload);

        assertThat(facts).hasSize(3);
        assertThat(facts.get(0)).contains("reggeli");
        assertThat(facts).noneMatch(f -> f.contains("null"));
    }
```

- [ ] **Step 2: Run it — it must fail** (`render` returns an empty list for the unmapped key).

```bash
./mvnw -f backend/pom.xml -Dmezo.test.use-testcontainers=true -Dtest=FlagFactRendererTest test
```

- [ ] **Step 3: Add the renderer arm.** In `FlagFactRenderer.render`'s switch, after the `MEAL_RHYTHM_DRIFT` case:

```java
            case FlagKey.ENERGY_DIP_MEAL_TIMING -> energyDipMealTiming(payload.energyDipMealTiming());
```

and the private renderer next to `mealRhythmDrift(...)`:

```java
    /** Round 2 S6 (mezo-d58h.7.7): a CORRELATION, stated as one. Three lines: how the two groups
     *  were formed, what each one's median afternoon energy was, and how big the sample is. No
     *  causal word appears — the whole card's honesty rests on that. */
    private static List<String> energyDipMealTiming(FlagPayloadEnvelope.EnergyDipMealTiming p) {
        if (p == null) {
            return List.of();
        }
        List<String> facts = new ArrayList<>();
        if (ENERGY_DIP_BREAKFAST_PRESENCE.equals(p.splitMode())) {
            facts.add("Két csoport: %d nap rögzített reggelivel, %d nap anélkül"
                .formatted(p.groupADays(), p.groupBDays()));
        } else {
            facts.add("Két csoport: korábbi ebéd (jellemzően %s, %d nap) és későbbi ebéd (%s, %d nap)"
                .formatted(p.groupAMedianLunchTime(), p.groupADays(),
                    p.groupBMedianLunchTime(), p.groupBDays()));
        }
        facts.add("Délutáni energia mediánja: %s, illetve %s (különbség %s pont, küszöb %s)"
            .formatted(num(p.groupAMedianEnergy()), num(p.groupBMedianEnergy()),
                num(p.energyDelta()), num(p.minEnergyDelta())));
        facts.add("Ablak: %d nap, ebből %d nap volt értékelhető; a napok %s%%-ában áll fenn ez a sorrend"
            .formatted(p.windowDays(), p.qualifyingDays(), pct(p.superiority())));
        return List.copyOf(facts);
    }
```

and the constant next to `MEAL_RHYTHM_DEAD_SLOT` at the top of the class:

```java
    /** {@code EnergyDipMealTimingRule}'s frozen fallback split mode. */
    private static final String ENERGY_DIP_BREAKFAST_PRESENCE = "breakfast_presence";
```

- [ ] **Step 4: Add the delivery IT.** In `InterventionServiceIT`, mirror the `MEAL_RHYTHM_DRIFT` case (around line 286) for the new key: raise the flag with `flagLogPopulator.raise(...)`, call `interventionService.deliverForFlag(owner, FlagKey.ENERGY_DIP_MEAL_TIMING)`, and assert the delivered card's `adviceKey()` equals `FlagKey.ENERGY_DIP_MEAL_TIMING`. Read the S4 test's exact shape (payload argument included) and copy it — this proves the library entry, the channel and the cooldown all bind.

- [ ] **Step 5: Add the switch-off IT.** Create `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/EnergyDipMealTimingRuleSwitchOffIT.java`:

```java
package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.service.rule.EnergyDipMealTimingRule;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.TestPropertySource;

/** Round 2 S6 (mezo-d58h.7.7): companion switch off ⇒ no energy-dip rule bean, so the whole
 *  detection is genuinely absent rather than silently evaluating. */
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class EnergyDipMealTimingRuleSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;

    @Test
    void testContext_shouldHaveNoRuleBean_whenCompanionSwitchOff() {
        assertThat(context.getBeanProvider(EnergyDipMealTimingRule.class).getIfAvailable()).isNull();
    }
}
```

- [ ] **Step 6: Run the whole flag + proactive surface.**

```bash
./mvnw -f backend/pom.xml -Dmezo.test.use-testcontainers=true \
  -Dtest='FlagFactRendererTest+InterventionServiceIT+EnergyDipMealTimingRuleSwitchOffIT+FlagEvaluatorEnergyDipIT' test
```

Expected: PASS with a non-zero test count.

- [ ] **Step 7: Commit.**

```bash
git add -A && git commit -m "feat(companion): the energy-dip card — facts, library entry, switch-off proof (mezo-d58h.7.7)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: architecture gates

**Files:** none (verification only — fix whatever these report).

- [ ] **Step 1: ArchUnit + the companion/proactive suites.**

```bash
./mvnw -f backend/pom.xml -Dmezo.test.use-testcontainers=true \
  -Dtest='ArchitectureTest+LayerRulesTest' test
```

If those class names do not exist, find them first (`ls backend/src/test/java/io/mrkuhne/mezo/arch* backend/src/test/java/io/mrkuhne/mezo/architecture 2>/dev/null; grep -rl "ArchRule" backend/src/test | head`) and run what is actually there. `companion → biometrics` and `companion → meal` both already exist as accepted directions, so this should pass unchanged — but the point of the run is not to assume that.

- [ ] **Step 2: The whole companion-flags and proactive test packages.**

```bash
./mvnw -f backend/pom.xml -Dmezo.test.use-testcontainers=true \
  -Dtest='io.mrkuhne.mezo.feature.companion.flags.**,io.mrkuhne.mezo.feature.proactive.**' test
```

Expected: PASS. This is where an unmapped key, a stale enumeration or a broken CHECK surfaces.

- [ ] **Step 3: Commit any fixes.**

```bash
git add -A && git commit -m "fix(companion): satisfy the architecture and enumeration gates for the energy-dip flag (mezo-d58h.7.7)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

(Skip the commit if nothing needed fixing.)

---

### Task 6: docs + CODEMAP

**Files:**
- Modify: `docs/features/companion.md`
- Modify: `docs/features/proactive.md`
- Modify: `docs/CODEMAP.md` (generated)

- [ ] **Step 1: `docs/features/companion.md` — the rule writeup.** After the `MealRhythmDriftRule` bullet (starts around line 1627), add a `EnergyDipMealTimingRule` bullet in the same voice: rank 12, bd `mezo-d58h.7.7`, spec 2026-09-05 §(15), key `energy_dip_meal_timing`; the window and day gate; the two split modes and which is the fallback; the median delta plus the superiority requirement; the four bounds from the rule's javadoc — **including, explicitly, that the spec's "AND a logged morning meal" is implemented as "the day carries any logged meal", with the reason (the spec's own breakfast-present/absent fallback is impossible otherwise, and the gate's real job is proving the meal log is not missing)**; and the fact that the card only ever REPORTS a correlation.

- [ ] **Step 2: `docs/features/companion.md` — the rule table.** Add a `energy_dip_meal_timing` row to the table that holds the `meal_rhythm_drift` row (around line 4246), in the same three-column shape (key | trigger | data sources). Data sources: `check_in` (`CheckInRepository.findByCreatedByAndDeletedFalseAndDateBetween`), `meal`.

- [ ] **Step 3: `docs/features/companion.md` — the `all_healthy` note and key files.** At the `existsProblemRaiseSince` paragraph (around line 4262) extend the "stay counted as problems" list with `energy_dip_meal_timing` and say why (a genuine observation about the user's own days; with a 30-day cooldown it can block the quiet window at most once a month). In §Key files (around line 6553) add the rule class and the two changesets, in the S4 entries' exact style, and update the "fifteen keys" phrasing to sixteen.

- [ ] **Step 4: `docs/features/proactive.md`.** Add a §9 decision bullet after the `(nn)` `meal_rhythm_adjust` one (around line 3077): `energy_dip_timing_insight`, `channel: feed`, `cooldown-hours: 720` mirroring `cooldown-hours.energy-dip-meal-timing`, the rank position, and the copy rule (no causal word; both group sizes on the card). Also extend the rank narrative around line 952 with the new tail entry.

- [ ] **Step 5: Regenerate CODEMAP.**

```bash
node scripts/gen-codemap.mjs
```

- [ ] **Step 6: Verify the docs gates.**

```bash
node scripts/lint-liquibase.mjs && node scripts/check-codemap.mjs 2>/dev/null || true
git diff --stat
```

If `check-codemap.mjs` does not exist under that name, find the freshness gate the CI `lint` job runs (`grep -n "codemap" .github/workflows/ci.yml`) and run that.

- [ ] **Step 7: Commit.**

```bash
git add -A && git commit -m "docs(companion): the energy-dip correlation rule — recipe, bounds, the spec deviation (mezo-d58h.7.7)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: ship it

- [ ] **Step 1: Push and open the self-PR.**

```bash
git push -u origin feat/proactive-round2-s6-energy-dip && \
gh pr create --fill --title "feat(companion): energy_dip_meal_timing — afternoon energy vs meal timing (mezo-d58h.7.7)"
```

The PR body must end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

- [ ] **Step 2: Wait for CI green.**

```bash
gh pr checks --watch
```

CI (`ci.yml`) is the authoritative full-suite gate — the local runs above were focused only.

- [ ] **Step 3: Re-check the merge result against the CURRENT main.**

```bash
gh workflow run premerge.yml -f pr=<number>
```

(~7 min. A PR's own green tick can predate the base it will actually merge into.)

- [ ] **Step 4: Merge locally with `--no-ff` and push.**

```bash
git switch main && git pull --rebase && \
git merge --no-ff feat/proactive-round2-s6-energy-dip && git push && \
git branch -d feat/proactive-round2-s6-energy-dip && git push origin --delete feat/proactive-round2-s6-energy-dip
```

- [ ] **Step 5: Close the issue and refresh the tracker backup.**

```bash
bd close mezo-d58h.7.7 && node scripts/check-beads-backup.mjs --fix && \
git add .beads/issues.jsonl && \
git commit -m "chore(beads): refresh the tracker export after round 2 S6 (mezo-d58h.7.7) [skip ci]" && \
bd dolt push && git push
```

- [ ] **Step 6: Close the round-2 epic if S6 was the last open child.**

```bash
bd show mezo-d58h.7
```

`mezo-d58h.7.6` ("Question cards should not say „Segített?"") is a separate P3 follow-up — the epic closes only once that is handled or explicitly deferred. Report which, do not silently close it.

---

## Self-Review

**Spec coverage (round-2 spec §(15) and the shared sections):**

| Spec requirement | Task |
|---|---|
| Minimum 10 days with an 11:00–16:00 check-in energy AND meal data | Task 1 (config), Task 3 (day gate + `NOT_ENOUGH_ENERGY_MEAL_DAYS`) |
| Split by lunch time around the window median | Task 3, `lunchTimeSplit` |
| Fallback split on breakfast present/absent when lunch times don't vary | Task 3, `breakfastPresenceSplit` + the separation gate that unlocks it |
| Medians differ by ≥ 1 full point, consistently, ≥ 4 days per group | Task 1 (`min-energy-delta`, `min-superiority`, `min-group-days`), Task 3 |
| Phrased as correlation, never causation | Task 1 (library copy), Task 4 (fact renderer + its no-causal-word assertion) |
| Cooldown 30 days | Task 1 (`cooldown-hours` 720 **and** the library entry's 720) |
| `FlagKey` + `FlagProperties` + `application.yml` + `FlagEvaluator` wiring + `AdvicePriority` + library entry + CHECK widening + per-rule IT | Tasks 1, 3, 4 |
| Silence is the default; the sweep never fails on this rule | Task 3 (every gate returns `unavailable`, no throw path) |
| Timezone: wall-clock convention, no UTC games | Task 3 (Bound 4) |
| Switches (`COMPANION_SWITCH`) + switch-off IT | Task 3 (`@ConditionalOnProperty`), Task 4 |
| `AdvicePriorityTest` extension | Task 1 — the existing reflection guard covers it automatically; Step 11 runs it |
| CODEMAP regen + `docs/features/proactive.md` update | Task 6 |

**Deliberate deviation, recorded:** the spec's day gate says "AND a logged morning meal"; this plan implements "AND any logged meal that day" and documents why in the rule javadoc (Bound 2), in `docs/features/companion.md` (Task 6 Step 1), and here. Without it the spec's own breakfast fallback cannot exist.

**Type consistency:** `FlagPayloadEnvelope.EnergyDipMealTiming` has the same 17 components everywhere it appears (Task 2's definition, Task 3's construction, Task 4's two test literals). `FlagProperties.EnergyDipMealTiming`'s eight accessors are used under the same names in Tasks 1, 3 and the `FlagPropertiesIT` assertions. `SPLIT_LUNCH_TIME` / `SPLIT_BREAKFAST_PRESENCE` in the rule and `ENERGY_DIP_BREAKFAST_PRESENCE` in the renderer are separate constants holding the same literals on purpose — companion's renderer must not import a rule class (the existing `MEAL_RHYTHM_DEAD_SLOT` precedent).
