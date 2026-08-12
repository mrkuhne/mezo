# Minta-motor monitor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/insights/motor` al-oldal + `GET /api/companion/pattern/monitor` végpont, amely élőben megmutatja, hogy a V3.1 minta-motor melyik párt miért nem tudja még felismerni, és melyik metrikából hiányzik adat.

**Architecture:** A mai `PatternDetectionService.detectPair` illesztő ciklusa + kapui kiemelődnek egy tiszta, statikus `PatternGate` osztályba; ezután a **job és a monitor ugyanazt a kódot futtatja**, csak a monitor nem ír. A monitor egy kérésen belül metrikánként egyszer húzza le a szériákat, így a pár-verdiktek és a metrika-lefedettség ugyanabból a pillanatképből származnak. A FE egy `useDualQuery`-alapú hookon át rendereli a három blokkot (motor-állapot / párok / lefedettség).

**Tech Stack:** Java 21 · Spring Boot 4 · MapStruct/Lombok · OpenAPI contract-first (`api/feature/companion/companion.yml`) · React 19 + TanStack Query + Vitest/MSW.

**Spec:** [`docs/superpowers/specs/2026-08-11-pattern-monitor-design.md`](../specs/2026-08-11-pattern-monitor-design.md) · **bd:** `mezo-viqs`

## Global Constraints

- **Nincs új DB-tábla, nincs Liquibase-migráció.** A `ResetDatabase` TRUNCATE-listája nem változik.
- **Contract-first:** minden boundary-DTO a generált `io.mrkuhne.mezo.api.dto` / `api.gen.ts` típusokból jön; kézzel írt boundary-DTO tilos.
- **A generált `CompanionApi` interfész absztrakt** (`skipDefaultInterface: true`) — amint a YAML-be kerül a végpont, a `CompanionController`-nek implementálnia KELL, különben nem fordul. Ezért a kontraktus és a controller **egy taskban** van.
- **Backend build mindig `clean`-nel:** `./mvnw clean test` (a Lombok+MapStruct inkrementális fordítás megbízhatatlan).
- **Minden companion bean** `@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")`.
- **DI konstruktoron át** (`@RequiredArgsConstructor`), soha nem mezőn; `@Transactional` csak metóduson.
- **Teszt-elnevezés:** `test{Method}_should{Result}_when{Condition}`, kizárólag AssertJ.
- **FE import:** mély + abszolút `@/*` alias, relatív `../` tilos, barrel csak `@/data/hooks`.
- **FE dual-mode:** minden olvasó hook `useDualQuery`; a mock seed SOHA nem real-módú fallback.
- **A UI nyelve magyar**, a `PatternCard.tsx`-ben használt token-készlettel (`card`/`chip`/`eyebrow`/`bar`/`bar-fill`, `var(--success)`, `var(--warning)`, `var(--lav-deep)`, `var(--wash-lav)`, `var(--surface-glass)`, `var(--text-primary|secondary|tertiary)`, `var(--ff-display)`) — **új CSS-token bevezetése tilos**.
- **Commit-üzenet:** conventional subject a bd id-val, pl. `feat(companion): ... (mezo-viqs)`.

---

## File Structure

| fájl | felelősség |
|---|---|
| `backend/.../companion/service/PatternGate.java` | **ÚJ** — a lag-illesztés + a két kapu tiszta függvényként (statikus, Spring-mentes) |
| `backend/.../companion/service/PatternDetectionService.java` | **MÓD** — `detectPair` átkötve a `PatternGate`-re, viselkedés-azonosan |
| `backend/.../companion/service/MetricKey.java` | **MÓD** — `wireKey()` (enum → kebab-case, a katalógus-YAML kulcsaival egyezően) |
| `backend/.../companion/service/PatternMonitorService.java` | **ÚJ** — élő diagnosztika összeállítása (széria-cache, verdiktek, lefedettség) |
| `backend/.../companion/controller/CompanionController.java` | **MÓD** — a generált `patternMonitor()` implementációja |
| `api/feature/companion/companion.yml` | **MÓD** — a végpont + 3 séma |
| `frontend/src/data/types.ts` | **MÓD** — `PatternGateVerdict`, `PatternMonitor*` domain típusok |
| `frontend/src/data/insights/monitorApi.ts` | **ÚJ** — wire → domain mapping |
| `frontend/src/data/insights/monitorHooks.ts` | **ÚJ** — `usePatternMonitor()` (`useDualQuery`, 404 → degraded) |
| `frontend/src/data/insights/insights.ts` | **MÓD** — `patternMonitor` mock seed |
| `frontend/src/data/hooks.ts` | **MÓD** — barrel re-export |
| `frontend/src/features/insights/components/GateVerdictRow.tsx` | **ÚJ** — egy pár sora (prezentációs) |
| `frontend/src/features/insights/components/MetricCoverageRow.tsx` | **ÚJ** — egy metrika lefedettség-sora (prezentációs) |
| `frontend/src/features/insights/pages/MotorPage.tsx` | **ÚJ** — a három blokk + rendezés + degraded állapot |
| `frontend/src/features/insights/pages/tabs.ts` · `frontend/src/app/router.tsx` | **MÓD** — 8. tab + route |
| `frontend/src/features/insights/pages/PatternsPage.tsx` | **MÓD** — „Miért nincs még minta?" link az üres és a degraded állapotban |

---

## Task 1: `PatternGate` — a kapu közös igazságforrásként

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternGate.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternDetectionService.java` (a `detectPair` metódus)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/PatternGateTest.java`

**Interfaces:**
- Consumes: `PearsonCorrelation.correlate(double[], double[]) → Optional<PearsonCorrelation.Result>` (meglévő, package-private, `Result(double r, int n, double p)`).
- Produces: `PatternGate.evaluate(Map<LocalDate,Double> seriesA, Map<LocalDate,Double> seriesB, int lagDays, int minN) → PatternGate.Outcome`, ahol `Outcome(Verdict verdict, int alignedDays, PearsonCorrelation.Result result, Side constantSide)`, `Verdict ∈ {LIVE, FEW_DAYS, NO_DATA, DEGENERATE}`, `Side ∈ {A, B, BOTH}`. Package-private (`io.mrkuhne.mezo.feature.companion.service`) — a Task 3 szolgáltatása ugyanebben a csomagban él.

- [ ] **Step 1: Írd meg a bukó tesztet**

`backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/PatternGateTest.java`:

```java
package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Map;
import java.util.TreeMap;

/** A V3.1 felszínre-engedő kapu tiszta fixtúrái — illesztés, min-n, degeneráció (no Spring, no DB). */
class PatternGateTest {

    private static final LocalDate D = LocalDate.of(2026, 6, 1);

    private static Map<LocalDate, Double> series(LocalDate start, double... values) {
        Map<LocalDate, Double> out = new TreeMap<>();
        for (int i = 0; i < values.length; i++) {
            out.put(start.plusDays(i), values[i]);
        }
        return out;
    }

    @Test
    void testEvaluate_shouldReturnNoData_whenNoDayAligns() {
        PatternGate.Outcome outcome = PatternGate.evaluate(
                series(D, 1, 2, 3), series(D.plusDays(30), 4, 5, 6), 0, 8);

        assertThat(outcome.verdict()).isEqualTo(PatternGate.Verdict.NO_DATA);
        assertThat(outcome.alignedDays()).isZero();
        assertThat(outcome.result()).isNull();
    }

    @Test
    void testEvaluate_shouldReturnFewDays_whenBelowMinN() {
        PatternGate.Outcome outcome = PatternGate.evaluate(
                series(D, 1, 2, 3, 4, 5), series(D, 2, 1, 4, 3, 6), 0, 8);

        assertThat(outcome.verdict()).isEqualTo(PatternGate.Verdict.FEW_DAYS);
        assertThat(outcome.alignedDays()).isEqualTo(5);
        assertThat(outcome.result()).isNull();
    }

    @Test
    void testEvaluate_shouldReturnLive_whenMinNReached() {
        PatternGate.Outcome outcome = PatternGate.evaluate(
                series(D, 1, 2, 3, 4, 5, 6, 7, 8), series(D, 2, 4, 6, 8, 10, 12, 14, 16), 0, 8);

        assertThat(outcome.verdict()).isEqualTo(PatternGate.Verdict.LIVE);
        assertThat(outcome.alignedDays()).isEqualTo(8);
        assertThat(outcome.result().r()).isCloseTo(1.0, within(1e-9));
        assertThat(outcome.result().n()).isEqualTo(8);
    }

    @Test
    void testEvaluate_shouldReturnDegenerateNamingSideB_whenSecondSeriesConstant() {
        PatternGate.Outcome outcome = PatternGate.evaluate(
                series(D, 1, 2, 3, 4, 5, 6, 7, 8), series(D, 5, 5, 5, 5, 5, 5, 5, 5), 0, 8);

        assertThat(outcome.verdict()).isEqualTo(PatternGate.Verdict.DEGENERATE);
        assertThat(outcome.constantSide()).isEqualTo(PatternGate.Side.B);
        assertThat(outcome.alignedDays()).isEqualTo(8);
    }

    @Test
    void testEvaluate_shouldReturnDegenerateNamingBoth_whenBothSeriesConstant() {
        PatternGate.Outcome outcome = PatternGate.evaluate(
                series(D, 2, 2, 2, 2, 2, 2, 2, 2), series(D, 5, 5, 5, 5, 5, 5, 5, 5), 0, 8);

        assertThat(outcome.constantSide()).isEqualTo(PatternGate.Side.BOTH);
    }

    @Test
    void testEvaluate_shouldAlignShiftedDays_whenLagIsOne() {
        // A: jún 1-5 = 1..5 · B: jún 2-6 = 2,4,6,8,10 → lag=1 mellett tökéletes egyezés
        PatternGate.Outcome outcome = PatternGate.evaluate(
                series(D, 1, 2, 3, 4, 5), series(D.plusDays(1), 2, 4, 6, 8, 10), 1, 3);

        assertThat(outcome.verdict()).isEqualTo(PatternGate.Verdict.LIVE);
        assertThat(outcome.alignedDays()).isEqualTo(5);
        assertThat(outcome.result().r()).isCloseTo(1.0, within(1e-9));
    }

    @Test
    void testEvaluate_shouldDropUnpairedDays_whenLagIsZeroOnShiftedSeries() {
        // ugyanaz az input lag=0-val: csak jún 2-5 illeszkedik (4 nap)
        PatternGate.Outcome outcome = PatternGate.evaluate(
                series(D, 1, 2, 3, 4, 5), series(D.plusDays(1), 2, 4, 6, 8, 10), 0, 3);

        assertThat(outcome.alignedDays()).isEqualTo(4);
    }
}
```

- [ ] **Step 2: Futtasd, hogy lásd a bukást**

```bash
cd backend && ./mvnw clean test -Dtest=PatternGateTest
```

Elvárt: **fordítási hiba** — `cannot find symbol: class PatternGate`.

- [ ] **Step 3: Írd meg a `PatternGate`-et**

`backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternGate.java`:

```java
package io.mrkuhne.mezo.feature.companion.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * A V3.1 felszínre-engedő kapu tiszta függvényként (a {@link PearsonCorrelation} precedense: se
 * Spring, se DB, se LLM). Ugyanezt futtatja az éjszakai {@code PatternDetectionService} és az élő
 * {@code PatternMonitorService} — ez garantálja, hogy a monitor nem tud mást mondani, mint amit a
 * job tenne. A {@code FROZEN} szándékosan NEM verdikt: az a perzisztált sor státuszának
 * következménye, nem a matematikáé.
 */
final class PatternGate {

    enum Verdict { LIVE, FEW_DAYS, NO_DATA, DEGENERATE }

    /** Melyik illesztett széria konstans — csak {@code DEGENERATE} esetén értelmezett. */
    enum Side { A, B, BOTH }

    /** {@code result} csak LIVE-nál, {@code constantSide} csak DEGENERATE-nél nem null. */
    record Outcome(Verdict verdict, int alignedDays, PearsonCorrelation.Result result, Side constantSide) {
    }

    private PatternGate() {
    }

    /**
     * {@code seriesB} a {@code seriesA} napjához képest {@code lagDays} nappal KÉSŐBB olvasódik.
     * A hívó felelőssége, hogy a két térképet a saját ablakára vágja (a job ezt teszi).
     */
    static Outcome evaluate(Map<LocalDate, Double> seriesA, Map<LocalDate, Double> seriesB,
                            int lagDays, int minN) {
        List<double[]> aligned = new ArrayList<>();
        seriesA.forEach((day, a) -> {
            Double b = seriesB.get(day.plusDays(lagDays));
            if (b != null) {
                aligned.add(new double[] {a, b});
            }
        });
        int n = aligned.size();
        if (n == 0) {
            return new Outcome(Verdict.NO_DATA, 0, null, null);
        }
        if (n < minN) {
            return new Outcome(Verdict.FEW_DAYS, n, null, null);
        }
        double[] xs = aligned.stream().mapToDouble(v -> v[0]).toArray();
        double[] ys = aligned.stream().mapToDouble(v -> v[1]).toArray();
        return PearsonCorrelation.correlate(xs, ys)
                .map(result -> new Outcome(Verdict.LIVE, n, result, null))
                .orElseGet(() -> new Outcome(Verdict.DEGENERATE, n, null, constantSide(xs, ys)));
    }

    /**
     * A {@code correlate()} csak üres Optionalt ad — a DEGENERATE verdiktnek viszont meg kell
     * tudnia nevezni a hibás metrikát, ezért a varianciát itt nézzük meg még egyszer. (A
     * {@code n < 3} miatti üres Optional nem érhet ide: a config {@code min-n}-je legalább 3.)
     */
    private static Side constantSide(double[] xs, double[] ys) {
        boolean a = isConstant(xs);
        boolean b = isConstant(ys);
        return a && b ? Side.BOTH : a ? Side.A : Side.B;
    }

    private static boolean isConstant(double[] values) {
        for (double value : values) {
            if (value != values[0]) {
                return false;
            }
        }
        return true;
    }
}
```

- [ ] **Step 4: Futtasd a tesztet — most zöldnek kell lennie**

```bash
cd backend && ./mvnw clean test -Dtest=PatternGateTest
```

Elvárt: PASS, 7 teszt.

- [ ] **Step 5: Kösd át a `PatternDetectionService`-t**

`PatternDetectionService.java` — a teljes `detectPair` metódust cseréld erre (a `detect`, `upsert`, `reinforcePromotedFact`, `mechanism`, `evidence` **változatlan marad**):

```java
    private boolean detectPair(UUID userId, CompanionProperties.PatternPair pair,
                               LocalDate from, LocalDate to, int minN) {
        Map<LocalDate, Double> seriesA = metricSeriesService.series(userId, pair.metricA(), from, to);
        Map<LocalDate, Double> seriesB = metricSeriesService.series(userId, pair.metricB(),
                from.plusDays(pair.lagDays()), to.plusDays(pair.lagDays()));
        // A kapu KÖZÖS a monitorral (PatternMonitorService) — a diagnosztika ettől hiteles.
        PatternGate.Outcome outcome = PatternGate.evaluate(seriesA, seriesB, pair.lagDays(), minN);
        if (outcome.verdict() != PatternGate.Verdict.LIVE) {
            return false; // a kapun kívül semmit nem perzisztálunk (kevés nap / nincs adat / degenerált)
        }
        upsert(userId, pair, outcome.result(), from, to);
        return true;
    }
```

Ezzel a `java.util.ArrayList` / `java.util.List` importok feleslegessé válhatnak a fájlban — töröld azokat, amiket a fordító feleslegesnek jelöl, de a `List` importot **hagyd meg**, mert az `evidence(...)` metódus használja.

- [ ] **Step 6: Futtasd a motor regressziós tesztjeit**

```bash
cd backend && ./mvnw clean test -Dtest='PatternGateTest,PatternDetectionServiceIT,CompanionPatternApiIT'
```

Elvárt: mind PASS — a `PatternDetectionServiceIT` a viselkedés-azonosság bizonyítéka (nem módosítjuk).

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternGate.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternDetectionService.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/PatternGateTest.java && git commit -m "refactor(companion): kapu-kiértékelés kiemelése PatternGate-be (mezo-viqs)"
```

---

## Task 2: Kontraktus + `PatternMonitorService` + végpont

**Files:**
- Modify: `api/feature/companion/companion.yml`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MetricKey.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternMonitorService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/controller/CompanionController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPatternMonitorApiIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPatternMonitorSwitchOffIT.java`

**Interfaces:**
- Consumes: `PatternGate.evaluate(...)` (Task 1) · `MetricSeriesService.series(UUID, MetricKey, LocalDate, LocalDate) → Map<LocalDate,Double>` · `PatternRepository.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(UUID) → List<PatternEntity>` · `CompanionProperties.patterns()` → `Patterns(String cron, int lookbackDays, int minN, int reinforceCooldownDays, List<PatternPair> pairs)` · `PatternPair(String key, String category, String label, String title, MetricKey metricA, MetricKey metricB, int lagDays)` · `PatternEntity.KIND_STATISTICAL` / `STATUS_CONFIRMED` / `STATUS_REJECTED`.
- Produces: `GET /api/companion/pattern/monitor` → `PatternMonitorResponse` · `PatternMonitorService.monitor(UUID) → PatternMonitorResponse` · `MetricKey.wireKey() → String` (kebab-case).

- [ ] **Step 1: Bővítsd a kontraktust**

`api/feature/companion/companion.yml` — a `/api/companion/pattern/{patternId}/decision` blokk UTÁN, még a `components:` szekció előtt:

```yaml
  /api/companion/pattern/monitor:
    get:
      tags: [Companion]
      operationId: patternMonitor
      summary: >-
        Élő kapu-diagnosztika (mezo-viqs) — a katalógus minden párjára ugyanaz a kiértékelés fut,
        amit az éjszakai job végezne, de ÍRÁS NÉLKÜL: verdikt + illesztett napok + a hiányzó
        metrika, plusz a 12 metrika lefedettsége a korrelációs ablakban.
      responses:
        '200':
          description: A motor pillanatnyi állapota
          content:
            application/json:
              schema: { $ref: '#/components/schemas/PatternMonitorResponse' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
```

Ugyanebben a fájlban, a `PatternDecisionRequest` séma UTÁN:

```yaml
    PatternMonitorResponse:
      type: object
      required: [windowFrom, windowTo, lookbackDays, minN, cron, pairs, metrics]
      properties:
        windowFrom: { type: string, format: date, description: 'A korrelációs ablak első napja.' }
        windowTo: { type: string, format: date, description: 'Az ablak utolsó napja (tegnap — a job is befejezett napokkal dolgozik).' }
        lookbackDays: { type: integer, description: 'mezo.companion.patterns.lookback-days' }
        minN: { type: integer, description: 'mezo.companion.patterns.min-n — a felszínre-engedő kapu.' }
        cron: { type: string, description: 'A nyers cron-kifejezés (a FE nem parse-olja, csak megjeleníti).' }
        lastRunAt: { type: string, format: date-time, nullable: true, description: 'A user statisztikai sorainak max(lastDetectedAt)-ja; null = a job még sosem írt sort.' }
        pairs:
          type: array
          items: { $ref: '#/components/schemas/PatternMonitorPair' }
        metrics:
          type: array
          items: { $ref: '#/components/schemas/PatternMetricCoverage' }
    PatternMonitorPair:
      type: object
      required: [key, title, category, categoryLabel, lagDays, metricAKey, metricALabel, metricBKey, metricBLabel, verdict, alignedDays]
      properties:
        key: { type: string, description: 'A pár stabil identitása (pair_key).' }
        title: { type: string }
        category: { type: string, pattern: '^(physiology|trigger|response)$' }
        categoryLabel: { type: string }
        lagDays: { type: integer, description: 'metric-b ennyi nappal metric-a napja UTÁN olvasódik.' }
        metricAKey: { type: string }
        metricALabel: { type: string }
        metricBKey: { type: string }
        metricBLabel: { type: string }
        verdict: { type: string, pattern: '^(live|few_days|no_data|degenerate|frozen)$' }
        alignedDays: { type: integer, description: 'Az illesztett napok száma (frozen sornál a befagyasztott n).' }
        missingDays: { type: integer, nullable: true, description: 'minN - alignedDays — csak few_days.' }
        bottleneckMetricKey: { type: string, nullable: true, description: 'A szűk keresztmetszet metrikája — few_days / no_data / degenerate.' }
        r: { type: number, format: double, nullable: true, description: 'live: élő számítás · frozen: a befagyasztott sor értéke.' }
        n: { type: integer, nullable: true }
        p: { type: number, format: double, nullable: true }
        status: { type: string, nullable: true, pattern: '^(confirmed|rejected)$', description: 'Csak frozen sorokon — a user ítélete.' }
    PatternMetricCoverage:
      type: object
      required: [key, label, coveredDays, windowDays, pairCount]
      properties:
        key: { type: string, description: 'kebab-case metrika-kulcs, egyezően a pairs katalógussal.' }
        label: { type: string, description: 'Magyar metrika-címke.' }
        coveredDays: { type: integer, description: 'Hány napon van érték az ablakban.' }
        windowDays: { type: integer }
        lastDayWithData: { type: string, format: date, nullable: true }
        pairCount: { type: integer, description: 'Hány katalógus-pár hivatkozik erre a metrikára.' }
```

- [ ] **Step 2: Generálj, és nézd meg, hogy a fordítás elhasal**

```bash
cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api && cd ../backend && ./mvnw clean compile
```

Elvárt: **fordítási hiba** — `CompanionController is not abstract and does not override abstract method patternMonitor()`. Ez a contract-first „piros" állapot: a kontraktus már megköveteli a végpontot.

- [ ] **Step 3: Add hozzá a `wireKey()`-t a `MetricKey`-hez**

`MetricKey.java` — a `labelHu()` metódus mellé:

```java
    /**
     * A wire/config kulcs (kebab-case), pl. {@code SLEEP_DURATION_H → "sleep-duration-h"} —
     * pontosan az, amit a {@code mezo.companion.patterns.pairs} katalógus is használ.
     */
    public String wireKey() {
        return name().toLowerCase(java.util.Locale.ROOT).replace('_', '-');
    }
```

- [ ] **Step 4: Írd meg a `PatternMonitorService`-t**

`backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternMonitorService.java`:

```java
package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.PatternMetricCoverage;
import io.mrkuhne.mezo.api.dto.PatternMonitorPair;
import io.mrkuhne.mezo.api.dto.PatternMonitorResponse;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Élő kapu-diagnosztika (mezo-viqs): a katalógus minden párjára ugyanazt a {@link PatternGate}-et
 * futtatja, amit az éjszakai {@code PatternDetectionService} — de semmit nem ír. A szériákat
 * metrikánként EGYSZER kéri le egy kérés-szintű cache-be, így a pár-verdiktek és a
 * metrika-lefedettség garantáltan ugyanabból a pillanatképből származnak.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class PatternMonitorService {

    static final String VERDICT_LIVE = "live";
    static final String VERDICT_FEW_DAYS = "few_days";
    static final String VERDICT_NO_DATA = "no_data";
    static final String VERDICT_DEGENERATE = "degenerate";
    static final String VERDICT_FROZEN = "frozen";

    private static final Set<String> FROZEN_STATUSES =
            Set.of(PatternEntity.STATUS_CONFIRMED, PatternEntity.STATUS_REJECTED);

    private final MetricSeriesService metricSeriesService;
    private final PatternRepository patternRepository;
    private final CompanionProperties properties;

    @Transactional(readOnly = true)
    public PatternMonitorResponse monitor(UUID userId) {
        CompanionProperties.Patterns config = properties.patterns();
        LocalDate to = LocalDate.now().minusDays(1);
        LocalDate from = to.minusDays(config.lookbackDays() - 1L);
        int maxLag = config.pairs().stream()
                .mapToInt(CompanionProperties.PatternPair::lagDays).max().orElse(0);

        Map<MetricKey, Map<LocalDate, Double>> cache = new EnumMap<>(MetricKey.class);
        for (MetricKey metric : MetricKey.values()) {
            cache.put(metric, metricSeriesService.series(userId, metric, from, to.plusDays(maxLag)));
        }
        Map<String, PatternEntity> rows = statisticalRowsByPairKey(userId);

        List<PatternMonitorPair> pairs = new ArrayList<>();
        for (CompanionProperties.PatternPair pair : config.pairs()) {
            pairs.add(toPair(pair, cache, rows.get(pair.key()), config.minN(), from, to));
        }

        return PatternMonitorResponse.builder()
                .windowFrom(from)
                .windowTo(to)
                .lookbackDays(config.lookbackDays())
                .minN(config.minN())
                .cron(config.cron())
                .lastRunAt(lastRunAt(rows))
                .pairs(pairs)
                .metrics(coverage(cache, config.pairs(), from, to, config.lookbackDays()))
                .build();
    }

    private Map<String, PatternEntity> statisticalRowsByPairKey(UUID userId) {
        Map<String, PatternEntity> rows = new LinkedHashMap<>();
        for (PatternEntity row : patternRepository
                .findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(userId)) {
            if (PatternEntity.KIND_STATISTICAL.equals(row.getKind())) {
                rows.putIfAbsent(row.getPairKey(), row); // a legfrissebb detektálás nyer
            }
        }
        return rows;
    }

    private OffsetDateTime lastRunAt(Map<String, PatternEntity> rows) {
        Instant latest = rows.values().stream()
                .map(PatternEntity::getLastDetectedAt)
                .filter(java.util.Objects::nonNull)
                .max(Comparator.naturalOrder())
                .orElse(null);
        return latest == null ? null : latest.atOffset(ZoneOffset.UTC);
    }

    private PatternMonitorPair toPair(CompanionProperties.PatternPair pair,
                                      Map<MetricKey, Map<LocalDate, Double>> cache,
                                      PatternEntity row, int minN, LocalDate from, LocalDate to) {
        PatternMonitorPair.PatternMonitorPairBuilder builder = PatternMonitorPair.builder()
                .key(pair.key())
                .title(pair.title())
                .category(pair.category())
                .categoryLabel(pair.label())
                .lagDays(pair.lagDays())
                .metricAKey(pair.metricA().wireKey())
                .metricALabel(pair.metricA().labelHu())
                .metricBKey(pair.metricB().wireKey())
                .metricBLabel(pair.metricB().labelHu());

        if (row != null && FROZEN_STATUSES.contains(row.getStatus())) {
            // A user megítélte EZT a korrelációt — a job nem nyúl hozzá, így mi sem számolunk újra.
            return builder.verdict(VERDICT_FROZEN)
                    .status(row.getStatus())
                    .alignedDays(row.getN() == null ? 0 : row.getN())
                    .n(row.getN())
                    .r(row.getR() == null ? null : row.getR().doubleValue())
                    .p(row.getP() == null ? null : row.getP().doubleValue())
                    .build();
        }

        // Pontosan a job ablakai: A a [from,to]-n, B lagDays-szel eltolva.
        Map<LocalDate, Double> seriesA = window(cache.get(pair.metricA()), from, to);
        Map<LocalDate, Double> seriesB = window(cache.get(pair.metricB()),
                from.plusDays(pair.lagDays()), to.plusDays(pair.lagDays()));
        PatternGate.Outcome outcome = PatternGate.evaluate(seriesA, seriesB, pair.lagDays(), minN);
        builder.alignedDays(outcome.alignedDays());

        switch (outcome.verdict()) {
            case LIVE -> builder.verdict(VERDICT_LIVE)
                    .r(outcome.result().r())
                    .n(outcome.result().n())
                    .p(outcome.result().p());
            case FEW_DAYS -> builder.verdict(VERDICT_FEW_DAYS)
                    .missingDays(minN - outcome.alignedDays())
                    .bottleneckMetricKey(thinnerMetric(pair, cache, from, to).wireKey());
            case NO_DATA -> builder.verdict(VERDICT_NO_DATA)
                    .bottleneckMetricKey(thinnerMetric(pair, cache, from, to).wireKey());
            case DEGENERATE -> builder.verdict(VERDICT_DEGENERATE)
                    .bottleneckMetricKey(constantMetric(pair, outcome.constantSide()).wireKey());
        }
        return builder.build();
    }

    /** A pár kevesebb lefedett nappal rendelkező metrikája (döntetlen → A) — a „mit logolj" alanya. */
    private MetricKey thinnerMetric(CompanionProperties.PatternPair pair,
                                    Map<MetricKey, Map<LocalDate, Double>> cache,
                                    LocalDate from, LocalDate to) {
        int a = window(cache.get(pair.metricA()), from, to).size();
        int b = window(cache.get(pair.metricB()), from, to).size();
        return b < a ? pair.metricB() : pair.metricA();
    }

    private MetricKey constantMetric(CompanionProperties.PatternPair pair, PatternGate.Side side) {
        return side == PatternGate.Side.B ? pair.metricB() : pair.metricA();
    }

    private List<PatternMetricCoverage> coverage(Map<MetricKey, Map<LocalDate, Double>> cache,
                                                 List<CompanionProperties.PatternPair> pairs,
                                                 LocalDate from, LocalDate to, int lookbackDays) {
        Map<MetricKey, Integer> pairCounts = new EnumMap<>(MetricKey.class);
        for (CompanionProperties.PatternPair pair : pairs) {
            pairCounts.merge(pair.metricA(), 1, Integer::sum);
            pairCounts.merge(pair.metricB(), 1, Integer::sum);
        }
        List<PatternMetricCoverage> out = new ArrayList<>();
        for (MetricKey metric : MetricKey.values()) {
            Map<LocalDate, Double> windowed = window(cache.get(metric), from, to);
            out.add(PatternMetricCoverage.builder()
                    .key(metric.wireKey())
                    .label(metric.labelHu())
                    .coveredDays(windowed.size())
                    .windowDays(lookbackDays)
                    .lastDayWithData(windowed.keySet().stream().max(Comparator.naturalOrder()).orElse(null))
                    .pairCount(pairCounts.getOrDefault(metric, 0))
                    .build());
        }
        return out;
    }

    /** A cache egyetlen uniós ablakot tart — a kapunak a job PONTOS ablakát kell látnia. */
    private Map<LocalDate, Double> window(Map<LocalDate, Double> series, LocalDate from, LocalDate to) {
        Map<LocalDate, Double> out = new LinkedHashMap<>();
        series.forEach((day, value) -> {
            if (!day.isBefore(from) && !day.isAfter(to)) {
                out.put(day, value);
            }
        });
        return out;
    }
}
```

- [ ] **Step 5: Implementáld a controller-metódust**

`CompanionController.java` — import: `io.mrkuhne.mezo.api.dto.PatternMonitorResponse` és `io.mrkuhne.mezo.feature.companion.service.PatternMonitorService`; új mező `private final PatternMonitorService patternMonitorService;` (a `patternService` alá); és a `decidePattern` metódus után:

```java
    @Override
    public PatternMonitorResponse patternMonitor() {
        return patternMonitorService.monitor(currentUserId.get());
    }
```

- [ ] **Step 6: Fordulnia kell**

```bash
cd backend && ./mvnw clean compile
```

Elvárt: BUILD SUCCESS.

- [ ] **Step 7: Írd meg az integrációs teszteket**

`backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPatternMonitorApiIT.java`:

```java
package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.api.dto.PatternMetricCoverage;
import io.mrkuhne.mezo.api.dto.PatternMonitorPair;
import io.mrkuhne.mezo.api.dto.PatternMonitorResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.service.PatternDetectionService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Az élő kapu-diagnosztika HTTP-kontraktusa (mezo-viqs) — verdiktek, szűk keresztmetszet,
 * lefedettség, és a lényegi ígéret: amit a monitor „live"-nak mond, azt a job perzisztálja is.
 */
@ActiveProfiles("companion-fake")
class CompanionPatternMonitorApiIT extends ApiIntegrationTest {

    private static final String STRESS_SLEEP_PAIR = "checkin-stress~sleep-quality";

    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private PatternDetectionService patternDetectionService;
    @Autowired private UserPopulator userPopulator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    private PatternMonitorResponse monitor() {
        return getForBody("/api/companion/pattern/monitor", ownerAuthHeaders(),
                HttpStatus.OK, PatternMonitorResponse.class);
    }

    private static PatternMonitorPair pair(PatternMonitorResponse response, String key) {
        return response.getPairs().stream().filter(p -> key.equals(p.getKey())).findFirst().orElseThrow();
    }

    private static PatternMetricCoverage metric(PatternMonitorResponse response, String key) {
        return response.getMetrics().stream().filter(m -> key.equals(m.getKey())).findFirst().orElseThrow();
    }

    /** Aznapi stressz + alvásminőség N napra visszamenőleg (lag=0 pár), változó értékekkel. */
    private void seedStressAndSleep(UUID owner, int days) {
        LocalDate to = LocalDate.now().minusDays(1);
        for (int i = 0; i < days; i++) {
            LocalDate day = to.minusDays(i);
            checkInPopulator.createCheckIn(owner, day, "08:00", 1 + i % 5, 3, null);
            sleepLogPopulator.createSleepLog(owner, day, new BigDecimal("7.0"), 1 + (i * 2) % 5);
        }
    }

    @Test
    void testPatternMonitor_shouldEchoWindowAndConfig_whenNoDataAtAll() {
        PatternMonitorResponse response = monitor();

        assertThat(response.getLookbackDays()).isEqualTo(60);
        assertThat(response.getMinN()).isEqualTo(8);
        assertThat(response.getCron()).isNotBlank();
        assertThat(response.getWindowTo()).isEqualTo(LocalDate.now().minusDays(1));
        assertThat(response.getWindowFrom()).isEqualTo(response.getWindowTo().minusDays(59));
        assertThat(response.getLastRunAt()).isNull();
        assertThat(response.getPairs()).hasSize(8);
        assertThat(response.getMetrics()).hasSize(12);
        assertThat(response.getPairs()).allSatisfy(p -> assertThat(p.getVerdict()).isEqualTo("no_data"));
    }

    @Test
    void testPatternMonitor_shouldReturnFewDaysWithMissingCount_whenBelowMinN() {
        seedStressAndSleep(ownerId(), 5);

        PatternMonitorPair pair = pair(monitor(), STRESS_SLEEP_PAIR);

        assertThat(pair.getVerdict()).isEqualTo("few_days");
        assertThat(pair.getAlignedDays()).isEqualTo(5);
        assertThat(pair.getMissingDays()).isEqualTo(3);
        assertThat(pair.getBottleneckMetricKey()).isNotBlank();
        assertThat(pair.getR()).isNull();
    }

    @Test
    void testPatternMonitor_shouldReturnLiveWithStats_whenMinNReached() {
        seedStressAndSleep(ownerId(), 10);

        PatternMonitorPair pair = pair(monitor(), STRESS_SLEEP_PAIR);

        assertThat(pair.getVerdict()).isEqualTo("live");
        assertThat(pair.getAlignedDays()).isEqualTo(10);
        assertThat(pair.getN()).isEqualTo(10);
        assertThat(pair.getR()).isNotNull();
        assertThat(pair.getP()).isNotNull();
        assertThat(pair.getMissingDays()).isNull();
    }

    @Test
    void testPatternMonitor_shouldAgreeWithTheNightlyJob_whenVerdictIsLive() {
        seedStressAndSleep(ownerId(), 10);
        PatternMonitorResponse before = monitor();

        patternDetectionService.detect(ownerId());
        PatternMonitorResponse after = monitor();

        // amit a monitor live-nak mondott, arra a job írt sort (a frozen ág nem érinti)
        assertThat(pair(before, STRESS_SLEEP_PAIR).getVerdict()).isEqualTo("live");
        assertThat(pair(after, STRESS_SLEEP_PAIR).getVerdict()).isEqualTo("live");
        assertThat(after.getLastRunAt()).isNotNull();
        // amit few_days-nek, arra nem
        assertThat(pair(after, "reta-cycle-day~daily-kcal").getVerdict()).isEqualTo("no_data");
    }

    @Test
    void testPatternMonitor_shouldReturnFrozenWithJudgedStats_whenUserDecided() {
        patternPopulator.statistical(ownerId(), STRESS_SLEEP_PAIR, PatternEntity.STATUS_CONFIRMED);
        seedStressAndSleep(ownerId(), 10);

        PatternMonitorPair pair = pair(monitor(), STRESS_SLEEP_PAIR);

        assertThat(pair.getVerdict()).isEqualTo("frozen");
        assertThat(pair.getStatus()).isEqualTo("confirmed");
        assertThat(pair.getN()).isEqualTo(12); // a populátor befagyasztott n-je, NEM a 10 élő nap
        assertThat(pair.getR()).isCloseTo(-0.55, within(1e-6));
    }

    @Test
    void testPatternMonitor_shouldCountCoveragePerMetric_whenDaysLogged() {
        seedStressAndSleep(ownerId(), 6);

        PatternMonitorResponse response = monitor();

        PatternMetricCoverage stress = metric(response, "checkin-stress");
        assertThat(stress.getLabel()).isEqualTo("stressz-szint");
        assertThat(stress.getCoveredDays()).isEqualTo(6);
        assertThat(stress.getWindowDays()).isEqualTo(60);
        assertThat(stress.getLastDayWithData()).isEqualTo(LocalDate.now().minusDays(1));
        assertThat(stress.getPairCount()).isEqualTo(1);
        assertThat(metric(response, "daily-kcal").getCoveredDays()).isZero();
        assertThat(metric(response, "daily-kcal").getLastDayWithData()).isNull();
    }

    @Test
    void testPatternMonitor_shouldIgnoreForeignRows_whenAnotherUserHasPatterns() {
        // egy IDEGEN user befagyasztott sora ugyanarra a pár-kulcsra
        patternPopulator.statistical(userPopulator.createUser().getId(),
                STRESS_SLEEP_PAIR, PatternEntity.STATUS_CONFIRMED);
        seedStressAndSleep(ownerId(), 10);

        PatternMonitorResponse response = monitor();

        assertThat(pair(response, STRESS_SLEEP_PAIR).getVerdict()).isEqualTo("live"); // nem frozen
        assertThat(response.getLastRunAt()).isNull(); // az idegen sor nem szivárog be
    }
}
```

`backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPatternMonitorSwitchOffIT.java`:

```java
package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.service.PatternMonitorService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.TestPropertySource;

/** Companion switch off ⇒ a monitor bean nem létezik (a végpont 404 — a FE degraded ága). */
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class CompanionPatternMonitorSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;

    @Test
    void testContext_shouldHaveNoMonitorBean_whenCompanionSwitchOff() {
        assertThat(context.getBeanProvider(PatternMonitorService.class).getIfAvailable()).isNull();
    }
}
```

**Megjegyzés a switch-off IThez:** a `@ActiveProfiles` / `@TestPropertySource` annotációkat **másold 1:1 a meglévő `CompanionSwitchOffIT`-ből** — az a kanonikus minta a companion switch kikapcsolására, és a property pontos neve a `FeaturesConfiguration.COMPANION_SWITCH` konstansban áll. Ne találd ki a kulcsot.

- [ ] **Step 8: Futtasd az ITeket**

```bash
cd backend && ./mvnw clean test -Dtest='CompanionPatternMonitorApiIT,CompanionPatternMonitorSwitchOffIT'
```

Elvárt: PASS. Ha a `seedStressAndSleep` által vetett napokra a `checkin-stress` és a `sleep-quality` értékek véletlenül konstansok lennének, a verdikt `degenerate` lenne — a fenti `1 + i % 5` / `1 + (i * 2) % 5` képletek szándékosan változó értékeket adnak.

- [ ] **Step 9: A teljes companion-suite is maradjon zöld**

```bash
cd backend && ./mvnw clean test -Dtest='Companion*,Pattern*,MetricSeriesServiceIT'
```

- [ ] **Step 10: Commit**

```bash
git add api/ backend/ frontend/src/data/_client/api.gen.ts && git commit -m "feat(companion): élő kapu-diagnosztika végpont (mezo-viqs)"
```

---

## Task 3: FE adatréteg — típusok, API, hook, mock seed

**Files:**
- Modify: `frontend/src/data/types.ts`
- Create: `frontend/src/data/insights/monitorApi.ts`
- Create: `frontend/src/data/insights/monitorHooks.ts`
- Modify: `frontend/src/data/insights/insights.ts`
- Modify: `frontend/src/data/hooks.ts`
- Modify: `frontend/src/test/msw/handlers.ts`
- Test: `frontend/src/data/insights/monitorHooks.test.tsx`

**Interfaces:**
- Consumes: a Task 2-ben generált `components['schemas']['PatternMonitorResponse' | 'PatternMonitorPair' | 'PatternMetricCoverage']` az `@/data/_client/api.gen`-ből · `apiFetch` (`@/data/_client/api`) · `ApiError` · `useDualQuery` (`@/data/useDualQuery`).
- Produces: `usePatternMonitor() → { monitor: PatternMonitor | null, degraded: boolean, mode: 'mock' | 'live', isPending: boolean }` a `@/data/hooks` barrelből · a `PatternMonitor`, `PatternMonitorPair`, `PatternMetricCoverage`, `PatternGateVerdict` domain típusok a `@/data/types`-ból · `patternMonitor` mock seed a `@/data/insights/insights`-ból.

- [ ] **Step 1: Domain típusok**

`frontend/src/data/types.ts` — a `Pattern` típus közelébe:

```ts
export type PatternGateVerdict = 'live' | 'few_days' | 'no_data' | 'degenerate' | 'frozen'

export interface PatternMonitorPair {
  key: string
  title: string
  category: PatternCategory
  categoryLabel: string
  lagDays: number
  metricAKey: string
  metricALabel: string
  metricBKey: string
  metricBLabel: string
  verdict: PatternGateVerdict
  alignedDays: number
  missingDays: number | null
  bottleneckMetricKey: string | null
  r: number | null
  n: number | null
  p: number | null
  status: 'confirmed' | 'rejected' | null
}

export interface PatternMetricCoverage {
  key: string
  label: string
  coveredDays: number
  windowDays: number
  lastDayWithData: string | null
  pairCount: number
}

export interface PatternMonitor {
  windowFrom: string
  windowTo: string
  lookbackDays: number
  minN: number
  cron: string
  lastRunAt: string | null
  pairs: PatternMonitorPair[]
  metrics: PatternMetricCoverage[]
}
```

- [ ] **Step 2: Írd meg a bukó hook-tesztet**

`frontend/src/data/insights/monitorHooks.test.tsx`:

```tsx
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { usePatternMonitor } from '@/data/insights/monitorHooks'
import { API_BASE } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'

const wire = {
  windowFrom: '2026-06-13',
  windowTo: '2026-08-10',
  lookbackDays: 60,
  minN: 8,
  cron: '0 40 2 * * *',
  lastRunAt: '2026-08-11T00:40:00Z',
  pairs: [
    {
      key: 'checkin-stress~sleep-quality',
      title: 'Stressz-szint ↔ aznapi alvásminőség',
      category: 'trigger',
      categoryLabel: 'Trigger',
      lagDays: 0,
      metricAKey: 'checkin-stress',
      metricALabel: 'stressz-szint',
      metricBKey: 'sleep-quality',
      metricBLabel: 'alvásminőség',
      verdict: 'few_days',
      alignedDays: 5,
      missingDays: 3,
      bottleneckMetricKey: 'checkin-stress',
    },
  ],
  metrics: [
    { key: 'checkin-stress', label: 'stressz-szint', coveredDays: 5, windowDays: 60, pairCount: 1 },
  ],
}

describe('usePatternMonitor (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('normalizes absent optional wire fields to null', async () => {
    server.use(http.get(`${API_BASE}/api/companion/pattern/monitor`, () => HttpResponse.json(wire)))
    const { result } = renderHook(() => usePatternMonitor(), { wrapper: makeHookWrapper() })

    await waitFor(() => expect(result.current.monitor).not.toBeNull())
    const pair = result.current.monitor!.pairs[0]
    expect(pair.verdict).toBe('few_days')
    expect(pair.missingDays).toBe(3)
    expect(pair.r).toBeNull()
    expect(pair.status).toBeNull()
    expect(result.current.monitor!.metrics[0].lastDayWithData).toBeNull()
    expect(result.current.degraded).toBe(false)
    expect(result.current.mode).toBe('live')
  })

  test('flags degraded on a 404 (companion switch off)', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/pattern/monitor`, () => new HttpResponse(null, { status: 404 })),
    )
    const { result } = renderHook(() => usePatternMonitor(), { wrapper: makeHookWrapper() })

    await waitFor(() => expect(result.current.degraded).toBe(true))
    expect(result.current.monitor).toBeNull()
  })
})

describe('usePatternMonitor (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('returns the mixed-verdict seed synchronously', () => {
    const { result } = renderHook(() => usePatternMonitor(), { wrapper: makeHookWrapper() })

    expect(result.current.mode).toBe('mock')
    expect(result.current.monitor!.pairs).toHaveLength(8)
    const verdicts = new Set(result.current.monitor!.pairs.map((p) => p.verdict))
    expect(verdicts).toEqual(new Set(['live', 'few_days', 'no_data', 'degenerate', 'frozen']))
    expect(result.current.monitor!.metrics).toHaveLength(12)
  })
})
```

- [ ] **Step 3: Futtasd — bukjon**

```bash
cd frontend && pnpm test src/data/insights/monitorHooks.test.tsx
```

Elvárt: FAIL — `Failed to resolve import "@/data/insights/monitorHooks"`.

- [ ] **Step 4: API-réteg**

`frontend/src/data/insights/monitorApi.ts`:

```ts
import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type {
  PatternCategory,
  PatternGateVerdict,
  PatternMetricCoverage,
  PatternMonitor,
  PatternMonitorPair,
} from '@/data/types'

export type PatternMonitorResponse = components['schemas']['PatternMonitorResponse']
type PairWire = components['schemas']['PatternMonitorPair']
type MetricWire = components['schemas']['PatternMetricCoverage']

const MONITOR = '/api/companion/pattern/monitor'

/** Wire → FE domain: a hiányzó opcionális mezők egységesen `null`-ra normalizálódnak. */
function toPair(w: PairWire): PatternMonitorPair {
  return {
    key: w.key,
    title: w.title,
    // a wire stringek a saját backendünk CHECK/pattern kényszereiből jönnek
    category: w.category as PatternCategory,
    categoryLabel: w.categoryLabel,
    lagDays: w.lagDays,
    metricAKey: w.metricAKey,
    metricALabel: w.metricALabel,
    metricBKey: w.metricBKey,
    metricBLabel: w.metricBLabel,
    verdict: w.verdict as PatternGateVerdict,
    alignedDays: w.alignedDays,
    missingDays: w.missingDays ?? null,
    bottleneckMetricKey: w.bottleneckMetricKey ?? null,
    r: w.r ?? null,
    n: w.n ?? null,
    p: w.p ?? null,
    status: (w.status ?? null) as PatternMonitorPair['status'],
  }
}

function toMetric(w: MetricWire): PatternMetricCoverage {
  return {
    key: w.key,
    label: w.label,
    coveredDays: w.coveredDays,
    windowDays: w.windowDays,
    lastDayWithData: w.lastDayWithData ?? null,
    pairCount: w.pairCount,
  }
}

export function toMonitor(w: PatternMonitorResponse): PatternMonitor {
  return {
    windowFrom: w.windowFrom,
    windowTo: w.windowTo,
    lookbackDays: w.lookbackDays,
    minN: w.minN,
    cron: w.cron,
    lastRunAt: w.lastRunAt ?? null,
    pairs: w.pairs.map(toPair),
    metrics: w.metrics.map(toMetric),
  }
}

export const monitorApi = {
  get: async () => toMonitor(await apiFetch<PatternMonitorResponse>(MONITOR)),
}
```

- [ ] **Step 5: A hook**

`frontend/src/data/insights/monitorHooks.ts`:

```ts
import { ApiError } from '@/data/_client/api'
import { useDualQuery } from '@/data/useDualQuery'
import { monitorApi } from '@/data/insights/monitorApi'
import { patternMonitor as mockMonitor } from '@/data/insights/insights'
import type { PatternMonitor } from '@/data/types'

const MONITOR_KEY = ['pattern-monitor']

export interface PatternMonitorBootstrap {
  monitor: PatternMonitor | null
  degraded: boolean
  mode: 'mock' | 'live'
}

const MOCK: PatternMonitorBootstrap = { monitor: mockMonitor, degraded: false, mode: 'mock' }
const EMPTY: PatternMonitorBootstrap = { monitor: null, degraded: false, mode: 'live' }

/** Élő kapu-diagnosztika (mezo-viqs) — a companion switch kikapcsolva 404 ⇒ degraded. */
export function usePatternMonitor() {
  const { data, isPending } = useDualQuery<PatternMonitorBootstrap>({
    queryKey: MONITOR_KEY,
    mockData: MOCK,
    realFetch: async () => {
      try {
        return { monitor: await monitorApi.get(), degraded: false, mode: 'live' as const }
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return { ...EMPTY, degraded: true }
        throw e
      }
    },
    realEmpty: EMPTY,
  })
  return { ...data, isPending }
}
```

- [ ] **Step 6: Mock seed**

`frontend/src/data/insights/insights.ts` — a fájl végére (a `PatternMonitor` típust importáld a meglévő `@/data/types` importba):

```ts
/** A monitor demo-pillanatképe (mezo-viqs) — mind az 5 verdikt látszik a 8 katalógus-páron. */
export const patternMonitor: PatternMonitor = {
  windowFrom: '2026-06-13',
  windowTo: '2026-08-10',
  lookbackDays: 60,
  minN: 8,
  cron: '0 40 2 * * *',
  lastRunAt: '2026-08-11T00:40:00Z',
  pairs: [
    {
      key: 'sleep-quality~next-day-training-rpe',
      title: 'Alvásminőség ↔ másnapi edzés-RPE',
      category: 'physiology', categoryLabel: 'Fiziológia', lagDays: 1,
      metricAKey: 'sleep-quality', metricALabel: 'alvásminőség',
      metricBKey: 'training-rpe', metricBLabel: 'edzés-RPE',
      verdict: 'live', alignedDays: 21, missingDays: null, bottleneckMetricKey: null,
      r: -0.42, n: 21, p: 0.058, status: null,
    },
    {
      key: 'checkin-stress~sleep-quality',
      title: 'Stressz-szint ↔ aznapi alvásminőség',
      category: 'trigger', categoryLabel: 'Trigger', lagDays: 0,
      metricAKey: 'checkin-stress', metricALabel: 'stressz-szint',
      metricBKey: 'sleep-quality', metricBLabel: 'alvásminőség',
      verdict: 'live', alignedDays: 34, missingDays: null, bottleneckMetricKey: null,
      r: -0.61, n: 34, p: 0.001, status: null,
    },
    {
      key: 'sleep-duration~next-day-training-rpe',
      title: 'Alváshossz ↔ másnapi edzés-RPE',
      category: 'physiology', categoryLabel: 'Fiziológia', lagDays: 1,
      metricAKey: 'sleep-duration-h', metricALabel: 'alváshossz',
      metricBKey: 'training-rpe', metricBLabel: 'edzés-RPE',
      verdict: 'few_days', alignedDays: 6, missingDays: 2, bottleneckMetricKey: 'training-rpe',
      r: null, n: null, p: null, status: null,
    },
    {
      key: 'late-meal~next-sleep-quality',
      title: 'Késői étkezés ↔ rákövetkező alvásminőség',
      category: 'trigger', categoryLabel: 'Trigger', lagDays: 1,
      metricAKey: 'late-meal-hour', metricALabel: 'utolsó étkezés ideje',
      metricBKey: 'sleep-quality', metricBLabel: 'alvásminőség',
      verdict: 'few_days', alignedDays: 7, missingDays: 1, bottleneckMetricKey: 'late-meal-hour',
      r: null, n: null, p: null, status: null,
    },
    {
      key: 'daily-kcal~next-morning-weight-delta',
      title: 'Napi kalória ↔ másnap reggeli súlyváltozás',
      category: 'response', categoryLabel: 'Response', lagDays: 1,
      metricAKey: 'daily-kcal', metricALabel: 'napi kalória',
      metricBKey: 'weight-delta-kg', metricBLabel: 'reggeli súlyváltozás',
      verdict: 'few_days', alignedDays: 3, missingDays: 5, bottleneckMetricKey: 'weight-delta-kg',
      r: null, n: null, p: null, status: null,
    },
    {
      key: 'sport-load~next-day-gym-volume',
      title: 'Sportterhelés ↔ másnapi gym-volumen',
      category: 'response', categoryLabel: 'Response', lagDays: 1,
      metricAKey: 'sport-load-min', metricALabel: 'sportterhelés',
      metricBKey: 'gym-volume-kg', metricBLabel: 'gym-volumen',
      verdict: 'no_data', alignedDays: 0, missingDays: null, bottleneckMetricKey: 'sport-load-min',
      r: null, n: null, p: null, status: null,
    },
    {
      key: 'daily-water~checkin-energy',
      title: 'Vízbevitel ↔ energia-szint',
      category: 'physiology', categoryLabel: 'Fiziológia', lagDays: 0,
      metricAKey: 'daily-water-ml', metricALabel: 'vízbevitel',
      metricBKey: 'checkin-energy', metricBLabel: 'energia-szint',
      verdict: 'degenerate', alignedDays: 19, missingDays: null, bottleneckMetricKey: 'daily-water-ml',
      r: null, n: null, p: null, status: null,
    },
    {
      key: 'reta-cycle-day~daily-kcal',
      title: 'Reta-ciklusnap ↔ napi kalória',
      category: 'physiology', categoryLabel: 'Fiziológia', lagDays: 0,
      metricAKey: 'reta-cycle-day', metricALabel: 'Reta-ciklusnap',
      metricBKey: 'daily-kcal', metricBLabel: 'napi kalória',
      verdict: 'frozen', alignedDays: 28, missingDays: null, bottleneckMetricKey: null,
      r: 0.55, n: 28, p: 0.002, status: 'confirmed',
    },
  ],
  metrics: [
    { key: 'sport-load-min', label: 'sportterhelés', coveredDays: 0, windowDays: 60, lastDayWithData: null, pairCount: 1 },
    { key: 'gym-volume-kg', label: 'gym-volumen', coveredDays: 4, windowDays: 60, lastDayWithData: '2026-07-02', pairCount: 1 },
    { key: 'weight-delta-kg', label: 'reggeli súlyváltozás', coveredDays: 9, windowDays: 60, lastDayWithData: '2026-08-06', pairCount: 1 },
    { key: 'training-rpe', label: 'edzés-RPE', coveredDays: 12, windowDays: 60, lastDayWithData: '2026-08-09', pairCount: 2 },
    { key: 'late-meal-hour', label: 'utolsó étkezés ideje', coveredDays: 16, windowDays: 60, lastDayWithData: '2026-08-10', pairCount: 1 },
    { key: 'daily-water-ml', label: 'vízbevitel', coveredDays: 19, windowDays: 60, lastDayWithData: '2026-08-10', pairCount: 1 },
    { key: 'sleep-duration-h', label: 'alváshossz', coveredDays: 22, windowDays: 60, lastDayWithData: '2026-08-10', pairCount: 1 },
    { key: 'daily-kcal', label: 'napi kalória', coveredDays: 27, windowDays: 60, lastDayWithData: '2026-08-10', pairCount: 2 },
    { key: 'reta-cycle-day', label: 'Reta-ciklusnap', coveredDays: 28, windowDays: 60, lastDayWithData: '2026-08-10', pairCount: 1 },
    { key: 'checkin-energy', label: 'energia-szint', coveredDays: 34, windowDays: 60, lastDayWithData: '2026-08-10', pairCount: 1 },
    { key: 'checkin-stress', label: 'stressz-szint', coveredDays: 34, windowDays: 60, lastDayWithData: '2026-08-10', pairCount: 1 },
    { key: 'sleep-quality', label: 'alvásminőség', coveredDays: 58, windowDays: 60, lastDayWithData: '2026-08-10', pairCount: 3 },
  ],
}
```

- [ ] **Step 7: Barrel + MSW default handler**

`frontend/src/data/hooks.ts` — a `usePatterns` sor alá:

```ts
export { usePatternMonitor } from '@/data/insights/monitorHooks'
```

`frontend/src/test/msw/handlers.ts` — a `GET /api/companion/pattern` handler mellé (üres, de séma-helyes default, hogy a többi teszt ne fusson hálózati hibára):

```ts
  http.get(`${API_BASE}/api/companion/pattern/monitor`, () =>
    HttpResponse.json({
      windowFrom: '2026-06-13',
      windowTo: '2026-08-10',
      lookbackDays: 60,
      minN: 8,
      cron: '0 40 2 * * *',
      lastRunAt: null,
      pairs: [],
      metrics: [],
    }),
  ),
```

Az MSW pontos útvonalra illeszt, így a `/api/companion/pattern` handlerrel nincs ütközés — tedd közvetlenül mellé, a fájl meglévő csoportosítását követve.

- [ ] **Step 8: Futtasd a hook-teszteket mindkét módban**

```bash
cd frontend && pnpm test src/data/insights/monitorHooks.test.tsx && VITE_USE_MOCK=true pnpm test src/data/insights/monitorHooks.test.tsx
```

Elvárt: PASS.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/data frontend/src/test && git commit -m "feat(insights): monitor adatréteg — hook, mapping, mock seed (mezo-viqs)"
```

---

## Task 4: FE oldal — `MotorPage`, komponensek, navigáció

**Files:**
- Create: `frontend/src/features/insights/components/GateVerdictRow.tsx`
- Create: `frontend/src/features/insights/components/MetricCoverageRow.tsx`
- Create: `frontend/src/features/insights/pages/MotorPage.tsx`
- Modify: `frontend/src/features/insights/pages/tabs.ts`
- Modify: `frontend/src/app/router.tsx`
- Modify: `frontend/src/features/insights/pages/PatternsPage.tsx`
- Test: `frontend/src/features/insights/pages/MotorPage.test.tsx`
- Test: `frontend/src/features/insights/pages/insights.nav.test.tsx` (kiegészítés)

**Interfaces:**
- Consumes: `usePatternMonitor()` a `@/data/hooks`-ból (Task 3) · `PatternMonitorPair` / `PatternMetricCoverage` / `PatternGateVerdict` a `@/data/types`-ból.
- Produces: `/insights/motor` route · `MotorPage` · `GateVerdictRow({ pair }: { pair: PatternMonitorPair })` · `MetricCoverageRow({ metric }: { metric: PatternMetricCoverage })`.

- [ ] **Step 1: Írd meg a bukó oldal-tesztet**

`frontend/src/features/insights/pages/MotorPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { MotorPage } from '@/features/insights/pages/MotorPage'

const renderPage = () =>
  render(
    <MemoryRouter>
      <MotorPage />
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

describe('MotorPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the engine-state header with the window, the gate and the raw cron', () => {
    renderPage()
    expect(screen.getByText('2026-06-13 – 2026-08-10')).toBeInTheDocument()
    expect(screen.getByText('60 nap')).toBeInTheDocument()
    expect(screen.getByText('min. 8 illeszkedő nap')).toBeInTheDocument()
    expect(screen.getByText('0 40 2 * * *')).toBeInTheDocument()
  })

  test('renders every verdict with its honest derived sentence', () => {
    renderPage()
    expect(screen.getAllByText('él')).toHaveLength(2)
    expect(screen.getByText('Még 2 illeszkedő nap kell — a szűk keresztmetszet: edzés-RPE.')).toBeInTheDocument()
    expect(
      screen.getByText('Nincs még illeszkedő nap — a(z) sportterhelés üres ebben az ablakban.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('A(z) vízbevitel nem mozdul az ablakban — így nincs mit korrelálni.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Te ítélted meg (megerősítve) — az éjszakai job nem számolja újra.'),
    ).toBeInTheDocument()
  })

  test('orders pairs live → few_days (fewest missing first) → degenerate → no_data → frozen', () => {
    renderPage()
    const titles = screen.getAllByTestId('gate-pair-title').map((el) => el.textContent)
    expect(titles[0]).toBe('Stressz-szint ↔ aznapi alvásminőség') // live, 34 illesztett nap
    expect(titles[1]).toBe('Alvásminőség ↔ másnapi edzés-RPE') // live, 21 illesztett nap
    expect(titles[2]).toBe('Késői étkezés ↔ rákövetkező alvásminőség') // 1 hiányzó nap
    expect(titles[3]).toBe('Alváshossz ↔ másnapi edzés-RPE') // 2 hiányzó nap
    expect(titles[7]).toBe('Reta-ciklusnap ↔ napi kalória') // frozen a végén
  })

  test('orders the coverage list thinnest-first', () => {
    renderPage()
    const labels = screen.getAllByTestId('coverage-label').map((el) => el.textContent)
    expect(labels[0]).toBe('sportterhelés')
    expect(labels[labels.length - 1]).toBe('alvásminőség')
  })
})

describe('MotorPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders the degraded card on a 404', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/pattern/monitor`, () => new HttpResponse(null, { status: 404 })),
    )
    renderPage()
    expect(await screen.findByText('A minta-motor most nem elérhető.')).toBeInTheDocument()
  })

  test('says the job has never run when lastRunAt is null', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/pattern/monitor`, () =>
        HttpResponse.json({
          windowFrom: '2026-06-13', windowTo: '2026-08-10', lookbackDays: 60, minN: 8,
          cron: '0 40 2 * * *', lastRunAt: null, pairs: [], metrics: [],
        }),
      ),
    )
    renderPage()
    expect(await screen.findByText('még nem futott')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Futtasd — bukjon**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test src/features/insights/pages/MotorPage.test.tsx
```

Elvárt: FAIL — `Failed to resolve import "@/features/insights/pages/MotorPage"`.

- [ ] **Step 3: `GateVerdictRow`**

`frontend/src/features/insights/components/GateVerdictRow.tsx`:

```tsx
import type { PatternGateVerdict, PatternMonitorPair } from '@/data/types'

const VERDICT_LABEL: Record<PatternGateVerdict, string> = {
  live: 'él',
  few_days: 'kevés nap',
  degenerate: 'nem mozdul',
  no_data: 'nincs adat',
  frozen: 'befagyasztva',
}

const VERDICT_COLOR: Record<PatternGateVerdict, string> = {
  live: 'var(--success)',
  few_days: 'var(--warning)',
  degenerate: 'var(--warning)',
  no_data: 'var(--text-tertiary)',
  frozen: 'var(--lav-deep)',
}

/** A szűk keresztmetszet kulcsához tartozó magyar címke a pár saját két metrikájából. */
function bottleneckLabel(pair: PatternMonitorPair): string {
  return pair.bottleneckMetricKey === pair.metricBKey ? pair.metricBLabel : pair.metricALabel
}

/** Egyetlen determinisztikus mondat — sosem állít többet, mint amit a verdikt fed. */
export function verdictSentence(pair: PatternMonitorPair): string {
  switch (pair.verdict) {
    case 'live':
      return `Elég adat van — a motor számolja ezt a párt.`
    case 'few_days':
      return `Még ${pair.missingDays} illeszkedő nap kell — a szűk keresztmetszet: ${bottleneckLabel(pair)}.`
    case 'no_data':
      return `Nincs még illeszkedő nap — a(z) ${bottleneckLabel(pair)} üres ebben az ablakban.`
    case 'degenerate':
      return `A(z) ${bottleneckLabel(pair)} nem mozdul az ablakban — így nincs mit korrelálni.`
    case 'frozen':
      return `Te ítélted meg (${pair.status === 'confirmed' ? 'megerősítve' : 'elvetve'}) — az éjszakai job nem számolja újra.`
  }
}

export function GateVerdictRow({ pair }: { pair: PatternMonitorPair }) {
  const color = VERDICT_COLOR[pair.verdict]
  const lag = pair.lagDays > 0 ? ` · +${pair.lagDays} nap` : ''

  return (
    <div className="card" style={{ padding: 14, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: color }} />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow text-tertiary">{pair.categoryLabel}</span>
        <span
          className="chip"
          style={{ fontSize: 9, padding: '3px 8px', color, borderColor: `${color}59`, background: 'var(--surface-glass)' }}
        >
          {VERDICT_LABEL[pair.verdict]}
        </span>
      </div>

      <div
        data-testid="gate-pair-title"
        style={{ fontFamily: 'var(--ff-display)', fontSize: 15, marginTop: 8, lineHeight: 1.25, color: 'var(--text-primary)' }}
      >
        {pair.title}
      </div>

      <div className="eyebrow text-tertiary" style={{ marginTop: 4 }}>
        {pair.metricALabel} → {pair.metricBLabel}{lag}
      </div>

      <p className="text-secondary" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 8 }}>
        {verdictSentence(pair)}
      </p>

      <div className="row gap-sm" style={{ marginTop: 8, flexWrap: 'wrap' }}>
        <span className="chip" style={{ fontSize: 9 }}>
          {pair.verdict === 'few_days' ? `n=${pair.alignedDays}/${pair.alignedDays + (pair.missingDays ?? 0)}` : `n=${pair.alignedDays} nap`}
        </span>
        {pair.r != null && <span className="chip" style={{ fontSize: 9 }}>r={pair.r.toFixed(2)}</span>}
        {pair.p != null && <span className="chip" style={{ fontSize: 9 }}>p={pair.p.toFixed(3)}</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: `MetricCoverageRow`**

`frontend/src/features/insights/components/MetricCoverageRow.tsx`:

```tsx
import type { PatternMetricCoverage } from '@/data/types'

export function MetricCoverageRow({ metric }: { metric: PatternMetricCoverage }) {
  const ratio = metric.windowDays === 0 ? 0 : metric.coveredDays / metric.windowDays
  const color = ratio >= 0.5 ? 'var(--success)' : ratio > 0 ? 'var(--warning)' : 'var(--text-tertiary)'

  return (
    <div className="col gap-xs">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span data-testid="coverage-label" className="eyebrow" style={{ color: 'var(--text-primary)' }}>
          {metric.label}
        </span>
        <span className="eyebrow text-tertiary">{metric.coveredDays}/{metric.windowDays} nap</span>
      </div>
      <div className="bar">
        <div className="bar-fill" style={{ width: `${ratio * 100}%`, background: color }} />
      </div>
      <span className="eyebrow text-tertiary">
        {metric.lastDayWithData ?? '—'} · {metric.pairCount} párban
      </span>
    </div>
  )
}
```

- [ ] **Step 5: `MotorPage`**

`frontend/src/features/insights/pages/MotorPage.tsx`:

```tsx
import { usePatternMonitor } from '@/data/hooks'
import { GateVerdictRow } from '@/features/insights/components/GateVerdictRow'
import { MetricCoverageRow } from '@/features/insights/components/MetricCoverageRow'
import type { PatternGateVerdict, PatternMonitorPair } from '@/data/types'

/** „Mi van legközelebb az áttöréshez" — ettől cselekvésre váltható az oldal, nem számfal. */
const VERDICT_ORDER: Record<PatternGateVerdict, number> = {
  live: 0,
  few_days: 1,
  degenerate: 2,
  no_data: 3,
  frozen: 4,
}

function comparePairs(a: PatternMonitorPair, b: PatternMonitorPair): number {
  const byVerdict = VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict]
  if (byVerdict !== 0) return byVerdict
  // few_days-en belül: kevesebb hiányzó nap előre; máshol a több illesztett nap előre
  if (a.verdict === 'few_days') return (a.missingDays ?? 0) - (b.missingDays ?? 0)
  return b.alignedDays - a.alignedDays
}

export function MotorPage() {
  const { monitor, degraded } = usePatternMonitor()

  if (degraded) {
    return (
      <div className="card" style={{ padding: 16, textAlign: 'center' }}>
        <p className="text-tertiary" style={{ fontSize: 12 }}>A minta-motor most nem elérhető.</p>
      </div>
    )
  }
  if (!monitor) return null

  const pairs = [...monitor.pairs].sort(comparePairs)
  const metrics = [...monitor.metrics].sort((a, b) => a.coveredDays - b.coveredDays)

  return (
    <div className="col gap-md">
      <div className="card" style={{ padding: 14, background: 'var(--wash-lav)' }}>
        <div className="eyebrow" style={{ color: 'var(--lav-deep)' }}>A motor állapota</div>
        <div className="col gap-xs" style={{ marginTop: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="eyebrow text-tertiary">Ablak</span>
            <span className="eyebrow" style={{ color: 'var(--text-primary)' }}>
              {monitor.windowFrom} – {monitor.windowTo}
            </span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="eyebrow text-tertiary">Hossz</span>
            <span className="eyebrow" style={{ color: 'var(--text-primary)' }}>{monitor.lookbackDays} nap</span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="eyebrow text-tertiary">Kapu</span>
            <span className="eyebrow" style={{ color: 'var(--text-primary)' }}>min. {monitor.minN} illeszkedő nap</span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="eyebrow text-tertiary">Ütemezés</span>
            <span className="eyebrow" style={{ fontFamily: 'var(--ff-mono)', color: 'var(--text-primary)' }}>{monitor.cron}</span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="eyebrow text-tertiary">Utolsó futás</span>
            <span className="eyebrow" style={{ color: 'var(--text-primary)' }}>
              {monitor.lastRunAt ? monitor.lastRunAt.slice(0, 10) : 'még nem futott'}
            </span>
          </div>
        </div>
      </div>

      <span className="eyebrow">Párok · {pairs.length}</span>
      {pairs.map((pair) => (
        <GateVerdictRow key={pair.key} pair={pair} />
      ))}

      <span className="eyebrow mt-md">Metrika-lefedettség</span>
      <div className="card col gap-md" style={{ padding: 14 }}>
        {metrics.map((metric) => (
          <MetricCoverageRow key={metric.key} metric={metric} />
        ))}
      </div>
    </div>
  )
}
```

A `--ff-mono` (`frontend/src/styles/prototype.css:148`, Geist Mono) és a `.eyebrow` / `.chip` / `.bar` / `.bar-fill` / `.card` / `.gap-xs` osztályok mind globálisak — a `.lbl` viszont **csak `.critique-bar` / `.pagerbar` alatt van definiálva**, ezért ebben az oldalban szándékosan nem használjuk.

- [ ] **Step 6: Route + tab + a Minták-linkek**

`frontend/src/features/insights/pages/tabs.ts` — a `INSIGHTS_TABS` tömb végére:

```ts
  { id: 'motor', to: '/insights/motor', label: 'Motor' },
```

`frontend/src/app/router.tsx` — import a többi Insights-oldal mellé:

```ts
import { MotorPage } from '@/features/insights/pages/MotorPage'
```

és az `insights` `children` tömb végére (az `experiments` után):

```tsx
          { path: 'motor', element: <MotorPage /> },
```

`frontend/src/features/insights/pages/PatternsPage.tsx` — import `Link` a `react-router-dom`-ból, és **mindkét** null-state kártyába (a `degraded` ág és az üres lista ág) a `<p>` alá:

```tsx
        <Link to="/insights/motor" style={{ fontSize: 12, color: 'var(--lav-deep)' }}>
          Miért nincs még minta? →
        </Link>
```

- [ ] **Step 7: Egészítsd ki a nav-tesztet**

`frontend/src/features/insights/pages/insights.nav.test.tsx` — a real-módú teszt végére:

```tsx
    // Motor — az átláthatósági al-oldal (mezo-viqs)
    await userEvent.click(screen.getByRole('button', { name: 'Kísérletek' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Motor' }))
    expect(await screen.findByText('A motor állapota')).toBeInTheDocument()
```

- [ ] **Step 8: Futtasd az érintett teszteket mindkét módban**

```bash
cd frontend && pnpm test src/features/insights && VITE_USE_MOCK=true pnpm test src/features/insights
```

Elvárt: PASS.

- [ ] **Step 9: Teljes FE kapu**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

Elvárt: build OK, mindkét mód zöld.

- [ ] **Step 10: Commit**

```bash
git add frontend/src && git commit -m "feat(insights): /insights/motor átláthatósági al-oldal (mezo-viqs)"
```

---

## Task 5: Dokumentáció + záró kapuk

**Files:**
- Modify: `docs/features/insights.md`
- Modify: `docs/features/companion.md`

**Interfaces:**
- Consumes: minden korábbi task kimenete.
- Produces: naprakész living docs + zöld lint.

- [ ] **Step 1: `docs/features/insights.md`**

Írd bele (a meglévő szerkezetbe illesztve, nem külön szekcióként a végére):
- a tab-listába a **8. tab: `Motor` → `/insights/motor`**, azzal, hogy mindkét módban látszik;
- egy bekezdés a `MotorPage`-ről: három blokk (motor-állapot fejléc / pár-verdiktek / metrika-lefedettség), az 5 verdikt jelentése egy mondatban, a rendezési szabály (`live → few_days → degenerate → no_data → frozen`, a lefedettség legvékonyabb elöl), és hogy a számok élő újraszámolásból jönnek, nem perzisztált naplóból;
- a fájltérképbe: `pages/MotorPage.tsx`, `components/GateVerdictRow.tsx`, `components/MetricCoverageRow.tsx`, `data/insights/monitorApi.ts`, `data/insights/monitorHooks.ts`;
- a `PatternsPage` null-state leírásához: az üres és a degraded állapot linkel a Motor oldalra.

- [ ] **Step 2: `docs/features/companion.md`**

- A V3.1 szekcióhoz: a kapu kiemelése `PatternGate`-be, az **5 verdiktes modell**, és hogy a monitor **ugyanazt a kaput** futtatja írás nélkül — ez a diagnosztika hitelességének garanciája.
- Az endpoint-táblába: `GET /api/companion/pattern/monitor` → `PatternMonitorResponse`, `200 · 401`, egysoros leírással.
- Jegyezd fel a spec §3.5-ös megfigyelését: a `lag=1` párok B-szériája a mai (részben logolt) napig olvasódik — a monitor ezt láthatóvá teszi, de nem javítja.

- [ ] **Step 3: Doc-lint**

```bash
node scripts/lint-docs.mjs
```

Elvárt: hibamentes, és az érintett feature-doksik staleness-flagje tiszta.

- [ ] **Step 4: Teljes kapusor**

```bash
cd backend && ./mvnw clean test
```

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

- [ ] **Step 5: Commit + push + self-PR**

```bash
git add docs && git commit -m "docs(insights,companion): minta-motor monitor al-oldal (mezo-viqs)" && git push -u origin HEAD
```

- [ ] **Step 6: PR + CI**

```bash
gh pr create --title "feat(insights): minta-motor monitor al-oldal + élő kapu-diagnosztika (mezo-viqs)" --body "$(cat <<'EOF'
## Mit

`/insights/motor` átláthatósági al-oldal + `GET /api/companion/pattern/monitor` élő kapu-diagnosztika.

A V3.1 minta-motor eddig némán ejtette a kapun át nem jutó párokat. A kapu (`PatternGate`) most közös kód a nightly jobbal és a monitorral, így a diagnosztika nem tud eltérni attól, amit a job döntene.

- 5 verdikt: `live` / `few_days` / `no_data` / `degenerate` / `frozen`
- páronként „mi hiányzik" mondat + szűk keresztmetszet metrika
- 12 metrika lefedettsége a korrelációs ablakban
- nincs új DB-tábla, nincs írás — a végpont read-only

Spec: `docs/superpowers/specs/2026-08-11-pattern-monitor-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Utána: `gh pr checks --watch` — **CI zöld** a merge feltétele.

- [ ] **Step 7: Merge + zárás (csak zöld CI után)**

A `<branch>` helyére a feature-ág neve kerül (`git rev-parse --abbrev-ref HEAD` a merge ELŐTT):

```bash
git checkout main && git pull --rebase && git merge --no-ff <branch> && git push && bd close mezo-viqs
```

```bash
bd dolt push && git status
```

Elvárt: `git status` „up to date with origin".

---

## Self-Review

**Spec-lefedettség:** §2 kapu-modell → Task 1 (`PatternGate` + 5. verdikt a Task 2 `frozen` ágában) · §3.1–3.3 → Task 1–2 · §3.4 controller → Task 2 Step 5 · §3.5 (meghagyott furcsaság) → Task 5 doksi · §4 kontraktus → Task 2 Step 1 · §5.1 route/tab/link → Task 4 Step 6 · §5.2 fájlok → Task 3–4 · §5.3 vegyes mock seed → Task 3 Step 6 · §5.4 anatómia + rendezés + őszinte állapotok → Task 4 Step 3–5 + a tesztek · §6 tesztek → Task 1 Step 1, Task 2 Step 7, Task 3 Step 2, Task 4 Step 1 · §7 doksi → Task 5 · §8 nem-scope → egyik task sem nyúl hozzá.

**Típus-konzisztencia:** `PatternGate.Outcome` mezőnevei (`verdict`/`alignedDays`/`result`/`constantSide`) azonosak a Task 1 tesztjében, a Task 1 `detectPair`-jében és a Task 2 szolgáltatásában. A wire verdikt-stringek (`live`/`few_days`/`no_data`/`degenerate`/`frozen`) azonosak a YAML `pattern` regexében, a Java konstansokban, a TS `PatternGateVerdict`-ben és a tesztek assertjeiben. A `metricAKey`/`metricALabel`/`metricBKey`/`metricBLabel` névsor végig egyezik YAML ↔ Java builder ↔ TS domain ↔ komponens között.

**Ismert érzékeny pontok** (a végrehajtónak): a Task 4 rendezés-tesztje a Task 3 mock seedjének **konkrét** értékeire épül (`late-meal` 1 hiányzó nap → `sleep-duration` 2 hiányzó nap; `sport-load-min` 0 lefedett nap; `sleep-quality` 58 nap) — ha a seedet módosítod, a teszt elvárásait is vezesd át.
