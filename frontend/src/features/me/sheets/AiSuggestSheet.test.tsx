import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AiSuggestSheet } from '@/features/me/sheets/AiSuggestSheet'
import type { HabitChainInfo, HabitSuggestion } from '@/data/types'

const {
  suggest, createDef, useHabitAiSuggest, useHabitCatalog, useHabitCatalogActions,
} = vi.hoisted(() => ({
  suggest: vi.fn(),
  // Typed to accept the create-def payload (unknown here — the payload shape is asserted
  // structurally at each toHaveBeenCalledWith site) so the pending-gate tests below can wrap
  // it as `createDef(input)` without a spurious "expected 0 arguments" compile error.
  createDef: vi.fn((_input: unknown) => Promise.resolve()),
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
  { title: 'Esti telefon-lezárás', why: 'Gyorsabb elalvás.', anchorCopy: 'wind-down előtt', skillKey: 'recovery', xp: 10, chainKey: 'EVENING',
    framework: null, cue: null, craving: null, reward: null, celebration: null },
  { title: 'Reggeli nyújtás', why: 'Élénkebb test.', anchorCopy: 'ébredés után', skillKey: 'mindset', xp: 5, chainKey: 'MORNING',
    framework: null, cue: null, craving: null, reward: null, celebration: null },
]

beforeEach(() => {
  suggest.mockClear(); createDef.mockClear()
  suggest.mockResolvedValue(SUGGESTIONS)
  // Re-asserted every test (not just cleared) — a test that overrides createDef's return value
  // (the pending-gate / rejection-handling cases below) must not bleed its implementation into
  // the next test via a stale mockReturnValue/mockImplementation.
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

  it('a rejecting suggest (a genuine failure the hook rethrows — network/500/etc) leaves the sheet usable: no cards, no unhandled rejection (review fix)', async () => {
    // mockRejectedValue builds the rejected promise fresh inside the mock's own implementation
    // (not a pre-constructed Promise.reject handed to mockReturnValue) — same reasoning as the
    // accept()-rejection test above: run()'s .then().catch() must attach in the same synchronous
    // tick as the promise is created, or Node reports a "handled asynchronously" warning even
    // though the rejection IS handled.
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

  it('a second Elfogadom click while the first accept is still pending does not fire a second createDef (review fix)', async () => {
    // A stateful useHabitCatalogActions stand-in — real usage's `pending` comes from an actual
    // in-flight useMutation, so the pending-gate assertion needs the mock to actually flip
    // `pending` true for the render cycle between the first click and the deferred settling.
    let resolveCreateDef: () => void = () => {}
    const deferred = new Promise<void>((resolve) => { resolveCreateDef = resolve })
    createDef.mockReturnValue(deferred)
    useHabitCatalogActions.mockImplementation(() => {
      const [pending, setPending] = useState(false)
      return {
        createDef: (input: unknown) => {
          setPending(true)
          return createDef(input).finally(() => setPending(false))
        },
        pending,
      }
    })

    render(<AiSuggestSheet onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /javasolj/i }))
    await waitFor(() => expect(screen.getByText('Esti telefon-lezárás')).toBeInTheDocument())

    const acceptButtons = screen.getAllByRole('button', { name: 'Elfogadom' })
    fireEvent.click(acceptButtons[0])
    expect(createDef).toHaveBeenCalledTimes(1)
    expect(acceptButtons[0]).toBeDisabled() // the pending gate — this is what makes the 2nd click a no-op

    fireEvent.click(acceptButtons[0]) // double-tap while still pending
    expect(createDef).toHaveBeenCalledTimes(1) // still just once — no duplicate def

    await act(async () => {
      resolveCreateDef()
    })
    await waitFor(() => expect(screen.queryByText('Esti telefon-lezárás')).not.toBeInTheDocument())
  })

  it('Elvetem is also disabled while an accept is pending (consistency with Elfogadom)', async () => {
    let resolveCreateDef: () => void = () => {}
    const deferred = new Promise<void>((resolve) => { resolveCreateDef = resolve })
    createDef.mockReturnValue(deferred)
    useHabitCatalogActions.mockImplementation(() => {
      const [pending, setPending] = useState(false)
      return {
        createDef: (input: unknown) => {
          setPending(true)
          return createDef(input).finally(() => setPending(false))
        },
        pending,
      }
    })

    render(<AiSuggestSheet onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /javasolj/i }))
    await waitFor(() => expect(screen.getByText('Esti telefon-lezárás')).toBeInTheDocument())

    fireEvent.click(screen.getAllByRole('button', { name: 'Elfogadom' })[0])
    expect(screen.getAllByRole('button', { name: 'Elvetem' })[0]).toBeDisabled()
    expect(screen.getAllByRole('button', { name: 'Elvetem' })[1]).toBeDisabled()

    await act(async () => {
      resolveCreateDef()
    })
    await waitFor(() => expect(screen.queryByText('Esti telefon-lezárás')).not.toBeInTheDocument())
  })

  it('a rejecting createDef on accept leaves the card in place and does not surface as an unhandled rejection (review fix)', async () => {
    // mockImplementation (not mockReturnValue with a pre-built Promise.reject) — the rejected
    // promise must be constructed fresh INSIDE the call so accept()'s own .then().catch() attaches
    // in the same synchronous tick; a promise built ahead of time and only later handed a handler
    // is what triggers Node's "handled asynchronously" warning this test is guarding against.
    createDef.mockImplementation(() => Promise.reject(new Error('HABIT_DEF_UNKNOWN_CHAIN')))
    render(<AiSuggestSheet onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /javasolj/i }))
    await waitFor(() => expect(screen.getByText('Esti telefon-lezárás')).toBeInTheDocument())

    const card = screen.getByText('Esti telefon-lezárás').closest('.card') as HTMLElement
    fireEvent.click(within(card).getByRole('button', { name: 'Elfogadom' }))

    // The rejection is consumed by accept()'s own .catch (no test-level unhandled-rejection
    // warning) — the global mutation-error toast is the app's real surface for this failure,
    // not exercised here; locally the card simply stays, so the user can retry it.
    await waitFor(() => expect(createDef).toHaveBeenCalledTimes(1))
    expect(screen.getByText('Esti telefon-lezárás')).toBeInTheDocument()
  })
})
