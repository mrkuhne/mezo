# Quick Log csempe-redesign — design (mezo-7lst)

*2026-09-03 · a `QuickInputSheet` v2 rácsának újratervezése*

## 1. A probléma

A FAB mögötti `QuickInputSheet` három különböző vizuális súlyú elemet halmoz egymásra:
egy `MOST`-fejlécet (aktív étkezési ablak), egy víz duo-csempét beépített chipekkel, és
egy 7 elemű csempe-rácsot — a chat sor pedig a legaljára szorult. A két hero-elem
körülbelül egy csempesornyi függőleges helyet eszik, a rács ritmusát megtöri, és a
víz-logolás egy második, a `WaterLogSheet`-től független felületet duplikál.

## 2. Amit építünk

Egyetlen, lapos hierarchia: cím → chat sor → 9 egyenrangú csempe 3×3-ban.

```
Gyors logolás
bármikor, két koppintás

[  Mondd el Mezónak                    › ]   ← gradiens CTA, változatlan

  Étkezés     Víz        Stack
  Edzés       Sport      Súly
  Check-in    Napló      Alvás
```

Tónusok: Étkezés `coral`, Víz `sky`, Stack `gold`, Edzés `coral`, Sport `rose`,
Súly `sky`, Check-in `rose`, Napló `sage`, Alvás `lav`.

### 2.1 A dinamikus Étkezés csempe

A csempe **helye, ikonja (`i-fuel`) és címkéje (`Étkezés`) fix** — csak az alszövege és a
célja változik:

| állapot | alszöveg | koppintás |
|---|---|---|
| van `state === 'now'` étkezési ablak | `MOST · <ablak neve>` | `/fuel/log/uj?w=<tileKey(nowWindow)>` |
| nincs | `ablakon kívül is` | `/fuel/log/uj` (a `FuelLogNewPage` „Ablakon kívül" ága) |

A `nowWindow` derivációja változatlan: `plan.slots.find(s => s.slotKey !== undefined && s.state === 'now')`
a `useFuelPreview()`-ból. Az ablak azonosítója **mindig** a `fuelSwimlane.ts` exportált
`tileKey(slot)` függvényéből jön, sosem kézzel összefűzött `${time}-${label}`-ből.

### 2.2 A Víz csempe

Alszövege az aznapi mennyiség (`fuel.consumed.water`, hu-HU formázva, `… ml`).
Koppintásra `phase = 'water'`, ami a **meglévő** `features/fuel/sheets/WaterLogSheet`-et
adja vissza — nem születik új sheet-fájl. Bekötés a `FuelMaiPage` precedense szerint:

```tsx
<WaterLogSheet
  currentMl={fuel.consumed.water}
  targetMl={fuel.targets.water}
  onLog={logWater}
  onClose={onClose}
/>
```

### 2.3 Az új Sport csempe

`i-sport` ikon, `rose` tónus (ugyanaz a szín, amit a `SportPage` fejléce használ).
Alszövege az aznapi utolsó sport-session, ha van: `SPORT_LABELS[s.sport] · <duration>p`
(pl. `röplabda · 90p`) — a `useTrain().sport.sessions` mai (`isoDate === localDateString()`)
elemei közül az utolsóból. Ha ma nem volt session, nincs alszöveg. Koppintásra `phase = 'sport'` → a **meglévő** `features/train/sheets/SportLogSheet`,
a `SportPage` bekötése szerint:

```tsx
<SportLogSheet
  onClose={onClose}
  onSave={(body, done) =>
    logSportSession(body, { onSuccess: r => showLevelUp(r?.levelUp), onSettled: done })}
/>
```

`logSportSession` a `useTrain()`-ből, `showLevelUp` a `useLevelUp()`-ból jön.

### 2.4 Ami nem változik

A `naplo-pick` alfelület (Aktivitás / Napló / Hála), a Súly / Check-in / Alvás / Napló /
Stack / Edzés csempék viselkedése, a chat sor tartalma és `/mezo/chat` célja, a sheet címe
(`Gyors logolás` — a `TabBar.test.tsx` erre fogódzik).

## 3. Megközelítés és elvetett alternatívák

**Elfogadott:** a víz mennyiség-választó a meglévő `WaterLogSheet` újrahasznosítása egy új
`'water'` phase-en át, pontosan úgy, ahogy a Súly a `WeightLogSheet`-et nyitja.

**Elvetve:** saját quicklog-os mini víz-sheet a `quickinput/sheets/` alatt. Két, külön
karbantartott víz-logoló felületet szülne, és új sheet-fájlként CODEMAP-regenerálást
kényszerítene — a nyereség pusztán tipográfiai.

## 4. Prior art

- **[MacroFactor — új food logger / Actions Sheet](https://macrofactor.com/new-food-logger/)** — *elfogadva.*
  A FAB-ot egyetlen sheet váltotta, amiben minden logolási belépő egyenrangú (vonalkód,
  keresés, gyors hozzáadás, AI-leírás, receptek); nincs túlméretezett hero-akció. A logger a
  **jelen órát tölti be alapértelmezésnek**, de nem kényszerít étkezés-besorolást — az idő
  kontextus előtöltés, nem módváltás. Ez pontosan a mi dinamikus Étkezés csempénk: a kontextus
  a célt és az alszöveget állítja, a csempe identitását nem.
- **[Material Design 3 — Bottom sheets](https://m3.material.io/components/bottom-sheets/guidelines)** — *elfogadva.*
  A rács-elrendezésű modális bottom sheet a szentesített akció-launcher minta, 6–8 (nálunk 9)
  akcióra görgetés nélkül; és megengedi, hogy egy fókuszált részfeladatra sheet váltson sheetet
  — ez a Víz és a Sport csempe mögötti phase-csere.
- **[Gajos et al., Predictability and Accuracy in Adaptive UIs (CHI 2008)](http://aiweb.cs.washington.edu/ai/puirg/papers/kgajos-chi08-predictability.pdf)** — *elfogadva, megszorítással.*
  A kísérlet szerint az adaptív felületnél a **pontosság dominál a kiszámíthatóság felett**;
  a pontatlan adaptáció frusztrál. Ebből jött a döntés, hogy az Étkezés csempe pozíciója,
  ikonja és címkéje fix marad, és **csak a leíró (nem jósló) alszöveg** változik — ez
  konstrukció szerint pontos.
- **[Thumb-zone ergonómia (Hoober nyomán)](https://parachutedesign.ca/blog/thumb-zone-ux/)** — *tudomásul véve, felülbírálva.*
  Magas telefonokon egy bottom sheet felső sávja a legrosszabb hüvelykujj-elérésű terület,
  tehát a chat felülre emelése elérhetőséget cserél előtérbe helyezésre. A döntés tudatos:
  a chat nem a leggyorsabb út, hanem a felfedezendő út — vizuális elsőbbséget kap, a napi
  rutin-logolás pedig a jól elérhető alsó kétharmadban marad.
- **[Vízkövető appok összehasonlítása (HabitBox)](https://habitbox.app/blog/water-tracker-app)** — *elfogadva.*
  A konvergált minta: 2–4 preset egy koppintásra + kilépő a pontos mennyiséghez; a tiszta
  stepper a vesztes (sok koppintás, könnyű túllövés). A meglévő `WaterLogSheet` pontosan ez
  (250/400/500 chip + kézi ml). Megjegyzés: a forrás körkép, nem elsődleges kutatás.

## 5. Codebase terrain

**Érintett feature-ök:** `quickinput` (FE-ui, nincs saját HOW doc), `fuel` (víz + étkezési
ablakok + `/fuel/log/uj`), `train` (sport session), `today` (`useFuelPreview`), shell (`app/`).

**Kulcsfájlok:**

| fájl | mi |
|---|---|
| `frontend/src/features/quickinput/sheets/QuickInputSheet.tsx` | a `Phase` unió, a lokális `Tile`, a törlendő MOST-fejléc és víz duo-csempe, a felmozgatandó chat sor |
| `frontend/src/features/fuel/sheets/WaterLogSheet.tsx` | a kész mennyiség-választó (`currentMl`/`targetMl`/`onLog`/`onClose`), 7 saját teszttel |
| `frontend/src/features/train/sheets/SportLogSheet.tsx` | a kész sport-logoló (`onClose`/`onSave`/`initialSport`/`date`) |
| `frontend/src/features/fuel/logic/fuelSwimlane.ts` | `tileKey(slot)` — a keresztURL-es ablak-azonosító |
| `frontend/src/features/fuel/pages/FuelLogNewPage.tsx` | a `?w=` fogadó oldala: ismeretlen/hiányzó kulcs = „Ablakon kívül" |
| `frontend/src/features/fuel/pages/FuelMaiPage.tsx` | a `WaterLogSheet` bekötési precedense |
| `frontend/src/features/train/pages/SportPage.tsx` | a `SportLogSheet` bekötési precedense |
| `frontend/src/styles/prototype.css` | a `.quicklog*` szabálycsalád |
| `frontend/src/app/AppLayout.tsx` | a FAB a `LevelUpProvider`-en **belül** van — élesben rendben |

**Követendő minták:** phase-csere (korai `return` egy másik sheettel), sosem sheet a
sheetben — a `Sheet` saját portált és backdropot hoz. A gyerek sheet a **külső** `onClose`-t
kapja. A sheetek adat-mentesek, ahol lehet: a nyitó birtokolja a hookot.

**Csapdák:**
- A `nowWindow`-ból képzett `tileKey` **koppintáskor rögzüljön**, ne minden rendereléskor
  számolódjon újra — ez a korábbi check-in regresszió (`mezo-967c`) osztálya.
- A `SportLogSheet` mentési útja `useLevelUp()`-ot hív, ami provider nélkül dob. A
  `TabBar.test.tsx` csupaszon rendereli a `QuickLogFab`-ot → azt a rendert `LevelUpProvider`-be
  kell csomagolni.
- A `QuickInputSheet.test.tsx` egészben mockolja a `@/data/hooks`-ot; a `useTrain`-t fel kell
  venni a mockba.
- Valós módban a `fuel.targets.water` 0 a friss ghostban → a víz-sheet „ma eddig 0 / 0 l"-t ír.
  Ez az őszinte első festés; **nem osztunk a targettel**.
- `VITE_USE_MOCK` beállítatlanul = mock mód; a valós módú kapu `VITE_USE_MOCK=false pnpm test`.
  Mock módban az idő `13:30`-ra van rögzítve, tehát mindig van aktív ablak — a „nincs ablak"
  ágat célzottan kell tesztelni.

## 6. Tesztterv

`QuickInputSheet.test.tsx`:

- **törlés** — a MOST-fejléc két tesztje (renderelés + `Logold` → `/fuel`; és a „now-window
  nélkül nem renderel semmit"), valamint a helyben logoló víz-chipek tesztje.
- **új** — az Étkezés csempe aktív ablakkal `/fuel/log/uj?w=<tileKey>`-re navigál;
  ablak nélkül `/fuel/log/uj`-ra.
- **új** — a Víz csempe megnyitja a mennyiség-választót („Mennyit ittál?"), a mentés `logWater`-t hív.
- **új** — a Sport csempe megnyitja a `SportLogSheet`-et.
- **bővítés** — a csempe-lista teszt 9 címkére; a clay-sprite teszt `#i-viz` és `#i-sport`-tal;
  a `@/data/hooks` mock a `useTrain`-nel.

`TabBar.test.tsx`: a `QuickLogFab` rendere `LevelUpProvider`-be csomagolva.

**Kapuk:** fókuszált FE tesztek mindkét módban (`pnpm test <fájlok>` és
`VITE_USE_MOCK=false pnpm test <fájlok>`), lint, `pnpm build`. Nincs backend-érintés, nincs
`api/**` fragmens, nincs új sheet-fájl → **CODEMAP-regenerálás nem szükséges**.

## 7. CSS-takarítás

Törlendő halott szabálycsaládok a `prototype.css`-ből: `.quicklog-most*`, `.quicklog-water*`,
`.quicklog-chip`, és a már korábban elárvult `.quicklog-emoji`. Új szabály nem kell — a
`.quicklog-grid` flex-wrap ritmusa 9 csempével pont 3×3-at ad. A „8 tiles in a 3-wide rhythm"
komment 9-re javítandó.

## 8. Dokumentáció

Minimál hatókör — a redesign által hazuggá tett sorok javítása:

- `docs/features/_platform-design-system.md` §5 QuickInput-sor (ma: chat felül
  `/insights/chat`-re, 8 csempe, Víz mint navigáló csempe, Súly `/me/weight`-re, hiányos
  `Phase` unió — mind hamis) és a §10 mondat (`TabBar` mountolja a sheetet — a `QuickLogFab`
  óta hamis).
- `docs/features/fuel.md:39` — az állítás, hogy az Étkezés csempe „csak navigál" a `/fuel`-ra.
- `docs/features/journal.md` — a QuickInput phase-listája.
- `frontend/src/app/QuickLogFab.tsx` fejléc-kommentje („a v2 redesign … until then").

A hiányzó `docs/features/quickinput.md` megírása **nem** része ennek a változásnak.

## 9. Kockázat

Alacsony. Tiszta view-réteg, minden logoló út meglévő, tesztelt sheetre vagy meglévő route-ra
mutat; nincs új adatséma és nincs backend-érintés. A legnagyobb kockázat a `useLevelUp`
provider-igénye a `TabBar.test.tsx`-ben — a fókuszált tesztfutás azonnal megfogja.
