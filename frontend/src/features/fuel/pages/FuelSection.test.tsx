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

test('the header dropdown lists all six Fuel sub-views', async () => {
  renderAt('/fuel/stack')
  await userEvent.click(screen.getByRole('button', { name: 'Stack' }))
  for (const label of ['Mai', 'Terv', 'Stack', 'Receptek', 'Kamra', 'Gyógyszer']) {
    expect(screen.getByRole('menuitem', { name: label })).toBeInTheDocument()
  }
  expect(document.querySelector('.np-pills')).toBeNull()
})
