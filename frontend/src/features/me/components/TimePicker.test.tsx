import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TimePicker } from '@/features/me/components/TimePicker'

test('changing the hour select emits HH:MM', async () => {
  const onChange = vi.fn()
  render(<TimePicker label="Lefekvés" val="23:00" onChange={onChange} hours={[22, 23, 0, 1]} />)
  await userEvent.selectOptions(screen.getByLabelText('Lefekvés óra'), '22')
  expect(onChange).toHaveBeenCalledWith('22:00')
})
