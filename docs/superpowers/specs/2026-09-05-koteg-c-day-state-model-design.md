# Köteg C — a nap becsületes állapotmodellje, egy igazsággal

- **Dátum:** 2026-09-05
- **bd issue-k:** `mezo-el0t` (a `logging` minden zárt napon DONE → érintetlen nap „tanulom"),
  `mezo-jcpt.8` (a `DayInputs`-ból hiányzik a `weightKg` és az `xp`)
- **Szülő epic:** `mezo-jcpt` — napi értékelés újratervezés
- **Státusz:** jóváhagyás nélkül végrehajtva (éjszakai futam, user-felhatalmazással); minden
  önálló döntés a PR-ben és a bd kommentekben, reggeli átnézésre

## Miért egy szelet

A két issue **nem összevonható, hanem szétválaszthatatlan**. Az `mezo-el0t` javítása feltesz
egy kérdést — *„logolt-e a felhasználó ma bármit egyáltalán?"* —, és erre a motor ma nem tud
helyesen válaszolni, mert a bemenetéből hiányzik a testsúly és az XP. Az a hiány maga a
`mezo-jcpt.8`. Külön javítva egy csak-mérlegelés nap továbbra is „semmit nem logolt"-nak
minősülne, vagyis pontosan azt a hibát szülnénk újra, amit javítani indultunk.

## Prior art

**Belső precedens a mérvadó, és van belőle kettő.**

- A `rhythm` dimenzió kizárása az adat-elegendőségi kapuból (`DayEvaluationEngine:92-102`,
  `mezo-jcpt.4` whole-branch review). Ez a szelet ugyanazt az elvet folytatja: *egy dimenzió,
  ami nem ezt a napot méri, nem szavazhat arról, hogy ez a nap mérhető-e.*
- A `weekly_score` cache egyszeri purge-e, amikor egy oszlop **jelentése** változott
  (`202609031200_mezo-jcpt.4_weekly_score_cache_invalidation.sql`). A `checkin_avg` most
  ugyanebbe a helyzetbe kerül.

**Külső prior art szándékosan kimaradt**, és ez a szelet elfogadott korlátja: a kérdés nem
„hogyan csinálják mások", hanem „mit állít a saját szerződésünk, és miért nem azt csinálja a
kódunk". A válasz teljes egészében a repón belül van.

## Codebase terrain

**Érintett feature-ök:** `companion` (motor, napi/heti szolgáltatások, `me-week` szerződés),
`me` (frontend logika és felületek), peremen `biometrics` (testsúly) és `gamification`
(`MetricKey.DAILY_XP`).

| Terület | Fájl |
| --- | --- |
| Adat-elegendőségi kapu (a `rhythm`-kizárás helye) | `DayEvaluationEngine.java:92-109` |
| `loggingDim` — mindig DONE | `DayEvaluationEngine.java:361-381`, indoklás `:348-359` |
| `DayInputs` (19 mezős rekord) | `DayEvaluationEngine.java:47-57` |
| `DayInputs` építése (produkció, 2 hely) | `DayScoreService.java:231-244`, `:272-277`, belépő `:170-190` |
| Backend állapot-döntés | `DayReviewService.java:179-191`, `hasAnyLog` `:195-202` |
| Frontend levezetés #1 | `weekDay.ts:56-58`, `:71-75`, `:78-82`, copy `:85-105` |
| Frontend levezetés #2 | `dayScoreState.ts:20-29`, `:34-37`, `:48-52`, copy `:56-69` |
| Az egyetlen felület, ami a backend válaszát olvassa | `WeekDayPage.tsx:183` |
| Szerződés (már ma is nullable) | `api/feature/me-week/me-week.yml:106-115` |
| LLM-prompt payload | `MeWeekService.java:221-247` |
| Heti cache-aggregálás | `WeeklyScoreService.java:219-245` |

**Követendő minták:** a `DayEvaluationEngine` **tiszta szolgáltatás, repository nélkül**
(saját javadoc `:12-17`) — a bővített adat betöltése a `DayScoreService`-be tartozik, nem a
motorba; becsületes hiány (null, soha nem hamis 0); egy igazságforrás per döntés.

**Ismert csapdák:**

1. **A 2-DONE kapu története.** A `logging` (őszinte 0) + `rhythm` (a korábbi napokból DONE)
   páros egyszer már **önmagában kinyitotta** a kaput, és egy érintetlen nap ~41 pontot kapott
   más napok átlagából. A javítás a `rhythm` kizárása; élő pinjei
   `DayReviewServiceTest.java:365-370` és `DayScoreServiceIT.java:157-171`. **Bármely
   változtatásnak fenn kell tartania, hogy érintetlen napon a kapu elérhetetlen.**
2. **A „27 pinned teszt" félrevezető.** Valójában **7 konstrukciós hely** van: a
   `DayEvaluationEngineTest` mind a 30 tesztje **egyetlen** fluent builderen megy keresztül
   (`:155-160`), a `DayReviewServiceTest`-ben viszont **6 nyers pozicionális** `new DayInputs(`
   hívás van (`:170, :202, :365, :381, :440, :450`). A `DayInputs` bővítése tehát 1 rekord +
   2 builder-metódus + 6 nyers hívás, nem 27 teszttest.
3. **A két frontend-levezetés ma sem egyezik**: a `dayScoreState.isDayUnlogged` nézi a
   `proteinG`-t, a `weekDay.isEmptyDay` nem. Mindkét fájl fejléce azt állítja magáról, hogy ő
   „az egyetlen hely".
4. **A vizuális suite** csak a `/me/week` hubot fotózza; a mozaik és a nap-oldal nincs benne.
   A hub mini-gyűrűjének `is-nodata` osztálya és „N nincs adat" aria-címkéje viszont **benne
   van** a snapshotban, és a suite mock módban fut (a mock szombatja csupa-null), tehát a
   valós backend `logging: 0`-ját sosem látja.
5. Contract-drift kapu, CODEMAP-frissesség, ArchUnit rétegszabályok, `-Dmezo.test.use-testcontainers=true`,
   FE-tesztek mindkét módban explicit `VITE_USE_MOCK`-kal.

## Döntések

### D1 — a `logging` „nem mérhető"-t ad, ha a napon semmit nem logoltak

A három felvetett irány közül ez a (c). **Döntő érv:** a szerződés
(`me-week.yml:106-108`) **már ma is** azt állítja, hogy `null = nem mérhető ezen a napon —
soha nem 0`, miközben a motor pont 0-t küld. A (c) nem új szabályt vezet be, hanem a kódot
hozza összhangba a saját szerződésével — és épp ezért **nem igényel szerződés-módosítást**.

Elutasítva **(a)** („a logolás essen ki a próbából"): a motorban alkalmazva **gyengítené** a
kaput, amit a Köteg A/B review-ja épp megerősített; csak a frontenden alkalmazva **új**
backend↔frontend eltérést szülne. Elutasítva **(b)** (a „nincs adat" állapot megszüntetése):
nem javítaná a `mezo-jcpt.8`-at, hanem tárgytalanná tenné, és elveszne a valós különbség
a „nem logoltál" és a „keveset logoltál" mondat között — csak az egyik a felhasználó döntése.

### D1/a — válasz egy korábbi review-döntésre, ami ez ellen szól

A `loggingDim` kommentje (`DayEvaluationEngine.java:348-359`) egy **korábbi review során hozott
döntést** rögzít, szó szerint: *„egy kitalált NO_DATA szabadkártya itt csendben elejtené a
dimenzió súlyát, és nem büntetné azt a napot, amelyen egyáltalán nem volt logolási erőfeszítés
— épp az ellenkezője annak, amiért ez a folyamat-dimenzió létezik."*

Ez az érv **érvényes, és ez a szelet nem sérti meg** — de csak azért nem, mert a predikátum a
**teljes** loghalmaz felett kérdez, nem a logolás-dimenzió saját bemenetei felett:

- Egy nap, amelyen a felhasználó **edzett és aludt**, de nem logolt étkezést, vizet vagy
  check-int: a predikátum **igaz** (van edzés- és alvás-log), tehát a `logging` továbbra is
  mérhető, DONE marad, és őszinte 0-val **ugyanúgy lehúzza a napot**, mint ma. A büntetés
  megmarad — pontosan ott, ahol a korábbi review meg akarta tartani.
- A `logging` **kizárólag** akkor lesz „nem mérhető", ha a napon **semmilyen** log nincs. Egy
  ilyen napon viszont a kapu amúgy is zárva (nulla vagy egy intrinsic DONE), tehát **nincs
  pontszám, amit büntetni lehetne** — a súly elejtése ott nem enged el semmit.

Vagyis a korábbi döntés a „logolt valamit, de rosszul" esetre szólt, és ott érintetlen marad;
ez a szelet a „semmit nem logolt" esetet választja le róla. A meglévő kommentet ennek
megfelelően **bővíteni kell**, nem törölni — a benne rögzített érv továbbra is él.

**Amit a (c) NEM ront el:** a `logging` továbbra is *folyamat*-dimenzió, ahol a `false`/`0`
maga a mérés. Csak a **teljesen érintetlen** nap kap „nem mérhető"-t; egy nap, amin bármit
logoltak, ugyanúgy kaphat őszinte 0-t.

### D2 — egy hiteles „logolt-e bármit" predikátum, a teljes bemenet felett

A predikátum: **étkezés · víz · check-in · alvás · elvégzett edzés · testsúly · XP · kcal**
közül bármelyik jelen van. Ez egy helyen él, és onnantól

- a `loggingDim` ez alapján dönt mérhetőségről,
- a `DayReviewService.state()` ezt hívja a saját részleges másolata helyett,
- a frontend ugyanezt a fogalmat tükrözi (lásd D4).

A `weightKg` és az `xp` felvétele a `DayInputs`-ba **ennek a predikátumnak a feltétele**, nem
külön feladat — ez a `mezo-jcpt.8`.

### D3 — vállalt következmény: az LLM-prompt payload megváltozik

Egy érintetlen napra a `renderDayLine` ma `checkin 0`-t ír, ezután `checkin –`-t. A Köteg B-ben
épp azt védtük, hogy ez a szöveg bájtazonos maradjon — most **szándékosan** változik, mert a
„–" az igazat mondja, a „0" pedig nem létező mérést állít. A pinelő teszt tudatosan igazítandó,
és a PR-nek külön ki kell emelnie.

### D4 — vállalt következmény: a `checkin_avg` cache-oszlop jelentése változik

A `WeeklyScoreService.aggregate` a nem-null `logging` értékeket átlagolja; ma az érintetlen nap
0-ája lehúzza az átlagot, ezután kiesik belőle. A már cache-elt hetek tehát máshogy számoltak,
mint a frissek → **egyszeri purge-changeset** kell a `weekly_score` sorokra, pontosan a
`mezo-jcpt.4` precedense szerint. **Ez az egyetlen szelet, ami migrációval jár.**

### D5 — a három párhuzamos állapot-levezetés eggyé olvad

A `weekDay.ts` és a `dayScoreState.ts` ma egymástól függetlenül vezeti le ugyanazt, és már ma
sem egyeznek. A szelet **egy** frontend-modulba vonja őket, a backend állapotnevei szerint, és a
`WeekDayPage` marad az egyetlen hely, ami a szerver válaszát olvassa (a levezetés csak
degradált tartalék). Enélkül a javítás után is két helyen kellene ugyanazt karbantartani.

## Architektúra és adatfolyam

```
DayScoreService  ──(betölti: étkezés, víz, check-in, alvás, edzés, SÚLY, XP, kcal)──►
        DayInputs {+ weightKg, + xp}
                │
                ├─► DayEvaluationEngine.anyLogPresent(in)   ◄── EGY predikátum
                │        │
                │        ├─► loggingDim: mérhető? → DONE(score) : NO_DATA(null)
                │        └─► DayReviewService.state(): empty | thin | scored
                │
                └─► kapu: doneCount(rhythm nélkül) >= 2   ── érintetlen napon strukturálisan 0
                          │
                          ▼
              MeWeekSubscores.logging = null   (a szerződés eddig is ezt ígérte)
                          │
                          ▼
        frontend: EGY állapot-levezetés (a subscoreCount === 0 ág újra elérhető)
```

## Hibakezelés és hiány-állapotok

- **Érintetlen nap:** `logging = null`, nulla intrinsic DONE, kapu zárva → `empty`, a felület
  „nincs adat"-ot mond, és a csempén **egyetlen** tömör pálcika sem lesz (a `rhythm` egyedül
  marad, de az önmagában nem nyitja a kaput). Ezzel megszűnik a mai ellentmondás, hogy két
  pálcika látszik a „kevesebb mint két területről van adat" lábjegyzet alatt.
- **Csak-mérlegelés nap:** a predikátum igaz → `logging` mérhető (őszinte 0) → `thin`
  („tanulom"), nem `empty`. Ez a `mezo-jcpt.8` javítása.
- **Részben logolt nap:** változatlan viselkedés.
- **Régi cache-elt hetek:** a purge-changeset után újraszámolódnak.

## Tesztelés

**Backend** (fókuszált, `-Dmezo.test.use-testcontainers=true`):

- `DayEvaluationEngineTest` — a `loggingDim` NO_DATA-t ad érintetlen napon, és DONE-t ad
  csak-víz / csak-check-in / csak-mérlegelés / csak-XP napon.
- **Regressziós pin, amit fenn kell tartani:** érintetlen nap + `priorBaseScores` jelenléte
  mellett a kapu **zárva marad** (a `rhythm` egyedül nem nyitja) — a Köteg A/B tanulsága.
- `DayReviewServiceTest` — a csak-mérlegelés és a csak-XP nap `thin`, nem `empty`; az
  érintetlen nap `empty` marad.
- `MeWeekServiceRenderDayLineTest` — **tudatosan** `checkin –`-re igazítva, a D3 szerint.
- `WeeklyScoreServiceTest` — az érintetlen nap kiesik a `checkinAvg`-ból.
- `ArchitectureTest` külön; a motor **nem** kaphat repository-t.

**Frontend** (mindkét mód explicit `VITE_USE_MOCK`-kal): az egyesített állapot-modul
tesztjei; hogy a `subscoreCount === 0` ág újra elérhető; hogy a hub, a mozaik és a nap-oldal
ugyanarra a napra ugyanazt az állapotot mondja.

**Migráció:** `lint-liquibase.mjs` zöld, és a purge-changeset **jelenléte** itt a bizonyíték —
ellentétben a Köteg B-vel, ahol a hiánya volt az.

## Dokumentáció

`docs/features/companion.md` (a `logging` mérhetőségi szabálya, a kapu, a cache-oszlop
jelentésváltása), `docs/features/me.md` (§2 — a „nincs adat" állapot **újra elérhető**
produkcióban; a mai, ezt tagadó bekezdés cseréje), `docs/CODEMAP.md` regen.

## Nyitott kérdések

Nincs. A három irány közötti választást a szerződés saját szövege döntötte el.
