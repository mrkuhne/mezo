import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setLang } from '@/shared/i18n'
import { QueryWrapper } from '@/test/queryWrapper'
import { FrameProvider, useFrame } from '@/shared/ui/folyadek'
import { FuelRecipesPage } from '@/features/fuel/pages/FuelRecipesPage'
import { RecipeDetailPage } from '@/features/fuel/pages/RecipeDetailPage'
import { RecipeEditorPage } from '@/features/fuel/pages/RecipeEditorPage'
import { RecipeWorkshopPage } from '@/features/fuel/pages/RecipeWorkshopPage'
import { RecipeLogsList } from '@/features/fuel/components/RecipeLogsList'

// Receptek, the recipe page, the manual editor and the Műhely in English: system text verbatim from the approved prototype
// (`vilagos/fuel.js` `L(hu, en)` pairs); what the user typed or what is stored (recipe and ingredient names, tags, Mezo's
// stored note) stays as written. Mock mode, so no fetch.
beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'true'); setLang('en', { persist: false }) })
afterEach(() => { vi.unstubAllEnvs(); setLang('hu', { persist: false }) })

function TitleProbe() {
  const f = useFrame()
  return <div data-testid="frame-title"><small>{f.eyebrow}</small><span>{f.title}</span></div>
}

const mount = (route: string) => render(
  <QueryWrapper>
    <MemoryRouter initialEntries={[route]}>
      <FrameProvider>
        <TitleProbe />
        <Routes>
          <Route path="/fuel/recipes" element={<FuelRecipesPage />} />
          <Route path="/fuel/recipes/new" element={<RecipeEditorPage />} />
          <Route path="/fuel/recipes/muhely" element={<RecipeWorkshopPage />} />
          <Route path="/fuel/recipes/:id" element={<RecipeDetailPage />} />
        </Routes>
      </FrameProvider>
    </MemoryRouter>
  </QueryWrapper>,
)

describe('Recipes in English', () => {
  it('the list: title, hero, filters, a row', () => {
    mount('/fuel/recipes')
    expect(screen.getByTestId('frame-title')).toHaveTextContent(/Kitchen · \d+ recipes/)
    expect(screen.getByTestId('frame-title')).toHaveTextContent('Recipes')
    expect(screen.getByText('Recipes · what you eat most')).toBeInTheDocument()
    expect(screen.getByText(/^You have \d+ recipes\. You’ve eaten your favourite \d+ times\.$/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ New recipe' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Filter/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Your recipes/ })).toBeInTheDocument()
    const filters = screen.getByRole('group', { name: 'Filter' })
    expect([...filters.querySelectorAll('button')].map(b => b.firstChild?.textContent))
      .toEqual(['All', 'Breakfast', 'Lunch', 'Dinner', 'Snack', 'Starred'])
    expect(screen.getByText('The number is one serving’s calories. The three bars are its protein, carbs and fat.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to Kitchen' })).toBeInTheDocument()
    // stored: the recipe's name stays Hungarian; its system labels are English
    const row = document.querySelector('.fc-list > .fx-it') as HTMLElement
    expect(row).toHaveTextContent(/Breakfast|Lunch|Dinner|Snack/)
    expect(row).toHaveTextContent(/prot\./)
    expect(document.body.textContent).not.toMatch(/Receptjeid|Szűrés|Csillagos|Uzsonna|adag/)
  })

  it('the list follows a language change at runtime, on the same node', () => {
    setLang('hu', { persist: false })
    mount('/fuel/recipes')
    const label = screen.getByText('Receptek · amit a legtöbbször ettél')
    const add = screen.getByRole('button', { name: '+ Új recept' })
    act(() => setLang('en', { persist: false }))
    expect(label).toHaveTextContent('Recipes · what you eat most')
    expect(add).toHaveTextContent('+ New recipe')
    expect(screen.getByRole('button', { name: /^Snack/ })).toBeInTheDocument()
  })

  it('a recipe: hero, sections, actions and the logs sheet', async () => {
    mount('/fuel/recipes/rec-1')
    expect(screen.getByTestId('frame-title')).toHaveTextContent(/(Breakfast|Lunch|Dinner|Snack) recipe/)
    expect(screen.getByText(/^(One serving · the whole pot|One serving from the pot · serves \d+)$/)).toBeInTheDocument()
    expect(document.querySelector('.fo-hero .fx-ng-n')).toHaveTextContent('kcal / serving')
    expect(document.querySelector('.fo-hero .fc-meta')).toHaveTextContent(/^1 serving · (ready in \d+ min|no cooking time given) · NOVA \d$/)
    expect(screen.getByText(/^Eaten \d+ times/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'I ate this today' })).toBeInTheDocument()
    for (const name of [/^1\s*Macros$/, /^2\s*Ingredients · \d+$/, /^3\s*Quality and micronutrients$/, /^4\s*Mezo’s note$/, /^5\s*What you can do$/]) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument()
    }
    expect(screen.getByText('The bar shows how much of the recipe’s calories the item gives.')).toBeInTheDocument()
    expect(within(screen.getByTestId('recipe-score-open')).getByText('Mezo’s rating')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Log it · I ate this today/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Rework it in the workshop/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('button', { name: 'Sure? Tap once more to delete' })).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('recipe-logs-open'))
    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByText('Recipe · today’s logs')).toBeInTheDocument()
    expect(within(sheet).getByText('Only today’s logs show here. Earlier ones are on Trends.')).toBeInTheDocument()
    expect(within(sheet).getAllByRole('button', { name: 'Close' })).toHaveLength(2) // the × and the link
  })

  it('a missing recipe', () => {
    mount('/fuel/recipes/nope')
    expect(screen.getByTestId('frame-title')).toHaveTextContent('No such recipe')
    expect(screen.getByText('You may have deleted it. Everything you still have is in Recipes.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to Recipes' })).toBeInTheDocument()
  })

  it('the logs list composes the slot label and the clock from data', () => {
    const at = new Date(2026, 9, 12, 7, 5).toISOString()
    render(<RecipeLogsList baselineScore={0.8} logs={[
      { mealId: 'm', slot: 'breakfast', score: 0.9, delta: 0, loggedAt: at, kcal: 1420, p: 30, c: 50, f: 12 },
      { mealId: 'n', slot: 'Délutáni falat', score: 0, delta: 0, loggedAt: at, kcal: 200, p: 3, c: 20, f: 9 },
    ]} />)
    expect(screen.getByText('Breakfast')).toBeInTheDocument()
    expect(screen.getAllByText('today 07:05')).toHaveLength(2)
    expect(screen.getByText('+1 points compared with the recipe’s rating.')).toBeInTheDocument()
    expect(screen.getByText('1,420')).toBeInTheDocument()
    // a stored window name is never translated; a log without a score says it is in progress
    expect(screen.getByText('Délutáni falat')).toBeInTheDocument()
    expect(screen.getByText('in progress')).toBeInTheDocument()
  })

  it('the editor: empty face, fields, the picker', async () => {
    mount('/fuel/recipes/new')
    expect(screen.getByTestId('frame-title')).toHaveTextContent('Fuel · Recipes')
    expect(screen.getByTestId('frame-title')).toHaveTextContent('New recipe')
    expect(screen.getByText('Macro total · one serving')).toBeInTheDocument()
    expect(screen.getByText('The pot is still empty.')).toBeInTheDocument()
    expect(screen.getByText('Add ingredients from your pantry. The total is worked out from their facts.')).toBeInTheDocument()
    for (const name of [/^1\s*Basics$/, /^2\s*Ingredients · 0$/, /^3\s*Tags$/]) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument()
    }
    expect(screen.getByLabelText('Recipe name')).toHaveAttribute('placeholder', 'e.g. Tuna salad · after training')
    expect([...screen.getByRole('group', { name: 'Meal' }).querySelectorAll('button')].map(b => b.textContent))
      .toEqual(['Breakfast', 'Lunch', 'Dinner', 'Snack'])
    expect([...screen.getByRole('group', { name: 'Role' }).querySelectorAll('button')].map(b => b.textContent))
      .toEqual(['General', 'Before training', 'After training'])
    expect(screen.getByRole('button', { name: 'Star' })).toBeInTheDocument()
    expect(screen.getByText('The role decides how we score it: around training, fast carbs are fuel, not a fault.')).toBeInTheDocument()
    expect(screen.getByText('Prep + cooking')).toBeInTheDocument()
    expect(screen.getByText('No ingredients yet. Tap Add from pantry.')).toBeInTheDocument()
    expect(screen.getByLabelText('New tag')).toHaveAttribute('placeholder', '+ tag')
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: '+ Add from pantry' }))
    const sheet = await screen.findByRole('dialog', { name: 'Pick an ingredient' })
    expect(within(sheet).getByText('Pantry · ingredient')).toBeInTheDocument()
    expect(within(sheet).getByPlaceholderText('Search the pantry…')).toBeInTheDocument()
    expect(within(sheet).getByText('You can add several in a row. This stays open.')).toBeInTheDocument()
    const adds = within(sheet).getAllByRole('button', { name: /^Add / })
    await userEvent.click(adds[0])
    expect(within(sheet).getAllByRole('button', { name: / added$/ })).toHaveLength(1)
    await userEvent.click(within(sheet).getByRole('button', { name: 'Done' }))
    expect(await screen.findByText('One serving is the whole pot.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Ingredients · 1/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Remove /i })).toBeInTheDocument()
  })

  it('the workshop: the empty canvas and the dock', () => {
    mount('/fuel/recipes/muhely')
    expect(screen.getByTestId('frame-title')).toHaveTextContent('Recipe workshop')
    expect(screen.getByText('Recipe workshop · empty pot')).toBeInTheDocument()
    expect(screen.getByText('What shall we cook up?')).toBeInTheDocument()
    expect(screen.getByText(/^Pick a goal or say it in your own words\./)).toBeInTheDocument()
    expect([...screen.getByRole('group', { name: 'Goals' }).querySelectorAll('button')].map(b => b.textContent))
      .toEqual(['High protein', 'Before training', 'After training', 'Before bed', 'Breakfast'])
    expect(screen.getByLabelText('Message to the workshop')).toHaveAttribute('placeholder', 'What shall we cook?')
    expect(screen.getByRole('button', { name: 'Pantry' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    expect(screen.getByRole('heading', { name: /How we work/ })).toBeInTheDocument()
    expect(screen.getByText('The workshop suggests ingredients and amounts. The macros always come from your pantry’s facts.')).toBeInTheDocument()
  })

  it('the workshop from a recipe: the draft face', async () => {
    mount('/fuel/recipes/muhely?recipeId=rec-1')
    expect(await screen.findByText('Draft · from an existing recipe')).toBeInTheDocument()
    expect(screen.getByText('Ready to save: it updates your recipe, it doesn’t copy it.')).toBeInTheDocument()
    expect(screen.getByText(/^All \d+ lines come from your pantry\.$/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Update the recipe' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Whole' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^1\s*Ingredients · \d+$/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Macros and quality/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Ask for a change/ })).toBeInTheDocument()
    expect(screen.getAllByText('pantry').length).toBeGreaterThan(0)
  })
})
