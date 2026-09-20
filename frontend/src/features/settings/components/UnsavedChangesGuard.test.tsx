import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, Link } from 'react-router-dom'
import { expect, test } from 'vitest'
import { UnsavedChangesGuard } from '@/features/settings/components/UnsavedChangesGuard'

test('allows staying or explicitly discarding changes on navigation', async () => {
  const router = createMemoryRouter([{ path: '/', element: <><UnsavedChangesGuard dirty /><Link to="/other">Másik oldal</Link></> }, { path: '/other', element: <p>Megérkeztél</p> }])
  render(<RouterProvider router={router} />)
  await userEvent.click(screen.getByText('Másik oldal'))
  expect(screen.getByText('Nem mentett módosítások')).toBeInTheDocument()
  await userEvent.click(screen.getByText('Maradok, folytatom'))
  expect(router.state.location.pathname).toBe('/')
  await userEvent.click(screen.getByText('Másik oldal'))
  await userEvent.click(screen.getByText('Elvetem, kilépek'))
  expect(await screen.findByText('Megérkeztél')).toBeInTheDocument()
})
