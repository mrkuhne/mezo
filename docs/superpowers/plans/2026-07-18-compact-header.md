# Compact Single-Row Header (AppHero v2) + SubNavDropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the three stacked header bands (hero row + chip row + `.np-pills` sub-nav) into ONE sticky avatar-height row on all 5 sections, with the sub-nav as an anchored popover dropdown in the header.

**Architecture:** `AppHero` (features/progression) is restructured to a single flex row (48px ring, inline label-less counters); a new domain-free `shared/ui/SubNavDropdown` primitive replaces the four `*SubNav` pill rows and is passed into AppHero's existing `utilities` slot by each section shell. Insights joins the AppHero family (its `pghead-np` big header retires). No data-layer changes — all hooks and tap targets unchanged.

**Tech Stack:** React 19, react-router 7 (`NavLink`, `matchPath`), vitest + @testing-library/react, plain CSS in `frontend/src/styles/prototype.css`.

**Spec:** `docs/superpowers/specs/2026-07-18-compact-header-redesign-design.md` · **bd:** `mezo-ugqb` · **Branch:** `feat/compact-header`

## Global Constraints

- Read `docs/references/frontend_conventions.md` before coding — non-negotiable house standard.
- No `@/data/*` import in `shared/ui` files; features import hooks from `@/data/hooks` only.
- Deep absolute imports via `@/*`; no new barrels; no relative `../`; tests colocated.
- Component code: `cn()` for conditional classes, `var(--token)` colors only in inline styles/props.
- All UI copy Hungarian; code + comments English.
- Counters lose their word labels visually but keep full Hungarian wording in `aria-label`s.
- Existing tap targets must not change: avatar→`/me`, level badge→`/me/growth`, title→TitleShopSheet, 🔥→StreakSheet, ⚡→`/me/growth`, 🪙→TitleShopSheet.
- Gate after every task: focused vitest run; final gate `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` (both modes green).
- Commits: conventional subjects carrying `(mezo-ugqb)`.
- All commands below run from `frontend/` unless noted.

---

### Task 1: `SubNavDropdown` shared primitive

**Files:**
- Create: `frontend/src/shared/ui/SubNavDropdown.tsx`
- Create: `frontend/src/shared/ui/SubNavDropdown.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (append new block at end of file)

**Interfaces:**
- Consumes: `@/shared/lib/cn`, `@/shared/ui/Icon` (existing `check`, `chevron-down`, `chevron-up` icon names), react-router `NavLink`/`matchPath`/`useLocation`.
- Produces (later tasks rely on these exact shapes):
  ```ts
  export interface SubNavItem { to: string; label: string; end?: boolean }
  export interface SubNavExtraAction { label: string; icon?: ReactNode; onSelect: () => void }
  export function SubNavDropdown(props: {
    label: string                 // nav aria-label, e.g. "Train alnavigáció"
    items: SubNavItem[]
    extraAction?: SubNavExtraAction
    accent?: string               // CSS color VALUE, e.g. 'var(--coral-deep)'
  }): JSX.Element
  ```

- [ ] **Step 1: Write the failing test**

`frontend/src/shared/ui/SubNavDropdown.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SubNavDropdown } from '@/shared/ui/SubNavDropdown'

const ITEMS = [
  { to: '/train', label: 'Mai', end: true },
  { to: '/train/gym', label: 'Gym' },
  { to: '/train/sport', label: 'Sport' },
]

const renderAt = (path: string, extra?: { label: string; onSelect: () => void }) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <SubNavDropdown label="Train alnavigáció" items={ITEMS} extraAction={extra} />
    </MemoryRouter>,
  )

test('closed: the chip shows the active item resolved from the URL, no menu', () => {
  renderAt('/train/gym')
  expect(screen.getByRole('button', { name: 'Gym' })).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('menu')).toBeNull()
})

test('index item (end:true) is active only on the exact path', () => {
  renderAt('/train')
  expect(screen.getByRole('button', { name: 'Mai' })).toBeInTheDocument()
})

test('open: lists every item as a menuitem, ✓ on the active one', async () => {
  renderAt('/train/gym')
  await userEvent.click(screen.getByRole('button', { name: 'Gym' }))
  const menu = screen.getByRole('menu')
  expect(menu).toBeInTheDocument()
  for (const label of ['Mai', 'Gym', 'Sport']) {
    expect(screen.getByRole('menuitem', { name: label })).toBeInTheDocument()
  }
  expect(screen.getByRole('menuitem', { name: 'Gym' })).toHaveClass('on')
})

test('selecting an item navigates and closes the menu', async () => {
  renderAt('/train/gym')
  await userEvent.click(screen.getByRole('button', { name: 'Gym' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Sport' }))
  expect(screen.queryByRole('menu')).toBeNull()
  expect(screen.getByRole('button', { name: 'Sport' })).toBeInTheDocument() // chip follows the route
})

test('Escape closes and returns focus to the chip', async () => {
  renderAt('/train/gym')
  await userEvent.click(screen.getByRole('button', { name: 'Gym' }))
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('menu')).toBeNull()
  expect(screen.getByRole('button', { name: 'Gym' })).toHaveFocus()
})

test('backdrop click closes the menu', async () => {
  renderAt('/train/gym')
  await userEvent.click(screen.getByRole('button', { name: 'Gym' }))
  await userEvent.click(screen.getByRole('button', { name: 'Bezárás' }))
  expect(screen.queryByRole('menu')).toBeNull()
})

test('extraAction renders after a separator and fires onSelect', async () => {
  const onSelect = vi.fn()
  renderAt('/train/gym', { label: 'Beállítások', onSelect })
  await userEvent.click(screen.getByRole('button', { name: 'Gym' }))
  expect(screen.getByRole('separator')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('menuitem', { name: 'Beállítások' }))
  expect(onSelect).toHaveBeenCalledOnce()
  expect(screen.queryByRole('menu')).toBeNull()
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && pnpm vitest run src/shared/ui/SubNavDropdown.test.tsx`
Expected: FAIL — `Cannot find module '@/shared/ui/SubNavDropdown'`

- [ ] **Step 3: Implement the component**

`frontend/src/shared/ui/SubNavDropdown.tsx`:

```tsx
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { NavLink, matchPath, useLocation } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { Icon } from '@/shared/ui/Icon'

export interface SubNavItem {
  to: string
  label: string
  end?: boolean
}

export interface SubNavExtraAction {
  label: string
  icon?: ReactNode
  onSelect: () => void
}

/** Compact sub-navigation for the sticky AppHero row: a pill chip showing the active
 *  sub-view that opens an anchored popover menu (spec 2026-07-18-compact-header §4).
 *  Domain-free: the section shells pass their tab lists in. */
export function SubNavDropdown({
  label,
  items,
  extraAction,
  accent,
}: {
  label: string
  items: SubNavItem[]
  extraAction?: SubNavExtraAction
  accent?: string
}) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const chipRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  // Same active semantics as the retired NavLink pills: index items match exactly
  // (end: true), section items match by prefix.
  const active =
    items.find((i) => matchPath({ path: i.to, end: i.end ?? false }, pathname)) ?? items[0]

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        chipRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <nav
      className="subnav-dd"
      aria-label={label}
      style={accent ? ({ '--subnav-accent': accent } as React.CSSProperties) : undefined}
    >
      <button
        ref={chipRef}
        type="button"
        className="dd-chip np-press"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {active.label}
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={12} />
      </button>
      {open && (
        <>
          <button
            type="button"
            className="dd-backdrop"
            aria-label="Bezárás"
            onClick={() => {
              setOpen(false)
              chipRef.current?.focus()
            }}
          />
          <div className="dd-menu" role="menu" id={menuId}>
            {items.map((item) => {
              const on = item === active
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  role="menuitem"
                  className={cn('dd-item np-press', on && 'on')}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                  {on && <Icon name="check" size={13} />}
                </NavLink>
              )
            })}
            {extraAction && (
              <>
                <div className="dd-sep" role="separator" />
                <button
                  type="button"
                  role="menuitem"
                  className="dd-item np-press"
                  onClick={() => {
                    setOpen(false)
                    extraAction.onSelect()
                  }}
                >
                  {extraAction.label}
                  {extraAction.icon}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </nav>
  )
}
```

- [ ] **Step 4: Add the CSS block**

Append to `frontend/src/styles/prototype.css` (end of file):

```css
/* ===== SubNavDropdown — sub-nav popover in the sticky AppHero row (mezo-ugqb) =====
   z-scale: chip lives inside .apphero (z 45, above tab-bar 40); the fixed backdrop and
   the anchored menu paint within that stacking context — above content + tab-bar,
   below StatusBar (50), DynamicIsland (60) and sheets (200+). */
.subnav-dd { position: relative; }
.subnav-dd .dd-chip {
  display: inline-flex; align-items: center; gap: 5px;
  background: var(--surface); border: 1px solid var(--border-subtle); border-radius: 999px;
  padding: 7px 12px; font: 800 12px/1 var(--ff-body);
  color: var(--subnav-accent, var(--ink)); cursor: pointer; white-space: nowrap;
}
.subnav-dd .dd-backdrop {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.35);
  border: none; padding: 0; cursor: default;
}
.subnav-dd .dd-menu {
  position: absolute; top: calc(100% + 8px); right: 0; min-width: 190px;
  background: var(--surface-1); border: 1px solid var(--border-subtle);
  border-radius: 14px; padding: 5px 0; box-shadow: 0 18px 40px rgba(0, 0, 0, 0.25);
}
.subnav-dd .dd-item {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  width: 100%; padding: 10px 14px; font: 700 13px/1.2 var(--ff-body);
  color: var(--sub); text-decoration: none; background: none; border: none;
  cursor: pointer; text-align: left;
}
.subnav-dd .dd-item.on { color: var(--subnav-accent, var(--coral-deep)); }
.subnav-dd .dd-sep { border-top: 1px solid var(--line); margin: 4px 0; }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && pnpm vitest run src/shared/ui/SubNavDropdown.test.tsx`
Expected: PASS (7 tests)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/shared/ui/SubNavDropdown.tsx frontend/src/shared/ui/SubNavDropdown.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(fe/shared): SubNavDropdown popover primitive for the compact header (mezo-ugqb)"
```

---

### Task 2: AppHero v2 — single sticky row

**Files:**
- Modify: `frontend/src/features/progression/components/AppHero.tsx`
- Modify: `frontend/src/features/progression/components/AppHero.test.tsx`
- Modify: `frontend/src/styles/prototype.css:1535-1564` (the `.apphero` + `.apphero-chips` blocks)

**Interfaces:**
- Consumes: nothing new — same hooks (`useProfile`, `useGamification`, `useTitles`, `useDailyQuests`), same `utilities?: ReactNode` prop.
- Produces: `.apphero` is now the sticky header row; the chips band (`.apphero-chips`) no longer exists. Counter accessible names (later tasks & tests rely on them): `` `${streakDays} napos sorozat` ``, `` `${done}/${total} napi quest` ``, `` `${coins} érme` ``. Mock-mode seed values: streak 6, quests 1/3, coins 240, level 12.

- [ ] **Step 1: Update the test to the v2 contract (failing first)**

Replace the full contents of `frontend/src/features/progression/components/AppHero.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppHero } from '@/features/progression/components/AppHero'
import { QueryWrapper } from '@/test/queryWrapper'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderHero = (utilities?: React.ReactNode) =>
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/today']}>
        <AppHero utilities={utilities} />
      </MemoryRouter>
    </QueryWrapper>,
  )

test('renders identity, level badge, equipped title and the label-less counters', () => {
  renderHero()
  expect(screen.getByText('Daniel')).toBeInTheDocument()
  expect(screen.getByText('A Fegyelmezett')).toBeInTheDocument()
  expect(screen.getByLabelText('Szint 12 — Growth')).toBeInTheDocument()
  expect(screen.getByText('🔥 6')).toBeInTheDocument()
  expect(screen.getByText('⚡ 1/3')).toBeInTheDocument() // mockQuestDay: 1 of 3 completed
  expect(screen.getByText('🪙 240')).toBeInTheDocument()
})

test('counters keep the full Hungarian wording for screen readers', () => {
  renderHero()
  expect(screen.getByLabelText('6 napos sorozat')).toBeInTheDocument()
  expect(screen.getByLabelText('1/3 napi quest')).toBeInTheDocument()
  expect(screen.getByLabelText('240 érme')).toBeInTheDocument()
})

test('single row: the chips band is gone, counters live inside .apphero', () => {
  const { container } = renderHero()
  expect(container.querySelector('.apphero-chips')).toBeNull()
  expect(container.querySelector('.apphero .counters')).toBeInTheDocument()
})

test('renders the per-tab utilities slot', () => {
  renderHero(<button aria-label="Keresés" />)
  expect(screen.getByLabelText('Keresés')).toBeInTheDocument()
})

test('🔥 opens the StreakSheet, 🪙 opens the TitleShopSheet', async () => {
  renderHero()
  await userEvent.click(screen.getByLabelText('6 napos sorozat'))
  expect(await screen.findByText('🔥 6 napos sorozat')).toBeInTheDocument()
  await userEvent.keyboard('{Escape}')
  await userEvent.click(screen.getByLabelText('240 érme'))
  expect(await screen.findByText('Title-ök')).toBeInTheDocument()
})

test('avatar links to /me, level badge and quest counter link to /me/growth', () => {
  renderHero()
  expect(screen.getByLabelText('Profil')).toHaveAttribute('href', '/me')
  expect(screen.getByLabelText('Szint 12 — Growth')).toHaveAttribute('href', '/me/growth')
  expect(screen.getByLabelText('1/3 napi quest')).toHaveAttribute('href', '/me/growth')
})
```

- [ ] **Step 2: Run to verify the new expectations fail**

Run: `cd frontend && pnpm vitest run src/features/progression/components/AppHero.test.tsx`
Expected: FAIL — `Unable to find an element with the text: 🔥 6` (old render is `🔥 6 nap`)

- [ ] **Step 3: Restructure the component**

Replace the render return of `frontend/src/features/progression/components/AppHero.tsx` (and the ring constants at the top) — full new file body:

```tsx
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useDailyQuests, useGamification, useProfile, useTitles } from '@/data/hooks'
import { StreakSheet } from '@/features/progression/sheets/StreakSheet'
import { TitleShopSheet } from '@/features/progression/sheets/TitleShopSheet'
import { localDateString } from '@/shared/lib/dates'

const RING_R = 22
const RING_C = 2 * Math.PI * RING_R

/** The unified identity header on all 5 sections — one sticky avatar-height row
 *  (compact-header spec §3). Per-section content arrives via `utilities`
 *  (SubNavDropdown on Train/Fuel/Me/Insights; search + Insights link on Today). */
export function AppHero({ utilities }: { utilities?: ReactNode }) {
  const { user } = useProfile()
  const { profile } = useGamification()
  const { titles } = useTitles()
  const { quests } = useDailyQuests(localDateString())
  const [sheet, setSheet] = useState<'titles' | 'streak' | null>(null)

  const initials = user.name.split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2)
  const activeTitle = titles.find((t) => t.equipped)
  const done = quests.filter((q) => q.status === 'completed').length
  const progress = profile.xpForNext > 0 ? profile.xpInLevel / profile.xpForNext : 0

  return (
    <>
      <div className="apphero">
        {/* Two sibling links, not nested (invalid HTML): avatar → /me, level badge → /me/growth. */}
        <div className="avwrap">
          <Link to="/me" className="avlink np-press" aria-label="Profil">
            <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
              <circle cx="24" cy="24" r={RING_R} fill="none" stroke="var(--line)" strokeWidth="3" />
              <circle
                cx="24" cy="24" r={RING_R} fill="none" stroke="var(--coral)" strokeWidth="3"
                strokeLinecap="round" strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - progress)}
                transform="rotate(-90 24 24)"
              />
            </svg>
            <span className="avatar" aria-hidden="true">{initials}</span>
          </Link>
          <Link to="/me/growth" className="lvbadge np-press" aria-label={`Szint ${profile.level} — Growth`}>
            {profile.level}
          </Link>
        </div>
        <div className="idcol">
          <Link to="/me" className="t1">{user.name}</Link>
          <button type="button" className="t2 np-press" onClick={() => setSheet('titles')}>
            {activeTitle?.name ?? ''}
          </button>
        </div>
        <div className="counters">
          <button
            type="button" className="cnt fire np-press"
            aria-label={`${profile.streakDays} napos sorozat`}
            onClick={() => setSheet('streak')}
          >
            🔥 {profile.streakDays}
          </button>
          <Link
            to="/me/growth" className="cnt quest np-press"
            aria-label={`${done}/${quests.length} napi quest`}
          >
            ⚡ {done}/{quests.length}
          </Link>
          <button
            type="button" className="cnt coin np-press"
            aria-label={`${profile.coins} érme`}
            onClick={() => setSheet('titles')}
          >
            🪙 {profile.coins}
          </button>
        </div>
        {utilities && <div className="util">{utilities}</div>}
      </div>
      {sheet === 'titles' && <TitleShopSheet onClose={() => setSheet(null)} />}
      {sheet === 'streak' && <StreakSheet onClose={() => setSheet(null)} />}
    </>
  )
}
```

- [ ] **Step 4: Replace the CSS blocks**

In `frontend/src/styles/prototype.css` replace the whole `.apphero` family AND delete the `.apphero-chips`/`.apphero-chip` rules (currently lines 1535–1564, from the `/* ===== AppHero — unified gamified header...` comment through `.apphero-chip.coin { ... }`) with:

```css
/* ===== AppHero v2 — compact single-row sticky header on all 5 sections (mezo-ugqb).
   Sticky at z 45: above content and tab-bar (40), below StatusBar (50) / island (60) /
   sheets (200+). The border-bottom is the header/content separator from the spec. ===== */
.apphero {
  display: flex; align-items: center; gap: 10px; padding: 8px 24px;
  position: sticky; top: 0; z-index: 45;
  background: var(--canvas); border-bottom: 1px solid var(--line);
}
.apphero .avwrap { position: relative; width: 48px; height: 48px; flex-shrink: 0; }
.apphero .avlink { position: absolute; inset: 0; display: block; }
.apphero .avatar {
  position: absolute; inset: 5px; border-radius: 50%;
  background: linear-gradient(140deg, #EEEBF6, #E2DCF0); color: var(--lav-deep);
  font-family: var(--ff-display); font-weight: 800; font-size: 15px;
  display: flex; align-items: center; justify-content: center;
}
:root[data-theme="dark"] .apphero .avatar { background: linear-gradient(140deg, rgba(155,143,196,.25), rgba(122,109,168,.25)); }
.apphero .lvbadge {
  position: absolute; right: -2px; bottom: -2px; min-width: 18px; height: 18px;
  border-radius: 999px; background: var(--coral); color: #fff; font-size: 9.5px; font-weight: 800;
  display: flex; align-items: center; justify-content: center; border: 2px solid var(--canvas);
  padding: 0 3px; font-family: var(--ff-display); text-decoration: none;
}
.apphero .idcol { min-width: 0; }
.apphero .t1 {
  display: block; font-family: var(--ff-display); font-size: 16px; font-weight: 800;
  letter-spacing: -.3px; color: var(--ink); text-decoration: none;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.apphero .t2 { display: block; background: none; border: none; padding: 0; cursor: pointer; font-size: 10px; color: var(--lav-deep); font-weight: 800; margin-top: 1px; letter-spacing: .4px; text-transform: uppercase; text-align: left; font-family: var(--ff-body); }
.apphero .counters { margin-left: auto; display: flex; align-items: center; gap: 2px; }
.apphero .cnt {
  background: none; border: none; padding: 6px 4px; cursor: pointer;
  font: 800 12px/1 var(--ff-body); text-decoration: none; white-space: nowrap;
}
.apphero .cnt.fire { color: var(--amber-deep); }
.apphero .cnt.quest { color: var(--coral-deep); }
.apphero .cnt.coin { color: var(--sage-deep); }
.apphero .util { display: flex; gap: 7px; align-items: center; }
```

(Note: `.util` loses `margin-left: auto` — the counters now carry it.)

- [ ] **Step 5: Run the tests**

Run: `cd frontend && pnpm vitest run src/features/progression/components/AppHero.test.tsx src/features/progression/components/appHeroMount.test.tsx`
Expected: PASS (appHeroMount still passes — Insights joins only in Task 5)

- [ ] **Step 6: Visual sanity check (mock mode)**

Run: `cd frontend && VITE_USE_MOCK=true pnpm dev` and eyeball `/train` at 390px (dark + light): single row, ring 48px, counters right, old pill row still below (migrates in Task 3), separator line present, header sticks on scroll.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/progression/components/AppHero.tsx frontend/src/features/progression/components/AppHero.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(fe/progression): AppHero v2 — single sticky row, inline label-less counters (mezo-ugqb)"
```

---

### Task 3: Mount the dropdown on Train + Fuel; delete their SubNavs

**Files:**
- Create: `frontend/src/features/fuel/pages/tabs.ts`
- Create: `frontend/src/features/train/pages/TrainSection.test.tsx`
- Create: `frontend/src/features/fuel/pages/FuelSection.test.tsx`
- Modify: `frontend/src/features/train/pages/TrainSection.tsx`
- Modify: `frontend/src/features/fuel/pages/FuelSection.tsx`
- Delete: `frontend/src/features/train/pages/TrainSubNav.tsx`, `TrainSubNav.test.tsx`
- Delete: `frontend/src/features/fuel/pages/FuelSubNav.tsx`, `FuelSubNav.test.tsx`

**Interfaces:**
- Consumes: `SubNavDropdown` (Task 1), `TRAIN_TABS` from `@/features/train/pages/tabs` (existing).
- Produces: `FUEL_TABS: FuelTab[]` in `@/features/fuel/pages/tabs` (shape identical to `TrainTab`).

- [ ] **Step 1: Write the failing section tests**

`frontend/src/features/train/pages/TrainSection.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderAt = (path: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
}

test('the header dropdown chip shows the active Train sub-view', () => {
  renderAt('/train/sport')
  expect(screen.getByRole('button', { name: 'Sport' })).toHaveAttribute('aria-haspopup', 'menu')
  expect(document.querySelector('.np-pills')).toBeNull() // the pill row is gone
})

test('opening the dropdown lists all six Train sub-views', async () => {
  renderAt('/train/gym')
  await userEvent.click(screen.getByRole('button', { name: 'Gym' }))
  for (const label of ['Mai', 'Gym', 'Sport', 'Futás', 'Gyakorlatok', 'Mesociklusok']) {
    expect(screen.getByRole('menuitem', { name: label })).toBeInTheDocument()
  }
})
```

`frontend/src/features/fuel/pages/FuelSection.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderAt = (path: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
}

test('the header dropdown lists all six Fuel sub-views', async () => {
  renderAt('/fuel/stack')
  await userEvent.click(screen.getByRole('button', { name: 'Stack' }))
  for (const label of ['Mai', 'Terv', 'Stack', 'Receptek', 'Kamra', 'Gyógyszer']) {
    expect(screen.getByRole('menuitem', { name: label })).toBeInTheDocument()
  }
  expect(document.querySelector('.np-pills')).toBeNull()
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend && pnpm vitest run src/features/train/pages/TrainSection.test.tsx src/features/fuel/pages/FuelSection.test.tsx`
Expected: FAIL — the chip button doesn't exist yet (`Unable to find role="button" and name "Sport"`)

- [ ] **Step 3: Create `FUEL_TABS` and rewire both sections**

`frontend/src/features/fuel/pages/tabs.ts`:

```ts
export interface FuelTab {
  id: string
  to: string
  label: string
  end?: boolean
}

export const FUEL_TABS: FuelTab[] = [
  { id: 'mai', to: '/fuel', label: 'Mai', end: true },
  { id: 'plan', to: '/fuel/plan', label: 'Terv' },
  { id: 'stack', to: '/fuel/stack', label: 'Stack' },
  { id: 'recipes', to: '/fuel/recipes', label: 'Receptek' },
  { id: 'kamra', to: '/fuel/kamra', label: 'Kamra' },
  { id: 'gyogyszer', to: '/fuel/gyogyszer', label: 'Gyógyszer' },
]
```

`frontend/src/features/train/pages/TrainSection.tsx` (full new contents):

```tsx
import { Outlet } from 'react-router-dom'
import { AppHero } from '@/features/progression/components/AppHero'
import { TRAIN_TABS } from '@/features/train/pages/tabs'
import { SubNavDropdown } from '@/shared/ui/SubNavDropdown'

// Thin shell: the sticky AppHero row carries the sub-nav as a dropdown (compact-header
// spec §5); each sub-view renders its own `.pghead-np` (eyebrow + title) below it —
// Train's views need rich, data-driven headers (GYM title = active meso, Mai day-label,
// Sport + Log chip), so that header lives in the view, not the shell.
export function TrainSection() {
  return (
    <>
      <AppHero
        utilities={
          <SubNavDropdown label="Train alnavigáció" items={TRAIN_TABS} accent="var(--coral-deep)" />
        }
      />
      <Outlet />
    </>
  )
}
```

`frontend/src/features/fuel/pages/FuelSection.tsx` (full new contents):

```tsx
import { Outlet } from 'react-router-dom'
import { AppHero } from '@/features/progression/components/AppHero'
import { FUEL_TABS } from '@/features/fuel/pages/tabs'
import { SubNavDropdown } from '@/shared/ui/SubNavDropdown'

export function FuelSection() {
  return (
    <>
      <AppHero
        utilities={
          <SubNavDropdown label="Fuel alnavigáció" items={FUEL_TABS} accent="var(--sage-deep)" />
        }
      />
      <Outlet />
    </>
  )
}
```

Delete the four files:

```bash
git rm frontend/src/features/train/pages/TrainSubNav.tsx frontend/src/features/train/pages/TrainSubNav.test.tsx frontend/src/features/fuel/pages/FuelSubNav.tsx frontend/src/features/fuel/pages/FuelSubNav.test.tsx
```

- [ ] **Step 4: Run the section tests + the affected suites**

Run: `cd frontend && pnpm vitest run src/features/train src/features/fuel src/features/progression src/app`
Expected: PASS (leaf-page tests are untouched — they render their own pgheads; `appHeroMount` unaffected)

- [ ] **Step 5: Commit**

```bash
git add -A frontend/src/features/train frontend/src/features/fuel
git commit -m "feat(fe/train,fuel): sub-nav pills -> header SubNavDropdown (mezo-ugqb)"
```

---

### Task 4: Me section — dropdown with the ⚙️ extra action

**Files:**
- Create: `frontend/src/features/me/pages/tabs.ts`
- Modify: `frontend/src/features/me/pages/MeSection.tsx`
- Modify: `frontend/src/features/me/pages/MeSection.test.tsx`
- Modify: `frontend/src/app/navigation.test.tsx:25-33` (the settings flow)
- Delete: `frontend/src/features/me/pages/MeSubNav.tsx`, `MeSubNav.test.tsx`

**Interfaces:**
- Consumes: `SubNavDropdown` + `SubNavExtraAction` (Task 1), existing `SettingsSheet`, `Icon`.
- Produces: `ME_TABS: MeTab[]` in `@/features/me/pages/tabs`. Settings is reached as: chip (name = active sub-view label, e.g. `Profil`) → menuitem `Beállítások`.

- [ ] **Step 1: Update the tests first**

In `frontend/src/features/me/pages/MeSection.test.tsx` replace the three affected tests (keep the file's imports and `renderApp` as they are; the deep-link test stays unchanged):

```tsx
test('/me shows the Profil route with the header dropdown', async () => {
  renderApp('/me')
  expect(await screen.findByText('Biometria')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Profil' })).toHaveAttribute('aria-haspopup', 'menu')
})

test('the dropdown lists all seven Me sub-views and navigates to Cél', async () => {
  server.use(http.get(`${API_BASE}/api/goals`, () => HttpResponse.json([])))
  renderApp('/me')
  await userEvent.click(screen.getByRole('button', { name: 'Profil' }))
  for (const label of ['Profil', 'Growth', 'Cél', 'Súly', 'Alvás', 'Emberek', 'Tudás']) {
    expect(screen.getByRole('menuitem', { name: label })).toBeInTheDocument()
  }
  await userEvent.click(screen.getByRole('menuitem', { name: 'Cél' }))
  expect(await screen.findByRole('heading', { level: 1, name: /Hosszú cél/ })).toBeInTheDocument()
})

test('Beállítások menu item opens SettingsSheet and theme toggle flips data-theme', async () => {
  localStorage.clear()
  renderApp('/me')
  await userEvent.click(screen.getByRole('button', { name: 'Profil' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Beállítások' }))
  expect(document.documentElement.getAttribute('data-theme')).toBeNull()
  await userEvent.click(screen.getByRole('switch', { name: 'Téma váltás' }))
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
})
```

In `frontend/src/app/navigation.test.tsx` update the theme test to go through the menu:

```tsx
test('Me screen theme toggle flips data-theme', async () => {
  localStorage.clear()
  renderApp('/me')
  await userEvent.click(screen.getByRole('button', { name: 'Profil' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Beállítások' }))
  // Light is the default (no attribute; light is the CSS base); toggling flips to dark.
  expect(document.documentElement.getAttribute('data-theme')).toBeNull()
  await userEvent.click(screen.getByRole('switch', { name: 'Téma váltás' }))
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend && pnpm vitest run src/features/me/pages/MeSection.test.tsx`
Expected: FAIL — no chip button named `Profil` yet

- [ ] **Step 3: Create `ME_TABS` and rewire the section**

`frontend/src/features/me/pages/tabs.ts`:

```ts
export interface MeTab {
  id: string
  to: string
  label: string
  end?: boolean
}

export const ME_TABS: MeTab[] = [
  { id: 'profil', to: '/me', label: 'Profil', end: true },
  { id: 'growth', to: '/me/growth', label: 'Growth' },
  { id: 'goals', to: '/me/goals', label: 'Cél' },
  { id: 'weight', to: '/me/weight', label: 'Súly' },
  { id: 'sleep', to: '/me/sleep', label: 'Alvás' },
  { id: 'people', to: '/me/people', label: 'Emberek' },
  { id: 'knowledge', to: '/me/knowledge', label: 'Tudás' },
]
```

`frontend/src/features/me/pages/MeSection.tsx` (full new contents):

```tsx
import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AppHero } from '@/features/progression/components/AppHero'
import { ME_TABS } from '@/features/me/pages/tabs'
import { SettingsSheet } from '@/features/me/sheets/SettingsSheet'
import { Icon } from '@/shared/ui/Icon'
import { SubNavDropdown } from '@/shared/ui/SubNavDropdown'

export function MeSection() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  return (
    <>
      <AppHero
        utilities={
          <SubNavDropdown
            label="Me alnavigáció"
            items={ME_TABS}
            accent="var(--lav-deep)"
            extraAction={{
              label: 'Beállítások',
              icon: <Icon name="settings" size={14} />,
              onSelect: () => setSettingsOpen(true),
            }}
          />
        }
      />
      <Outlet />
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
    </>
  )
}
```

Delete:

```bash
git rm frontend/src/features/me/pages/MeSubNav.tsx frontend/src/features/me/pages/MeSubNav.test.tsx
```

- [ ] **Step 4: Run the Me + app suites**

Run: `cd frontend && pnpm vitest run src/features/me src/app`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A frontend/src/features/me frontend/src/app/navigation.test.tsx
git commit -m "feat(fe/me): sub-nav pills -> header dropdown with Beállítások menu item (mezo-ugqb)"
```

---

### Task 5: Insights joins the AppHero family; retire `.np-pills`

**Files:**
- Modify: `frontend/src/features/insights/pages/InsightsSection.tsx`
- Modify: `frontend/src/features/insights/pages/tabs.ts` (drop the `title` field)
- Modify: `frontend/src/features/insights/pages/insights.nav.test.tsx`
- Modify: `frontend/src/app/navigation.test.tsx:17-24` (Insights tab-click test)
- Modify: `frontend/src/features/progression/components/appHeroMount.test.tsx`
- Modify: `frontend/src/styles/prototype.css:1290-1294` (delete the `.np-pills`/`.np-pill` block)
- Delete: `frontend/src/features/insights/pages/InsightsSubNav.tsx`, `InsightsSubNav.test.tsx`

**Interfaces:**
- Consumes: `SubNavDropdown` (Task 1), `visibleInsightsTabs()` (existing, signature unchanged).
- Produces: `InsightsTab` loses `title` (its only consumer was the retired section header). Insights pages have NO section-level `<h1>` anymore — tests assert the chip label + page content instead.

- [ ] **Step 1: Update the tests first**

`frontend/src/features/insights/pages/insights.nav.test.tsx` — replace both test bodies (imports and `renderApp` stay):

```tsx
describe('insights nav (real mode default)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('Insights opens on Minták; the dropdown reaches Heti / Memoár / Előrejelzések / Kísérletek', async () => {
    renderApp('/insights')
    expect(screen.getByRole('button', { name: 'Minták' })).toHaveAttribute('aria-haspopup', 'menu')
    expect(await screen.findByText(/Új minták ·/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Minták' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Heti' }))
    expect(screen.getByRole('button', { name: 'Heti' })).toBeInTheDocument()

    // Memoár is un-ghosted at W2 — navigates to the honest placeholder.
    await userEvent.click(screen.getByRole('button', { name: 'Heti' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Memoár' }))
    expect(await screen.findByText('Az első memoár a hét zárásakor készül el.')).toBeInTheDocument()

    // Előrejelzések is un-ghosted at P1 — the honest still-learning state.
    await userEvent.click(screen.getByRole('button', { name: 'Memoár' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Előrejelzések' }))
    expect(
      await screen.findByText('Az első predikciók a megerősített mintákból készülnek — a minta-motor még tanul.'),
    ).toBeInTheDocument()

    // Kísérletek is un-ghosted at P2 — its null-state.
    await userEvent.click(screen.getByRole('button', { name: 'Előrejelzések' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Kísérletek' }))
    expect(
      await screen.findByText('Az első N=1 kísérletet a megerősített mintákból javasolja Mezo.'),
    ).toBeInTheDocument()
  })
})

describe('insights nav (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('Memoár navigation renders the demo memoir', async () => {
    renderApp('/insights')
    await userEvent.click(screen.getByRole('button', { name: 'Minták' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Memoár' }))
    expect(screen.getByText('Egy hét amikor a tested megtanult várni')).toBeInTheDocument()
  })
})
```

`frontend/src/app/navigation.test.tsx` — replace the tab-click test:

```tsx
test('navigates between tabs by clicking the bottom nav', async () => {
  renderApp('/today')
  await userEvent.click(screen.getByLabelText('Insights'))
  // Insights shell: the AppHero dropdown chip is the stable landmark; it shows the
  // active sub-view (the index sub-view is "Minták").
  expect(screen.getByLabelText('Insights alnavigáció')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Minták' })).toBeInTheDocument()
})
```

`frontend/src/features/progression/components/appHeroMount.test.tsx` — Insights now HAS the hero:

```tsx
test.each(['/today', '/train', '/fuel', '/me', '/insights'])('AppHero renders on %s', (path) => {
  renderAt(path)
  expect(document.querySelector('.apphero')).toBeInTheDocument()
})

test('the Insights entry point survives on /today', () => {
  renderAt('/today')
  expect(document.querySelector('a[aria-label="Insights"]')).toBeInTheDocument()
})
```

(The `AppHero does NOT render on /insights` test is deleted.)

- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend && pnpm vitest run src/features/insights/pages/insights.nav.test.tsx src/features/progression/components/appHeroMount.test.tsx`
Expected: FAIL — Insights still renders the pghead, no chip

- [ ] **Step 3: Rewire the section, drop `title`, delete the pills**

`frontend/src/features/insights/pages/InsightsSection.tsx` (full new contents):

```tsx
import { Outlet } from 'react-router-dom'
import { AppHero } from '@/features/progression/components/AppHero'
import { visibleInsightsTabs } from '@/features/insights/pages/tabs'
import { SubNavDropdown } from '@/shared/ui/SubNavDropdown'

export function InsightsSection() {
  return (
    <>
      <AppHero
        utilities={
          <SubNavDropdown
            label="Insights alnavigáció"
            items={visibleInsightsTabs()}
            accent="var(--lav-deep)"
          />
        }
      />
      <div style={{ padding: '8px 24px 24px' }}>
        <Outlet />
      </div>
    </>
  )
}
```

`frontend/src/features/insights/pages/tabs.ts` — remove the `title` field from the interface and every row (the retired section header was its only consumer):

```ts
import { isMockMode } from '@/data/_client/mode'

export interface InsightsTab {
  id: string
  to: string
  label: string
  end?: boolean
}

export const INSIGHTS_TABS: InsightsTab[] = [
  { id: 'patterns', to: '/insights', label: 'Minták', end: true },
  { id: 'weekly', to: '/insights/weekly', label: 'Heti' },
  { id: 'memoir', to: '/insights/memoir', label: 'Memoár' },
  { id: 'knowledge', to: '/insights/knowledge', label: 'Tudástár' },
  { id: 'chat', to: '/insights/chat', label: 'Chat' },
  { id: 'predictions', to: '/insights/predictions', label: 'Előrejelzések' },
  { id: 'experiments', to: '/insights/experiments', label: 'Kísérletek' },
]

/** Phase-3+ demo surfaces that were hidden in real mode until the proactive epic shipped them:
 *  Memoir un-ghosted at W2 (mezo-h4wp.4), Predictions at P1 (mezo-h4wp.7), Experiments at P2
 *  (mezo-h4wp.8). The set is now EMPTY — all seven Insights tabs are real in both modes. */
const PHASE3_TAB_IDS = new Set<string>([])

export function visibleInsightsTabs(): InsightsTab[] {
  return isMockMode() ? INSIGHTS_TABS : INSIGHTS_TABS.filter((t) => !PHASE3_TAB_IDS.has(t.id))
}
```

Delete the pill CSS: in `frontend/src/styles/prototype.css` remove lines 1290–1294 (`.np-pills { … }`, `.np-pills::-webkit-scrollbar`, `.np-pill { … }`, the dark `.np-pill` override, `.np-pill.on { … }`).

Delete the sub-nav files:

```bash
git rm frontend/src/features/insights/pages/InsightsSubNav.tsx frontend/src/features/insights/pages/InsightsSubNav.test.tsx
```

Then verify nothing references the deleted class or the `title` field:

```bash
grep -rn "np-pill\|InsightsSubNav" frontend/src && echo "LEFTOVER REFS — fix them" || echo OK
grep -rn "\.title" frontend/src/features/insights | grep -v test && echo "check these" || echo OK
```

- [ ] **Step 4: Run the affected suites**

Run: `cd frontend && pnpm vitest run src/features/insights src/features/progression src/app`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A frontend/src/features/insights frontend/src/features/progression frontend/src/app frontend/src/styles/prototype.css
git commit -m "feat(fe/insights): join the AppHero family via header dropdown; retire np-pills (mezo-ugqb)"
```

---

### Task 6: Full gates, docs, PR flow

**Files:**
- Modify: `docs/features/_platform-design-system.md` (§1a structure + AppHero pattern + new SubNavDropdown primitive; np-pills retirement)
- Modify: `docs/features/today.md`, `train.md`, `fuel.md`, `me.md`, `insights.md`, `growth.md` (header anatomy + file maps: `*SubNav` → `SubNavDropdown` via AppHero `utilities`; Insights: pghead retired, `title` dropped)
- Modify: `docs/references/frontend_conventions.md` (§2 template + §3 taxonomy row + §7 recipe step 3: `*SubNav` components are retired — sub-nav lives in `tabs.ts` + `SubNavDropdown` passed to AppHero)

**Interfaces:** none — documentation + verification only.

- [ ] **Step 1: Full frontend gate (both modes)**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: build green, ALL tests pass in BOTH modes. Fix anything that surfaces before proceeding.

- [ ] **Step 2: Visual QA in both themes**

`VITE_USE_MOCK=true pnpm dev` — check `/today`, `/train/gym`, `/fuel/stack`, `/me`, `/insights` in dark AND light: single-row header everywhere, separator visible, dropdown opens/dismisses, sticky works, Me settings reachable, Today search+✨ intact, level-badge not clipped, long name truncates with ellipsis.

- [ ] **Step 3: Update the docs**

Per file, edit only the affected sections (living docs, overwrite in place):
- `_platform-design-system.md`: AppHero v2 anatomy (single sticky row, 48px ring, inline counters, separator), `SubNavDropdown` added to the shared/ui inventory, `.np-pills` removed, z-scale note (header 45).
- `today.md`/`train.md`/`fuel.md`/`me.md`: header section + file map (SubNav deleted, tabs.ts added for fuel/me, settings via menu on Me).
- `insights.md`: section header replaced by AppHero + dropdown; `title` field dropped; no section h1.
- `growth.md`: counter presentation (label-less) — tap targets unchanged.
- `frontend_conventions.md`: taxonomy row + recipe update (no more `*SubNav` components).

Run: `node scripts/lint-docs.mjs` (repo root) — must exit clean (staleness flags cleared).

- [ ] **Step 4: Commit docs**

```bash
git add docs
git commit -m "docs(features): compact header v2 — AppHero row, SubNavDropdown, np-pills retirement (mezo-ugqb)"
```

- [ ] **Step 5: Push branch + self-PR (CI gate)**

```bash
git push -u origin feat/compact-header
gh pr create --fill --title "feat(fe): compact single-row header + subnav dropdown (mezo-ugqb)"
gh pr checks --watch
```

Expected: CI green (backend suite untouched but runs on clean runner; FE both modes + lint + contract-drift).

- [ ] **Step 6: Merge locally with --no-ff, push, clean up**

```bash
git checkout main && git pull --rebase
git merge --no-ff feat/compact-header -m "Merge branch 'feat/compact-header' — compact single-row header + subnav dropdown (mezo-ugqb)"
git push
git branch -d feat/compact-header && git push origin --delete feat/compact-header
bd close mezo-ugqb
bd dolt push
git status   # MUST show "up to date with origin"
```

---

## Self-review notes

- **Spec coverage:** §3 anatomy → Task 2; §4 primitive → Task 1; §5 mounting (5 sections) → Tasks 3–5 (Today needs no edit — the change is inside AppHero); §6 deletions → Tasks 3–5; §7 testing → Tasks 1–5 + gate in 6; §8 docs → Task 6.
- **Ordering:** during Tasks 2–4 the migrated sticky row coexists with not-yet-migrated pill rows on other sections — harmless (both sticky), fully resolved by Task 5 which also deletes the shared CSS last.
- **Type consistency:** `SubNavItem {to,label,end?}` matches `TrainTab`/`FuelTab`/`MeTab`/`InsightsTab` structurally (extra `id` is fine). Accessible names used across tests: chip = active label; menu items = `menuitem` role; counters = the three aria-label strings defined in Task 2.
