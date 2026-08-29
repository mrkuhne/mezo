import type { ReactNode } from 'react'
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest'
import { http } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { RecipeDetailPage, recipeToInput } from '@/features/fuel/pages/RecipeDetailPage'
import { useRecipes } from '@/data/hooks'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import type { Recipe } from '@/data/types'

// The id of the single recipe the MSW GET /api/recipe fixture returns — the real-mode
// tests deep-link to it so the page resolves a recipe instead of the not-found fallback.
const REAL_RECIPE_ID = 'rc1f3a0e2-0000-4000-8000-000000000001'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname}</div>
}
const newQc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })

function renderDetail(id: string, qc: QueryClient) {
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/fuel/recipes/${id}`]}>
        <Routes>
          <Route path="/fuel/recipes/:id" element={<RecipeDetailPage />} />
          <Route path="/fuel/recipes/:id/edit" element={<LocationProbe />} />
          <Route path="/fuel/recipes" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function recipesOf(qc: QueryClient) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useRecipes(), { wrapper })
  return result.current.recipes
}

function firstId(qc: QueryClient) {
  return recipesOf(qc)[0]
}

/** Pick a seed recipe by predicate — throws instead of silently testing nothing. */
function pickRecipe(qc: QueryClient, match: (r: Recipe) => boolean) {
  const found = recipesOf(qc).find(match)
  if (!found) throw new Error('no seed recipe matches the predicate')
  return found
}

test('default tab is Részletek: hero, macro hero and breakdown visible, ingredients hidden (mezo-n3xa)', async () => {
  const qc = newQc()
  const r = firstId(qc)
  renderDetail(r.id, qc)
  expect(await screen.findByText(r.name)).toBeInTheDocument()
  // whole-recipe kcal appears in the macro hero
  expect(screen.getByText(String(r.macros.kcal))).toBeInTheDocument()
  // the breakdown section is immediately visible on the default tab
  expect(screen.getByText('PONTSZÁM')).toBeInTheDocument()
  // ingredient rows moved to the Hozzávalók tab
  expect(screen.queryByText(r.ingredients[0].name!)).toBeNull()
  // tablist renders with Részletek selected
  expect(screen.getByRole('tab', { name: 'Részletek' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('tab', { name: /Hozzávalók/ })).toHaveAttribute('aria-selected', 'false')
})

test('switching to Hozzávalók shows the ingredient lines and keeps the actions (mezo-n3xa)', async () => {
  const qc = newQc()
  const r = firstId(qc)
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  await userEvent.click(screen.getByRole('tab', { name: /Hozzávalók/ }))
  expect(screen.getByText(r.ingredients[0].name!)).toBeInTheDocument()
  // breakdown content hides with the tab
  expect(screen.queryByText('PONTSZÁM')).toBeNull()
  // the tab label carries the line count
  expect(screen.getByRole('tab', { name: /Hozzávalók/ }).textContent).toContain(String(r.ingredients.length))
  // page actions stay below the tab content on both tabs
  expect(screen.getByRole('button', { name: /mai étkezéshez/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Törlés/ })).toBeInTheDocument()
})

test('the hero meta line carries the NOVA value and the meta strip is gone (mezo-n3xa)', async () => {
  const qc = newQc()
  const r = firstId(qc)
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  // NOVA moved into the hero meta line (textContent spans the colored child span)
  expect(screen.getByText(/létrehozva/).textContent).toContain(`NOVA ${r.novaDominant}`)
  // the old 4-cell meta strip is deleted
  expect(screen.queryByText('Idő')).toBeNull()
  expect(screen.queryByText('Hozzáv.')).toBeNull()
})

// Napiv de-darkening (mezo-8141): the hero title/meta moved OFF the media band onto
// the card surface below it — var(--ink)/var(--faint), never the retired
// dark-media text tokens.
test('the hero title/meta render off the media band in var(--ink)/var(--faint)', async () => {
  const qc = newQc()
  const r = firstId(qc)
  renderDetail(r.id, qc)
  const title = await screen.findByText(r.name)
  expect(title.style.color).toBe('var(--ink)')
  const meta = screen.getByText(/létrehozva/)
  expect(meta.style.color).toBe('var(--faint)')
})

test('a missing id shows the not-found fallback', async () => {
  renderDetail('does-not-exist', newQc())
  expect(await screen.findByText('Nincs ilyen recept.')).toBeInTheDocument()
})

test('the serving toggle switches the macro basis', async () => {
  const qc = newQc()
  const r = firstId(qc)
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  await userEvent.click(screen.getByRole('button', { name: /Egész/ }))
  // whole-recipe kcal stays present in the "egész" basis
  expect(screen.getByText(String(r.macros.kcal))).toBeInTheDocument()
})

test('Szerkesztés navigates to the edit route', async () => {
  const qc = newQc()
  const r = firstId(qc)
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  await userEvent.click(screen.getByRole('button', { name: /Szerkesztés/ }))
  expect(screen.getByTestId('location').textContent).toBe(`/fuel/recipes/${r.id}/edit`)
})

test('Törlés removes the recipe and navigates back to the library', async () => {
  const qc = newQc()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useRecipes(), { wrapper })
  await waitFor(() => expect(result.current.recipes.length).toBeGreaterThan(0))
  const r = result.current.recipes[0]
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  await userEvent.click(screen.getByRole('button', { name: /Törlés/ }))
  await waitFor(() => expect(result.current.recipes.some(x => x.id === r.id)).toBe(false))
  expect(screen.getByTestId('location').textContent).toBe('/fuel/recipes')
})

test('opens LogFlowPage pre-filled when "+ Mai étkezéshez" is tapped', async () => {
  const qc = newQc()
  const r = firstId(qc)
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  fireEvent.click(screen.getByRole('button', { name: /mai étkezéshez/i }))
  expect(await screen.findByText('Mit ettél?')).toBeInTheDocument()
})

test('Csillag toggles the starred flag', async () => {
  const qc = newQc()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useRecipes(), { wrapper })
  await waitFor(() => expect(result.current.recipes.length).toBeGreaterThan(0))
  const r = result.current.recipes.find(x => !x.starred) ?? result.current.recipes[0]
  const before = r.starred
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  await userEvent.click(screen.getByRole('button', { name: /Csillag/ }))
  await waitFor(() => expect(result.current.recipes.find(x => x.id === r.id)?.starred).toBe(!before))
})

test('mounts the Logok section with a scored recipe log', async () => {
  const qc = newQc()
  const r = firstId(qc) // recipes[0] = rec-1, which has a scored recentLog (0.92)
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  // the section header is present
  expect(screen.getByText('LOGOK')).toBeInTheDocument()
  // the scored log renders its delta-vs-baseline line (RecipeLogsList scored branch)
  expect(screen.getByText(/vs baseline/)).toBeInTheDocument()
})

test('shows the Logok empty-state when the recipe was never logged', async () => {
  const qc = newQc()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useRecipes(), { wrapper })
  await waitFor(() => expect(result.current.recipes.length).toBeGreaterThan(0))
  // rec-3 (Lazac) is not in recipeLinks -> no recentLogs
  const unlogged = result.current.recipes.find(x => x.id === 'rec-3') ?? result.current.recipes[2]
  renderDetail(unlogged.id, qc)
  await screen.findByText(unlogged.name)
  expect(screen.getByText('LOGOK')).toBeInTheDocument()
  expect(screen.getByText(/Még nem logoltad ezt a receptet/)).toBeInTheDocument()
})

test('renders the PONTSZÁM section + dimension cards from the seed templateBreakdown (mezo-bw3y)', async () => {
  const qc = newQc()
  const rec = firstId(qc)
  renderDetail(rec.id, qc)
  expect(await screen.findByText('PONTSZÁM')).toBeInTheDocument()
  // the seed breakdown's dimension cards render via the shared ScoreBreakdownBody
  expect(screen.getByText(/szempont · megbízh\./)).toBeInTheDocument()
  expect(screen.getByText('Kcal & makró arány')).toBeInTheDocument()
})

// recipeToInput round-trips the whole recipe (the star toggle writes it straight back),
// so a dropped role would silently reset a pre-workout template to Általános (mezo-uavr).
test('preserves the role through recipeToInput', () => {
  const r = firstId(newQc())
  expect(recipeToInput({ ...r, role: 'pre_workout' }).role).toBe('pre_workout')
  // reads the recipe's own role, not a constant
  expect(recipeToInput({ ...r, role: 'post_workout' }).role).toBe('post_workout')
})

// The role RETARGETS the rubric (mezo-uavr) — the read surfaces must NAME the yardstick,
// otherwise a pre-workout template reads as a mediocre "general" meal. „Általános" is the
// implicit default, so it is never rendered: only a non-standard role earns a chip.
test('the hero meta line carries the role chip for a non-standard recipe (mezo-uavr)', async () => {
  const qc = newQc()
  const r = pickRecipe(qc, x => x.role === 'pre_workout')
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  expect(screen.getByText('Edzés előtt')).toBeInTheDocument()
  // it sits in the hero meta line, alongside NOVA / létrehozva
  expect(screen.getByText(/létrehozva/).textContent).toContain('Edzés előtt')
})

test('a standard recipe gets no role chip (mezo-uavr)', async () => {
  const qc = newQc()
  const r = pickRecipe(qc, x => x.role === 'standard')
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  expect(screen.queryByText('Edzés előtt')).toBeNull()
  expect(screen.queryByText('Általános')).toBeNull()
  expect(screen.getByText(/létrehozva/).textContent).not.toContain('Általános')
})

test('the PONTSZÁM header names the rubric a non-standard role retargets to (mezo-uavr)', async () => {
  const qc = newQc()
  const r = pickRecipe(qc, x => x.role === 'pre_workout' && !!x.templateBreakdown)
  renderDetail(r.id, qc)
  expect(await screen.findByText('PONTSZÁM')).toBeInTheDocument()
  // reads as "which yardstick was used", not as praise — and the role ATTRIBUTES the
  // mérce, so it takes the adjectival form („edzés előtti"), not the control label
  expect(screen.getByText('edzés előtti mérce szerint')).toBeInTheDocument()
})

test('the PONTSZÁM header stays rubric-free for a standard recipe (mezo-uavr)', async () => {
  const qc = newQc()
  const r = pickRecipe(qc, x => x.role === 'standard' && !!x.templateBreakdown)
  renderDetail(r.id, qc)
  expect(await screen.findByText('PONTSZÁM')).toBeInTheDocument()
  expect(screen.queryByText(/mérce szerint/)).toBeNull()
})

test('a tápérték-sor követi a /adag ↔ egész váltót', async () => {
  const qc = newQc()
  const r = pickRecipe(qc, x => x.id === 'rec-1')
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  // a hero tápérték-sora kirajzolódik a makrók alatt. 'Telített' is unique on the page, but
  // 'Rost' also names a PONTSZÁM dimension micronutrient (MicroPanel) on rec-1's seed
  // breakdown, so the second check is scoped to the NutrientCells row itself (the shared
  // "row" wrapper around the four cells) rather than a page-wide getByText.
  const telitett = screen.getByText('Telített')
  expect(telitett).toBeInTheDocument()
  const nutrientRow = telitett.closest('.row')
  expect(nutrientRow).not.toBeNull()
  expect(within(nutrientRow as HTMLElement).getByText('Rost')).toBeInTheDocument()
})

test('a hozzávalók fülön a tápérték nélküli sor gondolatjelet mutat', async () => {
  const qc = newQc()
  const r = pickRecipe(qc, x => x.id === 'rec-2') // ing-spenot: szándékosan tápérték nélküli seed-sor
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  await userEvent.click(screen.getByRole('tab', { name: /Hozzávalók/ }))
  expect(screen.getAllByText('—').length).toBeGreaterThan(0)
})

test('renders the sablon-olvasat card with fitsFor chips when the seed carries a summary', async () => {
  const qc = newQc()
  const rec = firstId(qc)
  if (!rec.templateBreakdown?.summary) return // seed without prose → the card honestly hides
  renderDetail(rec.id, qc)
  expect(await screen.findByText('Mezo · sablon-olvasat')).toBeInTheDocument()
  for (const t of rec.mezoFit.fitsFor) {
    expect(screen.getByText(`● ${t}`)).toBeInTheDocument()
  }
})

// Background re-evaluation (mezo-uavr) — real mode only: an edit / role change nulls the
// server-side prose and invalidates THIS recipe's ['recipeBreakdown', id], so the cached envelope
// on screen is a PRE-edit reading. The page must say so instead of rendering it as current.
// (Cross-recipe granularity — an edit of X must not light the banner on Y — is pinned at the hook
// level in data/fuel/recipeHooks.test.tsx.)
describe('RecipeDetailPage (real mode) — background re-evaluation', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('renders the re-evaluating copy instead of stale prose while refetching (mezo-uavr)', async () => {
    const qc = newQc()
    renderDetail(REAL_RECIPE_ID, qc)
    // first load resolves the MSW breakdown envelope: prose + score section on screen
    expect(await screen.findByText('MSW sablon-olvasat.')).toBeInTheDocument()
    expect(screen.getByText('PONTSZÁM')).toBeInTheDocument()

    // the regeneration the write path triggers is slow (LLM seconds) — never resolves here
    server.use(http.get(`${API_BASE}/api/recipe/:id/breakdown`, () => new Promise(() => {})))
    act(() => { void qc.invalidateQueries({ queryKey: ['recipeBreakdown', REAL_RECIPE_ID] }) })

    expect(await screen.findByText('Mezo újraértékeli a receptet…')).toBeInTheDocument()
    // the whole stale block is gone — prose, the PONTSZÁM header AND the rubric note
    expect(screen.queryByText('MSW sablon-olvasat.')).toBeNull()
    expect(screen.queryByText('PONTSZÁM')).toBeNull()
    expect(screen.queryByText(/mérce szerint/)).toBeNull()
    // and it does NOT claim a first evaluation
    expect(screen.queryByText('Mezo értékeli a receptet…')).toBeNull()
  })

  it('says „értékeli" (not „újraértékeli") on a cold first load (mezo-uavr)', async () => {
    server.use(http.get(`${API_BASE}/api/recipe/:id/breakdown`, () => new Promise(() => {})))
    renderDetail(REAL_RECIPE_ID, newQc())
    expect(await screen.findByText('Mezo értékeli a receptet…')).toBeInTheDocument()
    expect(screen.queryByText('Mezo újraértékeli a receptet…')).toBeNull()
  })

  // A plain revalidation (staleTime expiry on remount, window refocus) is NOT a regeneration:
  // it returns the SAME cached envelope, so claiming „újraértékeli" would be a false statement
  // and a pointless layout jump. Only a write-driven INVALIDATION counts (mezo-uavr).
  it('a background revalidation that is NOT an invalidation keeps the score section (mezo-uavr)', async () => {
    const qc = newQc()
    renderDetail(REAL_RECIPE_ID, qc)
    expect(await screen.findByText('MSW sablon-olvasat.')).toBeInTheDocument()

    // refetchQueries = exactly what a focus/stale revalidation does: refetch WITHOUT invalidating
    server.use(http.get(`${API_BASE}/api/recipe/:id/breakdown`, () => new Promise(() => {})))
    act(() => { void qc.refetchQueries({ queryKey: ['recipeBreakdown'] }) })
    // the refetch is genuinely in flight — otherwise the assertions below would be vacuous
    await waitFor(() => expect(qc.isFetching({ queryKey: ['recipeBreakdown'] })).toBe(1))

    expect(screen.queryByText('Mezo újraértékeli a receptet…')).toBeNull()
    expect(screen.queryByText('Mezo értékeli a receptet…')).toBeNull()
    // the cached reading stays on screen — no blanked score section
    expect(screen.getByText('MSW sablon-olvasat.')).toBeInTheDocument()
    expect(screen.getByText('PONTSZÁM')).toBeInTheDocument()
  })
})
