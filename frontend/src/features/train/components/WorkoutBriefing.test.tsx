import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Challenge } from '@/data/types'
import { WorkoutBriefing, type WorkoutBriefingProps } from './WorkoutBriefing'

const ch = (id: string, exerciseId: string, over: Partial<Challenge> = {}): Challenge => ({
  id, type: 'PR', typeLabel: 'PR-attempt', exerciseId, exercise: `Gyakorlat ${exerciseId}`, target: '107.5 kg × 8',
  confidence: 0.72, risk: 'low', why: 'mert', refs: [], glory: 'csúcs', ...over,
})

function renderBriefing(over: Partial<WorkoutBriefingProps> = {}) {
  const props: WorkoutBriefingProps = {
    title: 'Pull Day', eyebrow: 'PULL DAY · 3. HÉT', minutes: [70, 85], exerciseCount: 2, setCount: 7,
    niggle: null, challenges: [ch('a', 'ex1'), ch('b', 'ex2', { type: 'Depth', typeLabel: 'Mélység' })],
    pending: false, failed: false, ticked: { a: true, b: false }, onToggle: vi.fn(),
    overload: null,
    exercises: [
      { id: 'ex1', name: 'Chest Supported Row', muscle: 'back-mid', sets: 4, goal: '105 × 10', chip: { text: '↑ +2,5 kg', tone: 'up' } },
      { id: 'ex2', name: 'Lat Pulldown', muscle: 'back-wide', sets: 3, goal: null, chip: null },
    ],
    onBack: vi.fn(), onStart: vi.fn(), ...over,
  }
  render(<WorkoutBriefing {...props} />)
  return props
}

describe('WorkoutBriefing', () => {
  it('shows the duration band and the counts', () => {
    renderBriefing()
    expect(screen.getByLabelText(/várható időtartam/)).toHaveTextContent('70–85perc')
    expect(screen.getByText('2 gyakorlat')).toBeInTheDocument()
    expect(screen.getByText('7 szett')).toBeInTheDocument()
  })

  it('never prints a number while the band is unknown', () => {
    renderBriefing({ minutes: null })
    expect(screen.getByLabelText(/várható időtartam/)).toHaveTextContent('…')
  })

  it('counts the ticked challenges on the Indulás button and starts on tap', async () => {
    const user = userEvent.setup()
    const props = renderBriefing()
    await user.click(screen.getByRole('button', { name: 'Indulás · 1 küldetéssel' }))
    expect(props.onStart).toHaveBeenCalledTimes(1)
  })

  it('says "Indulás küldetés nélkül" when nothing is ticked', () => {
    renderBriefing({ ticked: {} })
    expect(screen.getByRole('button', { name: 'Indulás küldetés nélkül' })).toBeInTheDocument()
  })

  it('toggling a row reports its id', async () => {
    const user = userEvent.setup()
    const props = renderBriefing()
    await user.click(screen.getByRole('button', { name: /Mélység: vállalom$/ }))
    expect(props.onToggle).toHaveBeenCalledWith('b')
  })

  it('marks only the exercises a ticked challenge targets', () => {
    renderBriefing()
    expect(screen.getAllByRole('img', { name: 'Van vállalt küldetés' })).toHaveLength(1)
    expect(screen.getByText('↑ +2,5 kg')).toBeInTheDocument()
  })

  it('pending, failed and empty challenge states', () => {
    const { unmount } = render(<WorkoutBriefing {...renderBriefingProps({ challenges: [], failed: true, onRetry: vi.fn() })} />)
    expect(screen.getByText(/nem jöttek le/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Újra' })).toBeInTheDocument()
    unmount()
    render(<WorkoutBriefing {...renderBriefingProps({ challenges: [] })} />)
    expect(screen.getByText(/Ma nincs küldetés/)).toBeInTheDocument()
  })

  it('renders the niggle callout only when one is active', () => {
    renderBriefing({ niggle: { muscle: 'shoulder', muscleLabel: 'Jobb váll', detail: 'óvatosan' } })
    expect(screen.getByRole('note', { name: 'Sérülés-figyelmeztetés' })).toHaveTextContent('Jobb váll aktív · óvatosan')
  })
})

function renderBriefingProps(over: Partial<WorkoutBriefingProps>): WorkoutBriefingProps {
  return {
    title: 'Pull Day', eyebrow: 'X', minutes: [70, 85], exerciseCount: 0, setCount: 0, niggle: null,
    challenges: [], pending: false, failed: false, ticked: {}, onToggle: vi.fn(), overload: null,
    exercises: [], onBack: vi.fn(), onStart: vi.fn(), ...over,
  }
}
