// ============================================================
// Mezo · MesocyclePlannerPage — 5-step AI-guided new-mesocycle planner.
// Full-screen sibling route (/train/mesocycles/new): own back-button header,
// 5-segment progress bar, eyebrow brand step counter, per-step page title and
// footer nav. The terminal step (4) hosts the AI program review + set/rep
// tuning on the unified MesoEditor (day tabs, set-budget card, accordion
// recipe rows) and the two save actions.
//   Step 0 · Cél             → goal preset picker (prefills the rest)
//   Step 1 · Hossz + fázisok → name / start / length / phase-curve editor
//   Step 2 · Split + napok   → split picker + days-per-week
//   Step 3 · Fókusz          → MusclePriorityPicker (which muscle groups this
//                              block emphasizes/maintains) — always passable,
//                              never wipes a hand-edited program (mezo-3m5m)
//   Step 4 · Program         → generateProgram review + MesoEditor (day tabs,
//                              set-budget card, accordion set/rep tuning) + save
// Ported from prototype meso-planner.jsx MesocyclePlannerPage + its step parts.
// Steps 3+4 of the ORIGINAL prototype (program review, set/rep tuning) merged
// into one terminal step on the unified MesoEditor (mezo-7rdg Task 6) —
// MesoDayTabsEditor/PlannerDaySection retired. The Fókusz step added later
// (mezo-3m5m) sits before that terminal step, shifting it to index 4.
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrain, useMesoTemplates, useTimingProfile } from '@/data/hooks'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { PageTitle } from '@/shared/ui/PageTitle'
import type { ExerciseLibraryItem, GoalPreset, GymExercise, MesoPhase, MusclePriorities, SplitOption } from '@/data/types'
import type { MesoTemplateUpsertRequest } from '@/data/train/trainApi'
import { huMonthDay } from '@/shared/lib/dates'
import { DAY_ORDER, GOAL_PRESETS, SPLITS, MESOCYCLE_PHASE_COLORS } from '@/data/train/train'
import { Icon } from '@/shared/ui/Icon'
import { Display } from '@/shared/ui/Display'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { addWeeks, defaultWeekdays, generateProgram, getSeason, GOAL_HINTS, stepLabels } from '@/features/train/logic/planner'
import type { PlannerDay } from '@/features/train/logic/planner'
import { ExercisePickerSheet } from '@/features/train/sheets/ExercisePickerSheet'
import { MesoEditor } from '@/features/train/components/MesoEditor'
import { MusclePriorityPicker } from '@/features/train/components/MusclePriorityPicker'
import { addExerciseWithDefaults } from '@/features/train/logic/exerciseDefaults'
import { toDayInputs } from '@/features/train/logic/mesoDays'
import { MiniStat } from '@/features/train/components/MiniStat'

const STEP_COUNT = 5
const PHASES: MesoPhase[] = ['MEV', 'MAV', 'MRV', 'Deload']
const CORAL_TINT = 'var(--primary-bg)'

// Step 3's chrome title used to repeat MusclePriorityPicker's own card header verbatim — a
// visible duplicate ("Mire gyúr ez a blokk?" rendered twice: chrome PageTitle + picker card).
// RULING (mezo-ltk0, tier-review follow-up 4): the chrome title becomes the short step name
// (matches stepLabels below) and the picker's card header stays the only place asking the
// question — it is the only title in that step's body.
const PAGE_TITLES = [
  'Mit szeretnénk építeni?',
  'Mennyi időnk van?',
  'Hogyan osszuk be?',
  'Fókusz',
  'A programod · gyakorlatok + set & rep',
] as const

export function MesocyclePlannerPage() {
  const navigate = useNavigate()
  const { gymSlots, saveGymSchedule } = useTrain()
  const { createTemplate, startTemplate } = useMesoTemplates()
  // Minimal Task 5 rewire (mezo-meyc.1): the wizard now saves a template, then starts a run
  // from it (two calls instead of one createMesocycle POST) — `saving` covers the whole
  // two-step flow since neither mutation alone reflects it. Task 6 owns the real planner UX.
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState(0)
  const [goal, setGoal] = useState<GoalPreset | null>(null)
  const [name, setName] = useState('')
  // ISO in state (the contract speaks ISO); HU display derived for labels/season.
  const [startDateIso, setStartDateIso] = useState(() => new Date().toISOString().slice(0, 10))
  const startDate = huMonthDay(startDateIso)
  const [weeks, setWeeks] = useState(6)
  const [phaseCurve, setPhaseCurve] = useState<MesoPhase[]>(['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'Deload'])
  const [split, setSplit] = useState<SplitOption | null>(null)
  const [days, setDays] = useState(5)
  // Selected gym weekdays — exactly `days` must be picked. Defaults derive from the
  // split template (mezo-cne), but ONLY until the user touches the chips: after that,
  // split/count changes keep the manual pick and the exact-count gate guides adjusting
  // (mezo-509). A fresh goal pick re-prefills everything and clears the touch.
  const [selectedDays, setSelectedDays] = useState<string[]>(() => defaultWeekdays({ split: null, days: 5 }))
  const [daysTouched, setDaysTouched] = useState(false)
  // Lifted from Step3 so the terminal save buttons can read the reviewed/edited program.
  const [program, setProgram] = useState<PlannerDay[] | null>(null)
  // Fókusz step (mezo-3m5m): per-coarse-muscle tier picks. Deliberately NOT part of
  // programSignature below (AD6) — a tier change must never regenerate/wipe a
  // hand-edited program — and never reset in selectGoal either.
  const [priorities, setPriorities] = useState<MusclePriorities>({})

  // Gym times (mezo-4t43): each selected day prefills from the standing weekly schedule
  // (gymSlots, the Train-owned WHEN); a day with no slot defaults to 18:00. `dayTimes` holds
  // only the user's explicit edits — render + save fall back through the slot, then the default.
  const [dayTimes, setDayTimes] = useState<Record<string, string>>({})
  const slotTimeByDay = useMemo(() => {
    const m: Record<string, string> = {}
    for (const s of gymSlots) {
      const label = DAY_ORDER[s.dayOfWeek]
      if (label) m[label] = s.time
    }
    return m
  }, [gymSlots])
  const timeForDay = (day: string) => dayTimes[day] ?? slotTimeByDay[day] ?? '18:00'
  const setTimeForDay = (day: string, time: string) =>
    setDayTimes((cur) => ({ ...cur, [day]: time }))

  // Program generation lives at page level behind an input-signature guard so
  // step round-trips never wipe user edits; only real input changes regenerate.
  const generatedFor = useRef<string | null>(null)
  const programSignature = `${goal?.id ?? ''}|${split?.label ?? ''}|${days}|${selectedDays.join(',')}`
  useEffect(() => {
    // step < 4: Program is the new terminal step (index 4) — generation still only
    // kicks in once the wizard reaches it, unchanged from before the Fókusz step
    // insertion. Browsing Fókusz (step 3) never triggers or disturbs this.
    if (step < 4) return
    if (generatedFor.current === programSignature) return
    setProgram(null)
    const timer = setTimeout(() => {
      generatedFor.current = programSignature
      setProgram(generateProgram({ goal, split, days, weekdays: selectedDays, niggle: 'shoulder' }))
    }, 600)
    return () => clearTimeout(timer)
  }, [step, programSignature, goal, split, days, selectedDays])

  // --- draft mutations (lifted from Step3 so Task 5's recipe editor reuses them) ---
  // No PUT — the whole draft is saved at the end; each helper is keyed by day name.
  const removeExercise = (dayName: string, exId: string) => {
    setProgram((prev) =>
      (prev ?? []).map((d) =>
        d.day === dayName
          ? { ...d, exercises: d.exercises.filter((e) => e.id !== exId), exerciseCount: d.exercises.filter((e) => e.id !== exId).length }
          : d,
      ),
    )
  }

  // Draft-only reorder: maps the day's exercises into the new id order.
  const reorderExercises = (dayName: string, ids: string[]) => {
    setProgram((prev) =>
      (prev ?? []).map((d) => {
        if (d.day !== dayName) return d
        const byId = new Map(d.exercises.map((e) => [e.id, e]))
        const exercises = ids.map((id) => byId.get(id)).filter(Boolean) as typeof d.exercises
        return { ...d, exercises }
      }),
    )
  }

  // Custom-split days are user-named (mezo-9wv); the day key stays, only the label changes.
  const renameDay = (dayName: string, name: string) => {
    setProgram((prev) =>
      (prev ?? []).map((d) => (d.day === dayName ? { ...d, type: name } : d)),
    )
  }

  const addExercise = (dayName: string, item: ExerciseLibraryItem) => {
    setProgram((prev) =>
      (prev ?? []).map((d) => (d.day === dayName ? addExerciseWithDefaults(d, item, goal?.id) : d)),
    )
  }

  // Applies a recipe patch (warmup/working/rep-range/RIR/anchor) to one exercise.
  const updateExercise = (dayName: string, exId: string, patch: Partial<GymExercise>) => {
    setProgram((prev) =>
      (prev ?? []).map((d) =>
        d.day === dayName
          ? { ...d, exercises: d.exercises.map((e) => (e.id === exId ? { ...e, ...patch } : e)) }
          : d,
      ),
    )
  }

  const backToLibrary = () => navigate('/train/mesocycles')

  // Goal pick prefills the rest of the wizard.
  const selectGoal = (g: GoalPreset) => {
    setGoal(g)
    setName(`${g.label} · ${getSeason(startDate)}`)
    setWeeks(g.defaultWeeks)
    setPhaseCurve(g.phaseTemplate)
    setSplit(SPLITS.find((s) => s.label === g.split) ?? null)
    setDays(g.days)
    setSelectedDays(defaultWeekdays({ split: g.split, days: g.days }))
    setDaysTouched(false)
  }

  const pickSplit = (s: SplitOption) => {
    setSplit(s)
    if (!daysTouched) setSelectedDays(defaultWeekdays({ split: s, days }))
  }
  const pickDays = (d: number) => {
    setDays(d)
    if (!daysTouched) setSelectedDays(defaultWeekdays({ split, days: d }))
  }
  const toggleDay = (d: string) => {
    setDaysTouched(true)
    setSelectedDays((cur) =>
      cur.includes(d)
        ? cur.filter((x) => x !== d)
        : cur.length < days
          ? DAY_ORDER.filter((x) => cur.includes(x) || x === d)
          : cur)
  }

  // Wizard state -> contract payload. All 7 template days travel (rest days too) so the
  // backend mirrors the seed/template shape.
  // The wizard saves a TEMPLATE (mezo-meyc.1) — a timeless blueprint. „Mentés sablonként"
  // stops there and lands on the library; „Mentés + indítás" chains the one shared start
  // call to stamp an active run from it and jumps into the gym week.
  const saveTemplate = (alsoStart: boolean) => {
    const request: MesoTemplateUpsertRequest = {
      title: name || `${goal?.label ?? 'Mesociklus'} · ${getSeason(startDate)}`,
      shortTitle: goal?.label,
      goal: goal?.description,
      goalPreset: goal?.id,
      musclePriorities: Object.keys(priorities).length ? priorities : null,
      weeks,
      split: split ? `${split.label} · ${days}×/hét` : `${days}×/hét`,
      style: goal?.style ?? `${weeks} hét`,
      phaseCurve,
      days: toDayInputs(program ?? []),
    }
    // Persist the standing weekly gym schedule from the planner picks (mezo-4t43): one slot
    // per selected training day (all carry a time — default 18:00), replace-all. Mock no-ops.
    saveGymSchedule(
      selectedDays
        .map((d) => ({ dayOfWeek: DAY_ORDER.indexOf(d as (typeof DAY_ORDER)[number]), time: timeForDay(d) }))
        .filter((s) => s.dayOfWeek >= 0),
    )
    setSaving(true)
    createTemplate(request)
      .then((tpl) => {
        if (!alsoStart) return backToLibrary()
        return startTemplate(tpl.id, { startDate: startDateIso, status: 'active' })
          .then(() => navigate('/train/gym'))
          // The template IS saved even though the run never started — land on the library
          // where it now lives (never on Gym, which would fake a running block). The
          // mutation cache has already toasted the failure (§7a).
          .catch(backToLibrary)
      })
      // A failed create leaves nothing behind: stay on the wizard so the work isn't lost
      // and the save is retryable. The failure toast comes from the mutation cache (§7a).
      .catch(() => {})
      .finally(() => setSaving(false))
  }

  const canNext =
    (step === 0 && !!goal) || (step === 1 && weeks > 0)
    || (step === 2 && selectedDays.length === days) || step === 3 // Fókusz — always passable

  const handleBack = () => {
    if (step > 0) setStep(step - 1)
    else backToLibrary()
  }

  const backLabel = step === 0 ? 'Mesociklusok' : stepLabels[step - 1]

  return (
    // The route already sits inside AppLayout's .screen-content scroller — a nested
    // .screen-content would double the 54px status-bar padding (mezo-wdk).
    <div>
      {/* Breadcrumb — pinned below the status bar like native nav chrome */}
      <div className="sticky-top" style={{ padding: '8px 24px' }}>
        <button type="button" className="row gap-sm" onClick={handleBack}>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>←</span>
          <span className="eyebrow">{backLabel}</span>
        </button>
      </div>

      {/* Header */}
      <div style={{ padding: '6px 24px 0' }}>
        {/* Step progress — earlier segments tappable to jump back */}
        <div className="row gap-xs" style={{ marginBottom: 14 }}>
          {Array.from({ length: STEP_COUNT }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${i + 1}. lépés · ${stepLabels[i]}`}
              onClick={() => {
                if (i < step) setStep(i)
              }}
              style={{
                flex: 1,
                height: 3,
                background: i <= step ? 'var(--primary-base)' : 'var(--surface-2)',
                boxShadow: i === step ? '0 0 6px var(--primary-base)' : 'none',
                transition: 'all var(--duration-normal) var(--ease-out)',
                padding: 0,
                cursor: i < step ? 'pointer' : 'default',
              }}
            />
          ))}
        </div>

        <span className="eyebrow brand">
          {String(step + 1).padStart(2, '0')} / {String(STEP_COUNT).padStart(2, '0')} · {stepLabels[step]}
        </span>
      </div>
      <div className="page-header">
        <div>
          <Eyebrow brand>Edzés · Mesociklusok</Eyebrow>
          <PageTitle style={{ marginTop: 4 }}>{PAGE_TITLES[step]}</PageTitle>
        </div>
      </div>

      {step === 0 && <Step0Goal goal={goal} onSelect={selectGoal} />}
      {step === 1 && (
        <Step1Length
          goal={goal}
          name={name}
          setName={setName}
          startDate={startDate}
          startDateIso={startDateIso}
          setStartDateIso={setStartDateIso}
          weeks={weeks}
          setWeeks={setWeeks}
          phaseCurve={phaseCurve}
          setPhaseCurve={setPhaseCurve}
        />
      )}
      {step === 2 && (
        <Step2Split
          goal={goal}
          split={split}
          setSplit={pickSplit}
          days={days}
          setDays={pickDays}
          selectedDays={selectedDays}
          toggleDay={toggleDay}
          timeForDay={timeForDay}
          onTimeChange={setTimeForDay}
        />
      )}
      {step === 3 && <Step3Focus priorities={priorities} onChange={setPriorities} />}
      {step === 4 && (
        <Step4Program
          goal={goal}
          name={name}
          weeks={weeks}
          days={days}
          program={program}
          priorities={priorities}
          onAdd={addExercise}
          onRemove={removeExercise}
          onChange={updateExercise}
          onReorder={reorderExercises}
          onRename={renameDay}
        />
      )}

      {/* Nav */}
      <div style={{ padding: '16px 24px 32px' }}>
        {step < 4 && (
          <div className="row gap-sm">
            {step > 0 && (
              <button
                type="button"
                className="cta-ghost flex-1"
                style={{ padding: 14 }}
                onClick={() => setStep(step - 1)}
              >
                Vissza
              </button>
            )}
            <button
              type="button"
              className="cta-primary"
              disabled={!canNext}
              style={{
                flex: step > 0 ? 2 : 1,
                opacity: canNext ? 1 : 0.4,
                pointerEvents: canNext ? 'auto' : 'none',
                padding: 14,
              }}
              onClick={() => setStep(step + 1)}
            >
              Tovább →
            </button>
          </div>
        )}
        {step === 4 && (
          <div className="col gap-sm">
            <button
              type="button"
              className="cta-primary"
              onClick={() => saveTemplate(true)}
              disabled={saving || !program}
              style={{ padding: 14, opacity: saving || !program ? 0.5 : 1 }}
            >
              <Icon name="check" size={16} />
              <span>Mentés + indítás · {startDate}</span>
            </button>
            <button
              type="button"
              className="cta-ghost"
              style={{ padding: 12, opacity: saving || !program ? 0.5 : 1 }}
              onClick={() => saveTemplate(false)}
              disabled={saving || !program}
            >
              Mentés sablonként
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// === Step 0: Goal ===
function Step0Goal({ goal, onSelect }: { goal: GoalPreset | null; onSelect: (g: GoalPreset) => void }) {
  return (
    <div style={{ padding: '8px 24px' }}>
      <p className="text-secondary" style={{ fontSize: 16, lineHeight: 1.5, marginBottom: 16 }}>
        <SafeMarkdown text="Daniel — most az fontos hogy **mit akarunk a következő blokkban**. A többit kitaláljuk együtt." />
      </p>

      <div className="col gap-sm">
        {GOAL_PRESETS.map((g) => {
          const selected = goal?.id === g.id
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => onSelect(g)}
              className="card"
              style={{
                padding: 14,
                textAlign: 'left',
                width: '100%',
                background: selected ? CORAL_TINT : 'var(--surface-1)',
                borderColor: selected ? 'var(--line)' : 'var(--divider)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {selected && (
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: g.color }} />
              )}
              <div className="row gap-md" style={{ alignItems: 'center' }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    background: CORAL_TINT,
                    border: `1px solid ${selected ? g.color : 'var(--divider)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
                  }}
                >
                  <Icon name={g.icon} size={18} color={selected ? g.color : 'var(--text-secondary)'} />
                </div>
                <div className="col flex-1" style={{ minWidth: 0 }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span
                      style={{ fontFamily: 'var(--ff-display)', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}
                    >
                      {g.label}
                    </span>
                    <span className="label-mono text-tertiary">
                      {g.defaultWeeks} hét
                    </span>
                  </div>
                  <span className="text-tertiary" style={{ fontSize: 14, marginTop: 2 }}>
                    {g.sub}
                  </span>
                  {selected && (
                    <p style={{ fontSize: 14, marginTop: 8, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {g.description}
                    </p>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// === Step 1: Length + phase curve + name ===
function Step1Length({
  goal,
  name,
  setName,
  startDate,
  startDateIso,
  setStartDateIso,
  weeks,
  setWeeks,
  phaseCurve,
  setPhaseCurve,
}: {
  goal: GoalPreset | null
  name: string
  setName: (v: string) => void
  startDate: string
  startDateIso: string
  setStartDateIso: (v: string) => void
  weeks: number
  setWeeks: (v: number) => void
  phaseCurve: MesoPhase[]
  setPhaseCurve: (v: MesoPhase[]) => void
}) {
  // Adjust the phase curve length to match the chosen weeks count:
  //  - grow → duplicate the second-to-last phase before the Deload tail
  //  - shrink → keep the first weeks-1 phases + a Deload tail
  useEffect(() => {
    if (phaseCurve.length === weeks) return
    if (phaseCurve.length < weeks) {
      const next = [...phaseCurve]
      while (next.length < weeks) {
        const insertAt = next.length - 1
        next.splice(insertAt, 0, next[insertAt - 1] ?? 'MAV')
      }
      setPhaseCurve(next)
    } else {
      setPhaseCurve([...phaseCurve.slice(0, weeks - 1), 'Deload'])
    }
    // Deps are `[weeks]` ONLY by design: the effect calls setPhaseCurve, so
    // including phaseCurve would loop. Length only ever diverges from `weeks`
    // when the user changes weeks, so the captured phaseCurve is correct here.
  }, [weeks])

  const cyclePhase = (i: number) => {
    const idx = PHASES.indexOf(phaseCurve[i])
    const next = PHASES[(idx + 1) % PHASES.length]
    const nc = [...phaseCurve]
    nc[i] = next
    setPhaseCurve(nc)
  }

  const resetCurve = () => {
    if (goal) setPhaseCurve(goal.phaseTemplate)
  }

  // Prototype px (meso-body.html PSTYLE) ×1.18 scale (spec §1): MEV 26→31, MAV 46→54,
  // MRV 64→76, Deload 14→17.
  const phaseHeight = (p: MesoPhase) => (p === 'MEV' ? 31 : p === 'MAV' ? 54 : p === 'MRV' ? 76 : 17)

  return (
    <div style={{ padding: '8px 24px' }}>
      {/* Name + start */}
      <div className="col gap-md">
        <div className="col gap-sm">
          <span className="label-mono">Mesociklus neve</span>
          <div className="card" style={{ padding: 10 }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Mesociklus neve"
              style={{ width: '100%', fontSize: 14, color: 'var(--text-primary)' }}
              placeholder={`${goal?.label ?? ''} · ${getSeason(startDate)}`}
            />
          </div>
        </div>

        <div className="row gap-sm">
          <div className="col gap-sm flex-1">
            <span className="label-mono">Kezdés</span>
            <div className="card row" style={{ padding: '6px 12px', alignItems: 'center' }}>
              <input
                type="date"
                value={startDateIso}
                onChange={(e) => setStartDateIso(e.target.value)}
                aria-label="Kezdés dátuma"
                style={{ width: '100%', fontSize: 16, color: 'var(--text-primary)', colorScheme: 'dark' }}
              />
            </div>
          </div>
          <div className="col gap-sm flex-1">
            <span className="label-mono">Vége</span>
            <div className="card row" style={{ padding: '10px 12px', alignItems: 'center', opacity: 0.6 }}>
              <span style={{ fontSize: 16, color: 'var(--text-secondary)', flex: 1 }}>{addWeeks(startDate, weeks)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Weeks selector */}
      <div className="col gap-sm mt-xl">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span className="label-mono">Hossz</span>
          <span style={{ fontFamily: 'var(--ff-display)', fontSize: 26, fontWeight: 600, color: 'var(--primary-base)' }}>
            {weeks} <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>hét</span>
          </span>
        </div>
        <div className="row gap-xs">
          {[3, 4, 5, 6, 7, 8].map((w) => {
            const active = w === weeks
            return (
              <button
                key={w}
                type="button"
                aria-pressed={active}
                onClick={() => setWeeks(w)}
                className="segtab"
              >
                {w}
              </button>
            )
          })}
        </div>
      </div>

      {/* Phase curve editor */}
      <div className="col gap-sm mt-xl">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="label-mono">Fázis görbe · tappold a hetet</span>
          <button type="button" className="chip tapchip" onClick={resetCurve}>
            <Icon name="sparkle" size={10} /> Mezo reset
          </button>
        </div>
        <div className="card" style={{ padding: 14 }}>
          {/* Prototype .phaseed height 84px ×1.18 (spec §1) — room for the tallest MRV bar
              (76px) plus its two-line W/phase label underneath. */}
          <div className="row gap-xs" style={{ height: 99, alignItems: 'flex-end' }}>
            {phaseCurve.map((p, i) => (
              <div key={i} className="col flex-1" style={{ alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  aria-label={`W${i + 1} · ${p} · fázis váltás`}
                  onClick={() => cyclePhase(i)}
                  style={{
                    width: '100%',
                    height: phaseHeight(p),
                    background: MESOCYCLE_PHASE_COLORS[p],
                    transition: 'all 0.3s ease',
                    clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 2px), calc(100% - 2px) 100%, 0 100%)',
                    cursor: 'pointer',
                  }}
                />
                <span className="statstrip-l">
                  W{i + 1}
                </span>
                <span className="statstrip-l" style={{ color: MESOCYCLE_PHASE_COLORS[p] }}>
                  {p}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mezo hint */}
      <div className="card mt-lg" style={{ padding: 12, background: CORAL_TINT }}>
        <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
          <Icon name="sparkle" size={16} color="var(--primary-base)" />
          <div className="col flex-1">
            <span className="eyebrow brand">Mezo javasolja</span>
            <p style={{ fontSize: 14, marginTop: 6, lineHeight: 1.5, color: 'var(--text-primary)' }}>
              {goal ? GOAL_HINTS[goal.id] : ''}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// === Step 2: Split + days ===
function Step2Split({
  goal,
  split,
  setSplit,
  days,
  setDays,
  selectedDays,
  toggleDay,
  timeForDay,
  onTimeChange,
}: {
  goal: GoalPreset | null
  split: SplitOption | null
  setSplit: (v: SplitOption) => void
  days: number
  setDays: (v: number) => void
  selectedDays: string[]
  toggleDay: (d: string) => void
  timeForDay: (d: string) => string
  onTimeChange: (d: string, t: string) => void
}) {
  return (
    <div style={{ padding: '8px 24px' }}>
      <p className="text-secondary" style={{ fontSize: 16, lineHeight: 1.5, marginBottom: 16 }}>
        <SafeMarkdown text="Daniel — most a hét struktúrája. **5×/hét** a heti volleyball + gym mintád." />
      </p>

      <div className="col gap-sm">
        {SPLITS.map((s) => {
          const selected = split?.label === s.label
          return (
            <button
              key={s.label}
              type="button"
              onClick={() => setSplit(s)}
              className="card"
              style={{
                padding: 14,
                textAlign: 'left',
                width: '100%',
                background: selected ? CORAL_TINT : 'var(--surface-1)',
                borderColor: selected ? 'var(--line)' : 'var(--divider)',
              }}
            >
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="col">
                  <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{s.label}</span>
                  {s.best === goal?.id && goal && (
                    <span className="label-mono" style={{ color: 'var(--primary-deep)', marginTop: 2 }}>
                      ★ Mezo ajánlja {goal.label}-hez
                    </span>
                  )}
                </div>
                <span className="label-mono text-tertiary">
                  {s.days.join('/')}×/hét
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Days/week */}
      <div className="col gap-sm mt-xl">
        <span className="label-mono">Edzések száma · hetente</span>
        <div className="row gap-xs">
          {[3, 4, 5, 6].map((d) => {
            const active = d === days
            return (
              <button
                key={d}
                type="button"
                aria-pressed={active}
                onClick={() => setDays(d)}
                className="segtab"
              >
                {d}
                <span style={{ fontSize: 14, color: 'var(--text-tertiary)', marginLeft: 3 }}>×</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Gym weekdays — exactly `days` must stay selected (mezo-cne) */}
      <div className="col gap-sm mt-xl">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="label-mono">Melyik napokon?</span>
          <span
            className="label-mono"
            style={{ color: selectedDays.length === days ? 'var(--primary-deep)' : 'var(--warning-hover)' }}
          >
            {selectedDays.length}/{days}
          </span>
        </div>
        <div className="row gap-xs">
          {DAY_ORDER.map((d) => {
            const active = selectedDays.includes(d)
            return (
              <button
                key={d}
                type="button"
                aria-pressed={active}
                onClick={() => toggleDay(d)}
                className="segtab"
              >
                {d}
              </button>
            )
          })}
        </div>
        {selectedDays.length !== days && (
          <span className="label-mono" style={{ color: 'var(--warning-hover)' }}>
            Válassz pontosan {days} napot a folytatáshoz.
          </span>
        )}
      </div>

      {/* Gym times — one time per selected day; prefilled from the standing schedule (mezo-4t43) */}
      {selectedDays.length > 0 && (
        <div className="col gap-sm mt-xl">
          <span className="label-mono">Időpontok · mikor mész</span>
          <p className="text-tertiary" style={{ fontSize: 14, lineHeight: 1.5 }}>
            Ebből számolja a Fuel a pre/post-workout étkezést és supplement-timing-ot.
          </p>
          <div className="col gap-sm">
            {DAY_ORDER.filter((d) => selectedDays.includes(d)).map((d) => (
              <div key={d} className="card" style={{ padding: 10 }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="label-mono" style={{ width: 36, color: 'var(--primary-base)' }}>
                    {d}
                  </span>
                  <input
                    type="time"
                    aria-label={`${d} időpont`}
                    value={timeForDay(d)}
                    onChange={(e) => onTimeChange(d, e.target.value)}
                    style={{
                      background: 'var(--surface-2)', border: '1px solid var(--divider)',
                      color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', fontSize: 16,
                      padding: '8px 10px', width: 130,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exercise auto-fill option */}
      <div className="card mt-xl" style={{ padding: 14, background: CORAL_TINT }}>
        <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
          <Icon name="sparkle" size={16} color="var(--primary-base)" />
          <div className="col flex-1">
            <span className="eyebrow brand">Gyakorlatok · automatikusan</span>
            <p style={{ fontSize: 14, marginTop: 6, lineHeight: 1.5, color: 'var(--text-primary)' }}>
              A Mezo a STIM/fatigue rangsor + niggle-aware substitúció + korábbi mesók kedvenc gyakorlatai alapján kitölti. Az 5.
              lépésben átnézzük, és bármit cserélhetsz.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// === Step 3: Fókusz — muscle priority tier picker (mezo-3m5m). Always
// passable; deliberately never touches `program` — the picker only feeds the
// terminal step's MesoEditor budget/fit cards, it never regenerates anything. ===
function Step3Focus({ priorities, onChange }: { priorities: MusclePriorities; onChange: (next: MusclePriorities) => void }) {
  return (
    <div style={{ padding: '8px 24px' }}>
      <p className="text-secondary" style={{ fontSize: 16, lineHeight: 1.5, marginBottom: 16 }}>
        <SafeMarkdown text="Daniel — mielőtt legenerálnánk a programot: melyik izomcsoportokra gyúrjunk rá ebben a blokkban? A hangsúlyos csoportok MRV-ig mennek fel, a többi a szokásos MAV-ütemben nő." />
      </p>
      <MusclePriorityPicker value={priorities} onChange={onChange} />
    </div>
  )
}

// === Step 4 (terminal): AI-generated program review + set/rep tuning on the
// unified MesoEditor (day tabs, set-budget card, accordion recipe rows) ===
function Step4Program({
  goal,
  name,
  weeks,
  days,
  program,
  priorities,
  onAdd,
  onRemove,
  onChange,
  onReorder,
  onRename,
}: {
  goal: GoalPreset | null
  name: string
  weeks: number
  days: number
  program: PlannerDay[] | null
  priorities: MusclePriorities
  onAdd: (dayName: string, item: ExerciseLibraryItem) => void
  onRemove: (dayName: string, exId: string) => void
  onChange: (dayName: string, exId: string, patch: Partial<GymExercise>) => void
  onReorder: (dayName: string, ids: string[]) => void
  onRename: (dayName: string, name: string) => void
}) {
  const [pickerDay, setPickerDay] = useState<string | null>(null)
  // Calibrated pacing (Task 12, mezo-dzbm) for the MesoEditor hero below — called here
  // (before the early "still generating" return, since hooks must run unconditionally)
  // rather than inside MesoEditor itself: components/ stay presentational, pages/ own data
  // fetching (frontend_conventions.md).
  const { data: timingProfile, isPending: timingProfilePending } = useTimingProfile()

  if (!program) {
    return (
      <div style={{ padding: '32px 24px', textAlign: 'center' }}>
        <div className="row gap-xs" style={{ justifyContent: 'center', marginBottom: 12 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="np-pulse"
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--primary-base)',
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
        <span className="text-secondary" style={{ fontSize: 14 }}>
          A Mezo összerakja a programot…
        </span>
      </div>
    )
  }

  const totalExercises = program.reduce((a, d) => a + (d.exerciseCount || 0), 0)
  const totalSets = program.reduce((a, d) => a + d.exercises.reduce((b, e) => b + e.workingSets, 0), 0)

  return (
    <div style={{ padding: '8px 24px' }}>
      {/* Summary header */}
      <div
        className="card"
        style={{
          padding: 14,
          background: 'linear-gradient(180deg, color-mix(in srgb, var(--primary-base) 6%, transparent) 0%, var(--surface-1) 100%)',
          borderColor: 'var(--line)',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: 14,
        }}
      >
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: goal?.color ?? 'var(--primary-base)' }} />
        <div style={{ position: 'relative' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="col">
              <span className="eyebrow brand">A te blokkod · AI-generated</span>
              <Display size="md" className="mt-sm">
                {name}
              </Display>
            </div>
          </div>
          <div className="row gap-md mt-md" style={{ paddingTop: 10, borderTop: '1px solid var(--divider)' }}>
            <MiniStat label="Hossz" val={`${weeks}h`} />
            <MiniStat label="Napok" val={`${days}×`} />
            <MiniStat label="Gyak" val={totalExercises} />
            <MiniStat label="Szet" val={totalSets} highlight />
          </div>
        </div>
      </div>

      {/* AI hint */}
      <div className="card" style={{ padding: 12, background: 'color-mix(in srgb, var(--primary-base) 3%, transparent)', marginBottom: 14 }}>
        <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
          <Icon name="sparkle" size={16} color="var(--primary-base)" />
          <div className="col flex-1">
            <span className="eyebrow brand">Mezo · ezt raktam össze</span>
            <p style={{ fontSize: 14, marginTop: 6, lineHeight: 1.5, color: 'var(--text-primary)' }}>
              <SafeMarkdown
                text={`STIM/fatigue rangsor + jobb váll niggle figyelembe vétele + a ${goal?.label ?? ''}-fókuszhoz illő szet/rep séma. **Bármit kicserélhetsz · drag-rendezhetsz · új gyakorlatot adhatsz hozzá.**`}
              />
            </p>
          </div>
        </div>
      </div>

      {/* Day tabs + set-budget card + accordion recipe editor (shared with the builder's Gyakorlatok view) */}
      <MesoEditor
        days={program}
        onAddClick={setPickerDay}
        onRemove={onRemove}
        onChange={onChange}
        onReorder={onReorder}
        onRenameDay={onRename}
        priorities={priorities}
        timingProfile={timingProfile}
        timingProfilePending={timingProfilePending}
      />

      {pickerDay && (
        <ExercisePickerSheet
          dayLabel={(() => {
            const d = program?.find((x) => x.day === pickerDay)
            return d ? `${d.day} · ${d.type}` : undefined
          })()}
          onClose={() => setPickerDay(null)}
          onPick={(item) => onAdd(pickerDay, item)}
        />
      )}
    </div>
  )
}
