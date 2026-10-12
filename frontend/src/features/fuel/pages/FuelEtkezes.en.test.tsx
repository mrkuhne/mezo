// The meal page, Mezo's rating (meal + recipe) and their sheets in English (Folyadék F5, mezo-n4wf5.5): the words are
// verbatim from the approved prototype's `L(hu, en)` pairs wherever it has the string. Stored and server text (the meal's
// name, the aspects' names and explanations) stays as it was written. One case switches the language at runtime on the
// SAME node. Mock mode, so no fetch.
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FuelDay, FuelMeal } from '@/data/types'
import { fuelDay } from '@/data/fuel/fuel'
import { setLang } from '@/shared/i18n'
import { QueryWrapper } from '@/test/queryWrapper'
import { glycemicBand } from '@/features/fuel/logic/glycemicBand'
import { GlycemicGlass } from '@/features/fuel/components/GlycemicGlass'
import { MealClockBox, type ClockDay } from '@/features/fuel/components/MealClockBox'
import type { WindowTileVM } from '@/features/fuel/logic/fuelSwimlane'
import type { DoneMealRow } from '@/features/fuel/logic/keretHero'

const SEED = fuelDay.meals[0]
const MEAL: FuelMeal = {
  ...SEED, id: 'meal-1', slot: 'breakfast', title: 'Túrós zabkása · áfonyával', score: 0.84,
  kcal: 689, p: 54, c: 79, f: 15, loggedAt: '2026-10-12T07:20:00', mealDate: '2026-10-12',
  nutrients: { fiberG: 7, sugarG: 24, saltG: 0.3, saturatedFatG: null },
  mealItems: [
    { source: 'pantry', refId: 'p-1', amount: 60, unit: 'g', name: 'Zabpehely', contribution: { kcal: 223, p: 8, c: 35, f: 4 }, nova: 1 },
    { source: 'estimate', refId: '', amount: 25, unit: 'g', name: 'Akácméz', contribution: { kcal: 84, p: 0, c: 21, f: 0 }, nova: 2 },
  ],
  breakdown: { ...SEED.breakdown!, tagline: 'Fehérjében erős, tiszta tányér', summary: 'A fehérje viszi.' },
} as FuelMeal

const DAY: FuelDay = {
  targets: { kcal: 3100, p: 180, c: 380, f: 90, water: 3000 },
  consumed: { kcal: 689, p: 54, c: 79, f: 15, water: 500 },
  fuelMode: null, recoveryCategory: null, recoveryDay: null, skippedKcal: 0,
  meals: [MEAL], pacing: { msg: '' }, micronutrients: [], supplements: [],
}

vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return { ...actual, useFuelDay: () => ({ fuel: DAY, isPending: false }) }
})

import { FuelMealDetailPage } from '@/features/fuel/pages/FuelMealDetailPage'
import { FuelMealScorePage } from '@/features/fuel/pages/FuelMealScorePage'
import { FuelRecipeScorePage } from '@/features/fuel/pages/FuelRecipeScorePage'

beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'true'); setLang('en', { persist: false }) })
afterEach(() => { vi.unstubAllEnvs(); setLang('hu', { persist: false }) })

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/fuel/etkezes/:id', element: <FuelMealDetailPage /> },
      { path: '/fuel/etkezes/:id/ertekeles', element: <FuelMealScorePage /> },
      { path: '/fuel/recipes/:id/ertekeles', element: <FuelRecipeScorePage /> },
      { path: '*', element: <div>PROBE</div> },
    ],
    { initialEntries: [path] },
  )
  return render(<RouterProvider router={router} />, { wrapper: QueryWrapper })
}

/** No Hungarian accent may be left in what the area itself prints; stored / server text is cut out first. */
const ownText = (root: Element, stored: string[]) => stored.reduce((t, s) => t.split(s).join(''), root.textContent ?? '')

describe('Fuel · meal and rating in English', () => {
  it('meal page: hero, the five sections, rows and the doors', () => {
    const { container } = renderAt('/fuel/etkezes/meal-1')
    const hero = container.querySelector('.fo-hero') as HTMLElement
    // the meal's own name is stored text: never translated
    expect(hero.querySelector('.fo-hero-lbl')).toHaveTextContent('Túrós zabkása · áfonyával')
    expect(hero.querySelector('.fe-facts')).toHaveTextContent('22% of your day’s 3,100 kcal budget · logged at 07:20')
    expect(hero.querySelector('.fx-pk')).toHaveTextContent('the bowl was empty before itthis meal')
    expect(within(hero).getByRole('button', { name: 'Mezo’s rating 8.4' })).toBeInTheDocument()
    expect(within(hero).getByRole('button', { name: /^Blood sugar · (low|medium|high)$/ })).toBeInTheDocument()
    expect(Array.from(container.querySelectorAll('.fo-sec')).map(h => h.textContent)).toEqual(
      ['1Macros', '2Ingredients · 2', '3Quality', '4Micronutrients', '5Edit and recipe'])
    expect(screen.getByRole('group', { name: 'The split of the meal’s energy' })).toHaveTextContent(
      'The level is the split of the meal’s energy: 216 kcal from protein, 316 from carbs, 135 from fat.')
    const oats = screen.getByText('Zabpehely').closest('.fx-it')!
    expect(oats).toHaveTextContent('pantry')
    expect(oats).toHaveTextContent('Whole food')
    expect(screen.getByText('Akácméz').closest('.fx-it')).toHaveTextContent('estimate')
    expect(screen.getByText('The bar shows how much of the meal’s calories the item gives.')).toBeInTheDocument()
    for (const label of ['Whole-food share', 'Energy density', 'Ultra-processed', 'Blood sugar response']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    const micro = container.querySelector('.fe-mic') as HTMLElement
    expect(within(micro).getByText('100% of the meal goal')).toBeInTheDocument()
    expect(within(micro).getByText('96% of the meal allowance')).toBeInTheDocument()
    expect(within(micro).getByText('watch it')).toBeInTheDocument()
    expect(within(micro).getByText('the source gave no value')).toBeInTheDocument()
    expect(within(micro).getByText('no data')).toBeInTheDocument()
    expect(within(micro).getByText('This is what we store today. Vitamins and minerals are still on the way.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Edit this meal/ })).toHaveTextContent('you can change the items and the time')
    expect(screen.getByRole('button', { name: /Save it as a recipe/ })).toHaveTextContent('the workshop opens with this meal')
    expect(ownText(container, ['Túrós zabkása · áfonyával', 'Zabpehely', 'Akácméz', MEAL.breakdown!.tagline!, MEAL.breakdown!.summary!]))
      .not.toMatch(/[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/)
  })

  it('meal page: the text follows a language change at runtime, on the same node', () => {
    setLang('hu', { persist: false })
    const { container } = renderAt('/fuel/etkezes/meal-1')
    const facts = container.querySelector('.fe-facts')!
    const door = screen.getByRole('button', { name: /Javítom ezt az étkezést/ })
    expect(facts).toHaveTextContent('a napod 22%-a a 3 100 kcal-os keretből · 07:20-kor logoltad')
    act(() => setLang('en', { persist: false }))
    expect(container.querySelector('.fe-facts')).toBe(facts)
    expect(facts).toHaveTextContent('22% of your day’s 3,100 kcal budget · logged at 07:20')
    expect(door).toHaveTextContent('Edit this meal')
    expect(screen.getByRole('heading', { name: /Micronutrients/ })).toBeInTheDocument()
  })

  it('meal page: not found', () => {
    renderAt('/fuel/etkezes/none')
    expect(screen.getByText(/^This meal is not here\./)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to Today' })).toBeInTheDocument()
  })

  it('Mezo’s rating of a meal: hero, sections, an aspect’s sheet', async () => {
    const { container } = renderAt('/fuel/etkezes/meal-1/ertekeles')
    const hero = container.querySelector('.fo-hero') as HTMLElement
    expect(hero.querySelector('.fo-hero-lbl')).toHaveTextContent('Breakfast · 07:20')
    expect(within(hero).getByRole('img', { name: 'Mezo’s rating: 8.4 out of ten' })).toHaveTextContent('8.4')
    expect(hero.querySelector('.fe-sc')).toHaveTextContent(/confidence \d+%/)
    expect(within(hero).getByRole('button', { name: 'Meal details' })).toBeInTheDocument()
    const notes = Array.from(hero.querySelectorAll('.fe-8 .fo-vial small i')).map(e => e.textContent)
    expect(notes).toContain('weakest')
    expect(notes).toContain('strongest')
    expect(notes.some(n => /^weight \d+%$/.test(n ?? ''))).toBe(true)
    expect(Array.from(hero.querySelectorAll('.fe-8 .fo-vial small')).map(e => e.firstChild!.textContent)).toEqual(
      expect.arrayContaining(['Macros', 'Micro', 'Process.', 'Timing']))
    expect(screen.getByRole('heading', { name: /What is it made of\?/ })).toBeInTheDocument()
    expect(screen.getByText('Tap a row for details.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /If you want to raise it/ })).toBeInTheDocument()
    expect(container.querySelector('.fe-fbc')).toHaveTextContent('Mezo adds the text and never changes the numbers.')
    // the aspect's own name and explanation are server text: shown as they arrive
    const nova = MEAL.breakdown!.dimensions.find(d => d.id === 'nova')!
    await userEvent.click(within(container.querySelector('.fe-dims') as HTMLElement).getByRole('button', { name: new RegExp(nova.label.slice(0, 12)) }))
    const box = screen.getByRole('dialog')
    expect(box).toHaveAccessibleName(nova.label)
    expect(within(box).getByText(`weight ${Math.round(nova.weight * 100)}%`)).toBeInTheDocument()
    expect(within(box).getAllByRole('button', { name: 'Close' }).length).toBeGreaterThan(0)
  })

  it('Mezo’s rating of a recipe: per-serving label and the template note', () => {
    const { container } = renderAt('/fuel/recipes/rec-1/ertekeles')
    expect(container.querySelector('.fo-hero-lbl')!.textContent).toMatch(/^Recipe · template · 1 serving · [\d,]+ kcal$/)
    expect(screen.getByRole('button', { name: 'Recipe details' })).toBeInTheDocument()
    expect(container.querySelector('.fe-fbc')).toHaveTextContent(
      'The score is for the recipe as written, per serving, not for what you ended up eating. It is judged for its role: before training. What you log from it gets its own meal rating.')
  })

  it('recipe rating: gone', () => {
    renderAt('/fuel/recipes/none/ertekeles')
    expect(screen.getByText('This recipe is gone.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to Recipes' })).toBeInTheDocument()
  })

  it('blood sugar sheet: the band’s word, the shape, what you will feel — and no number on the axis', () => {
    const band = glycemicBand({ c: 100, sugarG: null, fiberG: 0, p: 0, f: 0 })!
    render(<GlycemicGlass band={band} onClose={() => {}} />)
    const box = screen.getByRole('dialog')
    expect(within(box).getByRole('heading', { level: 2 })).toHaveTextContent(/^High$/)
    expect(within(box).getByText('Blood sugar response · expected effect')).toBeInTheDocument()
    expect(within(box).getByText('This one pushes it up.')).toBeInTheDocument()
    expect(box.querySelector('.fe-gcv')!.getAttribute('aria-label')).toBe('The expected shape of the blood sugar response over three hours: peak')
    expect(Array.from(box.querySelectorAll('.fe-gcv text')).map(t => t.textContent)).toEqual(['baseline', 'peak', 'dip', 'meal', '+1 h', '+2 h', '+3 h'])
    expect(within(box).getByText(/^We do not know the amount of sugar/)).toBeInTheDocument()
    for (const label of ['What you will feel', 'Energy', 'Baseline', 'Hunger', 'Now', 'How to make it flatter next time']) {
      expect(within(box).getByText(label)).toBeInTheDocument()
    }
    expect(box.querySelector('.fe-result')!.textContent).toMatch(/^With the two together/)
    expect(within(box).getAllByRole('button', { name: 'Close' }).length).toBeGreaterThan(0)
    expect(box.textContent).not.toMatch(/[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/)
    expect(box.textContent).not.toMatch(/glyc[ae]mic index|\bGI\b/i)
  })

  it('meal clock sheet: before and after the log', () => {
    const tile = (over: Partial<WindowTileVM> = {}): WindowTileVM => ({
      key: 'b', slotKey: 'snack', state: 'now', icon: 'i-snack', label: 'Morning snack', time: '10:52',
      name: 'Morning snack', ghost: true, fromPlan: false, kcal: 311, rings: [], mealId: null,
      windowFrom: '10:30', windowTo: '11:30', windowReasons: ['bridge'], budgetKcal: 311, plannedTime: '10:52', ...over,
    } as WindowTileVM)
    const row: DoneMealRow = {
      mealId: 'm1', name: 'Kókuszos csirke', time: '08:46', kcal: 784, proteinG: 63, carbsG: 92, fatG: 14,
      scorePct: 87, fiberG: 10, sugarG: 6, plannedTime: '08:15', timing: null,
    }
    const day: ClockDay = {
      wake: '06:40', bed: '23:00', nowHHmm: '10:52', training: { start: '17:30', end: '18:45', label: 'Pull' },
      windows: [{ key: 'a', from: '07:20', to: '09:20' }, { key: 'b', from: '10:30', to: '11:30' }], mealCount: 4,
    }
    const before = render(<MealClockBox tile={tile()} row={null} day={day} next={null} blockColor="" onClose={() => {}} />)
    let box = screen.getByRole('dialog')
    expect(within(box).getByText('meal 2 of 4 · open now')).toBeInTheDocument()
    expect(within(box).getByText('Suggested window')).toBeInTheDocument()
    expect(within(box).getByText('NOW')).toBeInTheDocument()
    expect(within(box).getByText('38 min left')).toBeInTheDocument()
    expect(box.querySelector('.fe-dd24')!.getAttribute('aria-label')).toBe('Day clock: wake 06:40, bed 23:00, training 17:30–18:45')
    expect(box.querySelector('.fe-lg')).toHaveTextContent('Morning snackother mealstrainingsleep')
    for (const label of ['Why then?', 'Between two main meals', 'How it fits your day', 'Movement today', 'Meal plan']) {
      expect(within(box).getByText(label)).toBeInTheDocument()
    }
    expect(within(box).getByText('Meal 2 of 4. The plan gives it about 311 kcal of the daily budget.')).toBeInTheDocument()
    expect(within(box).getByText(/^The window is a guide\./)).toBeInTheDocument()
    expect(within(box).getByRole('button', { name: 'OK' })).toBeInTheDocument()
    expect(box.textContent).not.toMatch(/[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/)
    before.unmount()

    render(<MealClockBox tile={tile({ key: 'a', label: 'Breakfast', slotKey: 'breakfast', state: 'done', windowFrom: '07:20', windowTo: '09:20' })}
      row={row} day={day} next={tile()} blockColor="" onClose={() => {}} />)
    box = screen.getByRole('dialog')
    expect(within(box).getByText('meal 1 of 4 · logged')).toBeInTheDocument()
    expect(within(box).getByText('Logged')).toBeInTheDocument()
    expect(within(box).getByText('suggested window: 07:20–09:20')).toBeInTheDocument()
    expect(within(box).getByText('In the window')).toBeInTheDocument()
    expect(within(box).getByText('SUGGESTED')).toBeInTheDocument()
    expect(within(box).getByText('a 2 h window')).toBeInTheDocument()
    for (const label of ['Blood sugar response', 'What to expect', 'Energy', 'When you will be hungry', 'The rhythm of the day']) {
      expect(within(box).getByText(label)).toBeInTheDocument()
    }
    expect(within(box).getByText('It keeps the 3–4 hour protein rhythm, and the day’s other windows stay in place.')).toBeInTheDocument()
    expect(box.textContent).not.toMatch(/[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/)
  })
})
