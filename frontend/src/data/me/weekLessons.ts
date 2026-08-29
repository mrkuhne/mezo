// ============================================================
// Mezo · A hét tanulságai — the weekly knowledge-candidate shape (mezo-d20.6.10)
//
// THE BACKEND DOES NOT PRODUCE THESE YET. F6.5 (handoff §6.2) is the slice that
// teaches `WeeklyReviewGenerator` to emit `candidateFacts` and adds the weekly
// read path. Until it lands the page must not lie: mock mode demos the finished
// end state, real mode fetches the (not-yet-existing) endpoint and renders the
// honest empty on its 404 — so the backend slice lights this page up WITHOUT the
// UI being touched again.
//
// The wire shape below is exactly the one handoff §6.2 specifies:
//   GET /api/proactive/weekly-review/{start}/lessons → FactCandidateResponse[]
//   + a nullable `evidence` line (§6.2/3), and `userDecision` already decided for
//   closed weeks (§6.2/2 — `listPending` only returns the undecided ones, the
//   design shows the decided state too).
// The DECISION write path is NOT new: it is the shipped candidate endpoint
//   POST /api/companion/fact/candidate/{id}/decision
// reached through `useKnowledgeActions().decide` (§6.2/9).
// ============================================================
import { addDays } from '@/shared/lib/dates'
import { mondayIso } from '@/data/fuel/fuelWeekHooks'
import type { FactCategory, FactDecision } from '@/data/types'

/** The `/lessons` wire row — `FactCandidateResponse` + the design's evidence line. */
export interface WeekLessonWire {
  id: string
  candidateText: string
  /** train | fuel | health | life */
  category: string
  /** The "mire épül" line the generator must name (§6.2/1, §6.2/3). Nullable. */
  evidence?: string | null
  /** accept | reject | refine | null — null = still open. */
  userDecision?: string | null
  refinedText?: string | null
  promotedFactId?: string | null
  createdAt?: string
}

/** FE domain row. `decision === null` is the only OPEN state. */
export interface WeekLesson {
  id: string
  text: string
  category: FactCategory
  evidence: string | null
  decision: FactDecision | null
}

const DECISIONS: readonly string[] = ['accept', 'reject', 'refine']

export function toWeekLesson(w: WeekLessonWire): WeekLesson {
  const d = w.userDecision
  return {
    id: w.id,
    // a refined candidate shows what the user actually taught, not the draft
    text: (w.refinedText ?? '').trim() !== '' ? (w.refinedText as string) : w.candidateText,
    category: w.category as FactCategory,
    evidence: (w.evidence ?? '').trim() !== '' ? (w.evidence as string) : null,
    decision: d != null && DECISIONS.includes(d) ? (d as FactDecision) : null,
  }
}

/** Prototype `W.w1.less`, verbatim (en-body.html) — three OPEN candidates with their
 *  evidence lines. The CURRENT week has none: the weekly pipeline only proposes from a
 *  CLOSED week, exactly like `mockWeeklyReview` returning null there. */
export function mockWeekLessons(startIso: string): WeekLesson[] {
  if (startIso === mondayIso()) return []
  const seed = addDays(startIso, 0).replaceAll('-', '')
  return [
    {
      id: `wl-${seed}-1`,
      text: 'Az edzésnapokat követő éjszakákon átlagosan 38 perccel többet alszol.',
      category: 'train',
      evidence: '5 hét · 14 edzésnap · konfidencia erős',
      decision: null,
    },
    {
      id: `wl-${seed}-2`,
      text: 'A 200 g feletti fehérje-napokon a check-in energiád átlaga 7,6 — alatta 6,4.',
      category: 'fuel',
      evidence: 'ez a hét + 3 előző · 19 nap',
      decision: null,
    },
    {
      id: `wl-${seed}-3`,
      text: 'Röplabda-esték után a lefekvésed 52 perccel tolódik.',
      category: 'health',
      evidence: '4 röplabda-este · gyűlik még',
      decision: null,
    },
  ]
}
