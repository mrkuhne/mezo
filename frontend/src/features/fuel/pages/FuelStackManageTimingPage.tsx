import { useState } from 'react'
import { useStackDay } from '@/data/hooks'
import { StackManageOccurrenceList } from '@/features/fuel/components/StackManageOccurrenceList'
import { StackPageScaffold } from '@/features/fuel/components/StackPageScaffold'
import type { StackDayEntry } from '@/features/fuel/logic/projectStackDay'
import { StackItemSheet } from '@/features/fuel/sheets/StackItemSheet'

export function FuelStackManageTimingPage() {
  const { slots } = useStackDay()
  const [openEntry, setOpenEntry] = useState<StackDayEntry | null>(null)
  return (
    <StackPageScaffold tone="gold" backTo="/fuel/stack/manage" backLabel="‹ Kezelés"
      icon="i-idozito" name="Időzítési rend" big={`${slots.length} zóna`} sub="a napod horgonyaihoz igazítva">
      <StackManageOccurrenceList slots={slots} lens="timing" onOpen={setOpenEntry} />
      {openEntry && <StackItemSheet entry={openEntry} onClose={() => setOpenEntry(null)} />}
    </StackPageScaffold>
  )
}
