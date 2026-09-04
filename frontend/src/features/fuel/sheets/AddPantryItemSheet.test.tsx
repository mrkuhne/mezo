import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AddPantryItemSheet } from '@/features/fuel/sheets/AddPantryItemSheet'
import { usePantry } from '@/data/hooks'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

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

  it('definitionLocked disables the definition fields but keeps price editable', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <AddPantryItemSheet
          open
          onClose={vi.fn()}
          editId="e1"
          definitionLocked
          initial={{ kind: 'food', name: 'Skyr natúr', per: 100, unit: 'g', kcal: 63 }}
        />
      </QueryClientProvider>,
    )
    expect(screen.getByDisplayValue('Skyr natúr')).toBeDisabled()
    expect(screen.getByDisplayValue('63')).toBeDisabled()
    expect(screen.getByPlaceholderText('750')).toBeEnabled()
    expect(screen.getByText(/csak a szerző vagy a tulajdonos/)).toBeInTheDocument()
  })

  it('a state-only edit of a locked, dose-only shared row must NOT fabricate per/unit (mezo-qw37.4 review round 1)', async () => {
    // Fix-round regression: a dose/protocol-based supplement/stim/med row may legitimately carry
    // NO per/unit at all (validatePerKind permits it server-side). The edit sheet used to default
    // a missing basis to per:100/unit:'g' even in edit mode, which — for a LOCKED shared row whose
    // real serving_unit is null server-side — makes PantryMapper.definitionDiffers see a spurious
    // definition change and 403 a pure price/dose edit. Assert the mock cache's per/unit survive a
    // state-only save UNCHANGED (still absent), not silently introduced as 100/'g'.
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => usePantry(), { wrapper })
    await waitFor(() => expect(result.current.stash.length).toBeGreaterThan(0))

    const DOSE_ONLY_ID = 'shared-dose-only-teszt'
    qc.setQueryData(['pantry'], (prev: typeof result.current & Record<string, unknown>) => ({
      ...prev,
      stash: [
        ...prev.stash,
        {
          id: DOSE_ONLY_ID, name: 'Közös Magnézium', brand: '', type: 'supplement', category: 'supplement',
          dose: '400 mg', form: 'tabletta', stock: null, stockUnit: null, protocol: '', timing: 'flexible',
          taken: false,
          // No per/unit at all — a genuine dose-only row, mirroring what validatePerKind allows.
          catalogId: 'cat-magnezium', sharedFrom: { authorName: 'Anna' }, catalogEditable: false,
        },
      ],
    }))

    const onClose = vi.fn()
    render(
      <QueryClientProvider client={qc}>
        <AddPantryItemSheet
          open
          onClose={onClose}
          editId={DOSE_ONLY_ID}
          definitionLocked
          initial={{ kind: 'supplement', name: 'Közös Magnézium', dose: '400 mg' }}
        />
      </QueryClientProvider>,
    )

    fireEvent.change(screen.getByLabelText(/ár \(ft\)/i), { target: { value: '1490' } })
    fireEvent.click(screen.getByRole('button', { name: /mentés/i }))

    await waitFor(() => {
      const edited = result.current.stash.find(s => s.id === DOSE_ONLY_ID)
      expect(edited?.price).toBe(1490) // the state-only field DID save
      expect(edited?.per).toBeUndefined() // per/unit must NOT be fabricated
      expect(edited?.unit).toBeUndefined()
    })
    expect(onClose).toHaveBeenCalled()
  })
})

// The PAYLOAD the edit sheet puts on the wire — the half of I-1 (mezo-qw37.4 final review) that
// mock mode cannot observe, because the mock merge treats an echoed value and an omitted one alike.
describe('AddPantryItemSheet · update payload (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  function renderEdit(props: Record<string, unknown>) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    let body: Record<string, unknown> | null = null
    server.use(http.put(`${API_BASE}/api/pantry/:id`, async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>
      return new HttpResponse(null, { status: 204 })
    }))
    render(
      <QueryClientProvider client={qc}>
        <AddPantryItemSheet open onClose={vi.fn()} editId="e1" {...props} />
      </QueryClientProvider>,
    )
    return () => body
  }

  // PantryMapper zero-fills a NULL protein/carbs/fat to 0 on the way out, so echoing the prefill
  // back made `definitionDiffers` see 0-vs-null: a 403 for a non-author, and for an OWNER a silent
  // write of fabricated zeros onto the SHARED definition.
  it('a locked row sends the state half only — no macro/nutrition echo', async () => {
    const read = renderEdit({
      definitionLocked: true,
      initial: { kind: 'food', name: 'Közös Olívaolaj', per: 100, unit: 'g', kcal: 884, proteinG: 0, carbsG: 0, fatG: 0 },
    })

    fireEvent.change(screen.getByLabelText(/ár \(ft\)/i), { target: { value: '2490' } })
    fireEvent.click(screen.getByRole('button', { name: /mentés/i }))

    await waitFor(() => expect(read()).not.toBeNull())
    const sent = read()!
    expect(sent.price).toBe(2490)
    expect(Object.keys(sent)).toEqual(expect.arrayContaining(['kind', 'name', 'price']))
    for (const definitionKey of ['kcal', 'proteinG', 'carbsG', 'fatG', 'fiberG', 'sugarG', 'saltG',
      'saturatedFatG', 'per', 'unit', 'source', 'category', 'pkg']) {
      expect(sent[definitionKey]).toBeUndefined()
    }
  })

  // The same echo hurts an UNLOCKED editor too (an OWNER passes the gate, so the zeros land), so an
  // untouched definition field is dropped there as well — while a value the user really changes,
  // a typed 0 included, still goes out.
  it('an unlocked edit sends only the definition fields this save actually changed', async () => {
    const read = renderEdit({
      initial: { kind: 'food', name: 'Saját Olívaolaj', per: 100, unit: 'g', kcal: 884, proteinG: 0, carbsG: 0, fatG: 0 },
    })

    fireEvent.change(screen.getByLabelText(/^zsír$/i), { target: { value: '99.9' } })
    fireEvent.change(screen.getByLabelText(/ár \(ft\)/i), { target: { value: '2490' } })
    fireEvent.click(screen.getByRole('button', { name: /mentés/i }))

    await waitFor(() => expect(read()).not.toBeNull())
    const sent = read()!
    expect(sent.fatG).toBe(99.9)   // the edited field
    expect(sent.price).toBe(2490)
    expect(sent.kcal).toBeUndefined()      // untouched — never echoed back
    expect(sent.proteinG).toBeUndefined()
    expect(sent.carbsG).toBeUndefined()
  })

  it('a genuinely typed 0 over an empty macro is still sent (the echo fix must not swallow it)', async () => {
    const read = renderEdit({
      initial: { kind: 'food', name: 'Hiányos makrójú étel', per: 100, unit: 'g', kcal: 884 },
    })

    fireEvent.change(screen.getByLabelText(/fehérje/i), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: /mentés/i }))

    await waitFor(() => expect(read()).not.toBeNull())
    expect(read()!.proteinG).toBe(0)
  })
})
