import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { MesoDay } from '@/data/types'
import { MesoEditor } from '@/features/train/components/MesoEditor'

const ex = (id: string, muscle: string, workingSets: number, targetRIR: number) => ({
  id, name: `Gyak ${id}`, muscle, warmupSets: 1, workingSets, repMin: 8, repMax: 10, targetRIR, type: 'compound' as const,
})
const days: MesoDay[] = [
  { day: 'H', type: 'Push A', muscle: 'chest', exerciseCount: 2, exercises: [ex('a', 'chest-mid', 6, 0), ex('b', 'chest-upper', 6, 0)], current: true },
  { day: 'K', type: 'Pihenő', muscle: '', exerciseCount: 0, exercises: [] },
  { day: 'Cs', type: 'Pull A', muscle: 'back', exerciseCount: 1, exercises: [ex('c', 'back-wide', 13, 2)] },
]
const noop = () => {}
const props = { onAddClick: noop, onRemove: noop, onChange: noop, onReorder: noop }

describe('MesoEditor', () => {
  it('renders hero with active-day sets and week totals', () => {
    render(<MesoEditor days={days} {...props} />)
    expect(screen.getByText('12')).toBeInTheDocument()          // active day H: 6+6
    expect(screen.getByText(/25 szett/)).toBeInTheDocument()    // week: 12+13
  })
  it('flags warnings: chest 12 failure sets = 100% (near, not over); H chest 12 sets and Cs back 13 sets both break the session cap', () => {
    render(<MesoEditor days={days} {...props} />)
    expect(screen.getByText(/2 jelzés/)).toBeInTheDocument()
  })
  it('nothing is expanded on mount — pre-existing exercises are not treated as new', () => {
    render(<MesoEditor days={days} {...props} />)
    expect(screen.queryByRole('button', { name: /Volume/ })).not.toBeInTheDocument()
  })
  it('collapsed rows expand one at a time', () => {
    render(<MesoEditor days={days} {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /Gyak a · szerkesztés/ }))
    expect(screen.getByRole('button', { name: /Volume/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Gyak b · szerkesztés/ }))
    expect(screen.getAllByRole('button', { name: /Volume/ })).toHaveLength(1)
  })
  it('add button forwards the active day key', () => {
    const onAddClick = vi.fn()
    render(<MesoEditor days={days} {...props} onAddClick={onAddClick} />)
    fireEvent.click(screen.getByRole('button', { name: /Gyakorlat hozzáadása/ }))
    expect(onAddClick).toHaveBeenCalledWith('H')
  })

  it('renders the active day breakdown card (H chest 12/8) and highlights its over rows', () => {
    render(<MesoEditor days={days} {...props} />)
    expect(screen.getByText(/12 \/ 8/)).toBeInTheDocument()
    const rowA = screen.getByRole('button', { name: /Gyak a · szerkesztés/ }).closest('.card')
    const rowB = screen.getByRole('button', { name: /Gyak b · szerkesztés/ }).closest('.card')
    expect(rowA).toHaveAttribute('data-over', 'true')
    expect(rowB).toHaveAttribute('data-over', 'true')
  })

  it('an exempt exercise in an over-budget group does NOT get the over-budget highlight; a counted exercise still does (mezo-yqpf)', () => {
    const exemptDays: MesoDay[] = [
      {
        day: 'H', type: 'Push A', muscle: 'chest', exerciseCount: 3, current: true,
        exercises: [
          ex('a', 'chest-mid', 6, 0),
          ex('b', 'chest-upper', 6, 0),
          { ...ex('x', 'chest-lower', 5, 0), countsTowardVolume: false },
        ],
      },
    ]
    render(<MesoEditor days={exemptDays} {...props} />)
    const rowA = screen.getByRole('button', { name: /Gyak a · szerkesztés/ }).closest('.card')
    const rowX = screen.getByRole('button', { name: /Gyak x · szerkesztés/ }).closest('.card')
    expect(rowA).toHaveAttribute('data-over', 'true') // counted exercise in the over group — still flagged
    expect(rowX).not.toHaveAttribute('data-over') // exempt exercise — never flagged, even in an over group
  })

  it('switching to day Cs shows its own breakdown (13/8), the suggestDay clause, and highlights the over exercise', () => {
    render(<MesoEditor days={days} {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /^Cs ·/ }))
    expect(screen.getByText(/13 \/ 8/)).toBeInTheDocument()
    expect(screen.getByText(/\(pl\. H\)/)).toBeInTheDocument()
    const rowC = screen.getByRole('button', { name: /Gyak c · szerkesztés/ }).closest('.card')
    expect(rowC).toHaveAttribute('data-over', 'true')
  })

  it('off day (K) renders no breakdown card', () => {
    render(<MesoEditor days={days} {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /^K ·/ }))
    // "Ma · izmonként" is DayBreakdownCard's own eyebrow — scoped so it doesn't collide
    // with the week-level WeeklyBandsCard's "Heti szetek · izmonként", which stays
    // mounted regardless of the active day.
    expect(screen.queryByText(/Ma · izmonként/)).not.toBeInTheDocument()
  })

  it('adding a new exercise applies its suggested warmup count once (add-path override)', () => {
    const onChange = vi.fn()
    const { rerender } = render(<MesoEditor days={days} {...props} onChange={onChange} />)
    const newEx = {
      id: 'z', name: 'Uj gyakorlat', muscle: 'chest-mid', warmupSets: 2, workingSets: 3,
      repMin: 6, repMax: 8, targetRIR: 2, type: 'compound' as const,
    }
    const nextDays = days.map((d) => (d.day === 'H' ? { ...d, exercises: [...d.exercises, newEx] } : d))
    rerender(<MesoEditor days={nextDays} {...props} onChange={onChange} />)
    // day H already has two chest compounds ('a','b') → the group is hit → the new
    // compound's suggestion is 1, which differs from its default warmupSets 2.
    expect(onChange).toHaveBeenCalledWith('H', 'z', { warmupSets: 1 })
  })

  it('accordion shows the warmup suggestion chip when it differs from the stored count, and tapping it applies it', () => {
    const onChange = vi.fn()
    const customDays: MesoDay[] = [
      {
        day: 'H', type: 'Push A', muscle: 'chest', exerciseCount: 2, current: true,
        exercises: [
          { id: 'a', name: 'Gyak a', muscle: 'chest-mid', warmupSets: 1, workingSets: 6, repMin: 8, repMax: 10, targetRIR: 0, type: 'compound' },
          { id: 'b', name: 'Gyak b', muscle: 'chest-upper', warmupSets: 2, workingSets: 6, repMin: 8, repMax: 10, targetRIR: 0, type: 'compound' },
        ],
      },
    ]
    render(<MesoEditor days={customDays} {...props} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /Gyak b · szerkesztés/ }))
    expect(screen.getByText(/↺ javaslat: 1/)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Gyak b · bemelegítés javaslat alkalmazása'))
    expect(onChange).toHaveBeenCalledWith('H', 'b', { warmupSets: 1 })
  })

  it('renders the Struktúra lint card (mezo-oyhy.2)', () => {
    render(<MesoEditor days={days} {...props} />)
    expect(screen.getByRole('button', { name: /Struktúra/i })).toBeInTheDocument()
  })

  // mezo-d20.14 review, I2: ProgramDayView edits ONE day but must judge it against the whole
  // week — every week-scope derivation reads `weekDays`, the day tabs/breakdown read `days`.
  it('weekDays scopes the hero totals and the weekly bands to the week, not to the edited day', () => {
    render(<MesoEditor days={[days[0]]} weekDays={days} {...props} />)
    // hero: the WEEK's 25 sets (12 H + 13 Cs) and 2 training days, not Monday's 12 / 1
    expect(screen.getByText(/25 szett/)).toBeInTheDocument()
    expect(screen.getByText(/2 edzésnap/)).toBeInTheDocument()
    // bands: back is on Cs only — with a Monday-only week it would not appear at all
    const bands = screen.getByRole('group', { name: 'Heti szetek · izmonként' })
    expect(within(bands).getByText('Hát')).toBeInTheDocument()
    expect(within(bands).getByText(/^13 →/)).toBeInTheDocument()
    // a single edited day has no tab strip at all — a lone tab switches nothing (mezo-d20.15)
    expect(screen.queryAllByRole('button', { name: /^(H|K|Cs) ·/ })).toHaveLength(0)
  })

  it('does not render the peak-week fit card when nothing projects out of band (mezo-3m5m, GD6)', () => {
    render(<MesoEditor days={days} {...props} />)
    expect(screen.queryByText(/Csúcshét/i)).not.toBeInTheDocument()
  })

  it('threads priorities/volumePerMuscle into the peak-week fit card (mezo-3m5m, GD6)', () => {
    // Same fixture + hand-computed projection as peakWeekFit.test.ts's primary case: back
    // Emphasize -> target 40 -> Szo projects to 109 min (over), Sze to 29 min (under) -> 2 days.
    const peakDays: MesoDay[] = [
      {
        day: 'Szo', type: 'Pull', muscle: 'back', exerciseCount: 2, current: true,
        exercises: [
          { id: 'p1', name: 'Row', muscle: 'back-mid', warmupSets: 2, workingSets: 3, repMin: 8, repMax: 10, targetRIR: 2, type: 'compound' },
          { id: 'p2', name: 'Pulldown', muscle: 'back-wide', warmupSets: 1, workingSets: 2, repMin: 8, repMax: 10, targetRIR: 2, type: 'compound' },
        ],
      },
      {
        day: 'Sze', type: 'Pull', muscle: 'back', exerciseCount: 1,
        exercises: [
          { id: 'p3', name: 'Deadlift', muscle: 'lats', warmupSets: 1, workingSets: 1, repMin: 8, repMax: 10, targetRIR: 2, type: 'compound' },
        ],
      },
    ]
    render(
      <MesoEditor
        days={peakDays} {...props}
        priorities={{ back: 'emphasize' }}
        volumePerMuscle={{ back: { mev: 5, mav: 20, mrv: 40 } }}
      />,
    )
    expect(screen.getByRole('button', { name: /Csúcshét/i })).toBeInTheDocument()
    expect(screen.getByText('2 nap')).toBeInTheDocument()
  })
})
