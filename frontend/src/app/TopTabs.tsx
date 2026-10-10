// ============================================================
// Mezo · Folyadék frame — the top tabs (mezo-n4wf5.1, owner-approved 2026-10-09)
//
// The active domain's four pages as pill links under the title. Only on a HUB — a path that
// IS one of the four tab routes; a sub-page has a back button instead and no tabs.
// Carries the two tab marks the old bottom bar and header carried: the „A napom" morning dot
// (`dots`, decided in AppLayout) and the unread count of the Mezo thread on „Beszélgetés".
//
// Look: docs/design_2.0/prototypes/vilagos/kit.js `top(d,o)` (`.fh-tabs`); CSS `.fo-tabs`
// in styles/folyadek-frame.css.
// ============================================================
import { useId } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { useMezoThread } from '@/features/today/MezoThreadProvider'
import { activeDomainId, activeTabRoute, domainById, isHubPath } from '@/app/navModel'

/** The tab whose pill carries the Mezo thread's unread count. */
const THREAD_TAB = '/nap/uzenetek'

export interface TopTabsProps {
  /**
   * Per-tab-route dot flags (A napom, mezo-yjzhw.4): `dots['/nap/napom']` true renders a small
   * dot on that tab, telling the reader a fresh morning review is waiting without making them
   * open the page first. Keyed by the tab's own route.
   */
  dots?: Partial<Record<string, boolean>>
}

export function TopTabs({ dots }: TopTabsProps = {}) {
  const { pathname } = useLocation()
  const { unread } = useMezoThread()
  const idBase = useId()
  const domain = domainById(activeDomainId(pathname))
  if (!domain || !isHubPath(domain, pathname)) return null
  const activeRoute = activeTabRoute(domain, pathname)
  return (
    // `train-tabs` anchors the Edzés kalauz's tab-row orientation card (mezo-88iwa.5): this
    // strip IS the négy fül. Scoped to the train domain so the other domains' strips do not
    // spuriously satisfy the anchor lookup.
    <nav className="fo-tabs" aria-label={`${domain.name} oldalai`}
      data-kalauz-anchor={domain.id === 'train' ? 'train-tabs' : undefined}>
      {domain.tabs.map((tab, i) => {
        const active = tab.route === activeRoute
        const dot = !!dots?.[tab.route]
        const count = tab.route === THREAD_TAB ? unread : 0
        // The marks are decoration; their meaning rides the link's DESCRIPTION (a visually
        // hidden sibling), so the tab's accessible NAME stays exactly its label.
        const markId = dot || count > 0 ? `${idBase}-m${i}` : undefined
        return (
          <Link key={tab.route} to={tab.route} className={cn(active && 'on')}
            aria-current={active ? 'page' : undefined} aria-describedby={markId}>
            {tab.label}
            {dot && <i className="td" aria-hidden="true" />}
            {count > 0 && <b className="tn" aria-hidden="true">{count}</b>}
          </Link>
        )
      })}
      {domain.tabs.map((tab, i) => {
        const dot = !!dots?.[tab.route]
        const count = tab.route === THREAD_TAB ? unread : 0
        if (!dot && count === 0) return null
        return (
          <span key={`m-${tab.route}`} id={`${idBase}-m${i}`} className="sr-only">
            {dot ? 'kész a tegnapi értékelés' : `${count} olvasatlan`}
          </span>
        )
      })}
    </nav>
  )
}
