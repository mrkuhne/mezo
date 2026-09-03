# Egységes, shell-szintű AppHeader — design

- **bd:** `mezo-atry`
- **Dátum:** 2026-08-30
- **Érintett felület:** frontend PWA app-shell + az öt tab-gyökér + a Nap mozaikok

## Probléma

A felső fejléc-sor (`.nap-head`) ma **nem közös komponens**: mind az öt tab-gyökér külön-külön
bemásolja, és nem ugyanazt a tartalmat:

| Oldal | Fájl | Dátum | Napválasztó | Értesítések | Profil orb |
|---|---|---|---|---|---|
| Nap | `features/today/pages/NapHubPage.tsx` | ✔ | ✔ | ✔ | ✔ |
| Nap (horgony mód) | ugyanott, `scenario.anchorMode` ág | ✔ | ✘ | ✘ | ✔ |
| Edzés | `features/train/pages/EdzesHubPage.tsx` | ✔ | ✘ | ✔ | ✔ |
| Fuel | `features/fuel/pages/FuelMaiPage.tsx` | ✔ | ✘ | ✔ | ✔ |
| Mezo | `features/insights/pages/MezoHubPage.tsx` | ✔ | ✘ | ✔ | ✔ |
| Én | `features/me/pages/EnHubPage.tsx` | ✔ | ✘ | ✔ | ✘ |

A hub-oldalak alatti aloldalakon (`/nap/rutin`, `/fuel/etel`, …) pedig egyáltalán nincs fejléc,
csak a `MozaikPage` + `PageHead` „‹ vissza" chipje.

Ezzel párhuzamosan a Mezo **Üzenetek** felület ma egy mozaik-csempe (`mezoTile`), amely mindhárom
napszak-panelen ismétlődik — így háromszor foglal helyet a mozaikban, miközben egy fejléc-ikon
kevesebb helyért ugyanazt adja.

## Célállapot

Egyetlen, minden oldalon jelen lévő fejléc, fix tartalommal és fix sorrenddel:

```
[ Szombat · aug 30.        ]  (◐ napválasztó)  (✉ üzenetek)  (🔔 értesítések)  (● profil orb)
```

- A napválasztó **minden** oldalon ott van, és bármelyik napszakra kattintva a Nap oldalra navigál.
- Az Üzenetek csempe eltűnik a reggel/napközben/este mozaikokból, helyette a fejléc-karika.

## Döntések

| # | Kérdés | Döntés |
|---|---|---|
| D1 | Hol éljen a fejléc? | Az **app-shellben**, minden oldalon — a tab-gyökereken és az aloldalakon is |
| D2 | A jobb szélső „mezo karika" célja | Marad a jelenlegi profil-orb → `/me` (`aria-label="Profil"`, `i-mezo` clay ikon) |
| D3 | Az Üzenetek-karika viselkedése | Közvetlen navigáció a meglévő `/nap/uzenetek` oldalra (nincs dropdown) |
| D4 | A napszak-választás állapota | Marad az URL-ben (`/nap?dp=`); `/nap`-on kívül a gomb a **valós** napszakot mutatja |

D4 következménye: nincs új globális state, a meglévő `?dp=` deep-linkek változatlanul működnek, és
a fejléc bárhol ugyanabból a két forrásból (`useSearchParams` + `dayFace(now)`) származtatható.

## Architektúra

### Új komponens: `frontend/src/app/AppHeader.tsx`

Az `AppLayout` a `ScreenContent` **első gyerekeként** rendereli, az `Outlet` fölé — tehát a
görgethető területen belül, a jelenlegi (nem tapadó) viselkedést megtartva:

```tsx
<ScreenContent>
  {!hideChrome && <AppHeader />}
  <ErrorBoundary resetKey={location.pathname}>
    <Outlet />
  </ErrorBoundary>
</ScreenContent>
```

A `hideChrome` a már meglévő `hideTabBar` lista: `/train/session`, `/me/sleep/night`, `/ritual`.
A változó átnevezésre kerül `hideChrome`-ra, mert immár három fogyasztója van (TabBar,
QuickLogFab, AppHeader). Az `AppHeader` gyökere `.nap-head.app-head`, ahol az `.app-head` egyetlen
dolgot ad hozzá — `padding-top: 6px; margin-bottom: 13px` —, azt a függőleges ritmust, amit eddig a
`.nap-hub { padding: 6px 0 8px; gap: 13px }` adott a fejlécnek. Az öt hub-konténer paddingje és
gapje változatlan marad (a maradék tartalomra továbbra is érvényes).

A komponens **maga hordozza az adatait** — a hub-oldalaknak semmit nem kell lefelé adniuk:

| Adat | Hook | Mire kell |
|---|---|---|
| `today.dayLabel`, `today.dateLabel` | `useToday()` | dátum-eyebrow |
| `sleepGoal` + perc-tick | `useSleepGoal()`, `useMinuteTick()` | `dayFace(now, goal)` = valós napszak |
| `notifications` | `useNotificationFeed()` | csengő badge + dropdown |
| companion feed + scenario | `useCompanionFeed()`, `useTodayScenario()` | `buildMezoMessages` → olvasatlan-szám |

Mindegyik React Query-cache-elt vagy tisztán derivált, tehát a shellbe emelés nem jelent plusz
hálózati kört; a hub-oldalakról ugyanezek a hívások eltűnnek.

### A fejléc anatómiája

A meglévő CSS-recept (`.nap-head`, `.nap-head-grow`, `.nap-dpwrap`, `.nap-roundbtn`, `.nap-badge`,
`.nap-dpmenu`, `.nap-ntfmenu`, `.nap-avatar`) **változatlan** — csak egy helyre költözik. Új CSS
nem kell; az Üzenetek-gomb a `.nap-roundbtn` + `.nap-badge` párost használja újra.

1. **Dátum-eyebrow** — `.nap-head-grow > .mz-eyebrow`, `{dayLabel} · {dateLabel}`
2. **Napválasztó** — `.nap-roundbtn`, `aria-label="Napszak váltása"`, a megjelenített napszak clay
   ikonjával (`i-hajnal` / `i-nap` / `i-alvas`); lenyíló `.nap-dpmenu` a három napszakkal
3. **Üzenetek** — `.nap-roundbtn`, `i-level` ikon + `.nap-badge` az olvasatlan-számmal;
   `aria-label` = `Mezo üzenetei` vagy `Mezo üzenetei, N olvasatlan`; `navigate('/nap/uzenetek')`
4. **Értesítések** — `.nap-roundbtn`, `i-ertesites` + `.nap-badge`; a meglévő `.nap-ntfmenu`
   dropdown (utolsó 3 elem + „Összes értesítés ›" → `/me/ertesitesek`)
5. **Profil orb** — `.nap-avatar`, `i-mezo` ikon, `aria-label="Profil"` → `/me`

A két dropdown (napválasztó, értesítések) kölcsönösen kizáró: az egyik megnyitása bezárja a
másikat. Útvonalváltáskor mindkettő bezárul (`useEffect` a `location.pathname`-re) — a shellben
élő fejléc nem remountol navigációkor, tehát erről külön kell gondoskodni.

### Napszak-választó logika

```
megjelenítettFace = (pathname === '/nap' && isFace(params.dp)) ? params.dp : nowFace
```

- Az „eltértél a mostanitól" pötty (`.nap-offnow`) **csak** `/nap`-on jelenik meg, ahol jelentése van.
- Napszakra kattintva:
  - ha `f === nowFace` → `navigate('/nap')`
  - egyébként → `navigate('/nap?dp=' + f)`
- Bármely oldalról (Edzés, Fuel, Mezo, Én, aloldalak) ez a Nap oldalra dob — ez a kért viselkedés.

A `NapHubPage` továbbra is a `?dp=` paraméterből olvassa a megjelenítendő panelt; a `setFace`
helper és a `dpOpen` state onnan törlődik.

### Olvasatlan-üzenet számláló

A jelenlegi `useMemo`-s számítás localStorage-ból olvas (`lastSeenMessage(date)`), és csak a
`[date, messages]` függőségekre fut újra. A hub-oldalon ez működött, mert az oldal remountolt;
a shellben élő fejléc **nem** remountol, ezért az `/nap/uzenetek`-ről visszatérve beragadna a
badge. A memo függőségei közé bekerül a `location.pathname`, így minden navigáció után frissül.

### Törlések

| Fájl | Mit |
|---|---|
| `features/today/pages/NapHubPage.tsx` | mindkét `.nap-head` blokk (normál + horgony ág), `dpOpen`/`ntfOpen` state, `setFace`, `mezoTile` helper és három hívása, feleslegessé vált importok |
| `features/train/pages/EdzesHubPage.tsx` | `.nap-head` blokk, `ntfOpen`, `unreadNtf`, `useNotificationFeed` import |
| `features/fuel/pages/FuelMaiPage.tsx` | ugyanaz |
| `features/insights/pages/MezoHubPage.tsx` | ugyanaz |
| `features/me/pages/EnHubPage.tsx` | ugyanaz |

A `mezoTile` eltávolítása után a három mozaik belépő-animációs késleltetései (`--d`) újra
sorszámozódnak, hogy ne maradjon lyuk a kaszkádban (reggel `70ms`, napközben `270ms`,
este `190ms` volt a törölt csempéé).

## Tesztek

- **`app/hubHeaders.test.tsx`** (átírva) — a `.nap-head` már nem az öt hub-oldal felelőssége,
  hanem a shellé. Amit pinnel: mind az öt tab-útvonalon **pontosan egy** `.nap-head` van, benne
  mind a négy kontroll (napválasztó, üzenetek, értesítések, profil orb); egy aloldalon
  (`/nap/rutin`) is ott van; a chrome-mentes útvonalakon (`/train/session`, `/me/sleep/night`,
  `/ritual`) nincs.
- **`app/AppHeader.test.tsx`** (új) —
  - `/fuel`-ről az „Este" napszakra kattintva `/nap?dp=este`-re navigál;
  - a valós napszakra kattintva `?dp=` nélküli `/nap`-ra;
  - `/nap?dp=este`-n a gomb az `i-alvas` ikont és az `.nap-offnow` pöttyöt mutatja, `/fuel`-en
    pedig a valós napszakot, pötty nélkül;
  - az Üzenetek gomb `/nap/uzenetek`-re visz, és a badge az olvasatlan-számot mutatja;
  - a napválasztó megnyitása bezárja az értesítés-dropdownt és fordítva.
- **`features/today/pages/NapHubPage.test.tsx`** — mindhárom napszakon nincs „Üzenetek ›" csempe.
- A meglévő hub-oldal tesztek (`FuelMaiPage.test.tsx` stb.) `.nap-head`-re hivatkozó assertjei a
  shell-render felé igazítva.

## Amit ez a spec NEM tartalmaz

- A fejléc **nem** lesz sticky/fixed — együtt görög a tartalommal, ahogy ma is.
- Az aloldalak `PageHead` „‹ vissza" chipje **marad**; a globális fejléc fölötte ül. A két sor
  vizuális összehangolása (ha kell) külön kör.
- A `MezoMessagesSheet` / `/nap/uzenetek` oldal tartalma változatlan.
