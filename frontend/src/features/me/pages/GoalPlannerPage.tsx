import { useState, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useGoalCreation, useWeight, useFeasibilityPreview, useBiometricProfile } from '@/data/hooks'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { ScreenSkeleton } from '@/shared/ui/ScreenSkeleton'
import { MozaikPage, PageHead, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
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

const TRAJECTORIES: { id: Trajectory; label: string; sub: string; icon: Icon3DName }[] = [
  { id: 'cut', label: 'Fogyás', sub: '↓ deficit', icon: 't-down' },
  { id: 'bulk', label: 'Hízás', sub: '↑ surplus', icon: 't-up' },
  { id: 'maintain', label: 'Szinten tartás', sub: '≈ tartás', icon: 't-hold' },
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
// to /me/goals/weight (where the GoalGate + "Biometria beállítása" flow lives);
// complete → the wizard. In mock mode `useBiometricProfile` seeds the profile
// synchronously (initialData) so `isLoading` is false → no skeleton flash,
// hence no explicit `!mock` gate is needed here (mezo-f2z).
export function GoalPlannerPage() {
  const { isComplete, isLoading } = useBiometricProfile()
  if (isLoading) return <ScreenSkeleton />
  if (!isComplete) return <Navigate to="/me/goals/weight" replace />
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

  const backToGoals = () => navigate('/me/goals/weight')
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
    // F7.4 Mozaik re-face (mezo-d20.8.4.1, en-mely.html): MozaikPage(coral) shell —
    // the back chip steps back through the wizard before leaving to /me/goals/weight.
    // Üveg (mezo-me75u.6, prototype uveg-en.html#sulyuj): a FORM — the chosen trajectory is the
    // one glass card, everything else is flat; the lit CTA is coral, the draft save a ghost.
    <MozaikPage tone="coral" className="goal-planner-page">
      <PageHead
        glass
        onBack={() => (step > 0 ? setStep(step - 1) : backToGoals())}
        label={step === 0 ? 'Cél' : STEP_TITLES[step - 1]}
      />
      <PageBody>

      {/* Entrance choreography (mezo-d20.11): the wizard was the one Én sibling
          with no `.rise` at all. `replayKey={step}` re-arms the stagger on each
          step, the way the prototype's `showGr` replays a swapped panel. */}
      <EntranceGroup replayKey={step}>
      {/* Step progress — earlier segments tappable to jump back */}
      <div className="gp-steps rise" style={{ '--d': '0ms' } as React.CSSProperties}>
        <div className="gp-prog">
          {Array.from({ length: STEP_COUNT }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${i + 1}. lépés`}
              className={i <= step ? 'is-on' : undefined}
              onClick={() => {
                if (i < step) setStep(i)
              }}
              style={{ cursor: i < step ? 'pointer' : 'default' }}
            />
          ))}
        </div>

        <span className="gp-count">
          {String(step + 1).padStart(2, '0')} / {String(STEP_COUNT).padStart(2, '0')}
        </span>
      </div>

      {/* F7.4: Mozaik title block replaces the pghead-np header */}
      <div className="gp-title rise" style={{ '--d': '40ms' } as React.CSSProperties}>
        <span className="mz-eyebrow">Én · Új cél</span>
        <h1>{STEP_TITLES[step]}</h1>
      </div>

      {step === 0 && (
        <div className="gp-step0 rise" style={{ '--d': '80ms' } as React.CSSProperties}>
          <span className="gp-label">Súly-trajektória</span>
          <div className="gp-trajs">
            {TRAJECTORIES.map(t => {
              const sel = trajectory === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={sel}
                  onClick={() => setTrajectory(t.id)}
                  className={sel ? 'gp-traj glass is-sel' : 'gp-traj'}
                >
                  <Icon3D name={t.icon} size={40} />
                  <span className="gp-traj-copy">
                    <strong>{t.label}</strong>
                    <small>{t.sub}</small>
                  </span>
                </button>
              )
            })}
          </div>

          <span className="gp-label gp-label-guards">Mit védesz közben? · gard</span>
          <div className="gp-guards">
            {GUARDS.map(g => {
              const on = guards.includes(g.id)
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleGuard(g.id)}
                  className={on ? 'gp-guard is-on' : 'gp-guard'}
                >
                  {on && <Icon3D name="t-tick" size={18} />}
                  {g.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="rise" style={{ '--d': '80ms' } as React.CSSProperties}>
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
        </div>
      )}

      {/* Nav */}
      <div className="gp-foot rise" style={{ '--d': '130ms' } as React.CSSProperties}>
        {step < 1 ? (
          <div className="gp-foot-row">
            {step > 0 && (
              <button
                type="button"
                className="cta-ghost gp-ghost"
                onClick={() => setStep(step - 1)}
              >
                Vissza
              </button>
            )}
            <button
              type="button"
              className="cta-primary gp-cta"
              disabled={!canNext}
              onClick={() => setStep(step + 1)}
            >
              Tovább →
            </button>
          </div>
        ) : (
          <div className="gp-foot-col">
            <button
              type="button"
              className="cta-primary gp-cta"
              disabled={pending}
              onClick={() => save(true)}
            >
              <Icon3D name="t-tick" size={20} /> <span>Cél létrehozása + aktiválás</span>
            </button>
            <button
              type="button"
              className="cta-ghost gp-ghost"
              disabled={pending}
              onClick={() => save(false)}
            >
              Mentés tervezettként
            </button>
          </div>
        )}
      </div>
      </EntranceGroup>
      </PageBody>
    </MozaikPage>
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
    <div className="gp-field">
      <span className="gp-label">{label}</span>
      <div className="gp-inp">
        {input}
      </div>
    </div>
  )

  // The weeks/kg summary mirrors the backend's derivation basis (Δkg over the
  // window in calendar weeks) so the panel narrates the same quantities the pace
  // is built from. HU decimals via the shared hu1 (comma, trailing ",0" stripped).
  const deltaKg = Math.abs(startWeight - targetWeight)
  const weeks = Math.max(
    1,
    Math.round((Date.parse(targetDateIso) - Date.parse(startDateIso)) / (7 * 864e5)),
  )

  return (
    <div className="gp-step1">
      <div className="gp-fields">
        {field(
          'Cél neve',
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            aria-label="Cél neve"
            placeholder="pl. Nyári cut"
          />,
        )}
        <div className="gp-two">
          <div className="flex-1">
            {field(
              'Kezdés',
              <input
                type="date"
                value={startDateIso}
                onChange={e => setStartDateIso(e.target.value)}
                aria-label="Kezdés"
                className="gp-date"
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
                className="gp-date"
              />,
            )}
          </div>
        </div>
        <div className="gp-two">
          <div className="flex-1">
            {field(
              'Start súly (kg)',
              <input
                type="number"
                step="0.1"
                value={startWeight}
                onChange={e => setStartWeight(Number(e.target.value))}
                aria-label="Start súly"
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
                />,
              )}
            </div>
          )}
        </div>

        {/* Live feasibility preview (G6, mezo-06n). maintain has no target weight
            → a simple tartás note; otherwise the backend-derived pace + verdict. */}
        {trajectory === 'maintain' ? (
          <div className="gp-hold">
            <Icon3D name="t-hold" size={26} />
            <span>≈ Tartás — nincs súlyváltozási tempó.</span>
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
            className="gp-ta"
          />,
        )}
      </div>
    </div>
  )
}

// The cél step's live feasibility panel (mockup goal-wizard-v2.html). Two states:
// withinSafeBand → sage-lit "X,Y %BW/hét · [t-tick] Reális" + a kg/weeks summary;
// otherwise (aggressive) → amber-lit "X,Y %BW/hét · [t-info] Agresszív" + the
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
  const withWarnings = ok && preview.verdict === 'feasible-with-warnings'
  const label = ok ? (withWarnings ? 'Reális · figyelővel' : 'Reális') : 'Agresszív'
  // Üveg: a FLAT lit card (sage = within the safe band, amber = aggressive) — the verdict glyph
  // is the t-tick / t-info sprite, the meaning stays in the label and in `data-verdict`.
  return (
    <div className={ok ? 'gp-feas is-ok' : 'gp-feas is-warn'} data-verdict={ok ? 'ok' : 'aggressive'}>
      <div className="gp-feas-top">
        <span className="gp-feas-num">{hu1(preview.derivedRatePctPerWeek)}</span>
        <span className="gp-feas-unit">%BW / hét</span>
        <span className="gp-feas-verdict">
          <Icon3D name={ok ? 't-tick' : 't-info'} size={22} />
          {label}
        </span>
      </div>
      <div className="gp-feas-body">
        {ok ? (
          <>
            Fenntartható tempó a biztonságos sávban.{' '}
            <b>
              ≈{hu1(deltaKg)} kg · {weeks} hét.
            </b>
          </>
        ) : (
          <>
            A biztonságos sáv <b>fölött</b> — izomvesztés- és
            visszahízás-kockázat.
          </>
        )}
      </div>
      {!ok && preview.suggestedTargetDate && (
        <button
          type="button"
          onClick={() => onAccept(preview.suggestedTargetDate!)}
          className="gp-feas-accept"
        >
          ↦ Reális dátum: {huMonthDay(preview.suggestedTargetDate)} — Elfogadom
        </button>
      )}
    </div>
  )
}
