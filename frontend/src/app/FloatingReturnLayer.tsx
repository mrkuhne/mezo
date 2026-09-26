// ============================================================
// Mezo · FloatingReturnLayer — the way back into a running gym session
// (mezo-78sd, reshaped by mezo-d20.1.1). Mounted once in AppLayout next to the
// TabBar; positioning lives in prototype.css (.float-stack / .float-return,
// z-index 45 — above the tab bar (40), below sheets (200+)).
//
// Design 2.0 decision B: the lavender chat bubble is retired — Mezo (chat) is a
// first-class tab now, and its old bottom-right spot belongs to the quick-log
// FAB (QuickLogFab). What remains here is session-return chrome only:
//   /me/sleep/night, /ritual   → nothing (deliberately chrome-free screens)
//   /mezo/chat                 → a coral "Vissza az edzéshez" bar above the
//                                composer while a workout is open; else nothing
//   everywhere else            → the coral resume FAB (done-set badge) stacked
//                                above the quick-log FAB while a workout is open
//
// Üveg U10 (mezo-me75u.10, prototype `.rfab` / `.rbar`): the FAB is a round coral glass
// (overflow visible, sheen off) carrying the 3D dumbbell — the meaning is "your workout", not
// "play" — with the done-set badge OUTSIDE the circle; the chat bar is a coral glass bar with a
// lit coral pill. Skin lives in the `uveg reteg ablak` block; positions stay in the old rules.
// ============================================================
import { useLocation, useNavigate } from 'react-router-dom'
import { Icon3D } from '@/shared/ui/clay'
import { useOpenWorkout } from '@/data/hooks'

/** Same exact-match list idea as AppLayout's `hideChrome` — these two screens are
 *  intentionally free of every piece of chrome (light discipline / ritual focus). */
const HIDDEN_ROUTES = ['/me/sleep/night', '/ritual']

export function FloatingReturnLayer() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { openWorkout, title, doneSets } = useOpenWorkout()

  if (HIDDEN_ROUTES.includes(pathname)) return null
  const inProgress = openWorkout !== null
  if (!inProgress) return null

  if (pathname === '/mezo/chat') {
    const meta = [title, doneSets > 0 ? `${doneSets} szett kész` : null].filter(Boolean).join(' · ')
    return (
      <button type="button" className="float-return glass is-still np-press" onClick={() => navigate('/train/session')}>
        <Icon3D name="t-dumbbell" size={30} />
        <span className="float-return-text">
          <span className="float-return-title">Vissza az edzéshez</span>
          {meta && <span className="float-return-meta">{meta}</span>}
        </span>
        <span className="float-return-go" aria-hidden="true">Vissza</span>
      </button>
    )
  }

  if (pathname === '/train/session') return null
  return (
    <div className="float-stack">
      <button
        type="button"
        className="float-fab float-fab-train glass is-round np-press"
        onClick={() => navigate('/train/session')}
        aria-label="Vissza az edzéshez"
      >
        <Icon3D name="t-dumbbell" size={34} />
        {doneSets > 0 && <span className="float-fab-badge" aria-hidden>{doneSets}</span>}
      </button>
    </div>
  )
}
