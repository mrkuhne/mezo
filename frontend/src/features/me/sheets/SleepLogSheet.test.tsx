import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SleepLogSheet } from '@/features/me/sheets/SleepLogSheet'
import { QueryWrapper } from '@/test/queryWrapper'
import { userScopedKey } from '@/shared/lib/userScope'

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
    await screen.findByText('Mély') // review phase reached: the phase rail has rendered (mock resolves immediately)
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
    // read-only phase rail (replaces the old "fázisok: éber 52p · …" text strip, mezo-fk9a):
    // the awake segment still surfaces its minutes...
    expect(screen.getByText('Éber')).toBeInTheDocument()
    expect(screen.getByText('52p')).toBeInTheDocument()
    // ...and the tracker's own quality score keeps its own caption under the rail, since
    // PhaseRail has no slot for it.
    expect(screen.getByText(/Sleep Cycle minőség: 95%/)).toBeInTheDocument()
  })

  test('review hero shows the asleep duration that gets saved, not the bed span', async () => {
    renderSheet()
    await toReview()
    // hero = asleep duration (7.48, what saveShot persists), NOT the 00:42→09:03 bed span (8.3)
    expect(screen.getByText('7.48')).toBeInTheDocument()
    expect(screen.queryByText('8.3')).not.toBeInTheDocument()
    expect(screen.queryByText('8.4')).not.toBeInTheDocument()
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

  test('keeps the extracted phase fields when the user switches back to manual (leak fix, mezo-fk9a)', async () => {
    const { onSave } = renderSheet()
    await toReview() // switch to Screenshot, upload, land on the review step with a draft set

    // Set a distinctive date while the Dátum input is still on screen (it is shot-mode only).
    // This is the path discriminator: saveShot() sends this `date` state, whereas save()
    // stamps today via new Date() and ignores it entirely.
    fireEvent.change(screen.getByLabelText('Dátum'), { target: { value: '2026-01-15' } })

    // flip back to Kézi — this used to silently drop everything the AI just read
    await userEvent.click(screen.getByRole('button', { name: 'Kézi' }))

    // The component stamps the day at save time (`new Date().toISOString()`); reading the wall
    // clock a SECOND time in the assertion below made the test disagree with itself whenever
    // UTC midnight fell between the two reads (mezo-4jtz). Bracket the click instead: the
    // stamp must be one of the two days observed around it — a window that is a single day
    // except on the very run that straddles midnight, where both are legitimate.
    const utcDay = () => new Date().toISOString().slice(0, 10)
    const beforeSave = utcDay()
    await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
    const afterSave = utcDay()

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      deepMin: 100, lightMin: 206, remMin: 144, awakeMin: 52,
      sourceQualityPct: 95, source: 'screenshot',
      hypnogram: { bucketMin: 15, stages: 'ALDDLRRLDDLLRRRLDDLLRRLALDDLRRLRRR' },
      // the extracted ASLEEP duration rides along too — not the 8.3 bed span, which would
      // contradict phase minutes summing to 7.5h and inflate efficiency (mezo-fk9a)
      durationH: 7.48,
    }))
    // Proof the MANUAL branch ran: saveShot() would have sent the 2026-01-15 we just typed.
    expect([beforeSave, afterSave]).toContain(onSave.mock.calls[0][0].date)
    expect(onSave.mock.calls[0][0].date).not.toBe('2026-01-15')
  })
})

describe('night-trace prefill (mezo-d71m)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  const renderSheet = (onSave = vi.fn(), onClose = vi.fn()) => {
    render(<QueryWrapper><SleepLogSheet onClose={onClose} onSave={onSave} /></QueryWrapper>)
    return { onSave, onClose }
  }

  const today = new Intl.DateTimeFormat('en-CA').format(new Date())
  const KEY = userScopedKey(`night-wake:${today}`) // same value today (anon scope, no AuthGate here); derived so it self-corrects if that ever changes

  beforeEach(() => localStorage.clear())

  // The awakenings chips (0..4+) share number labels with the quality selector (1..10),
  // so scope the lookup to the labeled awakenings group to keep the query unambiguous.
  const awakeChip = (name: string) =>
    within(screen.getByRole('group', { name: 'Ébredések éjjel' })).getByRole('button', { name })

  test('prefills awakenings from the trace and shows the hint', () => {
    localStorage.setItem(KEY, JSON.stringify({ count: 2, lastAt: 'x' }))
    renderSheet()
    expect(screen.getByText(/Az éjjel 2× jártál az éjszakai módban/)).toBeInTheDocument()
    expect(awakeChip('2')).toHaveAttribute('aria-pressed', 'true')
  })

  test('clamps the prefill at 4', () => {
    localStorage.setItem(KEY, JSON.stringify({ count: 7, lastAt: 'x' }))
    renderSheet()
    expect(awakeChip('4+')).toHaveAttribute('aria-pressed', 'true')
  })

  test('no trace: default awakenings, no hint', () => {
    renderSheet()
    expect(screen.queryByText(/éjszakai módban/)).toBeNull()
    expect(awakeChip('1')).toHaveAttribute('aria-pressed', 'true')
  })

  test('saving clears the trace', () => {
    localStorage.setItem(KEY, JSON.stringify({ count: 1, lastAt: 'x' }))
    renderSheet()
    fireEvent.click(screen.getByRole('button', { name: /Mentés/ }))
    expect(localStorage.getItem(KEY)).toBeNull()
  })
})
