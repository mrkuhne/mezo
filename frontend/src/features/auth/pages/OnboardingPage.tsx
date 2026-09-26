import { useState } from 'react'
import { useOnboardingActions } from '@/data/hooks'
import { Stepper } from '@/shared/ui/Stepper'
import { localDateString } from '@/shared/lib/dates'
import { AuthField, AuthShell, ErrorLine } from '@/features/auth/components/AuthShell'
import { StepField } from '@/features/auth/components/StepField'
import { authErrorText } from '@/features/auth/logic/authErrorText'
import {
  BIRTH_DATE_MIN, HEIGHT_CM, SEX_LABEL, WEIGHT_KG, birthDateValid, summaryLines, type OnboardingDraft,
} from '@/features/auth/logic/onboardingSteps'

const STEP_LABEL = ['Rólad', 'Testméretek', 'Összefoglaló'] as const

/**
 * Onboarding wizard (S2, mezo-qw37.2) — rendered by AuthGate on the `onboarding` phase, outside
 * the router (no app chrome), so a fresh account cannot reach the app before the biometric
 * profile the goal engine needs exists. Three steps: 1) name confirm + birth date + sex,
 * 2) height + current weight, 3) summary → useOnboardingActions().complete. The name is read-only:
 * it was typed at registration and S1 has no name-edit endpoint.
 */
export function OnboardingPage({ name, onSuccess }: { name: string; onSuccess: () => void | Promise<void> }) {
  const { complete, pending } = useOnboardingActions()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [draft, setDraft] = useState<OnboardingDraft>({
    sex: 'M', birthDate: '', heightCm: HEIGHT_CM.initial, weightKg: WEIGHT_KG.initial,
  })
  const [error, setError] = useState<string | undefined>()
  const today = localDateString()

  const commit = async () => {
    setError(undefined)
    try {
      await complete({ sex: draft.sex, heightCm: draft.heightCm, birthDate: draft.birthDate, weightKg: draft.weightKg })
      await onSuccess()
    } catch (err) {
      setError(authErrorText(err))
    }
  }

  // The step's nav sits BELOW the glass card (not inside it): a flat ghost „Vissza" and the lit
  // lavender primary; on step 1 the primary alone spans the row.
  const nav = (back: (() => void) | null, next: { label: string; disabled?: boolean }) => (
    <div className={back ? 'auth-pair' : 'auth-pair is-single'}>
      {back && <button type="button" className="auth-ghost" onClick={back}>Vissza</button>}
      <button type="submit" className="auth-cta" disabled={next.disabled}>
        {next.label}
      </button>
    </div>
  )

  return (
    <AuthShell title="Első lépések" className="is-onboarding">
      <Stepper title="Beállítás" step={step} total={3} steps={STEP_LABEL} className="auth-steps" />

      {step === 1 && (
        <form className="auth-form" onSubmit={(e) => { e.preventDefault(); setStep(2) }}>
          <div className="auth-card glass">
            <div className="auth-greet">
              <p className="auth-greet-hi">Szia, {name}!</p>
              <p className="auth-greet-sub">Ezekből számol a Mezo — később a Beállításokban módosíthatod.</p>
            </div>
            <div className="auth-field">
              <span className="auth-field-lb">Nem</span>
              <div className="auth-seg2">
                {(['M', 'F'] as const).map((s) => (
                  <button key={s} type="button" aria-pressed={draft.sex === s} className={draft.sex === s ? 'on' : undefined}
                    onClick={() => setDraft((d) => ({ ...d, sex: s }))}>
                    {SEX_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>
            <AuthField label="Születési dátum">
              <input className="auth-inp" type="date" required min={BIRTH_DATE_MIN} max={today} value={draft.birthDate}
                onChange={(e) => setDraft((d) => ({ ...d, birthDate: e.target.value }))} />
            </AuthField>
          </div>
          {nav(null, { label: 'Tovább', disabled: !birthDateValid(draft.birthDate, today) })}
        </form>
      )}

      {step === 2 && (
        <form className="auth-form" onSubmit={(e) => { e.preventDefault(); setStep(3) }}>
          <div className="auth-card glass">
            <StepField label="Magasság" unit="cm" val={draft.heightCm} step={HEIGHT_CM.step} min={HEIGHT_CM.min} max={HEIGHT_CM.max} integer
              onChange={(n) => setDraft((d) => ({ ...d, heightCm: n }))} />
            <StepField label="Súly" unit="kg" val={draft.weightKg} step={WEIGHT_KG.step} min={WEIGHT_KG.min} max={WEIGHT_KG.max}
              onChange={(n) => setDraft((d) => ({ ...d, weightKg: n }))} />
            <p className="auth-tiny">A súly mai bejegyzésként kerül a naplóba.</p>
          </div>
          {nav(() => setStep(1), { label: 'Tovább' })}
        </form>
      )}

      {step === 3 && (
        <form className="auth-form" onSubmit={(e) => { e.preventDefault(); void commit() }}>
          <div className="auth-card glass is-summary">
            <ul className="auth-sum">
              {summaryLines(name, draft).map((line) => {
                // „Magasság: 181 cm" → a label/value row; the hidden „: " keeps the line's text whole.
                const cut = line.indexOf(': ')
                if (cut < 0) return <li key={line} className="auth-sumrow"><span>{line}</span></li>
                return (
                  <li key={line} className="auth-sumrow">
                    <span>{line.slice(0, cut)}<span className="sr-only">: </span></span>
                    <b>{line.slice(cut + 2)}</b>
                  </li>
                )
              })}
            </ul>
            <ErrorLine text={error} />
          </div>
          {nav(() => setStep(2), { label: 'Kezdjük', disabled: pending })}
        </form>
      )}
    </AuthShell>
  )
}
