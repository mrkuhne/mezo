import { useContext } from 'react'
import { UNSAFE_LocationContext, useLocation, useNavigate } from 'react-router-dom'
import {
  canGoBack, leaveAfterMutation, leaveBackAfterMutation, leaveDeletedFromEditor,
} from '@/shared/lib/backNav'

/**
 * Back to the PREVIOUS in-app page (history pop), with a fallback route for
 * deep links / hard reloads where this entry is the first in history
 * (React Router marks that state with location.key === 'default').
 * Full-screen sibling routes (session, review, builders) use this so a
 * Gym-launched session returns to Gym, a Mai-launched one to Mai (mezo-87d2).
 */
export function useBackNav(fallback: string): () => void {
  const navigate = useNavigate()
  const { key } = useLocation()
  return () => {
    // the shared decision (shared/lib/backNav.ts) — the same one the frame's title bar uses
    if (canGoBack(typeof window !== 'undefined' ? window.history.state : null, key)) navigate(-1)
    else navigate(fallback)
  }
}

export interface BackTarget {
  /** true = the control pops history (the user came from somewhere inside the app). */
  viaHistory: boolean
  /** What the control says: the neutral „Vissza" through history, the fallback's name otherwise. */
  label: string
  onBack: () => void
}

/**
 * „Vissza → ahonnan jöttél" (owner, 2026-09-24, mezo-me75u.13): the same history pop as
 * `useBackNav`, plus the LABEL the back control should wear. The origin of a history entry is
 * not knowable (the wall, a list, a room or a chat link all push plain paths), so a history pop
 * says the neutral „Vissza"; a direct open (first entry) names the fallback it goes to.
 *
 * Besides React Router's `key === 'default'`, the browser router's own `history.state.idx === 0`
 * also means "nothing in-app behind us": a list that redirects to a detail with `replace` on a
 * direct open leaves a non-default key on the FIRST entry, and popping there would leave the app.
 */
export function useBackTo(fallback: string, fallbackLabel: string): BackTarget {
  const navigate = useNavigate()
  const { key } = useLocation()
  const viaHistory = canGoBack(typeof window !== 'undefined' ? window.history.state : null, key)
  return {
    viaHistory,
    label: viaHistory ? 'Vissza' : fallbackLabel,
    onBack: () => {
      if (viaHistory) navigate(-1)
      else navigate(fallback)
    },
  }
}

/**
 * Leaving after a successful mutation (see `shared/lib/backNav.ts` for the rule):
 * - `to(target)` — the destination replaces the form / wizard / deleted record;
 * - `back(origin)` — an editor entered only from `origin` pops back onto it;
 * - `pastDetail(list)` — a delete from such an editor also drops the detail entry behind it.
 * The location key comes through the context (the `HistoryBackButton` idiom), so a page
 * rendered outside a router in a unit test is treated as a first entry.
 */
export function useLeaveAfterMutation(): {
  to: (target: string) => void
  back: (origin: string) => void
  pastDetail: (list: string) => void
} {
  const navigate = useNavigate()
  const key = useContext(UNSAFE_LocationContext)?.location.key ?? 'default'
  const state = () => (typeof window !== 'undefined' ? window.history.state : null)
  return {
    to: (target) => leaveAfterMutation(navigate, target),
    back: (origin) => leaveBackAfterMutation(navigate, state(), key, origin),
    pastDetail: (list) => leaveDeletedFromEditor(navigate, state(), list),
  }
}
