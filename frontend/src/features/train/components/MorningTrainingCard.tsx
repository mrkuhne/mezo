import { DAY_ORDER } from '@/data/train/train'
import type { GymScheduleSlot } from '@/data/types'
import { Acts, Btn, Card, Head, Lk, Row, Txt } from '@/shared/ui/folyadek'

/** Gentle anchor-consumer nudge (mezo-67rb): offer moving late gym slots into the
 *  wake-derived morning window. Presentational — the page owns data + snooze.
 *  Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js `mtrCard()`): a white card — the dawn head, the
 *  lead, one row per gym slot that would move („Pén 17:00 → 06:30"), the small primary button and the
 *  quiet „Maradjon így" link. */
export function MorningTrainingCard({
  offending,
  windowStart,
  windowEnd,
  onApply,
  onSnooze,
}: {
  offending: GymScheduleSlot[]
  windowStart: string
  windowEnd: string
  onApply: () => void
  onSnooze: () => void
}) {
  return (
    <Card className="em-mtr" aria-label="Reggeli edzés-ablak">
      <Head icon="t-dawn" title="Reggeli edzés" />
      <Txt>
        A reggeli mozgás előrébb tolja a belső órát — este könnyebben alszol el. Az ébredésed
        szerint az ablakod {windowStart}–{windowEnd}.
      </Txt>
      {offending.map((s) => (
        <Row key={`${s.dayOfWeek}-${s.time}`} icon="t-clock" title={`${DAY_ORDER[s.dayOfWeek]} ${s.time} → ${windowStart}`}
          sub="ezt az edzőtermi időpontot tennénk át" />
      ))}
      <Acts><Btn sm onClick={onApply}>Áthelyezés a reggeli ablakba</Btn></Acts>
      <Acts><Lk onClick={onSnooze}>Maradjon így</Lk></Acts>
    </Card>
  )
}
