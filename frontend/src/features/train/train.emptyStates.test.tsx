import { render, screen, waitFor } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

// T0 clean slate: real mode + empty backend must render ghost states — never
// crash and never show Phase-1 demo data. (server.resetHandlers runs globally
// in setup.ts, so the per-test overrides below don't leak.)
beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
  )
})
afterEach(() => vi.unstubAllEnvs())

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

test('TrainTodayView shows the ghost hero with a wizard CTA on an empty backend', async () => {
  renderApp('/train')
  await waitFor(() => expect(screen.getByText(/Itt fog élni a mai edzésed/i)).toBeInTheDocument())
  expect(screen.getByRole('button', { name: /tervezz mesociklust/i })).toBeInTheDocument()
})
