import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { ClayIcon } from '@/shared/ui/clay'
import { DomainSwitcher } from '@/app/DomainSwitcher'
import {
  DOMAINS,
  SWITCH_MARK,
  activeDomainId,
  activeTabRoute,
  domainById,
  rememberRoute,
} from '@/app/navModel'

// Titanium navigation (mezo-jkh4): the bottom bar is a domain-switch mark (the Mezo
// companion mark + the CURRENT domain's name + a ⌃ caret) followed by that domain's
// FOUR contextual tabs. The active domain is the first path segment; the active tab is
// the longest-matching-prefix among the domain's four routes. Tapping the switch mark
// opens the domain-switcher dialog. Replaces the always-flat five-domain bar (d20.1.1).
export function TabBar() {
  const location = useLocation()
  const [switcherOpen, setSwitcherOpen] = useState(false)

  // Last-tab memory: record every navigation that lands on one of a domain's tab routes.
  useEffect(() => {
    rememberRoute(location.pathname)
  }, [location.pathname])

  const domainId = activeDomainId(location.pathname)
  // A path outside the five domain roots (only reached with the bar visible via an odd
  // deep link) falls back to Nap so the bar always renders a coherent domain.
  const domain = domainById(domainId) ?? DOMAINS[0]
  const activeRoute = activeTabRoute(domain, location.pathname)

  return (
    <>
      <nav className="tab-bar" aria-label={`${domain.name} menü`}>
        <button
          type="button"
          className="tab-item domain-switch np-press"
          aria-haspopup="dialog"
          aria-label={`Területváltó: ${domain.name}`}
          onClick={() => setSwitcherOpen(true)}
        >
          <span className="tab-ico"><ClayIcon name={SWITCH_MARK} size={27} /></span>
          <span className="domain-switch-name">
            {domain.name} <b aria-hidden="true">⌃</b>
          </span>
        </button>
        {domain.tabs.map((tab) => {
          const active = tab.route === activeRoute
          return (
            <Link
              key={tab.route}
              to={tab.route}
              className={cn('tab-item', active && 'active')}
              aria-current={active ? 'page' : undefined}
            >
              <span className="tab-ico"><ClayIcon name={tab.icon} size={27} /></span>
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </nav>
      {switcherOpen && (
        <DomainSwitcher currentDomainId={domainId} onClose={() => setSwitcherOpen(false)} />
      )}
    </>
  )
}
