// ============================================================
// Mezo · LearningHistoryChart tests (mezo-3n2so, spec §6.3) — the „Hétről hétre” chart on the
// „Hogy tanultam?” page. Pure props: the weeks in, one continuous weekly axis out. A calendar week
// without a row is a GAP: both lines and the band break there, it gets a „nincs adat” label, and
// selecting it shows no number at all.
// ============================================================
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { ExpenditureWeek } from '@/data/fuel/expenditureApi'
import { LearningHistoryChart } from '@/features/fuel/components/LearningHistoryChart'

const wk = (weekStart: string, over: Partial<ExpenditureWeek> = {}): ExpenditureWeek => ({
  weekStart,
  status: 'updated',
  confidence: 'medium',
  formulaBaseKcal: 2400,
  posteriorBaseKcal: 2450,
  posteriorSdKcal: 165,
  appliedBaseKcal: 2420,
  stepKcal: -20,
  usableDays: 6,
  weighInDays: 4,
  ...over,
})

// Four calendar weeks, the third (aug. 17) missing — a gap.
const WEEKS: ExpenditureWeek[] = [
  wk('2026-08-03', { status: 'learning', appliedBaseKcal: 2400, stepKcal: 0 }),
  wk('2026-08-10', { status: 'holding', appliedBaseKcal: 2400, stepKcal: 0, usableDays: 2, weighInDays: 1 }),
  wk('2026-08-24', { appliedBaseKcal: 2480, posteriorBaseKcal: 2470, posteriorSdKcal: 148, stepKcal: 60, usableDays: 4 }),
]

const detail = () => document.querySelector('.fln-wkd') as HTMLElement

describe('LearningHistoryChart', () => {
  it('places the weeks on a continuous weekly axis — a missing week is a gap with a „nincs adat” label', () => {
    render(<LearningHistoryChart weeks={WEEKS} reducedMotion />)
    const svg = screen.getByRole('img', { name: /A keret alapja hétről hétre, 4 hét/ })
    // one tap target per CALENDAR week, the gap included
    expect(document.querySelectorAll('.fln-hit')).toHaveLength(4)
    expect(within(svg as unknown as HTMLElement).getByText('nincs adat')).toBeInTheDocument()
    // the gap breaks both lines and the band: two runs each (weeks 1–2, then week 4)
    expect(svg.querySelectorAll('.fln-applied')).toHaveLength(2)
    expect(svg.querySelectorAll('.fln-formula')).toHaveLength(2)
    expect(svg.querySelectorAll('.fln-band')).toHaveLength(2)
    // one marker per row; the holding week is hollow
    expect(svg.querySelectorAll('.fln-dot')).toHaveLength(3)
    expect(svg.querySelectorAll('.fln-dot.is-hold')).toHaveLength(1)
  })

  it('selects the latest week by default and shows its numbers with σ̂ next to the learned value', () => {
    render(<LearningHistoryChart weeks={WEEKS} reducedMotion />)
    const d = detail()
    expect(within(d).getByText('aug. 24–30.')).toBeInTheDocument()
    expect(within(d).getByText('2 400 kcal')).toBeInTheDocument() // Képlet szerint
    expect(within(d).getByText('2 470 ± 150 kcal')).toBeInTheDocument() // Tanult ± σ̂ (nearest 10)
    expect(within(d).getByText('2 480 kcal')).toBeInTheDocument() // A keret alapja
    expect(within(d).getByText('+60 kcal')).toBeInTheDocument() // Lépés
    expect(within(d).getByText('Teljes nap').nextSibling?.textContent).toBe('4')
    expect(within(d).getByText('Mérlegelés').nextSibling?.textContent).toBe('4')
  })

  it('tapping a holding week shows its reason and „nem léptem”', async () => {
    render(<LearningHistoryChart weeks={WEEKS} reducedMotion />)
    await userEvent.click(screen.getByRole('button', { name: 'aug. 10–16.' }))
    const d = detail()
    expect(within(d).getByText(/aug\. 10–16\. · ezen a héten vártam/)).toBeInTheDocument()
    expect(within(d).getByText('nem léptem')).toBeInTheDocument()
    expect(within(d).getByText(/Kevés adat volt \(legalább 4 teljes nap és 2 mérlegelés kell\), ezért a keret nem mozdult\./)).toBeInTheDocument()
  })

  it('tapping the gap week says it has no data and shows no numbers', async () => {
    render(<LearningHistoryChart weeks={WEEKS} reducedMotion />)
    await userEvent.click(screen.getByRole('button', { name: 'aug. 17–23.' }))
    const d = detail()
    expect(within(d).getByText('aug. 17–23.')).toBeInTheDocument()
    expect(within(d).getByText(/Erről a hétről nincs sorom — kevés volt a felírás és a mérlegelés, ezért nem tippelek számot\./)).toBeInTheDocument()
    expect(d.textContent).not.toMatch(/kcal/)
    expect(d.querySelectorAll('.fln-kv-cell')).toHaveLength(0)
  })

  it('draws the lines once unless reduced motion is on', () => {
    const { unmount } = render(<LearningHistoryChart weeks={WEEKS} reducedMotion={false} />)
    expect(document.querySelector('.fln-chart')!.classList.contains('is-draw')).toBe(true)
    unmount()
    render(<LearningHistoryChart weeks={WEEKS} reducedMotion />)
    expect(document.querySelector('.fln-chart')!.classList.contains('is-draw')).toBe(false)
  })
})
