import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AddPantryItemSheet } from '@/features/fuel/sheets/AddPantryItemSheet'
import { usePantry } from '@/data/hooks'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

describe('AddPantryItemSheet', () => {
  it('submits a food item: appends to the shared pantry cache, then closes', async () => {
    // ONE shared QueryClient so the sheet's mutation (setQueryData on ['pantry'])
    // is visible to a co-rendered usePantry() read — assert a REAL effect, not
    // just that onClose fired.
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    const onClose = vi.fn()
    const NEW_NAME = 'Brokkoli-add-sheet-teszt'

    const { result } = renderHook(() => usePantry(), { wrapper })
    const before = result.current.ingredients.length
    expect(result.current.ingredients.some(i => i.name === NEW_NAME)).toBe(false)

    render(
      <QueryClientProvider client={qc}>
        <AddPantryItemSheet open onClose={onClose} />
      </QueryClientProvider>,
    )

    fireEvent.change(screen.getByLabelText(/név/i), { target: { value: NEW_NAME } })
    fireEvent.change(screen.getByLabelText(/kcal/i), { target: { value: '34' } })
    fireEvent.click(screen.getByRole('button', { name: /polcra|mentés/i }))

    // The new ingredient actually landed in the cache that usePantry reads.
    await waitFor(() => {
      expect(result.current.ingredients.length).toBe(before + 1)
    })
    const added = result.current.ingredients.find(i => i.name === NEW_NAME)
    expect(added).toBeDefined()
    expect(added?.macros.kcal).toBe(34)
    expect(onClose).toHaveBeenCalled()
  })

  it('does not render when closed', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <AddPantryItemSheet open={false} onClose={vi.fn()} />
      </QueryClientProvider>,
    )
    expect(screen.queryByLabelText(/név/i)).not.toBeInTheDocument()
  })

  it('edit mode prefills name and saves via updateItem', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    const onClose = vi.fn()
    const { result } = renderHook(() => usePantry(), { wrapper })
    const target = result.current.ingredients[0]
    const EDITED = 'Átnevezett-tétel-teszt'

    render(
      <QueryClientProvider client={qc}>
        <AddPantryItemSheet open onClose={onClose} editId={target.id} initial={{ kind: 'food', name: target.name }} />
      </QueryClientProvider>,
    )
    expect((screen.getByLabelText(/név/i) as HTMLInputElement).value).toBe(target.name)
    fireEvent.change(screen.getByLabelText(/név/i), { target: { value: EDITED } })
    fireEvent.click(screen.getByRole('button', { name: /mentés/i }))

    await waitFor(() => {
      expect(result.current.ingredients.find(i => i.id === target.id)?.name).toBe(EDITED)
    })
    expect(onClose).toHaveBeenCalled()
  })

  // The old "supplement ADAG (per) change round-trips" test is RETIRED by design (mezo-0gjr):
  // the basis is no longer an input — the form can't change `per` at all, which is the point.
  // The replacement guarantees live in the "fixed per-100 g basis" describe below.

  it('the basis is not an input: no Adag field, sections declare the /100 g basis (mezo-0gjr)', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <AddPantryItemSheet open onClose={vi.fn()} />
      </QueryClientProvider>,
    )
    expect(screen.queryByText('Adag')).not.toBeInTheDocument()
    expect(screen.getByText('Makrók · /100 g')).toBeInTheDocument()
    expect(screen.getByText('Tápanyag · /100 g')).toBeInTheDocument()
  })

  it('create always lands on the per-100 g / grams basis (mezo-0gjr)', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => usePantry(), { wrapper })
    const NEW_NAME = 'Per100-bázis-teszt'

    render(
      <QueryClientProvider client={qc}>
        <AddPantryItemSheet open onClose={vi.fn()} />
      </QueryClientProvider>,
    )
    fireEvent.change(screen.getByLabelText(/név/i), { target: { value: NEW_NAME } })
    fireEvent.change(screen.getByLabelText(/kcal/i), { target: { value: '412' } })
    fireEvent.click(screen.getByRole('button', { name: /polcra/i }))

    await waitFor(() => {
      const added = result.current.ingredients.find(i => i.name === NEW_NAME)
      expect(added?.per).toBe(100)
      expect(added?.unit).toBe('g')
    })
  })

  it('edit leaves a legacy non-100 basis untouched (mezo-0gjr)', async () => {
    // The one intentional per-serving row (Vanilla whey, per=30) must survive an
    // unrelated edit: the form ECHOES the stored basis from `initial` (inputFromItem
    // always carries per/unit) — omitting it would trip validatePerKind on update.
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => usePantry(), { wrapper })
    await waitFor(() => expect(result.current.ingredients.length).toBeGreaterThan(0))
    const target = result.current.ingredients[0]
    // plant a legacy basis directly in the cache the mock mutators merge onto
    qc.setQueryData(['pantry'], (prev: { ingredients: typeof result.current.ingredients } & Record<string, unknown>) => ({
      ...prev,
      ingredients: prev.ingredients.map(i => i.id === target.id ? { ...i, per: 30 } : i),
    }))

    render(
      <QueryClientProvider client={qc}>
        <AddPantryItemSheet open onClose={vi.fn()} editId={target.id} initial={{ kind: 'food', name: target.name, per: 30, unit: 'g' }} />
      </QueryClientProvider>,
    )
    fireEvent.change(screen.getByLabelText(/név/i), { target: { value: 'Átnevezett örökölt bázisú' } })
    fireEvent.click(screen.getByRole('button', { name: /mentés/i }))

    await waitFor(() => {
      const edited = result.current.ingredients.find(i => i.id === target.id)
      expect(edited?.name).toBe('Átnevezett örökölt bázisú')
      expect(edited?.per).toBe(30) // the legacy basis survived the save
    })
  })

  it('edit shows the inherited-basis hint when the stored basis is not /100 (mezo-0gjr)', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <AddPantryItemSheet
          open
          onClose={vi.fn()}
          editId="whatever"
          initial={{ kind: 'supplement', name: 'Iso Whey Vanilla', per: 30, unit: 'g' }}
        />
      </QueryClientProvider>,
    )
    expect(screen.getByText(/Bázis: \/30 g · örökölt/)).toBeInTheDocument()
  })

  it('edit mode saves changed extended-nutrition + price fields via updateItem', async () => {
    // The expanded editor edits EVERY value — assert a non-macro field (Rost) and
    // price actually land in the cache through updateItem.
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    const onClose = vi.fn()
    const { result } = renderHook(() => usePantry(), { wrapper })
    const target = result.current.ingredients[0]

    render(
      <QueryClientProvider client={qc}>
        <AddPantryItemSheet
          open
          onClose={onClose}
          editId={target.id}
          initial={{ kind: 'food', name: target.name, kcal: target.macros.kcal }}
        />
      </QueryClientProvider>,
    )

    fireEvent.change(screen.getByLabelText(/^rost$/i), { target: { value: '4.5' } })
    fireEvent.change(screen.getByLabelText(/ár \(ft\)/i), { target: { value: '999' } })
    fireEvent.click(screen.getByRole('button', { name: /mentés/i }))

    await waitFor(() => {
      const edited = result.current.ingredients.find(i => i.id === target.id)
      expect(edited?.fiberG).toBe(4.5)
      expect(edited?.price).toBe(999)
    })
    expect(onClose).toHaveBeenCalled()
  })
})
