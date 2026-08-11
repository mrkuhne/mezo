# Pattern engine monitor — átláthatósági al-oldal (design)

**Dátum:** 2026-08-11 · **Státusz:** approved design (brainstorm session)
**Kapcsolódó:** [`companion.md`](../../features/companion.md) (V3.1 pattern engine),
[`insights.md`](../../features/insights.md) §2.1 (PatternsPage),
`2026-07-04-companion-v31-statistical-patterns.md` (a motor eredeti terve).

## 1. Probléma

Egy hónapnyi élő használat után csak ~2 minta látszik a Minták fülön, és a felületről nem
derül ki, *miért*: a motor 8 metrikapárt figyel szigorú kapukkal (min-n=8 igazított nap,
nulla-variancia kizárás, lag-igazítás), de a felhasználó csak a túlélőket látja. Nem látszik:

- **mit** gyűjtünk (a 12 metrika és forrásaik),
- **mennyi** adat van metrikánként a 60 napos ablakban,
- **páronként hol akad el** a kapu (kevés igazított nap? konstans sorozat? nincs adat?).

A cél egy monitoring/debug al-oldal, ami érdekességként és diagnosztikaként is szolgál.
(A tágabb memória-láthatóság — L1 összefoglalók, pgvector, tény-provenancia — külön spec:
memória-obszervatórium; a katalógus-bővítés szintén külön spec.)

## 2. Cél / nem cél

**Cél:** a Minták fül alól elérhető al-oldal, ami élőben mutatja páronként a kapu-állapotot
és metrikánként a lefedettséget — backend introspekciós endpointból.

**Nem cél:** új metrikák/párok (katalógus-spec), job-futás történeti napló (nincs új tábla),
a nyers napi értékek kilistázása (a 60 napos jelenlét-heatmap tudatosan kimaradt a v1-ből),
L1/pgvector láthatóság (obszervatórium-spec).

## 3. Architektúra-döntés

**Élő számítás lekéréskor** (nem éjjeli perzisztálás, nem FE-kompozíció): a
`GET /api/companion/pattern/monitor` híváskor futtatja le ugyanazt az igazítási logikát,
amit az éjjeli job, upsert nélkül. Egy userre 12 sorozat-olvasás — olcsó, mindig a mostani
állapotot mutatja (a ma logolt adat azonnal látszik a számlálókban), nincs migráció.
A nap közbeni számok ezért ELTÉRHETNEK a legutóbbi job-futáskor látottaktól — ez feature,
nem bug (a „miért nem nő?" kérdésre a friss állapot a válasz).

## 4. Contract (contract-first — `api/feature/companion/companion.yml` bővül ELŐSZÖR)

`GET /api/companion/pattern/monitor` → 200 `PatternMonitorResponse` · 401 · 404 (companion
switch off — a meglévő pattern-endpoint minta).

```yaml
PatternMonitorResponse:
  config:
    lookbackDays: int        # mezo.companion.patterns.lookback-days (60)
    minN: int                # mezo.companion.patterns.min-n (8)
    windowFrom: date         # ma-1 - (lookbackDays-1)
    windowTo: date           # ma-1 (lezárt napok)
  lastDetectedAt: instant|null   # max(pattern.last_detected_at) a user statisztikai sorain
  metrics:                   # mind a 12 MetricKey, katalógus-sorrendben
    - key: string            # pl. sleep-quality (a config-oldali kebab kulcs)
      labelHu: string        # „alvásminőség"
      sourceHu: string       # „Alvás (Me)" — új MetricKey mező
      daysWithData: int      # hány napon van adat az ablakban
      lastDataDate: date|null
  pairs:                     # mind a 8 katalógus-pár
    - key: string
      title: string
      category: string       # physiology|trigger|response
      categoryLabel: string
      metricA: string        # metrics[].key hivatkozás
      metricB: string
      lagDays: int
      daysA: int             # metricA napjainak száma az A-ablakban
      daysB: int             # metricB napjainak száma a lag-eltolt B-ablakban
      alignedN: int          # igazított (mindkét oldalon létező) napok
      verdict: live | below_min_n | constant_series | no_data
      pattern:               # null, ha nincs perzisztált sor ehhez a párhoz
        { status, r|null, n|null, p|null, lastDetectedAt }
```

**Verdikt-logika** (sorrendben): bármelyik sorozat üres → `no_data`;
`alignedN < minN` → `below_min_n`; a `PearsonCorrelation.correlate` üres Optional
(nulla variancia / n<3) → `constant_series`; különben `live`. A monitor r/p-t NEM számol ki
a válaszba a `live` verdikthez — a statisztika a perzisztált `pattern` sorból jön (ha van);
a monitor nem előzi meg a jobot fabrikált friss számokkal.

## 5. Backend

- **`PatternMonitorService`** (`feature/companion/service`, `@ConditionalOnProperty` a
  companion switch-re, mint a többi): csak olvas. A pár-igazítás (A-sorozat + lag-eltolt
  B-sorozat + igazított párok kigyűjtése) a `PatternDetectionService.detectPair`-ből kikerül
  egy közös package-private helperbe (pl. `PairAlignment.align(seriesA, seriesB, lagDays)`
  → aligned `List<double[]>` + a két napszám), amit a detektálás és a monitor is használ —
  a monitor garantáltan ugyanazt számolja, mint a job.
- **`MetricKey`** kap egy `sourceHu` mezőt a `labelHu` mintájára (Alvás/Me, Sport+futás/Train,
  Gym/Train, Étkezés/Fuel, Gyógyszer/Me, Víz/Fuel, Súly/Me, Check-in/Today).
- **Config-kulcs ↔ enum:** a válasz `key` mezői a config-oldali kebab-case kulcsok
  (`sleep-quality`), ahogy a `pairs` katalógus hivatkozik rájuk — a Spring binding már ismeri
  a kebab→enum leképezést, a monitor ugyanazt a konverziót használja kifelé.
- **Controller:** a pattern-endpointok mellé, a generált `<Tag>Api` interfész implementálásaként,
  `api.dto` modellekkel; mapper a `CompanionMapper`-ben.
- `lastDetectedAt` = a user statisztikai pattern-sorainak max `last_detected_at`-ja
  (repository max-query); nincs külön job-run tábla.

## 6. Frontend

- **Route:** új leaf `/insights/motor` → `PatternMonitorPage`
  (`features/insights/pages/PatternMonitorPage.tsx`); az al-nav chip-sor NEM bővül.
- **Belépési pont:** a `PatternsPage` fejlécének jobb oldalán a `min. 65% conf` eyebrow
  helyére `Link` a `/insights/motor`-ra (pulzus-ikon + „motor-státusz"); a conf-küszöb
  magyarázat a monitor-oldal fejlécébe költözik.
- **Hook:** `usePatternMonitor()` az új `data/insights/patternMonitorHooks.ts`-ben,
  `useDualQuery` (`['patternMonitor']` kulcs): mock módban kézzel írt seed-diagnosztika
  (a 3 mock mintához konzisztens számokkal), élesben a monitor endpoint; 404 → `degraded`.
  Re-export a `data/hooks.ts` barrelből.
- **UI (két blokk + fejléc):**
  - Fejléc: ablak (from–to), min-n, conf-küszöb, utolsó észlelés ideje.
  - **Párok:** páronként kártya — cím, két metrika-chip napszámmal
    („alvásminőség · 22 nap"), igazított számláló („5/8 igazított nap"), színkódolt
    verdikt-chip: `él` (success) / `gyűjtés alatt` (warning) / `konstans adat — nincs szórás` /
    `nincs adat` (tertiary); élő párnál r·n·p chipek + minta-státusz badge.
  - **Metrika-lefedettség:** 12 sor — magyar címke, forrás, `N/60 nap`, utolsó adat dátuma.
  - Degraded: a PatternsPage-szel azonos hangvételű őszinte kártya.

## 7. Tesztek

- **Backend** (`ApiIntegrationTest`): populátorral felépített ismert adathalmazból elvárt
  `daysWithData`/`alignedN`/verdiktek páronként (legalább: egy `live`, egy `below_min_n`,
  egy `constant_series`, egy `no_data` eset); üres user → minden pár `no_data`, minden
  metrika 0 nap; switch off → 404.
- **Frontend** (vitest, mindkét mód): a page rendereli mindkét blokkot a hook adataiból;
  mock seed konzisztencia; degraded állapot.

## 8. Docs-hatás

`companion.md` (pattern engine szakasz: monitor endpoint + service), `insights.md` §2.1
(PatternsPage belépési pont + az új al-oldal), contract regen mindkét oldalon
(`api/generate` + FE `generate:api` + backend `generate-sources`).

## 9. Kapcsolódó, külön specek

- Katalógus-bővítés (új MetricKey-k + párok) — külön spec.
- Memória-obszervatórium (L0→L3 + pgvector láthatóság) — külön spec; a monitor endpoint
  annak egyik építőköve lesz.
