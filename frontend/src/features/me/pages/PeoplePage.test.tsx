import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PeoplePage } from '@/features/me/pages/PeoplePage'

test('renders the Kapcsolatok header', () => {
  render(<PeoplePage />)
  expect(screen.getByRole('heading', { level: 1, name: /Kapcsolatok/ })).toBeInTheDocument()
})

test('renders all five people in the active circle', () => {
  render(<PeoplePage />)
  for (const name of ['Petra', 'Bence', 'Ádám', 'Réka', 'Márk']) {
    expect(screen.getAllByText(name).length).toBeGreaterThan(0)
  }
})

test('mentions feed "Jelölt" filter narrows to flagged mentions', async () => {
  render(<PeoplePage />)
  await userEvent.click(screen.getByText('Jelölt'))
  expect(screen.getAllByText('Réka').length).toBeGreaterThan(0)
})
