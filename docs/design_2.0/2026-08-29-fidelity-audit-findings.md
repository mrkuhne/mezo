# Design 2.0 — 1:1 hűség-audit, nyitó leletek (mezo-d20.11)

> Daniel 2026-08-29-én jelezte, hogy a leszállított felületek több ponton **nem 1:1-ek** a
> prototípusokkal, és hogy **sok oldalról hiányoznak az animációk** (felpörgő számok, töltődő
> sávok, animált progress-gyűrűk). Ez a fájl a kiinduló bizonyíték-lista: nem teljes, hanem
> az a néhány konkrét lelet, amiből az audit-kör indul. A módszer, amit érdemes követni:
> **a prototípus markupját és CSS-ét olvasd a kód mellé**, ne a képernyőt nézd — a pixel-
> összehasonlítás lassabb és kevésbé megbízható, mint a `src/<page>-body.html` ↔ `*.tsx` diff.

## Módszer

1. `docs/design_2.0/prototypes/src/<page>-body.html` — a csempe-markup és a hozzá tartozó CSS.
2. A megfelelő `frontend/src/features/**/pages/*.tsx`.
3. Minden eltérés három kategória egyike:
   - **hiba** — a prototípus mást mond, és nincs adat-indok → javítandó,
   - **indokolt** — a valós kontraktus mást enged (pl. nincs ilyen mező a wire-on) → maradhat,
     de a PR-ben nevesítve,
   - **hiányzó mozgás** — a statikus végállapot helyes, de a belépő koreográfia/animáció nincs meg.

## Nap hub (`nap-gerinc.html` `reggel` panel ↔ `NapHubPage.tsx`)

| # | Prototípus | Implementáció | Kategória |
|---|---|---|---|
| 1 | Mezo-csempe: `i-level` + **olvasatlan-számláló badge** (`3`) | `i-level` + egyszerű `dot` | hiba — a szám elveszik |
| 2 | Rutin-csempe: **per-szokás ikon** (`data-habicon`, itt `i-naplo`), alatta a szokás **neve** félkövéren, majd `3/4` + **helyben pipálható `htick` gomb** | fix `i-rend` ikon, egy sor `„50 fekvőtámasz · 3/8"`, nincs pipa | hiba ×3 — ikon, elrendezés, és elveszett egy **funkció** (helyben pipálás) |
| 3 | Küldetések-csempe: `s-hajtas` **spot** + küldetésenként egy **nagy pötty** (teljesített = kitöltve) + `+60 XP` | `i-lang` ikon + `„1/3 · +45 XP"` szöveg | hiba — rossz ikon, a pöttyök helyett szöveg (a „vizuálisan mutatott adat szövegben nem ismétlődik" szabály fordítottja) |
| 4 | Check-in: `i-checkin` + 4 pötty | ugyanaz | ✅ |
| 5 | Kreed-csempe: **nincs ikon** — az idézet 3 soros clamppel, alul `3 fókusz ›` | `i-naplo` ikon + idézet, nincs `3 fókusz ›` | hiba — fölösleges ikon, hiányzó több-jelölő |
| 6 | Hero: `hatékonyság 92% · cél ✓`; `Súly 84,2 kg ↘` és `Fókusz …` **egy sorban**, 9,5px | `minőség 9/10`; a `Súly 78,6 kg` **két sorba törik**, a Fókusz teljes mondatot ír | hiba — tördelés; a metrika-választás külön eldöntendő |

## Sport oldal (`edzes-tab.html` ↔ `SportPage.tsx`)

Daniel képe alapján (részletes diff még nem készült):
- a nap-sorokból hiányoznak a **típus-tagek** (`CROSS` · `RÖPI` · `TRX`) és a `MA` jelölő,
- hiányzik a **`nincs session`** szaggatott üres sor — a prototípus minden napot kirak,
- a `Logold ›` inline akció a mai napon nincs meg,
- a hero eltér: a prototípusban spot + `2/4`, a valós oldalon cím + `+ Log` gomb.

## Rendszerszintű gyanú: hiányzó mozgás

A `.rise` osztály **csak `EntranceGroup` (`.mz-play`) leszármazottjaként** animál — enélkül a
felület helyesen renderel, de néma. Ez a redesign egyik ismert, csendes hibaosztálya
(`_platform-design-system.md` §9). Az auditnak **oldalanként** ellenőriznie kell:

1. van-e `EntranceGroup` a panel körül (rise-stagger),
2. a hero-számok `useCountUp`-ot használnak-e,
3. a sávok/gyűrűk töltődnek-e (`stroke-dashoffset` / `--v` átmenet egy kerettel a mount után),
4. és hogy minden végtelen animáció `prefers-reduced-motion`-guarded-e.

## Amit az F8.2 doksi-kör talált (kód ↔ doksi olvasás közben)

Ezek **nem stílus-eltérések, hanem elveszett funkciók** — a redesign törölte a gazda-felületet,
és a viselkedés nem kapott új otthont. Mindet forrásban ellenőrizte a doksi-kör; a részletes
indoklás az adott feature-doc §9-ében van.

| # | Lelet | Hol | Súly |
|---|---|---|---|
| 1 | **`TitleShopSheet` + `StreakSheet` sehonnan nem nyílik** — az `AppHero` volt az egyetlen gazdájuk. A cím-vásárlás/-felvétel és a streak-védő megvehetetlen, pedig a `useGamificationActions` mindkét módban `canMutate`, az endpointok élnek. Az érme így **csak gyűlik, nincs hova elkölteni.** | growth.md §9 | magas |
| 2 | **Három sheet a `NapHubPage`-en soha nem tud kinyílni** (`MezoMessagesSheet`, `DailyQuestsSheet`, `CheckInSheet`): a state ott van, de a csempék route-ra mutatnak, és semmi nem állítja igazra a flageket. Halott kód, ami működőnek látszik. | today.md §9 | közepes |
| 3 | **`?day=rough` (a „nehéz nap" olvadás) nem renderel semmit** — az `AnchorIsland` törlődött, a hubnak nincs anchor-ága. Ez valódi regresszió a régi felülethez képest. | today.md §9 | magas |
| 4 | **`DecisionReviewSheet` gazdátlan** — a döntés-visszanézés így **nem tud szöveges kimenetet rögzíteni**, pedig a `DecisionReviewRequest.outcome`, az oszlop és az azt olvasó embedding-út mind él. | journal.md §9 | magas |
| 5 | **A `/mezo/*` oldalak közül csak a `PatternDetailPage`-en van visszalépés** — egyik sem rendel `PageHead`-et. | insights.md §9 | magas (UX) |
| 6 | A **wind-down fázisok**, a **lánc-teljesítés ünneplés** és a szokások **`linkUrl`** affordanciája is elvesztette a renderelőjét. | today.md, habit.md §9 | közepes |
| 7 | Az **Életjel küszöb-nudge-oknak nincs kézbesítési útja** (a `mezoMessages` `nudges` paraméterének nincs termelője a `needsNudges.ts` törlése óta). | today.md §9 | közepes |
| 8 | **Négy Fuel-testvér és négy Én-testvér a Mozaik-scaffold nélkül maradt** (`.pghead-np` fejléc vagy semmilyen fejléc) — a tabok két vizuális generációt kevernek. | fuel.md, me.md §9 | közepes |
| 9 | A **split-TDEE bontásnak nincs Én-oldali ajtaja** (`BiometricCard` volt az egyetlen), és az **Éjszakai módnak** nincs Nap-oldali belépője. | me.md §9 | közepes |
| 10 | Gazdátlan komponensek, amiket az F8 azért nem vitt el, mert még van tesztjük: `PrepHero`, `PrepExerciseCard`, `ChallengesCarousel`, `LastWeekStat`, `MotorStateHero`, `GrowthSummaryCard`, `MeBioRow`, `BiometricCard`, `AiUsageCard`, `logic/windowIslands.ts`, `sheets/MealPickerSheet.tsx`, `shared/ui/Island.tsx`. | több | alacsony |
| 11 | A vizuális baseline-ok neve még `today-*`, pedig a route `/nap`. | today.md §9 | alacsony |

**Az audit sorrendje ebből adódik:** előbb az 1., 3., 4., 5. (elveszett funkció / nincs kiút),
utána a csempe-szintű 1:1 eltérések, végül a hiányzó mozgás.

## Mozgás-leltár (mérve, 2026-08-29, mock mód, 390 px)

Módszer: minden route-ot betöltve megszámoltam a `.rise` elemeket, a `.mz-play` (EntranceGroup)
konténereket, és azt, hány `.rise` van **`.mz-play`-en kívül** (= néma, mert a koreográfiát a
szülő fegyverzi élesre). A statikus felét grep adja: melyik oldal importál `EntranceGroup`-ot,
illetve `useCountUp`-ot.

### A) Egyáltalán nincs belépő koreográfia (`play: 0`, `rise: 0`)

`/train/mai` · `/train/sport` · `/train/futas` · `/train/exercises` · `/train/templates` ·
`/fuel/stack` · `/fuel/recipes` · `/fuel/gyogyszer` · `/fuel/slots` · `/mezo/chat` ·
`/me/ertesitesek` · `/me/routines/edit` · `/me/goals/new` · `/me/week`

Ez 14 oldal — jórészt pont azok, amiket a doksi-kör is „nem kapott Mozaik-arcot" néven talált meg.

### B) `EntranceGroup` van, de nincs mit animálnia (`play: 1`, `rise: 0`)

`/train/week` · `/train/gym` · `/train/medals` · `/fuel/uzenetek` · `/me/growth` ·
`/me/knowledge`

A konténer ott van, a gyerekek nem kapták meg a `.rise` osztályt + a `--d` staggert. Olcsó javítás.

### C) Néma `.rise` — a csendes hibaosztály

`/fuel/kamra`: **3 `.rise` elem `EntranceGroup` nélkül.** Helyesen renderel, sosem animál, és
semmi nem bukik el tőle. Pontosan ez az a hiba, amit a design-system doksi §9 új gotchája leír.

### D) Count-up

`useCountUp`-ot **mindössze öt** felület használ: `PatternsPage`, `GoalsPage`, `EletjelPage`,
`NapHubPage`, `KeretHero`. A prototípusokban ennél jóval több nagy szám pörög fel — minden
hero-számnál ellenőrizendő (`data-kind="time"`/`cnt` osztály a prototípus markupban jelzi).

### E) Sáv- és gyűrű-töltés

A `KeretHero` `stroke-dashoffset`-es receptje (`:where()`-be csomagolva, hogy a reduced-motion
felülírás `!important` nélkül nyerjen) az egyetlen bizonyítottan animált gyűrű-töltés. A
mozaik-csempék sávjai (`.gtrack .fill`, `.mnt-bar`, a napi részpontszám-pálcikák) statikusan
renderelnek. A Heti-alapozás (`mezo-d20.6.10`) `.wk-trend`/`.wk-minibars` blokkja ugyanezt a
`transform: scaleY(0) → none` mintát hozza vissza — ez legyen a minta a többi sávhoz is.

### Megerősítés — a mérés nem skeleton-artefakt

Az A) csoportot 1,8 s várakozással újramértem: mindegyik oldalon `skeleton = 0`, tehát a tényleges
tartalom volt kirenderelve, és a koreográfia valóban hiányzik. **Két meglepetés**, amit érdemes
külön megnézni: az `ExercisesPage` és a `RecipesPage` **importál** `EntranceGroup`-ot, mégis nulla
`.mz-play` van a DOM-ban — vagy holt import, vagy egy olyan ágban van, ami sosem fut. Ez a fajta
„fél-bekötött" koreográfia rosszabb, mint a hiányzó, mert a kódot olvasva késznek látszik.

---

## Az audit eredménye (2026-08-29 este)

Öt tab, három PR ([#294](https://github.com/mrkuhne/mezo/pull/294) Nap+Edzés,
[#295](https://github.com/mrkuhne/mezo/pull/295) Fuel+Mezo, [#296](https://github.com/mrkuhne/mezo/pull/296) Én),
plusz ez a kereszt-metsző kör. A módszer bevált: **a prototípus forrását a kód mellé olvasva**
minden szelet talált olyat is, ami a képernyőn nem tűnt fel.

**Amit a mérés utólag igazolt:** a fenti A/B/C mozgás-csoportok mindegyike valós volt. A B) csoport
(„armed `EntranceGroup`, nulla `.rise`") a legalattomosabb: a kód olvasva késznek látszik.

**Amit a képernyő nem mutatott meg, csak a kód:**
- a `--error-deep` sötét témában `#F7B3AE`, azaz **piros** — és a minta-döntés sor ezt használta
  az „Elvetem" gombon, szemben a „sosem piros" guardraillel;
- hét `/mezo/*` oldalról **teljesen hiányzott a kiút** (nincs `PageHead`), mert a feloldott
  `InsightsScreen` shell hordozta korábban;
- az érme-gazdaság **nyelő nélkül** maradt (`TitleShopSheet`/`StreakSheet` gazdátlan), a
  döntés-visszanézés pedig **nem tudott szöveges kimenetet rögzíteni**, pedig a mező, az oszlop és
  az azt olvasó embedding-út is él.

**Amit szándékosan NEM javítottunk, és miért:** a Sport `+XP e héten` és a Futás
`RPE sprint cél 8–9` cellája a prototípusban kitalált érték (`logged × 30`, illetve konstans) —
ezeket eldobtuk, nem lemásoltuk. A Fuel Napló-csempe trend-nyila és a heti Napló-oldal
adatforrás nélkül maradt (F3.6/F6.2). A chat-oldalnak és az Adat-egészség gyűrűknek **a
prototípusban sincs** belépő animációja — a „hiányzó mozgás" listáról ezek lekerültek.

**Ami a következő körre marad** (`mezo-d20.11.1`): a `PageHero` ikonmérete oldalanként eltér a
prototípusokban (48–92 px, a 72 és az 54 holtversenyben) — nincs egyetlen hű alapérték, ezért
`iconSize` propot kapott, és az oldalankénti beállítás az F7-es körökre marad. A mini conic
gyűrűk töltésére **nem** vezettünk be `@property --v`-t: a `useCountUp`-pal hajtott `--v` már
bevált recept (WeekScoreRing, Fuel swimlane), és két párhuzamos mechanizmus rosszabb, mint egy.
