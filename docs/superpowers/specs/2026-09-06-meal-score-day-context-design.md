# Étel-score nap-tudatos `context` dimenzió + coach-prompt cél-forrás javítás

- **bd**: `mezo-jcpt.19` (szülő: `mezo-jcpt` — napi értékelés újratervezés)
- **Dátum**: 2026-09-06
- **Státusz**: jóváhagyott design

## 1. A probléma

Logoláskor az étel determinisztikus score-t kap
([`MealScoringService.scoreMeal`](../../../backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringService.java)).
A `context` dimenzió (súly `.12`) az étel kcal-ját a **statikus slot-arányhoz** méri:

```
rel      = étel_kcal / (napi_cél × statikus_slot_arány)      // slot-arányok: reggeli .25 / ebéd .35 / vacsora .30 / snack .10
shareDev = max(0, |rel − 1| − 0.4)
shareSub = max(0, 1 − shareDev)
```

A képlet **fogalmilag nem tudja, mit evett a felhasználó aznap**. Következmény: aki egész
nap nem evett, és 1500 kcal-os célon (cut) 20:00-kor belogol egy 1500 kcal-os vacsorát:

```
rel = 1500 / (1500 × 0.30) = 3.33  →  shareDev = 1.93  →  shareSub = 0
```

A dimenzió kcal-komponense nullázódik, holott a nap pontosan a célon van.

### A hiba pontos határai

A recon két gyakori feltevést cáfolt, és ezek szűkítik a scope-ot:

- **Az `energy-density` dimenzió nem hibás.** `kcal/100g`-ot mér, ami adagfüggetlen,
  intrinsic étel-tulajdonság — egy nagy étel nem kap érte büntetést attól, hogy nagy.
- **A `portion` dimenzió az ételeknél nincs pontozva.** A súly-konfig invariánsa:
  *meal uses all except portion, template all except context*
  ([`application.yml`](../../../backend/src/main/resources/application.yml) `mezo.fuel.scoring.weights`).

A tényleges hiba tehát **egyetlen dimenzió kcal- és fehérje-komponense**, `.12` súllyal —
a példában ~4 pont a 100-ból. Valós, de kicsi; a beavatkozás méretét ehhez szabjuk.

### Másodlagos hiba: a coach-prompt más napot lát, mint a szám

[`MealCoachService`](../../../backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealCoachService.java)
a statikus `NutritionTargetsProperties`-t adja a promptnak, míg a *szám* a goal-tudatos
`DailyTargets`-hez mér. Egy cut alatt a próza `NAPI CÉLOK: 3100 kcal` és egy ebből számolt
`marad: …` sort idézhet, miközben a pontszám ~1500-hoz mért. A `docs/features/fuel.md` §5
állítása ("a score és a hero soha nem ítélhet eltérő számok ellen") a próza-felületre **nem
igaz**.

## 2. Célok és nem-célok

**Cél**

1. A `context` dimenzió a logolás pillanatában ismert napi állapothoz mérjen, ne statikus
   arányhoz.
2. A coach-próza ugyanazokat a napi célszámokat lássa, mint a score.

**Nem cél (ebben a körben)**

- Külön, intrinsic "csak az étel" score a részletek oldalon. Ez a jóváhagyott 3. darab,
  külön bd issue-ban követi ezt — szemantikai tisztaság, nem hibajavítás. A meglévő motor
  `context` nélküli futása (a template-pontozás) már ma ez, tehát olcsó lesz.
- A "maradék keret" nyers számának megjelenítése a kártyán. Ez láthatóvá tenné a backend
  `DailyTargets` és a frontend `deriveDailyBudget` (BMR×NEAT + MET) eltérését; a 3. darab
  kérdése.
- Napi cél-illeszkedés-ítélet bevitele az étel-score-ba. Az a `DayEvaluationEngine`
  `nutritionDim`-jének dolga (súly `.30`, sávokkal).

## 3. A döntés és az alternatívák

A brainstorm négy irányt mért súlyozottan (helyesség 5 · érthetőség 4 · stabilitás 3 ·
újrafelhasználhatóság 3 · viselkedési kockázat 3 · költség 3; max 105):

| Irány | Pont |
|---|---|
| **B — kettéosztás: intrinsic étel-score + külön napi illeszkedés** | **90** |
| C — a szám marad, csak a próza kap napi kontextust | 80 |
| D — a napi kontextus csak elnyomja az indokolatlan levonásokat | 61 |
| A — egy szám, amibe a napi kontextus beleépül | 54 |

**A** azért bukik, mert a szám két dolgot jelentene, és **retroaktívan mozogna** (a reggel
logolt étel este mást mutatna) — ettől a score nem használható újra a recept oldalon, a
keresőben, az előzményekben.

Választott irány: **B**, de a súlypontja a recon után eltolódott. Nem új score-rendszert
építünk: a `context` dimenzió *maga* a "napi illeszkedés" fele, csak rossz bemenettel
dolgozik. Ezt javítjuk (S1 + S2); az intrinsic fél már létezik a template-futásban, azt a
3. darab emeli be a UI-ba.

### A retroaktivitás kérdése — a házi szemantika dönt

A score írásidőben fagy (`meal.score` denormalizált oszlop, ADR 0006). Három lehetőség
volt, mindegyik ára ismert:

| Opció | Ár |
|---|---|
| újraszámolás olvasáskor | elrontja a denormalizált oszlopot, a `FuelWeekResponse.mealScoreAvg`-ot és a `weekly_score` cache-t |
| a nap minden ételének újrapontozása minden íráskor | írás-amplifikáció + **kinullázza az aznapi összes coach-prózát** minden logoláskor |
| **"a logolás pillanatában" szemantika** | nem tud "a nap a célon zárt" állítást tenni |

A coach-réteg ezt már eldöntötte és leírta
([`MealCoachPrompt`](../../../backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealCoachPrompt.java)
osztály-javadoc): minden étkezés-blokk az **aznapi állapotot ANNAK az étkezésnek a
logolási idejéhez képest** hordozza, soha nem a "most"-hoz — *"ettől cache-elhető a
verdikt"*. Ugyanezt a szemantikát vesszük át: a score is csak az étel **előtti** napi
állapotot látja. Így nincs retroaktivitás, és a próza meg a szám ugyanazt a napot nézi.

## 4. S1 — A `context` dimenzió nap-tudatossá tétele

### 4.1 A képlet

```
maradék_keret   = max(0, napi_cél_kcal − a nap kcal-ja EZ ELŐTT az étel előtt)
hátralévő slotok = ennek az ételnek a slotja
                   ∪ minden slot, aminek az ablaka a logolás pillanatában még nem járt le
                   (a snacknek nincs ablaka → mindig hátravan)
nevező          = Σ a hátralévő slotok konfigurált arányai
elvárt_kcal     = max(maradék_keret × (slot_arány / nevező),  padló)
```

Ugyanez a fehérjére, **ugyanazzal a padlóval** (§4.2) — enélkül egy már teljesített napi
fehérjecél `elvárt_p = 0`-t adna, és a `protein / elvárt_p` nullosztásba futna:

```
elvárt_p = max(max(0, napi_cél_p − p_eddig) × (slot_arány / nevező),
               napi_cél_p × slot_arány × min-expected-slot-share-factor)
```

Minden más változatlan: a `0.4`-es tolerancia, a `shareDev`/`shareSub` logika, a
`timingSub`, a `proteinSub` `min(1, …)` plafonja, a dimenzió súlya, id-ja és a `Szerep`
sor.

**A nevező tiszta függvénye a logolási időnek és a konfignak** — nem kell tudni, mely
slotok voltak már logolva. (Végignézve: minden olyan eset, ahol a "már logolt" halmaz
számítana, az ablak-lejárati szabállyal is helyesen jön ki, mert a saját slot mindig
benne van.) Ez tartja két számon az új bemeneti felületet.

### 4.2 A padló (`maradék_keret ≤ 0`)

Ha a keret már az étel előtt elfogyott, az elvárt kcal 0 lenne, és nincs mihez osztani.
Választott megoldás: **puha padló**

```
padló = napi_cél_kcal × slot_arány × mezo.fuel.scoring.min-expected-slot-share-factor   // 0.25
```

Így a túllépés arányosan, nem szakadékkal büntet. Indok: a napi keret túllépését a napi
score `nutritionDim`-je már sávokkal bünteti; nem akarunk **kétszer, szakadékkal**
büntetni ugyanazért. Az elvetett alternatívák: őszinte 0 (igaz, de 100 kcal túllépés után
minden további falat 0-t kapna), és degradálás súly 0-ra (a ház szabálya szerint az
*adathiányra* való, nem arra, hogy a hír rossz).

Ugyanez a padló véd a `nevező = 0` ellen is (elvben nem előfordulható, mert a saját slot
mindig benne van — de a padló így is a képlet egyetlen osztás-védelme).

### 4.3 A kulcs-invariáns: nulla regresszió a névleges pályán

Ha a felhasználó az addig eltelt slotokban pont a névleges arányt ette, akkor

```
maradék = cél × (1 − Σ eltelt arányok) = cél × nevező
elvárt  = cél × nevező × slot_arány / nevező = cél × slot_arány
```

— **bitre a mai érték**. Az új képlet a régi *szigorú általánosítása*: csak akkor tér el,
amikor a mai téved. Ezt property-teszt őrzi (§7).

### 4.4 Viselkedés

| Eset (cél 1500 kcal) | Ma | Ezután |
|---|---|---|
| Reggeli 08:00, 375 kcal (névleges) | elvárt 375 → 100% | elvárt 375 → 100% |
| Ebéd 13:00, 525 kcal, reggeli 375 volt | elvárt 525 → 100% | elvárt 525 → 100% |
| **Vacsora 20:00, 1500 kcal, egész nap semmi** | elvárt 450 → **0%** | elvárt 1125 → **100%** |
| Vacsora 19:00, kihagyott reggeli, ebéd 525 | elvárt 450 | elvárt 731 |
| Snack 22:30, 1500 kcal, egész nap semmi (OMAD) | elvárt 150 → 0% | elvárt 1500 → 100% |
| **Reggeli 08:00, 1500 kcal** | elvárt 375 → 0% | elvárt 375 → **0%** (helyesen marad) |
| Snack 22:30, 200 kcal, egész nap semmi | elvárt 150 → ~100% | elvárt 1500 → ~53% (alulevés, őszinte) |
| Vacsora, a keret már 100 kcal-lal túllépve | elvárt 450 | padló 112 (arányos, nem 0) |

### 4.5 Beépítés

**Új carrier** (nutrition-tulajdonú, a `DailyTargets` mintájára):

```java
package io.mrkuhne.mezo.feature.nutrition.service;
public record DayContext(BigDecimal kcalBefore, BigDecimal pBefore) {}
```

Csak kcal + fehérje: a `context` dimenzió mást nem használ (YAGNI). Ugyanaz a fogalom,
amit a `MealCoachPrompt.MealBlock` már hordoz `kcalBefore`/`pBefore` néven.

**A scorer pure marad, a caller old fel** — a ház mintája:

- `MealScoringService.scoreMeal(...)` új overload 5→6 argumentummal (`DayContext`
  hozzáadva). A meglévő 5-argumentumos overload delegál egy "üres nap"
  `DayContext`-tel, tehát a template-/recept-út és minden más hívó változatlan.
- Új `FuelDayService.dayContext(userId, date, loggedAt, excludeMealId)`: az aznapi meal-ek
  közül a `loggedAt`-nál korábbiak Σ kcal/P-je, **a saját sort id alapján kizárva** (az
  `applyScore` update-kor is fut, amikor az étel már a napban van).
- Egyetlen új hívás [`MealService.applyScore`](../../../backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealService.java)-ban, a
  `dailyTargets(...)` hívás mellett. Egy plusz lekérdezés meal-írásonként.

**Nincs új dimenzió és nincs új súly** → a `MealScoringProperties.Weights` két
startup-fatális `@AssertTrue` súlyösszege érintetlen, a `MealScoreDimension.id` regex-pinned
enumja változatlan, tehát **nincs contract-drift**. A `min-expected-slot-share-factor` új
konfig-mező a `MealScoringProperties`-ben — ez viszont **töri a `MealScoringServiceTest`
pozicionális konstruktor-hívását**, azt frissíteni kell (§7).

**Provenance**: a `tools(...)` sor kapjon a napi kontextusra utaló bejegyzést
(`dayContext(kcalBefore=…, remaining=…)`), és a `Slot-arány` sor szövege nevezze meg, hogy
maradék kerethez mér.

**A `Szerep` sor nem mozdulhat**: a frontend a role-t a `context` dimenzió `Szerep`
sorának értékéből olvassa vissza (`frontend/src/features/fuel/logic/mealContext.ts`),
mert az enum nincs a wire-on. Sor törlése/átnevezése **típushiba nélkül** töri a kártya
chipjét.

**Verziózás**: `FORMULA_VERSION` 2→3, plusz egy `@Profile("demodata")` egyszeri
`CommandLineRunner` a régi borítékok idempotens újrapontozására a valódi írásúton
(`MealRescoreRunner` mintájára, `MealRepository.findStaleEnvelopes` munkalistával). A
`weekly_score` cache `created_at`-et néz frissességre, ezért **nem veszi észre az
UPDATE-et** — Liquibase changeset purge-öli, ahogy a `mezo-jcpt.2` is tette.

## 5. S2 — A coach-prompt cél-forrása

`MealCoachPrompt.userMessage(...)` és `appendMeal(...)` a `NutritionTargetsProperties`
helyett `DailyTargets`-et vegyen; `MealCoachService` a `NutritionTargetsProperties` mező
helyett `FuelDayService.dailyTargets(userId, date)`-et hívjon. Azonos slice
(`feature/meal`), nincs ArchUnit-ciklus és nincs Spring bean-ciklus (a `FuelDayService`
nem függ a coach-tól).

Ezzel a `NAPI CÉLOK` és a belőle számolt `marad: …` sor ugyanazt a napot idézi, amihez a
szám mért.

**Ezért tartozik egy PR-be az S1-gyel**: az S1 verzióbumpja újraírja a borítékokat, ami a
ház invariánsa szerint kinullázza a próza-fészkeket → a verdiktek újragenerálódnak, immár
a javított prompttal. Külön szállítva a cache magától nem gyógyulna.

## 6. Melléktermék — elavulás-javítás abban, amit érintünk

- `MealScoringService` szekció-kommentjei `// --- NOVA (.25)` és `// --- Context (.20)`
  szerepelnek a valós `.18` / `.12` súlyok helyett.
- `docs/features/fuel.md` §5 sor-horgonyai elcsúsztak (`applyScore`, `classifyRole`,
  a role-overlay és a `contextDim` `Szerep` sora). A leírt viselkedés helyes, csak a
  horgonyok rosszak.
- `fuel.md` §5 állítása a "soha nem eltérő számok"-ról a próza-felületre ma hamis — az S2
  teszi igazzá, a mondat pontosítandó.

Egy-egy soros javítások, nem külön munka.

## 7. Tesztelés

**Pure unit (`MealScoringServiceTest`, Spring nélkül)**

- §4.4 minden sora külön eset.
- **Property-teszt a §4.3 invariánsra**: névleges pályán az új képlet értéke azonos a
  statikus slot-arányossal. Ez a fő regressziós őr.
- Padló-esetek: `maradék ≤ 0`, épp 0, negatív.
- Ablak-lejárati határok: 22:00 vs 22:30 vacsora; snack minden órában.
- A `MealScoringProperties` pozicionális konstruktor-hívása (`:26-50`) frissítendő az új
  mezővel — ez a fájl törik **először**, még bármi más előtt.

**Írásút-IT** (`MealServiceIT` / `MealOverridesScoringIT` / `MealRescoreRunnerIT`)

- `dayContext` felöltése create / update / `rescore` útvonalon, önkizárással.
- Update esetén az étel a saját napjában van → nem számíthatja bele magát.

**Coach** (`MealCoachPromptTest`, `MealCoachServiceTest`)

- A `NAPI CÉLOK` és a `marad:` sor a goal-prescription számait idézi, nem a configot.

**Gate-ek**: `docs/CODEMAP.md` regenerálása (`node scripts/gen-codemap.mjs --check` fut a
cheap-gates-ben, és új osztály — `DayContext` — kerül be). Az ArchUnit a `*Test` körrel
megy, nem a fókuszált IT-kkel. A teljes backend suite a CI dolga
(`-Dmezo.test.use-testcontainers=true`); lokálisan csak fókuszált teszt.

## 8. Kockázatok

| Kockázat | Kezelés |
|---|---|
| Rejtett regresszió a normál napokon | §4.3 property-teszt: névleges pályán bitre azonos |
| A `Szerep` sor mozdulása némán töri a FE role-chipet | A sor érintetlen; a `mealContext.ts` string-match tesztje fut |
| Régi borítékok elavult képlettel | `FORMULA_VERSION` bump + rescore runner + `weekly_score` purge |
| Dupla büntetés a napi score-ral | A napi score csak a `nova`/`micro` dim-pontokat fogyasztja, a `context`-et nem — **nincs visszacsatolási hurok** (ellenőrizve). A padló (§4.2) kezeli a szakadék-jelleget |
| Két versengő napi keret (BE `DailyTargets` vs FE `deriveDailyBudget`) | Ebben a körben a maradék keret **nem** válik látható számmá — a 3. darab kérdése |
| Extra lekérdezés meal-írásonként | Egy indexelt nap-lekérdezés; az `applyScore` amúgy is több hívást tesz |

## 9. Prior art

A recon (max 5 forrás) eredménye — mit vettünk át és mit vetettünk el.

- **[Nutri-Score / FSA-Ofcom](https://nutriscore.blog/2025/10/31/the-nutri-score-nutrition-label-justifications-scientific-basis-user-guide-benefits-limitations-deployment-and-update/)**
  ([kritika](https://pubmed.ncbi.nlm.nih.gov/42588045/)) — szándékosan kontextusmentes,
  100 g-ra normalizált. **Átvéve** mint a stabil, intrinsic fél mintája (nálunk ez a
  template-futás). **Elvetve** mint egyedüli jelzés: strukturálisan képtelen megválaszolni,
  hogy belefér-e a napba; dokumentált gyengesége a porció-vakság.
- **[HEI-2020 aggregációs elemzés](https://www.medrxiv.org/content/10.64898/2026.06.08.26355152v1.full)**
  — a komponensek 1000 kcal-ra normalizálva, és a pontozás hivatalosan *több napra
  aggregálva* megy. **Átvéve** a figyelmeztetés: kisebb egységre levitt pontozás
  rendszerszinten lenyomja az "elérendő" komponenseket. **Elvetve** az étkezés-szintű
  adekvátsági plafonok — ezért nem viszünk be új rost/változatosság-jellegű komponenst.
- **[WeightWatchers Points](https://www.weightwatchers.com/us/blog/weight-loss-diet/what-are-points)**
  + [rollover](https://www.weightwatchers.com/nz/blog/weight-loss/how-rollovers-work-ww-program)
  — az étel értéke soha nem változik, **minden napi kontextus a keretben él**. **Ez a
  design szervező elve**: nem az ételt értékeljük át, a keret rugalmasságát modellezzük
  (nálunk: maradék keret + hátralévő slotok). A heti pool/rollover **elvetve** — nincs rá
  igény, és a napi keret már goal-vezérelt.
- **[ZOE Diet Score](https://resolve.cambridge.org/core/journals/proceedings-of-the-nutrition-society/article/development-of-the-zoe-diet-score-and-associations-with-dietary-diversity/98F451A7DDA4861AF6969D03CA189EA7)**
  ([termék](https://zoe.com/learn/zoe-2-0-science-made-simple)) — étkezésenkénti fix score
  → napi score annak *átlaga* + napszintű komponensek. **Átvéve** a kétszintűség (nálunk
  már megvan: meal-score → `DayEvaluationEngine`). **Átvéve** a dietetikusi kritika is: az
  étkezésenkénti pontozás perfekcionizmust hajt olvasható "miért" nélkül — ezért kap a
  `context` dimenzió őszinte provenance-sort és megnevezett viszonyítási alapot.
- **[ISSN nutrient timing állásfoglalás](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5596471/)**
  — az étkezésszám és -időzítés hatása a testösszetételre másodlagos a napi összbevitelhez
  képest. **Ez az érv arra, hogy az energiát és az adagméretet napi szinten ítéljük meg**
  (ezért nem büntetjük az OMAD/IF nagy étkezését). **Nem** szabad kártya mindenre: a
  fehérje-eloszlás az egyetlen komponens, aminek van védhető étkezés-szintű állítása —
  ezért marad a `proteinSub` a dimenzióban.

## 10. Codebase terrain

**Érintett feature-blokkok**: `nutrition` (a pontozó motor + konfig + boríték), `meal`
(írásút, nap-olvasás, coach-próza), közvetve `goal` (a napi célok forrása), `fuel` (FE),
`companion` (a napi score, ütközési felület).

**Kulcsfájlok**

| Fájl | Miért |
|---|---|
| `backend/…/nutrition/service/MealScoringService.java` | `scoreMeal` (a score teljes bemeneti felülete), `contextDim`, `timingSub`/`windowOf`, `tools(...)`, `FORMULA_VERSION` |
| `backend/…/nutrition/service/DailyTargets.java` | a mintakövetendő carrier; a `DayContext` ennek a testvére |
| `backend/…/nutrition/config/MealScoringProperties.java` | a konfig-record; `Weights` két startup-fatális `@AssertTrue` összege |
| `backend/src/main/resources/application.yml` (`mezo.fuel.scoring.*`) | súlyok, slot-arányok, slot-ablakok, `slot-share-tolerance`, az új padló-faktor |
| `backend/…/meal/service/MealService.java` (`applyScore`) | az EGYETLEN összeszerelési pont; create + update + `rescore` mind ide fut |
| `backend/…/meal/service/FuelDayService.java` | `dailyTargets(...)`; a nap Σ-ja már itt van (`consumed`, privát); ide kerül a `dayContext(...)` |
| `backend/…/meal/service/MealCoachPrompt.java` / `MealCoachService.java` | S2 cél-forrás; a "logolás pillanata" szemantika forrása |
| `backend/…/companion/service/DayEvaluationEngine.java` | a létező napi cél-illeszkedés-pontozó — a dupla könyvelés határa |
| `frontend/src/features/fuel/logic/mealContext.ts` | a role-t a `Szerep` sorból olvassa vissza — némán törhető |

**Követendő minták**

- **A scorer pure, a caller old fel.** `MealScoringService` csak feloldott carriereket kap
  (`ScoredLine`, `WorkoutWindow`, `DailyTargets`) és soha nem nyúl repositoryhoz.
- **Fogyasztó-tulajdonú portok a feature-határokon (ADR 0012).** `feature/nutrition` nem
  importálhat `feature/meal`-t — a `DayContext` **nutrition-tulajdonú**. Egy
  `nutrition → meal` import ÚJ ciklus lenne, és a `feature_slices_are_cycle_free`
  FreezingArchRule megbukna.
- **Overload-láncolás a visszafelé kompatibilitásért** — minden új argumentum új
  overloadként érkezett (`scoreMeal` 3→4→5, most →6).
- **Íráskor fagy, verzióbumppal mozdul** — `FORMULA_VERSION` + idempotens rescore-runner a
  valódi írásúton, soha nem SQL, ami duplikálja a képletet.
- **Config over constants** — az ArchUnit tiltja a Spring `@Value`-t; minden knob
  `@Validated` `*Properties` record.
- **A próza sosem talál ki számot** — a determinisztikus motor mindig üresen hagyja a
  `summary`/`tagline`/`improve`/`note` mezőket.

**Ismert csapdák**

- `MealScoringServiceTest` **pozicionálisan** építi a `MealScoringProperties`-t → az új
  konfig-mező ezt töri először.
- A `weekly_score` cache `created_at`-et néz, ezért **nem veszi észre az UPDATE-et** —
  rescore után Liquibase changeset purge-öli.
- `classifyRole` `loggedAt.toLocalTime()`-ot használ; a `rescore` `ZoneId.systemDefault()`-tal
  származtat — szerver-zónához kötött (`mezo-g8qm`). A hátralévő-slot nevező **ugyanezt a
  helyi órát** használja, tehát ugyanezt a korlátot örökli.
- Contract-drift gate: a `MealScoreDimension.id` regex-pinned enum. Ez a change **nem**
  nyúl hozzá.
- CODEMAP-frissesség gate: új osztály → `docs/CODEMAP.md` regenerálása ugyanabban a
  change-ben.
- `VITE_USE_MOCK` beállítatlan = mock mód; a valós FE-gate e nélkül vacuous.
- A flagKey "öt tükrözött változás" szabálya **nem** érintett — nem adunk új `FlagKey`-t.

**Kapcsolódó munka**: `mezo-1f7b` (PR #512, meal-score honesty 1. kör — per-tény lefedettség,
`FORMULA_VERSION` 1→2), `mezo-jcpt.1` (súly-renormalizálás + kcal-szignifikancia),
`mezo-jcpt.2` (verzióbélyeg + rescore backfill), `mezo-3g5w` (goal-tudatos `DailyTargets`),
`mezo-8ms6` (fehérje-többlet elnézve). Nap-kontextusos étel-pontozásról **nyitott issue nem
volt** — ez új terep.
