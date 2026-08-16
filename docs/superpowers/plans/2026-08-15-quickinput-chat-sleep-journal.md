# Gyors logolás (+ gomb) — chat, alvás, napló Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A középső `+` gomb menüje kapjon egy kiemelt chat-belépőt, valamint Alvás és Napló csempét, és a három sheet-alapú akció (Alvás, Napló, Check-in) helyben, oldalváltás nélkül nyíljon meg.

**Architecture:** Minden változás a `QuickInputSheet`-en belül marad — a `TabBar` érintetlen. A sheet kap egy `Phase` állapotot (`'menu' | 'sleep' | 'naplo' | 'checkin'`); `'menu'`-ben a saját `<Sheet>`-jét rendereli, a többiben **helyette** a cél-sheetet (korai `return`, sosem egyszerre — minden sheet a maga portál+backdrop `<Sheet>` primitívjét hozza). A cél-sheetek meglévők és változatlanok; csak a `SleepLogSheet` kap egy vékony wrappert, ami a `useSleep()`-et adja hozzá.

**Tech Stack:** React 19 · TypeScript · react-router-dom · TanStack Query · Vitest + React Testing Library · Tailwind v4 + `frontend/src/styles/prototype.css`

## Global Constraints

- **bd issue:** `mezo-967c`. Minden commit-subject ezzel végződik: `(mezo-967c)`.
- **Spec:** `docs/superpowers/specs/2026-08-15-quickinput-chat-sleep-journal-design.md` — ez a forrás minden szöveghez és viselkedéshez.
- **Frontend konvenciók kötelezők:** `docs/references/frontend_conventions.md`. Mély, abszolút `@/*` importok; **semmi relatív `../`**; barrel csak `@/data/hooks`; a tesztek kolokáltak.
- **Minden UI-szöveg magyar.** A csempe-feliratok és hintek szó szerint a specből (§3 táblázat).
- **Csak tokenek a CSS-ben** (`var(--sp-3)`, `var(--r-2xl)`, `var(--gradient-cta)`, `var(--shadow-cta)`, `var(--divider)`, `var(--surface-page)`, `var(--surface-recess)`, `var(--text-primary)`, `var(--text-muted)`) — nyers hex/px-érték csak ott, ahol a szomszédos `.quicklog*` szabályok is azt használnak.
- **Gate minden task végén:** `cd frontend && pnpm test -- <érintett tesztfájl>`; az utolsó taskban a teljes gate mindkét módban.
- **A meglévő sheetek nem módosulnak:** `ActivityLogSheet.tsx`, `CheckInSheet.tsx`, `SleepLogSheet.tsx` egy sora sem változik.

---

## File Structure

| Fájl | Felelősség |
|---|---|
| `frontend/src/features/quickinput/sheets/QuickInputSheet.tsx` *(módosul)* | A menü + a `Phase` állapotgép. Egyetlen döntési pont: melyik felület látszik. |
| `frontend/src/features/quickinput/sheets/QuickSleepSheet.tsx` *(új)* | Adapter: `useSleep()` → `SleepLogSheet`. Ettől mindhárom quick-sheet felülete egységesen `{ onClose }`. |
| `frontend/src/features/quickinput/sheets/QuickInputSheet.test.tsx` *(módosul)* | A menü teljes viselkedése: navigáló csempék, chat, három sheet-nyitás, check-in fallback. |
| `frontend/src/styles/prototype.css:1477–1489` *(módosul)* | `.quicklog-chat*` szabálycsalád + a rács grid→flex váltása. |
| `docs/features/_platform-design-system.md` *(módosul)* | A §Shell ↔ QuickInput sor frissítése. |

---

### Task 1: Kiemelt chat-sor + rugalmas rács

**Files:**
- Modify: `frontend/src/features/quickinput/sheets/QuickInputSheet.tsx`
- Modify: `frontend/src/styles/prototype.css:1477-1489`
- Test: `frontend/src/features/quickinput/sheets/QuickInputSheet.test.tsx`

**Interfaces:**
- Consumes: semmit (első task).
- Produces: a `.quicklog-chat` CSS-osztálycsalád és a flex-alapú `.quicklog-grid`, amire a 2–4. task új csempéi épülnek.

- [ ] **Step 1: Write the failing test**

Add hozzá ezt a tesztet a `QuickInputSheet.test.tsx` végéhez (a meglévő két teszt marad):

```tsx
test('the chat row closes the sheet and navigates to the companion chat', async () => {
  const onClose = vi.fn()
  renderSheet(onClose)
  await userEvent.click(screen.getByText('Beszélgetés a társsal'))
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
  expect(screen.getByTestId('loc')).toHaveTextContent('/insights/chat')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test -- QuickInputSheet`
Expected: FAIL — `Unable to find an element with the text: Beszélgetés a társsal`

- [ ] **Step 3: Write minimal implementation**

`QuickInputSheet.tsx` — add az `Icon` importot és a chat-gombot a `<h2>`/`<p>` pár után, közvetlenül a `.quicklog-grid` elé:

```tsx
import { Icon } from '@/shared/ui/Icon'
```

```tsx
          <button
            type="button"
            className="quicklog-chat np-press"
            onClick={() => { close(); navigate('/insights/chat') }}
          >
            <span className="quicklog-chat-emoji" aria-hidden>💬</span>
            <span className="quicklog-chat-text">
              <span className="quicklog-chat-label">Beszélgetés a társsal</span>
              <span className="quicklog-chat-hint">kérdezz, mesélj, tervezz</span>
            </span>
            <Icon name="chevron-right" size={18} />
          </button>
```

`prototype.css` — cseréld a `.quicklog-grid` sorát (1481) és told meg a `.quicklog-tile` szabályt egy flex-bázissal, majd a `.quicklog-hint` sora (1489) UTÁN illeszd be a chat-szabályokat:

```css
/* 8 tiles in a 3-wide rhythm; flex (not grid) so a short last row centres itself (mezo-967c) */
.quicklog-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--sp-3); margin-top: var(--sp-3); }
.quicklog-tile {
  flex: 0 0 calc((100% - 2 * var(--sp-3)) / 3);
  border-radius: var(--r-2xl); padding: 16px 8px 14px; min-height: 104px; text-align: center;
  border: 1px solid var(--divider); background: var(--surface-page); cursor: pointer;
  display: flex; flex-direction: column; align-items: center; gap: 2px; font-family: inherit;
}
```

```css
/* The one non-logging entry, lifted out of the grid so the companion chat stops hiding (mezo-967c) */
.quicklog-chat {
  width: 100%; margin-top: var(--sp-4); padding: 12px 14px;
  display: flex; align-items: center; gap: 12px; text-align: left;
  border: none; border-radius: var(--r-2xl); cursor: pointer; font-family: inherit;
  background: var(--gradient-cta); color: #fff; box-shadow: var(--shadow-cta);
}
.quicklog-chat-emoji {
  width: 44px; height: 44px; border-radius: 50%; flex: none; font-size: 19px;
  background: rgba(255, 255, 255, 0.22); display: flex; align-items: center; justify-content: center;
}
.quicklog-chat-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.quicklog-chat-label { font-size: 15px; font-weight: 700; }
.quicklog-chat-hint { font-size: 12px; font-weight: 500; opacity: 0.82; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm test -- QuickInputSheet`
Expected: PASS — mindhárom teszt zöld.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/quickinput/sheets/QuickInputSheet.tsx frontend/src/features/quickinput/sheets/QuickInputSheet.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(quickinput): kiemelt chat-sor a gyors logolás menüben (mezo-967c)"
```

---

### Task 2: `Phase` állapotgép + Napló csempe

**Files:**
- Modify: `frontend/src/features/quickinput/sheets/QuickInputSheet.tsx`
- Test: `frontend/src/features/quickinput/sheets/QuickInputSheet.test.tsx`

**Interfaces:**
- Consumes: Task 1 `.quicklog-chat` / flex-rács.
- Produces:
  - `type Phase = 'menu' | 'sleep' | 'naplo' | 'checkin'` és a `const [phase, setPhase] = useState<Phase>('menu')` állapot — a 3. és 4. task ezen a `setPhase`-en keresztül nyit sheetet;
  - egy fájl-lokális `Tile` komponens: `Tile({ emoji, label, hint, onClick }: { emoji: string; label: string; hint: string; onClick: () => void })` — a 3. és 4. task ezzel rendereli az új csempéit;
  - a `NAV_ACTIONS` konstans (a hat régiből az öt tisztán navigáló).
  - A tesztben egy `renderSheet(onClose?)` helper, ami már `QueryWrapper` + `LevelUpProvider` + `MemoryRouter` alatt renderel.

- [ ] **Step 1: Write the failing test**

Írd át a `QuickInputSheet.test.tsx` fejlécét és `renderSheet` helperét erre (a `LocationProbe` marad):

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QuickInputSheet } from '@/features/quickinput/sheets/QuickInputSheet'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'

function LocationProbe() {
  return <div data-testid="loc">{useLocation().pathname}</div>
}
function renderSheet(onClose = () => {}) {
  return render(
    <QueryWrapper>
      <LevelUpProvider>
        <MemoryRouter initialEntries={['/today']}>
          <Routes><Route path="*" element={<><QuickInputSheet onClose={onClose} /><LocationProbe /></>} /></Routes>
        </MemoryRouter>
      </LevelUpProvider>
    </QueryWrapper>,
  )
}
```

Írd át a csempe-számláló tesztet és add hozzá a napló-tesztet:

```tsx
test('renders all eight quick-log tiles', () => {
  renderSheet()
  for (const label of ['Étkezés', 'Edzés', 'Víz', 'Súly', 'Stack', 'Check-in', 'Alvás', 'Napló'])
    expect(screen.getByText(label)).toBeInTheDocument()
})

test('the Napló tile swaps the menu for the activity log sheet, without closing', async () => {
  const onClose = vi.fn()
  renderSheet(onClose)
  await userEvent.click(screen.getByText('Napló'))
  expect(await screen.findByText('Tevékenységnapló')).toBeInTheDocument()
  expect(screen.queryByText('Gyors logolás')).not.toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test -- QuickInputSheet`
Expected: FAIL — `Unable to find an element with the text: Alvás` (a nyolc-csempés teszt) és `Unable to find an element with the text: Napló`.

- [ ] **Step 3: Write minimal implementation**

Írd át a `QuickInputSheet.tsx`-et erre (az `Alvás` csempe már itt megjelenik, hogy a nyolc-csempés teszt zöld legyen; a működése a 3. taskban készül el):

```tsx
// ============================================================
// Mezo · QuickInputSheet — Napív quick-log launcher
// A highlighted chat row + an 8-tile grid. The navigating tiles route away;
// Alvás/Napló/Check-in swap this sheet for the matching log sheet in place,
// so a log is always two taps from anywhere (mezo-967c).
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { ActivityLogSheet } from '@/features/today/sheets/ActivityLogSheet'

/** Which surface the sheet shows: the launcher grid, or a log sheet opened in its place. */
type Phase = 'menu' | 'sleep' | 'naplo' | 'checkin'

const NAV_ACTIONS = [
  { label: 'Étkezés', sub: 'recept vagy szabad', emoji: '🍽', to: '/fuel' },
  { label: 'Edzés', sub: 'indítás · jegyzet', emoji: '🏋️', to: '/train' },
  { label: 'Víz', sub: '+250 ml', emoji: '💧', to: '/fuel' },
  { label: 'Súly', sub: 'reggeli mérés', emoji: '⚖️', to: '/me/weight' },
  { label: 'Stack', sub: 'bevettem', emoji: '💊', to: '/fuel/stack' },
] as const

function Tile({
  emoji, label, hint, onClick,
}: { emoji: string; label: string; hint: string; onClick: () => void }) {
  return (
    <button type="button" className="quicklog-tile np-press" onClick={onClick}>
      <span className="quicklog-emoji" aria-hidden>{emoji}</span>
      <span className="quicklog-label">{label}</span>
      <span className="quicklog-hint">{hint}</span>
    </button>
  )
}

export function QuickInputSheet({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('menu')

  // Each log sheet brings its own portal + backdrop, so it REPLACES the menu
  // rather than layering over it. Closing it closes the whole stack.
  if (phase === 'naplo') return <ActivityLogSheet onClose={onClose} />

  return (
    <Sheet onClose={onClose} labelledBy="quicklog-title">
      {close => (
        <div className="quicklog">
          <h2 id="quicklog-title">Gyors logolás</h2>
          <p className="quicklog-sub">bármikor, két koppintás</p>

          <button
            type="button"
            className="quicklog-chat np-press"
            onClick={() => { close(); navigate('/insights/chat') }}
          >
            <span className="quicklog-chat-emoji" aria-hidden>💬</span>
            <span className="quicklog-chat-text">
              <span className="quicklog-chat-label">Beszélgetés a társsal</span>
              <span className="quicklog-chat-hint">kérdezz, mesélj, tervezz</span>
            </span>
            <Icon name="chevron-right" size={18} />
          </button>

          <div className="quicklog-grid">
            {NAV_ACTIONS.map(a => (
              <Tile key={a.label} emoji={a.emoji} label={a.label} hint={a.sub}
                onClick={() => { close(); navigate(a.to) }} />
            ))}
            <Tile emoji="❤️" label="Check-in" hint="hogy vagyok"
              onClick={() => { close(); navigate('/today') }} />
            <Tile emoji="😴" label="Alvás" hint="az éjszakád"
              onClick={() => setPhase('sleep')} />
            <Tile emoji="📓" label="Napló" hint="egy mondat a napról"
              onClick={() => setPhase('naplo')} />
          </div>
        </div>
      )}
    </Sheet>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm test -- QuickInputSheet`
Expected: PASS — öt teszt zöld.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/quickinput/sheets/QuickInputSheet.tsx frontend/src/features/quickinput/sheets/QuickInputSheet.test.tsx
git commit -m "feat(quickinput): napló csempe helyben nyíló tevékenységnaplóval (mezo-967c)"
```

---

### Task 3: Alvás csempe — `QuickSleepSheet` adapter

**Files:**
- Create: `frontend/src/features/quickinput/sheets/QuickSleepSheet.tsx`
- Modify: `frontend/src/features/quickinput/sheets/QuickInputSheet.tsx`
- Test: `frontend/src/features/quickinput/sheets/QuickInputSheet.test.tsx`

**Interfaces:**
- Consumes: Task 2 `Phase` állapota és `setPhase('sleep')` hívása (a csempe már bekötve, csak a `'sleep'` ág hiányzik).
- Produces: `QuickSleepSheet({ onClose }: { onClose: () => void })` — a `SleepLogSheet` `{ onClose }`-felületű változata.

- [ ] **Step 1: Write the failing test**

Add hozzá a `QuickInputSheet.test.tsx`-hez:

```tsx
test('the Alvás tile swaps the menu for the sleep log sheet, without closing', async () => {
  const onClose = vi.fn()
  renderSheet(onClose)
  await userEvent.click(screen.getByText('Alvás'))
  expect(await screen.findByText('Hogyan aludtunk?')).toBeInTheDocument()
  expect(screen.queryByText('Gyors logolás')).not.toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test -- QuickInputSheet`
Expected: FAIL — `Unable to find an element with the text: Hogyan aludtunk?` (a `'sleep'` fázisnak még nincs ága, a menü marad).

- [ ] **Step 3: Write minimal implementation**

Hozd létre a `frontend/src/features/quickinput/sheets/QuickSleepSheet.tsx`-et:

```tsx
// ============================================================
// Mezo · QuickSleepSheet — SleepLogSheet a quick-log menü számára
// A SleepLogSheet `onSave`-et vár a hívótól; ez az adapter adja hozzá a
// useSleep() mutációt, hogy a sheet felülete `{ onClose }` legyen — ugyanaz,
// mint az önellátó ActivityLogSheet-é. Így a hook csak akkor mount-olódik,
// amikor a felhasználó tényleg alvást logol, nem minden + koppintásra.
// ============================================================
import { useSleep } from '@/data/hooks'
import { SleepLogSheet } from '@/features/me/sheets/SleepLogSheet'

export function QuickSleepSheet({ onClose }: { onClose: () => void }) {
  const { logSleep } = useSleep()
  return <SleepLogSheet onClose={onClose} onSave={logSleep} />
}
```

`QuickInputSheet.tsx` — add az importot és a `'sleep'` ágat a `'naplo'` ág **elé**:

```tsx
import { QuickSleepSheet } from '@/features/quickinput/sheets/QuickSleepSheet'
```

```tsx
  if (phase === 'sleep') return <QuickSleepSheet onClose={onClose} />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm test -- QuickInputSheet`
Expected: PASS — hat teszt zöld.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/quickinput/sheets/QuickSleepSheet.tsx frontend/src/features/quickinput/sheets/QuickInputSheet.tsx frontend/src/features/quickinput/sheets/QuickInputSheet.test.tsx
git commit -m "feat(quickinput): alvás csempe helyben nyíló sleep-loggal (mezo-967c)"
```

---

### Task 4: Check-in csempe — dinamikus slot, sheet vagy navigáció

**Files:**
- Modify: `frontend/src/features/quickinput/sheets/QuickInputSheet.tsx`
- Test: `frontend/src/features/quickinput/sheets/QuickInputSheet.test.tsx`
- Test: `frontend/src/app/TabBar.test.tsx:6-8` (a `renderAt` helper — a FAB-teszt rendereli a `QuickInputSheet`-et, aminek ettől a taskól QueryClient kell)

**Interfaces:**
- Consumes: Task 2 `Phase` + `Tile`; `useCheckins()` a `@/data/hooks`-ból (visszatérés: `{ checkins: CheckinSlot[]; saveCheckIn: (idx: number, data: Partial<CheckinSlot>) => void }`); `isFillableSlot(c: CheckinSlot): boolean` a `@/features/today/logic/todayItems`-ből.
- Produces: a menü kész viselkedése — a 5. task már csak dokumentál.

**Háttér az implementálónak:** a `useCheckins()` sosem ad üres tömböt. Mock módban a 4 elemű `initialCheckins` szinkron (0–1 `done`, 2 `now`, 3 `pending` → az első kitölthető a 2. index), valós módban a `buildDaySlots(rows ?? [])` a betöltés alatt is előállítja a 4 kanonikus slotot fali óra szerinti állapottal (a teszt-MSW `[]`-t ad, így minden slot nem-`done` → az első kitölthető a 0. index). Ezért a tesztek **nem** kötnek konkrét indexre, csak a sheet megjelenésére.

- [ ] **Step 1: Write the failing test**

Add hozzá a `QuickInputSheet.test.tsx`-hez. A második teszt a `@/data/hooks`-ot cseréli le, hogy a „ma már mind kész" ágat is le tudja fedni — a `vi.mock` blokkot a fájl importjai **után**, a `LocationProbe` elé tedd:

```tsx
const checkinsMock = vi.hoisted(() => ({ useCheckins: vi.fn() }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return { ...actual, useCheckins: () => checkinsMock.useCheckins() ?? actual.useCheckins() }
})
```

…és a tesztek:

```tsx
test('the Check-in tile swaps the menu for the check-in sheet on the next fillable slot', async () => {
  const onClose = vi.fn()
  renderSheet(onClose)
  await userEvent.click(screen.getByText('Check-in'))
  expect(await screen.findByText(/Heartbeat ·/)).toBeInTheDocument()
  expect(screen.queryByText('Gyors logolás')).not.toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
})

test('with every slot done the Check-in tile falls back to navigating to Today', async () => {
  checkinsMock.useCheckins.mockReturnValue({
    checkins: ['06:30', '10:00', '14:00', '20:00'].map(time => ({
      time, state: 'done' as const, values: null, note: null,
    })),
    saveCheckIn: vi.fn(),
  })
  const onClose = vi.fn()
  renderSheet(onClose)
  expect(screen.getByText('mára mind megvan')).toBeInTheDocument()
  await userEvent.click(screen.getByText('Check-in'))
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
  expect(screen.getByTestId('loc')).toHaveTextContent('/today')
})
```

A mock alapértelmezésben `undefined`-ot ad vissza (így az igazi hook fut); a második teszt után takarítsd el, hogy ne szivárogjon — tedd a fájl végére:

```tsx
afterEach(() => checkinsMock.useCheckins.mockReset())
```

…és egészítsd ki az első import-sort: `import { afterEach, expect, test, vi } from 'vitest'`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test -- QuickInputSheet`
Expected: FAIL — `Unable to find an element with the text: /Heartbeat ·/` (a csempe még `/today`-re navigál) és `Unable to find an element with the text: mára mind megvan`.

- [ ] **Step 3: Write minimal implementation**

`QuickInputSheet.tsx` — új importok:

```tsx
import { CheckInSheet } from '@/features/today/sheets/CheckInSheet'
import { isFillableSlot } from '@/features/today/logic/todayItems'
import { useCheckins } from '@/data/hooks'
```

A `useState` alá, a fázis-ágak **fölé**:

```tsx
  // The day's four canonical slots are already in the Today query cache, so this is a
  // cache read, not a second fetch. -1 = every slot is done for today.
  const { checkins, saveCheckIn } = useCheckins()
  const checkInIdx = checkins.findIndex(isFillableSlot)
```

A `'sleep'` és `'naplo'` ágak mellé:

```tsx
  if (phase === 'checkin' && checkInIdx >= 0) {
    return (
      <CheckInSheet
        slot={checkins[checkInIdx]}
        slotIdx={checkInIdx}
        onClose={onClose}
        onSave={data => saveCheckIn(checkInIdx, data)}
      />
    )
  }
```

Cseréld le a Check-in csempét:

```tsx
            <Tile emoji="❤️" label="Check-in"
              hint={checkInIdx >= 0 ? `${checkins[checkInIdx].time} · hogy vagyok` : 'mára mind megvan'}
              onClick={() => {
                if (checkInIdx >= 0) setPhase('checkin')
                else { close(); navigate('/today') }
              }} />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm test -- QuickInputSheet`
Expected: PASS — nyolc teszt zöld.

- [ ] **Step 5: Igazítsd a TabBar tesztjét az új provider-igényhez**

A `TabBar.test.tsx` FAB-tesztje (`:20-25`) is rendereli a `QuickInputSheet`-et, ami ettől a taskól
`useCheckins()`-t hív — QueryClient nélkül dob. Cseréld a `renderAt` helpert (`:6-8`) erre:

```tsx
import { QueryWrapper } from '@/test/queryWrapper'

function renderAt(path: string) {
  return render(
    <QueryWrapper><MemoryRouter initialEntries={[path]}><TabBar /></MemoryRouter></QueryWrapper>,
  )
}
```

Run: `cd frontend && pnpm test -- TabBar`
Expected: PASS — mindhárom TabBar-teszt zöld.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/quickinput/sheets/QuickInputSheet.tsx frontend/src/features/quickinput/sheets/QuickInputSheet.test.tsx frontend/src/app/TabBar.test.tsx
git commit -m "feat(quickinput): check-in csempe a következő kitölthető slotot nyitja (mezo-967c)"
```

---

### Task 5: Feature-doc frissítés + teljes gate

**Files:**
- Modify: `docs/features/_platform-design-system.md` (a „**Shell ↔ QuickInput**" táblázatsor)

**Interfaces:**
- Consumes: az 1–4. task teljes viselkedése.
- Produces: semmit (záró task).

- [ ] **Step 1: Frissítsd a feature-docot**

`docs/features/_platform-design-system.md` — a „**Shell ↔ QuickInput**" sorban cseréld le a
„Since the Napív redesign (`mezo-8141`) it's a 6-tile quick-log grid…" kezdetű mondatot erre
(a mondat végi „DS re-dress (`mezo-setx.5.4`)" rész változatlanul marad utána):

```markdown
Since the Napív redesign (`mezo-8141`) it's a quick-log launcher; **`mezo-967c`** turned it into the app's single logging entry point. A highlighted full-width chat row (`.quicklog-chat`, `--gradient-cta` + `--shadow-cta` — the `.tab-fab`'s language) sits above the grid and routes to `/insights/chat`, because the companion chat was otherwise three taps deep behind the Today header's ✨ link. Below it, **8 tiles**: five still just `close()` + `navigate()` (Étkezés/Edzés/Víz → `/fuel`, `/train`, `/fuel`; Súly → `/me/weight`; Stack → `/fuel/stack`), while **Alvás · Napló · Check-in open their log sheet in place** — the sheet keeps a `Phase = 'menu' | 'sleep' | 'naplo' | 'checkin'` state and, in a non-`menu` phase, **returns the target sheet instead of its own** (never both: each sheet brings its own portal + backdrop). The targets are the existing, unmodified sheets: `ActivityLogSheet` (self-contained), `CheckInSheet`, and `SleepLogSheet` via a thin `QuickSleepSheet` adapter (`@/features/quickinput/sheets/QuickSleepSheet.tsx`) that supplies `useSleep().logSleep` so all three share a `{ onClose }` surface. The Check-in tile is **dynamic**: `useCheckins()` + `checkins.findIndex(isFillableSlot)` picks the next unfilled slot (its `time` becomes the tile hint); with every slot done the hint reads „mára mind megvan" and the tile falls back to navigating `/today`. The grid is **flex-wrap + `justify-content: center`** (not `grid`), so the short last row centres itself and the tile count can change without CSS.
```

- [ ] **Step 2: Futtasd a doc-lintet**

Run: `node scripts/lint-docs.mjs`
Expected: hibamentes kimenet; a `_platform-design-system.md` nincs elavultként jelölve.

- [ ] **Step 3: Futtasd a teljes frontend gate-et mindkét módban**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

Expected: `pnpm build` sikeres (`tsc -b` + `vite build`), mindkét teszt-futás zöld.

- [ ] **Step 4: Commit**

```bash
git add docs/features/_platform-design-system.md
git commit -m "docs(features): quick-log menü — chat-sor, 8 csempe, helyben nyíló sheetek (mezo-967c)"
```

- [ ] **Step 5: Zárd le a bd issue-t**

```bash
bd close mezo-967c
```
