import { useEffect, useId, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { Boop, ClayIcon } from '@/shared/ui/clay'
import { DomainSwitcher } from '@/app/DomainSwitcher'
import {
  DOMAINS,
  activeDomainId,
  activeTabRoute,
  domainById,
  rememberRoute,
} from '@/app/navModel'

// Docked navigation (mezo-jkh4; re-skinned to the restored world in mezo-ju4j6.4 —
// style bible §7.4): the bottom bar is a domain-switch mark (the Mezo
// animated companion avatar) followed by that domain's
// FOUR contextual tabs. The active domain is the first path segment; the active tab is
// the longest-matching-prefix among the domain's four routes. Tapping the switch mark
// opens the domain-switcher dialog. Replaces the always-flat five-domain bar (d20.1.1).
export interface TabBarProps {
  /**
   * Per-tab-route dot flags (A napom, mezo-yjzhw.4): `dots['/nap/napom']` true renders a
   * small dot on that tab, telling the reader a fresh morning review is waiting without
   * making them open the page first. Keyed by the tab's own route, not the domain, so it
   * composes with any future per-tab signal without a shape change.
   */
  dots?: Partial<Record<string, boolean>>
}

export function TabBar({ dots }: TabBarProps = {}) {
  const location = useLocation()
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const dotIdBase = useId()

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
      {/* `train-tabs` anchors the Edzés kalauz's tab-row orientation card (fix round 1,
          mezo-88iwa.5): the négy fül itself has no page-level DOM of its own — this bar
          IS the négy fül, on every /train/* route. Scoped to the train domain only, so
          the other domains' bars don't spuriously satisfy the anchor lookup. */}
      {/* Üveg (bible §7.2, mezo-me75u.1): ONE floating `.glass` bar tinted by the active
          domain (`--c` from `[data-domain]`), and no sheen — a sweep through the always-visible
          menu reads as flicker (owner 2026-09-23). */}
      <nav className="tab-bar glass is-still" data-domain={domain.id} aria-label={`${domain.name} menü`} data-kalauz-anchor={domainId === 'train' ? 'train-tabs' : undefined}>
        <button
          type="button"
          className="tab-item domain-switch tab-boop np-press"
          aria-haspopup="dialog"
          aria-expanded={switcherOpen}
          aria-label={`Területváltó: ${domain.name}`}
          onClick={() => setSwitcherOpen(true)}
        >
          <span className="tab-ico"><Boop domain={domain.id} size={44} alive /></span>
        </button>
        {domain.tabs.map((tab, i) => {
          const active = tab.route === activeRoute
          // The dot is decoration; its meaning rides the link's DESCRIPTION (a visually-hidden
          // sibling), so the tab's accessible NAME stays exactly its label.
          const dotId = dots?.[tab.route] ? `${dotIdBase}-dot-${i}` : undefined
          return (
            <Link
              key={tab.route}
              to={tab.route}
              className={cn('tab-item', active && 'active')}
              aria-current={active ? 'page' : undefined}
              aria-describedby={dotId}
            >
              <span className="tab-ico">
                {dotId && <i className="tb-dot" aria-hidden="true" />}
                <ClayIcon name={tab.icon} size={27} />
              </span>
              <span>{tab.label}</span>
            </Link>
          )
        })}
        {domain.tabs.map((tab, i) => dots?.[tab.route] && (
          <span key={`dot-${tab.route}`} id={`${dotIdBase}-dot-${i}`} className="sr-only">kész a tegnapi értékelés</span>
        ))}
      </nav>
      {switcherOpen && (
        <DomainSwitcher currentDomainId={domainId} onClose={() => setSwitcherOpen(false)} />
      )}
    </>
  )
}
