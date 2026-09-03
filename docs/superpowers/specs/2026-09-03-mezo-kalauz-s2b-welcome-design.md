# Mezo-kalauz S2b — T0 első indítás (`KalauzWelcome`)

> Driving bd issue: `mezo-gb1s.4` (az `mezo-gb1s` epic alatt). Brainstorm: 2026-09-03, Claude Code.
> Szülő-spec: [`2026-09-02-mezo-kalauz-tutorial-design.md`](2026-09-02-mezo-kalauz-tutorial-design.md)
> Testvér-spec: [`2026-09-02-mezo-kalauz-s2-hubok-design.md`](2026-09-02-mezo-kalauz-s2-hubok-design.md) (S2a, merge-ölve)
> Feature-doc: [`docs/features/tutorial.md`](../../features/tutorial.md)

## 1. Mi ez a szelet

A T0 „első indítás": egy teljes képernyős, lapozós onboarding, ami a **legelső `/nap`
betöltéskor** jelenik meg, ha a user még nem látta. Nem route, hanem a `TutorialProvider`
egy állapota. **Frontend-only** — a `tutorial_progress` jsonb map kulcs-agnosztikus, a
`welcome` csak egy újabb kulcs benne.

A szelet bevállalja a nyitott `mezo-gb1s.2` `resetAll()` bugot és a hiányzó UI-belépési
pontját is: enélkül a welcome **egyszer** fut le, és sem a fejlesztő, sem a béta-tesztelő
nem tudja újranézni — a szelet saját kézi ellenőrzése lenne lehetetlen.

## 2. Döntések

| # | Döntés | Indok |
|---|---|---|
| S2b-1 | **Hat lépés helyett négy**: napszak · öt hely · logolás · „?" | a köszönés tisztán leíró (beolvad az 1. lépés címébe), a fejléc-lépés standard mintát magyaráz (§7 prior art) |
| S2b-2 | **Minden megmaradó lépés koppintható vagy valóban új** | Apple HIG „teach through interactivity"; Andersen: tutorial ott térül meg, ahol van felfedezhetetlen mechanika |
| S2b-3 | **A napszak-lépés a három arcot mutatja, nem definíciót mond** | a fogalom-doboz a hub-kalauzoké (S2a); nulla adat mellett a terminus-bevezetés a gyenge forma (NN/G empty states) |
| S2b-4 | **A logolás-lépés a VALÓDI `QuickInputSheet` anatómiáját mutatja** | a prototípus „fotó / mondat / hang / koppintás" létrája nem létezik a `+` gomb mögött (§8 drift) |
| S2b-5 | **A welcome a `KALAUZ_REGISTRY`-n KÍVÜL él**, saját lépés-unióval | a registrybe rakva három dolog törik: art-lint, `findKalauz` first-match árnyékolás, `KalauzCard` unió (§8) |
| S2b-6 | **Nincs láncolás**: a welcome után a `/nap` kalauz a KÖVETKEZŐ látogatáskor nyílik | NN/G onboarding-taxonómia explicit ellenzi a második, még nem actionable falat; és ez a route-effekt alapviselkedése — nem kell építeni |
| S2b-7 | **`z-index: 60`**, a `.logflow-page` sávja | a legközelebbi testvér-minta a kódban; letakarja a tab-bart (40) és a fake státuszsávot (50), a sheetek (200) és a LevelUp (250) alatt |
| S2b-8 | **Lépésváltáskor a fókusz az új lépés címére ugrik** | APG: enélkül a „Tovább" képernyőolvasóval némán nem csinál semmit |
| S2b-9 | **A `mezo-gb1s.2` fix + a „Kalauzok újranézése" Beállítások sor ide tartozik** | enélkül a welcome nem ellenőrizhető kézzel és nem béta-tesztelhető |
| S2b-10 | **A `§13.1` napszak-váltó kérdése NEM dől el itt** | a fejléc-lépés kiesett, tehát nem blokkol; marad az S3-ra |

## 3. A négy lépés

| # | Lépés | Miért marad | Interakció |
|---|---|---|---|
| 1 | **Egy nap, három szakasz** | Az app egyetlen mechanikája, amit egy ülésben *lehetetlen* felfedezni: a `/nap` reggel/nap/este szerint átrendezi magát. Mezo bemutatkozása ide olvad egy sorként, az orb art-tal. | Három clay-spot (`s-reggel`/`s-nap`/`s-este`); koppintás váltja a leírást. |
| 2 | **Öt hely** | Standard minta, de gyakoroltatva (HIG). | Demó-tabbar a **valódi** ikonokkal (`i-nap`, `i-edzes`, `i-fuel`, `i-mezo`, `i-emberek`); koppintás fület vált + egy mondat/fül. **Nem navigál.** |
| 3 | **Logolás** | Az elsődleges akció. | A `+` gomb; koppintásra a valódi `QuickInputSheet` anatómiája kicsiben: csempe-rács + a „Mondd el Mezónak" sor. |
| 4 | **Ha elakadsz** | Záró képernyő, a legrövidebb. | A fejléc `?` pulzál (reduced-motion alatt statikus). CTA: `Induljunk`. |

**Láb minden lépésen:** `Kihagyom` (link) · `‹ Vissza` (az 1. lépésen tiltva) ·
`Tovább` / az utolsón `Induljunk`.

**Ami kiesett a prototípusból:** az 1. („Szia, Mezo vagyok" — beolvad) és az 5. (fejléc-demó).
Az 5. kiesésének jó mellékhatása, hogy a `§13.1` nyitott kérdés (napszak-váltó minden
route-on vs. Nap-only) nem blokkolja ezt a szeletet.

### Skip-szemantika

`Kihagyom` → `dismissedAtStep`, és a welcome **nem** jön vissza. Andersen szerint a
kihagyhatóság önmagában nem változtat a viselkedésen, de a11y- és udvariassági okból
kötelező; a valódi beavatkozás a hossz csökkentése (S2b-1).

### A11y-szerződés

A [WAI-ARIA APG dialog-mintából](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) —
ez a szülő-specben eddig nem szerepelt:

- `role="dialog"` + `aria-modal="true"`, `aria-labelledby` az aktuális lépés címére.
- Mountkor a fókusz **a lépés címére** megy (`tabindex="-1"`), nem a CTA-ra: tartalom-nehéz
  dialógusnál ez az APG explicit ajánlása, különben a képernyőolvasós user átugorja a szöveget.
- **Lépésváltáskor a fókusz újra a friss lépés címére ugrik.**
- Fókuszcsapda (Tab / Shift+Tab), `Escape` = `Kihagyom`, unmountkor fókusz-visszaadás.
- `prefers-reduced-motion` alatt a lapátmenet cross-fade/azonnali, az orb nem loopol
  ([WCAG 2.2 SC 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)).

## 4. Architektúra

### 4.1 Adat — a registryn kívül

```
features/tutorial/registry/welcome.ts        ÚJ
  WELCOME_ID = 'welcome'
  WELCOME_VERSION = 1
  type WelcomeStep = { kind: 'napszak' | 'tabbar' | 'log' | 'sugo'; title; voice; … }
  export const WELCOME: { id, version, steps: WelcomeStep[] }
```

Saját lépés-unió, mert a demó-lépések egyik `KalauzCard`-típusba sem férnek bele. A
seen-kulcs `'welcome'`, **ugyanabban a jsonb map-ben** — nincs backend-, contract- vagy
migráció-változás.

`isUnseen('welcome')` ma `false`-t adna, mert `getKalauz` `null`-t ad
(`TutorialProvider.tsx:113-117`). Ezért egy `versionOf(id)` helper: a registry-találat
verziója, vagy `WELCOME_VERSION`, ha `id === 'welcome'`. A `findKalauz` **érintetlen** — a
fejléc `?` és a sheet-út soha nem látja a welcome-ot.

### 4.2 A Provider-varrat

Új state a `openId` mellett: `welcomeStatus: 'pending' | 'done'` (szinkronban a
`readLocalProgress()`-ből seedelve, lokális-először) és `welcomeOpen`, mindkettőhöz
ref-tükör a `TutorialProvider.tsx:55-64` doktrína szerint.

A kényes rész az **időzítés**. A `/nap` auto-open már mountkor ütemezve van 600 ms-ra
(`:208-213`); ha a welcome megvárná a szervert (`!isPending`) és a válasz később ér be, a
`/nap` sheet nyílna ki előbb, és a welcome ráülne. Ezért:

```ts
const shouldWelcome = welcomeStatus === 'pending' && pathname === '/nap'
```

- **A `:206` guard bővül:** `if (openIdRef.current !== null || shouldWelcomeRef.current) return`.
  A `/nap` timere el sem indul, amíg a welcome függőben van. A guard kommentje
  (`:203-205`) **név szerint ezt a használatot nevezi meg** — nem új mechanizmus, hanem a
  betervezett bővítés.
- A `shouldWelcome` **route-hoz kötött**: más oldalon egy függő welcome nem nyomja el az
  ottani kalauzt.
- Külön effekt: `shouldWelcome && !isPending` → megnyit, **és azonnal `persist`-eli** a
  `welcome` bejegyzést („látva = megjelent", `:126-131`). Ezzel a `welcomeStatus` `'done'`.
- **Új eszköz** (üres localStorage, szerver szerint látott): a merge `'done'`-ra állítja
  anélkül, hogy felvillanna. A fordított irány (lokálisan látott, szerveren nem) lokális-
  győzelem — nem villan újra.
- **Nincs láncolás** (S2b-6): a route-effekt ugyanarra a pathname-re nem fut újra, tehát a
  `/nap` kalauz a következő látogatáskor nyílik. Ez a meglévő viselkedés, nem új kód.

Renderelés a `LevelUpProvider.tsx:20-25` mintája szerint, a `KalauzSheet` testvéreként
(`TutorialProvider.tsx:226`). A welcome **nem navigál**, tehát a `navPendingCloseRef`
komplexitás nem érinti.

### 4.3 `KalauzWelcome.tsx`

`shared/ui/kalauz/KalauzWelcome.tsx`, domain-mentesen: props `{ steps, onDone, onSkip }`,
semmi `@/data` és `@/features` import — a `KalauzSheet.tsx:19-25` technikája (helyben
újradeklarált unió, hogy a `shared/ui` ne függjön a registry típusaitól).

Full-screen recept a `LevelUpScreen.tsx`-ből, pontról pontra:

- `:52` lusta, egyszeri portál-target: `document.querySelector('.phone-screen') ?? document.body`
  (jsdom-biztos fallback),
- `:74-95` fókusz-blokk: `document.activeElement` mentése mountkor, `keydown` listener
  (`Escape` → zár, `Tab` → csapda), fókusz-visszaadás cleanupban,
- `:131-138` root `role="dialog" aria-modal="true"`, `:262` `createPortal`,
- `useReducedMotion()` (`shared/hooks/useReducedMotion.ts:10`) — reduced alatt a végállapot
  renderelődik animáció nélkül.

A `LogFlowPage.tsx` portálját **nem** másoljuk: ugyanaz a full-screen minta, de nincs benne
fókusz-kezelés.

### 4.4 CSS

Új `.welcome` / `.wl-*` blokk a `prototype.css`-ben, **egy összefüggő blokkban a kalauz-blokk
mellé** (`~:4515`) — a fájl merge-törékeny. `z-index: 60`.

## 5. Lint

A `WELCOME` lépései **ugyanazon a hang-linten** mennek át, mint a kártyák: tiltott tő
`/\b(kell|muszáj|hib[aá]|elbuk|rossz)/i`, `voice` ≤ 2 mondat. Ehhez a `registry.test.ts`
lint-helpereit ki kell emelni, hogy két adathalmazra futhassanak.

Az art-lint (`spot !== orb ?? 's-orb'`) **nem** vonatkozik a welcome-ra: a lépések art-ja nem
`spot`/`orb` pár. (Ez az egyik oka az S2b-5 döntésnek — a prototípus 1. lépése sima orb, ami
a registrybe rakva elbukna ezen a linten.)

## 6. Teszt-fertőzés — ugyanabban a commitban

- `src/test/kalauz.ts` `buildAllSeenProgress()` (`:18-24`) a `KALAUZ_REGISTRY`-ből generál,
  tehát a welcome-ot **nem** fedné. Explicit hozzáadás. A helper **Node-safe marad** (a
  Playwright `visual.spec.ts:2` importálja).
- **`features/today/pages/NapKuldetesekPage.test.tsx:138`** — teljes routert mountol
  `/nap`-on, seed nélkül. Ma zöld, a welcome-mal **biztosan elbukik**. `seedAllKalauzSeen()`
  bekerül.
- `tests/visual/visual.spec.ts` — csak az első `describe` seedeli a kalauz-állapotot
  (`:99-106`); a `:124/:155/:177/:192/:205/:218` blokkok csak témát. Végig kell nézni, melyik
  megy `/nap`-ra, és seedelni.
- A már seedelt nyolc shell-teszt (`app/{navigation,notificationRoutes,hubHeaders,AppHeader}`,
  `train/{nav,emptyStates}`, `insights/nav`, `tutorial/registry/anchors`) a bővített helperrel
  automatikusan fedve lesz.
- Új tesztek: `KalauzWelcome.test.tsx` (lépés-navigáció, fókusz a címre lépésváltáskor,
  Escape = skip, reduced-motion), `TutorialProvider.test.tsx` bővítés (welcome elnyomja a
  `/nap` auto-opent; nincs láncolás; új eszközön nem villan), `welcome.test.ts` (hang-lint).

## 7. `mezo-gb1s.2` — a `resetAll()` fix

A bug: a `resetAll` `.catch(() => undefined)`-del nyeli a DELETE-hibát
(`TutorialProvider.tsx:158-163`), a lokális kiürül, aztán a szerver-merge effekt (`:87-103`)
a szerver **régi** állapotát visszahozza — a reset látszólag sikerül, majd némán visszafordul.

Fix:

1. a DELETE hibája felszínre kerül (nem nyeli el a `catch`),
2. a GET invalidálódik / cancel a DELETE körül, hogy egy repülő válasz ne írja vissza,
3. a reset **zárja a nyitott sheetet**, törli a timert és az `autoShown` guardot
   (különben a reset után az aktuális oldal kalauza nem nyílik újra),
4. `welcomeStatus` visszaáll `'pending'`-re. A reset a Beállításokból indul, tehát a
   `shouldWelcome` ott `false` — a welcome a **következő `/nap` belépéskor** jelenik meg,
   nem a Beállítások fölött.

Plusz a hiányzó belépési pont: **„Kalauzok újranézése" sor a `BeallitasokPage`-en**, a
meglévő `row(...)` mintával (`BeallitasokPage.tsx:43-54`). Ettől lesz a welcome kézzel
ellenőrizhető és béta-tesztelhető — és a feature-doc §4/§6 állítása (ami MA is úgy írja le
ezt a sort, mintha létezne) igazzá válik.

## 8. Prior art

Forrás: researcher recon (5 forrás) + az S2a specben már rögzített két NN/G forrás.

- **Adoptálva — Andersen et al., CHI 2012** (45 000+ játékos, élő A/B, nyolc tutorial-variáns
  három játékban). A valódi tengely nem „tutorial vs. semmi", hanem **„előre betolt vs.
  kontextusban kiváltott"** — a kontextuális győz, és tutorial csak a **legkomplexebb**
  játékban hozott mérhető hasznot (+29% játékidő), ahol volt felfedezhetetlen mechanika. A
  „szabadság" (kihagyhatóság) önmagában nem változtatott a viselkedésen. → Ez az S2b-1
  (rövidítés), az S2b-3 (a napszak marad, mert *ez* a felfedezhetetlen mechanika) és a
  skip-szemantika indoka. https://grail.cs.washington.edu/projects/game-abtesting/chi2012/chi2012.pdf
- **Adoptálva — Apple HIG, Onboarding.** Az onboarding a launch *után* jön, opcionális, és
  instrukció helyett interaktivitás: az ember jobban megjegyzi, amit el is végezhet. → S2b-2.
  https://developer.apple.com/design/human-interface-guidelines/onboarding
- **Adoptálva — WAI-ARIA APG, Dialog (Modal).** Tartalom-nehéz dialógusnál a fókusz egy
  `tabindex="-1"` statikus elemre (a címre) menjen, ne az első interaktív elemre. → S2b-8 és
  a §3 a11y-szerződés. https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- **Adoptálva — WCAG 2.2 SC 2.3.3.** Az interakció kiváltotta mozgás legyen letiltható;
  `prefers-reduced-motion`. → a lapátmenet cross-fade reduced alatt.
  https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
- **Részben adoptálva — NN/G, Designing Empty States.** „Egy üres állapot = egy akció", és
  ne vezess be termék-specifikus terminust, amit a user még nem érthet. Ebből **adoptálva**
  az, hogy a logolás-lépés egyetlen dolgot mutat (S2b-4), és hogy a fogalom-doboz nem a
  welcome-ba való (S2b-3). **Elvetve** viszont a researcher ebből levezetett javaslata, hogy a
  napszak-lépés teljesen essen ki: a napszakosság nem „terminus", hanem az oldal viselkedése,
  amit egy ülésben nem lehet felfedezni — az Andersen-kritérium pont ezt tartja
  megtérülőnek. A feloldás: a lépés a **három arcot mutatja**, nem a szót definiálja.
  https://www.nngroup.com/articles/empty-state-interface-design/
- **Elvetve — a researcher javaslata a „?" lépés kihagyására.** Az on-demand help hatása
  Andersennél vegyes, NN/G-nél gyenge; de a mi `?` gombunk nem standard minta, hanem a kalauz-
  rendszer egyetlen visszatérési pontja, és a záró képernyőt amúgy is meg kell rajzolni. A
  kompromisszum: ez a **legrövidebb** lépés, egyben a `Induljunk` CTA hordozója.
- **Már rögzítve az S2a specben** (§6): [NN/G mobile tutorials](https://www.nngroup.com/articles/mobile-tutorials/)
  70 fős mérése és az [NN/G onboarding-taxonómia](https://www.nngroup.com/articles/mobile-app-onboarding/).
  Ez utóbbi a S2b-6 (nincs láncolás) forrása.

Evidencia-minőségi megjegyzés: az onboarding-SaaS gyártók („+50% aktiváció") önpublikált,
módszertan nélküli számai szándékosan kihagyva.

## 9. Codebase terrain

Forrás: investigator recon (CODEMAP-first).

**Érintett feature-blokkok:** `tutorial` (FE-only), és határosan `today` (`/nap` a trigger-route),
`progression` (a full-screen recept), `me` (Beállítások sor), `_platform-design-system`
(z-létra, Clay sprite-ok).

**Kulcsfájlok:**

- `frontend/src/features/tutorial/TutorialProvider.tsx` — `:21` `AUTO_DELAY_MS`, `:50-53`
  state, `:55-84` ref-tükör doktrína, `:87-103` szerver-merge, `:107-111` `persist`,
  `:113-117` `isUnseen`, `:120-132` `open` („látva = megjelent"), `:134-150` `close`,
  `:158-163` `resetAll`, `:177-215` route-effekt, `:206` a guard, `:226-236` render.
- `frontend/src/features/tutorial/registry/index.ts:12-17` — `KALAUZ_REGISTRY` (a `nap` az
  első) + `findKalauz` **first-match**.
- `frontend/src/features/tutorial/registry/registry.test.ts` — `:27-35` route/id kapu,
  `:37-48` hang-lint, `:52-57` art-lint, `:59-72` szótár-lint, `:74-81` chip-route lint.
- `frontend/src/features/progression/LevelUpScreen.tsx:52,74-95,131-138,262` — a full-screen
  recept; `LevelUpProvider.tsx:20-25` — a provider-owns-state minta.
- `frontend/src/shared/ui/kalauz/KalauzSheet.tsx:19-33` — a domain-mentes prop/unió technika.
- `frontend/src/app/TabBar.tsx:11-17` — az öt fül valódi ikonjai.
- `frontend/src/features/quickinput/sheets/QuickInputSheet.tsx:104-178` — a valódi logolás-anatómia.
- `frontend/src/features/me/pages/BeallitasokPage.tsx:43-54,90-91` — a `row(...)` minta.
- `frontend/src/styles/prototype.css` — `.tab-bar` `:904` (40), `.status-bar` `:850` (50),
  `.logflow-page` `:6879` (60), `.sheet-backdrop` `:1236` (200), `.kalauz-spot` `:4519` (200),
  `.levelup` `:1690` (250), toast `:1327`/`:1437` (300).

**Követendő minták:** provider-owns-state / screen-is-dumb; ref-tükör `exhaustive-deps`-disable
helyett; „látva = megjelent"; lokális-először írás + háttér-PUT + kliens-oldali merge;
verzió-bump re-armol, id-t sosem nevezünk át; honest state (a gomb nem renderel, ha nincs mit).

**Csapdák:**

- A `:206` guard **csak `openId`-t néz** — külön welcome-state nem nyomná el a `/nap`
  auto-opent bővítés nélkül (§4.2).
- A route-effekt **ugyanarra a pathname-re nem fut újra** — ez adja ingyen az S2b-6-ot, de
  azt is jelenti, hogy „welcome → majd a `/nap` kalauz egy látogatáson belül" csak explicit
  `open('nap')` hívással menne. Nem kérjük.
- `findKalauz` first-match + a `nap` az első a tömbben → egy `/nap` route-ú welcome-bejegyzés
  **némán** árnyékolna. Nincs duplikátum-lint. (Az átfedés-lint az S3 előfeltétele, külön
  issue — nem ez a szelet.)
- Az art-lint megharapná a sima orb art-ú welcome-lépést.
- `buildAllSeenProgress()`-t a Playwright is importálja → **Node-safe** kell maradjon.
- `NapKuldetesekPage.test.tsx:138` seedeletlen teljes router `/nap`-on.
- `prototype.css` merge-törékeny; a `--mz-*` tokenek két `:root` blokkban élnek.
- **Nincs FE architektúra-linter** (nincs eslint boundary config) — a `shared/ui` domain-
  mentesség konvenció + review, egy elszórt `@/data` import átmenne a CI-n.
- CODEMAP freshness-kapu: `node scripts/gen-codemap.mjs --check`.
- `VITE_USE_MOCK` beállítatlanul mock-mód — a real-módú kaput explicit kell futtatni.

**Prototípus vs. valóság drift** (az investigator négy pontot talált; mind érinti a copy-t):

| Prototípus | Valóság | Kezelés |
|---|---|---|
| Én-fül ikon `i-polc` (`kalauz.html:1188`) | `i-emberek` (`TabBar.tsx:16`) | a kód a mérvadó |
| „fotó / mondat / hang / koppintás" a `+` mögött | a `+` csak a `QuickInputSheet` csempe-rácsát nyitja | S2b-4 |
| napszak-váltó „csak a Nap oldalon" (`:1225`) | feltétel nélkül renderel (`AppHeader.tsx:98`) | a lépés kiesett; §13.1 marad S3-ra |
| welcome z 12, a státuszsáv (z 15) alatt | `.status-bar` z 50 | S2b-7: z 60, letakarja — a `.logflow-page` már így viselkedik |

**Elavult doc-állítások** (az investigator öt darabot talált):

- `docs/features/tutorial.md` §4/§6 — a „Kalauzok újranézése" Beállítások sor úgy szerepel,
  mintha létezne. **Ez a szelet igazzá teszi** (§7).
- `docs/features/tutorial.md` §8 — a fejléc-tesztek `writeLocalProgress()`-t seedelnek; ma
  `seedAllKalauzSeen()`. **Itt javítjuk.**
- `docs/features/tutorial.md` §8 — a vizuális goldenek „seedelik a `mezo.kalauz.v1`-et";
  igaz, de csak az első `describe` blokkra. **Itt javítjuk.**
- Szülő-spec §5 `mezo.kalauz.<userId>` vs. a shippelt `mezo.kalauz.v1` — a multi-user szelet
  öröksége (nyitott kérdés #2). Jelölve, **nem itt** javítjuk.
- Szülő-spec §8 `fogalom: { term: FogalomKey }` vs. a shippelt `{ term, def }` — S2a-örökség.
  Jelölve, **nem itt** javítjuk.

## 10. Amit hozzáad

```
frontend/src/features/tutorial/registry/
  welcome.ts             ÚJ — WELCOME + WelcomeStep + WELCOME_VERSION
  welcome.test.ts        ÚJ — hang-lint a WELCOME lépéseire
  index.ts               MÓD — versionOf(id) helper
  registry.test.ts       MÓD — lint-helperek kiemelése (két adathalmazra futnak)
frontend/src/features/tutorial/
  TutorialProvider.tsx   MÓD — welcomeStatus/welcomeOpen, a :206 guard bővítése, resetAll fix
  TutorialProvider.test.tsx MÓD — elnyomás, nincs láncolás, új eszköz
frontend/src/shared/ui/kalauz/
  KalauzWelcome.tsx      ÚJ
  KalauzWelcome.test.tsx ÚJ
frontend/src/data/tutorial/
  tutorialProgressHooks.ts MÓD — a reset hibája felszínre kerül, GET cancel/invalidate
frontend/src/features/me/pages/
  BeallitasokPage.tsx    MÓD — „Kalauzok újranézése" sor
  BeallitasokPage.test.tsx MÓD
frontend/src/test/kalauz.ts        MÓD — 'welcome' a buildAllSeenProgress-be
frontend/src/features/today/pages/NapKuldetesekPage.test.tsx MÓD — seed
frontend/tests/visual/visual.spec.ts MÓD — a /nap-ra menő blokkok seedelése
frontend/src/styles/prototype.css  MÓD — .welcome / .wl-* blokk
docs/features/tutorial.md          MÓD
docs/CODEMAP.md                    MÓD (gen-codemap.mjs)
```

**Nem** ad hozzá: T2/T3 tartalmat, backend- vagy contract-változást, a `§13.1` döntést, a
`findKalauz` átfedés-lintet.

## 11. Kapuk

- `VITE_USE_MOCK=true pnpm test` **és** `VITE_USE_MOCK=false pnpm test`
- `pnpm build`
- `node scripts/gen-codemap.mjs` ugyanabban a commitban (új fájlok → `--check` kapu)
- Backend **nem érintett** — nincs Testcontainers-futás, nincs contract-drift kitettség.
- Kézi ellenőrzés: reset a Beállításokból → `/nap` → a welcome négy lépése, `Kihagyom`,
  `Escape`, reduced-motion, és hogy a `/nap` kalauz **nem** ugrik fel utána.

## 12. Nyitott, továbbadva

- **`§13.1` napszak-váltó** (minden route vs. Nap-only) — S3, a Nap-kalauz szelete.
- **`findKalauz` átfedés-lint** — az S3 (~32 kalauz) *előfeltétele*: az `index.ts:11` „a
  sorrend lényegtelen" megjegyzése hamissá válik, amint egy T2 kalauz paraméteres route-ot
  használ (`/mezo/patterns/:id` a `/mezo/patterns` mellett).
- **localStorage user-prefix** (`mezo.kalauz.v1` → per-user) — a multi-user account szelet.
