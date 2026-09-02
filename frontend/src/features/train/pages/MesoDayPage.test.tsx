import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'

// Asserts Phase-1 mock meso data, so pin mock mode explicitly.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const MESO_ID = 'meso-hyp-04'

function setup(day = 'Csü') {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/train/mesocycles/${MESO_ID}/days/${encodeURIComponent(day)}`],
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
