# Súly-diagnózis Implementation Plan (mezo-85x5r)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The third diagnosis question — „Miért mozog a súlyom?" — week-anchored, launched
from the weekly weight card, with a code-computed decomposition (real delta / tissue ceiling /
goal band / strength trend) above the LLM-ranked water suspects.

**Architecture:** Extend the `DiagnosisRecipe` engine: five new nutrition `MetricKey`s, a
window-generalized collector, an `anchor_start` column + contract field, a `WEIGHT` recipe with
a per-recipe coverage override, a pure `WeightDecomposition` calculator emitting
`kind='derived'` evidence, and FE wiring (catalog + `WeeklyWeightCard` button + Számvetés
block). Everything else (quota, feedback, probe→experiment, stale) is reused untouched.

**Tech Stack:** Java 21/Spring Boot 3/Liquibase · contract-first OpenAPI · React 19 + TanStack
Query · Vitest+MSW · `AbstractIntegrationTest`/`ApiIntegrationTest` + `FakeCompanionLlm`.

**Spec:** `docs/superpowers/specs/2026-09-19-weight-diagnosis-design.md` (Prior art + terrain
sections there; numbers below come from it).

## Global Constraints

- Branch `feat/weight-diagnosis` (cut from origin/main v2.286.0). One bd issue per slice
  (children of `mezo-85x5r`), self-PR, CI green, merge.
- **Index is the contract:** new `MetricKey` entries append at the enum END; the WEIGHT
  recipe's metric list order is frozen once merged.
- **null = unknown, never 0** for `snapshotFiberG/SugarG/SaltG` rollups; a day with no
  carrying item yields NO point.
- Focused local tests only, with `-Dmezo.test.use-testcontainers=true`; CI is the full gate.
  FE: `CI=true pnpm test` AND `CI=true VITE_USE_MOCK=false pnpm test` AND `pnpm build`
  (file filters after `--` do NOT scope — run the suite).
- Liquibase: `2026MMDDHHMM_mezo-85x5r_<desc>.sql` + `1.0.0_master.yml` entry + lint.
- Hungarian UI copy verbatim from this plan; code/comments English.
- Physics constants (from the spec's Prior art): fat 7700 kcal/kg, lean ~1800 kcal/kg,
  glycogen 3–4 g water/g CH, >1 %BW/week ⇒ non-tissue; bands cut 0.25–1 / bulk 0.1–0.25
  %BW/wk; no persistent-change language under 2–3 weeks.
- After any main merge: `node scripts/gen-codemap.mjs` (merge drops CODEMAP entries silently).

## File Structure

| File | Responsibility |
|---|---|
| `feature/companion/service/MetricKey.java` (mod) | +5 entries appended: `DAILY_CARBS_G`, `DAILY_FAT_G`, `DAILY_SUGAR_G`, `DAILY_SALT_G`, `DAILY_FIBER_G` |
| `feature/companion/service/MetricSeriesService.java` (mod) | 2 `fuelRollup` cases + new `nutrientRollup` over meal-item snapshots |
| `feature/proactive/service/FatigueEvidenceCollector.java` (mod) | `gather(userId, from, to, recipe)` window generalization + per-recipe coverage |
| `feature/proactive/service/DiagnosisRecipe.java` (mod) | +`WEIGHT` entry; +`minCoverageDays` component (null → properties default) |
| `feature/proactive/service/WeightDecomposition.java` (new) | pure calculator → derived `EvidenceItem`s |
| `feature/proactive/service/DiagnosisGenerator.java` (mod) | anchored window; derived items prepended; weight prompt block |
| `feature/proactive/service/DiagnosisService.java` (mod) | `anchorStart` validation, (weight,anchor) reuse, weigh-in gate |
| `feature/proactive/entity/DiagnosisEntity.java` + `DiagnosisEvidenceEnvelope.java` (mod) | `anchorStart` field; `kind` doc widens with `derived` |
| `db/.../2026092012??_mezo-85x5r_*.sql` ×1 (new) | `anchor_start` + ck `('fatigue','sleep','weight')` |
| `api/feature/diagnosis/diagnosis.yml` (mod) | `anchorStart` on request+response; kind pattern `+derived`; phenomenon `+weight` |
| `frontend/.../logic/diagnosisCatalog.ts` (mod) | weight → LIVE; „Miért nem mozdul a súlyom?" leaves UPCOMING |
| `frontend/.../data/insights/diagnosisApi.ts` + `diagnosisHooks.ts` + `diagnosisMock.ts` (mod) | `anchorStart` plumb + anchored mock row |
| `frontend/.../me/components/WeeklyWeightCard.tsx` (mod) | „✦ Mi történt ezen a héten?" open-or-generate |
| `frontend/.../insights/pages/DiagnosisDetailPage.tsx` (mod) | Számvetés block (derived items) above suspects |

---

### Task 1: Five nutrition metrics (bd child: extractors)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MetricKey.java` (append before the closing `;` of the entry list — AFTER `TEXT_SOCIAL_CONTACT`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MetricSeriesService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/MetricSeriesNutrientIT.java` (new)

**Interfaces:**
- Consumes: `fuelRollup(userId, from, to, FuelValue)` (`MetricSeriesService.java:272`),
  `MacroSet::getC` / `::getF` (same DTO family as the existing `::getKcal`/`::getP` cases),
  `MealEntity.getItems()` → `MealItemEntity.getSnapshotSugarG()/getSnapshotSaltG()/getSnapshotFiberG()` (nullable `BigDecimal`).
- Produces: five servable `MetricKey`s (all default-correlatable) for Task 3's recipe.

- [ ] **Step 1: Write the failing IT** — seed via the existing meal populator idiom (open
  `support/populator/MealPopulator.java` first; use `createPantryMeal(owner, pantryItem,
  mealDate)` and set the item snapshots directly, `saveAndFlush` through its repository):

```java
package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** The five nutrition series (mezo-85x5r): carbs/fat ride the fuel rollup; sugar/salt/fiber
 *  sum the frozen meal-item snapshots with null = unknown (a day whose items all lack the
 *  nutrient yields NO point — never zero). */
class MetricSeriesNutrientIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.now().minusDays(2);

    @Autowired private MetricSeriesService metricSeriesService;
    // + UserPopulator, MealPopulator (and its item repository) — mirror MealScore seeding
    //   in this package's existing MetricSeriesServiceIT for the exact factory calls.

    @Test
    void carbsAndFatRideTheFuelRollup() {
        UUID user = seedUserWithOneMeal(DAY, /*carbs*/ 180, /*fat*/ 40, null, null, null);
        assertThat(metricSeriesService.series(user, MetricKey.DAILY_CARBS_G, DAY, DAY))
                .containsEntry(DAY, 180.0);
        assertThat(metricSeriesService.series(user, MetricKey.DAILY_FAT_G, DAY, DAY))
                .containsEntry(DAY, 40.0);
    }

    @Test
    void nutrientRollupSumsSnapshotsAcrossItems() {
        UUID user = seedUserWithTwoItems(DAY, /*sugarPerItem*/ "12.5", /*saltPerItem*/ "1.2",
                /*fiberPerItem*/ "8.0");
        assertThat(metricSeriesService.series(user, MetricKey.DAILY_SUGAR_G, DAY, DAY))
                .containsEntry(DAY, 25.0);
        assertThat(metricSeriesService.series(user, MetricKey.DAILY_SALT_G, DAY, DAY))
                .containsEntry(DAY, 2.4);
        assertThat(metricSeriesService.series(user, MetricKey.DAILY_FIBER_G, DAY, DAY))
                .containsEntry(DAY, 16.0);
    }

    @Test
    void allNullSnapshotsYieldNoPointNeverZero() {
        UUID user = seedUserWithOneMeal(DAY, 180, 40, /*sugar*/ null, /*salt*/ null, /*fiber*/ null);
        assertThat(metricSeriesService.series(user, MetricKey.DAILY_SALT_G, DAY, DAY)).isEmpty();
        assertThat(metricSeriesService.series(user, MetricKey.DAILY_SUGAR_G, DAY, DAY)).isEmpty();
    }

    @Test
    void mixedNullAndValueCountsOnlyTheCarryingItems() {
        UUID user = seedUserWithTwoItemsOneNullSalt(DAY, /*saltOnItem2*/ "1.5");
        assertThat(metricSeriesService.series(user, MetricKey.DAILY_SALT_G, DAY, DAY))
                .containsEntry(DAY, 1.5);
    }
}
```
  (The four `seed…` helpers are private methods in the test built on the populators — write
  them against the real factory signatures you find in `MealPopulator`.)
- [ ] **Step 2:** Run `cd backend && ./mvnw test -Dtest=MetricSeriesNutrientIT -Dmezo.test.use-testcontainers=true` — FAIL: no such enum constants.
- [ ] **Step 3: Implement.** Append to `MetricKey` (exact entries, AFTER `TEXT_SOCIAL_CONTACT`, before the `;`):

```java
    DAILY_CARBS_G("napi szénhidrát", "Étkezés-napló", MetricDomain.FUEL),
    DAILY_FAT_G("napi zsír", "Étkezés-napló", MetricDomain.FUEL),
    DAILY_SUGAR_G("napi cukor", "Étkezés-napló (címke-pillanatképek)", MetricDomain.FUEL),
    DAILY_SALT_G("napi só", "Étkezés-napló (címke-pillanatképek)", MetricDomain.FUEL),
    DAILY_FIBER_G("napi rost", "Étkezés-napló (címke-pillanatképek)", MetricDomain.FUEL);
```

  In `MetricSeriesService.series()` add the cases next to `DAILY_KCAL` (`:112`):

```java
            case DAILY_CARBS_G -> fuelRollup(userId, from, to, MacroSet::getC);
            case DAILY_FAT_G -> fuelRollup(userId, from, to, MacroSet::getF);
            case DAILY_SUGAR_G -> nutrientRollup(userId, from, to, MealItemEntity::getSnapshotSugarG);
            case DAILY_SALT_G -> nutrientRollup(userId, from, to, MealItemEntity::getSnapshotSaltG);
            case DAILY_FIBER_G -> nutrientRollup(userId, from, to, MealItemEntity::getSnapshotFiberG);
```

  New private method (next to `fuelRollup`, same honest-absence contract):

```java
    /** Per-day sum of a frozen meal-item nutrient snapshot (mezo-85x5r). null = unknown:
     *  a null item contributes nothing, and a day where NO item carries the nutrient yields
     *  no point — never zero. */
    private Map<LocalDate, Double> nutrientRollup(UUID userId, LocalDate from, LocalDate to,
            Function<MealItemEntity, BigDecimal> extractor) {
        Map<LocalDate, Double> series = new HashMap<>();
        for (MealEntity meal : mealRepository.findAllOwned(userId)) {
            LocalDate day = meal.getMealDate();
            if (day.isBefore(from) || day.isAfter(to)) continue;
            for (MealItemEntity item : meal.getItems()) {
                BigDecimal v = extractor.apply(item);
                if (v != null) series.merge(day, v.doubleValue(), Double::sum);
            }
        }
        return series;
    }
```
  (Imports: `java.util.function.Function`, `MealItemEntity`. If `getItems()` is LAZY outside a
  transaction, the enclosing `series()` is already `@Transactional(readOnly = true)` — verify,
  it is.)
- [ ] **Step 4:** Re-run Step 2 — PASS (4 tests).
- [ ] **Step 5:** Regression: `./mvnw test -Dtest='MetricSeriesServiceIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true` — PASS.
- [ ] **Step 6:** Commit: `feat(companion): five nutrition series — carbs/fat rollup + snapshot nutrientRollup (mezo-85x5r)`

### Task 2: Collector window generalization (behaviour-preserving)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/FatigueEvidenceCollector.java:79-95`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/DiagnosisGenerator.java:106-115` (call site)

**Interfaces:**
- Produces: `FatigueGather gather(UUID userId, LocalDate windowFrom, LocalDate windowTo, DiagnosisRecipe recipe)` — baseline stays derived as the `properties.baselineDays()` days ENDING the day before `windowFrom`. The old 3-arg `gather(userId, today, recipe)` becomes a delegating alias computing `windowFrom = today.minusDays(properties.windowDays() - 1L)`, `windowTo = today` — so fatigue/sleep behavior is bit-identical.

- [ ] **Step 1:** Refactor exactly as above (no test-first — this is a pure signature refactor pinned by existing ITs). Payload's `ABLAK:` line derives day-count as `ChronoUnit.DAYS.between(windowFrom, windowTo) + 1` instead of `properties.windowDays()`.
- [ ] **Step 2:** Regression: `./mvnw test -Dtest='SleepDiagnosisIT,DiagnosisGeneratorIT,DiagnosisControllerIT,FatigueEvidenceCollectorIT' -Dmezo.test.use-testcontainers=true` — ALL PASS unchanged.
- [ ] **Step 3:** Commit: `refactor(proactive): collector takes an explicit [from,to] window (mezo-85x5r)`

### Task 3: Anchor schema + WEIGHT recipe + service gates

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202609201200_mezo-85x5r_diagnosis_weight_anchor.sql` + `1.0.0_master.yml` entry
- Modify: `DiagnosisEntity.java` (+`PHENOMENON_WEIGHT`, `@Pattern "fatigue|sleep|weight"`, `anchorStart` LocalDate nullable), `DiagnosisRecipe.java`, `DiagnosisService.java`, `DiagnosisRepository.java`, `api/feature/diagnosis/diagnosis.yml`, `DiagnosisProperties` untouched
- Test: extend `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/controller/DiagnosisControllerIT.java` + new `WeightDiagnosisIT.java` (service-level, Task 4 fills the generator half)

**Interfaces:**
- Produces: `DiagnosisRecipe` gains a 5th component `Integer minCoverageDays` (null → `properties.minCoverageDays()`); existing FATIGUE/SLEEP pass `null`. New entry:

```java
    /** Weight-as-outcome (mezo-85x5r): state first, water suspects after. 7-day anchor week
     *  ⇒ coverage override 3 (the global 7 would drop nearly every metric). */
    public static final DiagnosisRecipe WEIGHT = new DiagnosisRecipe(
            DiagnosisEntity.PHENOMENON_WEIGHT,
            "súly-mozgás",
            "{{NÉV}} azt kérdezi: miért mozog a súlya ezen a héten?",
            List.of(
                    MetricKey.WEIGHT_DELTA_KG,
                    MetricKey.WEIGHT_TREND_PCT_WK,
                    MetricKey.DAILY_KCAL,
                    MetricKey.DAILY_CARBS_G,
                    MetricKey.DAILY_FAT_G,
                    MetricKey.DAILY_SUGAR_G,
                    MetricKey.DAILY_SALT_G,
                    MetricKey.DAILY_FIBER_G,
                    MetricKey.DAILY_PROTEIN_G,
                    MetricKey.DAILY_WATER_ML,
                    MetricKey.LATE_MEAL_HOUR,
                    MetricKey.MEAL_SCORE,
                    MetricKey.ACWR,
                    MetricKey.TRAINING_MONOTONY,
                    MetricKey.GYM_VOLUME_KG,
                    MetricKey.COMBINED_LOAD_MIN,
                    MetricKey.SLEEP_DURATION_H,
                    MetricKey.SLEEP_QUALITY,
                    MetricKey.BEDTIME_VARIABILITY,
                    MetricKey.CHECKIN_STRESS,
                    MetricKey.MEDICATION_CYCLE_DAY,
                    MetricKey.MEDICATION_DOSE_MG),
            3);
```
- `DiagnosisService.generate(UUID userId, String phenomenon, LocalDate anchorStart)`:
  weight ⇒ `anchorStart` required + `anchorStart.getDayOfWeek() == MONDAY` else 400
  (`DIAGNOSIS_ANCHOR_NOT_MONDAY`); fatigue/sleep ⇒ anchorStart present → 400
  (`DIAGNOSIS_ANCHOR_NOT_SUPPORTED`). Weight window = `[anchorStart, min(anchorStart+6, today)]`.
  **Weigh-in gate:** `< 3` weigh-in days in that window ⇒ 409 `DIAGNOSIS_INSUFFICIENT_WEIGHINS`
  (count via the biometrics weight repository's owned date-range finder — same import family
  `LogFreshnessProbe` already uses). **Reuse:** `findByCreatedByAndPhenomenonAndAnchorStart`
  non-stale existing row → return it (no LLM, no quota).
- Contract: `DiagnosisGenerateRequest.anchorStart { type: string, format: date, nullable }`;
  `phenomenon` patterns widen to `^(fatigue|sleep|weight)$` (both places);
  `DiagnosisResponse.anchorStart` nullable date. Regenerate both clients
  (`cd api/generate && npm run generate:api` + `cd frontend && pnpm generate:api`).

- [ ] **Step 1:** Migration:

```sql
-- Weight diagnosis (bd mezo-85x5r): the third phenomenon is WEEK-ANCHORED. ck widens by
-- drop + re-add (the 202608311500_mezo-po3y precedent); anchor_start is the ISO Monday,
-- null for the rolling phenomena.
alter table diagnosis add column anchor_start date;
alter table diagnosis drop constraint ck_diagnosis_phenomenon;
alter table diagnosis add constraint ck_diagnosis_phenomenon
    check (phenomenon in ('fatigue', 'sleep', 'weight'));
```
  Register in master.yml; `node scripts/lint-liquibase.mjs` PASS.
- [ ] **Step 2:** Failing tests: in `DiagnosisControllerIT` — generate weight without anchor → 400; with Tuesday anchor → 400; anchor on other phenomena → 400; `WeightDiagnosisIT` — 2 weigh-ins → 409; existing (weight, anchor) row → second generate returns SAME id, no quota burn (assert `countGeneratedOn` unchanged).
- [ ] **Step 3:** Run — FAIL (compile/route).
- [ ] **Step 4:** Implement per Interfaces (entity+recipe+repo finder+service+controller pass-through+contract regen). Collector consumes `recipe.minCoverageDays()` where it read `properties.minCoverageDays()` (null-coalesced).
- [ ] **Step 5:** Run Step 2 tests + Task 2's regression set — PASS.
- [ ] **Step 6:** Commit: `feat(proactive): week-anchored weight phenomenon — schema, recipe, gates, reuse (mezo-85x5r)`

### Task 4: WeightDecomposition + prompt + generator wiring

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/WeightDecomposition.java`
- Modify: `DiagnosisGenerator.java` (derived items PREPENDED to the candidate list before the metric candidates so their indexes are stable-first; weight prompt block), `DiagnosisEvidenceEnvelope.java` (kind doc), `diagnosis.yml` kind pattern `^(metric|pattern|fact|derived)$`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/service/WeightDecompositionTest.java` (pure unit) + extend `WeightDiagnosisIT` (sentinel end-to-end)

**Interfaces:**
- Preflight (exact commands, run before writing imports):
  `grep -rn "interface WeightTrendQuery" backend/src/main/java` (the biometrics port the goal
  engine consumes — use the PORT, not `WeightTrendService`, from proactive) and
  `grep -n "findFirst.*Active\|status" backend/src/main/java/io/mrkuhne/mezo/feature/goal/repository/GoalRepository.java`
  for the active-goal finder. Then `./mvnw test -Dtest=ArchitectureTest …` immediately after
  adding the imports — if `proactive→train` (for `ExerciseRecordService.list`) closes a cycle,
  DROP the e1RM row (leave `GYM_VOLUME_KG` as strength proxy) and file the follow-up bd issue,
  per spec §2.4.
- Produces:

```java
/** Pure decomposition of one anchored week (mezo-85x5r §2). All inputs nullable-friendly:
 *  an absent input omits its row — never a zeroed or invented one. */
public record WeightDecomposition(List<DiagnosisEvidenceEnvelope.EvidenceItem> derivedItems) {
    public static WeightDecomposition compute(Inputs in) { ... }
    public record Inputs(
            Double weekAvgKg, Double prevWeekAvgKg, Integer weighInCount,
            Double rawMinKg, Double rawMaxKg,
            Double trendDeltaKgPerWeek,          // from the WeightTrendQuery port
            Double weekKcalSurplus,              // Σ(logged kcal − prescription TDEE), null if either side missing
            Double bodyweightKg,
            String goalTrajectory, Double goalRatePctPerWeek,  // null when no active goal
            Double e1rmTopDeltaPct) {}           // null when strength read unavailable
}
```
  Emitted rows (kind `derived`, sourceHu `"számvetés"`, label/detail exactly):
  1. `valódi delta` — `heti átlag X · előző hét Y · trend Δ Z kg/hét · nyers min→max ZAJ-ként jelölve`
  2. `szövet-plafon` — `többlet ≈ N kcal → max M kg zsír (7700 kcal/kg) · a delta többi része víz/glikogén/tartalom` (omitted when `weekKcalSurplus == null`); appends ` · >1% testsúly/hét → nem-szövet jel` when `|trendDelta|/bodyweight > 1%`.
  3. `cél-sáv` — trajectory+rate → `terven / terv fölött / terv alatt (sáv: a–b %/hét)`; no goal ⇒ `nincs aktív cél — sáv nélkül`.
  4. `erő-trend` — `top-gyakorlatok e1RM Δ +P% → glikogén/izom-sztori` vagy `−P% → fáradtság/víz-sztori` (omitted when null).
- Generator: for WEIGHT, prompt gains one block after the question sentence (verbatim):

```
A SZÁMVETÉS sorai kód által számolt tények — nem mondhatsz nekik ellent, és a plafon fölé
nem tulajdoníthatsz szövetet. A gyanúsítottak a VÍZ-részre vonatkoznak: CH-ugrás (1 g CH
3–4 g vizet köt glikogénként), só-ugrás, terhelés-ugrás (izomjavítási vízvisszatartás),
alváshiány/stressz (kortizol), késői nagy étkezés a mérés előtt, gyógyszer-ciklus
étvágy-hatás, kreatin/supplement-váltás. 2–3 hét konzisztens trend előtt tartós
irányváltást kimondani tilos.
```

- [ ] **Step 1:** Failing unit tests (`WeightDecompositionTest`, plain JUnit, no Spring):
  ceiling math (`surplus 3850 → 0.5 kg max fat`), band classification for cut/bulk/none,
  the >1%BW flag, every null-input omission branch, noise labeling. ~10 asserts, exact
  expected strings for labels.
- [ ] **Step 2:** Run — FAIL. Implement `compute` (pure, no Spring). PASS.
- [ ] **Step 3:** Failing IT half (`WeightDiagnosisIT`): seed a week (5 weigh-ins rising,
  daily meals with carbs spike, one gym session), plant `[fake-diagnosis:{…}]` in a confirmed
  pattern's MECHANISM (the established single-render channel) with one suspect citing a
  derived index → generated row's evidence STARTS with the derived items, suspects resolve,
  `anchorStart` persisted. Also: no-active-goal path renders the `nincs aktív cél` row.
- [ ] **Step 4:** Wire the generator (decomposition inputs assembled in a small package-private
  `WeightDecompositionInputsAssembler` next to it — reads via `WeightTrendQuery`, goal repo,
  fuel rollup already in hand from the collector's series, `ExerciseRecordService` guarded per
  Preflight). Run IT + `ArchitectureTest` — PASS.
- [ ] **Step 5:** Contract kind-pattern widening + client regen + `DiagnosisControllerIT` green.
- [ ] **Step 6:** Commit: `feat(proactive): WeightDecomposition — code-computed számvetés above the suspects (mezo-85x5r)`

### Task 5: Frontend — catalog, card button, Számvetés block

**Files:**
- Modify: `frontend/src/features/insights/logic/diagnosisCatalog.ts`, `frontend/src/data/insights/diagnosisApi.ts` (+`anchorStart` on generate/list mapping), `diagnosisHooks.ts` (`generateAsync(phenomenon, anchorStart?)` + `useDiagnosisForWeek(weekStart)` selector over the list), `diagnosisMock.ts` (one anchored weight row with 4 derived + 2 suspects), `frontend/src/features/me/components/WeeklyWeightCard.tsx`, `frontend/src/features/insights/pages/DiagnosisDetailPage.tsx`, `frontend/src/test/msw/handlers.ts`
- Tests: extend `DiagnosisListPage.test.tsx`/`DiagnosisDetailPage.test.tsx`/`WeeklyWeightCard.test.tsx`/`diagnosisHooks.test.tsx`

**Interfaces:**
- Catalog entry (verbatim):

```ts
  {
    phenomenon: 'weight',
    question: 'Miért mozog a súlyom?',
    blurb:
      'Egy kiválasztott hét súly-mozgása számvetéssel: mennyi lehet szövet, mennyi víz — és a víz-részhez rangsorolt gyanúsítottak.',
  },
```
  `'Miért nem mozdul a súlyom?'` leaves `UPCOMING_QUESTIONS`.
- `WeeklyWeightCard` footer button `✦ Mi történt ezen a héten?` — handler:
  `useDiagnosisForWeek(week.start)` hit → `navigate('/mezo/diagnozis/'+id)`; miss →
  `generateAsync('weight', week.start)` then navigate; 409 copy inline:
  `Ehhez a héthez kevés a mérés — legalább 3 reggeli mérés kell.` (map the new
  `DIAGNOSIS_INSUFFICIENT_WEIGHINS` code onto the existing `insufficient` error kind).
- Detail page: when any `evidence.kind === 'derived'` exists, render a `Számvetés` card
  (eyebrow `SZÁMVETÉS`, one `.mzp-evrow` per derived item — label bold + detail; house
  `mzp-*` classes ONLY, the `mzp-cta` lesson is pinned: assert the class in the test) above
  the verdict card; derived items are EXCLUDED from the suspect-cited evidence row lookup? —
  NO: they stay indexable (a suspect may cite them); they are only rendered once, in the
  Számvetés card, and the suspect rows resolve indexes against the full list as today.
  Hero sub for anchored rows: `Szep 14–20 · 5 mérés · a hét még nyitott` (last segment only
  while `anchorStart+6 >= today`).
- MSW: `POST /api/proactive/diagnosis` happy override returns the anchored row; default
  stays 409.

- [ ] **Step 1:** Failing tests (both modes): catalog shows 3 live cards; card button
  generate-then-navigate and reuse-navigate paths; detail renders the Számvetés card with 4
  rows + house classes; mock demo intact.
- [ ] **Step 2:** Implement; `CI=true pnpm test` AND `CI=true VITE_USE_MOCK=false pnpm test`
  AND `pnpm build` — ALL PASS.
- [ ] **Step 3:** Commit: `feat(fe): weight diagnosis — catalog, weekly-card launch, Számvetés block (mezo-85x5r)`

### Task 6: Gates, docs, PR

- [ ] Backend slice run: `./mvnw test -Dtest='MetricSeriesNutrientIT,WeightDecompositionTest,WeightDiagnosisIT,DiagnosisControllerIT,DiagnosisGeneratorIT,SleepDiagnosisIT,FatigueEvidenceCollectorIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true` — green.
- [ ] Docs: `proactive.md` §4 Diagnosis gains the WEIGHT recipe + decomposition paragraph + the anchor/reuse rows in the REST table; `companion.md` MetricKey note bumps 37→42; doc `updated:` dates; `node scripts/gen-codemap.mjs`; `node scripts/lint-docs.mjs` no new findings.
- [ ] Push, self-PR onto main, CI green (contract-drift WILL check both regenerated clients), merge per house flow; close the bd children + epic with commit ids.

## Done criteria

From the weekly card's +1.4 kg week: one tap → a report whose Számvetés says how much can be
tissue (ceiling), how the trend differs from the raw delta, where the goal band puts it — and
LLM-ranked, evidence-cited water suspects below, each with a probe that becomes an experiment.
Fatigue/sleep behavior bit-identical throughout.
