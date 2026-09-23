import { Link, useLocation } from 'react-router-dom'
import { ALL_FEATURES_ROUTE, BOOP_DESTINATIONS } from '@/features/insights/logic/boopNavigation'
import '@/features/insights/boop-world.css'

/** Content is a page, not a menu stack. The dock remains owned by AppLayout. */
export function BoopNavigation() {
  const { pathname, search } = useLocation()
  const isContent = pathname.startsWith('/mezo/') || pathname.startsWith('/me/week')
  if (!isContent || [ALL_FEATURES_ROUTE, '/mezo/rolad', '/mezo/emlekek', '/mezo/chat'].includes(pathname)) return null
  // The team's rooms are the new world (mezo-a9bo7.10): the approved prototype has no chip strip
  // there — the dock and the room's own „Gépterem · Összes funkció” door carry the way out.
  if (pathname === '/mezo/csapat' || pathname.startsWith('/mezo/csapat/')) return null
  return (
    <nav className="boop-world-navigation" aria-label="Boop funkciók">
      <Link to={ALL_FEATURES_ROUTE} className="boop-world-menu-link">Összes funkció</Link>
      <div>
        {BOOP_DESTINATIONS.filter(item => item.primary).map(item => (
          <Link key={item.to} to={item.to + (item.to === '/me/week' && pathname.startsWith('/me/week') ? search : '')}
            aria-current={pathname === item.to || pathname.startsWith(item.to + '/') ? 'page' : undefined}>
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
