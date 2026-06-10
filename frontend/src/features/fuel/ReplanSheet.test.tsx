import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReplanSheet } from './ReplanSheet'

test('lists scenarios and shows the cascade for the selected one', () => {
  render(<ReplanSheet onClose={() => {}} />)
  expect(screen.getByText(/Replan · Mezo/)).toBeInTheDocument()
  expect(screen.getByText(/Cascade/)).toBeInTheDocument()
})

test('Alkalmazom transitions to the applied phase', async () => {
  render(<ReplanSheet onClose={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: /Alkalmazom/ }))
  expect(screen.getByText(/Megnézem/)).toBeInTheDocument()
})
