import { useState } from 'react'
import { useOnboardingActions } from '@/data/hooks'
import { Stepper } from '@/shared/ui/Stepper'
import { localDateString } from '@/shared/lib/dates'
import { AuthShell, ErrorLine, fieldStyle } from '@/features/auth/components/AuthShell'
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

  const nav = (back: (() => void) | null, next: { label: string; disabled?: boolean }) => (
    <div className="row gap-sm" style={{ marginTop: 8 }}>
      {back && <button type="button" className="cta-ghost flex-1" onClick={back}>Vissza</button>}
      <button type="submit" className="cta-primary flex-1" disabled={next.disabled} style={{ padding: '12px 0' }}>
        {next.label}
      </button>
    </div>
  )

  return (
    <AuthShell title="Első lépések">
      <Stepper title="Beállítás" step={step} total={3} stepLabel={STEP_LABEL[step - 1]} />

      {step === 1 && (
        <form className="col gap-md" onSubmit={(e) => { e.preventDefault(); setStep(2) }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Szia, {name}!</p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #6E6257)' }}>
            Ezekből számol a Mezo — később a Beállításokban módosíthatod.
          </p>
          <div className="col gap-xs">
            <span style={{ fontSize: 13 }}>Nem</span>
            <div className="row gap-xs">
              {(['M', 'F'] as const).map((s) => (
                <button key={s} type="button" aria-pressed={draft.sex === s} className="flex-1 rad-12"
                  onClick={() => setDraft((d) => ({ ...d, sex: s }))}
                  style={{
                    padding: '12px 0', fontSize: 14, fontWeight: 600,
                    background: draft.sex === s ? 'color-mix(in srgb, var(--lav-deep) 12%, transparent)' : 'var(--surface-2, #FFFFFF)',
                    border: `1px solid ${draft.sex === s ? 'var(--lav-deep)' : 'var(--border-subtle, #E5DED2)'}`,
                    color: draft.sex === s ? 'var(--lav-deep)' : 'inherit',
                  }}>
                  {SEX_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
          <label className="col gap-xs">Születési dátum
            <input type="date" required min={BIRTH_DATE_MIN} max={today} value={draft.birthDate}
              onChange={(e) => setDraft((d) => ({ ...d, birthDate: e.target.value }))} style={fieldStyle} />
          </label>
          {nav(null, { label: 'Tovább', disabled: !birthDateValid(draft.birthDate, today) })}
        </form>
      )}

      {step === 2 && (
        <form className="col gap-md" onSubmit={(e) => { e.preventDefault(); setStep(3) }}>
          <StepField label="Magasság" unit="cm" val={draft.heightCm} step={HEIGHT_CM.step} min={HEIGHT_CM.min} max={HEIGHT_CM.max} integer
            onChange={(n) => setDraft((d) => ({ ...d, heightCm: n }))} />
          <StepField label="Súly" unit="kg" val={draft.weightKg} step={WEIGHT_KG.step} min={WEIGHT_KG.min} max={WEIGHT_KG.max}
            onChange={(n) => setDraft((d) => ({ ...d, weightKg: n }))} />
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary, #6E6257)' }}>A súly mai bejegyzésként kerül a naplóba.</p>
          {nav(() => setStep(1), { label: 'Tovább' })}
        </form>
      )}

      {step === 3 && (
        <form className="col gap-md" onSubmit={(e) => { e.preventDefault(); void commit() }}>
          <ul className="col gap-xs" style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
            {summaryLines(name, draft).map((line) => <li key={line}>{line}</li>)}
          </ul>
          <ErrorLine text={error} />
          {nav(() => setStep(2), { label: 'Kezdjük', disabled: pending })}
        </form>
      )}
    </AuthShell>
  )
}
