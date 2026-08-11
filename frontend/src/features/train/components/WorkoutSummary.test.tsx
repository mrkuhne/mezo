import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { WorkoutSummary } from '@/features/train/components/WorkoutSummary'
import type { Medal } from '@/data/train/medalTypes'

const exercises = [
  { id: 'a', name: 'Bench Press', muscle: 'chest-mid', plannedSets: 4, sets: [{ weight: 80, reps: 8, rir: 1 }], skipped: false },
  { id: 'b', name: 'Dead Hang', muscle: 'back-wide', plannedSets: 2, sets: [], skipped: true },
]
const challenges = [
  { id: 'c1', typeLabel: 'PR', exercise: 'Bench Press', target: '85 kg × 8', state: 'hit' as const },
  { id: 'c2', typeLabel: 'Depth', exercise: 'Face Pull', target: 'RIR 0', state: 'skipped' as const },
]
const medals: Medal[] = [
  {
    type: 'SESSION_VOLUME', tier: 'RECORD', exerciseName: 'Bench Press',
    date: '2026-07-20', value: 1250, unit: 'KG', previousValue: 1180, previousDate: '2026-07-13',
  },
  {
    type: 'TARGET_HIT', tier: 'TARGET', exerciseName: 'Bench Press',
    date: '2026-07-20', setIndex: 0, value: 8, unit: 'REPS', weightKg: 80, reps: 8, previousValue: null,
  },
  {
    type: 'TARGET_HIT', tier: 'TARGET', exerciseName: 'Row',
    date: '2026-07-20', setIndex: 2, value: 10, unit: 'REPS', weightKg: 60, reps: 10, previousValue: null,
  },
]

describe('WorkoutSummary', () => {
  it('closing mode: hero counts, region pills, challenge outcomes, finish CTA', async () => {
    const user = userEvent.setup()
    const onFinish = vi.fn()
    render(<WorkoutSummary title="Pull Day A" eyebrow="Edzés vége" mode="closing" durationMin={65}
      exercises={exercises} challenges={challenges} onFinish={onFinish} onBack={() => {}} onExit={() => {}} />)
    // hero: 1/6 sets + duration ("1" alone is ambiguous — Ø RIR cell also shows 1)
    const num = document.querySelector('.wsum-num') as HTMLElement
    expect(num.textContent).toBe('1/6szett')
    expect(screen.getByText(/~65 perc/)).toBeInTheDocument()
    // region pills: Mell live (has a set-count child → regex), Hát off (bare label).
    // Scoped to .wsum-regrow — "Mell" also appears inside the exercise's own muscle
    // tag ("Mell (közép)"), which would otherwise make the query ambiguous.
    const regionRow = document.querySelector('.wsum-regrow') as HTMLElement
    expect(within(regionRow).getByText(/Mell/)).toBeInTheDocument()
    expect(within(regionRow).getByText('Hát')).toBeInTheDocument()
    // challenge outcomes keep the existing vocabulary
    expect(screen.getByText('megcsináltad')).toBeInTheDocument()
    expect(screen.getByText('skippelted')).toBeInTheDocument()
    // abandoned exercise
    expect(screen.getByText('kihagyva')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Edzés lezárása/ }))
    expect(onFinish).toHaveBeenCalledOnce()
  })

  it('closed mode: no finish CTA, set chips render in full', () => {
    render(<WorkoutSummary title="Pull Day A" eyebrow="Lezárva · ma" mode="closed"
      exercises={exercises} challenges={challenges} onExit={() => {}} />)
    expect(screen.queryByRole('button', { name: /Edzés lezárása/ })).toBeNull()
    expect(screen.getByText(/80\s*×\s*8/)).toBeInTheDocument()
    expect(screen.getByText('@1')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Edzés-jegyzet/)).toBeNull() // note is closing-only
    // ghost chip for the partial Bench Press (plannedSets 4, only 1 logged)
    expect(screen.getByText('— kimaradt')).toBeInTheDocument()
    // the "1/4" set counter carries the .part class on that same partial exercise
    const partCounter = document.querySelector('.wsum-exc .setn.part') as HTMLElement
    expect(partCounter).not.toBeNull()
    expect(partCounter.textContent).toBe('1/4')
  })

  it('omits the "Kihívások" section entirely when challenges is empty', () => {
    render(<WorkoutSummary title="Pull Day A" eyebrow="Lezárva · ma" mode="closed"
      exercises={exercises} challenges={[]} onExit={() => {}} />)
    expect(screen.queryByText('Kihívások')).toBeNull()
  })

  it('the hero number carries a full aria-label for screen readers, decorative markup hidden', () => {
    render(<WorkoutSummary title="Pull Day A" eyebrow="Edzés vége" mode="closing" durationMin={65}
      exercises={exercises} challenges={challenges} onFinish={() => {}} onBack={() => {}} onExit={() => {}} />)
    const num = document.querySelector('.wsum-num') as HTMLElement
    expect(num.getAttribute('aria-label')).toBe('1 / 6 szett')
    expect(num.querySelector(':scope > [aria-hidden="true"]')).not.toBeNull()
    expect(num.textContent).toBe('1/6szett') // visual layout unchanged
  })

  it('a chip with a null rir (warmup) renders no "@" fragment', () => {
    const withWarmup = [
      { id: 'a', name: 'Bench Press', muscle: 'chest-mid', plannedSets: 2, sets: [{ weight: 40, reps: 10, rir: null }], skipped: false },
    ]
    render(<WorkoutSummary title="Pull Day A" eyebrow="Lezárva · ma" mode="closed"
      exercises={withWarmup} challenges={[]} onExit={() => {}} />)
    const chip = screen.getByText(/40\s*×\s*10/).closest('.wsum-chip') as HTMLElement
    expect(chip.textContent).not.toContain('@')
    expect(chip.querySelector('.rir')).toBeNull()
  })

  it('a partially-logged exercise the user explicitly skipped keeps the "· kihagyva" marker', () => {
    const partiallySkipped = [
      { id: 'a', name: 'Bench Press', muscle: 'chest-mid', plannedSets: 4, sets: [{ weight: 80, reps: 8, rir: 1 }], skipped: true },
    ]
    render(<WorkoutSummary title="Pull Day A" eyebrow="Lezárva · ma" mode="closed"
      exercises={partiallySkipped} challenges={[]} onExit={() => {}} />)
    const counter = document.querySelector('.wsum-exc .setn') as HTMLElement
    expect(counter.textContent).toBe('1/4 · kihagyva')
  })

  it('omits the "~N perc" fragment when durationMin is not provided', () => {
    render(<WorkoutSummary title="Pull Day A" eyebrow="Edzés vége" mode="closing"
      exercises={exercises} challenges={challenges} onFinish={() => {}} onBack={() => {}} onExit={() => {}} />)
    expect(screen.queryByText(/perc/)).toBeNull()
  })

  it('shows a dash in the Ø RIR strip cell when no sets are logged', () => {
    const noSets = exercises.map((e) => ({ ...e, sets: [] }))
    render(<WorkoutSummary title="Pull Day A" eyebrow="Lezárva · ma" mode="closed"
      exercises={noSets} challenges={challenges} onExit={() => {}} />)
    const cells = document.querySelectorAll('.wsum-strip .cell')
    expect(cells[3].textContent).toContain('–')
  })

  it('closing mode still renders the note textarea', () => {
    render(<WorkoutSummary title="Pull Day A" eyebrow="Edzés vége" mode="closing"
      exercises={exercises} challenges={challenges} onFinish={() => {}} onBack={() => {}} onExit={() => {}} />)
    expect(screen.getByLabelText('Edzés-jegyzet · opcionális')).toBeInTheDocument()
  })

  describe('medals (mezo-wp6n / mezo-w943 split)', () => {
    it('RECORD medal renders as a celebration card with value + previous', () => {
      render(<WorkoutSummary title="Pull Day A" eyebrow="Edzés vége" mode="closing"
        exercises={exercises} challenges={challenges} medals={medals} onFinish={() => {}} onBack={() => {}} onExit={() => {}} />)
      const section = screen.getByText('Medálok').closest('.wsum-sec') as HTMLElement
      expect(within(section).getByText('Volumen-rekord')).toBeInTheDocument()
      expect(within(section).getByText(/1[\s ]?250/)).toBeInTheDocument()
      expect(within(section).getByText(/előző:/)).toBeInTheDocument()
    })

    it('TARGET_HITs collapse into a single summary row with per-exercise chips', () => {
      render(<WorkoutSummary title="Pull Day A" eyebrow="Edzés vége" mode="closing"
        exercises={exercises} challenges={challenges} medals={medals} onFinish={() => {}} onBack={() => {}} onExit={() => {}} />)
      expect(screen.getByText('2 célszett teljesítve')).toBeInTheDocument()
      expect(screen.getByText('Bench Press ×1')).toBeInTheDocument()
      expect(screen.getByText('Row ×1')).toBeInTheDocument()
      // no per-TARGET rows anymore
      expect(screen.queryAllByText('Cél teljesítve')).toHaveLength(0)
    })

    it('renders no medal section and no title suffix when medals is empty', () => {
      render(<WorkoutSummary title="Pull Day A" eyebrow="Edzés vége" mode="closing"
        exercises={exercises} challenges={challenges} medals={[]} onFinish={() => {}} onBack={() => {}} onExit={() => {}} />)
      expect(screen.getByText('Pull Day A')).toBeInTheDocument()
      expect(screen.queryByText(/medál/)).not.toBeInTheDocument()
      expect(screen.queryByText('Medálok')).not.toBeInTheDocument()
    })

    it('marks the record set chip on the exercise card', () => {
      const recordOnSet: Medal[] = [{
        type: 'WEIGHT', tier: 'RECORD', exerciseName: 'Bench Press',
        date: '2026-07-20', setIndex: 0, value: 80, unit: 'KG', weightKg: 80, reps: 8, previousValue: 77.5,
      }]
      render(<WorkoutSummary title="Pull Day A" eyebrow="Edzés vége" mode="closing"
        exercises={exercises} challenges={challenges} medals={recordOnSet} onFinish={() => {}} onBack={() => {}} onExit={() => {}} />)
      const chip = screen.getByText(/80\s*×\s*8/).closest('.wsum-chip') as HTMLElement
      expect(chip.className).toContain('rec')
    })
  })
})
