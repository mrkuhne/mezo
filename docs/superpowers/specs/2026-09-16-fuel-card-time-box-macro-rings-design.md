# Fuel Mai kártya: óra-doboz + arány-alapú makró/rost mini-gyűrűk — design

**bd:** mezo-l2gp0 · **Jóváhagyott vizuális referencia:**
`docs/design_2.0/prototypes/fuel-kartya-ido.html` (v2, owner-approved 2026-09-16;
forrás: `prototypes/src/fuel-kartya-ido-{head,body}.html`, build.sh-ből épül).

## Probléma

Az owner a Mai nap-blokkokon nem látta, MIKOR logolt: az ablak-csík két szélső száma nem a
logolás ideje, hanem anchor ± 2,5 óra. Emellett a soronkénti gramm-csík (ikon + szám) mellett
nagy üres tér maradt jobbra, és a hosszú ételnevek levágódtak.

Első próbálkozás (v1, elvetve): idősáv törlése + napi-cél alapú makró gyűrűk. Az owner
visszajelzése: az idősáv maradjon; a napi célhoz mért per-étkezés gyűrűk pedig alig telnek
("ici pici kör részlet") — értelmesebb nevezőt kért, plusz rostot, és az AI pont lekerülését
az alsó sorba.

## Jóváhagyott design (v2)

A `FuelMealBlocks` blokk-kártya változásai:

1. **Ablak-csík marad** változatlanul (anchor ± 150 perc, sáv = tervezett ± 30, pötty = log).
2. **Óra gomb** a fejlécsorban, a név és a `BudgetRing` között: 34 px kerek üveg-korong,
   `i-idozito` clay ikonnal (21 px). CSAK logolt blokkon jelenik meg (`rows.length > 0`).
3. **Idő-doboz**: az óra gomb egy kis 3D üvegdobozt nyit (a ház `GlassBox` portál-mintája,
   kompakt változat): felül kilógó `i-idozito` clay ikon, "LOGOLVA" eyebrow, nagy
   display-számmal a logolás ideje (`DoneMealRow.time`), alatta "<blokk label> · <étel név>",
   elválasztó alatt halk sor: "Terv szerint ~HH:MM" (a tervezett ablak-idő). Bezárás:
   háttér-koppintás, Rendben gomb, Escape. Belépő: perspective/rotateX/scale spring-be
   érkezés (0,34 s), reduced-motion ágon azonnali.
   - A tervezett idő forrása tervezési kérdés (lásd Terep/csapdák): ha egy done slothoz nem
     áll rendelkezésre tervezett idő, a sor ELMARAD (őszinte-null), nem becslünk.
4. **Makró mini-gyűrűk** a gramm-csík helyén, NÉGY cella (P · Ch · Zs · Rost):
   - Cella: 15 px clay ikon a gyűrű fölött (`i-hus`/`i-gabona`/`i-avokado`/rost-ikon), 40 px
     gyűrű (pathLength 100, 4-es stroke), a gyűrűben a GRAMM (12,5 px, makró-színű) + kis "g".
   - **P/Ch/Zs gyűrű íve = a makró részesedése az ÉTKEZÉS energiájából** (4·P, 4·C, 9·Zs
     kcal-jából számolt arány — a részletlap arány-gyűrűinek szemantikája, a szín ugyanazt
     jelenti mindkét felületen).
   - **Rost gyűrű íve = a napi rost-adagból fedezett rész** (rostnak nincs energia-aránya).
   - Őszinte-null: hiányzó makró → "—" a gyűrűben, nincs ív (`is-null`); a 0 g valódi nulla
     (üres ív, "0 g"). Ha mindhárom makró null, arány nem számolható → mindhárom "—".
5. **Sor-elrendezés**: az étel neve teljes szélességben felül (2 soros clamp), alatta egy
   sorban a négy gyűrű + jobbra zárva a `FuelScoreChip`. A jobb oldali üres tér megszűnik.

Nem változik: BudgetRing, üres-blokk "Logolás ide", pont-chip viselkedése (értékelésre nyit),
blokk-mosások, szégyenmentes hangnem.

## Érintett owner-döntések

- A `FuelMealBlocks.tsx` fejléc-kommentjének "a sor IDEJE az ablak-csíkon él, nem külön
  szövegként" döntése ÚJ alakot kap: az idő az ablak-csíkon él ÉS az óra-dobozban kérhető le
  szövegesen — a kártyán továbbra sincs idő-szöveg. A komment és a prototípus-referencia
  (fuel-kartya-ido.html) frissítendő.
- mezo-n9peo (hue + clay ikon, felirat nélkül) marad érvényben, a gyűrűkre átörökítve.

## Prior art (researcher)

- **MacroFactor** (https://macrofactor.com/timeline-based-food-logger/): az érett loggerek
  az időt statikusan mutatják, szerkesztés explicit koppintás mögött — a "koppintásra
  külön felületen" minta validált. (Az owner kifejezetten gombot + dobozt kért; a statikus
  idő-szöveg alternatíváját elvetettük.)
- **FoodNoms / Untitled UI** (https://www.macstories.net/reviews/foodnoms-2-…,
  https://www.untitledui.com/components/progress-circles): gyűrű csak definiált nevezővel;
  bejegyzés-szinten a nyers gramm gyűrűként rossz műfaj → ezért lett a nevező az étkezés
  saját energia-aránya (v2), miután a napi-cél nevező (v1) vizuálisan üresnek bizonyult.
  Kis méretben: külön álló, egyforma stroke-ú gyűrűk, számmal — nem egymásba ágyazva.
- **Apple HIG popover-minta** (https://www.nutrient.io/blog/presenting-popovers-on-iphone-with-swiftui/):
  apró tartalom → kis horgonyzott doboz; bonyolultabb szerkesztés → sheet. Az idő-doboz
  view-only (owner-döntés), így a kis doboz a helyes műfaj; szerkesztés később sheetként
  jöhet, ha kell.
- Elvetve: swipe-to-reveal idő-szerkesztés (Cronometer) — PWA-ban a scroll-lal ütközik,
  nem felfedezhető.

## Codebase terrain (investigator)

- **Kártya:** `frontend/src/features/fuel/components/FuelMealBlocks.tsx` — `BlockCard`
  (:157), `WindowBar` (:84, marad), `BudgetRing` (:116, marad), `MACRO_STRIP`/`MacroStrip`
  (:40–61, ezt váltják a gyűrűk), `FuelScoreChip` (:134, lejjebb költözik).
  Fogyasztó: `FuelMaiPage.tsx:190`.
- **Adat:** `DoneMealRow` (`keretHero.ts:145–175`) — `time` = a meal `loggedAt`-je HH:mm-re
  vágva (`buildDayPlan.ts:355,397,441`); `proteinG/carbsG/fatG` megvan, **rost (fiberG) még
  nincs a sorban** — bővítendő a VM-lánc. Napi rost-cél forrása tervezési kérdés.
- **Tervezett idő done slotra:** a produkció EGY időt tárol slotonként (`FuelSlot.time`,
  done-nál = loggedAt) — a tervezett idő a terv-konfigurációból (slot label szerinti ablak)
  nyerhető vissza; a valódi `MealTiming` (windowFrom/To) csak scored meal breakdownban él.
  Ha nem elérhető → a "Terv szerint" sor elmarad.
- **Gyűrű-recept:** SVG `circle pathLength={100}` + `--ring-progress` (BudgetRing,
  `FuelQualityBlocks.tsx:76–102`); a kivezetett conic-gradient `MiniRing` NEM jön vissza.
  Számláló/belépő: `useFuelCountUp` (`FuelMacroRings.tsx:45`), egy-lövéses rAF, reduced-motion
  és jsdom alatt azonnali.
- **Overlay:** `GlassBox.tsx` (portál a `.phone-screen`-be, Escape/backdrop, NEM natív
  showModal) — élő fogyasztók: `FuelStackItemGlass.tsx`, `FuelWeekDayGlass.tsx`.
- **CSS:** minden új stílus a `prototype.css` meglévő `fuel-mai titanium` blokkjába,
  `fmx-` prefixszel (második blokk nem nyílik; `prototypeCssStructure.test.ts` őrzi).
- **Tesztek:** `FuelMealBlocks.test.tsx` — a :103/:117 gramm-csík és :138 ablak-csík pinek
  közül a gramm-csíkosak átírandók; `tests/layout/layout.spec.ts:56` (`.fmx-block`
  elérhetőség) változatlanul zöld kell legyen. FE tesztek CI-ben mindkét módban futnak.
- **Ikonok:** clay sprite (`clay-icons.svg`): `i-idozito` (óra gomb + doboz), rost-ikon
  jelöltje `i-noveny` — ha a sprite-ban van jobb (pl. dedikált rost), tervezéskor dől el.
- **Csapdák:** emojik tilosak; reduced-motion ág kötelező; CODEMAP-frissítés ha új fájl jön;
  `VITE_USE_MOCK` unset = mock kétszer; `pnpm test` fájl-szűrő nem szűkít.

## Tesztelés

- Komponens-tesztek (jsdom, mindkét mód): óra gomb csak logolt blokkon; doboz nyit/zár
  (Escape, backdrop, Rendben) és a helyes időt mutatja; gyűrű-arányok (P/Ch/Zs összege ~100%,
  rost = fiberG/napi cél); őszinte-null ("—", nincs ív; 0 g = üres ív "0 g"-vel); aria-címkék.
- Layout-gate: `.fmx-block` elérhetőség marad zöld.
- Vizuális ellenőrzés a `verify` skill mock-módú PWA-receptjével.

## Terjedelem

Egy szelet, egy PR: FuelMealBlocks + VM-bővítés (fiberG, napi rost-cél, tervezett idő) +
fmx CSS + tesztek. Backend/contract változás NEM várható (a rost és a tervek már a
kliens-oldali VM-láncban elérhetők kell legyenek — ha mégsem, az külön bd-t érdemel, nem
e szelet része).
