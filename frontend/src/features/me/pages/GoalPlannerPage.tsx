import { useState, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useGoalCreation, useWeight, useFeasibilityPreview, useBiometricProfile } from '@/data/hooks'
import { Icon, type IconName } from '@/shared/ui/Icon'
import { ScreenSkeleton } from '@/shared/ui/ScreenSkeleton'
import { huMonthDay } from '@/shared/lib/dates'
import { hu1 } from '@/shared/lib/huNum'
import type { GoalUpsertRequest, FeasibilityPreviewResponse } from '@/data/me/goalApi'

type Trajectory = 'cut' | 'bulk' | 'maintain'
type Guard = 'strength' | 'muscle'

// 2-step wizard: 0 = trajectory + guards, 1 = cél (title + window + weights +
// identity). Biometrics + the manual weekly rate were dropped in G6 (mezo-06n):
// biometrics moved to the Profile (a creation precondition) and the backend now
// derives the weekly rate from the window + weights.
const STEP_TITLES = ['Mit építünk?', 'Mennyi időnk van?'] as const
const STEP_COUNT = 2

const TRAJECTORIES: { id: Trajectory; label: string; sub: string; icon: IconName }[] = [
  { id: 'cut', label: 'Fogyás', sub: '↓ deficit', icon: 'minus' },
  { id: 'bulk', label: 'Hízás', sub: '↑ surplus', icon: 'plus' },
  { id: 'maintain', label: 'Szinten tartás', sub: '≈ tartás', icon: 'check' },
]

const GUARDS: { id: Guard; label: string }[] = [
  { id: 'strength', label: 'Erő megtartása' },
  { id: 'muscle', label: 'Izom megtartása' },
]

// Goal-creation hard gate as a route property (G6, mezo-06n — review fix): the
// wizard derives its calorie target from a complete biometric profile, so the
// direct route (back/forward, bookmark, manual URL) must not drop the user into
// it without one. The two "Új cél" buttons in GoalsPage already gate, but the
// route itself didn't — this closes that bypass (spec D4). While the profile is
// still loading we show the generic ScreenSkeleton (do NOT bounce a
// complete-profile user mid fetch); once loaded, an incomplete profile redirects
// to /me/goals (where the GoalGate + "Biometria beállítása" flow lives);
// complete → the wizard. In mock mode `useBiometricProfile` seeds the profile
// synchronously (initialData) so `isLoading` is false → no skeleton flash,
// hence no explicit `!mock` gate is needed here (mezo-f2z).
export function GoalPlannerPage() {
  const { isComplete, isLoading } = useBiometricProfile()
  if (isLoading) return <ScreenSkeleton />
  if (!isComplete) return <Navigate to="/me/goals" replace />
  return <GoalWizard />
}

function GoalWizard() {
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
  const [identity, setIdentity] = useState('')

  const backToGoals = () => navigate('/me/goals')
  const toggleGuard = (g: Guard) =>
    setGuards(cur => (cur.includes(g) ? cur.filter(x => x !== g) : [...cur, g]))

  // Live realism preview (G6, mezo-06n): the backend derives the weekly pace from
  // the draft window + weights and verdicts it. Skipped for `maintain` (no target
  // weight → no rate) and for invalid windows (target before start). The hook
  // debounces the inputs, so typing weights/dates doesn't spam the API.
  const validWindow = targetDateIso > startDateIso
  const previewable = trajectory !== null && trajectory !== 'maintain' && validWindow
  const preview = useFeasibilityPreview(
    previewable
      ? {
          trajectory: trajectory as Trajectory,
          startWeightKg: startWeight,
          targetWeightKg: targetWeight,
          startDate: startDateIso,
          targetDate: targetDateIso,
        }
      : null,
    { enabled: previewable },
  )

  // Step 1 (cél) is the terminal/save step — its guard stays title + a valid window.
  const canNext =
    (step === 0 && !!trajectory) ||
    (step === 1 && title.trim().length > 0 && targetDateIso > startDateIso)

  const save = (activate: boolean) => {
    if (!trajectory) return
    const goal = {
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
    } satisfies GoalUpsertRequest
    submit({ goal, activate }, { onSuccess: backToGoals })
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
          <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>←</span>
          <span className="eyebrow">{step === 0 ? 'Cél' : STEP_TITLES[step - 1]}</span>
        </button>
      </div>

      {/* Step progress — earlier segments tappable to jump back */}
      <div style={{ padding: '6px 24px 0' }}>
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
                background: i <= step ? 'var(--lav)' : 'var(--surface-2)',
                transition: 'all 0.3s ease',
                padding: 0,
                cursor: i < step ? 'pointer' : 'default',
              }}
            />
          ))}
        </div>

        <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>
          {String(step + 1).padStart(2, '0')} / {String(STEP_COUNT).padStart(2, '0')}
        </span>
      </div>

      {/* Own header (outside MeSection chrome, spec §4.6 / Task 5) */}
      <div className="pghead-np lav">
        <div>
          <div className="over">Me · Új cél</div>
          <h1>{STEP_TITLES[step]}</h1>
        </div>
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
                  className="card"
                  style={{
                    padding: 14,
                    textAlign: 'left',
                    width: '100%',
                    background: sel
                      ? 'color-mix(in srgb, var(--lav-deep) 8%, transparent)'
                      : 'var(--surface-1)',
                    borderColor: sel ? 'var(--lav-deep)' : 'var(--border-subtle)',
                  }}
                >
                  <div className="row gap-md" style={{ alignItems: 'center' }}>
                    <Icon name={t.icon} size={18} color={sel ? 'var(--lav-deep)' : 'var(--text-secondary)'} />
                    <div className="col">
                      <span
                        style={{
                          fontFamily: 'var(--ff-display)',
                          fontSize: 15,
                          fontWeight: 600,
                          color: sel ? 'var(--lav-deep)' : 'var(--text-primary)',
                        }}
                      >
                        {t.label}
                      </span>
                      <span
                        style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)', marginTop: 2 }}
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
                      ? 'color-mix(in srgb, var(--lav-deep) 8%, transparent)'
                      : 'var(--surface-1)',
                    borderColor: on ? 'var(--lav-deep)' : 'var(--border-subtle)',
                    color: on ? 'var(--lav-deep)' : 'var(--text-secondary)',
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
            identity,
            setIdentity,
            trajectory,
            preview: previewable ? preview : undefined,
          }}
        />
      )}

      {/* Nav */}
      <div style={{ padding: '16px 24px 32px' }}>
        {step < 1 ? (
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
              className="np-cta np-press"
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
              className="np-cta np-press"
              disabled={pending}
              style={{ padding: 14, opacity: pending ? 0.5 : 1 }}
              onClick={() => save(true)}
            >
              <Icon name="check" size={16} /> <span>Cél létrehozása + aktiválás</span>
            </button>
            <button
              type="button"
              className="cta-ghost"
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
// GoalPlannerPage spreads at its call site; target weight is hidden for `maintain`.
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
  identity,
  setIdentity,
  trajectory,
  preview,
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
  identity: string
  setIdentity: (v: string) => void
  trajectory: Trajectory | null
  preview: FeasibilityPreviewResponse | undefined
}) {
  const field = (label: string, input: ReactNode) => (
    <div className="col gap-sm">
      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' }}>{label}</span>
      <div className="card" style={{ padding: 10 }}>
        {input}
      </div>
    </div>
  )
  const numStyle = { width: '100%', fontSize: 14, color: 'var(--text-primary)' } as const
  const dateStyle = { width: '100%', fontSize: 13, color: 'var(--text-primary)', colorScheme: 'dark' } as const

  // The weeks/kg summary mirrors the backend's derivation basis (Δkg over the
  // window in calendar weeks) so the panel narrates the same quantities the pace
  // is built from. HU decimals via the shared hu1 (comma, trailing ",0" stripped).
  const deltaKg = Math.abs(startWeight - targetWeight)
  const weeks = Math.max(
    1,
    Math.round((Date.parse(targetDateIso) - Date.parse(startDateIso)) / (7 * 864e5)),
  )

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

        {/* Live feasibility preview (G6, mezo-06n). maintain has no target weight
            → a simple tartás note; otherwise the backend-derived pace + verdict. */}
        {trajectory === 'maintain' ? (
          <div className="card" style={{ padding: 13 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)' }}>
              ≈ Tartás — nincs súlyváltozási tempó.
            </span>
          </div>
        ) : preview ? (
          <FeasibilityPanel
            preview={preview}
            deltaKg={deltaKg}
            weeks={weeks}
            onAccept={d => setTargetDateIso(d)}
          />
        ) : null}

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

// The cél step's live feasibility panel (mockup goal-wizard-v2.html). Two states:
// withinSafeBand → brand-tinted "X,Y %BW/hét · ✓ Reális" + a kg/weeks summary;
// otherwise (aggressive) → warning-tinted "X,Y %BW/hét · ⚠ Agresszív" + the
// "↦ Reális dátum: <date> — Elfogadom" action that bumps the cél-dátum to the
// cap-paced suggestion (re-previews → flips to feasible). The CTA itself stays
// enabled (soft — the user MAY proceed); only the panel nudges.
function FeasibilityPanel({
  preview,
  deltaKg,
  weeks,
  onAccept,
}: {
  preview: FeasibilityPreviewResponse
  deltaKg: number
  weeks: number
  onAccept: (dateIso: string) => void
}) {
  const ok = preview.withinSafeBand
  const accent = ok ? 'var(--sage-deep)' : 'var(--warning)'
  const withWarnings = ok && preview.verdict === 'feasible-with-warnings'
  const label = ok ? (withWarnings ? '✓ Reális · figyelővel' : '✓ Reális') : '⚠ Agresszív'
  return (
    <div
      className="card"
      style={{
        padding: '13px 14px',
        background: ok
          ? 'color-mix(in srgb, var(--sage-deep) 8%, transparent)'
          : 'rgba(245,158,11,.06)',
        borderColor: ok ? 'var(--sage-deep)' : 'color-mix(in srgb, var(--warning) 42%, transparent)',
      }}
    >
      <div className="row" style={{ alignItems: 'baseline', gap: 7 }}>
        <span style={{ fontFamily: 'var(--ff-display)', fontSize: 26, lineHeight: 1, color: accent, fontVariantNumeric: 'tabular-nums' }}>
          {hu1(preview.derivedRatePctPerWeek)}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)' }}>
          %BW / hét
        </span>
        <span
          style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: accent }}
        >
          {label}
        </span>
      </div>
      <div
        style={{ fontSize: 11.5, lineHeight: 1.45, color: 'var(--text-secondary)', marginTop: 7 }}
      >
        {ok ? (
          <>
            Fenntartható tempó a biztonságos sávban.{' '}
            <b style={{ color: 'var(--text-primary)' }}>
              ≈{hu1(deltaKg)} kg · {weeks} hét.
            </b>
          </>
        ) : (
          <>
            A biztonságos sáv <b style={{ color: 'var(--text-primary)' }}>fölött</b> — izomvesztés- és
            visszahízás-kockázat.
          </>
        )}
      </div>
      {!ok && preview.suggestedTargetDate && (
        <button
          type="button"
          onClick={() => onAccept(preview.suggestedTargetDate!)}
          className="rad-12"
          style={{
            marginTop: 11,
            width: '100%',
            padding: 9,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.04em',
            background: 'rgba(245,158,11,.12)',
            border: '1px solid color-mix(in srgb, var(--warning) 55%, transparent)',
            color: 'var(--warning)',
          }}
        >
          ↦ Reális dátum: {huMonthDay(preview.suggestedTargetDate)} — Elfogadom
        </button>
      )}
    </div>
  )
}
