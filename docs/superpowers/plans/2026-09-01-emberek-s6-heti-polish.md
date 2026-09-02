# Emberek S6 — heti/detail polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Az Emberek szekció számai valós adatból jönnek — a hangulat-ív a tényleges említés-tónusokból aggregálva, az irányok és az indoklásuk kiszámítva, a Mezo-észrevétel sáv pedig egy igazi companion-üzenet, determinisztikus tartalékkal.

**Architecture:** Három, egymástól független réteg. (1) A `PersonAffectTrendCalculator` (tiszta, `feature/people/service`) heti kosarakba gyűjti a személy tónusozott említéseit, és 1–5 skálájú heti olvasatokat ad; ebből származik a `direction` és a magyar `directionReason` is — mind a három a `PersonResponse`-ba kerül, a `mentionCount`/`mentionsThisWeek` már bevált „a service számolja, sosem perzisztáljuk" idióma szerint. Az FE ezután nem számol irányt, csak megjelenít. (2) Új `people` companion message kind: az éjszakai/hajnali `CompanionMessageJob` generálja a hét valós aggregátumaiból, ugyanazzal a marker + `ParsedMessage` recepttel, mint a többi fajta — és mivel a `ProactiveFeedService` fajtafüggetlenül olvas, a Napi Mezo szálban is megjelenik, ami szándékos. (3) A sávot a `people` bootstrap hozza egy `mezoNote` mezőben, fogyasztó-tulajdonú porton át (`PeopleMezoNoteSource` a people oldalon, adapter a proactive oldalon) — mert a `people → proactive` import kört zárna a Task 2-ben született `proactive → people` éllel.

**Tech Stack:** Spring Boot 4 / Hibernate 7 / Liquibase, contract-first OpenAPI, MapStruct, ArchUnit; React 19 + TanStack Query dual-mode, Vitest + MSW.

## Global Constraints

Ezek MINDEN taskra érvényesek, külön említés nélkül is.

- **Munkakönyvtár:** `.claude/worktrees/emberek-section-development-d4aa89`. SOSEM `cd` a primary repóba (`/Users/mrkuhne/Applications/Personal/Mezo/mezo`) — az a mainen ül.
- **Backend teszt MINDIG** `-Dmezo.test.use-testcontainers=true`. Soha ne fusson két `mvnw` build egyszerre (megosztott `target/`, részleges annotation processing → hamis `NoSuchMethodError`).
- **FE teszt a worktree-ben EXPLICIT mindkét módban:** `VITE_USE_MOCK=false pnpm test` ÉS `VITE_USE_MOCK=true pnpm test`. A `pnpm build` (`tsc -b && vite build`) a „kész" definíciójának része — a vitest lazább típusellenőrzése az előző szeletben átengedett egy valódi típushibát.
- **Kontraktus-first:** előbb `api/feature/**.yml`, majd `cd api/generate && npm run generate:api` (ez írja `api/openapi.yml`-t), ÉS a frontend saját `generate:api` scriptje (ez írja `frontend/src/data/_client/api.gen.ts`-t) — mindkét generált fájl commitolandó. Utána `cd backend && ./mvnw clean test-compile`.
- **Hibadoktrína (IDENT-3):** LLM- vagy háttér-hiba SOSEM buktat egy felhasználói olvasást/írást — warn + degradálás. Nyers `RuntimeException`/`IllegalStateException`/`IllegalArgumentException` a `techcore`-on kívül TILOS (`SystemRuntimeErrorException` + `SystemMessage`).
- **Rétegszabályok (ArchUnit):** `@Service` csak `..service..`-ben, entity `..entity..`, repository `..repository..`. Élek: `companion → people` LÉTEZIK, `people → companion` TILOS. Ez a szelet új `proactive → people` élt nyit (ellenőrizve: a `people` kifelé csak `auth`/`journal`/`ritual` felé mutat, azok közül semmi nem mutat a `proactive`-ra, tehát nem zár kört) — és ezért a `people → proactive` irány szintén TILOS, portot kell használni.
- **Tiszta függvények:** minden derivációban a `now` PARAMÉTER, sosem `LocalDate.now()` a számoló osztály belsejében — így unit-tesztelhető, és nem lesz belőle naptárforduló-bomba (a repóban két ilyen már robbant). Tesztben vagy MINDEN dátum pinned, vagy MINDEN dinamikus — a kevert időzített bomba.
- **Becsületes állapotok:** kitalált szám sosem; ahol nincs adat, ott üres/`null` megy a wire-ra és az UI mondja ki magyarul, hogy nincs elég adat.
- **Magyar UI-szöveg**, ékezetekkel. Ikonok kizárólag a clay sprite-készletből, emoji sehol.
- Hardcodolt hex TILOS a `frontend/src/styles/prototype.css`-ben (a `mozaikCssTokens` guard a KOMMENTEKET is szkenneli); meglévő `--mz-*` tokent használj, vagy vegyél fel újat MINDKÉT `:root`-ba. Az exemption-listát sosem bővítjük.
- **bd:** a driving issue `mezo-06o0.8`; a commit-subjectek hordozzák: `feat(be): ... (mezo-06o0.8)`.
- **Docs-kapu:** `node scripts/lint-docs.mjs --errors-only` (a bare forma a pre-existing stale baseline miatt bukik — sosem „javítunk" idegen dokumentumot emiatt).

## Ami MÁR KÉSZ, és ebben a szeletben nem munka

A spec §8 S6 négy dolgot sorol; az egyik az S3-ban elkészült, és **nem szabad újraírni**:

- **„Csendben maradt"** — a `PeopleHetiPage` már rendereli (`quietPeople(people)` a `mentionsThisWeek === 0` személyekre, szaggatott kártyák, „Írok neki" CTA a `PersonLogSheet`-tel). A `mentionsThisWeek` szerver-oldalon számolt valós érték, tehát ez éles adaton is működik. Ellenőrizd, ne írd újra.
- Ugyanígy kész és érintetlen: „A hét tónusa" rakott sáv + jelmagyarázat, „A hét pillanata" idézet, a heti ritmus napi oszlopai.

## Mi a valódi hiány

- **`person.affect_trend`** egy perzisztált `integer[]` oszlop, amit SEMMI nem tölt (az S1 „AI-kurált, a CRUD nem nyúl hozzá"-ként vezette be). Éles adaton tehát minden személy íve üres → a részletek-oldal „— nincs elég adat"-ot ír, a `PeopleKorPage` sparkja üres, és `directionFor([])` mindig `'flat'` → a hub „hangulat-lejtő" cellája és a Heti kép „Irányok" mozaikja halott.
- **A `whyLine`** a `PeopleHetiPage`-ben az S3 saját, ideiglenes helyettesítője (a fájl kommentje szerint „S4 replaces this with real LLM prose" — az S4 nem tette meg), és csak a feedbe betöltött legfeljebb 50 említést látja.
- **A Mezo-sáv** mondata a `PeoplePage` lokális `mezoSentence()` sablonja két névből.

---

## File Structure

**Backend — új:**
- `feature/people/service/PersonAffectTrendCalculator.java` — tiszta aggregáció: heti olvasatok + irány + magyar indoklás. Nincs repository-függése, csak listákat kap.
- `feature/people/service/PersonAffectTrend.java` — a számítás eredménye egy rekordban (`readings`, `startWeek`, `direction`, `reason`).
- `feature/people/PeopleMezoNoteSource.java` — fogyasztó-tulajdonú port a feature GYÖKERÉBEN (a `PersonGraphEdgeSource` és a `feature/companion/NarrativeNoteSource` precedense: interfész, nem `@Service`, ezért nem esik a rétegszabály alá).
- `feature/proactive/service/PeopleMezoNoteAdapter.java` — a port proactive-oldali megvalósítása (`@Service`, ezért `..service..`-ben).
- `backend/src/main/resources/db/changelog/1.0.0/script/202609021000_mezo-06o0.8_companion_message_people_kind.sql`
- Tesztek: `PersonAffectTrendCalculatorTest` (tiszta unit, nincs Spring), `PeopleMezoNoteIT`, a `CompanionMessageGeneratorIT` bővítése.

**Backend — módosítás:**
- `feature/people/service/PeopleService.java` — a kalkulátor bekötése a bootstrapbe + `mezoNote` a portból, determinisztikus tartalékkal.
- `feature/people/mapper/PeopleMapper.java` — az új mezők a service-től jönnek.
- `feature/proactive/entity/CompanionMessageEntity.java` — `KIND_PEOPLE`.
- `feature/proactive/service/CompanionMessageGenerator.java` — `PEOPLE_MARKER`, `PEOPLE_PROMPT`, `generatePeopleObservation`.
- `feature/proactive/service/CompanionMessageJob.java` — a hajnali futás harmadik lépése.
- `feature/companion/llm/FakeCompanionLlm.java` — `PEOPLE_OBS_SENTINEL`.
- `api/feature/people/people.yml`, `api/feature/today/*.yml` (a feed kind enumja), `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`.

**Frontend — módosítás:**
- `frontend/src/data/types.ts` — `PersonEntry.affectTrendStart/direction/directionReason`, `PeopleBootstrap.mezoNote`, `FeedMessageKind` += `'people'`.
- `frontend/src/data/me/people.ts` (mock seed), `peopleApi.ts`, `peopleHooks.ts`.
- `frontend/src/features/me/logic/peopleDerive.ts` — a `directionFor` kivezetése, `hubLines` a szerver irányára áll.
- `frontend/src/features/me/pages/PeopleHetiPage.tsx` (DirCard + `whyLine` kivezetése), `PeoplePage.tsx` (a sáv a `mezoNote`-ból), `PersonDetailPage.tsx` (tengelycímkék a valós ablakból).
- Tesztek: `peopleDerive.test.ts`, `PeopleHetiPage.test.tsx`, `PeoplePage.test.tsx`, `PersonDetailPage.test.tsx`, `peopleHooks.test.tsx`, `frontend/src/test/msw/handlers.ts`.

**Docs:** `docs/features/me.md`, `docs/features/proactive.md`, `docs/features/companion.md` (ha érintett), `docs/CODEMAP.md`.

---

### Task 1: Hangulat-ív, irány és indoklás valós említésekből

A szelet magja. Egy tiszta kalkulátor + a bootstrap bekötése + három új kontraktus-mező.
Az FE ebben a taskban még nem változik (a régi mezőket használja tovább) — a `PersonResponse`
bővül, de semmi nem törik.

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/people/service/PersonAffectTrend.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/people/service/PersonAffectTrendCalculator.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/people/PersonAffectTrendCalculatorTest.java`
- Modify: `api/feature/people/people.yml`, `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/people/service/PeopleService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/people/mapper/PeopleMapper.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/people/PeopleContractIT.java` (bővítés)

**Interfaces:**
- Consumes: `MentionEntity.getTs()` (`Instant`), `getTone()` (`String`, NULLABLE amíg az éjszakai kör nem tölti), `getIntensity()` (`Short`, NULLABLE, 1..3).
- Produces:
  - `record PersonAffectTrend(List<Integer> readings, LocalDate startWeek, String direction, String reason)` + `PersonAffectTrend.EMPTY`
  - `PersonAffectTrendCalculator.calculate(List<MentionEntity> personMentions, LocalDate today) -> PersonAffectTrend`
  - `PersonResponse.affectTrendStart` (date, nullable), `.direction` (string: `up|down|flat`), `.directionReason` (string, nullable)

- [ ] **Step 1: Írd meg az eredmény-rekordot**

`PersonAffectTrend.java`:

```java
package io.mrkuhne.mezo.feature.people.service;

import java.time.LocalDate;
import java.util.List;

/**
 * Egy személy hangulat-íve és az abból olvasott irány (Emberek S6, mezo-06o0.8).
 *
 * @param readings heti olvasatok 1..5 skálán, IDŐRENDBEN (a legrégebbi elöl); csak azok a
 *                 hetek szerepelnek, ahol volt legalább egy tónusozott említés
 * @param startWeek a legelső olvasat hetének hétfője — ebből tudja a felület, milyen
 *                 időablakot címkézzen; {@code null}, ha nincs olvasat
 * @param direction {@code up} | {@code down} | {@code flat}
 * @param reason   magyar, determinisztikus indoklás az irány alatt; {@code null}, ha nincs
 *                 mit indokolni (nincs olvasat)
 */
public record PersonAffectTrend(List<Integer> readings, LocalDate startWeek, String direction,
    String reason) {

    public static final String DIRECTION_UP = "up";
    public static final String DIRECTION_DOWN = "down";
    public static final String DIRECTION_FLAT = "flat";

    /** Nincs egyetlen tónusozott említés sem — az ív üres, az irány lapos, nincs indoklás. */
    public static final PersonAffectTrend EMPTY =
        new PersonAffectTrend(List.of(), null, DIRECTION_FLAT, null);
}
```

- [ ] **Step 2: Írd meg a bukó unit-tesztet**

`backend/src/test/java/io/mrkuhne/mezo/feature/people/PersonAffectTrendCalculatorTest.java` —
TISZTA unit-teszt, Spring-kontextus nélkül (`PersonAffectTrendCalculator` állapotmentes, a
konstruktora üres). Minden dátum pinned.

```java
package io.mrkuhne.mezo.feature.people;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.people.entity.MentionEntity;
import io.mrkuhne.mezo.feature.people.service.PersonAffectTrend;
import io.mrkuhne.mezo.feature.people.service.PersonAffectTrendCalculator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;

class PersonAffectTrendCalculatorTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 9, 2);   // szerda
    private final PersonAffectTrendCalculator calculator = new PersonAffectTrendCalculator();

    private static MentionEntity mention(LocalDate day, String tone, Integer intensity) {
        MentionEntity m = new MentionEntity();
        m.setTs(day.atStartOfDay().toInstant(ZoneOffset.UTC));
        m.setTone(tone);
        m.setIntensity(intensity == null ? null : intensity.shortValue());
        return m;
    }

    @Test
    void calculate_shouldReturnEmpty_whenNoTonedMention() {
        assertThat(calculator.calculate(List.of(mention(TODAY, null, null)), TODAY))
            .isEqualTo(PersonAffectTrend.EMPTY);
    }

    @Test
    void calculate_shouldScorePositiveHigh_andNegativeLow() {
        PersonAffectTrend up = calculator.calculate(List.of(mention(TODAY, "positive", 3)), TODAY);
        PersonAffectTrend down = calculator.calculate(List.of(mention(TODAY, "negative", 3)), TODAY);
        assertThat(up.readings()).containsExactly(5);
        assertThat(down.readings()).containsExactly(1);
    }

    @Test
    void calculate_shouldDefaultIntensity_whenNull() {
        // hiányzó intenzitás = 2 (a skála közepe), tehát pozitív -> 3 + 2*(2/3) ≈ 4
        assertThat(calculator.calculate(List.of(mention(TODAY, "positive", null)), TODAY).readings())
            .containsExactly(4);
    }

    @Test
    void calculate_shouldBucketByWeek_oldestFirst_andSkipEmptyWeeks() {
        List<MentionEntity> mentions = List.of(
            mention(TODAY.minusWeeks(3), "negative", 2),
            mention(TODAY, "positive", 2));           // a köztes két hét üres
        PersonAffectTrend trend = calculator.calculate(mentions, TODAY);
        assertThat(trend.readings()).hasSize(2);      // az üres hetek NEM kapnak kitalált pontot
        assertThat(trend.readings().getFirst()).isLessThan(trend.readings().getLast());
        assertThat(trend.startWeek()).isEqualTo(LocalDate.of(2026, 8, 10));   // 3 héttel korábbi hétfő
    }

    @Test
    void calculate_shouldCapAtEightReadings_keepingTheNewest() {
        List<MentionEntity> mentions = new java.util.ArrayList<>();
        for (int w = 11; w >= 0; w--) {
            mentions.add(mention(TODAY.minusWeeks(w), "neutral", 2));
        }
        PersonAffectTrend trend = calculator.calculate(mentions, TODAY);
        assertThat(trend.readings()).hasSize(8);
        assertThat(trend.startWeek()).isEqualTo(LocalDate.of(2026, 7, 20));   // 7 héttel korábbi hétfő
    }

    @Test
    void calculate_shouldReportDown_withHungarianReason() {
        List<MentionEntity> mentions = List.of(
            mention(TODAY.minusWeeks(3), "positive", 3),
            mention(TODAY.minusWeeks(2), "positive", 3),
            mention(TODAY.minusWeeks(1), "negative", 3),
            mention(TODAY, "negative", 3));
        PersonAffectTrend trend = calculator.calculate(mentions, TODAY);
        assertThat(trend.direction()).isEqualTo(PersonAffectTrend.DIRECTION_DOWN);
        assertThat(trend.reason()).isEqualTo("többször nehéz tónus, mint korábban");
    }

    @Test
    void calculate_shouldReportFlat_whenTooFewReadings() {
        List<MentionEntity> mentions = List.of(
            mention(TODAY.minusWeeks(1), "positive", 3),
            mention(TODAY, "negative", 3));
        assertThat(calculator.calculate(mentions, TODAY).direction())
            .isEqualTo(PersonAffectTrend.DIRECTION_FLAT);
    }
}
```

- [ ] **Step 3: Futtasd, hogy bukjon**

Run: `cd backend && ./mvnw test -Dtest=PersonAffectTrendCalculatorTest -Dmezo.test.use-testcontainers=true`
Expected: fordítási hiba — a `PersonAffectTrendCalculator` nem létezik.

- [ ] **Step 4: Írd meg a kalkulátort**

`PersonAffectTrendCalculator.java`:

```java
package io.mrkuhne.mezo.feature.people.service;

import io.mrkuhne.mezo.feature.people.entity.MentionEntity;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * Emberek S6 (mezo-06o0.8): a hangulat-ív, az irány és a magyar indoklás egyetlen forrása.
 *
 * <p>Az S1 óta létező {@code person.affect_trend} oszlopot SEMMI nem töltötte — „AI-kurált"-ként
 * vezettük be, de kurátor sosem lett. Éles adaton tehát minden ív üres volt, és vele együtt
 * halott a hub hangulat-lejtő cellája és a Heti kép irány-mozaikja. Az S4 óta viszont az éjszakai
 * kör tónust ÉS intenzitást ír a mentionökre, tehát az ív végre becsületesen SZÁMÍTHATÓ. Ez az
 * osztály ezt teszi, a {@code mentionCount}/{@code mentionsThisWeek} bevált idiómája szerint:
 * mention-származtatott statisztika, a service számolja, sosem perzisztáljuk.
 *
 * <p>Tiszta és állapotmentes — {@code today} paraméter, sosem {@code LocalDate.now()} —, hogy
 * unit-tesztelhető legyen és ne váljon naptárforduló-bombává.
 *
 * <p><b>Az üres hét nem kap kitalált pontot.</b> Csak azok a hetek adnak olvasatot, ahol volt
 * legalább egy tónusozott említés; az ív tehát lehet „hézagos" a naptárhoz képest. Ezért utazik
 * vele a {@link PersonAffectTrend#startWeek()} — enélkül a felület nem tudná, milyen időablakot
 * címkézzen (egy „az olvasatok száma × 1 hét" becslés hézagos ívnél hazudna).
 */
@Service
public class PersonAffectTrendCalculator {

    /** A prototípus nyolc oszlopos sparkja — ennyi legutóbbi heti olvasatot mutatunk. */
    static final int MAX_READINGS = 8;
    /** Ennyi olvasat alatt nincs értelmes irány (két pontból még zaj). */
    static final int MIN_READINGS_FOR_DIRECTION = 3;
    /** Hiányzó intenzitás = a skála közepe (az S4 előtti sorok és a chip-es logolás). */
    private static final int DEFAULT_INTENSITY = 2;
    /** Ekkora eltérés alatt az irány lapos — ugyanaz a küszöb, amit az FE `directionFor` használt. */
    private static final double FLAT_BAND = 0.4;

    /** Tónus → előjel a 3-as középvonalhoz képest. A `mixed` fél lépéssel lefelé: vegyes hét
     *  rosszabb, mint egy semleges, de nem annyi, mint egy tisztán nehéz. */
    private static double toneSign(String tone) {
        return switch (tone == null ? "" : tone) {
            case "positive" -> 1.0;
            case "negative" -> -1.0;
            case "mixed" -> -0.5;
            default -> 0.0;      // neutral és minden ismeretlen: a középvonal
        };
    }

    /**
     * @param personMentions EGY személy említései, tetszőleges sorrendben (a hívó szűr személyre)
     * @param today          a mai nap; a heti kosarak ennek a hetének hétfőjéig futnak
     */
    public PersonAffectTrend calculate(List<MentionEntity> personMentions, LocalDate today) {
        LocalDate thisMonday = monday(today);
        // Hétfő -> (pontösszeg, darab). LinkedHashMap + rendezett beszúrás helyett rendezzük a
        // kulcsokat a végén: a bemenet sorrendje nem garantált.
        Map<LocalDate, double[]> byWeek = new LinkedHashMap<>();
        for (MentionEntity m : personMentions) {
            if (m.getTone() == null || m.getTs() == null) {
                continue;   // az éjszakai kör még nem töltötte — nem olvasat, nem is nulla
            }
            LocalDate week = monday(LocalDate.ofInstant(m.getTs(), ZoneOffset.UTC));
            if (week.isAfter(thisMonday)) {
                continue;   // jövőbeli időbélyeg (mis-seed) sosem tol ki az ablakból
            }
            int intensity = m.getIntensity() == null ? DEFAULT_INTENSITY : m.getIntensity();
            double score = 3.0 + toneSign(m.getTone()) * intensity * (2.0 / 3.0);
            double[] acc = byWeek.computeIfAbsent(week, k -> new double[2]);
            acc[0] += score;
            acc[1] += 1;
        }
        if (byWeek.isEmpty()) {
            return PersonAffectTrend.EMPTY;
        }
        List<LocalDate> weeks = new ArrayList<>(byWeek.keySet());
        weeks.sort(LocalDate::compareTo);
        if (weeks.size() > MAX_READINGS) {
            weeks = weeks.subList(weeks.size() - MAX_READINGS, weeks.size());   // a legfrissebbek
        }
        List<Integer> readings = new ArrayList<>(weeks.size());
        for (LocalDate week : weeks) {
            double[] acc = byWeek.get(week);
            long rounded = Math.round(acc[0] / acc[1]);
            readings.add((int) Math.max(1, Math.min(5, rounded)));
        }
        String direction = directionOf(readings);
        return new PersonAffectTrend(List.copyOf(readings), weeks.getFirst(), direction,
            reasonFor(direction, readings));
    }

    private static LocalDate monday(LocalDate day) {
        return day.with(DayOfWeek.MONDAY);
    }

    /** Az utolsó két olvasat átlaga a korábbiakéhoz képest — az FE `directionFor` szabálya,
     *  szerver-oldalra hozva, hogy egyetlen forrás legyen belőle. */
    private static String directionOf(List<Integer> readings) {
        if (readings.size() < MIN_READINGS_FOR_DIRECTION) {
            return PersonAffectTrend.DIRECTION_FLAT;
        }
        List<Integer> last2 = readings.subList(readings.size() - 2, readings.size());
        List<Integer> earlier = readings.subList(0, readings.size() - 2);
        double diff = average(last2) - average(earlier);
        if (Math.abs(diff) < FLAT_BAND) {
            return PersonAffectTrend.DIRECTION_FLAT;
        }
        return diff > 0 ? PersonAffectTrend.DIRECTION_UP : PersonAffectTrend.DIRECTION_DOWN;
    }

    private static double average(List<Integer> values) {
        return values.stream().mapToInt(Integer::intValue).average().orElse(0);
    }

    /** Determinisztikus magyar indoklás — az irány MIÉRTJE, kitalálás nélkül. */
    private static String reasonFor(String direction, List<Integer> readings) {
        return switch (direction) {
            case PersonAffectTrend.DIRECTION_UP -> "jobb hetek, mint korábban";
            case PersonAffectTrend.DIRECTION_DOWN -> "többször nehéz tónus, mint korábban";
            default -> readings.size() < MIN_READINGS_FOR_DIRECTION
                ? "még kevés hét az irányhoz"
                : "kiegyensúlyozott hetek";
        };
    }
}
```

- [ ] **Step 5: Futtasd, hogy záruljon**

Run: `cd backend && ./mvnw test -Dtest=PersonAffectTrendCalculatorTest -Dmezo.test.use-testcontainers=true`
Expected: mind a 7 teszt zöld. Ha egy elvárt szám nem jön ki, a TESZTET igazítsd a valós
képlethez CSAK akkor, ha a képlet a fenti javadoc szándékát tükrözi — a képletet ne
csavard el a teszt kedvéért.

- [ ] **Step 6: Bővítsd a kontraktust**

`api/feature/people/people.yml` — a `PersonResponse.properties`-be, az `affectTrend` MELLÉ:

```yaml
        affectTrendStart:
          type: string
          format: date
          nullable: true
          description: >-
            A hangulat-ív első olvasatának hete (hétfő). Az ív csak azokat a heteket
            tartalmazza, ahol volt tónusozott említés, ezért az időablakot ebből kell
            címkézni, nem az olvasatok számából. null, ha nincs olvasat.
        direction:
          type: string
          enum: [up, down, flat]
          description: A hangulat-ív iránya az utolsó két olvasat és a korábbiak átlaga alapján.
        directionReason:
          type: string
          nullable: true
          description: Magyar, determinisztikus indoklás az irány alatt. null, ha nincs olvasat.
```

és a `required` listába: `- direction` (az `affectTrendStart` és a `directionReason` nullable,
azok maradnak opcionálisak).

Az `affectTrend` leírását is frissítsd:

```yaml
        affectTrend:
          type: array
          description: >-
            Heti hangulat-olvasatok 1..5 skálán, időrendben (legfeljebb 8, a legfrissebbek).
            Az említések tónusából és intenzitásából SZÁMÍTOTT érték — a person.affect_trend
            oszlopot ez a válasz nem olvassa.
          items:
            type: integer
```

- [ ] **Step 7: Generálj**

Run: `cd api/generate && npm run generate:api`
Run: a frontend saját generátora, hogy az `api.gen.ts` is friss legyen (nézd meg a
`frontend/package.json` scriptjeit, és futtasd a `generate:api`-t).
Expected: mindkét generált fájl frissül.

- [ ] **Step 8: Kösd be a bootstrapbe**

`PeopleMapper.java` — a `toPersonResponse` fölé (a service tölti őket):

```java
    @Mapping(target = "affectTrendStart", ignore = true)
    @Mapping(target = "direction", ignore = true)
    @Mapping(target = "directionReason", ignore = true)
```

Az `affectTrend`-et a mapper eddig az entitásból másolta; mostantól a service ÍRJA FELÜL a
számított értékkel — hagyd meg a mappelést (a `createPerson` válaszához kell egy üres lista),
és a bootstrapben írd felül.

`PeopleService.getBootstrap` — a személy-mappelő blokkban, a `mapper.toPersonResponse(...)` UTÁN:

```java
                PersonResponse response = mapper.toPersonResponse(p, own.size(), thisWeek, lastAt);
                PersonAffectTrend trend = affectTrendCalculator.calculate(own, LocalDate.now());
                response.setAffectTrend(trend.readings());
                response.setAffectTrendStart(trend.startWeek());
                response.setDirection(PersonResponse.DirectionEnum.fromValue(trend.direction()));
                response.setDirectionReason(trend.reason());
```

(A generált enum pontos nevét/alakját a `backend/target/generated-sources/openapi` alatt
ellenőrizd — ha a generátor mást ad, azt használd.)

Új mező a service-ben: `private final PersonAffectTrendCalculator affectTrendCalculator;`

A `createPerson` / `updatePerson` / `decidePerson` válaszaiban a három új mező maradjon
becsületesen üres: `affectTrend` üres lista (a mapper adja), `affectTrendStart` és
`directionReason` `null`, `direction` pedig `flat` — a `required` mező nem hiányozhat a
wire-ról. Írd meg mind a négy helyen.

- [ ] **Step 9: Kontraktus-teszt**

Adj a `PeopleContractIT`-hez EGY tesztet: két tónusozott említés két külön héten ugyanannak a
személynek → a bootstrap `affectTrend`-je két elemű, `affectTrendStart` a korábbi hét hétfője,
`direction` jelen van. Használd a meglévő populator-idiómát; a mention időbélyegét pinneld.

Run: `cd backend && ./mvnw test -Dtest='PeopleContractIT,PersonAffectTrendCalculatorTest' -Dmezo.test.use-testcontainers=true`
Expected: zöld.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat(be): hangulat-ív, irány és indoklás valós említésekből (mezo-06o0.8)"
```

---

### Task 2: `people` companion message kind

Az éjszakai/hajnali kör egy valódi Mezo-észrevételt ír a hét emberi képéről. A
`ProactiveFeedService` fajtafüggetlenül olvas, tehát ez a Napi Mezo szálban is megjelenik —
**ez szándékos**: egy emberekről szóló proaktív megfigyelés pontosan oda való, és az FE
feed-renderelése kind-agnosztikus (csak a `morning` van külön kezelve a demo-fallback miatt),
tehát nem kell kizáró különkezelés.

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202609021000_mezo-06o0.8_companion_message_people_kind.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/CompanionMessageEntity.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/CompanionMessageGenerator.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/CompanionMessageJob.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java`
- Modify: `api/feature/today/*.yml` (a `FeedMessageResponse.kind` enum), `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`
- Modify: `frontend/src/data/types.ts` (`FeedMessageKind`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/CompanionMessageGeneratorIT.java` (bővítés — a pontos fájlnevet keresd meg)

**Interfaces:**
- Consumes: `PersonAffectTrendCalculator` + `PersonRepository`/`MentionRepository` (Task 1) — ez nyitja a `proactive → people` élt.
- Produces:
  - `CompanionMessageEntity.KIND_PEOPLE = "people"`
  - `CompanionMessageGenerator.PEOPLE_MARKER` és `generatePeopleObservation(UUID userId, LocalDate date)`
  - `FakeCompanionLlm.PEOPLE_OBS_SENTINEL`

- [ ] **Step 1: Migráció**

`202609021000_mezo-06o0.8_companion_message_people_kind.sql`:

```sql
-- Emberek S6 (mezo-06o0.8): a Mezo-észrevétel sáv valódi companion-üzenetté válik.
-- A 'people' egy NAPI megfigyelés az emberi körről — a többi fajtával egy sorban áll,
-- a (created_by, message_date, kind) parciális uniq index rá is érvényes.
ALTER TABLE companion_message DROP CONSTRAINT ck_companion_message_kind;
ALTER TABLE companion_message
    ADD CONSTRAINT ck_companion_message_kind
        CHECK (kind IN ('morning','sleep','weight','midday','evening','intervention','people'));
```

FIGYELEM: ellenőrizd a jelenlegi CHECK pontos tartalmát a working tree-ben, mielőtt írod —
a `202608151200_mezo-gst9_create_companion_message.sql` öt fajtát sorol, de az `intervention`
egy KÉSŐBBI migrációval jöhetett. Az új CHECK-nek a MOSTANI készlet + `people` legyen.

- [ ] **Step 2: Changelog-bekötés**

A `1.0.0_master.yml` VÉGÉRE, a meglévő behúzással:

```yaml
  - changeSet:
      id: "1.0.0:202609021000_mezo-06o0.8_companion_message_people_kind"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609021000_mezo-06o0.8_companion_message_people_kind.sql
```

- [ ] **Step 3: Entitás-konstans**

`CompanionMessageEntity.java` — a `KIND_INTERVENTION` UTÁN:

```java
    /** Emberek S6 (mezo-06o0.8): napi megfigyelés az emberi körről — az Emberek hub
     *  Mezo-sávja ezt mutatja, és a Napi Mezo szálban is megjelenik. */
    public static final String KIND_PEOPLE = "people";
```

- [ ] **Step 4: Írd meg a bukó ITt**

A meglévő generátor-IT mintájára (keresd meg: `grep -rln "generateWindow\|generateMorning" backend/src/test`)
adj hozzá két tesztet:

```java
@Test
void generatePeopleObservation_shouldPersistMessage_fromTheWeeksPeopleData() {
    // személy + két tónusozott említés a héten; a fake LLM a szentinelről válaszol
    // -> a sor létrejön KIND_PEOPLE fajtával, eyebrow + body kitöltve
}

@Test
void generatePeopleObservation_shouldReturnNull_whenNoMentionThisWeek() {
    // nincs e heti említés -> nincs LLM-hívás, nincs sor (becsületes hiány)
}

@Test
void generatePeopleObservation_shouldBeIdempotent() {
    // kétszer hívva ugyanazt a sort adja vissza, nem ír másodikat
}
```

A teszt-törzseket ténylegesen írd meg a fájl meglévő idiómái szerint.

- [ ] **Step 5: Generátor**

`CompanionMessageGenerator.java` — a `WINDOW_PROMPT` UTÁN:

```java
    /** Emberek S6 (mezo-06o0.8) — a fake LLM erre a prefixre diszpécsel. */
    public static final String PEOPLE_MARKER = "EMBEREK-ESZREVETEL-FELADAT";

    private static final String PEOPLE_PROMPT = PEOPLE_MARKER + "\n"
            + "Írj EGYETLEN rövid magyar mondatot Danielnek társ-szemszögből az emberi köréről, "
            + "kizárólag a megadott heti összesítésből. "
            + "Szabályok: "
            + "- Pontosan egy mondat, legfeljebb 22 szó, sima folyószöveg. "
            + "- Csak azt állítsd, amit az összesítés kimond; nevet, számot kitalálni tilos. "
            + "- Ha valakinél lefelé fordult a hangulat vagy elhallgatott, azt emeld ki — "
            + "  ez a mondat arra való, hogy Daniel észrevegye, kire érdemes ránéznie. "
            + "- Ne adj utasítást és ne moralizálj; egy megfigyelés, nem feladat. "
            + "- A válasz formátuma ugyanaz, mint a többi üzenetnél.";
```

és a `generateWindow` UTÁN a generáló metódus. A `generateMorning` szerkezetét kövesd
(létező sor → visszaadás; adat-kapu → `null`; payload; `llmCallContextHolder.runWith`;
`parse`; használhatatlan válasz → `null` + warn; perzisztálás):

```java
    /**
     * Emberek S6 (mezo-06o0.8): a hét emberi képéről szóló egymondatos megfigyelés. Adat-kapu:
     * e heti említés nélkül NINCS LLM-hívás és nincs sor — az Emberek hub ilyenkor a
     * determinisztikus tartalék-mondatot mutatja (Task 3), nem üres sávot.
     *
     * <p>A payload SZÁNDÉKOSAN már aggregált (személyenként egy sor), nem nyers említés-lista:
     * a modellnek nem kell — és nem is szabad — idézeteket újraértelmeznie, csak a heti képet
     * megfogalmaznia.
     */
    @Transactional
    public CompanionMessageEntity generatePeopleObservation(UUID userId, LocalDate date) {
        CompanionMessageEntity existing = companionMessageRepository
                .findByCreatedByAndMessageDateAndKind(userId, date, CompanionMessageEntity.KIND_PEOPLE)
                .orElse(null);
        if (existing != null) {
            return existing;
        }
        // ... a hét említései + személyek betöltése, PersonAffectTrendCalculator-ral irány/indok,
        //     payload sorok: "- <név> (<kapcsolat>): N említés e héten, irány <magyar>, <indok>"
        //     plus egy "CSENDBEN MARADT: <nevek>" sor a 0 e heti említésű aktív személyekről.
        // ... refs jelöltek: minden szereplő személy -> new CompanionMessageEnvelope.Ref("Person", név)
    }
```

A metódus törzsét ténylegesen írd meg. Amit magadnak kell eldöntened és a jelentésben
indokolnod: melyik repository-finderekkel töltöd a hetet (a `MentionRepository` és a
`PersonRepository` már tud owned-listát adni; NE írj új natív query-t, ha egy meglévő elég),
és hogy a „hét" ablak itt a `date` hetének hétfőjétől számít-e — a Task 1 kalkulátora
hétfő-alapú kosarakkal dolgozik, maradj vele konzisztens.

A `Ref("Person", …)` egy ÚJ ref-fajta. Ellenőrizd, hogy az FE ref-chip renderelése
fajtafüggetlen-e (`frontend/src/features/today/` alatt a refek megjelenítése); ha kind-alapú
ikonválasztás van, és nincs `Person` ág, akkor vagy vegyél fel egyet, vagy használd a
meglévő legközelebbi fajtát — a jelentésben mondd meg, melyiket és miért.

- [ ] **Step 6: Fake LLM ág**

`FakeCompanionLlm.java` — a többi szentinel mintájára:

```java
    /** Emberek S6: [fake-people-obs:…] a heti összesítésbe rejtve. */
    public static final Pattern PEOPLE_OBS_SENTINEL =
            Pattern.compile("\\[fake-people-obs:(.*?)]", Pattern.DOTALL);
```

és a diszpécser-láncba egy ág (a `WINDOW_MARKER` ág mellé), ami a
`CompanionMessageGenerator.PEOPLE_MARKER` prefixre üt. A válasz formátuma egyezzen azzal,
amit a `parse` vár — nézd meg a `parse` implementációját, és a szentinel nélküli DEFAULT
válasz legyen egy érvényes, semleges egymondatos üzenet (ne üres string), hogy a
happy-path ITek szentinel nélkül is működjenek.

- [ ] **Step 7: Job-huzalozás**

`CompanionMessageJob.runMorning` — a sleep-reaction blokk UTÁN, saját try/catch-csel:

```java
            try {
                companionMessageGenerator.generatePeopleObservation(user.getId(), today);
            } catch (Exception e) {
                log.warn("People-observation pre-generation failed for user {} on {}", user.getId(), today, e);
            }
```

SZÁNDÉKOSAN nem kerül bele a `ProactiveFeedService.ensureTodayCronKinds` lusta
miss-recovery ágába: az a feed GET-jén futna, és egy sima `GET /api/people`-ből sosem
szabad LLM-hívás lennie. Egy kimaradt hajnali futást a Task 3 determinisztikus tartaléka fed.
Ezt írd bele a metódus javadocjába.

- [ ] **Step 8: Kontraktus + FE típus**

Keresd meg, melyik `api/feature/**.yml` definiálja a `FeedMessageResponse.kind` enumot
(`grep -rn "morning" api/feature/`), és vedd fel a `people` értéket. Generálj újra
(mindkét generátor). Majd `frontend/src/data/types.ts`:

```ts
export type FeedMessageKind = 'morning' | 'sleep' | 'weight' | 'midday' | 'evening' | 'intervention' | 'people'
```

- [ ] **Step 9: Tesztek + ArchUnit**

Run: `cd backend && ./mvnw test -Dtest='CompanionMessageGeneratorIT,ProactiveFeedServiceIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true`
(a pontos IT-neveket a fájlrendszerből vedd)
Expected: zöld. Ha az `ArchitectureTest.feature_slices_are_cycle_free` bukik, NE regeneráld
a freeze store-t — jelentsd BLOCKED-ként: az azt jelentené, hogy a `proactive → people` él
mégis kört zár, és az terv-szintű döntést kíván.

Run: `cd frontend && VITE_USE_MOCK=true pnpm test -- src/features/today && pnpm build`
Expected: zöld.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat(be): people companion message kind — napi Mezo-észrevétel az emberi körről (mezo-06o0.8)"
```

---

### Task 3: A sáv szövege a bootstrapben — port + determinisztikus tartalék

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/people/PeopleMezoNoteSource.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/PeopleMezoNoteAdapter.java`
- Modify: `api/feature/people/people.yml`, `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/people/service/PeopleService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/people/PeopleMezoNoteIT.java` (create)

**Interfaces:**
- Consumes: `CompanionMessageEntity.KIND_PEOPLE` (Task 2), `PersonAffectTrend` (Task 1).
- Produces:
  - `PeopleMezoNoteSource.todaysNote(UUID userId, LocalDate today) -> Optional<String>`
  - `PeopleResponse.mezoNote` (string, required — sosem null)

- [ ] **Step 1: Port**

```java
package io.mrkuhne.mezo.feature.people;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

/**
 * Fogyasztó-tulajdonú port (a {@link PersonGraphEdgeSource} és a
 * {@code feature/companion/NarrativeNoteSource} idiómája): az Emberek hub Mezo-sávja a mai
 * {@code people} companion-üzenetet mutatja, de a {@code people} feature NEM függhet a
 * {@code proactive}tól — a fordított él (a generátor olvassa a személyeket) ebben a szeletben
 * született meg, tehát ez kört zárna.
 *
 * <p>Üres {@link Optional}: ma még nincs ilyen üzenet (a hajnali futás kimaradt, a proaktív
 * kapcsoló ki van kapcsolva, vagy az adat-kapu nem engedte). A hívó ilyenkor a saját
 * determinisztikus tartalék-mondatát mutatja — a sáv sosem üres.
 */
public interface PeopleMezoNoteSource {

    Optional<String> todaysNote(UUID userId, LocalDate today);
}
```

- [ ] **Step 2: Bukó IT**

`PeopleMezoNoteIT.java`: (a) mai `people` üzenet létezik → a bootstrap `mezoNote`-ja annak a
szövege; (b) nincs mai üzenet, de van e heti említés → a determinisztikus tartalék-mondat jön,
és tartalmazza az érintett személy nevét; (c) egyáltalán nincs adat → a tartalék általános,
nem üres string, és nem tartalmaz kitalált nevet.

- [ ] **Step 3: Adapter**

```java
package io.mrkuhne.mezo.feature.proactive.service;

// @Service, @RequiredArgsConstructor,
// @ConditionalOnProperty(name = {COMPANION_SWITCH, PROACTIVE_SWITCH}, havingValue = "true")
// implements PeopleMezoNoteSource
//
// todaysNote: companionMessageRepository.findByCreatedByAndMessageDateAndKind(
//     userId, today, CompanionMessageEntity.KIND_PEOPLE)
//   .map(m -> m.getContent().body()) -> a bekezdéseket EGY szóközzel összefűzve,
//   üres/blank eredmény esetén Optional.empty() (egy üres üzenet nem jobb, mint a tartalék).
```

A törzset ténylegesen írd meg, a `CompanionMessageEnvelope` valódi alakja szerint.

- [ ] **Step 4: Kontraktus**

`api/feature/people/people.yml` — a `PeopleResponse`-ba:

```yaml
        mezoNote:
          type: string
          description: >-
            Az Emberek hub Mezo-észrevétel sávjának mondata. A mai 'people' companion-üzenet,
            ha van; egyébként a heti aggregátumokból számított, determinisztikus tartalék.
            Sosem üres — a sáv mindig igaz mondatot mutat.
```

és a `required` listába: `- mezoNote`.

Generálj újra (mindkét generátor).

- [ ] **Step 5: Service + tartalék**

`PeopleService`: új mező `private final ObjectProvider<PeopleMezoNoteSource> mezoNoteSource;`
(ObjectProvider, mert kikapcsolt proaktív/companion mellett nincs implementáció), és a
`getBootstrap` végén:

```java
        String mezoNote = mezoNoteSource
            .getIfAvailable(() -> (u, d) -> Optional.empty())
            .todaysNote(userId, LocalDate.now())
            .orElseGet(() -> derivedMezoNote(personResponses));
        return new PeopleResponse(personResponses, mentionResponses, mezoNote);
```

(A generált `PeopleResponse` konstruktor-alakját ellenőrizd; ha setter/builder, azt használd.)

A tartalék-mondat egy privát, determinisztikus metódus a `PersonResponse` listából — nincs
új lekérdezés, mert minden szükséges adat (név, `mentionsThisWeek`, `direction`,
`directionReason`) már ott van a Task 1 után. Prioritási sorrend, az első találat nyer:

1. van lefelé forduló személy → `"<Név> hangulata lefelé fordult — <indok>."`
2. van olyan aktív személy, aki e héten egyszer sem került szóba →
   `"<Név> nem került szóba ezen a héten."`
3. van e heti említés → `"<Név> volt a leggyakoribb neved ezen a héten."`
4. semmi → `"Még nincs elég említés a heti képhez."`

Az 1–3. eset MINDIG valós adatból veszi a nevet; holtversenynél név szerinti ábécé dönt, hogy
a mondat két betöltés között ne ugráljon.

- [ ] **Step 6: Tesztek**

Run: `cd backend && ./mvnw test -Dtest='PeopleMezoNoteIT,PeopleContractIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true`
Expected: zöld.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(api): mezoNote a people bootstrapben, determinisztikus tartalékkal (mezo-06o0.8)"
```

---

### Task 4: FE — a felület a szerver számaira áll

**Files:**
- Modify: `frontend/src/data/types.ts`, `frontend/src/data/me/peopleApi.ts`, `peopleHooks.ts`, `frontend/src/data/me/people.ts`
- Modify: `frontend/src/features/me/logic/peopleDerive.ts`
- Modify: `frontend/src/features/me/pages/PeoplePage.tsx`, `PeopleHetiPage.tsx`, `PersonDetailPage.tsx`
- Modify: `frontend/src/test/msw/handlers.ts`
- Test: `peopleDerive.test.ts`, `PeoplePage.test.tsx`, `PeopleHetiPage.test.tsx`, `PersonDetailPage.test.tsx`, `peopleHooks.test.tsx`

**Interfaces:**
- Consumes: `PersonResponse.affectTrend/affectTrendStart/direction/directionReason`, `PeopleResponse.mezoNote`.
- Produces: `PersonEntry.affectTrendStart/direction/directionReason`, `usePeople().mezoNote`.

- [ ] **Step 1: Típusok**

`frontend/src/data/types.ts` — a `PersonEntry`-be, az `affectTrend` MELLÉ:

```ts
  /** A hangulat-ív első olvasatának hete (ISO dátum), vagy null, ha nincs olvasat. */
  affectTrendStart: string | null
  direction: 'up' | 'down' | 'flat'
  directionReason: string | null
```

- [ ] **Step 2: Bukó tesztek**

Írd meg ELŐSZÖR (a meglévő fájlok idiómáival, `createMemoryRouter` + a valós `routes`,
`useNavigate`-mock TILOS):
- `PeoplePage.test.tsx`: a Mezo-sáv a `mezoNote` szövegét mutatja (a mock seedből), nem
  sablonmondatot.
- `PeopleHetiPage.test.tsx`: egy lefelé forduló személy kártyáján a szerver
  `directionReason`-je jelenik meg.
- `PersonDetailPage.test.tsx`: a hangulat-ív tengelycímkéi az `affectTrendStart`-ból jönnek.

- [ ] **Step 3: Mock seed + hook**

`frontend/src/data/me/people.ts`: minden személy kap `affectTrendStart`, `direction`,
`directionReason` értéket, összhangban a már meglévő `affectTrend` tömbjével (pl. Bence
`direction: 'down'`, `directionReason: 'többször nehéz tónus, mint korábban'`), és vedd fel
a mock `mezoNote`-ot (egy Mezo-hangú mondat).

`peopleApi.ts` / `peopleHooks.ts`: a real ág mappelje az új mezőket; a `usePeople()` adjon
vissza `mezoNote`-ot. A mock ág `useDualQuery` `mockData`-ja hordozza ugyanezt; a real
`realEmpty` `mezoNote`-ja üres string legyen (a sávot az FE ilyenkor nem rendereli).

`frontend/src/test/msw/handlers.ts`: a `GET /api/people` válasz kapja meg az új mezőket.

- [ ] **Step 4: `peopleDerive` — a `directionFor` kivezetése**

A `hubLines` mostantól a szerver irányát olvassa:

```ts
  const downPerson = people.find((p) => p.direction === 'down')
  const upPerson = people.find((p) => p.direction === 'up')
```

A `directionFor` és a `Direction` típus: ha a kivezetés után SEMMI nem használja őket,
töröld mindkettőt a hozzájuk tartozó tesztekkel együtt (nem hagyunk halott kódot); ha marad
használó, hagyd meg és a jelentésben mondd meg, hol. A `Direction` típust a `PersonEntry`
mezőjének típusa váltja ki.

- [ ] **Step 5: `PeopleHetiPage` — a `whyLine` kivezetése**

A `DirCard` a `person.direction`-t és a `person.directionReason`-t olvassa; a lokális
`whyLine` függvény törlendő (az S3 ideiglenes helyettesítője volt, a fájl komment is így
jelöli — a kommentet is frissítsd). Ha a `directionReason` `null`, a `.ppl-why2` sor
maradjon el, ne írjon ki üres sort. A `directed` lista rendezése változatlan
(`DIR_WEIGHT` szerint).

- [ ] **Step 6: `PeoplePage` — a sáv a `mezoNote`-ból**

A lokális `mezoSentence()` törlendő; a `.ppl-hub-snip` a `mezoNote`-ot mutatja. Ha a
`mezoNote` üres string (real mód, még nincs adat), a sáv NE renderelődjön — a hub többi része
változatlan. A chat-handoff viselkedés (ADR 0032) érintetlen.

- [ ] **Step 7: `PersonDetailPage` — becsületes tengely**

A `trendAxisLabels(trend, now)` hívás helyett a tengely a `person.affectTrendStart` és a mai
nap hónapjából áll elő. Írd át a `peopleDerive.trendAxisLabels` szignatúráját
`(startISO: string | null, now: Date) => [string, string] | null`-ra (a hézagos ívnél a
`trend.length * 7` becslés hazudna — ezért utazik a startWeek a wire-on), frissítsd a
javadocját és a hozzá tartozó unit-teszteket, és igazítsd a `PeopleKorPage`/`PersonCard`
hívásait, ha érintettek.

- [ ] **Step 8: Kapuk**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test`
Run: `cd frontend && VITE_USE_MOCK=false pnpm test`
Run: `cd frontend && pnpm build`
Expected: mind zöld. A `mozaikCssTokens` guard is fusson le (a teljes suite tartalmazza).

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat(fe): az Emberek felület a szerver hangulat-ívére és Mezo-észrevételére áll (mezo-06o0.8)"
```

---

### Task 5: Dokumentáció és teljes kapu

**Files:**
- Modify: `docs/features/me.md`, `docs/features/proactive.md`, `docs/CODEMAP.md`

- [ ] **Step 1: `me.md`**

Rögzítsd, és keress rá KIFEJEZETTEN olyan mondatokra, amiket ez a szelet hazuggá tett
(az S4-nél és az S5-nél is pont ez volt a review egyik fogása):

- a hangulat-ív, az irány és az indoklás mostantól SZÁMÍTOTT érték a `PersonAffectTrendCalculator`-ból,
  a `person.affect_trend` oszlopot a válasz nem olvassa (ha bárhol „AI-kurált, a CRUD nem
  nyúl hozzá" áll az `affectTrend`-ről, írd át);
- az üres hét nem kap pontot, ezért utazik a `affectTrendStart` — és ezért nem a
  `trend.length`-ből számol a tengely;
- a Mezo-sáv a mai `people` companion-üzenet, determinisztikus tartalékkal; a tartalék
  prioritási sorrendjét írd le;
- „Csendben maradt" változatlanul az S3 óta él, `mentionsThisWeek === 0` alapon.

- [ ] **Step 2: `proactive.md`**

- új `people` message kind: mit lát a modell (aggregált heti sorok, nem nyers idézetek),
  mikor NEM születik sor (nincs e heti említés), az idempotencia, és hogy a hajnali cron
  generálja, de a feed lusta miss-recovery-je SZÁNDÉKOSAN nem — mert az egy `GET /api/people`-ből
  csinálna LLM-hívást;
- hogy a `people` kind a Napi Mezo szálban is megjelenik (a `getFeed` fajtafüggetlen), és ez
  szándékos;
- a `PeopleMezoNoteAdapter` és a port iránya (`proactive → people`, a fordított TILOS).

- [ ] **Step 3: CODEMAP + docs-kapu**

Run: `node scripts/gen-codemap.mjs`
Run: `node scripts/lint-docs.mjs --errors-only`
Expected: `result: PASS`. Idézd be a kimenet utolsó sorait a jelentésedbe.

- [ ] **Step 4: Teljes backend-kapu**

Run: `cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true`
Expected: BUILD SUCCESS. Ez tartalmazza az `ArchitectureTest`-et is (a fókuszált futások nem).
Ha a `feature_slices_are_cycle_free` bukik, NE regeneráld a freeze store-t — jelentsd BLOCKED-ként.
(Ha egy flaky Lombok/MapStruct fordítás kiürítené a `backend/src/test/resources/archunit-store`
fájlt: `git checkout -- backend/src/test/resources/archunit-store/`, majd újra, egyedül.)

- [ ] **Step 5: Teljes FE-kapu**

Run: `cd frontend && VITE_USE_MOCK=false pnpm test`
Run: `cd frontend && VITE_USE_MOCK=true pnpm test`
Run: `cd frontend && pnpm build`
Expected: mind zöld.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "docs: Emberek S6 heti/detail polish dokumentálása (mezo-06o0.8)"
```

---

## Self-Review

**Spec-lefedettség** (spec §8/6. szelet: „hangulat-ív aggregáció, irányok számítása,
»Csendben maradt«, Mezo-észrevétel sáv (companion message kind)"):

- „hangulat-ív aggregáció" → Task 1 (`PersonAffectTrendCalculator`, heti kosarak tónusból +
  intenzitásból), Task 4 Step 7 (becsületes tengely).
- „irányok számítása" → Task 1 (`direction` + `directionReason` szerver-oldalon, egyetlen
  forrásból), Task 4 Step 4–5 (az FE `directionFor` és `whyLine` kivezetése).
- „Csendben maradt" → **már kész az S3-ban**; a terv „Ami MÁR KÉSZ" szakasza kimondja, hogy
  ellenőrizni kell, nem újraírni. Ez nem hiányzó lefedettség.
- „Mezo-észrevétel sáv (companion message kind)" → Task 2 (a kind, a generátor, a job) +
  Task 3 (a port és a sáv szövege determinisztikus tartalékkal).

**Amit ez a szelet SZÁNDÉKOSAN nem csinál** (és amit a review-nak nem szabad hiányként
felrónia): nem törli a `person.affect_trend` oszlopot (a válasz csak nem olvassa — az oszlop
elhagyása külön migrációs döntés); nem vezeti be a `people` kindot a feed lusta
miss-recovery-jébe; nem ad LLM-prózát az irány-indoklásnak (az determinisztikus marad, a
Mezo-sáv az egyetlen LLM-felület ebben a szeletben); és nem nyúl a heti ritmus / tónus-sáv /
„A hét pillanata" blokkokhoz.

**Típus-konzisztencia:** a `direction` három értéke (`up`/`down`/`flat`) ugyanaz a három
string a `PersonAffectTrend` konstansaiban (Task 1), a kontraktus enumjában (Task 1 Step 6),
és az FE `PersonEntry.direction` uniójában (Task 4 Step 1). A `KIND_PEOPLE = "people"` ugyanaz
a string a DB CHECK-ben, az entitásban, az adapter lekérdezésében (Task 3) és az FE
`FeedMessageKind` uniójában (Task 2 Step 8). A `PersonAffectTrendCalculator.calculate` aláírása
`(List<MentionEntity>, LocalDate)` — a Task 2 generátora is ezt hívja, ugyanazzal a
hétfő-alapú hét-értelmezéssel.

**Ismert kockázat, amit a végrehajtónak látnia kell:** a Task 2 ÚJ szelet-élt nyit
(`proactive → people`). A terv írásakor ellenőriztem, hogy ez nem zár kört (a `people` kifelé
csak `auth`/`journal`/`ritual` felé mutat, és semmi nem mutat vissza a `proactive`-ra), de ez
a repó állapotától függ: ha az `ArchitectureTest` mégis bukik, az terv-szintű döntés, nem
freeze-store-regenerálás.
