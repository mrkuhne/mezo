import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'

function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
}

test('Insights opens on Patterns and the page title tracks the active sub-tab', async () => {
  renderApp('/insights')
  expect(screen.getByRole('heading', { level: 1, name: 'Patterns' })).toBeInTheDocument()
  expect(await screen.findByText('Új minták · 3')).toBeInTheDocument() // real mode fetches (V3.1)

  await userEvent.click(screen.getByRole('link', { name: 'Memoir' }))
  expect(screen.getByRole('heading', { level: 1, name: 'Memoir' })).toBeInTheDocument()
  expect(screen.getByText('Egy hét amikor a tested megtanult várni')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('link', { name: 'Chat' }))
  expect(screen.getByPlaceholderText('Mondj valamit...')).toBeInTheDocument()
})
