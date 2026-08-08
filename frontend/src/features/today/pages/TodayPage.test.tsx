import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { TodayPage } from '@/features/today/pages/TodayPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { HABIT_CATALOG_KEY } from '@/data/habit/habitAdminHooks'
import type { HabitDay } from '@/data/habit/habitApi'
import { mockHabitCatalog, mockHabitDay } from '@/data/habit/habitMock'
import { localDateString } from '@/shared/lib/dates'
import { onToast, type ToastMessage } from '@/shared/lib/toastBus'
import type { HabitChainInfo, HabitItem } from '@/data/types'

const at = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(2026, 4, 21)
  d.setHours(h, m, 0, 0)
  return d
}

/**
 * Clock-only fake timers for the tests that await a mutation: with `setTimeout`
 * faked too, RTL's `waitFor` polls on a clock nobody advances and always times out.
 * Faking `Date` alone is all the face derivation needs.
 */
const clockAt = (hhmm: string) => vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(at(hhmm))

/** Reports the live URL so a dispatched `nav` action and the `?dp=` writes are observable. */
function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname}{loc.search}</div>
}

function renderToday(path = '/today') {
  return render(
    <QueryWrapper>
      <LevelUpProvider>
        <MemoryRouter initialEntries={[path]}>
          <TodayPage />
          <LocationProbe />
        </MemoryRouter>
      </LevelUpProvider>
    </QueryWrapper>,
  )
}

/** Which island is big right now — the selection's single observable. */
const bigFace = (container: HTMLElement) =>
  (container.querySelector('.isl.isl-big') as HTMLElement | null)?.dataset.tone ?? null

/** A capsule's button (the visible ones only — the big island's capsule is aria-hidden). */
const capsule = (name: RegExp) => screen.getByRole('button', { name })

/** Opens the selected island's L1 list. */
const openList = () => fireEvent.click(screen.getByRole('button', { name: /^még \d+ ›$/ }))

describe('TodayPage — island selection', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers() })

  test('with no ?dp the big island comes from the clock', () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    const { container } = renderToday()
    expect(bigFace(container)).toBe('reggel')
  })

  test('the evening clock lands on the evening island', () => {
    vi.useFakeTimers().setSystemTime(at('21:05'))
    const { container } = renderToday()
    expect(bigFace(container)).toBe('este')
  })

  test('?dp= overrides the clock — but the clock still marks the CURRENT capsule', () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    const { container } = renderToday('/today?dp=este')
    expect(bigFace(container)).toBe('este')
    // „hol tartok" (the clock) and „mit nézek" (the selection) must not blur together.
    expect(capsule(/^Reggel · most ·/)).toBeInTheDocument()
    expect(within(capsule(/^Reggel · most ·/)).getByText('MOST')).toBeInTheDocument()
  })

  test.each(['', 'holnap', '4'])('a blank or unknown ?dp=%s falls back to the clock face', (v) => {
    vi.useFakeTimers().setSystemTime(at('13:42'))
    const { container } = renderToday(`/today?dp=${v}`)
    expect(bigFace(container)).toBe('nap')
  })

  test('tapping a capsule grows that island', () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    const { container } = renderToday()
    // fireEvent (not element.click()) — only the act-wrapped events flush the router's
    // state update in this Vitest/RTL/React-19 stack.
    fireEvent.click(capsule(/^Este ·/))
    expect(bigFace(container)).toBe('este')
  })

  test('selecting the CURRENT face drops ?dp entirely (no stale param)', () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    const { container } = renderToday('/today?dp=este')
    fireEvent.click(capsule(/^Reggel · most ·/))
    expect(bigFace(container)).toBe('reggel')
    expect(screen.getByTestId('loc').textContent).toBe('/today')
  })

  test('selecting another face writes ?dp and keeps the other params', () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    renderToday('/today?vulnerable=on')
    fireEvent.click(capsule(/^Nap ·/))
    expect(screen.getByTestId('loc').textContent).toBe('/today?vulnerable=on&dp=nap')
  })

  test('a face switch closes an open L1 list', () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    const { container } = renderToday()
    openList()
    expect(container.querySelector('.isl-l1')).toBeTruthy()
    fireEvent.click(capsule(/^Nap ·/))
    expect(container.querySelector('.isl-l1')).toBeNull()
  })
})

describe('TodayPage — composition', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers() })

  test('the fixed chrome + the sky render', () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    const { container } = renderToday()
    expect(container.querySelector('.apphero')).toBeTruthy()
    expect(container.querySelector('.sky-islands')).toBeTruthy()
    expect(container.querySelectorAll('.isl:not(.isl-anchor)')).toHaveLength(3)
  })

  test('the retired surfaces are gone', () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    const { container } = renderToday()
    expect(container.querySelector('.greet')).toBeNull()
    expect(container.querySelector('.dfs')).toBeNull()
    expect(container.querySelector('.faceswap')).toBeNull()
    expect(container.querySelector('.tdc')).toBeNull()
    expect(container.querySelector('.fhc-next')).toBeNull()
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryByText('Ma még vár rád')).toBeNull()
    expect(screen.queryByText('Szép reggelt, Daniel — induljunk.')).toBeNull()
  })

  test('?day=rough melts the sky into the single anchor island', () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    renderToday('/today?day=rough')
    expect(screen.queryByRole('button', { name: /megnyitás/ })).toBeNull()
    expect(screen.getByText(/Horgony mód/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kilépés a horgony módból' })).toBeInTheDocument()
  })

  test('the morning island promotes the chain\'s first open step as its ONE CTA', () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    renderToday()
    expect(screen.getByRole('button', { name: '50 fekvőtámasz' })).toBeInTheDocument()
    // the other two islands are capsules with their own counters
    expect(capsule(/^Nap ·/)).toBeInTheDocument()
    expect(capsule(/^Este ·/)).toBeInTheDocument()
  })

  test('the morning hero is the sleep number with contextual facts', () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    const { container } = renderToday()
    expect(container.querySelector('.isl-hero-v')?.textContent).toContain('óra alvás')
    // facts are contextualized (delta lines), not raw numbers
    expect(container.querySelectorAll('.isl-fact').length).toBeGreaterThan(0)
  })

  test('EVERY pending morning-chain step is actionable in L1', () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    const { container } = renderToday()
    openList()
    const group = [...container.querySelectorAll('.isl-grouph')]
      .find((g) => g.textContent?.startsWith('Reggeli rutin'))!
    const rows = [...group.parentElement!.querySelectorAll('.itemrow')]
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) {
      expect(within(r as HTMLElement).getByRole('button')).toBeInTheDocument()
    }
  })

  test('a middle chain step can be ticked without touching the ones before it', () => {
    clockAt('09:12')
    renderToday()
    openList()
    const row = screen.getByText('Gombakávé').closest('.itemrow') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: 'Logolás' }))
    expect(screen.getByTestId('loc').textContent).toBe('/fuel/stack')
  })

  test("the chain's linked content is reachable from its L1 row", () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    renderToday()
    openList()
    const link = screen.getByRole('link', { name: 'Reggeli videó megnyitása' })
    expect(link).toHaveAttribute('href', expect.stringContaining('facebook.com'))
    expect(link).toHaveAttribute('target', '_blank')
    // …and its own Pipa action survives beside it
    const row = link.closest('.itemrow') as HTMLElement
    expect(within(row).getByRole('button', { name: 'Pipa' })).toBeInTheDocument()
  })

  test('the briefing prose lives at the top of the morning L1 as a CoachBubble', () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    const { container } = renderToday()
    // L0 carries no prose — no coach bubble on the closed island
    expect(container.querySelector('.coach-bubble')).toBeNull()
    openList()
    expect(container.querySelector('.isl-l1 .coach-bubble')).toBeTruthy()
  })

  test('the evening island owns the Napzárás act — no ritual row in L1', () => {
    clockAt('21:30')
    const { container } = renderToday()
    // Inside the window the CTA is the one affordance…
    expect(screen.getByRole('button', { name: 'Zárjuk le a napot' })).toBeInTheDocument()
    openList()
    // …and the L1 never repeats it as a row (neither the ritual item nor evening_ritual).
    const rowTitles = [...container.querySelectorAll('.isl-l1 .itemrow .itemrow-t1')].map((n) => n.textContent)
    expect(rowTitles).not.toContain('Zárjuk le a napot')
    expect(rowTitles.filter((t) => t?.includes('Napzárás'))).toHaveLength(0)
  })

  test('the day island keeps the workout niggle warning, and ?niggle=off suppresses it', () => {
    clockAt('13:42')
    const { container, unmount } = renderToday()
    expect(container.querySelector('.isl-warnchip')?.textContent).toContain('niggle')
    unmount()
    const off = renderToday('/today?niggle=off')
    expect(off.container.querySelector('.isl-warnchip')).toBeNull()
  })

  test('the quest group heading links into quest management', () => {
    clockAt('09:12')
    renderToday()
    openList()
    const link = screen.getByRole('link', { name: 'Küldetések kezelése a Növekedésben' })
    expect(link).toHaveAttribute('href', '/me/growth')
    expect(link.textContent).toMatch(/^\d+\/\d+ · \+\d+ XP/)
  })

  test('the evening retrospective appears with the day XP once something is done', async () => {
    clockAt('21:30')
    renderToday()
    openList()
    // The seed evening chain is entirely pending, so the retrospective is honestly absent…
    expect(screen.queryByText(/Ahogy a nap telt/)).toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: 'Pipa' })[0])
    // …and appears — with the day's XP line — the moment the first item lands.
    await waitFor(() => expect(screen.getByText(/Ahogy a nap telt/)).toBeInTheDocument())
    expect(screen.getByText(/Ma összesen/)).toBeInTheDocument()
  })
})

/**
 * The `wind_down` habit is offered exactly once (mezo-mvb4.1 heritage): inside the winddown
 * phase the island's own „Leállás megvolt ✓" ghost owns it and the L1 row is filtered; in dim
 * and outside the windows the L1 row is the only affordance (act-anywhere must survive).
 * Mock anchor (wake 06:45 / bed 23:15): dim 21:45–22:15 · winddown 22:15–23:15.
 */
describe('TodayPage — the wind-down habit is offered exactly once', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers() })

  test('inside the winddown phase the island ghost owns it — no L1 row', () => {
    clockAt('22:30')
    renderToday()
    expect(screen.getByRole('button', { name: 'Leállás megvolt ✓' })).toBeInTheDocument()
    openList()
    expect(screen.queryByText('Wind-down, képernyő le')).toBeNull()
  })

  test('in the dim phase the L1 row keeps the only affordance', () => {
    clockAt('22:00')
    renderToday()
    expect(screen.queryByRole('button', { name: /Leállás megvolt/ })).toBeNull()
    openList()
    const row = screen.getByText('Wind-down, képernyő le').closest('.itemrow') as HTMLElement
    expect(within(row).getByRole('button', { name: 'Pipa' })).toBeInTheDocument()
  })

  test('outside the wind-down windows the L1 row is still there', () => {
    clockAt('21:30')
    renderToday()
    expect(screen.queryByRole('button', { name: /Leállás megvolt/ })).toBeNull()
    openList()
    expect(screen.getByText('Wind-down, képernyő le')).toBeInTheDocument()
  })
})

describe('TodayPage — no island renders a control that does nothing', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers() })

  /**
   * The class-level guard, driven off the REAL quest/habit/fuel/check-in fixtures: on every
   * island, open L1, tap every control and assert that each one did something observable —
   * navigated, opened a sheet, or fired a write. A pill that leaves the URL unchanged, opens
   * nothing and writes nothing is the defect this asserts against.
   */
  test.each(['reggel', 'nap', 'este'])('every L1 control on the %s island does something', async (face) => {
    clockAt('09:12')
    const first = renderToday(`/today?dp=${face}`)
    openList()
    const titles = [...first.container.querySelectorAll('.isl-l1 .itemrow')]
      .filter((row) => row.querySelector('button'))
      .map((row) => row.querySelector('.itemrow-t1')?.textContent)
    expect(titles.length).toBeGreaterThan(0)
    first.unmount()

    for (const title of titles) {
      // Fresh mount per control: a served action changes the tree, which would invalidate
      // the node handles collected above.
      const one = renderToday(`/today?dp=${face}`)
      openList()
      const row = [...one.container.querySelectorAll('.isl-l1 .itemrow')]
        .find((r) => r.querySelector('.itemrow-t1')?.textContent === title)!
      const btn = row.querySelector('button')!
      const before = one.container.innerHTML
      fireEvent.click(btn)
      await waitFor(() => {
        const navigated = screen.getByTestId('loc').textContent !== `/today?dp=${face}`
        const sheetOpened = document.querySelector('[role="dialog"]') !== null
        const treeChanged = one.container.innerHTML !== before
        expect(
          navigated || sheetOpened || treeChanged,
          `„${title}" renders a control that does nothing on the ${face} island`,
        ).toBe(true)
      })
      one.unmount()
    }
  })
})

describe('TodayPage — the act() dispatcher (ADR 0010)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers() })

  test('an ACTIVITY quest row opens the activity log sheet, it never self-completes', () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    renderToday()
    openList()
    const row = screen.getByText('Olvass ma legalább 10 percet').closest('.itemrow') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: 'Naplózz' }))
    expect(screen.getByText('Mi történt ma?')).toBeInTheDocument()
  })

  test('the promoted CTA routes a MANUAL habit to check() and advances to the next step', async () => {
    clockAt('09:12')
    renderToday()
    const cta = screen.getByRole('button', { name: '50 fekvőtámasz' })
    fireEvent.click(cta)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Reggeli videó' })).toBeInTheDocument())
  })

  test('a fuel row logs IN PLACE instead of navigating to /fuel', () => {
    vi.useFakeTimers().setSystemTime(at('13:42'))
    const { container } = renderToday()
    openList()
    const fuelRow = [...container.querySelectorAll('.isl-l1 .itemrow')]
      .find((r) => within(r as HTMLElement).queryByRole('button', { name: 'Logold' })) as HTMLElement
    fireEvent.click(within(fuelRow).getByRole('button', { name: 'Logold' }))
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Mit ettél?')
    expect(screen.getByTestId('loc').textContent).toBe('/today') // it did NOT navigate away
  })

  test('a check-in row opens the check-in sheet for its own slot', () => {
    vi.useFakeTimers().setSystemTime(at('13:42'))
    renderToday()
    openList()
    const row = screen.getByText('Hogy vagy?').closest('.itemrow') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: 'Koppints' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('dialog').textContent).toContain('14:00')
  })
})

/**
 * Per-chain celebrations (mezo-n5e9.4): a custom chain from the routine editor toasts with its
 * own title; the seed chains keep their fixed copy. Bespoke QueryClient so the caches can be
 * pre-seeded before mount.
 */
describe('TodayPage — per-chain celebrations (mezo-n5e9.4)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers() })

  let off: (() => void) | null = null
  const listen = () => {
    const seen: ToastMessage[] = []
    off = onToast((t) => seen.push(t))
    return seen
  }
  afterEach(() => { off?.(); off = null })

  function renderWithClient(qc: QueryClient, path: string) {
    return render(
      <QueryClientProvider client={qc}>
        <LevelUpProvider>
          <MemoryRouter initialEntries={[path]}>
            <TodayPage />
          </MemoryRouter>
        </LevelUpProvider>
      </QueryClientProvider>,
    )
  }

  test('the seed morning chain still celebrates with its exact fixed copy on completion', () => {
    clockAt('09:12')
    const today = localDateString()
    const seen = listen()
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const allMorningDone: HabitDay = {
      habits: mockHabitDay.map((h) => (h.chain === 'MORNING' ? { ...h, status: 'done' as const } : h)),
      levelUps: [],
    }
    qc.setQueryData(['habitDay', today], allMorningDone)

    renderWithClient(qc, '/today?dp=reggel')

    expect(seen).toEqual([{ kind: 'success', text: '🌅 Tökéletes reggel' }])
  })

  test('a custom DAY chain completing fires its own ✨ toast — the seed chains stay silent', () => {
    clockAt('13:42')
    const today = localDateString()
    const seen = listen()
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    const customChain: HabitChainInfo = {
      id: 'chain-day-custom', chainKey: 'DAY_CUSTOM', title: 'Déli szünet', daypart: 'DAY',
      position: 3, isActive: true,
      defs: [{
        id: 'def-day1', habitKey: 'day_habit_1', chainKey: 'DAY_CUSTOM', position: 1,
        title: 'Déli levegőzés', why: null, anchorCopy: null, mode: 'MANUAL', metric: 'manual',
        skillKey: 'mindfulness', xp: 5, linkUrl: null, isActive: true,
      }],
    }
    qc.setQueryData(HABIT_CATALOG_KEY, { chains: [...mockHabitCatalog.chains, customChain] })

    const customHabit: HabitItem = {
      key: 'day_habit_1', chain: 'DAY_CUSTOM', position: 1, title: 'Déli levegőzés',
      why: 'ok', anchorCopy: 'delben', mode: 'MANUAL', status: 'done',
      doneAt: '2026-05-21T12:00:00Z', xp: 5, strengthPct: null,
    }
    const day: HabitDay = { habits: [...mockHabitDay, customHabit], levelUps: [] }
    qc.setQueryData(['habitDay', today], day)

    renderWithClient(qc, '/today?dp=nap')

    // Neither seed chain is complete in the unmodified mock day, so ONLY the custom chain toasts.
    expect(seen).toEqual([{ kind: 'success', text: '✨ Déli szünet kész' }])
  })
})
