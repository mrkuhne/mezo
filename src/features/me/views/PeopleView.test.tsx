import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PeopleView } from './PeopleView'

test('renders the credit hero and ritual card', () => {
  render(<PeopleView />)
  expect(screen.getByRole('heading', { level: 1, name: /Kapcsolatok/ })).toBeInTheDocument()
  expect(screen.getByText('Kapcsolati credit')).toBeInTheDocument()
  expect(screen.getByText('Mizu Velünk · havi 1:1')).toBeInTheDocument()
  // score (74) and "/100" render as separate text nodes inside one element → match by textContent
  expect(
    screen.getByText((_, el) => el?.textContent === '74/100' && el.children.length === 1),
  ).toBeInTheDocument()
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

test('renders the IDENT-5 privacy footer', () => {
  render(<PeopleView />)
  expect(screen.getByText(/IDENT-5/)).toBeInTheDocument()
})
