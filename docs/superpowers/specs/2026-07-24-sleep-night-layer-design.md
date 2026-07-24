# Sleep slice C-éj — Esti wind-down réteg + éjszakai eszköztár + cirkadián téma

> **Status: APPROVED (D1–D9)** · bd **`mezo-d71m`** · branch `feat/sleep-night` · 2026-07-24
> A sleep+routine cluster **slice C első szelete** (a [cluster-notes](2026-07-23-sleep-routine-cluster-notes.md) §4
> "buildable affordances" listájából a C1 esti + C2 éjszakai réteg EGY szeletben — user-döntés).
> Vizuális melléklet (brainstorm visual-companion körökben jóváhagyva):
> [`2026-07-24-sleep-night-layer-mockup.html`](2026-07-24-sleep-night-layer-mockup.html).

## 1. Kontextus és cél

A Walker-videó (cluster-notes §1/§4) gyakorlati rétegei közül ez a szelet a **napi értéket adó
este/éjszaka élményt** építi meg a már landolt alvás-alapokra: a slice A day-anchorra
(`useSleepGoal()` — bed/wake mindig létezik: mock seed vagy backend config-ghost) és a meglévő
`wind_down` EVENING habitra (MANUAL, `habit.md`). **PWA push-notification nincs** (habit spec §10
halasztott), ezért minden „nudge" **idő-kapuzott in-app felület**.

Három pillér: **(1)** a Today esti sávja (`WindDownBanner` — T-90 tompítás → T-60 wind-down →
éjszakai belépő), **(2)** a full-screen extra-sötét **`NightPage`** az egyesített 20 perces
szabállyal + 3 calm-eszközzel, **(3)** a **cirkadián auto-téma** (a user saját ötlete a brainstorm
alatt): este a tompítással sötétre, reggel ébredés előtt 30 perccel világosra.

## 2. Döntések (D1–D9)

- **D1 — Scope: C1+C2 egyben, tisztán FE-szelet.** Nincs backend/contract/migráció-változás: a
  bed/wake horgony `useSleepGoal()`-ból, a wind-down pipa a meglévő habit API-n
  (`POST /api/habit/wind_down/check`), az éjszakai nyom localStorage. **C3** (tudás/motivációs
  stat-kártyák + eszkalációs kártya), **C4** (sleep-banking), **C5** (7 napos A/B kísérlet) külön
  szeletek maradnak a cluster-notes §4 tartalékában.
- **D2 — `WindDownBanner` a Today-en, fázisokkal, a `wind_down` habitot hordozva.** Új
  `features/today/components/WindDownBanner.tsx`, közvetlenül az `IntentionBanner` alá mountolva
  (`TodayPage`). Fázisok a bed-horgonyból: **`dim`** `[bed−90, bed−60)` — „Tompítsd a fényeket"
  (30 lux alá · meleg/sárga fény · szoba 18 °C felé + a **+18% REM** stat-sor); **`winddown`**
  `[bed−60, bed)` — „Kapcsolj le" (képernyők le) + a `wind_down` habit-sor Pipával; **`night`**
  `[bed, wake−30)` — lásd D3; egyébként **`none`** (nem renderel). A lefekvésig hátralévő időt
  mutatja („🛏️ még N p" — a no-countdown szabály az éjszakai elalvásra vonatkozik, nem erre). A
  Pipa `useHabitActions(today).check('wind_down')` — a közös `['habitDay', date]` cache-en át a
  `RoutineCard`-dal automatikusan szinkron; a write `levelUps[0]`-ját a bannernek is fel kell
  színre vinnie (`useLevelUp().showLevelUp`, HABIT meta — a RoutineCard manual-check mintája). Ha
  a habit már `done`: kompakt ✓ állapot („Leállás megvolt…"). **Ghost-szabályok:** real módban a
  goal-resolve előtt `null`; ha a habit-sor nem létezik (switch off), a banner fázis-tartalma
  renderel, csak a Pipa-doboz marad el.
- **D3 — A banner 3. fázisa = éjszakai belépő; + állandó chip az Alvás oldalon.** A `night`
  fázisban a banner kompakt, sötét-tónusú „🌙 Éjszakai mód" sorrá válik → `/me/sleep/night`
  (copy: „Felébredtél? Ne nézd az órát — gyere ide."). Emellett a `SleepPage`-en a cél-kártya
  alatt egy **állandó** (napközben is látható) éjszakai-mód belépő sor — felfedezhetőség +
  tesztelhetőség.
- **D4 — `NightPage`: full-screen, témától függetlenül extra-sötét, óra nélkül.** Route:
  `me/sleep/night` **sibling full page** (a `train/session` idióma, nem a `me` csoport gyereke —
  nincs `MeSection`/`AppHero` chrome), és az `AppLayout` `hideTabBar`-ja kiterjed rá. Saját
  `.night` CSS-scope a `prototype.css`-ben **literál színekkel** (nem téma-tokenekkel — a
  cirkadián/light téma nem érinti): közel-fekete vászon (`#0E0B09`), tompa meleg szöveg, halvány
  lavender akcentus alacsony opacitással, nagy érintőfelületek, **sehol óra/számjegy**,
  `prefers-reduced-motion` tisztelete. Kilépés: „← vissza" → `/me/sleep`.
- **D5 — Egyesített 20 perces flow (számjegy nélküli őr-timer).** Állapotgép
  (`features/me/logic/nightFlow.ts`, pure, injektálható now): `idle` („Felébredtél?" + nagy
  **„Ébren vagyok"** CTA + halk „csak körülnézek") → `waiting` (nyugodt, lélegző fény-orb, semmi
  szám/progress; az őr-timer **belépési timestamp-differenciából** számol — `NIGHT_WATCHDOG_MIN
  = 20`, egy ~15 mp-es interval csak összehasonlít, így képernyő-altatást túlél) → ~20 perc után
  **`getUp`**: szelíd átváltás („Kelj fel — ez most a jobb út": félhomályos hely · csendes
  elfoglaltság papírról/podcast · csak álmosan vissza; se hang, se rezgés), rajta
  **„Visszafeküdtem"** (→ új `waiting` kör friss timestamppel) és „elalszom · kilépek" (→
  `/me/sleep`). A toolkit-eszközök a `waiting`-ből nyílnak (`tool: null | 'breathing' |
  'bodyscan' | 'walk'`), az őr-timer közben fut tovább.
- **D6 — Calm-toolkit: 3 eszköz, vegyes formátum, audio nélkül** (copy:
  `features/me/logic/nightContent.ts`, minden HU):
  - **Légzés-pacer:** animált kör, 18 mp-es ciklus — **be 5 s** (nő) · **tartsd 6 s** · **ki 7 s**
    (zsugorodik), „Be… · Tartsd… · Ki…" felirat; CSS-animáció; reduced-motion → a skála-animáció
    kikapcsol, a fázis-feliratok maradnak. Megállításig fut.
  - **Testpásztázás:** ~10 lépés fejtől lábujjig, lépésenként ~40 mp auto-léptetés lassú
    crossfade-del, koppintásra léptethető; pozíció-jelzés halvány pöttyökkel (nem szám).
  - **4K-séta:** felkészítő kártya („Válassz egy jól ismert utat…") + 3–4 nagyon lassan (~90 mp)
    váltó, szelíd emlékeztető kártya az önnarráláshoz (Alison Harvey módszere — az app keretet
    ad, nem narrál). Guided meditation eszköz **nincs** (audio nélkül gyenge — elengedve).
- **D7 — Soft éjszakai nyom + reggeli előtöltés (localStorage, backend nélkül).**
  `features/me/logic/nightTrace.ts`: az „Ébren vagyok" megnyomása (waiting-be lépés) jegyet ír —
  kulcs `mezo-night-wake:<ISO dátum>`, érték `{count, lastAt}`; a dátum a **reggel dátuma**
  (18:00 utáni óra → másnap, egyébként aznap); íráskor a 3 napnál öregebb kulcsok takarítása. A
  `SleepLogSheet` (Kézi mód) a kiválasztott dátumhoz olvassa: ha van jegy és a user még nem
  nyúlt az ébredések mezőhöz → **előtölt `min(count, 4)`-re** + halk wash-lav hint sor („Az éjjel
  n× jártál az éjszakai módban — előtöltöttem. Írd felül, ha máshogy emlékszel."); kézi állítás
  felülírja; **sikeres mentés → a jegy törlődik**.
- **D8 — Idő-kezelés + tesztelés.** A banner/belépő **valós faliórát** használ mindkét módban (a
  `RoutineCard` `daypartNow` precedense); a fázis-logika (`features/today/logic/windDown.ts`)
  pure és injektált `now`+`goal` paraméterű — **éjfél-átfordulás-tudatos** (moduló-1440
  ablak-tartalmazás: pl. bed 00:15 → dim 22:45-től). A banner ~30 mp-es tickkel újraszámol.
  Teszt-térkép: §6.
- **D9 — Cirkadián auto-téma (default).** `shared/lib/theme.ts`: a tárolt érték **`ThemeMode =
  'light' | 'dark' | 'auto'`**-ra bővül, **`DEFAULT_MODE = 'auto'`**; a régi tárolt
  'light'/'dark' érvényes mód marad (kézi választás = auto kikapcsolva). Auto módban a
  megjelenített téma: **dark a `[bed−90, wake−30)` ablakban** (wrap-tudatos, ugyanaz a pure
  ablak-matek mint D2 — közös modul, nincs két időszámítás), egyébként light; percenkénti tick +
  a sleep-goal változására újraszámol. A resolvert egy, a data-providerek alatt mountolt kis
  effect-komponens hajtja (a `ThemeProvider` a resolved témát alkalmazza — pontos illesztés a
  plan dolga; a `ThemeProvider` jelenleg a QueryClient felett ül). A `SettingsSheet` téma-sora
  3-opciós választó lesz: Világos / Sötét / **Cirkadián** (magyarázó sorral). A PWA
  `theme-color` meta követi a resolved témát (`applyTheme` már kezeli). A NightPage-et nem
  érinti (D4: literál-sötét). Mock és real módban azonosan működik.

## 3. Amit NEM építünk (Walker-cáfolatok + elhagyások)

A cluster-notes §4 DEBUNK-lista kötelez: **nincs** 90 perces smart-wake, melatonin/magnézium
tartalom, kék-fény-fókusz, birkaszámolás, elalvás-countdown. Ezen felül e szeletben nincs: push
notification, audio-asset, screen wake-lock, éjszakai események backend-naplózása, guided
meditation eszköz.

## 4. Architektúra és fájl-térkép (FE-only)

```
Today
  WindDownBanner  ──reads──  useSleepGoal() + useHabitDay(today) + useHabitActions(today)
       │                        (fázis: logic/windDown.ts — pure, now+goal → phase/minsToBed)
       └─ night fázis → Link /me/sleep/night

NightPage (/me/sleep/night, sibling route, hideTabBar)
  nightFlow.ts (állapotgép + őr-timer helper)  ·  nightContent.ts (copy)  ·  nightTrace.ts (localStorage)
  NightBreathing / NightBodyScan / NightWalk  (features/me/components/)

SleepLogSheet ──reads/clears── nightTrace (ébredések előtöltés + hint)
SleepPage ── állandó „Éjszakai mód" belépő sor

ThemeProvider (mode: light|dark|auto) ◄── CircadianTheme effect (useSleepGoal + tick)
SettingsSheet ── 3-opciós téma-választó
```

Új fájlok: `features/today/components/WindDownBanner.tsx` · `features/today/logic/windDown.ts` ·
`features/me/pages/NightPage.tsx` · `features/me/components/{NightBreathing,NightBodyScan,NightWalk}.tsx`
· `features/me/logic/{nightFlow,nightContent,nightTrace}.ts` (+ tesztek). Módosul:
`TodayPage.tsx` (mount) · `app/router.tsx` (route) · `app/AppLayout.tsx` (hideTabBar) ·
`app/ThemeProvider.tsx` + `shared/lib/theme.ts` (mode) · `features/me/sheets/SettingsSheet.tsx`
(választó) · `features/me/sheets/SleepLogSheet.tsx` (előtöltés) · `features/me/pages/SleepPage.tsx`
(belépő sor) · `styles/prototype.css` (`.wdb*`/`.night*` családok). Konstansok (FE): T-90/T-60,
wake−30, `NIGHT_WATCHDOG_MIN=20`, body-scan/walk ütemek — a `windDown.ts`/`nightFlow.ts` exportjai.

## 5. Edge-esetek

- **Éjfél-átfordulás:** minden ablak (`dim`/`winddown`/`night`/dark-téma) moduló-1440 percben
  számolt, wrap-tudatos tartalmazással; bed 00:15 → dim 22:45–23:15, winddown 23:15–00:15.
- **Nincs sleep-goal sor (real):** a config-ghost miatt `useSleepGoal` mindig ad horgonyt
  (22:00/06:00 default) — a banner/téma ezekre esik vissza; resolve előtt a banner `null`, a téma
  a legutóbb resolved értéken marad (nincs villanás).
- **Habit switch off (real):** a banner Pipa-doboz nélkül renderel (D2 ghost-szabály).
- **Éjfél utáni winddown-fázis (bed 00:15 eset):** a Pipa az **új naptári nap** `wind_down`
  sorát checkolja (`localDateString()`), pontosan úgy, ahogy a meglévő `RoutineCard` esti lánca
  is az új nap habitjait mutatja 00:00 után (az `este` daypart 03:59-ig tart) — tudatosan a
  meglévő viselkedéssel konzisztens, nem újraértelmezett.
- **NightPage nappal megnyitva** (SleepPage chipről): ugyanúgy működik — az idle képernyő
  semleges („Felébredtél?" helyett is értelmes a „csak körülnézek" út); nem idő-kapuzott.
- **Őr-timer háttérben:** timestamp-differencia — ha a képernyő 15 percet aludt, ébredéskor a
  következő interval-tick azonnal `getUp`-ra vált, ha letelt.
- **Trace ugyanarra a reggelre többször:** `count` inkrementálódik; a prefill `min(count,4)`.
- **A user előbb állítja az ébredéseket, aztán jönne a prefill:** kézi érték nyer, prefill csak
  érintetlen mezőre (dirty-flag).
- **Cirkadián + kézi váltás:** a SettingsSheet-ben Világos/Sötét választása kilép az auto-ból;
  vissza-váltás Cirkadiánra újra követi az ablakot.

## 6. Tesztelés

- **`windDown.test.ts`:** fázis-határok (T-90/T-60/bed/wake−30, határ-inkluzivitás), éjfél-wrap
  (bed 00:15 és wake 04:30 esetek), `minsToBed`, `none` napközben.
- **`WindDownBanner.test.tsx`:** mindhárom fázis renderel (injektált idővel), Pipa → mock check +
  cache-patch, done ✓ állapot, ghost-ágak (pending goal / hiányzó habit-sor), night fázis link.
- **`nightFlow` + NightPage tesztek:** állapotgép-átmenetek fake-timerrel (idle→waiting→getUp
  20 perckor; „Visszafeküdtem" → friss kör), timestamp-robusztusság (nagy ugrás egy tickben),
  eszköz-alállapotok nyitása/zárása, trace-írás a waiting-be lépéskor.
- **`nightTrace.test.ts`:** dátum-hozzárendelés (18:00 szabály, éjfél után), inkrement, prune
  (>3 nap), clear.
- **`theme.test.ts` bővítés:** mode-perzisztencia + migráció (régi 'light'/'dark' érték), auto
  resolution ablak-határai (wrap-pal), default `auto`.
- **`SleepLogSheet` teszt-bővítés:** prefill + hint jegy esetén, kézi felülírás nyer, mentés
  törli a jegyet — mindkét módban.
- **Kapu:** `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` (mindkét mód
  zöld); backend-teszt nem érintett (FE-only). **Runtime-verify** a mock FE-n chrome-devtools-szal
  (a `verify` skill szerint); az időfüggő ágak kézzel/CDP-vel meghajtva.

## 7. Élő doksik (az implementációs change része)

`me.md` (Alvás § — NightPage + belépő sor + SleepLogSheet előtöltés; Settings téma-választó) ·
`today.md` (WindDownBanner) · `habit.md` §5/§9 (a banner mint a `wind_down` második felülete) ·
`_platform-design-system.md` (`.wdb`/`.night` CSS-családok + téma-mode) · cluster-notes §0/§3/§4/§5
(C-éj landolt; C3–C5 tartalék) · `node scripts/lint-docs.mjs` zöldre.

## 8. Elhalasztva / follow-up

- **C3** — tudás/motivációs stat-kártyák + eszkalációs kártya (cluster-notes §4 statok).
- **C4** — sleep-banking mód (sleep-goal ideiglenes override → backend).
- **C5** — 7 napos A/B önkísérlet állvány (új aggregátum + mérés).
- Screen wake-lock a NightPage-en; PWA push (cluster-szintű halasztott); éjszakai események
  backend-naplózása (ha a C5 igényli, ott).
