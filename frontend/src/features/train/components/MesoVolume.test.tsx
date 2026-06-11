import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { activeMeso, MUSCLE_LABELS } from '@/data/train'

// Asserts Phase-1 mock meso data, so pin mock mode explicitly (the swapped
// useTrain hook reads useQuery, so a QueryClientProvider is required too).
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function renderBuilder() {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/train/mesocycles/${activeMeso.id}`],
  })
  return render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
}

test('Volumen view shows the recompute banner and per-muscle VolumeBars', async () => {
  renderBuilder()
  await userEvent.click(screen.getByRole('button', { name: 'Volumen' }))

  // Live recompute banner.
  expect(screen.getByText('Élő rendszer · 4 nappal ezelőtt frissítve')).toBeInTheDocument()
  // Provenance intro eyebrow.
  expect(screen.getByText('Honnan jönnek a számok?')).toBeInTheDocument()
  // A VolumeBar per muscle — chest renders the Hungarian label "Mell".
  expect(screen.getByText(MUSCLE_LABELS.chest)).toBeInTheDocument()
  // AI suggestion card.
  expect(screen.getByText('Mezo · javaslat')).toBeInTheDocument()
})

test('expanding the recompute banner reveals the audit log', async () => {
  renderBuilder()
  await userEvent.click(screen.getByRole('button', { name: 'Volumen' }))

  await userEvent.click(screen.getByRole('button', { name: /Recompute napló/ }))
  expect(screen.getByText(`Utolsó futás · ${activeMeso.volumeRecompute!.lastRun}`)).toBeInTheDocument()
  expect(screen.getByText(/3 izomcsoport értékei módosultak/)).toBeInTheDocument()
})
