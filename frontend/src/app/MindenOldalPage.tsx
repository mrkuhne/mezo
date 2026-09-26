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
import { useEffect, type CSSProperties } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { Boop, Icon3D } from '@/shared/ui/clay'
import { DOMAINS, activeTabRoute, type NavDomain } from '@/app/navModel'
import { PAGE_INDEX, type IndexedPage } from '@/app/pageIndex'

/** The §2.1 wash each domain's section wears — the same ramp the switcher cards use. */
const DOMAIN_WASH: Record<string, string> = {
  nap: 'gold', train: 'coral', fuel: 'sage', mezo: 'lav', me: 'rose',
}

/** Üveg (mezo-me75u.10): each domain card's ONE accent (`--c`), the bible §2 dark dv values. */
const DOMAIN_ACCENT: Record<string, string> = {
  nap: 'var(--dv-amber)', train: 'var(--dv-coral)', fuel: 'var(--dv-sage)', mezo: 'var(--dv-lav)', me: 'var(--dv-rose)',
}

/** One page of the leltár: a flat cell (label + hint + chevron) inside the domain's glass card. */
function PageLink({ page }: { page: IndexedPage }) {
  return (
    <li>
      <Link to={page.route} className="mno-l">
        <span className="mno-l-tx"><b>{page.label}</b><small>{page.hint}</small></span>
        <span className="mno-chev" aria-hidden="true">›</span>
      </Link>
    </li>
  )
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

  const settingsPages = PAGE_INDEX.filter((p) => p.route.startsWith('/settings'))

  return (
    <MozaikPage tone="lav" className="mno-page mno-u10">
      <PageHead glass label="Vissza" onBack={() => navigate(-1)} />
      <PageBody>
        <PageHero art="t-grid" accent="var(--dv-amber)" eyebrow="LELTÁR" name="Minden oldal"
          sub={`Az app ${PAGE_INDEX.length} oldala, területenként, a menü szerinti bontásban.`} />

        {DOMAINS.map((domain) => {
          const groups = groupsForDomain(domain, pagesOfDomain(domain.id))
          const count = groups.reduce((n, group) => n + group.pages.length, 0)
          return (
            <section key={domain.id} id={domain.id} className="mno-domain glass" data-wash={DOMAIN_WASH[domain.id]}
              style={{ '--c': DOMAIN_ACCENT[domain.id] } as CSSProperties}>
              <div className="mno-dh">
                <Boop domain={domain.id} size={44} />
                <strong>{domain.name}</strong>
                <small>{count} oldal</small>
              </div>
              {groups.map((group) => (
                <div key={group.heading} className="mno-group">
                  <h2>{group.heading}</h2>
                  <ul>{group.pages.map((page) => <PageLink key={page.route} page={page} />)}</ul>
                </div>
              ))}
            </section>
          )
        })}
        <section id="settings" className="mno-domain glass is-neutral" data-wash="lav">
          <div className="mno-dh">
            <span className="uv-well mno-well"><Icon3D name="t-gear" size={30} /></span>
            <strong>Beállítások</strong>
            <small>{settingsPages.length} oldal</small>
          </div>
          <div className="mno-group">
            <h2>Közös beállítások</h2>
            <ul>{settingsPages.map((page) => <PageLink key={page.route} page={page} />)}</ul>
          </div>
        </section>
      </PageBody>
    </MozaikPage>
  )
}
