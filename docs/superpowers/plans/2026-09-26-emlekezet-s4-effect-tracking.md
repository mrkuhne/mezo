# S4 · Named Effect Tracking Implementation Plan (mezo-d6ivw.4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Named effect tracking — per-person and per-event-type tagged-day vs untagged-day
comparison against check-in mental/energy/stress, stored as `effect_link` rows recomputed
nightly, strong findings injected into the nightly hypothesis proposal, person effects shown
on the person page as an Üveg "Hatás" card (owner-approved prototype first).

**Architecture:** A pure Cliff's-delta calculator + a reflection-side recompute service
(companion → people reads only) feeding a companion-owned `effect_link` table; a new
`ReflectionJob` step; a `nightlyContext` section in `HypothesisPipelineService`; one new
companion GET endpoint; FE dual-mode hook + glass card on `PersonDetailPage`.

**Tech Stack:** Spring Boot + Liquibase + JPA (backend), OpenAPI contract
(`api/feature/companion/companion.yml` → generated BE interface + FE `api.gen.ts`),
React + TanStack Query + Üveg/mozaik UI kit (frontend).

## Global Constraints (from spec §S4 delta)

- Window: **60 days** rolling, ending yesterday (`today.minusDays(1)`).
- Metrics: `CHECKIN_MENTAL`, `CHECKIN_ENERGY`, `CHECKIN_STRESS` day means via
  `MetricSeriesService.series`; per-metric null-skip (a day absent from the series map simply
  isn't a data point for that metric). **Stress polarity is inverted** (higher = worse) — copy
  direction flips on the FE only; stored direction is always about the metric VALUE.
- Minimum-data gate per (subject, metric): **≥5 subject-days AND ≥10 complement-days**, each
  with the metric logged. Below gate → no row (existing row deleted).
- Strength = |Cliff's δ| bands: `<0.147` negligible (no row), `<0.33` **enyhe**, `<0.474`
  **közepes**, else **erős**. Confidence tier from subject-day count, independent of strength:
  `>=16` **erős**, `>=8` **közepes**, else **gyenge** (the `PeopleMoodLinkDetector` 8/16
  precedent).
- Hypothesis injection: only rows with strength band ≥ közepes AND confidence ≥ közepes.
  Stable topic keys: `effect-person-<first 8 hex of personId>-<metric>` /
  `effect-event-<eventKey>-<metric>`.
- Event-type effects have **NO surface** in S4 (owner decision) — engine + injection only.
- Person effects surface on `PersonDetailPage` only, prototype + owner OK before FE build.
- Non-causal hedged HU copy, strength and confidence shown as two separate signals; the
  sentence is assembled on the FE from structured fields — no server-side prose.
- No new feature switch: everything companion-side sits behind
  `COMPANION_SWITCH` ∧ `REFLECTION_SWITCH` (the `CompanionObservationController` /
  `DerivedSeriesService` idiom). No new LLM call, no new `LlmCallContext` slug.
- Code decides everything (thresholds, bands, tiers); LLM only ever phrases via the existing
  PROPOSE path.
- Tests: pure unit for the calculator (synthetic series, `today` as parameter,
  midnight-anchored fixtures); focused ITs for recompute/injection; FE both modes with
  `CI=true`; contract-drift gate on `companion.yml`.
- Commit subjects: conventional, carrying `(mezo-d6ivw.4)`.

---

### Task 1: Üveg prototype — "Hatás" card on the person page (OWNER GATE)

**Files:**
- Create: `docs/design_2.0/prototypes/ember-hatas-uveg.html`

This task follows the **/uvegesites Procedure §1 verbatim** (read that skill section before
starting): chrome copied from `docs/design_2.0/prototypes/fuel-uveg.html` untouched (header +
bottom dock), served over HTTP (`python3 -m http.server` from the prototypes dir), viewed with
cache-bust `?v=N`, an "Új ikonok" sheet if any new Titanium sprite icon is introduced, §3.4
ranking respected (not everything is glass), dark only.

- [ ] **Step 1: Build the prototype page**

Content: the person-page üveg anatomy (avatar hero with rose halo → stat strip → "Hangulat-ív"
card) extended with a new **"Hatás" section** between "Hangulat-ív" and "Milyen helyzetekben":

- Eyebrow: `Hatás · együttjárás` (marks it apart from the mention-tone "Hangulat-ív").
- One glass card, one accent (`--c` = the person's tone color), containing up to 3 metric
  rows. Each row:
  - a hedged, non-causal sentence, e.g.
    - mental ↑: „Úgy tűnik, azokon a napokon, amikor Anna szóba kerül, jobb a hangulatod.”
    - energy ↓: „Úgy tűnik, azokon a napokon, amikor Anna szóba kerül, kevesebb az energiád.”
    - stress ↓ (inverted copy): „Úgy tűnik, azokon a napokon, amikor Anna szóba kerül,
      nyugodtabb vagy.”
  - two SEPARATE small indicators under the sentence: strength (`enyhe/közepes/erős
    együttjárás` — 1–3 filled dots with accent glow) and confidence (`gyenge/közepes/erős
    bizonyosság` — its own 1–3 dots, visually distinct, e.g. hollow rings), plus the sample
    hint „14 nap alapján · átlagosan ~fél ponttal”.
  - a footer line on the card: „Együttjárás, nem ok-okozat.”
- Show two person variants (one with 3 rows, one with 1 row) and the below-gate state (card
  simply absent — include a note in the prototype explaining that).
- Reduced-motion branch per the üveg bible; rAF one-shot entrance like the existing person
  page cards.

- [ ] **Step 2: Verify in browser**

Serve over HTTP, open with `?v=1`, check 320px width, dark, reduced motion. Iterate.

- [ ] **Step 3: Commit**

```bash
git add docs/design_2.0/prototypes/ember-hatas-uveg.html
git commit -m "docs(proto): ember-oldali Hatás kártya üveg prototípus (mezo-d6ivw.4)"
```

- [ ] **Step 4: STOP — owner OK**

Show the owner the prototype (Hungarian, business language). **Do not start Task 6–8 (FE)
until the owner approves.** Tasks 2–5 (pure backend engine) may proceed while waiting.

### Task 2: Cliff's delta calculator (pure)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/reflection/service/EffectLinkCalculator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/reflection/service/EffectLinkCalculatorTest.java`

**Interfaces:**
- Produces: `EffectLinkCalculator.compute(Set<LocalDate> subjectDays, Map<LocalDate, Double>
  metricSeries)` → `Optional<Effect>` where
  `record Effect(double cliffsDelta, double meanDiff, int subjectDays, int complementDays,
  String strengthBand, String confidenceTier)` — `strengthBand` ∈
  `{"enyhe","kozepes","eros"}`, `confidenceTier` ∈ `{"gyenge","kozepes","eros"}`. Empty
  Optional = below gate OR negligible band. Constants public for tests:
  `MIN_SUBJECT_DAYS=5`, `MIN_COMPLEMENT_DAYS=10`, `NEGLIGIBLE=0.147`, `SMALL=0.33`,
  `MEDIUM=0.474`, `TIER_MEDIUM_MIN=8`, `TIER_STRONG_MIN=16`.

- [ ] **Step 1: Write the failing tests**

```java
package io.mrkuhne.mezo.feature.companion.reflection.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

/** Pure math — no Spring, no clock: every date is anchored explicitly (midnight-safe). */
class EffectLinkCalculatorTest {

    private static final LocalDate D0 = LocalDate.of(2026, 9, 1);

    /** subjectCount days at subjectValue, complementCount days at complementValue. */
    private static Object[] fixture(int subjectCount, double subjectValue,
                                    int complementCount, double complementValue) {
        Set<LocalDate> subjectDays = new HashSet<>();
        Map<LocalDate, Double> series = new HashMap<>();
        for (int i = 0; i < subjectCount; i++) {
            subjectDays.add(D0.plusDays(i));
            series.put(D0.plusDays(i), subjectValue);
        }
        for (int i = 0; i < complementCount; i++) {
            series.put(D0.plusDays(subjectCount + i), complementValue);
        }
        return new Object[] {subjectDays, series};
    }

    @Test
    void clearPositiveDifferenceIsStrongBand() {
        Object[] f = fixture(8, 8.0, 12, 5.0);
        @SuppressWarnings("unchecked") var subject = (Set<LocalDate>) f[0];
        @SuppressWarnings("unchecked") var series = (Map<LocalDate, Double>) f[1];
        var effect = EffectLinkCalculator.compute(subject, series).orElseThrow();
        assertThat(effect.cliffsDelta()).isEqualTo(1.0); // every subject day beats every other
        assertThat(effect.meanDiff()).isEqualTo(3.0);
        assertThat(effect.strengthBand()).isEqualTo("eros");
        assertThat(effect.confidenceTier()).isEqualTo("kozepes"); // 8 subject days
        assertThat(effect.subjectDays()).isEqualTo(8);
        assertThat(effect.complementDays()).isEqualTo(12);
    }

    @Test
    void clearNegativeDifferenceHasNegativeDelta() {
        Object[] f = fixture(6, 3.0, 15, 7.0);
        @SuppressWarnings("unchecked") var subject = (Set<LocalDate>) f[0];
        @SuppressWarnings("unchecked") var series = (Map<LocalDate, Double>) f[1];
        var effect = EffectLinkCalculator.compute(subject, series).orElseThrow();
        assertThat(effect.cliffsDelta()).isEqualTo(-1.0);
        assertThat(effect.meanDiff()).isEqualTo(-4.0);
        assertThat(effect.confidenceTier()).isEqualTo("gyenge"); // 6 subject days
    }

    @Test
    void tiesCountAsZeroInDelta() {
        // 5 subject days at 6.0 vs 10 complement days at 6.0 → delta 0 → negligible → empty
        Object[] f = fixture(5, 6.0, 10, 6.0);
        @SuppressWarnings("unchecked") var subject = (Set<LocalDate>) f[0];
        @SuppressWarnings("unchecked") var series = (Map<LocalDate, Double>) f[1];
        assertThat(EffectLinkCalculator.compute(subject, series)).isEmpty();
    }

    @Test
    void belowSubjectGateIsEmpty() {
        Object[] f = fixture(4, 9.0, 20, 4.0); // 4 < MIN_SUBJECT_DAYS
        @SuppressWarnings("unchecked") var subject = (Set<LocalDate>) f[0];
        @SuppressWarnings("unchecked") var series = (Map<LocalDate, Double>) f[1];
        assertThat(EffectLinkCalculator.compute(subject, series)).isEmpty();
    }

    @Test
    void belowComplementGateIsEmpty() {
        Object[] f = fixture(6, 9.0, 9, 4.0); // 9 < MIN_COMPLEMENT_DAYS
        @SuppressWarnings("unchecked") var subject = (Set<LocalDate>) f[0];
        @SuppressWarnings("unchecked") var series = (Map<LocalDate, Double>) f[1];
        assertThat(EffectLinkCalculator.compute(subject, series)).isEmpty();
    }

    @Test
    void subjectDayWithoutMetricIsNotADataPoint() {
        Object[] f = fixture(5, 8.0, 10, 5.0);
        @SuppressWarnings("unchecked") var subject = (Set<LocalDate>) f[0];
        @SuppressWarnings("unchecked") var series = (Map<LocalDate, Double>) f[1];
        subject.add(D0.plusDays(100)); // a subject day with NO metric value
        var effect = EffectLinkCalculator.compute(subject, series).orElseThrow();
        assertThat(effect.subjectDays()).isEqualTo(5); // the metric-less day never counted
    }

    @Test
    void smallOverlapLandsInMediumBand() {
        // subject: 5,6,6,7,7,8 (6 days) vs complement: 4,5,5,6,6,6,7,4,5,6 (10 days)
        Set<LocalDate> subject = new HashSet<>();
        Map<LocalDate, Double> series = new HashMap<>();
        double[] subjectVals = {5, 6, 6, 7, 7, 8};
        double[] complementVals = {4, 5, 5, 6, 6, 6, 7, 4, 5, 6};
        for (int i = 0; i < subjectVals.length; i++) {
            subject.add(D0.plusDays(i));
            series.put(D0.plusDays(i), subjectVals[i]);
        }
        for (int i = 0; i < complementVals.length; i++) {
            series.put(D0.plusDays(50 + i), complementVals[i]);
        }
        var effect = EffectLinkCalculator.compute(subject, series).orElseThrow();
        // hand-computed: wins 36.5-ish of 60 pairs → delta ≈ 0.35 → "kozepes"
        assertThat(effect.cliffsDelta()).isBetween(0.147, 0.474);
        assertThat(effect.strengthBand()).isEqualTo("kozepes");
    }
}
```

Before running, verify the delta of the last test by hand from the implementation's
definition (δ = (#(x>y) − #(x<y)) / (n₁·n₂) over all cross pairs); adjust the asserted band
if the hand count says otherwise — the test documents real math, not a wish.

- [ ] **Step 2: Run to verify failure**

```bash
cd backend && ../mvnw test -Dtest=EffectLinkCalculatorTest
```
Expected: compilation failure (class does not exist).

- [ ] **Step 3: Implement**

```java
package io.mrkuhne.mezo.feature.companion.reflection.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * S4 (mezo-d6ivw.4): tagged-day vs untagged-day effect size as Cliff's delta — non-parametric,
 * tie- and outlier-robust, valid at the 10–60 point sizes a 60-day personal window yields
 * (spec §S4 delta, prior art: Exist.io strength/confidence split + Bearable's with/without
 * framing). Pure function in the {@code PatternGate} tradition: no Spring, no DB, no clock.
 *
 * <p>Strength (|δ| band) and confidence (subject-day tier) are decided HERE, in code, and
 * independently of each other — a strong effect on few days is "erős együttjárás, gyenge
 * bizonyosság", never averaged into one number.
 */
public final class EffectLinkCalculator {

    public static final int MIN_SUBJECT_DAYS = 5;
    public static final int MIN_COMPLEMENT_DAYS = 10;
    public static final double NEGLIGIBLE = 0.147;
    public static final double SMALL = 0.33;
    public static final double MEDIUM = 0.474;
    public static final int TIER_MEDIUM_MIN = 8;
    public static final int TIER_STRONG_MIN = 16;

    public record Effect(double cliffsDelta, double meanDiff, int subjectDays,
                         int complementDays, String strengthBand, String confidenceTier) {}

    private EffectLinkCalculator() {}

    /**
     * Splits the metric series into subject-day and complement-day samples; a day missing
     * from the series is not a data point on either side. Empty = below gate or negligible.
     */
    public static Optional<Effect> compute(Set<LocalDate> subjectDays,
                                           Map<LocalDate, Double> metricSeries) {
        List<Double> subject = new ArrayList<>();
        List<Double> complement = new ArrayList<>();
        metricSeries.forEach((day, value) ->
                (subjectDays.contains(day) ? subject : complement).add(value));
        if (subject.size() < MIN_SUBJECT_DAYS || complement.size() < MIN_COMPLEMENT_DAYS) {
            return Optional.empty();
        }
        long wins = 0;
        long losses = 0;
        for (double s : subject) {
            for (double c : complement) {
                if (s > c) wins++;
                else if (s < c) losses++;
            }
        }
        double delta = (wins - losses) / (double) (subject.size() * complement.size());
        if (Math.abs(delta) < NEGLIGIBLE) {
            return Optional.empty();
        }
        double meanDiff = mean(subject) - mean(complement);
        return Optional.of(new Effect(delta, meanDiff, subject.size(), complement.size(),
                band(Math.abs(delta)), tier(subject.size())));
    }

    private static String band(double absDelta) {
        return absDelta < SMALL ? "enyhe" : absDelta < MEDIUM ? "kozepes" : "eros";
    }

    private static String tier(int subjectDays) {
        return subjectDays >= TIER_STRONG_MIN ? "eros"
                : subjectDays >= TIER_MEDIUM_MIN ? "kozepes" : "gyenge";
    }

    private static double mean(List<Double> values) {
        return values.stream().mapToDouble(Double::doubleValue).average().orElseThrow();
    }
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
cd backend && ../mvnw test -Dtest=EffectLinkCalculatorTest
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/reflection/service/EffectLinkCalculator.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/reflection/service/EffectLinkCalculatorTest.java
git commit -m "feat(companion): Cliff-delta hatás-kalkulátor, tiszta függvény (mezo-d6ivw.4)"
```

### Task 3: `effect_link` table + entity + repository

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.1.0/script/202609261400_mezo-d6ivw.4_effect_link.sql`
- Modify: the 1.1.0 changelog registry — find it with
  `grep -rn "202609261000_mezo-d6ivw.3_person_fact" backend/src/main/resources/db/changelog/`
  and register the new script EXACTLY the way the person_fact one is registered.
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/reflection/entity/EffectLinkEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/reflection/repository/EffectLinkRepository.java`

**Interfaces:**
- Produces: `EffectLinkEntity` (getters/setters via Lombok like sibling entities) with
  constants `SUBJECT_PERSON = "person"`, `SUBJECT_EVENT = "event"`, metric constants
  `METRIC_MENTAL = "mental"`, `METRIC_ENERGY = "energy"`, `METRIC_STRESS = "stress"`.
- Produces: `EffectLinkRepository extends JpaRepository<EffectLinkEntity, UUID>` with
  `List<EffectLinkEntity> findByCreatedByAndDeletedFalse(UUID createdBy)` and
  `List<EffectLinkEntity> findByCreatedByAndSubjectKindAndSubjectKeyAndDeletedFalse(UUID createdBy, String subjectKind, String subjectKey)`.

- [ ] **Step 1: Write the changelog SQL**

```sql
create table effect_link (
 id uuid not null default gen_random_uuid(),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 is_deleted boolean not null default false,
 subject_kind varchar(8) not null,
 subject_key varchar(64) not null,
 metric varchar(8) not null,
 cliffs_delta numeric(5,3) not null,
 mean_diff numeric(5,2) not null,
 subject_days int not null,
 complement_days int not null,
 strength_band varchar(8) not null,
 confidence_tier varchar(8) not null,
 window_days int not null,
 computed_at timestamptz not null,
 constraint pk_effect_link_id primary key(id),
 constraint fk_effect_link_created_by foreign key(created_by) references app_user(id) on delete cascade,
 constraint ck_effect_link_subject_kind check(subject_kind in ('person','event')),
 constraint ck_effect_link_metric check(metric in ('mental','energy','stress')),
 constraint ck_effect_link_strength check(strength_band in ('enyhe','kozepes','eros')),
 constraint ck_effect_link_confidence check(confidence_tier in ('gyenge','kozepes','eros'))
);
create unique index uq_effect_link_subject_metric on effect_link(created_by, subject_kind, subject_key, metric) where is_deleted = false;
```

Before writing, open the person_fact script's registration (changelog XML/YAML) and copy its
changeset envelope conventions exactly (author, id naming, file path style). No `?` jsonb
operators anywhere (Liquibase trap — not applicable here, plain DDL).

- [ ] **Step 2: Write the entity + repository**

Model `EffectLinkEntity` on `PersonFactEntity`'s JPA idioms (same base-column trio
`created_by/created_at/is_deleted`, `@SQLRestriction` soft-delete if the siblings carry it —
open `backend/.../feature/companion/reflection/entity/TextSignalEntity.java` and mirror its
annotations exactly, including the `@Table(name = "effect_link")` naming and any
`OwnedRepository`-style patterns). Fields: `subjectKind`, `subjectKey`, `metric`,
`cliffsDelta` (BigDecimal), `meanDiff` (BigDecimal), `subjectDays` (int),
`complementDays` (int), `strengthBand`, `confidenceTier`, `windowDays` (int),
`computedAt` (Instant).

- [ ] **Step 3: Boot check via any focused IT**

```bash
cd backend && ../mvnw test -Dtest=EffectLinkCalculatorTest
```
(compilation) and then one existing reflection IT to prove the context still starts and
Liquibase applies:

```bash
cd backend && ../mvnw test -Dtest=ReflectionJobIT
```
Expected: PASS (schema applied, no mapping errors).

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/resources/db/changelog backend/src/main/java/io/mrkuhne/mezo/feature/companion/reflection/entity/EffectLinkEntity.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/reflection/repository/EffectLinkRepository.java
git commit -m "feat(companion): effect_link tábla + entitás + repository (mezo-d6ivw.4)"
```

### Task 4: Mention context projection (people repo)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/people/repository/MentionRepository.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/people/repository/MentionContextSignal.java`

**Interfaces:**
- Produces: `record MentionContextSignal(UUID personId, Instant ts, String contextLabel)` and
  `MentionRepository.findContextSignals(UUID userId)` ordered `ts desc`.

- [ ] **Step 1: Add the projection**

```java
package io.mrkuhne.mezo.feature.people.repository;

import java.time.Instant;
import java.util.UUID;

/** S4 (mezo-d6ivw.4): the effect engine's day-flag input — id + day + context, nothing else. */
public record MentionContextSignal(UUID personId, Instant ts, String contextLabel) {}
```

In `MentionRepository`, next to `findSignals` (same projection idiom, same javadoc style —
one sentence on WHY a projection):

```java
    /** S4 (mezo-d6ivw.4): the nightly effect recompute reads only (personId, day, context) —
     *  a projection for the same dirty-check reason {@link #findSignals} exists. */
    @Query("""
        select new io.mrkuhne.mezo.feature.people.repository.MentionContextSignal(
            m.personId, m.ts, m.contextLabel)
        from MentionEntity m
        where m.createdBy = :userId and m.deleted = false
        order by m.ts desc
        """)
    List<MentionContextSignal> findContextSignals(@Param("userId") UUID userId);
```

- [ ] **Step 2: Compile + commit**

```bash
cd backend && ../mvnw test -Dtest=EffectLinkCalculatorTest && cd .. && git add backend/src/main/java/io/mrkuhne/mezo/feature/people/repository/ && git commit -m "feat(people): mention kontextus-projekció az effekt-motornak (mezo-d6ivw.4)"
```

### Task 5: `EffectLinkService` — nightly recompute + hypothesis prompt block

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/reflection/service/EffectLinkService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/reflection/service/ReflectionJob.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/HypothesisPipelineService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/reflection/EffectLinkServiceIT.java`

**Interfaces:**
- Consumes: `EffectLinkCalculator.compute(...)` (Task 2), `EffectLinkRepository` (Task 3),
  `MentionRepository.findSignals` / `.findContextSignals` (Task 4),
  `MetricSeriesService.series(userId, MetricKey.CHECKIN_MENTAL|CHECKIN_ENERGY|CHECKIN_STRESS, from, to)`,
  `TextSignalSeriesService.newestPerSource(userId, from, to)` (topics),
  `WorkoutSessionRepository.findDoneInstancesBetween(userId, from, to)` (edzés days).
- Produces: `EffectLinkService.recompute(UUID userId, LocalDate today)` → `int` (rows kept);
  `EffectLinkService.promptBlock(UUID userId)` → `String` ("" when nothing qualifies);
  `EffectLinkService.effectsForPerson(UUID userId, UUID personId)` →
  `List<EffectLinkEntity>` (Task 7's read); static
  `String topicKey(String subjectKind, String subjectKey, String metric)` returning
  `effect-person-<first8OfUuid>-<metric>` / `effect-event-<key>-<metric>`.

**Behaviour spec:**
- Window `[today-60, today-1]`.
- Person subjects: distinct mention days (`findSignals`, `ts` → system-zone LocalDate) per
  personId, only persons with ≥1 mention in the window.
- Event subjects (fixed code-enumerated taxonomy, each an OR of day-flag sources):
  - `edzes`: done workout-session days ∪ mention `context_label='edzes'` days
  - `munka`: mention ctx `munka` ∪ text-signal topic `munka` days
  - `csalad`: mention ctx `csalad` ∪ topic `család` days
  - `kozos_program`: mention ctx `kozos_program` ∪ ctx `baratok` days
  - `konfliktus`: mention ctx `konfliktus` days
  - `pihenes`: topic `pihenés` days
- For each (subject, metric in mental/energy/stress): `EffectLinkCalculator.compute`; present
  → upsert the row (match by user+kind+key+metric, update in place, stamp `computedAt`,
  `windowDays=60`); absent → soft-delete any existing row. Full recompute = the drift
  handling; the table is a cache of the current window, never history.
- Per-subject writes in their own `TransactionTemplate` + `REQUIRES_NEW`
  (`KnowledgeRecheckService.recheckOne` idiom, slice lesson 11).
- `promptBlock`: rows with strengthBand ∈ {kozepes, eros} AND confidenceTier ∈
  {kozepes, eros}, ordered by |delta| desc, capped at 6 rows, rendered as one line each:
  `- <subject label> és <metric label HU>: azokon a napokon <magasabb/alacsonyabb> (delta
  <x.xx>, <subjectDays> nap) · téma-kulcs: <topicKey>` with a header instructing the model to
  reuse the given `topicKey` verbatim when proposing. Person label = person name (read via
  `PeopleService`/person repository through the established companion→people read path —
  match how `PeopleSnapshotBlock` resolves names; look it up before coding). Never invent
  person names: unknown/deleted person → skip the row.
- `effectsForPerson`: rows `subject_kind='person' and subject_key=personId.toString()`,
  **with the serve-time confidence bump**: if a CONFIRMED pattern row exists whose evidence
  items contain `observation-topic-key:<topicKey(row)>` (see
  `HypothesisPipelineService.topicLabel` for the evidence-item format and
  `PatternEntity.STATUS_CONFIRMED`), lift `confidenceTier` one step (gyenge→kozepes→eros,
  cap eros) on the RETURNED value only — never stored.
- Service annotations: `@Service`, `@RequiredArgsConstructor`, `@ConditionalOnProperty(name =
  {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.REFLECTION_SWITCH},
  havingValue = "true")` — the `DerivedSeriesService` header, same javadoc style.

**ReflectionJob change** (`ReflectionJob.java:62-63`): inject `EffectLinkService` directly
(same gating, no provider needed) and add between evaluate and propose:

```java
            step("effects", userId, () -> effectLinkService.recompute(userId, today));
```

**HypothesisPipelineService change:** add
`private final ObjectProvider<EffectLinkService> effectLinkService;` (the
`ObservationContextService` idiom — reflection-gated collaborator reached lazily) and in
`nightlyContext(...)` append after the EMLÉKEK section:

```java
        String effects = effectsBlock(userId);
        if (!effects.isBlank()) {
            appendSection(out, effects);
        }
```

with

```java
    /** S4 (mezo-d6ivw.4): the named-effect engine's strong findings — code picked them, the
     *  model only phrases. "" while Reflexió is off or nothing clears the double gate. */
    private String effectsBlock(UUID userId) {
        EffectLinkService service = effectLinkService.getIfAvailable();
        return service == null ? "" : service.promptBlock(userId);
    }
```

`promptBlock`'s own header text (inside the service):
`NEVESÍTETT EGYÜTTJÁRÁSOK (kód számolta, nem ok-okozat — ha javaslatot építesz rá, a
megadott téma-kulcsot használd topicKey-ként):`.

- [ ] **Step 1: Write the failing IT**

`EffectLinkServiceIT` in the reflection IT package — find the sibling
`HypothesisEvaluationService` / `KnowledgeRecheckService` ITs
(`ls backend/src/test/java/io/mrkuhne/mezo/feature/companion/reflection/`) and copy their
base-class/bootstrap idiom exactly (owner user setup, repositories, direct service calls).
Cases, all with **midnight-anchored** fixtures (derive every date from a fixed
`LocalDate today = LocalDate.now()` handed to `recompute`, check-ins written to explicit
days inside `[today-60, today-1]`):

1. `personEffectRowUpsertedAndUpdated` — seed a person + mentions on 6 distinct days +
   check-ins (mental 8 on mention days, 5 on 12 other days) → `recompute` → one row
   (`person`, personId, `mental`, band `eros`, tier `gyenge`); change the data so delta
   flips negative → `recompute` again → SAME row id updated, negative `cliffsDelta`.
2. `belowGateRowIsDeleted` — existing row for a person who now has 3 mention days →
   `recompute` → row soft-deleted.
3. `eventTypeEdzesRow` — seed done workout sessions on 5 days + check-ins → row
   (`event`, `edzes`, ...) exists; assert no FE-visible side effects (nothing else to
   assert — presence is enough).
4. `promptBlockOnlyDoubleGatedRows` — one row eros/eros (via 16+ mention days) and one row
   enyhe/gyenge → `promptBlock` contains exactly the first (assert the topic key string
   `effect-person-<first8>-mental` present, the weak subject absent).
5. `confidenceBumpFromConfirmedObservation` — row with tier `kozepes`; insert a CONFIRMED
   pattern row whose evidence items include `observation-topic-key:` + the matching key
   (use the existing `patternPopulator` test fixture helpers — see slice lesson 10:
   `reflectionNoPlan(...)` for plan-less rows, then set status confirmed the way
   `PatternServiceIT` does) → `effectsForPerson` returns tier `eros`.
6. `stressPolarityIsNotFlippedInStorage` — high stress on mention days → row direction is
   positive delta (storage is value-space; FE flips copy).

- [ ] **Step 2: Run, verify failure**

```bash
cd backend && ../mvnw test -Dtest=EffectLinkServiceIT
```

- [ ] **Step 3: Implement the service + the two modifications**

Per the behaviour spec above. Keep `recompute` itself transaction-free; each subject's
upsert/delete runs through a `TransactionTemplate` field configured `REQUIRES_NEW`
(copy the exact construction from `KnowledgeRecheckService`).

- [ ] **Step 4: Run the IT + neighbors, verify pass**

```bash
cd backend && ../mvnw test -Dtest='EffectLinkServiceIT,ReflectionJobIT,HypothesisPipelineServiceIT'
```
(If `HypothesisPipelineServiceIT` doesn't exist under that name, run the tests that cover
`nightlyContext` — grep for `nightlyContext` in `backend/src/test`.)

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java backend/src/test/java
git commit -m "feat(companion): éjszakai nevesített hatás-recompute + hipotézis-kontextus blokk (mezo-d6ivw.4)"
```

### Task 6: Companion effects endpoint (contract + controller)

**Files:**
- Modify: `api/feature/companion/companion.yml`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/controller/CompanionEffectsController.java`
- Test: contract IT next to the sibling controller ITs (find
  `CompanionObservationController`'s IT and mirror it)
- Modify (generated): FE `frontend/src/data/_client/api.gen.ts` via `pnpm generate:api`

**Interfaces:**
- Produces wire: `GET /api/companion/effects?personId=<uuid>` →
  `PersonEffectsResponse { effects: EffectResponse[] }`,
  `EffectResponse { metric: mental|energy|stress, direction: higher|lower,
  strengthBand: enyhe|kozepes|eros, confidenceTier: gyenge|kozepes|eros,
  meanDiff: number, subjectDays: int, complementDays: int, computedAt: date-time }`.

- [ ] **Step 1: Add the path + schemas to companion.yml**

Model the path entry on `/api/companion/observation` (`companion.yml:556`), tag
`CompanionEffects`, operationId `listPersonEffects`, required `personId` query param
(`schema: { type: string, format: uuid }`), 200 → `PersonEffectsResponse`, 401 →
`SystemMessageList` (copy the sibling's error envelope exactly). Schemas in the components
section, enums spelled exactly as the Interfaces block above (direction is derived:
`cliffsDelta > 0 → higher`, else `lower`).

- [ ] **Step 2: Regenerate both sides**

Backend regenerates from the maven build; FE:

```bash
cd frontend && CI=true pnpm generate:api
```

Check `git diff --stat` shows only expected generated changes (contract-drift gate).

- [ ] **Step 3: Controller + IT**

`CompanionEffectsController implements CompanionEffectsApi` (generated name — check the
generated interface under `io.mrkuhne.mezo.api.controller` after the build), gated on
COMPANION + REFLECTION switches like `CompanionObservationController`, delegating to
`EffectLinkService.effectsForPerson(currentUserId.get(), personId)` and mapping entity →
DTO in the controller (BigDecimal → Double, direction from delta sign). IT: seed one
effect row, GET, assert JSON fields; assert 401 without auth if the sibling IT does.

- [ ] **Step 4: Run + commit**

```bash
cd backend && ../mvnw test -Dtest=CompanionEffectsControllerIT
git add api/ backend/ frontend/src/data/_client/api.gen.ts
git commit -m "feat(api): companion hatás-végpont személyre (mezo-d6ivw.4)"
```

### Task 7: FE data layer — dual-mode person effects

**Files:**
- Create: `frontend/src/data/me/personEffectsApi.ts`
- Create: `frontend/src/data/me/personEffectsHooks.ts`
- Modify: `frontend/src/data/me/people.ts` (mock effect fixtures)
- Modify: `frontend/src/data/types.ts` (domain type)
- Test: `frontend/src/data/me/personEffectsHooks.test.tsx`

**Interfaces:**
- Produces: `usePersonEffects(personId: string | undefined)` →
  `{ effects: PersonEffect[]; isPending: boolean }`;
  `PersonEffect { metric: 'mental'|'energy'|'stress', direction: 'higher'|'lower',
  strength: 'enyhe'|'kozepes'|'eros', confidence: 'gyenge'|'kozepes'|'eros',
  meanDiff: number, subjectDays: number }`; mock export `MOCK_PERSON_EFFECTS:
  Record<string, PersonEffect[]>` keyed by mock person id (give Anna-equivalent 3 rows —
  one per metric, mixed directions incl. a stress `lower` — and one other person 1 row;
  everyone else empty).

- [ ] **Step 1: Write the failing hook test** — mirror `peopleHooks.test.tsx` style: mock
  mode returns fixture rows for the seeded person and `[]` for others; real mode calls the
  endpoint (mock `apiFetch`) and maps wire → domain (strengthBand→strength,
  confidenceTier→confidence).
- [ ] **Step 2: Run to fail**

```bash
cd frontend && CI=true pnpm test -- run src/data/me/personEffectsHooks.test.tsx
```
(NOTE the repo trap: file args after `--` may not scope — if the full suite starts, run
`CI=true pnpm vitest run src/data/me/personEffectsHooks.test.tsx` instead; check
`package.json` scripts first.)
- [ ] **Step 3: Implement** — `personEffectsApi.getForPerson(personId)` via `apiFetch` +
  `components['schemas']['PersonEffectsResponse']`; hook with `useDualQuery` (the
  `peopleHooks` pattern), `queryKey: ['person-effects', personId]`, `enabled` only with a
  personId, `mockData` from `MOCK_PERSON_EFFECTS[personId] ?? []`.
- [ ] **Step 4: Run to pass, commit**

```bash
git add frontend/src/data
git commit -m "feat(fe): személy-hatások dual-mode adatréteg + mockok (mezo-d6ivw.4)"
```

### Task 8: FE "Hatás" card on PersonDetailPage (needs Task 1 owner OK)

**Files:**
- Modify: `frontend/src/features/me/pages/PersonDetailPage.tsx` (new section between
  "Hangulat-ív" and "Milyen helyzetekben", per the approved prototype)
- Modify: the ppl- prototype CSS section (find it:
  `grep -n "ppl-trendcard" frontend/src/**/*.css` / the file the existing ppl- classes live
  in) — port the prototype's `.ppl-effcard` styles
- Test: `frontend/src/features/me/pages/PersonDetailPage.test.tsx` (extend the existing
  page test if present; otherwise the peopleData test that covers this page — locate with
  `grep -rn "PersonDetailPage" frontend/src --include=*.test.*`)

**Interfaces:**
- Consumes: `usePersonEffects(person.id)` (Task 7).

**Copy rules (code-side sentence assembly, spec §S4 delta):**

```ts
const METRIC_COPY: Record<PersonEffect['metric'], { higher: string; lower: string }> = {
  mental: { higher: 'jobb a hangulatod', lower: 'nyomottabb a hangulatod' },
  energy: { higher: 'több az energiád', lower: 'kevesebb az energiád' },
  stress: { higher: 'feszültebb vagy', lower: 'nyugodtabb vagy' }, // polarity flip is HERE
}
const sentence = (name: string, e: PersonEffect) =>
  `Úgy tűnik, azokon a napokon, amikor ${name} szóba kerül, ${METRIC_COPY[e.metric][e.direction]}.`
```

Strength dots + confidence rings + „N nap alapján · átlagosan ~X ponttal” hint and the
„Együttjárás, nem ok-okozat.” footer, exactly as the approved prototype draws them. The
whole section renders ONLY when `effects.length > 0` (below-gate = absent, no nag). Honest
empty: no skeleton.

- [ ] **Step 1: Failing component test** — renders 3 rows for the fixture person (mock
  mode), hides the section for a person with no effects, stress+lower renders
  "nyugodtabb" copy, strength and confidence indicators both present with distinct
  aria-labels (`erősség: közepes`, `bizonyosság: erős`).
- [ ] **Step 2: Run to fail, implement, run to pass** (both FE modes):

```bash
cd frontend && CI=true pnpm test        # VITE_USE_MOCK unset
cd frontend && CI=true VITE_USE_MOCK=false pnpm test
```
- [ ] **Step 3: Commit**

```bash
git add frontend/src
git commit -m "feat(fe): Hatás kártya az ember lapján, üveg kánon (mezo-d6ivw.4)"
```

### Task 9: Gates, docs, runtime verify

- [ ] **Step 1: Backend focused suite**

```bash
cd backend && ../mvnw test -Dtest='EffectLink*,ReflectionJobIT,CompanionEffectsControllerIT'
```
plus ArchUnit:

```bash
cd backend && ../mvnw test -Dtest=ArchitectureTest
```

- [ ] **Step 2: FE full gates**

```bash
cd frontend && CI=true pnpm test && CI=true VITE_USE_MOCK=false pnpm test && pnpm build
```
Affected layout specs under `frontend/tests/layout` — run the person-page ones if any exist
(`ls frontend/tests/layout | grep -i person` / people).

- [ ] **Step 3: Runtime verify** — the `verify` skill on the person page (mock mode PWA),
  dark only, 320px, reduced motion: Hatás card renders for the fixture person, absent for
  an effect-less person.

- [ ] **Step 4: Docs + codemap**

- `docs/features/me.md`: person page "Hatás" card section (and fix the stale `me.md:30` /
  `:425` notes the recon flagged: removed placeholder "Hatások" factor cards are history —
  real Hatások now exist; `PersonEntity.knownFacts` comment staleness belongs to people
  docs — fix what §S3/S4 touched).
- `docs/features/companion.md` (or insights.md — whichever documents the reflection
  pipeline; check both): the effects step + prompt block.
- `node scripts/gen-codemap.mjs` and `node scripts/lint-docs.mjs`.

```bash
node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs
git add docs frontend backend && git commit -m "docs+gates: S4 hatásfigyelés dokumentáció, codemap (mezo-d6ivw.4)"
```

- [ ] **Step 5: Merge + deploy** per the /emlekezet skill §5 ("no-wait, net stays"):
rebase on origin/main, quick gates, detached-HEAD merge `--no-ff`, regenerate codemap after
the merge, push `origin HEAD:main`, watch the deploy workflow, delete the branch. Then the
skill's §6 close protocol (slice lessons appendix, bd close, beads backup, Hungarian owner
report).

---

## Self-review notes

- Spec coverage: engine (T2–T5), injection (T5), endpoint (T6), FE (T7–T8), prototype gate
  (T1), confidence bump (T5 `effectsForPerson`), silent event types (no FE task for them —
  deliberate, owner decision 2). Testing section of the delta mapped to T2/T5/T6/T8/T9.
- Types consistent: `Effect` (calculator) vs `EffectLinkEntity` (storage) vs
  `EffectResponse` (wire) vs `PersonEffect` (FE domain) — four layers, names distinct on
  purpose; mapping points named in T6 (controller) and T7 (api mapper).
- Known unknowns left to the executor WITH a lookup instruction (changelog registry file,
  IT base-class idiom, generated interface name, ppl- CSS file, layout spec names) — each
  has an exact grep/ls to resolve it.
