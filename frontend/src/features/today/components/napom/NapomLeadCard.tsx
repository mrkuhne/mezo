// A napom · „Most érdemes" — the one next step for today (Folyadék prototype `ndLead`,
// vilagos/nap.js): a numbered section whose title carries the time of day, and one filled step
// on the stream. The step is a statement, not a second button: the hero tank's CTA is the one
// control that goes there. The action itself comes from `nextBestAction` — pure rules, no LLM.
import type { Icon3DName } from '@/shared/ui/clay'
import { Card, Section, Step } from '@/shared/ui/folyadek'
import type { NextAction, NextActionKind } from '@/features/today/logic/napom'

const ICON: Record<NextActionKind, Icon3DName> = {
  workout: 't-dumbbell',
  checkin: 't-checkin',
  napzaras: 't-moon',
}

/** `MOST ÉRDEMES · ESTE` → `Most érdemes · este`; no time-of-day word → `Most érdemes`. */
export function leadTitle(action: NextAction): string {
  const when = action.eyebrow.split(' · ')[1]
  return when ? `Most érdemes · ${when.toLowerCase()}` : 'Most érdemes'
}

export function NapomLeadCard({ action, n }: { action: NextAction; /** Section number. */ n: number }) {
  return (
    <>
      <Section n={n} title={leadTitle(action)} />
      <Card>
        <Step now icon={ICON[action.kind]} title={action.title} sub={action.sub} />
      </Card>
    </>
  )
}
