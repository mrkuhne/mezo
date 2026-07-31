import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SleepChart } from '@/features/me/components/SleepChart'
import type { SleepEntry } from '@/data/types'

const base = {
  bedtime: '23:00', wakeup: '06:30', quality: 8, awakenings: 1, mealToSleep: 0, notes: null,
}
const withPhases = (date: string): SleepEntry => ({
  ...base, date, duration: 7.5, inBedMin: 470, awakeMin: 20, lightMin: 200, remMin: 140, deepMin: 110,
})
const plain = (date: string, duration = 7.0): SleepEntry => ({ ...base, date, duration })

describe('SleepChart', () => {
  it('splits a phase-carrying night into three stacked segments', () => {
    const { container } = render(
      <SleepChart entries={[withPhases('2026-05-21'), withPhases('2026-05-22')]} period="7d" />,
    )
    expect(container.querySelectorAll('rect[data-phase]')).toHaveLength(6)
  })

  it('leaves a phase-less night as a single plain bar — the gap stays visible', () => {
    const { container } = render(
      <SleepChart entries={[plain('2026-05-21'), withPhases('2026-05-22')]} period="7d" />,
    )
    expect(container.querySelectorAll('rect[data-phase]')).toHaveLength(3)
    expect(container.querySelectorAll('rect[data-plain]')).toHaveLength(1)
  })

  it('measures bars from a zero baseline so the stacked proportions are true', () => {
    const { container } = render(
      <SleepChart entries={[withPhases('2026-05-21'), withPhases('2026-05-22')]} period="7d" />,
    )
    const segments = [...container.querySelectorAll('rect[data-phase]')]
    const deep = segments.find(r => r.getAttribute('data-phase') === 'deep')!
    const light = segments.find(r => r.getAttribute('data-phase') === 'light')!
    // light (200 min) must be drawn taller than deep (110 min), in the same ratio
    const ratio = Number(light.getAttribute('height')) / Number(deep.getAttribute('height'))
    expect(ratio).toBeCloseTo(200 / 110, 1)
  })

  it('scales a plain bar height proportionally to its raw duration — a zero-baseline check', () => {
    // Regression guard for the truncated scale (minDur = Math.min(5.5, ...)): under that scale
    // a bar's height was duration-minus-offset, so two bars' height ratio would NOT match their
    // duration ratio. Only a true 0 baseline makes height/duration proportional. Two plain (no
    // phase-data) nights isolate the axis itself from the segment-split math.
    const short = plain('2026-05-21', 6.0)
    const long = plain('2026-05-22', 7.5)
    const { container } = render(<SleepChart entries={[short, long]} period="7d" />)
    const bars = [...container.querySelectorAll('rect[data-plain]')]
    expect(bars).toHaveLength(2)
    // Plain bars no longer carry an isLow amber tint (whole-branch review FIX 5 — they're
    // provenance, not verdict), so DOM order — guaranteed by `data.map` — disambiguates which
    // bar is which instead of opacity.
    const [shortBar, longBar] = bars
    const ratio = Number(shortBar.getAttribute('height')) / Number(longBar.getAttribute('height'))
    expect(ratio).toBeCloseTo(6.0 / 7.5, 2)
  })

  it('still returns null below two points', () => {
    const { container } = render(<SleepChart entries={[plain('2026-05-22')]} period="7d" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('gates the legend on what is actually on screen (whole-branch review FIX 2)', () => {
    // An all-plain window: no phase colour is drawn, so the phase legend must not name one —
    // and the plain bars need their own időtartam key instead.
    const { container: plainOnly } = render(
      <SleepChart entries={[plain('2026-05-21', 6.5), plain('2026-05-22', 7.0)]} period="7d" />,
    )
    expect(plainOnly.textContent).toContain('időtartam')
    expect(plainOnly.textContent).not.toContain('mély')
    expect(plainOnly.textContent).not.toContain('REM')

    // An all-phase window: every bar is stacked, so the időtartam swatch (which describes the
    // plain-bar colour) would be a stray key for nothing on screen.
    const { container: phaseOnly } = render(
      <SleepChart entries={[withPhases('2026-05-21'), withPhases('2026-05-22')]} period="7d" />,
    )
    expect(phaseOnly.textContent).toContain('mély')
    expect(phaseOnly.textContent).not.toContain('időtartam')
  })
})
