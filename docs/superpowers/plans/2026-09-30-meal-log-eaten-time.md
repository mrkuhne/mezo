# Étkezés tényleges ideje naplózáskor — megvalósítási terv

- **Cél:** Az új étkezés alapból a mentéskor aktuális helyi idővel kerüljön a kiválasztott napra; a használó egy csukott „Mikor ettél?” sorból átírhassa az időt, és a bejegyzés az időnek megfelelő ablakban jelenjen meg.
- **Architektúra:** A `FuelLogNewPage` átadja a kiválasztott nap tervezett étkezési ablakait a közös `MealComposer` számára. Egy tiszta Fuel logikai függvény az időből választja ki a megfelelő ablakot; a composer ugyanazt a döntést mutatja előnézetben és küldi a meglévő `MealInput` szerződésben. Az időmező helyi React állapot, ezért nyitás és zárás nem navigál és nem állítja vissza a görgetést.
- **Spec:** [2026-09-30-meal-log-eaten-time-design.md](../specs/2026-09-30-meal-log-eaten-time-design.md)
- **Beads:** `mezo-yhhvg`

## Állandó követelmények

- A vezérlő csak új étkezés megerősítésekor látszik, alapból csukva. Az üres piszkozat, a már mentett étkezés javítása és a meglévő négy forrás változatlan.
- A kezdőérték mindig az aktuális helyi óra; a „Most” ezt állítja vissza. A választott nap külön marad az időtől: korábbi napra pótláskor aznapi dátum + beírt HH:mm mentődik.
- A mentett `slot`, `loggedAt` és opcionális `window` ugyanabból a feloldásból jön. Találat nélkül „Ablakon kívül” jelenik meg, `window` nem kerül a kérésbe. Mai jövőbeli idő tiltott.
- A lenyitás, becsukás, átírás és visszaállítás nem navigál, nem üríti a piszkozatot és nem állítja vissza a görgetést. Sikertelen mentéskor az idő és a piszkozat megmarad.
- A `MealInput` REST szerződése már tartalmazza a szükséges mezőket; nincs új végpont, DTO vagy migráció. A meglévő szerkesztési út marad a tárolt idő javítója.

## 1. Idő → tervezett ablak feloldása

**Fájlok:** `frontend/src/features/fuel/logic/eatingTimePlacement.ts`, `frontend/src/features/fuel/logic/eatingTimePlacement.test.ts`.

**Interfész:** `resolveEatingTimePlacement(atHHmm: string, windows: readonly FuelSlot[]): { slot: MealSlot; window?: { from: string; to: string }; label: string | null }`. Csak `slotKey`-t és mindkét `windowFrom`/`windowTo` értéket hordozó étkezési ablak jelölt. Találatnál az első tervbeli egyezés nyer; éjfélen átnyúló tartományban `at >= from || at <= to`, egyébként a két végpont is beletartozik. Találat nélkül a `defaultMealSlot` az adott HH:mm alapján adja a kötelező API-kategóriát, `window` nélkül.

- [x] Írj piros teszteket: reggeli idő, délutáni másik ablakba átlépés, két ablak közötti és esti ablakon kívüli idő, éjfélen átnyúló ablak, hiányos tervablak.
- [x] Futtasd: `cd frontend && CI=true VITE_USE_MOCK=true pnpm exec vitest run src/features/fuel/logic/eatingTimePlacement.test.ts`; a várt eredmény FAIL.
- [x] Írd meg a tiszta függvényt; az időből feloldott `slot` és `window` egyetlen visszatérési értékből jöjjön, ne két külön keresésből.
- [x] Ugyanazzal a paranccsal PASS; commit: `feat(fuel): resolve meal window from eating time (mezo-yhhvg)`.

## 2. Közös megerősítő vezérlő és mentés

**Fájlok:** `frontend/src/features/fuel/components/MealComposer.tsx`, `frontend/src/features/fuel/components/MealComposer.eatenTime.test.tsx`, `frontend/src/styles/prototype.css`.

**Interfész:** `MealComposerProps.eatingTimeWindows?: readonly FuelSlot[]`. Ha a prop jelen van és `editMealId` nincs, a megerősítő részben az új „Mikor ettél?” sor váltja a régi MIKOR szegmenst; a meglévő overlay hívók és a javítás saját időmezője változatlan marad. Helyi állapot: `timeOpen: boolean = false`, `timeOverride: string | null = null`. A csukott alapérték és a mentéskori alapérték a helyi órából számolódik; a nyitott, még nem módosított mező „Most” értéke a megnyitás pillanatának ideje.

- [x] Piros komponens-tesztek befagyasztott helyi órával (`vi.setSystemTime(new Date(2026, 8, 30, 14, 10))`): tétel előtt nincs vezérlő; tétel után csukott „Most · 14:10”; nyitás/zárás ugyanazt a szövegmező DOM-csomópontot és görgetési értéket tartja; átírás a feloldott ablakot mutatja; „Most” visszaállít; mai jövőbeli idő hibát és tiltott mentést ad; javításkor a régi szerkesztő időmező marad.
- [x] Mentési tesztek: érintetlen mező a mentés pillanatának idejét küldi; átírt idő a megfelelő `slot`+`window`+`loggedAt` hármast küldi; elutasított mentés nem hív `onSaved`-et és megtartja a szerkesztett időt.
- [x] A fókuszált komponens-teszt első mock futása FAIL az új elvárásokon; az elkészült vezérlővel a fókuszált teszt mindkét explicit beállításban PASS.
- [x] Az új sor és vezérlő a `MealComposer` JSX-ébe kerüljön, a meglévő `logflow` stíluscsaládba illő CSS-sel és címkézett időmezővel. A gomb helyi állapotot váltson (`aria-expanded`), ne navigáljon, ne remountolja a komponenst és ne fókuszáljon automatikusan az időmezőre. Amíg nincs kézi átírás, a csukott címke és az érintetlen nyitott mező percenként frissüljön; beíráskor az érték rögzüljön.
- [x] Mentéskor egyetlen `resolveEatingTimePlacement` eredményből készüljön a `MealInput.slot`, a `window` és a dátummal `offsetIso`-val összeállított `loggedAt`. A mai jövőbeli időt a teljes helyi dátum+idő alapján ellenőrizd. Az új idővezérlős út csak sikeres `logMealAsync` után hívja az `onSaved`-et; hibánál a piszkozat és az átírt idő maradjon. Az edit út továbbra is az étkezés saját idejét őrizze.
- [x] Futtasd a fókuszált teszteket PASS-ra; commit: `feat(fuel): add optional eating time to meal composer (mezo-yhhvg)`.

## 3. Oldalbekötés és integrációs ellenőrzés

**Fájlok:** `frontend/src/features/fuel/pages/FuelLogNewPage.tsx`, `frontend/src/features/fuel/pages/FuelLogNewPage.test.tsx`; a meglévő `MealComposer.logDate.test.tsx` csak akkor, ha a régi közvetlen hívó elvárásait ténylegesen érinti a változás.

**Interfész:** A lap `plan.slots` tömbjét adja `eatingTimeWindows`-ként a composernek. A korábbi napi `logDate` marad; a `logTime={past ? tile?.time : undefined}` és a kiválasztott tile `window` értéke nem írhatja felül az aktuális vagy kézzel választott evési időt. A `?w=` továbbra is a megnyitó kontextust, a fejlécet és a recept-előtöltést határozza meg.

- [x] Piros oldalszintű tesztek: `?d=&w=` indításkor a megerősítő sor csukott és az aktuális időt mutatja; egy reggeli időre átírt, délutáni tile-ról indított pótlás a kiválasztott napon a reggeli `slot`-tal és reggeli `window`-val mentődik; ablakon kívüli időnél nem küld hamis tervablakot; mind a Fotó, Kamra, Recept, Szokásosak út ugyanazt a vezérlőt kapja.
- [x] Futtasd: `cd frontend && CI=true VITE_USE_MOCK=true pnpm exec vitest run src/features/fuel/pages/FuelLogNewPage.test.tsx`; a várt eredmény FAIL.
- [x] Kösd be a tervablakokat és távolítsd el a régi, múltbeli tile-időre kényszerítő átadást. A meglévő forrásmódok, előtöltés, AI-elemzés és napra visszalépés viselkedése maradjon.
- [x] Futtasd az oldal és a kapcsolódó composer teszteket mindkét explicit módban PASS-ra; commit: `feat(fuel): wire eaten time into new meal log page (mezo-yhhvg)`.

## 4. Dokumentáció, helyi kapuk és kiadás

**Fájlok:** `docs/features/fuel.md`, `docs/milestones/roadmap.md`, `docs/design_2.0/prototypes/elo/README.md`; a `docs/features/README.md` Fuel-sorát ellenőrizni kell. A `docs/CODEMAP.md` generált: csak a generátor írhatja.

- [ ] A Fuel élő doksi §2/§3/§4/§9/§10 érintett részeit frissítsd: csukott aktuális idő, átírás, ablakválasztás, sikertelen mentés, fájltérkép. A prototípus-regiszterből az „élő még nincs kész” állapot csak az éles ellenőrzés után tűnjön el; a roadmap kapjon rövid szállítási bejegyzést.
- [x] Futtasd a helyi kapukat: `cd frontend && pnpm build`; `cd frontend && CI=true VITE_USE_MOCK=true pnpm test`; `cd frontend && CI=true VITE_USE_MOCK=false pnpm test`; `node scripts/gen-codemap.mjs`; `node scripts/lint-docs.mjs`; `git diff --check`. A már a munka előtt is jelzett, nem Fuel területű stale doksikat külön név szerint rögzítsd, ha továbbra is fennállnak; új Fuel-staleness nem maradhat.
- [x] Browserben ellenőrizd a teljes új naplózási utat és az időmezőt 320 px-en, csökkentett mozgással és konzolhiba nélkül; nyitás/záráskor a piszkozat, DOM-mező és görgetés maradjon. Commit: `docs(fuel): document eating-time logging (mezo-yhhvg)`.
- [ ] A helyi gate-ek után frissítsd a Beads backupot (`node scripts/check-beads-backup.mjs --fix`), commitold a változást, szinkronizáld a Beadst, majd a projekt munkafolyamata szerint `--no-ff` merge és push a mainre. Ellenőrizd a deploy futás sikerét, és az éles oldalon a vezérlő látható működését; adatellenőrzéshez csak olvasó lekérdezést használj. Zárd a `mezo-yhhvg` feladatot, és add meg a commitot és az ellenőrzés eredményét.

## Kész, ha…

- [x] Új étkezésnél minden bejárat ugyanazzal a csukott, aktuális idejű sorral indul; az idő külön állítás nélkül is a mentés pillanatában aktuális.
- [x] Lenyitás, becsukás, átírás és „Most” nem tölti újra a napló felületét és nem veszíti el a piszkozatot vagy a görgetési helyet.
- [x] Az átírt idő ugyanarra a kiválasztott napra kerül; a hozzá tartozó tervezett ablakban látszik, vagy őszintén ablakon kívül marad. Mai jövőbeli idő nem menthető; hiba után a felvitt idő megmarad.
- [x] A négy forrás, a recept-előtöltés, AI-elemzés, már mentett étkezés javítása, korábbi napra visszatérés és a meglévő navigáció tovább működik.

**Helyi kapuk (2026-10-01):** build sikeres; mock mód 8980 zöld teszt; valós mód 8960 zöld + 46 zöld ChatPage teszt külön futtatva. A teljes valós módú párhuzamos futásban ez az egy ChatPage válaszvárás kétszer 5 másodperces időkorlátba futott; önállóan 46/46 zöld, Fuel hiba nem volt. A dokulintben a Fuel tiszta, egy korábbról stale lap maradt: `docs/features/settings.md`.
- [ ] A releváns tesztek, teljes frontend build, mindkét explicit tesztmód, Fuel-dokulint, 320 px és reduced motion ellenőrzés, main push, deploy és éles UI-ellenőrzés bizonyított.
