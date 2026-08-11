// ============================================================
// Mezo · DaypartTabs — the Mai screen's daypart switcher (mezo-puci).
// The house `.segtabs` control (the Sport/Futás precedent), NOT a new
// switcher language. Two independent signals, never blurred: the
// PRESSED segment is what you are looking at (`selected`, derived from
// `?dp=`), the gold dot is where the clock actually is (`current`) —
// the DayFaceStrip dual-signal, inherited through the islands era.
// Presentational: it owns no state and reads no hook.
// ============================================================
import { DAY_FACES, FACE_EMOJI, FACE_LABEL, type DayFace } from '@/features/today/logic/dayFace'

export interface DaypartTabsProps {
  /** What the screen is showing — from `?dp=`, falling back to the clock. */
  selected: DayFace
  /** Where the clock is — marked independently of the selection. */
  current: DayFace
  onSelect: (face: DayFace) => void
}

export function DaypartTabs({ selected, current, onSelect }: DaypartTabsProps) {
  return (
    <div className="daytabs">
      <div className="segtabs" role="group" aria-label="Napszak">
        {DAY_FACES.map((face) => (
          <button
            key={face}
            type="button"
            className="segtab np-press"
            aria-pressed={face === selected}
            onClick={() => onSelect(face)}
          >
            <span aria-hidden="true">{FACE_EMOJI[face]}</span> {FACE_LABEL[face]}
            {face === current && <span className="daytab-now" role="img" aria-label="most" />}
          </button>
        ))}
      </div>
    </div>
  )
}
