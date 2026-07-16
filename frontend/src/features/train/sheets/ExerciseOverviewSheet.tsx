// ============================================================
// Mezo · ExerciseOverviewSheet — mid-workout exercise overview + jump
// (spec 2026-07-15 free navigation, mockup "B · Áttekintő lista").
// Opens from the wk-top counter; every row shows the exercise's live
// state (✓ kész · ● folyamatban n/m · ○ hátravan · ⊘ kihagyva) and
// tapping a row jumps the execution card to it.
// ============================================================
import { Sheet } from '@/shared/ui/Sheet'
import { Display } from '@/shared/ui/Display'

export interface OverviewExercise {
  id: string
  name: string
  state: 'done' | 'progress' | 'todo' | 'skipped'
  done: number
  total: number
}

const STATE_GLYPH: Record<OverviewExercise['state'], string> = {
  done: '✓', progress: '●', todo: '○', skipped: '⊘',
}

export function ExerciseOverviewSheet({
  exercises,
  currentId,
  onJump,
  onClose,
}: {
  exercises: OverviewExercise[]
  currentId: string
  onJump: (id: string) => void
  onClose: () => void
}) {
  return (
    <Sheet onClose={onClose} labelledBy="exercise-overview-title">
      {(close) => (
        <>
          <div className="col" style={{ marginBottom: 14 }}>
            <span className="eyebrow" style={{ color: 'var(--coral-deep)' }}>Gyakorlatsor · tap = ugrás</span>
            <div id="exercise-overview-title" style={{ marginTop: 6 }}>
              <Display size="md">Hol tartasz</Display>
            </div>
          </div>
          <div className="col gap-sm">
            {exercises.map((e) => (
              <button
                key={e.id}
                type="button"
                aria-label={`${e.name} · ugrás`}
                onClick={() => { onJump(e.id); close() }}
                className="card notch-4 row gap-sm"
                style={{
                  padding: '11px 12px', alignItems: 'center', width: '100%', textAlign: 'left',
                  background: e.id === currentId ? 'color-mix(in srgb, var(--coral) 6%, transparent)' : 'var(--surface-1)',
                  borderColor: e.id === currentId ? 'var(--border-brand)' : 'var(--border-subtle)',
                }}
              >
                <span
                  className="label-mono"
                  style={{
                    width: 22, height: 22, borderRadius: '50%', display: 'inline-flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: 11, flex: 'none',
                    color: e.state === 'done' || e.state === 'progress' ? 'var(--coral)' : 'var(--text-tertiary)',
                    background: e.state === 'progress' ? 'color-mix(in srgb, var(--coral) 14%, transparent)' : 'var(--surface-2)',
                    border: e.state === 'skipped' ? '1.5px dashed var(--border-subtle)' : 'none',
                  }}
                >
                  {STATE_GLYPH[e.state]}
                </span>
                <span
                  style={{
                    flex: 1, fontSize: 13,
                    color: e.state === 'skipped' ? 'var(--text-tertiary)' : 'var(--text-primary)',
                    textDecoration: e.state === 'skipped' ? 'line-through' : 'none',
                  }}
                >
                  {e.name}
                </span>
                <span className="label-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                  {e.state === 'skipped' ? 'kihagyva' : `${e.done}/${e.total}`}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </Sheet>
  )
}
