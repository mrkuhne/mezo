# Köteg B — heti nap-csempe 6 sub-jele + meal időzítés-sáv

- **Dátum:** 2026-09-04
- **bd issue-k:** `mezo-jcpt.5` (WeekDayTile 4→6 sub-jel), `mezo-jcpt.3` (meal-breakdown `.tline` időzítés-sáv)
- **Szülő epic:** `mezo-jcpt` — napi értékelés újratervezés (C-hibrid score + Mozaik 2.0 UI)
- **Státusz:** jóváhagyva (2026-09-04)
- **Jóváhagyott UI-prototípus:** <https://claude.ai/code/artifact/c9aada04-9149-429e-ad16-b0a0fc8d3be2>

## Miért egy szelet

A két issue egyetlen PR-ban megy, ami **kifejezett felülbírálása** az `AGENTS.md`/`CLAUDE.md`
„1 bd issue + 1 branch" házirendjének, user-jóváhagyással (a döntés indoklása a `mezo-jcpt`
epic 2026-09-04-i kommentjében, a Köteg A precedense:
[`2026-09-04-jcpt-koteg-a-chore-design.md`](2026-09-04-jcpt-koteg-a-chore-design.md)).

Az indok: mindkettő **ugyanannak a jóváhagyott Mozaik 2.0 prototípusnak** a le nem szállított
maradéka, mindkettő FE-vizuális szelet egy vékony, additív contract-mezővel a háta mögött, és
mindkettőt ugyanaz a kapu-készlet zárja (contract-drift ×2, CODEMAP-regen, FE két mód,
Playwright-goldenek). Külön PR-ban a két szelet ugyanazokon a kapukon menne át kétszer, érdemi
bisect-haszon nélkül.

A maradék négy gyerek-issue (`.9`, `.6`, `.8`, `.10`) **külön PR/branch marad** — új
`FeedbackArtifactKind` a contracton, kereszt-feature perf-fix, 27 pinned engine-tesztbe gyűrűző
`DayInputs`-bővítés, illetve architekturális `useDualQuery`-konzisztencia; egyik sem tartozik
ehhez a vizuális szelethez.

## Prior art

A webes recon három szálon futott; mindhárom eredménye beépült.

**Elfogadva:**

- **Few bullet-graph nyelvtan** (<https://www.perceptualedge.com/articles/misc/Bullet_Graph_Design_Spec.pdf>)
  — a `.tline` teljes grammatikája innen jön: lineáris tengely, a minőségi zóna (étkezési ablak)
  **kitöltött háttérsávként**, nem körvonalként, és a tényleges érték **egy** jelölőként. Pontosan
  a „tartomány + tényérték, legend nélkül, kis helyen" feladatra tervezték.
- **Tufte small-multiples** (<https://guypursey.com/blog/202001041530-tufte-principles-visual-display-quantitative-information>)
  — ezért lett a `.tline` tengelye a **teljes nap (0–24 h) minden étkezésnél azonos skálán**, nem
  étkezésenként zoomolt: egy nap étkezései így egymás mellett is összehasonlíthatók.
- **WCAG 1.4.11 nem-szöveges kontraszt** (<https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html>)
  — innen a 6px-es pálcikaszélesség megtartása (a 3 CSS px-es padló bőven felett), és innen a
  szabály, hogy a sáv `aria-hidden`, a szöveges igazságot a meglévő „Időzítés" tény-chip hordozza.
- **IBM Carbon: a szín soha nem az egyetlen jel** (<https://v10.carbondesignsystem.com/guidelines/accessibility/color/>)
  — ezért kap a hat pálcika **csoportosítást** (3+3) és bővített legendet, nem csak két új hue-t.

**Elutasítva:**

- **Szegmentált mini-gyűrű** a hat jelre. A dashboard-minta-irodalom szerint a gyűrű-szegmensek
  csak akkor olvashatók 5–8 kategóriáig, ha az értékek **érdemben eltérnek**; a wellness
  sub-score-ok viszont a középmezőnyben tömörülnek, ott a hat rövid ív egybemosódik. Ráadásul
  elveszne a „melyik jel milyen magas" azonnali leolvasása, amit a pálcikák ma adnak.
- **Oura teljes visszavonulás-mintája** (kis kártyán csak egy nagy szám, a bontás a részletes
  képernyőn — <https://ouraring.com/blog/readiness-score/>). Elvben ez a legbiztonságosabb, de a
  mezo heti mozaikja **kifejezetten a napok összehasonlítására** való; ha a csempe csak egy számot
  ad, a heti oldal elveszti a fő funkcióját. A recon mérése szerint hat 6px-es pálcika **elfér**
  (56px a ~147px-es belső szélességben), tehát nem kell visszavonulni.
- **A `.tline` „ablak ± 3 h" zoomolt tengelye** (ami pontosan a `timingSub` nem-nulla tartománya
  lenne). Elegáns — a pont helye maga a részpontszám —, de étkezésenként más skálát adna, ami
  ütközik a small-multiples elvvel, és a snacknek (nincs ablaka) külön skála-kivétel kellene.

## Codebase terrain

**Érintett feature-ök:** `me` (FE-only, heti mozaik), `companion` (BE + `me-week` contract),
`fuel`/`nutrition`/`meal` (FE score-lap + BE scorer + contract), design system.

**Kulcsfájlok:**

| Terület | Fájl |
| --- | --- |
| Az egyetlen élő 4-pálcikás render | `frontend/src/features/me/components/week/WeekDayTile.tsx:83-97` |
| Sub-jel kulcsok/címkék/`barClass` | `frontend/src/features/me/logic/weekDay.ts:24-40` (négyes) és `:59-72` (a hatos nap-oldali analóg) |
| Legend | `frontend/src/features/me/pages/WeekDaysPage.tsx:27-32` |
| CSS: pálcikák + legend + tokenek | `frontend/src/styles/prototype.css:7955-7961`, `:7976-7987`, `:334-337` (light) + `:668-671` (dark) |
| CSS: nap-oldal domain-színek (a forrás-szemantika) | `frontend/src/styles/prototype.css:8110-8148` |
| Mock adat | `frontend/src/data/me/meWeek.ts:17-100`, `frontend/src/test/msw/handlers.ts:1513,1523` |
| Contract | `api/feature/me-week/me-week.yml:104-110` (`MeWeekSubscores`), `:150-153` (`MeWeekAggregates`) |
| BE projekció | `backend/.../companion/service/DayScoreService.java:124-129`, `MeWeekService.java:122-166` |
| BE heti aggregálás | `backend/.../companion/service/WeeklyScoreService.java:200-232` |
| Meal context-dimenzió (a `.tline` forrása) | `backend/.../nutrition/service/MealScoringService.java:505-535` |
| Slot-ablakok (ma csak configban) | `backend/.../nutrition/config/MealScoringProperties.java:150-156`, `application.yml:1408-1414` |
| Meal contract | `api/feature/meal/meal.yml:255-259` (`MealContextRow`) |
| FE context-panel + a beemelés helye | `frontend/src/features/fuel/components/ContextPanel.tsx`, `DimensionCard.tsx:76-80` |
| Recept-sablon breakdown (nincs `context` dim) | `backend/.../nutrition/service/MealScoringService.java:203-217` |

**Követendő minták:** `EntranceGroup` + `.rise` + per-elem `--d` stagger (a `.rise` **halott
markup** `EntranceGroup`-on kívül); clay ikonok/spotok, **soha nem emoji**; `--mz-wash-*` /
`--mz-cell-*-ink` token-családok, nem párhuzamos paletta; becsületes hiány (null → `is-none`
csonk, nem hamis nulla); `useDualQuery` explicit `REAL_EMPTY`-vel, mock-fallback nélkül real
módban; boxos komponens-fejléc-komment a bd id-vel és a prototípus-forrással; RTL +
`data-testid` + osztály-szelektor, **snapshot sehol**.

**Ismert csapdák:**

1. **Contract-drift kapu kétszer** — a `me-week` és a `meal` fragment mellé a regenerált
   `api/openapi.yml` és `frontend/src/data/_client/api.gen.ts` **ugyanabban a commitban**.
2. **`weekDay.test.ts:139` ma kifejezetten pineli**, hogy „a mozaik NÉGY pálcikán marad" — ezt a
   szelet invertálja, nem törli.
3. **A `.dayev-dim.is-*` és a `.wkd-sparks i.is-*` osztálycsalád scope-olása szándékos**
   (`prototype.css:8117-8122`). A két család azonos szemantikát kap, de **egyik sem oldható fel**.
4. **`mozaikCssTokens.test.ts`** minden új `--mz-*` propot megkövetel `:root`-ban **és**
   `:root[data-theme="dark"]`-ban → két új szín = négy deklaráció.
5. **`MeWeekService.renderDayLine:211-230` LLM-prompt payload**, nem kijelző-string: minden
   chat-fordulóban fut, és `MeWeekServiceRenderDayLineTest.java:26` pineli a pontos szöveget.
6. **`WeekDayCard.tsx` halott kód** (`me.md:602`), de a típusváltás után nem is fordulna.
7. **FE tesztek két módban, explicit `VITE_USE_MOCK`-kal** — worktree-ben a csupasz `pnpm test`
   kétszer mock-ot futtat, a real-mode kapu vacuous.
8. **Fókuszált BE teszt `-Dmezo.test.use-testcontainers=true`-val**, és az `ArchitectureTest`
   külön, mert a fókuszált futás kihagyja.

**Elavult doksi-mutatók, amiket ez a szelet zár le:** `me.md:151-159` (nem létező `WeekPage.tsx`-et
ír le; a doksi maga flageli `:680`-nál), `me.md:154` (a `WeekDayCard`-ot élő felületnek mondja),
`me.md:590` (`DayScoreServiceIT` „100/100/100/100" — ma az `activity` 30), `me.md:747` (§10 file
map). A `CODEMAP.md:737` a `components/week/` alkönyvtárat laposítja — ez **generátor-korlát,
nem kézzel javítandó**.

## Döntések

### D1 — A heti sub-jelek forrása: contract-bővítés (nem FE-only, nem 7 extra kérés)

A `MeWeekSubscores` négyről hatra bővül. Ez azért olcsó, mert a `DayScore` rekord **már hordozza
a teljes `DayEvaluation`-t**, tehát a `MeWeekService.toSubscores` projekciója nulla plusz
számítás. Elutasítva: a puszta FE-oldali forma-sűrítés (nem teljesíti a `.5`-öt) és a heti oldal
hét külön napi-evaluation kérése (duplikált igazságforrás, 7×-es kérésszám).

### D2 — A régi négy kulcs a hat tiszta részhalmaza

`fuel ← nutrition`, `activity ← training`, `checkin ← logging`, `sleep ← sleep`; a hatos csak
**minőség**-gel és **ritmus**-sal bővül. Nincs jelentés-vesztés és nincs kompromisszum-térkép, ezért
a mezőnevek a **dimenzió-idekre** állnak át (egy szókincs a heti és a napi felület között),
nem a régi négy név mellé kerül kettő.

### D3 — `MeWeekAggregates` / `MeWeekTrendPoint` / `weekly_score` NEM mozdul

A FE ma egyetlen `sleepAvg`/`fuelAvg`/`checkinAvg`/`activityAvg` mezőt sem fogyaszt (grep-igazolt),
és a cache-elt sor csak a `score`-t + a négy átlagot tárolja, míg a `subscores` wire-projekció
minden olvasáskor újraszámolódik. Ezért **nincs Liquibase-migráció és nincs cache-purge**; a
`WeeklyScoreService.aggregate` a négy meglévő átlagoszlopot ugyanabból a négy dimenzióból tölti
tovább. A `lint-liquibase.mjs` zöldje és egy üres migrációs diff a bizonyíték.

### D4 — `renderDayLine` szándékosan változatlan

Az LLM-prompt payload nem bővül a két új dimenzióval: minden chat-fordulóban fut, a
token-költség és a prompt-tartalom változása külön döntés lenne. A pinelt
`MeWeekServiceRenderDayLineTest` **változatlan átmenete** ennek a bizonyítéka, nem mellékhatás.

### D5 — Csoportosított 3+3 pálcika, nem egyenletes hatos, nem mini-gyűrű

Hat 6px-es pálcika, 3px belső rés, **8px csoportrés a harmadik után**: `tápanyag · minőség ·
edzés` | `alvás · logolás · ritmus` („mit tettél" | „hogy vagy"). Sávszélesség 56px a ~147px-es
belső szélességben. A csoport olvasási fogódzót ad legend nélkül is (Carbon: a szín ne legyen az
egyetlen jel). A legend hat elemre nő, halvány elválasztóval a csoporthatáron.

### D6 — Nap-oldallal egyező domain-paletta

`tápanyag = sage · minőség = gold · edzés = coral · alvás = lavender · logolás = rose · ritmus =
sky`. Ugyanaz a szín ugyanannak a jelnek a heti csempén és a nap-oldali dimenzió-csempén, tehát
átkattintás után nincs újratanulás. **Vállalt ára:** az alvás ma kék, és lavenderre vált; a mai
kék a ritmushoz kerül át. Két genuinely új token-pár (gold, lavender), a másik négy hue
újracímkézése.

### D7 — Az étkezési ablak a contracton érkezik, nem FE-ből származtatva

Új opcionális `MealTimingDetail { eatenAt, windowFrom, windowTo, slotLabel }` a `context`
dimenzión, a meglévő detail-mezők (`novaDetail`, `macroRatio`) mintájára. A `contextDim` már
kézben tartja a slotot, a `localTime`-ot és a `props.slotWindows()`-t. Elutasítva: az ablak
FE-oldali származtatása a felhasználói slot-sablonokból — **eltérne a szerver-config ablakoktól,
amik ténylegesen pontoztak**, pont az a divergencia, ami ellen a `mealContext.ts` „olvasd vissza,
ne származtasd újra" elve született. Snacknél `windowFrom`/`windowTo` null.

### D8 — `.tline` teljes nap tengelyen, `context`-re szűkített komponensben

Új `MealTimingStrip`, a `DimensionCard`-ban `dim.id === 'context' && 'timing' in dim` feltétellel
— **nem** a hat dimenzió által osztott generikus `ContextPanel`-be. Tengely 0–24 h, minden
étkezésnél azonos; kitöltött ablak-sáv; pont az `eatenAt`-nél; ablakon kívül korall pont +
szaggatott „mennyivel" híd az ablak széléig; snacknél halvány teljes sáv („bármikor jó"), nem
hamis „mindig tökéletes". A sáv `aria-hidden`, a meglévő „Időzítés" tény-chip a szöveges igazság.

### D9 — `WeekDayCard.tsx` + tesztje törlődik

Nem opcionális takarítás: a `me.md:602` szerint már ma sem fed élő felületet, és a
`MeWeekSubscores` típusváltása után nem is fordulna. A törlés kiváltja a CODEMAP-regent, ami a
szelet miatt amúgy is kötelező.

## Architektúra és adatfolyam

```
DayEvaluationEngine ──► DayEvaluation ──┐
                                        ├─► DayScore (már ma is hordozza mindkettőt)
DayScoreService.score ──────────────────┘
        │
        └─► MeWeekService.toSubscores ──► MeWeekSubscores{6} ──► useMeWeek ──► WeekDayTile.wkd-sparks{6}
                                                                                    └─► WeekDaysPage.LEGEND{6}

MealScoringService.contextDim ──► Dim("context", …, timing: MealTimingDetail?)
                                        └─► MealBreakdown.dimensions[] ──► DimensionCard
                                                                              └─► MealTimingStrip  (csak id==='context')
                                                                              └─► ContextPanel     (a chipek maradnak)
```

Az egységek határai: a `weekDay.ts` **egy** listát exportál a hat dimenzióról (kulcs, címke,
`barClass`, csoport), amit a csempe és a legend egyaránt fogyaszt — ma ez a lista duplikálva van
(`SUBSCORES` négyes + `DAY_DIMENSIONS` hatos), és a duplikáció oka (a négyes wire-alak) éppen
megszűnik. A `MealTimingStrip` tiszta prezentációs komponens: bemenete a `MealTimingDetail`,
kimenete a sáv; nem tud a sheetről, a mealről és a scorer belső szabályairól.

## Hibakezelés és hiány-állapotok

- **null sub-jel** → a mai `is-none` 4px-es csonk, változatlanul. Hat jelnél gyakoribb lesz
  (a `quality` és a `rhythm` degradálható), ezért a csonk olvashatósága explicit teszt-eset.
- **degradált dimenzió** (súly 0) a napi motorban → a heti csempén `null` sub-jel, nem 0.
- **`MealTimingDetail` hiánya** (régi envelope, recept-sablon, snack ablak nélkül) → a
  `MealTimingStrip` **nem renderel semmit**, a tény-chipek a mai formában maradnak. Ez teszi a
  mezőt biztonságosan opcionálissá a már cache-elt `meal_breakdown` envelope-ok felett is.
- **Éjfél-átfordulás** az ablakon kívüli hídnál: a napi motor `mezo-jcpt.4`-es tanulsága
  (körkörös óratávolság) itt is érvényes — a 23:35-ös vacsora a 22:00-s ablakszélhez 1 h 35 p,
  nem 22 óra.

## Tesztelés

**Backend** (fókuszált, `-Dmezo.test.use-testcontainers=true`):

- **Megjegyzés (F5, záró review):** `MeWeekServiceTest` és `WeeklyScoreServiceTest` NEM léteznek
  a repóban — tervezési hiba. Az egyenértékű fedés a `DayScoreServiceTest` /
  `MeWeekControllerIT` / `MeWeekTrendIT` hármasban landolt; a következő szelet ezeket keresse.
- `DayScoreServiceTest` / `MeWeekControllerIT` / `MeWeekTrendIT` — a hat mező projekciója a
  `DayEvaluation`-ből (degradált dimenzió `null`-ként megy ki, nem 0-ként), és hogy a négy
  átlagoszlop ugyanazt adja, mint a szelet előtt.
- `MeWeekServiceRenderDayLineTest` — **változatlanul zöld** (D4 bizonyítéka).
- `MealScoringServiceTest` — `MealTimingDetail` ablakban / ablakon kívül / snack (null ablak);
  és hogy a `recipeTemplateBreakdown` továbbra sem ad `context` dimenziót.
- `ArchitectureTest` külön futtatva.

**Frontend** (RTL, mindkét mód explicit `VITE_USE_MOCK`-kal):

- `WeekDayTile.test` — hat `i` elem, a csoportrés megléte, `is-none` csonk nullra, `aria-label`
  változatlan.
- `weekDay.test` — a mai „NÉGY pálcikán marad" pin invertálva a hatos listára.
- `WeekDaysPage.test` — hat legend-elem.
- `MealTimingStrip.test` — a három állapot; hogy `timing` nélkül semmit nem renderel; hogy a sáv
  `aria-hidden` és a szöveges tény a chipben van.
- `dualMode.guard` és `mozaikCssTokens` / `prototypeCssStructure` változatlanul zöld.

**Kapuk:** contract-drift (kétszer), `gen-codemap.mjs --check`, `lint-liquibase.mjs`,
`pnpm build`, Playwright vizuális suite. **Javítás (Task 5, a human jóváhagyásával):**
vizuális baseline-frissítést MÉGIS várunk, de szűkítve — az új `m4` mock étkezés (kései vacsora,
23:35, az ablakon kívül, a `MealTimingStrip` out-of-window ágának lefedésére) megváltoztatja, mit
renderel a `/fuel` és a `/fuel/plan`, mindkettő a Playwright suite-ban van
(`frontend/tests/visual/visual.spec.ts:57-58`, `fuel`/`fuel-terv` goldenek) — ezért **a `fuel` és
a `fuel-terv` goldenek el FOGNAK mozdulni**, és a PR után egy `update-visual-baselines.yml`
dispatch szükséges (a linux baseline darwin gépen nem regenerálható). A `WEEK` csempe és a
recept-lap goldenje viszont továbbra sem mozdul: a `/me/week`
golden a `WeekHubPage` (ring + spark), a `WeekDayTile` a suite-on kívüli `/me/week/napok`-on van;
a `fuel-recept-score` goldenen pedig nincs `context` dimenzió (recept-sablon, nem logolt étkezés).
Ezt a szelet **explicit ellenőrző lépéssel** zárja le, nem feltételezéssel.

**Futásidejű ellenőrzés** a `verify` skillel, mock-módban: `/me/week/napok` (benne a `100 / 100`
szoros eset, ahol az 56px-es sáv a legkritikusabb) és egy meal score-lap a `.tline` három
állapotával.

## Dokumentáció

- `docs/features/me.md` — §2 Heti + nap-oldal, §4 végpontok, §7 tesztek, §10 file map; **és** a
  doksi által saját magán flagelt elavult mutatók javítása (`:151-159`, `:590`, `:602`, `:747`).
- `docs/features/fuel.md` — §2 „Logolás 2.1" 4. pont (az időzítés-sáv leszállítva), §10 komponensek.
- `docs/features/companion.md` — a `DayScoreService` → `MeWeekSubscores` projekció narratívája
  (a „legacy négyes wire-alak" megszűnt).
- `docs/CODEMAP.md` — regenerálva (`node scripts/gen-codemap.mjs`).

## Nyitott kérdések

Nincs. A három nyitott döntést (heti jel-forma, paletta, `.tline` tengely) a vizuális
brainstorm-companion zárta le: B (csoportosított 3+3), 1 (nap-oldallal egyező paletta),
1 (teljes nap tengelye).
