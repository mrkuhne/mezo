import { useState } from 'react'
import { useStackDay } from '@/data/hooks'
import { StackDayArc, isSlotDone } from '@/features/fuel/components/StackDayArc'
import { StackPageScaffold } from '@/features/fuel/components/StackPageScaffold'
import { StackTimeline } from '@/features/fuel/components/StackTimeline'
import { buildStackDayView } from '@/features/fuel/logic/stackPresentation'
import { useStackIntakeToggle } from '@/features/fuel/logic/useStackIntakeToggle'
import type { StackDayEntry } from '@/features/fuel/logic/projectStackDay'
import { StackItemSheet } from '@/features/fuel/sheets/StackItemSheet'

export function FuelStackTodayPage() {
  const { slots, wake, bed } = useStackDay()
  const view = buildStackDayView(slots)
  const { toggleIntake } = useStackIntakeToggle()
  const [openEntry, setOpenEntry] = useState<StackDayEntry | null>(null)
  const nextIndex = slots.findIndex(slot => !isSlotDone(slot))

  return (
    <StackPageScaffold
      tone="gold" backTo="/fuel/stack" backLabel="‹ Stack" icon="i-idozito"
      name="Mai ritmus" big={`${view.takenCount}/${view.totalCount}`} sub="bevéve ma"
    >
      {slots.length > 0 ? (
        <>
          <div className="rise"><StackDayArc slots={slots} wake={wake} bed={bed} nextIndex={nextIndex} now={new Date()} /></div>
          <StackTimeline
            slots={slots}
            onToggle={entry => { void toggleIntake(entry) }}
            onOpen={setOpenEntry}
          />
        </>
      ) : <div className="stk-detail-state">A mai ritmus még üres.</div>}
      {openEntry && <StackItemSheet entry={openEntry} onClose={() => setOpenEntry(null)} />}
    </StackPageScaffold>
  )
}
