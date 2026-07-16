// ============================================================
// Mezo · ExercisePickerSheet — bottom sheet for adding an exercise to a
// builder day. Search input + horizontal muscle-filter chips + a filtered
// list from the exercise library (name · muscle label · type, a 5-bar STIM
// meter, and a + affordance). The sheet stays open across picks for
// multi-add: each pick calls onPick(item), bumps a live counter and flashes
// the picked row; the sheet only dismisses via Kész / ✕ / backdrop / Escape.
// Wraps the shared Sheet (render-fn child) so the X button dismisses with
// the same slide-down as the backdrop.
// Ported from prototype mesocycles.jsx ExercisePickerSheet.
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { useTrain } from '@/data/hooks'
import { MUSCLE_LABELS } from '@/data/train/train'

import { MUSCLE_FILTERS, FILTER_LABELS, matchesMuscleFilter } from '@/features/train/logic/muscleFilters'
import type { ExerciseLibraryItem } from '@/data/types'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { VideoDemo } from '@/features/train/components/VideoDemo'

interface ExercisePickerSheetProps {
  onClose: () => void
  onPick: (item: ExerciseLibraryItem) => void
  /** Context line for the header, e.g. "Csü · Pull" — which day receives the picks. */
  dayLabel?: string
}

export function ExercisePickerSheet({ onClose, onPick, dayLabel }: ExercisePickerSheetProps) {
  const { exerciseLibrary } = useTrain()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  // Multi-add: the sheet stays open across picks; count + a short per-row flash
  // give the feedback the auto-close used to provide.
  const [addedCount, setAddedCount] = useState(0)
  const [flashId, setFlashId] = useState<string | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current) }, [])

  const muscles = MUSCLE_FILTERS

  const filtered = exerciseLibrary.filter(
    (e) =>
      matchesMuscleFilter(e.muscle, e.type, filter) &&
      (search === '' || e.name.toLowerCase().includes(search.toLowerCase())),
  )

  return (
    <Sheet onClose={onClose} labelledBy="exercise-picker-title">
      {(close) => (
        <>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div className="col">
              <span className="eyebrow brand">Gyakorlat választás{dayLabel ? ` · ${dayLabel}` : ''}</span>
              <div
                id="exercise-picker-title"
                style={{
                  fontFamily: 'var(--ff-display)',
                  fontSize: 22,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginTop: 4,
                  lineHeight: 1.15,
                }}
              >
                Mit pakolunk be?
              </div>
              {addedCount > 0 && (
                <span className="label-mono" style={{ fontSize: 9, color: 'var(--brand-glow)', marginTop: 4 }}>
                  {addedCount} hozzáadva
                </span>
              )}
            </div>
            <div className="row gap-xs">
              <button className="chip brand notch-4" onClick={close} style={{ fontSize: 9, padding: '6px 10px' }}>
                Kész{addedCount > 0 ? ` · ${addedCount}` : ''}
              </button>
              <button className="chip notch-4" onClick={close} aria-label="Bezárás" style={{ padding: '6px 8px' }}>
                <Icon name="x" size={12} />
              </button>
            </div>
          </div>

          {/* Search */}
          <div
            className="card notch-4"
            style={{ padding: 8, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}
          >
            <Icon name="search" size={14} color="var(--text-tertiary)" />
            <input
              placeholder="Keresés · pl. row, curl, press"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1, fontSize: 13, padding: '6px 0' }}
            />
          </div>

          {/* Muscle filter */}
          <div
            className="row gap-xs"
            style={{ overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 14, paddingBottom: 4 }}
          >
            {muscles.map((m) => (
              <button
                key={m}
                onClick={() => setFilter(m)}
                aria-pressed={filter === m}
                className={cn('chip', 'notch-4', filter === m && 'brand')}
                style={{ fontSize: 9, padding: '6px 10px', flexShrink: 0 }}
              >
                {FILTER_LABELS[m] ?? MUSCLE_LABELS[m] ?? m}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="col gap-sm">
            {filtered.map((e) => (
              <div key={e.id} className="col gap-sm">
                <button
                  onClick={() => {
                    onPick(e)
                    setAddedCount((c) => c + 1)
                    setFlashId(e.id)
                    if (flashTimer.current) clearTimeout(flashTimer.current)
                    flashTimer.current = setTimeout(() => setFlashId(null), 900)
                  }}
                  className="card notch-4 row"
                  style={{
                    padding: 12,
                    alignItems: 'center',
                    textAlign: 'left',
                    width: '100%',
                    borderColor: flashId === e.id ? 'var(--border-brand)' : undefined,
                  }}
                >
                  <div className="col flex-1">
                    <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{e.name}</span>
                    <div className="row gap-sm mt-xs">
                      <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                        {MUSCLE_LABELS[e.muscle] ?? e.muscle}
                      </span>
                      <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                        · {e.type}
                      </span>
                    </div>
                  </div>
                  <div className="col" style={{ alignItems: 'flex-end', marginRight: 12 }}>
                    <span className="label-mono" style={{ fontSize: 8, color: 'var(--brand-glow)' }}>
                      STIM
                    </span>
                    <div className="row gap-xs mt-xs">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <div
                          key={n}
                          style={{
                            width: 4,
                            height: 8,
                            background: n / 5 <= e.stim ? 'var(--brand-glow)' : 'var(--surface-2)',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  {flashId === e.id ? (
                    <span className="label-mono" style={{ fontSize: 9, color: 'var(--brand-glow)', flexShrink: 0 }}>
                      Hozzáadva ✓
                    </span>
                  ) : (
                    <Icon name="plus" size={16} color="var(--brand-glow)" />
                  )}
                </button>
                {/* Inline demo video — sibling of the row button so its toggle never triggers onPick */}
                <VideoDemo url={e.videoUrl} />
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <p className="text-tertiary" style={{ fontSize: 12, textAlign: 'center', padding: 20 }}>
              Nincs találat ezzel a szűrővel.
            </p>
          )}

          <div style={{ height: 24 }} />
        </>
      )}
    </Sheet>
  )
}
