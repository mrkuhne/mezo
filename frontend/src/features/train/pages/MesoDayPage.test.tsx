import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'

// Asserts Phase-1 mock meso data, so pin mock mode explicitly.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const MESO_ID = 'meso-hyp-04'

function setup(day = 'Csü', mesoId = MESO_ID) {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/train/mesocycles/${mesoId}/days/${encodeURIComponent(day)}`],
  })
  render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
  return router
}

test('the hero names the day, its type and its numbers', () => {
  setup()
  expect(screen.getByText('Pull nap')).toBeInTheDocument()
  // Csü · Pull: 16 working sets in the mock fixture; the week and the "next session"
  // promise ride along in the same sub line.
  expect(screen.getByText(/16 szett · ~\d+ perc · 3\. hét · a szerkesztés a következő edzéstől él/))
    .toBeInTheDocument()
})

test('per-muscle stat cells break the day down', () => {
  setup()
  const strip = document.querySelector('.mz-statstrip')!
  expect(strip.textContent).toContain('Hát')
  expect(strip.textContent).toContain('Bicepsz')
})

test('the editor edits ONE day — this day\'s exercises, not another day\'s', () => {
  setup()
  expect(screen.getByText('Chest Supported Row')).toBeInTheDocument() // Csü
  expect(screen.queryByText('Barbell Bench Press')).not.toBeInTheDocument() // Hét
  // A single day means no tab strip to switch with.
  expect(screen.queryByRole('button', { name: /^Hét · Push$/ })).not.toBeInTheDocument()
})

test('back lands on the run page', async () => {
  const router = setup()
  await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
  await waitFor(() => expect(router.state.location.pathname).toBe(`/train/mesocycles/${MESO_ID}`))
})

test('a day the block does not have says so instead of an empty editor', () => {
  setup('Vasárnap')
  expect(screen.getByText('Ez a nap nincs a blokkban.')).toBeInTheDocument()
})

// ── Real mode ────────────────────────────────────────────────────────────────
// The regression this pins: in real mode the block list is a fetch, and the page used to
// render „Ez a nap nincs a blokkban." for the whole in-flight window — a valid deep link
// (or a shared URL opened cold) flashed as a dead one before resolving.
describe('MesoDayPage (real mode)', () => {
  const REAL_MESO_ID = 'b6f3a0e2-0000-4000-8000-000000000001'

  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('a skeleton holds the page while the block is in flight — never a „nincs a blokkban" flash', async () => {
    setup('Csü', REAL_MESO_ID)
    expect(screen.getByRole('status', { name: 'Betöltés…' })).toBeInTheDocument()
    expect(screen.queryByText('Ez a nap nincs a blokkban.')).not.toBeInTheDocument()
    expect(screen.queryByText('Ez a mesociklus nem található.')).not.toBeInTheDocument()

    expect(await screen.findByText('Pull nap')).toBeInTheDocument()
    expect(screen.getByText('Chest Supported Row')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Betöltés…' })).not.toBeInTheDocument()
  })

  test('a RESOLVED block without the day is still a dead link, and says so', async () => {
    setup('Vas', REAL_MESO_ID)
    expect(await screen.findByText('Ez a nap nincs a blokkban.')).toBeInTheDocument()
  })

  test('an unknown block id resolves to the not-found ghost, not an endless skeleton', async () => {
    server.use(http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([])))
    setup('Csü', REAL_MESO_ID)
    expect(await screen.findByText('Ez a mesociklus nem található.')).toBeInTheDocument()
  })
})
