import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { FuelStackPage } from '@/features/fuel/pages/FuelStackPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

const renderView = () => render(
  <QueryWrapper><MemoryRouter><FuelStackPage /></MemoryRouter></QueryWrapper>,
)

afterEach(() => vi.unstubAllEnvs())

const kreatinStashRow = {
  id: 'kreatin', name: 'Kreatin', brand: 'MP', type: 'supplement', category: 'muscle',
  dose: '5g', form: 'por', stock: 30, stockUnit: 'adag', protocol: '', timing: 'flexible', taken: false,
}

describe('FuelStackPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  test('renders the Napi protokoll heading', () => {
    renderView()
    expect(screen.getByRole('heading', { name: 'Napi protokoll' })).toBeInTheDocument()
  })

  test('own header: pghead-np sage over + h1, no live chip', () => {
    const { container } = renderView()
    expect(container.querySelector('.pghead-np.sage')).toBeInTheDocument()
    expect(screen.getByText('Fuel · Stack')).toBeInTheDocument()
    expect(screen.queryByText('live')).not.toBeInTheDocument()
  })

  test('zone cards render the seed occurrences in STACK_ZONE_ORDER (Ébredés before Este)', () => {
    const { container } = renderView()
    const labels = [...container.querySelectorAll('.zh .zn')].map(el => el.textContent)
    expect(labels).toContain('Ébredés')
    expect(labels).toContain('Este')
    expect(labels.indexOf('Ébredés')).toBeLessThan(labels.indexOf('Este'))
  })

  test('the kreatin row (rule-placed, not pinned) shows the auto badge', () => {
    renderView()
    const row = screen.getByRole('button', { name: 'Kreatin monohidrát beállítások' })
    expect(row).toHaveTextContent('auto')
  })

  test('tapping the Kreatin tick toggles its taken styling (check icon appears/disappears)', async () => {
    renderView()
    const tick = screen.getByRole('button', { name: 'Kreatin monohidrát bevétel' })
    // Seed: kreatin is taken (mezo-vx9v mock intake seed derives from the stash's taken:true flag).
    expect(tick.querySelector('svg')).not.toBeNull()
    await userEvent.click(tick)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Kreatin monohidrát bevétel' }).querySelector('svg')).toBeNull())
    await userEvent.click(screen.getByRole('button', { name: 'Kreatin monohidrát bevétel' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Kreatin monohidrát bevétel' }).querySelector('svg')).not.toBeNull())
  })

  test('tapping a row (not the tick) opens the StackItemSheet with its zone chips', async () => {
    renderView()
    await userEvent.click(screen.getByRole('button', { name: 'Magnézium-glicinát beállítások' }))
    expect(await screen.findByText('Mozgatás másik zónába')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Ébredés' }).length).toBeGreaterThan(0)
  })

  test('the picker opens from + Hozzáadás a Kamrából and adding an item is reflected in the cache (a new row renders)', async () => {
    renderView()
    await userEvent.click(screen.getByRole('button', { name: /Hozzáadás a Kamrából/ }))
    expect(await screen.findByText('Mit szedjünk')).toBeInTheDocument()
    // 'cink' (Cink-biszglicinát) az egyetlen seed-előfordulás nélküli elem — hozzáadva ÚJ sort
    // ejt az esti zónába (mockPlaceOccurrence timing-hint ága: 'evening' → 'evening'), a már ott
    // lévő seed magnézium-sor mellé.
    await userEvent.type(screen.getByPlaceholderText(/Keress a polcon/), 'cink')
    await userEvent.click(await screen.findByText('Cink-biszglicinát'))
    expect(await screen.findByRole('button', { name: 'Cink-biszglicinát beállítások' })).toBeInTheDocument()
  })

  test('the day-summary strip shows edzésnap for the seeded training day (mock gym seed carries today:true)', () => {
    renderView()
    // Lowercase 'ébredés' (case-sensitive, no /i) is unique to the strip's inline prose — the
    // zone card's own zone-label header renders capitalized 'Ébredés', a distinct string.
    const strip = screen.getByText(/ébredés/)
    expect(strip.textContent).toMatch(/edzésnap/)
    expect(strip.textContent).not.toMatch(/pihenőnap/)
  })

  test('no "Bekapcsolás" text anywhere — the stack has no apply/activate step anymore', () => {
    renderView()
    expect(screen.queryByText(/Bekapcsolás/)).not.toBeInTheDocument()
  })

  test('the compact "Miért így" block is present (seed occurrences carry primary-zone reasons)', () => {
    renderView()
    expect(screen.getByText('Miért így')).toBeInTheDocument()
  })

  // Page-level smoke test (review finding, mezo-vx9v Task 8): the seed occurrences DO yield a
  // non-empty matchMealsToStack() result on this page — d3k2/omega3 (lunch, fat-bound) + the seed
  // lunch meal (f:18 >= FAT_OK_G:15) — so the wiring itself (useRecipes/useFuelDay(today/yesterday)
  // → matchMealsToStack → StackMealMatch) is covered here, not just StackMealMatch's own
  // component-level fixture tests (StackMealMatch.test.tsx).
  test('the meal-match section renders a real suggestion + verdict from the seed data', () => {
    renderView()
    expect(screen.getByText('Étkezés-egyeztetés')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'Csirke + édesburgonya + spenót' })
    expect(link).toHaveAttribute('href', '/fuel/recipes/rec-2')
    expect(screen.getAllByText('✓').length).toBeGreaterThan(0)
  })
})

describe('FuelStackPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  test('one active occurrence (kreatin/wake) renders exactly one zone card', async () => {
    server.use(
      http.get(`${API_BASE}/api/pantry`, () => HttpResponse.json({ ingredients: [], stash: [kreatinStashRow] })),
      http.get(`${API_BASE}/api/fuel/protocol`, () => HttpResponse.json({
        active: {
          id: 'proto-1', version: 1, builtAt: '2026-08-03T06:00:00Z', status: 'active', confidence: 0.9,
          items: [{ id: 'occ-1', pantryItemId: 'kreatin', slotKey: 'wake', pinned: false, placementSource: 'rule' }],
        },
        history: [],
      })),
    )
    const { container } = renderView()
    await screen.findByRole('heading', { name: 'Napi protokoll' })
    await waitFor(() => expect(container.querySelectorAll('.zcard')).toHaveLength(1))
    expect(screen.getByRole('button', { name: 'Kreatin beállítások' })).toBeInTheDocument()
  })

  test('an unresolved protocol renders the empty-stack dashed card, never the mock seed', async () => {
    renderView() // default handler → { history: [] } → no active protocol → ghost, occurrences: []
    await screen.findByRole('heading', { name: 'Napi protokoll' })
    expect(await screen.findByText('Üres stack · adj hozzá a Kamrából')).toBeInTheDocument()
    expect(screen.queryByText('Kreatin monohidrát')).not.toBeInTheDocument()
  })

  test('adding an item via the picker POSTs the pantryItemId', async () => {
    server.use(
      http.get(`${API_BASE}/api/pantry`, () => HttpResponse.json({ ingredients: [], stash: [kreatinStashRow] })),
    )
    let posted: Record<string, unknown> | undefined
    server.use(http.post(`${API_BASE}/api/fuel/protocol/items`, async ({ request }) => {
      posted = (await request.json()) as Record<string, unknown>
      return HttpResponse.json({ id: 'item-new', pantryItemId: 'kreatin', slotKey: 'wake', pinned: false, placementSource: 'rule' }, { status: 201 })
    }))
    renderView()
    await screen.findByRole('heading', { name: 'Napi protokoll' })
    await userEvent.click(screen.getByRole('button', { name: /Hozzáadás a Kamrából/ }))
    await userEvent.click(await screen.findByText('Kreatin'))
    await waitFor(() => expect(posted).toMatchObject({ pantryItemId: 'kreatin' }))
  })

  test('does not fetch /api/goals when rendering the Stack (mezo-4nu invariant, preserved through Task 8)', async () => {
    let goalsCalls = 0
    server.use(
      http.get(`${API_BASE}/api/goals`, () => {
        goalsCalls++
        return HttpResponse.json([])
      }),
    )
    renderView()
    await screen.findByRole('heading', { name: 'Napi protokoll' })
    await waitFor(() => expect(screen.getByText('Üres stack · adj hozzá a Kamrából')).toBeInTheDocument())
    expect(goalsCalls).toBe(0)
  })
})
