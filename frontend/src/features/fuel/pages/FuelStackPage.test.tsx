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

  // Mozaik face (fidelity audit, mezo-d20.11): the page wore the pre-Mozaik `.pghead-np`
  // header; the prototype's #page-stack is a sage MozaikPage with a ‹ Fuel back chip, the
  // `＋ Kamrából` head action and an i-stack hero carrying `bevéve/összes`.
  test('Mozaik scaffold: sage page, ‹ Fuel back chip, Stack hero with the taken/total bignum', () => {
    const { container } = renderView()
    expect(container.querySelector('.pghead-np')).toBeNull()
    expect(container.querySelector('.mz-page.mz-p-sage')).toBeInTheDocument()
    expect(screen.getByText('‹ Fuel')).toBeInTheDocument()
    expect(screen.getByText('Stack')).toBeInTheDocument()
    expect(container.querySelector('.mz-bignum')?.textContent).toMatch(/^\d+\/\d+$/)
    expect(screen.queryByText('live')).not.toBeInTheDocument()
  })

  // Entrance choreography (audit group A: the page had play:0 / rise:0 — which ALSO left the
  // day-arc's `.mz-play .stk-arc-dot.next` gold pulse and the arc fill permanently dead).
  test('the body rises inside one EntranceGroup, so the day-arc pulse/fill can play', () => {
    const { container } = renderView()
    const play = container.querySelector('.mz-play')
    expect(play).not.toBeNull()
    expect(play!.querySelectorAll('.rise').length).toBeGreaterThan(2)
    expect(play!.querySelector('.stk-arc-dot.next')).not.toBeNull()
    expect(play!.querySelector('.stk-arc-fill')).not.toBeNull()
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

  test('the picker opens from the ＋ Kamrából head action and adding an item is reflected in the cache (a new row renders)', async () => {
    renderView()
    await userEvent.click(screen.getByRole('button', { name: /Kamrából/ }))
    expect(await screen.findByText('Mit szedjünk')).toBeInTheDocument()
    // 'cink' (Cink-biszglicinát) az egyetlen seed-előfordulás nélküli elem — hozzáadva ÚJ sort
    // ejt az esti zónába (mockPlaceOccurrence timing-hint ága: 'evening' → 'evening'), a már ott
    // lévő seed magnézium-sor mellé.
    await userEvent.type(screen.getByPlaceholderText(/Keress a polcon/), 'cink')
    await userEvent.click(await screen.findByText('Cink-biszglicinát'))
    expect(await screen.findByRole('button', { name: 'Cink-biszglicinát beállítások' })).toBeInTheDocument()
  })

  // The day-type now rides the day-arc card's corner note (the prototype's `edzésnap 17:30`);
  // the wake/bed/item recap + the autosave reassurance stay as the quiet closing line.
  test('the day-arc corner note shows edzésnap for the seeded training day, and the autosave line keeps the wake/bed recap', () => {
    const { container } = renderView()
    const note = container.querySelector('.stk-arc-note')
    expect(note?.textContent).toMatch(/edzésnap/)
    expect(note?.textContent).not.toMatch(/pihenőnap/)
    // Lowercase 'ébredés' (case-sensitive) is unique to the closing line — the zone card's own
    // header renders capitalized 'Ébredés', a distinct string.
    const closing = screen.getByText(/ébredés/)
    expect(closing).toHaveClass('stk-autosave')
    expect(closing.textContent).toMatch(/minden változás automatikusan mentve/)
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

  // Stack v2 (mezo-d20.4.3) — stat strip, day-arc timeline, featured KÖVETKEZŐ card, mosaic.
  test('the stat strip shows bevéve · következő · e heti adherencia · kézi rögzítés', () => {
    renderView()
    expect(screen.getByText('bevéve ma')).toBeInTheDocument()
    expect(screen.getByText('következő')).toBeInTheDocument()
    expect(screen.getByText('e heti adherencia')).toBeInTheDocument()
    // mock seed's weeklyStats.supplementsAdherence is 92 (fuelWeek.ts) — honest number, not a dash.
    expect(screen.getByText('92%')).toBeInTheDocument()
    expect(screen.getByText('kézi rögzítés')).toBeInTheDocument()
  })

  test('the day-arc timeline renders between the real wake/lefekvés anchors', () => {
    renderView()
    expect(screen.getByText(/Nap-ív ·/)).toBeInTheDocument()
  })

  test('the seed pre_workout zone (Origin PWO, untaken, earliest not-done zone) is the featured KÖVETKEZŐ card', () => {
    renderView()
    expect(screen.getByText(/KÖVETKEZŐ · EDZÉS ELŐTT/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Origin PWO bevétel' })).toBeInTheDocument()
  })

})

describe('FuelStackPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  test('one active, untaken occurrence (kreatin/wake) renders as the sole featured KÖVETKEZŐ card, no mosaic', async () => {
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
    await screen.findByText('Stack')
    await waitFor(() => expect(screen.getByText(/KÖVETKEZŐ · ÉBREDÉS/)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Kreatin beállítások' })).toBeInTheDocument()
    // The only occurrence IS the next zone — nothing left over for the mini-mosaic.
    expect(container.querySelectorAll('.zcard')).toHaveLength(0)
  })

  test('an unresolved protocol renders the empty-stack dashed card, never the mock seed', async () => {
    renderView() // default handler → { history: [] } → no active protocol → ghost, occurrences: []
    await screen.findByText('Stack')
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
    await screen.findByText('Stack')
    await userEvent.click(screen.getByRole('button', { name: /Kamrából/ }))
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
    await screen.findByText('Stack')
    await waitFor(() => expect(screen.getByText('Üres stack · adj hozzá a Kamrából')).toBeInTheDocument())
    expect(goalsCalls).toBe(0)
  })
})
