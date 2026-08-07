// ============================================================
// Mezo · islandFacts — pure fact derivations for the three-islands
// Today L0 (mezo-euze). Every island shows ONE hero + 1–2 facts; a
// fact is a CONTEXTUALIZED datum (trend / delta / goal distance /
// forecast), never a raw number. No source → null (strip philosophy:
// the cell simply does not render — no `—` fabrication).
// ============================================================
import type { FuelSlot, QuickStatItem, SleepEntry, SleepGoal, WeightEntry } from '@/data/types'
import type { GrowthTodaySummary } from '@/features/today/logic/growthToday'
import { minsToBed } from '@/features/today/logic/windDown'

export type FactTone = 'good' | 'warn' | 'muted'

export interface IslandFact {
  label: string
  value: string
  unit?: string
  delta?: { text: string; tone: FactTone }
}

export interface IslandHero {
  value: string
  unit: string
  sub: string | null
}

/** Hungarian decimal formatting — 78.6 → '78,6'. */
const hu = (n: number, digits = 1) => n.toFixed(digits).replace('.', ',')

const MINUS = '−'

export function fallbackHero(openCount: number): IslandHero {
  return { value: String(openCount), unit: 'tétel ma', sub: null }
}

export function morningHero(lastNight: SleepEntry | undefined, log: SleepEntry[], goal: SleepGoal): IslandHero | null {
  if (!lastNight) return null
  const d = lastNight.duration * 60 - goal.targetMinutes
  let sub = `${hu(Math.abs(d) / 60)} órával ${d >= 0 ? 'a célod felett' : 'a célod alatt'}`
  if (log.length >= 3) {
    const recent = log.slice(-7)
    const debt = recent.reduce((acc, e) => acc + (e.duration * 60 - goal.targetMinutes), 0)
    sub += ` · heti adósság ${debt < 0 ? MINUS : '+'}${hu(Math.abs(debt) / 60)} óra`
  }
  return { value: hu(lastNight.duration), unit: 'óra alvás', sub }
}

export function weightFact(log: WeightEntry[], targetWeight: number | null): IslandFact | null {
  if (log.length === 0) return null
  const last = log[log.length - 1]
  const fact: IslandFact = { label: 'Súly', value: hu(last.value), unit: 'kg' }
  // Reference: the newest entry at least 7 days older than the last one; with a
  // shorter log (but ≥ 2 entries) the oldest entry stands in.
  const lastMs = Date.parse(last.date)
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000
  const ref =
    [...log].reverse().find((e) => lastMs - Date.parse(e.date) >= WEEK_MS) ?? (log.length >= 2 ? log[0] : undefined)
  if (!ref || ref === last) return fact
  const diff = last.value - ref.value
  const arrow = diff <= 0 ? '↘' : '↗'
  let tone: FactTone = 'muted'
  if (targetWeight != null) {
    tone = Math.abs(last.value - targetWeight) < Math.abs(ref.value - targetWeight) ? 'good' : 'warn'
  }
  let text = `${arrow} ${diff < 0 ? MINUS : '+'}${hu(Math.abs(diff))} a héten`
  if (targetWeight != null) text += ` · cél ${hu(targetWeight)}`
  fact.delta = { text, tone }
  return fact
}

export function hrvFact(cells: QuickStatItem[]): IslandFact | null {
  const cell = cells.find((c) => c.label.toUpperCase().includes('HRV'))
  if (!cell) return null
  return { label: 'HRV', value: cell.value, unit: cell.unit }
}

export function proteinFact(slots: FuelSlot[]): IslandFact | null {
  const withP = slots.filter((s) => typeof s.p === 'number')
  if (withP.length === 0) return null
  const doneP = withP.filter((s) => s.state === 'done').reduce((acc, s) => acc + (s.p as number), 0)
  const targetP = withP.reduce((acc, s) => acc + (s.p as number), 0)
  return {
    label: 'Fehérje ma',
    value: String(Math.round(doneP)),
    unit: 'g',
    delta: { text: `cél ${Math.round(targetP)} g`, tone: doneP >= targetP * 0.5 ? 'good' : 'warn' },
  }
}

export function kcalFact(energy: { balance: number; target: number } | null | undefined): IslandFact | null {
  if (energy == null) return null
  const b = Math.round(energy.balance)
  return {
    label: 'Energia-cél',
    value: String(Math.round(energy.target)),
    unit: 'kcal',
    delta: { text: `egyenleg ${b >= 0 ? '+' : MINUS}${Math.abs(b)}`, tone: 'muted' },
  }
}

export function dayBalance(growth: GrowthTodaySummary, dayXp: number): IslandFact {
  return {
    label: 'Nap mérlege',
    value: `+${dayXp}`,
    unit: 'XP',
    delta: { text: `${growth.done}/${growth.total} tétel ma`, tone: 'good' },
  }
}

export function sleepOutlook(goal: SleepGoal): IslandFact {
  return {
    label: 'Alvás-kilátás',
    value: hu(goal.targetMinutes / 60),
    unit: 'óra',
    delta: { text: `ha ${goal.bedTime}-kor lefekszel`, tone: 'muted' },
  }
}

/**
 * Countdown to lights-out. `minsToBed` wraps to [0, 1440), so a bed that
 * passed within the last 12 hours reads as a huge "time to next bed" —
 * that window IS the "elmúlt" state (night face).
 */
export function bedCountdown(now: Date, goal: { bedTime: string }): IslandHero {
  const m = minsToBed(now, goal.bedTime)
  if (m === 0 || m > 12 * 60) return { value: goal.bedTime, unit: 'elmúlt', sub: null }
  return { value: `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`, unit: 'a villanyoltásig', sub: null }
}
