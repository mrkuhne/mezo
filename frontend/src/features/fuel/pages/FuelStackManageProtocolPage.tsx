import { useState } from 'react'
import { useStackDay } from '@/data/hooks'
import { StackManageOccurrenceList } from '@/features/fuel/components/StackManageOccurrenceList'
import { StackPageScaffold } from '@/features/fuel/components/StackPageScaffold'
import type { StackDayEntry } from '@/features/fuel/logic/projectStackDay'
import { StackItemSheet } from '@/features/fuel/sheets/StackItemSheet'

export function FuelStackManageProtocolPage() {
  const { slots, occurrences } = useStackDay()
  const [openEntry, setOpenEntry] = useState<StackDayEntry | null>(null)
  return (
    <StackPageScaffold tone="sage" backTo="/fuel/stack/manage" backLabel="‹ Kezelés"
      icon="i-stack" name="Protokoll tételei" big={`${occurrences.length} tétel`} sub="élő protokoll">
      <StackManageOccurrenceList slots={slots} lens="protocol" onOpen={setOpenEntry} />
      {openEntry && <StackItemSheet entry={openEntry} onClose={() => setOpenEntry(null)} />}
    </StackPageScaffold>
  )
}
