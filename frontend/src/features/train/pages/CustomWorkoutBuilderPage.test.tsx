import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { QueryWrapper } from '@/test/queryWrapper'
import { CustomWorkoutBuilderPage } from '@/features/train/pages/CustomWorkoutBuilderPage'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderAt = (path: string) => render(
  <QueryWrapper>
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/train/custom/new" element={<CustomWorkoutBuilderPage />} />
        <Route path="/train/custom/:id" element={<CustomWorkoutBuilderPage />} />
      </Routes>
    </MemoryRouter>
  </QueryWrapper>,
)

test('new composer: save disabled until name + at least one exercise', () => {
  renderAt('/train/custom/new')
  const save = screen.getByRole('button', { name: 'Mentés' })
  expect(save).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Edzés neve'), { target: { value: 'Vasárnapi push' } })
  expect(save).toBeDisabled() // still no exercise
})

test('the picker adds a catalog exercise as a recipe row', () => {
  renderAt('/train/custom/new')
  fireEvent.click(screen.getByRole('button', { name: /Gyakorlat hozzáadása/ }))
  // ExercisePickerSheet lists the mock exercise library; pick the first row.
  // Note (verify-point): the row button carries no aria-label — its accessible
  // name is its text content (name + muscle label + type + the "STIM" caption,
  // and only the *picked* row transiently gains "Hozzáadva ✓" via flashId). The
  // brief's guessed `/hozzáadása$/` selector doesn't match anything real here;
  // "STIM" is present on every row and unique from the sheet's "Kész"/"Bezárás"
  // buttons, so it reliably targets a catalog row without depending on flash state.
  fireEvent.click(screen.getAllByRole('button', { name: /STIM/ })[0])
  // The picked exercise lands as an ExerciseRecipeRow (recipe steppers appear).
  expect(screen.getAllByText('Work').length).toBeGreaterThan(0)
})

test('editing an existing custom workout prefills name + exercises', () => {
  renderAt('/train/custom/custom-1')
  expect(screen.getByLabelText('Edzés neve')).toHaveValue('Pihenőnapi felső')
  expect(screen.getByText('Incline DB Press')).toBeInTheDocument()
  expect(screen.getByText('Lateral Raise')).toBeInTheDocument()
})
