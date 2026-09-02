import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AiSuggestSheet } from '@/features/me/sheets/AiSuggestSheet'
import type { HabitChainInfo, HabitSuggestion } from '@/data/types'

const {
  suggest, createDef, navigate, useHabitAiSuggest, useHabitCatalog, useHabitCatalogActions,
} = vi.hoisted(() => ({
  suggest: vi.fn(),
  // The sheet no longer writes (mezo-3zue.4) — this stays wired up purely so the tests can
  // assert it is NEVER called: accepting a proposal must open the wizard, not mint a habit.
  createDef: vi.fn((_input: unknown) => Promise.resolve()),
  navigate: vi.fn(),
  useHabitAiSuggest: vi.fn(),
  useHabitCatalog: vi.fn(),
  useHabitCatalogActions: vi.fn(),
}))
vi.mock('@/data/hooks', () => ({
  useHabitAiSuggest: () => useHabitAiSuggest(),
  useHabitCatalog: () => useHabitCatalog(),
  useHabitCatalogActions: () => useHabitCatalogActions(),
}))
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}))

const ACCEPT = 'Megnyitom a varázslóban'

const MORNING: HabitChainInfo = {
  id: 'chain-morning', chainKey: 'MORNING', title: 'Reggeli rutin', daypart: 'MORNING',
  position: 1, isActive: true, defs: [],
}
const EVENING: HabitChainInfo = {
  id: 'chain-evening', chainKey: 'EVENING', title: 'Esti rutin', daypart: 'EVENING',
  position: 2, isActive: true, defs: [],
}

const SUGGESTIONS: HabitSuggestion[] = [
  { title: 'Esti telefon-lezárás', why: 'Gyorsabb elalvás.', anchorCopy: 'wind-down előtt', skillKey: 'recovery', xp: 10, chainKey: 'EVENING',
    framework: null, cue: null, craving: null, reward: null, celebration: null },
  { title: 'Reggeli nyújtás', why: 'Élénkebb test.', anchorCopy: 'ébredés után', skillKey: 'mindset', xp: 5, chainKey: 'MORNING',
    framework: null, cue: null, craving: null, reward: null, celebration: null },
]

beforeEach(() => {
  suggest.mockClear(); createDef.mockClear(); navigate.mockClear()
  sessionStorage.clear()
  suggest.mockResolvedValue(SUGGESTIONS)
  createDef.mockImplementation(() => Promise.resolve())
  useHabitAiSuggest.mockReturnValue({ suggest, pending: false, unavailable: false })
  useHabitCatalog.mockReturnValue({ catalog: { chains: [MORNING, EVENING] }, isPending: false, isError: false, refetch: vi.fn() })
  useHabitCatalogActions.mockReturnValue({ createDef, pending: false })
})

describe('AiSuggestSheet', () => {
  it('Javasolj calls suggest with the trimmed hint + preselected chainKey and renders the returned cards', async () => {
    render(<AiSuggestSheet chainKey="EVENING" onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Szándék'), { target: { value: '  jobb esti lezárás  ' } })
    fireEvent.click(screen.getByRole('button', { name: /javasolj/i }))
    expect(suggest).toHaveBeenCalledWith({ chainKey: 'EVENING', hint: 'jobb esti lezárás' })

    await waitFor(() => expect(screen.getByText('Esti telefon-lezárás')).toBeInTheDocument())
    expect(screen.getByText('Reggeli nyújtás')).toBeInTheDocument()
    expect(screen.getByText('Gyorsabb elalvás.')).toBeInTheDocument()
    // target-chain title chip resolved from the catalog
    expect(screen.getAllByText('Esti rutin').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Reggeli rutin').length).toBeGreaterThan(0)
  })

  it('an empty hint sends hint:undefined (not an empty string)', async () => {
    render(<AiSuggestSheet onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /javasolj/i }))
    expect(suggest).toHaveBeenCalledWith({ chainKey: undefined, hint: undefined })
    await waitFor(() => expect(screen.getByText('Esti telefon-lezárás')).toBeInTheDocument())
  })

  it('Elfogadom stashes the suggestion and opens the wizard on the card\'s chain — it never writes a def', async () => {
    render(<AiSuggestSheet onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /javasolj/i }))
    await waitFor(() => expect(screen.getByText('Esti telefon-lezárás')).toBeInTheDocument())

    const card = screen.getByText('Esti telefon-lezárás').closest('.card') as HTMLElement
    fireEvent.click(within(card).getByRole('button', { name: ACCEPT }))

    // ADR 0019: the suggester PROPOSES. Accepting must open the wizard, never create a habit.
    expect(createDef).not.toHaveBeenCalled()
    expect(JSON.parse(sessionStorage.getItem('mezo.routineWizard.suggestion') ?? 'null'))
      .toEqual(SUGGESTIONS[0])
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/me/rutin/uj?chain=EVENING'))
  })

  it('a sessionStorage failure still opens the wizard (the proposal is lost, the flow is not)', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    render(<AiSuggestSheet onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /javasolj/i }))
    await waitFor(() => expect(screen.getByText('Esti telefon-lezárás')).toBeInTheDocument())

    fireEvent.click(screen.getAllByRole('button', { name: ACCEPT })[0])

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/me/rutin/uj?chain=EVENING'))
    setItem.mockRestore()
  })

  it('Elvetem removes the card without stashing or navigating', async () => {
    render(<AiSuggestSheet onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /javasolj/i }))
    await waitFor(() => expect(screen.getByText('Esti telefon-lezárás')).toBeInTheDocument())

    const cards = screen.getAllByRole('button', { name: 'Elvetem' })
    fireEvent.click(cards[0])

    expect(createDef).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('mezo.routineWizard.suggestion')).toBeNull()
    await waitFor(() => expect(screen.queryByText('Esti telefon-lezárás')).not.toBeInTheDocument())
    expect(screen.getByText('Reggeli nyújtás')).toBeInTheDocument()
  })

  it('an empty (resolved) result shows the quiet ghost, not an error', async () => {
    suggest.mockResolvedValue([])
    render(<AiSuggestSheet onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /javasolj/i }))
    await waitFor(() => expect(screen.getByText(/nincs javaslat/i)).toBeInTheDocument())
  })

  it('a rejecting suggest (a genuine failure the hook rethrows — network/500/etc) leaves the sheet usable: no cards, no unhandled rejection (review fix)', async () => {
    // mockRejectedValue builds the rejected promise fresh inside the mock's own implementation
    // (not a pre-constructed Promise.reject handed to mockReturnValue): run()'s .then().catch()
    // must attach in the same synchronous tick as the promise is created, or Node reports a
    // "handled asynchronously" warning even though the rejection IS handled.
    suggest.mockRejectedValue(new Error('network error'))
    render(<AiSuggestSheet onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /javasolj/i }))

    await waitFor(() => expect(suggest).toHaveBeenCalledTimes(1))
    // no cards, no crash, no premature "no suggestions" ghost (cards stays null, not [])— the
    // form is still there, ready for another "Javasolj" attempt.
    expect(screen.queryByText(/nincs javaslat/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /javasolj/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Szándék')).toBeInTheDocument()
  })

  it('unavailable (503/404) shows the honest inline card and hides the form entirely', () => {
    useHabitAiSuggest.mockReturnValue({ suggest, pending: false, unavailable: true })
    render(<AiSuggestSheet onClose={vi.fn()} />)
    expect(screen.getByText(/az ai-javasló most nem elérhető/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /javasolj/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Szándék')).not.toBeInTheDocument()
  })

  it('the Javasolj CTA is disabled while pending', () => {
    useHabitAiSuggest.mockReturnValue({ suggest, pending: true, unavailable: false })
    render(<AiSuggestSheet onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /javasolj/i })).toBeDisabled()
  })
})
