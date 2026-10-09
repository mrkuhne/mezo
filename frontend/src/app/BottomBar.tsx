// ============================================================
// Mezo · Folyadék frame — the bottom bar (mezo-n4wf5.1, owner-approved 2026-10-09)
//
// The five domains, ALWAYS: five drops, the active one fuller and alive. It replaces the old
// contextual bar (one domain-switch mark + the current domain's four tabs) and with it the
// domain-switcher dialog — the four pages of the active domain moved to the top (TopTabs).
// Tapping a drop goes to that domain's last-visited tab, else its tab 1 (navModel memory).
//
// Look: docs/design_2.0/prototypes/vilagos/kit.js `nav(d)`; CSS `.fo-nav` in
// styles/folyadek-frame.css.
// ============================================================
import { useEffect, type CSSProperties } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { Drop } from '@/shared/ui/folyadek'
import { DOMAINS, activeDomainId, rememberRoute, routeForDomain } from '@/app/navModel'

/** The drop colour of each domain (kit.js `DOM`). */
export const DOMAIN_COLOR: Record<string, string> = {
  nap: '#1F6FEB', train: '#F26A3D', fuel: '#1E9E6A', mezo: '#6D5BD0', me: '#0E9AA7',
}
/** The resting level of each drop (kit.js `FILL`); the active one stands at 86. */
export const REST_FILL: Record<string, number> = { nap: 70, train: 34, fuel: 62, mezo: 50, me: 58 }

/** The drop of one domain in the bar: size + level. ONE recipe — the opening animation reuses it. */
export function navDropSpec(id: string, active: boolean) {
  return { pct: active ? 86 : REST_FILL[id], color: DOMAIN_COLOR[id], size: active ? 40 : 34 }
}

export function BottomBar() {
  const { pathname } = useLocation()
  // Last-tab memory: record every navigation that lands on (or under) one of a domain's tabs.
  useEffect(() => { rememberRoute(pathname) }, [pathname])
  // A path outside the five domain roots lights Nap, so the bar always shows a coherent state.
  const active = activeDomainId(pathname) ?? 'nap'
  return (
    <nav className="fo-nav" aria-label="Területek">
      {DOMAINS.map((d) => (
        <Link key={d.id} to={routeForDomain(d.id)} className={cn('fo-nav-item', d.id === active && 'on')}
          aria-current={d.id === active ? 'true' : undefined} data-domain={d.id}
          style={{ '--c': DOMAIN_COLOR[d.id] } as CSSProperties}>
          <Drop {...navDropSpec(d.id, d.id === active)} alive={d.id === active} />
          <span>{d.name}</span>
        </Link>
      ))}
    </nav>
  )
}
