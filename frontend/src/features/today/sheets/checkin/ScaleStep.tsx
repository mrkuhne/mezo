// Check-in · one 1–10 item (Folyadék, prototype vilagos/nap.js `ckSheet()`, the scale body): the
// answer is a jar you fill. The jar, the one loud numeral („–" until tapped: nothing is
// pre-selected) and the item's icon in its chip, then the ten vials and their two anchors.
import { Bub, Ends, Jar, Scale } from '@/shared/ui/folyadek'
import type { Icon3DName } from '@/shared/ui/clay'

export function ScaleStep({ icon, value, low, high, onPick, labelledBy }: {
  icon: Icon3DName; value: number | null; low?: string; high?: string; onPick: (n: number) => void
  /** The id of the question this scale answers. */
  labelledBy?: string
}) {
  return (
    <>
      <div className="nck2-bigrow">
        <Jar pct={value ? value * 10 : 0} size={66} />
        <span className="nck2-big" data-testid="ck-value">{value ?? '–'}<small>/ 10</small></span>
        <span className="nck2-end"><Bub icon={icon} size={52} /></span>
      </div>
      <Scale value={value} onPick={onPick} aria-labelledby={labelledBy} />
      <Ends low={low} high={high} />
    </>
  )
}
