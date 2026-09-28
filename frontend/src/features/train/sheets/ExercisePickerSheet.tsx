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
// Üveg (U10, mezo-me75u.10, `uveg-reteg` `SH.ex`): a coral glass sheet, the dumbbell 3D head with
// the lit „Kész" pill, a flat search field, flat filter chips (the active one lit), exercise rows
// as hairline-split flat rows with the coral + ring; a pick shows „Hozzáadva" with the tick icon.
// Mid-workout swap/add (mezo-mobji): `mode="single"` closes on the first pick, and `similarTo`
// puts a „Hasonló gyakorlatok" strip (same muscle first, then the same region) above the list;
// `excludeNames` hides what the session already holds.
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { useTrain } from '@/data/hooks'
import { MUSCLE_LABELS } from '@/data/train/train'

import {
  TOP_FILTERS, TOP_FILTER_LABELS, subMuscles, matchesMuscleFilter, type TopFilter,
} from '@/features/train/logic/muscleFilters'
import type { ExerciseLibraryItem } from '@/data/types'
import { Sheet } from '@/shared/ui/Sheet'
import { SheetHead } from '@/shared/ui/SheetHead'
import { Icon3D } from '@/shared/ui/clay'
import { cn } from '@/shared/lib/cn'
import { VideoDemo } from '@/features/train/components/VideoDemo'
import { ExerciseImage } from '@/features/train/components/ExerciseImage'
import { muscleRegion } from '@/features/train/logic/muscleColors'

interface ExercisePickerSheetProps {
  onClose: () => void
  onPick: (item: ExerciseLibraryItem) => void
  /** Context line for the header, e.g. "Csü · Pull" — which day receives the picks. */
  dayLabel?: string
  /** 'single' closes on the first pick (mid-workout swap/add); 'multi' (default) stays open. */
  mode?: 'multi' | 'single'
  /** Header overrides for the single-pick uses. */
  eyebrow?: string
  title?: string
  /** The muscle the „Hasonló gyakorlatok" strip matches (a swap's replaced exercise). */
  similarTo?: string
  /** Exercise names hidden from every list (already in the session). */
  excludeNames?: string[]
}

/** Up to four library items for a swap: the same muscle first, then the same region. */
export function similarExercises(library: ExerciseLibraryItem[], muscle: string, exclude: Set<string>): ExerciseLibraryItem[] {
  const free = library.filter((e) => !exclude.has(e.name))
  const region = muscleRegion(muscle)
  const same = free.filter((e) => e.muscle === muscle)
  const near = region ? free.filter((e) => e.muscle !== muscle && muscleRegion(e.muscle) === region) : []
  return [...same, ...near].slice(0, 4)
}

export function ExercisePickerSheet({
  onClose, onPick, dayLabel, mode = 'multi', eyebrow, title, similarTo, excludeNames,
}: ExercisePickerSheetProps) {
  const { exerciseLibrary: fullLibrary } = useTrain()
  const excluded = new Set(excludeNames ?? [])
  const exerciseLibrary = excluded.size ? fullLibrary.filter((e) => !excluded.has(e.name)) : fullLibrary
  const single = mode === 'single'
  // Two-level filter: top = 'all'|'plyo'|region, sub = a muscle token within a region (or null).
  const [top, setTop] = useState<TopFilter>('all')
  const [sub, setSub] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  // Multi-add: the sheet stays open across picks; count + a short per-row flash
  // give the feedback the auto-close used to provide.
  const [addedCount, setAddedCount] = useState(0)
  const [flashId, setFlashId] = useState<string | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current) }, [])

  const subs = subMuscles(top)

  const similar = similarTo && search === '' ? similarExercises(fullLibrary, similarTo, excluded) : []

  const filtered = exerciseLibrary.filter(
    (e) =>
      matchesMuscleFilter(e.muscle, e.type, top, sub) &&
      (search === '' || e.name.toLowerCase().includes(search.toLowerCase())),
  )

  return (
    <Sheet glass onClose={onClose} labelledBy="exercise-picker-title" className="uvl-edzes">
      {(close) => (
        <div className="uvl-body">
          <SheetHead
            icon="t-dumbbell"
            eyebrow={eyebrow ?? `Gyakorlat választás${dayLabel ? ` · ${dayLabel}` : ''}`}
            title={title ?? 'Mit pakolunk be?'}
            titleId="exercise-picker-title"
            sub={!single && addedCount > 0 ? <span className="uvl-shh-count">{addedCount} hozzáadva</span> : undefined}
            action={single ? undefined : (
              <button type="button" className="uvl-cta is-sm" onClick={close}>
                Kész{addedCount > 0 ? ` · ${addedCount}` : ''}
              </button>
            )}
            onClose={close}
          />

          {/* Search */}
          <label className="uvl-search">
            <Icon3D name="t-lens" size={20} />
            <input
              placeholder="Keresés · pl. row, curl, press"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>

          {similar.length > 0 && (
            <>
              <span className="uvl-subh">Hasonló gyakorlatok</span>
              <div className="uvl-exlist is-similar" aria-label="Hasonló gyakorlatok">
                {similar.map((e) => (
                  <button key={e.id} type="button" className="uvl-exrow" onClick={() => { onPick(e); close() }}>
                    <ExerciseImage start={e.imageStartUrl} end={e.imageEndUrl} name={e.name} muscle={e.muscle} variant="thumb" />
                    <span className="uvl-exrow-t">
                      <strong>{e.name}</strong>
                      <small>{MUSCLE_LABELS[e.muscle] ?? e.muscle} · {e.type}</small>
                    </span>
                    <em className="uvl-exrow-add" aria-hidden="true">›</em>
                  </button>
                ))}
              </div>
              <span className="uvl-subh">Összes gyakorlat</span>
            </>
          )}

          {/* Muscle filter — level 1: régiók */}
          <div className="uvl-chips is-scroll">
            {TOP_FILTERS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setTop(m); setSub(null) }}
                aria-pressed={top === m}
                className={cn('uvl-chip', top === m && 'on')}
              >
                {TOP_FILTER_LABELS[m] ?? m}
              </button>
            ))}
          </div>

          {/* Muscle filter — level 2: fej-specifikus al-szűrők (csak régió kiválasztásakor) */}
          {subs.length > 0 && (
            <div className="uvl-chips is-scroll is-sub">
              {subs.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSub(sub === m ? null : m)}
                  aria-pressed={sub === m}
                  className={cn('uvl-chip', sub === m && 'on')}
                >
                  {MUSCLE_LABELS[m] ?? m}
                </button>
              ))}
            </div>
          )}

          {/* List */}
          <div className="uvl-exlist">
            {filtered.map((e) => (
              <div key={e.id} className="uvl-exitem">
                <button
                  type="button"
                  onClick={() => {
                    onPick(e)
                    if (single) {
                      close()
                      return
                    }
                    setAddedCount((c) => c + 1)
                    setFlashId(e.id)
                    if (flashTimer.current) clearTimeout(flashTimer.current)
                    flashTimer.current = setTimeout(() => setFlashId(null), 900)
                  }}
                  className={cn('uvl-exrow', flashId === e.id && 'is-added')}
                >
                  <ExerciseImage
                    start={e.imageStartUrl}
                    end={e.imageEndUrl}
                    name={e.name}
                    muscle={e.muscle}
                    variant="thumb"
                  />
                  <span className="uvl-exrow-t">
                    <strong>{e.name}</strong>
                    <small>{MUSCLE_LABELS[e.muscle] ?? e.muscle} · {e.type}</small>
                  </span>
                  <span className="uvl-stim">
                    <small>STIM</small>
                    <span aria-hidden="true">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <i key={n} className={cn(n / 5 <= e.stim && 'on')} />
                      ))}
                    </span>
                  </span>
                  {flashId === e.id ? (
                    <span className="uvl-exrow-done"><Icon3D name="t-tick" size={20} />Hozzáadva</span>
                  ) : (
                    <em className="uvl-exrow-add" aria-hidden="true">+</em>
                  )}
                </button>
                {/* Inline demo video — sibling of the row button so its toggle never triggers onPick */}
                <VideoDemo url={e.videoUrl} />
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <p className="uvl-none uv-empty">Nincs találat ezzel a szűrővel.</p>
          )}
        </div>
      )}
    </Sheet>
  )
}
