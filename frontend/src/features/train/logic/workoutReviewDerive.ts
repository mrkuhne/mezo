// ============================================================
// Mezo · workoutReviewDerive (mezo-n4wf5.4, Folyadék F4) — the small pure derivations the approved
// review / ceremony drawings need on top of what the pages already load. No fetching, no UI.
// ============================================================
import type { Challenge } from '@/data/types'
import { setStatus } from '@/features/train/logic/workoutCardMeta'

/** The previous instance's done sets per exercise name (from `refStats.exercises` on the review page) —
 *  the review hero's dashed line. */
export function prevDoneByName(ref: ReadonlyArray<{ name: string; doneSets: number }> | null | undefined): Record<string, number> {
  const out: Record<string, number> = {}
  for (const e of ref ?? []) out[e.name] = e.doneSets
  return out
}

/** Where the dashed line stands in TODAY's vessel: the previous done sets as a 0–1 share of today's
 *  planned sets (capped at the rim). Null = no line (no reference for this exercise, or nothing planned). */
export function prevDoneLine(prevDone: number | undefined, plannedToday: number): number | null {
  if (prevDone == null || !(plannedToday > 0)) return null
  return Math.min(1, Math.max(0, prevDone / plannedToday))
}

export type SetBandKey = 'in' | 'below' | 'above' | 'warmup'
const BAND_WORD: Record<SetBandKey, string> = { in: 'célsávban', below: 'cél alatt', above: 'cél fölött', warmup: 'bemelegítő' }

/** The word for a logged set against its exercise's rep range (the same rule as the session's
 *  verdict mark, `setStatus`). Null when the exercise carries no range. */
export function setBand(
  range: { repMin?: number | null; repMax?: number | null },
  set: { reps: number; warmup?: boolean },
): { key: SetBandKey; word: string } | null {
  if (set.warmup) return { key: 'warmup', word: BAND_WORD.warmup }
  if (range.repMin == null || range.repMax == null) return null
  const status = setStatus({ repMin: range.repMin, repMax: range.repMax }, { reps: set.reps, kind: 'working' })
  const key: SetBandKey = status === 'ok' ? 'in' : status
  return { key, word: BAND_WORD[key] }
}

export type QuestState = 'hit' | 'miss' | 'inconclusive' | 'skipped'
export interface QuestRow {
  id: string
  /** The type's label without pictographs. */
  typeLabel: string
  exercise?: string
  /** The server's outcome sentence when there is one, else the target. */
  detail: string
  state: QuestState
  label: string
  /** `ok` = it earned its colour; `q` = quiet (the report never punishes). */
  tone: 'ok' | 'q'
}

const QUEST_COPY: Record<QuestState, { label: string; tone: 'ok' | 'q' }> = {
  hit: { label: 'megvan', tone: 'ok' },
  miss: { label: 'nem jött össze', tone: 'q' },
  inconclusive: { label: 'nem értékelhető', tone: 'q' },
  skipped: { label: 'nem vállaltad', tone: 'q' },
}

const clean = (label: string) => label.replace(/[\p{Extended_Pictographic}️‍]/gu, '').trim()

/** Every quest of the day as a row, the ones never taken included („nem vállaltad"). An accepted
 *  quest the server has not judged is „nem értékelhető" — it WAS taken, so it cannot read as not taken. */
export function questRows(challenges: readonly Challenge[]): { rows: QuestRow[]; hit: number; rest: number } {
  const rows = challenges.map((c): QuestRow => {
    const state: QuestState = c.status === 'hit' || c.status === 'miss' || c.status === 'inconclusive'
      ? c.status
      : c.status === 'accepted' ? 'inconclusive' : 'skipped'
    return { id: c.id, typeLabel: clean(c.typeLabel), exercise: c.exercise, detail: c.outcome ?? c.target, state, ...QUEST_COPY[state] }
  })
  const hit = rows.filter((r) => r.state === 'hit').length
  return { rows, hit, rest: rows.length - hit }
}
