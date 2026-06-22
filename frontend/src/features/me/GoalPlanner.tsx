import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGoalCreation, useWeight } from '@/data/hooks'
import { Icon, type IconName } from '@/components/ui/Icon'

type Trajectory = 'cut' | 'bulk' | 'maintain'
type Guard = 'strength' | 'muscle'
type ActivityLevel = 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'VERY' | 'EXTRA'

const STEP_TITLES = ['Mit építünk?', 'Mennyi időnk van?', 'Profil a TDEE-hez'] as const
const STEP_COUNT = 3

// HU labels + a one-line "mit jelent" hint per PAL level → the BiometricProfile
// activityLevel enum. Default MODERATE (mezo-g1u): the engine's TDEE = BMR × PAL.
const ACTIVITY_LEVELS: { id: ActivityLevel; label: string; hint: string }[] = [
  { id: 'SEDENTARY', label: 'Ülő', hint: 'kevés mozgás, irodai munka' },
  { id: 'LIGHT', label: 'Enyhén aktív', hint: 'heti 1–2 edzés' },
  { id: 'MODERATE', label: 'Mérsékelten aktív', hint: 'heti 3–5 edzés' },
  { id: 'VERY', label: 'Nagyon aktív', hint: 'heti 6–7 edzés' },
  { id: 'EXTRA', label: 'Extra aktív', hint: 'napi kemény edzés / fizikai munka' },
]

const TRAJECTORIES: { id: Trajectory; label: string; sub: string; icon: IconName }[] = [
  { id: 'cut', label: 'Fogyás', sub: '↓ deficit', icon: 'minus' },
  { id: 'bulk', label: 'Hízás', sub: '↑ surplus', icon: 'plus' },
  { id: 'maintain', label: 'Szinten tartás', sub: '≈ tartás', icon: 'check' },
]

const GUARDS: { id: Guard; label: string }[] = [
  { id: 'strength', label: 'Erő megtartása' },
  { id: 'muscle', label: 'Izom megtartása' },
]

export function GoalPlanner() {
  const navigate = useNavigate()
  const { submit, pending } = useGoalCreation()
  const { weightLog } = useWeight()
  const latestWeight = weightLog.length ? weightLog[weightLog.length - 1].value : 80

  const [step, setStep] = useState(0)
  // Step 0
  const [trajectory, setTrajectory] = useState<Trajectory | null>(null)
  const [guards, setGuards] = useState<Guard[]>([])
  // Step 1
  const [title, setTitle] = useState('')
  const [startDateIso, setStartDateIso] = useState(() => new Date().toISOString().slice(0, 10))
  const [targetDateIso, setTargetDateIso] = useState(() =>
    new Date(Date.now() + 56 * 864e5).toISOString().slice(0, 10),
  )
  const [startWeight, setStartWeight] = useState(latestWeight)
  const [targetWeight, setTargetWeight] = useState(latestWeight)
  const [rate, setRate] = useState(0.7)
  const [identity, setIdentity] = useState('')
  // Step 2
  const [sex, setSex] = useState<'M' | 'F'>('M')
  const [heightCm, setHeightCm] = useState(180)
  const [birthDateIso, setBirthDateIso] = useState('1991-03-01')
  const [bodyFat, setBodyFat] = useState<number | ''>('')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('MODERATE')

  const backToGoals = () => navigate('/me/goals')
  const toggleGuard = (g: Guard) =>
    setGuards(cur => (cur.includes(g) ? cur.filter(x => x !== g) : [...cur, g]))

  const canNext =
    (step === 0 && !!trajectory) ||
    (step === 1 && title.trim().length > 0 && targetDateIso > startDateIso) ||
    step === 2

  const save = (activate: boolean) => {
    if (!trajectory) return
    submit(
      {
        profile: {
          sex,
          heightCm,
          birthDate: birthDateIso,
          activityLevel,
          ...(bodyFat !== '' ? { bodyFatPct: Number(bodyFat) } : {}),
        },
        goal: {
          title: title || `${TRAJECTORIES.find(t => t.id === trajectory)!.label} cél`,
          trajectory,
          guards,
          startDate: startDateIso,
          targetDate: targetDateIso,
          startWeightKg: startWeight,
          ...(trajectory !== 'maintain' ? { targetWeightKg: targetWeight } : {}),
          // rateTargetPctPerWeek is no longer sent — the backend derives it from
          // |startWeightKg − targetWeightKg| / startWeightKg / weeks (G6, mezo-06n).
          ...(identity ? { identityFrame: identity } : {}),
        },
        activate,
      },
      { onSuccess: backToGoals },
    )
  }

  return (
    // The route already sits inside AppLayout's .screen-content scroller — a nested
    // .screen-content would double the status-bar padding (mezo-wdk).
    <div>
      {/* Breadcrumb — pinned below the status bar like native nav chrome */}
      <div className="sticky-top" style={{ padding: '8px 24px' }}>
        <button
          type="button"
          className="row gap-sm"
          onClick={() => (step > 0 ? setStep(step - 1) : backToGoals())}
        >
          <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--ff-mono)', fontSize: 14 }}>←</span>
          <span className="eyebrow">{step === 0 ? 'Cél' : STEP_TITLES[step - 1]}</span>
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
              aria-label={`${i + 1}. lépés`}
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
          {String(step + 1).padStart(2, '0')} / {String(STEP_COUNT).padStart(2, '0')}
        </span>
        <div className="page-title mt-sm">{STEP_TITLES[step]}</div>
      </div>

      {step === 0 && (
        <div style={{ padding: '8px 24px' }}>
          <div style={{ marginTop: 8 }}>
            <span className="eyebrow">Súly-trajektória</span>
          </div>
          <div className="col gap-sm" style={{ marginTop: 8 }}>
            {TRAJECTORIES.map(t => {
              const sel = trajectory === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTrajectory(t.id)}
                  className="card notch-8"
                  style={{
                    padding: 14,
                    textAlign: 'left',
                    width: '100%',
                    background: sel
                      ? 'color-mix(in srgb, var(--brand-glow) 8%, transparent)'
                      : 'var(--surface-1)',
                    borderColor: sel ? 'var(--border-brand)' : 'var(--border-subtle)',
                  }}
                >
                  <div className="row gap-md" style={{ alignItems: 'center' }}>
                    <Icon name={t.icon} size={18} color={sel ? 'var(--brand-glow)' : 'var(--text-secondary)'} />
                    <div className="col">
                      <span
                        style={{
                          fontFamily: 'var(--ff-display)',
                          fontSize: 15,
                          fontWeight: 600,
                          color: sel ? 'var(--brand-glow)' : 'var(--text-primary)',
                        }}
                      >
                        {t.label}
                      </span>
                      <span
                        className="label-mono"
                        style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}
                      >
                        {t.sub}
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          <div style={{ marginTop: 18 }}>
            <span className="eyebrow">Mit védesz közben? · gard</span>
          </div>
          <div className="row gap-sm" style={{ marginTop: 8, flexWrap: 'wrap' }}>
            {GUARDS.map(g => {
              const on = guards.includes(g.id)
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleGuard(g.id)}
                  className="chip"
                  style={{
                    padding: '8px 11px',
                    background: on
                      ? 'color-mix(in srgb, var(--brand-glow) 8%, transparent)'
                      : 'var(--surface-1)',
                    borderColor: on ? 'var(--border-brand)' : 'var(--border-subtle)',
                    color: on ? 'var(--brand-glow)' : 'var(--text-secondary)',
                  }}
                >
                  {on ? '✓ ' : ''}
                  {g.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {step === 1 && (
        <Step1
          {...{
            title,
            setTitle,
            startDateIso,
            setStartDateIso,
            targetDateIso,
            setTargetDateIso,
            startWeight,
            setStartWeight,
            targetWeight,
            setTargetWeight,
            rate,
            setRate,
            identity,
            setIdentity,
            trajectory,
          }}
        />
      )}
      {step === 2 && (
        <Step2
          {...{ sex, setSex, heightCm, setHeightCm, birthDateIso, setBirthDateIso, bodyFat, setBodyFat, activityLevel, setActivityLevel }}
        />
      )}

      {/* Nav */}
      <div style={{ padding: '16px 24px 32px' }}>
        {step < 2 ? (
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
        ) : (
          <div className="col gap-sm">
            <button
              type="button"
              className="cta-primary notch-8"
              disabled={pending}
              style={{ padding: 14, opacity: pending ? 0.5 : 1 }}
              onClick={() => save(true)}
            >
              <Icon name="check" size={16} /> <span>Cél létrehozása + aktiválás</span>
            </button>
            <button
              type="button"
              className="cta-ghost notch-4"
              disabled={pending}
              style={{ padding: 12, opacity: pending ? 0.5 : 1 }}
              onClick={() => save(false)}
            >
              Mentés tervezettként
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// Step 1 — window + weights. Props are exactly the step-1 state slice that
// GoalPlanner spreads at its call site; target weight is hidden for `maintain`.
function Step1({
  title,
  setTitle,
  startDateIso,
  setStartDateIso,
  targetDateIso,
  setTargetDateIso,
  startWeight,
  setStartWeight,
  targetWeight,
  setTargetWeight,
  rate,
  setRate,
  identity,
  setIdentity,
  trajectory,
}: {
  title: string
  setTitle: (v: string) => void
  startDateIso: string
  setStartDateIso: (v: string) => void
  targetDateIso: string
  setTargetDateIso: (v: string) => void
  startWeight: number
  setStartWeight: (v: number) => void
  targetWeight: number
  setTargetWeight: (v: number) => void
  rate: number
  setRate: (v: number) => void
  identity: string
  setIdentity: (v: string) => void
  trajectory: Trajectory | null
}) {
  const field = (label: string, input: ReactNode) => (
    <div className="col gap-sm">
      <span className="label-mono">{label}</span>
      <div className="card notch-4" style={{ padding: 10 }}>
        {input}
      </div>
    </div>
  )
  const numStyle = { width: '100%', fontSize: 14, color: 'var(--text-primary)' } as const
  const dateStyle = { width: '100%', fontSize: 13, color: 'var(--text-primary)', colorScheme: 'dark' } as const
  return (
    <div style={{ padding: '8px 24px' }}>
      <div className="col gap-md">
        {field(
          'Cél neve',
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            aria-label="Cél neve"
            placeholder="pl. Nyári cut"
            style={numStyle}
          />,
        )}
        <div className="row gap-sm">
          <div className="flex-1">
            {field(
              'Kezdés',
              <input
                type="date"
                value={startDateIso}
                onChange={e => setStartDateIso(e.target.value)}
                aria-label="Kezdés"
                style={dateStyle}
              />,
            )}
          </div>
          <div className="flex-1">
            {field(
              'Cél dátum',
              <input
                type="date"
                value={targetDateIso}
                onChange={e => setTargetDateIso(e.target.value)}
                aria-label="Cél dátum"
                style={dateStyle}
              />,
            )}
          </div>
        </div>
        <div className="row gap-sm">
          <div className="flex-1">
            {field(
              'Start súly (kg)',
              <input
                type="number"
                step="0.1"
                value={startWeight}
                onChange={e => setStartWeight(Number(e.target.value))}
                aria-label="Start súly"
                style={numStyle}
              />,
            )}
          </div>
          {trajectory !== 'maintain' && (
            <div className="flex-1">
              {field(
                'Cél súly (kg)',
                <input
                  type="number"
                  step="0.1"
                  value={targetWeight}
                  onChange={e => setTargetWeight(Number(e.target.value))}
                  aria-label="Cél súly"
                  style={numStyle}
                />,
              )}
            </div>
          )}
        </div>
        {field(
          'Heti tempó (%/hét)',
          <input
            type="number"
            step="0.1"
            value={rate}
            onChange={e => setRate(Number(e.target.value))}
            aria-label="Heti tempó"
            style={numStyle}
          />,
        )}
        {field(
          'Identity frame · opcionális',
          <textarea
            value={identity}
            onChange={e => setIdentity(e.target.value.slice(0, 200))}
            aria-label="Identity frame"
            placeholder='pl. "Erő megtartva — nem csak a szám."'
            style={{ ...numStyle, minHeight: 48, resize: 'none', lineHeight: 1.45 }}
          />,
        )}
      </div>
    </div>
  )
}

// Step 2 — BiometricProfile inputs that feed the TDEE estimate. Body-fat optional.
function Step2({
  sex,
  setSex,
  heightCm,
  setHeightCm,
  birthDateIso,
  setBirthDateIso,
  bodyFat,
  setBodyFat,
  activityLevel,
  setActivityLevel,
}: {
  sex: 'M' | 'F'
  setSex: (v: 'M' | 'F') => void
  heightCm: number
  setHeightCm: (v: number) => void
  birthDateIso: string
  setBirthDateIso: (v: string) => void
  bodyFat: number | ''
  setBodyFat: (v: number | '') => void
  activityLevel: ActivityLevel
  setActivityLevel: (v: ActivityLevel) => void
}) {
  const field = (label: string, input: ReactNode) => (
    <div className="col gap-sm">
      <span className="label-mono">{label}</span>
      <div className="card notch-4" style={{ padding: 10 }}>
        {input}
      </div>
    </div>
  )
  const numStyle = { width: '100%', fontSize: 14, color: 'var(--text-primary)' } as const
  return (
    <div style={{ padding: '8px 24px' }}>
      <div className="col gap-md">
        <div className="col gap-sm">
          <span className="label-mono">Nem</span>
          <div className="row gap-xs">
            {(['M', 'F'] as const).map(s => (
              <button
                key={s}
                type="button"
                aria-pressed={sex === s}
                onClick={() => setSex(s)}
                className="flex-1 notch-4"
                style={{
                  padding: '12px 0',
                  background:
                    sex === s
                      ? 'color-mix(in srgb, var(--brand-glow) 12%, transparent)'
                      : 'var(--surface-1)',
                  border: `1px solid ${sex === s ? 'var(--brand-glow)' : 'var(--border-subtle)'}`,
                  color: sex === s ? 'var(--brand-glow)' : 'var(--text-secondary)',
                  fontFamily: 'var(--ff-display)',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {s === 'M' ? 'Férfi' : 'Nő'}
              </button>
            ))}
          </div>
        </div>
        {field(
          'Testmagasság (cm)',
          <input
            type="number"
            value={heightCm}
            onChange={e => setHeightCm(Number(e.target.value))}
            aria-label="Testmagasság"
            style={numStyle}
          />,
        )}
        {field(
          'Születési dátum',
          <input
            type="date"
            value={birthDateIso}
            onChange={e => setBirthDateIso(e.target.value)}
            aria-label="Születési dátum"
            style={{ ...numStyle, fontSize: 13, colorScheme: 'dark' }}
          />,
        )}
        {field(
          'Testzsír % · opcionális',
          <input
            type="number"
            step="0.1"
            value={bodyFat}
            onChange={e => setBodyFat(e.target.value === '' ? '' : Number(e.target.value))}
            aria-label="Testzsír"
            placeholder="pl. 15"
            style={numStyle}
          />,
        )}
        {/* Aktivitási szint → PAL: a TDEE = BMR × PAL szorzó. Default MODERATE. */}
        <div className="col gap-sm">
          <span className="label-mono">Aktivitási szint</span>
          <div className="col gap-xs">
            {ACTIVITY_LEVELS.map(a => {
              const sel = activityLevel === a.id
              return (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={sel}
                  onClick={() => setActivityLevel(a.id)}
                  className="card notch-4"
                  style={{
                    padding: '10px 12px',
                    textAlign: 'left',
                    width: '100%',
                    background: sel
                      ? 'color-mix(in srgb, var(--brand-glow) 10%, transparent)'
                      : 'var(--surface-1)',
                    borderColor: sel ? 'var(--brand-glow)' : 'var(--border-subtle)',
                  }}
                >
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <span
                      style={{
                        fontFamily: 'var(--ff-display)',
                        fontSize: 14,
                        fontWeight: 600,
                        color: sel ? 'var(--brand-glow)' : 'var(--text-primary)',
                      }}
                    >
                      {sel ? '✓ ' : ''}
                      {a.label}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{a.hint}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
      <div
        className="card notch-4 mt-lg"
        style={{ padding: 12, background: 'color-mix(in srgb, var(--brand-glow) 6%, transparent)' }}
      >
        <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
          <Icon name="sparkle" size={12} color="var(--brand-glow)" />
          <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-primary)' }}>
            Ezekből számolja a Mezo a napi energiaigényedet (TDEE). Ha megadod a testzsírt, pontosabb a becslés.
          </p>
        </div>
      </div>
    </div>
  )
}
