import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderAt = (path: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
}

test('the header dropdown chip shows the active Train sub-view', () => {
  renderAt('/train/sport')
  expect(screen.getByRole('button', { name: 'Sport' })).toHaveAttribute('aria-haspopup', 'menu')
  expect(document.querySelector('.np-pills')).toBeNull() // the pill row is gone
})

test('opening the dropdown lists all six Train sub-views', async () => {
  renderAt('/train/gym')
  await userEvent.click(screen.getByRole('button', { name: 'Gym' }))
  for (const label of ['Mai', 'Gym', 'Sport', 'Futás', 'Gyakorlatok', 'Mesociklusok']) {
    expect(screen.getByRole('menuitem', { name: label })).toBeInTheDocument()
  }
})
