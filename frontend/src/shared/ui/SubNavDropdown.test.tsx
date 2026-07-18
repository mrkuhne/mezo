import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SubNavDropdown } from '@/shared/ui/SubNavDropdown'

const ITEMS = [
  { to: '/train', label: 'Mai', end: true },
  { to: '/train/gym', label: 'Gym' },
  { to: '/train/sport', label: 'Sport' },
]

const renderAt = (path: string, extra?: { label: string; onSelect: () => void }) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <SubNavDropdown label="Train alnavigáció" items={ITEMS} extraAction={extra} />
    </MemoryRouter>,
  )

test('closed: the chip shows the active item resolved from the URL, no menu', () => {
  renderAt('/train/gym')
  expect(screen.getByRole('button', { name: 'Gym' })).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('menu')).toBeNull()
})

test('index item (end:true) is active only on the exact path', () => {
  renderAt('/train')
  expect(screen.getByRole('button', { name: 'Mai' })).toBeInTheDocument()
})

test('open: lists every item as a menuitem, ✓ on the active one', async () => {
  renderAt('/train/gym')
  await userEvent.click(screen.getByRole('button', { name: 'Gym' }))
  const menu = screen.getByRole('menu')
  expect(menu).toBeInTheDocument()
  for (const label of ['Mai', 'Gym', 'Sport']) {
    expect(screen.getByRole('menuitem', { name: label })).toBeInTheDocument()
  }
  expect(screen.getByRole('menuitem', { name: 'Gym' })).toHaveClass('on')
})

test('selecting an item navigates and closes the menu', async () => {
  renderAt('/train/gym')
  await userEvent.click(screen.getByRole('button', { name: 'Gym' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Sport' }))
  expect(screen.queryByRole('menu')).toBeNull()
  expect(screen.getByRole('button', { name: 'Sport' })).toBeInTheDocument() // chip follows the route
})

test('Escape closes and returns focus to the chip', async () => {
  renderAt('/train/gym')
  await userEvent.click(screen.getByRole('button', { name: 'Gym' }))
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('menu')).toBeNull()
  expect(screen.getByRole('button', { name: 'Gym' })).toHaveFocus()
})

test('backdrop click closes the menu', async () => {
  renderAt('/train/gym')
  await userEvent.click(screen.getByRole('button', { name: 'Gym' }))
  await userEvent.click(screen.getByRole('button', { name: 'Bezárás' }))
  expect(screen.queryByRole('menu')).toBeNull()
})

test('extraAction renders after a separator and fires onSelect', async () => {
  const onSelect = vi.fn()
  renderAt('/train/gym', { label: 'Beállítások', onSelect })
  await userEvent.click(screen.getByRole('button', { name: 'Gym' }))
  expect(screen.getByRole('separator')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('menuitem', { name: 'Beállítások' }))
  expect(onSelect).toHaveBeenCalledOnce()
  expect(screen.queryByRole('menu')).toBeNull()
})
