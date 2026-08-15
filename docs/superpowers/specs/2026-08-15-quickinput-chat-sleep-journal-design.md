# Gyors logolás (+ gomb) — chat, alvás, napló + közvetlen sheet-nyitás (design)

**Dátum:** 2026-08-15 · **Státusz:** approved design (brainstorm)
**bd:** `mezo-967c` · **Érintett feature-doc:** `docs/features/_platform-design-system.md` (§Shell ↔ QuickInput)

## 1. Probléma

A társsal való beszélgetés (`/insights/chat`) mélyen el van dugva: a Today fejlécének ✨ ikonja →
Insights → al-navigáció → Chat. Ez a termék egyik központi felülete, mégis három koppintás és egy
almenü választja el a felhasználótól.

Emellett a középső `+` gomb `QuickInputSheet`-je a saját ígéretét („bármikor, két koppintás") nem
váltja be: mind a hat csempéje **csak navigál** egy oldalra, ahol a felhasználónak meg kell keresnie
a tényleges log-felületet. Két gyakori log-forma pedig teljesen hiányzik a menüből: az **alvás**
(csak `/me/sleep`-ről vagy a Today esti kártyájáról érhető el) és a **szabad szöveges napló**
(`ActivityLogSheet` — csak a Today tevékenység-kártyájáról és a Rituáléból).

**Tisztázás — „napló" vs „hála":** a kódbázisban **nincs hála-funkció** (semmilyen `hála`/`gratitude`
találat). A meglévő szabad szöveges bejegyzés az `ActivityLogSheet` („Tevékenységnapló"), ami skill-XP-t
is oszt. Ez lesz a menü „Napló" opciója; hála-feature nem készül ebben a körben.

## 2. Cél / nem cél

**Cél:** a `+` menü legyen a napi rögzítés egyetlen belépőpontja — a chat kiemelt helyre kerül, az
alvás és a napló új csempét kap, és a három sheet-alapú akció (Alvás, Napló, Check-in) **helyben,
oldalváltás nélkül** nyílik meg, bármelyik képernyőről.

**Nem cél:** új adatmodell, új backend-végpont, új log-felület megtervezése (mindhárom sheet létezik és
változatlan marad); hála-feature; a `TabBar` vagy a `Sheet` primitív módosítása; a maradék öt navigáló
csempe viselkedésének megváltoztatása.

## 3. Menü-szerkezet

```
┌──────────────────────────────────────┐
│  Gyors logolás                       │
│  bármikor, két koppintás             │
│                                      │
│  ┌────────────────────────────────┐  │  ← kiemelt, teljes szélességű
│  │ 💬  Beszélgetés a társsal      │  │     .quicklog-chat (CTA-gradiens)
│  │     kérdezz, mesélj, tervezz → │  │     → navigál /insights/chat
│  └────────────────────────────────┘  │
│                                      │
│  🍽 Étkezés   🏋️ Edzés    💧 Víz     │  ← 8 csempe, 3 oszlop
│  ⚖️ Súly      💊 Stack    ❤️ Check-in│     (az utolsó sor középre zárva)
│      😴 Alvás      📓 Napló          │
└──────────────────────────────────────┘
```

**Csempék és viselkedésük** (a `sub` hint-szöveg zárójelben):

| Csempe | Hint | Akció |
|---|---|---|
| 🍽 Étkezés | recept vagy szabad | navigál `/fuel` |
| 🏋️ Edzés | indítás · jegyzet | navigál `/train` |
| 💧 Víz | +250 ml | navigál `/fuel` |
| ⚖️ Súly | reggeli mérés | navigál `/me/weight` |
| 💊 Stack | bevettem | navigál `/fuel/stack` |
| ❤️ Check-in | *dinamikus, lásd §4.3* | **sheet** (vagy navigál, ha ma már mind kész) |
| 😴 Alvás | az éjszakád | **sheet** — `SleepLogSheet` |
| 📓 Napló | egy mondat a napról | **sheet** — `ActivityLogSheet` |

A Chat azért kiemelt sor és nem a kilencedik csempe, mert (a) ez a menü egyetlen „beszélgetés" jellegű
belépője a nyolc rögzítő akció mellett, és (b) épp az elrejtettsége a megoldandó probléma.

## 4. Implementáció

### 4.1 Fázis-állapot a `QuickInputSheet`-ben

A `TabBar` változatlan: továbbra is csak `QuickInputSheet`-et mount-ol. A sheet kap egy belső fázist:

```ts
type Phase = 'menu' | 'sleep' | 'naplo' | 'checkin'
```

`'menu'` fázisban a saját `<Sheet>`-jét rendereli a ráccsal. A másik három fázisban **a menü helyett**
a cél-sheetet rendereli — sosem egyszerre, mert minden sheet a maga `<Sheet>` primitívjét (portál +
backdrop) hozza, és két egymásra rétegzett backdrop hibás lenne:

```tsx
if (phase === 'sleep')   return <QuickSleepSheet onClose={onClose} />
if (phase === 'naplo')   return <ActivityLogSheet onClose={onClose} />
if (phase === 'checkin' && checkInIdx !== null)
  return <CheckInSheet slot={checkins[checkInIdx]} slotIdx={checkInIdx}
                       onClose={onClose} onSave={d => saveCheckIn(checkInIdx, d)} />
```

A cél-sheet `onClose`-a a `QuickInputSheet` saját `onClose`-a, így a bezárás az egész stacket lebontja —
nincs „vissza a menübe" lépés (a felhasználó a `+`-szal újranyitja, ha mást akar).

A közvetlen-akció csempék **nem** hívják a `Sheet` render-prop `close()`-ját (az animálva unmount-olna
mindent), csak `setPhase(...)`-t. A navigáló csempék és a chat-gomb a jelenlegi
`close(); navigate(...)` mintát tartják.

### 4.2 Sheet-adapterek

- **`ActivityLogSheet`** önellátó (saját hookjai vannak, csak `onClose` kell) — közvetlenül renderelhető.
- **`SleepLogSheet`** `onSave: (input: SleepLogInput) => void`-ot vár, amit a hívó a `useSleep()`-ből ad.
  Hogy a `useSleep()` lekérdezés ne fusson le minden `+` koppintásra, egy 8 soros wrapper viszi:
  `features/quickinput/components/QuickSleepSheet.tsx` — meghívja a `useSleep()`-et és továbbadja a
  `logSleep`-et. Így mindhárom quick-sheet egységesen „csak `onClose`" felületű, és a hook csak akkor
  mount-olódik, amikor tényleg kell.
- **`CheckInSheet`** `slot` + `slotIdx` + `onSave`-et vár. Ehhez az adat **már a menü fázisban** kell
  (lásd §4.3), ezért a `useCheckins()` a `QuickInputSheet`-ben hívódik. Ez nem plusz hálózati kör: a
  Today ugyanezt a query-t tölti, a TanStack Query cache-ből szolgálja ki.

### 4.3 Check-in csempe — dinamikus cél

A `useCheckins()`-ből a **következő kitölthető** slot indexe: `checkins.findIndex(isFillableSlot)`
(`isFillableSlot = c.state !== 'done'` — a Today is pontosan ezt használja).

- **Van kitölthető slot** → hint: az adott slot neve (pl. „reggeli · hogy vagyok"), akció: `CheckInSheet`
  azon a sloton.
- **Ma már mind kész** → hint: „mára mind megvan", akció: a jelenlegi viselkedés, navigál `/today`-re
  (nem tiltjuk le a csempét — a felhasználó megnézheti, mit írt).

### 4.4 Rács-elrendezés (CSS)

A `.quicklog-grid` ma `grid-template-columns: 1fr 1fr 1fr`. Nyolc elemmel az utolsó sor két csempéje
balra tapadna, üres harmadik cellával. Ezért a rács **flex-wrap**-re vált:
`display: flex; flex-wrap: wrap; justify-content: center` + a csempék
`flex: 0 0 calc((100% - 2 * var(--sp-3)) / 3)` — azonos háromoszlopos ritmus, de a hiányos utolsó sor
magától középre zár. Ez elem-szám-független, így egy jövőbeli kilencedik csempe sem igényel CSS-t.

Új osztály a kiemelt chat-sorra: `.quicklog-chat` — teljes szélességű, `--gradient-cta` kitöltés +
`--shadow-cta` (a `.tab-fab` nyelve), balra emoji-pajzs, jobbra nyíl, `np-press` visszajelzés.

## 5. Tesztek

A meglévő `QuickInputSheet.test.tsx` bővül (a jelenlegi két teszt marad, a „six tiles" nyolcra nő):

1. a chat-gomb bezárja a sheetet és `/insights/chat`-ra navigál;
2. az Alvás csempe az alvás-sheetet nyitja a menü helyén (a menü címe eltűnik) — `onClose` **nem** hívódik;
3. a Napló csempe az `ActivityLogSheet`-et nyitja;
4. a Check-in csempe kitölthető slot esetén a `CheckInSheet`-et nyitja;
5. minden slot `done` állapotában a Check-in csempe `/today`-re navigál.

A sheet-nyitó tesztek a repo bevett mintáját követik (`ActivityLogSheet.test.tsx`): a `@/data/hooks`
szükséges hookjai (`useCheckins`, `useSleep`, `useActivityActions`) `vi.mock` + `importOriginal`
kombinációval cserélődnek, a fa pedig `makeHookWrapper()` (`@/test/queryWrapper`) QueryClientjében
renderelődik. Az `ActivityLogSheet` a `LevelUpProvider` alatt vár renderelést — az appban ezt az
`AppLayout` adja (a `TabBar` alatta van), a tesztben explicit be kell csomagolni. Mindkét módban
(`pnpm test` + `VITE_USE_MOCK=true pnpm test`) zölden.

## 6. Kockázatok

- **Két sheet egymáson.** A fázis-váltásnál a menü unmount-ol, mielőtt a cél-sheet mount-ol — a `return`
  ágak kizárják az átfedést. A menü nem játssza le a kifutó animációját (nincs `close()` hívás), a
  cél-sheet a szokásos felcsúszással érkezik; ez a „csere" érzet szándékos.
- **`useCheckins()` a menüben.** Ha a query még tölt, `checkins` üres → a Check-in csempe a „mind kész"
  ágra esne. Ezért a hint/akció döntése a betöltés alatt a **navigáló** fallback marad (ez a jelenlegi,
  változatlan viselkedés), és csak betöltött adatnál nyit sheetet.

## 7. Dokumentáció

`docs/features/_platform-design-system.md` §Shell ↔ QuickInput sora frissül (8 csempe + kiemelt chat-sor
+ a három közvetlen sheet-seam), utána `node scripts/lint-docs.mjs`.
