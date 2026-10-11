// ============================================================
// Mezo · MesoWeekEditor — az EGYSÉGES mezo-szerkesztő (mezo-yty6; Folyadék mezo-n4wf5.3,
// prototype vilagos/edzes.js `weekEd()`). A varázsló vázlata és a sablon-szerkesztő ugyanezt
// rendereli: két felület helyett egy. Ami különbözik, az kívülről jön — a perzisztencia (a
// szülő callbackjei), a hero gombjai (`actions`) és a lap alja (`footer` slot); a `mode` a
// hero feliratát, a cél megjelenését és a címsort választja.
//
// Anatómia: hero (szerkeszthető név + meta + a cél / Mezo indoklása + az öt legtöbbet dolgozó
// izom edényként, a szélük a legfeljebb vállalható heti szett — weekMuscleLoad) → ① a hét
// napjai soronként → ② Heti terhelés sor + az átfedés-jelzések → footer. Egy nap megnyitása
// OLDAL-ÁLLAPOT (`activeDay`, a hívó birtokolja), nem route — a még nem mentett vázlat így éli
// túl a be-/kilépést.
// ============================================================
import type { ReactNode } from 'react'
import { useEffect, useId, useState } from 'react'
import type { GymExercise, MesoDay, MusclePriorities } from '@/data/types'
import { DayStripTile } from '@/features/train/components/DayStripTile'
import { LoadTile } from '@/features/train/components/LoadTile'
import { MesoDayEditor } from '@/features/train/components/MesoDayEditor'
import { WeekLoadPanel } from '@/features/train/components/WeekLoadPanel'
import { Mchp, deepMuscle } from '@/features/train/components/folyadek'
import { adjacentDayConflicts, dayMuscleLoad, weekMuscleLoad, type Landmark } from '@/features/train/logic/mesoLoad'
import { isOffDay } from '@/features/train/logic/offDay'
import { estimateSessionMinutes, type SessionTimingProfile } from '@/features/train/logic/sessionLength'
import {
  Box, Btn, Card, FrameBack, Hero, Input, Lab, Msg, Page, Section, Tubes, useFrameTitle,
} from '@/shared/ui/folyadek'

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
  /** The hero's liquid row. Default: the „Heti terhelés" button (the template editor has nothing to save by hand). */
  actions?: ReactNode
  /** Rendered after the numbered sections (the draft's „Újragenerálás" section). */
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
  onChangeExercise, onMoveExercise, onRemoveExercise, onAddClick, actions, footer,
}: MesoWeekEditorProps) {
  const [weekLoadOpen, setWeekLoadOpen] = useState(false)
  const [nameText, setNameText] = useBufferedText(name)
  const nameId = useId()

  // Held at 0 while the calibrated profile is still loading — never the static fallback,
  // which would render and then swap under the user (MesoEditor's own rule).
  const minutesOf = (day: MesoDay) =>
    timingProfilePending ? 0 : estimateSessionMinutes(day.exercises, timingProfile ?? undefined)

  const conflicts = adjacentDayConflicts(days)
  const flaggedDays = new Set(conflicts.flatMap((c) => [c.fromDay, c.toDay]))
  const weekRows = weekMuscleLoad(days, priorities ?? null, volumePerMuscle ?? null)
  // The HEADLINE is the raw working-set total — the same quantity each day tile shows, so
  // the day tiles always add up to the week tile on one screen (mezo-yty6 final review, I3).
  // Summing `weekRows` instead would silently drop exempt work (plyo) and landmark-less
  // groups (traps/core), and the two numbers on this very screen would disagree. The
  // per-muscle GAUGES below stay the filtered view: only groups with a landmark have a
  // target to gauge against.
  const weekSets = days.reduce((a, d) => a + d.exercises.reduce((s, e) => s + e.workingSets, 0), 0)

  const trainingCount = days.filter((d) => d.exercises.length > 0).length

  const open = activeDay ? days.find((d) => d.day === activeDay) : undefined
  if (open) {
    return (
      <MesoDayEditor
        day={open}
        minutes={minutesOf(open)}
        mode={mode}
        eyebrow={mode === 'draft' ? 'Új terv · még nincs mentve' : `Sablon · ${name}`}
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
    <WeekFace mode={mode} name={name}>
      <FrameBack className="fo-backpill" onBack={onBack}>‹ Terv</FrameBack>
      <Hero
        className="ew-hero"
        label={mode === 'draft' ? 'Vázlat · még nincs mentve' : 'Sablon · mentve'}
        verdict={`${weekSets} szett az első héten, ${trainingCount} edzésnapra.`}
        sub={meta}
        actions={actions ?? <Btn onClick={() => setWeekLoadOpen(true)}>Heti terhelés · izmonként</Btn>}
      >
        <Lab htmlFor={nameId}>A terv neve</Lab>
        <Input
          id={nameId}
          aria-label="A terv neve"
          value={nameText}
          onChange={(e) => {
            setNameText(e.target.value)
            onRename(e.target.value)
          }}
        />
        {note && (mode === 'draft'
          ? <Msg member="mezo">{note}</Msg>
          : <Box icon="t-note" title="A sablon célja"><p>{note}</p></Box>)}
        {weekRows.length > 0 && (
          <div className="fo-hero-g ew-hg">
            <Tubes
              size="sm" height={86} gap={6}
              items={weekRows.slice(0, 5).map((r) => ({
                node: <Mchp muscle={r.colorMuscle} size={28} />,
                label: r.label,
                value: r.sets,
                note: `/ ${r.landmark.mrv}`,
                pct: (r.sets / Math.max(1, r.landmark.mrv)) * 94,
                color: deepMuscle(r.colorMuscle),
                ariaLabel: `${r.label}: ${r.sets} szett, legfeljebb ${r.landmark.mrv}`,
                onClick: () => setWeekLoadOpen(true),
              }))}
            />
          </div>
        )}
      </Hero>

      <Section n={1} title="A heted · koppints egy napra" />
      <Card>
        {days.map((d) => {
          const rows = dayMuscleLoad(d)
          const sets = d.exercises.reduce((a, e) => a + e.workingSets, 0)
          return (
            <DayStripTile
              key={d.day}
              day={d.day}
              // MesoDay has no name field, so the (renameable) day name IS `d.type`.
              name={d.type}
              sets={sets}
              minutes={minutesOf(d)}
              muscles={rows.map((r) => ({ label: r.label, sets: r.sets, color: deepMuscle(r.colorMuscle) }))}
              flagged={flaggedDays.has(d.day)}
              rest={d.exercises.length === 0 && (isOffDay(d) || d.type === 'Rest')}
              onOpen={() => onOpenDay(d.day)}
            />
          )
        })}
      </Card>

      <Section n={2} title="Heti terhelés · izmonként" />
      <Card>
        <LoadTile
          title="Heti terhelés · izmonként"
          value={weekSets}
          unit="szett · 1. hét"
          flags={conflicts.length}
          onOpen={() => setWeekLoadOpen(true)}
        />
        {conflicts.map((c) => (
          <div className="ew-alert" data-testid="week-conflict" key={`${c.fromDay}-${c.toDay}`}>
            <Box icon="t-info" color="var(--fo-warn)" title={`${c.groups.map((g) => g.label).join(' + ')} egymást követő napokon`}>
              <p>({c.fromDay} {c.fromType} → {c.toDay} {c.toType}) — pihenőnap ajánlott közéjük.</p>
            </Box>
          </div>
        ))}
      </Card>

      {footer}
    </WeekFace>
  )
}

/** The week face's page root: it owns the title-bar line, so the day and load faces can set their own. */
function WeekFace({ mode, name, children }: { mode: 'draft' | 'template'; name: string; children: ReactNode }) {
  useFrameTitle(mode === 'draft'
    ? { title: 'A vázlatod', eyebrow: 'Új terv · még nincs mentve' }
    : { title: 'Szerkesztés', eyebrow: `Sablon · ${name}` })
  return <Page className="ew-page">{children}</Page>
}
