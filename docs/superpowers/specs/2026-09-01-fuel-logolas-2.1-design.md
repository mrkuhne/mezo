# Fuel · Logolás 2.1 — Keret-hero a /fuel/log-on, nagy AI score, rost gyűrű, kontextus chip, breakdown sheet

**Dátum:** 2026-09-01 · **bd:** mezo-zeeq · **Státusz:** jóváhagyva (artifact-prototípus, három
iterációs kör a userrel: „tökéletes, mehet")
**Prototípus (a vizuális igazság forrása):** `docs/design_2.0/prototypes/fuel-logolas-2.1.html`
(artifact: https://claude.ai/code/artifact/f4af0e21-8293-4732-a9e2-2a2c48a3427e)
**Előzmény:** `2026-08-31-fuel-logolas-2.0-design.md` (mezo-byo1), `2026-08-09-fuel-keret-hero-design.md` (mezo-c9t5)

## Probléma

A `/fuel/log` oldalon logolás közben nem látszik, hol tart a nap makróban: a hero csak
egy kcal-számot mutat, a Fuel hub Keret-hero gyűrűi (fehérje / szénhidrát / zsír / rost /
víz) hiányoznak. A logolt ételek kártyáján a három 22 px-es makró-gyűrű olvashatatlan, a
rost hiányzik, a kcal 15 px, az AI score egy apró chip. Nem látszik, hogy az étel
standard, edzés előtti vagy edzés utáni ablakként lett pontozva. A MealScoreSheet
breakdownja sűrű, 9–12,5 px-es szövegekből áll, a súlyozás nem látszik egyben, és a
„Hogyan számoltam" eszköz-lista zajt visz a részletekbe.

## Megoldás — négy szelet, egy oldal

### 1. Hero: a Keret-hero blokk egy az egyben (`FuelLogPage`)

A `.mz-page-hero` kcal-bignum + `/ cél kcal` sor **törlődik**. Marad a `‹ Fuel` chip, a
nap-léptető és a `LOGOLÁS` / `PÓTLÁS` eyebrow; alattuk a hub `KeretHero` komponense
**változatlan CSS-családdal** (`.khero`): 46 px kcal-szám „kcal ma" utótaggal (2 s
count-up), szegmentált nap-sáv arany most-jelölővel, `Alap / Mozgás / Cél` chipek
(→ `EnergyBreakdownSheet`), öt gyűrű (→ a víz gyűrű `WaterLogSheet`-et nyit,
`useWaterActions(date)`).

- **VM feed:** ugyanaz, mint `FuelMaiPage`-en — `buildKeretHero({budget, staticEnergy,
  consumed, meals, water, slots, nowHHmm})` a `useFuelDay(date)` + `useFuelTimeline(date)`
  eredményéből. A kcal-cél nevezője ezzel a FE `budget` lesz (mint a hubon), nem a
  `fuel.targets.kcal` — fuel.md „egy dinamikus budget a hero-n" szabálya.
- **Of-sor visszatér (deliberate divergencia a hub v3 declutterhez képest):** a
  `KeretHero` új, opcionális `ofLine?: string` propot kap; a log-oldal
  `{done}/{n} ablak kész · {remainingKcal} kcal még belefér` szöveget ad (a
  `remainingKcal` a VM-en már ott van). Negatív maradéknál: `· {|x|} kcal fölötte`.
  A hub nem adja meg a propot, ott semmi nem változik.
- **Múlt nap (offset > 0):** `useFuelTimeline` energia-/edzés-adatai a MAI napot
  tükrözik, ezért egy pure post-pass, `asPastDayHero(vm)` (`logic/keretHero.ts`, az
  `asPastDayLane` mintája) **elrejti a chipeket és a most-jelölőt** (`chips: null`,
  `nowFrac: null`). Fogyasztás, szegmensek, gyűrűk, víz a nap valós adatai — maradnak.
- A `mz-hero-sb` „nincs mai étkezési ablak" / „ezen a napon nem volt…" üzenetek az
  of-sorba költöznek, amikor nincs ablak.

### 2. Logolt kártya (`WindowBlock`, done állapot)

Anatómia felülről: `időpont · ABLAK · [kontextus chip] · KÉSZ ✓` → ikon + étel neve
(17 px) → **egy sor: balra AI score pill, jobbra kcal** → négy makró-gyűrű.

- **AI score pill** (`.fh-aisc`, gomb): 30 px SVG gyűrű (`stroke-dashoffset`, a KeretHero
  ring-recept) a pontszám tónusszínével, benne ✨; mellette 19 px-es szám és alatta a
  tónus-szó 8,5 px verzállal (`jó` ≥ 80 · `közepes` ≥ 60 · `gyenge` < 60 — a
  `MealScoreChip.toneOf` küszöbei, oda kiemelve `logic/scoreTone.ts`-be); jobbra `›`
  chevron. Tónus: jó = sage, közepes = amber, gyenge = coral (`--mz-cell-*` tokenek).
  Pontszám nélkül: `✨ folyamatban` (marad, `.is-pend`). Csak `scorable` tile-nál gomb.
- **Nudge:** `@keyframes fh-aisc-nudge` (rotate ±5° + scale 1,06, a ciklus első 14%-a)
  és `fh-aisc-halo` (tónusszínű box-shadow villanás), `2.6s ease-in-out infinite` — a
  `fh-lt-nowpulse` kadenciája. `:active` alatt leáll. A `.fh-*` reduced-motion blokkban
  `animation: none`. (Prior art figyelmeztetés: lásd lent; a user kifejezetten a
  folyamatos ismétlést kérte, ez kerül be; a korlátozott ismétlés opció bd-ben marad.)
- **kcal:** 24 px félkövér, `KCAL` utótag 8 px verzállal, a sor jobb szélén. Terv-ablakon
  (now / missed / future) a kcal marad a név mellett, 22 px, alatta `kcal terv`.
- **Makró-gyűrűk:** 44 px SVG gyűrűk (P · C · F · R), a betű a gyűrű közepén, alatta a
  gramm 15 px félkövéren, alatta `{pct}% napi`. A rost gyűrű **csak done tile-on és
  csak `meal.fiberG != null` esetén** jelenik meg (a `FuelSlot`-on nincs rost; null-nál
  nem fabrikálunk). `TileRingVM.key` bővül: `'p' | 'c' | 'f' | 'r'`; a rost cél
  `FIBER_TARGET_G`, szín `var(--macro-fiber)`. A gyűrű animációja CSS transition, a
  MiniRing conic-gradient + `useCountUp` receptje **kivezetve**.

### 3. Kontextus chip: Standard / Pre-workout / Post-workout

A szerver a pontozáskor osztályozza a szerepet, de nem perzisztálja és nem küldi mezőként;
az egyetlen őszinte nyom a `breakdown.dimensions[id='context'].context` `Szerep` sora
(`Pre-workout üzemanyag-ablak` / `Post-workout regeneráció`), ami csak nem-standard
szerepnél létezik.

- `logic/mealContext.ts`: `mealContextOf(meal): 'standard' | 'pre' | 'post' | null` —
  `null`, ha nincs breakdown (pontozatlan → nincs chip); `Szerep` sor `Pre-workout…`
  prefixszel → `pre`, `Post-workout…` → `post`; pontozott, `Szerep` nélkül → `standard`.
  Prefix-egyezés, hogy a szerver-szöveg finomhangolása ne törje.
- `WindowTileVM.context` új mező (done tile-on számolva). Chip a `.flog-top` sorban a
  label és a stamp között: `● STANDARD` (recess/ink-soft), `● PRE-WORKOUT`
  (`--mz-cell-amber-*`), `● POST-WORKOUT` (`--mz-cell-lav-*`).
- A MealScoreSheet fejléce ugyanezt a chipet mutatja a slot mellett.
- **Nem** derivál a FE `deriveMealRole`-ból vagy a recept `role`-jából: az eltérne a
  szerver 120/90 perces, edzés-végétől számolt szabályától, és a chip mást mondana, mint
  a sheet kontextus-dimenziója. A composer-beli kézi választás külön bd-issue (nyitva).

### 4. MealScoreSheet — a breakdown újratervezve

Megosztott felület: `ScoreBreakdownBody` a `RecipeScoreSheet`-ben (recept Pontszám) is
él — a változás **oda is** átmegy, szándékosan (a fájl fejléce szerint a két felület
pixel-azonos marad).

- **Hero (`ScoreHero`):** 112 px gyűrű, benne 40 px-es (weight 200) pontszám és `/ 100`;
  a hero mosása a tónusszín; mellette a tónus-szó 20 px-en, alatta tény-chipek
  (`kcal · P · C · F · Rost`, a rost csak ha `fiberG != null`), alatta Konfidencia-csík.
  A prototípus fabrikált alcíme („két apró csere, és 80 fölé megy") **kimarad**.
- **Mezo · olvasat:** 14 px szöveg (SafeMarkdown), a kártya marad.
- **Szekció-eyebrow:** `Miből áll össze a {score}` · `{n} dimenzió · súlyozva`
  (a `Súlyozott bontás` felirat kivezetve, teszt frissül).
- **Új `ScoreLedger` komponens** (`components/`): szegmentált sáv, minden dimenzió
  szegmense `flex: weight`, kitöltése `score`, a dimenzió színével; alatta a súlyok
  százalékban és `Σ {contribution} / 100`. Tisztán a `weight` / `score` mezőkből.
- **`DimensionCard` összecsukható** (gomb-fejléc + `aria-expanded` + `aria-controls`):
  fejlécben 52 px gyűrű a pont-százalékkal, label színes ponttal, `súly {w}% → {pt} pont`,
  és a `detail` prózája 2 sorra vágva (`-webkit-line-clamp`). Kinyitva a teljes `detail`
  + a meglévő per-dimenzió panel (Macro/Micro/Nova/Context). **Alapból csukva.**
  A prototípus „Felhúzta / Lehúzta" párja **kimarad** — a wire-on egy `detail` string
  van, a pár fabrikáció lenne.
- **Lehetne jobb:** tételenként kártya, balra a szöveg 13 px-en, jobbra a nyereség
  sage dobozban. `formatImpact(impact)` (`logic/`): a `+0.04 score` alakot `+4 pont`-tá
  alakítja (×100, kerekítve); minden más impact-szöveg változatlanul jelenik meg.
- **„Hogyan számoltam" (tools) szekció törlődik** a `ScoreBreakdownBody`-ból. A
  `ToolChipRow` marad (négy másik fogyasztója van).

## Nem cél

- Sticky összecsukódó makró-sáv görgetéskor (prototípus nem sticky; ha kell, külön issue).
- Kontextus kézi választása a MealComposer-ben; backend `role` mező a wire-on.
- Rost gyűrű terv-ablakokon (nincs adat).
- A Fuel hub (`FuelMaiPage`) bármilyen vizuális változása.

## Adatfolyam

```
useFuelDay(date) ──fuel.meals/consumed/targets──┐
useFuelTimeline(date) ──plan.slots/budget/nowHHmm/energyBreakdown──┤
                                                                     ▼
FuelLogPage ── buildKeretHero(...) ─[past? asPastDayHero]─▶ <KeretHero ofLine chips→EnergySheet water→WaterSheet>
            ── buildWindowLane(...) ─[past? asPastDayLane]─▶ <WindowBlock tile{rings[p,c,f,(r)], context, scorePct}>
                                                              └─ score pill ─▶ <MealScoreSheet meal>
                                                                                 ├ ScoreHero (tónus, chipek, konfidencia)
                                                                                 ├ olvasat
                                                                                 ├ ScoreLedger (weight × score)
                                                                                 ├ DimensionCard[] (collapsible)
                                                                                 └ Lehetne jobb (formatImpact)
```

## Hiba- és üres állapotok

- Nincs breakdown: nincs kontextus chip, `✨ folyamatban` pill (nem gomb).
- `fiberG == null`: nincs rost gyűrű a kártyán, nincs Rost chip a sheet hero-ban.
- `energyBreakdown == null` vagy múlt nap: chipek rejtve, sheet nem mountolódik.
- Nincs ablak a napon: of-sor a régi üres-nap szöveggel, a hero többi része a valós
  (0) fogyasztást mutatja.
- Reduced motion: count-up azonnali, gyűrű-transition és nudge kikapcsolva.

## Tesztelés

Fókuszált FE tesztek (mock + real mód, `VITE_USE_MOCK=false` explicit):

- `logic/keretHero.test.ts`: `asPastDayHero` nullázza a chipeket és a `nowFrac`-ot, más
  mezőt nem érint.
- `logic/mealContext.test.ts`: null / standard / pre / post levezetés, prefix-egyezés.
- `logic/fuelSwimlane.test.ts`: done tile 4 gyűrű `fiberG` mellett, 3 nélkül; terv-tile
  mindig 3; `context` a done tile-on.
- `logic/formatImpact.test.ts`: `+0.04 score` → `+4 pont`, `−0.02 score` → `−2 pont`,
  szabad szöveg érintetlen.
- `components/ScoreLedger.test.tsx`: szegmens-arányok és a Σ.
- `components/DimensionCard.test.tsx`: fejléc label + súly-sor csukva; a sorok kinyitás
  után láthatók.
- `components/KeretHero.test.tsx`: `ofLine` renderel, nélküle nincs `.khero-of`.
- `sheets/MealScoreSheet.test.tsx`: új eyebrow-szövegek, nincs `Hogyan számoltam`,
  kontextus chip.
- `pages/FuelLogPage.test.tsx`: `.khero-n` jelen, régi bignum nincs; done blokk pill
  szövege `69` + `közepes`; kontextus chip a mock `Szerep` sorból; víz gyűrű sheetet nyit;
  múlt napon nincs chip-sor.
- `pages/RecipeDetailPage.test.tsx`: Pontszám sheet dimenzió-label a csukott fejlécben.
- Visual gate (`tests/visual/layout.spec.ts`) osztálynevei (`.flog-blk`, `.mz-page-body`)
  változatlanok.

## Prior art

Researcher-jelentés (5 forrás), szűrve:

- **Átvéve — Lighthouse** (https://developer.chrome.com/docs/lighthouse/performance/performance-scoring):
  publikált súlyok, alpont és összpont ugyanazon a színskálán, a „mit nyerek, ha X-et
  javítom" a súly × alpont-rés. Ez a `ScoreLedger` és a `+N pont` nyereség-doboz mintája.
- **Átvéve — Yuka** (https://help.yuka.io/l/en/article/ijzgfvi1jq-how-are-food-products-scored):
  szám + ítélet-szó + színsáv együtt a pillen; a súlyok nyíltak. Elvetve: a nem-additív
  „plafon" — a Mezo-score additív, a ledger összege a pontszám.
- **Részben átvéve — Oura / WHOOP / Zoe** (https://support.ouraring.com/hc/en-us/articles/360057791533-Readiness-Contributors):
  rögzített ítélet-létra minden dimenzión, csukott kártyák, konkrét étel-szintű javaslat.
  Elvetve: a súlyok elrejtése.
- **Figyelmeztetés, tudatosan felülírva — NN/g** (https://www.nngroup.com/articles/animation-usability/)
  és **WCAG 2.2.2** (https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html):
  a végtelen, ismétlődő pozíció-mozgás egy görgethető listán zavaró, és a szünetelhetőség
  szürke zónája. A user kifejezett kérése a 2–3 mp-es ismétlés; bekerül reduced-motion
  kapuval és `:active` leállítással. A korlátozott ismétlés (2–3 ciklus, vagy első
  megnyitás után leáll) külön bd-issue-ban marad opcióként.

## Codebase terrain

Investigator-jelentés, szűrve:

- **Érintett feature:** fuel (`docs/features/fuel.md` §2 43-74, §10 379-391; frissítendő).
- **Kulcsfájlok:** `pages/FuelLogPage.tsx:112-139` (hero, cserélendő);
  `pages/FuelMaiPage.tsx:53-70, 123-127, 167-177` (a másolandó VM-feed és sheet-drót);
  `logic/keretHero.ts:20-30, 43-109` (VM, `remainingKcal` már ott);
  `components/KeretHero.tsx:112-118`; `logic/fuelSwimlane.ts:39-48, 128-137, 152-156`
  (TileRingVM, done-join, gyűrűk); `components/WindowBlock.tsx:28-61, 89-104`;
  `sheets/MealScoreSheet.tsx`, `components/ScoreBreakdownBody.tsx:14-65`,
  `components/DimensionCard.tsx`, `components/ScoreHero.tsx`, `sheets/RecipeScoreSheet.tsx:41`;
  CSS `styles/prototype.css:3165-3214` (`.khero`), `6372-6390` (`.fh-wstamp/.fh-wring/.fh-scorech`),
  `6791-6831` (`.flog-*`), `6358-6362, 6425-6428` (`fh-lt-nowpulse` + reduced-motion minta).
- **Követendő minták:** pure VM `logic/`-ban, prezentációs komponens `components/`-ben,
  hookok csak a page-en; őszinte állapotok (null → nincs cella); ring = CSS
  `stroke-dashoffset` transition egy-frame `filled` flippel; periodikus animáció = CSS
  keyframes + a család reduced-motion blokkja; sheet-idióma `{open && <Sheet/>}`,
  `EnergyBreakdownSheet` `energyBreakdown != null` őrrel.
- **Csapdák:** a CODEMAP-gate már piros a branchen (`RecipeWorkshopPage.tsx` hiányzik) —
  regenerálni kell; `useFuelTimeline(date)` félig dátum-tudatos (energia/edzés = ma) →
  `asPastDayHero`; két kcal-cél (targets vs budget) → budget; `FuelSlot`-on nincs rost;
  a szerep nincs a wire-on → `Szerep` sor; `fuelSwimlane.test.ts:79-91` három gyűrűt
  rögzít; `DimensionCard.test.tsx:26-30` és `RecipeDetailPage.test.tsx:220` a sorokat
  látja → kinyitás a tesztben; `MealScoreSheet.test.tsx:26-27` a régi eyebrow-t rögzíti;
  `useCountUp`-nak nincs jsdom-őre → CSS keyframes; `VITE_USE_MOCK` unset = mock.
- **Elavult doc-sorok, ebben a körben javítva:** `fuelSwimlane.ts:15-16` (WindowLane
  már nincs), `fuel.md:383` (ScoreBreakdownBody a RecipeScoreSheet-en át),
  `prototypes/README.md` index (2.1 felvétele).
