import { fireEvent, render, screen } from '@testing-library/react'
import rawCss from '@/styles/prototype.css?raw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { HabitPage } from '@/features/me/pages/HabitPage'
import type { HabitChainInfo } from '@/data/types'

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

const mockHabitSummary = {
  perfectMorningDays30: 6,
  perfectEveningDays30: 4,
  habits: [{ key: 'intent', strengthPct: 82, done28: 23, missed28: 5 }],
}

const {
  useHabitSummary, useHabitCatalog, useHabitCatalogActions, updateDef, deleteDef,
} = vi.hoisted(() => ({
  useHabitSummary: vi.fn(),
  useHabitCatalog: vi.fn(),
  useHabitCatalogActions: vi.fn(),
  updateDef: vi.fn((_id: string, _patch: Record<string, unknown>) => Promise.resolve()),
  deleteDef: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/data/hooks', () => ({
  useHabitSummary: () => useHabitSummary(),
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

  test('the 28-day strip is captioned as counts, never as a calendar', () => {
    const { container } = renderPage('intent')
    const cells = [...container.querySelectorAll('.rt-hist i')]
    expect(cells).toHaveLength(28)
    // three states, in order, partitioning the 28 cells — never two states wearing one look
    expect(cells.map((c) => c.getAttribute('data-state'))).toEqual([
      ...Array(23).fill('done'), ...Array(5).fill('miss'),
    ])
    expect(screen.getByText(/nem naptár/)).toBeInTheDocument()
  })

  test('a partly-empty strip keeps the three states visually ordered (miss darker than empty)', () => {
    useHabitSummary.mockReturnValue({
      data: { ...mockHabitSummary, habits: [{ key: 'intent', strengthPct: 40, done28: 8, missed28: 4 }] },
    })
    const { container } = renderPage('intent')
    const states = [...container.querySelectorAll('.rt-hist i')].map((c) => c.getAttribute('data-state'))
    expect(states.filter((s) => s === 'done')).toHaveLength(8)
    expect(states.filter((s) => s === 'miss')).toHaveLength(4)
    expect(states.filter((s) => s === 'none')).toHaveLength(16)
    // the legend must not invert: a missed cell may not reuse the empty cell's own fill
    const emptyFill = rawCss.match(/\.rt-hist i \{[^}]*background:\s*([^;]+);/)?.[1]?.trim()
    const missFill = rawCss.match(/\.rt-hist i\.is-miss \{[^}]*background:\s*([^;]+);/)?.[1]?.trim()
    expect(emptyFill).toBeTruthy()
    expect(missFill).toBeTruthy()
    expect(missFill).not.toEqual(emptyFill)
    expect(missFill).not.toContain('--surface-recess')
  })

  test('never renders a tick control', () => {
    renderPage('intent')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
