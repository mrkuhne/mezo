import { useState, type ReactNode } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { useBiometricActions } from '@/data/hooks'
import type { BiometricProfileResponse, BiometricProfileUpsertRequest } from '@/data/me/biometricProfileApi'
import { ACTIVITY_LEVELS, type ActivityLevel } from '@/features/me/logic/biometricFields'

// Jakarta section-label idiom (Napiv, replaces the retired mono `label-mono` class).
const SECTION_LABEL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '.1em',
  textTransform: 'uppercase',
  color: 'var(--faint)',
}

// Biometric editor sheet (G6, mezo-06n). Opened from the Profile Biometria card
// (both the populated card and the empty-state prompt). Edits the single
// first-class biometric profile the engine computes the base-TDEE from. The
// field markup (Nem segmented M/F · Magasság · Születési dátum · Testzsír%
// optional · Aktivitási szint × PAL) is lifted from the deleted GoalPlannerPage
// Step2. Prefills from the current profile when present. Mentés calls the upsert
// mutation (which invalidates ['biometricProfile'] + ['goals'] so the active
// goal recomputes server-side — Task 3) then closes on success — the EditGoalSheet
// "mutation inside the sheet" pattern.
export function BiometricSheet({
  onClose,
  profile,
}: {
  onClose: () => void
  profile: BiometricProfileResponse | null
}) {
  const { upsert, pending } = useBiometricActions()
  const [sex, setSex] = useState<'M' | 'F'>(profile?.sex ?? 'M')
  const [heightCm, setHeightCm] = useState<number>(profile?.heightCm ?? 180)
  const [birthDateIso, setBirthDateIso] = useState<string>(profile?.birthDate ?? '1991-03-01')
  const [bodyFat, setBodyFat] = useState<number | ''>(profile?.bodyFatPct ?? '')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    (profile?.activityLevel as ActivityLevel | null | undefined) ?? 'MODERATE',
  )

  const save = (close: () => void) => {
    const body: BiometricProfileUpsertRequest = {
      sex,
      heightCm,
      birthDate: birthDateIso,
      activityLevel,
      ...(bodyFat !== '' ? { bodyFatPct: Number(bodyFat) } : {}),
    }
    upsert(body).then(close)
  }

  const field = (label: ReactNode, input: ReactNode) => (
    <div className="col gap-sm">
      <span style={SECTION_LABEL}>{label}</span>
      <div className="card notch-4" style={{ padding: 10 }}>
        {input}
      </div>
    </div>
  )
  const numStyle = { width: '100%', fontSize: 14, color: 'var(--text-primary)' } as const

  return (
    <Sheet onClose={onClose} labelledBy="biometric-title">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div className="col">
              <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>Biometria</span>
              <div id="biometric-title" className="h-display size-md" style={{ marginTop: 4 }}>
                A motor ebből számol
              </div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          <div className="col gap-md">
            <div className="col gap-sm">
              <span style={SECTION_LABEL}>Nem</span>
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
                        sex === s ? 'color-mix(in srgb, var(--lav-deep) 12%, transparent)' : 'var(--surface-1)',
                      border: `1px solid ${sex === s ? 'var(--lav-deep)' : 'var(--border-subtle)'}`,
                      color: sex === s ? 'var(--lav-deep)' : 'var(--text-secondary)',
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
              'Magasság (cm)',
              <input
                type="number"
                value={heightCm}
                onChange={e => setHeightCm(Number(e.target.value))}
                aria-label="Magasság"
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
              <>
                Testzsír % <span style={{ color: 'var(--lav-deep)', opacity: 0.8 }}>· opcionális → pontosabb TDEE</span>
              </>,
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
              <span style={SECTION_LABEL}>Aktivitási szint</span>
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
                        background: sel ? 'color-mix(in srgb, var(--lav-deep) 10%, transparent)' : 'var(--surface-1)',
                        borderColor: sel ? 'var(--lav-deep)' : 'var(--border-subtle)',
                      }}
                    >
                      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                        <span
                          style={{
                            fontFamily: 'var(--ff-display)',
                            fontSize: 14,
                            fontWeight: 600,
                            color: sel ? 'var(--lav-deep)' : 'var(--text-primary)',
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

          <div className="row gap-sm mt-lg">
            <button className="cta-ghost notch-4 flex-1" onClick={close}>
              Mégse
            </button>
            <button
              className="cta-primary notch-4 flex-1"
              disabled={pending}
              onClick={() => save(close)}
            >
              <Icon name="check" size={14} /> Mentés
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
