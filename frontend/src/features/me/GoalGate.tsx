import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { useBiometricProfile } from '@/data/hooks'
import { BiometricSheet } from './BiometricSheet'

// Goal-creation hard gate (G6, mezo-06n — Task 7). The engine derives the
// calorie target from the biometric profile (sex · height · birth date), so a
// goal cannot be created without a complete one. Both "Új cél" entries in
// GoalsView route through this gate: when the profile is complete the caller
// navigates straight to the wizard; when it is NOT, GoalsView renders this
// interstitial instead of navigating (mockup: hard-gate.html). Its CTA opens
// the BiometricSheet; once the saved profile is complete (the upsert
// invalidates ['biometricProfile'] → useBiometricProfile re-reads it) we
// continue into the wizard via onComplete.
const MISSING_LABEL = { sex: 'nem', heightCm: 'magasság', birthDate: 'szül.dátum' } as const

export function GoalGate({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const { profile, isComplete } = useBiometricProfile()
  const [sheetOpen, setSheetOpen] = useState(false)

  // Which of the three required fields are still missing → the warning chips.
  const missing = (Object.keys(MISSING_LABEL) as (keyof typeof MISSING_LABEL)[]).filter(
    k => !(profile && profile[k]),
  )

  // After the sheet saves a complete profile, the ['biometricProfile'] refetch
  // flips isComplete → continue into the wizard. Guard on sheetOpen so we only
  // advance after the user actually edited (not on an already-complete profile,
  // which never opens the gate anyway).
  useEffect(() => {
    if (isComplete && sheetOpen) onComplete()
  }, [isComplete, sheetOpen, onComplete])

  return (
    <div
      className="col"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 60,
        background: 'radial-gradient(ellipse at center, #0c1218 0%, var(--canvas) 70%)',
      }}
    >
      {/* Top bar: ✕ back + "Új cél" eyebrow, mirroring the wizard chrome. */}
      <div className="row gap-sm" style={{ padding: '14px 22px', alignItems: 'center' }}>
        <button
          type="button"
          className="chip"
          aria-label="Bezárás"
          onClick={onClose}
          style={{ padding: '6px 8px' }}
        >
          <Icon name="x" size={12} />
        </button>
        <span className="eyebrow brand">Új cél</span>
      </div>

      {/* Centered gate card (notch / brand-glow idiom). */}
      <div
        className="col"
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          padding: '0 28px 40px',
        }}
      >
        <div
          className="notch-12"
          style={{
            width: 64,
            height: 64,
            display: 'grid',
            placeItems: 'center',
            marginBottom: 18,
            border: '1.5px solid var(--border-brand)',
            background: 'color-mix(in srgb, var(--brand-glow) 7%, transparent)',
          }}
        >
          <Icon name="heart" size={28} color="var(--brand-glow)" />
        </div>

        <div
          style={{ fontFamily: 'var(--ff-display)', fontSize: 26, lineHeight: 1.08, marginBottom: 10 }}
        >
          Előbb: a biometriád
        </div>
        <p
          className="text-secondary"
          style={{ fontSize: 13, lineHeight: 1.55, maxWidth: 250 }}
        >
          A motor a kalória-cél kiszámításához a{' '}
          <b style={{ color: 'var(--text-primary)' }}>nem · magasság · kor</b> adataidból dolgozik.
          Állítsd be egyszer a profilban — utána minden cél innen számol.
        </p>

        {/* Missing-field chips (warning idiom). */}
        {missing.length > 0 && (
          <div
            className="row gap-xs"
            style={{ flexWrap: 'wrap', justifyContent: 'center', margin: '16px 0 4px' }}
          >
            {missing.map((k, i) => (
              <span
                key={k}
                className="chip notch-4"
                style={{
                  fontFamily: 'var(--ff-mono)',
                  fontSize: 9,
                  letterSpacing: '0.06em',
                  padding: '4px 9px',
                  color: 'var(--warning)',
                  borderColor: 'color-mix(in srgb, var(--warning) 40%, transparent)',
                }}
              >
                {i === 0 ? `⚠ hiányzik: ${MISSING_LABEL[k]}` : MISSING_LABEL[k]}
              </span>
            ))}
          </div>
        )}

        <button
          type="button"
          className="cta-primary notch-8"
          onClick={() => setSheetOpen(true)}
          style={{ marginTop: 22, width: '100%', maxWidth: 280 }}
        >
          Biometria beállítása →
        </button>
        <span
          className="text-tertiary"
          style={{ marginTop: 11, fontFamily: 'var(--ff-mono)', fontSize: 10, letterSpacing: '0.06em' }}
        >
          egyszeri beállítás · ~20 mp
        </span>
      </div>

      {sheetOpen && <BiometricSheet onClose={() => setSheetOpen(false)} profile={profile} />}
    </div>
  )
}
