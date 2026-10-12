import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

// Folyadék (mezo-n4wf5.5): the six steps are six numbered ROWS (title + a one-line digest); a row opens the step in a sheet
// with „Előző / Következő lépés" between the steps (prototype `hw:<0–5>`).
const body = (x: Partial<ExpenditureExplanation> = {}, reducedMotion = true) =>
  render(<LearnedBaseExplainerBody explanation={{ ...seed, ...x }} reducedMotion={reducedMotion} />)
const rows = () => [...document.querySelectorAll('.ft-step')].map(r => r.textContent)
const titles = () => [...document.querySelectorAll('.ft-step')].map(r => `${r.querySelector('.ft-dd')!.textContent}${r.querySelector('strong')!.textContent}`)
const open = async (title: string) => {
  await userEvent.click(screen.getByRole('button', { name: new RegExp(title) }))
  return screen.getByRole('dialog')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('LearnedBaseExplainerBody — the fixture numbers', () => {
  it('lists all six steps, each with the digest of its numbers', () => {
    body()
    expect(rows()).toEqual([
      '1Mit néztem meg47 teljes nap · 52 mérlegelés · 8 hét',
      '2A súlyod és az evésed együttevés-oszlopok, súlypontok, trend, víz-sáv',
      '3A számítás, egyszerűen2 780 − 352 − 426 ≈ 2 000 (kerekítve)',
      '4Amit kiszűrtem, hogy ne tévesszen meg4 kihagyott nap · víz · 9 nap felírás nélkül',
      '5Mennyire vagyok biztos benne±200 kcal · még tanulok',
      '6Hogyan léptem2 356 → 2 309 → −150 → 2 159',
    ])
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.querySelector('.flp-how-cell, .flp-how-in')).toBeNull()
  })

  it('step 1: the three facts and the rule', async () => {
    body()
    const sheet = await open('Mit néztem meg')
    expect(within(sheet).getByRole('heading', { name: '1. Mit néztem meg' })).toBeInTheDocument()
    expect(within(sheet).getByText('a legutóbbi hét · szept. 21–27.')).toBeInTheDocument()
    expect([...sheet.querySelectorAll('.fo-facts b')].map(b => b.textContent)).toEqual(['47', '52', '8'])
    expect(within(sheet).getByText('teljes nap felírt evéssel')).toBeInTheDocument()
    expect(within(sheet).getByText(/A mai napot soha nem nézem/)).toBeInTheDocument()
  })

  it('step 3: the simple calculation as running levels, with the why-note', async () => {
    body()
    const sheet = await open('A számítás, egyszerűen')
    expect([...sheet.querySelectorAll('.ft-gr > em')].map(r => r.textContent)).toEqual(['2 780', '−352', '−426'])
    expect(sheet.querySelector('.ft-tot b')!.textContent).toBe('≈ 2 000kcal')
    expect(within(sheet).getByText(/\+0,32 kg\/hét valódi gyarapodás/)).toBeInTheDocument()
    expect(within(sheet).getByText('logolt mozgás, napi átlag')).toBeInTheDocument()
    expect(within(sheet).getByText('Miért 2 159 és nem 2 000?').tagName).toBe('B')
    expect(within(sheet).getByText(/Mert még bizonytalan vagyok.*\(6\. pont\)/)).toBeInTheDocument()
    // the levels run down from what was eaten: 100 % → after the tissue → after the movement
    const levels = [...sheet.querySelectorAll('.ft-gr .fo-level > i')].map(i => parseFloat((i as HTMLElement).style.width))
    expect(levels[0]).toBe(100)
    expect(levels[1]).toBeCloseTo(((2780 - 352) / 2780) * 100, 0)
    expect(levels[2]).toBeCloseTo(((2780 - 352 - 426) / 2780) * 100, 0)
  })

  it('step 4: what was filtered out, with the days', async () => {
    body()
    const sheet = await open('Amit kiszűrtem')
    expect(within(sheet).getByText('4 hiányosnak tűnő nap')).toBeInTheDocument()
    expect([...sheet.querySelectorAll('.ft-chips > span')].map(x => x.textContent))
      .toEqual(['szept. 13. · 604', 'szept. 19. · 929', 'szept. 20. · 828', 'szept. 24. · 1 347'])
    expect(within(sheet).getByText('Víz, nem zsír · szept. 14. körül')).toBeInTheDocument()
    expect(within(sheet).getByText(/kb\. 1,5 kg-ot ugrott/)).toBeInTheDocument()
    expect(within(sheet).getByText('9 nap felírás nélkül')).toBeInTheDocument()
  })

  it('steps 5 and 6: how sure, and how the frame stepped; „Előző / Következő lépés" walk the steps', async () => {
    body()
    const sheet = await open('Mennyire vagyok biztos benne')
    expect(within(sheet).getByText('±200 kcal').tagName).toBe('B')
    expect(sheet.querySelector('.ft-gb3 .on')!.textContent).toBe('Még tanulok')
    expect(within(sheet).getByText(/Minél több teljes napot/)).toBeInTheDocument()
    await userEvent.click(within(sheet).getByRole('button', { name: 'Következő lépés' }))
    expect(screen.getByRole('heading', { name: '6. Hogyan léptem' })).toBeInTheDocument()
    expect([...document.querySelectorAll('.ft-steps .fo-vial > b')].map(b => b.textContent)).toEqual(['2 356', '2 309', '−150', '2 159'])
    expect(screen.getByText('a korábbi igazításaiddal')).toBeInTheDocument()
    expect(screen.getByText(/Hetente csak kis lépést teszek/)).toBeInTheDocument()
    // the last step has no „Következő lépés"; „Előző" goes back
    expect(screen.queryByRole('button', { name: 'Következő lépés' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Előző' }))
    expect(screen.getByRole('heading', { name: '5. Mennyire vagyok biztos benne' })).toBeInTheDocument()
  })

  it('the chart summarises itself and draws one bar per logged day', async () => {
    body()
    const sheet = await open('A súlyod és az evésed együtt')
    const chart = within(sheet).getByRole('img', { name: /Napi evés oszlopokban.*8 hét \(aug\. 3\. – szept\. 27\.\)/ })
    const logged = seed.series.filter(p => p.intakeKcal != null && p.status !== 'unlogged')
    expect(chart.querySelectorAll('rect.okc, rect.bad')).toHaveLength(logged.length)
    expect(chart.querySelectorAll('rect.bad')).toHaveLength(4)
    expect(chart.querySelectorAll('circle')).toHaveLength(seed.series.filter(p => p.weightKg != null).length)
    expect(within(sheet).getByText('ebből víz')).toBeInTheDocument()
  })

  it('meter: three equal zones, the SD places the level inside the served confidence zone', () => {
    // low: 300→200 over [0, 1/3]; >300 clamps to the left edge
    expect(meterPosition(350, 'low')).toBe(0)
    expect(meterPosition(250, 'low')).toBeCloseTo(1 / 6)
    // medium: 200→100 over [1/3, 2/3]
    expect(meterPosition(150, 'medium')).toBeCloseTo(0.5)
    // high: 100→0 over [2/3, 1]
    expect(meterPosition(50, 'high')).toBeCloseTo(5 / 6)
    expect(meterPosition(0, 'high')).toBe(1)
  })

  it('meter: the level never leaves the zone of the served word', () => {
    expect(meterPosition(80, 'low')).toBeCloseTo(1 / 3) // low with a tight SD → low zone's right edge
    expect(meterPosition(260, 'medium')).toBeCloseTo(1 / 3) // medium with a wide SD → medium's left edge
    expect(meterPosition(180, 'high')).toBeCloseTo(2 / 3) // high with a wide SD → high's left edge
  })

  it('the meter level renders in the fixture zone (low, ±200 → the low zone edge)', async () => {
    body()
    const sheet = await open('Mennyire vagyok biztos benne')
    const meter = within(sheet).getByRole('img', { name: 'Biztonság: Még tanulok' })
    expect(parseFloat((meter.querySelector('.fo-level > i') as HTMLElement).style.width)).toBeCloseTo(100 / 3)
    expect(within(sheet).queryByText(/150 kcal/)).not.toBeInTheDocument()
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
  it('no simple base → no calculation step, the rest renumbers', () => {
    body({ simpleBaseKcal: null })
    expect(screen.queryByText('A számítás, egyszerűen')).not.toBeInTheDocument()
    expect(titles()).toContain('3Amit kiszűrtem, hogy ne tévesszen meg')
  })

  it('no tissue rate (HOLDING) → no calculation step', () => {
    body({ tissueRateKgPerWeek: null })
    expect(screen.queryByText('A számítás, egyszerűen')).not.toBeInTheDocument()
  })

  it('nothing filtered → no step 4; empty series → no chart step; the why-note points at the renumbered last step', async () => {
    body({ excludedDays: [], waterEvents: [], unloggedDays: 0, series: [] })
    expect(screen.queryByText('Amit kiszűrtem, hogy ne tévesszen meg')).not.toBeInTheDocument()
    expect(titles()).toEqual(['1Mit néztem meg', '2A számítás, egyszerűen', '3Mennyire vagyok biztos benne', '4Hogyan léptem'])
    const sheet = await open('A számítás, egyszerűen')
    expect(within(sheet).queryByRole('img')).not.toBeInTheDocument()
    expect(within(sheet).getByText(/hetente lépek felé \(4\. pont\)/)).toBeInTheDocument()
  })

  it('each hint hides on its own', async () => {
    body({ waterEvents: [], unloggedDays: 0 })
    expect(rows()[3]).toBe('4Amit kiszűrtem, hogy ne tévesszen meg4 kihagyott nap')
    const sheet = await open('Amit kiszűrtem')
    expect(within(sheet).getByText('4 hiányosnak tűnő nap')).toBeInTheDocument()
    expect(within(sheet).queryByText(/Víz, nem zsír/)).not.toBeInTheDocument()
    expect(within(sheet).queryByText(/felírás nélkül/)).not.toBeInTheDocument()
  })

  it('days the owner marked stand beside the suspicious ones in the digest', () => {
    body({ excludedDays: [...seed.excludedDays, { date: '2026-09-26', kcal: 2150, reason: 'marked' }] })
    expect(rows()[3]).toContain('4 + 1 kihagyott nap')
  })

  it('start = formula → no start vial; step 0 → no step vial', async () => {
    body({ startBaseKcal: 2356, stepKcal: 0, appliedBaseKcal: 2356 })
    expect(rows().at(-1)).toBe('6Hogyan léptem2 356 → 2 356')
    const sheet = await open('Hogyan léptem')
    expect(within(sheet).queryByText('a korábbi igazításaiddal')).not.toBeInTheDocument()
    expect(within(sheet).queryByText('e heti lépés')).not.toBeInTheDocument()
    expect([...sheet.querySelectorAll('.fo-vial > b')].map(b => b.textContent)).toEqual(['2 356', '2 356'])
  })

  it('a positive step is printed with its plus sign', async () => {
    body({ stepKcal: 120 })
    const sheet = await open('Hogyan léptem')
    expect([...sheet.querySelectorAll('.fo-vial > b')].map(b => b.textContent)).toContain('+120')
  })

  it('high confidence → no "more data" line, Biztos lit', async () => {
    body({ confidence: 'high', posteriorSdKcal: 90 })
    const sheet = await open('Mennyire vagyok biztos benne')
    expect(within(sheet).queryByText(/Minél több teljes napot/)).not.toBeInTheDocument()
    expect(sheet.querySelector('.ft-gb3 .on')!.textContent).toBe('Biztos')
  })
})

describe('LearnedBaseExplainerBody — the why-note threshold', () => {
  it('hidden below 30 kcal apart', async () => {
    body({ appliedBaseKcal: 2031, simpleBaseKcal: 2002 })
    const sheet = await open('A számítás, egyszerűen')
    expect(within(sheet).queryByText(/^Miért/)).not.toBeInTheDocument()
  })
  it('shown at 30 kcal apart', async () => {
    body({ appliedBaseKcal: 2032, simpleBaseKcal: 2002 })
    const sheet = await open('A számítás, egyszerűen')
    expect(within(sheet).getByText('Miért 2 032 és nem 2 000?')).toBeInTheDocument()
  })
})

describe('LearnedBaseExplainerBody — motion', () => {
  it('reduced motion renders the final frame at once', () => {
    render(<LearnedBaseChart series={seed.series} historyWeeks={seed.historyWeeks} reducedMotion />)
    const chart = screen.getByRole('img')
    expect(chart.getAttribute('data-progress')).toBe('1')
    const first = chart.querySelector('rect.okc')!
    expect(Number(first.getAttribute('height'))).toBeGreaterThan(0)
    expect(chart.querySelector('.tr')!.getAttribute('stroke-dashoffset')).toBe('0')
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
    expect(Number(chart.querySelector('.tr')!.getAttribute('stroke-dashoffset'))).toBeGreaterThan(0)
    expect(raf).toHaveBeenCalledTimes(1)

    // Advance by hand straight to the pass's own 900ms duration (DUR in LearnedBaseChart.tsx) —
    // the final frame: fully drawn.
    act(() => { frames[0]?.(900) })
    expect(chart.getAttribute('data-progress')).toBe('1')
    expect(chart.querySelector('.tr')!.getAttribute('stroke-dashoffset')).toBe('0')
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
    expect(await screen.findByText('47 teljes nap · 52 mérlegelés · 8 hét')).toBeInTheDocument()
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
