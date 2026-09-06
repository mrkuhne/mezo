# Nap-tudatos meal-score `context` dimenzió — megvalósítási terv

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `context` dimenzió a statikus slot-arány helyett a **maradék napi kerethez** és a **még hátralévő slotokhoz** mérje az étkezés kcal-ját és fehérjéjét, és a coach-próza ugyanazokat a napi számokat lássa, mint a pontszám.

**Architecture:** A `MealScoringService` pure marad: egy új, nutrition-tulajdonú `DayContext` carrier érkezik be új `scoreMeal` overloadon (a `DailyTargets` mintájára). A napi Σ-t a hívó (`MealService.applyScore`) oldja fel egy új `FuelDayService.dayContext(...)` metódussal. Nincs új dimenzió, nincs új súly, **nincs contract-változás**. A `DayContext.unknown()` a névleges pályát feltételezi, ami bitre a mai viselkedés — így a 40+ meglévő rövid-overload teszthívás érintetlen marad.

**Tech Stack:** Java 21 (records, switch expressions), Spring Boot, Lombok `@RequiredArgsConstructor`, JUnit 5 + AssertJ, Liquibase, Maven wrapper (`./mvnw`).

**Spec:** [`docs/superpowers/specs/2026-09-06-meal-score-day-context-design.md`](../specs/2026-09-06-meal-score-day-context-design.md)
**bd:** `mezo-jcpt.19`

## Global Constraints

- **bd id minden commit-tárgyban:** `feat(...): ... (mezo-jcpt.19)` / `fix(...)` / `docs(...)`.
- **Az `ArchUnit` tiltja:** a Spring `@Value`-t (minden knob `@ConfigurationProperties` record), az osztály-szintű `@Transactional`-t, a mező-injektálást. Minden osztály a saját stereotype-csomagjában (`..service..`, `..entity..`, `..repository..`, `..controller..`).
- **`feature/nutrition` NEM importálhat `feature/meal`-t** (ADR 0012, `feature_slices_are_cycle_free` FreezingArchRule). A `DayContext` ezért **nutrition-tulajdonú**.
- **Nincs magic number** a motorban: az új padló-faktor `MealScoringProperties` mező, `application.yml`-ből kötve.
- **Lokálisan csak fókuszált teszt fut**; a teljes backend suite a CI dolga. Ha mégis teljes suite kell: `-Dmezo.test.use-testcontainers=true`.
- **A `context` dimenzió `Szerep` sorát tilos átnevezni/törölni** — a frontend a role-t abból olvassa vissza string-egyezéssel (`frontend/src/features/fuel/logic/mealContext.ts:16`), típushiba nélkül törne.
- **A dimenzió `id`-ja marad `context`** — a `MealScoreDimension.id` regex-pinned enum a contractban; ez a change nem nyúl hozzá, tehát nem lehet contract-drift.
- Minden új publikus típus/metódus **magyar javadocot** kap, a környező fájlok stílusában.

## File Structure

| Fájl | Felelősség |
|---|---|
| `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/DayContext.java` | **ÚJ** — a nap állapota az étkezés előtt (kcal + fehérje), `unknown()` sentinellel |
| `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/config/MealScoringProperties.java` | + `minExpectedSlotShareFactor` mező |
| `backend/src/main/resources/application.yml` | + `mezo.fuel.scoring.min-expected-slot-share-factor` |
| `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringService.java` | 6-arg `scoreMeal` overload, nap-tudatos `contextDim`, `remainingSlotShare`/`windowPassed`/`expectedRef` helperek, `FORMULA_VERSION` 2→3 |
| `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/FuelDayService.java` | + `dayContext(...)` |
| `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealService.java` | `applyScore` átadja a `DayContext`-et |
| `backend/src/main/resources/db/changelog/1.0.0/script/202609062000_mezo-jcpt.19_weekly_score_cache_invalidation.sql` | **ÚJ** — cache-ürítés a re-score után |
| `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` | + a changeset bejegyzés |
| `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealCoachStore.java` | S2b — skálázott makró-összegzés |
| `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealCoachPrompt.java` | S2 — `DailyTargets` a static config helyett |
| `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealCoachService.java` | S2 — `FuelDayService.dailyTargets` hívás |
| `docs/features/fuel.md`, `docs/CODEMAP.md` | dokumentáció + elavult horgonyok |

---

## Task 1: Nap-tudatos `context` dimenzió (pure motor)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/DayContext.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/config/MealScoringProperties.java` (a `slotShareTolerance` mező UTÁN)
- Modify: `backend/src/main/resources/application.yml` (`mezo.fuel.scoring.slot-share-tolerance` UTÁN)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringServiceTest.java`

**Interfaces:**
- Consumes: `DailyTargets(int kcal, int p, int c, int f, String source)`, `MealScoringProperties.SlotShares.of(String)`, `MealScoringProperties.SlotWindows`, a meglévő privát `windowOf(SlotWindows, String)`.
- Produces:
  - `io.mrkuhne.mezo.feature.nutrition.service.DayContext` — `DayContext.unknown()`, `DayContext.of(BigDecimal kcalBefore, BigDecimal pBefore)`, `boolean known()`, `BigDecimal kcalBefore()`, `BigDecimal pBefore()`.
  - `MealScoringService.scoreMeal(String slot, List<ScoredLine> lines, LocalTime localTime, MealRole role, DailyTargets base, DayContext day)` — a 6-argumentumos belépő; a Task 2 ezt hívja.
  - `MealScoringService.FORMULA_VERSION == 3`.

- [ ] **Step 1: Írd meg a bukó teszteket**

Add hozzá a `MealScoringServiceTest`-hez. A meglévő import-blokkhoz vedd fel:
`import io.mrkuhne.mezo.feature.nutrition.service.DayContext;` (ugyanaz a csomag, tehát import nem is kell — csak használd), és `import java.time.LocalTime;` már ott van.

```java
    // ── Nap-tudatos context dimenzió (mezo-jcpt.19) ────────────────────────────────

    /** 1500 kcal-os cut-cél, a spec §4.4 példáinak alapja. */
    private static final DailyTargets CUT = new DailyTargets(1500, 150, 150, 50, "goal");

    /** Egyetlen, tény nélküli sor a megadott kcal/fehérje értékkel — csak a context dim érdekel. */
    private static List<ScoredLine> line(int kcal, int protein) {
        return List.of(new ScoredLine("Teszt", "1 adag",
            bd(kcal), bd(protein), bd(0), bd(0), (short) 1,
            null, null, null, null, null, null));
    }

    private static double contextScore(MealBreakdownJson b) {
        return dimension(b, "context").score().doubleValue();
    }

    @Test
    void emptyDay_dinnerFillingTheWholeBudget_isNoLongerPenalised() {
        // 20:00, egész nap semmi: hátralévő slotok = vacsora .30 + snack .10 = .40
        // elvárt = 1500 × .30/.40 = 1125; rel = 1500/1125 = 1.33 → a 0.4-es toleranciába fér
        MealBreakdownJson dayAware = service.scoreMeal("dinner", line(1500, 120),
            LocalTime.of(20, 0), MealRole.STANDARD, CUT, DayContext.of(bd(0), bd(0)));
        assertThat(contextScore(dayAware)).isCloseTo(1.0, within(0.01));
    }

    @Test
    void unknownDay_keepsTheNominalTrajectoryRubric() {
        // ugyanaz az étkezés napi kontextus NÉLKÜL: elvárt = 1500 × .30 = 450 → shareSub 0
        // → (timing 1 + share 0 + protein 1) / 3
        MealBreakdownJson blind = service.scoreMeal("dinner", line(1500, 120),
            LocalTime.of(20, 0), MealRole.STANDARD, CUT);
        assertThat(contextScore(blind)).isCloseTo(2.0 / 3, within(0.01));
    }

    @Test
    void wholeBudgetAtBreakfast_isStillPenalised() {
        // 08:00: minden slot hátravan → nevező 1.0 → elvárt = 1500 × .25 = 375; rel = 4
        MealBreakdownJson b = service.scoreMeal("breakfast", line(1500, 120),
            LocalTime.of(8, 0), MealRole.STANDARD, CUT, DayContext.of(bd(0), bd(0)));
        assertThat(contextScore(b)).isCloseTo(2.0 / 3, within(0.01));
    }

    @Test
    void lateOmadSnack_afterTheDinnerWindowClosed_takesTheWholeBudget() {
        // 22:30: a vacsora-ablak (…22:00) lejárt → nevező = snack .10 → elvárt = 1500
        MealBreakdownJson b = service.scoreMeal("snack", line(1500, 120),
            LocalTime.of(22, 30), MealRole.STANDARD, CUT, DayContext.of(bd(0), bd(0)));
        assertThat(contextScore(b)).isCloseTo(1.0, within(0.01));
    }

    @Test
    void skippedBreakfast_widensTheDinnerBudget() {
        // 19:00, csak egy 525 kcal-os ebéd volt: maradék 975, nevező .40 → elvárt = 731
        MealBreakdownJson b = service.scoreMeal("dinner", line(731, 60),
            LocalTime.of(19, 0), MealRole.STANDARD, CUT, DayContext.of(bd(525), bd(37)));
        assertThat(contextScore(b)).isCloseTo(1.0, within(0.01));
    }

    @Test
    void overspentBudget_fallsBackToTheSoftFloor_notZero() {
        // a keret már 100 kcal-lal túllépve → maradék 0 → padló = 1500 × .30 × .25 = 112.5
        MealBreakdownJson atFloor = service.scoreMeal("dinner", line(112, 12),
            LocalTime.of(20, 0), MealRole.STANDARD, CUT, DayContext.of(bd(1600), bd(160)));
        assertThat(contextScore(atFloor)).isCloseTo(1.0, within(0.02));

        MealBreakdownJson wayOver = service.scoreMeal("dinner", line(900, 60),
            LocalTime.of(20, 0), MealRole.STANDARD, CUT, DayContext.of(bd(1600), bd(160)));
        assertThat(contextScore(wayOver)).isLessThan(0.5);
    }

    /**
     * A TERV FŐ REGRESSZIÓS ŐRE (spec §4.3): ha a felhasználó a névleges pályán halad, az új
     * képlet értéke azonos a statikus slot-arányossal. Algebrailag:
     * maradék = cél × (1 − Σ eltelt arányok) = cél × nevező, tehát elvárt = cél × slot_arány.
     */
    @Test
    void onTheNominalTrajectory_theDayAwareFormulaEqualsTheStaticOne() {
        // 13:00 ebéd, a reggeli pont a névleges .25 volt: 1500×.25 = 375 kcal, 150×.25 = 37.5 g
        DayContext nominal = DayContext.of(bd(375), new BigDecimal("37.5"));
        MealBreakdownJson dayAware = service.scoreMeal("lunch", line(525, 52),
            LocalTime.of(13, 0), MealRole.STANDARD, CUT, nominal);
        MealBreakdownJson blind = service.scoreMeal("lunch", line(525, 52),
            LocalTime.of(13, 0), MealRole.STANDARD, CUT);
        assertThat(dayAware.value()).isEqualByComparingTo(blind.value());
        assertThat(contextScore(dayAware)).isCloseTo(contextScore(blind), within(1e-9));
    }

    @Test
    void theRoleRowSurvivesTheDayAwareRewrite() {
        // A frontend a role-t EBBŐL a sorból olvassa vissza (mealContext.ts) — nincs típusvédelem.
        MealBreakdownJson b = service.scoreMeal("lunch", line(525, 52),
            LocalTime.of(13, 0), MealRole.POST_WORKOUT, CUT, DayContext.of(bd(375), bd(38)));
        assertThat(dimension(b, "context").context())
            .anySatisfy(row -> assertThat(row.label()).isEqualTo("Szerep"));
    }
```

Ha a `dimension(...)` helper a fájlban más szignatúrájú (pl. csak `dimension(MealBreakdownJson)`), igazítsd a hívásokat a meglévőhöz — ne írj újat.

- [ ] **Step 2: Futtasd, hogy lásd a bukást**

```bash
./mvnw -q -pl backend test -Dtest=MealScoringServiceTest
```

Elvárt: fordítási hiba — `DayContext` nem létezik, és nincs 6-argumentumos `scoreMeal`.

- [ ] **Step 3: Hozd létre a `DayContext` carriert**

`backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/DayContext.java`:

```java
package io.mrkuhne.mezo.feature.nutrition.service;

import java.math.BigDecimal;

/**
 * A nap állapota EZ ELŐTT az étkezés előtt (mezo-jcpt.19) — a {@link MealScoringService} context
 * dimenziójának napi bemenete. Nutrition-tulajdonú carrier, pontosan úgy, ahogy a
 * {@link DailyTargets}: a scorer pure marad, a hívó (meal slice) oldja fel a napot.
 *
 * <p>Csak kcal + fehérje: a context dimenzió mást nem használ. Ugyanaz a fogalom, amit a
 * coach-prompt {@code MealBlock}-ja {@code kcalBefore}/{@code pBefore} néven már hordoz.
 *
 * <p><b>Az {@link #unknown()} nem „üres nap", hanem „nem tudjuk".</b> Ilyenkor a dimenzió a
 * NÉVLEGES pályát feltételezi (elvárt = napi cél × slot-arány), ami bitre a v2 viselkedés —
 * lásd a spec §4.3 azonosságát. A produkcióban egyedül a {@code MealService.applyScore} pontoz
 * étkezést, és az mindig ismert napot ad; az ismeretlen ág a rövid {@code scoreMeal}
 * overloadoké.
 */
public record DayContext(BigDecimal kcalBefore, BigDecimal pBefore) {

    private static final DayContext UNKNOWN = new DayContext(null, null);

    /** „Nem tudjuk, mit evett ma" — a névleges pálya feltételezése. */
    public static DayContext unknown() {
        return UNKNOWN;
    }

    /** A nap addigi összegei; a {@code null} itt 0-t jelent (nincs korábbi étkezés). */
    public static DayContext of(BigDecimal kcalBefore, BigDecimal pBefore) {
        return new DayContext(
            kcalBefore == null ? BigDecimal.ZERO : kcalBefore,
            pBefore == null ? BigDecimal.ZERO : pBefore);
    }

    /** Igaz, ha a nap tényleg fel van oldva — ilyenkor él a maradék-keretes ág. */
    public boolean known() {
        return kcalBefore != null && pBefore != null;
    }
}
```

- [ ] **Step 4: Vedd fel a padló-konfigot**

`MealScoringProperties.java` — közvetlenül a `slotShareTolerance` mező UTÁN (a sorrend számít: a teszt pozicionálisan építi a recordot):

```java
    /** Relative tolerance around the slot kcal-share within which the fit is perfect (0..1). */
    @DecimalMin("0.0") @DecimalMax("1.0") double slotShareTolerance,
    /** Padló az elvárt slot-keretre a {@code napi cél × slot-arány} hányadaként (mezo-jcpt.19):
     *  ha a maradék napi keret elfogyott, az elvárt kcal/fehérje nem eshet ez alá, így a
     *  túllépés arányosan büntet, nem szakadékkal. A napi score {@code nutritionDim}-je a
     *  túllépést amúgy is bünteti sávokkal — nem akarunk kétszer, szakadékkal büntetni. */
    @DecimalMin("0.0") @DecimalMax("1.0") double minExpectedSlotShareFactor,
```

`application.yml` — a `slot-share-tolerance: 0.4` sor UTÁN:

```yaml
      # Padló az elvárt slot-keretre a napi_cél × slot_arány hányadaként (mezo-jcpt.19): ha a
      # maradék keret elfogyott, az elvárt érték nem eshet ez alá — arányos, nem szakadékos
      # büntetés a napi keret túllépése után.
      min-expected-slot-share-factor: 0.25
```

`MealScoringServiceTest` — a pozicionális konstruktorban a `0.4,` sor UTÁN vedd fel:

```java
        0.4,
        0.25,  // minExpectedSlotShareFactor
        120,   // preLeadMin
```

- [ ] **Step 5: Írd meg a nap-tudatos `contextDim`-et**

`MealScoringService.java`. Először az overload-lánc — a meglévő 5-argumentumos `scoreMeal` **törzsét** told le egy új 6-argumentumosba:

```java
    /**
     * Napi kontextus nélküli belépő: a NÉVLEGES pályát feltételezi ({@link DayContext#unknown()}),
     * ami bitre a v2 rubrika. A produkciós írásút mindig a 6-argumentumos alakot hívja.
     */
    public MealBreakdownJson scoreMeal(String slot, List<ScoredLine> lines, LocalTime localTime,
                                       MealRole role, DailyTargets base) {
        return scoreMeal(slot, lines, localTime, role, base, DayContext.unknown());
    }

    /**
     * Nap-tudatos pontozás (mezo-jcpt.19): a context dimenzió az étkezés kcal-ját és fehérjéjét a
     * MARADÉK napi kerethez méri, a még hátralévő slotok között felosztva — a statikus slot-arány
     * helyett, ami nem tudta, hogy a felhasználó aznap evett-e egyáltalán. A többi hét dimenzió
     * érintetlen: az energiasűrűség és a makró-arányok nem napi mennyiségek.
     */
    public MealBreakdownJson scoreMeal(String slot, List<ScoredLine> lines, LocalTime localTime,
                                       MealRole role, DailyTargets base, DayContext day) {
        // …a MEGLÉVŐ törzs változatlanul, egyetlen sor kivételével:
        // a dims listában a contextDim hívás kapja meg a `day` argumentumot.
    }
```

A `dims` listában:

```java
            energyDensityDim(lines, kcal), contextDim(slot, lines, kcal, localTime, role, base, day));
```

A `contextDim` új törzse (a `rel`/`shareDev`/`shareSub`/`proteinSub`/`timingSub` logika és a sorok sorrendje szándékosan változatlan — csak a két referencia-érték számítása mozdul):

```java
    private Dim contextDim(String slot, List<ScoredLine> lines, double kcal, LocalTime localTime,
                           MealRole role, DailyTargets base, DayContext day) {
        double slotShare = props.slotShares().of(slot);
        double timingSub = timingSub(slot, localTime);
        double kcalRef = expectedRef(base.kcal(), day.known() ? day.kcalBefore().doubleValue() : 0,
            slot, slotShare, localTime, day.known());
        double proteinRef = expectedRef(base.p(), day.known() ? day.pBefore().doubleValue() : 0,
            slot, slotShare, localTime, day.known());

        double rel = kcal / kcalRef;
        double shareDev = Math.max(0, Math.abs(rel - 1) - props.slotShareTolerance());
        double shareSub = Math.max(0, 1 - shareDev);
        double protein = sum(lines, ScoredLine::p);
        double proteinSub = Math.min(1, protein / proteinRef);

        double score = (timingSub + shareSub + proteinSub) / 3;
        List<ContextRow> rows = new ArrayList<>();
        if (role != MealRole.STANDARD) {
            rows.add(new ContextRow("Szerep", roleLabel(role)));
        }
        rows.add(new ContextRow("Időzítés", String.format("%s · %s", localTime.format(HHMM), timingSub >= 1
            ? slotLabel(slot) + " ablakban" : "a " + slotLabel(slot) + " ablakon kívül")));
        rows.add(new ContextRow("Adag vs keret", String.format("%d kcal / ~%d kcal %s",
            Math.round(kcal), Math.round(kcalRef),
            day.known() ? "a maradék keretből" : "névleges slot-keret")));
        rows.add(new ContextRow("Fehérje", String.format("%d g / %d g slot-cél",
            Math.round(protein), Math.round(proteinRef))));
        String text = String.format("Időzítés %.0f%% · kcal-keret %.0f%% · fehérje %.0f%%.",
            timingSub * 100, shareSub * 100, proteinSub * 100);
        MealScoringProperties.SlotWindows w = props.slotWindows();
        int[] window = windowOf(w, slot);
        TimingDetail timing = new TimingDetail(
            localTime.format(HHMM),
            hourOrNull(window == null ? null : window[0]),
            hourOrNull(window == null ? null : window[1]),
            slotLabel(slot));
        return new Dim("context", "Időzítés & kontextus", props.weights().context(), score, 1.0, text,
            null, null, null, rows, timing);
    }

    /** A négy pontozott slot — a hátralévő-arány nevezőjének tartománya. */
    private static final List<String> SLOTS = List.of("breakfast", "lunch", "dinner", "snack");

    /**
     * Egy tápanyag viszonyítási kerete ehhez az étkezéshez. Ismeretlen nap esetén a NÉVLEGES pálya
     * ({@code napi cél × slot-arány} — a v2 képlet); ismert nap esetén a MARADÉK keret a még
     * hátralévő slotok között felosztva, soha nem a konfigurált padló alatt.
     */
    private double expectedRef(double dayTarget, double consumedBefore, String slot,
                               double slotShare, LocalTime t, boolean known) {
        if (!known) {
            return dayTarget * slotShare;
        }
        double remaining = Math.max(0, dayTarget - consumedBefore);
        double floor = dayTarget * slotShare * props.minExpectedSlotShareFactor();
        return Math.max(remaining * slotShare / remainingSlotShare(slot, t), floor);
    }

    /**
     * A még HÁTRALÉVŐ slotok arányösszege — ez osztja fel a maradék keretet. Az étkezés SAJÁT
     * slotja mindig hátravan (egy 22:30-kor logolt vacsora továbbra is a vacsora kerete), a
     * snacknek pedig nincs ablaka, tehát az is mindig. Így az eredmény sosem 0.
     */
    private double remainingSlotShare(String slot, LocalTime t) {
        MealScoringProperties.SlotShares shares = props.slotShares();
        double sum = 0;
        for (String candidate : SLOTS) {
            if (candidate.equals(slot) || !windowPassed(candidate, t)) {
                sum += shares.of(candidate);
            }
        }
        return sum;
    }

    /** Egy slot ablaka lejárt, ha az óra a záró órája UTÁN jár; a snacknek nincs ablaka. */
    private boolean windowPassed(String slot, LocalTime t) {
        int[] window = windowOf(props.slotWindows(), slot);
        return window != null && t.getHour() + t.getMinute() / 60.0 > window[1];
    }
```

- [ ] **Step 6: Bumpold a formula-verziót és javítsd az elavult szekció-kommenteket**

`MealScoringService.java` — a `FORMULA_VERSION` javadocjához fűzd hozzá, majd írd át az értéket:

```java
     * <p>`3` (mezo-jcpt.19): a context dimenzió nap-tudatos lett. A statikus slot-arány
     * (`napi_cél × slot_arány`) helyett a MARADÉK keret a még hátralévő slotok között felosztva —
     * a régi képlet nem tudta, evett-e a felhasználó aznap, ezért egy egész napi koplalás utáni
     * nagy étkezés kcal-komponensét nullázta. A névleges pályán a két képlet azonos, tehát a
     * történelmi „szabályos" napok pontszáma nem mozdul.
     */
    public static final int FORMULA_VERSION = 3;
```

Ugyanebben a fájlban javítsd a két elavult szekció-kommentet (a valós súlyok `.18` / `.12`):

```java
    // --- NOVA (.18): processing quality --------------------------------------------------------
```
```java
    // --- Context (.12): deterministic slot/timing fit -------------------------------------------
```

- [ ] **Step 7: Futtasd a teszteket**

```bash
./mvnw -q -pl backend test -Dtest=MealScoringServiceTest
```

Elvárt: PASS — az új esetek és **mind a ~40 meglévő** teszt (a rövid overloadok az `unknown()` ágon bitre a régi számokat adják).

- [ ] **Step 8: Ellenőrizd a startup-konfig invariánsokat**

```bash
./mvnw -q -pl backend test -Dtest='MealScoringProperties*'
```

Elvárt: PASS. (Nem adtunk új súlyt, tehát a két `@AssertTrue` összegnek változatlanul 1.0-nak kell kijönnie.)

- [ ] **Step 9: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/nutrition backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo/feature/nutrition
git commit -m "feat(nutrition): nap-tudatos context dimenzió a meal-score-ban (mezo-jcpt.19)

A statikus slot-arány helyett a maradék napi keret, a még hátralévő slotok
között felosztva. A névleges pályán algebrailag azonos a régi képlettel, így a
szabályos napok pontszáma nem mozdul. Puha padló a keret túllépése utánra.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: A napi kontextus felöltése az írásúton

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/FuelDayService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealService.java` (`applyScore`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/FuelDayServiceIT.java`

**Interfaces:**
- Consumes: `DayContext.of(BigDecimal, BigDecimal)` és a 6-arg `scoreMeal(...)` a Task 1-ből; `MealRepository.findByCreatedByAndMealDateAndDeletedFalseOrderByLoggedAtAsc(UUID, LocalDate)`; `MealMapper.contribution(MealItemEntity)` → `Macros` (`getKcal()`, `getP()`).
- Produces: `FuelDayService.dayContext(UUID userId, LocalDate date, Instant loggedAt, UUID excludeMealId)` → `DayContext`.

- [ ] **Step 1: Írd meg a bukó tesztet**

`FuelDayServiceIT.java` — a fájl meglévő fixture-építő helperjeit használd (nézd meg, hogyan hoz létre étkezést tételekkel; NE írj új populátort).

```java
    @Test
    void dayContext_sumsOnlyTheMealsLoggedBefore_andExcludesItself() {
        LocalDate date = LocalDate.of(2026, 6, 24);
        UUID breakfast = createMeal(userId, date, "breakfast",
            Instant.parse("2026-06-24T06:00:00Z"), 400, 30);
        UUID lunch = createMeal(userId, date, "lunch",
            Instant.parse("2026-06-24T11:00:00Z"), 600, 45);

        // A vacsora előtti állapot: reggeli + ebéd
        DayContext beforeDinner = fuelDayService.dayContext(userId, date,
            Instant.parse("2026-06-24T18:00:00Z"), null);
        assertThat(beforeDinner.known()).isTrue();
        assertThat(beforeDinner.kcalBefore()).isEqualByComparingTo("1000");
        assertThat(beforeDinner.pBefore()).isEqualByComparingTo("75");

        // Az ebéd SAJÁT újrapontozásakor sem a nála későbbi, sem ő maga nem számít bele
        DayContext beforeLunch = fuelDayService.dayContext(userId, date,
            Instant.parse("2026-06-24T11:00:00Z"), lunch);
        assertThat(beforeLunch.kcalBefore()).isEqualByComparingTo("400");

        // A nap első étkezése előtt üres, de ISMERT nap
        DayContext beforeBreakfast = fuelDayService.dayContext(userId, date,
            Instant.parse("2026-06-24T06:00:00Z"), breakfast);
        assertThat(beforeBreakfast.known()).isTrue();
        assertThat(beforeBreakfast.kcalBefore()).isEqualByComparingTo("0");
    }
```

Ha a `createMeal(...)` helper nem létezik ilyen szignatúrával, igazítsd a fájl meglévő fixture-mintájához — a lényeg: két étkezés ismert kcal/fehérje értékekkel, ismert `loggedAt`-tel, ahol legalább az egyik tétel `amount != snapshotPer` (hogy a skálázás is bizonyítva legyen).

- [ ] **Step 2: Futtasd, hogy lásd a bukást**

```bash
./mvnw -q -pl backend test -Dtest=FuelDayServiceIT -Dmezo.test.use-testcontainers=true
```

Elvárt: fordítási hiba — `dayContext` nem létezik a `FuelDayService`-en.

- [ ] **Step 3: Írd meg a `dayContext`-et**

`FuelDayService.java` — a `dailyTargets(...)` metódus MELLÉ (ugyanaz a szerep: a scorer bemenetét oldja fel):

```java
    /**
     * A nap állapota EGY adott étkezés ELŐTT (mezo-jcpt.19) — a meal-score context dimenziójának
     * napi bemenete, a {@link #dailyTargets} párja: a hívó old fel, a scorer pure marad.
     *
     * <p>A nap logolt étkezései közül a {@code loggedAt}-nál KORÁBBIAK Σ kcal/fehérjéje, a saját
     * sort id alapján kizárva — az {@code applyScore} update-kor és re-score-kor is fut, amikor az
     * étkezés MÁR benne van a napban, és azonos {@code loggedAt} esetén az id-kizárás az egyetlen
     * biztos szűrő.
     *
     * <p>A tétel-hozzájárulás a KANONIKUS képlettel megy ({@link MealMapper#contribution}:
     * {@code factor = amount / snapshotPer}), nem a nyers snapshot-összeggel — különben egy
     * per-100 g kamra-sorból logolt 250 g a 100 g-os értékkel számolna.
     */
    @Transactional(readOnly = true)
    public DayContext dayContext(UUID userId, LocalDate date, Instant loggedAt, UUID excludeMealId) {
        BigDecimal kcal = BigDecimal.ZERO;
        BigDecimal p = BigDecimal.ZERO;
        for (MealEntity meal : mealRepository
                .findByCreatedByAndMealDateAndDeletedFalseOrderByLoggedAtAsc(userId, date)) {
            if (meal.getId() != null && meal.getId().equals(excludeMealId)) {
                continue;
            }
            if (meal.getLoggedAt() == null || !meal.getLoggedAt().isBefore(loggedAt)) {
                continue;
            }
            for (MealItemEntity item : meal.getItems()) {
                Macros contribution = mapper.contribution(item);
                kcal = kcal.add(contribution.getKcal());
                p = p.add(contribution.getP());
            }
        }
        return DayContext.of(kcal, p);
    }
```

Vedd fel a hiányzó importokat: `java.time.Instant`, `io.mrkuhne.mezo.feature.meal.entity.MealItemEntity`, `io.mrkuhne.mezo.feature.nutrition.service.DayContext`, és a `Macros` generált típusa (nézd meg, honnan importálja a `MealMapper`).

- [ ] **Step 4: Kösd be az írásútra**

`MealService.java`, az `applyScore` metódusban — a `DailyTargets base = …` sor UTÁN:

```java
        DailyTargets base = fuelDayService.dailyTargets(userId, meal.getMealDate());
        DayContext day = fuelDayService.dayContext(userId, meal.getMealDate(),
            loggedAt.toInstant(), meal.getId());
        MealBreakdownJson breakdown =
            scoringService.scoreMeal(meal.getSlot(), lines, loggedAt.toLocalTime(), role, base, day);
```

Az `applyScore` javadocjához fűzd hozzá:

```java
     * <p>A context dimenzió a nap addigi állapotát is megkapja (mezo-jcpt.19): a napi keret
     * maradékához mér, nem a statikus slot-arányhoz. A saját sor id alapján ki van zárva, mert ez
     * a metódus update-kor és re-score-kor is fut, amikor az étkezés már a napban van.
```

Import: `io.mrkuhne.mezo.feature.nutrition.service.DayContext`.

- [ ] **Step 5: Futtasd a teszteket**

```bash
./mvnw -q -pl backend test -Dtest='FuelDayServiceIT,MealServiceIT,MealOverridesScoringIT' -Dmezo.test.use-testcontainers=true
```

Elvárt: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/meal backend/src/test/java/io/mrkuhne/mezo/feature/meal
git commit -m "feat(meal): a nap addigi állapota bekötve a meal-score írásútjára (mezo-jcpt.19)

FuelDayService.dayContext a dailyTargets párjaként oldja fel a napot; a saját
sor id alapján kizárva, mert az applyScore update-kor és re-score-kor is fut.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: Cache-ürítés a re-score után

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202609062000_mezo-jcpt.19_weekly_score_cache_invalidation.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealRescoreRunnerIT.java`

**Interfaces:**
- Consumes: `MealScoringService.FORMULA_VERSION == 3` (Task 1), `MealRepository.findStaleEnvelopes(int)`, a meglévő `MealRescoreRunner` (nem módosul — a verzióbélyegen keresztül idempotens, a munkalistát magától megtalálja).
- Produces: semmi kódszintűt.

- [ ] **Step 1: Írd meg a bukó tesztet**

`MealRescoreRunnerIT.java` — a meglévő teszt-minta szerint (nézd meg, hogyan gyárt bélyeg nélküli / elavult envelope-ot):

```java
    @Test
    void aStaleV2Envelope_isRescoredToV3() {
        UUID mealId = createMealWithEnvelopeVersion(userId, 2);

        int healed = runner.run();

        assertThat(healed).isEqualTo(1);
        assertThat(mealRepository.findById(mealId).orElseThrow().getBreakdown().formulaVersion())
            .isEqualTo(MealScoringService.FORMULA_VERSION);
        // Idempotens: a második futás szerkezetileg 0 sort érint
        assertThat(runner.run()).isZero();
    }
```

- [ ] **Step 2: Futtasd**

```bash
./mvnw -q -pl backend test -Dtest=MealRescoreRunnerIT -Dmezo.test.use-testcontainers=true
```

Elvárt: PASS már itt is, ha a runner generikus a verzióbélyegre — ez a teszt azt **bizonyítja**, hogy nem kell új runnert írni. Ha bukik, a runner nem generikus: akkor és csak akkor igazítsd.

- [ ] **Step 3: Írd meg a cache-ürítő changesetet**

`backend/src/main/resources/db/changelog/1.0.0/script/202609062000_mezo-jcpt.19_weekly_score_cache_invalidation.sql`:

```sql
-- mezo-jcpt.19 — CACHE INVALIDATION, NOT DATA LOSS.
--
-- weekly_score a hét logjai feletti determinisztikus számítás write-through CACHE-e (lásd
-- WeeklyScoreService): semmi nincs itt, ami ne lenne újraszármaztatható, egy sor törlése egyetlen
-- újraszámolásba kerül a hét következő olvasásakor.
--
-- Miért most: a FORMULA_VERSION 2 -> 3 (nap-tudatos context dimenzió) miatt a MealRescoreRunner
-- újrapontozza a történelmi meal-envelope-okat, ami a napok pontszámát és így a heti átlagokat is
-- elmozdítja. A frissesség-próba viszont created_at-et olvas
-- (WeeklyScoreRepository.latestScoreInputWrittenAt: "an EDIT of an existing row ... is not
-- detected"), a re-score pedig UPDATE — e nélkül a törlés nélkül minden cache-elt hét
-- határozatlan ideig a backfill ELŐTTI számokat szolgálná ki. Ugyanaz, amit a mezo-jcpt.2 és a
-- mezo-jcpt.4 changesetje kezelt.
--
-- day_review NEM szerepel itt: annak kulcsa az inputsHash, ami tartalmazza a dimenzió-score-okat,
-- tehát magától cache-misst okoz. Kitörölni csak fölösleges LLM-hívásokba kerülne.

delete from weekly_score;
```

`1.0.0_master.yml` — a fájl VÉGÉRE:

```yaml
  - changeSet:
      id: "1.0.0:202609062000_mezo-jcpt.19_weekly_score_cache_invalidation"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609062000_mezo-jcpt.19_weekly_score_cache_invalidation.sql
```

- [ ] **Step 4: Ellenőrizd, hogy a migráció lefut**

```bash
./mvnw -q -pl backend test -Dtest=MealRescoreRunnerIT -Dmezo.test.use-testcontainers=true
```

Elvárt: PASS (a Liquibase a teszt-konténer indulásakor lefuttatja a teljes changelogot; egy hibás YAML/SQL itt bukna el).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/resources/db/changelog backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealRescoreRunnerIT.java
git commit -m "chore(db): weekly_score cache ürítése a v3 meal-envelope re-score-hoz (mezo-jcpt.19)

A frissesség-próba created_at-et olvas, a re-score viszont UPDATE — e nélkül a
cache-elt hetek a backfill előtti számokat szolgálnák ki.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: A coach-próza ugyanazt a napot lássa (S2 + S2b)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealCoachStore.java` (`toLoaded`, `sum`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealCoachPrompt.java` (`userMessage`, `appendMeal`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealCoachService.java` (`generate`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/service/MealCoachPromptTest.java`

**Interfaces:**
- Consumes: `DailyTargets(int kcal, int p, int c, int f, String source)`, `FuelDayService.dailyTargets(UUID, LocalDate)`, `MealMapper.contribution(MealItemEntity)`.
- Produces: `MealCoachPrompt.userMessage(LocalDate date, DailyTargets targets, List<Window> workouts, List<MealBlock> meals)` — a `NutritionTargetsProperties` paraméter helyén most `DailyTargets` áll.

- [ ] **Step 1: Írd meg a bukó teszteket**

`MealCoachPromptTest.java` — cseréld a `TARGETS` konstanst, és add hozzá az új esetet:

```java
    private static final DailyTargets TARGETS = new DailyTargets(1500, 150, 150, 50, "goal");

    @Test
    void thePromptQuotesTheResolvedGoalTargets_notTheStaticConfig() {
        String prompt = MealCoachPrompt.userMessage(DATE, TARGETS, List.of(),
            List.of(block("Vacsora", 1, BigDecimal.ZERO)));
        assertThat(prompt).contains("NAPI CÉLOK: 1500 kcal");
        assertThat(prompt).doesNotContain("3100");
    }

    @Test
    void theRemainingLine_isComputedFromTheResolvedTargets() {
        String prompt = MealCoachPrompt.userMessage(DATE, TARGETS, List.of(),
            List.of(block("Vacsora", 2, new BigDecimal("400"))));
        assertThat(prompt).contains("marad: 1100 kcal");
    }
```

A fájl többi hívásában a `TARGETS` típusa átvált — a meglévő assertek közül azok, amelyek a 3100-as számokra hivatkoznak, a fenti értékekre igazítandók.

Új teszt a skálázásra — `MealCoachServiceTest` VAGY `MealCoachStore` szintjén, aszerint, hogy a fájl hogyan épít fixture-t (nézd meg, mielőtt írsz):

```java
    @Test
    void theDayStateScalesItemsByAmountOverSnapshotPer() {
        // per-100 g kamra-sor, 250 g-ot logolva: 250 kcal, nem 100
        // (a nyers snapshot-összeg a régi, HIBÁS viselkedés volt — mezo-jcpt.19 S2b)
    }
```

- [ ] **Step 2: Futtasd, hogy lásd a bukást**

```bash
./mvnw -q -pl backend test -Dtest='MealCoachPromptTest,MealCoachServiceTest'
```

Elvárt: fordítási hiba a `userMessage` típus-eltérésén, majd assert-bukás a `3100` miatt.

- [ ] **Step 3: Állítsd át a prompt cél-forrását**

`MealCoachPrompt.java` — a két metódus szignatúrája és a `NAPI CÉLOK` sor:

```java
    static String userMessage(LocalDate date, DailyTargets targets,
                              List<Window> workouts, List<MealBlock> meals) {
```
```java
    private static void appendMeal(StringBuilder sb, DailyTargets targets, MealBlock m) {
```

A törzsben a `targets.kcal()` / `.p()` / `.c()` / `.f()` hívások **változatlanok** — a `DailyTargets` ugyanezeket a getter-neveket adja. Csak az importot cseréld: `NutritionTargetsProperties` → `io.mrkuhne.mezo.feature.nutrition.service.DailyTargets`.

Az osztály-javadocba vedd fel:

```java
 * <p>A napi célok a GOAL-tudatos {@link DailyTargets}-ből jönnek (mezo-jcpt.19), nem a statikus
 * mezo.nutrition configból: cut alatt a próza korábban 3100 kcal-t idézhetett, miközben a
 * pontszám ~1500-hoz mért.
```

`MealCoachService.java` — a `generate(...)` metódusban:

```java
            String userMessage = MealCoachPrompt.userMessage(date,
                fuelDayService.dailyTargets(userId, date), windows, List.copyOf(blocks.values()));
```

Cseréld a `private final NutritionTargetsProperties targets;` mezőt `private final FuelDayService fuelDayService;`-re (ha a `targets` mezőt sehol máshol nem használja — ellenőrizd `grep -n "targets" MealCoachService.java`), és igazítsd az importokat.

- [ ] **Step 4: Javítsd a skálázatlan napi összegeket (S2b)**

`MealCoachStore.java` — a `toLoaded` a kanonikus képletet használja. Vedd fel a `MealMapper`-t a store függőségei közé (`@RequiredArgsConstructor` mező), és a statikus `sum` helyett:

```java
    private LoadedMeal toLoaded(MealEntity meal) {
        BigDecimal kcal = BigDecimal.ZERO;
        BigDecimal p = BigDecimal.ZERO;
        BigDecimal c = BigDecimal.ZERO;
        BigDecimal f = BigDecimal.ZERO;
        for (MealItemEntity item : meal.getItems()) {
            Macros x = mapper.contribution(item);
            kcal = kcal.add(x.getKcal());
            p = p.add(x.getP());
            c = c.add(x.getC());
            f = f.add(x.getF());
        }
        return new LoadedMeal(meal.getId(), meal.getTitle(), meal.getSlot(), meal.getLoggedAt(),
            meal.getBreakdown(), kcal, p, c, f);
    }
```

(A metódus így már nem `static` — a `loadDay` `.map(MealCoachStore::toLoaded)` hívása `.map(this::toLoaded)`-ra vált. A régi statikus `sum` helper törölhető, ha más nem használja.)

A javadocba:

```java
    /**
     * A nap egy étkezése, a tételek KANONIKUS képlettel összegezve
     * ({@link MealMapper#contribution}: {@code factor = amount / snapshotPer}). Korábban a nyers
     * {@code snapshotKcal} összeg ment, ami minden {@code amount != snapshotPer} tételnél tévedett
     * — egy per-100 g soron logolt 250 g a 100 g-os értéket adta (mezo-jcpt.19 S2b).
     */
```

- [ ] **Step 5: Futtasd a teszteket**

```bash
./mvnw -q -pl backend test -Dtest='MealCoachPromptTest,MealCoachServiceTest'
```

Elvárt: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/meal/service backend/src/test/java/io/mrkuhne/mezo/feature/meal/service
git commit -m "fix(meal): a coach-próza a goal-célokat és a valós napi összegeket lássa (mezo-jcpt.19)

A prompt eddig a statikus mezo.nutrition configot idézte (cut alatt 3100 kcal,
miközben a szám ~1500-hoz mért), a napi Σ-t pedig skálázatlan snapshot-összegből
képezte (egy per-100 g soron logolt 250 g a 100 g-os értékkel számolt).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: Dokumentáció + gate-ek

**Files:**
- Modify: `docs/features/fuel.md`
- Modify: `docs/CODEMAP.md` (generált)
- Modify: `.beads/issues.jsonl` (generált)

**Interfaces:**
- Consumes: minden korábbi task eredménye.
- Produces: semmi kódszintűt.

- [ ] **Step 1: Frissítsd a `fuel.md`-t**

Három dolog, egy menetben:

1. **A context dimenzió leírása** (§3 architektúra és/vagy a dimenzió-tábla): a statikus slot-arány helyett a maradék keret + hátralévő slotok; említsd a névleges-pálya azonosságot és a puha padlót.
2. **A §5 elavult sor-horgonyai**: `applyScore` (a `MealService.java:171-185` helyett a valós sorszám), `classifyRole`, a role-overlay és a `contextDim` `Szerep` sora. Nyisd meg a fájlokat és írd be a TÉNYLEGES sorszámokat — ne másold a jelen tervből, mert a Task 1-4 elmozdította őket.
3. **A §5 "soha nem eltérő számok" állítása**: ma a próza-felületre nem volt igaz; a Task 4 után igaz. Pontosítsd a mondatot úgy, hogy a coach-prompt is nevesítve legyen.

- [ ] **Step 2: Regeneráld a CODEMAP-et**

```bash
node scripts/gen-codemap.mjs
```

(A `DayContext` új osztály; a `--check` változat CI-gate a `cheap-gates.sh`-ban, tehát e nélkül a build bukna.)

- [ ] **Step 3: Ellenőrizd, hogy nincs contract-drift**

```bash
node scripts/gen-codemap.mjs --check
```

Elvárt: exit 0, semmi kimenet.

- [ ] **Step 4: Frissítsd a beads exportot**

```bash
node scripts/check-beads-backup.mjs --fix
```

- [ ] **Step 5: Commit**

```bash
git add docs .beads
git commit -m "docs(fuel): nap-tudatos context dimenzió + elavult sor-horgonyok javítása (mezo-jcpt.19)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: Zárás — PR és CI-kapu

- [ ] **Step 1: Futtasd a fókuszált backend gate-et**

```bash
./mvnw -q -pl backend test -Dtest='MealScoringServiceTest,MealCoachPromptTest,MealCoachServiceTest,DayTargetProjectorTest,ArchitectureTest'
```

Elvárt: PASS. Az `ArchitectureTest` itt fut le — a fókuszált IT-k NEM futtatják, és a `DayContext` elhelyezése (`..service..` csomag) meg a `nutrition → meal` importtilalom pont itt bukna el.

- [ ] **Step 2: Push és self-PR**

```bash
git push -u origin claude/ai-score-context-issue-6d53aa
```

Nyiss self-PR-t; a leírás hivatkozzon a specre és a `mezo-jcpt.19`-re, és sorolja fel a viselkedésváltozást (spec §4.4 tábla) + a `FORMULA_VERSION` bumpot.

- [ ] **Step 3: Várd meg a CI zöldet, majd a merge ELŐTT ellenőrizd a jelenlegi main ellen**

```bash
gh workflow run premerge.yml -f pr=<number>
```

- [ ] **Step 4: Merge lokálisan `--no-ff`, majd push**

```bash
git checkout main && git pull --rebase && git merge --no-ff claude/ai-score-context-issue-6d53aa && git push
```

> **Figyelem:** a merge-öt a főkönyvtárban kell elvégezni, nem ebben a worktree-ben. A worktree a feature-ágon áll.

- [ ] **Step 5: Zárd a bd issue-t**

```bash
bd close mezo-jcpt.19
```

---

## Self-Review

**Spec-lefedettség**

| Spec szakasz | Task |
|---|---|
| §4.1 képlet | Task 1 / Step 5 |
| §4.2 puha padló | Task 1 / Step 4 (config) + Step 5 (`expectedRef`) |
| §4.3 nulla-regresszió invariáns | Task 1 / Step 1 (`onTheNominalTrajectory…` property-teszt) |
| §4.4 viselkedési tábla | Task 1 / Step 1 (soronként egy teszt) |
| §4.5 `DayContext` + `unknown()` | Task 1 / Step 3 |
| §4.5 `FuelDayService.dayContext` + `applyScore` | Task 2 |
| §4.5 provenance / `Adag vs keret` sor | Task 1 / Step 5 |
| §4.5 `Szerep` sor sértetlensége | Task 1 / Step 1 (`theRoleRowSurvives…`) |
| §4.5 `FORMULA_VERSION` + rescore + cache-purge | Task 1 / Step 6 + Task 3 |
| §5 coach cél-forrás | Task 4 |
| §5 S2b skálázatlan összegek | Task 4 / Step 4 |
| §6 elavulás-javítás | Task 1 / Step 6 (kommentek) + Task 5 / Step 1 (fuel.md) |
| §7 tesztelés | Task 1, 2, 3, 4 tesztlépései + Task 6 / Step 1 |

Nincs fedetlen spec-követelmény.

**Placeholder-ellenőrzés**: nincs "TBD"/"TODO"/"hasonlóan a Task N-hez". Két helyen szándékosan a fájl meglévő fixture-mintájához igazítást kérek (Task 2 / Step 1, Task 4 / Step 1) — ezek konkrét, ellenőrizhető utasítások, nem kitöltetlen helyek, mert a fixture-helperek szignatúráját a végrehajtónak a helyszínen kell leolvasnia.

**Típus-konzisztencia**: `DayContext.of(BigDecimal, BigDecimal)` / `unknown()` / `known()` / `kcalBefore()` / `pBefore()` végig azonos; `scoreMeal(…, DailyTargets, DayContext)` a Task 1-ben definiálva és a Task 2-ben pontosan így hívva; `FuelDayService.dayContext(UUID, LocalDate, Instant, UUID)` a Task 2-ben definiálva és ugyanott hívva; `MealCoachPrompt.userMessage(LocalDate, DailyTargets, List<Window>, List<MealBlock>)` a Task 4-ben egységesen.
