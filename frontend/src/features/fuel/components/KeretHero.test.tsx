// ============================================================
// Mezo · KeretHero tests (mezo-c9t5, keret-hero Task 2). See
// .superpowers/sdd/2026-08-09-fuel-keret-hero/task-2-brief.md.
// ============================================================
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { KeretHero } from '@/features/fuel/components/KeretHero'
import type { KeretHeroVM, RingVM } from '@/features/fuel/logic/keretHero'

// Force reduced-motion (the stubReduced pattern, CountUp.test.tsx precedent).
function stubReduced(matches = true) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches,
    media: q,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const ring = (over: Partial<RingVM> = {}): RingVM => ({
  key: 'p', label: 'Fehérje', pct: 39, value: '62 g', target: '160 g', color: 'var(--macro-protein)',
  ...over,
})

const VM = (over: Partial<KeretHeroVM> = {}): KeretHeroVM => ({
  remainingKcal: 1160,
  consumedKcal: 1240,
  targetKcal: 2400,
  doneCount: 2,
  totalCount: 4,
  segments: [{ widthPct: 20, toneAlt: false }, { widthPct: 30, toneAlt: true }],
  nowFrac: 0.49,
  chips: { base: 1890, activity: 910, balance: -400 },
  rings: [
    ring({ key: 'p', label: 'Fehérje', pct: 39, value: '62 g', target: '160 g', color: 'var(--macro-protein)' }),
    ring({ key: 'c', label: 'Szénhidrát', pct: 52, value: '130 g', target: '250 g', color: 'var(--macro-carbs)' }),
    ring({ key: 'f', label: 'Zsír', pct: 51, value: '38 g', target: '75 g', color: 'var(--macro-fat)' }),
    ring({ key: 'fiber', label: 'Rost', pct: 43, value: '13 g', target: '30 g', color: 'var(--macro-fiber)' }),
    ring({ key: 'water', label: 'Víz', pct: 48, value: '1200 ml', target: '2500 ml', color: 'var(--sky)' }),
  ],
  ...over,
})

describe('KeretHero — count-up', () => {
  it('renders the final remaining-kcal value synchronously under reduced motion, HU space-grouped', () => {
    stubReduced()
    render(<KeretHero vm={VM()} onChip={vi.fn()} onWaterRing={vi.fn()} />)
    expect(screen.getByText('1 160')).toBeInTheDocument()
  })

  it('the accessible name of the count-up is the final value, and it carries no aria-live', () => {
    stubReduced()
    render(<KeretHero vm={VM()} onChip={vi.fn()} onWaterRing={vi.fn()} />)
    const el = screen.getByLabelText('1 160 kcal hátra')
    expect(el).toBeInTheDocument()
    expect(el).not.toHaveAttribute('aria-live')
  })

  it('an overshoot day (negative remainingKcal) renders the honest negative with the Unicode minus, in both the numeral and the aria-label', () => {
    stubReduced()
    render(<KeretHero vm={VM({ remainingKcal: -240 })} onChip={vi.fn()} onWaterRing={vi.fn()} />)
    expect(screen.getByText('−240')).toBeInTheDocument()
    expect(screen.getByLabelText('−240 kcal hátra')).toBeInTheDocument()
  })

  it('moving-path smoke: shows 0 at mount, then the final HU-grouped value once the rAF loop completes', async () => {
    // Bypass CountUp.tsx's jsdom short-circuit (same trick as CountUp.test.tsx) to exercise
    // the real rAF branch instead of the reduced/jsdom instant-value branch. A short
    // durationMs (CountUp.test.tsx precedent) keeps this fast/non-flaky under real rAF
    // timing while the waitFor timeout stays generous.
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Test Browser)')
    render(<KeretHero vm={VM({ remainingKcal: 30 })} onChip={vi.fn()} onWaterRing={vi.fn()} durationMs={40} />)
    expect(screen.getByText('0')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('30')).toBeInTheDocument(), { timeout: 2000 })
  })

  it('a later vm.remainingKcal change animates from the previously displayed value, not a restart from 0', () => {
    // A manually-flushed rAF queue (rather than real timers) makes the very first animation
    // frame after the `to` change deterministically observable — real rAF timing can't prove
    // "never touches 0 on frame 1" without either a flaky race or a full-duration wait that
    // would miss the bug (the old code's brief 0-flash only exists on that first frame).
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Test Browser)')
    let queue: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      queue.push(cb)
      return queue.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    const flush = (now: number) => {
      const cbs = queue
      queue = []
      act(() => cbs.forEach((cb) => cb(now)))
    }

    const { rerender } = render(<KeretHero vm={VM({ remainingKcal: 800 })} onChip={vi.fn()} onWaterRing={vi.fn()} durationMs={40} />)
    flush(1000) // first frame: p=0, eased=0 — 0→800 sweep starts at 0, same as always
    flush(1040) // p=1 — sweep lands on the mount target
    expect(screen.getByText('800')).toBeInTheDocument()

    rerender(<KeretHero vm={VM({ remainingKcal: 300 })} onChip={vi.fn()} onWaterRing={vi.fn()} durationMs={40} />)
    flush(2000) // first frame of the NEW sweep: p=0, eased=0 — must render `from` (800), not 0
    expect(screen.queryByText('0')).not.toBeInTheDocument()
    expect(screen.getByText('800')).toBeInTheDocument()

    flush(2040) // p=1 — the new sweep lands on the new target
    expect(screen.getByText('300')).toBeInTheDocument()
  })
})

describe('KeretHero — of-line', () => {
  it('renders eddig/target/window-count with no percent', () => {
    stubReduced()
    const { container } = render(<KeretHero vm={VM()} onChip={vi.fn()} onWaterRing={vi.fn()} />)
    const ofLine = container.querySelector('.khero-of')
    expect(ofLine?.textContent).toContain('eddig 1 240')
    expect(ofLine?.textContent).toContain('2 400')
    expect(ofLine?.textContent).toContain('2/4 ablak')
    expect(ofLine?.textContent).not.toContain('%')
  })
})

describe('KeretHero — dayseg', () => {
  it('renders one segment per vm.segments plus a now-marker when nowFrac is set', () => {
    stubReduced()
    const { container } = render(<KeretHero vm={VM()} onChip={vi.fn()} onWaterRing={vi.fn()} />)
    expect(container.querySelectorAll('.khero-seg')).toHaveLength(2)
    expect(container.querySelector('.khero-mark')).toBeInTheDocument()
  })

  it('omits the now-marker when nowFrac is null', () => {
    stubReduced()
    const { container } = render(<KeretHero vm={VM({ nowFrac: null })} onChip={vi.fn()} onWaterRing={vi.fn()} />)
    expect(container.querySelector('.khero-mark')).not.toBeInTheDocument()
  })
})

describe('KeretHero — chips', () => {
  it('renders no chip row when vm.chips is null (static-energy day)', () => {
    stubReduced()
    render(<KeretHero vm={VM({ chips: null })} onChip={vi.fn()} onWaterRing={vi.fn()} />)
    expect(screen.queryByText(/Alap/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Mozgás/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Cél/)).not.toBeInTheDocument()
  })

  it('renders a signed (−) Cél chip for a deficit and calls onChip("deficit")', async () => {
    stubReduced()
    const onChip = vi.fn()
    render(<KeretHero vm={VM({ chips: { base: 1890, activity: 910, balance: -400 } })} onChip={onChip} onWaterRing={vi.fn()} />)
    const goal = screen.getByRole('button', { name: /Cél/ })
    expect(goal).toHaveTextContent('−400')
    await userEvent.click(goal)
    expect(onChip).toHaveBeenCalledWith('deficit')
  })

  it('renders a signed (+) Cél chip for a surplus', () => {
    stubReduced()
    render(<KeretHero vm={VM({ chips: { base: 1890, activity: 910, balance: 400 } })} onChip={vi.fn()} onWaterRing={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Cél/ })).toHaveTextContent('+400')
  })

  it('the Alap and Mozgás chips call onChip with their own section', async () => {
    stubReduced()
    const onChip = vi.fn()
    render(<KeretHero vm={VM()} onChip={onChip} onWaterRing={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /Alap/ }))
    expect(onChip).toHaveBeenCalledWith('base')
    await userEvent.click(screen.getByRole('button', { name: /Mozgás/ }))
    expect(onChip).toHaveBeenCalledWith('movement')
  })
})

describe('KeretHero — rings', () => {
  it('renders exactly the 4 non-water rings as progressbars, fixed P/C/F/Rost order, with HU aria values', () => {
    stubReduced()
    render(<KeretHero vm={VM()} onChip={vi.fn()} onWaterRing={vi.fn()} />)
    const bars = screen.getAllByRole('progressbar')
    expect(bars).toHaveLength(4)
    expect(bars.map(b => b.getAttribute('aria-label'))).toEqual([
      'Fehérje 62 g / 160 g',
      'Szénhidrát 130 g / 250 g',
      'Zsír 38 g / 75 g',
      'Rost 13 g / 30 g',
    ])
    expect(bars[0]).toHaveAttribute('aria-valuenow', '39')
    expect(bars[0]).toHaveAttribute('aria-valuemin', '0')
    expect(bars[0]).toHaveAttribute('aria-valuemax', '100')
  })

  it('the water ring is a button (not a progressbar) with a full HU aria-label in liters, calling onWaterRing on click', async () => {
    stubReduced()
    const onWaterRing = vi.fn()
    render(<KeretHero vm={VM()} onChip={vi.fn()} onWaterRing={onWaterRing} />)
    // 1200 ml / 2500 ml (RingVM's raw data, unchanged) presents as liters — the mockup's
    // validated phrasing — both in the aria-label and the on-ring value/target text.
    const waterBtn = screen.getByRole('button', { name: 'Víz logolása · 1,2 a 2,5 literből' })
    await userEvent.click(waterBtn)
    expect(onWaterRing).toHaveBeenCalledTimes(1)
  })

  it('the water ring shows its value/target in liters, not raw ml', () => {
    stubReduced()
    render(<KeretHero vm={VM()} onChip={vi.fn()} onWaterRing={vi.fn()} />)
    const waterBtn = screen.getByRole('button', { name: /Víz logolása/ })
    expect(waterBtn).toHaveTextContent('1,2')
    expect(waterBtn).toHaveTextContent('/ 2,5 l')
    expect(waterBtn).not.toHaveTextContent('ml')
  })
})
