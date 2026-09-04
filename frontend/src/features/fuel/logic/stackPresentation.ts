import type { StackDayEntry, StackDaySlot } from '@/features/fuel/logic/projectStackDay'

export interface StackDayRow {
  entry: StackDayEntry
  zone: StackDaySlot['zone']
  time: string
  slotLabel: string
  anchorNote: string | null
}

export interface StackDayView {
  rows: StackDayRow[]
  applicableRows: StackDayRow[]
  previewRows: StackDayRow[]
  nextRow: StackDayRow | null
  takenCount: number
  totalCount: number
  allDone: boolean
}

export function buildStackDayView(slots: StackDaySlot[]): StackDayView {
  const rows = slots.flatMap(slot => slot.entries.map(entry => ({
    entry,
    zone: slot.zone,
    time: slot.time,
    slotLabel: slot.label,
    anchorNote: slot.anchorNote,
  })))
  const applicableRows = rows.filter(row => !row.entry.skippedToday)
  const takenCount = applicableRows.filter(row => row.entry.taken).length
  const totalCount = applicableRows.length
  const nextIndex = applicableRows.findIndex(row => !row.entry.taken)
  const previewStart = Math.max(0, nextIndex - 1)
  const previewRows = nextIndex < 0
    ? applicableRows.slice(-3)
    : applicableRows.slice(previewStart, previewStart + 3)

  return {
    rows,
    applicableRows,
    previewRows,
    nextRow: nextIndex < 0 ? null : applicableRows[nextIndex],
    takenCount,
    totalCount,
    allDone: totalCount > 0 && takenCount === totalCount,
  }
}
