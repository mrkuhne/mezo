import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { MedalsPage } from '@/features/train/pages/MedalsPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { huMonthDay, huMonthDayDow, localDateString } from '@/shared/lib/dates'
import type { Medal } from '@/data/train/medalTypes'

// Real-mode view: medals come from the MSW fixture unless a test overrides it.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
afterEach(() => vi.unstubAllEnvs())

const renderView = () =>
  render(<QueryWrapper><MemoryRouter><MedalsPage /></MemoryRouter></QueryWrapper>)

test('the hero names the page and says the count and the share of this month as its verdict', async () => {
  const { container } = renderView()
  // 3 in the default fixture, all of them earlier than this month.
  expect(await screen.findByText('3 medál, ebből 0 e hónapban.')).toBeInTheDocument()
  expect(screen.getByText('Medálok')).toHaveClass('fo-hero-lbl')
  // the shelf: one drop per medal, none of them this month's
  expect(container.querySelectorAll('.er-shelf i')).toHaveLength(3)
  expect(container.querySelectorAll('.er-shelf i.new')).toHaveLength(0)
  expect(container.querySelector('.fo-lg')!.textContent).toBe('0 e hónapban3 korábbról')
})

test('the counter chip + honest backfill line render alongside the cabinet', async () => {
  renderView()
  // 3 in the default fixture (mezo-wp6n handlers): WEIGHT + TARGET_HIT + SESSION_VOLUME.
  expect(await screen.findByText('3 medál')).toBeInTheDocument()
  expect(
    screen.getByText(/visszamenőleg.*korábban logolt szetteid alapján/),
  ).toBeInTheDocument()
})

// Three medals from the default fixture (mezo-wp6n handlers): a RECORD (Chest
// Supported Row, 2026-06-02, previousDate set), a TARGET_HIT (Hip Thrust,
// 2026-06-01, no previous* at all), and a SESSION_VOLUME RECORD (Leg Press,
// 2026-06-05, carrying the session's top set in weightKg/reps).
test('the default fixture groups by date with exercise names + type labels under their date heading', async () => {
  renderView()
  const recordHeading = await screen.findByText(new RegExp(huMonthDayDow('2026-06-02')))
  const targetHeading = screen.getByText(new RegExp(huMonthDayDow('2026-06-01')))
  const volumeHeading = screen.getByText(new RegExp(huMonthDayDow('2026-06-05')))
  expect(recordHeading).toBeInTheDocument()
  expect(targetHeading).toBeInTheDocument()
  expect(volumeHeading).toBeInTheDocument()
  expect(screen.getByText('Chest Supported Row')).toBeInTheDocument()
  expect(screen.getByText('Súly-rekord')).toBeInTheDocument()
  expect(screen.getByText('Hip Thrust')).toBeInTheDocument()
  expect(screen.getByText('Cél teljesítve')).toBeInTheDocument()
  expect(screen.getByText('Leg Press')).toBeInTheDocument()
  expect(screen.getByText('Volumen-rekord')).toBeInTheDocument()
})

test('RECORD is the gold capsule with the old record as its line, TARGET_HIT the green capsule with none', async () => {
  const { container } = renderView()
  await screen.findByText('Chest Supported Row')
  // Folyadék (mezo-n4wf5.3): the tier rides the visible REKORD / CÉL tag and the capsule.
  const recordRow = screen.getByText('Chest Supported Row').closest('.er-medal') as HTMLElement
  const targetRow = screen.getByText('Hip Thrust').closest('.er-medal') as HTMLElement
  expect(recordRow).toHaveAttribute('data-tier', 'RECORD')
  expect(targetRow).toHaveAttribute('data-tier', 'TARGET')
  expect(within(recordRow).getByText('REKORD')).toHaveClass('fo-st', 'warn')
  expect(within(targetRow).getByText('CÉL')).toHaveClass('fo-st', 'ok')
  const recordCap = recordRow.querySelector('.ex-rc') as HTMLElement
  const targetCap = targetRow.querySelector('.ex-rc') as HTMLElement
  // the dashed line of the beaten record stands inside the RECORD capsule only
  expect(recordCap.querySelector('u')).not.toBeNull()
  expect(targetCap.querySelector('u')).toBeNull()
  expect(targetCap.style.getPropertyValue('--c')).toBe('var(--fo-ok)')
  expect(recordCap.style.getPropertyValue('--c')).not.toBe(targetCap.style.getPropertyValue('--c'))
  // no text glyph survives anywhere on the page
  expect(container.textContent).not.toMatch(/🏅|✓/)
})

test('the cabinet is kit rows in a white card — no glass, no old skin', async () => {
  const { container } = renderView()
  await screen.findByText('Chest Supported Row')
  const rows = Array.from(container.querySelectorAll('.er-medal'))
  expect(rows.length).toBe(3)
  for (const row of rows) {
    expect(row).toHaveClass('fo-row')
    expect(row.closest('.fo-card')).not.toBeNull()
  }
  expect(container.querySelector('.glass, .mz-facttile, [class*="gyx-"], [class*="uv-"]')).toBeNull()
})

// The regression case for mezo-wp6n Finding 1: a real-mode SESSION_VOLUME medal
// carries weightKg/reps (the session's top set) but must still headline the
// session volume, not `weightKg × reps` — that would show one set's load next to
// a "previous" that is itself a volume, and read as an indistinguishable WEIGHT row.
test('a SESSION_VOLUME medal with weightKg/reps still headlines the volume, not the set', async () => {
  renderView()
  const row = (await screen.findByText('Leg Press')).closest('.er-medal') as HTMLElement
  expect(within(row).getByText('820 kg')).toBeInTheDocument()
  expect(within(row).queryByText(/102,5 kg × 8/)).not.toBeInTheDocument()
  expect(within(row).getByText(/Előző: 800 kg/)).toBeInTheDocument()
})

test('a TARGET_HIT medal never renders a previous-value slot (nothing was beaten)', async () => {
  renderView()
  const row = (await screen.findByText('Hip Thrust')).closest('.er-medal') as HTMLElement
  expect(within(row).queryByText(/Előző/)).not.toBeInTheDocument()
})

describe('grouping + null previousDate (mezo-wp6n Task 10)', () => {
  const customMedals: Medal[] = [
    // 2026-07-01: TARGET_HIT logged before the RECORD in the source order — the
    // cabinet must keep that order (chronological record), NOT re-sort RECORD-first
    // the way WorkoutSummary does for a single session's recap.
    {
      type: 'TARGET_HIT', tier: 'TARGET', exerciseName: 'Row Machine',
      date: '2026-07-01', setIndex: 1, value: 10, unit: 'REPS', weightKg: 60, reps: 10,
      previousValue: null, previousDate: null,
    },
    // A RECORD medal with a previousValue but NO previousDate — the mock-mode shape
    // (medalEvaluator.ts) the "…óta állt" phrasing must drop cleanly for.
    {
      type: 'WEIGHT', tier: 'RECORD', exerciseName: 'Squat',
      date: '2026-07-01', setIndex: 2, value: 140, unit: 'KG', weightKg: 140, reps: 5,
      previousValue: 135, previousDate: null,
    },
    // 2026-07-10 (newer): a RECORD medal WITH a previousDate.
    {
      type: 'E1RM', tier: 'RECORD', exerciseName: 'Bench Press',
      date: '2026-07-10', setIndex: 3, value: 150, unit: 'KG', weightKg: 130, reps: 5,
      previousValue: 145, previousDate: '2026-06-20',
    },
  ]

  beforeEach(() => {
    server.use(
      http.get(`${API_BASE}/api/train/medals`, () => HttpResponse.json({ medals: customMedals })),
    )
  })

  test('newest date group renders first, older date group after', async () => {
    const { container } = renderView()
    await screen.findByText('Bench Press')
    const cards = Array.from(container.querySelectorAll('.er-medal'))
    const names = cards.map((c) => c.textContent)
    const benchIdx = names.findIndex((t) => t?.includes('Bench Press'))
    const rowIdx = names.findIndex((t) => t?.includes('Row Machine'))
    const squatIdx = names.findIndex((t) => t?.includes('Squat'))
    expect(benchIdx).toBeGreaterThanOrEqual(0)
    // newest-first grouping: the 2026-07-10 row precedes both 2026-07-01 rows
    expect(benchIdx).toBeLessThan(rowIdx)
    expect(benchIdx).toBeLessThan(squatIdx)
    // within 2026-07-01, the server order (TARGET_HIT then RECORD) is kept —
    // no re-sort to put the RECORD row first.
    expect(rowIdx).toBeLessThan(squatIdx)
  })

  test('a RECORD medal with previousValue but null previousDate drops the date cleanly', async () => {
    renderView()
    const row = (await screen.findByText('Squat')).closest('.er-medal') as HTMLElement
    expect(within(row).getByText(/Előző: 135 kg/)).toBeInTheDocument()
    // never a dangling "null"/"undefined" or trailing separator
    expect(row.textContent).not.toMatch(/null|undefined/i)
    expect(within(row).queryByText(/óta állt/)).not.toBeInTheDocument()
  })

  test('a RECORD medal WITH a previousDate renders the "…óta állt" phrasing', async () => {
    renderView()
    const row = (await screen.findByText('Bench Press')).closest('.er-medal') as HTMLElement
    expect(within(row).getByText(new RegExp(`Előző: 145 kg · ${huMonthDay('2026-06-20')} óta állt`))).toBeInTheDocument()
  })
})

test('empty cabinet: an honest single line, no ghost rows, no counter chip, no backfill note', async () => {
  server.use(
    http.get(`${API_BASE}/api/train/medals`, () => HttpResponse.json({ medals: [] })),
  )
  const { container } = renderView()
  expect(
    await screen.findByText('Még nincs medálod — az első megdöntött rekord ide kerül.'),
  ).toBeInTheDocument()
  expect(screen.getByText('Medálok')).toBeInTheDocument()
  expect(container.querySelectorAll('.er-medal').length).toBe(0)
  // the empty vessel in the hero, and the verdict says it too
  expect(container.querySelector('.fo-hero .fo-ev')).not.toBeNull()
  expect(screen.getByText('Még nincs medálod.')).toHaveClass('fo-hero-verdict')
  expect(container.querySelector('.fo-sec')).toBeNull()
  expect(screen.queryByText(/medál$/)).not.toBeInTheDocument()
  expect(screen.queryByText(/visszamenőleg/)).not.toBeInTheDocument()
})

describe('MedalsPage (real mode, pending)', () => {
  it('shows a skeleton while the query is unresolved — never the seed', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/medals`, () => new Promise(() => {})),
    )
    renderView()
    expect(await screen.findByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('Chest Supported Row')).not.toBeInTheDocument()
  })
})

describe('MedalsPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  it('renders the seeded cabinet synchronously — no skeleton', () => {
    renderView()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByText('8 medál')).toBeInTheDocument()
  })

  it('groups the seeded cabinet by date, newest first', () => {
    const { container } = renderView()
    const cards = Array.from(container.querySelectorAll('.er-medal'))
    const names = cards.map((c) => c.textContent ?? '')
    // 2026-07-27 (Hammer Curl E1RM + TARGET_HIT) is the newest date in the seed —
    // it must render before 2026-06-15 (the oldest Hammer Curl WEIGHT medal).
    const newestIdx = names.findIndex((t) => t.includes('1RM-rekord') && t.includes('Hammer Curl'))
    const oldestIdx = names.findIndex((t) => t.includes('Súly-rekord') && t.includes('Hammer Curl'))
    expect(newestIdx).toBeGreaterThanOrEqual(0)
    expect(oldestIdx).toBeGreaterThanOrEqual(0)
    expect(newestIdx).toBeLessThan(oldestIdx)
  })
})

// Folyadék (mezo-n4wf5.3): the cabinet is two numbered cards — this month and earlier.
describe('E hónapban / Korábbról', () => {
  const today = localDateString()
  const split: Medal[] = [
    {
      type: 'WEIGHT', tier: 'RECORD', exerciseName: 'Squat',
      date: today, setIndex: 1, value: 140, unit: 'KG', weightKg: 140, reps: 5,
      previousValue: 135, previousDate: null,
    },
    {
      type: 'E1RM', tier: 'RECORD', exerciseName: 'Bench Press',
      date: '2025-01-10', setIndex: 3, value: 150, unit: 'KG', weightKg: 130, reps: 5,
      previousValue: 145, previousDate: '2024-12-20',
    },
  ]

  test('a medal of this month sits in card 1, the rest in card 2; the capsule note is said once', async () => {
    server.use(http.get(`${API_BASE}/api/train/medals`, () => HttpResponse.json({ medals: split })))
    const { container } = renderView()
    expect(await screen.findByText('2 medál, ebből 1 e hónapban.')).toBeInTheDocument()
    const heads = Array.from(container.querySelectorAll('.fo-sec')).map((h) => h.textContent)
    expect(heads).toEqual(['1E hónapban', '2Korábbról'])
    const cards = container.querySelectorAll('.fo-card:not(.fo-hero)')
    expect(within(cards[0] as HTMLElement).getByText('Squat')).toBeInTheDocument()
    expect(within(cards[1] as HTMLElement).getByText('Bench Press')).toBeInTheDocument()
    expect(screen.getAllByText(/A kapszulán a vonal a régi rekord/)).toHaveLength(1)
    expect(container.querySelectorAll('.er-shelf i.new')).toHaveLength(1)
  })

  test('with nothing this month only „Korábbról" stands, numbered 1', async () => {
    const { container } = renderView()
    await screen.findByText('3 medál')
    expect(Array.from(container.querySelectorAll('.fo-sec')).map((h) => h.textContent)).toEqual(['1Korábbról'])
    expect(screen.getByText(/A kapszulán a vonal a régi rekord/)).toBeInTheDocument()
  })
})
