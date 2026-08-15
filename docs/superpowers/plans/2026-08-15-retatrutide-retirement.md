# Retatrutid kivezetése — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A retatrutid mint hatóanyag nyomtalanul kikerül az appból (seed, DB-sorok, mock-tartalom, promptpéldák, UI-szöveg), a „reta" domain-névadás generikus gyógyszer-fogalmakra vált, a Fuel „Gyógyszer" tab pedig tartós, őszinte üres állapotba kerül.

**Architecture:** Kontraktus-first: az `api/feature/medication/medication.yml` mezőneve vezeti a backend és a frontend átnevezését. A gyógyszer-slice minden gépezete (entity, service, mapper, endpointok, hookok) **megmarad és generikus** — csak a névadás, a seedelt adat és a szövegek változnak. Két Liquibase changeset zárja a kört: az egyik a `pattern.pair_key`-t migrálja az átnevezett mintapárokra, a másik fizikailag törli a gyógyszer-sorokat.

**Tech Stack:** Java 21 / Spring Boot 4 / Liquibase / MapStruct (backend) · React 19 + TS + Vite + TanStack Query + MSW + Vitest (frontend) · OpenAPI 3.0.3 (kontraktus)

**Spec:** [`docs/superpowers/specs/2026-08-15-retatrutide-retirement-design.md`](../specs/2026-08-15-retatrutide-retirement-design.md) · **bd:** `mezo-lwmq` · **branch:** `feat/retire-retatrutide`

## Global Constraints

- **Kontraktus-first, mindig ebben a sorrendben:** `api/feature/<name>/<name>.yml` szerkesztése → `cd api/generate && npm run generate:api` → `cd frontend && pnpm generate:api`. A `api/openapi.yml` és a `frontend/src/data/_client/api.gen.ts` **generált** — soha ne szerkeszd kézzel.
- **A backend Java típusai** (`io.mrkuhne.mezo.api.dto.*`) a `./mvnw generate-sources` / `test` során automatikusan regenerálódnak — nincs kézi lépés.
- **Maven mindig `clean`-nel:** `cd backend && ./mvnw clean test` (a Lombok+MapStruct inkrementális fordítás megbízhatatlan).
- **A frontend mindkét módban zöld kell legyen:** `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`.
- **A backend integrációs tesztek** a `docker compose up -d` által futtatott fix `mezo_test` DB ellen mennek (`backend/docker-compose.yml`, Postgres a **15432**-es porton).
- **Liquibase:** changeset-fájlnév `{YYYYMMDDHHMM}_{bd-id}_{leírás}.sql` a `backend/src/main/resources/db/changelog/1.0.0/script/` alatt, és fel kell venni az `1.0.0_master.yml`-be. Kiadott changeset-et soha nem módosítunk.
- **Nyelv:** minden felhasználónak látszó szöveg magyar. A kódkommentek a fájl meglévő nyelvét követik (a repo túlnyomórészt angol kommenteket használ magyar UI-szövegekkel).
- **Commit-formátum:** conventional subject a driving bd id-val, pl. `refactor(medication): retaDay -> cycleDay a kontraktusban (mezo-lwmq)`.
- **Az `rx-terms` lista (`application.yml`, `mezo.companion.advisors.rx-terms`) VÁLTOZATLAN marad.** Ez a `ClinicalOutputCheck` őrének szótára, nem felhasználói adat. Ez a terv egyetlen helye, ahol a „retatrutid" szó a kódban maradhat.
- **A befagyasztott dokumentumokhoz nem nyúlunk:** `docs/superpowers/specs/*` (a §Task 8-ban létrehozott újat kivéve), `docs/superpowers/plans/*` (ezt a fájlt kivéve), `docs/old docs/*`, `docs/design/ux-*.html`.

---

### Task 1: A ciklusnap-mező átnevezése végig a kontraktuson (`retaDay` → `cycleDay` / `medCycleDay`)

Ez egy end-to-end mechanikus átnevezés. Azért **egy** task, mert a generált `api.gen.ts` és a generált Java DTO egyszerre változik: a backend fele a frontend fele nélkül nem fordul, tehát külön nem lenne zöldre hozható.

**Files:**
- Modify: `api/feature/medication/medication.yml` (a `MedicationCycleResponse` séma + a tag leírása)
- Generated (ne szerkeszd kézzel): `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`
- Modify (backend): `backend/src/main/java/io/mrkuhne/mezo/feature/medication/service/dto/MedicationCycle.java`, `.../medication/service/MedicationCycleService.java`, `.../medication/mapper/MedicationMapper.java`, `.../companion/tools/MedicationTools.java`, `.../companion/service/ContextSnapshotAssembler.java:451,455`, `.../companion/service/DailySummaryService.java:193,201`, `.../companion/service/MetricSeriesService.java:301,310-312`, `.../notification/service/AnchorResolver.java:211,217`
- Modify (frontend): `frontend/src/data/types.ts:228,254,270`, `frontend/src/data/today/todayHooks.ts:35-48,107`, `frontend/src/data/today/today.ts:14`, `frontend/src/data/fuel/medicationHooks.ts`, `frontend/src/features/fuel/pages/FuelMedicationPage.tsx:12,102`, `frontend/src/features/fuel/pages/FuelPlanPage.tsx:26,98,101`, `frontend/src/features/me/pages/NotificationsPage.tsx:60,90,149,160,161`, `frontend/src/features/me/logic/notificationForecast.ts:25`, `frontend/src/features/fuel/sheets/LogDoseSheet.tsx:5`
- Test (backend): `backend/src/test/java/io/mrkuhne/mezo/feature/medication/MedicationApiIT.java`, `.../feature/companion/ContextSnapshotAssemblerIT.java`, `.../feature/companion/tools/CompanionToolsRenderIT.java`
- Test (frontend): `frontend/src/data/hooks.test.tsx`, `frontend/src/data/fuel/medicationHooks.test.tsx`, `frontend/src/features/fuel/pages/FuelMedicationPage.test.tsx`, `frontend/src/features/fuel/sheets/LogDoseSheet.test.tsx`, `frontend/src/features/me/logic/notificationForecast.test.ts`, `frontend/src/test/msw/handlers.ts`

**Interfaces:**
- Produces: `MedicationCycle` record új komponens-neve **`cycleDay()`** (Java), `MedicationCycleResponse.getCycleDay()` (generált DTO), `MedicationCycle.cycleDay` (TS interface), `TodayMeta.medCycleDay` + `TodayScenario.medCycleDay` (TS), és a `?medCycleDay=` URL-paraméter. Minden későbbi task ezeket a neveket használja.

- [ ] **Step 1: A kontraktus átnevezése**

`api/feature/medication/medication.yml` — a `MedicationCycleResponse` sémában:

```yaml
    MedicationCycleResponse:
      type: object
      required: [cycleDay, phaseKey, phaseLabel, week]
      properties:
        cycleDay: { type: integer }
        phaseKey: { type: string }
        phaseLabel: { type: string }
        lastDoseAt: { type: string, format: date-time, nullable: true }
        week:
          type: array
          items: { $ref: '#/components/schemas/MedicationCycleCell' }
```

Ugyanebben a fájlban a `tags[0].description` szövegében `(retaDay + phase)` → `(cycleDay + phase)`.

- [ ] **Step 2: Kontraktus-generálás**

```bash
cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api
```

Ellenőrzés: `grep -c 'cycleDay' ../api/openapi.yml src/data/_client/api.gen.ts` — mindkettőben legalább 1 találat, és `grep -c 'retaDay' ../api/openapi.yml src/data/_client/api.gen.ts` → 0.

- [ ] **Step 3: Backend — a service-réteg record átnevezése**

`MedicationCycle.java`: a record első komponense `int retaDay` → `int cycleDay`, és a javadocban a `{@code retaDay}` → `{@code cycleDay}`.

```java
public record MedicationCycle(
    int cycleDay, String phaseKey, String phaseLabel, Instant lastDoseAt, List<Cell> week) {

    /** One day-cell of the cycle strip: its 1-based {@code day}, its phase, and whether it is "now". */
    public record Cell(int day, String phaseKey, String label, boolean current) {}
}
```

- [ ] **Step 4: Backend — a hívási helyek átírása**

Minden `cycle.retaDay()` → `cycle.cycleDay()`, és a `MedicationMapper.toCycleResponse` buildere `.retaDay(c.retaDay())` → `.cycleDay(c.cycleDay())`. A `MedicationTools.renderAll` a generált DTO-t olvassa: `cycle.getRetaDay()` → `cycle.getCycleDay()`. A `MedicationCycleService` javadocjában a `retaDay` említések is `cycleDay`-re. A `MetricSeriesService:310-312` lokális változója `int retaDay` → `int cycleDay`.

Gépi ellenőrzésre alkalmas parancs a task végén:

```bash
rg -n 'retaDay|getRetaDay' backend/src
```

Elvárt: nulla találat.

- [ ] **Step 5: Backend tesztek futtatása**

```bash
cd backend && ./mvnw clean test
```

Elvárt: PASS. Ha egy IT `retaDay` JSON-mezőre assertál (`MedicationApiIT`, `ContextSnapshotAssemblerIT`, `CompanionToolsRenderIT`), írd át `cycleDay`-re.

- [ ] **Step 6: Frontend — a típusok átnevezése**

`frontend/src/data/types.ts`:

```ts
export interface MedicationCycle {
  cycleDay: number; phaseKey: string; phaseLabel: string
  lastDoseAt?: string | null
  week: MedicationCycleCell[]
}
```

```ts
export interface TodayMeta { dayLabel: string; dateLabel: string; workoutType: string; workoutTime: string; medCycleDay: number; mesoPhase: string }
```

```ts
export interface TodayScenario {
  dayState: DayState; medCycleDay: number; niggle: boolean; vulnerable: boolean; anchorMode: boolean
  /** `?ritual=` demo override (mezo-ilsj) — wins over RitualCard's derived waiting/open/done state. */
  ritual: 'waiting' | 'open' | 'done' | null
}
```

- [ ] **Step 7: Frontend — a `useTodayScenario` átírása**

`frontend/src/data/today/todayHooks.ts` — a kommentet is frissítsd, mert a „Reta surface" megfogalmazás elavul. Az URL-paraméter `?retaDay=` → `?medCycleDay=`, kompatibilitási alias **nélkül** (spec §9). A mock-fallback logika ebben a taskban még változatlan marad — azt a Task 5 bontja le.

```ts
  // The medCycleDay base is the real medication cycle in real mode (the single FE source every
  // medication surface reads), the mock default in mock mode. cycle.cycleDay is 0 when there is no
  // medication / no dose (the ghost, or the cold-load window) → fall back to today.medCycleDay so
  // nothing ever shows a 0 day. The ?medCycleDay= URL override stays TOP priority in BOTH modes.
  const { cycle } = useMedication()
  const base = isMockMode() ? today.medCycleDay : cycle.cycleDay || today.medCycleDay
  const rawDay = parseInt(params.get('medCycleDay') ?? '', 10)
  const medCycleDay = Number.isFinite(rawDay) ? Math.min(7, Math.max(1, rawDay)) : base
```

és a return: `return { dayState, medCycleDay, niggle, vulnerable, anchorMode: dayState === 'rough', ritual }`.

A `useToday()` real-módú ága (`todayHooks.ts:107`): `medCycleDay: today.medCycleDay, // unused in real mode — the scenario derives it from useMedication`.

- [ ] **Step 8: Frontend — a maradék hívási helyek**

`today.ts:14` mezőnév, `medicationHooks.ts` (`EMPTY_CYCLE`, `deriveCycle` két helyen, a `useMedicationActions` javadoc `retaDay` említése), `FuelMedicationPage.tsx:102` (`{cycle.cycleDay}. nap`), `FuelPlanPage.tsx` (`const { medCycleDay } = useTodayScenario()`, `D{medCycleDay} · ma`, `<RetaWeekStrip currentDay={medCycleDay} />` — a komponens neve a Task 2-ben változik), `NotificationsPage.tsx` (a `retaDay: number` mező a lokális ctx-típusban → `medCycleDay`, a `D${ctx.medCycleDay}` sablon, és a `medicationCycle.cycleDay > 0` feltételek), `notificationForecast.ts:25` és `LogDoseSheet.tsx:5` kommentek.

- [ ] **Step 9: Frontend — az MSW fixture + tesztek**

`frontend/src/test/msw/handlers.ts` `medicationDayFixture.cycle.retaDay: 3` → `cycleDay: 3`. A tesztekben minden `retaDay` assert `cycleDay`-re, a `useTodayScenario` teszteknél `?retaDay=` → `?medCycleDay=` és a visszaadott objektum kulcsa `medCycleDay`.

- [ ] **Step 10: Frontend kapuk**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

Elvárt: mindhárom PASS.

- [ ] **Step 11: Commit**

```bash
git add -A && git commit -m "refactor(medication): retaDay -> cycleDay/medCycleDay végig a kontraktuson (mezo-lwmq)"
```

---

### Task 2: A maradék „reta" azonosítók és CSS-tokenek de-brandelése

Frontend-only, a Task 1-től független nevek. A színértékek **nem** változnak — csak a token-nevek.

**Files:**
- Rename: `frontend/src/features/fuel/components/RetaWeekStrip.tsx` → `MedicationWeekStrip.tsx`; `RetaWeekStrip.test.tsx` → `MedicationWeekStrip.test.tsx`
- Modify: `frontend/src/data/types.ts:577-578`, `frontend/src/data/fuel/fuelWeek.ts:19-27`, `frontend/src/data/fuel/fuelWeekHooks.ts`, `frontend/src/features/fuel/pages/FuelPlanPage.tsx:19,92,101`, `frontend/src/styles/prototype.css:265-266,919-935,2975`
- Test: `frontend/src/data/fuel/fuelWeekData.test.tsx:14-15`, `frontend/src/data/fuel/fuelWeekHooks.test.tsx:68,93-94`

**Interfaces:**
- Consumes: a Task 1 `medCycleDay` neve (a `FuelPlanPage` már azt olvassa).
- Produces: `MedicationWeekStrip` komponens (prop-ja változatlanul `{ currentDay: number }`), `MedCycleDayCell` / `MedCyclePhase` típusok, `medCycleWeek` mock export, `toMedCycleCells(week: MedicationCycleCell[]): MedCycleDayCell[]`, és a `--medcycle-d1…--medcycle-d7` CSS-változók.

- [ ] **Step 1: A típusok átnevezése**

`frontend/src/data/types.ts`:

```ts
export type MedCyclePhase = 'Peak' | 'Stable' | 'Trough'
export interface MedCycleDayCell { d: number; label: MedCyclePhase; color: string }
```

- [ ] **Step 2: A CSS-tokenek átnevezése**

`frontend/src/styles/prototype.css:265-266` — **a hex-értékek betű szerint változatlanok**:

```css
  --medcycle-d1: #7FA48A; --medcycle-d2: #8FAC7E; --medcycle-d3: #A3B272; --medcycle-d4: #BCB466;
  --medcycle-d5: #D6B25B; --medcycle-d6: #EBB250; --medcycle-d7: #FFB347;   /* sage→amber ramp */
```

A `919-935` sorok osztályai: `.reta-bar` → `.medcycle-bar`, `.reta-seg` → `.medcycle-seg`, `.reta-seg.active` → `.medcycle-seg.active`, `.reta-seg.past` → `.medcycle-seg.past`. A `2975`-ös sor kommentjében a `.retamicro (Reta micro-strip)` → `.medcycle-micro (gyógyszer-ciklus micro-strip)`; ha a `.retamicro` osztály máshol is szerepel a fájlban, nevezd át ott is (`rg -n 'retamicro' frontend/src`).

- [ ] **Step 3: A mock-adat és a hook átnevezése**

`frontend/src/data/fuel/fuelWeek.ts`:

```ts
// fuel-plan.jsx heti gyógyszer-ciklus csík fázisai (227–235)
export const medCycleWeek: MedCycleDayCell[] = [
  { d: 1, label: 'Peak', color: 'var(--medcycle-d1)' },
  { d: 2, label: 'Peak', color: 'var(--medcycle-d2)' },
  { d: 3, label: 'Stable', color: 'var(--medcycle-d3)' },
  { d: 4, label: 'Stable', color: 'var(--medcycle-d4)' },
  { d: 5, label: 'Stable', color: 'var(--medcycle-d5)' },
  { d: 6, label: 'Trough', color: 'var(--medcycle-d6)' },
  { d: 7, label: 'Trough', color: 'var(--medcycle-d7)' },
]
```

(a `RetaDayCell` import is `MedCycleDayCell`-re a fájl tetején)

`frontend/src/data/fuel/fuelWeekHooks.ts` — az import-alias `retaWeek as mockRetaWeek` → `medCycleWeek as mockMedCycleWeek`, a `FuelWeekView.retaWeek` mező → `medCycleWeek`, és:

```ts
const PHASE_LABEL: Record<string, MedCyclePhase> = { peak: 'Peak', stable: 'Stable', trough: 'Trough' }

/** Medication cycle week → the cycle strip cells; empty (no dose → ghost cycle) stays empty. */
export function toMedCycleCells(week: MedicationCycleCell[]): MedCycleDayCell[] {
  return week.map((c) => ({
    d: c.day,
    label: PHASE_LABEL[c.phaseKey] ?? 'Stable',
    color: `var(--medcycle-d${c.day})`,
  }))
}
```

A fájl fejléc-kommentjében a „the Reta strip from the medication cycle" → „the cycle strip from the medication cycle". A `useFuelWeek` mindkét ágában a `retaWeek:` kulcs `medCycleWeek:`-re (`mockMedCycleWeek`, ill. `toMedCycleCells(cycle.week)`).

- [ ] **Step 4: A komponens átnevezése**

```bash
cd frontend && git mv src/features/fuel/components/RetaWeekStrip.tsx src/features/fuel/components/MedicationWeekStrip.tsx && git mv src/features/fuel/components/RetaWeekStrip.test.tsx src/features/fuel/components/MedicationWeekStrip.test.tsx
```

`MedicationWeekStrip.tsx` — a függvénynév és a hook-mező:

```tsx
import { useFuelWeek } from '@/data/hooks'

export function MedicationWeekStrip({ currentDay }: { currentDay: number }) {
  const { medCycleWeek } = useFuelWeek()
  return (
    <div className="row gap-xs" style={{ alignItems: 'stretch' }}>
      {medCycleWeek.map((p) => {
```

(a törzs többi része változatlan)

`FuelPlanPage.tsx`: az import, a `{medCycleWeek.length > 0 && (` feltétel és a `<MedicationWeekStrip currentDay={medCycleDay} />` használat.

- [ ] **Step 5: A tesztek átírása**

`MedicationWeekStrip.test.tsx` importja + a render, `fuelWeekData.test.tsx:14-15` és `fuelWeekHooks.test.tsx:68,93-94` a `medCycleWeek` mezőre. A `fuelWeekHooks.test.tsx:94` várt objektuma:

```ts
expect(result.current.medCycleWeek[2]).toEqual({ d: 3, label: 'Stable', color: 'var(--medcycle-d3)' })
```

- [ ] **Step 6: Kapuk + ellenőrzés**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

```bash
rg -n 'RetaWeekStrip|RetaDayCell|RetaPhase|retaWeek|toRetaCells|--reta-|\.reta-|retamicro' frontend/src
```

Elvárt: PASS, illetve nulla találat.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "refactor(fuel): gyógyszer-ciklus csík + CSS tokenek de-brandelése (mezo-lwmq)"
```

---

### Task 3: Metrika-kulcsok, mintapárok és a `pattern.pair_key` migráció

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MetricKey.java:19,33`, `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MetricSeriesService.java:301`, `backend/src/main/resources/application.yml:441-454,646-659`
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202608151200_mezo-lwmq_rename_medication_pattern_keys.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPropertiesIT.java`

**Interfaces:**
- Produces: `MetricKey.MEDICATION_CYCLE_DAY`, `MetricKey.MEDICATION_DOSE_MG`, és a `medication-cycle-day~daily-kcal` / `medication-dose~daily-kcal` mintapár-kulcsok.

- [ ] **Step 1: Az enum átnevezése**

`MetricKey.java` — a két érintett sor (a többi enum-konstans érintetlen):

```java
    MEDICATION_CYCLE_DAY("Gyógyszer-ciklusnap", "Gyógyszer-napló", MetricDomain.FUEL),
```

```java
    MEDICATION_DOSE_MG("Gyógyszer-dózis", "Gyógyszer-napló", MetricDomain.FUEL),
```

Az enum a config-kulcsot a **saját nevéből** származtatja (`MetricKey.java:72` — `name().toLowerCase(Locale.ROOT).replace('_', '-')`), tehát nincs külön átírandó string-konstans: `MEDICATION_CYCLE_DAY` → `medication-cycle-day` és `MEDICATION_DOSE_MG` → `medication-dose-mg` automatikusan adódik, és pontosan ezt várja a Step 2 pár-katalógusa.

`MetricSeriesService.java:301` javadoc: „The derived Reta cycle day per date" → „The derived medication cycle day per date".

- [ ] **Step 2: A mintapár-katalógus átírása**

`application.yml:441-454`:

```yaml
        - key: medication-cycle-day~daily-kcal
          category: physiology
          label: Fiziológia
          title: "Gyógyszer-ciklusnap ↔ napi kalória"
          mechanism: "A ciklus fázisa befolyásolhatja az étvágyat és a bevitelt."
          question: "A ciklus vége felé nő az étvágyad?"
          expected-direction: positive
          when-positive-hu: "a ciklus későbbi napjain {erősség} többet ettél"
          when-negative-hu: "a ciklus későbbi napjain {erősség} kevesebbet ettél"
          metric-a: medication-cycle-day
          metric-b: daily-kcal
          lag-days: 0
```

`application.yml:646-659`:

```yaml
        - key: medication-dose~daily-kcal
          category: physiology
          label: Fiziológia
          title: "Gyógyszer-dózis ↔ napi kalória"
          mechanism: "Az étvágy-elnyomás dózisfüggő lehet — magasabb dózis, kevesebb kalória."
          question: "Kevesebbet eszel magasabb dózison?"
          expected-direction: negative
          when-positive-hu: "a magasabb dózisú napokon {erősség} többet ettél"
          when-negative-hu: "a magasabb dózisú napokon {erősség} kevesebbet ettél"
          metric-a: medication-dose-mg
          metric-b: daily-kcal
          lag-days: 0
```

- [ ] **Step 3: A migrációs script megírása**

Create `backend/src/main/resources/db/changelog/1.0.0/script/202608151200_mezo-lwmq_rename_medication_pattern_keys.sql`:

```sql
-- mezo-lwmq: a retatrutid-kivezetés részeként a két gyógyszer-mintapár kulcsa generikusra vált.
-- A pattern egyediség-indexe (created_by, kind, pair_key) WHERE is_deleted = false — a kulcs
-- átnevezése adatmigráció NÉLKÜL elárvítaná a meglévő minta-sorokat, és a nightly Pearson-job
-- nulla előzménnyel indítaná újra a korrelációkat.
-- A pattern_event csak pattern_id FK-t hordoz, így az események együtt mozognak.

UPDATE pattern SET pair_key = 'medication-cycle-day~daily-kcal'
 WHERE pair_key = 'reta-cycle-day~daily-kcal';

UPDATE pattern SET pair_key = 'medication-dose~daily-kcal'
 WHERE pair_key = 'reta-dose~daily-kcal';
```

- [ ] **Step 4: Bekötés a master changelogba**

`backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` — fűzd a **lista végére**:

```yaml
  - changeSet:
      id: "1.0.0:202608151200_mezo-lwmq_rename_medication_pattern_keys"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202608151200_mezo-lwmq_rename_medication_pattern_keys.sql
```

- [ ] **Step 5: Backend tesztek**

```bash
cd backend && ./mvnw clean test
```

Elvárt: PASS. A `CompanionPropertiesIT` valószínűleg a pár-katalógus kulcsaira assertál — írd át a két érintett kulcsot.

- [ ] **Step 6: Ellenőrzés**

```bash
rg -n 'RETA_CYCLE_DAY|RETA_DOSE_MG|reta-cycle-day|reta-dose' backend/src
```

Elvárt: nulla találat (a migrációs script `WHERE` feltételei kivételével — azok szándékosan tartalmazzák a régi kulcsot; szűkítsd a keresést `-g '!*rename_medication_pattern_keys.sql'`-lel).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "refactor(patterns): gyógyszer-metrikák és mintapár-kulcsok generikussá tétele + pair_key migráció (mezo-lwmq)"
```

---

### Task 4: A Gyógyszer tab őszinte üres állapota

**Additív** task: kezeli a „nincs aktív gyógyszer" esetet, de még nem veszi el a seedet. Így a fa a task végén is működő appot ad.

A `FuelMedicationPage` ma feltétel nélkül dereferálja a `med`-et (`med.route`, `med.doseUnit`) és a `cycle.phaseLabel.split('·')`-t — üres gyógyszernél ez üres/értelmetlen kártyát renderelne.

**Files:**
- Modify: `frontend/src/features/fuel/pages/FuelMedicationPage.tsx`
- Test: `frontend/src/features/fuel/pages/FuelMedicationPage.test.tsx`

**Interfaces:**
- Consumes: `useMedication()` → `{ medication, cycle, doses }` (változatlan szignatúra); az „üres" jel a `medication.id === ''` (a `medicationHooks.ts`-beli `EMPTY_MEDICATION` ghost alakja).
- Produces: a `data-testid="medication-empty"` teszt-horog az üres állapoton.

- [ ] **Step 1: A bukó teszt megírása**

`frontend/src/features/fuel/pages/FuelMedicationPage.test.tsx` — új describe blokk a fájl végére. A `QueryWrapper` egy friss QueryClientet ad; az üres állapotot úgy állítjuk elő, hogy real módban az MSW-t üres gyógyszer-napra írjuk át.

```tsx
describe('FuelMedicationPage (nincs aktív gyógyszer)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('üres állapotot mutat, és nincs "＋ Beadás" akció', async () => {
    server.use(http.get(`${API_BASE}/api/medication`, () =>
      HttpResponse.json({
        medication: {
          id: '', name: '', activeIngredient: '', route: '', cadence: '',
          defaultDose: 0, doseUnit: '', active: false,
          cycle: { cycleLengthDays: 0, phases: [] },
        },
        cycle: { cycleDay: 0, phaseKey: '', phaseLabel: '', lastDoseAt: null, week: [] },
        recentDoses: [],
      })))
    renderView()
    expect(await screen.findByTestId('medication-empty')).toBeInTheDocument()
    expect(screen.getByText('Nincs aktív gyógyszer')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Beadás/ })).not.toBeInTheDocument()
    expect(screen.queryByTestId('medication-phase-note')).not.toBeInTheDocument()
  })
})
```

A fájl tetejére szükséges importok (ha még nincsenek): `import { http, HttpResponse } from 'msw'`, `import { server } from '@/test/msw/server'`, `import { API_BASE } from '@/test/msw/handlers'`.

- [ ] **Step 2: A teszt futtatása — bukjon**

```bash
cd frontend && pnpm test -- FuelMedicationPage
```

Elvárt: FAIL — `Unable to find an element by: [data-testid="medication-empty"]`.

- [ ] **Step 3: Az üres állapot implementálása**

`FuelMedicationPage.tsx` — a `const ago = lastDoseAgo(cycle.lastDoseAt)` sor után, a `return (` elé illeszd be a korai visszatérést. A `phaseName` számítást is védeni kell, ezért **mozgasd** a `routeLabel`/`cadenceLabel`/`phaseName`/`ago` számításokat a korai return **alá**:

```tsx
export function FuelMedicationPage() {
  const { medication: med, cycle, doses } = useMedication()
  const [logOpen, setLogOpen] = useState(false)

  // Honest empty state (mezo-lwmq): there is no active medication and no way to add one from
  // the UI — the slice keeps its generic machinery, but the owner tracks no medication.
  if (!med.id) {
    return (
      <>
        <div className="pghead-np sage">
          <div>
            <div className="over">Fuel · Gyógyszer</div>
            <h1>Gyógyszer</h1>
          </div>
        </div>
        <div style={{ padding: '0 24px 32px' }}>
          <div data-testid="medication-empty" className="card" style={{ padding: 24, textAlign: 'center' }}>
            <span style={{ fontFamily: 'var(--ff-display)', fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>
              Nincs aktív gyógyszer
            </span>
            <span className="text-tertiary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
              Nem követsz gyógyszert. Jelenleg nincs felvételi út a felületen — ha kellene, az külön fejlesztés.
            </span>
          </div>
        </div>
      </>
    )
  }

  const routeLabel = ROUTE_LABEL[med.route] ?? med.route
  const cadenceLabel = CADENCE_LABEL[med.cadence] ?? med.cadence
  // the phase note's phase name is the leading word of the derived phaseLabel ("Stabil · plató" → "Stabil")
  const phaseName = cycle.phaseLabel.split('·')[0].trim()
  const ago = lastDoseAgo(cycle.lastDoseAt)
```

A fájl fejléc-kommentjéből is vedd ki a „(Retatrutide)" megjegyzést: `// The owner's single active medication, restyled to the agreed mockup`.

- [ ] **Step 4: A teszt futtatása — menjen át**

```bash
cd frontend && pnpm test -- FuelMedicationPage
```

Elvárt: PASS (az összes meglévő teszt is, mert a seed még populált).

- [ ] **Step 5: Teljes kapu**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(fuel): őszinte üres állapot a Gyógyszer tabon (mezo-lwmq)"
```

---

### Task 5: A seed megszüntetése és a gyógyszer-sorok törlése

Ez a task veszi el a retatrutidot mint **adatot** — a backend seedet, az eltárolt sorokat, és a frontend mock/MSW fixture-öket.

**Fontos teszt-következmény:** a `FuelMedicationPage`, `LogDoseSheet`, `MedicationCycleBar` és `medicationHooks` tesztek ma a globális seedre/MSW fixture-re támaszkodnak a *populált* ág bizonyításához. Mivel az appban többé nincs gyógyszer, ezek a tesztek **explicit, semleges teszt-fixture-t** kapnak (`server.use(...)` real módban, `queryClient.setQueryData(['medication'], …)` mock módban). Így a generikus képesség tesztfedettsége megmarad, retatrutid nélkül.

**Files:**
- Delete: `backend/src/main/java/io/mrkuhne/mezo/feature/medication/MedicationDemoLoader.java`
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202608151210_mezo-lwmq_delete_medication_rows.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/MedicationPopulator.java`, `backend/src/test/java/io/mrkuhne/mezo/feature/medication/MedicationApiIT.java`
- Modify: `frontend/src/data/fuel/medication.ts`, `frontend/src/test/msw/handlers.ts`
- Create: `frontend/src/test/fixtures/medication.ts`
- Modify (tesztek): `frontend/src/data/fuel/medicationHooks.test.tsx`, `frontend/src/features/fuel/pages/FuelMedicationPage.test.tsx`, `frontend/src/features/fuel/sheets/LogDoseSheet.test.tsx`, `frontend/src/data/hooks.test.tsx`, `frontend/src/data/fuel/fuelWeekHooks.test.tsx`

(A `MedicationCycleBar`-nak nincs saját tesztfájlja — a `FuelMedicationPage.test.tsx` fedi le a ciklus-csíkot.)

**Interfaces:**
- Consumes: a Task 1 `cycleDay` mezőneve, a Task 4 `medication-empty` üres állapota.
- Produces: `medicationSeed` immár a nincs-gyógyszer ghost (`MedicationDay` alak, `medication.id === ''`), és egy exportált teszt-fixture a populált ághoz.

- [ ] **Step 1: A backend seed törlése**

```bash
git rm backend/src/main/java/io/mrkuhne/mezo/feature/medication/MedicationDemoLoader.java
```

Ellenőrizd, hogy más osztály nem hivatkozik rá: `rg -n 'MedicationDemoLoader' backend/src` → nulla találat.

- [ ] **Step 2: A törlő migráció**

Create `backend/src/main/resources/db/changelog/1.0.0/script/202608151210_mezo-lwmq_delete_medication_rows.sql`:

```sql
-- mezo-lwmq: a retatrutid kivezetése. TUDATOS FIZIKAI TÖRLÉS, szemben a repo is_deleted
-- soft-delete konvenciójával: a kivezetés célja épp az, hogy ne maradjon nyom — egy
-- soft-deleted sor a szer nevét a DB-ben hagyná. A normál törlési utak változatlanul
-- soft-delete-elnek; ez egyszeri, kivezetési migráció.
-- Sorrend: előbb a dózis-napló (FK a medication-re), utána a katalógus-sor.

DELETE FROM medication_dose;
DELETE FROM medication;
```

Vedd fel az `1.0.0_master.yml`-be a Task 3-ban hozzáadott bejegyzés **után**:

```yaml
  - changeSet:
      id: "1.0.0:202608151210_mezo-lwmq_delete_medication_rows"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202608151210_mezo-lwmq_delete_medication_rows.sql
```

- [ ] **Step 3: A teszt-populátor semlegesítése**

`backend/src/test/java/io/mrkuhne/mezo/support/populator/MedicationPopulator.java` — a három retatrutid-említést semleges tesztadatra. A ciklus-konfiguráció (7 nap, peak/stable/trough) és a dózis-értékek maradhatnak, csak az azonosító szövegek változnak:

```java
        e.setName("Teszt gyógyszer");
        e.setActiveIngredient("teszthatoanyag");
```

(a harmadik előfordulás egy javadoc/komment — írd át `Retatrutide` → `a teszt gyógyszer`-re)

- [ ] **Step 4: Backend kapu**

```bash
cd backend && ./mvnw clean test
```

Elvárt: PASS. A `MedicationApiIT` egy retatrutid-említést tartalmaz — ha a populátor nevére assertál, kövesse a semleges nevet.

- [ ] **Step 5: A frontend mock seed ghostosítása**

`frontend/src/data/fuel/medication.ts` teljes tartalma:

```ts
import type { MedicationDay } from '@/data/types'

/**
 * Mock-mode medication day (Gyógyszer slice) — used as TanStack Query `initialData` in mock mode.
 * The owner tracks NO medication (mezo-lwmq): an honest no-medication ghost, byte-identical in
 * shape to the real-mode `MEDICATION_EMPTY` fallback in `medicationHooks.ts`. Tests that need the
 * populated branch seed their own fixture — see `medicationFixture` in `@/test/fixtures/medication`.
 */
export const medicationSeed: MedicationDay = {
  medication: {
    id: '', name: '', activeIngredient: '', route: '', cadence: '',
    defaultDose: 0, doseUnit: '', active: false,
    cycle: { cycleLengthDays: 0, phases: [] },
  },
  cycle: { cycleDay: 0, phaseKey: '', phaseLabel: '', lastDoseAt: null, week: [] },
  recentDoses: [],
}
```

- [ ] **Step 6: A közös teszt-fixture létrehozása**

Create `frontend/src/test/fixtures/medication.ts` — egy semleges, retatrutid-mentes gyógyszer-nap, amit a populált ágat bizonyító tesztek használnak mindkét módban:

```ts
import type { MedicationDay } from '@/data/types'

/** Neutral medication day for tests that exercise the POPULATED branch of the Gyógyszer slice.
 *  The app itself seeds no medication (mezo-lwmq) — this fixture exists only so the generic
 *  machinery (cycle derivation, dose log, cycle bar, LogDoseSheet) stays covered. */
export const medicationFixture: MedicationDay = {
  medication: {
    id: 'med-test', name: 'Teszt gyógyszer', activeIngredient: 'teszthatoanyag', route: 'subQ',
    cadence: 'weekly-monday', defaultDose: 6, doseUnit: 'mg', active: true,
    cycle: {
      cycleLengthDays: 7,
      phases: [
        { key: 'peak', fromDay: 1, toDay: 2, label: 'Peak · étvágy ↓' },
        { key: 'stable', fromDay: 3, toDay: 5, label: 'Stabil · plató' },
        { key: 'trough', fromDay: 6, toDay: 7, label: 'Trough · étvágy ↑' },
      ],
    },
  },
  cycle: {
    cycleDay: 3, phaseKey: 'stable', phaseLabel: 'Stabil · plató', lastDoseAt: '2026-06-22T07:00:00',
    week: [
      { day: 1, phaseKey: 'peak', label: 'Peak', current: false },
      { day: 2, phaseKey: 'peak', label: 'Peak', current: false },
      { day: 3, phaseKey: 'stable', label: 'Stabil', current: true },
      { day: 4, phaseKey: 'stable', label: 'Stabil', current: false },
      { day: 5, phaseKey: 'stable', label: 'Stabil', current: false },
      { day: 6, phaseKey: 'trough', label: 'Trough', current: false },
      { day: 7, phaseKey: 'trough', label: 'Trough', current: false },
    ],
  },
  recentDoses: [
    { id: 'dose-3', administeredAt: '2026-06-22T07:00:00', dose: 6, note: 'Hétfő reggel · subQ has' },
    { id: 'dose-2', administeredAt: '2026-06-15T07:10:00', dose: 6, note: null },
    { id: 'dose-1', administeredAt: '2026-06-08T07:05:00', dose: 6, note: null },
  ],
}
```

- [ ] **Step 7: Az MSW alap-fixture ghostosítása**

`frontend/src/test/msw/handlers.ts` — a `medicationDayFixture` konstans a fenti ghost alakot kapja (a `medication.ts`-beli `medicationSeed`-del azonos), és a fölötte lévő komment frissül:

```ts
// Medication day fixture (mezo-lwmq): the owner tracks NO medication — the honest no-medication
// ghost. Tests that need the populated branch override this handler with `medicationFixture`.
const medicationDayFixture = {
  medication: {
    id: '', name: '', activeIngredient: '', route: '', cadence: '',
    defaultDose: 0, doseUnit: '', active: false,
    cycle: { cycleLengthDays: 0, phases: [] },
  },
  cycle: { cycleDay: 0, phaseKey: '', phaseLabel: '', lastDoseAt: null, week: [] },
  recentDoses: [],
}
```

- [ ] **Step 8: A populált ág tesztjeinek átállítása a fixture-re**

Minden olyan tesztben, ami ma a seedre/alap-MSW-fixture-re támaszkodva populált gyógyszert vár:

**Mock mód** — a `QueryWrapper` helyett saját klienssel, előtöltött cache-sel:

```tsx
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
client.setQueryData(['medication'], medicationFixture)
```

**Real mód** — handler-felülírással:

```tsx
server.use(http.get(`${API_BASE}/api/medication`, () => HttpResponse.json(medicationFixture)))
```

Az érintett tesztek és a várt új assertek:
- `FuelMedicationPage.test.tsx` — a `'Retatrutide'` szövegre assertáló sorok `'Teszt gyógyszer'`-re; a fejléc-komment „the seed and the real-mode handler fixture both resolve Retatrutide · retaDay 3" → „both suites drive the populated branch from `medicationFixture` · cycleDay 3".
- `medicationHooks.test.tsx` — a két `expect(...medication.name).toBe('Retatrutide')` → `'Teszt gyógyszer'`.
- `LogDoseSheet.test.tsx` — a `cycle.cycleDay).toBe(1)` assert marad, de a fixture-ből induljon.
- `hooks.test.tsx` — a real-módú `useTodayScenario` tesztek fixture-alapúak legyenek; a mock-módú „defaults" teszt várt `medCycleDay`-e a Step 9 után változik.
- `fuelWeekHooks.test.tsx` — a real-módú `medCycleWeek` hossz-assertek fixture-t igényelnek (üres ciklusnál a strip üres).

- [ ] **Step 9: A `useTodayScenario` mock-fallbackjének lebontása**

`frontend/src/data/today/todayHooks.ts` — a kitalált alapérték kikerül, mindkét ág a valós ciklusra ül:

```ts
  // The medCycleDay base is the derived medication cycle in BOTH modes. It is 0 when there is no
  // medication / no dose — the honest zero (mezo-lwmq: the owner tracks no medication, so this is
  // the normal state). The ?medCycleDay= URL override stays TOP priority, as a dev switch.
  const { cycle } = useMedication()
  const rawDay = parseInt(params.get('medCycleDay') ?? '', 10)
  const medCycleDay = Number.isFinite(rawDay) ? Math.min(7, Math.max(1, rawDay)) : cycle.cycleDay
```

Az `isMockMode` import törölhető ebből a hookból, **ha** a fájl máshol nem használja (`rg -n 'isMockMode' frontend/src/data/today/todayHooks.ts`).

- [ ] **Step 9b: A holttá vált `TodayMeta.medCycleDay` mező törlése**

A `TodayMeta.medCycleDay`-t **kizárólag** a `useTodayScenario` fallbackje olvasta (`todayHooks.ts:40`); a Step 9 után a mező sehol nem kerül felhasználásra, csak beállításra — halott adat. Töröld mind a három helyről:

- `frontend/src/data/types.ts` — a `TodayMeta` interfészből ki a `medCycleDay: number;` (a `TodayScenario.medCycleDay` **marad**, azt a feature-ök olvassák)
- `frontend/src/data/today/today.ts:14` — a `medCycleDay: 3,` sor
- `frontend/src/data/today/todayHooks.ts:107` — a `medCycleDay: today.medCycleDay,` sor a `useToday()` real ágából

Ellenőrzés: `rg -n 'medCycleDay' frontend/src` — csak a `TodayScenario` típus, a `useTodayScenario` és annak fogyasztói (`FuelPlanPage`) maradhatnak.

- [ ] **Step 9c: A `hooks.test.tsx` tesztjeinek igazítása**

A „defaults" teszt várt értéke:

```tsx
test('useTodayScenario defaults: medium, medCycleDay 0 (nincs gyógyszer), niggle on, vulnerable off, not anchor, no ritual override', () => {
  const { result } = renderHook(() => useTodayScenario(), { wrapper: wrap('/today') })
  expect(result.current).toEqual({ dayState: 'medium', medCycleDay: 0, niggle: true, vulnerable: false, anchorMode: false, ritual: null })
})
```

A `hooks.test.tsx:80` tesztjét (`'useTodayScenario (mock mode): retaDay defaults to today.retaDay, unchanged'`) **töröld** — a mező, amit bizonyított, megszűnt.

A real-módú `useTodayScenario` teszt kommentje is elavul (`'before the ["medication"] query resolves the cycle is the ghost (retaDay 0), so the scenario falls back to the mock default (3)'`) — az új viselkedés: a feloldás előtt a ghost 0, és a scenario **is** 0-t ad, mert nincs fallback.

- [ ] **Step 10: Frontend kapu**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

Elvárt: mindhárom PASS. Ha egy Today/Fuel komponens-teszt azon bukik, hogy `D0`-t vagy üres ciklus-csíkot renderel, az **helyes új viselkedés** — igazítsd a tesztet, ne állítsd vissza a kitalált alapértéket.

- [ ] **Step 11: Commit**

```bash
git add -A && git commit -m "feat(medication): a seedelt gyógyszer megszüntetése + sorok törlése (mezo-lwmq)"
```

---

### Task 6: Companion tool + prompt de-brandelés

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/MedicationTools.java:27,33-34,44-51,60-83,102`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java:54,66`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/BriefingGenerator.java:54`, `.../WeeklySuggestionGenerator.java:48`, `.../HeartbeatGenerator.java:50`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/tools/CompanionToolsRenderIT.java`, `.../companion/ChatServiceIT.java`, `.../companion/CompanionAdvisorChainIT.java`, `.../companion/advisor/ClinicalOutputCheckTest.java`

**Interfaces:**
- Produces: a `get_medication` tool `scope` értékei **`cycle`** (alapértelmezés) és `all`.

- [ ] **Step 1: A tool scope + leírás átírása**

`MedicationTools.java` — az osztály-javadoc, a scope-konstans, a `@Tool` leírás és a `normalizeScope`:

```java
/** V0.5 read tool over the medication feature (cycle position + general dose ledger). NEVER advises dosing (spec §6). */
```

```java
    /** get_medication's supported scope values; anything else (incl. null) falls back to "cycle". */
    private static final List<String> MEDICATION_SCOPES = List.of("cycle", "all");
```

```java
    @Tool(name = "get_medication", description = "Gyógyszer: ciklusállás vagy általános "
            + "gyógyszer-áttekintés. scope=cycle (alapértelmezés) — az aktív gyógyszer ciklusállása: "
            + "hányadik nap, fázis, utolsó dózis, következő esedékes nap, utolsó dózisok. scope=all — az "
            + "aktív gyógyszer általános adatai: név, hatóanyag, adagolási rend, alapdózis, ciklusállás "
            + "(ha van már rögzített dózis), utolsó dózisok. Használd, amikor a user a gyógyszeréről / a "
            + "gyógyszer-ciklusáról kérdez. scope: cycle (alapértelmezés), all.")
    public String getMedication(
            @ToolParam(required = false, description = "cycle|all (alapértelmezés: cycle).") String scope,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        String s = normalizeScope(scope);
        return "all".equals(s) ? renderAll(userId, toolContext) : renderCycle(userId, toolContext);
    }

    private static String normalizeScope(String scope) {
        if (scope == null) {
            return "cycle";
        }
        String s = scope.trim().toLowerCase();
        return MEDICATION_SCOPES.contains(s) ? s : "cycle";
    }
```

- [ ] **Step 2: A `renderReta` átnevezése és szövegei**

`renderReta` → `renderCycle`, és a három kimeneti string prefixe:

```java
    /** scope=cycle (default) — the medication cycle position + the recent dose ledger. */
    private String renderCycle(UUID userId, ToolContext toolContext) {
```

- `"Retatrutid ciklus: " + ToolText.NO_DATA` → `"Gyógyszer-ciklus: " + ToolText.NO_DATA`
- `"Retatrutid ciklus: " + med.getName() + " — nincs rögzített dózis"` → `"Gyógyszer-ciklus: " + med.getName() + " — nincs rögzített dózis"`
- `new StringBuilder("Retatrutid ciklus: ")` → `new StringBuilder("Gyógyszer-ciklus: ")`

A `renderAll` javadocjában: „No reta-specific naming" → „No brand-specific naming", és a `{@link #renderReta}` hivatkozás `{@link #renderCycle}`-ra.

- [ ] **Step 3: A promptok de-brandelése**

Mind a négy generátorban a dózistanács-tilalom **megmarad**, csak a zárójeles példa esik ki:

`ChatService.java:54` — `Gyógyszer adagolására (pl. retatrutid) vonatkozó változtatást SOHA ne javasolj — az orvosi döntés.` → `Gyógyszer adagolására vonatkozó változtatást SOHA ne javasolj — az orvosi döntés.`

`ChatService.java:66` — az `[Eszköz-útmutató]` routing sora: `- gyógyszer, reta-ciklus → get_medication` → `- gyógyszer, gyógyszer-ciklus → get_medication`

`BriefingGenerator.java:54` — `(5) gyógyszer adagolására (pl. retatrutid) vonatkozó` → `(5) gyógyszer adagolására vonatkozó`

`WeeklySuggestionGenerator.java:48` — `gyógyszer adagolására (pl. retatrutid) ` → `gyógyszer adagolására `

`HeartbeatGenerator.java:50` — `adagolására (pl. retatrutid) vonatkozó` → `adagolására vonatkozó`

- [ ] **Step 4: A tesztek átírása**

`CompanionToolsRenderIT` a legérintettebb (7 előfordulás): a `scope=reta` hívások `scope=cycle`-re, a várt kimenet-prefixek `Gyógyszer-ciklus:`-ra, a fixture-nevek a Task 5 semleges nevére. `ChatServiceIT`, `CompanionAdvisorChainIT`, `ClinicalOutputCheckTest` — a promptból eltűnt példa miatt igazítandó assertek.

**Figyelem:** a `ClinicalOutputCheckTest` szándékosan használhat retatrutid-szöveget az `rx-terms` őr bizonyítására. Az **maradhat** — az őr szótára változatlan (Global Constraints). Csak akkor írd át, ha a teszt a *system promptra* assertál, nem az őrre.

- [ ] **Step 5: Backend kapu**

```bash
cd backend && ./mvnw clean test
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "refactor(companion): gyógyszer-tool scope=cycle + promptok de-brandelése (mezo-lwmq)"
```

---

### Task 7: Mock-tartalom de-brandelése

Frontend-only, tisztán szöveg + egy mock-sor törlése.

**Files:**
- Modify: `frontend/src/data/fuel/fuel.ts` — **9 előfordulás**: `125` (reggeli coach-prose), `128` és `245` („Reta fázis" chip-ek), `320` (ebéd-indoklás), `337` (pacing-üzenet), `471-472` (a stack-sor), `487` (komment), `560` és `562` (protokoll-history indoklások)
- Modify: `frontend/src/data/me/goals.ts:18,60,67,131,135,142`
- Modify: `frontend/src/data/train/train.ts:87,249,264,441,444`
- Modify: `frontend/src/data/insights/insights.ts:21,25,27,28`
- Modify: `frontend/src/data/fuel/fuelWeek.ts` (`weeklyNote`)
- Modify: `frontend/src/data/types.ts:1283` (értesítés-katalógus)
- Test: `frontend/src/features/fuel/pages/FuelStackPage.test.tsx:73-78`, `frontend/src/data/insights/insightsData.test.tsx:6`, `frontend/src/data/insights/predictionsHooks.test.tsx:12`

- [ ] **Step 1: A stack-sor cseréje**

`frontend/src/data/fuel/fuel.ts` — a `{ id: 'reta', name: 'Retatrutide', brand: 'Eli Lilly · klinikai', … }` objektum **helyére** (a `471-483` sorok, a `type: 'medication'` sor azonosítja) egy semleges készítmény kerül.

**Miért csere és nem puszta törlés:** a `protocolOccurrences` seed a 8 nem-gyógyszer elemhez tartalmaz elhelyezést, és a `reta` volt az **egyetlen** olyan katalógus-elem, aminek nincs occurrence-e. A `FuelStackPage` picker-tesztje épp erre épül (lásd Step 2) — ha csak törölnénk, a tesztnek nem maradna „még nem elhelyezett" felvehető eleme.

```ts
  {
    id: 'cink',
    name: 'Cink-biszglicinát',
    brand: 'Now Foods',
    type: 'supplement',
    category: 'mineral',
    dose: '15mg',
    form: 'kapszula',
    stock: 90,
    stockUnit: 'db',
    protocol: 'Este · vacsora után',
    timing: 'evening',
    taken: false,
  },
```

A `487`-es komment is frissül: `// One occurrence per placed stash item (cink excluded — not placed in the protocol yet).`

- [ ] **Step 2: A stack-teszt átállítása**

`FuelStackPage.test.tsx:73-78`. A `timing: 'evening'` a `zoneForTiming` szerint az `evening` zónába esik (`fuel.ts:540-549`), tehát a várt zóna változik `wake`-ről:

```tsx
    // 'cink' (Cink-biszglicinát) az egyetlen seed-előfordulás nélküli elem — hozzáadva ÚJ sort
    // ejt az esti zónába (mockPlaceOccurrence timing-hint ága: 'evening' → 'evening'), a már ott
    // lévő seed magnézium-sor mellé.
    await userEvent.type(screen.getByPlaceholderText(/Keress a polcon/), 'cink')
    await userEvent.click(await screen.findByText('Cink-biszglicinát'))
    expect(await screen.findByRole('button', { name: 'Cink-biszglicinát beállítások' })).toBeInTheDocument()
```

- [ ] **Step 3: A narratíva-szövegek átírása**

Minden „Reta cycle" / „Reta D3" / „Reta beadás" említés gyógyszer-független megfogalmazásra. A számok és a szerkezet maradjon — csak a gyógyszer-ok kerüljön ki. Példák:

`goals.ts:18` — `'Egészséges erő · nem csak alak — a teljes energiám jobb 73kg-on a Reta cycle után.'` → `'Egészséges erő · nem csak alak — a teljes energiám jobb 73kg-on a mély deficit után.'`

`goals.ts:60` — `label: 'Mély deficit · Reta cycle'` → `label: 'Mély deficit'`

`goals.ts:67` — `'A Reta cycle alatt agresszívabb deficit fér bele — a fehérje magasan tartja az izmot, az alvás védi a regenerációt.'` → `'Ebben a szakaszban agresszívabb deficit fér bele — a fehérje magasan tartja az izmot, az alvás védi a regenerációt.'`

`goals.ts:131,135,142` — a súlynapló-jegyzetek: `'Goal start · Reta cycle indul'` → `'Goal start · mély deficit indul'`; `'Első hét Reta · étvágy lefulladás stabil'` → `'Első hét · étvágy stabil'`; `'Reta D1 reggel · hétfő reggeli súly nem reprezentatív'` → `'Hétfő reggeli súly nem reprezentatív'`

`train.ts:87` — `'… — 22-re is felmehetnénk, de Reta cycle alatt 20 a felső limit.'` → `'… — 22-re is felmehetnénk, de mély deficitben 20 a felső limit.'`

`train.ts:249` — `"Daniel: 'Idő egy erő-blokkra is.' Reta cycle befejezésével szinkronban indul."` → `"Daniel: 'Idő egy erő-blokkra is.' A deficit-szakasz lezárásával szinkronban indul."`

`train.ts:264` — `'Reta cycle vége — kalória deficit nélkül erő- és izom-tartás.'` → `'Deficit-szakasz vége — kalória deficit nélkül erő- és izom-tartás.'`

`train.ts:441` — `'… Múlt heti RIR 2 + Reta D3 alacsony étvágy + 7.2h alvás — …'` → `'… Múlt heti RIR 2 + alacsony étvágy + 7.2h alvás — …'`

`train.ts:444` — `{ kind: 'Pattern', label: 'Reta-D3 + 7h+ alvás → PR window' }` → `{ kind: 'Pattern', label: 'Alacsony étvágy + 7h+ alvás → PR window' }`

`fuelWeek.ts` `weeklyNote` — `'Most kell egy **középmagas-protein héttel** menni — Reta D3-D5 a peak étvágy-süllyedés.'` → `'Most kell egy **középmagas-protein héttel** menni — a hét közepén a legalacsonyabb az étvágy.'`

`fuel.ts` — a maradék hat előfordulás. A számok és a szerkezet maradjanak, csak a gyógyszer-ok essen ki:

- `125` — `'… Pull Day T-10h · Reta D3 reggel az étvágy még magas. …'` → `'… Pull Day T-10h · reggel az étvágy még magas. …'`
- `128` — `{ label: 'Reta fázis', value: 'D3 reggel · étvágy ↑' }` → `{ label: 'Étvágy', value: 'Reggel magas' }`
- `245` — `{ label: 'Reta fázis', value: 'D3 nappal · étvágy magas' }` → `{ label: 'Étvágy', value: 'Nappal magas' }`
- `320` — `'… A makró-arány protein-felé húz — Reta D3-on védő, mert biztosítjuk …'` → `'… A makró-arány protein-felé húz — védő, mert biztosítjuk …'`
- `337` — `'… Reta D3 miatt az étvágy ma még felül van — érdemes …'` → `'… Az étvágy ma még felül van — érdemes …'`
- `560` / `562` — `reason: 'Reggeli újraszámolás · Reta D3 stack-poll'` → `reason: 'Reggeli újraszámolás · stack-poll'`; `reason: 'Hét eleji baseline · Reta D1'` → `reason: 'Hét eleji baseline'`

- [ ] **Step 4: Az értesítés-címke**

`frontend/src/data/types.ts:1283`:

```ts
  medication: {
    label: 'Gyógyszer beadás', emoji: '💉', section: 'reminder',
    description: 'Injekciós napon, reggel', showLeadChip: false, iconBg: '--wash-amber',
  },
```

- [ ] **Step 5: Az insights minta cseréje**

`frontend/src/data/insights/insights.ts` — a `p1` minta **jelentése** retatrutid-specifikus (a beadás utáni étvágy-lefulladás), ezért a mintát cserélni kell, nem átnevezni.

Az új `pairKey` a `sport-load~next-sleep-quality` — ez **ténylegesen létező** kulcs az `application.yml` pár-katalógusában (`658`. sor), és a kategóriája ott `physiology` / `Fiziológia`, tehát a `p1` kategóriája (és ezzel a `patternCategoryColor` `--cat-physiology` tokenje) változatlan marad:

```ts
  {
    id: 'p1',
    pairKey: 'sport-load~next-sleep-quality',
    category: 'physiology',
    categoryLabel: 'Fiziológia',
    confidence: 0.85,
    title: 'Magas sportterhelés → rákövetkező éjjel mélyebb alvás',
    mechanism:
      'A 90 perc feletti sportterhelésű napok után az alvásminőség érezhetően jobb. A nézőpontunk: ezeken az éjszakákon az alvás-score 84% körül van (átlag: 71%).',
    evidence: ['12 terhelt nap óta', '9 éjszaka megerősítve', '0.85 statisztikai stabilitás'],
    critique: { statistical: 0.85, confounders: 0.72, l3align: 0.91, actionability: 0.88 },
    thinking:
      'Megfigyelés: a terhelt napokat követő éjszakákon az ébredések száma 3-ról 1-re esik, és ez nem a lefekvési idő következménye, hanem a terhelés utáni alvásnyomás. Hipotézis: a lecsendesítés-push T-60p-cel a lefekvés előtt ezeken a napokon is fix kell maradjon — különben a késői stimuláció elviszi a megnyert mélyalvást.',
  },
```

- [ ] **Step 6: A minta-tesztek igazítása**

`insightsData.test.tsx:6` — a várt cím az új mintáé:

```tsx
expect(patterns[0].title).toBe('Magas sportterhelés → rákövetkező éjjel mélyebb alvás')
```

`predictionsHooks.test.tsx:12` — a `basis: 'Reta D3-D7 alacsonyabb intake.'` → `basis: 'Terhelt napok után alacsonyabb intake.'`

- [ ] **Step 7: Frontend kapu**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "content(mock): a retatrutid-narratíva kivezetése a mock-adatokból (mezo-lwmq)"
```

---

### Task 8: Dokumentáció, ADR és záró ellenőrzés

**Files:**
- Modify: `docs/features/fuel.md`, `docs/features/companion.md`, `docs/features/today.md`, `docs/features/proactive.md`, `docs/features/_platform-design-system.md`, `docs/features/_platform-data-layer.md`, `docs/features/_platform-notifications.md`
- Modify: `docs/references/companion_tool_conventions.md`, `docs/guides/companion-hogyan-mukodik.md`, `docs/milestones/roadmap.md`, `docs/decisions/0005-pantry-item-supersedes-food-item-supplement-intake-fk.md`
- Create: `docs/decisions/0027-retire-retatrutide-generic-medication-domain.md` (a `0026` sorszám már ütközik két meglévő ADR között — `0027` a következő szabad)

- [ ] **Step 1: Az élő feature-doksik frissítése**

Minden érintett doksiban: a `retaDay` → `cycleDay`/`medCycleDay`, a `RetaWeekStrip` → `MedicationWeekStrip`, a `RETA_*` metrikák és a mintapár-kulcsok az új nevekre, a retatrutid mint konkrét szer említései kikerülnek. A `fuel.md` gyógyszer-szekciója (5 előfordulás) írja le az **új** valóságot: a slice generikus, jelenleg nincs aktív gyógyszer, a tab őszinte üres állapotot mutat, és nincs felvételi út. A `file:line` mutatókat igazítsd a Task 1–7 átnevezéseihez.

- [ ] **Step 2: Az ADR megírása**

Az ADR a `docs/README.md`-ben leírt sablont követi (olvasd el a sablont, mielőtt írod). Rögzítendő döntések: (1) a gyógyszer-domain generikussá tétele márkanév helyett; (2) a tartósan üres tab felvételi út nélkül; (3) a fizikai törlés a soft-delete konvenció alóli tudatos, egyszeri kivételként; (4) az `rx-terms` érintetlenül hagyása, mert az biztonsági őr és nem felhasználói adat; (5) a befagyasztott specek/tervek/mockupok érintetlenül hagyása.

- [ ] **Step 3: Doc-lint**

```bash
node scripts/lint-docs.mjs
```

Elvárt: nulla hiba, és a frissített feature-doksik staleness-jelzése tisztul.

- [ ] **Step 4: Az elfogadási kritérium ellenőrzése**

```bash
rg -i 'retatrutid' -g '!docs/superpowers' -g '!docs/old docs' -g '!docs/design' -g '!.git'
```

```bash
rg -iE '\breta\b|reta[A-Z]|--reta-|\.reta-|RETA_' -g '!docs/superpowers' -g '!docs/old docs' -g '!docs/design' -g '!.git' -g '!*rename_medication_pattern_keys.sql'
```

Mindkét keresésre **kizárólag a következő találatok megengedettek**; bármi más maradék hiba:

| Megengedett találat | Miért marad |
|---|---|
| `application.yml` `rx-terms:` sora | A `ClinicalOutputCheck` őrének szótára, nem felhasználói adat (Global Constraints) |
| `ClinicalOutputCheckTest.java` retatrutid-szövegei | **Csak** ha az őr működését bizonyítják; ha a system promptra assertálnak, azok a Task 6 Step 4-ben már kiestek |
| `202608151200_..._rename_medication_pattern_keys.sql` `WHERE` feltételei | A migráció szükségszerűen hivatkozik a régi kulcsokra (ezért a második keresés kizárja a fájlt) |

Ha bármelyik keresés ezeken kívüli sort ad vissza, javítsd, mielőtt továbbmész.

- [ ] **Step 5: Teljes kapu**

```bash
cd backend && ./mvnw clean test
```

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

- [ ] **Step 6: Commit + bd zárás**

```bash
git add -A && git commit -m "docs: retatrutid-kivezetés — élő doksik + ADR (mezo-lwmq)"
```

```bash
bd close mezo-lwmq
```

- [ ] **Step 7: Self-PR és merge**

```bash
git push -u origin feat/retire-retatrutide
```

Nyiss self-PR-t, **várd meg a CI zöldet** (ez az autoritatív teljes-suite kapu — a 16 GB-os gépen a backend IT-suite nem fut le lokálisan), majd:

```bash
git checkout main && git pull --rebase && git merge --no-ff feat/retire-retatrutide && git push
```

---

## Nyitott következmény (külön bd issue)

A Gyógyszer tab felvételi út nélkül marad. Ha valaha kell, az **külön spec + issue**: `POST /api/medication` a kontraktusban, controller/service, „＋ Gyógyszer hozzáadása" sheet, tesztek. Ez a terv szándékosan nem építi meg (YAGNI) — a tulajdonos nem tervez gyógyszert szedni.
