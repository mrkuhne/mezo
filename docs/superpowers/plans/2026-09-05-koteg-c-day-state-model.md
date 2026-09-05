# Köteg C — a nap becsületes állapotmodellje · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Egy napon, amelyen a felhasználó semmit nem logolt, a `logging` dimenzió „nem mérhető"-t adjon 0 helyett — így a „nincs adat" állapot újra elérhetővé válik produkcióban —, és a „logolt-e bármit" kérdésre mind a backend, mind a frontend **ugyanabból az egy** forrásból válaszoljon.

**Architecture:** A `DayInputs` megkapja a hiányzó `weightKg` és `xp` mezőt, amivel a motor először tud teljes választ adni a „logolt-e ma bármit" kérdésre. Ez az egy predikátum vezérli a `logging` mérhetőségét és a `DayReviewService` állapot-döntését; a frontend két párhuzamos levezetése egy modullá olvad. Két vállalt következmény: az LLM-prompt sora és a `weekly_score.checkin_avg` oszlop jelentése változik.

**Tech Stack:** Java 21 / Spring Boot, OpenAPI contract-first, Liquibase, React + TypeScript, Vitest + RTL, pnpm 9.

**Spec:** [`docs/superpowers/specs/2026-09-05-koteg-c-day-state-model-design.md`](../specs/2026-09-05-koteg-c-day-state-model-design.md)
**bd:** `mezo-el0t` + `mezo-jcpt.8` (egy branch, egy PR — szétválaszthatatlan, lásd a spec „Miért egy szelet")

## Global Constraints

- **A `DayEvaluationEngine` TISZTA szolgáltatás, repository nélkül** (saját javadoc `:12-17`). Az új adat betöltése a `DayScoreService`-be tartozik; a motor csak a `DayInputs`-ot kapja.
- **A 2-DONE kapu érintetlen napon elérhetetlen kell maradjon.** Ez a Köteg A/B review-jának a fixe (`DayEvaluationEngine.java:92-102`): a `rhythm` extrinsic, egyedül nem nyithat kaput. Élő pinjei `DayReviewServiceTest.java:365-370` és `DayScoreServiceIT.java:157-171`.
- **A `logging` „nem mérhető" ága KIZÁRÓLAG a semmilyen logot nem tartalmazó napra vonatkozik.** Aki edzett vagy aludt, de nem logolt étkezést/vizet/check-int, továbbra is DONE-t és őszinte 0-t kap — a `loggingDim:348-359` kommentjében rögzített korábbi review-döntés így sértetlen marad. Azt a kommentet **bővíteni** kell, nem törölni.
- **Fókuszált backend teszt mindig `-Dmezo.test.use-testcontainers=true`-val**; az `ArchitectureTest` külön futtatandó.
- **FE tesztek KÉT módban, explicit env-vel:** `VITE_USE_MOCK=true pnpm test` **és** `VITE_USE_MOCK=false pnpm test`.
- **Ez a szelet migrációval jár** (a `weekly_score` purge-e). A `lint-liquibase.mjs` zöldje **és a changeset jelenléte** a bizonyíték — ellentétben a Köteg B-vel, ahol a hiánya volt az.
- Becsületes hiány: null, soha nem hamis 0. Mozaik 2.0; clay ikonok, soha emoji.
- Commit-tárgy hordozza a bd id-t (`mezo-el0t` és/vagy `mezo-jcpt.8`) és a `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` trailert.
- **NE pusholj, NE nyiss PR-t, NE mergelj.** A branch `feat/day-state-model`, friss `origin/main`-ből.

---

### Task 1: `DayInputs` bővítése testsúllyal és XP-vel (mezo-jcpt.8 fele)

Tisztán mechanikus, **viselkedés-változás nélkül**: a két mező bekerül, feltöltődik, de még senki nem olvassa. Ez teszi a Task 2-t egyáltalán lehetségessé.

**Files:**
- Modify: `backend/.../companion/service/DayEvaluationEngine.java:47-57` (`DayInputs`)
- Modify: `backend/.../companion/service/DayScoreService.java` (a két építési hely + a betöltés)
- Test: `backend/src/test/java/.../DayEvaluationEngineTest.java` (a fluent builder `:155-160`), `.../DayReviewServiceTest.java` (6 nyers `new DayInputs(` hívás: `:170, :202, :365, :381, :440, :450`)

**Interfaces:**
- Produces: `DayInputs` két új komponenssel — `Double weightKg`, `Integer xp` — a `checkinCount` **után**, a `priorBaseScores` **elé** (a `priorBaseScores` maradjon az utolsó, mert a `withPriors` másoló azt cseréli).

- [ ] **Step 1: Builder a `DayReviewServiceTest`-be, MIELŐTT a rekord változna**

A 6 nyers pozicionális hívás a valódi mechanikus költség. Előbb vezess be a fájlban egy privát fluent buildert (a `DayEvaluationEngineTest:155-160` mintájára), és írd át rá mind a 6 helyet — **változatlan értékekkel**. Futtasd:

```bash
cd backend && ./mvnw -q test -Dtest=DayReviewServiceTest -Dmezo.test.use-testcontainers=true
```

Elvárt: zöld, viselkedés-változás nélkül. **Ez külön commit.**

- [ ] **Step 2: Írd meg a bukó tesztet a betöltésre**

`DayScoreServiceTest`-ben (vagy ahol a `inputsFor` tesztelve van): egy nap, amelyre van
testsúly-log és XP, adja vissza azokat a `DayInputs`-ban.

```java
@Test
void inputsFor_carries_the_days_weight_and_xp() {
    // A DayInputs eddig NEM hordozta ezeket, ezért egy csak-mérlegelés nap
    // "semmit nem logolt"-nak látszott (mezo-jcpt.8).
    DayEvaluationEngine.DayInputs in = service.inputsFor(userId, LocalDate.of(2026, 5, 21));
    assertThat(in.weightKg()).isEqualTo(74.2);
    assertThat(in.xp()).isEqualTo(120);
}
```

A fixture-t a fájl meglévő konvenciója szerint állítsd be (mock repository vagy IT-adat).

- [ ] **Step 3: Futtasd — bukjon** (`weightKg()` nem létezik).

- [ ] **Step 4: Bővítsd a rekordot**

```java
        List<MealLogFact> meals,                       // logolási dimenzióhoz
        boolean waterLogged, int checkinCount,
        Double weightKg,                               // null = aznap nem mérlegelt (mezo-jcpt.8)
        Integer xp,                                    // null/0 = aznap nem gyűlt XP
        List<Integer> priorBaseScores                  // az előző rhythmWindowDays nap base-scoreja (ami van)
```

- [ ] **Step 5: Töltsd fel a `DayScoreService`-ben**

**Olvasd el** a `DayScoreService` két építési helyét (`rhythmFreeInputs` és `withPriors`) és a
`inputsFor` belépőt, mielőtt írsz. A forrásokat a `MeWeekService` már használja **ranged**
lekérdezéssel: `WeightLogRepository.latestWeightByDate` (`MeWeekService.java:314-320`) és
`metricSeriesService.series(userId, MetricKey.DAILY_XP, start, end)` (`:96`). **Ranged
lekérdezést használj**, ne per-napot — a `mezo-jcpt.6` épp a per-napi felsokszorozás ellen szól,
ne teremtsünk újat.

A motorba **NEM** kerülhet repository (ArchUnit + a motor javadoc-ja).

- [ ] **Step 6: Futtasd — menjen át**

```bash
cd backend && ./mvnw -q test -Dtest='DayScoreServiceTest,DayReviewServiceTest,DayEvaluationEngineTest,ArchitectureTest' -Dmezo.test.use-testcontainers=true
```

- [ ] **Step 7: Commit** — `feat(companion): weightKg + xp a DayInputs-ban (mezo-jcpt.8)`

---

### Task 2: Egy hiteles „logolt-e bármit" predikátum, és a `logging` mérhetősége

**Files:**
- Modify: `backend/.../companion/service/DayEvaluationEngine.java` (új predikátum + `loggingDim` + a `:348-359` komment bővítése)
- Modify: `backend/.../companion/service/DayReviewService.java:195-202` (`hasAnyLog` → a közös predikátum)
- Test: `DayEvaluationEngineTest`, `DayReviewServiceTest`, `DayScoreServiceIT`

**Interfaces:**
- Consumes: a Task 1 bővített `DayInputs`-a.
- Produces: `public static boolean anyLogPresent(DayInputs in)` a `DayEvaluationEngine`-en (statikus, hogy a `DayReviewService` a motor példányosítása nélkül is hívhassa).

- [ ] **Step 1: Írd meg a bukó teszteket**

```java
@Test
void logging_is_not_measurable_on_a_day_with_no_logs_at_all() {
    // A szerződés (me-week.yml) MA IS azt mondja: "null = nem mérhető ezen a napon —
    // soha nem 0". Eddig a motor pont 0-t küldött, és ettől a "nincs adat" állapot
    // elérhetetlen volt produkcióban (mezo-el0t).
    DayEvaluation e = engine.evaluate(untouchedClosedDay().build());
    DayDimension logging = dim(e, "logging");
    assertThat(logging.status()).isEqualTo("NO_DATA");
    assertThat(logging.score()).isNull();
}

@Test
void logging_STILL_penalises_a_day_that_was_lived_but_not_logged() {
    // A loggingDim korábbi review-döntése (:348-359) érintetlen: aki edzett és aludt,
    // de nem logolt étkezést/vizet/check-int, továbbra is mérhető és őszinte 0-t kap.
    DayEvaluation e = engine.evaluate(untouchedClosedDay()
        .doneWorkouts(1).sleepH(7.5).build());
    DayDimension logging = dim(e, "logging");
    assertThat(logging.status()).isEqualTo("DONE");
    assertThat(logging.score()).isZero();
}

@Test
void a_weigh_in_only_day_counts_as_logged() {
    // mezo-jcpt.8: eddig 'empty', pedig a felhasználó CSINÁLT valamit.
    assertThat(DayEvaluationEngine.anyLogPresent(
        untouchedClosedDay().weightKg(74.2).build())).isTrue();
}

@Test
void an_untouched_day_stays_below_the_gate_even_with_priors() {
    // REGRESSZIÓS PIN — a Köteg A/B tanulsága: a rhythm extrinsic, egyedül nem nyithat
    // kaput. Most strukturálisan is igaz: nulla intrinsic DONE.
    DayEvaluation e = engine.evaluate(untouchedClosedDay()
        .priorBaseScores(List.of(70, 78, 80)).build());
    assertThat(e.base()).isNull();
}
```

A segédnevek (`untouchedClosedDay`, `dim`) a fájl meglévő builderéhez igazítandók.

- [ ] **Step 2: Futtasd — bukjanak.**

- [ ] **Step 3: Vedd fel a predikátumot**

```java
    /**
     * Logolt-e a felhasználó EZEN A NAPON bármit egyáltalán — a nap „becsületes állapot"
     * modelljének egyetlen igazságforrása (mezo-el0t). SZÁNDÉKOSAN a teljes loghalmaz felett
     * kérdez, nem a logolás-dimenzió saját bemenetei felett: egy nap, amelyen a felhasználó
     * edzett vagy aludt, de étkezést/vizet/check-int nem logolt, LOGOLT napnak számít — így a
     * {@code loggingDim} ott továbbra is mérhető marad és őszinte 0-val bünteti a napot,
     * ahogy azt a {@code loggingDim} javadoc-jában rögzített korábbi review-döntés megköveteli.
     */
    public static boolean anyLogPresent(DayInputs in) {
        return in.kcal() != null
            || (in.meals() != null && !in.meals().isEmpty())
            || in.waterLogged()
            || in.checkinCount() > 0
            || in.sleepH() != null
            || (in.doneWorkouts() != null && in.doneWorkouts() > 0)
            || in.weightKg() != null
            || (in.xp() != null && in.xp() > 0);
    }
```

- [ ] **Step 4: Kösd be a `loggingDim`-be**

A `closed` ág elejére, a számítás elé:

```java
        if (!anyLogPresent(in)) {
            // Semmilyen log — nincs mit mérni. A súly elejtése itt NEM enged el büntetést:
            // egy ilyen napon a kapu amúgy is zárva (nulla intrinsic DONE), tehát nincs
            // pontszám, amit a logolás lehúzhatna.
            return new RawDim(id, label, configWeight, null, NO_DATA, loggingFacts(in, mealPart));
        }
```

A `:348-359` kommentet **bővítsd** ezzel a megkülönböztetéssel — a benne rögzített érv él, csak
a hatóköre szűkül a „logolt valamit, de rosszul" esetre.

- [ ] **Step 5: A `DayReviewService.hasAnyLog` álljon át a közös predikátumra**

`DayReviewService.java:195-202` — a részleges saját másolat helyére
`DayEvaluationEngine.anyLogPresent(inputs)`. A `:193-194`-es javadoc, ami eddig a
weight/XP-hiányt **elfogadott korlátként** dokumentálta, most **törlendő**: a korlát megszűnt.

- [ ] **Step 6: Futtasd**

```bash
cd backend && ./mvnw -q test -Dtest='DayEvaluationEngineTest,DayReviewServiceTest,DayScoreServiceTest,DayScoreServiceIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true
```

A `DayScoreServiceIT.emptyDayYieldsNullEverything` (`:157-171`) ma azt pineli, hogy a `logging`
**nulla**. Ez a szelet szándékosan `null`-ra változtatja — igazítsd, és a teszt nevében/kommentjében
mondd ki, hogy ez a `mezo-el0t` javítása.

- [ ] **Step 7: Commit** — `feat(companion): a logging nem mérhető a semmit nem logolt napon (mezo-el0t)`

---

### Task 3: A két vállalt következmény — prompt-payload és cache-oszlop

**Files:**
- Modify: `backend/.../companion/service/MeWeekService.java:221-247` (javadoc), test `MeWeekServiceRenderDayLineTest`
- Modify: `backend/.../companion/service/WeeklyScoreService.java:219-245` (javadoc)
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/<dátum>_mezo-el0t_weekly_score_cache_invalidation.sql`

- [ ] **Step 1: A prompt-sor pinjének tudatos igazítása**

A `renderDayLine` érintetlen napra ma `checkin 0`-t ír, ezután `checkin –`-t (az `orDash`
`:250-252` null-ra `–`-t ad). **A kód nem változik** — a viselkedés a Task 2 következménye.
Igazítsd a `MeWeekServiceRenderDayLineTest` érintett elvárását, és a teszt kommentjében mondd
ki, hogy ez **szándékos**: a Köteg B-ben a bájtazonosság volt a bizonyíték, itt épp a
változás az.

A `renderDayLine` javadocjába vedd fel: *„Egy érintetlen nap `checkin –`-t ír, nem `0`-t
(mezo-el0t): a `–` az igazat mondja, a `0` egy nem létező mérést állítana. Ez LLM-prompt
payload — minden chat-fordulóban fut."*

- [ ] **Step 2: A cache-oszlop jelentésváltásának rögzítése + purge**

A `WeeklyScoreService.aggregate` a nem-null `logging` értékeket átlagolja `checkinAvg`-ba. Az
érintetlen napok mostantól kiesnek belőle (eddig 0-val húzták lefelé). A már cache-elt hetek
tehát más szabállyal számoltak.

Írj egy **egyszeri purge-changesetet** a `weekly_score` sorokra, pontosan a precedens szerint:
`backend/src/main/resources/db/changelog/1.0.0/script/202609031200_mezo-jcpt.4_weekly_score_cache_invalidation.sql`
— **olvasd el, és kövesd a formáját** (a changelog-beillesztés módját is). A changeset
kommentje mondja ki, hogy a `checkin_avg` **jelentése** változott, nem a képlete.

A `WeeklyScoreService.aggregate` javadocját egészítsd ki ugyanezzel.

- [ ] **Step 3: Futtasd**

```bash
cd backend && ./mvnw -q test -Dtest='MeWeekServiceRenderDayLineTest,WeeklyScoreServiceTest,MeWeekTrendIT' -Dmezo.test.use-testcontainers=true
cd .. && node scripts/lint-liquibase.mjs
```

Elvárt: zöld, **és a changeset létezik** (`git status` mutassa).

- [ ] **Step 4: Commit** — `feat(companion): checkin_avg jelentésváltás + weekly_score purge (mezo-el0t)`

---

### Task 4: A frontend három levezetése eggyé olvad

**Files:**
- Modify: `frontend/src/features/me/logic/weekDay.ts`, `frontend/src/features/me/logic/dayScoreState.ts`
- Modify: minden fogyasztó (`WeekDayTile.tsx`, `WeekDaysPage.tsx`, `WeekHubPage.tsx`, `WeekScoreBars.tsx`, `WeekDayPage.tsx`)
- Test: a hozzájuk tartozó tesztfájlok

**Interfaces:**
- Consumes: a wire-on mostantól `logging: null` érintetlen napon.
- Produces: **egy** állapot-levezetés. A két mai fogalomkészletet (`empty/thin/scored/future` vs `nodata/learning/scored/future`) **egyre** kell hozni; a backend nevei (`empty`/`thin`) a mérvadók, mert a `WeekDayPage` már ma is azokat olvassa.

- [ ] **Step 1: Írd meg a bukó teszteket**

```ts
it('egy érintetlen nap újra „nincs adat", mert a logging már null (mezo-el0t)', () => {
  const day = untouchedDay({ subscores: {
    nutrition: null, quality: null, training: null,
    sleep: null, logging: null, rhythm: 41,
  } })
  expect(subscoreCount(day)).toBe(0)
  expect(dayState(day, '2026-05-22')).toBe('empty')
})

it('a hub és a mozaik UGYANAZT az állapotot mondja ugyanarra a napra', () => {
  // Ma két külön levezetés van, és már ma sem egyeznek (az egyik nézi a proteinG-t,
  // a másik nem). Ez a teszt a duplikáció visszatérését akadályozza.
  const day = untouchedDay({ proteinG: 12 })
  expect(dayState(day, '2026-05-22')).toBe(weekHubState(day, '2026-05-22'))
})
```

- [ ] **Step 2: Futtasd — bukjanak.**

- [ ] **Step 3: Vond össze a két modult**

A `dayScoreState.ts` és a `weekDay.ts` állapot-részét **egy** helyre; a másik fájl re-exportál
vagy megszűnik. **Mindkét fájl fejléc-kommentje ma azt állítja, hogy ő „az egyetlen hely" —
a megmaradó egy mondja igazat, a másik állítás törlendő.** A `proteinG` vs. nem-`proteinG`
eltérést tudatosan döntsd el (a `proteinG` jelenléte log, tehát bele tartozik), és a
kommentben indokold.

- [ ] **Step 4: Vezesd át a fogyasztókat**, és futtasd:

```bash
cd frontend && VITE_USE_MOCK=true pnpm test && VITE_USE_MOCK=false pnpm test
```

- [ ] **Step 5: Mock-adat**

A `data/me/meWeek.ts` csupa-null szombatja **helyes marad** (ez most már a valós backend alakja
is). Ellenőrizd, hogy a mock legalább egy napon `logging: null`-t ad, hogy a „nincs adat" ág
látszódjon a fejlesztői felületen.

- [ ] **Step 6: Futásidejű ellenőrzés a `verify` skillel** — mock módban a `/me/week` hub, a
`/me/week/napok` mozaik és egy `/me/week/napok/:date` nap-oldal **ugyanarra a napra ugyanazt**
mondja. Írd le, mit láttál.

- [ ] **Step 7: Commit** — `refactor(me): egy állapot-levezetés a három helyett (mezo-el0t)`

---

### Task 5: Dokumentáció, CODEMAP, teljes kapu-sor

**Files:** `docs/features/companion.md`, `docs/features/me.md`, `docs/CODEMAP.md`

- [ ] **Step 1: `companion.md`** — a `logging` mérhetőségi szabálya (és hogy a korábbi
  review-döntés hatóköre szűkült, nem szűnt meg), a kapu strukturális biztonsága érintetlen
  napon, a `checkin_avg` jelentésváltása és a purge oka.

- [ ] **Step 2: `me.md`** — a §2-es bekezdés, amit a Köteg B írt („produkcióban »tanulom«
  jelenik meg, nem »nincs adat«"), **most már NEM igaz** — cseréld a valóságra, és hivatkozz
  arra, hogy ezt a `mezo-el0t` oldotta meg. A `mezo-el0t`-re mutató „elfogadott korlát"
  hivatkozás törlendő.

- [ ] **Step 3: CODEMAP-regen** — `node scripts/gen-codemap.mjs` (ne kézzel).

- [ ] **Step 4: Teljes helyi kapu-sor**

```bash
node scripts/gen-codemap.mjs --check && node scripts/lint-liquibase.mjs
cd backend && ./mvnw -q test -Dtest='DayEvaluationEngineTest,DayReviewServiceTest,DayScoreServiceTest,DayScoreServiceIT,MeWeekServiceRenderDayLineTest,WeeklyScoreServiceTest,MeWeekTrendIT,MeWeekControllerIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true
cd ../frontend && VITE_USE_MOCK=true pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build
```

- [ ] **Step 5: Vizuális kitettség ellenőrzése** — a `/me/week` hub **benne van** a Playwright
suite-ban, és a mini-gyűrű `is-nodata` osztálya + a „N nincs adat" aria-címke a snapshot
DOM-jában él. A suite **mock módban** fut, a mock szombatja pedig eddig is csupa-null volt,
tehát elvileg nem mozdul. **Ellenőrizd, ne feltételezd** — futtasd a vizuális suite-ot, és ha
mozdul, jelezd a jelentésben, hogy `update-visual-baselines.yml` dispatch kell.

- [ ] **Step 6: Commit** — `docs: Köteg C átvezetése (mezo-el0t, mezo-jcpt.8)`

## Self-Review

**Spec-lefedettség.** D1 → Task 2. D1/a (a korábbi review-döntés hatóköre) → Task 2 Step 3-4 + Task 5 Step 1. D2 (predikátum) → Task 1 + Task 2. D3 (prompt-payload) → Task 3 Step 1. D4 (cache + purge) → Task 3 Step 2. D5 (FE összevonás) → Task 4. Hiány-állapotok → Task 2 Step 1 négy teszte + Task 4 Step 1.

**Placeholder-ellenőrzés.** Nincs TBD. Két helyen adok „olvasd el, mielőtt írsz" utasítást (Task 1 Step 5 a `DayScoreService` betöltői, Task 3 Step 2 a precedens-changeset) — ezek konkrét fájlmegjelölések, nem placeholderek: a pontos kódot ott a meglévő minta határozza meg, és félrevezető lenne kitalálnom.

**Típus-konzisztencia.** `DayInputs` új komponensei (`Double weightKg`, `Integer xp`) azonosak a Task 1 Step 4 rekordjában és a Task 2 predikátumában. Az `anyLogPresent` szignatúrája azonos a Task 2 Step 3-ban és a `DayReviewService` bekötésében (Step 5).
