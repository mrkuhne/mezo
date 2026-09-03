# Régi meal-envelope-ok újrapontozása — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `mezo-jcpt.1` előtt írt `meal.breakdown` envelope-ok újrapontozása, hogy a tárolt súlyok renormalizáltak legyenek és a `ScoreLedger` Σ-ja megegyezzen a fejléc-pontszámmal.

**Architecture:** Verzióbélyeg (`formulaVersion`) kerül a jsonb envelope-ba; egy `@Profile("demodata")` `CommandLineRunner` a régebbi bélyegű étkezéseket a **valódi write-path-on** (`MealService`) pontozza újra, étkezésenként külön tranzakcióban. A `weekly_score` cache-t egy egyszeri Liquibase changeset üríti, mert annak frissesség-próbája `created_at`-et olvas és egy `UPDATE`-et nem venne észre.

**Tech Stack:** Java 21 · Spring Boot 4 / Hibernate 7 · PostgreSQL jsonb · Liquibase · JUnit 5 + AssertJ · Maven wrapper (`./mvnw`)

**Spec:** [`docs/superpowers/specs/2026-09-03-meal-envelope-rescore-design.md`](../specs/2026-09-03-meal-envelope-rescore-design.md)

## Global Constraints

- **bd id minden commit-subjectben:** `mezo-jcpt.2`. Formátum: `fix(meal): … (mezo-jcpt.2)`.
- **Lokális kapuk CSAK fókuszáltak.** `./mvnw test -Dtest=<Osztály>`. A `-Dmezo.test.use-testcontainers=true` **TILOS** (16 GB-os gépen OOM). A teljes suite a CI dolga.
- **Nincs contract-változás.** A `formulaVersion` nem lép ki a wire-re — a `BreakdownDtoMapper` mezőnként képez, és ezt a mezőt nem viszi. `api/openapi.yml` / `api.gen.ts` **változatlan**.
- **Nincs FE-változás.** Ez a szelet tisztán backend + docs; FE-teszt nem futtatandó.
- **ArchUnit:** `@Service` ⇒ `..service..` package; runner `@Component` a feature package **gyökerében**; **nincs osztály-szintű `@Transactional`** (metóduson legyen); nincs mezőinjekció (`@RequiredArgsConstructor` + `final`).
- **Új backend osztály ⇒ `node scripts/gen-codemap.mjs`** ugyanebben a szeletben (CI `--check` gate).
- **jsonb kulcsnév-konvenció:** camelCase (nincs Jackson naming-strategy override) — a SQL predikátum `breakdown ->> 'formulaVersion'`.

---

### Task 1: `formulaVersion` bélyeg az envelope-on

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/entity/MealBreakdownJson.java:23-31`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringService.java:143-145` és `:226-227`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealCoachStore.java:74-76`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/service/RecipeBreakdownProseService.java:172-173`
- Modify (konstruktor-hívás bővítés): `backend/src/test/java/io/mrkuhne/mezo/support/populator/MealPopulator.java:95`, `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeBreakdownApiIT.java:298`, `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/service/RecipeBreakdownProseServiceTest.java:34`, `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealCoachServiceIT.java:144`, `backend/src/test/java/io/mrkuhne/mezo/feature/meal/service/MealCoachPromptTest.java:28`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringServiceTest.java`

**Interfaces:**
- Produces: `MealScoringService.FORMULA_VERSION` (`public static final int`, értéke `1`) — a Task 2 SQL-predikátuma és a Task 4 runnere ezt olvassa.
- Produces: `MealBreakdownJson` **8-komponensű** rekord, a `formulaVersion` az UTOLSÓ komponens: `MealBreakdownJson(value, confidence, summary, tagline, dimensions, improve, tools, formulaVersion)`.

- [ ] **Step 1: Írd meg a bukó tesztet**

`MealScoringServiceTest`-be, a fájl végi teszt-blokk mellé (a meglévő `scoreMeal_weightsRenormalizeWhenADimensionDegrades` mintájára — nézd meg, hogyan épít `ScoredLine`-t, és használd ugyanazt a builder-hívást):

```java
@Test
void scoreMeal_stampsTheCurrentFormulaVersion() {
    MealBreakdownJson out = service.scoreMeal("lunch", lunchLines(), LocalTime.of(13, 0));

    assertThat(out.formulaVersion()).isEqualTo(MealScoringService.FORMULA_VERSION);
}

@Test
void recipeTemplateBreakdown_stampsTheCurrentFormulaVersion() {
    MealBreakdownJson out = service.recipeTemplateBreakdown("lunch", lunchLines());

    assertThat(out.formulaVersion()).isEqualTo(MealScoringService.FORMULA_VERSION);
}
```

`lunchLines()` a fájlban MÁR LÉTEZŐ line-építő helper (`:55`), amit a `scoreMeal_*` tesztek is hívnak — ne vezess be újat. A `recipeTemplateBreakdown` itt a 2-argumentumos overloadja (`:362` ugyanígy hívja).

- [ ] **Step 2: Futtasd, hogy lásd a bukást**

```bash
./mvnw -q test -Dtest=MealScoringServiceTest
```

Elvárt: **compile error** — `cannot find symbol: method formulaVersion()` és `cannot find symbol: variable FORMULA_VERSION`.

- [ ] **Step 3: Add hozzá a rekord-komponenst**

`MealBreakdownJson.java` — a rekord fejét egészítsd ki, és a javadoc alá tedd az indoklást:

```java
/**
 * … (a meglévő javadoc változatlan) …
 *
 * <p>{@code formulaVersion} a scorer FORMULA-generációja, nem a jsonb séma verziója
 * ({@link io.mrkuhne.mezo.feature.nutrition.service.MealScoringService#FORMULA_VERSION}).
 * A mezo-jcpt.1 ELŐTT írt envelope-okban hiányzik (deszerializáláskor {@code null}) — ez a
 * „0-s generáció", amit a mezo-jcpt.2 backfill újrapontoz. NEM lép ki a wire-re: a
 * {@code BreakdownDtoMapper} mezőnként képez és ezt kihagyja.
 */
public record MealBreakdownJson(
    BigDecimal value,
    BigDecimal confidence,
    String summary,
    String tagline,
    List<Dimension> dimensions,
    List<ImproveRow> improve,
    List<ToolRow> tools,
    Integer formulaVersion
) {
```

- [ ] **Step 4: Vedd fel a konstansot és bélyegezz**

`MealScoringService.java` — az osztály első mezőjeként (a `@RequiredArgsConstructor` mezők FÖLÉ, mert `static final`):

```java
    /**
     * A determinisztikus formula generációja. **Bumpold**, valahányszor egy változás a MÁR TÁROLT
     * envelope-ok számait elmozdítaná — ez az egyetlen jel, amiből a mezo-jcpt.2 backfill runner
     * tudja, melyik sort kell újrapontozni. A `1` az első bélyegzett generáció: a súly-
     * renormalizálás (`d51ec268b`) + a makró kcal-szignifikancia-skálázás (`01b194ac7`) UTÁNI
     * állapot. A bélyeg nélküli (`null`) envelope-ok az azok ELŐTTI, javítandó generáció.
     */
    public static final int FORMULA_VERSION = 1;
```

Majd a két `return new MealBreakdownJson(...)`:

`:143-145` (`scoreMeal`):

```java
        return new MealBreakdownJson(round2(value), round2(confidence), null, null,
            jsonDims, List.of(),
            tools(slot, lines, dims, localTime, base), FORMULA_VERSION);
```

`:226-227` (`recipeTemplateBreakdown`):

```java
        return new MealBreakdownJson(round2(value), round2(confidence), null, null, dims, List.of(),
            tools, FORMULA_VERSION);
```

- [ ] **Step 5: Őrizd meg a bélyeget a próza-írásnál**

A próza sosem mozdít számot — a bélyeg számnak számít, tehát átmásolandó, nem újragenerálandó.

`MealCoachStore.java:74-76`:

```java
                meal.setBreakdown(new MealBreakdownJson(det.value(), det.confidence(), summary,
                    tagline, mergeDimensionNotes(det.dimensions(), dimensionNotes), improve,
                    det.tools(), det.formulaVersion()));
```

`RecipeBreakdownProseService.java:172-173`:

```java
        return new MealBreakdownJson(det.value(), det.confidence(), prose.summary(), null, dims,
            improve, tools, det.formulaVersion());
```

- [ ] **Step 6: Javítsd a teszt-konstruktorokat**

Öt teszt-fájl épít kézzel envelope-ot. Mindegyikben az utolsó (`tools`) argumentum UTÁN kerül egy új argumentum:

- `MealPopulator.java:95` → `null` (ez a fixture szándékosan pre-jcpt.1 alakú), ÉS a `createScoredMeal` javadocjába kerüljön egy sor: `A verzióbélyeg szándékosan null: ez a fixture a pre-jcpt.1 envelope-alakot mintázza (mezo-jcpt.2).`
- `RecipeBreakdownApiIT.java:298` → `MealScoringService.FORMULA_VERSION` (importáld)
- `RecipeBreakdownProseServiceTest.java:34` → `MealScoringService.FORMULA_VERSION`
- `MealCoachServiceIT.java:144` → `det.formulaVersion()` (a `det` már ott van a scope-ban)
- `MealCoachPromptTest.java:28` → `MealScoringService.FORMULA_VERSION`

- [ ] **Step 7: Futtasd a teszteket**

```bash
./mvnw -q test -Dtest='MealScoringServiceTest,MealCoachPromptTest,RecipeBreakdownProseServiceTest'
```

Elvárt: PASS. Ha egy meglévő assert azért bukik, mert egy envelope-mezőt egyenlőségre hasonlít (nem mezőnként), írd át mezőnkéntire — a rekord `equals`-a most már a bélyeget is nézi.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(nutrition): formulaVersion stamp on the meal score envelope (mezo-jcpt.2)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Elavult envelope-ok keresője + a fixture-ök

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/repository/MealRepository.java` (a fájl végére, a `findByCreatedByAndDeletedFalseAndMealDateBetween…` UTÁN)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/MealPopulator.java` (két új metódus a `createScoredMeal` UTÁN)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealRescoreRunnerIT.java` (ÚJ fájl — ebben a taskban csak a finder-teszt kerül bele)

**Interfaces:**
- Consumes: `MealScoringService.FORMULA_VERSION` (Task 1).
- Produces: `MealRepository.findStaleEnvelopes(int version)` → `List<MealEntity>`.
- Produces: `MealPopulator.createStaleScoredMeal(UUID owner, PantryItemEntity pantryItem, LocalDate mealDate, String title, Instant loggedAt)` → `MealEntity` — nem-renormalizált súlyok, `null` bélyeg, KITÖLTÖTT próza.
- Produces: `MealPopulator.createCurrentScoredMeal(UUID owner, PantryItemEntity pantryItem, LocalDate mealDate, String title, Instant loggedAt)` → `MealEntity` — `FORMULA_VERSION` bélyeggel.

- [ ] **Step 1: Írd meg a bukó tesztet**

Új fájl `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealRescoreRunnerIT.java`. A `@ActiveProfiles("demodata")` + owner-feloldás mintáját a `GoalReevaluateRunnerIT`-ből másold; a pantry-fixture-höz nézd meg, hogyan szerez `PantryItemEntity`-t egy meglévő meal-IT (`MealCoachServiceIT`).

```java
package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.nutrition.service.MealScoringService;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * A mezo-jcpt.2 backfill: a pre-jcpt.1 envelope-ok súlyai nem renormalizáltak, ezért a
 * ScoreLedger kliensoldali Σ-ja széttart a fejléc-pontszámtól. A runner {@code @Profile("demodata")},
 * ezért kell az {@code @ActiveProfiles}; a no-arg {@code run()} overloadot hívjuk közvetlenül,
 * a {@code GoalReevaluateRunnerIT} mintájára.
 */
@Transactional
@ActiveProfiles("demodata")
class MealRescoreRunnerIT extends AbstractIntegrationTest {

    @Autowired private MealRepository mealRepository;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private AppUserRepository appUserRepository;

    private static final LocalDate DAY = LocalDate.of(2026, 6, 10);
    private static final Instant NOON = Instant.parse("2026-06-10T10:00:00Z");

    private UUID owner() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    @Test
    void findStaleEnvelopes_shouldReturnOnlyThePreStampGeneration() {
        UUID owner = owner();
        PantryItemEntity item = pantryItemPopulator.createFoodWithNutrients(owner, "csirkemell");
        MealEntity stale = mealPopulator.createStaleScoredMeal(owner, item, DAY, "régi", NOON);
        MealEntity current = mealPopulator.createCurrentScoredMeal(owner, item, DAY, "friss", NOON);

        List<MealEntity> found = mealRepository.findStaleEnvelopes(MealScoringService.FORMULA_VERSION);

        assertThat(found).extracting(MealEntity::getId).contains(stale.getId());
        assertThat(found).extracting(MealEntity::getId).doesNotContain(current.getId());
    }
}
```

`PantryItemPopulator.createFoodWithNutrients(UUID owner, String name)` (`:45`) az a builder, ami rost/cukor/só/telített-zsír snapshotot is ad — a scorer mikro- és WHO-dimenziója e nélkül degradálódna, és a teszt nem a renormalizálást mérné.

- [ ] **Step 2: Futtasd, hogy lásd a bukást**

```bash
./mvnw -q test -Dtest=MealRescoreRunnerIT
```

Elvárt: **compile error** — `cannot find symbol: method createStaleScoredMeal / createCurrentScoredMeal / findStaleEnvelopes`.

- [ ] **Step 3: Vedd fel a fixture-öket**

`MealPopulator.java`, a `createScoredMeal` UTÁN:

```java
    /**
     * Pre-mezo-jcpt.1 alakú envelope: a súlyok NEM renormalizáltak (egyetlen élő dimenzió 0.22
     * súllyal, miközben a {@code value} már el volt osztva a súlyösszeggel), a verzióbélyeg
     * hiányzik, és a próza-fészkek KI VANNAK töltve — pontosan az az állapot, amit a mezo-jcpt.2
     * backfillnek gyógyítania kell (a Σ(w·score)=0.11 széttart a 0.62-es fejléctől, és a próza
     * olyan számokról beszél, amiket az újrapontozás elmozdít).
     */
    public MealEntity createStaleScoredMeal(UUID owner, PantryItemEntity pantryItem,
        LocalDate mealDate, String title, Instant loggedAt) {
        MealEntity meal = createScoredMeal(owner, pantryItem, mealDate, title, loggedAt);
        MealBreakdownJson stale = meal.getBreakdown();
        meal.setBreakdown(new MealBreakdownJson(stale.value(), stale.confidence(),
            "Kiegyensúlyozott reggeli.", "Jó start",
            List.of(new MealBreakdownJson.Dimension("macro", "Kcal & makró", new BigDecimal("0.22"),
                new BigDecimal("0.50"), "P/C/F 17/71/11 vs 27/47/26", null, null, null, null,
                "A fehérje aránya elmarad a céltól.")),
            List.of(new MealBreakdownJson.ImproveRow("Tegyél mellé egy tojást.", "+8")),
            stale.tools(), null));
        return repository.saveAndFlush(meal);
    }

    /** Ugyanaz az étkezés, de MÁR a jelenlegi formula-generáció bélyegével — a backfill nem nyúlhat hozzá. */
    public MealEntity createCurrentScoredMeal(UUID owner, PantryItemEntity pantryItem,
        LocalDate mealDate, String title, Instant loggedAt) {
        MealEntity meal = createScoredMeal(owner, pantryItem, mealDate, title, loggedAt);
        MealBreakdownJson b = meal.getBreakdown();
        meal.setBreakdown(new MealBreakdownJson(b.value(), b.confidence(), b.summary(), b.tagline(),
            b.dimensions(), b.improve(), b.tools(), MealScoringService.FORMULA_VERSION));
        return repository.saveAndFlush(meal);
    }
```

Importáld, ami hiányzik (`MealScoringService`, `BigDecimal`, `Instant`, `LocalDate`).

- [ ] **Step 4: Vedd fel a findert**

`MealRepository.java`, a fájl végére:

```java
    /**
     * A mezo-jcpt.2 backfill munkalistája: azok az étkezések, amelyek tárolt envelope-ja a
     * {@code version}-nél KORÁBBI formula-generációból való. Natív, mert a predikátum a jsonb
     * oszlopon BELÜLRE néz: a pre-jcpt.1 envelope-okban a {@code formulaVersion} kulcs egyáltalán
     * nincs jelen, tehát a „hiányzó kulcs" és az „alacsonyabb szám" ugyanaz az eset
     * ({@code coalesce(…, 0)}).
     *
     * <p>Szándékosan CROSS-USER — ebben a repositoryban minden más finder {@code …AndCreatedBy…},
     * de egy adatjavítás nem user-scope-os (multi-user óta, mezo-qw37.1, több tulajdonos is lehet).
     */
    @Query(value = """
            select * from meal
             where is_deleted = false
               and breakdown is not null
               and coalesce((breakdown ->> 'formulaVersion')::int, 0) < :version
             order by created_by, meal_date, logged_at
            """, nativeQuery = true)
    List<MealEntity> findStaleEnvelopes(@Param("version") int version);
```

- [ ] **Step 5: Futtasd a tesztet**

```bash
./mvnw -q test -Dtest=MealRescoreRunnerIT
```

Elvárt: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(meal): stale-envelope finder keyed on the formula version (mezo-jcpt.2)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `MealService.rescore` — újrapontozás a valódi write-path-on

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealService.java` (új publikus metódus a `delete` UTÁN; `@Slf4j` az osztályra; új importok)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealRescoreRunnerIT.java` (bővítés)

**Interfaces:**
- Consumes: `MealRepository.findStaleEnvelopes(int)` (Task 2), `MealPopulator.createStaleScoredMeal(...)` (Task 2).
- Produces: `MealService.rescore(UUID mealId)` → `boolean` (`true`, ha újrapontozott; `false`, ha az étkezés eltűnt vagy sosem volt envelope-ja).

- [ ] **Step 1: Írd meg a bukó tesztet**

`MealRescoreRunnerIT`-be, a meglévő teszt mellé. Adj hozzá `@Autowired private MealService mealService;` és `@Autowired private jakarta.persistence.EntityManager entityManager;` mezőket.

```java
    @Test
    void rescore_shouldRenormalizeWeightsStampTheVersionAndClearProse() {
        UUID owner = owner();
        PantryItemEntity item = pantryItemPopulator.createFoodWithNutrients(owner, "csirkemell");
        MealEntity stale = mealPopulator.createStaleScoredMeal(owner, item, DAY, "régi", NOON);

        boolean rescored = mealService.rescore(stale.getId());

        assertThat(rescored).isTrue();
        entityManager.flush();
        entityManager.clear();
        MealBreakdownJson healed = mealRepository.findById(stale.getId()).orElseThrow().getBreakdown();

        assertThat(healed.formulaVersion()).isEqualTo(MealScoringService.FORMULA_VERSION);
        // A ScoreLedger invariánsa: az ÉLŐ súlyok 1.0-ra összegződnek, és Σ(súly·score) == value.
        double liveWeightSum = healed.dimensions().stream()
            .filter(d -> d.weight().signum() > 0)
            .mapToDouble(d -> d.weight().doubleValue()).sum();
        double ledgerSum = healed.dimensions().stream()
            .filter(d -> d.weight().signum() > 0)
            .mapToDouble(d -> d.weight().doubleValue() * d.score().doubleValue()).sum();
        assertThat(liveWeightSum).isCloseTo(1.0, within(0.02));
        assertThat(ledgerSum).isCloseTo(healed.value().doubleValue(), within(0.02));
        // A próza nem élheti túl a számokat, amiket magyarázott.
        assertThat(healed.summary()).isNull();
        assertThat(healed.tagline()).isNull();
        assertThat(healed.improve()).isEmpty();
        assertThat(healed.dimensions()).allSatisfy(d -> assertThat(d.note()).isNull());
    }
```

Importok: `io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson`, `io.mrkuhne.mezo.feature.meal.service.MealService`, `static org.assertj.core.api.Assertions.within`.

A `0.02` tűrés a `round2` kerekítés miatt kell (8 dimenzió, 2 tizedesre vágott súlyok).

- [ ] **Step 2: Futtasd, hogy lásd a bukást**

```bash
./mvnw -q test -Dtest=MealRescoreRunnerIT
```

Elvárt: **compile error** — `cannot find symbol: method rescore(UUID)`.

- [ ] **Step 3: Implementáld a `rescore`-t**

`MealService.java` — tedd `@Slf4j`-vé az osztályt (`lombok.extern.slf4j.Slf4j` import + annotáció a `@Service` mellé), és vedd fel a metódust a `delete` UTÁN:

```java
    /**
     * Újrapontoz egy MÁR PERZISZTÁLT étkezést ugyanazon a write-path-on, amit a {@link #create} és
     * az {@link #update} használ (mezo-jcpt.2 backfill) — így a súly-renormalizálás és a makró
     * kcal-szignifikancia szabálya pontosan EGY helyen él, és nem duplikálódik SQL-be.
     *
     * <p>A timing-kontextushoz kellő LOKÁLIS falóra-idő NINCS a soron fagyasztva (csak egy UTC
     * {@code Instant} van), ezért a ház konvenciójával vezetjük le ugyanerre az oszlopra:
     * {@code ZoneId.systemDefault()} — ahogy a {@code MealCoachService} is teszi. Ez egyben
     * MEGGYÓGYÍTJA a mezo-g8qm sorokat: azoknál a tárolt {@code Instant} helyes UTC volt, csak az
     * írás-idejű falióra-idő csúszott el, így a helyes instantból levezetett helyi idő most a
     * helyes {@code MealRole}-t adja (az issue jegyzete szerint ezek addig csak újralogolással
     * gyógyultak volna). A konvenció korlátja a SZERVER zónája, nem a felhasználóé — amíg a kettő
     * egyezik, pontos.
     *
     * <p>Az envelope ÜRES próza-fészkekkel íródik újra, betartva a coach-invariánst: egy elavult
     * verdikt nem élheti túl a számokat, amiket magyarázott ({@code MealCoachService} javadoc). A
     * coach a következő score-sheet-nyitáskor újragenerálja.
     *
     * @return {@code true}, ha újrapontozott; {@code false}, ha az étkezés eltűnt vagy sosem volt
     *     envelope-ja (pre-scoring sor — annak a backfillhez semmi köze).
     */
    @Transactional
    public boolean rescore(UUID mealId) {
        MealEntity meal = repository.findById(mealId).orElse(null);
        if (meal == null || meal.getBreakdown() == null) {
            return false;
        }
        BigDecimal before = meal.getScore();
        OffsetDateTime loggedAt = meal.getLoggedAt().atZone(ZoneId.systemDefault()).toOffsetDateTime();
        applyScore(meal.getCreatedBy(), meal, loggedAt);
        repository.saveAndFlush(meal);
        log.debug("Re-scored meal {} ({}): {} -> {}", mealId, meal.getMealDate(), before, meal.getScore());
        return true;
    }
```

Új importok: `java.time.ZoneId`, `lombok.extern.slf4j.Slf4j`. (`OffsetDateTime`, `BigDecimal`, `UUID`, `Transactional` már bent vannak.)

- [ ] **Step 4: Futtasd a tesztet**

```bash
./mvnw -q test -Dtest=MealRescoreRunnerIT
```

Elvárt: PASS (mindkét teszt).

- [ ] **Step 5: Ellenőrizd, hogy a write-path nem sérült**

```bash
./mvnw -q test -Dtest=MealApiIT
```

Elvárt: PASS — a `MealApiIT:323-353` a wire-szintű `Σ(weight·score) == value` invariánst pinneli.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(meal): MealService.rescore re-runs the write-path over a stored meal (mezo-jcpt.2)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: A backfill runner

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/MealRescoreRunner.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealRescoreRunnerIT.java` (bővítés)

**Interfaces:**
- Consumes: `MealRepository.findStaleEnvelopes(int)` (Task 2), `MealService.rescore(UUID)` (Task 3).
- Produces: `MealRescoreRunner.run()` (no-arg overload) → `int` — a ténylegesen újrapontozott étkezések száma.

- [ ] **Step 1: Írd meg a bukó teszteket**

`MealRescoreRunnerIT`-be. Adj hozzá `@Autowired private MealRescoreRunner runner;`.

```java
    @Test
    void run_shouldHealTheStaleMealAndLeaveTheCurrentOneUntouched() {
        UUID owner = owner();
        PantryItemEntity item = pantryItemPopulator.createFoodWithNutrients(owner, "csirkemell");
        MealEntity stale = mealPopulator.createStaleScoredMeal(owner, item, DAY, "régi", NOON);
        MealEntity current = mealPopulator.createCurrentScoredMeal(owner, item, DAY, "friss", NOON);
        MealBreakdownJson currentBefore = current.getBreakdown();

        int healed = runner.run();

        entityManager.flush();
        entityManager.clear();
        assertThat(healed).isGreaterThanOrEqualTo(1);
        assertThat(mealRepository.findById(stale.getId()).orElseThrow().getBreakdown().formulaVersion())
            .isEqualTo(MealScoringService.FORMULA_VERSION);
        // A már aktuális envelope-hoz a runner NEM nyúlhat — enélkül az assert vak lenne egy
        // „mindent újrapontozok" implementációra.
        MealBreakdownJson currentAfter =
            mealRepository.findById(current.getId()).orElseThrow().getBreakdown();
        assertThat(currentAfter.value()).isEqualByComparingTo(currentBefore.value());
        assertThat(currentAfter.dimensions()).hasSameSizeAs(currentBefore.dimensions());
        assertThat(currentAfter.tagline()).isEqualTo(currentBefore.tagline());
    }

    @Test
    void run_shouldBeANoOpOnTheSecondPass() {
        UUID owner = owner();
        PantryItemEntity item = pantryItemPopulator.createFoodWithNutrients(owner, "csirkemell");
        mealPopulator.createStaleScoredMeal(owner, item, DAY, "régi", NOON);

        runner.run();
        entityManager.flush();
        entityManager.clear();

        assertThat(runner.run()).isZero();
    }
```

- [ ] **Step 2: Futtasd, hogy lásd a bukást**

```bash
./mvnw -q test -Dtest=MealRescoreRunnerIT
```

Elvárt: **compile error** — `cannot find symbol: class MealRescoreRunner`.

- [ ] **Step 3: Írd meg a runnert**

Új fájl `backend/src/main/java/io/mrkuhne/mezo/feature/meal/MealRescoreRunner.java` (a feature package **gyökerében**, nem `..service..` — ArchUnit):

```java
package io.mrkuhne.mezo.feature.meal;

import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.meal.service.MealService;
import io.mrkuhne.mezo.feature.nutrition.service.MealScoringService;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Egyszeri adatjavítás (mezo-jcpt.2): a mezo-jcpt.1 ELŐTT írt {@code meal.breakdown} envelope-ok
 * súlyai nem renormalizáltak (degradált dimenzió mellett Σ≈0.34), miközben a tárolt
 * {@code meal.score} már el volt osztva a súlyösszeggel — a {@code ScoreLedger} kliensoldali Σ-ja
 * ezért széttart a fejléc-pontszámtól. Ez a runner ezeket a sorokat a VALÓDI write-path-on
 * ({@link MealService#rescore}) pontozza újra, így a formula nem duplikálódik SQL-be.
 *
 * <p><b>Idempotens</b> a verzióbélyegen keresztül: a munkalista
 * {@link MealRepository#findStaleEnvelopes} „ahol a generáció &lt; {@link
 * MealScoringService#FORMULA_VERSION}", tehát a második futás szerkezetileg 0 sort érint. Ez az,
 * ami a meal-envelope „frozen at write" szándékát megőrzi: a történelem egyszeri, dátumozott,
 * verziózott helyreállítást kap, nem egy folyamatosan újraíró viselkedést.
 *
 * <p>{@code @Profile("demodata")} — a prod-ban aktív profil, tehát prodon a következő deploykor
 * lefut. Az őr arra kell, hogy a bean a TÖBBI integrációs-teszt kontextusban ne létezzen: a
 * {@code MealPopulator.createScoredMeal} kézzel gyárt bélyeg nélküli envelope-ot, egy őrizetlen
 * runner tehát idegen tesztek fixture-jeit pontozná újra. {@code @Order(210)} a
 * {@code GoalReevaluateRunner} (200) UTÁN fut, mert az újrapontozás a cél-előírásból származó
 * {@code DailyTargets}-et olvassa.
 *
 * <p>A cache-oldal nem itt van: a {@code weekly_score} sorokat egy egyszeri Liquibase changeset
 * üríti (a frissesség-próba {@code created_at}-et olvas, egy re-score viszont UPDATE), a
 * {@code day_review} pedig az {@code inputsHash}-en keresztül magától invalidálódik.
 */
@Slf4j
@Component
@Profile("demodata")
@Order(210)
@RequiredArgsConstructor
public class MealRescoreRunner implements CommandLineRunner {

    private final MealRepository mealRepository;
    private final MealService mealService;

    /** CommandLineRunner belépési pont (indulás). */
    @Override
    public void run(String... args) {
        run();
    }

    /**
     * No-arg overload — az integrációs teszt belépési pontja. Szándékosan NEM
     * {@code @Transactional}: minden étkezés a saját {@link MealService#rescore} tranzakciójában
     * gyógyul, így egy hibás sor nem visz magával egy egész backfillt, és a self-invocation
     * proxy-csapda fel sem merül.
     *
     * @return a ténylegesen újrapontozott étkezések száma
     */
    public int run() {
        List<UUID> stale = mealRepository.findStaleEnvelopes(MealScoringService.FORMULA_VERSION)
            .stream().map(MealEntity::getId).toList();
        if (stale.isEmpty()) {
            return 0;
        }
        int healed = 0;
        for (UUID id : stale) {
            if (mealService.rescore(id)) {
                healed++;
            }
        }
        log.info("Re-scored {} meal envelope(s) to formula version {} (mezo-jcpt.2); "
            + "prose sockets cleared, the coach regenerates them lazily.",
            healed, MealScoringService.FORMULA_VERSION);
        return healed;
    }
}
```

- [ ] **Step 4: Futtasd a teszteket**

```bash
./mvnw -q test -Dtest=MealRescoreRunnerIT
```

Elvárt: PASS (mind a négy teszt).

- [ ] **Step 5: Futtasd az ArchUnit kaput**

```bash
./mvnw -q test -Dtest=ArchitectureTest
```

Elvárt: PASS. Ha a `feature_slices_are_cycle_free` FreezingArchRule bukik, NE fagyaszd be az új sértést — az azt jelentené, hogy új slice-ciklust hoztál be; ellenőrizd, hogy a runner csak `meal` + `nutrition` felé importál.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(meal): one-shot backfill runner re-scores pre-jcpt.1 envelopes (mezo-jcpt.2)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: `weekly_score` cache-ürítés

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202609031400_mezo-jcpt.2_weekly_score_cache_invalidation.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (a fájl VÉGÉRE, a `202609031300_mezo-jcpt.4_create_day_review` changeSet UTÁN)

**Interfaces:**
- Consumes: semmi (független a Java-oldaltól, de a Liquibase indulás-időben, a runner ELŐTT fut — így a cache már üres, mire az újrapontozott számok megjelennek).

- [ ] **Step 1: Írd meg a changesetet**

`backend/src/main/resources/db/changelog/1.0.0/script/202609031400_mezo-jcpt.2_weekly_score_cache_invalidation.sql`:

```sql
-- mezo-jcpt.2 — CACHE INVALIDATION, NOT DATA LOSS.
--
-- weekly_score a hét logjai feletti determinisztikus számítás write-through CACHE-e (lásd
-- WeeklyScoreService): semmi nincs itt, ami ne lenne újraszármaztatható, egy sor törlése egyetlen
-- újraszámolásba kerül a hét következő olvasásakor.
--
-- Miért most: a MealRescoreRunner (mezo-jcpt.2) újrapontozza a pre-jcpt.1 meal-envelope-okat, ami
-- a történelmi napok tápanyag-dimenzióját és így a heti átlagokat is elmozdítja. A frissesség-
-- próba viszont created_at-et olvas (WeeklyScoreRepository.latestScoreInputWrittenAt, a javadoc
-- explicit is kimondja: "an EDIT of an existing row ... is not detected"), a re-score pedig UPDATE
-- — e nélkül a törlés nélkül minden cache-elt hét határozatlan ideig a backfill ELŐTTI számokat
-- szolgálná ki. Ugyanaz a helyzet, amit a mezo-jcpt.4 changesetje kezelt.
--
-- day_review NEM szerepel itt: annak kulcsa az inputsHash, ami tartalmazza a dimenzió-score-okat
-- és a tényeket (DayReviewService.inputsHash), tehát magától cache-misst okoz. Kitörölni csak
-- fölösleges LLM-hívásokba kerülne.

delete from weekly_score;
```

- [ ] **Step 2: Kösd be a master changelogba**

`1.0.0_master.yml` legvégére:

```yaml
  - changeSet:
      id: "1.0.0:202609031400_mezo-jcpt.2_weekly_score_cache_invalidation"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609031400_mezo-jcpt.2_weekly_score_cache_invalidation.sql
```

- [ ] **Step 3: Ellenőrizd, hogy a changelog lefut**

```bash
./mvnw -q test -Dtest=MealRescoreRunnerIT
```

Elvárt: PASS. Ez a leggyorsabb valódi ellenőrzés: az IT teljes Liquibase-migrációt futtat egy friss sémán, tehát egy elgépelt YAML/útvonal itt context-startup hibaként azonnal kibukik.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore(db): invalidate weekly_score after the meal envelope backfill (mezo-jcpt.2)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Dokumentáció + codemap

**Files:**
- Modify: `docs/features/fuel.md:349` (a §9 „a meal score REAL és determinisztikus" bekezdés vége)
- Modify: `docs/CODEMAP.md` (generált)

- [ ] **Step 1: Egészítsd ki a fuel.md §9-et**

A `:349`-es bekezdés MA úgy fogalmaz, mintha a renormalizálás mindig is igaz lett volna — épp ez a bug. A bekezdés VÉGÉRE fűzd hozzá:

```markdown
 **A TÁROLT pre-jcpt.1 envelope-ok viszont megsértették ezt az invariánst (mezo-jcpt.2):** a `scoreMeal` csak a `d51ec268b` commitban kapta meg a `Dim.renormalized` hívást (a `recipeTemplateBreakdown` már előtte is renormalizált), így a korábban írt meal-envelope-okban a `dimensions[].weight` a NYERS config-súly, miközben a `value` már el volt osztva a súlyösszeggel — a `ScoreLedger` kliensoldali Σ-ja ezért látványosan széttartott a fejléc-pontszámtól ugyanabban a sheetben. A javítás egy **verzióbélyeg + egyszeri backfill**: `MealBreakdownJson.formulaVersion` (a jsonb-n belül, NEM a wire-en — `BreakdownDtoMapper` kihagyja) rögzíti a scorer formula-generációját (`MealScoringService.FORMULA_VERSION`), a bélyeg nélküli sorokat pedig a `MealRescoreRunner` (`@Profile("demodata")`, `@Order(210)`) pontozza újra a valódi write-path-on (`MealService.rescore`), étkezésenként külön tranzakcióban, idempotensen. **Vállalt következmények:** a re-score a nem-fagyasztott bemeneteket (a cél-előírásból származó `DailyTargets`, a mai gym-ütemtervből származó `MealRole`, a live pantry `category`, a jcpt.1-es `macro-significance-ref-share`) a MAI állapotukban olvassa, tehát a régi számok mozognak — ez a fix célja, nem mellékhatás; és az envelope próza-fészkei kiürülnek, betartva a coach-invariánst („egy elavult verdikt nem élheti túl a számokat, amiket magyarázott"), amit a coach a következő score-sheet-nyitáskor tölt újra. **Ráadás-gyógyulás:** a `mezo-g8qm` sorokban a tárolt `Instant` helyes UTC volt, csak az írás-idejű falióra-idő csúszott el, ezért a helyes instantból levezetett helyi idő most a helyes `MealRole`-t adja — az issue jegyzete szerint ezek addig csak újralogolással gyógyultak volna. A `weekly_score` cache-t egy egyszeri changeset üríti (a frissesség-próba `created_at`-et olvas, a re-score viszont UPDATE); a `day_review` az `inputsHash`-en keresztül magától invalidálódik. **Lokális idő tárolt `Instant`-ból:** a `rescore` a ház konvencióját követi ugyanerre az oszlopra — `ZoneId.systemDefault()`, ahogy `MealCoachService` is (NEM a `MealService.recipeLogs` `ZoneOffset.UTC`-je, és NEM az `app_user.timezone`, aminek ma nulla backend-fogyasztója van); a konvenció korlátja a SZERVER zónája, nem a felhasználóé.
```

- [ ] **Step 2: Generáld újra a codemapet**

```bash
node scripts/gen-codemap.mjs
```

- [ ] **Step 3: Ellenőrizd, hogy a codemap-kapu zöld**

```bash
node scripts/gen-codemap.mjs --check
```

Elvárt: exit 0, semmi drift.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "docs(fuel): record the pre-jcpt.1 envelope debt and its backfill (mezo-jcpt.2)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Záró kapuk (a PR előtt)

```bash
./mvnw -q test -Dtest='MealScoringServiceTest,MealCoachPromptTest,RecipeBreakdownProseServiceTest,MealRescoreRunnerIT,MealApiIT,MealCoachServiceIT,ArchitectureTest'
```

```bash
node scripts/gen-codemap.mjs --check && git status --short
```

Ezután: push → self-PR (ez a CI-kapu) → 5/5 zöld → merge. **A `--no-ff` merge-öt a fő checkouton kell futtatni, amit ez a worktree-izolált session nem tud elérni** — vagy a felhasználó futtatja, vagy a PR-t GitHubon kell merge-elni.
