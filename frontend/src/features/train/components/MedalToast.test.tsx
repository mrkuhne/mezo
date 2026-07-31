import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MedalToast } from '@/features/train/components/MedalToast'
import type { Medal } from '@/data/train/medalTypes'

const weightMedal: Medal = {
  type: 'WEIGHT', tier: 'RECORD', exerciseName: 'Chest Supported Row',
  date: '2026-07-20', setIndex: 2,
  value: 102.5, unit: 'KG', weightKg: 102.5, reps: 8,
  previousValue: 97.5, previousDate: '2026-06-08',
}

describe('MedalToast', () => {
  it('renders the eyebrow, the achieving set and the previous value + date', () => {
    render(<MedalToast medal={weightMedal} />)
    expect(screen.getByText('ÚJ REKORD · SÚLY')).toBeInTheDocument()
    expect(screen.getByText('102,5 kg × 8')).toBeInTheDocument()
    expect(screen.getByText(/Eddigi legjobbad 97,5 kg volt/)).toBeInTheDocument()
    expect(screen.getByText(/Jún 8 óta állt/)).toBeInTheDocument()
  })

  it('does not render the extra-count clause when extraCount is 0', () => {
    render(<MedalToast medal={weightMedal} />)
    expect(screen.queryByText(/további medál/)).not.toBeInTheDocument()
  })

  it('appends the extra-count clause when extraCount > 0', () => {
    render(<MedalToast medal={weightMedal} extraCount={2} />)
    expect(screen.getByText(/\+2 további medál/)).toBeInTheDocument()
  })

  it('drops the "óta állt" clause when previousDate is null (mock mode)', () => {
    render(<MedalToast medal={{ ...weightMedal, previousDate: null }} />)
    expect(screen.getByText(/Eddigi legjobbad 97,5 kg volt\./)).toBeInTheDocument()
    expect(screen.queryByText(/óta állt/)).not.toBeInTheDocument()
    expect(screen.queryByText(/null/)).not.toBeInTheDocument()
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument()
  })

  it('renders a different eyebrow + rep-based headline for a REPS_AT_WEIGHT medal', () => {
    const repsMedal: Medal = {
      type: 'REPS_AT_WEIGHT', tier: 'RECORD', exerciseName: 'Lat Pulldown · Pronated',
      date: '2026-06-29', setIndex: 3,
      value: 12, unit: 'REPS', weightKg: 74.5, reps: 12,
      previousValue: 10, previousDate: '2026-06-15',
    }
    render(<MedalToast medal={repsMedal} />)
    expect(screen.getByText('ÚJ REKORD · REP')).toBeInTheDocument()
    expect(screen.getByText('74,5 kg × 12')).toBeInTheDocument()
    expect(screen.getByText(/Eddigi legjobbad 10 rep volt/)).toBeInTheDocument()
  })
})
