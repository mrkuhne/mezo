// ============================================================
// Mezo · MesoDayEditor — egy edzésnap szerkesztője az egységes mezo-szerkesztőben
// (mezo-yty6; Folyadék mezo-n4wf5.3, prototype vilagos/edzes.js `weekEd(r, 'nap')`).
// Anatómia: hero ÁTNEVEZHETŐ napnévvel + a nap három legtöbbet dolgozó izma edényként a
// kb. 8 szett / edzés határ vízvonalával (dayMuscleLoad) → a hero folyadéksorán a Napi
// terhelés és a gyakorlat hozzáadása → mindig nyitott gyakorlat-kártyák.
//
// RENDER-FEGYELEM (prototípus-visszajelzés: „átrendezéskor az egész oldal flashel"):
// a belépő choreográfia CSAK az első mountra fut. A lista `data-entered` jelzője a mount
// után 'true' lesz, és onnantól a kártyák stagger-osztály nélkül renderelődnek — a
// szerkesztés (átrendezés, törlés, hozzáadás, számbevitel) villanás nélkül frissül.
// ============================================================
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { DAY_LABELS } from '@/data/train/train'
import type { GymExercise, MesoDay } from '@/data/types'
import { DayLoadPanel } from '@/features/train/components/DayLoadPanel'
import { ExerciseCard } from '@/features/train/components/ExerciseCard'
import { Mchp, deepMuscle } from '@/features/train/components/folyadek'
import { dayMuscleLoad } from '@/features/train/logic/mesoLoad'
import { BUDGET_GROUP_LABELS, budgetGroup } from '@/features/train/logic/setBudget'
import {
  Btn, Card, FrameBack, Hero, Input, Lab, Note, Page, Section, Tubes, useFrameTitle,
} from '@/shared/ui/folyadek'

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
  /** Which editor this day belongs to — picks the hero label. */
  mode?: 'draft' | 'template'
  /** The title bar's small line above the day (the template's name, or „még nincs mentve"). */
  eyebrow?: string
  onBack: () => void
  onRename: (name: string) => void
  onChangeExercise: (exId: string, patch: Partial<GymExercise>) => void
  onMoveExercise: (exId: string, dir: -1 | 1) => void
  onRemoveExercise: (exId: string) => void
  onAdd: () => void
}

export function MesoDayEditor({
  day, minutes, mode = 'template', eyebrow, onBack, onRename, onChangeExercise, onMoveExercise, onRemoveExercise, onAdd,
}: MesoDayEditorProps) {
  const [loadOpen, setLoadOpen] = useState(false)
  // One-shot entrance, WITHOUT state: the first render paints the stagger, the post-mount
  // effect clears the ref, and every LATER render (an edit, a reorder, a delete) renders
  // without it. Deliberately not useState — a state flip would force an extra render and the
  // staggered frame would never reach the screen.
  const firstRender = useRef(true)
  const entrance = firstRender.current
  useEffect(() => { firstRender.current = false }, [])

  const [nameText, setNameText] = useBufferedText(day.type, day.day)
  const nameId = useId()

  const rows = dayMuscleLoad(day)
  const sets = day.exercises.reduce((a, e) => a + e.workingSets, 0)

  if (loadOpen) {
    return <DayLoadPanel day={day} minutes={minutes} onBack={() => setLoadOpen(false)} />
  }

  return (
    <DayFace eyebrow={eyebrow} title={`${DAY_LABELS[day.day] ?? day.day} · ${day.type}`}>
      <FrameBack className="ew-back" onBack={onBack}>‹ A heted</FrameBack>
      <Hero
        className="ew-hero"
        label={mode === 'draft' ? 'Vázlat · egy nap' : 'Sablon · egy nap'}
        verdict={`${sets} szett, ~${minutes} perc, ${day.exercises.length} gyakorlat.`}
        sub="Minden mező közvetlenül írható. Átrendezés a ▲▼ nyilakkal, törlés az ✕-szel."
        actions={(
          <>
            <Btn onClick={() => setLoadOpen(true)}>Napi terhelés · {day.day}</Btn>
            <Btn ghost aria-label="Gyakorlat hozzáadása" onClick={onAdd}>＋ Gyakorlat</Btn>
          </>
        )}
      >
        <Lab htmlFor={nameId}>A nap neve</Lab>
        <Input
          id={nameId}
          aria-label={`${day.day} nap neve`}
          value={nameText}
          onChange={(e) => {
            setNameText(e.target.value)
            onRename(e.target.value)
          }}
        />
        <Note>✎ koppints a névre az átnevezéshez</Note>
        {rows.length > 0 && (
          <div className="ew-hg n3">
            <Tubes
              size="sm" height={86}
              items={rows.slice(0, 3).map((r) => ({
                node: <Mchp muscle={r.colorMuscle} size={28} />,
                label: r.label,
                value: r.sets,
                note: `/ ~${r.cap}`,
                pct: (r.sets / (r.cap + 1)) * 94,
                wl: (r.cap / (r.cap + 1)) * 94,
                color: deepMuscle(r.colorMuscle),
                over: r.over,
              }))}
            />
          </div>
        )}
      </Hero>

      <Section n={1} title={`Gyakorlatok · ${day.exercises.length} gyakorlat · ${sets} szett`} />
      <Card data-testid="exercise-list" data-entered={entrance ? 'false' : 'true'}>
        {day.exercises.length === 0 && <Note>Ezen a napon még nincs gyakorlat.</Note>}
        {day.exercises.map((ex, i) => {
          const group = budgetGroup(ex.muscle)
          return (
            <div
              key={ex.id}
              className={entrance ? 'ew-exw ew-rise' : 'ew-exw'}
              style={entrance ? { ['--d' as string]: `${60 + i * 50}ms` } : undefined}
            >
              <ExerciseCard
                ex={ex}
                contribution={group
                  ? [{
                    label: BUDGET_GROUP_LABELS[group] ?? group,
                    sets: ex.workingSets,
                    color: deepMuscle(ex.muscle),
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
      </Card>
    </DayFace>
  )
}

/** The day face's page root: it owns the title-bar line, so the load page (its sibling face) can set its own. */
function DayFace({ title, eyebrow, children }: { title: string; eyebrow?: string; children: ReactNode }) {
  useFrameTitle({ title, eyebrow })
  return <Page className="ew-page">{children}</Page>
}
