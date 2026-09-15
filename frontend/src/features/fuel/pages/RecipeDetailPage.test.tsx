import type { ReactNode } from 'react'
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest'
import { http } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { RecipeDetailPage, recipeToInput } from '@/features/fuel/pages/RecipeDetailPage'
import { FuelRecipeScorePage } from '@/features/fuel/pages/FuelRecipeScorePage'
import { useRecipes } from '@/data/hooks'
import { RECIPES_KEY } from '@/data/fuel/queryKeys'
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
  return <div data-testid="location">{loc.pathname}{loc.search}</div>
}
const newQc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })

function renderDetail(id: string, qc: QueryClient) {
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/fuel/recipes/${id}`]}>
        <Routes>
          <Route path="/fuel/recipes/:id" element={<RecipeDetailPage />} />
          <Route path="/fuel/recipes/:id/edit" element={<LocationProbe />} />
          {/* mezo-jb84: a Pontszám ajtó már nem sheetet nyit, hanem a Titán értékelő OLDALRA visz
              — ugyanarra, amit egy logolt étkezés kap. Az oldalt itt valódiként mountoljuk, hogy
              a lefedettség az ajtó CÉLJÁRÓL szóljon, ne egy sorompó mögötti feltevésről. */}
          <Route path="/fuel/recipes/:id/ertekeles" element={<FuelRecipeScorePage />} />
          <Route path="/fuel/recipes/muhely" element={<LocationProbe />} />
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

/** Put a doctored copy of a seed recipe into the client-owned mock cache — the seeds are all
 *  single-serving, so a basis test needs a multi-serving one, and an honest-null test needs a
 *  recipe whose facts are genuinely absent. */
function seedRecipe(qc: QueryClient, patch: Partial<Recipe>): Recipe {
  const all = recipesOf(qc)
  const doctored = { ...all[0], ...patch, id: patch.id ?? 'rec-doctored' }
  qc.setQueryData(RECIPES_KEY, [doctored, ...all.filter(r => r.id !== doctored.id)])
  return doctored
}

/** Pick a seed recipe by predicate — throws instead of silently testing nothing. */
function pickRecipe(qc: QueryClient, match: (r: Recipe) => boolean) {
  const found = recipesOf(qc).find(match)
  if (!found) throw new Error('no seed recipe matches the predicate')
  return found
}

// ── S4 (mezo-hygp): a Titán anatómia. A korábbi F7.3 Mozaik-mozaik (négy csempe + lokális
// hozzávaló-nézet) KIVEZETVE: az owner szerint egy recept megnyitása ugyanazt a mélységet
// adja, mint egy logolt étkezésé, ezért a blokkok a LAPON vannak, nem csempék mögött. ──────

// Owner: a recept részletei ugyanazokat a blokkokat viszik, mint az étkezésé.
test('a recept részletei ugyanazokat a blokkokat viszik, mint az étkezésé (mezo-hygp)', async () => {
  const qc = newQc()
  const r = firstId(qc)
  renderDetail(r.id, qc)
  expect(await screen.findByText(r.name)).toBeInTheDocument()
  for (const name of ['Makrók', 'Hozzávalók', 'Minőség', 'Mikrotápanyagok']) {
    expect(screen.getByRole('heading', { name })).toBeInTheDocument()
  }
  // Az AI értékelés a fejlécben áll (a `FuelScoreChip` akadálymentes neve), a régi
  // csempe-mozaik pedig eltűnt.
  await waitFor(() => expect(screen.getByRole('button', { name: /AI értékelés/ })).toBeInTheDocument())
  expect(screen.queryByTestId('recipe-score-tile')).toBeNull()
  expect(screen.queryByTestId('recipe-ingredients-tile')).toBeNull()
  expect(screen.queryByRole('tab')).toBeNull()
})

// A hozzávaló-SOROK most a lapon vannak (nem lokális nézet mögött) — a soronkénti
// mennyiség a legbiztosabb jelenlét-próba.
test('a hozzávaló-sorok a lapon vannak, nem egy csempe mögött', async () => {
  const qc = newQc()
  const r = firstId(qc)
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  expect(screen.getByText(r.ingredients[0].name!)).toBeInTheDocument()
  // …és a lap fő műveletei ugyanott maradnak, nem kell visszanavigálni értük
  expect(screen.getByRole('button', { name: /Logolás/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Törlés' })).toBeInTheDocument()
})

// F1 őszinteség: csak a tárolt négy tény, kitalált vitamin nincs.
test('a mikrotápanyagok csak a tárolt tényeket mutatják', async () => {
  const qc = newQc()
  const r = firstId(qc)
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  const micro = screen.getByRole('heading', { name: 'Mikrotápanyagok' }).closest('section')!
  for (const label of ['Rost', 'Cukor', 'Só', 'Telített zsír']) {
    expect(within(micro).getByText(label)).toBeInTheDocument()
  }
  expect(within(micro).queryByText(/vitamin/i)).toBeNull()
})

// B12: a receptből naplózás előtöltve indul, a kamera-felület kihagyásával.
test('a receptből naplózás előtöltve nyílik', async () => {
  const qc = newQc()
  const r = firstId(qc)
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  fireEvent.click(screen.getByRole('button', { name: /Logolás/ }))
  expect(await screen.findByRole('dialog', { name: /Mit ettél/ })).toBeInTheDocument()
})

// B10: a részletlapról a Műhelybe lehet iterálni, a receptet magával víve.
test('a részletlapról a Műhely a recepttel indul', async () => {
  const qc = newQc()
  const r = firstId(qc)
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  await userEvent.click(screen.getByRole('button', { name: /Iterálás a Műhelyben/ }))
  expect(screen.getByTestId('location').textContent).toContain(`recipeId=${r.id}`)
})

test('a meta-sor viszi a NOVA-értéket és a létrehozás dátumát (mezo-n3xa)', async () => {
  const qc = newQc()
  const r = firstId(qc)
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  expect(screen.getByText(/létrehozva/).textContent).toContain(`NOVA ${r.novaDominant}`)
  // a régi négy-cellás meta-csík nem tért vissza
  expect(screen.queryByText('Idő')).toBeNull()
  expect(screen.queryByText('Hozzáv.')).toBeNull()
})

test('a missing id shows the not-found fallback', async () => {
  renderDetail('does-not-exist', newQc())
  expect(await screen.findByText('Nincs ilyen recept.')).toBeInTheDocument()
})

test('the serving toggle switches the macro basis', async () => {
  const qc = newQc()
  // A seedek mind EGY adagosak, ezért ott a váltónak nincs mit mutatnia: ez a próba egy két
  // adagos receptet tesz a kliens-oldali cache-be, hogy a két bázis tényleg elváljon.
  const r = seedRecipe(qc, { servings: 2, macros: { kcal: 600, p: 40, c: 60, f: 20 } })
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  expect(screen.getByText('300')).toBeInTheDocument()          // 600 / 2 adag
  expect(screen.getByText(/kcal \/ adag/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Egész/ }))
  expect(screen.getByText('600')).toBeInTheDocument()
  expect(screen.getByText(/kcal · egész/)).toBeInTheDocument()
})

test('a mikrotápanyag-blokk is követi a /adag ↔ egész váltót', async () => {
  const qc = newQc()
  const r = seedRecipe(qc, { servings: 2, nutrients: { fiberG: 8, sugarG: 12, saltG: 1, saturatedFatG: 4 } })
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  const rostCard = () => screen.getByText('Rost').closest('.fmx-micro-card') as HTMLElement
  expect(within(rostCard()).getByText('4 g')).toBeInTheDocument()   // 8 g / 2 adag
  await userEvent.click(screen.getByRole('button', { name: /Egész/ }))
  expect(within(rostCard()).getByText('8 g')).toBeInTheDocument()
})

// Őszinte-null az ÚJ felületen: amire nincs tárolt tény, az „—" és „nincs adat", nem nulla.
// (A korábbi változat a visszavont lokális Hozzávalók-nézet per-soros tápérték-celláit
// vizsgálta; a Titán hozzávaló-sor kcal-t és mennyiséget mond, tápérték-cellákat nem.)
test('tárolt tény nélkül a mikrotápanyag-kártya gondolatjelet ad, nem kitalált nullát', async () => {
  const qc = newQc()
  const r = seedRecipe(qc, { nutrients: undefined })
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  const micro = screen.getByRole('heading', { name: 'Mikrotápanyagok' }).closest('section')!
  expect(within(micro).getAllByText('—')).toHaveLength(4)
  expect(within(micro).getAllByText('nincs adat')).toHaveLength(4)
  expect(within(micro).queryByText('0 g')).toBeNull()
})

test('Szerkesztés navigates to the edit route', async () => {
  const qc = newQc()
  const r = firstId(qc)
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  await userEvent.click(screen.getByRole('button', { name: /Szerkesztés/ }))
  expect(screen.getByTestId('location').textContent).toBe(`/fuel/recipes/${r.id}/edit`)
})

// S4: a törlés KÉT lépés lett (a prototípus `deleteControl`-ja + a kamra-tétel lap precedense) —
// egy részletező lapon egy koppintás nem törölhet receptet.
test('Törlés két lépés: az első koppintás csak felfegyverzi a megerősítést', async () => {
  const qc = newQc()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useRecipes(), { wrapper })
  await waitFor(() => expect(result.current.recipes.length).toBeGreaterThan(0))
  const r = result.current.recipes[0]
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  await userEvent.click(screen.getByRole('button', { name: 'Törlés' }))
  expect(await screen.findByRole('button', { name: /Biztos\? Még egy érintés a törléshez/ })).toBeInTheDocument()
  expect(result.current.recipes.some(x => x.id === r.id)).toBe(true)
  expect(screen.queryByTestId('location')).toBeNull()
})

test('Törlés removes the recipe on the SECOND tap and navigates back to the library', async () => {
  const qc = newQc()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useRecipes(), { wrapper })
  await waitFor(() => expect(result.current.recipes.length).toBeGreaterThan(0))
  const r = result.current.recipes[0]
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  await userEvent.click(screen.getByRole('button', { name: 'Törlés' }))
  await userEvent.click(screen.getByRole('button', { name: /Biztos\?/ }))
  await waitFor(() => expect(result.current.recipes.some(x => x.id === r.id)).toBe(false))
  expect(screen.getByTestId('location').textContent).toBe('/fuel/recipes')
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

test('a Logok ajtó a log-sheetet nyitja a pontozott loggal', async () => {
  const qc = newQc()
  const r = firstId(qc) // recipes[0] = rec-1, which has a scored recentLog (0.92)
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  await userEvent.click(screen.getByTestId('recipe-logs-open'))
  // the scored log renders its delta-vs-baseline line (RecipeLogsList scored branch)
  expect(await screen.findByText(/vs baseline/)).toBeInTheDocument()
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
  expect(screen.getByText('ma még nincs logolva')).toBeInTheDocument()
  await userEvent.click(screen.getByTestId('recipe-logs-open'))
  expect(await screen.findByText(/Még nem logoltad ezt a receptet/)).toBeInTheDocument()
})

test('a Pontszám ajtó a Titán értékelő oldalra visz, a teljes bontással (mezo-bw3y)', async () => {
  const qc = newQc()
  const rec = firstId(qc)
  renderDetail(rec.id, qc)
  await screen.findByText(rec.name)
  const door = screen.getByTestId('recipe-score-open')
  await waitFor(() => expect(door).not.toBeDisabled())
  expect(within(door).getByText(/szempont/)).toBeInTheDocument()
  await userEvent.click(door)
  // Az értékelő oldal a dimenzió-mozaikot rendereli — ugyanazt az envelope-ot, más bőrben.
  expect((await screen.findAllByText('Kcal & makró arány')).length).toBeGreaterThanOrEqual(1)
  expect(screen.getByText('Miből áll össze?')).toBeInTheDocument()
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
test('the meta line carries the role chip for a non-standard recipe (mezo-uavr)', async () => {
  const qc = newQc()
  const r = pickRecipe(qc, x => x.role === 'pre_workout')
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  expect(screen.getByText('Edzés előtt')).toBeInTheDocument()
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

test('az értékelő oldal megnevezi a mércét, amihez egy nem-standard szerep igazodik (mezo-uavr)', async () => {
  const qc = newQc()
  const r = pickRecipe(qc, x => x.role === 'pre_workout' && !!x.templateBreakdown)
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  const door = screen.getByTestId('recipe-score-open')
  await waitFor(() => expect(door).not.toBeDisabled())
  await userEvent.click(door)
  // Azt mondja el, MILYEN mércével mértünk — nem dicsér. A lábjegyzetben él, az oldal alján.
  expect(await screen.findByText(/edzés előtti/)).toBeInTheDocument()
})

test('standard receptnél az értékelő oldal nem beszél mércéről (mezo-uavr)', async () => {
  const qc = newQc()
  const r = pickRecipe(qc, x => x.role === 'standard' && !!x.templateBreakdown)
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  const door = screen.getByTestId('recipe-score-open')
  await waitFor(() => expect(door).not.toBeDisabled())
  await userEvent.click(door)
  expect(await screen.findByText('Miből áll össze?')).toBeInTheDocument()
  expect(screen.queryByText(/mérce/)).toBeNull()
})

test('renders the Mezo jegyzete card with the first fit chip when the seed carries a summary', async () => {
  const qc = newQc()
  const rec = firstId(qc)
  if (!rec.templateBreakdown?.summary) return // seed without prose → the card honestly says so
  renderDetail(rec.id, qc)
  await screen.findByText(rec.name)
  const note = screen.getByRole('region', { name: 'Mezo jegyzete' })
  await waitFor(() => expect(within(note).queryByText(/Még nincs olvasat/)).toBeNull())
  expect(within(note).getByText(`● ${rec.mezoFit.fitsFor[0]}`)).toBeInTheDocument()
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
    // first load resolves the MSW breakdown envelope: prose + score door on screen
    expect(await screen.findByText('MSW sablon-olvasat.')).toBeInTheDocument()
    expect(within(screen.getByTestId('recipe-score-open')).getByText(/szempont/)).toBeInTheDocument()

    // the regeneration the write path triggers is slow (LLM seconds) — never resolves here
    server.use(http.get(`${API_BASE}/api/recipe/:id/breakdown`, () => new Promise(() => {})))
    act(() => { void qc.invalidateQueries({ queryKey: ['recipeBreakdown', REAL_RECIPE_ID] }) })

    expect(await screen.findByText('Mezo újraértékeli…')).toBeInTheDocument()
    // the whole stale block is gone — prose AND the dimension count; the door is disabled
    expect(screen.queryByText('MSW sablon-olvasat.')).toBeNull()
    expect(screen.queryByText(/szempont/)).toBeNull()
    expect(screen.getByTestId('recipe-score-open')).toBeDisabled()
    // and it does NOT claim a first evaluation
    expect(screen.queryByText('Mezo értékeli…')).toBeNull()
  })

  it('says „értékeli" (not „újraértékeli") on a cold first load (mezo-uavr)', async () => {
    server.use(http.get(`${API_BASE}/api/recipe/:id/breakdown`, () => new Promise(() => {})))
    renderDetail(REAL_RECIPE_ID, newQc())
    expect(await screen.findByText('Mezo értékeli…')).toBeInTheDocument()
    expect(screen.queryByText('Mezo újraértékeli…')).toBeNull()
  })

  // A plain revalidation (staleTime expiry on remount, window refocus) is NOT a regeneration:
  // it returns the SAME cached envelope, so claiming „újraértékeli" would be a false statement
  // and a pointless layout jump. Only a write-driven INVALIDATION counts (mezo-uavr).
  it('a background revalidation that is NOT an invalidation keeps the score block (mezo-uavr)', async () => {
    const qc = newQc()
    renderDetail(REAL_RECIPE_ID, qc)
    expect(await screen.findByText('MSW sablon-olvasat.')).toBeInTheDocument()

    // refetchQueries = exactly what a focus/stale revalidation does: refetch WITHOUT invalidating
    server.use(http.get(`${API_BASE}/api/recipe/:id/breakdown`, () => new Promise(() => {})))
    act(() => { void qc.refetchQueries({ queryKey: ['recipeBreakdown'] }) })
    // the refetch is genuinely in flight — otherwise the assertions below would be vacuous
    await waitFor(() => expect(qc.isFetching({ queryKey: ['recipeBreakdown'] })).toBe(1))

    expect(screen.queryByText('Mezo újraértékeli…')).toBeNull()
    expect(screen.queryByText('Mezo értékeli…')).toBeNull()
    // the cached reading stays on screen — no blanked score door
    expect(screen.getByText('MSW sablon-olvasat.')).toBeInTheDocument()
    expect(within(screen.getByTestId('recipe-score-open')).getByText(/szempont/)).toBeInTheDocument()
  })
})
