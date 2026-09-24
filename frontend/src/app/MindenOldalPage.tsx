// ============================================================
// Mezo · „Minden oldal" — az oldal-leltár (mezo-ju4j6.17)
//
// The safety net for the tab restructuring (mezo-ju4j6 phases 5–7): every surface in
// the app, grouped the way the menu groups it, so a function cannot be lost while the
// menu around it is redrawn. Reached from the DomainSwitcher's bottom row, NOT from a
// fifth tab — the owner chose that placement (2026-09-18) so the four tabs keep their
// full width exactly while he is judging whether they are well divided.
//
// It lives in `app/` rather than a feature folder because it is a map OF the shell: its
// only inputs are `navModel` (the menu) and `pageIndex` (the leltár), and it must not
// acquire a dependency on any one feature.
//
// The grouping is DERIVED, never stored: `activeTabRoute()` is the same rule the TabBar
// uses to light a tab, so the leltár's headings and the bar can never disagree. Move a
// route between tabs and this page follows on the next render. A page under no tab lands
// in „Máshonnan elérhető" — the honest answer, and itself a useful signal while
// restructuring.
// ============================================================
import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { MozaikPage, PageBody, PageHead } from '@/shared/ui/mozaik'
import { ClayIcon } from '@/shared/ui/clay'
import { DOMAINS, activeTabRoute, type NavDomain } from '@/app/navModel'
import { PAGE_INDEX, type IndexedPage } from '@/app/pageIndex'

/** The §2.1 wash each domain's section wears — the same ramp the switcher cards use. */
const DOMAIN_WASH: Record<string, string> = {
  nap: 'gold', train: 'coral', fuel: 'sage', mezo: 'lav', me: 'rose',
}

/** Pages that belong to no tab still belong somewhere — and saying so is the point. */
const ORPHAN_GROUP = 'Máshonnan elérhető'

export interface PageGroup { heading: string; pages: IndexedPage[] }

/**
 * Splits a domain's pages into one group per tab, in bar order, then the leftovers.
 *
 * `activeTabRoute` is asked per page rather than the tab's `owns` list being read
 * directly, so `owns` precedence and the longest-prefix rule are honoured exactly once,
 * in the module that owns them.
 */
export function groupsForDomain(domain: NavDomain, pages: IndexedPage[]): PageGroup[] {
  const byTab = new Map<string, IndexedPage[]>()
  // A page can override its heading (`page.group`) when a tab OWNS it for navigation
  // purposes (so the bar lights the right tab) but it isn't really that tab's own page —
  // `/ritual`, owned by Rutin, files under „Napzárás" instead (mezo-yjzhw.4).
  const overrides = new Map<string, IndexedPage[]>()
  const orphans: IndexedPage[] = []
  for (const page of pages) {
    const tabRoute = activeTabRoute(domain, page.route)
    if (tabRoute === null) orphans.push(page)
    else if (page.group) overrides.set(page.group, [...(overrides.get(page.group) ?? []), page])
    else byTab.set(tabRoute, [...(byTab.get(tabRoute) ?? []), page])
  }
  const groups = domain.tabs
    .map((tab) => ({ heading: tab.label, pages: byTab.get(tab.route) ?? [] }))
    .filter((group) => group.pages.length > 0)
  for (const [heading, groupPages] of overrides) groups.push({ heading, pages: groupPages })
  if (orphans.length > 0) groups.push({ heading: ORPHAN_GROUP, pages: orphans })
  return groups
}

/**
 * The pages a domain owns: those under its own path, plus any cross-domain route one of
 * its tabs claims (`/ritual` is Nap's Napzárás). The second case is asked of
 * `activeTabRoute` rather than guessed from the path shape — that is the rule's job.
 */
export function pagesOfDomain(domainId: string): IndexedPage[] {
  const domain = DOMAINS.find((d) => d.id === domainId)
  if (!domain) return []
  return PAGE_INDEX.filter((page) => {
    const first = page.route.split('/').filter(Boolean)[0]
    if (first === domainId) return true
    const belongsToAnotherDomain = DOMAINS.some((d) => d.id === first)
    return !belongsToAnotherDomain && activeTabRoute(domain, page.route) !== null
  })
}

export default function MindenOldalPage() {
  const navigate = useNavigate()
  const { hash } = useLocation()

  // The switcher links here with the current domain as the hash, so the page opens where
  // the reader already was instead of at the top of a ~100-item list.
  useEffect(() => {
    if (!hash) return
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [hash])

  return (
    <MozaikPage tone="lav" className="mno-page">
      <PageHead onBack={() => navigate(-1)} />
      <PageBody>
        <header className="mno-head">
          <span className="mz-eyebrow">LELTÁR</span>
          <h1>Minden oldal</h1>
          <p>Az app {PAGE_INDEX.length} oldala, területenként, a menü szerinti bontásban.</p>
        </header>

        {DOMAINS.map((domain) => {
          const groups = groupsForDomain(domain, pagesOfDomain(domain.id))
          const count = groups.reduce((n, group) => n + group.pages.length, 0)
          return (
            <section key={domain.id} id={domain.id} className="mno-domain" data-wash={DOMAIN_WASH[domain.id]}>
              <div className="mno-domain-head">
                <ClayIcon name={domain.tabs[0].icon} size={34} />
                <strong>{domain.name}</strong>
                <small>{count} oldal</small>
              </div>
              {groups.map((group) => (
                <div key={group.heading} className="mno-group">
                  <h2>{group.heading}</h2>
                  <ul>
                    {group.pages.map((page) => (
                      <li key={page.route}>
                        <Link to={page.route}>
                          <b>{page.label}</b>
                          <small>{page.hint}</small>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )
        })}
        <section id="settings" className="mno-domain" data-wash="lav">
          <div className="mno-domain-head"><ClayIcon name="i-beallitas" size={34} /><strong>Beállítások</strong><small>{PAGE_INDEX.filter(p => p.route.startsWith('/settings')).length} oldal</small></div>
          <div className="mno-group"><h2>Közös beállítások</h2><ul>{PAGE_INDEX.filter(p => p.route.startsWith('/settings')).map(page => <li key={page.route}><Link to={page.route}><b>{page.label}</b><small>{page.hint}</small></Link></li>)}</ul></div>
        </section>
      </PageBody>
    </MozaikPage>
  )
}
