import { describe, expect, it } from 'vitest'
import { buildStackDayView } from '@/features/fuel/logic/stackPresentation'
import type { StackDayEntry, StackDaySlot } from '@/features/fuel/logic/projectStackDay'

function entry(name: string, taken = false, skippedToday = false): StackDayEntry {
  return {
    occurrenceId: `occ-${name}`,
    pantryItemId: name,
    persistedZone: 'breakfast',
    name,
    dose: '1 adag',
    pinned: false,
    placementSource: 'rule',
    reason: null,
    dailyTotalHint: null,
    skippedToday,
    displacedToday: false,
    taken,
  }
}

function slot(time: string, ...entries: StackDayEntry[]): StackDaySlot {
  return {
    zone: 'breakfast',
    time,
    label: 'Reggeli',
    anchorNote: 'étkezéshez kötve',
    entries,
  }
}

describe('buildStackDayView', () => {
  it('a közvetlen előző, a következő és az utána jövő sort teszi az előnézetbe', () => {
    const slots = [
      slot('07:00', entry('D3 + K2', true)),
      slot('08:00', entry('Kreatin')),
      slot('12:30', entry('Magnézium')),
      slot('17:00', entry('Pihenőnapi PWO', false, true)),
    ]

    const view = buildStackDayView(slots)

    expect(view.takenCount).toBe(1)
    expect(view.totalCount).toBe(3)
    expect(view.nextRow?.entry.name).toBe('Kreatin')
    expect(view.previewRows.map(row => row.entry.name)).toEqual([
      'D3 + K2', 'Kreatin', 'Magnézium',
    ])
    expect(view.rows).toHaveLength(4)
    expect(view.applicableRows).toHaveLength(3)
    expect(view.allDone).toBe(false)
  })

  it('üres inputot nem mutat kész napként', () => {
    expect(buildStackDayView([])).toEqual({
      rows: [],
      applicableRows: [],
      previewRows: [],
      nextRow: null,
      takenCount: 0,
      totalCount: 0,
      allDone: false,
    })
  })

  it('az első három sort mutatja, ha az első sor következik', () => {
    const view = buildStackDayView([
      slot('07:00', entry('A')),
      slot('08:00', entry('B')),
      slot('09:00', entry('C')),
      slot('10:00', entry('D')),
    ])
    expect(view.previewRows.map(row => row.entry.name)).toEqual(['A', 'B', 'C'])
  })

  it('kész napnál az utolsó három applicable sort mutatja', () => {
    const view = buildStackDayView([
      slot('07:00', entry('A', true)),
      slot('08:00', entry('B', true)),
      slot('09:00', entry('C', true)),
      slot('10:00', entry('D', true)),
    ])
    expect(view.previewRows.map(row => row.entry.name)).toEqual(['B', 'C', 'D'])
    expect(view.nextRow).toBeNull()
    expect(view.allDone).toBe(true)
  })

  it('a skipped sort megtartja a teljes listában, de progressből és preview-ból kihagyja', () => {
    const skipped = entry('Kimarad', false, true)
    const view = buildStackDayView([slot('07:00', skipped), slot('08:00', entry('Kreatin'))])
    expect(view.rows.map(row => row.entry.name)).toEqual(['Kimarad', 'Kreatin'])
    expect(view.applicableRows.map(row => row.entry.name)).toEqual(['Kreatin'])
    expect(view.previewRows.map(row => row.entry.name)).toEqual(['Kreatin'])
  })

  it('nem mutálja az input slotokat vagy entryket', () => {
    const slots = [slot('07:00', entry('A', true)), slot('08:00', entry('B'))]
    const before = structuredClone(slots)
    buildStackDayView(slots)
    expect(slots).toEqual(before)
  })
})
