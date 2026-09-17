import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, test, vi } from 'vitest'
import { StrengthCurve, splitOnGaps } from '@/features/train/components/StrengthCurve'
import type { E1rmPoint } from '@/data/train/trainApi'

// „Az erőd íve" (Train parity P2 Task 5, mezo-lf3cv). The three things this suite is
// actually here to pin: the honest empty branches (0 and 1 points say different, true
// things and NEVER draw a flat line), the fact that NOTHING projected is drawn, and the
// gap rule — Task 2's wire OMITS a session with no eligible set, so the line must not
// cross the hole as if the weeks had been continuous.

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

const polylines = (c: HTMLElement) => Array.from(c.querySelectorAll('polyline'))
const pointCount = (el: Element) => el.getAttribute('points')!.trim().split(/\s+/).length

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
  expect(container.querySelector('.gy-curve-cap')!.textContent).toContain('2025. Szep 3 óta')
  expect(container.querySelector('svg')!.getAttribute('aria-label')).toContain('2025. Szep 3 óta')
})

test('no points at all says so — and draws nothing', () => {
  const { container } = render(<StrengthCurve points={[]} />)
  expect(container.querySelector('svg')).toBeNull()
  expect(screen.getByText(/még nincs becsülhető maximumod/)).toBeInTheDocument()
})

test('ONE point is a dot in prose, never a flat line through it', () => {
  const { container } = render(<StrengthCurve points={[{ date: '2026-05-19', e1rm: 130 }]} />)
  expect(container.querySelector('svg')).toBeNull()
  expect(container.querySelector('polyline')).toBeNull()
  expect(screen.getByText(/Egyetlen becslésed van eddig/)).toBeInTheDocument()
  // The one measurement it does have is still named, date and value.
  expect(screen.getByText(/Máj 19 · 130 kg/)).toBeInTheDocument()
})

test('two points draw one solid line and the „now" dot', () => {
  const { container } = render(<StrengthCurve points={weekly(2)} />)
  const lines = polylines(container)
  expect(lines).toHaveLength(1)
  expect(lines[0].getAttribute('class')).toBe('gy-curve-was')
  expect(pointCount(lines[0])).toBe(2)
  expect(container.querySelectorAll('circle.gy-curve-now')).toHaveLength(1)
})

test('the projected branch is NOT drawn — there is no dashed line and no „várakozás" copy', () => {
  const { container } = render(<StrengthCurve points={weekly(8)} />)
  expect(container.querySelector('.gy-curve-will')).toBeNull()
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
  expect(container.querySelector('.gy-curve-val b')!.textContent).toBe('132,5')
})

test('60 points render — the FE never re-caps what the wire already capped at 52', () => {
  const { container } = render(<StrengthCurve points={weekly(60)} />)
  const lines = polylines(container)
  expect(lines).toHaveLength(1)
  expect(pointCount(lines[0])).toBe(60)
})

describe('a gap reads as a gap', () => {
  it('breaks the line where the interval is out of character for the series', () => {
    // 10 weekly points with weeks 4 and 5 missing → a 21-day hole in a 7-day cadence.
    const { container } = render(<StrengthCurve points={weekly(10, '2026-01-07', [4, 5])} />)
    const lines = polylines(container)
    expect(lines).toHaveLength(2)
    expect(pointCount(lines[0])).toBe(4)
    expect(pointCount(lines[1])).toBe(4)
  })

  it('the x axis is TIME, so the hole is as wide as the calendar says', () => {
    const { container } = render(<StrengthCurve points={weekly(10, '2026-01-07', [4, 5])} />)
    const [before, after] = polylines(container)
    const lastBefore = Number(before.getAttribute('points')!.trim().split(/\s+/).pop()!.split(',')[0])
    const firstAfter = Number(after.getAttribute('points')!.trim().split(/\s+/)[0].split(',')[0])
    // 3 weeks of a 9-week span (63 days) over a 300-wide box = 100, vs 33.3 for one week.
    expect(firstAfter - lastBefore).toBeCloseTo(100, 1)
  })

  it('a measurement stranded between two gaps keeps a dot of its own', () => {
    const points: E1rmPoint[] = [
      { date: '2026-01-07', e1rm: 80 },
      { date: '2026-01-14', e1rm: 82 },
      { date: '2026-04-01', e1rm: 90 }, // alone between two long holes
      { date: '2026-07-01', e1rm: 95 },
      { date: '2026-07-08', e1rm: 96 },
    ]
    const { container } = render(<StrengthCurve points={points} />)
    expect(polylines(container)).toHaveLength(2)
    // two segment dots would be one; here: the stranded point + the „now" marker
    expect(container.querySelectorAll('circle.gy-curve-now')).toHaveLength(2)
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
  const pts = container.querySelector('polyline')!.getAttribute('points')!
  expect(pts).not.toMatch(/NaN/)
})
