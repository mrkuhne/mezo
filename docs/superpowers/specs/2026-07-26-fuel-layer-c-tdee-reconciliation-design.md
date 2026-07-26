# Fuel „Layer C" — goal-engine + Me TDEE összehangolás (dinamikus maintenance) — design spec

- **Date:** 2026-07-26 · **bd:** `mezo-eujg` · **Parent slice:** `mezo-1oy5` ([`2026-07-26-fuel-dynamic-day-plan-design.md`](2026-07-26-fuel-dynamic-day-plan-design.md) §10 — ott out-of-scope volt, ez az) · **Related:** `mezo-6r1` (Fuel roadmap)
- **Decided with Daniel in-session (2026-07-26):** MET×kg×óra a backendben (a FE `fuelConfig` tükre); a Me „Alap-TDEE" kártya **bontott** (Alaphő + Betábl. mozgás + Fenntartó); 3 tiszta NEAT-band új enummal (`DESK`/`MIXED`/`PHYSICAL`); a heti-EAT logika **train-portban** él; **auto re-evaluate** migráció után; a kontraktus `pal`→`neat` átnevezés; a régi session-kcal `Met` record **nyugdíjazása**. A fizikailag őszinte modellt választva (a heti drift vállalva — a `GoalProjectionService` a megfigyelt súlytrendet használja gerincként, tehát a trajektória önkorrigál).
- **Scope:** backend (train-port + goal-engine + migráció + auto re-evaluate) + kontraktus (`api/`) + frontend (`deriveDailyBudget` + Me-kártya/sheet) + vizuális goldenek. Ez a `mezo-1oy5` A/B rétegének backend-oldali párja.

## 1. Cél

A `mezo-1oy5` óta a Fuel „Mai" napi kcal-budget **dinamikus, de csak a frontenden** (`deriveDailyBudget`: `BMR×NEAT + Σ MET-mozgás + balance`). A **backend goal-engine még statikus `BMR×PAL`-t** számol, és a Me-oldali „Alap-TDEE" kártya is statikus. Így a **Me-projekció és a Fuel napi cél KÜLÖNBÖZŐ aktivitás-modellt** használ → nem egy történetet mondanak.

Ez a slice a maintenance-t **`BMR×NEAT + heti betáblázott EAT`-re** állítja át a backenden is (ugyanaz a MET-modell, mint a FE napi célja), **explicit `dailyEnergyBalance`-t** tesz a kontraktusra (a FE `segment.kcal − tdee` közelítése helyett), a Me „Alap-TDEE" kártyát **dinamikus + bontott** nézetté teszi, és az `activityLevel`-t **NEAT-életmód-sávvá** értelmezi újra.

## 2. A gyökér-diszkrepancia (miért nem egy történet ma)

| # | Tünet | Ok |
|---|---|---|
| D1 | A Me „Alap-TDEE" statikus, a Fuel napi cél dinamikus | `TdeeBootstrapService`: `tdee = BMR × PAL(activityLevel)` — az edzés a szorzóba van „elrejtve", sosem néz az aznapi vagy a betáblázott mozgásra. |
| D2 | A backend csak a **futásra** dinamikus, a röplabdára/gymre nem | `GoalProjectionService`: `tdeeEstimate = bootstrap.tdee + runDelta` (csak `intervalRunKcal×session/hét ÷7`); meso = 0 delta; röplabda = ambiens (nem plan-link → kimarad). |
| D3 | **Rejtett futás-dupla a FE-n** | A FE közelítése `balance = segment.kcal − tdeeBootstrap.tdee`. Mivel `segment.kcal = bootstrap.tdee + runDelta + dailyEnergyBalance`, ez valójában `runDelta + dailyEnergyBalance`. Futás-napon a FE **kétszer** számolja a futást: a `runDelta`-n át a „balance"-ben, és a `MET(run 9.5)` aznapi EAT-jében. |
| D4 | A `dailyEnergyBalance` a backendben megvan, de **nincs a wire-en** | `GoalProjectionService.dailyEnergyBalance(...)` privát; a kontraktus csak `segment.kcal`-t (=target) és `tdeeBootstrap.tdee`-t (=BMR×PAL) tesz ki → a FE kénytelen közelíteni. |

## 3. Döntések (in-session, NE litigáld újra)

| # | Döntés | Választás |
|---|---|---|
| ① | MET-modell a heti EAT-hez | **MET×kg×óra** (a FE `fuelConfig` tükre); a projekció `runDelta`-ja átíródik |
| ② | `tdeeBootstrap` / Me-kártya | **Bontott**: külön `neat`-baseline + `weeklyEatKcalPerDay`, a Me-kártya `Alaphő · Betábl. mozgás · Fenntartó` bontással (a Fuel cél-kártyával konzisztens nyelven) |
| ③ | NEAT-band + enum | **3 tiszta életmód-band, új enum**: `DESK 1.20` / `MIXED 1.35` / `PHYSICAL 1.50` (az edzés SEHOL a címkékben — az a betáblázott EAT-ben) |
| ④ | Ownership | **Train-port**: `WeeklyScheduledActivityService` a train domainben (a train birtokolja a schedule-t + MET-modellt), a goal-engine injektálja; a Fuel is újrahasználhatja később |
| ⑤ | Migráció / visszafelé-kompat | **Auto re-evaluate**: `ApplicationReadyEvent` runner újra-evaluate-el minden nem-archived goalt → a FE közelítés-kód **törölhető** |
| ⑥ | Kontraktus `pal` mező | **Átnevezés `neat`-re** (a jelentés NEAT-szorzó; a FE együtt frissül) |
| ⑦ | Régi session-kcal `Met` record | **Nyugdíjazás** (`intervalRunKcal` csak a projekció runDelta-jában él; a többi mező holt konfig) — egyetlen MET-modell a backendben |

## 4. A modell (a mag)

```
neatBaseline      = BMR × NEAT(activityLevel)                        // életmód-alaphő; DESK 1.20 / MIXED 1.35 / PHYSICAL 1.50
weeklyEatPerDay   = ( Σ_schedule  MET(kind) × kg × (durationMin/60) ) ÷ 7   // heti betáblázott gym+sport+futás, napi átlag
maintenance       = neatBaseline + weeklyEatPerDay                   // = tdeeBootstrap.tdee (a teljes fenntartó)
dailyEnergyBalance = sign(trajectory) × rateTargetPctPerWeek/100 × kg × kcalPerKg ÷ 7   // VÁLTOZATLAN, TDEE-független
segment.kcal      = maintenance(szegmens) + dailyEnergyBalance       // a projekció targetKcal-ja
```

**Miért nincs dupla:** a `PAL` egyetlen szorzójából három **explicit, tételes** komponens lesz. Az edzés a `weeklyEatPerDay`-ben van, **nem** a szorzóban. A `dailyEnergyBalance` kizárólag a súlyváltozás-ütemből jön (aktivitás-független), és mostantól **explicit a wire-en** — a FE nem közelíti, így a D3 futás-dupla megszűnik.

**Szegmens-változékonyság:** a gym+sport heti recurring (állandó minden szegmensben), a **futás/meso szegmensfüggő** (goal plan-linkek). A `bootstrap` a **jelenlegi** teljes betáblázást tükrözi (Me-kártya = pillanatkép); a projekció szegmensenként a jövőbeli futás-be/kikapcsolást viszi a `weeklyEatPerDay`-en át (a régi `runDelta` helyén).

### 4.1 Ellenőrző-számok (BMR 1720, súly 78,6, MIXED 1.35; illusztratív betáblázás)
Betáblázás: 3× gym 60p @6.0 + 2× röpi 120p @4.5 + 2× futás 45p @9.5.
| Tétel | Számítás | Érték |
|---|---|---:|
| `neatBaseline` | 1720 × 1,35 | **2322** |
| gym heti | 6,0 × 78,6 × 1,0 × 3 | 1415 |
| röpi heti | 4,5 × 78,6 × 2,0 × 2 | 1415 |
| futás heti | 9,5 × 78,6 × 0,75 × 2 | 1120 |
| `weeklyEatPerDay` | (1415+1415+1120) ÷ 7 | **~564** |
| `maintenance` (Fenntartó) | 2322 + 564 | **~2886** |
| `dailyEnergyBalance` (cut, 0,7%/hét) | változatlan | **−516** |

> A régi `BMR×PAL(1.55) = 2666`-hoz képest a Fenntartó **feljebb megy** (~2886), mert a valós 7-session/hét betáblázás intenzívebb, mint amit a `MODERATE` PAL feltételezett — pontosan ez a fizikailag őszinte modell lényege. A konkrét szám a te tényleges `GymScheduleSlot`/`SportScheduleSlot`/running betáblázásodból jön; a plan-fázisban a valós seed-adaton hitelesítjük (a NEAT/MET értékek a §6.5/§6.1 property-defaultok).

## 5. Kontraktus-változások (`api/feature/goal/goal.yml` + `biometrics-profile.yml`)

**`TdeeBootstrap`** — a backend számol, a FE csak rajzol (self-explaining, redundancia szándékos):

| mező | ma | C réteg után |
|---|---|---|
| `bmr` | van | marad |
| `pal` | van | **→ `neat`** (átnevezve; szorzó, pl. `1.35`) |
| — | — | **+ `neatBaselineKcal`** (`= bmr × neat`, a Me-bontáshoz) |
| — | — | **+ `weeklyEatKcalPerDay`** (betáblázott mozgás napi átlaga) |
| `tdee` | `BMR×PAL` | **= `neatBaselineKcal + weeklyEatKcalPerDay`** (a teljes maintenance) |
| `formula`, `computedAt` | van | marad |

**`GoalPrescriptionSegment`** — **+ `dailyEnergyBalanceKcal`** (előjeles integer; a projekció már számolja `balance`-ként). A szegmens-`tdeeEstimateKcal`-t **nem** tesszük ki (YAGNI — a Fuel a `neatBaseline`-t a bootstrap-ból, a napi EAT-et FE-n, a balance-t innen olvassa; a szegmensenkénti maintenance-nézet jövőbeli bővítés).

**`biometrics-profile.yml`** — `activityLevel` enum `[SEDENTARY, LIGHT, MODERATE, VERY, EXTRA]` **→ `[DESK, MIXED, PHYSICAL]`**; a hint/leírás nem-edzés életmódra.

**Kontraktus-workflow:** `api/feature/goal/goal.yml` + `biometrics-profile.yml` szerkesztése → `cd api/generate && npm run generate:api` → `cd frontend && pnpm generate:api` (FE típusok) → a backend Java típusok `./mvnw generate-sources`-nál. Contract-first: a YAML előbb, a kód utána.

## 6. Backend

### 6.1 Train-port — `WeeklyScheduledActivityService` (`feature/train/.../service/`)
- **Felelősség:** a heti betáblázott aktivitás-energia napi átlaga (`kcal/nap`), MET×kg×óra alapon. A train birtokolja a schedule-t + a MET-modellt.
- **Input:** `userId`, `weightKg` (paraméter — a train nem birtokolja a súlyt, ahogy a `TdeeBootstrapService` is `currentWeightKg`-t kap), opcionálisan a szegmensben aktív running-blokk azonosítója/kontextusa a szegmens-bontáshoz.
- **Olvassa:** `GymScheduleSlotRepository` (heti gym-napok; **nincs `durationMin`** a gym-sloton → **default 60 perc** config-konstans, a FE `DEFAULT_BLOCK_MIN`-nel egyezően), `SportScheduleSlotRepository` (`durationMin` + `kind` training|match + `sport`), és a running blokk heti sessionjeit (a `RunningBlockStructure.weeks[].sessions`; interval → default futás-perc).
- **MET-tábla:** új `@Validated TrainProperties` (`mezo.train.met`), a FE `fuelConfig.MET_BY_KIND` **tükre** (`gym 6.0 / sport 4.5 / run 9.5 / default 5.0`).
- **Output:** `weeklyEatPerDay` (kcal/nap), bonthatóan „állandó (gym+sport)" + „szegmensfüggő (running)" részre, hogy a projekció szegmensenként finomíthasson.
- **House-standard:** konstruktor-injektált, method-szintű `@Transactional(readOnly)` ahol olvas; a repók ownership-ellenőrzött, soft-delete-aware finderek (a meglévő train-repo minta).

### 6.2 `TdeeBootstrapService` (goal-engine)
- `props.pal().forLevel(...)` → `props.neat().forLevel(...)` (3 band; default `MIXED` az ismeretlen/null helyett).
- `compute(profile, currentWeightKg, weeklyEatKcalPerDay)` — a `weeklyEat`-et **paraméterként** kapja (a service tiszta/repo-mentes marad; az orchestrator hívja a train-portot és adja át). `tdee = bmr×neat + weeklyEat`. A `TdeeBootstrapJson` bővül: `neat`, `neatBaselineKcal`, `weeklyEatKcalPerDay`.

### 6.3 `GoalProjectionService` (goal-engine)
- A `runDelta` (session-kcal, `intervalRunKcal×session/7`) **kivezetése**. Szegmensenként: `tdeeEstimate = neatBaseline + weeklyEatPerDay(a szegmensben aktív futással)` — a gym+sport állandó, a running a szegmensben aktív plan-linkből (a train-port bontott outputjából). A `dailyEnergyBalance` a segment-re kerül (`GoalEvaluationService` folder-eli be a prescription-be `dailyEnergyBalanceKcal`-ként).
- A meso változatlanul **0 TDEE-delta** (a volumen-guard hatás, nem az energiáé); a röplabda immár **nem ambiens** — a `SportScheduleSlot` heti betáblázása expliciten beszámít.

### 6.4 `GoalEvaluationService` / `GoalEngineService` (orchestrátor)
- `GoalEngineService.evaluate`: a bootstrap + projekció ELŐTT meghívja a train-portot (`weeklyEatPerDay`), átadja a bootstrap-nak és a projekciónak.
- `GoalEvaluationService.assemble`: a `ProjectionSegment.balance`-t a `Segment.dailyEnergyBalanceKcal`-ba folder-eli.

### 6.5 `GoalEngineProperties`
- `Pal` record → `Neat` record (3 mező: `desk 1.20`, `mixed 1.35`, `physical 1.50`; `forLevel(String)` default `mixed`).
- A `Met` record + a `mezo.goal.met` yml-blokk **törlése** (nyugdíjazás — csak a projekció runDelta-ja használta; a MET-tábla átkerül a train `TrainProperties`-be).
- `application.yml`: `mezo.goal.pal` → `mezo.goal.neat`; új `mezo.train.met` blokk.

### 6.6 Migráció (Liquibase) + auto re-evaluate
- **Liquibase changeset** (`{YYYYMMDDHHMM}_mezo-eujg_reframe_activity_level_neat.sql`): a `ck_biometric_profile_activity_level` CHECK csere (`DESK|MIXED|PHYSICAL`); a meglévő sor(ok) remap: `SEDENTARY,LIGHT → DESK` · `MODERATE → MIXED` · `VERY,EXTRA → PHYSICAL`. (Ez adat-migráció létező soron — legitim SQL changeset, nem seed.)
- **Auto re-evaluate:** `@EventListener(ApplicationReadyEvent)` bean a goal feature-ben — a startup (Liquibase után) minden nem-archived goalra `GoalEngineService.evaluate` (idempotens; single-user → ~1 goal; a friss prescription hordozza az új `dailyEnergyBalanceKcal`-t + a `basis`/számok az új modellel). Így a FE mindig az explicit mezőt kapja → a közelítés-kód törölhető.

## 7. Frontend

- **`data/fuel/fuelConfig.ts`:** a `NEAT_BASELINE` konstans **kivezetése a hardkódból** — a FE a `tdeeBootstrap.neat`-ot használja (a backend a NEAT source of truth). A `MET_BY_KIND` marad (a napi EAT FE-oldali), de **drift-guard** köti a backend `TrainProperties.met`-hez (§9).
- **`features/fuel/logic/buildDayPlan.ts` (`deriveDailyBudget`):** `balance = segment.kcal − tdee` **törölve** → `segment.dailyEnergyBalanceKcal`; `maintenance = bmr × tdeeBootstrap.neat` (a hardkód `NEAT_BASELINE` helyett). A napi cél struktúrája (`base + activity + balance`, floored BMR) változatlan, tisztább inputokkal.
- **`data/fuel/timelineHooks.ts`:** a `deriveDailyBudget` hívás új inputjai (`neat`, `dailyEnergyBalanceKcal` a `currentSegment`-ből + a `tdeeBootstrap`-ból).
- **`features/me/logic/biometricFields.ts`:** `ActivityLevel = 'DESK'|'MIXED'|'PHYSICAL'`; `ACTIVITY_LEVELS` NEAT-értékekkel + nem-edzés címkékkel/hintekkel; `ACTIVITY_SHORT` frissítve; `palLabel` → `neatLabel`.
- **`features/me/components/BiometricCard.tsx`:** a bontott „Alap-TDEE" kártya — `Alaphő (NEAT) · Betábl. mozgás · Fenntartó` (a `tdeeBootstrap.neatBaselineKcal` + `weeklyEatKcalPerDay` + `tdee`-ből). Az „Aktivitás" stat a NEAT-band címkéjét + szorzóját mutatja.
- **`features/me/sheets/BiometricSheet.tsx`:** a 3-band életmód-választó (DESK/MIXED/PHYSICAL) az 5-PAL-szint helyett.
- **Vizuális goldenek:** Me/`BiometricCard` (darwin lokál + linux CI a baseline-workflow-val); Today/Fuel csak ha a szám ténylegesen változik.

## 8. Adatfolyam / plumbing

```
GymScheduleSlot ─┐
SportScheduleSlot ├─► WeeklyScheduledActivityService (train, MET×kg×óra) ─► weeklyEatPerDay
RunningBlock ────┘                                                            │
                                                                             ▼
biometricProfile + currentWeightKg ─► TdeeBootstrapService ─► tdeeBootstrap {bmr, neat, neatBaselineKcal, weeklyEatKcalPerDay, tdee}
                                                                             │
                                        GoalProjectionService (szegmensenként) ─► segment {kcal, dailyEnergyBalanceKcal, ...}
                                                                             │
                                            ┌────────────────────────────────┴───────────────┐
                                            ▼                                                  ▼
                              Me BiometricCard (bontott TDEE)                    FE deriveDailyBudget
                              = neatBaselineKcal + weeklyEatKcalPerDay      = bmr×neat + aznapi_MET_EAT + dailyEnergyBalanceKcal
```

A napi Fuel-cél **nem** függ a `weeklyEat`-től (az csak a maintenance/Me-kártya és a súly-trajektória bemenete) — a FE-nek a C rétegtől a `neat` (baseline szorzó) és a `dailyEnergyBalanceKcal` (explicit) kell.

## 9. MET drift-guard

A `MET×kg×óra` tábla **két helyen** él (FE `fuelConfig.MET_BY_KIND` + backend `TrainProperties.met`), mert a napi EAT tiszta FE-offline függvény, a heti EAT backend. Egy **drift-guard teszt** (a `contract-drift` CI-lépés szellemében) ellenőrzi az egyezést: a backend a MET-táblát egy stabil helyen exponálja (teszt-fixture vagy egy generált JSON), a FE-teszt ehhez asszertál. Eltérés → a Me-kártya (heti átlag) és a Fuel (napi) elcsúszna; a guard ezt CI-ben elkapja.

## 10. Tesztelés (gate)

**Backend (integration-first, `AbstractIntegrationTest`/`ApiIntegrationTest`, Testcontainers/fix `mezo_test`):**
- `WeeklyScheduledActivityService`: rest (0), csak-gym, gym+röpi, +futás heti-EAT; default gym-duration; ownership + soft-delete szűrés; új `*Populator` a schedule-slotokhoz, ha kell.
- `TdeeBootstrapService`: `neat` lookup (DESK/MIXED/PHYSICAL + default), `tdee = bmr×neat + weeklyEat`, `neatBaselineKcal`.
- `GoalProjectionService`: szegmens-maintenance a betáblázásból; futás szegmensfüggő; meso 0-delta; röplabda beszámít; `dailyEnergyBalanceKcal` a segmenten; determinizmus.
- Migráció: a remap (SEDENTARY/…→DESK/MIXED/PHYSICAL) + a CHECK-csere; az auto re-evaluate runner (IT: startup után a goal prescription friss + hordozza a `dailyEnergyBalanceKcal`-t).
- `GoalMapper`: az új `TdeeBootstrap`/`Segment` mezők leképezése.

**Frontend (mindkét mód zöld):**
- `deriveDailyBudget`: explicit `dailyEnergyBalanceKcal` (nincs `segment.kcal − tdee`), `neat` a bootstrap-ból, a rest/gym/big-day számok (§4.1), `KCAL_FLOOR`, makró-split — a `mezo-1oy5` tesztek átírva (a közelítés-ág törölve).
- `biometricFields`: 3-band NEAT; `BiometricCard` bontott render; `BiometricSheet` 3-választó.
- MET drift-guard (§9).
- **Gate:** `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`; backend `./mvnw clean test` (CI a mérvadó full-suite); vizuális goldenek; `docs/features/fuel.md` + a goal-engine/Me feature-doc frissítés + `node scripts/lint-docs.mjs`.

## 11. Edge case-ek

- **Nincs betáblázott aktivitás (pihenő-hét, üres schedule):** `weeklyEatPerDay = 0` → `maintenance = neatBaseline`. A Me-kártya „Betábl. mozgás +0"; a Fuel napi cél az aznapi EAT-ből (0 → BMR-padló).
- **Nincs biometriai profil:** a `GoalEngineService` graceful ága változatlan (nincs bootstrap, „profil szükséges" note) — a train-portot ekkor nem hívjuk (nincs súly/BMR).
- **Gym-slot duration hiánya:** default 60 perc (config), a FE `DEFAULT_BLOCK_MIN`-nel egyezően.
- **Stale prescription re-evaluate előtt:** az auto-runner a startupon frissít; archived goal nem forrás a Fuelnek → nem érinti.
- **Súly-változás:** a `neatBaseline` (BMR a súlyból) + a `weeklyEat` (kg-alapú MET) + a `dailyEnergyBalance` (kg-alapú) mind a jelenlegi súllyal számol — konzisztens a bootstrap-pillanatképpel.

## 12. Out of scope (később)

- **Adaptív TDEE-hurok** (megfigyelt súlytrend → valós maintenance visszaszámolás) — a MET-becslés hosszú távú hálója; a `GoalProjectionService` már részben erre támaszkodik (a spine a trend), a teljes hurok külön slice.
- **Szegmensenkénti maintenance-nézet a Me-n** (a `tdeeEstimateKcal` kitétele + egy timeline-vizualizáció) — most csak a `dailyEnergyBalanceKcal` kell a Fuelnek.
- **MET-finomítás:** táv/tempó-alapú futás-égés, match vs training sport-intenzitás megkülönböztetése, HR-alapú becslés.
- **Gym-slot `durationMin`** felvétele a schedule-be (a default 60p kiváltása) — külön Train-slice, ha a pontosság indokolja.
