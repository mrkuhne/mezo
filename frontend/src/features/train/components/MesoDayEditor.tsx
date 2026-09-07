// ============================================================
// Mezo · MesoDayEditor — egy edzésnap szerkesztője az egységes mezo-szerkesztőben
// (mezo-yty6). Anatómia: hero ÁTNEVEZHETŐ napnévvel → Napi terhelés csempe →
// mindig nyitott gyakorlat-kártyák → hozzáadás-gomb.
//
// RENDER-FEGYELEM (prototípus-visszajelzés: „átrendezéskor az egész oldal flashel"):
// a belépő `rise` choreográfia CSAK az első mountra fut. A lista `data-entered`
// jelzője a mount után 'true' lesz, és onnantól a kártyák stagger-osztály nélkül
// renderelődnek — a szerkesztés (átrendezés, törlés, hozzáadás, számbevitel)
// villanás nélkül frissül.
// ============================================================
import { useEffect, useRef, useState } from 'react'
import type { GymExercise, MesoDay } from '@/data/types'
import { DayLoadPanel } from '@/features/train/components/DayLoadPanel'
import { ExerciseCard } from '@/features/train/components/ExerciseCard'
import { LoadTile } from '@/features/train/components/LoadTile'
import { dayMuscleLoad, dayTone } from '@/features/train/logic/mesoLoad'
import { muscleColor } from '@/features/train/logic/muscleColors'
import { BUDGET_GROUP_LABELS, budgetGroup } from '@/features/train/logic/setBudget'
import { Icon } from '@/shared/ui/Icon'
import { ClayIcon } from '@/shared/ui/clay'
import { MozaikPage, PageBody, PageHead, type PageTone } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'

const TONE: Record<string, PageTone> = { coral: 'coral', sage: 'sage', rose: 'rose', gold: 'gold' }

/**
 * Buffers the day-name text locally rather than mirroring the incoming `type` prop
 * verbatim on every keystroke — same reasoning as ExerciseCard's useBufferedText: this
 * component is presentational, so the parent's `day` prop only advances once it
 * re-renders with the renamed day, and a directly-controlled input would have React
 * restore the DOM to the stale prop right after each native input event.
 *
 * `key` is the day identity (`day.day`), passed in addition to `value` (`day.type`):
 * a split can contain two days with the SAME type string (a 6-day Push/Pull/Legs ×2
 * week has two 'Push' days), and Task 8 swaps the `day` prop on this same component
 * instance without unmounting. Depending on `value` alone would miss that swap when
 * the type strings coincide, leaving the old day's buffered text on screen.
 */
function useBufferedText(value: string, key: string): [string, (t: string) => void] {
  const [text, setText] = useState(value)
  useEffect(() => {
    setText(value)
  }, [value, key])
  return [text, setText]
}

interface MesoDayEditorProps {
  day: MesoDay
  /** Estimated session minutes — the page owns the timing profile and passes the number. */
  minutes: number
  onBack: () => void
  onRename: (name: string) => void
  onChangeExercise: (exId: string, patch: Partial<GymExercise>) => void
  onMoveExercise: (exId: string, dir: -1 | 1) => void
  onRemoveExercise: (exId: string) => void
  onAdd: () => void
}

export function MesoDayEditor({
  day, minutes, onBack, onRename, onChangeExercise, onMoveExercise, onRemoveExercise, onAdd,
}: MesoDayEditorProps) {
  const [loadOpen, setLoadOpen] = useState(false)
  // One-shot entrance, WITHOUT state: the first render paints the `rise` stagger, the
  // post-mount effect clears the ref, and every LATER render (an edit, a reorder, a delete)
  // renders without it. Deliberately not useState — a state flip would force an extra
  // render and the staggered frame would never reach the screen.
  const firstRender = useRef(true)
  const entrance = firstRender.current
  useEffect(() => { firstRender.current = false }, [])

  const [nameText, setNameText] = useBufferedText(day.type, day.day)

  const rows = dayMuscleLoad(day)
  const sets = day.exercises.reduce((a, e) => a + e.workingSets, 0)

  if (loadOpen) {
    return <DayLoadPanel day={day} minutes={minutes} onBack={() => setLoadOpen(false)} />
  }

  return (
    <MozaikPage tone={TONE[dayTone(day.type)] ?? 'coral'}>
      <PageHead onBack={onBack} label="‹ A heted" />
      <EntranceGroup>
        <div className="mz-dayhero rise">
          <ClayIcon name="i-edzes" size={30} />
          <input
            className="mz-dayname"
            aria-label={`${day.day} nap neve`}
            value={nameText}
            onChange={(e) => {
              setNameText(e.target.value)
              onRename(e.target.value)
            }}
          />
          <span className="mz-dayhero-hint">✎ koppints a névre az átnevezéshez</span>
          <span className="mz-dayhero-sub">
            {day.day} · {sets} szett · ~{minutes} perc · {day.exercises.length} gyakorlat
          </span>
        </div>
        <PageBody principle="Minden mező közvetlenül írható. Átrendezés a ▲▼ nyilakkal, törlés az ×-szel.">
          <div className="rise" style={{ marginBottom: 10 }}>
            <LoadTile
              tone="day"
              eyebrow={`Napi terhelés · ${day.day}`}
              value={sets}
              unit={`szett · ~${minutes}′`}
              gauges={rows.slice(0, 3).map((r) => ({
                label: r.label,
                value: r.sets,
                max: r.cap,
                color: muscleColor(r.colorMuscle).deep,
                warn: r.nearCap || r.over,
              }))}
              flagged={rows.some((r) => r.over)}
              onOpen={() => setLoadOpen(true)}
            />
          </div>

          <div data-testid="exercise-list" data-entered={entrance ? 'false' : 'true'}>
            {day.exercises.map((ex, i) => {
              const group = budgetGroup(ex.muscle)
              return (
                <div key={ex.id} className={entrance ? 'rise' : undefined} style={entrance ? { ['--d' as string]: `${60 + i * 50}ms` } : undefined}>
                  <ExerciseCard
                    ex={ex}
                    contribution={group
                      ? [{
                        label: BUDGET_GROUP_LABELS[group] ?? group,
                        sets: ex.workingSets,
                        color: muscleColor(ex.muscle).deep,
                      }]
                      : []}
                    canMoveUp={i > 0}
                    canMoveDown={i < day.exercises.length - 1}
                    onChange={(patch) => onChangeExercise(ex.id, patch)}
                    onMove={(dir) => onMoveExercise(ex.id, dir)}
                    onRemove={() => onRemoveExercise(ex.id)}
                  />
                </div>
              )
            })}
          </div>

          <button type="button" onClick={onAdd} className="mz-addex">
            <Icon name="plus" size={12} /> Gyakorlat hozzáadása
          </button>
        </PageBody>
      </EntranceGroup>
    </MozaikPage>
  )
}
