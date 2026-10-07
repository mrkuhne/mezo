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

// final review: the two views are two routes, so a switch remounts the page — the keyboard
// focus must land on the new page's pressed segment instead of falling back to <body>.
// Two different components, like WeightPage and SleepPage: the route change really remounts.
const SulyPage = () => <TestViewSwitch view="suly" />
const AlvasPage = () => <TestViewSwitch view="alvas" />

function renderBothViews(start: '/me/weight' | '/me/sleep') {
  return render(
    <MemoryRouter initialEntries={[start]}>
      <Routes>
        <Route path="/me/weight" element={<SulyPage />} />
        <Route path="/me/sleep" element={<AlvasPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

test('after a switch the pressed segment of the new view holds the focus', async () => {
  renderBothViews('/me/weight')
  const old = screen.getByRole('button', { name: 'Alvás' })
  await userEvent.click(old)
  const pressed = screen.getByRole('button', { name: 'Alvás' })
  expect(pressed).not.toBe(old) // the page really remounted
  expect(pressed).toHaveAttribute('aria-pressed', 'true')
  expect(pressed).toHaveFocus()
})

test('a plain arrival (tab bar, deep link) does not steal the focus', () => {
  renderBothViews('/me/sleep')
  expect(screen.getByRole('button', { name: 'Alvás' })).not.toHaveFocus()
  expect(document.body).toHaveFocus()
})
