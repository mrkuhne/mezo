import { render, screen, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecipeCard } from './RecipeCard'
import { useRecipes } from '@/data/hooks'

test('renders the recipe name, macros and Mezo fit; click opens', async () => {
  const { result } = renderHook(() => useRecipes())
  const recipe = result.current.recipes[0]
  const onOpen = vi.fn()
  render(<RecipeCard recipe={recipe} onOpen={onOpen} />)
  expect(screen.getByText(recipe.name)).toBeInTheDocument()
  expect(screen.getByText(/Mezo fit/)).toBeInTheDocument()
  await userEvent.click(screen.getByText(recipe.name))
  expect(onOpen).toHaveBeenCalledWith(recipe)
})
