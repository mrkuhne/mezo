import { useLocation, useNavigate } from 'react-router-dom'
import { canGoBack } from '@/shared/lib/backNav'

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
