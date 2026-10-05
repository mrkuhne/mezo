import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { delay, http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { expenditureExplanationSeed as seed } from '@/data/fuel/expenditureExplanation'
import { fuelDayEnergy } from '@/data/fuel/fuel'
import type { ExpenditureExplanation } from '@/data/fuel/expenditureApi'
import { LearnedBaseExplainer, LearnedBaseExplainerBody, meterPosition } from '@/features/fuel/sheets/LearnedBaseExplainer'
import { LearnedBaseChart } from '@/features/fuel/sheets/LearnedBaseChart'

const body = (x: Partial<ExpenditureExplanation> = {}, reducedMotion = true) =>
  render(<LearnedBaseExplainerBody explanation={{ ...seed, ...x }} reducedMotion={reducedMotion} />)
const titles = () => [...document.querySelectorAll('.flp-how-cell h4')].map(h => h.textContent)

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('LearnedBaseExplainerBody — the fixture numbers', () => {
  it('renders all six sections with the persisted numbers', () => {
    body()
    expect(titles()).toEqual([
      '1Mit néztem meg', '2A súlyod és az evésed együtt', '3A számítás, egyszerűen',
      '4Amit kiszűrtem, hogy ne tévesszen meg', '5Mennyire vagyok biztos benne', '6Hogyan léptem',
    ])
    const stats = [...document.querySelectorAll('.flp-how-stat b')].map(b => b.textContent)
    expect(stats).toEqual(['47', '52', '8'])
    const calc = [...document.querySelectorAll('.flp-how-calc .r')].map(r => r.textContent)
    expect(calc).toEqual(['2780', '−352', '−426', '≈ 2000'])
    expect(screen.getByText(/\+0,32 kg\/hét valódi gyarapodás/)).toBeInTheDocument()
    expect(screen.getByText('Miért 2159 és nem 2000?')).toBeInTheDocument()
    expect(screen.getByText('logolt mozgás, napi átlag')).toBeInTheDocument()
    expect(screen.getByText('4 hiányosnak tűnő nap')).toBeInTheDocument()
    expect([...document.querySelectorAll('.flp-how-chip .days span')].map(s => s.textContent))
      .toEqual(['szept. 13 · 604', 'szept. 19 · 929', 'szept. 20 · 828', 'szept. 24 · 1347'])
    expect(screen.getByText('Víz, nem zsír · szept. 14. körül')).toBeInTheDocument()
    expect(screen.getByText(/~1,5 kg-ot ugrott/)).toBeInTheDocument()
    expect(screen.getByText('9 nap felírás nélkül')).toBeInTheDocument()
    expect(screen.getByText('±200 kcal')).toBeInTheDocument()
    expect(document.querySelector('.flp-how-meter-lbl .on')!.textContent).toBe('Még tanulok')
    expect(screen.getByText(/Minél több teljes napot/)).toBeInTheDocument()
    const steps = [...document.querySelectorAll('.flp-how-step b')].map(b => b.textContent)
    expect(steps).toEqual(['2356', '2309', '−150', '2159'])
    expect(screen.getByText('a korábbi igazításaiddal')).toBeInTheDocument()
    expect(document.querySelector('.flp-how-step.is-down')).not.toBeNull()
  })

  it('the chart summarises itself and draws one bar per logged day', () => {
    body()
    const chart = screen.getByRole('img', { name: /Napi evés oszlopokban.*8 hét \(aug\. 3 – szept\. 27\)/ })
    const logged = seed.series.filter(p => p.intakeKcal != null && p.status !== 'unlogged')
    expect(chart.querySelectorAll('rect.is-ok, rect.is-bad')).toHaveLength(logged.length)
    expect(chart.querySelectorAll('rect.is-bad')).toHaveLength(4)
    expect(chart.querySelectorAll('circle')).toHaveLength(seed.series.filter(p => p.weightKg != null).length)
  })

  it('meter: three equal zones, the SD places the pin inside the served confidence zone', () => {
    // low: 300→200 over [0, 1/3]; >300 clamps to the left edge
    expect(meterPosition(350, 'low')).toBe(0)
    expect(meterPosition(250, 'low')).toBeCloseTo(1 / 6)
    // medium: 200→100 over [1/3, 2/3]
    expect(meterPosition(150, 'medium')).toBeCloseTo(0.5)
    // high: 100→0 over [2/3, 1]
    expect(meterPosition(50, 'high')).toBeCloseTo(5 / 6)
    expect(meterPosition(0, 'high')).toBe(1)
  })

  it('meter: the pin never leaves the zone of the served word', () => {
    expect(meterPosition(80, 'low')).toBeCloseTo(1 / 3) // low with a tight SD → low zone's right edge
    expect(meterPosition(260, 'medium')).toBeCloseTo(1 / 3) // medium with a wide SD → medium's left edge
    expect(meterPosition(180, 'high')).toBeCloseTo(2 / 3) // high with a wide SD → high's left edge
  })

  it('meter pin renders in the fixture zone (low, ±200 → the low zone edge)', () => {
    body()
    const left = parseFloat((document.querySelector('.flp-how-meter .pin') as HTMLElement).style.left)
    expect(left).toBeCloseTo(100 / 3)
    expect(screen.getByText(/Hetente csak kis lépést teszek/)).toBeInTheDocument()
    expect(screen.queryByText(/150 kcal/)).not.toBeInTheDocument()
  })
})

describe('mock story', () => {
  // mezo-3n2so: the Fuel day now serves the learned-expenditure part 2 seed's latest week (2480,
  // see expenditureLearningSeed.test.ts), so the equation box, the weekly sheet and the
  // „Hogy tanultam?” page agree. The served equation must still close.
  it('the fuel mock serves a learned base, and its equation still closes', () => {
    expect(fuelDayEnergy.baseSource).toBe('learned')
    expect(fuelDayEnergy.plannedMovementKcal).toBeGreaterThan(0)
    expect(fuelDayEnergy.baseKcal + fuelDayEnergy.plannedMovementKcal + fuelDayEnergy.extraMovementKcal + fuelDayEnergy.balanceKcal)
      .toBe(fuelDayEnergy.targetKcal)
  })
})

describe('LearnedBaseExplainerBody — hidden when missing', () => {
  it('no simple base → no calculation section, the rest renumbers', () => {
    body({ simpleBaseKcal: null })
    expect(screen.queryByText('A számítás, egyszerűen')).not.toBeInTheDocument()
    expect(titles()).toContain('3Amit kiszűrtem, hogy ne tévesszen meg')
  })

  it('no tissue rate (HOLDING) → no calculation section', () => {
    body({ tissueRateKgPerWeek: null })
    expect(screen.queryByText(/ami súlyként megmaradt/)).not.toBeInTheDocument()
    expect(screen.queryByText('A számítás, egyszerűen')).not.toBeInTheDocument()
  })

  it('nothing filtered → no section 4; empty series → no chart', () => {
    body({ excludedDays: [], waterEvents: [], unloggedDays: 0, series: [] })
    expect(screen.queryByText('Amit kiszűrtem, hogy ne tévesszen meg')).not.toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(titles()).toEqual(['1Mit néztem meg', '2A számítás, egyszerűen', '3Mennyire vagyok biztos benne', '4Hogyan léptem'])
    expect(screen.getByText(/hetente lépek felé \(4\. pont\)/)).toBeInTheDocument()
  })

  it('each chip hides on its own', () => {
    body({ waterEvents: [], unloggedDays: 0 })
    expect(screen.getByText('4 hiányosnak tűnő nap')).toBeInTheDocument()
    expect(screen.queryByText(/Víz, nem zsír/)).not.toBeInTheDocument()
    expect(screen.queryByText(/felírás nélkül/)).not.toBeInTheDocument()
  })

  it('start = formula → no start tile; step 0 → no step tile', () => {
    body({ startBaseKcal: 2356, stepKcal: 0, appliedBaseKcal: 2356 })
    expect(screen.queryByText('a korábbi igazításaiddal')).not.toBeInTheDocument()
    expect(screen.queryByText('e heti lépés')).not.toBeInTheDocument()
    expect([...document.querySelectorAll('.flp-how-step b')].map(b => b.textContent)).toEqual(['2356', '2356'])
  })

  it('a positive step is sage (is-up)', () => {
    body({ stepKcal: 120 })
    expect(document.querySelector('.flp-how-step.is-up b')!.textContent).toBe('+120')
  })

  it('high confidence → no "more data" line, Biztos lit', () => {
    body({ confidence: 'high', posteriorSdKcal: 90 })
    expect(screen.queryByText(/Minél több teljes napot/)).not.toBeInTheDocument()
    expect(document.querySelector('.flp-how-meter-lbl .on')!.textContent).toBe('Biztos')
  })
})

describe('LearnedBaseExplainerBody — the why-note threshold', () => {
  it('hidden below 30 kcal apart', () => {
    body({ appliedBaseKcal: 2031, simpleBaseKcal: 2002 })
    expect(screen.queryByText(/^Miért/)).not.toBeInTheDocument()
  })
  it('shown at 30 kcal apart', () => {
    body({ appliedBaseKcal: 2032, simpleBaseKcal: 2002 })
    expect(screen.getByText('Miért 2032 és nem 2000?')).toBeInTheDocument()
  })
})

describe('LearnedBaseExplainerBody — motion', () => {
  it('reduced motion renders the final frame at once', () => {
    body({}, true)
    const chart = screen.getByRole('img')
    expect(chart.getAttribute('data-progress')).toBe('1')
    const first = chart.querySelector('rect.is-ok')!
    expect(Number(first.getAttribute('height'))).toBeGreaterThan(0)
    expect(chart.querySelector('.flp-how-trend')!.getAttribute('stroke-dashoffset')).toBe('0')
  })
  // The chart's own one-shot rAF pass reads real wall-clock time (`performance.now()`) over a real
  // 900ms — under a loaded full-suite run that never reliably finishes inside a `waitFor` timeout
  // (mezo-y72o3 follow-up: this flaked main's CI). Driven deterministically instead, the same way
  // WorkoutCeremony.test.tsx drives its own rAF pass: spy `requestAnimationFrame` to capture the
  // frame callback instead of scheduling it, pin `performance.now()` so the pass's `t0` is known,
  // then invoke the captured callback by hand with a chosen timestamp — no real animation, no
  // clock, no flake. Rendered as the bare `<LearnedBaseChart>` (not the full explainer body) so
  // the single captured frame is unambiguously the chart's own, not entangled with the sibling
  // confidence-meter's independent rAF pass.
  it('with motion the chart starts undrawn and draws in', () => {
    const frames: FrameRequestCallback[] = []
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb)
      return frames.length
    })
    vi.spyOn(performance, 'now').mockReturnValue(0)

    render(<LearnedBaseChart series={seed.series} historyWeeks={seed.historyWeeks} reducedMotion={false} />)
    const chart = screen.getByRole('img')

    // First frame (mount): undrawn — progress 0, the trend line's dash fully offset (hidden).
    expect(chart.getAttribute('data-progress')).toBe('0')
    expect(Number(chart.querySelector('.flp-how-trend')!.getAttribute('stroke-dashoffset'))).toBeGreaterThan(0)
    expect(raf).toHaveBeenCalledTimes(1)

    // Advance by hand straight to the pass's own 900ms duration (DUR in LearnedBaseChart.tsx) —
    // the final frame: fully drawn.
    act(() => { frames[0]?.(900) })
    expect(chart.getAttribute('data-progress')).toBe('1')
    expect(chart.querySelector('.flp-how-trend')!.getAttribute('stroke-dashoffset')).toBe('0')
  })
})

// mezo-3n2so: the explainer left the energy sheet for the „Hogy tanultam?” page (/fuel/tanulas),
// which renders the data-bound `LearnedBaseExplainer` as its six sections.
describe('LearnedBaseExplainer — data-bound', () => {
  it('mock mode shows the fixture', () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    render(<QueryWrapper><LearnedBaseExplainer reducedMotion /></QueryWrapper>)
    expect(screen.getByText('Mit néztem meg')).toBeInTheDocument()
  })

  it('real mode: loading line first, then the persisted explanation', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    server.use(http.get(`${API_BASE}/api/goals/expenditure/explanation`, async () => {
      await delay(80)
      return HttpResponse.json(seed)
    }))
    render(<QueryWrapper><LearnedBaseExplainer reducedMotion /></QueryWrapper>)
    expect(screen.getByText('Betöltöm, hogyan tanultam…')).toBeInTheDocument()
    expect(await screen.findByText('4 hiányosnak tűnő nap')).toBeInTheDocument()
  })

  it('real mode: 204 → the honest no-data line', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    server.use(http.get(`${API_BASE}/api/goals/expenditure/explanation`, () => new HttpResponse(null, { status: 204 })))
    render(<QueryWrapper><LearnedBaseExplainer reducedMotion /></QueryWrapper>)
    expect(await screen.findByText('Még nincs elég adat a magyarázathoz.')).toBeInTheDocument()
  })

  it('real mode: 500 → the honest error line', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    server.use(http.get(`${API_BASE}/api/goals/expenditure/explanation`, () => new HttpResponse(null, { status: 500 })))
    render(<QueryWrapper><LearnedBaseExplainer reducedMotion /></QueryWrapper>)
    expect(await screen.findByText('Most nem sikerült betölteni a magyarázatot.')).toBeInTheDocument()
  })
})
