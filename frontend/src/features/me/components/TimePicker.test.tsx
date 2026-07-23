import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TimePicker } from '@/features/me/components/TimePicker'

test('changing the hour select emits HH:MM', async () => {
  const onChange = vi.fn()
  render(<TimePicker label="Lefekvés" val="23:00" onChange={onChange} hours={[22, 23, 0, 1]} />)
  await userEvent.selectOptions(screen.getByLabelText('Lefekvés óra'), '22')
  expect(onChange).toHaveBeenCalledWith('22:00')
})

describe('TimePicker value-outside-list tolerance', () => {
  it('renders an out-of-list value exactly (00:42 with hours=[22,23,0,1])', () => {
    render(<TimePicker label="Lefekvés" val="00:42" onChange={vi.fn()} hours={[22, 23, 0, 1]} />)
    expect(screen.getByLabelText('Lefekvés óra')).toHaveValue('0')
    expect(screen.getByLabelText('Lefekvés perc')).toHaveValue('42')
  })

  it('keeps the plain lists when the value is in-list (manual mode unchanged)', async () => {
    const onChange = vi.fn()
    render(<TimePicker label="Ébredés" val="06:30" onChange={onChange} hours={[5, 6, 7, 8]} />)
    const minute = screen.getByLabelText('Ébredés perc')
    expect(Array.from((minute as HTMLSelectElement).options).map(o => o.value)).toEqual(['0', '30'])
    await userEvent.selectOptions(minute, '0')
    expect(onChange).toHaveBeenCalledWith('06:00')
  })
})
