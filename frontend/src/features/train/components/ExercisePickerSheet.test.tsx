import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, vi } from 'vitest'
import { ExercisePickerSheet } from './ExercisePickerSheet'
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
