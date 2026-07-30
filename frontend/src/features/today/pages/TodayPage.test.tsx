import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { TodayPage } from '@/features/today/pages/TodayPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'

const at = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(2026, 4, 21)
  d.setHours(h, m, 0, 0)
  return d
}

/**
 * Clock-only fake timers for the tests that await a mutation: with `setTimeout`
 * faked too, RTL's `waitFor` polls on a clock nobody advances and always times out
 * (this repo has no `jest` global, so RTL cannot detect the fake timers and drive
 * them itself). Faking `Date` alone is all the face derivation needs.
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

describe('TodayPage — face selection', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers() })

  test('with no ?dp the face comes from the clock', () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    renderToday()
    expect(screen.getByRole('tab', { selected: true })).toHaveAccessibleName(/^Reggel/)
  })

  test('the evening clock lands on the evening face', () => {
    vi.useFakeTimers().setSystemTime(at('21:05'))
    renderToday()
    expect(screen.getByRole('tab', { selected: true })).toHaveAccessibleName(/^Este/)
  })

  test('?dp= overrides the clock — but the clock still marks the CURRENT pill', () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    renderToday('/today?dp=este')
    expect(screen.getByRole('tab', { selected: true })).toHaveAccessibleName(/^Este/)
    // „hol tartok" (the clock) and „mit nézek" (the selection) must not blur together.
    expect(screen.getByRole('tab', { name: /^Reggel/ })).toHaveAccessibleName(/· most/)
    expect(screen.getByRole('tab', { selected: true })).not.toHaveAccessibleName(/· most/)
  })

  test.each(['', 'holnap', '4'])('a blank or unknown ?dp=%s falls back to the clock face', (v) => {
    vi.useFakeTimers().setSystemTime(at('13:42'))
    renderToday(`/today?dp=${v}`)
    expect(screen.getByRole('tab', { selected: true })).toHaveAccessibleName(/^Nap/)
  })

  test('tapping another pill switches the rendered face', () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    renderToday()
    // fireEvent (not element.click()) — only the act-wrapped events flush the router's
    // state update in this Vitest/RTL/React-19 stack.
    fireEvent.click(screen.getByRole('tab', { name: /^Este/ }))
    expect(screen.getByRole('tab', { selected: true })).toHaveAccessibleName(/^Este/)
  })

  test('selecting the CURRENT face drops ?dp entirely (no stale param)', () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    renderToday('/today?dp=este')
    fireEvent.click(screen.getByRole('tab', { name: /^Reggel/ }))
    expect(screen.getByRole('tab', { selected: true })).toHaveAccessibleName(/^Reggel/)
    expect(screen.getByTestId('loc').textContent).toBe('/today')
  })

  test('selecting another face writes ?dp and keeps the other params', () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    renderToday('/today?vulnerable=on')
    fireEvent.click(screen.getByRole('tab', { name: /^Nap/ }))
    expect(screen.getByTestId('loc').textContent).toBe('/today?vulnerable=on&dp=nap')
  })
})

describe('TodayPage — face-swap direction (mezo-1khu)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers() })

  test('moving forward (Reggel → Nap) stamps data-dir="fwd"', () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    const { container } = renderToday()
    fireEvent.click(screen.getByRole('tab', { name: /^Nap/ }))
    expect(container.querySelector('.faceswap')).toHaveAttribute('data-dir', 'fwd')
  })

  test('moving backward (Este → Reggel) stamps data-dir="back"', () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    const { container } = renderToday('/today?dp=este')
    fireEvent.click(screen.getByRole('tab', { name: /^Reggel/ }))
    expect(container.querySelector('.faceswap')).toHaveAttribute('data-dir', 'back')
  })

  test('skipping forward past a face (Reggel → Este) still reads as forward', () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    const { container } = renderToday()
    fireEvent.click(screen.getByRole('tab', { name: /^Este/ }))
    expect(container.querySelector('.faceswap')).toHaveAttribute('data-dir', 'fwd')
  })

  test('the face-swap wrapper remounts (a fresh key) on every face change', () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    const { container } = renderToday()
    const before = container.querySelector('.faceswap')
    fireEvent.click(screen.getByRole('tab', { name: /^Nap/ }))
    const after = container.querySelector('.faceswap')
    expect(after).not.toBe(before)
  })
})

describe('TodayPage — composition', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers() })

  test('the fixed chrome renders on every face', () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    const { container } = renderToday()
    expect(container.querySelector('.apphero')).toBeTruthy()
    expect(container.querySelector('.greet')).toBeTruthy()
    expect(screen.getByRole('tablist', { name: 'Napszakok' })).toBeInTheDocument()
  })

  test('the retired sections are gone', () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    const { container } = renderToday()
    expect(container.querySelector('.dayarc')).toBeNull()
    expect(container.querySelector('.zonediv')).toBeNull()
    expect(container.querySelector('.beats')).toBeNull()
    expect(container.querySelector('.scard')).toBeNull()
    expect(container.querySelector('.np-hero')).toBeNull()
    expect(screen.queryByText('Teendők ma')).toBeNull()
    expect(screen.queryByText('A napod')).toBeNull()
    expect(screen.queryByText('Ma eddig')).toBeNull()
  })

  test('?day=rough still replaces the whole screen with AnchorMode', () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    renderToday('/today?day=rough')
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.getByText('Kilépés')).toBeInTheDocument()
  })

  test('the morning face leads with the chain hero and previews the later faces', () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    const { container } = renderToday()
    expect(container.querySelector('.fhc-next-tx b')?.textContent).toBe('50 fekvőtámasz')
    expect(screen.getByText('Ma még vár rád')).toBeInTheDocument()
  })

  test('EVERY pending morning-chain step is actionable, not just the promoted one', () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    const { container } = renderToday()
    // seed: pushups (promoted) · videó · gombakávé · edzés · fehérjés reggeli
    const promoted = container.querySelector('.fhc-next-tx b')?.textContent
    expect(promoted).toBe('50 fekvőtámasz')
    const group = [...container.querySelectorAll('.tdc-grp')]
      .find((g) => g.textContent?.startsWith('Reggeli rutin'))!
    const rows = [...group.parentElement!.querySelectorAll('.itemrow')]
    // the promoted step is NOT repeated as a row, and every other step has its own control
    expect(rows.map((r) => r.querySelector('.itemrow-t1')?.textContent)).not.toContain(promoted)
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) {
      expect(within(r as HTMLElement).getByRole('button')).toBeInTheDocument()
    }
  })

  test('a middle chain step can be ticked without touching the ones before it', async () => {
    clockAt('09:12')
    const { container } = renderToday()
    // „Gombakávé" is step 6 — two steps behind the promoted one. Before this round it was an
    // inert metapill, so a skipped step could never be logged.
    const row = screen.getByText('Gombakávé').closest('.itemrow') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: 'Logolás' }))
    expect(screen.getByTestId('loc').textContent).toBe('/fuel/stack')
    expect(container.querySelector('.fhc-next-tx b')?.textContent).toBe('50 fekvőtámasz')
  })

  test("the chain's linked content is reachable from its row", () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    renderToday()
    const link = screen.getByRole('link', { name: 'Reggeli videó megnyitása' })
    expect(link).toHaveAttribute('href', expect.stringContaining('facebook.com'))
    expect(link).toHaveAttribute('target', '_blank')
    // …and its own Pipa action survives beside it
    const row = link.closest('.itemrow') as HTMLElement
    expect(within(row).getByRole('button', { name: 'Pipa' })).toBeInTheDocument()
  })

  test('the evening face names Napzárás exactly once — the hero owns it, the row is gone', () => {
    clockAt('21:05')
    renderToday()
    // The hero's eyebrow is the ONE naming. The `evening_ritual` habit row and the
    // `ritual:day` item both described the same act with a weaker affordance.
    expect(screen.getAllByText('NAPZÁRÁS')).toHaveLength(1)
    expect(screen.queryByText('Napzárás')).toBeNull()
    // …and the hero still offers the route (its CTA inside the window, the card otherwise).
    expect(screen.getByRole('heading', { name: 'Zárjuk le a napot' })).toBeInTheDocument()
  })

  test('the day face keeps the workout niggle warning, and ?niggle=off suppresses it', () => {
    clockAt('13:42')
    const { container, unmount } = renderToday()
    expect(container.querySelector('.warmstrip')?.textContent).toContain('niggle')
    unmount()
    const off = renderToday('/today?niggle=off')
    expect(off.container.querySelector('.warmstrip')).toBeNull()
  })

  test('a face with fuel rows carries the fuel plan companion line', () => {
    clockAt('13:42')
    const { container } = renderToday()
    expect(container.querySelector('.tdc-note')).toBeTruthy()
  })

  test('the TodoCard header links into quest management', () => {
    clockAt('09:12')
    renderToday()
    const link = screen.getByRole('link', { name: 'Küldetések kezelése a Növekedésben' })
    expect(link).toHaveAttribute('href', '/me/growth')
    expect(link.textContent).toMatch(/^\d+\/\d+ · \+\d+ XP/)
  })

  test('the evening face closes with the retrospective and the day XP once something is done', async () => {
    clockAt('21:05')
    renderToday()
    // The seed evening chain is entirely pending, so the retrospective is honestly absent…
    expect(screen.queryByText('Ahogy a nap telt')).toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: 'Pipa' })[0])
    // …and appears — with the day's XP line — the moment the first item lands.
    await waitFor(() => expect(screen.getByText('Ahogy a nap telt')).toBeInTheDocument())
    expect(screen.getByText(/Ma összesen/)).toBeInTheDocument()
  })
})

/**
 * I2 — the `wind_down` habit used to be offered TWICE on the Este face inside the winddown
 * window: once as the `WindDownBanner`'s own row (title + anchor cue + XP + `Pipa`) and once as
 * an „Esti rutin" row in the `TodoCard`, because `OWNED_BY_RITUAL_HERO` filtered only
 * `evening_ritual`. The two controls came from two `useHabitActions` instances with INDEPENDENT
 * `pending` state, so tapping one left the other live and a second `check('wind_down')` could
 * fire. With the mock anchor (wake 06:45 / bed 23:15) the winddown phase is 22:15–23:15.
 */
describe('TodayPage — the wind-down habit is offered exactly once', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers() })

  const windDownRows = () =>
    screen.getAllByText('Wind-down, képernyő le').map((n) => n.closest('.itemrow') as HTMLElement)

  test('inside the winddown phase the banner owns it — one row, one Pipa', () => {
    clockAt('22:30')
    renderToday()
    // Two before the fix: the banner's row AND the „Esti rutin" TodoCard row.
    const rows = windDownRows()
    expect(rows).toHaveLength(1)
    // …and the surviving one is the BANNER's (inside the wind-down `.todaycard`, where the
    // advice lines explain it), not the weaker `.tdc` row.
    expect(rows[0].closest('.tdc')).toBeNull()
    expect(rows[0].closest('.todaycard')).toBeTruthy()
    expect(within(rows[0]).getByRole('button', { name: 'Pipa' })).toBeInTheDocument()
  })

  test('in the dim phase the banner shows no row, so the TodoCard keeps the only affordance', () => {
    // 22:00 = dim (bed−90 … bed−60): the habit's anchor („napzárás után") has not come due, the
    // banner deliberately renders no row — so filtering the TodoCard row here would leave the
    // habit unreachable on this face, which is a loss, not a de-duplication.
    clockAt('22:00')
    const { container } = renderToday()
    const rows = windDownRows()
    expect(rows).toHaveLength(1)
    expect(rows[0].closest('.tdc')).toBeTruthy()
    expect(within(rows[0]).getByRole('button', { name: 'Pipa' })).toBeInTheDocument()
    expect(container.querySelector('.todaycard-rows')).toBeNull()
  })

  test('outside the wind-down windows the TodoCard row is still there', () => {
    clockAt('21:05') // phase 'none' — the banner renders nothing at all
    renderToday()
    const rows = windDownRows()
    expect(rows).toHaveLength(1)
    expect(rows[0].closest('.tdc')).toBeTruthy()
  })
})

describe('TodayPage — no face renders a control that does nothing', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers() })

  /**
   * The class-level guard, driven off the REAL quest/habit/fuel/check-in fixtures rather than a
   * hand-picked case: on every face, tap every control the face renders and assert that each one
   * did something observable — navigated, opened a sheet, or fired a write. A pill that leaves
   * the URL unchanged, opens nothing and writes nothing is the defect this asserts against.
   */
  test.each(['reggel', 'nap', 'este'])('every control on the %s face does something', async (face) => {
    clockAt('09:12')
    const { container, unmount } = renderToday(`/today?dp=${face}`)
    const controls = [...container.querySelectorAll('.tdc .itemrow, .fhc-next')]
      .flatMap((row) => [...row.querySelectorAll('button')]
        .map((btn) => ({ btn, title: row.querySelector('.itemrow-t1, .fhc-next-tx b')?.textContent })))
    expect(controls.length).toBeGreaterThan(0)
    unmount()

    for (const { title } of controls) {
      // Fresh mount per control: a served action changes the tree, which would invalidate
      // the node handles collected above.
      const one = renderToday(`/today?dp=${face}`)
      const row = [...one.container.querySelectorAll('.tdc .itemrow, .fhc-next')]
        .find((r) => r.querySelector('.itemrow-t1, .fhc-next-tx b')?.textContent === title)!
      const btn = row.querySelector('button')!
      const before = one.container.innerHTML
      fireEvent.click(btn)
      // `waitFor` covers the async ones too: a MANUAL habit's check resolves through a
      // mutation, so its evidence is the re-render that follows the cache patch.
      await waitFor(() => {
        const navigated = screen.getByTestId('loc').textContent !== `/today?dp=${face}`
        const sheetOpened = document.querySelector('[role="dialog"]') !== null
        const treeChanged = one.container.innerHTML !== before
        expect(
          navigated || sheetOpened || treeChanged,
          `„${title}" renders a control that does nothing on the ${face} face`,
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
    const row = screen.getByText('Olvass ma legalább 10 percet').closest('.itemrow') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: 'Naplózz' }))
    expect(screen.getByText('Mi történt ma?')).toBeInTheDocument()
  })

  test('a MANUAL habit routes to check() — the chain hero advances to the next step', async () => {
    clockAt('09:12')
    const { container } = renderToday()
    expect(container.querySelector('.fhc-next-tx b')?.textContent).toBe('50 fekvőtámasz')
    // The hero's own CTA — the chain rows below now carry their own `Pipa` pills too.
    fireEvent.click(container.querySelector('.fhc-next-go') as HTMLElement)
    await waitFor(() =>
      expect(container.querySelector('.fhc-next-tx b')?.textContent).toBe('Reggeli videó'))
  })

  test('a fuel row logs IN PLACE instead of navigating to /fuel', () => {
    vi.useFakeTimers().setSystemTime(at('13:42'))
    const { container } = renderToday()
    const fuelRow = [...container.querySelectorAll('.tdc .itemrow')]
      .find((r) => within(r as HTMLElement).queryByRole('button', { name: 'Logold' })) as HTMLElement
    fireEvent.click(within(fuelRow).getByRole('button', { name: 'Logold' }))
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Mit ettél?')
    expect(screen.getByTestId('loc').textContent).toBe('/today') // it did NOT navigate away
  })

  test('a check-in row opens the check-in sheet for its own slot', () => {
    vi.useFakeTimers().setSystemTime(at('13:42'))
    const { container } = renderToday()
    // Scoped to the face's TodoCard — the same slot is ALSO previewed as a `later` row.
    const card = within(container.querySelector('.tdc') as HTMLElement)
    const row = card.getByText('Hogy vagy?').closest('.itemrow') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: 'Koppints' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('dialog').textContent).toContain('14:00')
  })

  test('a preview row jumps to the item\'s own face rather than acting on it', () => {
    vi.useFakeTimers().setSystemTime(at('09:12'))
    renderToday()
    fireEvent.click(screen.getAllByRole('button', { name: /ugrás a napszakára$/ })[0])
    expect(screen.getByRole('tab', { selected: true })).not.toHaveAccessibleName(/^Reggel/)
  })
})
