import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { WorkoutSummary } from '@/features/train/components/WorkoutSummary'
import { deriveSummaryStats } from '@/features/train/logic/summaryStats'
import { deriveComparison } from '@/features/train/logic/workoutComparison'
import type { Medal } from '@/data/train/medalTypes'
import type { Challenge } from '@/data/types'
import { questRows } from '@/features/train/logic/workoutReviewDerive'

const exercises = [
  { id: 'a', name: 'Bench Press', muscle: 'chest-mid', plannedSets: 4, sets: [{ weight: 80, reps: 8, rir: 1 }], skipped: false },
  { id: 'b', name: 'Dead Hang', muscle: 'back-wide', plannedSets: 2, sets: [], skipped: true },
]
// The rows the review page hands over: `questRows` of the day's challenges (one hit, one never taken).
const challenges = questRows([
  { id: 'c1', typeLabel: 'PR', exercise: 'Bench Press', target: '85 kg × 8', status: 'hit' },
  { id: 'c2', typeLabel: 'Depth', exercise: 'Face Pull', target: 'RIR 0', status: 'proposed' },
] as Challenge[]).rows
/** The „Gyakorlatonként" card — an exercise is reachable from its hero tube AND its row here. */
const exList = () => document.querySelector('.eo-exlist') as HTMLElement
const exRow = (name: RegExp) => within(exList()).getByRole('button', { name })
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
    // hero: the verdict sentence carries done / planned sets and the tonnes; the duration is in the sub line
    const num = document.querySelector('.eo-num') as HTMLElement
    expect(num.textContent).toBe('1 szett a 6-ból, 0,6 tonna összvolumen.')
    expect(screen.getByText(/~65 perc/)).toBeInTheDocument()
    // region tags: Mell live (with its set count), Hát struck off (nothing logged for it).
    const regionRow = document.querySelector('.eo-regs') as HTMLElement
    expect(within(regionRow).getByText('Mell · 1 szett')).toBeInTheDocument()
    expect(within(regionRow).getByText('Hát').tagName).toBe('S')
    // quest outcomes in the Folyadék vocabulary — a quest never taken is quiet, not a failure
    expect(screen.getByText('Küldetések · 1 megvan · 1 kimaradt')).toBeInTheDocument()
    expect(screen.getByText('megvan')).toBeInTheDocument()
    expect(screen.getByText('nem vállaltad')).toBeInTheDocument()
    expect(document.querySelector('.eo-quest[data-state="skipped"]')!.className).toContain('dim')
    // abandoned exercise: its tube says so, and so does its row
    expect(within(document.querySelector('.eo-extubes') as HTMLElement).getByText('kihagyva')).toBeInTheDocument()
    expect(within(exList()).getByText('kihagyva · nincs szett')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Edzés lezárása/ }))
    expect(onFinish).toHaveBeenCalledOnce()
  })

  it('closed mode: no finish CTA, and each exercise row is anchored on its top set', () => {
    render(<WorkoutSummary title="Pull Day A" eyebrow="Lezárva · ma" mode="closed"
      exercises={exercises} challenges={challenges} onExit={() => {}} />)
    expect(screen.queryByRole('button', { name: /Edzés lezárása/ })).toBeNull()
    const row = exRow(/Bench Press/)
    expect(row.querySelector('.eo-best')!.textContent).toMatch(/80\s*×\s*8/)
    // The partial exercise counts what was logged against what was planned…
    expect(row).toHaveAccessibleName('Bench Press — 1 / 4 szett')
    // …as capsules: one full, the three unlogged slots empty — never a warning.
    const caps = [...row.querySelectorAll('.fo-caps i')]
    expect(caps).toHaveLength(4)
    expect(caps.filter((c) => c.className === 'f')).toHaveLength(1)
    // The same numbers stand under the exercise's tube in the hero.
    const tube = within(document.querySelector('.eo-extubes') as HTMLElement).getByRole('button', { name: /Bench Press/ })
    expect(within(tube).getByText('1/4')).toBeInTheDocument()
    expect(within(tube).getByText('−3 szett')).toBeInTheDocument()
  })

  it('draws the previous instance as a dashed line on the tubes — and no line without a reference', () => {
    const { unmount } = render(<WorkoutSummary title="Pull Day A" eyebrow="Lezárva · ma" mode="closed"
      exercises={exercises} challenges={[]} onExit={() => {}} />)
    expect(document.querySelectorAll('.eo-extubes .wl')).toHaveLength(0)
    unmount()

    const reference = deriveSummaryStats([{ ...exercises[0], sets: [exercises[0].sets[0], exercises[0].sets[0]] }], [])
    const now = deriveSummaryStats(exercises, [])
    render(<WorkoutSummary title="Pull Day A" eyebrow="Lezárva · ma" mode="closed"
      exercises={exercises} challenges={[]} reference={reference}
      comparison={deriveComparison(now, reference, '2026-07-20', 'Júl 13', '2026-07-13')} onExit={() => {}} />)
    // Bench Press was in the reference (2 of today's 4 planned → halfway up); Dead Hang was not.
    const lines = [...document.querySelectorAll<HTMLElement>('.eo-extubes .wl')]
    expect(lines).toHaveLength(1)
    expect(lines[0].style.bottom).toBe('46%')
    expect(screen.getByText(/A szaggatott vonal az előző alkalom \(Júl 13\)/)).toBeInTheDocument()
  })

  it('omits the "Küldetések" section entirely when challenges is empty', () => {
    render(<WorkoutSummary title="Pull Day A" eyebrow="Lezárva · ma" mode="closed"
      exercises={exercises} challenges={[]} onExit={() => {}} />)
    expect(screen.queryByText(/Küldetések/)).toBeNull()
    expect(document.querySelector('.eo-quests')).toBeNull()
  })

  it('the hero number carries a full aria-label for screen readers, decorative markup hidden', () => {
    render(<WorkoutSummary title="Pull Day A" eyebrow="Edzés vége" mode="closing" durationMin={65}
      exercises={exercises} challenges={challenges} onFinish={() => {}} onBack={() => {}} onExit={() => {}} />)
    const num = document.querySelector('.eo-num') as HTMLElement
    expect(num.getAttribute('aria-label')).toBe('1 / 6 szett, 0,6 tonna összvolumen')
    expect(num.querySelector(':scope > [aria-hidden="true"]')).not.toBeNull()
  })

  it('a set with a null rir (warmup) shows no RIR fragment on the exercise view', async () => {
    const user = userEvent.setup()
    const withWarmup = [
      { id: 'a', name: 'Bench Press', muscle: 'chest-mid', plannedSets: 2, sets: [{ weight: 40, reps: 10, rir: null }], skipped: false },
    ]
    render(<WorkoutSummary title="Pull Day A" eyebrow="Lezárva · ma" mode="closed"
      exercises={withWarmup} challenges={[]} onExit={() => {}} />)
    await user.click(exRow(/Bench Press/))
    const set = document.querySelector('.eo-set') as HTMLElement
    expect(set.textContent).not.toContain('RIR')
    expect(set.querySelector('.eo-rir')).toBeNull()
  })

  it('an exercise with nothing logged reads "kihagyva · nincs szett" and dims, never strikes a number', () => {
    const abandoned = [
      { id: 'a', name: 'Bench Press', muscle: 'chest-mid', plannedSets: 4, sets: [], skipped: true },
    ]
    render(<WorkoutSummary title="Pull Day A" eyebrow="Lezárva · ma" mode="closed"
      exercises={abandoned} challenges={[]} onExit={() => {}} />)
    const row = exRow(/Bench Press/)
    expect(row.className).toContain('dim')
    expect(within(row).getByText('kihagyva · nincs szett')).toBeInTheDocument()
    expect(row.querySelector('.eo-best')).toBeNull()
    expect(row.querySelectorAll('.fo-caps i.f')).toHaveLength(0)
    // …and its tube in the hero is an empty vessel.
    expect(document.querySelector('.eo-extubes .fo-vial')!.className).toContain('ghost')
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
    const cells = document.querySelectorAll('.eo-nums .fo-facts > div')
    expect(cells).toHaveLength(4)
    expect(cells[3].textContent).toBe('–Ø RIR')
  })

  // mezo-d20.8.2.1 removed the workout-note textarea because it accepted what you typed and
  // dropped it. mezo-d20.8.2.2 brings it back WIRED — so the guard flips from "the field must
  // not exist" to "the field must be connected to something that keeps it".
  it('offers a wired note field in closing mode, and none when the page owns no draft', () => {
    const typed: string[] = []
    const { unmount } = render(<WorkoutSummary title="Pull Day A" eyebrow="Edzés vége" mode="closing"
      exercises={exercises} challenges={challenges} draftNote="" onDraftNote={(v) => typed.push(v)}
      onFinish={() => {}} onBack={() => {}} onExit={() => {}} />)
    expect(screen.getAllByText('Hogy ment?').length).toBeGreaterThan(0)
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

    // ADR 0010: an absent note is not an empty placeholder — and without an editor there is no
    // „+ Jegyzet" either: the whole section is absent.
    render(<WorkoutSummary title="Pull Day A" eyebrow="Lezárva · ma" mode="closed"
      exercises={exercises} challenges={challenges} note={null} onExit={() => {}} />)
    expect(document.querySelector('.eo-note')).toBeNull()
    expect(screen.queryByText('Amit aznap írtál')).toBeNull()
    expect(screen.queryByRole('button', { name: /Jegyzet ehhez az edzéshez/ })).toBeNull()
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
    expect(screen.getByRole('button', { name: 'Mégse' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Jegyzet ehhez az edzéshez/ })).toBeNull()
  })

  // The comparison tile and the stepping are the REVISIT's own; the closing report gets neither.
  it('keeps the comparison out of the closing report', () => {
    render(<WorkoutSummary title="Pull Day A" eyebrow="Edzés vége" mode="closing"
      exercises={exercises} challenges={challenges} comparison={null} onFinish={() => {}} onBack={() => {}} onExit={() => {}} />)
    expect(document.querySelector('.eo-cmp')).toBeNull()
    expect(document.querySelector('.eo-stepnav')).toBeNull()
    expect(screen.getByText('A számok')).toBeInTheDocument()
  })

  describe('medals (mezo-wp6n / mezo-w943 split)', () => {
    it('RECORD medal renders as a capsule row with value + previous', () => {
      render(<WorkoutSummary title="Pull Day A" eyebrow="Edzés vége" mode="closing"
        exercises={exercises} challenges={challenges} medals={medals} onFinish={() => {}} onBack={() => {}} onExit={() => {}} />)
      expect(screen.getByText('Medálok · 1 rekord · 2 célszett')).toBeInTheDocument()
      const row = document.querySelector('.eo-medals .eo-medal') as HTMLElement
      expect(within(row).getByText('Bench Press')).toBeInTheDocument()
      expect(within(row).getByText(/Volumen-rekord · előző: 1[\s\u00a0]?180 kg/)).toBeInTheDocument()
      expect(row.querySelector('.v')!.textContent).toMatch(/1[\s\u00a0]?250/)
      // The capsule carries the old record as its dashed line (1180 of 1250).
      expect(row.querySelector('.ex-rc u')).not.toBeNull()
    })

    it('TARGET_HITs collapse into a single summary row with per-exercise counts', () => {
      render(<WorkoutSummary title="Pull Day A" eyebrow="Edzés vége" mode="closing"
        exercises={exercises} challenges={challenges} medals={medals} onFinish={() => {}} onBack={() => {}} onExit={() => {}} />)
      expect(screen.getByText('2 célszett teljesítve')).toBeInTheDocument()
      expect(screen.getByText('Bench Press ×1 · Row ×1')).toBeInTheDocument()
      expect(document.querySelectorAll('.eo-targets')).toHaveLength(1)
      // no per-TARGET rows anymore
      expect(screen.queryAllByText('Cél teljesítve')).toHaveLength(0)
    })

    it('renders no medal section and no title suffix when medals is empty', () => {
      render(<WorkoutSummary title="Pull Day A" eyebrow="Edzés vége" mode="closing"
        exercises={exercises} challenges={challenges} medals={[]} onFinish={() => {}} onBack={() => {}} onExit={() => {}} />)
      expect(screen.getByText('Edzés vége · Pull Day A')).toBeInTheDocument()
      expect(screen.queryByText(/medál/i)).not.toBeInTheDocument()
      expect(document.querySelector('.eo-medals')).toBeNull()
    })

    it('tags the exercise row and marks the set itself as the record on the exercise view', async () => {
      const user = userEvent.setup()
      const recordOnSet: Medal[] = [{
        type: 'WEIGHT', tier: 'RECORD', exerciseName: 'Bench Press',
        date: '2026-07-20', setIndex: 0, value: 80, unit: 'KG', weightKg: 80, reps: 8, previousValue: 77.5,
      }]
      render(<WorkoutSummary title="Pull Day A" eyebrow="Edzés vége" mode="closing"
        exercises={exercises} challenges={challenges} medals={recordOnSet} onFinish={() => {}} onBack={() => {}} onExit={() => {}} />)
      const row = exRow(/Bench Press/)
      expect(within(row).getByText('Rekord')).toBeInTheDocument()

      await user.click(row)
      const set = document.querySelector('.eo-set') as HTMLElement
      expect(set.className).toContain('rec')
      expect(within(set).getByText('rekord')).toBeInTheDocument()
      // …and the exercise's own Medál card names what it beat.
      expect(within(document.querySelector('.eo-medals') as HTMLElement).getByText(/Súly-rekord · előző: 77,5 kg/)).toBeInTheDocument()
    })
  })
})
