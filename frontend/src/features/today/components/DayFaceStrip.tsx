// ============================================================
// Mezo · DayFaceStrip — Today's daypart navigator (mezo-j7u4). One pill per
// face; the pill's own counter is the day-progress indicator that replaced
// `DayArc`. The current face is highlighted even when another one is selected,
// so „hol tartok" and „mit nézek" never blur together.
// Presentational: it receives pre-derived counts and reports selections.
// ============================================================
import { cn } from '@/shared/lib/cn'
import { DAY_FACES, FACE_EMOJI, FACE_LABEL, type DayFace } from '@/features/today/logic/dayFace'

/** Spoken state of a pill — the visual counter in words. */
function spokenState(open: number, done: number): string {
  if (open > 0) return `${open} nyitott tétel`
  return done > 0 ? 'kész' : 'nincs teendő'
}

export function DayFaceStrip({
  selected, current, counts, doneCounts, onSelect,
}: {
  selected: DayFace
  /** The face the clock is actually in — styled distinctly from `selected`. */
  current: DayFace
  counts: Record<DayFace, number>
  doneCounts: Record<DayFace, number>
  onSelect: (face: DayFace) => void
}) {
  return (
    <div className="dfs" role="tablist" aria-label="Napszakok">
      {DAY_FACES.map((face) => {
        const open = counts[face]
        const done = doneCounts[face]
        const isNow = face === current
        return (
          <button
            key={face}
            type="button"
            role="tab"
            aria-selected={face === selected}
            className={cn('dfs-pill', 'np-press', isNow && 'now', face === selected && 'sel', open > 0 && 'has-open')}
            onClick={() => onSelect(face)}
            // The label REPLACES the pill's content as its accessible name, so the
            // counter has to be spoken here; the emoji stays decorative.
            aria-label={`${FACE_LABEL[face]}${isNow ? ' · most' : ''} · ${spokenState(open, done)}`}
          >
            <span className="dfs-e" aria-hidden="true">{FACE_EMOJI[face]}</span>
            <span className="dfs-l">{FACE_LABEL[face]}</span>
            <span className="dfs-c" aria-hidden="true">
              {open > 0 ? `${open} tétel` : done > 0 ? '✓ kész' : '—'}
            </span>
          </button>
        )
      })}
    </div>
  )
}
