import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setLang } from '@/shared/i18n'
import { QueryWrapper } from '@/test/queryWrapper'
import { useRecipes } from '@/data/hooks'
import { FrameProvider, useFrame } from '@/shared/ui/folyadek'
import { FuelLogNewPage } from '@/features/fuel/pages/FuelLogNewPage'
import { LogFlowPage } from '@/features/fuel/pages/LogFlowPage'
import { FuelMealCeremony } from '@/features/fuel/components/FuelMealCeremony'

// Area B (logging + the meal ceremony) in English: the strings are the approved prototype's `L(hu, en)` pairs
// (`vilagos/fuel.js` `log()`, `cer()`, `SH.kamrapick`, `SH.receptpick`). Mock mode, so no fetch. What the user typed
// or what is stored (recipe / pantry names) is never translated.
beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'true'); setLang('en', { persist: false }) })
afterEach(() => { setLang('hu', { persist: false }); vi.unstubAllEnvs() })

function FrameProbe() {
  const { title, eyebrow } = useFrame()
  return <div><span data-testid="frame-title">{title}</span><span data-testid="frame-eyebrow">{eyebrow}</span></div>
}
const mountLog = (route = '/fuel/log/uj') => render(
  <QueryWrapper><MemoryRouter initialEntries={[route]}><FrameProvider><FrameProbe /><FuelLogNewPage /></FrameProvider></MemoryRouter></QueryWrapper>,
)

describe('Fuel logging in English', () => {
  it('the log page: frame title, the empty draft hero, the four ways in, the foot', () => {
    mountLog()
    expect(screen.getByTestId('frame-title')).toHaveTextContent('Between meals')
    expect(screen.getByTestId('frame-eyebrow')).toHaveTextContent(/^Log · \d{1,2} [A-Z][a-z]+ · today$/)
    expect(screen.getByText('Free entry · you pick the time')).toBeInTheDocument()
    expect(screen.getByText('kcal still fits')).toBeInTheDocument()
    expect(screen.getByText('what you log now goes here')).toBeInTheDocument()
    expect(screen.getByText('Text, voice and photo in one draft. After the analysis you can still change the recognised items.')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'What did you eat?' })).toHaveAttribute('placeholder', 'e.g. a chicken wrap and a latte…')
    expect(screen.getByRole('button', { name: 'Analyse' })).toBeDisabled()
    expect(screen.getByRole('heading', { name: /Where do you add it from\?/ })).toBeInTheDocument()
    const ways = screen.getByRole('group', { name: 'Add' })
    expect([...ways.querySelectorAll('button')].map(b => b.textContent)).toEqual(['Photo', 'Pantry', 'Recipe', 'Usuals'])
    expect(screen.getByText('Take a photo of the plate')).toBeInTheDocument()
    expect(screen.getByText('Take a photo, or write what you ate straight away above.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  })

  it('the log page follows a language change at runtime, without a remount', () => {
    setLang('hu', { persist: false })
    mountLog()
    const heading = screen.getByRole('heading', { name: /Honnan adod hozzá\?/ })
    const field = screen.getByRole('textbox', { name: 'Mit ettél?' })
    expect(screen.getByTestId('frame-title')).toHaveTextContent('Ablakon kívül')
    act(() => setLang('en', { persist: false }))
    expect(screen.getByRole('heading', { name: /Where do you add it from\?/ })).toBe(heading)
    expect(screen.getByRole('textbox', { name: 'What did you eat?' })).toBe(field)
    expect(screen.getByTestId('frame-title')).toHaveTextContent('Between meals')
    expect(screen.getByRole('button', { name: 'Usuals' })).toBeInTheDocument()
  })

  it('the pantry picker: head, search, the category filter and the add buttons', async () => {
    mountLog()
    await userEvent.click(screen.getByRole('button', { name: 'Pantry' }))
    expect(await screen.findByRole('heading', { name: 'Pick from the shelf' })).toBeInTheDocument()
    expect(screen.getByText('Pantry · add')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search the pantry' })).toHaveAttribute('placeholder', 'Search the Pantry…')
    expect(screen.getByRole('group', { name: 'Category filter' })).toHaveTextContent('All')
    const add = screen.getAllByRole('button', { name: /^Add / })
    expect(add.length).toBeGreaterThan(0)
    // a picked line: the confirmation part in English
    await userEvent.click(add[0])
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.getByRole('heading', { name: /Items · 1/ })).toBeInTheDocument()
    expect(screen.getByText('pantry')).toBeInTheDocument()
    expect(screen.getByText(/^This (leaves|takes you) /)).toBeInTheDocument()
    expect(screen.getByText(/^Today so far .* · goal .* kcal · 1 item$/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /When did you eat\?/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'When did you eat?' })).toHaveTextContent(/Now · \d\d:\d\d/)
    expect(screen.getByText('tap if you ate at another time')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Add more/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log · +10 XP' })).toBeEnabled()
  })

  it('„What did you eat?" (the overlay): when, the three sources, a recipe line and its fine-tuning', async () => {
    const recipe = renderHook(() => useRecipes(), { wrapper: QueryWrapper }).result.current.recipes[0]
    render(<LogFlowPage prefill={{ source: 'recipe', recipeId: recipe.id }} onClose={vi.fn()} />, { wrapper: QueryWrapper })
    expect(screen.getByRole('dialog', { name: 'What did you eat?' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'What did you eat?' })).toBeInTheDocument()
    expect(screen.getByText(/^Log · today · \d\d:\d\d$/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^1\s*When$/ })).toBeInTheDocument()
    const when = screen.getByRole('group', { name: 'When' })
    expect([...when.querySelectorAll('button')].map(b => b.textContent)).toEqual(['Breakfast', 'Lunch', 'Dinner', 'Snack'])
    expect(screen.getByRole('button', { name: 'Pantry · add' })).toHaveTextContent('from the shelf, by gram')
    expect(screen.getByRole('button', { name: 'Recipe · add' })).toHaveTextContent('by serving')
    expect(screen.getByRole('button', { name: 'AI · photo or text' })).toBeInTheDocument()
    // the stored recipe name stays as it is; its tag, unit and controls are English
    expect(screen.getAllByText(recipe.name).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('recipe')).toBeInTheDocument()
    expect(screen.getByText('serving')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Remove ${recipe.name}` })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: `Amount of ${recipe.name}` })).toHaveValue('1')
    const tune = screen.getByRole('button', { name: 'Fine-tune the ingredients' })
    expect(tune).toHaveTextContent(`Ingredients · ${recipe.ingredients.length}`)
    expect(tune).toHaveTextContent('fine-tune')
    await userEvent.click(tune)
    expect(tune).toHaveTextContent('collapse')
    await userEvent.click(screen.getByRole('button', { name: 'AI · photo or text' }))
    expect(screen.getByText('Text, voice or photo, or all three. The recognised lines go among the items, where you can change everything.')).toBeInTheDocument()
    expect(screen.getByLabelText('Food photo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log · +10 XP' })).toBeEnabled()
  })

  it('editing a logged meal: the title, the time and the two-step delete', async () => {
    mountLog('/fuel/log/uj?edit=m1')
    expect(screen.getByTestId('frame-title')).toHaveTextContent('Edit')
    expect(await screen.findByRole('button', { name: 'Save changes' })).toBeInTheDocument()
    expect(screen.getByLabelText('When did you eat?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Delete it? It also comes off the day’s total.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Yes, delete it' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Keep it' })).toBeInTheDocument()
  })

  it('the meal ceremony: stars, the rating, the verdict, what went into the day, the two ways out', () => {
    render(
      <FuelMealCeremony scoreOutOfTen={8.3} mealLabel="Túrós zabkása" timeLabel="07:15" kcal={1689} proteinG={49} carbsG={74} fatG={21}
        onClose={vi.fn()} onDetails={vi.fn()} reducedMotion />,
    )
    expect(screen.getByRole('dialog', { name: 'Your meal is logged' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Now part of your day' })).toBeInTheDocument()
    expect(screen.getByText('Túrós zabkása · 07:15')).toBeInTheDocument()
    expect(screen.getByText('5 of five stars')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Mezo’s rating: 8.3 out of ten' })).toBeInTheDocument()
    expect(screen.getByText('A flawless choice.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /This went into your day/ })).toBeInTheDocument()
    expect(screen.getByText('1,689')).toBeInTheDocument()
    expect(screen.getByText('g protein')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to today' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Details' })).toBeInTheDocument()
  })
})
