import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import type { GymExercise, MesoDay } from '@/data/types'
import { DayLoadPanel } from '@/features/train/components/DayLoadPanel'

function ex(id: string, name: string, muscle: string, workingSets: number): GymExercise {
  return { id, name, muscle, warmupSets: 1, workingSets, repMin: 8, repMax: 10, targetRIR: 1, anchorWeightKg: null, type: 'compound' }
}

const DAY: MesoDay = {
  day: 'Hét', type: 'Upper', muscle: 'back', exerciseCount: 3,
  exercises: [ex('a', 'Evezés', 'back', 7), ex('b', 'Pulldown', 'back', 2), ex('c', 'Press', 'shoulder', 3)],
}

describe('DayLoadPanel', () => {
  test('the hero carries the day and its totals', () => {
    render(<DayLoadPanel day={DAY} minutes={53} onBack={vi.fn()} />)
    expect(screen.getByText('Napi terhelés · Hét · Upper')).toBeInTheDocument()
    expect(screen.getByText('szett · ~53 perc · 3 gyakorlat')).toBeInTheDocument()
  })

  test('one card per muscle group, sets desc, with the cap denominator', () => {
    render(<DayLoadPanel day={DAY} minutes={53} onBack={vi.fn()} />)
    const cards = screen.getAllByTestId('day-load-card')
    expect(cards.map((c) => c.getAttribute('data-group'))).toEqual(['back', 'shoulder'])
    expect(screen.getByText('9')).toBeInTheDocument()
    expect(screen.getAllByText('/ ~8')).toHaveLength(2)
  })

  test('a group over the cap is called out', () => {
    render(<DayLoadPanel day={DAY} minutes={53} onBack={vi.fn()} />)
    expect(screen.getByText('a plafon fölött')).toBeInTheDocument()
  })

  test('each card lists the exercises behind the number', () => {
    render(<DayLoadPanel day={DAY} minutes={53} onBack={vi.fn()} />)
    expect(screen.getByText('Evezés +7')).toBeInTheDocument()
    expect(screen.getByText('Pulldown +2')).toBeInTheDocument()
    expect(screen.getByText('Press +3')).toBeInTheDocument()
  })

  test('back closes the panel', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    render(<DayLoadPanel day={DAY} minutes={53} onBack={onBack} />)
    const back = screen.getByRole('button', { name: 'Vissza' })
    expect(back).toHaveTextContent('‹ Upper')
    await user.click(back)
    expect(onBack).toHaveBeenCalled()
  })
})
