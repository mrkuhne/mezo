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

// Reads the numeric value shown by an ExerciseRecipeRow stepper. Anchored on the
// field's own "növelése" (increase) button, which carries a name-scoped
// `${exerciseName} · ${field}` aria-label — stable regardless of duplicate visible
// text elsewhere (e.g. the picker sheet still shows the same exercise name). The
// value <span> is the increase button's own row-sibling (see ExerciseRecipeRow's
// RecipeStepper: <div row>[<span value>, <div buttons>[dec, inc]]).
function stepperValue(exerciseName: string, field: string): string | null {
  const incBtn = screen.getByRole('button', { name: `${exerciseName} · ${field} növelése` })
  const valueSpan = incBtn.parentElement?.previousElementSibling
  return valueSpan?.textContent ?? null
}

test('mezo-szsi item 1: adding a plyo via the picker yields the fixed weightless PLYO scheme (3x5 RIR0, 0 warmup)', async () => {
  // The static mock exerciseLibrary (data/train/train.ts) carries no plyo fixture
  // (trainHooks.test.tsx pins its length at 21, all compound/isolation) — switch
  // to real mode for this test so the picker loads the msw API-catalog fixture,
  // which does have one ("Box Jump", quad/plyo, handlers.ts), same pattern as
  // ExercisePickerSheet.test.tsx's "plyo chip filters by type in real mode" test.
  vi.stubEnv('VITE_USE_MOCK', 'false')
  renderAt('/train/custom/new')
  fireEvent.click(screen.getByRole('button', { name: /Gyakorlat hozzáadása/ }))
  fireEvent.click(await screen.findByRole('button', { name: /Box Jump/ }))
  expect(stepperValue('Box Jump', 'Bemelegítő')).toBe('0')
  expect(stepperValue('Box Jump', 'Working')).toBe('3')
  expect(stepperValue('Box Jump', 'Rep min')).toBe('5')
  expect(stepperValue('Box Jump', 'Rep max')).toBe('5')
  expect(stepperValue('Box Jump', 'RIR')).toBe('0')
})

test('mezo-szsi item 1: a compound pick still gets the shared hypertrophy scheme (4x8-10 RIR1)', () => {
  renderAt('/train/custom/new')
  fireEvent.click(screen.getByRole('button', { name: /Gyakorlat hozzáadása/ }))
  // "Chest Supported Row" is a mock catalog compound fixture.
  fireEvent.click(screen.getByRole('button', { name: /Chest Supported Row/ }))
  expect(stepperValue('Chest Supported Row', 'Working')).toBe('4')
  expect(stepperValue('Chest Supported Row', 'Rep min')).toBe('8')
  expect(stepperValue('Chest Supported Row', 'Rep max')).toBe('10')
  expect(stepperValue('Chest Supported Row', 'RIR')).toBe('1')
})
