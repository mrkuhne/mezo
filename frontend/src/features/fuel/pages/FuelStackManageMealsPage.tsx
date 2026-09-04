import { useState } from 'react'
import { useStackDay } from '@/data/hooks'
import { StackManageOccurrenceList } from '@/features/fuel/components/StackManageOccurrenceList'
import { StackPageScaffold } from '@/features/fuel/components/StackPageScaffold'
import type { StackDayEntry } from '@/features/fuel/logic/projectStackDay'
import { StackItemSheet } from '@/features/fuel/sheets/StackItemSheet'

const mealZones = new Set(['breakfast', 'lunch', 'dinner'])

export function FuelStackManageMealsPage() {
  const { slots } = useStackDay()
  const mealCount = slots.filter(slot => mealZones.has(slot.zone)).flatMap(slot => slot.entries).length
  const [openEntry, setOpenEntry] = useState<StackDayEntry | null>(null)
  return (
    <StackPageScaffold tone="coral" backTo="/fuel/stack/manage" backLabel="‹ Kezelés"
      icon="i-recept" name="Étkezési horgonyok" big={`${mealCount} tétel`} sub="reggeli · ebéd · vacsora">
      <StackManageOccurrenceList slots={slots} lens="meals" onOpen={setOpenEntry} />
      {openEntry && <StackItemSheet entry={openEntry} onClose={() => setOpenEntry(null)} />}
    </StackPageScaffold>
  )
}
