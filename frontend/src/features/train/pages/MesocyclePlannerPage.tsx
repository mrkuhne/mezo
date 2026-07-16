// ============================================================
// Mezo · MesocyclePlannerPage — 4-step AI-guided new-mesocycle planner.
// Full-screen sibling route (/train/mesocycles/new): own back-button header,
// 4-segment progress bar, eyebrow brand step counter, per-step page title and
// footer nav. The planner does NOT persist — both step-3 save actions just
// navigate back to the library.
//   Step 0 · Cél             → goal preset picker (prefills the rest)
//   Step 1 · Hossz + fázisok → name / start / length / phase-curve editor
//   Step 2 · Split + napok   → split picker + days-per-week
//   Step 3 · Áttekintés      → generateProgram review (collapsible days)
// Ported from prototype meso-planner.jsx MesocyclePlannerPage + its step parts.
// ============================================================
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrain } from '@/data/hooks'
import type { ExerciseLibraryItem, GoalPreset, MesoPhase, SplitOption } from '@/data/types'
import type { MesocycleCreateRequest } from '@/data/train/trainApi'
import { huMonthDay } from '@/shared/lib/dates'
import { DAY_ORDER, GOAL_PRESETS, SPLITS, MESOCYCLE_PHASE_COLORS } from '@/data/train/train'
import { Icon } from '@/shared/ui/Icon'
import { Display } from '@/shared/ui/Display'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { addWeeks, defaultWeekdays, generateProgram, getSeason, GOAL_HINTS, stepLabels } from '@/features/train/logic/planner'
import type { PlannerDay } from '@/features/train/logic/planner'
import { ExercisePickerSheet } from '@/features/train/sheets/ExercisePickerSheet'
import { PlannerDaySection } from '@/features/train/components/PlannerDaySection'
import { MiniStat } from '@/features/train/components/MiniStat'

const STEP_COUNT = 4
const PHASES: MesoPhase[] = ['MEV', 'MAV', 'MRV', 'Deload']
const CORAL_TINT = 'color-mix(in srgb, var(--coral) 6%, transparent)'
const CORAL_TINT_STRONG = 'color-mix(in srgb, var(--coral) 12%, transparent)'

const PAGE_TITLES = [
  'Mit szeretnénk építeni?',
  'Mennyi időnk van?',
  'Hogyan osszuk be?',
  'AI program · áttekintés',
] as const

export function MesocyclePlannerPage() {
  const navigate = useNavigate()
  const { createMesocycle, mesoMutationPending } = useTrain()
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
  // backend mirrors the seed/template shape; mock mode no-ops and just navigates (Phase 1).
  const saveMesocycle = (status: 'planned' | 'active') => {
    const request: MesocycleCreateRequest = {
      title: name || `${goal?.label ?? 'Mesociklus'} · ${getSeason(startDate)}`,
      shortTitle: goal?.label,
      status,
      goal: goal?.description,
      startDate: startDateIso,
      weeks,
      split: split ? `${split.label} · ${days}×/hét` : `${days}×/hét`,
      style: goal?.style ?? `${weeks} hét`,
      phaseCurve,
      days: (program ?? []).map((d) => ({
        day: d.day,
        type: d.type,
        muscle: d.muscle,
        muscleAccent: d.muscleAccent || undefined,
        note: d.note,
        exercises: d.exercises.map((e) => ({
          name: e.name, muscle: e.muscle,
          warmupSets: e.warmupSets, workingSets: e.workingSets,
          repMin: e.repMin, repMax: e.repMax, targetRIR: e.targetRIR,
          anchorWeightKg: e.anchorWeightKg, type: e.type, warning: e.warning, catalogId: e.catalogId,
        })),
      })),
    }
    createMesocycle(request, { onSuccess: backToLibrary })
  }

  const canNext =
    (step === 0 && !!goal) || (step === 1 && weeks > 0)
    || (step === 2 && selectedDays.length === days) || step === 3

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
                background: i <= step ? 'var(--coral)' : 'var(--surface-2)',
                boxShadow: i === step ? '0 0 6px var(--coral)' : 'none',
                transition: 'all 0.3s ease',
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
      <div className="pghead-np">
        <div>
          <div className="over">Edzés · Mesociklusok</div>
          <h1>{PAGE_TITLES[step]}</h1>
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
        />
      )}
      {step === 3 && (
        <Step3Program
          goal={goal}
          name={name}
          weeks={weeks}
          split={split}
          days={days}
          weekdays={selectedDays}
          program={program}
          setProgram={setProgram}
        />
      )}

      {/* Nav */}
      <div style={{ padding: '16px 24px 32px' }}>
        {step < 3 && (
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
        {step === 3 && (
          <div className="col gap-sm">
            <button
              type="button"
              className="cta-primary"
              onClick={() => saveMesocycle('planned')}
              disabled={mesoMutationPending || !program}
              style={{ padding: 14, opacity: mesoMutationPending || !program ? 0.5 : 1 }}
            >
              <Icon name="check" size={16} />
              <span>Hozzáad mint tervezett</span>
            </button>
            <button
              type="button"
              className="cta-ghost"
              style={{ padding: 12, opacity: mesoMutationPending || !program ? 0.5 : 1 }}
              onClick={() => saveMesocycle('active')}
              disabled={mesoMutationPending || !program}
            >
              Aktiválás most · {startDate}
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
      <p className="text-secondary" style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>
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
                borderColor: selected ? 'var(--line)' : 'var(--border-subtle)',
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
                    border: `1px solid ${selected ? g.color : 'var(--border-subtle)'}`,
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
                    <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                      {g.defaultWeeks} hét
                    </span>
                  </div>
                  <span className="text-tertiary" style={{ fontSize: 11, marginTop: 2 }}>
                    {g.sub}
                  </span>
                  {selected && (
                    <p style={{ fontSize: 11, marginTop: 8, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
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

  const phaseHeight = (p: MesoPhase) => (p === 'MEV' ? 20 : p === 'MAV' ? 40 : p === 'MRV' ? 60 : 12)

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
                style={{ width: '100%', fontSize: 13, color: 'var(--text-primary)', colorScheme: 'dark' }}
              />
            </div>
          </div>
          <div className="col gap-sm flex-1">
            <span className="label-mono">Vége</span>
            <div className="card row" style={{ padding: '10px 12px', alignItems: 'center', opacity: 0.6 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', flex: 1 }}>{addWeeks(startDate, weeks)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Weeks selector */}
      <div className="col gap-sm mt-xl">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span className="label-mono">Hossz</span>
          <span style={{ fontFamily: 'var(--ff-display)', fontSize: 26, fontWeight: 600, color: 'var(--coral)' }}>
            {weeks} <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>hét</span>
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
                className="flex-1 rad-12"
                style={{
                  padding: '10px 0',
                  background: active ? CORAL_TINT_STRONG : 'var(--surface-1)',
                  border: `1px solid ${active ? 'var(--coral)' : 'var(--border-subtle)'}`,
                  color: active ? 'var(--coral)' : 'var(--text-secondary)',
                  fontFamily: 'var(--ff-display)',
                  fontSize: 14,
                  fontWeight: 600,
                  boxShadow: active ? 'inset 0 0 0 1px color-mix(in srgb, var(--coral) 20%, transparent)' : 'none',
                }}
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
          <button type="button" className="chip" onClick={resetCurve} style={{ fontSize: 9 }}>
            <Icon name="sparkle" size={10} /> Mezo reset
          </button>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div className="row gap-xs" style={{ height: 70, alignItems: 'flex-end' }}>
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
                <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>
                  W{i + 1}
                </span>
                <span className="label-mono" style={{ fontSize: 7, color: MESOCYCLE_PHASE_COLORS[p], letterSpacing: '0.08em' }}>
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
          <Icon name="sparkle" size={12} color="var(--coral)" />
          <div className="col flex-1">
            <span className="eyebrow brand">Mezo javasolja</span>
            <p style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5, color: 'var(--text-primary)' }}>
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
}: {
  goal: GoalPreset | null
  split: SplitOption | null
  setSplit: (v: SplitOption) => void
  days: number
  setDays: (v: number) => void
  selectedDays: string[]
  toggleDay: (d: string) => void
}) {
  return (
    <div style={{ padding: '8px 24px' }}>
      <p className="text-secondary" style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>
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
                borderColor: selected ? 'var(--line)' : 'var(--border-subtle)',
              }}
            >
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="col">
                  <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{s.label}</span>
                  {s.best === goal?.id && goal && (
                    <span className="label-mono" style={{ fontSize: 9, color: 'var(--coral)', marginTop: 2 }}>
                      ★ Mezo ajánlja {goal.label}-hez
                    </span>
                  )}
                </div>
                <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
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
                className="flex-1 rad-12"
                style={{
                  padding: '12px 0',
                  background: active ? CORAL_TINT_STRONG : 'var(--surface-1)',
                  border: `1px solid ${active ? 'var(--coral)' : 'var(--border-subtle)'}`,
                  color: active ? 'var(--coral)' : 'var(--text-secondary)',
                  fontFamily: 'var(--ff-display)',
                  fontSize: 16,
                  fontWeight: 600,
                }}
              >
                {d}
                <span style={{ fontSize: 9, color: 'var(--text-tertiary)', marginLeft: 3 }}>×</span>
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
            style={{ fontSize: 9, color: selectedDays.length === days ? 'var(--coral)' : 'var(--warning)' }}
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
                className="flex-1 rad-12"
                style={{
                  padding: '10px 0',
                  background: active ? CORAL_TINT_STRONG : 'var(--surface-1)',
                  border: `1px solid ${active ? 'var(--coral)' : 'var(--border-subtle)'}`,
                  color: active ? 'var(--coral)' : 'var(--text-tertiary)',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                {d}
              </button>
            )
          })}
        </div>
        {selectedDays.length !== days && (
          <span className="label-mono" style={{ fontSize: 9, color: 'var(--warning)' }}>
            Válassz pontosan {days} napot a folytatáshoz.
          </span>
        )}
      </div>

      {/* Exercise auto-fill option */}
      <div className="card mt-xl" style={{ padding: 14, background: CORAL_TINT }}>
        <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
          <Icon name="sparkle" size={12} color="var(--coral)" />
          <div className="col flex-1">
            <span className="eyebrow brand">Gyakorlatok · automatikusan</span>
            <p style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5, color: 'var(--text-primary)' }}>
              A Mezo a STIM/fatigue rangsor + niggle-aware substitúció + korábbi mesók kedvenc gyakorlatai alapján kitölti. A 4.
              lépésben átnézzük, és bármit cserélhetsz.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// === Step 3: AI-generated program review ===
function Step3Program({
  goal,
  name,
  weeks,
  split,
  days,
  weekdays,
  program,
  setProgram,
}: {
  goal: GoalPreset | null
  name: string
  weeks: number
  split: SplitOption | null
  days: number
  weekdays: string[]
  program: PlannerDay[] | null
  setProgram: (v: PlannerDay[] | null | ((prev: PlannerDay[] | null) => PlannerDay[] | null)) => void
}) {
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const [pickerDay, setPickerDay] = useState<string | null>(null)

  // Brief loading state, then generate the program (re-run if inputs change).
  // The first training day auto-expands ONCE per generation, right here — a
  // standalone "expand when null" effect would re-open every user collapse (mezo-xnq).
  useEffect(() => {
    setProgram(null)
    setExpandedDay(null)
    const timer = setTimeout(() => {
      const prog = generateProgram({ goal, split, days, weekdays, niggle: 'shoulder' })
      setProgram(prog)
      // type-based: a custom day starts with 0 exercises but is still the day to open
      setExpandedDay(prog.find((d) => d.type !== 'Rest' && d.type !== 'Volleyball')?.day ?? null)
    }, 600)
    return () => clearTimeout(timer)
  }, [goal, split, days, weekdays])

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
                background: 'var(--coral)',
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
        <span className="text-secondary" style={{ fontSize: 12 }}>
          A Mezo összerakja a programot…
        </span>
      </div>
    )
  }

  const totalExercises = program.reduce((a, d) => a + (d.exerciseCount || 0), 0)
  const totalSets = program.reduce((a, d) => a + d.exercises.reduce((b, e) => b + e.workingSets, 0), 0)

  const removeExercise = (dayName: string, exId: string) => {
    setProgram((prev) =>
      (prev ?? []).map((d) =>
        d.day === dayName
          ? { ...d, exercises: d.exercises.filter((e) => e.id !== exId), exerciseCount: d.exercises.filter((e) => e.id !== exId).length }
          : d,
      ),
    )
  }

  // Draft-only reorder: maps the day's exercises into the new id order and
  // updates local program state. No PUT — the whole draft is saved at the end.
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
      (prev ?? []).map((d) => {
        if (d.day !== dayName) return d
        const exercises = [
          ...d.exercises,
          {
            id: `${item.id}-${Date.now()}`, name: item.name, muscle: item.muscle, type: item.type,
            warmupSets: 2, workingSets: 3, repMin: 6, repMax: 8, targetRIR: 0,
            ...(item.catalogId ? { catalogId: item.catalogId } : {}),
          },
        ]
        return { ...d, exercises, exerciseCount: exercises.length }
      }),
    )
  }

  return (
    <div style={{ padding: '8px 24px' }}>
      {/* Summary header */}
      <div
        className="card"
        style={{
          padding: 14,
          background: 'linear-gradient(180deg, color-mix(in srgb, var(--coral) 6%, transparent) 0%, var(--surface-1) 100%)',
          borderColor: 'var(--line)',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: 14,
        }}
      >
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: goal?.color ?? 'var(--coral)' }} />
        <div style={{ position: 'relative' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="col">
              <span className="eyebrow brand">A te blokkod · AI-generated</span>
              <Display size="md" className="mt-sm">
                {name}
              </Display>
            </div>
          </div>
          <div className="row gap-md mt-md" style={{ paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
            <MiniStat label="Hossz" val={`${weeks}h`} />
            <MiniStat label="Napok" val={`${days}×`} />
            <MiniStat label="Gyak" val={totalExercises} />
            <MiniStat label="Szet" val={totalSets} highlight />
          </div>
        </div>
      </div>

      {/* AI hint */}
      <div className="card" style={{ padding: 12, background: 'color-mix(in srgb, var(--coral) 3%, transparent)', marginBottom: 14 }}>
        <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
          <Icon name="sparkle" size={12} color="var(--coral)" />
          <div className="col flex-1">
            <span className="eyebrow brand">Mezo · ezt raktam össze</span>
            <p style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5, color: 'var(--text-primary)' }}>
              <SafeMarkdown
                text={`STIM/fatigue rangsor + jobb váll niggle figyelembe vétele + a ${goal?.label ?? ''}-fókuszhoz illő szet/rep séma. **Bármit kicserélhetsz · drag-rendezhetsz · új gyakorlatot adhatsz hozzá.**`}
              />
            </p>
          </div>
        </div>
      </div>

      {/* Days */}
      <div className="col gap-sm">
        {program.map((d) => (
          <PlannerDaySection
            key={d.day}
            day={d}
            expanded={expandedDay === d.day}
            onToggle={() => setExpandedDay((cur) => (cur === d.day ? null : d.day))}
            onRemove={(exId) => removeExercise(d.day, exId)}
            onReorder={(ids) => reorderExercises(d.day, ids)}
            onAdd={() => setPickerDay(d.day)}
            onRename={d.muscle === 'custom' ? (name) => renameDay(d.day, name) : undefined}
          />
        ))}
      </div>

      {/* Tool transparency */}
      <div className="row gap-xs flex-wrap mt-lg">
        <span className="toolchip read" style={{ fontSize: 9 }}>
          get_meso_history()
        </span>
        <span className="toolchip read" style={{ fontSize: 9 }}>
          get_niggle_events()
        </span>
        <span className="toolchip compute" style={{ fontSize: 9 }}>
          generateMesoPlan(goal, split)
        </span>
        <span className="toolchip compute" style={{ fontSize: 9 }}>
          rankByStimFatigue()
        </span>
      </div>

      {pickerDay && (
        <ExercisePickerSheet
          onClose={() => setPickerDay(null)}
          onPick={(item) => addExercise(pickerDay, item)}
        />
      )}
    </div>
  )
}
