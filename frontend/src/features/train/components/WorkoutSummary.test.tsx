import { fireEvent, render, screen, within } from '@testing-library/react'
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

  it('closed mode: no finish CTA, and the swimlane anchors each exercise on its top set', () => {
    render(<WorkoutSummary title="Pull Day A" eyebrow="Lezárva · ma" mode="closed"
      exercises={exercises} challenges={challenges} onExit={() => {}} />)
    expect(screen.queryByRole('button', { name: /Edzés lezárása/ })).toBeNull()
    const tile = screen.getByRole('button', { name: /Bench Press/ })
    expect(tile.querySelector('.top')!.textContent).toMatch(/80\s*×\s*8/)
    // The partial exercise's foot counts what was logged against what was planned.
    expect(within(tile).getByText('1/4 szett')).toBeInTheDocument()
    // …and the unlogged slots show as dashed bars, never as a warning.
    expect(tile.querySelectorAll('.wr-setbars i.miss')).toHaveLength(3)
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

  it('a set with a null rir (warmup) shows no RIR fragment on the exercise view', async () => {
    const user = userEvent.setup()
    const withWarmup = [
      { id: 'a', name: 'Bench Press', muscle: 'chest-mid', plannedSets: 2, sets: [{ weight: 40, reps: 10, rir: null }], skipped: false },
    ]
    render(<WorkoutSummary title="Pull Day A" eyebrow="Lezárva · ma" mode="closed"
      exercises={withWarmup} challenges={[]} onExit={() => {}} />)
    await user.click(screen.getByRole('button', { name: /Bench Press/ }))
    const set = document.querySelector('.wr-set') as HTMLElement
    expect(set.textContent).not.toContain('RIR')
    expect(set.querySelector('.rir')).toBeNull()
  })

  it('an exercise with nothing logged reads "nincs szett" and dims, never strikes a number', () => {
    const abandoned = [
      { id: 'a', name: 'Bench Press', muscle: 'chest-mid', plannedSets: 4, sets: [], skipped: true },
    ]
    render(<WorkoutSummary title="Pull Day A" eyebrow="Lezárva · ma" mode="closed"
      exercises={abandoned} challenges={[]} onExit={() => {}} />)
    const tile = screen.getByRole('button', { name: /Bench Press/ })
    expect(tile.className).toContain('dead')
    expect(within(tile).getByText('nincs szett')).toBeInTheDocument()
    expect(tile.querySelector('.top')!.textContent).toBe('—')
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
    const cells = document.querySelectorAll('.mz-statstrip .mz-statcell')
    expect(cells[3].textContent).toContain('–')
  })

  // mezo-d20.8.2.1 removed the workout-note textarea because it accepted what you typed and
  // dropped it. mezo-d20.8.2.2 brings it back WIRED — so the guard flips from "the field must
  // not exist" to "the field must be connected to something that keeps it".
  it('offers a wired note field in closing mode, and none when the page owns no draft', () => {
    const typed: string[] = []
    const { unmount } = render(<WorkoutSummary title="Pull Day A" eyebrow="Edzés vége" mode="closing"
      exercises={exercises} challenges={challenges} draftNote="" onDraftNote={(v) => typed.push(v)}
      onFinish={() => {}} onBack={() => {}} onExit={() => {}} />)
    expect(screen.getByText('Hogy ment?')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Hogy ment?'), { target: { value: 'Nehéz nap volt.' } })
    expect(typed).toEqual(['Nehéz nap volt.'])
    unmount()

    // No handler → no field. A caller that cannot keep the text must not offer the box.
    render(<WorkoutSummary title="Pull Day A" eyebrow="Edzés vége" mode="closing"
      exercises={exercises} challenges={challenges} onFinish={() => {}} onBack={() => {}} onExit={() => {}} />)
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('renders the saved note read-only in closed mode, and nothing when there is none', () => {
    const { unmount } = render(<WorkoutSummary title="Pull Day A" eyebrow="Lezárva · ma" mode="closed"
      exercises={exercises} challenges={challenges} note="Öt órát aludtam." onExit={() => {}} />)
    expect(screen.getByText('Öt órát aludtam.')).toBeInTheDocument()
    expect(screen.getByText('Amit aznap írtál')).toBeInTheDocument()
    expect(document.querySelector('textarea')).toBeNull()
    unmount()

    // ADR 0010: an absent note is not an empty placeholder — and without an editor (the
    // just-finished summary) there is no `＋ Jegyzet` either.
    render(<WorkoutSummary title="Pull Day A" eyebrow="Lezárva · ma" mode="closed"
      exercises={exercises} challenges={challenges} note={null} onExit={() => {}} />)
    expect(document.querySelector('.wsum-note-r')).toBeNull()
    expect(document.querySelector('.wsum-note-add')).toBeNull()
  })

  it('offers ＋ Jegyzet only where editing is possible, and swaps in the editor', () => {
    let editing = false
    const { rerender } = render(<WorkoutSummary title="Pull Day A" eyebrow="Lezárva · ma" mode="closed"
      exercises={exercises} challenges={challenges} note={null}
      onEditNote={() => { editing = true }} onExit={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Jegyzet ehhez az edzéshez/ }))
    expect(editing).toBe(true)

    rerender(<WorkoutSummary title="Pull Day A" eyebrow="Lezárva · ma" mode="closed"
      exercises={exercises} challenges={challenges} note={null} noteEditing
      draftNote="pótolva" onDraftNote={() => {}} onNoteSave={() => {}} onNoteCancel={() => {}}
      onEditNote={() => {}} onExit={() => {}} />)
    expect((screen.getByLabelText('Hogy ment?') as HTMLTextAreaElement).value).toBe('pótolva')
    expect(screen.getByRole('button', { name: 'Mentés' })).toBeInTheDocument()
    expect(document.querySelector('.wsum-note-add')).toBeNull()
  })

  // The comparison tile and the stepping are the REVISIT's own; the closing report gets neither.
  it('keeps the comparison out of the closing report', () => {
    render(<WorkoutSummary title="Pull Day A" eyebrow="Edzés vége" mode="closing"
      exercises={exercises} challenges={challenges} comparison={null} onFinish={() => {}} onBack={() => {}} onExit={() => {}} />)
    expect(document.querySelector('.wr-cmp')).toBeNull()
    expect(document.querySelector('.wr-stepnav')).toBeNull()
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

    it('stamps the swimlane tile and golds the set itself on the exercise view', async () => {
      const user = userEvent.setup()
      const recordOnSet: Medal[] = [{
        type: 'WEIGHT', tier: 'RECORD', exerciseName: 'Bench Press',
        date: '2026-07-20', setIndex: 0, value: 80, unit: 'KG', weightKg: 80, reps: 8, previousValue: 77.5,
      }]
      render(<WorkoutSummary title="Pull Day A" eyebrow="Edzés vége" mode="closing"
        exercises={exercises} challenges={challenges} medals={recordOnSet} onFinish={() => {}} onBack={() => {}} onExit={() => {}} />)
      const tile = screen.getByRole('button', { name: /Bench Press/ })
      expect(within(tile).getByText('REKORD')).toBeInTheDocument()
      expect(tile.querySelectorAll('.wr-setbars i.med')).toHaveLength(1)

      await user.click(tile)
      expect((document.querySelector('.wr-set') as HTMLElement).className).toContain('rec')
    })
  })
})
