import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, test, vi } from 'vitest'
import { StrengthCurve, splitOnGaps } from '@/features/train/components/StrengthCurve'
import type { E1rmPoint } from '@/data/train/trainApi'

// „Az erőd íve" (Train parity P2 Task 5, mezo-lf3cv; Folyadék mezo-n4wf5.3). What this suite
// pins: the honest empty branches (0 and 1 points say different, true things and NEVER draw a
// flat line), the fact that NOTHING projected is drawn, the liquid area with its „now" mark and
// record drops, and the gap rule — `splitOnGaps` still finds the holes and the spoken label
// names them (the kit's area itself is one continuous surface).

/** `n` weekly points starting at `startIso`, skipping the 0-based indices in `skip`. */
function weekly(n: number, startIso = '2026-01-07', skip: readonly number[] = []): E1rmPoint[] {
  const [y, m, d] = startIso.split('-').map(Number)
  const out: E1rmPoint[] = []
  for (let i = 0; i < n; i++) {
    if (skip.includes(i)) continue
    const dt = new Date(Date.UTC(y, m - 1, d + i * 7))
    out.push({ date: dt.toISOString().slice(0, 10), e1rm: 80 + i })
  }
  return out
}

const area = (c: HTMLElement) => c.querySelector('svg.fo-area')
/** The curve's line: the one stroked, unfilled path of the area. */
const line = (c: HTMLElement) => c.querySelector('svg.fo-area > path[fill="none"]')!.getAttribute('d')!
/** Points on the line: the M plus one C per further point. */
const pointCount = (d: string) => 1 + (d.match(/C/g) ?? []).length

afterEach(() => vi.useRealTimers())

// A 52-point WEEKLY series spans a year by construction, so the curve's oldest date being a
// year old is the common case, not an edge one — and the hero above this component already
// states its own „óta" with the year (`huMonthDayAged`). „Szep 3 óta" in the caption under
// „2025. Szep 3 óta" in the hero would be the same date told two different ways on ONE screen.
test('the caption carries the YEAR on a date old enough to be misread', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 17))
  const { container } = render(
    <StrengthCurve points={[{ date: '2025-09-03', e1rm: 100 }, { date: '2026-09-01', e1rm: 120 }]} />,
  )
  expect(container.querySelector('.fo-ft')!.textContent).toContain('2025. Szep 3 óta')
  expect(screen.getByRole('img').getAttribute('aria-label')).toContain('2025. Szep 3 óta')
})

test('no points at all says so — and draws nothing', () => {
  const { container } = render(<StrengthCurve points={[]} />)
  expect(area(container)).toBeNull()
  expect(screen.getByText(/még nincs becsülhető maximumod/)).toBeInTheDocument()
  // …in the empty vessel
  expect(container.querySelector('.fo-ev')).not.toBeNull()
})

test('ONE point is a dot in prose, never a flat line through it', () => {
  const { container } = render(<StrengthCurve points={[{ date: '2026-05-19', e1rm: 130 }]} />)
  expect(container.querySelector('svg')).toBeNull()
  expect(screen.getByText(/Egyetlen becslésed van eddig/)).toBeInTheDocument()
  // The one measurement it does have is still named, date and value.
  expect(screen.getByText(/Máj 19 · 130 kg/)).toBeInTheDocument()
})

test('two points draw one liquid surface with the „now" mark on the last point', () => {
  const { container } = render(<StrengthCurve points={weekly(2)} />)
  expect(area(container)).not.toBeNull()
  expect(pointCount(line(container))).toBe(2)
  expect(container.querySelectorAll('.fo-area-now')).toHaveLength(1)
  // the mark carries the latest value
  expect(container.querySelector('.fo-area-now text')!.textContent).toBe('81')
  expect(container.querySelector('.fo-area-pr')).toBeNull()
})

test('a record drop stands on each point whose date holds an e1RM record; only the highest is captioned', () => {
  const pts = weekly(6)
  const { container } = render(<StrengthCurve points={pts} recordDates={[pts[1].date, pts[3].date, '1999-01-01']} />)
  const drops = container.querySelectorAll('.fo-area-pr')
  expect(drops).toHaveLength(2)
  expect(Array.from(drops).map((d) => d.querySelector('text')?.textContent ?? null)).toEqual([null, '83'])
})

test('a record on the LAST point is the „now" mark, not a second drop on top of it', () => {
  const pts = weekly(4)
  const { container } = render(<StrengthCurve points={pts} recordDates={[pts[3].date]} />)
  expect(container.querySelector('.fo-area-pr')).toBeNull()
  expect(container.querySelectorAll('.fo-area-now')).toHaveLength(1)
})

test('the liquid wears the muscle colour when the muscle is known', () => {
  const { container } = render(<StrengthCurve points={weekly(3)} muscle="back-mid" />)
  const stroke = container.querySelector('svg.fo-area > path[fill="none"]')!.getAttribute('stroke')!
  expect(stroke).not.toContain('--liq')
})

test('the projected branch is NOT drawn — there is no dashed line and no „várakozás" copy', () => {
  const { container } = render(<StrengthCurve points={weekly(8)} />)
  expect(container.querySelector('[stroke-dasharray="3 4"]')).toBeNull()
  expect(screen.queryByText(/várakozás/)).toBeNull()
  // …and the caption says what the line IS, plus names the estimate.
  expect(screen.getByText(/ami eddig megtörtént/)).toBeInTheDocument()
  expect(screen.getByText('becslés, nem mérés')).toBeInTheDocument()
})

test('the headline is the LATEST estimate („kg most"), not the best one', () => {
  const points: E1rmPoint[] = [
    { date: '2026-04-07', e1rm: 140 },
    { date: '2026-04-14', e1rm: 132.5 },
  ]
  const { container } = render(<StrengthCurve points={points} />)
  expect(container.querySelector('.fo-big')!.textContent).toBe('132,5kg most')
})

test('60 points render — the FE never re-caps what the wire already capped at 52', () => {
  const { container } = render(<StrengthCurve points={weekly(60)} />)
  expect(pointCount(line(container))).toBe(60)
})

describe('a gap reads as a gap', () => {
  it('finds the hole where the interval is out of character for the series', () => {
    // 10 weekly points with weeks 4 and 5 missing → a 21-day hole in a 7-day cadence.
    const segs = splitOnGaps(weekly(10, '2026-01-07', [4, 5]))
    expect(segs.map((x) => x.length)).toEqual([4, 4])
  })

  it('the surface keeps every measurement across the hole (the kit area does not break)', () => {
    const { container } = render(<StrengthCurve points={weekly(10, '2026-01-07', [4, 5])} />)
    expect(pointCount(line(container))).toBe(8)
  })

  it('a measurement stranded between two gaps is its own segment and stays on the surface', () => {
    const points: E1rmPoint[] = [
      { date: '2026-01-07', e1rm: 80 },
      { date: '2026-01-14', e1rm: 82 },
      { date: '2026-04-01', e1rm: 90 }, // alone between two long holes
      { date: '2026-07-01', e1rm: 95 },
      { date: '2026-07-08', e1rm: 96 },
    ]
    expect(splitOnGaps(points).map((x) => x.length)).toEqual([2, 1, 2])
    const { container } = render(<StrengthCurve points={points} />)
    expect(pointCount(line(container))).toBe(5)
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/2 kihagyott időszakkal/)
  })

  it('an even cadence is never broken up, however long the series', () => {
    expect(splitOnGaps(weekly(52))).toHaveLength(1)
    // Monthly measurements are „even" for THIS series — the rule is relative, not a
    // fixed number of days.
    const monthly = ['2026-01-05', '2026-02-05', '2026-03-05', '2026-04-05']
      .map((date, i) => ({ date, e1rm: 100 + i }))
    expect(splitOnGaps(monthly)).toHaveLength(1)
  })

  it('the accessible label names the breaks rather than hiding them', () => {
    render(<StrengthCurve points={weekly(10, '2026-01-07', [4, 5])} />)
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/1 kihagyott időszakkal/)
  })

  it('splitOnGaps is total: 0 and 1 points answer without throwing', () => {
    expect(splitOnGaps([])).toEqual([])
    expect(splitOnGaps([{ date: '2026-01-07', e1rm: 80 }])).toHaveLength(1)
  })
})

test('a perfectly flat series still draws (no divide-by-zero collapse)', () => {
  const flat: E1rmPoint[] = [
    { date: '2026-01-07', e1rm: 100 },
    { date: '2026-01-14', e1rm: 100 },
    { date: '2026-01-21', e1rm: 100 },
  ]
  const { container } = render(<StrengthCurve points={flat} />)
  expect(line(container)).not.toMatch(/NaN/)
})
