// ============================================================
// Mezo · FuelRecoveryNote + FuelRecoveryStrip — the two quiet signs of a kímélő day on the Fuel Mai when
// the day still has a (maintenance / estimate) budget (Kihagyás S3, mezo-q4xt2.3; Folyadék F5,
// mezo-n4wf5.5 — prototype vilagos/fuel.js `strip` / `kmNote`). The strip is the pill under the day pager;
// the note is a card between the hero and the macros. Nothing here is red, and nothing grades.
// ============================================================
import { useM } from '@/shared/i18n'
import { Card } from '@/shared/ui/folyadek'
import { Strip, Tip } from '@/features/fuel/components/folyadek'
import type { SkipReason } from '@/features/train/logic/plannedSkips'

type Who = 'ILLNESS' | 'STOMACH' | 'INJURY' | 'TRAVEL'
const isWho = (c: SkipReason | null): c is Who => c === 'ILLNESS' || c === 'STOMACH' || c === 'INJURY' || c === 'TRAVEL'

/** The slim „Kímélő mód · Sérülés · 2. nap" strip above the hero (MAINTENANCE / ESTIMATE). */
export function FuelRecoveryStrip({ category, day, onTap }: {
  category: SkipReason | null
  day: number | null
  /** The strip only explains where the mode is closed (the Nap page) — it is a button, not a switch. */
  onTap: () => void
}) {
  const M = useM()
  const G = M.fuelMai.gentle
  const who = isWho(category) ? G.who[category] : null
  const parts = [who, day != null ? G.day(day) : null].filter((x): x is string => x != null)
  return (
    <Strip icon="t-kimelo" onClick={onTap} ariaLabel={[M.fuelKozos.gentle, ...parts].join(', ')}>
      <b>{M.fuelKozos.gentle}</b>{parts.map(p => ` · ${p}`).join('')}
    </Strip>
  )
}

export function FuelRecoveryNote({ mode, deficitDropped = false }: {
  mode: 'MAINTENANCE' | 'ESTIMATE'
  /** MAINTENANCE only: the cut's deficit was really switched off (see `deficitDropped`). */
  deficitDropped?: boolean
}) {
  const M = useM()
  const G = M.fuelMai.gentle
  return (
    <Card className="fa-kmn">
      {mode === 'ESTIMATE' ? (
        <Tip icon="t-travel" title={G.travel}>{G.travelBody}</Tip>
      ) : deficitDropped ? (
        // Only when a cut goal's deficit was really dropped.
        <Tip icon="t-pain" color="var(--fo-warn)" title={G.injuryDropped}>{G.injuryDroppedBody} {G.notMedical}</Tip>
      ) : (
        // Any other goal (bulk / maintain / no energy base): nothing was dropped, so nothing is claimed.
        <Tip icon="t-pain" color="var(--fo-warn)" title={G.injury}>{G.injuryBody} {G.notMedical}</Tip>
      )}
    </Card>
  )
}
