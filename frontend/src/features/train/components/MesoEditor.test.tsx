import { fireEvent, render, screen } from '@testing-library/react'
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
  it('flags warnings: chest 12 failure sets = 100% (near, not over) but Cs back 13 sets breaks the session cap', () => {
    render(<MesoEditor days={days} {...props} />)
    expect(screen.getByText(/1 jelzés/)).toBeInTheDocument()
  })
  it('collapsed rows expand one at a time', () => {
    render(<MesoEditor days={days} {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /Gyak a/ }))
    expect(screen.getByRole('button', { name: /Volume/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Gyak b/ }))
    expect(screen.getAllByRole('button', { name: /Volume/ })).toHaveLength(1)
  })
  it('add button forwards the active day key', () => {
    const onAddClick = vi.fn()
    render(<MesoEditor days={days} {...props} onAddClick={onAddClick} />)
    fireEvent.click(screen.getByRole('button', { name: /Gyakorlat hozzáadása/ }))
    expect(onAddClick).toHaveBeenCalledWith('H')
  })
})
