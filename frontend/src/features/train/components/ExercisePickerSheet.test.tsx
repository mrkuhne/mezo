import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExercisePickerSheet } from './ExercisePickerSheet'

test('renders the picker title', () => {
  render(<ExercisePickerSheet onClose={() => {}} onPick={() => {}} />)
  expect(screen.getByText('Mit pakolunk be?')).toBeInTheDocument()
})

test('search with no matches shows the empty-state copy', async () => {
  render(<ExercisePickerSheet onClose={() => {}} onPick={() => {}} />)
  await userEvent.type(screen.getByPlaceholderText('Keresés · pl. row, curl, press'), 'zzzz')
  expect(screen.getByText('Nincs találat ezzel a szűrővel.')).toBeInTheDocument()
})
