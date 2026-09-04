# Köteg B — heti 6 sub-jel + meal időzítés-sáv · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A heti nap-mozaik csempéje a napi motor mind a hat dimenzióját mutatja (csoportosított 3+3 pálcikán, a nap-oldallal egyező színekkel), a meal score-lap `context` csempéje pedig megkapja a prototípus időzítés-sávját.

**Architecture:** A `DayScore` rekord **már ma is** hordozza a teljes `DayEvaluation`-t, ezért a heti wire-alak bővítése tiszta projekció-csere a `MeWeekService`-ben — nincs új számítás, nincs séma-változás. A meal oldalon egy új opcionális `MealTimingDetail` kerül a `context` dimenzióra, ugyanabból a `MealScoringProperties.SlotWindows` configból, ami a pontszámot adta, így a rajzolt sáv nem tud eltérni a pontozástól. A FE mindkét helyen egy-egy fókuszált prezentációs egységet kap.

**Tech Stack:** Java 21 / Spring Boot / OpenAPI contract-first (`api/feature/*/*.yml` → `api/openapi.yml` → `frontend/src/data/_client/api.gen.ts`), React + TypeScript, Vitest + React Testing Library, MSW, Playwright (vizuális), Liquibase, pnpm 9, Maven wrapper.

**Spec:** [`docs/superpowers/specs/2026-09-04-jcpt-koteg-b-fe-visual-design.md`](../specs/2026-09-04-jcpt-koteg-b-fe-visual-design.md)
**bd issue-k:** `mezo-jcpt.5`, `mezo-jcpt.3` (egy branch, egy PR — user-jóváhagyott házirend-felülbírálás)

> **Megjegyzés (F5, záró review):** ez a terv `MeWeekServiceTest`-et és `WeeklyScoreServiceTest`-et
> ír elő (l. lentebb, `92, 109, 137, 261, 1231`) — ezek NEM léteznek a repóban, tervezési hiba. Az
> egyenértékű fedés a `DayScoreServiceTest` / `MeWeekControllerIT` / `MeWeekTrendIT` hármasban
> landolt; a következő szelet ezeket keresse, ne a fent nevezetteket.

## Global Constraints

- **Mozaik 2.0 kötelező** (CLAUDE.md „Design direction"): csempe-mozaik, poszter-anatómia, adat mint grafika, clay 3D SVG ikonok — **soha emoji**, kétrétegű színes árnyékok, belépő-koreográfia. Nem találunk ki új look-ot; a jóváhagyott prototípusból indulunk.
- **Contract-drift kapu:** ha `api/feature/**/*.yml` változik, a regenerált `api/openapi.yml` és `frontend/src/data/_client/api.gen.ts` **ugyanabban a commitban** landol. Regen: `cd api/generate && npm run generate:api` majd `cd frontend && pnpm generate:api`.
- **FE tesztek két módban, EXPLICIT env-vel.** Worktree-ben a csupasz `pnpm test` kétszer mock-ot futtat; a real-mode kapu vacuous nélküle. Mindig: `VITE_USE_MOCK=true pnpm test` **és** `VITE_USE_MOCK=false pnpm test`.
- **Fókuszált backend teszt mindig `-Dmezo.test.use-testcontainers=true`-val.** A teljes suite CI-only.
- **`ArchitectureTest` külön futtatandó** — a fókuszált futás kihagyja (layer-alcsomagok, contract-first controller, `@Value` tilalom, method-level `@Transactional`).
- **`--mz-*` token minden új propja kell `:root`-ba ÉS `:root[data-theme="dark"]`-ba** — a `mozaikCssTokens.test.ts` bukik különben.
- **Nincs snapshot-teszt sehol** ebben a terrénumban: RTL + `data-testid` + osztály-szelektor + szöveg-assertion.
- **`.rise` halott markup `EntranceGroup`-on kívül** (a szabály `.mz-play .rise`-ra van scope-olva).
- **Osztály-scope tilalom:** a `.dayev-dim.is-*` és a `.wkd-sparks i.is-*` / `.wkd-legend i.is-*` család **egyike sem oldható fel bare szelektorrá**.
- **Becsületes hiány:** null sub-jel → `is-none` 4px csonk; degradált dimenzió → null, **soha nem 0**.
- **Commit-tárgy hordozza a bd id-t:** `feat(me): ... (mezo-jcpt.5)` / `feat(fuel): ... (mezo-jcpt.3)`.
- **Branch:** `feat/week-card-6-signals`, a friss `origin/main`-ből vágva. A záró `--no-ff` merge-öt a user végzi — ez a session **soha nem cd-zik a fő repóba**.

## File Structure

**Létrehozandó:**

| Fájl | Felelősség |
| --- | --- |
| `frontend/src/features/fuel/components/MealTimingStrip.tsx` | Tiszta prezentációs komponens: `MealTiming` → 0–24 h sáv + ablak-band + pont. Nem tud sheetről, mealről, scorerről. |
| `frontend/src/features/fuel/components/MealTimingStrip.test.tsx` | A három állapot + a „timing nélkül semmit nem renderel" szerződés. |

**Módosítandó:**

| Fájl | Változás |
| --- | --- |
| `api/feature/me-week/me-week.yml:104-110` | `MeWeekSubscores` négy mezője → hat dimenzió-id. |
| `api/feature/meal/meal.yml:196-213, 255-259` | `MealScoreDimension.timing` + új `MealTimingDetail` séma. |
| `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts` | Regenerálva (kapu). |
| `backend/.../companion/service/DayScoreService.java:123, 347-353` | `DaySubscores` hat mezőre; `toSubscores` hat `dimScore` hívásra. |
| `backend/.../companion/service/MeWeekService.java:152-166, 217-226` | `toSubscores` projekció; `renderDayLine` **accessor**-cserék, szöveg változatlan. |
| `backend/.../companion/service/WeeklyScoreService.java:228-231` | Négy `subscoreAverage` method-reference-e az új mezőnevekre. |
| `backend/.../nutrition/entity/MealBreakdownJson.java:48-60` | `Dimension.timing` + `TimingDetail` record. |
| `backend/.../nutrition/service/MealScoringService.java:505-535, 594-614` | `Dim` record `timing` mezővel; `contextDim` kitölti. |
| `backend/.../nutrition/mapper/BreakdownDtoMapper.java:47-78` | `timing` átvezetése a DTO-ra. |
| `frontend/src/features/me/logic/weekDay.ts:24-40, 59-72` | Két lista egyesítése egy hatos listába `group` mezővel. |
| `frontend/src/features/me/logic/dayScoreState.ts:20-33` | Az intrinsic jelek listája (ritmus **kihagyva**). |
| `frontend/src/features/me/components/week/WeekDayTile.tsx:83-97` | Hat pálcika + csoportrés. |
| `frontend/src/features/me/pages/WeekDaysPage.tsx:27-32` | Hat legend-elem + csoport-elválasztó. |
| `frontend/src/styles/prototype.css:334-337, 668-671, 7955-7961, 7976-7987` | Token-család átnevezve/bővítve; hat `is-*` szabály; csoportrés; `.tline` blokk. |
| `frontend/src/data/types.ts:104` | `ContextDimension.timing?`. |
| `frontend/src/data/fuel/mealApi.ts:85-86` | `timing` átvezetése. |
| `frontend/src/features/fuel/components/DimensionCard.tsx:76-80` | `MealTimingStrip` beékelése `id==='context' && 'timing' in dim` alatt. |
| Mock/fixture: `frontend/src/data/me/meWeek.ts:17-100`, `frontend/src/test/msw/handlers.ts:1513,1523`, `frontend/src/data/fuel/fuel.ts:121-128,238-247` | Hat kulcs / `timing` payload. |
| Tesztek: `weekDay.test.ts`, `dayScoreState.test.ts`, `weekHub.test.ts`, `WeekDayTile.test.tsx`, `WeekDaysPage.test.tsx`, `mealApi.test.ts`, BE-tesztek | Az új alakra. |
| Doksik: `docs/features/me.md`, `fuel.md`, `companion.md`, `docs/CODEMAP.md` | Docs mandate. |

**Törlendő:**

| Fájl | Miért |
| --- | --- |
| `frontend/src/features/me/components/WeekDayCard.tsx` | Halott kód (`me.md:602`), és a típusváltás után nem is fordulna. |
| `frontend/src/features/me/components/WeekDayCard.test.tsx` | A fentihez tartozó teszt, amely saját bevallása szerint nem fed élő felületet. |

---

### Task 1: A 4→6 wire-alak végigvezetése (contract + backend + FE adatréteg)

Ez a task **egy commitban** viszi végig a contract-változást és minden hívási helyét, mert a
drift-kapu ezt követeli és mert a generált kliens cseréje egyébként fordíthatatlan állapotot hagyna.
A vizuális sűrítés (csoportrés, legend-elválasztó) NEM ebben a taskban van — itt a hat pálcika
egyenletes réssel jelenik meg.

**Files:**
- Modify: `api/feature/me-week/me-week.yml:104-110`
- Modify: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts` (generált)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/DayScoreService.java:123, 345-353`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MeWeekService.java:152-166, 217-226`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/WeeklyScoreService.java:212-232`
- Modify: `frontend/src/features/me/logic/weekDay.ts:24-40, 59-72`
- Modify: `frontend/src/features/me/logic/dayScoreState.ts:20-33`
- Modify: `frontend/src/features/me/components/week/WeekDayTile.tsx:83-97`
- Modify: `frontend/src/features/me/pages/WeekDaysPage.tsx:27-32`
- Modify: `frontend/src/styles/prototype.css:334-337, 668-671, 7955-7961, 7976-7987`
- Modify: `frontend/src/data/me/meWeek.ts:17-100`, `frontend/src/test/msw/handlers.ts:1513, 1523`
- Delete: `frontend/src/features/me/components/WeekDayCard.tsx`, `frontend/src/features/me/components/WeekDayCard.test.tsx`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/MeWeekServiceTest.java`,
  `.../DayScoreServiceTest.java`, `.../WeeklyScoreServiceTest.java`, `.../MeWeekServiceRenderDayLineTest.java`,
  `frontend/src/features/me/logic/weekDay.test.ts`, `.../dayScoreState.test.ts`, `.../weekHub.test.ts`,
  `frontend/src/features/me/components/week/WeekDayTile.test.tsx`, `frontend/src/features/me/pages/WeekDaysPage.test.tsx`

**Interfaces:**
- Consumes: semmit (első task).
- Produces:
  - Java: `DayScoreService.DaySubscores(Integer nutrition, Integer quality, Integer training, Integer sleep, Integer logging, Integer rhythm)`
  - Wire: `MeWeekSubscores { nutrition, quality, training, sleep, logging, rhythm }` (mind `integer, nullable`)
  - TS: `DayDimensionKey = 'nutrition'|'quality'|'training'|'sleep'|'logging'|'rhythm'`
  - TS: `DAY_DIMENSIONS: readonly { key: DayDimensionKey; label: string; barClass: string; group: 'do' | 'be' }[]`
  - TS: `subscoreCount(day: MeWeekDay): number`, `INTRINSIC_SUBSCORE_KEYS: readonly DayDimensionKey[]`
  - CSS tokenek: `--mz-wk-sub-nutrition|quality|training|sleep|logging|rhythm`

- [ ] **Step 1: Írd meg a bukó backend tesztet a hatos projekcióra**

`backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/MeWeekServiceTest.java` — új teszt:

```java
@Test
void toSubscores_projects_all_six_dimensions_and_nulls_a_degraded_one() {
    DayEvaluation evaluation = evaluationWith(
        dim("nutrition", 82), dim("quality", 64), dim("training", 91),
        dim("sleep", 55), dim("logging", 100), degraded("rhythm"));
    DayScoreService.DaySubscores s = DayScoreServiceTestAccess.toSubscores(evaluation);

    assertThat(s.nutrition()).isEqualTo(82);
    assertThat(s.quality()).isEqualTo(64);
    assertThat(s.training()).isEqualTo(91);
    assertThat(s.sleep()).isEqualTo(55);
    assertThat(s.logging()).isEqualTo(100);
    // A degradált dimenzió NULL, nem 0 — ez a "tanulom" jel, amit a csempe már ma is renderel.
    assertThat(s.rhythm()).isNull();
}
```

Ha a `DayScoreServiceTestAccess` segédosztály nem létezik, a tesztet a meglévő
`DayScoreServiceTest`-ben írd meg, a `DayScoreService.scores(...)` publikus belépési pontján
keresztül (a `DaySubscores` a `DayScore` rekord mezője), és a `degraded("rhythm")` legyen olyan
dimenzió, aminek `weight == 0` és `status != DONE`.

- [ ] **Step 2: Futtasd — bukjon**

```bash
./mvnw -q -pl backend test -Dtest=MeWeekServiceTest -Dmezo.test.use-testcontainers=true
```

Elvárt: fordítási hiba (`nutrition()` nem létezik a `DaySubscores`-on).

- [ ] **Step 3: Bővítsd a contract fragmentet**

`api/feature/me-week/me-week.yml:104-110` helyére:

```yaml
    MeWeekSubscores:
      description: >-
        A napi motor hat dimenziójának pontszáma ezen a napon (mezo-jcpt.5). A mezőnevek a
        DayEvaluation dimenzió-idjei, hogy a heti mozaik és a nap-oldal EGY szókincset használjon.
        null = a dimenzió degradált vagy nem mérhető ezen a napon — soha nem 0.
      type: object
      properties:
        nutrition: { type: integer, nullable: true, description: 0–100; null = no data }
        quality:   { type: integer, nullable: true }
        training:  { type: integer, nullable: true }
        sleep:     { type: integer, nullable: true }
        logging:   { type: integer, nullable: true }
        rhythm:    { type: integer, nullable: true }
```

**A `MeWeekAggregates` (`:150-153`) és a `MeWeekTrendPoint` NEM változik** — a spec D3 döntése:
a FE egyetlen `sleepAvg`/`fuelAvg`/`checkinAvg`/`activityAvg` mezőt sem fogyaszt, a cache-elt sor
csak ezt a négy átlagot tárolja, ezért nincs migráció és nincs cache-purge.

- [ ] **Step 4: Regeneráld a contractot**

```bash
cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api
```

- [ ] **Step 5: Írd át a `DaySubscores` rekordot és a projekciót**

`DayScoreService.java:122-124`:

```java
    /** The evaluation's six dimensions under their wire names — see the class javadoc's
     *  dimension table. A degraded dimension projects to null, never 0. */
    public record DaySubscores(Integer nutrition, Integer quality, Integer training,
                               Integer sleep, Integer logging, Integer rhythm) {
    }
```

`DayScoreService.java:347-353`:

```java
    private static DaySubscores toSubscores(DayEvaluation evaluation) {
        return new DaySubscores(
                dimScore(evaluation, DIM_NUTRITION),
                dimScore(evaluation, DIM_QUALITY),
                dimScore(evaluation, DIM_TRAINING),
                dimScore(evaluation, DIM_SLEEP),
                dimScore(evaluation, DIM_LOGGING),
                dimScore(evaluation, DIM_RHYTHM));
    }
```

Ha a `DIM_QUALITY` / `DIM_RHYTHM` konstansok még nem léteznek a `DayScoreService`-ben, vedd fel
őket a meglévő `DIM_SLEEP`/`DIM_NUTRITION`/`DIM_TRAINING`/`DIM_LOGGING` mellé
(`private static final String DIM_QUALITY = "quality";`, `... DIM_RHYTHM = "rhythm";`).

A „Legacy projection" szekció-kommentet (`:345`) írd át: **már nem legacy**, ez a teljes
dimenzió-vektor wire-alakja.

- [ ] **Step 6: Írd át a `MeWeekService.toSubscores`-t**

`MeWeekService.java:152-166`:

```java
    /**
     * A {@code me-week} contract hat sub-jele (mezo-jcpt.5) a napi motor hat dimenziója, a
     * dimenzió-idjeik alatt — EGY szókincs a heti mozaik és a nap-oldal között. A hordozó
     * továbbra is {@link DayScoreService.DaySubscores}, ami a {@link DayScoreService.DayScore}
     * részeként MÁR kézben van, tehát ez tiszta projekció: nulla plusz számítás. Degradált
     * dimenzió {@code null}-ra megy — pontosan a „tanulom" jel, amit ez a felület renderel.
     */
    private static MeWeekSubscores toSubscores(DayScoreService.DayScore score) {
        if (score == null) {
            return new MeWeekSubscores();
        }
        DayScoreService.DaySubscores s = score.subscores();
        return new MeWeekSubscores()
                .nutrition(s.nutrition()).quality(s.quality()).training(s.training())
                .sleep(s.sleep()).logging(s.logging()).rhythm(s.rhythm());
    }
```

- [ ] **Step 7: Igazítsd a `renderDayLine` accessorait — a SZÖVEG változatlan**

`MeWeekService.java:220-226` — csak a getterek nevei cserélődnek, a címkék és a sorrend nem:

```java
                .append(" [alvás ").append(orDash(subscores != null ? subscores.getSleep() : null))
                .append(" · fuel ").append(orDash(subscores != null ? subscores.getNutrition() : null))
                .append(" · checkin ").append(orDash(subscores != null ? subscores.getLogging() : null))
                .append(" · aktivitás ").append(orDash(subscores != null ? subscores.getTraining() : null))
```

A javadocba (`:210-215`) vedd fel: *„A sor SZÁNDÉKOSAN a régi négy jelet írja, az új `quality`/`rhythm`
nélkül (spec D4): ez LLM-prompt payload, minden chat-fordulóban fut, a bővítése külön döntés."*

- [ ] **Step 8: Igazítsd a `WeeklyScoreService.aggregate` method-reference-eit**

`WeeklyScoreService.java:228-231`:

```java
                subscoreAverage(dayScores, DayScoreService.DaySubscores::sleep),
                subscoreAverage(dayScores, DayScoreService.DaySubscores::nutrition),
                subscoreAverage(dayScores, DayScoreService.DaySubscores::logging),
                subscoreAverage(dayScores, DayScoreService.DaySubscores::training));
```

A javadocban (`:213-217`) a „négy legacy per-domain átlag" mondat maradjon, de a mapping-tábla
mostantól így hangozzon: *„a négy cache-oszlop a hat dimenzióból négyet vesz —
`sleepAvg←sleep, fuelAvg←nutrition, checkinAvg←logging, activityAvg←training`; a `quality` és a
`rhythm` szándékosan nem kap oszlopot (spec D3: a FE egyiket sem fogyasztja, így nincs migráció)."*

- [ ] **Step 9: Futtasd a backend teszteket — menjenek át**

```bash
./mvnw -q -pl backend test -Dtest='MeWeekServiceTest,DayScoreServiceTest,WeeklyScoreServiceTest,MeWeekServiceRenderDayLineTest' -Dmezo.test.use-testcontainers=true
```

Elvárt: mind PASS. A `MeWeekServiceRenderDayLineTest` **átmenete a D4 bizonyítéka** — ha bukik, a
prompt szövege elmozdult, és vissza kell állítani (nem a tesztet igazítani).

- [ ] **Step 10: Írd meg a bukó FE tesztet a hatos listára**

`frontend/src/features/me/logic/weekDay.test.ts:139-142` — a mai „NÉGY pálcikán marad" pin
**invertálva** (ne töröld, írd át; ez a pin most az ellenkezőjét őrzi):

```ts
describe('a heti mozaik hat sub-jelet rajzol (mezo-jcpt.5)', () => {
  it('a hat dimenzió a config-súly sorrendjében, csoportokkal', () => {
    expect(DAY_DIMENSIONS.map((s) => s.key))
      .toEqual(['nutrition', 'quality', 'training', 'sleep', 'logging', 'rhythm'])
    expect(DAY_DIMENSIONS.map((s) => s.group))
      .toEqual(['do', 'do', 'do', 'be', 'be', 'be'])
  })

  it('a barClass az is-<key> minta, hogy a nap-oldal és a heti csempe EGY szemantikát osszon', () => {
    expect(DAY_DIMENSIONS.map((s) => s.barClass))
      .toEqual(['is-nutrition', 'is-quality', 'is-training', 'is-sleep', 'is-logging', 'is-rhythm'])
  })
})
```

`frontend/src/features/me/logic/dayScoreState.test.ts` — új teszt a **ritmus-csapdára**:

```ts
it('egy érintetlen nap NINCS ADAT marad akkor is, ha a ritmus más napokból kapott pontot', () => {
  // A ritmus EXTRINSIC: más napok base-scoreainak átlaga (DayEvaluationEngine javadoc :93-97).
  // Ha beleszámítana az "unlogged" próbába, egy soha nem érintett nap "tanulom"-ra váltana.
  const day = emptyDay({ subscores: { nutrition: null, quality: null, training: null,
    sleep: null, logging: null, rhythm: 41 } })
  expect(isDayUnlogged(day)).toBe(true)
  expect(dayScoreState(day, '2026-05-21')).toBe('nodata')
})
```

- [ ] **Step 11: Futtasd — bukjon**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/me/logic/weekDay.test.ts src/features/me/logic/dayScoreState.test.ts
```

Elvárt: FAIL — `DAY_DIMENSIONS` nem hordoz `group` mezőt, és a `rhythm` kulcs nem létezik a mock napon.

- [ ] **Step 12: Egyesítsd a két listát a `weekDay.ts`-ben**

Töröld a `SUBSCORE_KEYS` / `SUBSCORES` / `SubscoreKey` / `SUBRING_LABEL` négyes blokkot
(`weekDay.ts:24-38`) — a `SUBRING_LABEL`-nek nulla fogyasztója van, a másik három helyét a hatos
lista veszi át. A hatos blokk (`:44-66`) így alakul:

```ts
// ── A napi motor hat dimenziója — EGY lista a heti mozaiknak ÉS a nap-oldalnak ────────────────
// mezo-jcpt.5 óta a `MeWeekDay.subscores` wire-alakja ugyanez a hat kulcs, ezért a korábbi
// négyes `SUBSCORES` lista megszűnt: az oka (a szűkebb heti wire-alak) elmúlt.
// A `barClass` mindkét felületen ugyanaz az `is-<key>` név, de KÉT KÜLÖN, scope-olt CSS-családot
// címez (`.dayev-dim.is-*` a nap-oldalon, `.wkd-sparks i.is-*` a heti csempén) — a két szabálycsalád
// most már azonos szemantikát kap, de egyiket sem szabad bare szelektorrá oldani.
const DAY_DIMENSION_KEYS = ['nutrition', 'quality', 'training', 'sleep', 'logging', 'rhythm'] as const
export type DayDimensionKey = (typeof DAY_DIMENSION_KEYS)[number]

/** `do` = amit a nap folyamán TETTÉL, `be` = ahogy a tested/ritmusod ÁLL. A heti csempe
 *  ezen a határon nyit egy szélesebb rést, hogy a hat pálcika legend nélkül is csoportosuljon. */
export type DimensionGroup = 'do' | 'be'

export const DAY_DIMENSIONS: readonly {
  key: DayDimensionKey; label: string; barClass: string; group: DimensionGroup
}[] = [
  { key: 'nutrition', label: 'tápanyag', barClass: 'is-nutrition', group: 'do' },
  { key: 'quality', label: 'minőség', barClass: 'is-quality', group: 'do' },
  { key: 'training', label: 'edzés', barClass: 'is-training', group: 'do' },
  { key: 'sleep', label: 'alvás', barClass: 'is-sleep', group: 'be' },
  { key: 'logging', label: 'logolás', barClass: 'is-logging', group: 'be' },
  { key: 'rhythm', label: 'ritmus', barClass: 'is-rhythm', group: 'be' },
]

/** A `rhythm` KIMARAD: extrinsic jel — MÁS napok base-scoreainak átlaga
 *  (`DayEvaluationEngine` javadoc :93-97), ezért egy érintetlen napon is lehet értéke.
 *  A motor is kihagyja a saját adat-elegendőségi kapujából; minden „mennyit mértünk ezen a
 *  napon" próba ezt a listát használja, nem a teljes hatot. */
export const INTRINSIC_SUBSCORE_KEYS: readonly DayDimensionKey[] =
  ['nutrition', 'quality', 'training', 'sleep', 'logging']

export function subscoreCount(day: MeWeekDay): number {
  return INTRINSIC_SUBSCORE_KEYS.filter((k) => day.subscores[k] != null).length
}
```

- [ ] **Step 13: Igazítsd a `dayScoreState.ts`-t ugyanerre a listára**

`dayScoreState.ts:20-33`:

```ts
export function isDayUnlogged(day: MeWeekDay): boolean {
  const s = day.subscores
  // A ritmus szándékosan kimarad — lásd INTRINSIC_SUBSCORE_KEYS: extrinsic jel, egy érintetlen
  // napon is kaphat értéket a szomszédos napokból, és „logolt nappá" hazudná ezt a napot.
  const anySubscore = INTRINSIC_SUBSCORE_KEYS.some((k) => s?.[k] != null)
  return !anySubscore
    && day.kcal == null && day.proteinG == null
    && day.sleepMin == null && day.weightKg == null
    && !day.checkinCount && !day.workoutCount && !day.xp
}

/** Hány INTRINSIC dimenziót tudott ténylegesen mérni a Mezo ezen a napon. Kettő az a küszöb,
 *  ami alatt egyáltalán nem ad pontszámot (handoff §4) — a motor ugyanezt a kaput alkalmazza,
 *  és ugyanígy hagyja ki belőle a ritmust. */
export function measuredSubscores(day: MeWeekDay): number {
  const s = day.subscores
  return INTRINSIC_SUBSCORE_KEYS.filter((k) => s?.[k] != null).length
}
```

- [ ] **Step 14: Vedd fel a hat CSS-tokent mindkét témában**

`prototype.css:332-337` (light) — a négy régi token helyére:

```css
  /* Heti nap-mozaik — a hat sub-jel hue-ja (mezo-jcpt.5). SZÁNDÉKOSAN azonos szemantika a
     nap-oldal domain-színeivel (.dayev-dim), hogy egy átkattintás után ne kelljen újratanulni:
     tápanyag=sage · minőség=gold · edzés=coral · alvás=lavender · logolás=rose · ritmus=sky. */
  --mz-wk-sub-nutrition: #8FAF7E;
  --mz-wk-sub-quality: #A8801F;
  --mz-wk-sub-training: #FF6B4A;
  --mz-wk-sub-sleep: #8A78D0;
  --mz-wk-sub-logging: #C46FA0;
  --mz-wk-sub-rhythm: #4E8FB8;
```

`prototype.css:668-671` (dark) — a négy régi token helyére:

```css
  --mz-wk-sub-nutrition: var(--dv-sage);
  --mz-wk-sub-quality: var(--dv-amber);
  --mz-wk-sub-training: var(--primary-base);
  --mz-wk-sub-sleep: var(--dv-lav);
  --mz-wk-sub-logging: var(--dv-rose);
  --mz-wk-sub-rhythm: var(--dv-sky);
```

`prototype.css:7956-7960` (a pálcika-szabályok) és `:7984-7987` (a legend-szabályok) — mindkét
helyen a négy `is-sleep|is-fuel|is-checkin|is-activity` sor helyére hat sor:

```css
.wkd-sparks i.is-nutrition { background: var(--mz-wk-sub-nutrition); }
.wkd-sparks i.is-quality { background: var(--mz-wk-sub-quality); }
.wkd-sparks i.is-training { background: var(--mz-wk-sub-training); }
.wkd-sparks i.is-sleep { background: var(--mz-wk-sub-sleep); }
.wkd-sparks i.is-logging { background: var(--mz-wk-sub-logging); }
.wkd-sparks i.is-rhythm { background: var(--mz-wk-sub-rhythm); }
```

(és ugyanez `.wkd-legend i.is-*` prefixszel). Az `is-none` sor változatlan marad.

- [ ] **Step 15: Írd át a `WeekDayTile` pálcika-blokkját**

`WeekDayTile.tsx:19` importban `SUBSCORES` → `DAY_DIMENSIONS`, és `:83-97`:

```tsx
        <div className="wkd-sparks" aria-hidden="true">
          {DAY_DIMENSIONS.map((s, k) => {
            const v = day.subscores[s.key]
            return (
              <i
                key={s.key}
                className={v == null ? 'is-none' : s.barClass}
                style={{
                  height: v == null ? 4 : Math.max(5, Math.round((v / 100) * 26)),
                  '--d': `${300 + delayMs + k * 53}ms`,
                } as CSSProperties}
              />
            )
          })}
        </div>
```

A csoportrés (markup + CSS + teszt) **teljes egészében a Task 2-é** — ez a task hat egyenletes
pálcikát ad. A fájl fejléc-kommentjébe vedd fel: *„mezo-jcpt.5: négy sub-jelről hatra —
a wire-alak és a nap-oldal ugyanazt a hat dimenzió-idet használja."*

- [ ] **Step 16: Bővítsd a legendet hat elemre**

`WeekDaysPage.tsx:27-32` — a négyelemű `LEGEND` konstans helyére a hatos lista **egyetlen forrásból**:

```tsx
const LEGEND = DAY_DIMENSIONS
```

és a render (`:78-97` legend-blokkja):

```tsx
      <div className="wkd-legend">
        {LEGEND.map((l) => (
          <span key={l.key}><i className={l.barClass} />{l.label}</span>
        ))}
      </div>
```

(A csoport-elválasztó a Task 2-ben jön.)

- [ ] **Step 17: Töröld a halott `WeekDayCard`-ot**

```bash
git rm frontend/src/features/me/components/WeekDayCard.tsx frontend/src/features/me/components/WeekDayCard.test.tsx
```

- [ ] **Step 18: Igazítsd a mock- és fixture-adatot hat kulcsra**

`frontend/src/data/me/meWeek.ts` `SEED_DAYS` mind a hét napja, `frontend/src/test/msw/handlers.ts:1513`
és `:1523` — minden `subscores: { sleep, fuel, checkin, activity }` objektum helyére
`{ nutrition, quality, training, sleep, logging, rhythm }`. Az érték-átvitel:
`nutrition ← fuel`, `training ← activity`, `logging ← checkin`, `sleep ← sleep`; a `quality` és a
`rhythm` **új, hihető értékeket kap** (a mock a valóságot imitálja, nem tölti nullával),
és **legalább egy napon mindkettő `null` legyen**, hogy az `is-none` csonk is látszódjon a fejlesztői
felületen. Ugyanezt tedd a `weekDay.test.ts`, `dayScoreState.test.ts`, `weekHub.test.ts` fixture-jeiben.

- [ ] **Step 19: Futtasd az FE teszteket mindkét módban**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test && VITE_USE_MOCK=false pnpm test
```

Elvárt: mind PASS, beleértve a `dualMode.guard`, `mozaikCssTokens` és `prototypeCssStructure` őröket.

- [ ] **Step 20: Ellenőrizd a kapukat**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/ai-score-macro-evaluation-7cb15a \
  && node scripts/gen-codemap.mjs \
  && node scripts/lint-liquibase.mjs \
  && ./mvnw -q -pl backend test -Dtest=ArchitectureTest -Dmezo.test.use-testcontainers=true
```

Elvárt: a CODEMAP-diff **csak** a törölt `WeekDayCard` sorait tartalmazza; a liquibase-lint zöld és
**nincs új changeset** (ez a D3 bizonyítéka); az ArchUnit zöld.

- [ ] **Step 21: Commit**

```bash
git add -A && git commit -m "$(cat <<'EOF'
feat(me): heti sub-jelek 4→6 a napi motor dimenzióira (mezo-jcpt.5)

A MeWeekSubscores wire-alakja a DayEvaluation hat dimenzió-idjére vált; a projekció
a DayScore-ban már kézben lévő evaluationből olvas, tehát nulla plusz számítás. A
weekly_score cache négy átlagoszlopa változatlan (a FE egyiket sem fogyasztja), ezért
nincs migráció. A renderDayLine szövege szándékosan változatlan — LLM-prompt payload.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: A csempe vizuális sűrítése — csoportosított 3+3 pálcika

**Files:**
- Modify: `frontend/src/styles/prototype.css` (a `.wkd-sparks` / `.wkd-legend` blokk)
- Modify: `frontend/src/features/me/components/week/WeekDayTile.tsx` (az `is-gsep` osztály a csoporthatáron)
- Modify: `frontend/src/features/me/pages/WeekDaysPage.tsx` (legend csoport-elválasztó)
- Test: `frontend/src/features/me/components/week/WeekDayTile.test.tsx`, `.../pages/WeekDaysPage.test.tsx`

**Interfaces:**
- Consumes: `DAY_DIMENSIONS` (`key`, `barClass`, `group`) a Task 1-ből.
- Produces: semmi új export — a szerződés a `.wkd-sparks i.is-gsep` CSS-szabály és a legend `.wkd-legsep` elválasztója.

A csoportrés markupja is ITT születik, hogy az osztály és a szabálya egy commitban landoljon.
A `WeekDayTile.tsx` pálcika-blokkjában a `className` így alakul:

```tsx
                className={cn(v == null ? 'is-none' : s.barClass,
                  DAY_DIMENSIONS[k + 1]?.group !== undefined && DAY_DIMENSIONS[k + 1].group !== s.group && 'is-gsep')}
```

(azaz a csoporthatár ELŐTTI pálcika viszi a szélesebb jobb margót — a listából származtatva, nem
bedrótozott `'training'` kulccsal.)

- [ ] **Step 1: Írd meg a bukó teszteket**

`frontend/src/features/me/components/week/WeekDayTile.test.tsx`:

```tsx
it('hat pálcikát rajzol, a harmadik után csoportréssel (mezo-jcpt.5)', () => {
  const { container } = render(<WeekDayTile day={scoredDay} todayIso="2026-05-21"
    hasNote={false} delayMs={0} onOpen={() => {}} />)
  const bars = container.querySelectorAll('.wkd-sparks i')
  expect(bars).toHaveLength(6)
  // A csoporthatár az „amit tettél" (tápanyag·minőség·edzés) és az „ahogy állsz"
  // (alvás·logolás·ritmus) között van — az edzés pálcikája viseli.
  expect(bars[2]).toHaveClass('is-gsep')
  expect(bars[0]).not.toHaveClass('is-gsep')
  expect(bars[5]).not.toHaveClass('is-gsep')
})

it('null sub-jel csonkot kap, nem hamis nullát', () => {
  const day = { ...scoredDay, subscores: { ...scoredDay.subscores, quality: null, rhythm: null } }
  const { container } = render(<WeekDayTile day={day} todayIso="2026-05-21"
    hasNote={false} delayMs={0} onOpen={() => {}} />)
  const none = container.querySelectorAll('.wkd-sparks i.is-none')
  expect(none).toHaveLength(2)
  // a csonk a csoportrést akkor is viszi, ha éppen ő a harmadik
  expect(container.querySelectorAll('.wkd-sparks i')[2]).toHaveClass('is-gsep')
})
```

`frontend/src/features/me/pages/WeekDaysPage.test.tsx`:

```tsx
it('hat legend-elem, csoport-elválasztóval a harmadik után', () => {
  const { container } = renderPage()
  expect(container.querySelectorAll('.wkd-legend span')).toHaveLength(6)
  expect(container.querySelector('.wkd-legend .wkd-legsep')).toBeInTheDocument()
})
```

- [ ] **Step 2: Futtasd — bukjon**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/me/components/week/WeekDayTile.test.tsx src/features/me/pages/WeekDaysPage.test.tsx
```

Elvárt: FAIL — nincs `wkd-legsep` elem (a `is-gsep` assertion már zöld lehet a Task 1 markupjából).

- [ ] **Step 3: Írd meg a CSS-t**

`prototype.css` — a `.wkd-sparks` szabály `gap` értéke 3.5px-ről 3px-re, plusz az új csoportrés:

```css
.wkd-sparks { display: flex; gap: 3px; align-items: flex-end; height: 28px; margin-left: auto; flex: none; }
/* A hat sub-jel két hármas csoportra bomlik — „amit tettél" | „ahogy állsz" (mezo-jcpt.5).
   A szélesebb rés adja az olvasási fogódzót legend nélkül is: a szín SOHA nem az egyetlen jel. */
.wkd-sparks i.is-gsep { margin-right: 5px; }
```

A legend csoport-elválasztója:

```css
.wkd-legsep { display: inline-block; width: 1px; height: 9px; background: var(--mz-ink-mut);
  opacity: 0.3; vertical-align: -1px; }
```

- [ ] **Step 4: Szúrd be a legend elválasztóját**

`WeekDaysPage.tsx` legend-blokkja:

```tsx
      <div className="wkd-legend">
        {LEGEND.map((l, i) => (
          <Fragment key={l.key}>
            {i > 0 && LEGEND[i - 1].group !== l.group && <i className="wkd-legsep" aria-hidden="true" />}
            <span><i className={l.barClass} />{l.label}</span>
          </Fragment>
        ))}
      </div>
```

(`Fragment` importja a `react`-ből.)

- [ ] **Step 5: Futtasd — menjenek át**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test && VITE_USE_MOCK=false pnpm test
```

- [ ] **Step 6: Futásidejű ellenőrzés a `verify` skillel**

Indítsd az appot mock-módban a `verify` skill receptje szerint, navigálj a `/me/week/napok`
oldalra, és **nézd meg a legszorosabb esetet**: egy `100 / 100` pontszámú napot. Ellenőrizd:

1. a hat pálcika **nem megy neki** a score-számnak és nem lóg ki a csempéből;
2. a csoportrés láthatóan elválik a normál réstől;
3. a belépő-koreográfia mind a hat pálcikát végigfuttatja (a `--d` stagger `k * 53ms`-mal nő);
4. sötét témában is mind a hat szín elkülönül.

Ha a sáv szoros: **először** a belső rést húzd 3 → 2.5px-re; ha az sem elég, a pálcikát 6 → 5.5px-re.
A WCAG 3 CSS px-es nem-szöveges padló alá **nem mehetsz** (spec Prior art). Amit módosítasz, azt a
CSS-kommentben indokold, és a lépés eredményét (mit láttál, mit állítottál) írd be a task-jelentésbe.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "$(cat <<'EOF'
feat(me): heti csempe hat pálcikája 3+3 csoportban, nap-oldali palettával (mezo-jcpt.5)

A csoportrés adja az olvasási fogódzót legend nélkül is (Carbon: a szín ne legyen az
egyetlen jel); a legend ugyanezen a határon kap halvány elválasztót. A hat hue a
nap-oldal domain-színeit veszi át, így egy átkattintás után nincs újratanulás.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `MealTimingDetail` a contracton és a scorerben

Csak az adat — a rajzolás a Task 4. Így egy reviewer külön dönthet arról, hogy a *forrás* helyes-e,
és arról, hogy a *sáv* helyesen néz-e ki.

**Files:**
- Modify: `api/feature/meal/meal.yml:196-213` (a `MealScoreDimension` `timing` mezője), `:255-259` után (új séma)
- Modify: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts` (generált)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/entity/MealBreakdownJson.java:48-60, 93`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringService.java:505-535, 594-614`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/mapper/BreakdownDtoMapper.java:47-78`
- Modify: `frontend/src/data/types.ts:104`, `frontend/src/data/fuel/mealApi.ts:85-86`
- Modify: `frontend/src/data/fuel/fuel.ts:121-128, 238-247`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringServiceTest.java`,
  `frontend/src/data/fuel/mealApi.test.ts`

**Interfaces:**
- Consumes: semmi a Task 1-2-ből (független szál).
- Produces:
  - Wire: `MealTimingDetail { eatenAt: string /* "HH:mm" */, windowFrom: string|null, windowTo: string|null, slotLabel: string }`,
    a `MealScoreDimension.timing` mezőn (nullable).
  - Java: `MealBreakdownJson.TimingDetail(String eatenAt, String windowFrom, String windowTo, String slotLabel)`
  - TS: `export interface MealTiming { eatenAt: string; windowFrom: string | null; windowTo: string | null; slotLabel: string }`
    és `ContextDimension.timing?: MealTiming | null`

- [ ] **Step 1: Írd meg a bukó backend tesztet**

`MealScoringServiceTest.java`:

```java
@Test
void contextDim_carries_the_timing_detail_from_the_SAME_config_windows_that_scored_it() {
    // 19:00-kor logolt vacsora — a configolt ablak 17–22.
    MealBreakdownJson b = service.mealBreakdown("dinner", lines(), LocalTime.of(19, 0), MealRole.STANDARD);
    MealBreakdownJson.Dimension ctx = dimension(b, "context");

    assertThat(ctx.timing()).isNotNull();
    assertThat(ctx.timing().eatenAt()).isEqualTo("19:00");
    assertThat(ctx.timing().windowFrom()).isEqualTo("17:00");
    assertThat(ctx.timing().windowTo()).isEqualTo("22:00");
    assertThat(ctx.timing().slotLabel()).isEqualTo("vacsora");
}

@Test
void contextDim_timing_has_no_window_for_a_snack_that_fits_any_hour() {
    MealBreakdownJson b = service.mealBreakdown("snack", lines(), LocalTime.of(15, 30), MealRole.STANDARD);
    MealBreakdownJson.Dimension ctx = dimension(b, "context");

    assertThat(ctx.timing().eatenAt()).isEqualTo("15:30");
    // Nincs ablak — a sáv „bármikor jó"-t rajzol, nem hamis „mindig tökéletes"-t.
    assertThat(ctx.timing().windowFrom()).isNull();
    assertThat(ctx.timing().windowTo()).isNull();
}

@Test
void recipe_template_breakdown_still_has_no_context_dimension() {
    // Ez tartja a fuel-recept-score vizuális goldent mozdulatlanul: az időzítés-sáv
    // csak logolt étkezésen jelenhet meg, mert a sablonnak nincs `context` dimenziója.
    MealBreakdownJson b = service.recipeTemplateBreakdown("dinner", lines(), MealRole.STANDARD);
    assertThat(b.dimensions().stream().map(MealBreakdownJson.Dimension::id))
        .doesNotContain("context");
}
```

A `mealBreakdown` pontos szignatúráját a `MealScoringService` publikus API-ján olvasd ki, és a
teszt hívását ahhoz igazítsd; a lényeg a három assertion-blokk.

- [ ] **Step 2: Futtasd — bukjon**

```bash
./mvnw -q -pl backend test -Dtest=MealScoringServiceTest -Dmezo.test.use-testcontainers=true
```

Elvárt: fordítási hiba (`timing()` nem létezik a `Dimension`-ön).

- [ ] **Step 3: Vedd fel a contract-sémát**

`api/feature/meal/meal.yml` — a `MealScoreDimension.properties` blokkba, a `context` sor után:

```yaml
        timing:
          allOf: [ { $ref: '#/components/schemas/MealTimingDetail' } ]
          nullable: true
```

és a `MealContextRow` séma után:

```yaml
    MealTimingDetail:
      type: object
      description: >-
        A `context` dimenzió időzítés-tényei rajzolható alakban (mezo-jcpt.3). UGYANABBÓL a
        szerver-oldali slot-ablak configból származik, ami a timing-részpontszámot adta, ezért a
        rajzolt sáv és a pontszám nem tud eltérni. Csak logolt étkezésen van jelen; a
        recept-sablon breakdownjában nincs `context` dimenzió, tehát ott soha.
      required: [eatenAt, slotLabel]
      properties:
        eatenAt: { type: string, description: 'Helyi idő "HH:mm" alakban' }
        windowFrom: { type: string, nullable: true, description: 'Az ablak kezdete "HH:mm"; null = nasi, bármikor jó' }
        windowTo: { type: string, nullable: true, description: 'Az ablak vége "HH:mm"; null = nasi, bármikor jó' }
        slotLabel: { type: string, description: 'Magyar slot-név, pl. "vacsora"' }
```

A `MealScoreDimension` `description`-jét is egészítsd ki: *„a `context` emellett `timing`-et is
hordoz, ha logolt étkezésről van szó."*

- [ ] **Step 4: Regeneráld a contractot**

```bash
cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api
```

- [ ] **Step 5: Bővítsd az envelope rekordot**

`MealBreakdownJson.java` — a `Dimension` rekord utolsó mezője elé:

```java
        List<ContextRow> context,
        TimingDetail timing,
        String note
```

és a `ContextRow` mellé:

```java
    /** A `context` dimenzió időzítés-tényei rajzolható alakban (mezo-jcpt.3). Új, opcionális mező:
     *  a már cache-elt envelope-okban null, és a FE ilyenkor egyszerűen nem rajzol sávot. */
    public record TimingDetail(String eatenAt, String windowFrom, String windowTo, String slotLabel) {
    }
```

- [ ] **Step 6: Töltsd ki a scorerben**

`MealScoringService.java` — a `Dim` rekord (`:594-614`) kap egy `TimingDetail timing` mezőt az
utolsó helyen; a `degraded(...)`, a `renormalized(...)` és a `toJson()` mind továbbadja
(a `degraded` `null`-lal). A `contextDim` (`:505-535`) a `return` előtt:

```java
        MealScoringProperties.SlotWindows w = props.slotWindows();
        TimingDetail timing = new TimingDetail(
            localTime.format(HHMM),
            hourOrNull(windowFromHour(w, slot)),
            hourOrNull(windowToHour(w, slot)),
            slotLabel(slot));
        return new Dim("context", "Időzítés & kontextus", props.weights().context(), score, 1.0, text,
            null, null, null, rows, timing);
```

A `windowFromHour`/`windowToHour` privát helperek ugyanazt a `switch (slot)`-ot használják, amit a
`timingSub(...)` (`:533+`) — **ne duplikáld a szabályt**: emeld ki a `timingSub`-ból a
slot→ablak leképezést egy `private static int[] windowOf(SlotWindows w, String slot)` helperbe,
ami snackre `null`-t ad, és mindkét hívó ezt használja. `HHMM` =
`DateTimeFormatter.ofPattern("HH:mm")`, `hourOrNull(Integer h)` = `h == null ? null : String.format("%02d:00", h)`.

- [ ] **Step 7: Vezesd át a mapperen**

`BreakdownDtoMapper.java:75-77` — a `.context(...)` után:

```java
            .timing(d.timing() == null ? null : MealTimingDetail.builder()
                .eatenAt(d.timing().eatenAt())
                .windowFrom(d.timing().windowFrom())
                .windowTo(d.timing().windowTo())
                .slotLabel(d.timing().slotLabel())
                .build())
```

- [ ] **Step 8: Futtasd a backend tesztet — menjen át**

```bash
./mvnw -q -pl backend test -Dtest='MealScoringServiceTest,BreakdownDtoMapperTest' -Dmezo.test.use-testcontainers=true
```

Ha a `BreakdownDtoMapperTest` nem létezik, hagyd ki a szűrőből.

- [ ] **Step 9: Írd meg a bukó FE adapter-tesztet**

`frontend/src/data/fuel/mealApi.test.ts`:

```ts
it('átviszi a context dimenzió timing payloadját (mezo-jcpt.3)', () => {
  const dim = toDimension({
    id: 'context', label: 'Időzítés & kontextus', weight: 0.2, score: 0.84, detail: '…',
    context: [{ label: 'Időzítés', value: '19:00 · vacsora ablakban' }],
    timing: { eatenAt: '19:00', windowFrom: '17:00', windowTo: '22:00', slotLabel: 'vacsora' },
  })
  expect(dim).toMatchObject({ id: 'context',
    timing: { eatenAt: '19:00', windowFrom: '17:00', windowTo: '22:00', slotLabel: 'vacsora' } })
})

it('timing nélküli context dimenziót változatlanul enged át (régi cache-elt envelope)', () => {
  const dim = toDimension({
    id: 'context', label: 'Időzítés & kontextus', weight: 0.2, score: 0.84, detail: '…',
    context: [{ label: 'Időzítés', value: '19:00 · vacsora ablakban' }],
  })
  expect((dim as ContextDimension).timing).toBeUndefined()
})
```

A `toDimension` a `mealApi.ts` belső mappelője — ha nem exportált, a tesztet a fájl publikus
belépési pontján (a teljes breakdown-adapteren) keresztül írd meg, ugyanazokkal az assertionökkel.

- [ ] **Step 10: Futtasd — bukjon**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/data/fuel/mealApi.test.ts
```

- [ ] **Step 11: Bővítsd a FE típust és az adaptert**

`frontend/src/data/types.ts:104` helyére:

```ts
/** A `context` dimenzió időzítés-tényei rajzolható alakban (mezo-jcpt.3). Opcionális: a
 *  cache-elt régi envelope-okban nincs, és a sáv ilyenkor egyszerűen nem rajzolódik. */
export interface MealTiming { eatenAt: string; windowFrom: string | null; windowTo: string | null; slotLabel: string }
export interface ContextDimension extends MealDimensionBase {
  id: 'context'
  context: { label: string; value: string }[]
  timing?: MealTiming | null
}
```

`frontend/src/data/fuel/mealApi.ts:85-86`:

```ts
  if (d.id === 'context' && d.context && d.context.length > 0) {
    return {
      id: 'context', ...base,
      context: d.context.map(c => ({ label: c.label, value: c.value })),
      ...(d.timing ? { timing: {
        eatenAt: d.timing.eatenAt, windowFrom: d.timing.windowFrom ?? null,
        windowTo: d.timing.windowTo ?? null, slotLabel: d.timing.slotLabel,
      } } : {}),
    }
  }
```

- [ ] **Step 12: Bővítsd a mock-fixture-öket**

`frontend/src/data/fuel/fuel.ts:121-128` és `:238-247` — a két `context` dimenzió-fixture kapjon
`timing` payloadot. **Legyen mindkét eset lefedve** a fejlesztői felületen: az egyik ablakban
(pl. `{ eatenAt: '19:00', windowFrom: '17:00', windowTo: '22:00', slotLabel: 'vacsora' }`), a másik
ablakon kívül (pl. `{ eatenAt: '23:35', windowFrom: '17:00', windowTo: '22:00', slotLabel: 'vacsora' }`).

- [ ] **Step 13: Futtasd az FE teszteket mindkét módban**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test && VITE_USE_MOCK=false pnpm test
```

- [ ] **Step 14: Commit**

```bash
git add -A && git commit -m "$(cat <<'EOF'
feat(fuel): MealTimingDetail a context dimenzión (mezo-jcpt.3)

Az étkezési ablak határai eddig csak a szerver configjában éltek, a wire-on egy
előre formázott magyar string volt. Az új opcionális mező UGYANABBÓL a
SlotWindows configból származik, ami a timing-részpontszámot adta, így a rajzolt
sáv nem tud eltérni a pontozástól. A slot→ablak leképezés egy helyre került, a
timingSub és a detail közösen használja.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: A `.tline` időzítés-sáv megrajzolása

**Files:**
- Create: `frontend/src/features/fuel/components/MealTimingStrip.tsx`
- Create: `frontend/src/features/fuel/components/MealTimingStrip.test.tsx`
- Modify: `frontend/src/features/fuel/components/DimensionCard.tsx:76-80`
- Modify: `frontend/src/styles/prototype.css` (új `.sb-tline` blokk a `.sb-fchips` közelébe)

**Interfaces:**
- Consumes: `MealTiming` (`frontend/src/data/types.ts`, Task 3), `ContextDimension.timing`.
- Produces: `export function MealTimingStrip({ timing }: { timing: MealTiming }): JSX.Element`

- [ ] **Step 1: Írd meg a bukó teszteket**

`frontend/src/features/fuel/components/MealTimingStrip.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { MealTimingStrip } from './MealTimingStrip'

const inWindow = { eatenAt: '19:00', windowFrom: '17:00', windowTo: '22:00', slotLabel: 'vacsora' }

it('a pontot a nap 0–24 h tengelyén helyezi el (19:00 → 79.2%)', () => {
  const { container } = render(<MealTimingStrip timing={inWindow} />)
  const dot = container.querySelector('.sb-tline .dot') as HTMLElement
  expect(dot.style.left).toBe('79.2%')
})

it('az ablakot kitöltött sávként rajzolja, nem körvonalként', () => {
  const { container } = render(<MealTimingStrip timing={inWindow} />)
  const band = container.querySelector('.sb-tline .band') as HTMLElement
  expect(band.style.left).toBe('70.8%')
  expect(band.style.width).toBe('20.8%')
})

it('ablakon kívül korall pontot és hidat rajzol az ablak széléig', () => {
  const { container } = render(<MealTimingStrip
    timing={{ ...inWindow, eatenAt: '23:35' }} />)
  expect(container.querySelector('.sb-tline .dot')).toHaveClass('is-miss')
  const link = container.querySelector('.sb-tline .miss-lnk') as HTMLElement
  // 22:00-tól 23:35-ig — a híd az ablak végétől a pontig tart
  expect(link.style.left).toBe('91.7%')
})

it('ablak nélküli nasira halvány teljes sávot rajzol, nem hamis „mindig tökéletes”-t', () => {
  const { container } = render(<MealTimingStrip
    timing={{ eatenAt: '15:30', windowFrom: null, windowTo: null, slotLabel: 'nasi' }} />)
  const band = container.querySelector('.sb-tline .band') as HTMLElement
  expect(band).toHaveClass('is-any')
  expect(container.querySelector('.sb-tline .dot')).not.toHaveClass('is-miss')
})

it('a sáv aria-hidden — a szöveges igazságot a tény-chip hordozza', () => {
  const { container } = render(<MealTimingStrip timing={inWindow} />)
  expect(container.querySelector('.sb-tline')).toHaveAttribute('aria-hidden', 'true')
})
```

`frontend/src/features/fuel/components/DimensionCard.test.tsx` — két új eset:

```tsx
it('a context csempe kinyitva megkapja az időzítés-sávot', () => {
  const { container } = renderOpen(contextDimWithTiming)
  expect(container.querySelector('.sb-tline')).toBeInTheDocument()
  // a tény-chipek MEGMARADNAK a sáv alatt
  expect(container.querySelectorAll('.sb-fchip').length).toBeGreaterThan(0)
})

it('timing nélküli context csempe csak a tény-chipeket mutatja', () => {
  const { container } = renderOpen(contextDimWithoutTiming)
  expect(container.querySelector('.sb-tline')).not.toBeInTheDocument()
  expect(container.querySelectorAll('.sb-fchip').length).toBeGreaterThan(0)
})

it('a többi sor-dimenzió (who, portion, …) SOHA nem kap sávot', () => {
  const { container } = renderOpen(portionDim)
  expect(container.querySelector('.sb-tline')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Futtasd — bukjon**

```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/fuel/components/MealTimingStrip.test.tsx src/features/fuel/components/DimensionCard.test.tsx
```

Elvárt: FAIL — a `MealTimingStrip` modul nem létezik.

- [ ] **Step 3: Írd meg a komponenst**

`frontend/src/features/fuel/components/MealTimingStrip.tsx`:

```tsx
// ============================================================
// Mezo · MealTimingStrip — a `context` dimenzió időzítés-sávja (mezo-jcpt.3)
// Source: a jóváhagyott napi-értékelés prototípus 3. képernyője, `.predtile.sky` `.tline`.
//
// Nyelvtan: Stephen Few bullet-graph — lineáris tengely, a minőségi zóna (az étkezési
// ablak) KITÖLTÖTT háttérsávként (nem körvonalként, ami a 3:1 nem-szöveges kontrasztot
// megbukná), és a tényleges érték EGY jelölőként. Legend nélkül olvasható.
//
// A tengely SZÁNDÉKOSAN a teljes nap (0–24 h), minden étkezésnél azonos skálán (Tufte
// small-multiples): egy nap étkezései így egymás mellett is összehasonlíthatók. Az
// „ablak ± 3 h" zoomolt tengelyt elvetettük — étkezésenként más skálát adna.
//
// A sáv aria-hidden: a szöveges igazságot a meglévő „Időzítés" tény-chip hordozza
// (WCAG / Carbon: a szín soha nem az egyetlen jel).
// ============================================================
import { cn } from '@/shared/lib/cn'
import type { MealTiming } from '@/data/types'

/** "HH:mm" → a nap hányadrésze, %-ban. */
function pct(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return ((h * 60 + m) / 1440) * 100
}

/** Egy tizedesre kerekített százalék-string — a teszt és a render ugyanazt a számot látja. */
function at(hhmm: string): string {
  return `${Math.round(pct(hhmm) * 10) / 10}%`
}

export function MealTimingStrip({ timing }: { timing: MealTiming }) {
  const { eatenAt, windowFrom, windowTo } = timing
  const anyHour = windowFrom == null || windowTo == null
  const eaten = pct(eatenAt)
  const from = anyHour ? 0 : pct(windowFrom)
  const to = anyHour ? 100 : pct(windowTo)
  const miss = !anyHour && (eaten < from || eaten > to)
  // A híd az ablak KÖZELEBBI szélétől a pontig tart — soha nem a tengely elejétől.
  const linkFrom = eaten > to ? to : eaten
  const linkTo = eaten > to ? eaten : from

  return (
    <div className="sb-tline" aria-hidden="true">
      <span className="trk" />
      <span className={cn('band', anyHour && 'is-any')}
        style={{ left: `${Math.round(from * 10) / 10}%`, width: `${Math.round((to - from) * 10) / 10}%` }} />
      {miss && (
        <span className="miss-lnk"
          style={{ left: `${Math.round(linkFrom * 10) / 10}%`, width: `${Math.round((linkTo - linkFrom) * 10) / 10}%` }} />
      )}
      <span className={cn('dot', miss && 'is-miss')} style={{ left: at(eatenAt) }} />
      <span className={cn('tlab', miss && 'is-miss')} style={{ left: at(eatenAt) }}>{eatenAt}</span>
      <span className="ax" style={{ left: '0%' }}>0</span>
      <span className="ax" style={{ left: '25%' }}>6</span>
      <span className="ax" style={{ left: '50%' }}>12</span>
      <span className="ax" style={{ left: '75%' }}>18</span>
      <span className="ax" style={{ left: '100%' }}>24</span>
    </div>
  )
}
```

- [ ] **Step 4: Írd meg a CSS-t**

`prototype.css` — a `.sb-fchips` szabály (`:7475`) elé:

```css
/* ── Időzítés-sáv a `context` csempén (mezo-jcpt.3) ──────────────────────────
   Few bullet-graph: track + KITÖLTÖTT ablak-band + egy pont. A band nem körvonal,
   mert egy 1px-es stroke megbukná a WCAG 1.4.11 3:1-es nem-szöveges kontrasztját. */
.sb-tline { position: relative; height: 34px; margin: 8px 0 2px; }
.sb-tline .trk { position: absolute; left: 0; right: 0; top: 19px; height: 5px;
  border-radius: 3px; background: var(--mz-sc-track); }
.sb-tline .band { position: absolute; top: 17px; height: 9px; border-radius: 5px;
  background: color-mix(in srgb, var(--mz-cell-sky-ink) 30%, transparent); }
.sb-tline .band.is-any { background: color-mix(in srgb, var(--mz-cell-sky-ink) 13%, transparent); }
.sb-tline .dot { position: absolute; top: 14.5px; width: 14px; height: 14px; margin-left: -7px;
  border-radius: 50%; background: var(--mz-cell-sky-ink);
  box-shadow: 0 0 0 3px var(--mz-wash-white), 0 3px 7px -3px rgba(43, 33, 24, 0.5); }
.sb-tline .dot.is-miss { background: var(--mz-cell-coral-ink); }
.sb-tline .miss-lnk { position: absolute; top: 20.5px; height: 2px;
  background: repeating-linear-gradient(90deg, var(--mz-cell-coral-ink) 0 3px, transparent 3px 6px); }
.sb-tline .tlab { position: absolute; top: 0; font-size: 9.5px; font-weight: 800;
  color: var(--mz-cell-sky-ink); transform: translateX(-50%); white-space: nowrap;
  font-variant-numeric: tabular-nums; }
.sb-tline .tlab.is-miss { color: var(--mz-cell-coral-ink); }
.sb-tline .ax { position: absolute; top: 27px; font-size: 7.5px; font-weight: 800;
  letter-spacing: 0.08em; color: var(--mz-ink-mut); transform: translateX(-50%); }
```

**Új `--mz-*` tokent ez a blokk szándékosan nem vezet be** — kizárólag meglévő
`--mz-cell-*-ink` / `--mz-sc-track` / `--mz-ink-mut` / `--mz-wash-white` tokenekből épül, amelyek
mindkét témában definiáltak. Ha mégis új tokenre lenne szükség, az **kötelezően** bekerül
`:root`-ba **és** `:root[data-theme="dark"]`-ba is.

- [ ] **Step 5: Ékeld be a `DimensionCard`-ba**

`DimensionCard.tsx:76-80` — a meglévő hatos `ContextPanel`-feltétel **elé**:

```tsx
          {/* Az időzítés-sáv KIZÁRÓLAG a logolt étkezés `context` dimenzióján jelenik meg —
              nem a generikus ContextPanelben, amit hat dimenzió oszt. A recept-sablon
              breakdownjában nincs `context` dimenzió, tehát a recept-lapra sosem kerül ki. */}
          {dim.id === 'context' && 'timing' in dim && dim.timing != null
            && <MealTimingStrip timing={dim.timing} />}
```

Importáld a `MealTimingStrip`-et a fájl tetején. A `ContextPanel` hívása **változatlan** marad —
a tény-chipek a sáv alatt maradnak.

- [ ] **Step 6: Futtasd — menjenek át**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test && VITE_USE_MOCK=false pnpm test
```

- [ ] **Step 7: Futásidejű ellenőrzés a `verify` skillel**

Mock-módban nyisd meg egy logolt étkezés score-lapját, és nyisd ki az „Időzítés & kontextus"
csempét. Ellenőrizd:

1. az **ablakban** lévő étkezés pontja a sávon belül van, sky színnel;
2. az **ablakon kívüli** étkezés pontja korall, és a szaggatott híd az ablak széléig tart
   (nem a tengely elejéig);
3. a tény-chipek **megmaradtak** a sáv alatt;
4. sötét témában a sáv, a band és a pont mind elkülönül;
5. a **recept**-lap score-sheetjén **nem jelenik meg** sáv.

A látottakat írd be a task-jelentésbe.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "$(cat <<'EOF'
feat(fuel): meal időzítés-sáv a context csempén (mezo-jcpt.3)

Few bullet-graph nyelvtan: 0–24 h tengely minden étkezésnél azonos skálán (Tufte
small-multiples), kitöltött ablak-band, egy pont, ablakon kívül korall pont +
szaggatott híd az ablak széléig. aria-hidden — a szöveges igazság a tény-chipben
marad. A recept-lapra nem kerül ki: a sablon-breakdownnak nincs context dimenziója.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Dokumentáció, CODEMAP és a teljes kapu-sor

**Files:**
- Modify: `docs/features/me.md:151-159, 161-198, 389, 397, 590, 601-602, 747-754, 680`
- Modify: `docs/features/fuel.md:75, 395`
- Modify: `docs/features/companion.md` (a `DayScoreService` projekció-narratívája)
- Modify: `docs/CODEMAP.md` (generált)

**Interfaces:**
- Consumes: minden korábbi task leszállított alakja.
- Produces: semmi kódszerződés.

- [ ] **Step 1: Frissítsd a `me.md`-t**

Négy kötelező tartalmi javítás, a doksi-mandátum és a szelet által feltárt elavulások miatt:

1. **§2 „Heti" (`:151-159`)** — a bekezdés ma egy **nem létező** `WeekPage.tsx`-et ír le, saját
   maga flageli ezt `:680`-nál. Írd át a valóságra: `WeekHubPage` + `WeekAnalysisPage` /
   `WeekDaysPage` / `WeekDayPage` / `WeekLessonsPage` / `WeekDiscoveriesPage`, és a `:680`-as
   „stale pointer" flaget töröld, mert megszűnt.
2. **`:154`** — a `WeekDayCard` mint élő felület: az élő csempe a `components/week/WeekDayTile.tsx`,
   a `WeekDayCard` **törölve** ebben a szeletben.
3. **§2 heti csempe leírása** — négy sub-jelről hatra, a 3+3 csoportosítással és a nap-oldallal
   egyező palettával; a `rhythm` extrinsic volta és a `INTRINSIC_SUBSCORE_KEYS` mint az
   „unlogged" próba alapja.
4. **`:590`** — `DayScoreServiceIT` „100/100/100/100" állítása ma sem igaz (az `activity` 30), és a
   projekció most hat mezős: igazítsd a valósághoz.
5. **§4 (`:389`, `:397`)** — a `me-week` `subscores` wire-alak hat kulcsa.
6. **§7 (`:601-602`)** és **§10 file map (`:747-754`)** — a törölt `WeekDayCard(.test)` kivezetése,
   a `components/week/` fájlok felvétele.

- [ ] **Step 2: Frissítsd a `fuel.md`-t**

- **§2 „Logolás 2.1" 4. pont (`:75`)** — az időzítés-sáv **leszállítva**: honnan jön az ablak
  (`MealTimingDetail`, ugyanaz a `SlotWindows` config, ami pontozott), miért csak logolt
  étkezésen látszik (a sablon-breakdownban nincs `context` dimenzió), és hogy a régi cache-elt
  envelope-okban `null`, ilyenkor a sáv nem rajzolódik.
- **§10 komponensek (`:395`)** — `MealTimingStrip`.

- [ ] **Step 3: Frissítsd a `companion.md`-t**

A `DayScoreService` → `MeWeekSubscores` projekció narratívája: a „legacy négyes wire-alak"
**megszűnt**, a heti mozaik ugyanazt a hat dimenzió-idet kapja, mint a nap-oldal. Írd le a
`weekly_score` négy átlagoszlopának változatlanságát is (`sleepAvg←sleep, fuelAvg←nutrition,
checkinAvg←logging, activityAvg←training`) és **miért** nem kellett migráció, valamint hogy a
`renderDayLine` LLM-prompt payload szándékosan a régi négy jelnél maradt.

- [ ] **Step 4: Regeneráld a CODEMAP-et**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/ai-score-macro-evaluation-7cb15a && node scripts/gen-codemap.mjs
```

**Ne javítsd kézzel** a `components/week/` alkönyvtár laposítását a CODEMAP-ben — ez a generátor
ismert korlátja, nem hiba.

- [ ] **Step 5: Futtasd a teljes helyi kapu-sort**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/ai-score-macro-evaluation-7cb15a \
  && node scripts/gen-codemap.mjs --check \
  && node scripts/lint-liquibase.mjs \
  && ./mvnw -q -pl backend test -Dtest='MeWeekServiceTest,DayScoreServiceTest,WeeklyScoreServiceTest,MeWeekServiceRenderDayLineTest,MealScoringServiceTest,ArchitectureTest' -Dmezo.test.use-testcontainers=true
```

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/ai-score-macro-evaluation-7cb15a/frontend \
  && VITE_USE_MOCK=true pnpm test && VITE_USE_MOCK=false pnpm test && pnpm lint && pnpm build
```

Mindnek zöldnek kell lennie. **Ha a `git status` új Liquibase changesetet mutat, valami félrement** —
a spec D3 döntése szerint ennek a szeletnek nincs migrációja.

- [ ] **Step 6: Ellenőrizd a vizuális goldeneket — feltételezés helyett**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/ai-score-macro-evaluation-7cb15a \
  && grep -n "SCREENS" -A40 frontend/e2e/visual.spec.ts | head -60
```

Igazold, hogy a suite egyik képernyője sem rendereli a `WeekDayTile`-t vagy a logolt étkezés
`context` dimenzióját. Ha bármelyik mégis, **jelezd a task-jelentésben**, hogy PR után
`update-visual-baselines.yml` dispatch kell (a linux baseline darwin gépen nem regenerálható).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "$(cat <<'EOF'
docs: Köteg B átvezetése + elavult me.md-mutatók lezárása (mezo-jcpt.5, mezo-jcpt.3)

A me.md §2 „Heti" bekezdése egy 2026 tavasza óta nem létező WeekPage.tsx-et írt le
(a doksi maga flagelte); a szelet ezt zárja le a valós oldal-felbontásra. Emellett a
hatos sub-jel wire-alak, a MealTimingStrip és a companion projekció-narratíva.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**1. Spec-lefedettség.** D1 → Task 1 (Step 3-6). D2 → Task 1 (Step 3, 5, 12). D3 → Task 1
(Step 3 megjegyzés, Step 8 javadoc, Step 20 liquibase-bizonyíték, Task 5 Step 5). D4 → Task 1
(Step 7, 9). D5 → Task 2. D6 → Task 1 (Step 14) + Task 2 (Step 6 sötét-téma ellenőrzés). D7 →
Task 3. D8 → Task 4. D9 → Task 1 (Step 17). Hiba- és hiányállapotok → Task 1 (Step 10, 18),
Task 3 (Step 1 snack-eset, Step 9 régi envelope), Task 4 (Step 1 négy állapot). Tesztelési
szekció → minden task saját lépései + Task 5 Step 5-6. Dokumentáció → Task 5. **Nincs
lefedetlen spec-követelmény.**

**2. Placeholder-ellenőrzés.** Nincs „TBD"/„TODO"/„hasonlóan a Task N-hez"; minden kódlépés
konkrét blokkot tartalmaz. Két helyen adtam feltételes utasítást (Task 1 Step 1 a
`DayScoreServiceTestAccess` létezéséről, Task 3 Step 9 a `toDimension` exportáltságáról) —
mindkettőnél megadtam a pontos alternatívát és az assertion-készlet változatlan marad, tehát
ezek nem placeholderek, hanem a repo két lehetséges állapotára adott konkrét elágazások.

**3. Típus-konzisztencia.** `DaySubscores` mezősorrendje (nutrition, quality, training, sleep,
logging, rhythm) azonos a Step 5-ös rekordban, a Step 6-os projekcióban és a Step 8-as
method-reference-ekben. `DAY_DIMENSIONS` mezőkészlete (`key`, `label`, `barClass`, `group`)
azonos a Step 12-es definícióban, a Step 10-es tesztben, a Task 1 Step 15/16-os használatban és a
Task 2 Step 4-es legend-renderben. `MealTiming` mezőnevei (`eatenAt`, `windowFrom`, `windowTo`,
`slotLabel`) azonosak a contractban (Task 3 Step 3), a Java rekordban (Step 5), a mapperben
(Step 7), a TS típusban (Step 11) és a komponensben (Task 4 Step 3). Az `is-gsep` osztálynév
azonos a Task 1 Step 15-ös markupban, a Task 2 Step 1-es tesztben és a Step 3-as CSS-ben.
