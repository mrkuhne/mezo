# DayOrb — a fejléc Mezo-orbja napi állapotjelzőként

- **bd**: mezo-idz2
- **Dátum**: 2026-09-03
- **Mockup**: https://claude.ai/code/artifact/eb26b9ec-409b-4705-8842-b255912c6ab5
- **Scope**: frontend-only

## A probléma

A napi értékelés („Mezo · erről a napról") a `/me/week/napok/:date` nap-oldalon él, és
onnan nincs belépő. A kérdés az volt, hogyan legyen elérhető a napszakos főoldalról:
ismétlődő csempeként minden napszakban, vagy egy fejléc-belépőn keresztül.

A döntés a fejléc-belépő. Az ismétlődő csempét a prior art kifejezetten ellenjavallja
(lásd lent), a fejlécben pedig már ott ül egy **duplikátum**: a jobb szélső
`nap-avatar` (`aria-label="Profil"` → `/me`) ugyanoda visz, mint az alsó TabBar „Én"
füle. Ennek a helyére kerül a DayOrb, tehát a fejléc **nem nő** egy hatodik gombbal.

## A megoldás

A `nap-avatar` gomb megmarad, de a tartalma egy új `DayOrb` komponens: a meglévő
`#s-orb` clay sprite szürkén, ami **alulról fölfelé telik meg**, ahogy a nap jelei
megérkeznek. Koppintásra `/me/week/napok/<ma>`.

Két, egymástól független tengely:

- **Magasság = mennyit tudok a napodról.** A rögzített jelek aránya a nap
  alkalmazandó jeleihez képest. Nem ítélet, nem pontszám.
- **Szín telítettsége = milyen az, amit tudok.** Egy hangulat — a Mezo saját
  clay-coralja —, változó telítettséggel. Erős nap: telt. Gyenge nap: ugyanaz a szín,
  kifakulva. Sosem vált másik színre; a gyenge nap nem büntetés, csak halkabb.

A profil elérése változatlanul az „Én" tabon.

### A hét jel

| # | Jel | Jelen van, ha |
|---|---|---|
| 1 | alvás | van tegnap éjszakára vonatkozó alvás-sor |
| 2 | súly | van mai súlybejegyzés |
| 3 | kaja | van ma logolt étkezés |
| 4 | edzés | a mai gym-edzés le van zárva — **csak ha ma edzésnap van** |
| 5 | sport | van ma logolt sport- **vagy** futás-session — **csak ha ma tervezve van** |
| 6 | check-in | van ma legalább egy `done` check-in |
| 7 | napló | van ma `occurredOn`-nal rendelkező journal-bejegyzés |

**A nevező napfüggő.** A 4. és az 5. jel akkor tartozik a naphoz, ha **a nap terve
szerint jár, VAGY ha ma tényleg logoltál ilyet**. Pihenőnapon 5 jel a nevező,
edzésnapon 6, edzés+sport napon 7 — így egy tökéletes pihenőnap is meg tud telni,
és egy spontán esti séta sem esik a padlóra egy nem tervezett napon (belép a
nevezőbe *és* a számlálóba, tehát sosem ronthat). Ez az egyetlen feltételesség;
a másik öt jel minden napon számít.

**Minden jel egyet ér.** Nincs súlyozás: egy naplósor ugyanannyit tesz hozzá ahhoz,
amit a napról tudok, mint egy súlymérés. A magasság őszintén az adat-lefedettséget
mutatja, nem egy rejtett képletet.

### Állapotok

| helyzet | orb | `aria-label` |
|---|---|---|
| a lekérdezések függőben | szürke, mozgás nélkül | „A mai napod" |
| nincs egy jel sem | teljesen szürke | „A mai napod · még nincs adat" |
| n jel a k-ból | n/k magasságig, a minőség telítettségében | „A mai napod · n a k jelből megvan" |
| minden jel megvan | tele | „A mai napod · teljes" |

Nincs badge-pötty és nincs szám a glifben — a töltöttség maga a jelzés. A fejlécben már
két `nap-badge` van (üzenetek, értesítések); egy harmadik jelzés-réteg zaj lenne.
Éjfélkor a `localDateString()` fordul és az orb kiürül.

### A glif

A clay sprite-készlet 1:1 asset-kontraktus alatt áll (`frontend/src/shared/ui/clay/index.tsx:3`) —
**sprite-ot nem szerkesztünk**. A `DayOrb` egyetlen `<svg viewBox="0 0 100 100">`:

1. **alap** — `<use href="#s-orb">`, `filter: grayscale(1) brightness(1.28) contrast(0.55)`,
   `opacity: .55`. Ez a „még nem tudok rólad semmit" szürke orb.
2. **kitöltés** — az orb teste (`circle cx=50 cy=48 r=34`) újrarajzolva a nap tónusának
   radiális gradiensével, a sprite fény-ellipszisével és ívével együtt, egy alulról
   nyíló `clipPath`-be zárva. A kör y-ban 14…82 közt fut, tehát
   `fillY = 82 − pct/100 × 68`.
3. **menisz** — a töltésszint vonala a tónus mély árnyalatában, az orb körére clippelve.
   Csak `0 < pct < 100` esetén.

A tónus **interpoláció** két végpont között: kifakult `#F3E2D9 / #E3BDAB / #C69C89` és
telt `#FFC3A8 / #FF7A55 / #D8481F` (utóbbi maga az `sg-orb` gradiens). Az intenzitás a
napi pontból: 45 alatt teljesen halvány, 92 fölött teljesen telt, közte lineáris.

A `clipPath` `y`-ja CSS-transitionnel csúszik, amikor új adat érkezik;
`prefers-reduced-motion` alatt ugrik. Belépő koreográfia nincs — a fejléc nem úszik be.

### Adatforrás

**Magasság** — tiszta frontend-kompozíció a shellben már meglévő lekérdezésekből.
A `MezoThreadProvider` az `AppLayout`-ból minden chrome-os route-on fut, és a `useNeeds`
már ma lekéri a fuelt, alvást, edzést/sportot és a check-int. Ebből öt jel **cache-találat**;
csak a **súly** (`useWeight`) és a **napló** (`useJournalNotes(ma, ma)`) két új olvasás.

**Naptípus** — a kanonikus deriváció újrahasznosítva: `deriveBlocks(gymSchedule, sport,
activeRunningBlock)` (`frontend/src/features/fuel/logic/buildProtocol.ts:29`) +
`resolveDayType` (`frontend/src/features/fuel/logic/resolveDayType.ts:11`). A gym-ág
`d.time`-ot is követel, ami egy time-slot nélküli meso-napot tévesen pihenőnapnak
mutatna — a nevezőhöz ezért `gymSchedule.weeklyTimes.find(d => d.today && d.active)`
(idő nélkül) vagy `useToday().workout != null` a helyes kapu.

**Tónus** — `useMeWeek(mondayOf(ma))` → a mai `MeWeekDay.score`. Ez a *„milyen jó a nap"*
egyetlen forrása, ugyanaz, amit a nap-oldal mutat; egy második, kliensoldali definíció
elcsúszna tőle. Ára: egy extra lekérdezés a shellben, és mivel a `MeWeekService` /
`DayScoreService` a `COMPANION_SWITCH` mögött van, kikapcsolt kapcsolónál az orb
**semleges (középső) tónusra esik vissza** — a magasság ilyenkor is működik.

A `MeWeekDay`-t a **magassághoz** szándékosan **nem** használjuk: összemossa az
edzést / sportot / futást egyetlen `workoutCount`-ba, nincs benne napló és nincs
naptípus-tudata.

### Modul-határok

- `frontend/src/features/today/logic/dayOrbFill.ts` — **pure**. Bemenet: a hét jel
  jelen/hiány flagjei + a nap terve + a napi pont. Kimenet: `{ present, denominator,
  pct, intensity }`. React nélkül unit-tesztelhető; a ház stílusa (`needs.ts`,
  `resolveDayType.ts`).
- `frontend/src/features/today/logic/useDayOrbFill.ts` — a hookok kompozíciója. **Egy
  hely**, ahol az összes olvasás történik, és az egyetlen pont, ahol a másik session
  6-dimenziós modellje később becsatlakozik. A `useDayFace` / `MezoThreadProvider`
  precedens: a fejléc és a hub nem drift-elhet szét két külön olvasáson.
- `frontend/src/shared/ui/DayOrb.tsx` — buta prezentáció: `pct`, `intensity`, `size`.
  Saját teszt.

## Prior art

A recon (researcher, web) egyértelmű képet adott, és ez döntötte el a csempe-vs-belépő
kérdést:

- **WHOOP** — az AI-próza egy megnevezett „Daily Outlook" belépő mögött, a Home-on
  pontosan egy slotban; a korábbi mindig jelen lévő chat-felületet erre *cserélték*.
  https://www.whoop.com/us/en/thelocker/the-all-new-whoop-home-screen/
- **Oura (2025 redesign)** — a Today tab egyetlen dinamikus „daily highlight" slotot
  tart, ami *napszak szerint változtatja a tartalmát*, nem ismétlődik szekciónként.
  https://ouraring.com/blog/new-oura-app-experience/
- **Apple Health Summary** — a generált insightok pontosan egy „Highlights" blokkban
  laknak, sosem duplikálva; a staleness-re a válasz a hiány, nem az elavult kártya.
  https://support.apple.com/guide/iphone/see-your-activity-summary-iph4c34a8a95/ios
- **NN/g, banner blindness** — az ismétlődő, azonos kinézetű blokkot a felhasználó
  *megtanulja* kiszűrni. Ez a közvetlen bizonyíték az „ugyanaz a csempe minden
  napszakban" ellen. https://www.nngroup.com/articles/banner-blindness-original-eyetracking/
- **NN/g, passzív értesítések** — a pötty-badge korrekt „van új" jelzés, de önmagában
  könnyen elkerüli a figyelmet.
  https://www.nngroup.com/articles/indicators-validations-notifications/

**Átvéve:** egy belépő, fix helyen, sosem ismételve.
**Elvetve:** a badge-pötty — nálunk a töltöttség maga a folyamatos, mindig látható
jelzés, tehát a passzív pötty redundáns lenne a fejléc két meglévő badge-e mellett.

## Codebase terrain

- **A fejléc** — `frontend/src/app/AppHeader.tsx:80-158`, az app egyetlen fejléce, az
  `AppLayout` minden chrome-os route-on mountolja. A cserélendő gomb: `:153`
  (`nap-avatar`, `ClaySpot s-orb`, `aria-label="Profil"` → `/me`). CSS:
  `frontend/src/styles/prototype.css:4559`.
- **A duplikátum** — `frontend/src/app/TabBar.tsx:15`, az „Én" fül ugyanoda visz.
- **A shell-cache** — `frontend/src/app/AppLayout.tsx:53` → `MezoThreadProvider` →
  `useNeeds` (`frontend/src/features/today/logic/useNeeds.ts:28-45`), ~15 olvasás
  app-session-önként; a `docs/features/today.md` §3 tudatosan vállalt költségként
  dokumentálja.
- **Jelenkénti forrás** — `useFuelDay(date)` (`data/fuel/fuelHooks.ts:38`),
  `useToday()` (`data/today/todayHooks.ts:93`, `workoutDone` `:146`,
  `loggedSportKinds` `:150`), `useTrain()` (`data/train/trainHooks.ts:438`),
  `useSleep()` (`data/me/sleepHooks.ts:12`), `useWeight()` (`data/me/weightHooks.ts:29`),
  `useCheckins()` (`data/today/checkinHooks.ts:47`),
  `useJournalNotes(from,to)` (`data/journal/journalHooks.ts:32`).
- **Naptípus** — `buildProtocol.ts:29`, `resolveDayType.ts:11`,
  `deriveGymSchedule` (`data/train/trainHooks.ts:105`), `toSportSchedule` (`:158`).
- **Nincs meglévő „napi teljesség" fogalom.** A `DayScoreService` négy *minőségi*
  subscore-t ad (`null` = „tanulom"), a `HabitEvaluator` per-nap presence-flageket
  (`weight_logged_today` stb.), de a habit-lista felhasználó által szerkeszthető, tehát
  nem stabil nevező; a questek naponta változnak. Ez **új fogalom**, és az új pure modul
  a helye.

**Csapdák:**

1. **Vizuális goldenek — az egész suite.** `frontend/tests/visual/visual.spec.ts`:
   90 snapshot × 2 platform, és a fejléc **mindegyiken** rajta van. Bármilyen pixelváltozás
   a `.nap-avatar`-on az egészet rebaseline-olja; a linux baseline-ok CI-ból
   (`.github/workflows/update-visual-baselines.yml`, precedens: `1f9abc7ec`).
2. **Fejléc-kontraktus tesztek.** `frontend/src/app/hubHeaders.test.tsx:38-59` exact-match
   gomblistát assertál öt route-on; `frontend/src/app/AppHeader.test.tsx` (299 sor);
   `frontend/src/app/navigation.test.tsx`. A `'Profil'` label eltűnik — a lista hossza
   viszont marad.
3. **Mock-módban négy jel halott.** A seedek fix dátumokra pineltek: alvás
   (`data/me/sleep.ts:3`), súly (`data/me/goals.ts:141`), sport (`data/train/train.ts:1048`),
   napló (`data/journal/journalMock.ts:5`). Dátum-egyezéssel az orb mock-ban ~2/7-en áll.
   **A javítás a seedek relatívvá tétele** `localDateString()`-hez, nem a dátum-ellenőrzés
   elhagyása.
4. **Mock naptípusa csütörtökön fagyott** — `data/train/train.ts:1005` `today: true`-t
   drótoz a `Csü`-re, a mock sport-sessionökön pedig egyáltalán nincs `today` flag (azt
   csak a real-mode `toSportSchedule` bélyegzi). Mock-ban a gym mindig tervezett, a sport
   sosem.
5. **`useSleep().lastNight` hazudik** — a teljes napló utolsó eleme, nem tegnap éjszakáé
   (`data/me/sleepHooks.ts:53`). A helyes predikátum a `needsInputs.ts:93` idióma:
   ma **vagy** tegnap, maximumot véve. (Ugyanez a hiba-osztály él a
   `NapHubPage.tsx:74` `latestWeight`-jében is.)
6. **`SleepEntry.duration` órában van** (`7.5`, nem `450`) — `docs/features/today.md` §2.
7. **`VITE_USE_MOCK` üresen = mock mód** — a csupasz `pnpm test` kétszer mockot futtat;
   mindkét módot külön kell futtatni.
8. **Shell-mount költség** — a `useWeight` + `useJournalNotes` a fejlécből *minden*
   chrome-os route-on elindul, a session teljes hosszára. Ez a vállalt ár, ugyanaz az
   osztály, amit a `today.md` §3 már dokumentál.
9. **`useDualQuery` kötelező** minden olvasásra, explicit `realEmpty`-vel; a
   `data/dualMode.guard.test.ts` az egész `src`-t ellenőrzi.
10. **CODEMAP-kapu** — `node scripts/gen-codemap.mjs --check`, új komponens esetén
    `docs/CODEMAP.md` ugyanabban a changeben.
11. **Backend érintés nincs** → nincs contract-drift, nincs IT-suite kitettség,
    nincs ArchUnit.

**Doksi-elavulás, ugyanebben a changeben javítandó:**
`docs/features/today.md` §2, 6. elem azt írja, a `nap-avatar` az `i-mezo` clay ikont
rendereli — valójában `ClaySpot name="s-orb"` (`AppHeader.tsx:154`). Épp ez az elem
cserélődik.

## Ami szándékosan kimarad (YAGNI)

- Nincs badge-pötty, nincs olvasott/olvasatlan állapot.
- Nincs csempe egyetlen napszak-mozaikban sem.
- Nincs napszak-függő tartalom vagy szöveg az orbon.
- Nincs új sprite-art a `docs/design_2.0/assets/`-ben.
- A magasság nem súlyozott — ha később kiderül, hogy kell, a pure modul egy paramétere
  lesz, nem újratervezés.

## Jövőbeli becsatlakozás

Egy párhuzamos munka (a nap-oldal 6-dimenziós napi értékelése: determinisztikus
dimenzió-pontok + napzáráskor, lustán generált Mezo-narratíva) explicit
**„kész / még íródik"** állapotot ad dimenziónként. Amikor az landol, a `useDayOrbFill`
tónus-ága arra vált át a `useMeWeek` helyett, és ezzel a `COMPANION_SWITCH`-függés is
megszűnik. A `DayOrb` és a `dayOrbFill` pure modul nem változik.
