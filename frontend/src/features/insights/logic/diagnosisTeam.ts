/**
 * Kérdezd a csapatot (mezo-u3712) — the team reading of a diagnosis. Pure, derived labels only
 * (ADR 0049: nothing composed): who hosts a question (the catalog), who owns each suspect (its
 * metric's domain → the character registry), and today's remaining asks.
 */
import type { Diagnosis, DiagnosisSuspect } from '@/data/types'
import { hostOf } from '@/features/insights/logic/diagnosisCatalog'
import { TEAM, characterForMetricDomain, type TeamCharacterId } from '@/features/insights/logic/team'
import { localDateString } from '@/shared/lib/dates'

/** The backend's daily generation budget (`mezo.proactive.diagnosis` quota). The backend stays
 *  the authority — a 429 still maps to the quota copy; this only paints the line. */
export const DAILY_QUOTA = 3

export function suspectOwner(s: DiagnosisSuspect): TeamCharacterId {
  return characterForMetricDomain(s.domain ?? 'other')
}

/** The characters the host brought in: distinct suspect owners ≠ host, in rank order. */
export function guestsOf(d: Diagnosis): TeamCharacterId[] {
  const host = hostOf(d.phenomenon)
  const out: TeamCharacterId[] = []
  for (const s of [...d.suspects].sort((a, b) => a.rank - b.rank)) {
    const owner = suspectOwner(s)
    if (owner !== host && !out.includes(owner)) out.push(owner)
  }
  return out
}

function joinHu(names: string[]): string {
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} és ${names[names.length - 1]}`
}

/** „Mezo nézte meg · Szunya és Mocor segített" — or just the host when nobody helped. */
export function helpersLine(host: TeamCharacterId, guests: TeamCharacterId[]): string {
  const head = `${TEAM[host].name} nézte meg`
  return guests.length === 0 ? head : `${head} · ${joinHu(guests.map((g) => TEAM[g].name))} segített`
}

export function quotaLeft(diagnoses: Diagnosis[], now: Date = new Date()): number {
  const today = localDateString(now)
  const used = diagnoses.filter((d) => localDateString(new Date(d.generatedAt)) === today).length
  return Math.max(0, DAILY_QUOTA - used)
}

export function newestFirst(diagnoses: Diagnosis[]): Diagnosis[] {
  return [...diagnoses].sort((a, b) => (a.generatedAt < b.generatedAt ? 1 : a.generatedAt > b.generatedAt ? -1 : 0))
}
