import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SportEventSheet } from '@/features/train/sheets/SportEventSheet'
import { localDateString } from '@/shared/lib/dates'

test('saves a volleyball event with the match default, today date and default time/length', async () => {
  const onSave = vi.fn()
  render(<SportEventSheet onSave={onSave} onClose={vi.fn()} />)

  expect(screen.getByRole('heading', { name: 'Új esemény' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave).toHaveBeenCalledWith(
    { date: localDateString(), time: '18:00', durationMin: 90, sport: 'volleyball', kind: 'match' },
    expect.any(Function),
  )
})

test('a cross event always saves kind training (the kind toggle hides)', async () => {
  const onSave = vi.fn()
  render(<SportEventSheet onSave={onSave} onClose={vi.fn()} />)

  await userEvent.click(screen.getByRole('button', { name: 'Cross' }))
  expect(screen.queryByRole('group', { name: 'Esemény típusa' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({ sport: 'cross', kind: 'training' }),
    expect.any(Function),
  )
})

test('the trimmed location joins the payload only when non-empty', async () => {
  const onSave = vi.fn()
  render(<SportEventSheet onSave={onSave} onClose={vi.fn()} />)

  await userEvent.type(screen.getByLabelText('Esemény helyszíne'), '  Kőbánya Sport  ')
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({ location: 'Kőbánya Sport' }),
    expect.any(Function),
  )
})
