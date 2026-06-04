import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NewRecipeSheet } from './NewRecipeSheet'

test('Save is disabled until a name and an ingredient are added', async () => {
  render(<NewRecipeSheet onClose={() => {}} />)
  expect(screen.getByRole('button', { name: 'Mentés' })).toBeDisabled()
  await userEvent.type(screen.getByPlaceholderText(/Tonhalsaláta/), 'Teszt recept')
  await userEvent.click(screen.getByRole('button', { name: /Kamrából/ }))
  expect(await screen.findByText('Válassz hozzávalót')).toBeInTheDocument()
})
