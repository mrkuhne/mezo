# Quick Log csempe-redesign — Implementation Plan (mezo-7lst)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `QuickInputSheet` lapos újratervezése — chat sor a tetejére, a `MOST`-fejléc és a víz duo-csempe helyett 9 egyenrangú csempe 3×3-ban, dinamikus Étkezés csempével és két új helyben-nyíló sheettel (Víz, Sport).

**Architecture:** Tiszta frontend view-réteg. Nincs backend, nincs API-szerződés, nincs új sheet-fájl: a Víz a meglévő `features/fuel/sheets/WaterLogSheet`-et, a Sport a meglévő `features/train/sheets/SportLogSheet`-et nyitja a `QuickInputSheet` bevált **phase-csere** idiómájával (korai `return` egy másik sheettel — sosem `Sheet` a `Sheet`-ben). Az Étkezés csempe a `useFuelPreview()` aktív ablakából épít `/fuel/log/uj?w=<tileKey>` célt.

**Tech Stack:** React 18 + TypeScript, react-router-dom, Vitest + Testing Library + userEvent, TanStack Query (a `QueryWrapper` teszt-burkolón át), CSS a `frontend/src/styles/prototype.css`-ben.

## Global Constraints

- Minden felhasználónak látszó szöveg **magyar**; a számformázás `Intl.NumberFormat('hu-HU')` vagy a `@/shared/lib/huNum` (`hu1`, `huInt`).
- **Sosem két `Sheet` egyszerre.** A `Sheet` saját portált és backdropot hoz; az alfelületek a `phase` állapot korai `return`-jével cserélődnek, és a gyerek sheet a **külső** `onClose`-t kapja.
- Az étkezési ablak azonosítója **mindig** a `tileKey(slot)` a `@/features/fuel/logic/fuelSwimlane`-ből — sosem kézzel összefűzött `` `${time}-${label}` ``.
- Származtatott index/kulcs, ami egy megnyíló gyerek sheetet vezérel, **koppintáskor rögzül** `useState`-be, nem minden rendereléskor számolódik újra (a `mezo-967c` check-in regresszió osztálya).
- Minden koppintható felület `np-press` osztályt visel; ha az elérhető neve nem a szövege, `aria-label` is kell.
- A sheet `h2` címe **`Gyors logolás`** marad — a `TabBar.test.tsx` erre fogódzik.
- Teszt-kapuk **mindkét módban** futnak: `VITE_USE_MOCK` beállítatlanul = mock mód; a valós módú futás `VITE_USE_MOCK=false`.
- Minden parancs a `frontend/` könyvtárból, **abszolút úton** indítva; a `pnpm` a 9-es major.
- Commit-tárgyak: conventional commit + a bd id, pl. `feat(quicklog): ... (mezo-7lst)`.

---

## Fájlstruktúra

| fájl | felelősség | művelet |
|---|---|---|
| `frontend/src/features/quickinput/sheets/QuickInputSheet.tsx` | a Quick Log launcher: cím, chat sor, csemperács, phase-csere | módosítás |
| `frontend/src/features/quickinput/sheets/QuickInputSheet.test.tsx` | a launcher viselkedésének tesztjei | módosítás |
| `frontend/src/app/TabBar.test.tsx` | a FAB → sheet füst-teszt | módosítás |
| `frontend/src/styles/prototype.css` | a `.quicklog*` szabálycsalád | módosítás (törlés) |
| `frontend/src/app/QuickLogFab.tsx` | a FAB; csak az elavult fejléc-komment | módosítás (komment) |
| `docs/features/_platform-design-system.md` | §5 QuickInput integrációs sor, §10 shell-mondat | módosítás |
| `docs/features/fuel.md` | a 39. sor állítása az Étkezés csempéről | módosítás |
| `docs/features/journal.md` | a QuickInput phase-listája | módosítás |

Új fájl nem születik → **CODEMAP-regenerálás nem szükséges**.

---

### Task 1: Chat felülre, MOST-fejléc törlése, dinamikus Étkezés csempe

**Files:**
- Modify: `frontend/src/features/quickinput/sheets/QuickInputSheet.tsx`
- Test: `frontend/src/features/quickinput/sheets/QuickInputSheet.test.tsx`

**Interfaces:**
- Consumes: `useFuelPreview()` → `{ plan: { slots: FuelSlot[] } }` a `@/data/hooks`-ból; `tileKey(slot: FuelSlot): string` a `@/features/fuel/logic/fuelSwimlane`-ből.
- Produces: a `menu` phase új sorrendje (chat sor a `<p className="quicklog-sub">` után, rács utána) és a `foodTarget` string, amit a Task 2/3 rácsa változatlanul továbbvisz.

- [ ] **Step 1: Írd meg a bukó teszteket**

A `QuickInputSheet.test.tsx`-ben **töröld** ezt a két tesztet:
- `'the MOST head shows the current eating window and Logold navigates to Fuel'`
- `'without a now-window the MOST head renders nothing (honest state)'`

A helyükre írd be:

```tsx
test('the Étkezés tile routes to the active window’s log page', async () => {
  const onClose = vi.fn()
  renderSheet(onClose)
  await userEvent.click(screen.getByRole('button', { name: /Étkezés/ }))
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
  expect(screen.getByTestId('loc')).toHaveTextContent('/fuel/log/uj')
  expect(screen.getByTestId('search')).toHaveTextContent('?w=13%3A30-Eb%C3%A9d-ablak')
})

test('without a now-window the Étkezés tile routes to free-item logging', async () => {
  fuelPreviewMock.useFuelPreview.mockReturnValue({ visible: [], nextStack: undefined, plan: { slots: [] } })
  const onClose = vi.fn()
  renderSheet(onClose)
  expect(screen.getByText('ablakon kívül is')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Étkezés/ }))
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
  expect(screen.getByTestId('loc')).toHaveTextContent('/fuel/log/uj')
  expect(screen.getByTestId('search').textContent).toBe('')
})

test('the Étkezés tile’s subline names the active window', () => {
  renderSheet()
  expect(screen.getByText('MOST · Ebéd-ablak')).toBeInTheDocument()
})
```

A `LocationProbe` ma csak a `pathname`-et írja ki — bővítsd a query stringgel, hogy a `?w=`
állítható legyen. Cseréld le a meglévő `LocationProbe`-ot erre:

```tsx
function LocationProbe() {
  const loc = useLocation()
  return (
    <>
      <div data-testid="loc">{loc.pathname}</div>
      <div data-testid="search">{loc.search}</div>
    </>
  )
}
```

- [ ] **Step 2: Futtasd a teszteket, győződj meg róla, hogy buknak**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/workout-message-bug-29e351/frontend && pnpm vitest run src/features/quickinput/sheets/QuickInputSheet.test.tsx
```

Várt: a három új teszt bukik — az Étkezés csempe ma `/fuel`-ra navigál, és nincs `MOST · Ebéd-ablak` alszöveg.

- [ ] **Step 3: Írd meg a minimális implementációt**

A `QuickInputSheet.tsx`-ben adj hozzá egy importot a többi `@/features/...` import mellé:

```tsx
import { tileKey } from '@/features/fuel/logic/fuelSwimlane'
```

A `nowWindow` derivációja alá (a `const { fuel } = useFuelDay()` sor elé) vedd fel a cél kiszámítását:

```tsx
// A dinamikus Étkezés csempe: a hely, az ikon és a címke FIX — csak az alszöveg és a cél
// változik (CHI 2008, Gajos: az adaptáció akkor nem dezorientál, ha leíró és nem jósló).
// Az ablak azonosítója a swimlane exportált `tileKey`-e, a `/fuel/log/uj?w=` másik végének
// szerződése; ismeretlen/hiányzó kulcs ott a becsületes „Ablakon kívül" ág.
const foodTarget = nowWindow ? `/fuel/log/uj?w=${encodeURIComponent(tileKey(nowWindow))}` : '/fuel/log/uj'
const foodSub = nowWindow ? `MOST · ${nowWindow.label}` : 'ablakon kívül is'
```

Töröld a teljes `{nowWindow && (<button className="quicklog-most" …>…</button>)}` blokkot.

Mozgasd a `<button className="quicklog-chat" …>…</button>` blokkot a `<p className="quicklog-sub">bármikor, két koppintás</p>` **közvetlenül alá** (a `quicklog-water` blokk elé).

Cseréld az Étkezés csempét erre:

```tsx
<Tile icon="i-fuel" label="Étkezés" tone="coral" sub={foodSub}
  onClick={() => { close(); navigate(foodTarget) }} />
```

- [ ] **Step 4: Futtasd a teszteket, győződj meg róla, hogy zöldek**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/workout-message-bug-29e351/frontend && pnpm vitest run src/features/quickinput/sheets/QuickInputSheet.test.tsx
```

Várt: minden teszt zöld (a `the Mezo row closes the sheet and navigates to the companion chat` is — a chat sor csak elmozdult).

- [ ] **Step 5: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/workout-message-bug-29e351 && git add frontend/src/features/quickinput/sheets/QuickInputSheet.tsx frontend/src/features/quickinput/sheets/QuickInputSheet.test.tsx && git commit -m "feat(quicklog): chat sor felulre, dinamikus Etkezes csempe (mezo-7lst)"
```

---

### Task 2: A Víz duo-csempe helyett normál csempe + mennyiség-választó sheet

**Files:**
- Modify: `frontend/src/features/quickinput/sheets/QuickInputSheet.tsx`
- Test: `frontend/src/features/quickinput/sheets/QuickInputSheet.test.tsx`

**Interfaces:**
- Consumes: `WaterLogSheet` a `@/features/fuel/sheets/WaterLogSheet`-ből, props `{ currentMl: number; targetMl: number; onLog: (ml: number) => void; onClose: () => void }`; `useFuelDay()` → `{ fuel: { consumed: { water }, targets: { water } } }`; `useWaterActions()` → `{ logWater }`.
- Produces: a `Phase` unió `'water'` tagja és a 8 csempés rács `Étkezés · Víz · Stack / Edzés · Súly · Check-in / Napló · Alvás` sorrendben.

- [ ] **Step 1: Írd meg a bukó tesztet**

A `QuickInputSheet.test.tsx` `@/data/hooks` mockjában bővítsd a `useFuelDay`-t targettel (a
`WaterLogSheet` `targetMl`-t is kap):

```tsx
    useFuelDay: () => {
      const [water, setWater] = useState(1850)
      waterStore.set = setWater
      return { fuel: { consumed: { water }, targets: { water: 3000 } } }
    },
```

**Töröld** a `'the Víz chips log in place — the counter updates and the sheet stays open'` tesztet, és írd a helyére:

```tsx
test('the Víz tile opens the amount picker in place and the log lands', async () => {
  const onClose = vi.fn()
  renderSheet(onClose)
  expect(screen.getByText('1850 ml')).toBeInTheDocument() // hu-HU leaves 4-digit numbers ungrouped
  await userEvent.click(screen.getByRole('button', { name: /Víz/ }))
  expect(await screen.findByText('Mennyit ittál?')).toBeInTheDocument()
  expect(screen.queryByText('Gyors logolás')).not.toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: '250 ml' }))
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
})
```

Bővítsd a csempe-listás tesztet a rács tényleges sorrendjére (a teszt neve is javul):

```tsx
test('renders all eight quick-log tiles', () => {
  renderSheet()
  for (const label of ['Étkezés', 'Víz', 'Stack', 'Edzés', 'Súly', 'Check-in', 'Napló', 'Alvás'])
    expect(screen.getByText(label)).toBeInTheDocument()
})
```

És a clay-sprite tesztet a víz szimbólummal:

```tsx
  for (const sym of ['i-suly', 'i-alvas', 'i-naplo', 'i-fuel', 'i-edzes', 'i-stack', 'i-viz']) {
```

- [ ] **Step 2: Futtasd a tesztet, győződj meg róla, hogy bukik**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/workout-message-bug-29e351/frontend && pnpm vitest run src/features/quickinput/sheets/QuickInputSheet.test.tsx
```

Várt: a víz-teszt bukik — nincs `Mennyit ittál?` felület, a `Víz` ma egy `div` fejléc, nem gomb.

- [ ] **Step 3: Írd meg a minimális implementációt**

Import a `QuickInputSheet.tsx` tetején:

```tsx
import { WaterLogSheet } from '@/features/fuel/sheets/WaterLogSheet'
```

Bővítsd a `Phase` uniót:

```tsx
type Phase = 'menu' | 'sleep' | 'naplo-pick' | 'aktivitas' | 'journal' | 'gratitude' | 'checkin' | 'weight' | 'water'
```

A `weight` phase korai `return`-je mellé:

```tsx
  if (phase === 'water') {
    return (
      <WaterLogSheet
        currentMl={fuel.consumed.water}
        targetMl={fuel.targets.water}
        onLog={logWater}
        onClose={onClose}
      />
    )
  }
```

Töröld a `WATER_CHIPS` konstanst és a teljes `<div className="quicklog-water">…</div>` blokkot.

Cseréld a rácsot erre a 8 csempés, végleges sorrendű változatra:

```tsx
              <div className="quicklog-grid">
                <Tile icon="i-fuel" label="Étkezés" tone="coral" sub={foodSub}
                  onClick={() => { close(); navigate(foodTarget) }} />
                <Tile icon="i-viz" label="Víz" tone="sky" sub={`${HU.format(fuel.consumed.water)} ml`}
                  onClick={() => setPhase('water')} />
                <Tile icon="i-stack" label="Stack" tone="gold"
                  onClick={() => { close(); navigate('/fuel/stack') }} />
                <Tile icon="i-edzes" label="Edzés" tone="coral" sub={trainSub} subDone={workoutDone}
                  onClick={() => { close(); navigate('/train') }} />
                <Tile icon="i-suly" label="Súly" tone="sky"
                  sub={latestWeight ? `${HU.format(latestWeight.value)} kg` : undefined}
                  onClick={() => setPhase('weight')} />
                <Tile icon="i-checkin" label="Check-in" tone="rose"
                  sub={nextCheckInIdx >= 0 ? `köv. ${checkins[nextCheckInIdx].time}` : 'ma kész ✓'}
                  subDone={nextCheckInIdx < 0}
                  onClick={() => {
                    if (nextCheckInIdx >= 0) { setCheckInIdx(nextCheckInIdx); setPhase('checkin') }
                    else { close(); navigate('/nap') }
                  }} />
                <Tile icon="i-naplo" label="Napló" tone="sage" sub="3 mód" onClick={() => setPhase('naplo-pick')} />
                <Tile icon="i-alvas" label="Alvás" tone="lav" onClick={() => setPhase('sleep')} />
              </div>
```

- [ ] **Step 4: Futtasd a teszteket, győződj meg róla, hogy zöldek**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/workout-message-bug-29e351/frontend && pnpm vitest run src/features/quickinput/sheets/QuickInputSheet.test.tsx src/features/fuel/sheets/WaterLogSheet.test.tsx
```

Várt: mind zöld — a `WaterLogSheet` saját 7 tesztje is, változatlanul.

- [ ] **Step 5: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/workout-message-bug-29e351 && git add frontend/src/features/quickinput/sheets/QuickInputSheet.tsx frontend/src/features/quickinput/sheets/QuickInputSheet.test.tsx && git commit -m "feat(quicklog): Viz normal csempe, a meglevo WaterLogSheettel (mezo-7lst)"
```

---

### Task 3: Új Sport csempe a meglévő `SportLogSheet`-tel

**Files:**
- Modify: `frontend/src/features/quickinput/sheets/QuickInputSheet.tsx`
- Test: `frontend/src/features/quickinput/sheets/QuickInputSheet.test.tsx`
- Test: `frontend/src/app/TabBar.test.tsx`

**Interfaces:**
- Consumes: `SportLogSheet` a `@/features/train/sheets/SportLogSheet`-ből, props `{ onClose: () => void; onSave?: (input: SportSessionCreateRequest, done: () => void) => void; initialSport?: SportKind; date?: string }`; `useTrain()` → `{ sport: { sessions: SportSession[] }, logSportSession }` a `@/data/hooks`-ból; `useLevelUp()` → `{ showLevelUp }` a `@/features/progression/LevelUpProvider`-ből; `SPORT_LABELS` a `@/features/train/logic/sportKinds`-ból; `localDateString` a `@/shared/lib/dates`-ből.
- Produces: a `Phase` unió `'sport'` tagja és a végleges 9 csempés rács.

- [ ] **Step 1: Írd meg a bukó teszteket**

A `QuickInputSheet.test.tsx` `@/data/hooks` mockjába vedd fel a `useTrain`-t (a mock objektum
utolsó bejegyzése után):

```tsx
    useTrain: () => ({
      sport: {
        sessions: [
          { id: 's1', sport: 'volleyball', isoDate: '2026-05-22', duration: 60 },
          { id: 's2', sport: 'volleyball', isoDate: localDateString(), duration: 90 },
        ],
      },
      logSportSession: vi.fn(),
    }),
```

és a fájl tetején add hozzá az importot:

```tsx
import { localDateString } from '@/shared/lib/dates'
```

Frissítsd a csempe-listás tesztet a kilencedik csempével:

```tsx
test('renders all nine quick-log tiles', () => {
  renderSheet()
  for (const label of ['Étkezés', 'Víz', 'Stack', 'Edzés', 'Sport', 'Súly', 'Check-in', 'Napló', 'Alvás'])
    expect(screen.getByText(label)).toBeInTheDocument()
})
```

a clay-sprite tesztet a sport szimbólummal:

```tsx
  for (const sym of ['i-suly', 'i-alvas', 'i-naplo', 'i-fuel', 'i-edzes', 'i-stack', 'i-viz', 'i-sport']) {
```

és írd meg a két új tesztet:

```tsx
test('the Sport tile swaps the menu for the sport log sheet, without closing', async () => {
  const onClose = vi.fn()
  renderSheet(onClose)
  await userEvent.click(screen.getByRole('button', { name: /Sport/ }))
  expect(await screen.findByText(/Sport log ·/)).toBeInTheDocument()
  expect(screen.queryByText('Gyors logolás')).not.toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
})

test('the Sport tile’s subline reads today’s last session only', () => {
  renderSheet()
  expect(screen.getByText('Röpi · 90p')).toBeInTheDocument()
  expect(screen.queryByText('Röpi · 60p')).not.toBeInTheDocument()
})
```

A `TabBar.test.tsx`-ben a FAB-teszt a `SportLogSheet` `useLevelUp()` hívása miatt providert
igényel. Add hozzá az importot:

```tsx
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
```

és cseréld a `renderAt` helperjét erre:

```tsx
function renderAt(path: string, ui: React.ReactNode) {
  return render(
    <QueryWrapper>
      <LevelUpProvider>
        <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
      </LevelUpProvider>
    </QueryWrapper>,
  )
}
```

- [ ] **Step 2: Futtasd a teszteket, győződj meg róla, hogy buknak**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/workout-message-bug-29e351/frontend && pnpm vitest run src/features/quickinput/sheets/QuickInputSheet.test.tsx src/app/TabBar.test.tsx
```

Várt: a két új Sport-teszt bukik — nincs `Sport` csempe.

- [ ] **Step 3: Írd meg a minimális implementációt**

Importok a `QuickInputSheet.tsx`-ben:

```tsx
import { SportLogSheet } from '@/features/train/sheets/SportLogSheet'
import { SPORT_LABELS, sportOf } from '@/features/train/logic/sportKinds'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import { localDateString } from '@/shared/lib/dates'
```

és a `useTrain` felvétele a meglévő `@/data/hooks` importsorba (a `useToday` mellé).

A `Phase` unió:

```tsx
type Phase = 'menu' | 'sleep' | 'naplo-pick' | 'aktivitas' | 'journal' | 'gratitude' | 'checkin' | 'weight' | 'water' | 'sport'
```

A hookok közé (a `useToday()` sor mellé):

```tsx
  const { sport, logSportSession } = useTrain()
  const { showLevelUp } = useLevelUp()
  // A mai UTOLSÓ sport-session az alszöveghez — múltbeli session sosem szólal meg itt.
  const todaysSport = [...(sport.sessions ?? [])].reverse().find(s => s.isoDate === localDateString())
  const sportSub = todaysSport ? `${SPORT_LABELS[sportOf(todaysSport)]} · ${todaysSport.duration}p` : undefined
```

A `water` phase korai `return`-je mellé:

```tsx
  if (phase === 'sport') {
    return (
      <SportLogSheet
        onClose={onClose}
        onSave={(body, done) =>
          logSportSession(body, { onSuccess: r => showLevelUp(r?.levelUp), onSettled: done })}
      />
    )
  }
```

A rácsban az `Edzés` csempe **után** szúrd be:

```tsx
                <Tile icon="i-sport" label="Sport" tone="rose" sub={sportSub}
                  onClick={() => setPhase('sport')} />
```

- [ ] **Step 4: Futtasd a teszteket, győződj meg róla, hogy zöldek**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/workout-message-bug-29e351/frontend && pnpm vitest run src/features/quickinput/sheets/QuickInputSheet.test.tsx src/app/TabBar.test.tsx src/features/train/pages/SportPage.test.tsx
```

Várt: mind zöld.

- [ ] **Step 5: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/workout-message-bug-29e351 && git add frontend/src/features/quickinput/sheets/QuickInputSheet.tsx frontend/src/features/quickinput/sheets/QuickInputSheet.test.tsx frontend/src/app/TabBar.test.tsx && git commit -m "feat(quicklog): Sport csempe a meglevo SportLogSheettel (mezo-7lst)"
```

---

### Task 4: Halott CSS és elavult kommentek takarítása

**Files:**
- Modify: `frontend/src/styles/prototype.css`
- Modify: `frontend/src/app/QuickLogFab.tsx`
- Modify: `frontend/src/features/quickinput/sheets/QuickInputSheet.tsx` (fejléc-komment)

**Interfaces:**
- Consumes: a Task 1–3 után élő `.quicklog*` osztályok halmaza.
- Produces: semmi új felület — tisztán takarítás.

- [ ] **Step 1: Igazold, hogy a törlendő osztályoknak nincs fogyasztója**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/workout-message-bug-29e351/frontend && grep -rn "quicklog-most\|quicklog-water\|quicklog-chip\|quicklog-emoji" src --include="*.tsx" --include="*.ts"
```

Várt: **nulla találat** (a `prototype.css` nincs a keresésben). Ha bármi találat van, az a Task 1–3 hiányos befejezését jelzi — oda menj vissza, ne törölj CSS-t.

- [ ] **Step 2: Töröld a halott szabálycsaládokat**

A `frontend/src/styles/prototype.css`-ből töröld ezeket a szabályokat teljes egészében:
`.quicklog-emoji`, `.quicklog-most`, `.quicklog-most-text`, `.quicklog-most-row`,
`.quicklog-most-row b`, `.quicklog-most-stamp`, `.quicklog-most-meal`, `.quicklog-most-cta`,
`.quicklog-water`, `.quicklog-water-head`, `.quicklog-water-count`, `.quicklog-water-chips`,
`.quicklog-chip`.

A megmaradó `.quicklog-sub-line` fölötti szekció-kommentet írd át:

```css
/* ── quick-log v2 (mezo-7lst): lapos 3×3 rács, élő sublinekkal ── */
```

és a rács fölötti kommentet:

```css
/* 9 tiles in a 3-wide rhythm; flex (not grid) so a short last row centres itself (mezo-967c) */
```

- [ ] **Step 3: Javítsd az elavult kódkommenteket**

A `frontend/src/app/QuickLogFab.tsx` fejléc-kommentjében cseréld a harmadik-negyedik sort:

```tsx
// Design 2.0 decision B (mezo-d20.1.1): the quick log lives on a floating coral FAB
// bottom-right — the thumb zone on every tab. The sheet's flat 3×3 tile grid is
// mezo-7lst.
```

A `QuickInputSheet.tsx` fájl-fejléc kommentjét cseréld erre:

```tsx
// ============================================================
// Mezo · QuickInputSheet — a Design 2.0 quick-log launcher (mezo-7lst)
// A floating coral FAB mögött, minden tabon. Anatómia:
//   · Chat sor legfelül — a Mezónak mondott logolás a felfedezendő út,
//     ezért kap vizuális elsőbbséget (a rutin-logolás a rács alsó
//     kétharmadában marad, hüvelykujj-közelben).
//   · 9 egyenrangú csempe 3×3-ban, élő sublinekkal.
//   · Étkezés DINAMIKUS: aktív ablakkal a `/fuel/log/uj?w=<tileKey>` logolóba
//     visz, ablak nélkül a szabad tétel ágra. A hely/ikon/címke fix — csak az
//     alszöveg és a cél változik.
//   · Víz / Sport / Súly / Alvás / Napló / Check-in helyben cserélik a sheetet
//     (phase-csere, sosem Sheet a Sheetben); a többi navigál.
// ============================================================
```

- [ ] **Step 4: Futtasd a teljes fókuszált csomagot mindkét módban**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/workout-message-bug-29e351/frontend && pnpm vitest run src/features/quickinput src/app/TabBar.test.tsx src/app/navigation.test.tsx src/features/fuel/sheets/WaterLogSheet.test.tsx
```

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/workout-message-bug-29e351/frontend && VITE_USE_MOCK=false pnpm vitest run src/features/quickinput src/app/TabBar.test.tsx src/app/navigation.test.tsx src/features/fuel/sheets/WaterLogSheet.test.tsx
```

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/workout-message-bug-29e351/frontend && pnpm lint && pnpm build
```

Várt: minden zöld, a build hibátlan.

- [ ] **Step 5: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/workout-message-bug-29e351 && git add frontend/src/styles/prototype.css frontend/src/app/QuickLogFab.tsx frontend/src/features/quickinput/sheets/QuickInputSheet.tsx && git commit -m "refactor(quicklog): halott .quicklog-most/-water CSS es elavult kommentek (mezo-7lst)"
```

---

### Task 5: Dokumentáció-igazítás

**Files:**
- Modify: `docs/features/_platform-design-system.md`
- Modify: `docs/features/fuel.md`
- Modify: `docs/features/journal.md`

**Interfaces:**
- Consumes: a Task 1–4 utáni tényleges viselkedés.
- Produces: semmi kód — a dokumentáció visszaszinkronizálása.

- [ ] **Step 1: Keresd meg a javítandó sorokat**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/workout-message-bug-29e351 && grep -n "QuickInput\|quick-log\|quicklog" docs/features/_platform-design-system.md docs/features/fuel.md docs/features/journal.md
```

- [ ] **Step 2: Írd át a `_platform-design-system.md` §5 QuickInput sorát**

A sor ma azt állítja, hogy a chat a rács **fölött** ül és `/insights/chat`-re visz, hogy **8**
csempe van, hogy a Víz egy egyszerű navigáló csempe a `/fuel`-ra, hogy a Súly a `/me/weight`-re
navigál, és a `Phase` uniót `'gratitude'` és `'weight'` nélkül sorolja. A valóság, amit be kell
írni: a chat sor a **cím alatt, a rács fölött** ül és a **`/mezo/chat`**-re visz; **9** csempe
van 3×3-ban (`Étkezés · Víz · Stack / Edzés · Sport · Súly / Check-in · Napló · Alvás`); a Víz a
`WaterLogSheet`-et, a Sport a `SportLogSheet`-et, a Súly a `WeightLogSheet`-et nyitja **helyben**;
az Étkezés dinamikusan a `/fuel/log/uj?w=<tileKey>` vagy a `/fuel/log/uj` felé visz; a `Phase`
unió teljes listája `'menu' | 'sleep' | 'naplo-pick' | 'aktivitas' | 'journal' | 'gratitude' |
'checkin' | 'weight' | 'water' | 'sport'`.

- [ ] **Step 3: Javítsd a `_platform-design-system.md` §10 shell-mondatát**

A „4-tab nav + center quick-log FAB… a `TabBar` birtokolja a `quickOpen` state-et és feltételesen
mountolja a `QuickInputSheet`-et" mondat a `mezo-d20.1.1` óta hamis. A valóság: **5 tab**, és a
sheetet a **`QuickLogFab`** birtokolja és mountolja (`app/QuickLogFab.tsx`), a `LevelUpProvider`-en
belül. Írd át erre.

- [ ] **Step 4: Javítsd a `fuel.md` állítását az Étkezés csempéről**

A doksi ma azt írja, hogy a `QuickInputSheet` „Étkezés" csempéje **csak navigál** a `/fuel`-ra, és
ezért kell a hub ablak-sávjának mindig log-ajtóval végződnie. Ez már nem igaz: a csempe aktív
ablak esetén közvetlenül a `/fuel/log/uj?w=<tileKey>` logolóba visz, ablak nélkül a szabad tétel
ágra. Írd át a mondatot úgy, hogy a hub log-ajtójára vonatkozó indoklás megmaradjon, ha az
önmagában is érvényes (az ablak-sáv múltbeli napokat is kiszolgál), de az Étkezés csempéről szóló
állítás pontos legyen.

- [ ] **Step 5: Javítsd a `journal.md` QuickInput phase-listáját**

Egészítsd ki a fájl-térkép bejegyzését a `'water'` és `'sport'` phase-ekkel, és a hozzájuk tartozó
sheetekkel (`WaterLogSheet`, `SportLogSheet`).

- [ ] **Step 6: Igazold, hogy nem maradt hazug sor**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/workout-message-bug-29e351 && grep -n "insights/chat\|me/weight\|8 tiles\|8 csempe\|center FAB\|quickOpen" docs/features/_platform-design-system.md docs/features/fuel.md docs/features/journal.md
```

Várt: nincs olyan találat, ami a QuickInput sheetre vonatkozna.

- [ ] **Step 7: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/workout-message-bug-29e351 && git add docs/features && git commit -m "docs(quicklog): a QuickInput sorok visszaszinkronizalasa (mezo-7lst)"
```

---

## Befejezés

- [ ] `bd close mezo-7lst`
- [ ] Ág push, self-PR, CI zöld, majd lokális `--no-ff` merge a mainbe és push — a repo git-workflowja szerint.
- [ ] A böngésző-mockup (`frontend/tests/parity/quicklog-mockup.html`, git-ignorált) törölhető.
