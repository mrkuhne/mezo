import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PeopleView } from './PeopleView'

test('renders the Kapcsolatok header', () => {
  render(<PeopleView />)
  expect(screen.getByRole('heading', { level: 1, name: /Kapcsolatok/ })).toBeInTheDocument()
})

test('renders all five people in the active circle', () => {
  render(<PeopleView />)
  for (const name of ['Petra', 'Bence', 'Ádám', 'Réka', 'Márk']) {
    expect(screen.getAllByText(name).length).toBeGreaterThan(0)
  }
})

test('mentions feed "Jelölt" filter narrows to flagged mentions', async () => {
  render(<PeopleView />)
  await userEvent.click(screen.getByText('Jelölt'))
  expect(screen.getAllByText('Réka').length).toBeGreaterThan(0)
})
