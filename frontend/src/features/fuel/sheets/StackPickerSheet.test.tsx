import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StackPickerSheet } from '@/features/fuel/sheets/StackPickerSheet'

test('filters the stash by query and toggles an item', async () => {
  const onToggle = vi.fn()
  render(<StackPickerSheet selectedIds={[]} onToggle={onToggle} onClose={() => {}} />)
  await userEvent.type(screen.getByPlaceholderText(/Keress a polcon/), 'kreatin')
  await userEvent.click(screen.getByText(/Kreatin/))
  expect(onToggle).toHaveBeenCalled()
})
