import { useLocation, useNavigate } from 'react-router-dom'

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
    if (key !== 'default') navigate(-1)
    else navigate(fallback)
  }
}
