// F7.5 (mezo-d20.8.5): the archive timeline's month grouping — Day One pattern.
// Input is the shelf order (weekStart desc); groups preserve it. The year only appears
// on the labels when the shelf spans more than one year (the common single-year shelf
// reads like the prototype: "Augusztus", not "Augusztus 2026").
import type { MemoirEntry } from '@/data/types'

export interface MemoirMonthGroup { label: string; entries: MemoirEntry[] }

const monthLabel = (weekStart: string, withYear: boolean): string => {
  const [y, m] = weekStart.split('-').map(Number)
  const name = new Date(y, m - 1, 1).toLocaleDateString('hu-HU', { month: 'long' })
  const cap = name.charAt(0).toUpperCase() + name.slice(1)
  return withYear ? `${cap} ${y}` : cap
}

export function groupByMonth(entries: MemoirEntry[]): MemoirMonthGroup[] {
  const years = new Set(entries.map((e) => e.weekStart.slice(0, 4)))
  const withYear = years.size > 1
  const groups: MemoirMonthGroup[] = []
  for (const e of entries) {
    const label = monthLabel(e.weekStart, withYear)
    const last = groups.at(-1)
    if (last && last.label === label) last.entries.push(e)
    else groups.push({ label, entries: [e] })
  }
  return groups
}
