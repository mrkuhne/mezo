import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SleepLogSheet } from '@/features/me/sheets/SleepLogSheet'
import { QueryWrapper } from '@/test/queryWrapper'

test('Save bubbles up a SleepLogInput with computed duration then closes', async () => {
  const onSave = vi.fn()
  const onClose = vi.fn()
  render(<QueryWrapper><SleepLogSheet onClose={onClose} onSave={onSave} /></QueryWrapper>)
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({ bedtime: '23:00', wakeup: '06:30', durationH: 7.5, quality: 7, awakenings: 1 }),
  )
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})

test('includes inBedMin when the optional field is filled', async () => {
  const onSave = vi.fn()
  render(<QueryWrapper><SleepLogSheet onClose={vi.fn()} onSave={onSave} /></QueryWrapper>)
  await userEvent.type(screen.getByLabelText('Ágyban összesen (perc)'), '480')
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ inBedMin: 480 }))
})

describe('screenshot mode (mezo-66ab)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  const renderSheet = (onSave = vi.fn(), onClose = vi.fn()) => {
    render(<QueryWrapper><SleepLogSheet onClose={onClose} onSave={onSave} /></QueryWrapper>)
    return { onSave, onClose }
  }

  const toReview = async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Screenshot' }))
    const file = new File(['shot'], 'sleep.png', { type: 'image/png' })
    await userEvent.upload(screen.getByLabelText('Sleep Cycle screenshot'), file)
    await screen.findByText(/fázisok/i) // review phase reached (mock resolves immediately)
  }

  test('toggle shows the two modes and manual stays default', () => {
    renderSheet()
    expect(screen.getByRole('button', { name: 'Kézi' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Screenshot' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByLabelText('Lefekvés óra')).toBeInTheDocument() // manual inputs visible
  })

  test('extract prefills the review: exact times, duration, in-bed, derived quality 10', async () => {
    renderSheet()
    await toReview()
    expect(screen.getByLabelText('Lefekvés óra')).toHaveValue('0')
    expect(screen.getByLabelText('Lefekvés perc')).toHaveValue('42')
    expect(screen.getByLabelText('Ébredés óra')).toHaveValue('9')
    expect(screen.getByLabelText('Alvásidő (óra)')).toHaveValue(7.48)
    expect(screen.getByLabelText('Ágyban összesen (perc)')).toHaveValue(501)
    expect(screen.getByRole('button', { name: '10', pressed: true })).toBeInTheDocument() // 95% -> 10
    expect(screen.getByText(/éber 52p/)).toBeInTheDocument() // read-only phase row
    expect(screen.getByText(/95%/)).toBeInTheDocument()
  })

  test('save posts the full enriched payload with source screenshot and the edited date', async () => {
    const { onSave } = renderSheet()
    await toReview()
    fireEvent.change(screen.getByLabelText('Dátum'), { target: { value: '2026-07-20' } })
    await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      date: '2026-07-20', bedtime: '00:42', wakeup: '09:03', durationH: 7.48,
      inBedMin: 501, awakeMin: 52, lightMin: 206, remMin: 144, deepMin: 100,
      sourceQualityPct: 95, source: 'screenshot', quality: 10,
    }))
  })

  test('duplicate-date hint appears for a date that already has a log', async () => {
    renderSheet()
    await toReview()
    // mock seed's last entry is 2026-05-22
    fireEvent.change(screen.getByLabelText('Dátum'), { target: { value: '2026-05-22' } })
    expect(screen.getByText(/Erre a napra már van bejegyzés/)).toBeInTheDocument()
  })

  test('manual save payload has no screenshot fields (regression)', async () => {
    const { onSave } = renderSheet()
    await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ bedtime: '23:00', wakeup: '06:30' }))
    expect(onSave.mock.calls[0][0].source).toBeUndefined()
  })
})
