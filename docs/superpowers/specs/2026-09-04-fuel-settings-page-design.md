# Fuel beállítások — önálló Mozaik 2.0 oldal

- **Dátum:** 2026-09-04
- **bd issue:** `mezo-2xzf`
- **Státusz:** vizuálisan jóváhagyva (2026-09-04)
- **Scope:** frontend-only UI + navigáció; API, DTO, adatmodell és mentési szemantika változatlan

## Cél

A jelenlegi `FuelSettingsSheet` sűrű, form-szerű drawerét egy önálló
`/fuel/settings` oldal váltja. A belépési pont nem változik: a Fuel hub alján levő
`Fuel-beállítások` sáv/fogaskerék nyitja az oldalt. Az új felület a Design 2.0
Huawei Health-ihlette „tile → own full page” nyelvét használja: zsálya tónusú hero,
adatvizualizációként rajzolt napi ritmus, lebegő csoportkártyák és egyetlen erős,
coral mentés CTA.

A változás nem vezet be új beállítást. A sheet minden mai mezője, korlátja és
mentési viselkedése változatlanul átkerül az oldalra.

## Jóváhagyott vizuális irány

### Oldalhéj

- A route a Fuel full-page siblingje: `fuel/settings`.
- `MozaikPage tone="sage"`, felül `PageHead` `‹ Fuel` visszalépéssel.
- A háttér felül zsálya mosásból fut át a normál canvasba.
- Belépéskor egyszeri, staggerelt rise-in; utána nyugodt felület. A ritmusív egyszer
  rajzolódik fel. Minden mozgás reduced-motion alatt állóképre vált.
- A mentés a már bevált portaled save-bar idiommal a tab bar fölött marad elérhető;
  nem része a görgetett formnak.

### Élő napi ritmus hero

A hero a page első és egyetlen nagy panelje:

- nagy `N étkezés` szám;
- koffein-cutoff pill;
- 06–24 időtengelyű, félkörös napív;
- az étkezésszámnak megfelelő zsálya pontok;
- arany cutoff-marker;
- rövid elv: „A napi ív együtt mozdul a beállításaiddal.”

Az étkezésszám stepper és a time input a mentés előtt, lokálisan is frissíti a
hero pontjait/markerét. Ez kizárólag nézetmodell; új adat vagy perzisztencia nincs.

### Tartalmi sorrend

1. **Ritmus** — `Étkezések naponta` stepper (3…6), `Koffein-cutoff` time input.
2. **Makróprofil** — egy natív, teljes szélességű dropdown az öt meglévő profillal.
3. **Aktuális cél előnézete** — donut + a napi kcal-cél, majd Fehérje / Szénhidrát /
   Zsír soronként egyszerre százalék és gramm.
4. **Napi célok** — Víz és Rost két egyenrangú mini-csempében.
5. **Finomhangolás** — Fehérjeszint segmented control; Edzésnapi shift a mai
   0…500 kcal, 50-es lépésű szabállyal.
6. **Időzítés** — `Étkezési ablakok` navigációs kártya, amely `/fuel/slots`-ra visz.
7. Csendes zárómondat: „A ritmus vezet, nem korlátoz — bármelyik ablak utólag is
   logolható.”

### Makróprofil felfedezhetőség + preview

A régi öt egymás mellé csomagolt chip helyett natív `<select>` jelenik meg. Így
görgetés és horizontális keresés nélkül egyértelmű, hogy több profil közül lehet
választani; az operációs rendszer pickerét kapjuk billentyűzet- és VoiceOver-barát
módon.

Az előnézet forrása a már létező `useFuelDay().fuel.targets`:

- `kcal` a „Mai cél alapján” érték;
- `p`, `c`, `f` a tényleges, goal-engine által felírt grammcél;
- a százalékok a három makró energiájából számolt, 100%-ra normalizált arányok
  (`p×4`, `c×4`, `f×9`).

Ez tudatosan a **jelenleg aktív, szerver által felírt cél**, nem egy frontendben
újraimplementált goal-engine-becslés. Ha a form draft eltér a mentett diet
settings-től, a preview mellett „Mentés után frissül” jelzés jelenik meg. Mentés
után a meglévő diet mutation invalidálja a goals + fuel-day queryket, és a preview
az új, backend által számolt értékre áll. Így nincs duplikált backend-konfiguráció,
és a felület sosem mutat kitalált grammcélt.

## Architektúra

### Új és nyugdíjazott elemek

- **Új:** `frontend/src/features/fuel/pages/FuelSettingsPage.tsx`
- **Új/áthelyezett teszt:** `FuelSettingsPage.test.tsx`
- **Nyugdíjazott:** `frontend/src/features/fuel/sheets/FuelSettingsSheet.tsx` és a
  sheet-nevű tesztje; nincs más fogyasztó.
- **Route:** `frontend/src/app/router.tsx` — `fuel/settings` a többi Fuel sibling
  között, `fuel/slots` előtt.
- **Belépési pont:** `FuelMaiPage` `Fuel-beállítások` sávja `navigate('/fuel/settings')`;
  a `settingsOpen` state, a sheet import és a conditional mount eltűnik.
- **Stílus:** Fuel-scoped `.fset-*` szabályok a meglévő
  `frontend/src/styles/prototype.css` Design 2.0 részében; minden szín tokenből,
  Pulse/Cirkadián módban komponens-branch nélkül.

Az oldal a meglevő `MozaikPage`, `PageHead`, `PageBody`, `EntranceGroup`, `Icon`
és portaled save-bar recepteket használja. Új shared primitive nem indokolt:
a hero, a donut és a settings-kártyák Fuel-specifikusak.

### Állapot és adatfolyam

Az oldal ugyanazokat a hookokat használja, mint a sheet:

- `useFuelSettings` + `useFuelSettingsActions`;
- `useDietSettings` + `useDietSettingsActions`;
- plusz read-only `useFuelDay` az aktuális target previewhoz.

A két query két független lokális draftot és két független touched flaget tart meg.
A valós módban ghosttal induló cold-open race védelme byte-for-byte ugyanaz marad:
a beérkező szerverérték csak a saját, még érintetlen draft-szekcióját szinkronizálja.
Egy fuel mező szerkesztése nem fagyaszthatja be a később beérkező diet értéket, és
fordítva.

A mentés továbbra is a két meglévő mutation `Promise.all`-ja. Siker után az oldal
`/fuel`-re navigál; hiba esetén a globális mutation toast marad az egyetlen
hiba-visszajelzés, az oldal nem nyeli el a hibát és nem navigál el.

## Validáció és állapotok

- Étkezésszám: 3…6, a végpontokon a megfelelő gomb disabled.
- Koffein-cutoff: csak nem üres `HH:mm` kerül draftba.
- Víz: 500…8000 ml, 100-as lépés.
- Rost: 10…80 g.
- Edzésnapi shift: 0…500 kcal, 50-es lépés; a `0` vizuális értéke `ki`.
- Egyéni split: a három százalék tizedes pontossággal pontosan 100; eltérésnél
  inline terracotta figyelmeztetés és disabled Mentés.
- Bármelyik read vagy write pending állapotában Mentés disabled; ghost érték sosem
  írható vakon a szerverre.
- Hiányzó target preview esetén a teljes donut/értéksor nem renderel kitalált
  számot; csak a profilválasztó marad.

## Tesztelés

### Oldaltesztek

A korábbi `FuelSettingsSheet.test.tsx` regressziói oldaltesztként megmaradnak:

- ghost prefill;
- étkezés stepper 3…6 clamp;
- `/fuel/slots` navigáció;
- mindkét settings payload mentése;
- real-mode delayed GET: Mentés tiltott, majd re-sync;
- a felhasználó fetch közbeni szerkesztése nem íródik felül;
- a két touched flag függetlensége;
- custom split 100%-os validációja.

Új lefedés:

- `/fuel/settings` route renderel és `‹ Fuel` visszavisz;
- a Fuel hub band a route-ra navigál, nem dialogot nyit;
- a dropdown mind az öt profilt tartalmazza és váltja a draftot;
- target preview a `fuel.targets` grammértékeit és a belőlük normalizált százalékot
  mutatja;
- draft módosításakor megjelenik a „Mentés után frissül” jelzés;
- étkezésszám/cutoff draft a hero vizualizációját frissíti;
- pending/hibás/custom-invalid állapot nem menthető;
- reduced-motion alatt nincs végtelen vagy belépési animáció.

### Gate-ek

```bash
cd frontend
pnpm build
pnpm test
VITE_USE_MOCK=true pnpm test
```

A Fuel living doc §2/§9/§10 frissül, majd:

```bash
node scripts/lint-docs.mjs
```

Az új route miatt `node scripts/gen-codemap.mjs` fut; a generált
`docs/CODEMAP.md` kézzel nem szerkeszthető.

## Nem-célok

- backend, OpenAPI vagy adatmodell változtatása;
- új diet preset vagy új beállítás;
- a `/fuel/slots` editor belső újratervezése;
- a Fuel hub újabb belépési pontja vagy külön beállítás-csempe;
- a goal-engine képlet frontendbe másolása;
- a többi Fuel sheet vizuális áttervezése.

## Kockázatok

- **Cold-open felülírás:** a page-re költözéskor könnyű elveszíteni a két külön
  touched flaget. A késleltetett GET tesztek változatlanul kötelezőek.
- **Mentés + navigáció:** csak mindkét mutation sikere után léphetünk vissza;
  részleges hiba nem tűnhet el oldalváltással.
- **Preview őszinteség:** presetből tilos frontend-oldali „várható” grammcélt
  fabrikálni. A preview csak a tényleges `fuel.targets` értékeit mutatja.
- **Alsó chrome:** a save-bar a tab bar fölé portálozik és ugyanazokat a safe-area
  offseteket használja, mint a recipe editor; nem takarhatja a form utolsó sorát.
