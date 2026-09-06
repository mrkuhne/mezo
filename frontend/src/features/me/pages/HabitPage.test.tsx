import { fireEvent, render, screen } from '@testing-library/react'
import rawCss from '@/styles/prototype.css?raw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { HabitPage } from '@/features/me/pages/HabitPage'
import type { HabitChainInfo, HabitFormation } from '@/data/types'

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

function def(
  habitKey: string, title: string, framework: 'FOGG' | 'CLEAR' | null,
  overrides: Partial<HabitChainInfo['defs'][number]> = {},
): HabitChainInfo['defs'][number] {
  return {
    id: `d-${habitKey}`, habitKey, chainKey: 'MORNING', position: 1, title, why: null, anchorCopy: null,
    mode: 'MANUAL', metric: 'manual', skillKey: 'mindset', xp: 5, linkUrl: null, isActive: true,
    framework, anchorHabitKey: null, cue: null, craving: null, reward: null, celebration: null, identity: null,
    ...overrides,
  }
}

const MORNING: HabitChainInfo = {
  id: 'chain-morning', chainKey: 'MORNING', title: 'Reggeli rutin', daypart: 'MORNING', position: 1, isActive: true,
  defs: [
    def('sun', 'Reggeli fény', 'FOGG', { position: 1, anchorCopy: 'kitöltöttem a kávét', celebration: 'ökölrázás' }),
    def('intent', 'leírom a napi szándékot', 'CLEAR', {
      position: 2,
      cue: '7:10-kor a konyhában', craving: 'tisztább a fejem', reward: 'a pipa maga',
      identity: 'figyel a saját gondolataira',
    }),
    def('water', 'Hidratálás', null, { position: 3, why: 'mert száraz a torkom' }),
    // A CHIP-LINKED anchor (`anchorHabitKey`), the case the API cannot unlink.
    def('stretch', 'Nyújtás', 'FOGG', { position: 4, anchorHabitKey: 'sun', celebration: 'mosoly' }),
  ],
}
const EVENING: HabitChainInfo = {
  id: 'chain-evening', chainKey: 'EVENING', title: 'Esti rutin', daypart: 'EVENING', position: 2, isActive: true,
  defs: [def('bed', 'Időben ágyban', null, { chainKey: 'EVENING', position: 1 })],
}


/**
 * A formation payload the page can actually draw. `days` is the lifetime, so the calendar has
 * something to lay out; the estimate fields are internally consistent with `curveK`/`reps` —
 * a fixture that disagreed with itself would let a real inconsistency pass unnoticed.
 */
function formation(over: Partial<HabitFormation> = {}): HabitFormation {
  const days: HabitFormation['days'] = []
  for (let i = 0; i < 40; i += 1) {
    const d = new Date(2026, 6, 1 + i)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    days.push({ date: iso, status: i % 5 === 4 ? 'missed' : 'done' })
  }
  return {
    key: 'intent', firstDate: days[0].date, reps: 32, missed: 8,
    automaticityPct: 62, curveK: 0.03, thresholdPct: 90, minReps: 5,
    repsToThresholdLo: 30, repsToThresholdHi: 80,
    weeksToThresholdLo: 5, weeksToThresholdHi: 11,
    repsPerWeek: 6, consistencyPct: 71, timeConstancyPct: 84, anchorConstancyPct: null,
    days, ...over,
  }
}

const mockHabitSummary = {
  perfectMorningDays30: 6,
  perfectEveningDays30: 4,
  habits: [{ key: 'intent', strengthPct: 82, done28: 23, missed28: 5 }],
}

const {
  useHabitSummary, useHabitCatalog, useHabitCatalogActions, useHabitFormation, updateDef, deleteDef,
} = vi.hoisted(() => ({
  useHabitSummary: vi.fn(),
  useHabitFormation: vi.fn(),
  useHabitCatalog: vi.fn(),
  useHabitCatalogActions: vi.fn(),
  updateDef: vi.fn((_id: string, _patch: Record<string, unknown>) => Promise.resolve()),
  deleteDef: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/data/hooks', () => ({
  useHabitSummary: () => useHabitSummary(),
  useHabitFormation: (k: string) => useHabitFormation(k),
  useHabitCatalog: () => useHabitCatalog(),
  useHabitCatalogActions: () => useHabitCatalogActions(),
}))

function renderPage(habitKey: string) {
  return render(
    <MemoryRouter initialEntries={[`/me/rutin/szokas/${habitKey}`]}>
      <Routes>
        <Route path="/me/rutin/szokas/:habitKey" element={<HabitPage />} />
        <Route path="/me/rutin" element={<div>RUTIN HUB</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  navigate.mockClear()
  updateDef.mockClear()
  deleteDef.mockClear()
  useHabitSummary.mockReset()
  useHabitSummary.mockReturnValue({ data: mockHabitSummary })
  useHabitFormation.mockReset()
  useHabitFormation.mockReturnValue({ data: formation() })
  useHabitCatalog.mockReset()
  useHabitCatalog.mockReturnValue({
    catalog: { chains: [MORNING, EVENING] }, isPending: false, isError: false, refetch: vi.fn(),
  })
  useHabitCatalogActions.mockReset()
  useHabitCatalogActions.mockReturnValue({
    createChain: vi.fn(() => Promise.resolve()),
    updateChain: vi.fn(() => Promise.resolve()),
    deleteChain: vi.fn(() => Promise.resolve()),
    reorderChain: vi.fn(() => Promise.resolve()),
    createDef: vi.fn(() => Promise.resolve()),
    updateDef,
    deleteDef,
    pending: false,
  })
})

describe('HabitPage', () => {
  test('shows the finished recipe sentence and the framework band', () => {
    renderPage('intent')
    expect(screen.getByTestId('recipe-sentence'))
      .toHaveTextContent('7:10-kor a konyhában leírom a napi szándékot, mert tisztább a fejem. Jutalmam: a pipa maga.')
    expect(screen.getByText('Négy törvény')).toBeInTheDocument()
  })

  test('offers pausing, not deleting, as the primary destructive action', () => {
    renderPage('intent')
    expect(screen.getByRole('button', { name: /Szüneteltetés/ })).toBeInTheDocument()
  })

  test('pauses the habit through updateDef', () => {
    renderPage('intent')
    fireEvent.click(screen.getByRole('button', { name: /Szüneteltetés/ }))
    expect(updateDef).toHaveBeenCalledWith('d-intent', { isActive: false })
  })

  test('labels a framework-less habit as legacy and offers re-framing', () => {
    renderPage('water')
    expect(screen.getByText('Keret nélkül')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Keret választása/ }))
    expect(navigate).toHaveBeenCalledWith('/me/rutin/uj?prefill=water')
  })

  test('a framework habit offers switching frames', () => {
    renderPage('intent')
    fireEvent.click(screen.getByRole('button', { name: /Keret váltása/ }))
    expect(navigate).toHaveBeenCalledWith('/me/rutin/uj?prefill=intent')
  })

  test('the hero carries the 28-day strength and its pipa/kihagyás split', () => {
    renderPage('intent')
    expect(screen.getByText('82%')).toBeInTheDocument()
    expect(screen.getByText('28 napos erő · 23 pipa · 5 kihagyás')).toBeInTheDocument()
  })

  test('omits the hero sub entirely when the def has no summary row', () => {
    renderPage('sun')
    expect(screen.queryByText(/28 napos erő/)).not.toBeInTheDocument()
  })

  test('saves the edited CLEAR fields', () => {
    renderPage('intent')
    fireEvent.change(screen.getByLabelText('Vágy'), { target: { value: 'tiszta fejjel indul a nap' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    expect(updateDef).toHaveBeenCalledWith('d-intent', {
      title: 'leírom a napi szándékot',
      xp: 5,
      cue: '7:10-kor a konyhában',
      craving: 'tiszta fejjel indul a nap',
      reward: 'a pipa maga',
      identity: 'figyel a saját gondolataira',
    })
  })

  // ---- review finding 1: a non-move must never carry chainKey ----

  test('an edit that does not change the chain sends no chainKey (it would re-order the chain)', () => {
    renderPage('intent')
    fireEvent.change(screen.getByLabelText('Jutalom'), { target: { value: 'egy fejezet' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    expect(updateDef.mock.calls[0][1]).not.toHaveProperty('chainKey')
  })

  test('an actual chain change does send chainKey', () => {
    renderPage('intent')
    fireEvent.click(screen.getByRole('button', { name: 'Esti rutin' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    expect(updateDef.mock.calls[0][1]).toMatchObject({ chainKey: 'EVENING' })
  })

  // ---- review finding 3: an emptied optional key is OMITTED, never sent as '' ----

  test('emptying an optional CLEAR field omits the key instead of sending an empty string', () => {
    renderPage('intent')
    fireEvent.change(screen.getByLabelText('Identitás'), { target: { value: '  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    expect(updateDef.mock.calls[0][1]).not.toHaveProperty('identity')
  })

  test('emptying the legacy Miért field omits `why` instead of sending an empty string', () => {
    renderPage('water')
    expect(screen.getByLabelText('Miért')).toHaveValue('mert száraz a torkom')
    fireEvent.change(screen.getByLabelText('Miért'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    expect(updateDef.mock.calls[0][1]).not.toHaveProperty('why')
  })

  // ---- review finding 2 + 4: the chip-linked anchor ----

  test('an untouched chip-linked anchor is preserved as a link, never downgraded to free text', () => {
    renderPage('stretch')
    fireEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    expect(updateDef).toHaveBeenCalledWith('d-stretch', {
      title: 'Nyújtás', xp: 5, anchorHabitKey: 'sun', celebration: 'mosoly',
    })
  })

  test('a chip-linked anchor is read-only and says why, since the API has no unlink', () => {
    renderPage('stretch')
    const anchor = screen.getByLabelText('Miután … · horgony')
    expect(anchor).toHaveValue('kész a Reggeli fény')
    expect(anchor).toHaveAttribute('readonly')
    expect(screen.getByText(/nem írható át/)).toBeInTheDocument()
  })

  test('a free-text anchor stays editable and saves as anchorCopy', () => {
    renderPage('sun')
    const anchor = screen.getByLabelText('Miután … · horgony')
    expect(anchor).not.toHaveAttribute('readonly')
    fireEvent.change(anchor, { target: { value: 'letettem a fogkefét' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    expect(updateDef.mock.calls[0][1]).toMatchObject({ anchorCopy: 'letettem a fogkefét' })
  })

  // ---- review finding 7: xp is clamped on save, not only in the stepper ----

  test('a stored xp outside 5-15 is clamped on save', () => {
    useHabitCatalog.mockReturnValue({
      catalog: { chains: [{ ...MORNING, defs: [{ ...MORNING.defs[1], xp: 40 }] }, EVENING] },
      isPending: false, isError: false, refetch: vi.fn(),
    })
    renderPage('intent')
    fireEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    expect(updateDef.mock.calls[0][1]).toMatchObject({ xp: 15 })
  })

  // ---- review finding 6: the hero icon follows the owning chain's daypart ----

  test('an evening habit does not wear the dawn icon', () => {
    const { container } = renderPage('bed')
    expect(container.querySelector('.mz-page-hero use')).toHaveAttribute('href', '#i-alvas')
    // …and a morning habit still wears the dawn one
    expect(renderPage('intent').container.querySelector('.mz-page-hero use'))
      .toHaveAttribute('href', '#i-hajnal')
  })

  test('refuses to save a CLEAR recipe the backend would reject', () => {
    renderPage('intent')
    fireEvent.change(screen.getByLabelText('Vágy'), { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: 'Mentés' })).toBeDisabled()
  })

  test('saves a FOGG recipe with its anchor and celebration', () => {
    renderPage('sun')
    fireEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    expect(updateDef).toHaveBeenCalledWith('d-sun', {
      title: 'Reggeli fény',
      xp: 5,
      anchorCopy: 'kitöltöttem a kávét',
      celebration: 'ökölrázás',
    })
  })

  test('deletion takes two taps and is not the visually primary action', () => {
    renderPage('intent')
    fireEvent.click(screen.getByRole('button', { name: /Szokás törlése/ }))
    expect(deleteDef).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Biztosan törlöd/ }))
    expect(deleteDef).toHaveBeenCalledWith('d-intent')
  })

  test('an unknown habit key bounces back to the rutin hub', () => {
    renderPage('nincs-ilyen')
    expect(screen.getByText('RUTIN HUB')).toBeInTheDocument()
  })

  test('an unresolved catalog shows the loading ghost instead of bouncing', () => {
    useHabitCatalog.mockReturnValue({ catalog: { chains: [] }, isPending: true, isError: false, refetch: vi.fn() })
    renderPage('intent')
    expect(screen.queryByText('RUTIN HUB')).not.toBeInTheDocument()
    expect(screen.getByText(/Szokás betöltése/)).toBeInTheDocument()
  })

  // ---- formálódás-nézet (mezo-08zl) ----

  test('the lifetime calendar keeps the three states visually distinct (a miss is not an empty day)', () => {
    const { container } = renderPage('intent')
    const cells = [...container.querySelectorAll('.rt-cal i')]
    // 40 lifetime days, padded to whole weeks — so at least the lifetime, and a multiple of 7
    expect(cells.length).toBeGreaterThanOrEqual(40)
    expect(cells.length % 7).toBe(0)
    expect(container.querySelectorAll('.rt-cal i.is-done').length).toBe(32)
    expect(container.querySelectorAll('.rt-cal i.is-miss').length).toBe(8)
    // A day with NO row is not a miss: rows only exist for days the app was opened, so the two
    // must not share a fill — otherwise absence reads as failure, which ADR 0010 forbids.
    const emptyFill = rawCss.match(/\.rt-cal i \{[^}]*background:\s*([^;]+);/)?.[1]?.trim()
    const missFill = rawCss.match(/\.rt-cal i\.is-miss \{[^}]*background:\s*([^;]+);/)?.[1]?.trim()
    expect(emptyFill).toBeTruthy()
    expect(missFill).toBeTruthy()
    expect(missFill).not.toEqual(emptyFill)
  })

  test('the estimate is shown as a RANGE, never as a single date', () => {
    renderPage('intent')
    expect(screen.getByTestId('formation-eta')).toHaveTextContent('5–11 hét')
    expect(screen.getByTestId('formation-eta')).toHaveTextContent(/van hátra/)
  })

  test('under minReps it shows no percentage and no deadline, only what is missing', () => {
    useHabitFormation.mockReturnValue({
      data: formation({
        reps: 2, missed: 1, automaticityPct: null, curveK: null,
        repsToThresholdLo: null, repsToThresholdHi: null,
        weeksToThresholdLo: null, weeksToThresholdHi: null, consistencyPct: null,
      }),
    })
    const { container } = renderPage('intent')
    expect(screen.getByTestId('formation-card')).toHaveTextContent('Még gyűlik az adat')
    expect(screen.getByTestId('formation-eta')).toHaveTextContent('3')
    expect(screen.getByTestId('formation-eta')).toHaveTextContent(/még ennyi ismétlés/)
    // no fabricated curve and no fabricated percentage
    expect(container.querySelector('.rt-curve')).toBeNull()
    expect(screen.getByTestId('formation-card').textContent).not.toMatch(/\d+%/)
  })

  test('a context signal we cannot measure renders as a dash, not as 0%', () => {
    const ctx = screen.queryByTestId
    void ctx
    renderPage('intent')
    // anchorConstancyPct is null in the fixture (no anchor on `intent`)
    expect(screen.getByTestId('formation-context')).toHaveTextContent('—')
    expect(screen.getByTestId('formation-context')).toHaveTextContent('nincs horgony')
  })

  test('nothing is drawn from the unresolved empty payload (thresholdPct 0)', () => {
    useHabitFormation.mockReturnValue({
      data: formation({ reps: 0, missed: 0, thresholdPct: 0, minReps: 0, automaticityPct: null, curveK: null, days: [] }),
    })
    renderPage('intent')
    expect(screen.queryByTestId('formation-card')).toBeNull()
  })

  // ---- fix wave (mezo-3zue.4): the two fields that lost their only editor ----

  test('linkUrl is editable on every definition and rides the patch', () => {
    renderPage('intent')
    const link = screen.getByLabelText('Link')
    expect(link).toHaveValue('')
    fireEvent.change(link, { target: { value: 'https://example.com/video' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    expect(updateDef.mock.calls[0][1]).toMatchObject({ linkUrl: 'https://example.com/video' })
  })

  test('an existing linkUrl seeds the field and survives an unrelated edit', () => {
    useHabitCatalog.mockReturnValue({
      catalog: { chains: [{ ...MORNING, defs: [{ ...MORNING.defs[2], linkUrl: 'https://example.com/a' }] }, EVENING] },
      isPending: false, isError: false, refetch: vi.fn(),
    })
    renderPage('water')
    expect(screen.getByLabelText('Link')).toHaveValue('https://example.com/a')
    fireEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    expect(updateDef.mock.calls[0][1]).toMatchObject({ linkUrl: 'https://example.com/a' })
  })

  test('an emptied linkUrl omits the key rather than sending an empty string', () => {
    useHabitCatalog.mockReturnValue({
      catalog: { chains: [{ ...MORNING, defs: [{ ...MORNING.defs[2], linkUrl: 'https://example.com/a' }] }, EVENING] },
      isPending: false, isError: false, refetch: vi.fn(),
    })
    renderPage('water')
    fireEvent.change(screen.getByLabelText('Link'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    expect(updateDef.mock.calls[0][1]).not.toHaveProperty('linkUrl')
  })

  test('a framework-less definition can edit its anchorCopy — the Nap tab renders that line', () => {
    renderPage('water')
    const anchor = screen.getByLabelText('Horgony-szöveg')
    fireEvent.change(anchor, { target: { value: 'fogmosás után' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    expect(updateDef.mock.calls[0][1]).toMatchObject({ anchorCopy: 'fogmosás után' })
  })

  test('the anchorCopy field is legacy-only — a framework habit has its own anchor slot instead', () => {
    renderPage('intent')
    expect(screen.queryByLabelText('Horgony-szöveg')).not.toBeInTheDocument()
    renderPage('sun')
    expect(screen.queryByLabelText('Horgony-szöveg')).not.toBeInTheDocument()
  })

  // ---- fix wave (mezo-3zue.4): a paused habit must SAY so, and must be resumable ----

  test('a paused habit shows a paused note and offers Folytatás, not a second pause', () => {
    useHabitCatalog.mockReturnValue({
      catalog: { chains: [{ ...MORNING, defs: [{ ...MORNING.defs[1], isActive: false }] }, EVENING] },
      isPending: false, isError: false, refetch: vi.fn(),
    })
    renderPage('intent')
    expect(screen.getByTestId('paused-note')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Folytatás/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Szüneteltetés/ })).not.toBeInTheDocument()
  })

  test('resuming a paused habit sends isActive: true', () => {
    useHabitCatalog.mockReturnValue({
      catalog: { chains: [{ ...MORNING, defs: [{ ...MORNING.defs[1], isActive: false }] }, EVENING] },
      isPending: false, isError: false, refetch: vi.fn(),
    })
    renderPage('intent')
    fireEvent.click(screen.getByRole('button', { name: /Folytatás/ }))
    expect(updateDef).toHaveBeenCalledWith('d-intent', { isActive: true })
  })

  test('an active habit shows no paused note', () => {
    renderPage('intent')
    expect(screen.queryByTestId('paused-note')).not.toBeInTheDocument()
  })

  // ---- fix wave (mezo-3zue.4): a FAILED fetch is not a resolved miss ----

  test('a failed catalog fetch shows the retry ghost instead of silently redirecting', () => {
    const refetch = vi.fn()
    useHabitCatalog.mockReturnValue({ catalog: { chains: [] }, isPending: false, isError: true, refetch })
    renderPage('intent')
    expect(screen.queryByText('RUTIN HUB')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Újra' }))
    expect(refetch).toHaveBeenCalled()
  })

  test('never renders a tick control', () => {
    renderPage('intent')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
