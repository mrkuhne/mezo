import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AiSuggestSheet } from '@/features/me/sheets/AiSuggestSheet'
import type { HabitChainInfo, HabitSuggestion } from '@/data/types'

const {
  suggest, createDef, useHabitAiSuggest, useHabitCatalog, useHabitCatalogActions,
} = vi.hoisted(() => ({
  suggest: vi.fn(),
  createDef: vi.fn(() => Promise.resolve()),
  useHabitAiSuggest: vi.fn(),
  useHabitCatalog: vi.fn(),
  useHabitCatalogActions: vi.fn(),
}))
vi.mock('@/data/hooks', () => ({
  useHabitAiSuggest: () => useHabitAiSuggest(),
  useHabitCatalog: () => useHabitCatalog(),
  useHabitCatalogActions: () => useHabitCatalogActions(),
}))

const MORNING: HabitChainInfo = {
  id: 'chain-morning', chainKey: 'MORNING', title: 'Reggeli rutin', daypart: 'MORNING',
  position: 1, isActive: true, defs: [],
}
const EVENING: HabitChainInfo = {
  id: 'chain-evening', chainKey: 'EVENING', title: 'Esti rutin', daypart: 'EVENING',
  position: 2, isActive: true, defs: [],
}

const SUGGESTIONS: HabitSuggestion[] = [
  { title: 'Esti telefon-lezárás', why: 'Gyorsabb elalvás.', anchorCopy: 'wind-down előtt', skillKey: 'recovery', xp: 10, chainKey: 'EVENING' },
  { title: 'Reggeli nyújtás', why: 'Élénkebb test.', anchorCopy: 'ébredés után', skillKey: 'mindset', xp: 5, chainKey: 'MORNING' },
]

beforeEach(() => {
  suggest.mockClear(); createDef.mockClear()
  suggest.mockResolvedValue(SUGGESTIONS)
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

  it('Elfogadom calls createDef with MANUAL + the card\'s fields, then removes just that card', async () => {
    render(<AiSuggestSheet onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /javasolj/i }))
    await waitFor(() => expect(screen.getByText('Esti telefon-lezárás')).toBeInTheDocument())

    const card = screen.getByText('Esti telefon-lezárás').closest('.card') as HTMLElement
    fireEvent.click(within(card).getByRole('button', { name: 'Elfogadom' }))

    expect(createDef).toHaveBeenCalledWith({
      chainKey: 'EVENING', title: 'Esti telefon-lezárás', why: 'Gyorsabb elalvás.',
      anchorCopy: 'wind-down előtt', mode: 'MANUAL', skillKey: 'recovery', xp: 10,
    })
    await waitFor(() => expect(screen.queryByText('Esti telefon-lezárás')).not.toBeInTheDocument())
    expect(screen.getByText('Reggeli nyújtás')).toBeInTheDocument() // the other card stays
  })

  it('Elvetem removes the card without calling createDef', async () => {
    render(<AiSuggestSheet onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /javasolj/i }))
    await waitFor(() => expect(screen.getByText('Esti telefon-lezárás')).toBeInTheDocument())

    const cards = screen.getAllByRole('button', { name: 'Elvetem' })
    fireEvent.click(cards[0])

    expect(createDef).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByText('Esti telefon-lezárás')).not.toBeInTheDocument())
    expect(screen.getByText('Reggeli nyújtás')).toBeInTheDocument()
  })

  it('an empty (resolved) result shows the quiet ghost, not an error', async () => {
    suggest.mockResolvedValue([])
    render(<AiSuggestSheet onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /javasolj/i }))
    await waitFor(() => expect(screen.getByText(/nincs javaslat/i)).toBeInTheDocument())
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
