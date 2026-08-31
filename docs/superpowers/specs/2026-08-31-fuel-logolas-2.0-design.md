# Fuel · Logolás 2.0 — swimlane → hős-csempe + /fuel/log blokk-oldal

**Dátum:** 2026-08-31 · **bd:** mezo-byo1 · **Státusz:** jóváhagyva (brainstorm + vizuális
prototípus-iteráció a userrel)
**Prototípus (a vizuális igazság forrása):** `docs/design_2.0/prototypes/fuel-logolas.html`
(`src/fuel-log-head.html` + `src/fuel-log-body.html`)

## Probléma

A Fuel hub vízszintes ablak-swimlane-je (`WindowLane`) nehezen áttekinthető — a keskeny,
oldalra görgethető csempéken nem látszik egyben a nap. A „Mit ettél?" logolási flow
(`LogFlowPage`) szürke, élettelen; a NÉV mező felesleges (a név a tételekből levezethető);
a Kamra/Recept picker sheetek lapos, egyforma kártyalisták. (User-visszajelzés: a sűrűség
NEM gond — a szín/élet, az automatikus név és a jobb választók a fókusz.)

## Megoldás — négy réteg, egy nyelv (Mozaik 2.0)

### 1. Hub: élő „Logolás" hős-csempe (a swimlane helyén)

A `FuelMaiPage`-ről a `WindowLane` **törlődik**. Helyére a KeretHero alá egy teljes
szélességű, korall-mosott hős-csempe kerül (`FuelLogHeroTile`), amely a `/fuel/log`
oldalra navigál. Tartalma állapotfüggő, a `buildWindowLane` VM-ből számolva:

- **MOST-ablak van**: lüktető korall pont + „LOGOLÁS · MOST" eyebrow, nagy sor
  `{slot} · {time}`, alatta `a tervből: {plan név}` (terv nélkül: „mit ettél?"), az ablak
  clay ikonja.
- **Nincs MOST, van jövőbeli**: „köv. {slot} · {time}" + terv-javaslat.
- **Minden ablak kész**: zsálya mosás, „Minden ablak kész ✓".
- **Nincs ablak ma (üres nap)**: a csempe a `/fuel/log` oldalra visz, ahol az üres-nap
  blokk áll (lásd 2.).
- Alul **ablak-pöttysor** (flex sáv: zsálya=kész, korall lüktet=MOST, borostyán=kimaradt,
  szürke=jövő) + őszinte állapotsor: `{done}/{n} ablak kész[ · {m} pótolható]`.

### 2. Új routolt oldal: `/fuel/log` — ablakok egymás alatt (FuelLogPage)

Mozaik „csempe → saját oldal" idióma (`MozaikPage`, korall hero-zóna, `‹ Fuel` vissza-chip).
Oldal-hero: nagy szám = mai kcal, mellette `/ {cél} kcal`, alatta `{done}/{n} ablak kész`
— minden mentés után élőben frissül.

Alatta **függőleges blokk-lista**, ablakonként egy széles kártya (`WindowBlock`), a
`WindowTileVM` állapotaival:

- **done**: zsálya wash, `KÉSZ ✓` stamp, loggedTime, étel neve, AI-score chip
  (`✨ {pct} p` / `✨ folyamatban`, koppintásra MealScoreSheet), jobbra kcal-cella + 3
  mini makró-gyűrű (P korall · C borostyán · F levendula, kitöltés = napi cél-arány).
- **now**: korall keret + `MOST` stamp, terv-étel + „a tervből", kcal+gyűrűk a tervből,
  CTA sor: primér `Logold` + ghost `✨ AI`.
- **missed**: szaggatott borostyán keret, `KIMARADT` stamp, ghost étel-név, „még
  pótolható", CTA: `Pótold` + `✨ AI` — sosem büntető.
- **future**: fehér kártya, terv-javaslat, ghost `Logold` + `✨ AI`.
- A lista végén állandó **„Ablakon kívül"** blokk (szaggatott, `＋ Logolás` + `✨ AI`),
  üres napnál vezető **üres-nap blokk** (`＋ tervezz` → `/fuel/plan`).

**Helyben nyíló logolás:** a Logold/Pótold/AI a blokkot **helyben nyitja ki**
(grid-rows 0fr→1fr animáció, reduced-motion: ugrás), benne a MealComposer. Egyszerre egy
blokk nyitott; nyitáskor a lista a blokkra gördül (csak a belső scroll-konténer). A slot
maga az ablak (mezo-bnsf: a window slotKey-e megy a mentésbe), ezért slot-választó csak
az „Ablakon kívül" blokk composerében van. Mentés → a blokk összecsukódik, done-ra vált
(pattanó `justdone` animáció), a hero-k és a hub-csempe frissülnek; +10 XP a meglévő
logMeal útvonalon.

### 3. MealComposer — a LogFlowPage törzse kiemelve, felfrissítve

Az 556 soros `LogFlowPage` szerkesztő-törzse **`MealComposer`** komponenssé válik
(`features/fuel/components/MealComposer.tsx`). Minden logika érintetlenül költözik:
forrás-csempék (Kamra/Recept/AI), AI-panel (szöveg+fotó, BECSLÉS-sorok, needsReview),
AmountField guard (±/gépelés), recept-hozzávaló finomhangolás (mezo-ormb overrides),
provenance-szabály, totals + nap-kontextus sáv, `logMeal` mentés.

Változások:

- **NÉV input törölve.** A név mindig `deriveMealName(sorok)`; a mentés `title`-je ez a
  derivált név (üres tételsornál null). Az összesítő kártya címeként jelenik meg.
- **Tétel-kártyák kind-wash arca** (prototípus szerint): forrás-színű átmenet +
  4px bal gerinc (KAMRA arany · RECEPT korall · BECSLÉS levendula), forrás-chip,
  jobbra **kcal-cella** a forrás színében, alatta **3 színes makró-minicella**
  (feh./szénh./zsír) — élőben számolva. A NutrientCells sor (cukor/rost/só…) marad
  a minicellák alatt, ahogy ma.
- **Összesítő**: zsálya mini-hero — „EZ AZ ÉTKEZÉS" + derivált név + színes
  makró-cellák + „Mai nap eddig X +Y = Z · cél" sor + kétszínű progress.
- Props: `initialSlot?`, `slotLocked` (ablakból nyitva a seg el sem jelenik),
  `prefill?`, `aiPanelOpenOnMount?`, `onSaved`, `onCancel`.

A **LogFlowPage megmarad vékony overlay-wrapperként** (portál + fejléc + MIKOR
slot-választó + MealComposer) a többi belépési pontnak: KamraItemDetailPage,
RecipeDetailPage, EletjelPage, NapRutinPage — API-ja változatlan, így azok nem módosulnak.

### 4. Picker sheetek — színes, szűrhető polcok

- **KamraPickSheet**: kereső alatt vízszintes **kategória-chip sor** (Mind + a
  `categoryMeta` kategóriái, színpöttyel; aktív chip a kategória színével tintázva).
  A sorok kind-wash kártyák: kategória-színű gerinc + halvány átmenet, név,
  `márka · NOVA-pont + NOVA n · /100 g` alsor, jobbra kcal-cella, `＋`/`✓` gomb.
  Multi-add (nyitva marad) változatlan.
- **ReceptPickSheet**: kereső + `★ csillagos` szűrő-chip; korall wash kártyák:
  név (+★), `{slot} · {n} hozzávaló · /adag` alsor, kcal-cella, `＋`. Választásra zár.

## Architektúra / fájlok

| Egység | Fájl | Sors |
|---|---|---|
| FuelLogPage (új oldal) | `features/fuel/pages/FuelLogPage.tsx` | ÚJ — route `/fuel/log` a router.tsx-ben |
| WindowBlock (blokk) | `features/fuel/components/WindowBlock.tsx` | ÚJ — prezentációs, `WindowTileVM`-ből |
| FuelLogHeroTile | `features/fuel/components/FuelLogHeroTile.tsx` | ÚJ — hub hős-csempe |
| MealComposer | `features/fuel/components/MealComposer.tsx` | ÚJ — a LogFlowPage törzse kiemelve |
| LogFlowPage | `features/fuel/pages/LogFlowPage.tsx` | marad, vékony wrapper |
| WindowLane | `features/fuel/components/WindowLane.tsx` | TÖRLŐDIK |
| fuelSwimlane VM | `features/fuel/logic/fuelSwimlane.ts` | marad (a blokkok + hős-csempe hajtója) |
| FuelMaiPage | `features/fuel/pages/FuelMaiPage.tsx` | WindowLane → FuelLogHeroTile; a log-overlay state a hubról a FuelLogPage-re költözik |
| KamraPickSheet / ReceptPickSheet | `features/fuel/sheets/…` | átfazonírozás |
| CSS | `styles/prototype.css` | új `fh-log*` / `fh-lb*` blokk a meglévő fuel-szekció mellé |

Adatréteg, contractok, mutációk, sheetek (MealScoreSheet, WaterLogSheet…) **érintetlenek**
— ez view-layer recompose, mint a d20 többi köre.

## Viselkedési invariánsok (őszinte állapotok)

- Ablakból indított log a **window slotKey-ével** ment (mezo-bnsf) — sosem falióra-tipp.
- kcal/gyűrű csak ott, ahol az adat létezik — se „0 kcal", se „—" színház.
- Kimaradt ablak: „még pótolható" — sosem büntető hang.
- Frissen mentett meal score-chipje `✨ folyamatban`, sosem koholt szám.
- Üres tételsor = a Logolás CTA disabled; üres nap = tervezz-blokk.
- Reduced-motion: minden új animáció (expand, pöttypulzus, justdone) kikapcsol.

## Tesztek

- `FuelLogPage.test.tsx`: blokk-állapotok renderelése a VM-ből; expand/collapse;
  slot-továbbítás mentéskor; „Ablakon kívül" slot-választó; üres nap.
- A `FuelMaiPage.logMeal.test.tsx` window-flow esetei átköltöznek a FuelLogPage tesztjeibe;
  a FuelMaiPage tesztje a hős-csempe állapotait fedi (MOST / köv. / mind kész / pótolható
  számláló) + navigációt.
- MealComposer: a LogFlowPage meglévő tesztjei (ai/overrides/prefill/timestamp) a wrapper
  szinten változatlanul zöldek maradnak — a kiemelés viselkedés-semleges, kivéve a NÉV
  mező eseteit, amelyek a derivált névre írandók át.
- Sheet-tesztek: kategória-szűrés (Kamra), ★-szűrés (Recept), multi-add ✓ marad.
- Gate: frontend tesztek mindkét módban + build; CI a PR-on.
