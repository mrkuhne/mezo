import { useEffect, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '@/shared/ui/Icon'
import { Icon3D } from '@/shared/ui/clay'
import { useBiometricProfile } from '@/data/hooks'

// Goal-creation hard gate (G6, mezo-06n — Task 7). The engine derives the
// calorie target from the biometric profile (sex · height · birth date), so a
// goal cannot be created without a complete one. Both "Új cél" entries in
// GoalsPage route through this gate: when the profile is complete the caller
// navigates straight to the wizard; when it is NOT, GoalsPage renders this
// interstitial instead of navigating. Its repair CTA opens the canonical biometric
// settings editor. The return origin leads back to weight goals after correction.
const MISSING_LABEL = { sex: 'nem', heightCm: 'magasság', birthDate: 'szül.dátum' } as const

export function GoalGate({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const { profile, isComplete } = useBiometricProfile()
  const navigate = useNavigate()
  const location = useLocation()

  // Which of the three required fields are still missing → the warning chips.
  const missing = (Object.keys(MISSING_LABEL) as (keyof typeof MISSING_LABEL)[]).filter(
    k => !(profile && profile[k]),
  )

  useEffect(() => {
    if (isComplete) onComplete()
  }, [isComplete, onComplete])

  // Üveg (mezo-me75u.6): a dimmed scrim with ONE coral glass card — the missing fields are
  // flat amber chips with the t-info sprite instead of the "⚠" glyph; the meaning ("hiányzik")
  // stays in the chip text. Not a GlassBox: this is the page's own full-screen interstitial.
  return (
    <div className="goal-gate">
      <div className="goal-gate-card glass" style={{ '--c': 'var(--dv-coral)' } as CSSProperties}>
        {/* Top bar: ✕ back + "Új cél" eyebrow, mirroring the wizard chrome. */}
        <div className="goal-gate-top">
          <span className="goal-gate-eb">Új cél</span>
          <button type="button" className="goal-gate-x" aria-label="Bezárás" onClick={onClose}>
            <Icon name="x" size={12} />
          </button>
        </div>

        <div className="goal-gate-title">
          <Icon3D name="t-heart" size={52} className="goal-gate-art" />
          <h3>Előbb: a biometriád</h3>
        </div>
        <p className="goal-gate-lead">
          A motor a kalória-cél kiszámításához a{' '}
          <b>nem · magasság · kor</b> adataidból dolgozik.
          Állítsd be egyszer a profilban — utána minden cél innen számol.
        </p>

        {/* Missing-field chips (warning idiom). */}
        {missing.length > 0 && (
          <div className="goal-gate-chips">
            {missing.map((k, i) => (
              <span key={k} className="goal-gate-chip">
                {i === 0 && <Icon3D name="t-info" size={16} />}
                {i === 0 ? `hiányzik: ${MISSING_LABEL[k]}` : MISSING_LABEL[k]}
              </span>
            ))}
          </div>
        )}

        <button
          type="button"
          className="goal-gate-cta np-press"
          onClick={() => navigate('/settings/me/biometrics', { state: { from: location.pathname + location.search } })}
        >
          Biometria beállítása →
        </button>
        <span className="goal-gate-hint">egyszeri beállítás · ~20 mp</span>
      </div>
    </div>
  )
}
