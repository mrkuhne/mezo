// ============================================================
// Mezo · FloatingReturnLayer — the way back into a running gym session
// (mezo-78sd, reshaped by mezo-d20.1.1; Folyadék look: mezo-n4wf5.4). Mounted once in AppLayout next to the
// BottomBar; positioning lives in styles/folyadek-edzes-kozben.css (`.ek-retwrap` / `.ek-retbar`).
//
// Design 2.0 decision B: the chat bubble is retired — Mezo (chat) is a first-class tab, and its old bottom-right spot
// belongs to the quick-log FAB (QuickLogFab). What remains here is session-return chrome only:
//   /me/sleep/night, /ritual   → nothing (deliberately chrome-free screens)
//   /mezo/chat                 → a „Vissza az edzéshez" bar above the composer while a workout is open; else nothing
//   everywhere else            → the return disc (`ReturnFab`: the Edzés liquid, the dumbbell, the done-set count)
//                                stacked above the quick-log FAB while a workout is open
// The disc and the bar wear the Edzés liquid on every domain: the meaning is „your workout", wherever you are.
// ============================================================
import { useLocation, useNavigate } from 'react-router-dom'
import { Bub } from '@/shared/ui/folyadek'
import { ReturnFab } from '@/features/train/components/folyadek'
import { useOpenWorkout } from '@/data/hooks'
import { useM } from '@/shared/i18n'

/** Same exact-match list idea as AppLayout's `hideChrome` — these two screens are
 *  intentionally free of every piece of chrome (light discipline / ritual focus). */
const HIDDEN_ROUTES = ['/me/sleep/night', '/ritual']

export function FloatingReturnLayer() {
  const { pathname } = useLocation()
  const t = useM().frame.returnBar
  const navigate = useNavigate()
  const { openWorkout, title, doneSets } = useOpenWorkout()

  if (HIDDEN_ROUTES.includes(pathname)) return null
  const inProgress = openWorkout !== null
  if (!inProgress) return null

  if (pathname === '/mezo/chat') {
    const meta = [title, doneSets > 0 ? t.setsDone(doneSets) : null].filter(Boolean).join(' · ')
    return (
      <button type="button" className="ek-retbar" onClick={() => navigate('/train/session')}>
        <Bub icon="t-dumbbell" size={36} />
        <span className="g">
          <strong>{t.title}</strong>
          {meta && <small>{meta}</small>}
        </span>
        <span className="go" aria-hidden="true">{t.go}</span>
      </button>
    )
  }

  if (pathname === '/train/session') return null
  return (
    <div className="ek-retwrap">
      <ReturnFab doneSets={doneSets} onClick={() => navigate('/train/session')} />
    </div>
  )
}
