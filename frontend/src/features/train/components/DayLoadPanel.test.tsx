import { render, screen, within } from '@testing-library/react'
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
    expect(screen.getByText('12 szett · ~53 perc · 3 gyakorlat')).toBeInTheDocument()
    // the verdict counts the muscles at or over the per-session limit
    expect(screen.getByText('1 izom közel jár a napi határhoz.')).toBeInTheDocument()
  })

  test('a day well under the limit says so', () => {
    const light: MesoDay = { ...DAY, exercises: [ex('c', 'Press', 'shoulder', 3)] }
    render(<DayLoadPanel day={light} minutes={20} onBack={vi.fn()} />)
    expect(screen.getByText('Egy izom sincs a napi határ közelében.')).toBeInTheDocument()
  })

  test('one card per muscle group, sets desc, with the cap denominator', () => {
    render(<DayLoadPanel day={DAY} minutes={53} onBack={vi.fn()} />)
    const cards = screen.getAllByTestId('day-load-card')
    expect(cards.map((c) => c.getAttribute('data-group'))).toEqual(['back', 'shoulder'])
    expect(within(cards[0]).getByText('9')).toBeInTheDocument()
    for (const c of cards) expect(within(c).getByText('/ ~8')).toBeInTheDocument()
    // the level is measured against the limit's waterline, one set below the rim
    expect((cards[0].querySelector('.fo-wlv > i') as HTMLElement).style.width).toBe('100%')
    expect((cards[1].querySelector('.fo-wlv > u') as HTMLElement).style.left).toBe(`${(8 / 9) * 100}%`)
  })

  test('a group over the cap is called out', () => {
    render(<DayLoadPanel day={DAY} minutes={53} onBack={vi.fn()} />)
    expect(screen.getByText('a határ fölött')).toHaveClass('fo-st', 'warn')
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
