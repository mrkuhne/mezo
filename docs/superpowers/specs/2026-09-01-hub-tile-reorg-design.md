# Hub-csempe átszervezés: Mezo ↔ Én + Beállítások oldal — design

**Dátum:** 2026-09-01 · **Státusz:** jóváhagyott design
**Hatókör:** tiszta frontend (routing + hub-kompozíció); backend/contract nem érintett.

## Probléma

A Mezo hub és az Én hub csempéi összekeveredtek: AI-hoz kötődő csempék (Heti,
Tudás, Karakter) az Én hub-on ülnek, az Értesítés és az AI-napló pedig
top-level csempeként foglal helyet, miközben valójában ritkán használt
beállítás-jellegű felületek. A Beállítások ma csak egy sáv, ami egy
téma-választó sheetet nyit.

## Vezérelv (a felhasználóval rögzítve)

**Mezo = minden, ami az AI-hoz kötődik. Én = személyes adatok, emberek,
beállítások.** Új csempék elhelyezésekor is ez dönt.

## Végállapot

### Mezo hub (`MezoHubPage`)

- 6 kis csempe változatlan párosítással: Minták · Heti · Memoár · Tudástár ·
  Előrejelzések · Kísérletek
- **Karakter** — ÚJ, teljes szélességű csempe (a Diagnózis mintájára), célja a
  meglévő `/me/karakter` oldal. Precedens a cross-hub célra: a Mezo Heti
  csempéje is `/me/week`-re mutat.
- Diagnózis (széles) és a Memória-sáv változatlan.

### Én hub (`EnHubPage`)

- Marad: Súly · Alvás · Growth · Napló · Emberek
- **Beállítások** — ÚJ csempe (a mostani teljes szélességű Beállítások-sáv
  megszűnik), célja az új `/me/beallitasok` oldal. Élő alsó sora a témát
  mutatja (pl. `téma: Világos`).
- Lekerül: Heti (a Mezón már megvan), Tudás, Karakter, Értesítés, AI-napló.
- Végeredmény: 6 csempe, 3×2-es rács.

### Új Beállítások oldal (`/me/beallitasok`, `BeallitasokPage.tsx`)

Csoportosított lista (Android settings-guideline minta):

1. **Téma** — a választó helyben, az oldalon. A `SettingsSheet` megszűnik,
   `useTheme`-es tartalma ide olvad be.
2. **Értesítések** sor → meglévő kapcsoló-oldal (`/me/ertesitesek/beallitasok`).
3. **AI-napló** sor → meglévő `/me/ai-usage` oldal.

Az értesítési *hírfolyam* (`/me/ertesitesek`) továbbra is a fejléc
csengő-dropdownjából érhető el (`AppHeader.tsx`) — az az ajtó nem sérül.

### Tudás-gráf elérése

A Tudás csempe nem költözik, hanem megszűnik. A Tudástár oldal
(`KnowledgeListPage`, `/mezo/knowledge`) kap egy belépési pontot
(„Kapcsolatok · élő mindmap" jellegű sor/gomb) a gráf-oldalra
(`KnowledgePage`, `/me/knowledge`). A meglévő Tudástár-boundary (mezo-0ap9)
érintetlen: a tények a Tudástáré, a gráf-oldal csak a kapcsolatokat birtokolja.

### Vissza-chipek

- `KnowledgePage` „‹ Én" → **„‹ Tudástár"** (`/mezo/knowledge`)
- `KarakterHubPage` „‹ Én" → **„‹ Mezo"** (`/mezo`)

## Döntések és indoklásuk

| Döntés | Indok |
|---|---|
| AI-napló + Értesítés a Beállítások alá | A felhasználó ritkán nézi őket (HIG frekvencia-teszt); nem lesznek új kacatfiók-lakók. |
| Egy tudás-csempe, gráf a Tudástárból | Két hasonló nevű csempe zavaró lenne; a boundary megmarad. |
| Karakter széles csempe a Mezón | 7. kis cella megbontaná a 2 oszlopos párosítást; a széles forma precedense a Diagnózis. |
| Beállítások = csoportosított lista, nem mini-mozaik | Platform-konvenció beállításokhoz; a téma-sheet extra rétege megszűnik. |
| Oldalak nem költöznek, csak csempék | „Stable full-page siblings" repo-minta; nincs route-törlés, nincs redirect. |

## Technikai terv

- A csempék hardcode-olt JSX-ek; minden csempe élő alsó sora saját hookból
  jön. A Karakter átvitelekor a `useCharacterOverview` hívás + a sor-derivált
  átköltözik `EnHubPage.tsx` → `MezoHubPage.tsx`. Az Én hub-ról a
  `useMeWeek`/`useKnowledge`/`useNotificationPrefs`/`useLlmUsageSummary`
  csempesor-deriváltak kikerülnek (figyelve: másra is használja-e őket az oldal).
- Honest-states kontraktus marad: a csempesor `undefined`-re tűnik el, ha a
  forrás nem elérhető — kitalált szám sehol.
- Új route a `router.tsx` `me/*` blokkjába: `me/beallitasok`. Route-törlés
  nincs.
- CSS: `styles/prototype.css` `enh-*`/`mzh-*` tokenszerkezetét követjük; a
  CSS-struktúra tesztek (`prototypeCssStructure.test.ts`,
  `mozaikCssTokens.test.ts`) figyelnek rá.
- A Beállítások oldalnak nincs design_2.0 prototípusa — a meglévő Mozaik
  oldal-primitívekből (`MozaikPage`, `PageHead`, `PageHero`, `PageBody`)
  épül, a többi `/me` oldal mintájára.

## Tesztek

- `EnHubPage.test.tsx`: „ten tiles" → hat csempe; Beállítások-sáv asserts →
  Beállítások csempe navigáció; törölt csempék assertjei ki.
- `MezoHubPage.test.tsx`: csempeszám + Karakter széles csempe + navigáció;
  a real-módú (MSW) describe blokk frissítése.
- `navigation.test.tsx`: Én hub → Karakter link átírása Mezo hub → Karakter-ra.
- Új: `BeallitasokPage` teszt (téma-váltás, Értesítések/AI-napló sor navigáció).
- `notificationRoutes.test.tsx`, `hubHeaders.test.tsx`: ellenőrzés, szükség
  szerint frissítés.
- Mindkét mód fut (mock + `VITE_USE_MOCK=false` MSW) — a bare `pnpm test`
  mock-ot futtat kétszer, a real-módot explicit kell kérni.

## Docs-kötelezettség (ugyanabban a change-ben)

- `docs/features/me.md` §2 (a „nine-tile mosaic" amúgy is driftes — most 10,
  a change után 6) + SettingsSheet → BeallitasokPage.
- `docs/features/insights.md` (Mezo hub csempéi), `docs/features/character.md`
  (belépési pont), ADR 0032 érintettségének átvezetése.
- `node scripts/gen-codemap.mjs` — új oldalfájl születik, a CI `--check`-kel
  őrzi.

## Prior art

- **Strava 2024 nav-redesign („You" fül)**: a profil-fül szigorúan a saját
  adatoké, a domain-funkciók saját hubot kapnak — átvéve mint a Mezo/Én
  határvonal modellje. ([Cycling Weekly](https://www.cyclingweekly.com/news/product-news/a-new-look-for-strava-app-with-updates-to-the-navigation-bar-498270), [BikeRadar](https://www.bikeradar.com/news/strava-beta-test-layout))
- **NN/g hub-and-spoke + junk-drawer**: hubonként egy koherens szándék; a
  kevés-de-kiszámítható csempe jobb, mint a felpárnázott rács — átvéve (az Én
  hub 6 csempére zsugorodása nem hiba, hanem cél). ([Mobile navigation patterns](https://www.nngroup.com/articles/mobile-navigation-patterns/), [Top-10 mistakes](https://www.nngroup.com/articles/top-10-application-design-mistakes/))
- **Apple HIG Settings frekvencia-teszt**: ami ritkán változik, másodlagos
  képernyőre való — ez döntötte el az Értesítés + AI-napló sorsát (a
  felhasználó megerősítette, hogy az AI-naplót ritkán nézi). ([HIG Settings](https://codershigh.github.io/guidelines/ios/human-interface-guidelines/interaction/settings/index.html))
- **Android settings guidelines**: csoportosított lista, gyakran használt
  elemek felül, sub-screen csak ~10+ elem felett — átvéve a Beállítások oldal
  szerkezetéhez; a mini-mozaik formát elvetettük. ([Android settings](https://source.android.com/docs/core/settings/settings-guidelines))

## Codebase terrain

- **Érintett feature-blokkok:** `me` (Én hub, Beállítások, Értesítés/AI-napló
  oldalak), `insights` (Mezo hub, Tudástár), `character` (Karakter oldal),
  `notification` (adatréteg). Backend nem érintett.
- **Kulcsfájlok:** `frontend/src/features/me/pages/EnHubPage.tsx` (mozaik:
  ~264–285, sáv: ~287–296, hook-deriváltak: ~146–218),
  `frontend/src/features/insights/pages/MezoHubPage.tsx` (mozaik: ~190–210),
  `frontend/src/features/me/sheets/SettingsSheet.tsx`,
  `frontend/src/features/insights/pages/KnowledgeListPage.tsx`,
  `frontend/src/features/me/pages/KnowledgePage.tsx`,
  `frontend/src/app/router.tsx` (me/* blokk), `frontend/src/app/AppHeader.tsx`
  (csengő-dropdown → `/me/ertesitesek`),
  `frontend/src/shared/ui/mozaik/index.tsx` (Tile/Mosaic primitívek).
- **Követendő minták:** hardcode-olt csempe-JSX + hook-per-csempe élő sor;
  honest states; cross-hub csempe normális (Heti precedens); Hungarian copy,
  nincs i18n-keret — a tesztek a magyar stringeket assertálják.
- **Csapdák:** két teszt-mód gate; csempeszám-assertök törnek először;
  CSS-struktúra tesztek; CODEMAP-frissesség gate; a fejléc-dropdown mélylinkje
  nem árvulhat el; a két Tudás-oldal szándékosan külön entitás.
