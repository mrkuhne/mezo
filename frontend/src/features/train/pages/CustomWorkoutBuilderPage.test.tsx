import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { QueryWrapper } from '@/test/queryWrapper'
import { CustomWorkoutBuilderPage } from '@/features/train/pages/CustomWorkoutBuilderPage'
import { FrameProvider, useFrame } from '@/shared/ui/folyadek'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

// The page's title lives in the frame's title bar — this stands in for it.
function TitleProbe() {
  const f = useFrame()
  return <h1 data-testid="frame-title">{f.eyebrow} · {f.title}</h1>
}

const renderAt = (path: string) => render(
  <QueryWrapper>
    <MemoryRouter initialEntries={[path]}>
      <FrameProvider>
      <TitleProbe />
      <Routes>
        <Route path="/train/custom/new" element={<CustomWorkoutBuilderPage />} />
        <Route path="/train/custom/:id" element={<CustomWorkoutBuilderPage />} />
      </Routes>
      </FrameProvider>
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
  // The picked exercise lands as an OPEN ExerciseRecipeRow (its recipe steppers appear).
  expect(screen.getAllByText('Munka').length).toBeGreaterThan(0)
})

test('editing an existing custom workout prefills name + exercises', () => {
  renderAt('/train/custom/custom-1')
  expect(screen.getByLabelText('Edzés neve')).toHaveValue('Pihenőnapi felső')
  expect(screen.getByText('Incline DB Press')).toBeInTheDocument()
  expect(screen.getByText('Lateral Raise')).toBeInTheDocument()
})

// Reads the value shown by an ExerciseRecipeRow stepper — each is a name-scoped group
// (`${exerciseName} · ${field}`) holding − value +. A freshly picked exercise opens its own
// row (mezo-7ugb5), so the steppers are mounted right after the pick.
function stepperValue(exerciseName: string, field: string): string | null {
  return within(screen.getByRole('group', { name: `${exerciseName} · ${field}` })).getByText(/^\d+$|^auto$/).textContent
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

test('edit: rows start collapsed with a summary; tapping one opens it and closes the other', () => {
  renderAt('/train/custom/custom-1')
  // SortableList's drag handle + ▲▼ buttons also carry the exercise name — the row head is the
  // one with aria-expanded.
  const head = (name: RegExp) => screen.getAllByRole('button', { name }).find((b) => b.hasAttribute('aria-expanded'))!
  const lateral = head(/Lateral Raise/)
  expect(lateral).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(lateral)
  expect(lateral).toHaveAttribute('aria-expanded', 'true')
  const incline = head(/Incline DB Press/)
  fireEvent.click(incline)
  expect(incline).toHaveAttribute('aria-expanded', 'true')
  expect(lateral).toHaveAttribute('aria-expanded', 'false')
})

test('the hint names what is missing', () => {
  renderAt('/train/custom/new')
  expect(screen.getByText('Adj nevet az edzésnek.')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Edzés neve'), { target: { value: 'X' } })
  expect(screen.getByText('Adj hozzá legalább egy gyakorlatot.')).toBeInTheDocument()
})

test('an unknown id shows not-found instead of an empty new form', () => {
  renderAt('/train/custom/nincs-ilyen')
  expect(screen.getByText(/nem található/)).toBeInTheDocument()
  expect(screen.queryByLabelText('Edzés neve')).toBeNull()
})

test('new composer title and the empty lead', () => {
  renderAt('/train/custom/new')
  expect(screen.getByTestId('frame-title')).toHaveTextContent('Edzés · Új saját edzés')
  expect(screen.getByText(/Még nincs gyakorlat/)).toBeInTheDocument()
  // the empty vessel waits for the exercises; both actions sit on the hero's liquid row
  expect(screen.getByText('üres — ide töltődnek a gyakorlatok')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Indítás ma' })).toBeDisabled()
  expect(screen.getByRole('heading', { name: /Gyakorlatok · 0 gyakorlat · 0 szett/ })).toBeInTheDocument()
})

// Folyadék (mezo-n4wf5.3, prototype `sajat()`)
test('edit: the hero pours the workout into one vessel and the heading counts it', () => {
  const { container } = renderAt('/train/custom/custom-1')
  expect(screen.getByTestId('frame-title')).toHaveTextContent('Edzés · Saját edzés')
  expect(screen.getByText('Összerakod, amit ma csinálni akarsz.')).toBeInTheDocument()
  const layers = container.querySelectorAll('.fo-hero .fo-pour > i')
  expect(layers.length).toBe(container.querySelectorAll('.ee-ex').length)
  expect(screen.getByRole('heading', { name: new RegExp(`Gyakorlatok · ${layers.length} gyakorlat · \\d+ szett`) })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Mentés' })).toBeEnabled()
  expect(screen.queryByText(/Adj nevet|Adj hozzá/)).not.toBeInTheDocument()
  expect(screen.getByText(/Húzd a sorokat a sorrendhez/)).toBeInTheDocument()
  // the old skin is gone
  expect(container.querySelector('.glass, [class*="uvx-cw"], .uvs-primary')).toBeNull()
})
