// ============================================================
// Mezo · MesoWeekEditor — az EGYSÉGES mezo-szerkesztő (mezo-yty6). A varázsló
// harmadik lépése és a sablon-szerkesztő ugyanezt rendereli: két felület helyett
// egy. Ami különbözik, az kívülről jön — a perzisztencia (a szülő callbackjei) és
// a lábléc CTA-i (`footer` slot); a `mode` csak a fejléc-eyebrow-t választja.
//
// Anatómia: hero (szerkeszthető mezo-név + meta) → VÍZSZINTESEN görgethető
// nap-csempesor → Heti terhelés csempe → lint-sorok → footer. Egy nap
// megnyitása OLDAL-ÁLLAPOT (`activeDay`, a hívó birtokolja), nem route — a még
// nem mentett vázlat így éli túl a be-/kilépést (ProgramDayView idiom).
// ============================================================
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import type { GymExercise, MesoDay, MusclePriorities } from '@/data/types'
import { DayStripTile } from '@/features/train/components/DayStripTile'
import { LoadTile } from '@/features/train/components/LoadTile'
import { MesoDayEditor } from '@/features/train/components/MesoDayEditor'
import { WeekLoadPanel } from '@/features/train/components/WeekLoadPanel'
import { adjacentDayConflicts, dayMuscleLoad, dayTone, weekMuscleLoad, type Landmark } from '@/features/train/logic/mesoLoad'
import { muscleColor } from '@/features/train/logic/muscleColors'
import { estimateSessionMinutes, type SessionTimingProfile } from '@/features/train/logic/sessionLength'
import { MozaikPage, PageBody, PageHead } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'

interface MesoWeekEditorProps {
  mode: 'draft' | 'template'
  name: string
  /** One-line meta under the name: weeks · split · run count. */
  meta: string
  /** Mezo's coach-style rationale for the generated block (proposal.rationale). Optional. */
  note?: string
  days: MesoDay[]
  priorities?: MusclePriorities | null
  volumePerMuscle?: Record<string, Landmark> | null
  timingProfile?: SessionTimingProfile | null
  timingProfilePending?: boolean
  activeDay: string | null
  onOpenDay: (dayKey: string | null) => void
  onBack: () => void
  onRename: (name: string) => void
  onRenameDay: (dayKey: string, name: string) => void
  onChangeExercise: (dayKey: string, exId: string, patch: Partial<GymExercise>) => void
  onMoveExercise: (dayKey: string, exId: string, dir: -1 | 1) => void
  onRemoveExercise: (dayKey: string, exId: string) => void
  onAddClick: (dayKey: string) => void
  footer?: ReactNode
}

/**
 * Buffers the mesocycle-name text locally rather than mirroring the incoming `name`
 * prop verbatim on every keystroke — this component is presentational, so the parent's
 * `name` prop only advances once it re-renders with the renamed value, and a directly-
 * controlled input would have React restore the DOM to the stale prop right after each
 * native input event (same reasoning as MesoDayEditor's useBufferedText).
 */
function useBufferedText(value: string): [string, (t: string) => void] {
  const [text, setText] = useState(value)
  useEffect(() => {
    setText(value)
  }, [value])
  return [text, setText]
}

export function MesoWeekEditor({
  mode, name, meta, note, days, priorities, volumePerMuscle, timingProfile, timingProfilePending,
  activeDay, onOpenDay, onBack, onRename, onRenameDay,
  onChangeExercise, onMoveExercise, onRemoveExercise, onAddClick, footer,
}: MesoWeekEditorProps) {
  const [weekLoadOpen, setWeekLoadOpen] = useState(false)
  const [nameText, setNameText] = useBufferedText(name)

  // Held at 0 while the calibrated profile is still loading — never the static fallback,
  // which would render and then swap under the user (MesoEditor's own rule).
  const minutesOf = (day: MesoDay) =>
    timingProfilePending ? 0 : estimateSessionMinutes(day.exercises, timingProfile ?? undefined)

  const conflicts = adjacentDayConflicts(days)
  const flaggedDays = new Set(conflicts.flatMap((c) => [c.fromDay, c.toDay]))
  const weekRows = weekMuscleLoad(days, priorities ?? null, volumePerMuscle ?? null)
  const weekSets = weekRows.reduce((a, r) => a + r.sets, 0)

  const open = activeDay ? days.find((d) => d.day === activeDay) : undefined
  if (open) {
    return (
      <MesoDayEditor
        day={open}
        minutes={minutesOf(open)}
        onBack={() => onOpenDay(null)}
        onRename={(next) => onRenameDay(open.day, next)}
        onChangeExercise={(exId, patch) => onChangeExercise(open.day, exId, patch)}
        onMoveExercise={(exId, dir) => onMoveExercise(open.day, exId, dir)}
        onRemoveExercise={(exId) => onRemoveExercise(open.day, exId)}
        onAdd={() => onAddClick(open.day)}
      />
    )
  }

  if (weekLoadOpen) {
    return (
      <WeekLoadPanel
        days={days}
        priorities={priorities}
        volumePerMuscle={volumePerMuscle}
        onBack={() => setWeekLoadOpen(false)}
      />
    )
  }

  return (
    <MozaikPage tone="coral">
      <PageHead onBack={onBack} label="‹ Mezociklus" />
      <EntranceGroup>
        <PageBody>
          <div className="mz-wbhero rise">
            <div className="mz-eyebrow">{mode === 'draft' ? 'Vázlat · még nincs mentve' : 'Sablon · mentve'}</div>
            <input
              className="mz-wbname"
              aria-label="Mezociklus neve"
              value={nameText}
              onChange={(e) => {
                setNameText(e.target.value)
                onRename(e.target.value)
              }}
            />
            <div className="mz-wbmeta">{meta}</div>
            {note && (
              <div className="mz-coach">
                <span className="dot" aria-hidden="true" />
                <span>{note}</span>
              </div>
            )}
          </div>

          <div className="mz-eyebrow rise" style={{ padding: '9px 2px 5px' }}>A heted · koppints egy napra</div>
          <div className="mz-dayrow rise">
            {days.map((d) => {
              const rows = dayMuscleLoad(d)
              const sets = d.exercises.reduce((a, e) => a + e.workingSets, 0)
              return (
                <DayStripTile
                  key={d.day}
                  day={d.day}
                  type={d.type}
                  name={d.type}
                  sets={sets}
                  minutes={minutesOf(d)}
                  muscles={rows.map((r) => ({
                    label: r.label, sets: r.sets, color: muscleColor(r.colorMuscle).deep,
                  }))}
                  tone={dayTone(d.type)}
                  flagged={flaggedDays.has(d.day)}
                  onOpen={() => onOpenDay(d.day)}
                />
              )
            })}
          </div>

          <div className="rise">
            <LoadTile
              tone="week"
              eyebrow="Heti terhelés · izmonként"
              value={weekSets}
              unit="szett · W1"
              gauges={weekRows.slice(0, 3).map((r) => ({
                label: r.label,
                value: r.sets,
                max: r.landmark.mrv,
                color: muscleColor(r.colorMuscle).deep,
              }))}
              flagged={conflicts.length > 0}
              onOpen={() => setWeekLoadOpen(true)}
            />
          </div>

          {conflicts.map((c) => (
            <div className="mz-lint rise" key={`${c.fromDay}-${c.toDay}`}>
              <span aria-hidden="true">⚠️</span>
              <span>
                <b>{c.groups.map((g) => g.label).join(' + ')}</b> egymást követő napokon
                ({c.fromDay} {c.fromType} → {c.toDay} {c.toType}) — pihenőnap ajánlott közéjük.
              </span>
            </div>
          ))}

          {footer && <div className="mz-wfoot">{footer}</div>}
        </PageBody>
      </EntranceGroup>
    </MozaikPage>
  )
}
