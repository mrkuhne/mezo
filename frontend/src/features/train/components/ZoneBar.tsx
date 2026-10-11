// ============================================================
// Mezo · ZoneBar — a heti volumen edénye (mezo-yty6; Folyadék mezo-n4wf5.3, prototype
// vilagos/edzes.js `wlv()` a heti terhelés sorában). Az edény széle a legfeljebb vállalható
// heti szettszám (MRV); benne a mostani szint az izom színében, egy folytonos vízvonal ott,
// ahonnan az izom fejlődik (MEV), és egy szaggatott a fókusz szerinti célnál. A betűszavak
// (MV / MEV / MAV / MRV) lekerültek a felületről — a jelmagyarázat a kártya tetején áll.
// Százalék soha nem jelenik meg szövegként.
// ============================================================
import { deepMuscle } from '@/features/train/components/folyadek'
import type { Landmark } from '@/features/train/logic/mesoLoad'
import { LevelMarks } from '@/shared/ui/folyadek'

interface ZoneBarProps {
  landmark: Landmark
  /** Working sets planned this week. */
  value: number
  /** The tier's landmark target — the dashed waterline. */
  target: number
  colorMuscle: string
  /** Muscle label, used for the meter's accessible name. */
  label: string
}

export function ZoneBar({ landmark, value, target, colorMuscle, label }: ZoneBarProps) {
  const max = Math.max(1, landmark.mrv)
  const at = (v: number) => (v / max) * 100

  return (
    <span
      className="ew-zb"
      role="meter"
      aria-label={`${label} · heti szettek`}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <LevelMarks
        pct={at(value)}
        color={deepMuscle(colorMuscle)}
        height={14}
        marks={[{ at: at(landmark.mev) }, { at: at(target), dashed: true }]}
      />
    </span>
  )
}
