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
    fireEvent.click(screen.getByRole('button', { name: 'Pipa' }))
    await waitFor(() =>
      expect(container.querySelector('.fhc-next-tx b')?.textContent).toBe('Reggeli videó'))
  })

  test('a DERIVED habit routes to its log surface instead of self-completing', () => {
    vi.useFakeTimers().setSystemTime(at('21:05'))
    renderToday()
    const row = screen.getByText('Napzárás').closest('.itemrow') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: 'Logolás' }))
    expect(screen.getByTestId('loc').textContent).toBe('/ritual')
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
