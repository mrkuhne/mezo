import { render } from '@testing-library/react'
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

test.each(['/today', '/train', '/fuel', '/me', '/insights'])('AppHero renders on %s', (path) => {
  renderAt(path)
  expect(document.querySelector('.apphero')).toBeInTheDocument()
})

test('the Insights entry point survives on /today', () => {
  renderAt('/today')
  expect(document.querySelector('a[aria-label="Insights"]')).toBeInTheDocument()
})
