# Motor tab redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Motor tab domén-csoportos, élénk újratervezése (hero + szűrő-chipek + kibontható pár-sorok + lefedettség-gyűrűk) a jóváhagyott mockup szerint, kis additív contract-bővítéssel (forrás/domén/mechanizmus/pairKey).

**Architecture:** Backend: `MetricKey` bővül `sourceHu`+`domain` mezőkkel, a pár-config `mechanism`-mel; a `PatternMonitorService` áttölti őket a (bővített) monitor-DTO-kba; `PatternResponse` += `pairKey`. Frontend: a `MotorPage` új prezentációs komponensekre bomlik (hero, chipek, domén-szekciók, kibontható sorok, gyűrűk), a Patterns-oldal `?pair=` görgetést kap.

**Tech Stack:** Spring Boot 4 / Java 21 (contract-first OpenAPI), React 19 + Vite, vitest + MSW, Playwright visual harness.

**Spec:** [`docs/superpowers/specs/2026-08-13-motor-redesign-design.md`](../specs/2026-08-13-motor-redesign-design.md) · **Mockup:** `2026-08-13-motor-redesign-mockup.html` · **bd:** `mezo-18bx`

## Global Constraints

- **FE-kód írása ELŐTT kötelező elolvasni** [`docs/references/frontend_conventions.md`](../../references/frontend_conventions.md); contract-munka előtt `api_contract_conventions.md`; BE-munka előtt `spring_patterns.md`/`configuration_conventions.md`/`testing_standards.md`.
- Contract-first: előbb `api/feature/companion/companion.yml`, aztán `cd api/generate && npm run generate:api`, majd `cd frontend && pnpm generate:api`; backend Java típusok a `./mvnw generate-sources`/`test` alatt frissülnek.
- FE: prezentációs komponensek `features/insights/components/` alatt pure props-szal (`@/data/*` import tilos bennük); tiszta logika `features/insights/logic/`; adat CSAK `@/data/hooks`-ból; mély abszolút importok; tesztek kolokáltan.
- Minden szín token (`frontend/src/styles/prototype.css` rampák); alvás-domén = a meglévő `--lav`/`--wash-lav`/`--lav-deep` — új token NEM kell.
- FE-kapuk: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — mindkét mód zöld.
- Backend: `./mvnw clean test` (mindig `clean`); compose fut (`:15432`).
- Vizuális baseline: a redesign szándékosan mozdít pixelt — lokál `pnpm test:visual:update` (darwin), CI-linux: `gh workflow run update-visual-baselines.yml -r feat/motor-redesign` a PR-branchre (`docs/infrastructure/local-dev-testing.md`).
- Commit-subject: `feat(insights): … (mezo-18bx)`.
- Kulcs-szemantika: a pár- és metrika-kulcsok élő identitások — csak ÚJ mezőket adunk, meglévőt nem nevezünk át.

## File Structure

| Fájl | Felelősség |
|---|---|
| `backend/.../companion/service/MetricDomain.java` | ÚJ enum: SLEEP/TRAIN/FUEL/MIND/BODY/OTHER + `wireKey()` |
| `backend/.../companion/service/MetricKey.java` | +`sourceHu`, +`domain` mind a 31 tagon |
| `backend/.../companion/config/CompanionProperties.java` | `PatternPair` += `@NotBlank String mechanism` |
| `backend/src/main/resources/application.yml` | 29 pár `mechanism` sora |
| `api/feature/companion/companion.yml` | monitor-DTO-k + `PatternResponse.pairKey` additív mezői |
| `backend/.../companion/service/PatternMonitorService.java` | az új mezők áttöltése |
| `frontend/src/data/types.ts` + `insights/monitorApi.ts` + `insights/patternsApi.ts` + `insights/insights.ts` | FE típusok, wire-mapping, mock-seed |
| `frontend/src/features/insights/logic/domains.ts` | ÚJ — `DOMAIN_META` (címke/ikon/szín-tokenek) + rendezés |
| `frontend/src/features/insights/components/MotorHero.tsx`, `VerdictFilterChips.tsx`, `DomainSection.tsx`, `PairRow.tsx`, `MetricCoverageRing.tsx` | ÚJ prezentációs komponensek (a `GateVerdictRow`/`MetricCoverageRow` utódai — a régiek törlődnek) |
| `frontend/src/features/insights/pages/MotorPage.tsx` | összeszerelés + szűrő-állapot |
| `frontend/src/features/insights/pages/PatternsPage.tsx` + `components/PatternCard.tsx` | `?pair=` görgetés/kiemelés + visszalink |
| `docs/features/insights.md` + `docs/features/companion.md` | doksi-frissítés |

---

### Task 1: Backend — MetricDomain + sourceHu + pár-mechanizmusok

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MetricDomain.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MetricKey.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java`
- Modify: `backend/src/main/resources/application.yml`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPropertiesIT.java` + új `MetricKeyTest`

**Interfaces:**
- Produces: `MetricDomain { SLEEP, TRAIN, FUEL, MIND, BODY, OTHER }` + `labelHu()` + `wireKey()` (kisbetűs név); `MetricKey.sourceHu()`, `MetricKey.domain()`; `CompanionProperties.PatternPair.mechanism()`.

- [ ] **Step 1: Failing test** — új `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/MetricKeyTest.java` (sima unit, a `PatternGateTest` mintájára):

```java
package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** V3.4 UI-mezők: minden metrika hordoz forrást + domént (mezo-18bx). */
class MetricKeyTest {

    @Test
    void testMetricKey_shouldCarrySourceAndDomain_forEveryMetric() {
        for (MetricKey metric : MetricKey.values()) {
            assertThat(metric.sourceHu()).as(metric.name()).isNotBlank();
            assertThat(metric.domain()).as(metric.name()).isNotNull();
        }
        assertThat(MetricKey.SLEEP_QUALITY.domain()).isEqualTo(MetricDomain.SLEEP);
        assertThat(MetricKey.GYM_WORKLOAD.domain()).isEqualTo(MetricDomain.TRAIN);
        assertThat(MetricKey.WEEKEND.domain()).isEqualTo(MetricDomain.OTHER);
        assertThat(MetricKey.CHECKIN_BODY.domain()).isEqualTo(MetricDomain.BODY);
        assertThat(MetricDomain.SLEEP.wireKey()).isEqualTo("sleep");
    }
}
```

és a `CompanionPropertiesIT.testPatternsConfig…` tesztbe:

```java
        assertThat(properties.patterns().pairs())
                .allSatisfy(p -> assertThat(p.mechanism()).isNotBlank()); // mezo-18bx: miért figyeljük
```

- [ ] **Step 2: Run — FAIL** (fordítási hiba: `sourceHu`/`domain`/`mechanism` nincs)

```bash
cd backend && ./mvnw clean test -Dtest='MetricKeyTest,CompanionPropertiesIT'
```

- [ ] **Step 3: Implementáció**

`MetricDomain.java`:

```java
package io.mrkuhne.mezo.feature.companion.service;

/** A metrikák élet-domén besorolása a Motor tab csoportosításához (mezo-18bx). */
public enum MetricDomain {

    SLEEP("Alvás"),
    TRAIN("Edzés"),
    FUEL("Táplálkozás"),
    MIND("Mentális & társas"),
    BODY("Test"),
    OTHER("Egyéb");

    private final String labelHu;

    MetricDomain(String labelHu) {
        this.labelHu = labelHu;
    }

    public String labelHu() {
        return labelHu;
    }

    /** Wire-kulcs a contractnak (kisbetűs enum-név). */
    public String wireKey() {
        return name().toLowerCase(java.util.Locale.ROOT);
    }
}
```

`MetricKey`: a konstruktor `(labelHu, sourceHu, domain)`-ra bővül, mind a 31 tag:

```java
    SLEEP_QUALITY("alvásminőség", "Alvás-napló", MetricDomain.SLEEP),
    SLEEP_DURATION_H("alváshossz", "Alvás-napló", MetricDomain.SLEEP),
    TRAINING_RPE("edzés-RPE", "Sport- és futás-napló (RPE)", MetricDomain.TRAIN),
    SPORT_LOAD_MIN("sportterhelés", "Sport-napló (perc)", MetricDomain.TRAIN),
    GYM_VOLUME_KG("gym-volumen", "Workout szettek (súly×ism.)", MetricDomain.TRAIN),
    LATE_MEAL_HOUR("utolsó étkezés ideje", "Étkezés-napló (utolsó étkezés)", MetricDomain.FUEL),
    DAILY_KCAL("napi kalória", "Étkezés-napló", MetricDomain.FUEL),
    RETA_CYCLE_DAY("Reta-ciklusnap", "Gyógyszer-napló", MetricDomain.FUEL),
    DAILY_WATER_ML("vízbevitel", "Víz-számláló", MetricDomain.FUEL),
    WEIGHT_DELTA_KG("reggeli súlyváltozás", "Reggeli mérlegelés", MetricDomain.BODY),
    CHECKIN_STRESS("stressz-szint", "Check-in sheet", MetricDomain.MIND),
    CHECKIN_ENERGY("energia-szint", "Check-in sheet", MetricDomain.MIND),
    GYM_WORKLOAD("gym-terhelésérzet", "Set debrief a workoutban", MetricDomain.TRAIN),
    GYM_JOINT_PAIN("ízületi fájdalom", "Set debrief a workoutban", MetricDomain.TRAIN),
    CHECKIN_BODY("testérzet", "Check-in sheet", MetricDomain.BODY),
    CHECKIN_MENTAL("mentális állapot", "Check-in sheet", MetricDomain.MIND),
    BEDTIME_HOUR("lefekvés ideje", "Alvás-napló", MetricDomain.SLEEP),
    WAKEUP_HOUR("ébredés ideje", "Alvás-napló", MetricDomain.SLEEP),
    SLEEP_AWAKENINGS("éjszakai ébredések", "Alvás-napló", MetricDomain.SLEEP),
    DAILY_PROTEIN_G("napi fehérje", "Étkezés-napló", MetricDomain.FUEL),
    MEAL_SCORE("étkezés-pontszám", "Étkezés-pontozó", MetricDomain.FUEL),
    RETA_DOSE_MG("Reta-dózis", "Gyógyszer-napló", MetricDomain.FUEL),
    HABITS_DONE("kész szokások", "Szokás-követő", MetricDomain.MIND),
    RITUAL_CLOSED("esti lezárás", "Esti lezárás rituálé", MetricDomain.MIND),
    DAILY_XP("napi XP", "Activity + szokás + küldetés XP", MetricDomain.MIND),
    SOCIAL_MENTIONS("társas említések", "People-említések", MetricDomain.MIND),
    RUN_HR_RECOVERY_S("pulzus-visszaállás", "Futás-napló (pulzus-visszaállás)", MetricDomain.TRAIN),
    WEEKEND("hétvége", "naptár (származtatott)", MetricDomain.OTHER),
    ACWR("akut:krónikus terhelés", "származtatott: sport + gym terhelésből", MetricDomain.TRAIN),
    TRAINING_MONOTONY("edzés-monotónia", "származtatott: a napi terhelés szórásából", MetricDomain.TRAIN),
    BEDTIME_VARIABILITY("lefekvés-szórás", "származtatott: a lefekvési időkből", MetricDomain.SLEEP);
```

(a mezők + `sourceHu()`/`domain()` getterek a `labelHu` mintájára.)

`CompanionProperties.PatternPair` a `lagDays` elé:

```java
        /** Miért figyeljük — a Motor tab kibontott sorának egysoros mechanizmusa (mezo-18bx). */
        @NotBlank String mechanism,
```

(FIGYELEM: a rekord-mező sorrendje kötelezően egyezzen a yml-lel nem kell — a binding név-alapú; a mezőt a `title` után vedd fel a rekordban.)

`application.yml`: mind a 29 pair-bejegyzés kap `mechanism:` sort a `title` után. A 8 eredeti:

```yaml
# sleep-quality~next-day-training-rpe:
          mechanism: "A rosszabb alvás másnap nehezebbnek érződő edzést hozhat."
# sleep-duration~next-day-training-rpe:
          mechanism: "A rövidebb alvás másnap magasabb erőkifejtés-érzetet hozhat."
# late-meal~next-sleep-quality:
          mechanism: "A késői étkezés ronthatja a rákövetkező éjszaka minőségét."
# reta-cycle-day~daily-kcal:
          mechanism: "A ciklus fázisa befolyásolhatja az étvágyat és a bevitelt."
# sport-load~next-day-gym-volume:
          mechanism: "A sportterhelés másnapra elvehet a gym-teljesítményből."
# daily-kcal~next-morning-weight-delta:
          mechanism: "A napi bevitel a másnap reggeli súlyban csapódhat le."
# checkin-stress~sleep-quality:
          mechanism: "A stresszes nap ronthatja az aznapi alvásminőséget."
# daily-water~checkin-energy:
          mechanism: "A hidratáltság az energia-szintben érződhet."
```

A 21 új (V3.4) pár:

```yaml
# sleep-quality~next-day-gym-workload:
          mechanism: "A rosszabb alvás másnap nehezebbnek érződő szetteket hozhat — a gym-RPE proxyja."
# gym-volume~next-day-joint-pain:
          mechanism: "A nagy volumen másnap ízületi panaszként üthet vissza — túlterhelés-jel."
# checkin-body~gym-joint-pain:
          mechanism: "A rosszabb testérzet és az edzés közbeni ízületi fájdalom együtt járhat."
# gym-workload~next-day-checkin-body:
          mechanism: "A nehéznek érzett edzés a másnapi testérzetben csapódhat le."
# bedtime-hour~sleep-quality:
          mechanism: "Alvás-higiénia: a késői lefekvés ronthatja az alvás minőségét."
# late-meal~next-sleep-awakenings:
          mechanism: "A késői étkezés szétdarabolhatja az éjszakát — több ébredés."
# checkin-stress~late-meal-hour:
          mechanism: "Stressz-evés: a feszült nap kitolhatja az utolsó étkezést."
# habits-done~checkin-mental:
          mechanism: "A kipipált szokások jobb mentális állapottal járhatnak."
# ritual-closed~next-sleep-quality:
          mechanism: "Az esti lezárás lecsendesítheti az elalvást — jobb alvásminőség."
# daily-protein~next-day-checkin-energy:
          mechanism: "A fehérjebevitel a másnapi energia-szintben érződhet."
# daily-xp~checkin-mental:
          mechanism: "Az aktív, pontszerző nap jobb hangulattal járhat."
# meal-score~next-day-checkin-energy:
          mechanism: "A jobb minőségű étkezés másnap több energiát adhat."
# reta-dose~daily-kcal:
          mechanism: "Az étvágy-elnyomás dózisfüggő lehet — magasabb dózis, kevesebb kalória."
# sport-load~next-sleep-quality:
          mechanism: "Az edzésterhelés kihathat a rákövetkező éjszaka minőségére."
# wakeup-hour~checkin-energy:
          mechanism: "A korábbi vagy későbbi ébredés az aznapi energiában érződhet."
# sleep-quality~next-day-hr-recovery:
          mechanism: "A jó alvás gyorsabb pulzus-visszaállást hozhat — regeneráció-jel."
# social-mentions~checkin-mental:
          mechanism: "A társas nap jobb hangulattal járhat."
# acwr~next-day-joint-pain:
          mechanism: "A hirtelen terhelés-ugrás (magas ACWR) a sérülés-kockázat klasszikus jele."
# training-monotony~checkin-energy:
          mechanism: "Az egyhangú terhelés (Foster-monotónia) fáradtság-jel lehet."
# bedtime-variability~checkin-mental:
          mechanism: "Social jetlag: a szórt lefekvés a hangulatban érződhet."
# weekend~late-meal-hour:
          mechanism: "Hétvége-hatás: lazább napokon később csúszhat az utolsó étkezés."
```

- [ ] **Step 4: Run — PASS**

```bash
cd backend && ./mvnw clean test -Dtest='MetricKeyTest,CompanionPropertiesIT'
```

- [ ] **Step 5: Commit**

```bash
git add backend/src
git commit -m "feat(companion): MetricDomain + sourceHu + pár-mechanizmusok a Motor UI-nak (mezo-18bx)"
```

---

### Task 2: Contract + monitor-service — az új mezők a dróton

**Files:**
- Modify: `api/feature/companion/companion.yml`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PatternMonitorService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPatternMonitorApiIT.java`
- (generált) `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Consumes: Task 1 (`MetricKey.sourceHu()/domain()`, `PatternPair.mechanism()`).
- Produces (wire): `PatternMonitorPair.mechanismHu/metricADomain/metricBDomain`, `PatternMetricCoverage.sourceHu/domain`, `PatternResponse.pairKey`.

- [ ] **Step 1: Contract-szerkesztés** — `api/feature/companion/companion.yml`:

`PatternMonitorPair.properties`-be (a `metricBLabel` után) + `required`-be MIND a három:

```yaml
        mechanismHu: { type: string, description: 'Miért figyeljük — a katalógus mechanism-egysorosa (mezo-18bx).' }
        metricADomain: { type: string, pattern: '^(sleep|train|fuel|mind|body|other)$', description: 'metric-a élet-doménje.' }
        metricBDomain: { type: string, pattern: '^(sleep|train|fuel|mind|body|other)$', description: 'metric-b (a kimenet) doménje — a Motor tab elsődleges csoportja.' }
```

`PatternMetricCoverage.properties`-be + `required`-be:

```yaml
        sourceHu: { type: string, description: 'Honnan jön az adat — gyűjtő-felület vagy derivált-magyarázat.' }
        domain: { type: string, pattern: '^(sleep|train|fuel|mind|body|other)$' }
```

`PatternResponse.properties`-be + `required`-be:

```yaml
        pairKey: { type: string, description: 'A minta stabil pár-kulcsa (statistical: katalógus-kulcs, hypothesis: hyp-hash) — a Motor↔Patterns kereszt-link horgonya (mezo-18bx).' }
```

- [ ] **Step 2: Generálás**

```bash
cd api/generate && npm run generate:api
cd ../../frontend && pnpm generate:api
```

- [ ] **Step 3: Failing test** — `CompanionPatternMonitorApiIT`-be:

```java
    @Test
    void testPatternMonitor_shouldCarrySourceDomainAndMechanism_whenRequested() {
        PatternMonitorResponse response = monitor();

        assertThat(response.getPairs()).allSatisfy(p -> {
            assertThat(p.getMechanismHu()).isNotBlank();
            assertThat(p.getMetricADomain()).isNotBlank();
            assertThat(p.getMetricBDomain()).isNotBlank();
        });
        assertThat(pair(response, STRESS_SLEEP_PAIR).getMetricBDomain()).isEqualTo("sleep");
        assertThat(metric(response, "checkin-stress").getSourceHu()).isEqualTo("Check-in sheet");
        assertThat(metric(response, "checkin-stress").getDomain()).isEqualTo("mind");
    }
```

(A meglévő `monitor()`/`pair()`/`metric()` helperek maradnak.) A `PatternResponse.pairKey`-re a meglévő pattern-lista IT-be (`CompanionPatternApiIT` vagy ahol a `GET /api/companion/pattern` asszertálódik — keresd: `rg "pattern\b.*get" backend/src/test`) egy sor: a statistical sor `pairKey`-e egyezik a populátorban használt kulccsal.

- [ ] **Step 4: Run — FAIL**, majd **implementáció**:

`PatternMonitorService.toPair` builder-lánca bővül:

```java
                .mechanismHu(pair.mechanism())
                .metricADomain(pair.metricA().domain().wireKey())
                .metricBDomain(pair.metricB().domain().wireKey())
```

és a `coverage(...)` buildere:

```java
                    .sourceHu(metric.sourceHu())
                    .domain(metric.domain().wireKey())
```

`PatternResponse.pairKey`: a `CompanionMapper` MapStruct név-egyezéssel automatikusan mappeli (`PatternEntity.getPairKey()` → `pairKey`); ha a mapper explicit mezőlistás, vedd fel a `@Mapping`-et.

- [ ] **Step 5: Run — PASS** (+ teljes companion-kör):

```bash
cd backend && ./mvnw clean test -Dtest='CompanionPatternMonitor*,CompanionPattern*,MetricKeyTest'
```

- [ ] **Step 6: Commit**

```bash
git add api backend/src frontend/src/data/_client/api.gen.ts
git commit -m "feat(api): monitor forrás/domén/mechanizmus + PatternResponse.pairKey (mezo-18bx)"
```

---

### Task 3: FE adatréteg — típusok, mapping, mock-seed

**Files:**
- Modify: `frontend/src/data/types.ts`, `frontend/src/data/insights/monitorApi.ts`, `frontend/src/data/insights/patternsApi.ts`, `frontend/src/data/insights/insights.ts`

**Interfaces:**
- Produces: `MetricDomain` FE-típus (`'sleep'|'train'|'fuel'|'mind'|'body'|'other'`); `PatternMonitorPair.mechanismHu/metricADomain/metricBDomain`; `PatternMetricCoverage.sourceHu/domain`; `Pattern.pairKey`.

- [ ] **Step 1: Típusok** — `types.ts`:

```ts
export type MetricDomain = 'sleep' | 'train' | 'fuel' | 'mind' | 'body' | 'other'
```

`PatternMonitorPair` += `mechanismHu: string`, `metricADomain: MetricDomain`, `metricBDomain: MetricDomain`; `PatternMetricCoverage` += `sourceHu: string`, `domain: MetricDomain`; `Pattern` += `pairKey: string`.

- [ ] **Step 2: Mapping** — `monitorApi.toPair`/`toMetric` a wire-mezőket átveszi (`as MetricDomain` cast a saját backend pattern-kényszere alapján, a `category` precedens); `patternsApi` a `pairKey`-t átveszi.

- [ ] **Step 3: Mock-seed** — `insights.ts`: a `patternMonitor` minden pár-eleme kap `mechanismHu` + `metricADomain` + `metricBDomain` értéket, minden metrika-elem `sourceHu` + `domain`-t (a Task 1 táblázatával konzisztensen); a `patterns` seed elemei `pairKey`-t. A seedben legyen legalább: 2 élő pár KÜLÖNBÖZŐ doménban, 1 few_days, 1 no_data, 1 frozen, és 1 pár, ahol `metricADomain !== metricBDomain` (kereszt-domén chip teszteléséhez).

- [ ] **Step 4: Kapu** — mindkét mód fordul és zöld:

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(insights): FE monitor-típusok + mock-seed a domén/forrás/mechanizmus mezőkkel (mezo-18bx)"
```

---

### Task 4: MotorHero + VerdictFilterChips

**Files:**
- Create: `frontend/src/features/insights/logic/domains.ts` (+ `domains.test.ts`)
- Create: `frontend/src/features/insights/components/MotorHero.tsx`, `VerdictFilterChips.tsx`
- Modify: `frontend/src/features/insights/pages/MotorPage.tsx`
- Test: `frontend/src/features/insights/pages/MotorPage.test.tsx`

**Interfaces:**
- Produces: `DOMAIN_META: Record<MetricDomain, { label: string; icon: string; rail: string; tint: string }>` és `DOMAIN_ORDER: MetricDomain[]` (`['sleep','train','fuel','mind','body','other']`) a `logic/domains.ts`-ben (tokenek: sleep → `var(--lav)`/`var(--wash-lav)`, train → `var(--primary-base)`/`var(--primary-bg)`, fuel → `var(--success-base)`/`var(--success-bg)`, mind → `var(--accent-base)`/`var(--accent-bg)`, body → `var(--secondary-soft)`/`var(--secondary-bg)`, other → `var(--text-muted)`/`var(--surface-recess)`); `MotorHero({ monitor })` (pure props); `VerdictFilterChips({ counts, active, onToggle })` ahol `counts: Record<PatternGateVerdict, number>`, `active: Set<PatternGateVerdict>`.

- [ ] **Step 1: Failing test** — `MotorPage.test.tsx`-be (mindkét módos blokkba, a meglévő MSW/seed infrával):

```tsx
  it('renders the hero with live count and engine facts', async () => {
    render(<MotorPage />)
    expect(await screen.findByText(/élő összefüggés/)).toBeInTheDocument()
    expect(screen.getByText(/figyelt pár/)).toBeInTheDocument()
    expect(screen.getByText(/mért metrika/)).toBeInTheDocument()
  })

  it('filters pairs by verdict chip toggle', async () => {
    render(<MotorPage />)
    const liveChip = await screen.findByRole('button', { name: /Élő/ })
    fireEvent.click(liveChip)
    // csak élő sorok maradnak; a few_days seed-cím eltűnik
    expect(screen.queryByText('Alváshossz ↔ másnapi edzés-RPE')).not.toBeInTheDocument()
    fireEvent.click(liveChip) // toggle vissza
    expect(await screen.findByText('Alváshossz ↔ másnapi edzés-RPE')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run — FAIL**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test -- MotorPage
```

- [ ] **Step 3: Implementáció** — `MotorHero`: primary-gradiens kártya (`linear-gradient(135deg, var(--primary-base), var(--primary-hover), var(--primary-deep))`, fehér szöveg), eyebrow „Minta-motor", nagy szám = élő párok száma + „élő összefüggés", tény-sor: `{pairs.length} figyelt pár · {metrics.length} mért metrika · utolsó felismerés: {lastRunAt?.slice(0,10) ?? 'még nem talált mintát'}`, alatta kis sorban ablak/min-n/cron (mono). `VerdictFilterChips`: vízszintes görgethető sor, chipenként nagy szám + címke, `role="button"` + `aria-pressed={active.has(v)}`, aktívnál kiemelt keret; a színek a `GateVerdictRow` régi `VERDICT_COLOR` rampáit követik tokenből. `MotorPage`: `const [activeVerdicts, setActiveVerdicts] = useState<Set<PatternGateVerdict>>(new Set())`; üres set = nincs szűrés.

- [ ] **Step 4: Run — PASS** (mindkét mód), **Step 5: Commit**

```bash
cd frontend && pnpm test -- MotorPage && VITE_USE_MOCK=true pnpm test -- MotorPage
git add frontend/src && git commit -m "feat(insights): Motor hero + verdikt-szűrő chipek (mezo-18bx)"
```

---

### Task 5: DomainSection + PairRow (kibontás, nudge, kereszt-link)

**Files:**
- Create: `frontend/src/features/insights/components/DomainSection.tsx`, `PairRow.tsx`
- Delete: `frontend/src/features/insights/components/GateVerdictRow.tsx`
- Modify: `frontend/src/features/insights/pages/MotorPage.tsx`, `frontend/src/features/insights/logic/domains.ts`
- Test: `MotorPage.test.tsx`

**Interfaces:**
- Consumes: `DOMAIN_META`/`DOMAIN_ORDER`; a pár elsődleges doménje = `pair.metricBDomain`.
- Produces: `groupPairsByDomain(pairs): Map<MetricDomain, PatternMonitorPair[]>` a `logic/domains.ts`-ben (szekción belül a meglévő `comparePairs` sorrend — a fv. a `MotorPage`-ből ide költözik és exportálódik); `DomainSection({ domain, pairs, defaultOpen, children-render })`; `PairRow({ pair, bottleneckCoveredDays })` — kibontás lokális state, a régi `verdictSentence` logika ide költözik és bővül a nudge-mondattal.

- [ ] **Step 1: Failing test** — `MotorPage.test.tsx` + `domains.test.ts`:

```tsx
  it('groups pairs into domain sections by metric-B domain, cross-domain chip shown', async () => {
    render(<MotorPage />)
    expect(await screen.findByText('Alvás')).toBeInTheDocument()
    // a kereszt-domén pár az OUTCOME (B) doménjénél van, a soron a másik domén chipje
    const crossRow = screen.getByText('Alvásminőség ↔ másnapi edzés-RPE').closest('[data-testid="pair-row"]')!
    expect(within(crossRow as HTMLElement).getByText('alvás')).toBeInTheDocument() // A-domén chip
  })

  it('expands a pair row to mechanism + source pills + pattern link on live', async () => {
    render(<MotorPage />)
    fireEvent.click(await screen.findByText('Stressz-szint ↔ aznapi alvásminőség'))
    expect(screen.getByText(/Miért figyeljük/)).toBeInTheDocument()
    expect(screen.getByText('Check-in sheet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Minta megnyitása/ })).toHaveAttribute(
      'href', expect.stringContaining('/insights/patterns?pair=checkin-stress~sleep-quality'))
  })

  it('renders the nudge sentence on few_days rows', async () => {
    render(<MotorPage />)
    expect(await screen.findByText(/még 2 illeszkedő nap, és ez a pár életre kel/)).toBeInTheDocument()
  })
```

`domains.test.ts` (pure): `groupPairsByDomain` a B-domén szerint oszt, ismeretlen nélkül, szekción belül `comparePairs` sorrendben.

- [ ] **Step 2: Run — FAIL**, **Step 3: Implementáció**:

`PairRow` — a `GateVerdictRow` utóda: bal domén-színsáv (a szekció rail-színe prop), fejsor (cím + verdikt-pill; few_days pill szövege `MÉG {missingDays} NAP`), élő sornál r-erősség mini-sáv (`width: Math.abs(r)*100%`, `bar`/`bar-fill` osztályok) + `r/n/p` chipsor; kereszt-domén chip ha `metricADomain !== metricBDomain` (`DOMAIN_META[metricADomain]` tint/label); few_days-nél nudge-sor:

```ts
function nudgeSentence(pair: PatternMonitorPair): string {
  const bottleneck = pair.bottleneckMetricKey === pair.metricBKey ? pair.metricBLabel : pair.metricALabel
  return `🎯 ${capitalize(bottleneck)} logolása még ${pair.missingDays} illeszkedő nap, és ez a pár életre kel!`
}
```

no_data/degenerate/frozen a régi `verdictSentence` mondatait tartja (a fv. a `PairRow.tsx`-be költözik, exportálva a tesztnek). Kibontásra (`useState`, a teljes kártya kattintható, `aria-expanded`): accent-tintás belső kártya — „💡 Miért figyeljük" (`mechanismHu`), „📥 Honnan jön az adat" két pill (`{metricALabel} · {sourceALabel}` — a forrás a coverage-ből jön: a `MotorPage` `Map<metricKey, PatternMetricCoverage>`-et ad le propként vagy előre felold két `sourceHu` stringet `PairRow`-propba: `sourceA`, `sourceB`), és `verdict === 'live' || verdict === 'frozen'` esetén `<Link to={`/insights/patterns?pair=${pair.key}`}>Minta megnyitása →</Link>` primary-gomb stílussal. `DomainSection`: tinted fejléc + ikon-badge + „N pár" + zöld „M élő" pill + caret; `defaultOpen = pairs.some(p => p.verdict === 'live')`; csukás/nyitás `useState`. Szűrt-üres állapot: a fejléc marad, a törzs „0 találat a szűrőre" sor. `GateVerdictRow.tsx` törlődik (a `MotorPage.test.tsx` régi, sorokra vonatkozó asszertjei az újakra cserélődnek — a verdikt-mondat tesztek a `PairRow` exportált `verdictSentence`-ére portolódnak).

- [ ] **Step 4: Run — PASS** (mindkét mód, teljes insights-kör):

```bash
cd frontend && pnpm test -- insights && VITE_USE_MOCK=true pnpm test -- insights
```

- [ ] **Step 5: Commit**

```bash
git add -A frontend/src && git commit -m "feat(insights): domén-szekciók + kibontható pár-sorok nudge-dzsal (mezo-18bx)"
```

---

### Task 6: Lefedettség-gyűrűk

**Files:**
- Create: `frontend/src/features/insights/components/MetricCoverageRing.tsx`
- Delete: `frontend/src/features/insights/components/MetricCoverageRow.tsx`
- Modify: `frontend/src/features/insights/pages/MotorPage.tsx`
- Test: `MotorPage.test.tsx`

**Interfaces:**
- Consumes: `PatternMetricCoverage` (+ `sourceHu`), `pairsByMetricKey: Map<string, string[]>` (a hivatkozó párok címei — a `MotorPage` számolja a pairs-ből).
- Produces: `MetricCoverageRing({ metric, referencingTitles })` — kibontható sor.

- [ ] **Step 1: Failing test:**

```tsx
  it('renders coverage rings thinnest-first with waiting-pair label and expands to source', async () => {
    render(<MotorPage />)
    const rows = await screen.findAllByTestId('coverage-ring-row')
    // a legvékonyabb elöl (a seed szerint ismert sorrend)
    expect(within(rows[0]).getByText(/pár vár rá/)).toBeInTheDocument()
    fireEvent.click(rows[0])
    expect(within(rows[0]).getByText(/naptár|napló|sheet|származtatott|követő|számláló|pontozó|rituálé|említések|XP|mérlegelés|debrief/)).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run — FAIL**, **Step 3: Implementáció** — gyűrű: `conic-gradient(var(--success-base) ${ratio*100}%, var(--surface-recess) 0)` külső div + fehér belső kör a nap-számmal (a mockup `.ring` mintája inline stílussal, tokenekkel); jobbra `„{coveredDays}/{windowDays} nap · {pairCount} pár {élő pár nélkül: 'vár rá'}`" — a „vár rá" akkor, ha a metrika egyetlen hivatkozó párja sem élő (a `MotorPage` a pairs-ből számolja és `waiting: boolean` propot ad). Kibontásra: `sourceHu` + a hivatkozó párok címei felsorolva. Rendezés marad: legvékonyabb elöl.

- [ ] **Step 4: Run — PASS**, **Step 5: Commit**

```bash
cd frontend && pnpm test -- MotorPage && VITE_USE_MOCK=true pnpm test -- MotorPage
git add -A frontend/src && git commit -m "feat(insights): metrika-lefedettség gyűrűkkel + forrás-kibontással (mezo-18bx)"
```

---

### Task 7: Patterns kereszt-link (`?pair=` + visszalink)

**Files:**
- Modify: `frontend/src/features/insights/pages/PatternsPage.tsx`, `frontend/src/features/insights/components/PatternCard.tsx`
- Test: `frontend/src/features/insights/pages/PatternsPage.test.tsx`

**Interfaces:**
- Consumes: `Pattern.pairKey` (Task 3), `useSearchParams` (react-router).
- Produces: `?pair=<pairKey>` → a találat-kártya `scrollIntoView` + rövid kiemelés; `PatternCard` alján `Motor-diagnosztika →` link `/insights/motor`-ra.

- [ ] **Step 1: Failing test** — `PatternsPage.test.tsx`:

```tsx
  it('highlights the card matching ?pair= and renders the motor back-link', async () => {
    render(
      <MemoryRouter initialEntries={['/insights/patterns?pair=checkin-stress~sleep-quality']}>
        <Routes><Route path="/insights/patterns" element={<PatternsPage />} /></Routes>
      </MemoryRouter>,
    )
    const card = (await screen.findAllByTestId('pattern-card'))
      .find((c) => within(c).queryByText(/Stressz/))!
    expect(card).toHaveAttribute('data-highlighted', 'true')
    expect(within(card).getByRole('link', { name: /Motor-diagnosztika/ })).toHaveAttribute('href', '/insights/motor')
  })
```

(Igazítsd a fájl meglévő render-helperéhez — ha már saját router-wrappert használ, azt bővítsd `initialEntries` paraméterrel.)

- [ ] **Step 2: Run — FAIL**, **Step 3: Implementáció** — `PatternsPage`: `const [params] = useSearchParams(); const target = params.get('pair')`; a lista renderelésénél `highlighted = p.pairKey === target`; `useEffect` a mountkor: ha van target, `document.querySelector('[data-highlighted="true"]')?.scrollIntoView({ block: 'center' })`. `PatternCard`: `data-testid="pattern-card"`, `data-highlighted` attribútum + kiemeléskor `boxShadow: 0 0 0 2px var(--primary-base)`; alul kis `Link` „Motor-diagnosztika →".

- [ ] **Step 4: Run — PASS** (mindkét mód), **Step 5: Commit**

```bash
cd frontend && pnpm test -- PatternsPage && VITE_USE_MOCK=true pnpm test -- PatternsPage
git add frontend/src && git commit -m "feat(insights): Motor↔Patterns kereszt-link ?pair= horgonnyal (mezo-18bx)"
```

---

### Task 8: Teljes kapu + vizuális baseline + docs + kiadás

**Files:**
- Modify: `docs/features/insights.md` (§2.8 + §10), `docs/features/companion.md` (contract/MetricKey mezők)
- (baseline) `frontend/tests/visual/` goldens

- [ ] **Step 1: Teljes kapuk**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
cd ../backend && ./mvnw clean test
```

- [ ] **Step 2: Vizuális baseline** — lokál darwin: `cd frontend && pnpm test:visual:update`; a linux goldeneket a PR-branchen: `gh workflow run update-visual-baselines.yml -r feat/motor-redesign` (CI zöldre válásához szükséges).

- [ ] **Step 3: Docs** — `insights.md` §2.8 újraírása az új szerkezetre (hero/chipek/domén-szekciók/PairRow/gyűrűk + kereszt-link; a `GateVerdictRow`/`MetricCoverageRow` → utódaik a §10 key-files listában); `companion.md`: MetricKey `sourceHu`/`domain`, `PatternPair.mechanism`, a monitor-DTO és `PatternResponse.pairKey` mezők. Majd:

```bash
node scripts/lint-docs.mjs
```

- [ ] **Step 4: Commit + push + self-PR**

```bash
git add -A && git commit -m "docs(insights): Motor redesign dokumentálása (mezo-18bx)"
git push -u origin feat/motor-redesign
gh pr create --fill --title "feat(insights): Motor tab redesign — domén-csoportos kapu-diagnosztika (mezo-18bx)"
```

CI zöld után: `git checkout main && git pull --rebase && git merge --no-ff feat/motor-redesign && git push`, majd `bd close mezo-18bx` + `bd dolt push`.

---

## Self-Review (elvégezve a terv írásakor)

- **Spec-lefedettség:** §3.1 hero → T4; §3.2 chipek → T4; §3.3 domén-szekciók + elsődleges-domén szabály → T5; §3.4 pár-sor (pill/mini-sáv/nudge/kibontás/CTA) → T5; §3.5 gyűrűk + kibontás → T6; §4 backend/contract (MetricDomain, sourceHu, mechanism, monitor-mezők, pairKey) → T1–T2; §5 FE réteg + tokenek (lav újrahasznosítva, új token nem kell — a spec „ha kell" feltétele nem áll be) → T3–T6; §6 tesztek → taskonként + T8; §7 docs → T8. Hiány: nincs.
- **Placeholder-scan:** mind a 29 mechanizmus-szöveg és mind a 31 forrás/domén besorolás tételesen szerepel; nincs TBD.
- **Típus-konzisztencia:** `MetricDomain.wireKey()` (T1) ↔ yml pattern `^(sleep|train|fuel|mind|body|other)$` (T2) ↔ FE `MetricDomain` union (T3) ↔ `DOMAIN_META` kulcsok (T4) egyeznek; `comparePairs` a `MotorPage`-ből a `logic/domains.ts`-be költözik (T5) és a T5 tesztje onnan importál.
- **Ismert ellenőrzendők az implementálónak:** a `PatternResponse`-t asszertáló meglévő IT pontos neve (T2/Step 3), a `PatternsPage.test.tsx` meglévő render-helper alakja (T7/Step 1), a `CompanionMapper` explicit-e (T2/Step 4) — mind egy-egy fájl megnyitásával eldől.
