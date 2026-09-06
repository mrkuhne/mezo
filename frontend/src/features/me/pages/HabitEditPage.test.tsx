import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { HabitEditPage } from '@/features/me/pages/HabitEditPage'
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
    def('water', 'Hidratálás', null, { position: 3, why: 'mert száraz a torkom', anchorCopy: 'fogmosás után' }),
    def('stretch', 'Nyújtás', 'FOGG', { position: 4, anchorHabitKey: 'sun', celebration: 'mosoly' }),
    def('scale', 'Súlymérés', 'FOGG', {
      position: 5, mode: 'DERIVED', metric: 'weight_logged_today',
      anchorCopy: 'felkeltem', celebration: 'pacsi',
    }),
  ],
}
const EVENING: HabitChainInfo = {
  id: 'chain-evening', chainKey: 'EVENING', title: 'Esti rutin', daypart: 'EVENING', position: 2, isActive: true,
  defs: [def('bed', 'Időben ágyban', null, { chainKey: 'EVENING', position: 1 })],
}

const mockHabitSummary = {
  perfectMorningDays30: 6,
  perfectEveningDays30: 4,
  habits: [
    { key: 'sun', strengthPct: 91, done28: 26, missed28: 2 },
    { key: 'intent', strengthPct: 82, done28: 23, missed28: 5 },
  ],
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
    <MemoryRouter initialEntries={[`/me/rutin/szokas/${habitKey}/szerkesztes`]}>
      <Routes>
        <Route path="/me/rutin/szokas/:habitKey/szerkesztes" element={<HabitEditPage />} />
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

describe('HabitEditPage — recept és mentés', () => {
  test('shows the live sentence and saves the edited CLEAR fields', async () => {
    renderPage('intent')
    expect(screen.getByTestId('edit-sentence')).toHaveTextContent('7:10-kor a konyhában')
    fireEvent.change(screen.getByLabelText(/Jelzés/), { target: { value: '7:20-kor a konyhában' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    expect(updateDef).toHaveBeenCalledWith('d-intent', expect.objectContaining({ cue: '7:20-kor a konyhában' }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/me/rutin/szokas/intent'))
  })

  test('emptying the optional identity CLEARS it on the wire (blank string, mezo-pero)', () => {
    renderPage('intent')
    fireEvent.change(screen.getByLabelText(/Identitás/), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    expect(updateDef).toHaveBeenCalledWith('d-intent', expect.objectContaining({ identity: '' }))
  })

  test('an edit that does not change the chain sends no chainKey (it would re-order the chain)', () => {
    renderPage('intent')
    fireEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    const patch = updateDef.mock.calls[0][1]
    expect(patch.chainKey).toBeUndefined()
  })

  test('an actual chain change does send chainKey', () => {
    renderPage('intent')
    fireEvent.click(screen.getByRole('button', { name: 'Esti rutin' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    expect(updateDef).toHaveBeenCalledWith('d-intent', expect.objectContaining({ chainKey: 'EVENING' }))
  })

  test('refuses to save a CLEAR recipe the backend would reject', () => {
    renderPage('intent')
    fireEvent.change(screen.getByLabelText(/Jelzés/), { target: { value: '  ' } })
    const save = screen.getByRole('button', { name: 'Mentés' })
    expect(save).toBeDisabled()
  })
})

describe('HabitEditPage — keretváltás előre kimondott adatvesztéssel', () => {
  test('switching CLEAR → FOGG names the fields (with their values) that will be destroyed, BEFORE saving', () => {
    renderPage('intent')
    fireEvent.click(screen.getByRole('button', { name: /Szokás-láncolás/ }))
    const warn = screen.getByTestId('fw-warn')
    // The backend nulls the other framework's fields on switch — the page says exactly what
    // goes, with the user's own words, while they can still back out.
    expect(warn).toHaveTextContent('7:10-kor a konyhában')
    expect(warn).toHaveTextContent('tisztább a fejem')
    expect(warn).toHaveTextContent('a pipa maga')
    expect(updateDef).not.toHaveBeenCalled()
  })

  test('switching FOGG → CLEAR warns with the anchor + celebration, and the save carries the new frame', () => {
    renderPage('sun')
    fireEvent.click(screen.getByRole('button', { name: /Négy törvény/ }))
    const warn = screen.getByTestId('fw-warn')
    expect(warn).toHaveTextContent('kitöltöttem a kávét')
    expect(warn).toHaveTextContent('ökölrázás')
    // The new frame's fields start empty → the save is gated until they are filled.
    expect(screen.getByRole('button', { name: 'Mentés' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/Jelzés/), { target: { value: 'kávé után' } })
    fireEvent.change(screen.getByLabelText(/Vágy/), { target: { value: 'fényt akarok' } })
    fireEvent.change(screen.getByLabelText(/Jutalom/), { target: { value: 'a nap indul' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    expect(updateDef).toHaveBeenCalledWith('d-sun', expect.objectContaining({
      framework: 'CLEAR', cue: 'kávé után', craving: 'fényt akarok', reward: 'a nap indul',
    }))
  })

  test('switching back to the stored frame withdraws the warning', () => {
    renderPage('intent')
    fireEvent.click(screen.getByRole('button', { name: /Szokás-láncolás/ }))
    expect(screen.getByTestId('fw-warn')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Négy törvény/ }))
    expect(screen.queryByTestId('fw-warn')).toBeNull()
  })
})

describe('HabitEditPage — horgony-választó', () => {
  test('a chip-linked anchor opens the picker instead of locking the field', () => {
    renderPage('stretch')
    fireEvent.click(screen.getByTestId('anchor-pick'))
    const sheet = within(screen.getByTestId('anchor-sheet'))
    expect(sheet.getByText('Mihez kötöd?')).toBeInTheDocument()
    // own habits (self excluded), mezo moments, free text and unlink are all offered
    expect(sheet.getByRole('button', { name: /Reggeli fény/ })).toBeInTheDocument()
    expect(sheet.queryByRole('button', { name: /^Nyújtás/ })).toBeNull()
    expect(sheet.getByRole('button', { name: /befejeztem az edzést/ })).toBeInTheDocument()
    expect(sheet.getByRole('button', { name: /Saját szavakkal/ })).toBeInTheDocument()
    expect(sheet.getByRole('button', { name: /Leoldom/ })).toBeInTheDocument()
  })

  test('picking another habit saves its anchorHabitKey', () => {
    renderPage('stretch')
    fireEvent.click(screen.getByTestId('anchor-pick'))
    fireEvent.click(screen.getByRole('button', { name: /napi szándékot/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    expect(updateDef).toHaveBeenCalledWith('d-stretch', expect.objectContaining({ anchorHabitKey: 'intent' }))
  })

  test('picking a mezo-moment unlinks the habit anchor and stores the clause as free text', () => {
    renderPage('stretch')
    fireEvent.click(screen.getByTestId('anchor-pick'))
    fireEvent.click(screen.getByRole('button', { name: /befejeztem az edzést/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    // '' is the contract's unlink sentinel — a moment is not a def, so it cannot be a link.
    expect(updateDef).toHaveBeenCalledWith('d-stretch', expect.objectContaining({
      anchorHabitKey: '', anchorCopy: 'befejeztem az edzést',
    }))
  })

  test('Leoldom on a FOGG recipe empties the anchor and gates the save until a new one is given', () => {
    renderPage('stretch')
    fireEvent.click(screen.getByTestId('anchor-pick'))
    fireEvent.click(screen.getByRole('button', { name: /Leoldom/ }))
    // FOGG needs SOME anchor (the validator's rule) — the save waits for free text or a pick.
    expect(screen.getByRole('button', { name: 'Mentés' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/horgony/i), { target: { value: 'letettem a fogkefét' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    expect(updateDef).toHaveBeenCalledWith('d-stretch', expect.objectContaining({
      anchorHabitKey: '', anchorCopy: 'letettem a fogkefét',
    }))
  })

  test('Leoldom on a legacy (frameworkless) def truly clears the stored anchor copy', () => {
    renderPage('water')
    fireEvent.click(screen.getByTestId('anchor-pick'))
    fireEvent.click(screen.getByRole('button', { name: /Leoldom/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    expect(updateDef).toHaveBeenCalledWith('d-water', expect.objectContaining({ anchorCopy: '' }))
  })

  test('a picker row shows the candidate habit standing (strength), never a bare title', () => {
    renderPage('stretch')
    fireEvent.click(screen.getByTestId('anchor-pick'))
    const sheet = within(screen.getByTestId('anchor-sheet'))
    const row = sheet.getByRole('button', { name: /Reggeli fény/ })
    expect(within(row).getByText(/91%/)).toBeInTheDocument()
  })
})

describe('HabitEditPage — pipálódás (mode/metric, mezo-pero kontraktus)', () => {
  test('MANUAL → DERIVED sends mode with the chosen metric', () => {
    renderPage('intent')
    fireEvent.click(screen.getByRole('button', { name: /Adatból/ }))
    fireEvent.change(screen.getByLabelText('Metrika'), { target: { value: 'weight_logged_today' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    expect(updateDef).toHaveBeenCalledWith('d-intent', expect.objectContaining({
      mode: 'DERIVED', metric: 'weight_logged_today',
    }))
  })

  test('DERIVED → MANUAL sends the mode switch and no metric', () => {
    renderPage('scale')
    fireEvent.click(screen.getByRole('button', { name: /Kézzel pipálom/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    const patch = updateDef.mock.calls[0][1]
    expect(patch.mode).toBe('MANUAL')
    expect(patch.metric).toBeUndefined()
  })

  test('an untouched mode sends neither mode nor metric', () => {
    renderPage('intent')
    fireEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    const patch = updateDef.mock.calls[0][1]
    expect(patch.mode).toBeUndefined()
    expect(patch.metric).toBeUndefined()
  })
})

describe('HabitEditPage — kilépések', () => {
  test('pausing lives here and goes through updateDef', () => {
    renderPage('intent')
    fireEvent.click(screen.getByRole('button', { name: /Szüneteltetés/ }))
    expect(updateDef).toHaveBeenCalledWith('d-intent', { isActive: false })
  })

  test('deletion takes two taps', () => {
    renderPage('intent')
    fireEvent.click(screen.getByRole('button', { name: 'Szokás törlése' }))
    expect(deleteDef).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Biztosan törlöd/ }))
    expect(deleteDef).toHaveBeenCalledWith('d-intent')
  })

  test('a paused habit offers Folytatás and resumes with isActive: true', () => {
    useHabitCatalog.mockReturnValue({
      catalog: {
        chains: [{ ...MORNING, defs: MORNING.defs.map((d) => (d.habitKey === 'intent' ? { ...d, isActive: false } : d)) }, EVENING],
      },
      isPending: false, isError: false, refetch: vi.fn(),
    })
    renderPage('intent')
    expect(screen.queryByRole('button', { name: /Szüneteltetés/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Folytatás/ }))
    expect(updateDef).toHaveBeenCalledWith('d-intent', { isActive: true })
  })

  test('an emptied Link field truly clears on the wire (blank string, mezo-pero)', () => {
    useHabitCatalog.mockReturnValue({
      catalog: {
        chains: [{ ...MORNING, defs: MORNING.defs.map((d) => (d.habitKey === 'intent' ? { ...d, linkUrl: 'https://example.com/a' } : d)) }, EVENING],
      },
      isPending: false, isError: false, refetch: vi.fn(),
    })
    renderPage('intent')
    expect(screen.getByLabelText('Link')).toHaveValue('https://example.com/a')
    fireEvent.change(screen.getByLabelText('Link'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    expect(updateDef).toHaveBeenCalledWith('d-intent', expect.objectContaining({ linkUrl: '' }))
  })

  test('the back button returns to the habit page, not the hub', () => {
    renderPage('intent')
    fireEvent.click(screen.getByRole('button', { name: 'Vissza' }))
    expect(navigate).toHaveBeenCalledWith('/me/rutin/szokas/intent')
  })

  test('a stored xp outside 5-15 is clamped on save', () => {
    useHabitCatalog.mockReturnValue({
      catalog: {
        chains: [{ ...MORNING, defs: [def('big', 'Nagy szokás', null, { xp: 40 })] }],
      },
      isPending: false, isError: false, refetch: vi.fn(),
    })
    renderPage('big')
    fireEvent.click(screen.getByRole('button', { name: 'Mentés' }))
    expect(updateDef).toHaveBeenCalledWith('d-big', expect.objectContaining({ xp: 15 }))
  })

  test('an unknown habit key bounces back to the rutin hub', () => {
    renderPage('nincs-ilyen')
    expect(screen.getByText('RUTIN HUB')).toBeInTheDocument()
  })
})
