import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { activeMeso } from '@/data/train'

// Asserts Phase-1 mock meso data, so pin mock mode explicitly (the swapped
// useTrain hook reads useQuery, so a QueryClientProvider is required too).
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

async function renderExercisesView() {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/train/mesocycles/${activeMeso.id}`],
  })
  render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Gyakorlatok' }))
}

test('Gyakorlatok view shows the weekly intro and day sections', async () => {
  await renderExercisesView()
  expect(screen.getByText('Heti gyakorlat-terv')).toBeInTheDocument()
  expect(screen.getByText('Heti szet-volumen')).toBeInTheDocument()
  // The current Csü Pull day renders its type.
  expect(screen.getByText('Pull')).toBeInTheDocument()
})

test('+ Gyakorlat hozzáadása opens the exercise picker', async () => {
  await renderExercisesView()
  // The current day is expanded by default → its add button is present.
  await userEvent.click(screen.getByRole('button', { name: /Gyakorlat hozzáadása/ }))
  expect(screen.getByText('Mit pakolunk be?')).toBeInTheDocument()
})

test('picking an exercise appends it to the open day', async () => {
  await renderExercisesView()
  await userEvent.click(screen.getByRole('button', { name: /Gyakorlat hozzáadása/ }))
  const dialog = screen.getByRole('dialog')
  // Pick the first library row (Chest Supported Row) from the picker.
  await userEvent.click(within(dialog).getByText('Hip Thrust'))
  // The Sheet dismisses with a slide-down animation, so it unmounts async.
  await waitFor(() => expect(screen.queryByText('Mit pakolunk be?')).not.toBeInTheDocument())
  // The new exercise now appears in the day list.
  expect(screen.getByText('Hip Thrust')).toBeInTheDocument()
})
