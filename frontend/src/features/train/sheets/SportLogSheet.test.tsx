import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NumberStep, SportLogSheet } from '@/features/train/sheets/SportLogSheet'

function setup() {
  const onClose = vi.fn()
  render(<SportLogSheet onClose={onClose} />)
  return { onClose }
}

test('renders the sport-log fields (volleyball default)', () => {
  setup()
  expect(screen.getByText('Sport log · Röpi')).toBeInTheDocument()
  expect(screen.getByText('Hogy ment?')).toBeInTheDocument()
  expect(screen.getByText('Idő · perc')).toBeInTheDocument()
  expect(screen.getByText('RPE · összesített nehézség')).toBeInTheDocument()
  expect(screen.getByText('Váll terhelés')).toBeInTheDocument()
})

test('Mentés closes the sheet', async () => {
  const { onClose } = setup()
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  // The Sheet dismisses with a slide-down animation, so onClose fires async.
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})

test('captures high shoulder strain without inventing personalized training advice', async () => {
  setup()
  // default shoulder 6 → baseline copy; raise to ≥7 via the scale grid
  // Folyadék: the scale is the kit's radio group of ten rising vessels, named by its label.
  const shoulder = within(screen.getByRole('radiogroup', { name: 'Váll terhelés' }))
  await userEvent.click(shoulder.getByRole('radio', { name: '8' }))
  expect(shoulder.getByRole('radio', { name: '8' })).toHaveAttribute('aria-checked', 'true')
  expect(screen.queryByText(/Overhead Press|Pull Day|heti ritmusodhoz képest/)).not.toBeInTheDocument()
})

test('Mentés passes the sheet values to onSave (house WeightLogSheet idiom)', async () => {
  const onClose = vi.fn()
  const onSave = vi.fn()
  render(<SportLogSheet onClose={onClose} onSave={onSave} />)
  // duration 90 -> 105 (+15 step), sets 5 -> 6, rpe -> 8, shoulder -> 7
  await userEvent.click(screen.getByRole('button', { name: 'Idő · perc növelése' }))
  await userEvent.click(screen.getByRole('button', { name: 'Setek · összesen növelése' }))
  await userEvent.click(within(screen.getByRole('radiogroup', { name: 'RPE · összesített nehézség' })).getByRole('radio', { name: '8' }))
  await userEvent.click(within(screen.getByRole('radiogroup', { name: 'Váll terhelés' })).getByRole('radio', { name: '7' }))
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  // Deferred close: onSave receives the payload + a `done` closer; the parent
  // calls done after the log succeeds (the spy here does not, so the sheet stays open).
  expect(onSave).toHaveBeenCalledWith(
    { sport: 'volleyball', duration: 105, setsPlayed: 6, rpe: 8, shoulderStrain: 7 },
    expect.any(Function),
  )
  expect(onClose).not.toHaveBeenCalled()
  // saving guard: the CTA disables on submit (prevents double-submit while in flight).
  expect(screen.getByRole('button', { name: /Mentés/ })).toBeDisabled()
})

// Contract bounds (review finding): the steppers must clamp so the sheet can
// never produce a payload the backend's @Valid rejects with a 400.
test('NumberStep clamps to min/max bounds', async () => {
  const onChange = vi.fn()
  const { rerender } = render(<NumberStep label="X" val={600} step={15} max={600} onChange={onChange} />)
  await userEvent.click(screen.getByRole('button', { name: 'X növelése' }))
  expect(onChange).toHaveBeenCalledWith(600) // ceiling holds
  rerender(<NumberStep label="X" val={15} step={15} min={15} max={600} onChange={onChange} />)
  await userEvent.click(screen.getByRole('button', { name: 'X csökkentése' }))
  expect(onChange).toHaveBeenLastCalledWith(15) // floor holds
})

test('NumberStep accepts direct keyboard entry and clamps to max on blur', async () => {
  const onChange = vi.fn()
  render(<NumberStep label="X" val={90} step={15} min={15} max={600} onChange={onChange} />)
  const input = screen.getByLabelText('X') as HTMLInputElement
  await userEvent.clear(input)
  await userEvent.type(input, '750')
  await userEvent.tab() // blur commits
  expect(onChange).toHaveBeenLastCalledWith(600) // typed value clamped to max
})

test('duration stepper never goes below 15 minutes', async () => {
  setup()
  const minus = screen.getByRole('button', { name: 'Idő · perc csökkentése' })
  for (let i = 0; i < 7; i++) await userEvent.click(minus) // 90 - 7×15 would be < 0
  // Folyadék: the kit's stepper (`.fo-stp`) with the typeable value between its two buttons.
  expect(minus.closest('.fo-stp')).not.toBeNull()
  expect(screen.getByLabelText('Idő · perc')).toHaveValue('15')
})

test('Mégse does not call onSave', async () => {
  const onClose = vi.fn()
  const onSave = vi.fn()
  render(<SportLogSheet onClose={onClose} onSave={onSave} />)
  await userEvent.click(screen.getByRole('button', { name: 'Mégse' }))
  expect(onSave).not.toHaveBeenCalled()
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})

test('defaults to a volleyball payload', async () => {
  const onSave = vi.fn()
  render(<SportLogSheet onClose={vi.fn()} onSave={onSave} />)
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave.mock.calls[0][0]).toEqual({ sport: 'volleyball', duration: 90, setsPlayed: 5, rpe: 7, shoulderStrain: 6 })
})

test('cross kind sends sport:cross + rounds, no volleyball fields', async () => {
  const onSave = vi.fn()
  render(<SportLogSheet onClose={vi.fn()} onSave={onSave} />)
  await userEvent.click(screen.getByRole('button', { name: 'Cross' }))
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  const body = onSave.mock.calls[0][0]
  expect(body.sport).toBe('cross')
  expect(body.rounds).toBeGreaterThan(0)
  expect(body.setsPlayed).toBeUndefined()
  expect(body.shoulderStrain).toBeUndefined()
})

test('trx kind sends sport:trx + rounds', async () => {
  const onSave = vi.fn()
  render(<SportLogSheet onClose={vi.fn()} onSave={onSave} />)
  await userEvent.click(screen.getByRole('button', { name: 'TRX' }))
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave.mock.calls[0][0].sport).toBe('trx')
})

test('initialSport preselects the kind', () => {
  render(<SportLogSheet initialSport="trx" onClose={vi.fn()} />)
  expect(screen.getByText('Sport log · TRX')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'TRX' })).toHaveAttribute('aria-pressed', 'true')
})

// mezo-9bbc (Task 9): a `date` prop is a retroactive ("Pótold") log — the body
// must carry that ISO date instead of leaving it for the server's "now" default.
test('a date prop is included in the saved body (retroactive log)', async () => {
  const onSave = vi.fn()
  render(<SportLogSheet date="2026-07-14" onClose={vi.fn()} onSave={onSave} />)
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave.mock.calls[0][0]).toEqual({ sport: 'volleyball', duration: 90, setsPlayed: 5, rpe: 7, shoulderStrain: 6, date: '2026-07-14' })
})

test('no date prop omits date from the body (today logs server-side default)', async () => {
  const onSave = vi.fn()
  render(<SportLogSheet onClose={vi.fn()} onSave={onSave} />)
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave.mock.calls[0][0]).not.toHaveProperty('date')
})

// Designed addition (mezo-d20.3.4): the contract's `notes` field had no sheet
// surfacing it before — a blank field omits `notes` entirely (never sends '').
test('empty notes are omitted from the saved body', async () => {
  const onSave = vi.fn()
  render(<SportLogSheet onClose={vi.fn()} onSave={onSave} />)
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave.mock.calls[0][0]).not.toHaveProperty('notes')
})

test('typed notes are trimmed and included in the saved body', async () => {
  const onSave = vi.fn()
  render(<SportLogSheet onClose={vi.fn()} onSave={onSave} />)
  await userEvent.type(screen.getByLabelText('Session jegyzet'), '  Jó session volt  ')
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave.mock.calls[0][0].notes).toBe('Jó session volt')
})

// Folyadék (mezo-n4wf5.3): the sheet is the light sheet with the kit head — the sport's own glyph,
// the three sports as pills — and none of the old capture-sheet skin.
test('the sheet wears the Folyadék sheet language', async () => {
  render(<SportLogSheet onClose={vi.fn()} initialSport="cross" />)
  const sheet = document.querySelector('.sheet.fo-sheet')!
  expect(sheet).not.toBeNull()
  expect(sheet.querySelector('.fo-shh use')?.getAttribute('href')).toBe('#t-crossfit')
  expect(within(screen.getByRole('group', { name: 'Sport típus' })).getAllByRole('button')).toHaveLength(3)
  expect(sheet.querySelector('.glass, [class*="capture-"], .stepper')).toBeNull()
  // cross asks rounds, not the volleyball shoulder scale
  expect(screen.queryByRole('radiogroup', { name: 'Váll terhelés' })).not.toBeInTheDocument()
  expect(screen.getByLabelText('Körök · összesen')).toHaveValue('6')
})
