import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { TestViewSwitch } from './TestViewSwitch'

function Where() { return <output>{useLocation().pathname}</output> }

function renderAt(view: 'suly' | 'alvas') {
  return render(
    <MemoryRouter initialEntries={[view === 'suly' ? '/me/weight' : '/me/sleep']}>
      <Routes><Route path="*" element={<><TestViewSwitch view={view}><button>＋ Súly</button></TestViewSwitch><Where /></>} /></Routes>
    </MemoryRouter>,
  )
}

test('marks the current view and renders the action', () => {
  renderAt('suly')
  expect(screen.getByRole('button', { name: 'Súly' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Alvás' })).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByRole('button', { name: '＋ Súly' })).toBeInTheDocument()
})

test('switching replaces the route, so back does not ping-pong between the views', async () => {
  renderAt('suly')
  await userEvent.click(screen.getByRole('button', { name: 'Alvás' }))
  expect(screen.getByRole('status')).toHaveTextContent('/me/sleep')
})
