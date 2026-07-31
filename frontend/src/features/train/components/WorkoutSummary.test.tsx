import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { WorkoutSummary } from '@/features/train/components/WorkoutSummary'
import type { Medal } from '@/data/train/medalTypes'

const exercises = [
  { id: 'a', name: 'Bench Press', plannedSets: 4, sets: [{ weight: 80, reps: 8, rir: 1 }], skipped: false },
  { id: 'b', name: 'Dead Hang', plannedSets: 2, sets: [], skipped: true },
]
const challenges = [
  { id: 'c1', typeLabel: 'PR', exercise: 'Bench Press', target: '85 kg × 8', state: 'hit' as const },
  { id: 'c2', typeLabel: 'Depth', exercise: 'Face Pull', target: 'RIR 0', state: 'skipped' as const },
]
// One RECORD medal + two TARGET_HIT medals — the mix the brief describes
// (SESSION_VOLUME only ever appears in the summary, never on a set-log).
const medals: Medal[] = [
  {
    type: 'SESSION_VOLUME', tier: 'RECORD', exerciseName: 'Bench Press',
    date: '2026-07-20', value: 1250, unit: 'KG', previousValue: 1180, previousDate: '2026-07-13',
  },
  {
    type: 'TARGET_HIT', tier: 'TARGET', exerciseName: 'Bench Press',
    date: '2026-07-20', setIndex: 1, value: 8, unit: 'REPS', weightKg: 80, reps: 8, previousValue: null,
  },
  {
    type: 'TARGET_HIT', tier: 'TARGET', exerciseName: 'Row',
    date: '2026-07-20', setIndex: 2, value: 10, unit: 'REPS', weightKg: 60, reps: 10, previousValue: null,
  },
]

describe('WorkoutSummary', () => {
  it('closing mode: stats + challenge outcomes + the finish CTA', async () => {
    const user = userEvent.setup()
    const onFinish = vi.fn()
    render(<WorkoutSummary title="Pull Day A" eyebrow="Edzés vége · Pull Day A" mode="closing"
      exercises={exercises} challenges={challenges} onFinish={onFinish} onBack={() => {}} onExit={() => {}} />)
    expect(screen.getByText('Mai mérleg')).toBeInTheDocument()
    expect(screen.getByText('megcsináltad')).toBeInTheDocument()
    expect(screen.getByText('skippelted')).toBeInTheDocument()
    expect(screen.getByText('kihagyva')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Edzés lezárása/ }))
    expect(onFinish).toHaveBeenCalledOnce()
  })
  it('closed mode: no finish CTA, set lines render', () => {
    render(<WorkoutSummary title="Pull Day A" eyebrow="Lezárva · ma" mode="closed" showSetLines
      exercises={exercises} challenges={challenges} onExit={() => {}} />)
    expect(screen.queryByRole('button', { name: /Edzés lezárása/ })).toBeNull()
    expect(screen.getByText(/80.*×.*8.*@RIR 1/)).toBeInTheDocument()
  })

  describe('medals (mezo-wp6n)', () => {
    it('appends the "· N medál" title suffix when medals are present', () => {
      render(<WorkoutSummary title="Pull Day A" eyebrow="Edzés vége" mode="closing"
        exercises={exercises} challenges={challenges} medals={medals} onExit={() => {}} />)
      expect(screen.getByText('Pull Day A · 3 medál')).toBeInTheDocument()
    })

    it('renders neither the suffix nor the medal block when medals is empty', () => {
      render(<WorkoutSummary title="Pull Day A" eyebrow="Edzés vége" mode="closing"
        exercises={exercises} challenges={challenges} medals={[]} onExit={() => {}} />)
      expect(screen.getByText('Pull Day A')).toBeInTheDocument()
      expect(screen.queryByText(/medál/)).not.toBeInTheDocument()
      expect(screen.queryByText('Medálok')).not.toBeInTheDocument()
    })

    it('renders each medal row with its exercise name and Hungarian type label', () => {
      render(<WorkoutSummary title="Pull Day A" eyebrow="Edzés vége" mode="closing"
        exercises={exercises} challenges={challenges} medals={medals} onExit={() => {}} />)
      const section = screen.getByText('Medálok').parentElement as HTMLElement
      expect(within(section).getByText('Volumen-rekord')).toBeInTheDocument()
      expect(within(section).getAllByText('Cél teljesítve')).toHaveLength(2)
      expect(within(section).getAllByText('Bench Press')).toHaveLength(2)
      expect(within(section).getByText('Row')).toBeInTheDocument()
    })

    it('gives a RECORD row and a TARGET_HIT row different marks and colors — the load-bearing two-tier split', () => {
      render(<WorkoutSummary title="Pull Day A" eyebrow="Edzés vége" mode="closing"
        exercises={exercises} challenges={challenges} medals={medals} onExit={() => {}} />)
      const section = screen.getByText('Medálok').parentElement as HTMLElement
      const recordGlyph = within(section).getByText('🏅')
      const targetGlyphs = within(section).getAllByText('✓')
      expect(targetGlyphs).toHaveLength(2)
      expect(recordGlyph.style.color).not.toBe(targetGlyphs[0].style.color)
      expect(recordGlyph.style.color).not.toBe('')
      expect(targetGlyphs[0].style.color).not.toBe('')
    })
  })
})
