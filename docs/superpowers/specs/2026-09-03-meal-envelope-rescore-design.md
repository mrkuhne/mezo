# Régi meal-envelope-ok újrapontozása — design spec

**Dátum:** 2026-09-03 · **Státusz:** user által jóváhagyott design, spec-review előtt
**Driving bd issue:** `mezo-jcpt.2` (P1 BUG) · **Szülő:** `mezo-jcpt` (napi értékelés újratervezés)

## Probléma

A `mezo-jcpt.1` szelet előtt írt `meal.breakdown` jsonb envelope-okban a `dimensions[].weight`
a **nyers config-súly** — degradált („Nincs adat", `weight 0`) dimenzió esetén a maradék súlyok
összege ≈0.34 —, miközben a tárolt `meal.score` / `breakdown.value` **már** el volt osztva a
`weightSum`-mal. A Mozaik 2.0 `ScoreLedger` a Σ-sort kliensoldalon számolja ezekből a súlyokból
([`ScoreLedger.tsx:21`](../../../frontend/src/features/fuel/components/ScoreLedger.tsx)):

```ts
const sum = live.reduce((s, d) => s + d.weight * d.score * 100, 0)
```

így egy régi, degradált dimenziót tartalmazó étkezésnél a Σ látványosan kisebb számot mutat,
mint a fejléc-pontszám **ugyanabban a sheetben**. Nem crash, és nem a jcpt.1 branch okozta —
az új UI csak láthatóvá tette a meglévő adat-adósságot. A FE-teszt
(`ScoreLedger.test.tsx:23-37`, „weights already renormalized upstream") *feltételezi* azt a
backend-garanciát, amit ezek a sorok megsértenek.

**A súly-Σ önmagában nem elég staleness-detektor.** A jcpt.1 két viselkedést változtatott:

| commit | változás | hatás a régi sorokra |
|---|---|---|
| `d51ec268b` | `scoreMeal` renormalizálja a súlyokat a túlélő dimenziók felett | csak a degradált envelope-oknál látszik a Σ-en |
| `01b194ac7` | a makró-dimenzió a ratio-deviációt kcal-szignifikanciával skálázza | **minden** envelope score-ját elmozdíthatja, a súly-Σ-t nem |

Egy „Σ ≠ 1.0" heurisztika tehát a második osztályt csendben kihagyná.

## Döntések

| # | Döntés | Tartalom |
|---|---|---|
| D1 | **Re-score, nem FE-kozmetika** | A ledger Σ-ját nem a fejléc-számból származtatjuk (az a %-attribúciós sorban továbbra is elavult súlyokat mutatna, és a régi *számok* is hibásak maradnának). A régi étkezéseket újrapontozzuk, így a belső konzisztencia ÉS a számok is gyógyulnak. A whole-branch review is emellett érvelt. |
| D2 | **Verzióbélyeg az envelope-ban** | `MealBreakdownJson` kap egy `Integer formulaVersion` mezőt; `MealScoringService.FORMULA_VERSION = 1` bélyegzi minden újonnan számolt envelope-ot. A régiek `null`-t deszerializálnak → ez a „0-s generáció". Ez az egyetlen dolog, ami a fenti két hiba-osztályt együtt, megbízhatóan detektálja, és a következő formulaváltásnál is használható (bump). |
| D3 | **Egyszeri, idempotens backfill runner** | `CommandLineRunner`, ami a *valódi* write-path-on pontoz újra. NEM lazy read-time recompute: az folyamatosan újraírná a történelmet, és szembemegy a meal-envelope „frozen at write" szándékával. NEM SQL-be duplikált formula sem. |
| D4 | **`@Profile("demodata")` őr** | A demodata a prod-ban aktív profil, tehát a runner a következő deploykor prodon lefut. Az őr arra kell, hogy a bean a *többi* IT-kontextusban ne létezzen: a `MealPopulator.createScoredMeal` kézzel gyárt envelope-ot verzióbélyeg nélkül, egy őrizetlen runner tehát idegen tesztek fixture-jeit pontozná újra. |
| D5 | **A próza nullázódik** | A re-score a `summary`/`tagline`/`improve`/dim-`note` mezőket üresen hagyja. Ez nem mellékhatás, hanem a meglévő invariáns betartása (`MealCoachService` javadoc, `fuel.md:347`): *„a stale verdict cannot outlive its numbers"*. |
| D6 | **A történelmi próza elvesztését vállaljuk** | A `MealController` csak a MAI napra generál kötegelt coach-verdiktet, tehát a régi étkezések taglineja nem áll vissza magától — csak a score-sheet megnyitásakor (`GET /api/meal/{id}/coach`, ami bármely dátumra generál). A ma-kaput NEM oldjuk fel: az bármely régi nap megnyitásakor LLM-hívások kötegét indítaná — új, nem kért költség-felület. |
| D7 | **Minden felhasználó, nem csak a tulajdonos** | Egy adatjavító backfill nem user-scope-os. A `MealRepository`-nak ma nincs cross-user findere (minden metódus `…AndCreatedBy…`), ezért kap egy natív, verzióra szűrő lekérdezést. |
| D8 | **`weekly_score` purge kell, `day_review` purge nem** | Lásd „Kaszkád" lent. |

## Architektúra

```
Liquibase (boot, Spring előtt)
  └─ 202609031400_mezo-jcpt.2_weekly_score_cache_invalidation.sql   # delete from weekly_score;

CommandLineRunner @Order(210)  MealRescoreRunner  @Profile("demodata")
  └─ MealRepository.findStaleEnvelopes(FORMULA_VERSION)      # natív, verzióra szűr
       └─ MealService.rescore(MealEntity)                    # ÚJ publikus belépési pont
            └─ applyScore(createdBy, meal, loggedAt)         # a meglévő, változatlan write-path
                 └─ MealScoringService.scoreMeal(...)        # + formulaVersion bélyeg
```

### Komponensek

**`MealBreakdownJson.formulaVersion`** — a jsonb-n belül, **nincs új oszlop**. A
`BreakdownDtoMapper` mezőnként képez a contractra, és ezt a mezőt nem viszi ki, tehát
**nincs contract-változás**, nincs drift-gate érintés. Az envelope-rekord pozicionális
konstruktorát négy hívóhely használja (`MealScoringService` ×2, `MealCoachStore.writeProse`,
`RecipeBreakdownProseService`) — a fordító mindet kikényszeríti, ami itt előny.

**`MealScoringService.FORMULA_VERSION`** — `public static final int`, jelenleg `1`. Mind a
`scoreMeal`, mind a `recipeTemplateBreakdown` ezzel bélyegez (egy envelope-típus, egy szabály).
Recept-backfill **nincs**: a sablon-felület már jcpt.1 előtt is renormalizált volt
(`recipeTemplateBreakdown` mindig hívta a `Dim.renormalized`-et), és a
`RecipeBreakdownService.matches()` úgyis csak `value`-t és per-dim `id/score/weight`-et
hasonlít — a verziómezőre nem érzékeny.

**`MealService.rescore(MealEntity)`** — új publikus, `@Transactional` metódus. Az `applyScore`
ma `private` és a *kérés* `OffsetDateTime`-ját kapja; a soron csak `Instant` van. A lokális
falióra-időt a házi konvencióval vezetjük le:

```java
LocalTime.ofInstant(meal.getLoggedAt(), ZoneId.systemDefault())
```

pontosan úgy, ahogy a `MealCoachService:194` már teszi **ugyanezen az oszlopon**. A
`MealService.recipeLogs:130` `ZoneOffset.UTC`-je egy *másik* konvenció ugyanarra az oszlopra —
azt tudatosan nem másoljuk. `app_user.timezone`-t sem olvasunk: annak ma **nulla** backend-
fogyasztója van (csak az `/auth/me` payload), bevezetni itt csendes konvenció-elágazás lenne.

**`MealRescoreRunner`** — a `feature/meal` package **gyökerében** (nem `..service..`; ArchUnit),
a `GoalReevaluateRunner` szerkezetét másolva: `run(String...)` delegál egy no-arg `run()`-ra,
amit az IT közvetlenül hív. `@Order(210)` — a goal-újraértékelés (200) UTÁN, mert a
`DailyTargets` abból származik.

### Kaszkád (mit invalidálunk)

- **`weekly_score`: purge kell.** A frissesség-próba `created_at`-et olvas
  (`WeeklyScoreRepository:70-102`, a javadoc explicit is kimondja: *„The probe reads
  `created_at`, so an EDIT of an existing row … is not detected"*), egy re-score viszont
  `UPDATE` — a cache-elt hetek határozatlan ideig a backfill előtti számokat szolgálnák ki.
  Egyszeri changeset, a `202609031200_mezo-jcpt.4_weekly_score_cache_invalidation.sql`
  mintájára és annak indoklás-stílusában.
- **`day_review`: purge NEM kell.** A cache kulcsa az `inputsHash`, ami tartalmazza a
  dimenzió-score-okat ÉS a tényeket (`DayReviewService:328`) — a táp-dimenzió elmozdulása
  magától cache-misst okoz. Kitörölni fölösleges LLM-hívásokba kerülne újragenerálni azt,
  amit a hash úgyis eldob.
- `MetricSeriesService` élőben olvassa a `meal.score`-t — nincs teendő.

### Amit tudatosan vállalunk

A re-score **nem idempotens a múltra nézve**: az `applyScore` több bemenete nincs a soron
fagyasztva, ezért egy régi étkezés ma más számot kaphat, mint a logolásakor:

1. **`DailyTargets`** — az *aktuálisan aktív* cél *jelenlegi* `prescription` jsonb-jéből
   (`FuelDayService.dailyTargets`); a `GoalReevaluateRunner` azóta átírhatta.
2. **Nap-típus** — `hasScheduledTrainingOn` a *mai* heti gym-ütemtervet vetíti a múltbeli hétköznapra.
3. **`MealRole`** — a `WorkoutWindowQueryService` gym-ablakai a *jelenlegi* `gym_schedule_slot`
   sorokból jönnek; egy azóta szerkesztett ütemterv csendben átminősít PRE/POST/STANDARD közt.
4. **Live pantry `category`** — a növényi diverzitás dimenzió bemenete (a NOVA és a tápérték
   fagyasztott, ez nem); egy átkategorizált vagy törölt pantry-sor elmozdítja, akár degradálja is.
5. **Config** — a jcpt.1-ben bevezetett `macro-significance-ref-share: 0.25` és a mezo-8ms6
   `macro-protein-surplus-penalty: 0.0` a *makró-score-t magát* mozgatja, kis étkezéseknél láthatóan.

Ez nem mellékhatás: **ez a fix célja** (a review pont ezért választotta a re-score-t a
FE-kozmetika helyett). Egy ismert kellemetlenség viszont itt bújik meg: a `mezo-g8qm` szerint
a csupasz `Z`-instanttal logolt régi sorok időzítése **már ma is** félreolvasódik, és a
`systemDefault()`-os újrapontozás ezeknek a *szerepét* is átírhatja. A runner ezért soronként
`debug` szinten logolja a régi→új score-deltát, és egy `info` összegző sort ír.

Az envelope-ok Hungarian `detail` / `MacroDetail.targetP|C|F` / `ContextRow` szövegei szintén
újraíródnak — bármely fixture-szövegre asszertáló teszt elmozdul.

## Hatókörön kívül

- **`MacroDetail.notes` nyugdíjazása.** A deprecated mező marad: a backfill csak a *meal*
  envelope-okat írja újra, a régi *recipe* envelope-oknak továbbra is deszerializálódniuk kell.
- **A coach ma-kapujának feloldása** (D6) — ha kell, külön issue.
- **Ranged `windowsFor`** (`mezo-jcpt.6`) — a runner ugyanazt a per-nap lekérdezést használja,
  amit a write-path; a felsokszorozás javítása külön szelet.

## Tesztterv (TDD)

| Teszt | Mit bizonyít |
|---|---|
| `MealScoringServiceTest` — új eset | `scoreMeal` és `recipeTemplateBreakdown` `FORMULA_VERSION`-t bélyegez. |
| `MealRescoreRunnerIT` — heal | `MealPopulator` gyárt egy *elavult* envelope-ot (nem-renormalizált súlyok, `null` verzió, kitöltött próza); a runner után: bélyeg jelen, `Σ(w·score) == value`, próza `null`. |
| `MealRescoreRunnerIT` — nem nyúl az aktuálishoz | Egy már `FORMULA_VERSION`-ös envelope-ot a runner **nem** ír át (enélkül a teszt vak lenne egy „mindent újrapontozok" implementációra). |
| `MealRescoreRunnerIT` — idempotencia | A második futás nulla sort érint. |

Az IT `@ActiveProfiles("demodata")` és közvetlenül a runner no-arg `run()`-ját hívja — a
`GoalReevaluateRunnerIT` mintája.

**Lokális kapuk:** csak fókuszáltak (`./mvnw test -Dtest=MealScoringServiceTest`,
`-Dtest=MealRescoreRunnerIT`, `-Dtest=MealApiIT`); a teljes suite a CI dolga. A
`-Dmezo.test.use-testcontainers=true` tiltott (OOM).

## Docs & gate-ek

- `docs/features/fuel.md` §9: ma úgy fogalmaz, mintha a renormalizálás mindig is igaz lett
  volna — épp ez a bug. Kap egy bekezdést a tárolt pre-jcpt.1 envelope-okról és a backfillről,
  valamint a „lokális idő tárolt `Instant`-ból" konvencióról (`ZoneId.systemDefault()`), ami ma
  csak kódban él.
- `node scripts/gen-codemap.mjs` ugyanebben a szeletben (új backend osztály → ArchUnit +
  codemap CI-gate).
- Contract-drift: **nincs érintés** (a `formulaVersion` nem lép ki a wire-re).

## Prior art

A `researcher` külső recon (max 5 forrás) a következőket hozta:

- **MongoDB Document/Schema Versioning** — `schemaVersion` a dokumentumban, olvasáskor
  összevetve az aktuális konstanssal.
  <https://www.mongodb.com/docs/manual/data-modeling/design-patterns/data-versioning/>
  **Átvéve:** a verzióbélyeg (D2). **Elutasítva:** a minta másik fele, a write-back-on-read —
  az a történelem újraírását olvasási mellékhatássá tenné, időben nemdeterminisztikusan, és
  minden jövőbeli formulaváltásnál csendben újraindulna.
- **Event-sourced séma-evolúció (upcasting vs. in-place vs. copy-and-transform)** —
  Overeem et al. / <https://event-driven.io/en/simple_events_versioning_patterns/>
  **Elutasítva** az upcasting (olvasás-idejű transzformáció): itt a *kliensnek* kell tudnia
  ellenőrizni a `Σ(weight × score) == value` egyenlőséget a tárolt bájtokon, tehát írni kell.
  A tanulság átvéve: az írás legyen **egyszeri, dátumozott, verziózott restatement**, ne
  ad-hoc in-place mutáció.
- **CQRS projekció-újraépítés (truncate & replay)** —
  <https://event-driven.io/en/projections_and_read_models_in_event_driven_architecture/>
  **Átvéve** a `weekly_score` purge mentális modelljeként (a cache eldobható, mert
  újraszármaztatható). **Elutasítva** a blue-green változat: pár száz sornál és egy
  felhasználónál indokolatlan. Fontos megkötés innen: az **LLM-próza nem replayelhető**
  (nemdeterminisztikus generátor), tehát invalidálandó, nem újrajátszandó → D5.
- **GitLab batched background migrations** —
  <https://docs.gitlab.com/development/database/batched_background_migrations/>
  **Elutasítva** a batch-infrastruktúra: a saját dokumentációja mondja ki, hogy a kiváltó ok a
  migrációs időkorlát átlépése, és pár száz sor ezt meg sem közelíti. **Átvéve** az
  idempotencia-követelmény: a backfill „ahol `formulaVersion < N`" formában íródik, így az
  újrafuttatás szerkezetileg no-op.
- **Liquibase adat-changeset run-once szemantika** —
  <https://reflectoring.io/database-migration-spring-boot-liquibase/>
  **Részben átvéve:** a Liquibase kapja a cache-purge-t (egysoros SQL). A re-score maga NEM
  mehet changesetbe: a Liquibase indulásidőben fut, alkalmazás-beanek nélkül, tehát a
  renormalizálás + kcal-szignifikancia SQL-be duplikálását jelentené — pontosan az a mód,
  ahogy a két implementáció legközelebb széttart.

## Codebase terrain

Az `investigator` recon (CODEMAP-first) főbb megállapításai:

**Érintett CODEMAP-blokkok:** `meal` (write-path), `nutrition` (scorer + envelope + config),
`pantry` (live `category`), `train` (`WorkoutWindowQueryService`), `goal` (`DailyTargets` +
a runner precedens), `companion` (cache-fogyasztók), FE `fuel` (ledger).

**Kulcsfájlok:**

| fájl:sor | szerep |
|---|---|
| `MealService.java:177-192` | `applyScore` — `private`, `OffsetDateTime`-ot vár; itt kell az új belépési pont |
| `MealService.java:194-217` | `toScoredLine` — minden fagyasztott, **kivéve** a live pantry `category` (`:205`) |
| `MealScoringService.java:134-142` | `weightSum` + a jcpt.1-ben hozzáadott `d.renormalized(weightSum)` |
| `MealEntity.java:60-81` | `loggedAt` **`Instant`**; `breakdown` `@JdbcTypeCode(SqlTypes.JSON)` |
| `MealCoachService.java:194` | a követendő precedens: `LocalTime.ofInstant(…, ZoneId.systemDefault())` ugyanezen az oszlopon |
| `MealCoachStore.java:67-79` | `writeProse` — „a coach soha nem mozdít számot"; a tükörszabály: „a re-score soha nem tart meg prózát" |
| `GoalReevaluateRunner.java` | a másolandó runner-szerkezet (`@Profile("demodata")`, `@Order`, no-arg `run()` IT-belépő) |
| `1.0.0/script/202609031200_mezo-jcpt.4_…sql` | a cache-purge changeset mintája (indoklás a kommentben, egysoros SQL) |
| `MealPopulator.java:90-99` | `createScoredMeal` — itt gyártjuk az „elavult" fixture-t |

**Csapdák:**

1. `WeeklyScoreRepository.latestScoreInputWrittenAt` `created_at`-et próbáz → a purge nem opcionális.
2. `DayScoreService.mealDimScore:328-343` `weight().signum() > 0`-ra szűr → a re-score a
   történelmi napi számokat is mozgatja.
3. **ArchUnit:** `@Service` ⇒ `..service..`; nincs mezőinjekció; **nincs osztály-szintű
   `@Transactional`** (metóduson legyen); a `feature_slices_are_cycle_free` **`FreezingArchRule`** —
   új `meal → companion` import új ciklus lenne. A runner `train`/`nutrition`/`pantry` importjai
   rendben (a `MealService` már ezeket használja).
4. Fókuszált ITek nem futtatják az ArchUnit + codemap kaput → `gen-codemap.mjs` ugyanabba a szeletbe.
5. `@Profile("demodata")` a prod-ban aktív profil, de az IT-nek `@ActiveProfiles("demodata")` kell.
6. Multi-user (`mezo-qw37.1`) óta több user lehet; a `MealRepository`-nak nincs cross-user findere → D7.
7. Önhívás megkerüli a Spring-proxyt (`MealCoachStore` külön bean pont ezért) — a runner ne a
   saját `@Transactional` metódusát hívja belülről.

**Staleness-jelzés:** `fuel.md:349` úgy írja le a renormalizálást, mintha mindig igaz lett
volna; a `git log` szerint a `scoreMeal` csak a `d51ec268b`-ben kapta meg. Ez a spec „Docs"
szakasza javítja.
