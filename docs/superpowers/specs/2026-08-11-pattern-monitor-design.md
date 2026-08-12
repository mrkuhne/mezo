# Minta-motor monitor — átláthatósági al-oldal — design spec

- **Dátum:** 2026-08-11
- **Driving bd:** `mezo-viqs`
- **Előzmény:** a V3.1 statisztikai minta-motor (`mezo-fnnq.12`) éjszakai jobja **némán** ejti azokat a párokat, amelyek nem jutnak át a kapun — `PatternDetectionService.detectPair` háromszor `return false`-ol (üres A-széria, `aligned < min-n`, degenerált Pearson), és ezek a párok **nem is perzisztálódnak**. A `PatternsPage` üres állapota (`„Még nincs felismert minta — az éjszakai elemzés magától tölti…"`) így az egyetlen visszajelzés: nem derül ki, hogy melyik pár hol akadt el, mennyi hiányzik, és melyik metrika a szűk keresztmetszet. A motor a felhasználó szemszögéből fekete doboz.

## 1. Cél

Egy **/insights/motor** al-oldal + egy **`GET /api/companion/pattern/monitor`** introspekciós végpont, amely **élőben** újrafuttatja ugyanazt a kapu-kiértékelést, amit az éjszakai job végez — írás nélkül —, és páronként megmondja: átment-e, ha nem, miért nem, és mennyi hiányzik az áttöréshez. Mellé a 12 `MetricKey` **lefedettsége** a korrelációs ablakban, hogy látszódjon, mit érdemes többet logolni.

Hangnem: **átláthatóság magyarul + nyers számok** — a verdiktek felhasználói prózában szólnak („még 3 illeszkedő nap kell"), de az `n`, `r`, `p`, lefedettség-számok chipeken végig láthatók. Egy réteg, nincs „fejlesztői mód" kapcsoló.

## 2. A kapu-modell — 5 verdikt

Ez a spec magja; minden más ebből következik.

| verdikt | mikor | a felhasználó ezt látja |
|---|---|---|
| `live` | átment a kapun — van `r`/`n`/`p` | „él · r=−0.42 · n=14 nap" |
| `few_days` | van illesztett nap, de `alignedDays < min-n` | „n=5/8 — még 3 illeszkedő nap kell" |
| `no_data` | `alignedDays == 0` | „nincs még adat — az {X} metrika üres" |
| `degenerate` | `alignedDays ≥ min-n`, de az egyik széria konstans | „a(z) {Y} nem mozdul — így nincs statisztika" |
| `frozen` | a sor státusza `confirmed` vagy `rejected` | „te ítélted meg — az éjszakai job nem nyúl hozzá" |

Ma a `no_data` és a `few_days` **ugyanaz** a néma `return false`, a `degenerate` pedig a `PearsonCorrelation.correlate() → Optional.empty()` ága. A monitor választja szét őket — **a job viselkedésének változtatása nélkül**.

`frozen` sornál **nincs újraszámolás**: a befagyasztott sor saját `r`/`n`/`p`-je jelenik meg, mert a felhasználó *azt* a korrelációt ítélte meg. (Az „vajon még mindig áll-e?" kérdés külön feature, nem ez.)

## 3. Backend — közös kapu, két hívó

A monitor értéke az, hogy **hiteles**: pontosan azt mutatja, amit a job döntene. Ezt csak közös kóddal lehet garantálni, ezért a kapu kiemelődik.

### 3.1 `PatternGate` (új, `feature/companion/service/`)

Package-private, statikus, Spring-mentes osztály — a [`PearsonCorrelation`](../../../backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PearsonCorrelation.java) pontos precedense (NFR: tiszta compute-lépés, se Spring, se LLM).

```java
enum Verdict { LIVE, FEW_DAYS, NO_DATA, DEGENERATE }        // FROZEN a hívó szintjén dől el
enum Side { A, B, BOTH }                                    // melyik széria konstans
record GateOutcome(Verdict verdict, int alignedDays,
                   PearsonCorrelation.Result result,        // null, ha nem LIVE
                   Side constantSide) {}                    // null, ha nem DEGENERATE

static GateOutcome evaluate(Map<LocalDate, Double> seriesA,
                            Map<LocalDate, Double> seriesB,
                            int lagDays, int minN)
```

Ide költözik a mai `detectPair` illesztő ciklusa (`a[day]` ↔ `b[day + lagDays]`) és a két kapu. A `FROZEN` szándékosan **nem** a `Verdict`-ben van: az nem a matematika, hanem a perzisztált sor státuszának következménye — a `PatternGate` tiszta marad.

A `constantSide` azért kell, mert a `PearsonCorrelation.correlate()` csak egy üres `Optional`-t ad vissza — nem árulja el, *melyik* széria nem mozdul. A `PatternGate` az illesztett minta varianciáját nézve ezt kiegészíti (a `correlate()` maga változatlan marad), különben a `degenerate` verdikt nem tudná megnevezni a hibás metrikát.

### 3.2 `PatternDetectionService` — átkötés, viselkedés-azonosan

`detectPair` ezután: két széria lekérése → `PatternGate.evaluate(...)` → `if (verdict == LIVE) upsert(...); return verdict == LIVE;`. A `detect(userId)` ciklusa, a per-pár `try/catch` izoláció, a nem-`@Transactional` döntés és a `upsert`/`reinforcePromotedFact` logika **változatlan**. A meglévő `PatternDetectionServiceIT` ennek a regressziós hálója — nem módosul.

### 3.3 `PatternMonitorService` (új)

`@Service`, `@RequiredArgsConstructor`, `@Transactional(readOnly = true)`, `@ConditionalOnProperty(COMPANION_SWITCH)` — mint minden companion bean. Függőségei: `MetricSeriesService`, `PatternRepository`, `CompanionProperties`.

Egy `monitor(UUID userId)` hívás:

1. **Ablak** — a jobbal azonos derivációval: `to = tegnap`, `from = to − (lookbackDays − 1)`.
2. **Széria-cache** — a 8 pár **16 metrika-hivatkozása** a 12 `MetricKey` mindegyikét lefedi (a jelenlegi katalógus mind a 12-t használja, négyet kétszer). A szolgáltatás metrikánként **egyszer** húzza le a szériát egy `Map<MetricKey, Map<LocalDate, Double>>`-be, `[from, to + maxLag]` uniós ablakon. Így a pár-verdiktek és a lefedettségi blokk számai garantáltan **ugyanabból a pillanatképből** jönnek, és a DB-terhelés 16 helyett 12 lekérdezés.
3. **Perzisztált sorok** — `findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(userId)` egyszer, `pairKey → PatternEntity` mapre redukálva (csak `kind = statistical`).
4. **Páronként** — ha a sor `confirmed`/`rejected` → `frozen` (nincs compute, a sor `r`/`n`/`p`-je megy ki); különben `PatternGate.evaluate(...)`.
5. **Származtatások** (mind determinisztikus kód):
   - `missingDays = minN − alignedDays` — csak `few_days`-nél, különben `null`.
   - `bottleneckMetricKey` — a pár két metrikája közül a kevesebb lefedett nappal rendelkező (döntetlen → `metricA`); `few_days`/`no_data` esetén van kitöltve, ez adja a „mit logolj" mondat alanyát. `degenerate`-nél a konstans széria metrikája.
   - `lastRunAt` = a user statisztikai sorainak `max(lastDetectedAt)`-ja; `null` → „még nem futott".
6. **Lefedettség** — mind a 12 `MetricKey`-re, **az enum alapján, nem a katalógusból** (ha a `pairs` lista trimmelődik, a kiesett metrika lefedettsége attól még látszik, `pairCount = 0`-val): `coveredDays` a `[from, to]` részablakban, `windowDays = lookbackDays`, `lastDayWithData` (nullable), `pairCount` = hány katalógus-pár hivatkozik rá.

### 3.4 Controller

`CompanionController` új metódusa a generált `CompanionApi`-ból, `currentUserId.get()`-tel — a `listPatterns` mintájára. A switch kikapcsolva → a bean nem létezik → **404**, ami a FE `degraded` ága (pontosan mint a `usePatterns`).

### 3.5 Ismert, meghagyott furcsaság

A job a `lag=1`-es párok B-szériáját `to + 1` napig, azaz a **mai, részben logolt napig** olvassa, míg az A-széria tegnapig megy. Ez mai viselkedés; a monitor az ablakhatárok kiírásával **láthatóvá teszi**, de nem javítja. Ha zavarónak bizonyul → külön bd issue.

## 4. Kontraktus (`api/feature/companion/companion.yml` — először ez)

`GET /api/companion/pattern/monitor` · `operationId: patternMonitor` · `tags: [Companion]` · 200 / 401 (+ implicit 404 switch-off).

```yaml
PatternMonitorResponse:
  required: [windowFrom, windowTo, lookbackDays, minN, cron, pairs, metrics]
  windowFrom, windowTo: date
  lookbackDays, minN: integer
  cron: string                      # a config echója — a szabályok nem rejtőznek a YAML-ben
  lastRunAt: date-time, nullable    # max(lastDetectedAt); null = még nem futott
  pairs:   [PatternMonitorPair]
  metrics: [PatternMetricCoverage]

PatternMonitorPair:
  required: [key, title, category, categoryLabel, lagDays,
             metricAKey, metricALabel, metricBKey, metricBLabel, verdict, alignedDays]
  key, title, category, categoryLabel: string   # category: ^(physiology|trigger|response)$
  lagDays, alignedDays: integer
  metricAKey/metricALabel, metricBKey/metricBLabel: string   # kulcs kebab-case, label HU
  verdict: string  # ^(live|few_days|no_data|degenerate|frozen)$
  missingDays: integer, nullable            # csak few_days
  bottleneckMetricKey: string, nullable     # few_days | no_data | degenerate
  r: number, nullable                       # live: élő számítás · frozen: a befagyott sor értéke
  n: integer, nullable
  p: number, nullable
  status: string, nullable                  # csak frozen: ^(confirmed|rejected)$

PatternMetricCoverage:
  required: [key, label, coveredDays, windowDays, pairCount]
  key, label: string
  coveredDays, windowDays, pairCount: integer
  lastDayWithData: date, nullable
```

A metrika-kulcsok a wire-on **kebab-case**-ek (`sleep-quality`), egyezően a `pairs` katalógus YAML-jével — nem a Java enum-nevek.

Generálás: `cd api/generate && npm run generate:api` → `cd frontend && pnpm generate:api`; a backend Java típusok a `generate-sources` fázisban jönnek.

## 5. Frontend

### 5.1 Route + belépő

- `features/insights/pages/tabs.ts` — 8. elem: `{ id: 'motor', to: '/insights/motor', label: 'Motor' }`. A `PHASE3_TAB_IDS` üres marad (mindkét módban látszik).
- `app/router.tsx` — az `insights` gyerekei közé `{ path: 'motor', element: <MotorPage /> }`.
- `PatternsPage` — az **üres** és a **degraded** állapot is kap egy „Miért nincs még minta? →" linket a `/insights/motor`-ra. A degraded ág ma zsákutca; ez a spec mellékhozadéka.

### 5.2 Fájlok (a frontend-konvenciók szerint)

| réteg | fájl |
|---|---|
| oldal | `features/insights/pages/MotorPage.tsx` (leaf `*Page`) |
| komponensek | `features/insights/components/GateVerdictRow.tsx` · `MetricCoverageRow.tsx` — tisztán prezentációs, propokból élnek, **nem** importálnak `@/data/*`-ot |
| adat | `data/insights/monitorApi.ts` (típusok az `api.gen.ts`-ből) · `data/insights/monitorHooks.ts` → `usePatternMonitor()` |
| barrel | `data/hooks.ts` — `usePatternMonitor` re-export |
| mock | `data/insights/insights.ts` → `patternMonitor` seed |

`usePatternMonitor()` a `useDualQuery` idiómát követi (queryKey `['pattern-monitor']`, `mockData`, `realFetch`, `realEmpty`), 404 → `degraded: true` — bájtra a `usePatterns` szerkezete.

### 5.3 A mock seed szándékosan vegyes

Demo/vizuál módban mind az öt verdikt látszódjon: **2 `live`**, **3 `few_days`** (különböző `missingDays`-szel), **1 `no_data`**, **1 `degenerate`**, **1 `frozen`** — a 8 katalógus-pár valódi kulcsaival/címeivel —, plusz a 12 metrika lefedettsége 0 és 58 nap között szórva. A seed **nem** szolgál real-módú fallbackként (konvenció).

### 5.4 Oldal-anatómia

A szomszédos Insights lapok token-készletével (`card` / `eyebrow` / chip, `--lav-deep` akcent, `--wash-lav` blokk-háttér) — **új token nélkül**. Fentről le:

1. **Motor-állapot fejléc** — ablak (`2026-06-13 – 2026-08-10`, `{lookbackDays} nap`), `min. {minN} illeszkedő nap`, az **ütemezés a nyers cron-kifejezéssel** mono szedéssel (`0 40 2 * * *` — a FE nem parse-ol cront, mert abból csak félreértelmezés lenne), és az utolsó tényleges futás (`lastRunAt` relatív alakban, vagy „még nem futott").
2. **Párok** — 8 sor: verdikt-chip + pár-cím + a metrika-pár lag-jelöléssel (`alvásminőség → edzés-RPE · +1 nap`) + a származtatott magyar mondat + a nyers chipek (`n=5/8`, `r=−0.42`, `p=0.031`). **Rendezés: `live` → `few_days` (kevesebb hiányzó nap előre) → `degenerate` → `no_data` → `frozen`** — ez a „mi van legközelebb az áttöréshez" sorrend, ettől lesz az oldal cselekvésre váltható, nem számfal.
3. **Metrika-lefedettség** — 12 sor mini-sávval (`coveredDays / windowDays`), utolsó adatnap, `{pairCount} párban szerepel`. **Legkevésbé lefedett elöl** (az a hasznos információ); a `pairCount = 0` metrikák halványan a lista végén.

Őszinte állapotok: `lastRunAt == null` → „még nem futott" (nem hamis dátum); `r`/`p` csak `live`/`frozen` sorokon jelenik meg; `lastDayWithData == null` → „—"; `degraded` → a `PatternsPage`-dzsel azonos hangú kártya („A minta-motor most nem elérhető").

## 6. Tesztelés

**Backend**
- `PatternGateTest` — tiszta egységteszt a [`PearsonCorrelationTest`](../../../backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/PearsonCorrelationTest.java) precedensével: mind a 4 `Verdict`-ág (`LIVE`, `FEW_DAYS`, `NO_DATA`, `DEGENERATE`) + a lag-illesztés helyessége.
- `CompanionPatternMonitorApiIT extends ApiIntegrationTest` — `ownerAuthHeaders()` + populátorok úgy vetve, hogy egy pár `live`, egy `few_days`, egy `no_data`, és egy (`PatternPopulator`-ral `confirmed`-re állított) `frozen` legyen. Assertek: verdiktek, `missingDays`, `bottleneckMetricKey`, a lefedettség-számok, `windowFrom/To`, `minN`, `lastRunAt`.
- **Konzisztencia-assert** ugyanitt: amit a monitor `live`-nak mond, arra a `PatternDetectionService.detect()` ténylegesen perzisztál sort (és amit `few_days`-nek, arra nem) — ez őrzi meg a spec ígéretét, hogy a monitor nem hazudhat.
- `CompanionPatternMonitorSwitchOffIT` — a végpont 404 kikapcsolt companion switch mellett (házi kötelező).
- Új domain-tábla nincs → a `ResetDatabase` TRUNCATE-lista **nem** változik.

**Frontend**
- `data/insights/monitorHooks.test.tsx` — mock seed / real fetch / 404 → `degraded`.
- `features/insights/pages/MotorPage.test.tsx` — a három blokk renderelése, a verdikt-sorrend, a lefedettség-sorrend, a degraded és a „még nem futott" állapot.
- `PatternsPage.test.tsx` — kiegészítés: az üres és a degraded állapot linkel a `/insights/motor`-ra.

**Kapuk:** `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` · `cd backend && ./mvnw clean test` · self-PR → CI zöld → `--no-ff` merge.

## 7. Dokumentáció

- [`docs/features/insights.md`](../../features/insights.md) — a 8. tab, a `/insights/motor` route, a `MotorPage` + a két komponens a fájltérképbe, a `usePatternMonitor` hook, a `PatternsPage` új linkje.
- [`docs/features/companion.md`](../../features/companion.md) — a `PatternGate` kiemelés (a V3.1 motor szerkezete), az 5 verdiktes kapu-modell, az új endpoint az endpoint-táblába, és a „monitor = ugyanaz a kapu, írás nélkül" seam.
- `node scripts/lint-docs.mjs` a staleness-flag tisztázásához.

## 8. Nem-scope (tudatosan kihagyva)

- **„Futtasd most" POST trigger** — az élő monitor úgyis megmutatja, mit döntene a job; egy író végpont (auth, idempotencia, hiba-ág) külön scope.
- **Verdikt-történet** — nincs új tábla, nincs időbeli trend; a monitor mindig a *mostot* mutatja.
- **A pár-katalógus szerkesztése UI-ból** — a `mezo.companion.patterns.pairs` YAML marad az igazságforrás.
- **A `lag=1` B-ablak mai napig nyúlásának javítása** (§3.5) — láthatóvá tesszük, nem javítjuk.
- **A V3.2 `ai_hypothesis` sorok monitorozása** — a monitor a *statisztikai* katalógusról szól.
- **Confidence/kritika-mezők** — a statisztikai sorok `confidence`-e szándékosan `null` (őszinte kis-`n`); a monitor sem talál ki százalékot.
