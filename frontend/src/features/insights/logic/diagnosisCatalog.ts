import type { TeamCharacterId } from '@/features/insights/logic/team'

/**
 * The diagnosis question catalog (mezo-po3y) — the FE face of the backend's DiagnosisRecipe
 * list. A new live question is one entry here (+ its backend recipe); it leaves UPCOMING by
 * arriving in LIVE_QUESTIONS.
 *
 * Kérdezd a csapatot (mezo-u3712, owner decision 2026-09-26): every question has a HOST — the
 * team character whose area it belongs to. Fatigue spans several areas, so Mezo (the team's
 * convenor) hosts it. `blurb` is the one-line row copy, `window` + `looks` feed the ask sheet.
 */
export interface DiagnosisQuestion {
  phenomenon: string
  question: string
  host: TeamCharacterId
  blurb: string
  /** The ask sheet's „Ezt nézi meg:" sentence — what window the recipe reads. */
  window: string
  /** The ask sheet's chips — the areas the recipe compares. */
  looks: string[]
  /** Week-anchored (weight, mezo-85x5r): the ask sheet offers a week picker. */
  weekAnchored?: boolean
}

export const LIVE_QUESTIONS: DiagnosisQuestion[] = [
  {
    phenomenon: 'fatigue',
    question: 'Miért vagyok fáradt?',
    host: 'mezo',
    blurb: 'Több terület együtt — alvás, energia, terhelés, étkezés',
    window: 'az utolsó 14 nap, összevetve az előző négy héttel',
    looks: ['alvás', 'energia', 'terhelés', 'étkezés'],
  },
  {
    phenomenon: 'sleep',
    question: 'Miért alszom rosszul?',
    host: 'szunya',
    blurb: 'Késői evés, esti stressz, terhelés, lefekvés-szórás',
    window: 'az utolsó 14 nap',
    looks: ['alvás', 'késői evés', 'esti stressz', 'lefekvés ideje'],
  },
  {
    phenomenon: 'weight',
    question: 'Miért mozog a súlyom?',
    host: 'deru',
    blurb: 'Egy hét súly-mozgása: mennyi szövet, mennyi víz',
    window: 'a kiválasztott hét',
    looks: ['mérések', 'kalória', 'só és szénhidrát', 'edzés'],
    weekAnchored: true,
  },
]

export interface UpcomingQuestion {
  question: string
  host: TeamCharacterId
}

export const UPCOMING_QUESTIONS: UpcomingQuestion[] = [
  { question: 'Kell most deload?', host: 'mocor' },
  { question: 'Havi Mezo Riport', host: 'mezo' },
]

/** phenomenon → its catalog entry, or undefined for an unknown wire value. */
export function questionFor(phenomenon: string): DiagnosisQuestion | undefined {
  return LIVE_QUESTIONS.find((q) => q.phenomenon === phenomenon)
}

/** phenomenon → the question title (the detail hero); falls back to the wire value. */
export function questionOf(phenomenon: string): string {
  return questionFor(phenomenon)?.question ?? phenomenon
}

/** phenomenon → its host character; an unknown phenomenon is the team's (Mezo). */
export function hostOf(phenomenon: string): TeamCharacterId {
  return questionFor(phenomenon)?.host ?? 'mezo'
}
