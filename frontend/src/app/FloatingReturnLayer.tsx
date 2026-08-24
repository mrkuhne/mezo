// ============================================================
// Mezo · FloatingReturnLayer — quick two-way switching between a running gym
// session and the Mezo chat (mezo-78sd). Mounted once in AppLayout next to the
// TabBar; positioning lives in prototype.css (.float-stack / .float-return,
// z-index 45 — above the tab bar (40), below sheets (200+)).
//
// Route rules:
//   /me/sleep/night, /ritual   → nothing (deliberately chrome-free screens)
//   /insights/chat             → a coral "Vissza az edzéshez" bar above the
//                                composer while a workout is open; else nothing
//   /train/session             → the lavender chat bubble only, dropped to the
//                                corner (no tab bar, no docked bottom chrome there)
//   everywhere else            → the chat bubble always; the coral resume FAB
//                                (done-set badge) stacked above it while a
//                                workout is open
// ============================================================
import { useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '@/shared/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { useOpenWorkout } from '@/data/hooks'

/** Same exact-match list idea as AppLayout's hideTabBar — these two screens are
 *  intentionally free of every piece of chrome (light discipline / ritual focus). */
const HIDDEN_ROUTES = ['/me/sleep/night', '/ritual']

export function FloatingReturnLayer() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { openWorkout, title, doneSets } = useOpenWorkout()

  if (HIDDEN_ROUTES.includes(pathname)) return null
  const inProgress = openWorkout !== null

  if (pathname === '/insights/chat') {
    if (!inProgress) return null
    const meta = [title, doneSets > 0 ? `${doneSets} szett kész` : null].filter(Boolean).join(' · ')
    return (
      <button type="button" className="float-return np-press" onClick={() => navigate('/train/session')}>
        <Icon name="play" size={18} />
        <span className="float-return-text">
          <span className="float-return-title">Vissza az edzéshez</span>
          {meta && <span className="float-return-meta">{meta}</span>}
        </span>
        <span className="float-return-go"><Icon name="chevron-right" size={16} /></span>
      </button>
    )
  }

  const onSession = pathname === '/train/session'
  return (
    <div className={cn('float-stack', onSession && 'float-stack-session')}>
      {inProgress && !onSession && (
        <button
          type="button"
          className="float-fab float-fab-train np-press"
          onClick={() => navigate('/train/session')}
          aria-label="Vissza az edzéshez"
        >
          <Icon name="play" size={22} />
          {doneSets > 0 && <span className="float-fab-badge" aria-hidden>{doneSets}</span>}
        </button>
      )}
      <button
        type="button"
        className="float-fab float-fab-chat np-press"
        onClick={() => navigate('/insights/chat')}
        aria-label="Beszélgetés a társsal"
      >
        <Icon name="chat" size={22} />
      </button>
    </div>
  )
}
