// ============================================================
// Mezo · ZoneBar — a heti volumen zóna-sávja (mezo-yty6): a MEV–MAV és MAV–MRV
// zónák halvány sávozása, feliratozott landmark-vonalak, a tier-cél vonala és a
// mostani értéken álló, izom-színű marker. Ez váltja a magyarázat nélküli
// zöld/sárga/piros jelzést: látszik, hol állsz ÉS hova tartasz.
// Százalék soha nem jelenik meg szövegként (a WeeklyBandsCard öröklött szabálya).
// ============================================================
import type { Landmark } from '@/features/train/logic/mesoLoad'
import { muscleColor } from '@/features/train/logic/muscleColors'

interface ZoneBarProps {
  landmark: Landmark
  /** Working sets planned this week. */
  value: number
  /** The tier's landmark target — gets its own line on the track. */
  target: number
  colorMuscle: string
  /** Muscle label, used for the meter's accessible name. */
  label: string
}

/** A little headroom past MRV so a marker AT the ceiling is still visibly inside the track. */
const HEADROOM = 2

export function ZoneBar({ landmark, value, target, colorMuscle, label }: ZoneBarProps) {
  const max = landmark.mrv + HEADROOM
  // Round to 5 decimal places: keeps whole-percent positions terse ("50%")
  // while matching the fixed precision the design expects for fractional ones.
  const round5 = (n: number) => Math.round(n * 1e5) / 1e5
  const at = (v: number) => `${round5(Math.min(100, Math.max(0, (v / max) * 100)))}%`
  const deep = muscleColor(colorMuscle).deep

  return (
    <>
      <div
        className="mz-zb"
        role="meter"
        aria-label={`${label} · heti szettek`}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <span className="mz-zb-z2" style={{ left: at(landmark.mev), width: `${((landmark.mav - landmark.mev) / max) * 100}%` }} />
        <span className="mz-zb-z3" style={{ left: at(landmark.mav), width: `${((landmark.mrv - landmark.mav) / max) * 100}%` }} />
        <span className="mz-zb-hl" style={{ left: at(landmark.mev) }} />
        <span className="mz-zb-hl" style={{ left: at(landmark.mav) }} />
        <span className="mz-zb-hl" style={{ left: at(landmark.mrv) }} />
        <span className="mz-zb-tg" style={{ left: at(target) }} />
        <span className="mz-zb-mk" style={{ left: at(value), background: deep }} />
      </div>
      <div className="mz-zb-cap" aria-hidden="true">
        <span>MV {landmark.mev > 0 ? Math.max(0, Math.round(landmark.mev / 2)) : 0}</span>
        <span>MEV {landmark.mev}</span>
        <span>MAV {landmark.mav}</span>
        <span>MRV {landmark.mrv}</span>
      </div>
    </>
  )
}
