import { useState, type ReactNode } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { SheetError, SheetHead } from '@/shared/ui/SheetHead'
import { Icon3D } from '@/shared/ui/clay'
import { cn } from '@/shared/lib/cn'
import { useBiometricActions } from '@/data/hooks'
import type { BiometricProfileResponse, BiometricProfileUpsertRequest } from '@/data/me/biometricProfileApi'
import { ACTIVITY_LEVELS, type ActivityLevel } from '@/features/me/logic/biometricFields'

// Biometric editor sheet (G6, mezo-06n). Opened from the Profile Biometria card
// (both the populated card and the empty-state prompt). Edits the single
// first-class biometric profile the engine computes the base-TDEE from. The
// field markup (Nem segmented M/F · Magasság · Születési dátum · Testzsír%
// optional · Aktivitási szint / NEAT-sáv) is lifted from the deleted GoalPlannerPage
// Step2. Prefills from the current profile when present. Mentés calls the upsert
// mutation (which invalidates ['biometricProfile'] + ['goals'] so the active
// goal recomputes server-side — Task 3) then closes on success — the EditGoalSheet
// "mutation inside the sheet" pattern.
// Üveg (U10, mezo-me75u.10): a rose glass sheet (Én), the person 3D head, eyebrow-labelled flat
// fields, flat segment/option cells (the chosen one lit, with the tick icon instead of „✓"),
// the split-TDEE readout as one flat cell, Mégse flat ghost + the lit „Mentés" pill.
export function BiometricSheet({
  onClose,
  profile,
  onExplainEnergy,
}: {
  onClose: () => void
  profile: BiometricProfileResponse | null
  /** Opens the shared EnergyBreakdownSheet on the split-TDEE row (mezo-d20.11).
   *  Absent → the row still renders read-only; the host decides whether it can
   *  swap sheets. `BiometricCard` was the only Én-side door into the breakdown
   *  and the card lost its host — this is the replacement (me.md §9). */
  onExplainEnergy?: () => void
}) {
  const [error, setError] = useState(false)
  const { upsert, pending } = useBiometricActions()
  const [sex, setSex] = useState<'M' | 'F'>(profile?.sex ?? 'M')
  const [heightCm, setHeightCm] = useState<number>(profile?.heightCm ?? 180)
  const [birthDateIso, setBirthDateIso] = useState<string>(profile?.birthDate ?? '')
  const [bodyFat, setBodyFat] = useState<number | ''>(profile?.bodyFatPct ?? '')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    (profile?.activityLevel as ActivityLevel | null | undefined) ?? 'MIXED',
  )

  const save = (close: () => void) => {
    const body: BiometricProfileUpsertRequest = {
      sex,
      heightCm,
      birthDate: birthDateIso,
      activityLevel,
      ...(bodyFat !== '' ? { bodyFatPct: Number(bodyFat) } : {}),
    }
    upsert(body).then(close).catch(() => setError(true))
  }

  const field = (label: ReactNode, input: ReactNode) => (
    <label className="uvl-field">
      <span className="uvl-flabel">{label}</span>
      {input}
    </label>
  )

  return (
    <Sheet glass onClose={onClose} labelledBy="biometric-title" className="uvl-en">
      {(close) => (
        <div className="uvl-body">
          <SheetHead icon="t-person" eyebrow="Biometria" title="A motor ebből számol" titleId="biometric-title" onClose={close} />

          {!profile && <p className="uvl-lead">Még nincs saját profilod. Az előre kitöltött értékek példák: ellenőrizd őket és add meg a születési dátumodat.</p>}
          <div className="uvl-field">
            <span className="uvl-flabel">Nem</span>
            <div className="uvl-seg">
              {(['M', 'F'] as const).map(s => (
                <button key={s} type="button" aria-pressed={sex === s} onClick={() => setSex(s)}
                  className={cn('uvl-chip', sex === s && 'on')}>
                  {s === 'M' ? 'Férfi' : 'Nő'}
                </button>
              ))}
            </div>
          </div>

          {field(
            'Magasság (cm)',
            <input type="number" value={heightCm} onChange={e => setHeightCm(Number(e.target.value))} aria-label="Magasság" />,
          )}
          {field(
            'Születési dátum',
            <input type="date" value={birthDateIso} onChange={e => setBirthDateIso(e.target.value)} aria-label="Születési dátum" />,
          )}
          {field(
            <>Testzsír % <span className="uvl-flabel-opt">· opcionális → pontosabb TDEE</span></>,
            <input type="number" step="0.1" value={bodyFat}
              onChange={e => setBodyFat(e.target.value === '' ? '' : Number(e.target.value))}
              aria-label="Testzsír" placeholder="pl. 15" />,
          )}

          {/* NEAT életmód-sáv (a betáblázott edzés külön adódik hozzá). Default MIXED. */}
          <div className="uvl-field">
            <span className="uvl-flabel">Aktivitási szint</span>
            <div className="uvl-opts">
              {ACTIVITY_LEVELS.map(a => {
                const sel = activityLevel === a.id
                return (
                  <button key={a.id} type="button" aria-pressed={sel} onClick={() => setActivityLevel(a.id)}
                    className={cn('uvl-opt', sel && 'on')}>
                    {sel && <Icon3D name="t-tick" size={20} />}
                    <span className="uvl-opt-nm">{a.label}</span>
                    <span className="uvl-opt-hint">{a.hint}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Split-TDEE readout — the persisted bootstrap, never a recomputation.
              No `tdeeBootstrap` (engine not run yet) → nothing renders; a number
              is never fabricated here. */}
          {profile?.tdeeBootstrap && (
            <div className="uvl-field">
              <span className="uvl-flabel">Fenntartó energia</span>
              {onExplainEnergy ? (
                <button type="button" className="tdee tdee-split uvl-tdee"
                  onClick={onExplainEnergy} aria-label="Energia-bontás magyarázata">
                  <TdeeRows tdee={profile.tdeeBootstrap} explainable />
                </button>
              ) : (
                <div className="tdee tdee-split uvl-tdee">
                  <TdeeRows tdee={profile.tdeeBootstrap} />
                </div>
              )}
            </div>
          )}

          {error && <SheetError>A mentés nem sikerült. A módosításaid megmaradtak, próbáld újra.</SheetError>}
          <div className="uvl-foot">
            <button type="button" className="uvl-ghost" onClick={close}>Mégse</button>
            <button type="button" className="uvl-cta" disabled={pending || !birthDateIso || heightCm <= 0} onClick={() => save(close)}>
              <Icon3D name="t-tick" size={20} />Mentés
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}

/** The three-row split (Alaphő · NEAT / Betáblázott mozgás / Fenntartó) — lifted
 *  verbatim from the retired `BiometricCard`, the surface that used to carry it. */
function TdeeRows({ tdee, explainable }: {
  tdee: NonNullable<BiometricProfileResponse['tdeeBootstrap']>
  explainable?: boolean
}) {
  return (
    <>
      <div className="row">
        <span className="lab"><span className="dot dot-sage" />Alaphő · NEAT</span>
        <span className="amt">{Math.round(tdee.neatBaselineKcal)}</span>
      </div>
      <div className="row">
        <span className="lab"><span className="dot dot-amber" />Betábl. mozgás</span>
        <span className="amt">+{Math.round(tdee.weeklyEatKcalPerDay)}</span>
      </div>
      <div className="row total">
        <span className="lab">
          Fenntartó · {tdee.formula === 'KATCH' ? 'Katch' : 'MSJ'}
          {explainable && <span className="infochev"><Icon3D name="t-info" size={16} /></span>}
        </span>
        <span className="amt">≈{Math.round(tdee.tdee)} <small>kcal/nap</small></span>
      </div>
    </>
  )
}
