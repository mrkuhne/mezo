# Today „Napszak-tabok” — implementációs terv

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/today` render-rétegének cseréje: a három-sziget kompozíció helyére egy `.segtabs` napszak-váltó, egy full-bleed mezo-üzenetsáv és a kiválasztott napszak **teljes, kártyakeret nélküli** tartalma lép — semmi nem marad elrejtve a kész tételeken kívül.

**Architecture:** Tisztán frontend re-kompozíció. A nap-modell (`dayFace.ts`), a normalizáló (`todayItems.ts`), a tény-derivációk (`islandFacts.ts`), az akció-táblák (`habitAction`/`questAction`), a `windDown` fázisok és mind a hét sheet **egy sort sem változik** — a `TodayPage` ugyanazokat a hookokat hívja és ugyanazt az `act()` diszpécsert használja, csak más fát renderel. Az új komponensek a `features/today/components/` alatt épülnek fel a régiek MELLÉ (1–7. feladat), a `TodayPage` egyetlen lépésben vált át rájuk (8. feladat), és csak utána töröljük a halottakat (10. feladat) — így minden feladat végén zöld a build és mindkét teszt-mód.

**Tech Stack:** React 19 · TypeScript · Vite · Tailwind v4 + `prototype.css` (kézi DS-osztályok) · Vitest + Testing Library · Playwright (vizuális goldenek) · react-router-dom.

**Driving bd:** `mezo-puci` · **Spec:** [`../specs/2026-08-10-today-daypart-tabs-design.md`](../specs/2026-08-10-today-daypart-tabs-design.md) · **Mockup:** [`../specs/assets/2026-08-10-today-daypart-tabs-mockup.html`](../specs/assets/2026-08-10-today-daypart-tabs-mockup.html)

## Global Constraints

- **Olvasd el a munka megkezdése előtt:** [`docs/references/frontend_conventions.md`](../../references/frontend_conventions.md). Kötelező házi szabvány.
- **Réteg-szabály:** minden új fájl `frontend/src/features/today/{components,logic}/` alá kerül. Adat kizárólag `@/data/hooks`-ból. Mély, abszolút importok a `@/*` aliason; **nincs relatív `../`**, nincs barrel a `data/hooks.ts`-en kívül. A tesztek colokáltak (`X.tsx` mellé `X.test.tsx`).
- **Az `.isl-*` CSS-családot TILOS törölni**, kivéve a `.isl-doneline`, `.isl-nightrow`, `.isl-nightrow-arr`, `.isl-phase` szabályokat. A Fuel „Mai” (`FuelMaiPage.tsx`, `WindowIsland.tsx`) az összes többi élő fogyasztója — lásd a spec §9 táblázatát. A `shared/ui/Island.tsx` **marad**.
- **A logikai modulok érinthetetlenek:** `logic/dayFace.ts`, `logic/todayItems.ts`, `logic/islandFacts.ts`, `logic/windDown.ts`, `logic/useWindDownPhase.ts`, `logic/questAction.ts`, `logic/habitAction.ts`, `logic/growthToday.ts`, `logic/useChainCelebration.ts`, `logic/dayArc.ts` — és a tesztjeik. Ha bármelyik teszt elpirul, a re-kompozíció hibás, nem a modul.
- **Az `act()` / `servableAction()` páros doktrínája marad:** egyetlen sor sem mutathat olyan kontrollt, amit ez a képernyő nem tud kiszolgálni. Új akció-fajta nem épül.
- **Nyelv:** minden felhasználónak látszó szöveg magyar. Kód-azonosítók és kommentek angolul, a meglévő fájlfejléc-stílusban (`// ==== Mezo · <Név> — <mit csinál> (mezo-puci). ====`).
- **Gate minden feladat végén:** `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — mindkét mód zöld.
- **Commit-üzenet:** conventional subject a bd id-vel, pl. `feat(today): napszak-váltó komponens (mezo-puci)`, és a törzs végén `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## Fájl-térkép

| Fájl | Felelősség | Feladat |
|---|---|---|
| `features/today/components/DaypartTabs.tsx` (+ test) | a `.segtabs` napszak-váltó + MOST-jelölés | 1 |
| `features/today/components/MezoMessage.tsx` (+ test) | a full-bleed briefing sáv (a `BriefingCard` utódja) | 2 |
| `features/today/components/DayGroups.tsx` (+ test) | csoportosított `ItemRow`-k + kész-hajtás (az `IslandList` utódja) | 3 |
| `features/today/components/DayView.tsx` (+ test) | a keret nélküli nézet váza + `DayHeroLine` | 4 |
| `features/today/components/ViewMorning.tsx` (+ test) | reggeli nézet | 5 |
| `features/today/components/ViewDay.tsx` (+ test) | nappali nézet, exportálja a `DayHero` típust | 6 |
| `features/today/components/ViewEvening.tsx` (+ test) | esti nézet a négy fázissal | 7 |
| `features/today/pages/TodayPage.tsx` (+ 2 teszt átcímzése) | kompozíciós gyökér — a render-fa cseréje | 8 |
| `features/today/pages/TodaySkeleton.tsx` (+ test) | az új layout betöltő tükre | 9 |
| `styles/prototype.css` | `.daytabs`, `.dayview`/`.dv-*`, `.cb-band`; 3 szabály törlése | 1, 2, 4, 10 |
| `features/today/todayReducedMotion.test.ts` | a mozgás-cascade guard átcímzése | 10 |
| törlendő: `IslandSky/IslandMorning/IslandDay/IslandEvening/IslandList/BriefingCard` (+ tesztjeik) | — | 10 |
| `docs/features/today.md`, `docs/features/_platform-design-system.md`, `docs/decisions/0025-*.md` | dokumentáció | 11 |
| `frontend/tests/visual/visual.spec.ts-snapshots/today-*` | vizuális goldenek | 11 |

---

### Task 1: `DaypartTabs` — a napszak-váltó

**Files:**
- Create: `frontend/src/features/today/components/DaypartTabs.tsx`
- Test: `frontend/src/features/today/components/DaypartTabs.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (a Today-szekció végére, a `.isl*` család után)

**Interfaces:**
- Consumes: `DAY_FACES`, `FACE_EMOJI`, `FACE_LABEL`, `type DayFace` a `@/features/today/logic/dayFace`-ből (léteznek, változatlanok).
- Produces: `DaypartTabs({ selected, current, onSelect })` — `selected: DayFace`, `current: DayFace`, `onSelect: (face: DayFace) => void`. A 8. feladat ezt renderelí.

- [ ] **Step 1: Write the failing test**

`frontend/src/features/today/components/DaypartTabs.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { DaypartTabs } from '@/features/today/components/DaypartTabs'

describe('DaypartTabs', () => {
  test('renders the three dayparts in chronological order', () => {
    render(<DaypartTabs selected="nap" current="nap" onSelect={() => {}} />)
    const tabs = screen.getAllByRole('button')
    expect(tabs.map((t) => t.textContent?.trim())).toEqual(['🌅 Reggel', '☀️ Nap', '🌙 Este'])
  })

  test('the selected daypart is the pressed segment', () => {
    render(<DaypartTabs selected="este" current="reggel" onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: /Este/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Nap/ })).toHaveAttribute('aria-pressed', 'false')
  })

  test('the MOST marker follows the CLOCK, not the selection', () => {
    render(<DaypartTabs selected="este" current="reggel" onSelect={() => {}} />)
    const now = screen.getByLabelText('most')
    expect(screen.getByRole('button', { name: /Reggel/ })).toContainElement(now)
    expect(screen.getAllByLabelText('most')).toHaveLength(1)
  })

  test('clicking a segment reports its face', async () => {
    const onSelect = vi.fn()
    render(<DaypartTabs selected="nap" current="nap" onSelect={onSelect} />)
    await userEvent.click(screen.getByRole('button', { name: /Reggel/ }))
    expect(onSelect).toHaveBeenCalledWith('reggel')
  })

  test('the group carries a spoken Hungarian label', () => {
    render(<DaypartTabs selected="nap" current="nap" onSelect={() => {}} />)
    expect(screen.getByRole('group', { name: 'Napszak' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend && pnpm vitest run src/features/today/components/DaypartTabs.test.tsx
```

Expected: FAIL — `Failed to resolve import "@/features/today/components/DaypartTabs"`.

- [ ] **Step 3: Write the component**

`frontend/src/features/today/components/DaypartTabs.tsx`:

```tsx
// ============================================================
// Mezo · DaypartTabs — the Mai screen's daypart switcher (mezo-puci).
// The house `.segtabs` control (the Sport/Futás precedent), NOT a new
// switcher language. Two independent signals, never blurred: the
// PRESSED segment is what you are looking at (`selected`, derived from
// `?dp=`), the gold dot is where the clock actually is (`current`) —
// the DayFaceStrip dual-signal, inherited through the islands era.
// Presentational: it owns no state and reads no hook.
// ============================================================
import { DAY_FACES, FACE_EMOJI, FACE_LABEL, type DayFace } from '@/features/today/logic/dayFace'

export interface DaypartTabsProps {
  /** What the screen is showing — from `?dp=`, falling back to the clock. */
  selected: DayFace
  /** Where the clock is — marked independently of the selection. */
  current: DayFace
  onSelect: (face: DayFace) => void
}

export function DaypartTabs({ selected, current, onSelect }: DaypartTabsProps) {
  return (
    <div className="daytabs">
      <div className="segtabs" role="group" aria-label="Napszak">
        {DAY_FACES.map((face) => (
          <button
            key={face}
            type="button"
            className="segtab np-press"
            aria-pressed={face === selected}
            onClick={() => onSelect(face)}
          >
            <span aria-hidden="true">{FACE_EMOJI[face]}</span> {FACE_LABEL[face]}
            {face === current && <span className="daytab-now" role="img" aria-label="most" />}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add the CSS**

A `frontend/src/styles/prototype.css` végén, a Today `.isl*` szekció után szúrd be:

```css
/* ═══ Mai · napszak-tabok (mezo-puci) ═══
   The house .segtabs control in the Today gutter; the gold dot marks the
   chronologically-current daypart independently of the pressed segment. */
.daytabs { padding: 4px 20px 12px; }
.daytabs .segtab { display: inline-flex; align-items: center; justify-content: center; gap: 6px;
                   min-height: 40px; font-size: 13.5px; }
.daytab-now { width: 6px; height: 6px; border-radius: 50%; background: var(--accent-base);
              box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-base) 22%, transparent); }
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd frontend && pnpm vitest run src/features/today/components/DaypartTabs.test.tsx
```

Expected: PASS — 5 test.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/today/components/DaypartTabs.tsx frontend/src/features/today/components/DaypartTabs.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(today): napszak-váltó a .segtabs kontrollon (mezo-puci)"
```

---

### Task 2: `MezoMessage` — a full-bleed üzenetsáv

**Files:**
- Create: `frontend/src/features/today/components/MezoMessage.tsx`
- Test: `frontend/src/features/today/components/MezoMessage.test.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: `CoachBubble` (`@/shared/ui/CoachBubble` — már van `avatar?: boolean` propja, ne módosítsd), `RefTag` (`@/shared/ui/RefTag`), `SafeMarkdown` (`@/shared/lib/safeMarkdown`), `type Briefing` (`@/data/types`).
- Produces: `MezoMessage({ briefing, demo })` — `briefing: Briefing`, `demo?: boolean`. A 8. feladat ezt renderelí.

- [ ] **Step 1: Write the failing test**

`frontend/src/features/today/components/MezoMessage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { MezoMessage } from '@/features/today/components/MezoMessage'
import type { Briefing } from '@/data/types'

const briefing: Briefing = {
  eyebrow: 'Mezo · reggeli briefing',
  body: [
    { text: 'Jól aludtál — 7,2 óra.' },
    { text: 'Fehérjéből 84 g van meg.' },
    { text: 'A bal válladra figyelj.' },
  ],
  refs: [{ kind: 'alvás', label: '7,2 óra' }],
  confidence: 0.8,
}

describe('MezoMessage', () => {
  test('every paragraph renders — the message is never clamped', () => {
    render(<MezoMessage briefing={briefing} />)
    expect(screen.getByText(/Jól aludtál/)).toBeInTheDocument()
    expect(screen.getByText(/Fehérjéből 84 g/)).toBeInTheDocument()
    expect(screen.getByText(/bal válladra/)).toBeInTheDocument()
  })

  test('there is no expander — nothing is hidden to expand', () => {
    render(<MezoMessage briefing={briefing} />)
    expect(screen.queryByRole('button', { name: /bővebben|összecsuk/ })).toBeNull()
  })

  test('the avatar circle is gone; the eyebrow carries the identity', () => {
    const { container } = render(<MezoMessage briefing={briefing} />)
    expect(container.querySelector('.cb-avatar')).toBeNull()
    expect(screen.getByText('Mezo · reggeli briefing')).toBeInTheDocument()
  })

  test('the band modifier is on the bubble', () => {
    const { container } = render(<MezoMessage briefing={briefing} />)
    expect(container.querySelector('.coach-bubble.cb-band')).toBeInTheDocument()
  })

  test('refs render; the demo label replaces the fabricated confidence', () => {
    const { unmount } = render(<MezoMessage briefing={briefing} demo />)
    expect(screen.getByText('Hivatkozott')).toBeInTheDocument()
    expect(screen.getByText('Demo tartalom')).toBeInTheDocument()
    unmount()
    render(<MezoMessage briefing={briefing} />)
    expect(screen.getByText('Confidence 80%')).toBeInTheDocument()
  })

  test('an empty refs list renders no refs row', () => {
    const { container } = render(<MezoMessage briefing={{ ...briefing, refs: [] }} />)
    expect(container.querySelector('.brief-refs')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend && pnpm vitest run src/features/today/components/MezoMessage.test.tsx
```

Expected: FAIL — a modul nem oldható fel.

- [ ] **Step 3: Write the component**

`frontend/src/features/today/components/MezoMessage.tsx`:

```tsx
// ============================================================
// Mezo · MezoMessage — the companion's standing word on the Mai
// screen (mezo-puci), the BriefingCard's successor. Three deliberate
// differences from the card it replaces: it is a FULL-BLEED band (no
// side margin, no left border, no radius), it carries NO avatar (the
// eyebrow is the identity), and it is NEVER clamped — there is no
// `bővebben`, because nothing is hidden. It renders above the daypart
// views and does not change with the selected tab.
// ============================================================
import { CoachBubble } from '@/shared/ui/CoachBubble'
import { RefTag } from '@/shared/ui/RefTag'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import type { Briefing } from '@/data/types'

export function MezoMessage({
  briefing,
  /** True in real mode — the prose is static demo copy, so the fabricated confidence % is replaced. */
  demo,
}: {
  briefing: Briefing
  demo?: boolean
}) {
  const [lead, ...rest] = briefing.body
  const meta = demo ? (
    <span className="brief-meta">Demo tartalom</span>
  ) : briefing.confidence != null ? (
    <span className="brief-meta">Confidence {Math.round(briefing.confidence * 100)}%</span>
  ) : null

  return (
    <CoachBubble eyebrow={briefing.eyebrow || 'Mezo · reggeli briefing'} avatar={false} className="cb-band">
      <div className="briefing-body">
        <p className="brief-lead"><SafeMarkdown text={lead?.text ?? ''} /></p>
        {rest.map((p, i) => (
          <p key={i} className="brief-rest"><SafeMarkdown text={p.text} /></p>
        ))}
      </div>
      {briefing.refs.length > 0 && (
        <div className="brief-refs">
          <span className="brief-refs-l">Hivatkozott</span>
          {briefing.refs.map((r, i) => <RefTag key={i} kind={r.kind} label={r.label} />)}
        </div>
      )}
      {meta && <div className="brief-foot">{meta}</div>}
    </CoachBubble>
  )
}
```

- [ ] **Step 4: Add the CSS**

A `.daytabs` blokk után:

```css
/* ═══ Mai · a mezo-üzenet sávja (mezo-puci) ═══
   The CoachBubble stripped of its card framing: edge-to-edge, no left rule,
   no radius, no avatar gap. Only a hairline separates it from the day view. */
.coach-bubble.cb-band { margin: 0; padding: 16px 20px 18px; border-left: 0; border-radius: 0;
                        border-bottom: 1px solid color-mix(in srgb, var(--primary-base) 16%, transparent);
                        gap: 0; }
.cb-band .cb-head { margin-bottom: 8px; }
.cb-band .brief-lead { margin: 0; }
.cb-band .brief-refs { margin-top: 14px; }
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd frontend && pnpm vitest run src/features/today/components/MezoMessage.test.tsx
```

Expected: PASS — 6 test.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/today/components/MezoMessage.tsx frontend/src/features/today/components/MezoMessage.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(today): full-bleed mezo üzenetsáv avatar és csonkolás nélkül (mezo-puci)"
```

---

### Task 3: `DayGroups` — a teljes lista + kész-hajtás

**Files:**
- Create: `frontend/src/features/today/components/DayGroups.tsx`
- Test: `frontend/src/features/today/components/DayGroups.test.tsx`

**Interfaces:**
- Consumes: `ItemRow` (`@/shared/ui/ItemRow`), `type TodayItem` (`@/features/today/logic/todayItems`), `type GrowthTodaySummary` (`@/features/today/logic/growthToday`).
- Produces:

```ts
export interface DayGroupsProps {
  open: TodayItem[]
  done: TodayItem[]
  /** The whole label on the collapsed fold, e.g. „✓ 3 kész ma · +40 XP”. */
  doneLabel: string
  /** Evening retrospective total — closes the expanded done block with „Ma összesen +N XP”. */
  dayXp?: number | null
  /** MezoMessage-sibling slot: the day/evening companion note, above the groups. */
  head?: ReactNode
  /** IntentionBanner slot — rendered under a „Fókusz” group heading. */
  focus?: ReactNode
  growth?: GrowthTodaySummary | null
  habitPending?: boolean
  onAct: (item: TodayItem) => void
}
```

- [ ] **Step 1: Write the failing test**

`frontend/src/features/today/components/DayGroups.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test, vi } from 'vitest'
import { DayGroups } from '@/features/today/components/DayGroups'
import type { TodayItem } from '@/features/today/logic/todayItems'

const item = (over: Partial<TodayItem> = {}): TodayItem => ({
  id: 'habit:a', source: 'habit', face: 'reggel', status: 'open', tone: 'body', emoji: '🌅',
  tag: 'REGGELI RUTIN', title: 'Mobilitás', subtitle: '8 perc', time: null, xp: 10,
  group: 'Reggeli rutin', action: { kind: 'nav', to: '/x', label: 'Indítsd' } as TodayItem['action'],
  linkUrl: null, ...over,
})

const renderGroups = (over: Partial<DayGroupsProps> = {}) =>
  render(
    <MemoryRouter>
      <DayGroups
        open={[item(), item({ id: 'q:1', group: 'Napi küldetések', title: 'Vízbevitel' })]}
        done={[item({ id: 'habit:d', status: 'done', title: 'Mérés' })]}
        doneLabel="✓ 1 kész ma · +45 XP"
        onAct={() => {}}
        {...over}
      />
    </MemoryRouter>,
  )
type DayGroupsProps = Parameters<typeof DayGroups>[0]

describe('DayGroups', () => {
  test('every open row is visible without opening anything', () => {
    renderGroups()
    expect(screen.getByText('Mobilitás')).toBeInTheDocument()
    expect(screen.getByText('Vízbevitel')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /összecsuk|még \d+/ })).toBeNull()
  })

  test('groups keep first-appearance order and carry their count', () => {
    const { container } = renderGroups()
    const heads = [...container.querySelectorAll('.isl-grouph')].map((h) => h.textContent)
    expect(heads[0]).toContain('Reggeli rutin · 1')
    expect(heads[1]).toContain('Napi küldetések · 1')
  })

  test('done rows are behind the fold and open on click', async () => {
    renderGroups()
    expect(screen.queryByText('Mérés')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /1 kész ma/ }))
    expect(screen.getByText('Mérés')).toBeInTheDocument()
  })

  test('the fold reports its state to assistive tech', async () => {
    renderGroups()
    const fold = screen.getByRole('button', { name: /1 kész ma/ })
    expect(fold).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(fold)
    expect(fold).toHaveAttribute('aria-expanded', 'true')
  })

  test('the evening total closes the opened done block', async () => {
    renderGroups({ dayXp: 120 })
    await userEvent.click(screen.getByRole('button', { name: /1 kész ma/ }))
    expect(screen.getByText('Ma összesen +120 XP')).toBeInTheDocument()
  })

  test('no done items means no fold', () => {
    renderGroups({ done: [] })
    expect(screen.queryByRole('button', { name: /kész/ })).toBeNull()
  })

  test('a row action dispatches its own item', async () => {
    const onAct = vi.fn()
    const row = item({ id: 'habit:z', title: 'Súlymérés' })
    renderGroups({ open: [row], onAct })
    await userEvent.click(screen.getByRole('button', { name: 'Indítsd' }))
    expect(onAct).toHaveBeenCalledWith(row)
  })

  test('habitPending withdraws habit pills only', () => {
    renderGroups({
      open: [item({ id: 'habit:h' }), item({ id: 'q:2', group: 'Napi küldetések', title: 'Víz', action: { kind: 'quest', quest: {} as never, label: '+250 ml' } as TodayItem['action'] })],
      habitPending: true,
    })
    expect(screen.queryByRole('button', { name: 'Indítsd' })).toBeNull()
    expect(screen.getByRole('button', { name: '+250 ml' })).toBeInTheDocument()
  })

  test('the quest heading carries the ONE Today → Growth route', () => {
    renderGroups({ growth: { done: 2, total: 5, xp: 120 } })
    expect(screen.getByRole('link', { name: /Küldetések kezelése/ })).toHaveAttribute('href', '/me/growth')
  })

  test('head and focus slots render, focus under a Fókusz heading', () => {
    renderGroups({ head: <div>jegyzet</div>, focus: <div>vezérelv</div> })
    expect(screen.getByText('jegyzet')).toBeInTheDocument()
    expect(screen.getByText('Fókusz')).toBeInTheDocument()
    expect(screen.getByText('vezérelv')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend && pnpm vitest run src/features/today/components/DayGroups.test.tsx
```

Expected: FAIL — a modul nem oldható fel.

- [ ] **Step 3: Write the component**

`frontend/src/features/today/components/DayGroups.tsx`:

```tsx
// ============================================================
// Mezo · DayGroups — a daypart view's item list (mezo-puci), the
// IslandList successor. Two things left with the islands: the internal
// scroller (the page is the scroller now) and the `összecsuk` handle
// (nothing is folded away). What survives verbatim: grouping in
// first-appearance order, the group heading's count, the quest
// heading's single Today → /me/growth route, the head/focus slots,
// and the ItemRow language.
// The ONE collapsed thing on the whole screen is the done fold — the
// day's finished items, behind a quiet line.
// ============================================================
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ItemRow } from '@/shared/ui/ItemRow'
import type { GrowthTodaySummary } from '@/features/today/logic/growthToday'
import type { TodayItem } from '@/features/today/logic/todayItems'

export interface DayGroupsProps {
  open: TodayItem[]
  done: TodayItem[]
  /** The whole label on the collapsed fold, e.g. „✓ 3 kész ma · +40 XP”. */
  doneLabel: string
  /** Evening retrospective total — closes the expanded done block. */
  dayXp?: number | null
  /** The day/evening companion note, above the groups. */
  head?: ReactNode
  /** IntentionBanner slot — rendered under a „Fókusz” group heading. */
  focus?: ReactNode
  growth?: GrowthTodaySummary | null
  habitPending?: boolean
  onAct: (item: TodayItem) => void
}

export function DayGroups({
  open, done, doneLabel, dayXp, head, focus, growth, habitPending, onAct,
}: DayGroupsProps) {
  const [doneOpen, setDoneOpen] = useState(false)

  // Group in first-appearance order — a Map preserves insertion order.
  const groups = new Map<string, TodayItem[]>()
  for (const it of open) {
    const bucket = groups.get(it.group)
    if (bucket) bucket.push(it)
    else groups.set(it.group, [it])
  }

  const rowsOf = (rows: TodayItem[], isDone = false) =>
    rows.map((it) => (
      <ItemRow
        key={it.id}
        tone={it.tone}
        emoji={it.emoji}
        title={it.title}
        subtitle={it.subtitle}
        time={it.time}
        actionLabel={isDone ? undefined : it.action?.label}
        onAction={!isDone && it.action ? () => onAct(it) : undefined}
        linkUrl={it.linkUrl}
        disabled={habitPending && it.action?.kind === 'habit'}
        done={isDone}
      />
    ))

  return (
    <div className="dv-groups">
      {head}
      {[...groups].map(([group, rows]) => (
        <div key={group}>
          <div className="isl-grouph">
            <span>{group} · {rows.length}</span>
            {group === 'Napi küldetések' && growth && growth.total > 0 && (
              <Link to="/me/growth" className="isl-grouph-go" aria-label="Küldetések kezelése a Növekedésben">
                {growth.done}/{growth.total} · +{growth.xp} XP ›
              </Link>
            )}
          </div>
          {rowsOf(rows)}
        </div>
      ))}
      {focus && (
        <div>
          <div className="isl-grouph"><span>Fókusz</span></div>
          {focus}
        </div>
      )}
      {done.length > 0 && (
        <div>
          <button
            type="button"
            className="dv-done"
            aria-expanded={doneOpen}
            onClick={() => setDoneOpen((v) => !v)}
          >
            {doneLabel}
            <span className="dv-done-arr" aria-hidden="true">{doneOpen ? '▴' : '▾'}</span>
          </button>
          {doneOpen && (
            <>
              {rowsOf(done, true)}
              {dayXp != null && <div className="isl-dayxp">Ma összesen +{dayXp} XP</div>}
            </>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd frontend && pnpm vitest run src/features/today/components/DayGroups.test.tsx
```

Expected: PASS — 10 test.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/today/components/DayGroups.tsx frontend/src/features/today/components/DayGroups.test.tsx
git commit -m "feat(today): DayGroups — teljes lista, egyetlen kész-hajtással (mezo-puci)"
```

---

### Task 4: `DayView` + `DayHeroLine` — a keret nélküli váz

**Files:**
- Create: `frontend/src/features/today/components/DayView.tsx`
- Test: `frontend/src/features/today/components/DayView.test.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: `type DayFace` (`@/features/today/logic/dayFace`), `cn` (`@/shared/lib/cn`).
- Produces:
  - `DayView({ tone, night, children })` — `tone: DayFace`, `night?: boolean`, `children: ReactNode`.
  - `DayHeroLine({ value, unit, sub })` — `value: string`, `unit?: string | null`, `sub?: string | null`.

- [ ] **Step 1: Write the failing test**

`frontend/src/features/today/components/DayView.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { DayHeroLine, DayView } from '@/features/today/components/DayView'

describe('DayView', () => {
  test('carries the daypart tone and NO card shell', () => {
    const { container } = render(<DayView tone="nap"><div>tartalom</div></DayView>)
    const view = container.querySelector('.dayview')!
    expect(view).toHaveAttribute('data-tone', 'nap')
    // the retired island shell must not come back
    expect(container.querySelector('.isl, .isl-big, .isl-blob, .isl-bigview')).toBeNull()
    expect(screen.getByText('tartalom')).toBeInTheDocument()
  })

  test('the night phase darkens the view itself', () => {
    const { container } = render(<DayView tone="este" night><div /></DayView>)
    expect(container.querySelector('.dayview.is-night')).toBeInTheDocument()
  })
})

describe('DayHeroLine', () => {
  test('value, unit and sub all render', () => {
    render(<DayHeroLine value="13:00" unit="· Pull A" sub="~55 perc · 3. mezóhét" />)
    expect(screen.getByText('13:00')).toBeInTheDocument()
    expect(screen.getByText('· Pull A')).toBeInTheDocument()
    expect(screen.getByText('~55 perc · 3. mezóhét')).toBeInTheDocument()
  })

  test('a missing unit or sub simply does not render', () => {
    const { container } = render(<DayHeroLine value="Pihenő" />)
    expect(container.querySelector('.dv-hero-u')).toBeNull()
    expect(container.querySelector('.dv-hero-sub')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend && pnpm vitest run src/features/today/components/DayView.test.tsx
```

Expected: FAIL — a modul nem oldható fel.

- [ ] **Step 3: Write the component**

`frontend/src/features/today/components/DayView.tsx`:

```tsx
// ============================================================
// Mezo · DayView — the frame a daypart's content sits in (mezo-puci).
// The point of this component is what it does NOT draw: there is no
// card, no border, no blob, no shadow. The content sits straight on
// the canvas, exactly like the mezo message band above it — boxes
// exist only INSIDE (fact strip, ItemRows, chips). The `key={tone}`
// on the root is what makes a tab switch cross-fade rather than
// mutate in place (the isl-phasein motion, reused).
// `DayHeroLine` is the daypart's one big number, left-aligned.
// ============================================================
import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import type { DayFace } from '@/features/today/logic/dayFace'

export function DayView({ tone, night, children }: {
  tone: DayFace
  /** The evening's night phase — the VIEW darkens, since there is no card to darken. */
  night?: boolean
  children: ReactNode
}) {
  return (
    <div className={cn('dayview', night && 'is-night')} data-tone={tone} key={tone}>
      {children}
    </div>
  )
}

export function DayHeroLine({ value, unit, sub }: {
  value: string
  unit?: string | null
  sub?: string | null
}) {
  return (
    <div className="dv-hero">
      <span className="dv-hero-v">
        {value}
        {unit && <span className="dv-hero-u"> {unit}</span>}
      </span>
      {sub && <span className="dv-hero-sub">{sub}</span>}
    </div>
  )
}
```

- [ ] **Step 4: Add the CSS**

A `.cb-band` blokk után:

```css
/* ═══ Mai · napszak-nézet (mezo-puci) ═══
   No card: the content sits on the canvas. Boxes only inside — the fact
   strip, the ItemRows, the chips. The .isl-* micro-components are reused
   as-is (they are Fuel's language too), only the frame is new. */
.dayview { padding: 2px 20px 6px; }
:where(.dayview) { animation: isl-phasein .32s ease both; }
.dv-hero { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
.dv-hero-v { font-size: 30px; font-weight: 200; letter-spacing: -.03em; line-height: 1.1;
             color: var(--ink); font-variant-numeric: tabular-nums; }
.dv-hero-u { font-size: 14px; font-weight: 300; color: var(--faint); letter-spacing: 0; }
.dv-hero-sub { width: 100%; font-size: 11.5px; color: var(--sub); font-weight: 500; margin-top: 4px; }
.dayview .isl-facts { margin-top: 14px; }
.dayview .isl-warnchip { margin: 12px 0 0; }
.dv-act { display: flex; align-items: center; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
.dayview .isl-cta { padding: 10px 18px; font-size: 13px; }
.dayview .isl-grouph { margin: 18px 2px 8px; }
.dayview .itemrow { margin-bottom: 6px; }
.dayview .creedchip { margin: 0 0 6px; }
.dv-done { display: flex; align-items: center; gap: 6px; width: 100%; margin-top: 12px;
           padding: 10px 14px; border-radius: var(--r-full); border: 1px solid var(--line);
           background: transparent; font-family: inherit; font-size: 12px; font-weight: 700;
           color: var(--success-hover); cursor: pointer; }
.dv-done-arr { margin-left: auto; color: var(--faint); font-weight: 600; }
/* night: the view itself goes theme-invariant dark (the .isl-night heritage) */
.dayview.is-night { background: linear-gradient(165deg, #28223c, #1d1930); border-radius: var(--r-xl);
                    padding: 18px 20px 14px; margin: 0 6px; }
.dayview.is-night .dv-hero-v { color: #F5EFE6; }
.dayview.is-night .dv-hero-u, .dayview.is-night .dv-hero-sub { color: #9c92b8; }
.dv-nightrow { display: flex; align-items: center; gap: 10px; margin-top: 16px; padding: 12px 14px;
               background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.10);
               border-radius: var(--r-xl); color: #E8E2F5; font-size: 13px; font-weight: 600;
               text-decoration: none; }
.dv-nightrow-arr { margin-left: auto; color: #9c92b8; }
@media (prefers-reduced-motion: reduce) {
  .dayview { animation: none; }
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd frontend && pnpm vitest run src/features/today/components/DayView.test.tsx
```

Expected: PASS — 4 test.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/today/components/DayView.tsx frontend/src/features/today/components/DayView.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(today): DayView váz kártyakeret nélkül + DayHeroLine (mezo-puci)"
```

---

### Task 5: `ViewMorning`

**Files:**
- Create: `frontend/src/features/today/components/ViewMorning.tsx`
- Test: `frontend/src/features/today/components/ViewMorning.test.tsx`

**Interfaces:**
- Consumes: `DayView`, `DayHeroLine` (Task 4), `DayGroups` (Task 3), `ChainCelebrations` + `type ChainCelebrationInput`, `IntentionBanner`, `IslandFactsStrip` (mind létező), `type IslandFact`/`IslandHero` (`logic/islandFacts`), `type TodayItem`, `type GrowthTodaySummary`.
- Produces:

```ts
export interface ViewMorningProps {
  hero: IslandHero
  facts: IslandFact[]
  open: TodayItem[]
  done: TodayItem[]
  doneXp: number
  celebrations: ChainCelebrationInput[]
  growth?: GrowthTodaySummary | null
  habitPending?: boolean
  onAct: (item: TodayItem) => void
}
```

Vedd észre: **nincs `next`/promotált CTA és nincs `briefing` prop** — a lánc első lépése sorként úgyis látszik, a briefing pedig a `MezoMessage` sávban ül.

- [ ] **Step 1: Write the failing test**

`frontend/src/features/today/components/ViewMorning.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test, vi } from 'vitest'
import { ViewMorning } from '@/features/today/components/ViewMorning'
import type { TodayItem } from '@/features/today/logic/todayItems'
import { QueryWrapper } from '@/test/queryWrapper'

const item = (over: Partial<TodayItem> = {}): TodayItem => ({
  id: 'habit:a', source: 'habit', face: 'reggel', status: 'open', tone: 'body', emoji: '🌅',
  tag: 'REGGELI RUTIN', title: 'Mobilitás', subtitle: '8 perc', time: null, xp: 10,
  group: 'Reggeli rutin', action: { kind: 'nav', to: '/x', label: 'Indítsd' } as TodayItem['action'],
  linkUrl: null, ...over,
})

const renderMorning = (over: Partial<Parameters<typeof ViewMorning>[0]> = {}) =>
  render(
    <QueryWrapper>
      <MemoryRouter>
        <ViewMorning
          hero={{ value: '7,2', unit: 'óra alvás', sub: 'céltól −18 perc' }}
          facts={[{ label: 'Súly', value: '78,4', unit: 'kg', delta: { text: '−0,3 kg · 7 nap', tone: 'good' } }]}
          open={[item(), item({ id: 'habit:b', title: 'Fehérjés reggeli' })]}
          done={[item({ id: 'habit:d', status: 'done', title: 'Mérés' })]}
          doneXp={40}
          celebrations={[]}
          onAct={() => {}}
          {...over}
        />
      </MemoryRouter>
    </QueryWrapper>,
  )

describe('ViewMorning', () => {
  test('hero and facts render', () => {
    renderMorning()
    expect(screen.getByText('7,2')).toBeInTheDocument()
    expect(screen.getByText('óra alvás')).toBeInTheDocument()
    expect(screen.getByText('céltól −18 perc')).toBeInTheDocument()
    expect(screen.getByText('Súly')).toBeInTheDocument()
  })

  test('EVERY open row is visible with no unfolding — no promoted CTA duplicate', () => {
    renderMorning()
    expect(screen.getByText('Mobilitás')).toBeInTheDocument()
    expect(screen.getByText('Fehérjés reggeli')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^még \d+ ›$/ })).toBeNull()
    // the chain's first step appears exactly once — as a row, not also as a hero CTA
    expect(screen.getAllByText('Mobilitás')).toHaveLength(1)
  })

  test('the done fold carries the morning label', () => {
    renderMorning()
    expect(screen.getByRole('button', { name: /✓ 1 kész ma · \+40 XP/ })).toBeInTheDocument()
  })

  test('a row action dispatches through onAct', async () => {
    const onAct = vi.fn()
    const row = item({ id: 'habit:z', title: 'Súlymérés' })
    renderMorning({ open: [row], onAct })
    await userEvent.click(screen.getByRole('button', { name: 'Indítsd' }))
    expect(onAct).toHaveBeenCalledWith(row)
  })

  test('empty facts ghost the strip', () => {
    const { container } = renderMorning({ facts: [] })
    expect(container.querySelector('.isl-facts')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend && pnpm vitest run src/features/today/components/ViewMorning.test.tsx
```

Expected: FAIL — a modul nem oldható fel.

- [ ] **Step 3: Write the component**

`frontend/src/features/today/components/ViewMorning.tsx`:

```tsx
// ============================================================
// Mezo · ViewMorning — the morning daypart's view (mezo-puci), the
// IslandMorning successor. Two things the island had are gone on
// purpose: the promoted chain CTA (the step is right there as a row —
// the button was a duplicate) and the briefing head (it moved up into
// the standing MezoMessage band). What is left is the whole morning,
// visible at once: hero, facts, every row, the creed, the done fold.
// ============================================================
import type { ChainCelebrationInput } from '@/features/today/components/ChainCelebrations'
import { ChainCelebrations } from '@/features/today/components/ChainCelebrations'
import { DayGroups } from '@/features/today/components/DayGroups'
import { DayHeroLine, DayView } from '@/features/today/components/DayView'
import { IntentionBanner } from '@/features/today/components/IntentionBanner'
import { IslandFactsStrip } from '@/features/today/components/IslandFactsStrip'
import type { GrowthTodaySummary } from '@/features/today/logic/growthToday'
import type { IslandFact, IslandHero } from '@/features/today/logic/islandFacts'
import type { TodayItem } from '@/features/today/logic/todayItems'

export interface ViewMorningProps {
  hero: IslandHero
  facts: IslandFact[]
  open: TodayItem[]
  done: TodayItem[]
  doneXp: number
  celebrations: ChainCelebrationInput[]
  growth?: GrowthTodaySummary | null
  habitPending?: boolean
  onAct: (item: TodayItem) => void
}

export function ViewMorning({
  hero, facts, open, done, doneXp, celebrations, growth, habitPending, onAct,
}: ViewMorningProps) {
  return (
    <DayView tone="reggel">
      <ChainCelebrations chains={celebrations} />
      <DayHeroLine value={hero.value} unit={hero.unit} sub={hero.sub} />
      <IslandFactsStrip facts={facts} />
      <DayGroups
        open={open}
        done={done}
        doneLabel={`✓ ${done.length} kész ma · +${doneXp} XP`}
        focus={<IntentionBanner variant="chip" />}
        growth={growth}
        habitPending={habitPending}
        onAct={onAct}
      />
    </DayView>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd frontend && pnpm vitest run src/features/today/components/ViewMorning.test.tsx
```

Expected: PASS — 5 test.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/today/components/ViewMorning.tsx frontend/src/features/today/components/ViewMorning.test.tsx
git commit -m "feat(today): ViewMorning — a teljes reggel egy nézetben (mezo-puci)"
```

---

### Task 6: `ViewDay`

**Files:**
- Create: `frontend/src/features/today/components/ViewDay.tsx`
- Test: `frontend/src/features/today/components/ViewDay.test.tsx`

**Interfaces:**
- Consumes: Task 3 + 4 komponensei, `CompanionNoteCard`, `IntentionBanner`, `IslandFactsStrip`, `ChainCelebrations`, `type CompanionNote` (`@/data/types`), `type ItemTone` (`@/shared/ui/ItemCard`).
- Produces: **a `DayHero` típus új otthona** (a törlésre ítélt `IslandDay.tsx`-ből költözik ide, változatlan mezőkkel), és:

```ts
export interface ViewDayProps {
  hero: DayHero | null
  heroWarn?: string | null
  facts: IslandFact[]
  mesoLine: string | null
  open: TodayItem[]
  done: TodayItem[]
  doneXp: number
  note: CompanionNote | null
  celebrations: ChainCelebrationInput[]
  growth?: GrowthTodaySummary | null
  habitPending?: boolean
  onAct: (item: TodayItem) => void
  onCustom: () => void
}
```

- [ ] **Step 1: Write the failing test**

`frontend/src/features/today/components/ViewDay.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test, vi } from 'vitest'
import { ViewDay, type DayHero } from '@/features/today/components/ViewDay'
import type { TodayItem } from '@/features/today/logic/todayItems'
import { QueryWrapper } from '@/test/queryWrapper'

const hero: DayHero = {
  tone: 'gym', emoji: '🏋️', tag: 'GYM · Pull', time: '13:00', title: 'Pull A',
  facts: ['6 gyakorlat', '~55 perc'], logged: false, ctaLabel: 'Indítsuk', onLog: () => {},
}

const item = (over: Partial<TodayItem> = {}): TodayItem => ({
  id: 'fuel:lunch', source: 'fuel', face: 'nap', status: 'open', tone: 'fuel', emoji: '🥗',
  tag: 'ÉTKEZÉS', title: 'Ebéd', subtitle: '~650 kcal', time: null, xp: 0,
  group: 'Étkezés', action: { kind: 'nav', to: '/fuel', label: 'Logold' } as TodayItem['action'],
  linkUrl: null, ...over,
})

const renderDay = (over: Partial<Parameters<typeof ViewDay>[0]> = {}) =>
  render(
    <QueryWrapper>
      <MemoryRouter>
        <ViewDay
          hero={hero}
          facts={[{ label: 'Fehérje', value: '84', unit: '/160 g', delta: { text: '76 g van hátra', tone: 'warn' } }]}
          mesoLine="3. mezóhét"
          open={[item()]}
          done={[]}
          doneXp={0}
          note={null}
          celebrations={[]}
          onAct={() => {}}
          onCustom={() => {}}
          {...over}
        />
      </MemoryRouter>
    </QueryWrapper>,
  )

describe('ViewDay', () => {
  test('the session hero renders with its CTA', async () => {
    const onLog = vi.fn()
    renderDay({ hero: { ...hero, onLog } })
    expect(screen.getByText('13:00')).toBeInTheDocument()
    expect(screen.getByText(/Pull A/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Indítsuk' }))
    expect(onLog).toHaveBeenCalled()
  })

  test('a rest day reads Pihenő and offers Saját edzés', async () => {
    const onCustom = vi.fn()
    renderDay({ hero: null, onCustom })
    expect(screen.getByText('Pihenő')).toBeInTheDocument()
    expect(screen.getByText('Ma nincs tervezett edzés')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Saját edzés' }))
    expect(onCustom).toHaveBeenCalled()
  })

  test('the niggle warning renders as the one safety chip', () => {
    renderDay({ heroWarn: 'Bal váll — figyelj a tempóra' })
    expect(screen.getByText(/Bal váll/)).toBeInTheDocument()
  })

  test('rows are visible with no unfolding', () => {
    renderDay()
    expect(screen.getByText('Ebéd')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^még \d+ ›$/ })).toBeNull()
  })

  test('the companion note renders above the groups when present', () => {
    renderDay({ note: { text: 'Igyál egy pohár vizet.', tone: 'calm' } as never })
    expect(screen.getByText(/Igyál egy pohár vizet/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend && pnpm vitest run src/features/today/components/ViewDay.test.tsx
```

Expected: FAIL — a modul nem oldható fel.

- [ ] **Step 3: Write the component**

`frontend/src/features/today/components/ViewDay.tsx`:

```tsx
// ============================================================
// Mezo · ViewDay — the day daypart's view (mezo-puci), the IslandDay
// successor. The hero is the day's session (`13:00 · Pull A`), rest
// days read `Pihenő` with the `Saját edzés` CTA; the niggle warning
// survives as the one safety chip. The `DayHero` shape lives here now
// (it moved from the retired IslandDay, unchanged) — TodayPage's
// `heroCardOf` builds it, so the row and the hero stay one object.
// ============================================================
import type { CompanionNote } from '@/data/types'
import type { ItemTone } from '@/shared/ui/ItemCard'
import type { ChainCelebrationInput } from '@/features/today/components/ChainCelebrations'
import { ChainCelebrations } from '@/features/today/components/ChainCelebrations'
import { CompanionNoteCard } from '@/features/today/components/CompanionNoteCard'
import { DayGroups } from '@/features/today/components/DayGroups'
import { DayHeroLine, DayView } from '@/features/today/components/DayView'
import { IntentionBanner } from '@/features/today/components/IntentionBanner'
import { IslandFactsStrip } from '@/features/today/components/IslandFactsStrip'
import type { GrowthTodaySummary } from '@/features/today/logic/growthToday'
import type { IslandFact } from '@/features/today/logic/islandFacts'
import type { TodayItem } from '@/features/today/logic/todayItems'

/** The day's hero session, shaped by TodayPage — one session authored once (heroCardOf). */
export interface DayHero {
  tone: ItemTone
  emoji: string
  tag: string
  time: string | null
  title: string
  facts: (string | null | undefined | false)[]
  logged: boolean
  loggedSummary?: string
  ctaLabel?: string
  onLog?: () => void
}

export interface ViewDayProps {
  hero: DayHero | null
  heroWarn?: string | null
  facts: IslandFact[]
  mesoLine: string | null
  open: TodayItem[]
  done: TodayItem[]
  doneXp: number
  note: CompanionNote | null
  celebrations: ChainCelebrationInput[]
  growth?: GrowthTodaySummary | null
  habitPending?: boolean
  onAct: (item: TodayItem) => void
  onCustom: () => void
}

export function ViewDay({
  hero, heroWarn, facts, mesoLine, open, done, doneXp, note, celebrations,
  growth, habitPending, onAct, onCustom,
}: ViewDayProps) {
  const durationFact = hero?.facts.find((f) => typeof f === 'string' && /perc|′/.test(f))
  const heroUnit = hero ? `${hero.title}${durationFact ? ` · ${durationFact}` : ''}` : 'nap'

  return (
    <DayView tone="nap">
      <ChainCelebrations chains={celebrations} />
      <DayHeroLine
        value={hero ? hero.time ?? '—' : 'Pihenő'}
        unit={heroUnit}
        sub={hero ? mesoLine : 'Ma nincs tervezett edzés'}
      />
      <IslandFactsStrip facts={facts} />
      {heroWarn && <div className="isl-warnchip">⚠️ {heroWarn}</div>}
      <div className="dv-act">
        {hero ? (
          <button type="button" className="isl-cta np-press" onClick={() => hero.onLog?.()}>
            {hero.ctaLabel ?? 'Indítsuk'}
          </button>
        ) : (
          <button type="button" className="isl-cta np-press" onClick={onCustom}>
            Saját edzés
          </button>
        )}
      </div>
      <DayGroups
        open={open}
        done={done}
        doneLabel={`✓ ${done.length} kész ma · +${doneXp} XP`}
        head={note ? <CompanionNoteCard note={note} /> : undefined}
        focus={<IntentionBanner variant="chip" />}
        growth={growth}
        habitPending={habitPending}
        onAct={onAct}
      />
    </DayView>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd frontend && pnpm vitest run src/features/today/components/ViewDay.test.tsx
```

Expected: PASS — 5 test.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/today/components/ViewDay.tsx frontend/src/features/today/components/ViewDay.test.tsx
git commit -m "feat(today): ViewDay — session-hero + teljes nappali lista (mezo-puci)"
```

---

### Task 7: `ViewEvening` — a négy fázissal

**Files:**
- Create: `frontend/src/features/today/components/ViewEvening.tsx`
- Test: `frontend/src/features/today/components/ViewEvening.test.tsx`
- Reference: `frontend/src/features/today/components/IslandEvening.tsx` (a forrás, amit átalakítasz — MÉG NE töröld)
- Reference: `frontend/src/features/today/components/IslandEvening.test.tsx` (a fázis-esetek, amiket átveszel)

**Interfaces:**
- Consumes: Task 3 + 4 komponensei; `useHabitActions`, `useHabitDay`, `useRitualDay`, `useTodayScenario` (`@/data/hooks`); `useWindDownPhase` (`@/features/today/logic/useWindDownPhase`); `bedCountdown` (`@/features/today/logic/islandFacts`); `ritualWindowState` (`@/features/ritual/logic/ritualWindow`); `useLevelUp`; `localDateString`.
- Produces: `ViewEvening(props)` — az `IslandEveningProps` propjai **`listOpen`/`onToggleList` nélkül**:

```ts
export interface ViewEveningProps {
  open: TodayItem[]
  done: TodayItem[]
  dayXp: number
  facts: IslandFact[]
  note: CompanionNote | null
  celebrations: ChainCelebrationInput[]
  growth?: GrowthTodaySummary | null
  habitPending?: boolean
  onAct: (item: TodayItem) => void
}
```

- [ ] **Step 1: Write the failing test**

`frontend/src/features/today/components/ViewEvening.test.tsx` — a meglévő `IslandEvening.test.tsx` mock-mintáit vedd át (ugyanaz a `useWindDownPhase` mockolás), az `openList()` lépés nélkül:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ViewEvening } from '@/features/today/components/ViewEvening'
import type { TodayItem } from '@/features/today/logic/todayItems'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'

const at = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(2026, 4, 21)
  d.setHours(h, m, 0, 0)
  return d
}

const item = (over: Partial<TodayItem> = {}): TodayItem => ({
  id: 'habit:read', source: 'habit', face: 'este', status: 'open', tone: 'body', emoji: '📖',
  tag: 'ESTI RUTIN', title: 'Olvasás', subtitle: '15 perc', time: null, xp: 10,
  group: 'Esti rutin', action: { kind: 'habit', habit: { key: 'read' }, label: 'Pipa' } as TodayItem['action'],
  linkUrl: null, ...over,
})

const renderEvening = (over: Partial<Parameters<typeof ViewEvening>[0]> = {}) =>
  render(
    <QueryWrapper>
      <LevelUpProvider>
        <MemoryRouter>
          <ViewEvening
            open={[item()]}
            done={[]}
            dayXp={120}
            facts={[{ label: 'Alvás-kilátás', value: '7,5', unit: 'óra' }]}
            note={null}
            celebrations={[]}
            onAct={() => {}}
            {...over}
          />
        </MemoryRouter>
      </LevelUpProvider>
    </QueryWrapper>,
  )

describe('ViewEvening', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers() })

  test('the normal phase shows the countdown hero and the Napzárás CTA', () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(at('21:50'))
    renderEvening()
    expect(screen.getByRole('button', { name: 'Zárjuk le a napot' })).toBeInTheDocument()
    expect(screen.getByText('Olvasás')).toBeInTheDocument()
  })

  test('rows need no unfolding — the list is part of the view', () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(at('21:50'))
    renderEvening()
    expect(screen.queryByRole('button', { name: /^még \d+ ›$/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'összecsuk ↑' })).toBeNull()
  })

  test('the ritual-owned rows never appear as list rows — the CTA owns that act', () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(at('21:50'))
    renderEvening({
      open: [item(), item({ id: 'habit:evening_ritual', title: 'Napzárás rituálé' }),
             item({ id: 'ritual:day', source: 'ritual', title: 'Napzárás' })],
    })
    expect(screen.queryByText('Napzárás rituálé')).toBeNull()
    expect(screen.getByText('Olvasás')).toBeInTheDocument()
  })

  test('the winddown phase offers wind_down exactly once — the ghost, not a row', () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(at('22:40'))
    renderEvening({ open: [item(), item({ id: 'habit:wind_down', title: 'Leállás' })] })
    expect(screen.queryByText('Leállás')).toBeNull()
    expect(screen.getByRole('button', { name: 'Leállás megvolt ✓' })).toBeInTheDocument()
  })

  test('outside the winddown phase the wind_down row IS the only affordance', () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(at('21:50'))
    renderEvening({ open: [item({ id: 'habit:wind_down', title: 'Leállás' })] })
    expect(screen.getByText('Leállás')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Leállás megvolt ✓' })).toBeNull()
  })

  test('the night phase darkens the VIEW and offers the night-mode row only', () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(at('23:40'))
    const { container } = renderEvening()
    expect(container.querySelector('.dayview.is-night')).toBeInTheDocument()
    expect(screen.getByText(/Éjszakai mód megnyitása/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Zárjuk le a napot' })).toBeNull()
  })

  test('the retrospective fold carries the evening label and the day total', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(at('21:50'))
    renderEvening({ done: [item({ id: 'habit:x', status: 'done', title: 'Hűvös szoba' })] })
    expect(screen.getByRole('button', { name: /Ahogy a nap telt · 1 tétel/ })).toBeInTheDocument()
  })
})
```

**Fontos:** a `21:50` / `22:40` / `23:40` órák a mock alvás-cél (ébredés 06:45, lefekvés 23:15) `windDown.ts` ablakaira esnek — `none` / `winddown` / `night`. Ha a mock cél változna, ezek az órák velük mozognak; a `dim` fázis `[bed−90, bed−60)` = 21:45–22:15.

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend && pnpm vitest run src/features/today/components/ViewEvening.test.tsx
```

Expected: FAIL — a modul nem oldható fel.

- [ ] **Step 3: Write the component**

`frontend/src/features/today/components/ViewEvening.tsx` — másold át az `IslandEvening.tsx` teljes tartalmát, és alkalmazd ezt a hat változtatást:

1. Fájlfejléc és név: `ViewEvening`, `(mezo-puci)`, a szigetre utaló mondatok átírva a nézetre.
2. **Töröld** a `listOpen` / `onToggleList` propokat és a `if (listOpen) { … }` ágat.
3. A gyökér `<div className="isl-phase" key={ph}>` helyére `<DayView tone="este" night={ph === 'night'} key={ph}>` kerül (a night ág is ezt használja, `night` propal).
4. A hero blokk `<div className="isl-hero-v">…<span className="isl-hero-u">` + `<div className="isl-hero-sub">` hármasa helyére `<DayHeroLine value={hero.value} unit={hero.unit} sub={sub} />` kerül; a night ág subja `'minden várhat reggelig — jó éjt'`.
5. Az `isl-act` sor `className`-je `dv-act`; a `még N ›` gomb **törlendő** (nincs mit nyitni). A `Zárjuk le a napot`, a `Napzárás {opensAt}-kor nyílik` ghost és a `Leállás megvolt ✓` gomb változatlan.
6. Az `isl-doneline` sorok helyére: a `wdDone` és a `ritualState === 'done'` állapotjelzők maradnak, de `className="dv-doneline"` helyett használd a meglévő `.isl-dayxp` idiómát — konkrétan cseréld mindkettőt erre az egy sorra: `<div className="dv-state">Leállás megvolt ✓</div>` illetve `<div className="dv-state">Napzárás kész ✓</div>`, és a Task 4 CSS-blokkja mellé vedd fel:

```css
.dv-state { margin-top: 10px; font-size: 11.5px; font-weight: 600; color: var(--success-hover); }
```

7. A done-lista `isl-doneline` gombja helyére a `DayGroups` kerül, ami a `visibleOpen`-t és a `done`-t is rendereli:

```tsx
      <DayGroups
        open={visibleOpen}
        done={done}
        doneLabel={`Ahogy a nap telt · ${done.length} tétel`}
        dayXp={dayXp}
        head={note ? <CompanionNoteCard note={note} /> : undefined}
        focus={<IntentionBanner variant="reflect" />}
        growth={growth}
        habitPending={habitPending}
        onAct={onAct}
      />
```

A `night` ágban a `DayGroups` **nem** renderel (éjszaka minden várhat reggelig) — ott csak a hero, a `dv-nightrow` link és semmi más. A night ág linkje az `isl-nightrow` helyett `dv-nightrow` / `dv-nightrow-arr` osztályt kap (Task 4 CSS-e).

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd frontend && pnpm vitest run src/features/today/components/ViewEvening.test.tsx
```

Expected: PASS — 7 test.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/today/components/ViewEvening.tsx frontend/src/features/today/components/ViewEvening.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(today): ViewEvening — négy fázis kártyakeret nélkül (mezo-puci)"
```

---

### Task 8: `TodayPage` — a render-fa cseréje

**Files:**
- Modify: `frontend/src/features/today/pages/TodayPage.tsx`
- Modify: `frontend/src/features/today/pages/TodayPage.test.tsx`
- Modify: `frontend/src/features/today/pages/TodayPage.dispatch.test.tsx`

**Interfaces:**
- Consumes: `DaypartTabs` (1), `MezoMessage` (2), `ViewMorning` (5), `ViewDay` + `type DayHero` (6), `ViewEvening` (7).
- Produces: a `/today` új felülete. A `?dp=` szemantika, az `act()` diszpécser, a `servableAction` szűrés, a `sessions`/`heroItemId` szerzőség, a consume-once level-upok és a hét sheet **változatlanok**.

- [ ] **Step 1: Rewrite the render tree**

A `TodayPage.tsx`-ben:

1. **Import-csere:** a `AnchorIsland`, `IslandDay`/`DayHero`, `IslandEvening`, `IslandMorning`, `IslandSky`, `Island`/`IslandCapsule`, `resolveBriefing` sorokból az `Island*` importok helyére:

```tsx
import { AnchorIsland } from '@/features/today/components/AnchorIsland'
import { DaypartTabs } from '@/features/today/components/DaypartTabs'
import { MezoMessage } from '@/features/today/components/MezoMessage'
import { ViewDay, type DayHero } from '@/features/today/components/ViewDay'
import { ViewEvening } from '@/features/today/components/ViewEvening'
import { ViewMorning } from '@/features/today/components/ViewMorning'
```

Az `Island`/`IslandCapsule` import a `@/shared/ui/Island`-ból **törlendő** (a héj marad a fájlban a Fuelnek, csak a Today nem használja), és a `FACE_EMOJI`/`FACE_LABEL` import is, ha csak a kapszulákhoz kellett — a `DAY_FACES`/`dayFace`/`DayFace` marad.

2. **Töröld** a `listOpen` state-et, az `essence()` függvényt, az `islandCapsule`/`islandAriaLabel` helpereket, a `reggelCapsule`/`napCapsule`/`esteCapsule` konstansokat és a `chainNext` derivációt (a promotált CTA megszűnt).

3. **`selectFace`** kapja meg a lap-tetejére görgetést:

```tsx
  const selectFace = (face: Face) => {
    const next = new URLSearchParams(params)
    if (face === current) next.delete('dp')
    else next.set('dp', face)
    setSearchParams(next, { replace: true })
    // The app's single scroller. `?dp=` is a search-param change, so ScreenContent's
    // pathname-keyed reset does NOT fire — a tab switch must land at the top itself.
    // scrollTop assignment (not scrollTo) — works in every engine incl. jsdom.
    const scroller = document.querySelector('.screen-content')
    if (scroller instanceof HTMLElement) scroller.scrollTop = 0
  }
```

4. **Az `anchorMode` korai visszatérés** ne a szigetes eget rendereljen:

```tsx
  if (scenario.anchorMode) {
    return (
      <>
        {appHero}
        <AnchorIsland />
      </>
    )
  }
```

5. **A fő render** a `<>…</>`-en belül:

```tsx
      {appHero}
      {scenario.vulnerable && <VulnerabilityCard />}
      <DaypartTabs selected={selected} current={current} onSelect={selectFace} />
      <MezoMessage briefing={briefing ?? resolveBriefing(scenario.dayState)} demo={briefingDemo} />
      {selected === 'reggel' && (
        <ViewMorning
          hero={mHero} facts={morningFacts}
          open={open} done={done} doneXp={doneXp}
          celebrations={celebrationsFor('MORNING')} growth={growth}
          habitPending={habitPending} onAct={act}
        />
      )}
      {selected === 'nap' && (
        <ViewDay
          hero={dayHero}
          heroWarn={scenario.niggle ? workout?.niggleWarning?.detail ?? null : null}
          facts={dayFacts}
          mesoLine={user.weekInMeso ? `${user.weekInMeso}. mezóhét` : null}
          open={open} done={done} doneXp={doneXp}
          note={companionNote} celebrations={celebrationsFor('DAY')} growth={growth}
          habitPending={habitPending} onAct={act} onCustom={() => setCustomOpen(true)}
        />
      )}
      {selected === 'este' && (
        <ViewEvening
          open={open} done={done} dayXp={dayXp} facts={eveningFacts}
          note={companionNote} celebrations={celebrationsFor('EVENING')} growth={growth}
          habitPending={habitPending} onAct={act}
        />
      )}
```

6. A `useWindDownPhase()` hívás **törölhető a `TodayPage`-ből** (a `windPhase` csak az `Island night` propjához kellett; a `ViewEvening` maga fetcheli). Töröld az importot is.

7. A fájlfejléc kommentjét írd át: a „non-scrolling SKY of three islands” bekezdés helyére a tabos modell kerül, a `?dp=` és az `act()`/`servableAction` bekezdések változatlanul maradnak.

- [ ] **Step 2: Re-anchor `TodayPage.test.tsx`**

A viselkedési állítások megmaradnak; a **felület-horgonyok** cserélődnek. Cseréld a fájl tetején lévő három helpert:

```tsx
/** Which daypart the screen is showing — the selection's single observable. */
const shownFace = (container: HTMLElement) =>
  (container.querySelector('.dayview') as HTMLElement | null)?.dataset.tone ?? null

/** A daypart segment in the switcher. */
const tab = (name: RegExp) => screen.getByRole('button', { name })
```

…és töröld az `openList()` helpert **teljesen**. Ezután a fájlban:

- minden `bigFace(container)` → `shownFace(container)`;
- minden `capsule(/^Reggel · most ·/)` típusú lekérés → `tab(/Reggel/)`, a `MOST` szöveg-állítás helyére: `expect(within(tab(/Reggel/)).getByLabelText('most')).toBeInTheDocument()`;
- minden `openList()` hívás **törlendő** (a sorok eleve láthatók);
- a „the retired surfaces are GONE” blokkba vedd fel az új tiltólistát:

```tsx
  test('the retired island surfaces are gone', () => {
    vi.useFakeTimers().setSystemTime(at('13:42'))
    const { container } = renderToday()
    expect(container.querySelector('.sky-islands')).toBeNull()
    expect(container.querySelector('.isl-l1')).toBeNull()
    expect(screen.queryByRole('button', { name: /^még \d+ ›$/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'összecsuk ↑' })).toBeNull()
  })
```

- vedd fel az új záró állításokat:

```tsx
  test('the mezo message is visible on every daypart, in full', () => {
    vi.useFakeTimers().setSystemTime(at('13:42'))
    const { container } = renderToday()
    expect(container.querySelector('.coach-bubble.cb-band')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'bővebben' })).toBeNull()
  })

  test('switching tabs scrolls the app scroller back to the top', async () => {
    vi.useFakeTimers().setSystemTime(at('13:42'))
    const scroller = document.createElement('div')
    scroller.className = 'screen-content'
    scroller.scrollTop = 400
    document.body.appendChild(scroller)
    renderToday()
    fireEvent.click(tab(/Reggel/))
    expect(scroller.scrollTop).toBe(0)
    scroller.remove()
  })
```

- [ ] **Step 3: Re-anchor `TodayPage.dispatch.test.tsx`**

Ugyanez a recept: töröld az `openList()`-et és minden hívását; a promotált CTA in-flight letiltását vizsgáló eset (`the promoted CTA is disabled while a habit write is in flight`) **törlendő** — nincs promotált CTA. Helyette:

```tsx
  test('an in-flight habit write withdraws habit pills but leaves quest pills live', async () => {
    // (a meglévő „in-flight withdrawal" eset törzse, az openList() lépés nélkül)
  })
```

A session-authored-once esetek (`early gym renders nowhere on the morning island`) horgonyát írd át: a nap-session a **Nap** tabon jelenik meg heroként, a Reggel tabon sehol:

```tsx
  test('the promoted session renders on the day view only', () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    const { container } = renderToday('/today?dp=reggel')
    expect(shownFace(container)).toBe('reggel')
    expect(screen.queryByText('Pull A')).toBeNull()
  })
```

- [ ] **Step 4: Run the Today suite**

```bash
cd frontend && pnpm vitest run src/features/today
```

Expected: PASS. Ha egy `logic/` teszt elpirul, ÁLLJ MEG — a re-kompozíció rontott el valamit, nem a modul.

- [ ] **Step 5: Run the full gate in both modes**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

Expected: mindkét mód zöld. A `TodaySkeleton.test.tsx` ekkor még a régi vázat várja és zöld marad (a skeleton még nem változott) — a 9. feladat cseréli.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/today/pages/TodayPage.tsx frontend/src/features/today/pages/TodayPage.test.tsx frontend/src/features/today/pages/TodayPage.dispatch.test.tsx
git commit -m "feat(today): a Mai render-fája napszak-tabokra vált (mezo-puci)"
```

---

### Task 9: `TodaySkeleton` — az új betöltő tükör

**Files:**
- Modify: `frontend/src/features/today/pages/TodaySkeleton.tsx`
- Modify: `frontend/src/features/today/pages/TodaySkeleton.test.tsx`

**Interfaces:**
- Consumes: `Skeleton` (`@/shared/ui/Skeleton`).
- Produces: változatlan default export; a `TodayPage` `sleepGoalPending` ága rendereli, az `.apphero` node-azonossági szerződés érintetlen.

- [ ] **Step 1: Update the test first**

`TodaySkeleton.test.tsx` — cseréld a szigetes állításokat:

```tsx
test('mirrors the tabs + band + view layout, inert', () => {
  const { container } = render(<TodaySkeleton />)
  expect(container.querySelector('.sky-islands')).toBeNull()
  expect(container.querySelectorAll('.segtab')).toHaveLength(0)   // inert: no buttons
  expect(container.querySelector('.daytabs')).toBeInTheDocument()
  expect(container.querySelector('.cb-band')).toBeInTheDocument()
  expect(container.querySelector('.dayview')).toBeInTheDocument()
  expect(container.querySelectorAll('button')).toHaveLength(0)
})

test('announces itself as a loading status', () => {
  render(<TodaySkeleton />)
  expect(screen.getByRole('status', { name: 'Betöltés' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd frontend && pnpm vitest run src/features/today/pages/TodaySkeleton.test.tsx
```

Expected: FAIL — `.daytabs` nincs a fában.

- [ ] **Step 3: Rewrite the skeleton**

```tsx
// ============================================================
// Mezo · TodaySkeleton — the real-mode loading mirror of the daypart-tabs
// layout (mezo-puci). Renders while `useSleepGoal` resolves (the daypart
// anchor): a tab-row placeholder, the message band, and one day view, so
// the resolve swap does not shift the page. Inert by design — no buttons;
// a `role="status"` live region announces loading.
// AppHero is NOT here: TodayPage renders the same `appHero` element above
// both branches (node-identity contract, TodayPage.skeleton.test).
// ============================================================
import { Skeleton } from '@/shared/ui/Skeleton'

export default function TodaySkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Betöltés">
      <div className="daytabs">
        <div className="segtabs">
          <Skeleton width="100%" height={40} radius={12} />
          <Skeleton width="100%" height={40} radius={12} />
          <Skeleton width="100%" height={40} radius={12} />
        </div>
      </div>
      <div className="coach-bubble cb-band">
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Skeleton width={160} height={11} radius={6} />
          <Skeleton width="100%" height={54} radius={10} />
          <Skeleton width="85%" height={40} radius={10} />
        </div>
      </div>
      <div className="dayview" data-tone="nap" style={{ animation: 'none' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          <Skeleton width={180} height={32} radius={10} />
          <Skeleton width={220} height={12} radius={6} />
          <Skeleton width="100%" height={72} radius={14} />
          <Skeleton width="100%" height={56} radius={14} />
          <Skeleton width="100%" height={56} radius={14} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the skeleton tests**

```bash
cd frontend && pnpm vitest run src/features/today/pages/TodaySkeleton.test.tsx src/features/today/pages/TodayPage.skeleton.test.tsx
```

Expected: PASS. A `TodayPage.skeleton.test.tsx` `.apphero` node-azonossági esete változtatás nélkül zöld; ha a fájl a `.sky-islands`-re horgonyoz a „resolve → live sky” esetben, cseréld `.dayview`-ra.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/today/pages/TodaySkeleton.tsx frontend/src/features/today/pages/TodaySkeleton.test.tsx frontend/src/features/today/pages/TodayPage.skeleton.test.tsx
git commit -m "feat(today): a betöltő váz a tabos layoutot tükrözi (mezo-puci)"
```

---

### Task 10: A halottak eltakarítása + a mozgás-guard átcímzése

**Files:**
- Delete: `frontend/src/features/today/components/IslandSky.tsx`, `IslandMorning.tsx` (+ test), `IslandDay.tsx` (+ test), `IslandEvening.tsx` (+ test), `IslandList.tsx` (+ test), `BriefingCard.tsx` (+ test)
- Modify: `frontend/src/styles/prototype.css`
- Modify: `frontend/src/features/today/todayReducedMotion.test.ts`

- [ ] **Step 1: Verify nothing else imports them**

```bash
cd frontend && grep -rn "IslandSky\|IslandMorning\|IslandDay\|IslandEvening\|IslandList\|BriefingCard" src --include="*.tsx" --include="*.ts"
```

Expected: csak a törlésre ítélt fájlok saját sorai. **Ha bármi más találat van, ÁLLJ MEG** és jelentsd — nem törölhető.

- [ ] **Step 2: Delete the retired components and their tests**

```bash
cd frontend && git rm src/features/today/components/IslandSky.tsx \
  src/features/today/components/IslandMorning.tsx src/features/today/components/IslandMorning.test.tsx \
  src/features/today/components/IslandDay.tsx src/features/today/components/IslandDay.test.tsx \
  src/features/today/components/IslandEvening.tsx src/features/today/components/IslandEvening.test.tsx \
  src/features/today/components/IslandList.tsx src/features/today/components/IslandList.test.tsx \
  src/features/today/components/BriefingCard.tsx src/features/today/components/BriefingCard.test.tsx
```

- [ ] **Step 3: Delete exactly three CSS rules**

A `prototype.css`-ből **csak** ezeket töröld: `.isl-doneline`, `.isl-nightrow`, `.isl-nightrow-arr`, `.isl-phase`. Előtte igazold, hogy a Fuel nem használja őket:

```bash
cd frontend && grep -rn "isl-doneline\|isl-nightrow\|isl-phase" src --include="*.tsx" --include="*.ts"
```

Expected: nincs találat (a `todayReducedMotion.test.ts` `isl-phasein` **keyframe**-re hivatkozó sorai nem számítanak — az a keyframe MARAD).

**Semmi mást ne törölj az `.isl-*` családból** — a Fuel „Mai” a `.sky-islands`, `.isl-l1*`, `.isl-openhead`, `.isl-hero-*`, `.isl-act`, `.isl-cta`, `.isl-more`, `.isl-grouph*`, `.isl-facts`/`.isl-fact*`, `.isl-mealchip*` és a `shared/ui/Island` héj élő fogyasztója.

- [ ] **Step 4: Re-anchor the reduced-motion cascade guard**

`todayReducedMotion.test.ts` — a `isl-morph` / `isl-floaty` / `isl-rowin` családokra vonatkozó Today-esetek átcímzése: ezek a keyframe-ek megmaradnak (a Fuel használja őket), de a **Today** felelőssége a `.dayview` animációja. Vedd fel:

```ts
test('the day view animation is guarded by a :where()-wrapped reduce override', () => {
  expect(css).toMatch(/:where\(\.dayview\)\s*\{\s*animation:\s*isl-phasein/)
  const reduce = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
  expect(reduce).toMatch(/\.dayview\s*\{\s*animation:\s*none/)
})
```

…és töröld azokat az eseteket, amelyek konkrétan a Today `.isl-l1` stagger-létrájára vagy a kapszula-morfra horgonyoztak — ha a teszt string-jelenlétet vizsgál a `prototype.css`-ben, ezek a szabályok MEGMARADNAK a Fuel miatt, tehát az eseteket nem törölni kell, hanem **átcímezni a Fuelre** a kommentjükben. Döntsd el fájlolvasás után; a szabály: **egyetlen létező CSS-szabályra hivatkozó eset sem törölhető, csak a Today-hoz kötő kommentje/neve pontosítható.**

- [ ] **Step 5: Run the full gate**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

Expected: mindkét mód zöld, és a `pnpm build` nem panaszkodik nem létező importra.

- [ ] **Step 6: Commit**

```bash
git add -A frontend/src frontend/src/styles/prototype.css
git commit -m "refactor(today): a szigetes komponensek és három CSS-szabály nyugdíjazása (mezo-puci)"
```

---

### Task 11: Dokumentáció, ADR és vizuális goldenek

**Files:**
- Modify: `docs/features/today.md`
- Modify: `docs/features/_platform-design-system.md`
- Create: `docs/decisions/0025-today-daypart-tabs.md`
- Regenerate: `frontend/tests/visual/visual.spec.ts-snapshots/today-{reggel,nap,este}-{light,dark}-darwin.png`

- [ ] **Step 1: Write the ADR**

`docs/decisions/0025-today-daypart-tabs.md` — a repo ADR-sablonja szerint (lásd [`docs/README.md`](../../README.md)). Tartalma:

- **Státusz:** Elfogadva, 2026-08-10. **Leváltja** az [ADR 0022](0022-today-three-islands.md) *render-rétegét*; az ADR 0014 nap-modellje, kártyanyelve, act-anywhere és dedup döntései, valamint az ADR 0010 (semmi nem zárja le magát) **továbbra is érvényben**.
- **Kontextus:** a három sziget rejtésre optimalizált — két interakció kellett bármely rutin-lépéshez, a companion üzenete alapból nem látszott. Felhasználói visszajelzés hívta életre.
- **Döntés:** `.segtabs` napszak-váltó + állandó, full-bleed mezo-üzenetsáv + a kiválasztott napszak teljes, kártyakeret nélküli tartalma; az egyetlen összecsukott elem a kész-hajtás.
- **Következmények:** a kapszula-morf mozgás-nyelv elveszik; a napszakok színkódját a chrome hordozza (blob nélkül); a `shared/ui/Island` héj és a teljes `.isl-*` család **megmarad a Fuelnek**, tehát a csere nem hoz CSS-tisztulást — ezt vállaljuk.
- **Alternatívák:** (a) három egymás alatti szekció egy görgetésben — elvetve, mert hosszú lapot ad és a napszak-fókusz elmosódik; (b) a szigethéj kényszerítése „mind a három nagy” módba — elvetve, mert a héj a Fuelé is, és a morf a lényege.

- [ ] **Step 2: Update `docs/features/today.md`**

Felülírás a helyén (nincs changelog, nincs dátumozott pillanatkép — git a történet). A frissítendő szakaszok:

- **fejléc-idézet + §1 Summary:** a „non-scrolling sky of three islands” leírás helyére a tabos modell; a driving döntés az **ADR 0025** a `specs/2026-08-10-today-daypart-tabs-design.md` felett.
- **§2 User-facing behavior:** a sziget-kiválasztás/L1-nyitás bekezdései helyére a tabváltás (a `?dp=` szemantika szó szerint marad, plusz a lap-tetejére görgetés), a mindig látható üzenetsáv, a kész-hajtás mint az egyetlen összecsukott elem; az esti négy fázis táblája marad, a „hero-slot” szó „nézet”-re cserélve.
- **§3 Architecture:** az ASCII komponens-fa cseréje az új gyökérre (`AppHero → VulnerabilityCard? → DaypartTabs → MezoMessage → View{Morning,Day,Evening}`); a guard-sorrend (`anchorMode` → `sleepGoalPending`) változatlan.
- **§5 Integrations:** a „Shared UI consumed” listából a `BriefingCard` kikerül, a `CoachBubble` marad; új mondat arról, hogy a `shared/ui/Island` **már csak a Fuelé**.
- **§8 Testing:** az új komponens-tesztek felsorolása, a `TodayPage.test`/`dispatch.test` átcímzésének ténye, a goldenek újragenerálása.
- **§9 Decisions/gotchas:** **ÚJ GOTCHA** — „az `.isl-*` család a Fuelé; a Today-ról való leválás NEM jelent CSS-törlést, csak három szabály tűnt el”. A `DailyQuestsCard`/`ActivityLogCard` nem-árva gotcha **marad**. A `dayArc.ts` gotcha **marad**.
- **§10 Key files:** az új fájlnevek, a törölt komponensek listája.
- A frontmatter `updated:` mezője `2026-08-10`.

- [ ] **Step 3: Update the design-system catalogue**

`docs/features/_platform-design-system.md` — a Today-owned CSS-családok katalógusában a `.isl*` bejegyzés mellé vedd fel a `.daytabs` / `.dayview` / `.dv-*` / `.coach-bubble.cb-band` családot, és jelöld, hogy az `.isl*` **tulajdonosa a Fuel lett**.

- [ ] **Step 4: Run the docs lint**

```bash
node scripts/lint-docs.mjs
```

Expected: a `docs/features/today.md` **nem** szerepel a stale listában. (A `_platform-api-backend`, `insights`, `proactive` stb. már a munka kezdete előtt is stale volt — azokhoz ne nyúlj.)

- [ ] **Step 5: Regenerate the visual goldens**

```bash
cd frontend && pnpm test:visual --update-snapshots
```

A három Today golden (`today-reggel|nap|este` × light/dark) a `?dp=`-vel pontosan a három tabot állítja be, a befagyasztott órák változatlanok. Nézd át a generált PNG-ket, mielőtt commitolsz — ha bármelyik üres vagy elvágott, a layout hibás, nem a baseline. A **linux** baseline-okat az `update-visual-baselines.yml` workflow generálja a branchen; ezt a lépést a PR nyitása után indítsd.

- [ ] **Step 6: Commit**

```bash
git add docs/features/today.md docs/features/_platform-design-system.md docs/decisions/0025-today-daypart-tabs.md frontend/tests/visual
git commit -m "docs(today): ADR 0025 + feature-doc a napszak-tabokra, darwin goldenek (mezo-puci)"
```

- [ ] **Step 7: Close the bd issue and push**

```bash
bd close mezo-puci
git pull --rebase && bd dolt push && git push
git status   # MUST show "up to date with origin"
```

Ezután nyisd meg a self-PR-t (CI-kapu), várd meg a zöldet, és `--no-ff` merge-elj lokálisan a `main`-re a `CLAUDE.md` git-workflow szerint.

---

## Önellenőrzés (a terv írója végezte el)

**Spec-lefedettség:** §2 anatómia → 1–8. feladat · §3 váltó → 1. · §4 üzenet → 2. · §5 nézet + hero-tábla → 4–7. · §5 esti fázisok → 7. · §6 horgony → 8/Step 1.4 · §7 mozgás → 4. (`isl-phasein` újrahasznosítás) + 10. (guard) · §8 színvilág → nincs kód (a chrome hordozza, dokumentálva a 11.-ben) · §9 komponens-terv → 1–10. · §9 CSS-tábla → 10/Step 3 · §10 a11y → 1. (role/aria-pressed/aria-label) + 3. (`aria-expanded`) · §11 tesztelés → minden feladat + 11/Step 5 · §12 scope → nincs backend-feladat a tervben. **Nincs lefedetlen szakasz.**

**Placeholder-ellenőrzés:** minden lépés konkrét kódot vagy konkrét parancsot ad. A 7. és a 10. feladat két helyen ítéletet kér (az `IslandEvening` átmásolása, a reduced-motion esetek átcímzése) — mindkettőnél explicit döntési szabály van megadva, nem „intézd el valahogy”.

**Típus-konzisztencia:** `DayHero` a 6. feladatban születik és a 8. importálja onnan · `DayGroupsProps.doneLabel` mindhárom nézetben string-interpolációval készül · `ViewEveningProps` nem tartalmaz `listOpen`/`onToggleList`-et, és a 8. feladat sem ad át ilyet · a `DaypartTabs` `onSelect: (face: DayFace) => void` szignatúrája megegyezik a `TodayPage` `selectFace`-ével.
