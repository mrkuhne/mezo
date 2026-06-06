// ============================================================
// Mezo · MesocyclePlanner — 4-step AI-guided new-mesocycle planner.
// Full-screen sibling route (/train/mesocycles/new): own back-button header,
// 4-segment progress bar, eyebrow brand step counter, per-step page title and
// footer nav. The planner does NOT persist — both step-3 save actions just
// navigate back to the library.
//   Step 0 · Cél             → goal preset picker (prefills the rest)
//   Step 1 · Hossz + fázisok → name / start / length / phase-curve editor
//   Step 2 · Split + napok   → split picker + days-per-week
//   Step 3 · Áttekintés      → generateProgram review (collapsible days)
// Ported from prototype meso-planner.jsx MesocyclePlanner + its step parts.
// ============================================================
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { GoalPreset, MesoPhase, SplitOption } from '@/data/types'
import { GOAL_PRESETS, SPLITS, MESOCYCLE_PHASE_COLORS } from '@/data/train'
import { Icon } from '@/components/ui/Icon'
import { Display } from '@/components/ui/Display'
import { SafeMarkdown } from '@/lib/safeMarkdown'
import { addWeeks, generateProgram, getSeason, GOAL_HINTS, stepLabels } from './planner'
import type { PlannerDay } from './planner'
import { ExercisePickerSheet } from './components/ExercisePickerSheet'
import { PlannerDaySection } from './components/PlannerDaySection'
import { MiniStat } from './components/MiniStat'

const STEP_COUNT = 4
const PHASES: MesoPhase[] = ['MEV', 'MAV', 'MRV', 'Deload']
const BRAND_TINT = 'color-mix(in srgb, var(--brand-glow) 6%, transparent)'
const BRAND_TINT_STRONG = 'color-mix(in srgb, var(--brand-glow) 12%, transparent)'

const PAGE_TITLES = [
  'Mit szeretnénk építeni?',
  'Mennyi időnk van?',
  'Hogyan osszuk be?',
  'AI program · áttekintés',
] as const

export function MesocyclePlanner() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [goal, setGoal] = useState<GoalPreset | null>(null)
  const [name, setName] = useState('')
  const [startDate] = useState('Jún 16')
  const [weeks, setWeeks] = useState(6)
  const [phaseCurve, setPhaseCurve] = useState<MesoPhase[]>(['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'Deload'])
  const [split, setSplit] = useState<SplitOption | null>(null)
  const [days, setDays] = useState(5)

  const backToLibrary = () => navigate('/train/mesocycles')

  // Goal pick prefills the rest of the wizard.
  const selectGoal = (g: GoalPreset) => {
    setGoal(g)
    setName(`${g.label} · ${getSeason(startDate)}`)
    setWeeks(g.defaultWeeks)
    setPhaseCurve(g.phaseTemplate)
    setSplit(SPLITS.find((s) => s.label === g.split) ?? null)
    setDays(g.days)
  }

  const canNext =
    (step === 0 && !!goal) || (step === 1 && weeks > 0) || step === 2 || step === 3

  const handleBack = () => {
    if (step > 0) setStep(step - 1)
    else backToLibrary()
  }

  const backLabel = step === 0 ? 'Mesociklusok' : stepLabels[step - 1]

  return (
    <div className="screen-content">
      {/* Header */}
      <div style={{ padding: '12px 24px' }}>
        <button type="button" className="row gap-sm" onClick={handleBack} style={{ marginBottom: 14 }}>
          <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--ff-mono)', fontSize: 14 }}>←</span>
          <span className="eyebrow">{backLabel}</span>
        </button>

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
                background: i <= step ? 'var(--brand-glow)' : 'var(--surface-2)',
                boxShadow: i === step ? '0 0 6px var(--brand-glow)' : 'none',
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
        <div className="page-title mt-sm">{PAGE_TITLES[step]}</div>
      </div>

      {step === 0 && <Step0Goal goal={goal} onSelect={selectGoal} />}
      {step === 1 && (
        <Step1Length
          goal={goal}
          name={name}
          setName={setName}
          startDate={startDate}
          weeks={weeks}
          setWeeks={setWeeks}
          phaseCurve={phaseCurve}
          setPhaseCurve={setPhaseCurve}
        />
      )}
      {step === 2 && <Step2Split goal={goal} split={split} setSplit={setSplit} days={days} setDays={setDays} />}
      {step === 3 && (
        <Step3Program goal={goal} name={name} weeks={weeks} split={split} days={days} />
      )}

      {/* Nav */}
      <div style={{ padding: '16px 24px 32px' }}>
        {step < 3 && (
          <div className="row gap-sm">
            {step > 0 && (
              <button
                type="button"
                className="cta-ghost notch-4 flex-1"
                style={{ padding: 14 }}
                onClick={() => setStep(step - 1)}
              >
                Vissza
              </button>
            )}
            <button
              type="button"
              className="cta-primary notch-8"
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
            <button type="button" className="cta-primary notch-8" onClick={backToLibrary} style={{ padding: 14 }}>
              <Icon name="check" size={16} />
              <span>Hozzáad mint tervezett</span>
            </button>
            <button type="button" className="cta-ghost notch-4" style={{ padding: 12 }} onClick={backToLibrary}>
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
              className="card notch-8"
              style={{
                padding: 14,
                textAlign: 'left',
                width: '100%',
                background: selected ? BRAND_TINT : 'var(--surface-1)',
                borderColor: selected ? 'var(--border-brand)' : 'var(--border-subtle)',
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
                    background: BRAND_TINT,
                    border: `1px solid ${selected ? g.color : 'var(--border-subtle)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
                  }}
                >
                  <Icon name="train" size={18} color={selected ? g.color : 'var(--text-secondary)'} />
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
                  <span className="text-tertiary" style={{ fontSize: 11, marginTop: 2, fontFamily: 'var(--ff-mono)' }}>
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
  weeks,
  setWeeks,
  phaseCurve,
  setPhaseCurve,
}: {
  goal: GoalPreset | null
  name: string
  setName: (v: string) => void
  startDate: string
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
          <div className="card notch-4" style={{ padding: 10 }}>
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
            <div className="card notch-4 row" style={{ padding: '10px 12px', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>{startDate} · 2026</span>
              <Icon name="chevron-down" size={12} color="var(--text-tertiary)" />
            </div>
          </div>
          <div className="col gap-sm flex-1">
            <span className="label-mono">Vége</span>
            <div className="card notch-4 row" style={{ padding: '10px 12px', alignItems: 'center', opacity: 0.6 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', flex: 1 }}>{addWeeks(startDate, weeks)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Weeks selector */}
      <div className="col gap-sm mt-xl">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span className="label-mono">Hossz</span>
          <span style={{ fontFamily: 'var(--ff-display)', fontSize: 26, fontWeight: 600, color: 'var(--brand-glow)' }}>
            {weeks} <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 12, color: 'var(--text-tertiary)' }}>hét</span>
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
                className="flex-1 notch-4"
                style={{
                  padding: '10px 0',
                  background: active ? BRAND_TINT_STRONG : 'var(--surface-1)',
                  border: `1px solid ${active ? 'var(--brand-glow)' : 'var(--border-subtle)'}`,
                  color: active ? 'var(--brand-glow)' : 'var(--text-secondary)',
                  fontFamily: 'var(--ff-display)',
                  fontSize: 14,
                  fontWeight: 600,
                  boxShadow: active ? 'inset 0 0 0 1px color-mix(in srgb, var(--brand-glow) 20%, transparent)' : 'none',
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
        <div className="card notch-12" style={{ padding: 14 }}>
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
      <div className="card notch-4 mt-lg" style={{ padding: 12, background: BRAND_TINT }}>
        <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
          <Icon name="sparkle" size={12} color="var(--brand-glow)" />
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
}: {
  goal: GoalPreset | null
  split: SplitOption | null
  setSplit: (v: SplitOption) => void
  days: number
  setDays: (v: number) => void
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
              className="card notch-4"
              style={{
                padding: 14,
                textAlign: 'left',
                width: '100%',
                background: selected ? BRAND_TINT : 'var(--surface-1)',
                borderColor: selected ? 'var(--border-brand)' : 'var(--border-subtle)',
              }}
            >
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="col">
                  <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{s.label}</span>
                  {s.best === goal?.id && goal && (
                    <span className="label-mono" style={{ fontSize: 9, color: 'var(--brand-glow)', marginTop: 2 }}>
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
                className="flex-1 notch-4"
                style={{
                  padding: '12px 0',
                  background: active ? BRAND_TINT_STRONG : 'var(--surface-1)',
                  border: `1px solid ${active ? 'var(--brand-glow)' : 'var(--border-subtle)'}`,
                  color: active ? 'var(--brand-glow)' : 'var(--text-secondary)',
                  fontFamily: 'var(--ff-display)',
                  fontSize: 16,
                  fontWeight: 600,
                }}
              >
                {d}
                <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, color: 'var(--text-tertiary)', marginLeft: 3 }}>×</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Exercise auto-fill option */}
      <div className="card notch-4 mt-xl" style={{ padding: 14, background: BRAND_TINT }}>
        <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
          <Icon name="sparkle" size={12} color="var(--brand-glow)" />
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
}: {
  goal: GoalPreset | null
  name: string
  weeks: number
  split: SplitOption | null
  days: number
}) {
  const [program, setProgram] = useState<PlannerDay[] | null>(null)
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const [pickerDay, setPickerDay] = useState<string | null>(null)

  // Brief loading state, then generate the program (re-run if inputs change).
  useEffect(() => {
    setProgram(null)
    const timer = setTimeout(() => {
      setProgram(generateProgram({ goal, split, days, niggle: 'shoulder' }))
    }, 600)
    return () => clearTimeout(timer)
  }, [goal, split, days])

  // Auto-expand the first training day once the program lands.
  useEffect(() => {
    if (program && expandedDay == null) {
      const first = program.find((d) => d.exerciseCount > 0)
      if (first) setExpandedDay(first.day)
    }
  }, [program, expandedDay])

  if (!program) {
    return (
      <div style={{ padding: '32px 24px', textAlign: 'center' }}>
        <div className="row gap-xs" style={{ justifyContent: 'center', marginBottom: 12 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--brand-glow)',
                animation: `pulse-soft 1.2s ease-in-out infinite ${i * 0.2}s`,
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
  const totalSets = program.reduce((a, d) => a + d.exercises.reduce((b, e) => b + e.sets, 0), 0)

  const removeExercise = (dayName: string, exId: string) => {
    setProgram((prev) =>
      (prev ?? []).map((d) =>
        d.day === dayName
          ? { ...d, exercises: d.exercises.filter((e) => e.id !== exId), exerciseCount: d.exercises.filter((e) => e.id !== exId).length }
          : d,
      ),
    )
  }

  const addExercise = (dayName: string, item: { id: string; name: string; muscle: string; type: 'compound' | 'isolation' }) => {
    setProgram((prev) =>
      (prev ?? []).map((d) => {
        if (d.day !== dayName) return d
        const exercises = [
          ...d.exercises,
          { id: `${item.id}-${Date.now()}`, name: item.name, muscle: item.muscle, type: item.type, sets: 3, targetReps: '8-12', targetRIR: 1 },
        ]
        return { ...d, exercises, exerciseCount: exercises.length }
      }),
    )
  }

  return (
    <div style={{ padding: '8px 24px' }}>
      {/* Summary header */}
      <div
        className="card notch-12"
        style={{
          padding: 14,
          background: 'linear-gradient(180deg, color-mix(in srgb, var(--brand-glow) 6%, transparent) 0%, var(--surface-1) 100%)',
          borderColor: 'var(--border-brand)',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: 14,
        }}
      >
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: goal?.color ?? 'var(--brand-glow)' }} />
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
      <div className="card notch-4" style={{ padding: 12, background: 'color-mix(in srgb, var(--brand-glow) 3%, transparent)', marginBottom: 14 }}>
        <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
          <Icon name="sparkle" size={12} color="var(--brand-glow)" />
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
            onAdd={() => setPickerDay(d.day)}
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
