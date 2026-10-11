// ============================================================
// Mezo · ExercisePickerSheet — bottom sheet for adding an exercise to a
// builder day. Search input + horizontal muscle-filter chips + a filtered
// list from the exercise library (name · muscle label · type, a 5-bar STIM
// meter, and a + affordance). The sheet stays open across picks for
// multi-add: each pick calls onPick(item), bumps a live counter and flashes
// the picked row; the sheet only dismisses via Kész / ✕ / backdrop / Escape.
// Wraps the shared Sheet (render-fn child) so the X button dismisses with
// the same slide-down as the backdrop.
// Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js `xpick` / `xpBody()`): the light sheet. Context line
// („Gyakorlat választás · Csü · Pull"), the dumbbell bubble with the question, then the count of
// picks beside the „Kész" pill, the search field, the region pills (and a region's muscle pills),
// and the rows: the photo or the muscle chip, name, „izom · típus", the stimulus as five drops
// and the „▶ Demo" link; the + turns into „Hozzáadva" for a moment after a pick.
// Mid-workout swap/add (mezo-mobji): `mode="single"` closes on the first pick, and `similarTo`
// puts a „Hasonló gyakorlatok" group (same muscle first, then the same region) above the list;
// `excludeNames` hides what the session already holds. Props and behaviour are the same for
// every caller (day editor, saját edzés, template editor, planner, the active workout).
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { useTrain } from '@/data/hooks'
import { MUSCLE_LABELS } from '@/data/train/train'

import {
  TOP_FILTERS, TOP_FILTER_LABELS, subMuscles, matchesMuscleFilter, type TopFilter,
} from '@/features/train/logic/muscleFilters'
import type { ExerciseLibraryItem } from '@/data/types'
import { Sheet } from '@/shared/ui/Sheet'
import { Btn, Chev, DropsMeter, FoSheetHead, Input, Lab, Note, Pill, Pills, St } from '@/shared/ui/folyadek'
import { deepMuscle } from '@/features/train/components/folyadek'
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

const TYPE_LABEL: Record<string, string> = { compound: 'összetett', isolation: 'izolált', plyo: 'plyo' }

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

  const text = (e: ExerciseLibraryItem) => (
    <>
      <strong>{e.name}</strong>
      <small>{MUSCLE_LABELS[e.muscle] ?? e.muscle} · {TYPE_LABEL[e.type] ?? e.type}</small>
    </>
  )
  const thumb = (e: ExerciseLibraryItem) => (
    <ExerciseImage start={e.imageStartUrl} name={e.name} muscle={e.muscle} />
  )

  return (
    <Sheet onClose={onClose} labelledBy="exercise-picker-title" className="fo-sheet ee-xp">
      {(close) => (
        <>
          <FoSheetHead
            icon="t-dumbbell"
            eyebrow={eyebrow ?? `Gyakorlat választás${dayLabel ? ` · ${dayLabel}` : ''}`}
            title={title ?? 'Mit pakolunk be?'}
            titleId="exercise-picker-title"
            onClose={close}
          />
          {!single && (
            <div className="ee-xph">
              <span aria-live="polite">{addedCount > 0 ? `${addedCount} hozzáadva` : ''}</span>
              <Btn sm onClick={close}>Kész{addedCount > 0 ? ` · ${addedCount}` : ''}</Btn>
            </div>
          )}

          <Input type="search" className="ee-xq" aria-label="Keresés" autoComplete="off"
            placeholder="Keresés · pl. row, curl, press" value={search} onChange={(e) => setSearch(e.target.value)} />

          {similar.length > 0 && (
            <>
              <Lab>Hasonló gyakorlatok</Lab>
              <div className="ee-xlist" role="group" aria-label="Hasonló gyakorlatok">
                {similar.map((e) => (
                  <div key={e.id} className="fo-row ee-xrow">
                    <button type="button" className="fo-row-main" onClick={() => { onPick(e); close() }}>
                      {thumb(e)}
                      <span className="g">{text(e)}</span>
                      <Chev />
                    </button>
                  </div>
                ))}
              </div>
              <Lab>Összes gyakorlat</Lab>
            </>
          )}

          {/* Muscle filter — level 1: the regions */}
          <Pills>
            {TOP_FILTERS.map((m) => (
              <Pill key={m} on={top === m} onClick={() => { setTop(m); setSub(null) }}>{TOP_FILTER_LABELS[m] ?? m}</Pill>
            ))}
          </Pills>

          {/* Muscle filter — level 2: a region's muscles (only when a region is picked) */}
          {subs.length > 0 && (
            <Pills className="ee-xsub">
              {subs.map((m) => (
                <Pill key={m} on={sub === m} onClick={() => setSub(sub === m ? null : m)}>{MUSCLE_LABELS[m] ?? m}</Pill>
              ))}
            </Pills>
          )}

          <div className="ee-xlist">
            {filtered.map((e) => (
              <div key={e.id} className="fo-row ee-xrow">
                <button
                  type="button"
                  className="fo-row-main"
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
                >
                  {thumb(e)}
                  <span className="g">
                    {text(e)}
                    <span className="ee-stim">
                      <em>STIM</em>
                      <DropsMeter n={[1, 2, 3, 4, 5].filter((n) => n / 5 <= e.stim).length} of={5} color={deepMuscle(e.muscle)} />
                    </span>
                  </span>
                  {flashId === e.id
                    ? <St tone="ok">Hozzáadva</St>
                    : <span className="ee-plus" aria-hidden="true">+</span>}
                </button>
                {/* The demo link and its player are siblings of the row button, so the toggle never picks the exercise. */}
                <VideoDemo url={e.videoUrl} fo />
              </div>
            ))}
          </div>

          {filtered.length === 0 && <Note className="ee-xnone">Nincs találat ezzel a szűrővel.</Note>}
        </>
      )}
    </Sheet>
  )
}
