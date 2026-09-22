import { Link, useLocation } from 'react-router-dom'
import { BOOP_DESTINATIONS } from '@/features/insights/logic/boopNavigation'
import '@/features/insights/boop-world.css'

/** Content is a page, not a menu stack. The dock remains owned by AppLayout. */
export function BoopNavigation() {
  const { pathname, search } = useLocation()
  const isContent = pathname.startsWith('/mezo/') || pathname.startsWith('/me/week')
  if (!isContent || ['/mezo/menu', '/mezo/rolad', '/mezo/emlekek', '/mezo/chat'].includes(pathname)) return null
  return (
    <nav className="boop-world-navigation" aria-label="Boop funkciók">
      <Link to="/mezo/menu" className="boop-world-menu-link">Összes funkció</Link>
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
