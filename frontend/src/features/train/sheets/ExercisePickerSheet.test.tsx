import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, vi } from 'vitest'
import { ExercisePickerSheet } from '@/features/train/sheets/ExercisePickerSheet'
import { QueryWrapper } from '@/test/queryWrapper'

// Reads the static exerciseLibrary via useTrain, but the swapped hook calls
// useQuery — pin mock mode + provide a QueryClientProvider.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('renders the picker title', () => {
  render(<ExercisePickerSheet onClose={() => {}} onPick={() => {}} />, { wrapper: QueryWrapper })
  expect(screen.getByText('Mit pakolunk be?')).toBeInTheDocument()
})

test('search with no matches shows the empty-state copy', async () => {
  render(<ExercisePickerSheet onClose={() => {}} onPick={() => {}} />, { wrapper: QueryWrapper })
  await userEvent.type(screen.getByPlaceholderText('Keresés · pl. row, curl, press'), 'zzzz')
  expect(screen.getByText('Nincs találat ezzel a szűrővel.')).toBeInTheDocument()
})

test('plyo chip filters by type in real mode (API catalog)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false') // override the file-level mock pin
  render(<ExercisePickerSheet onClose={() => {}} onPick={() => {}} />, { wrapper: QueryWrapper })
  expect(await screen.findByText('Box Jump')).toBeInTheDocument()
  expect(screen.getByText('Hip Thrust')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Plyo' }))
  expect(screen.getByText('Box Jump')).toBeInTheDocument()
  expect(screen.queryByText('Hip Thrust')).not.toBeInTheDocument()
})

test('calf and core chips filter the API catalog by muscle', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  render(<ExercisePickerSheet onClose={() => {}} onPick={() => {}} />, { wrapper: QueryWrapper })
  await screen.findByText('Box Jump')
  await userEvent.click(screen.getByRole('button', { name: 'Vádli' }))
  expect(screen.getByText('Standing Calf Raise')).toBeInTheDocument()
  expect(screen.queryByText('Box Jump')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Core' }))
  expect(screen.getByText('Cable Crunch')).toBeInTheDocument()
})
