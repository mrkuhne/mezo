// ============================================================
// Mezo · Titanium navigation model (mezo-jkh4)
// The owner-approved companion model: ONE domain-switch mark + the CURRENT
// domain's four contextual tabs, with per-domain last-tab memory. This module is
// the single source of truth for the 5×4 matrix (label → route → clay icon), the
// active-domain / active-tab derivation, and the in-session `navMemory` store —
// consumed by TabBar (the bar) and DomainSwitcher (the dialog).
//
// Frozen spec: docs/superpowers/specs/2026-09-11-titanium-nav-design.md
// Prior art: docs/design_2.0/prototypes/companion-titanium/navigation.js
//            (the `domains` object + `rememberRoute`; there memory keyed page
//             INDEX, here it keys the tab's full ROUTE).
// ============================================================
import type { ClayIconName } from '@/shared/ui/clay'

export interface NavTab {
  label: string
  route: string
  icon: ClayIconName
  /**
   * Deeper routes this tab OWNS, as path prefixes.
   *
   * Without it the active tab is the longest tab-route prefix, so any deep page that does not
   * live under its tab's own path falls back to the domain home and lights the WRONG tab —
   * `/fuel/recipes` lit „Mai" while the user was standing in Konyha (mezo-jb84). A deep page
   * should say where it belongs; this is where it says it.
   */
  owns?: string[]
}

export interface NavDomain {
  /** First path segment that selects this domain (`/nap`→nap, `/train`→train, …). */
  id: string
  /** The domain's display name — shown on the switch mark and in the switcher list. */
  name: string
  /** Exactly four contextual tabs, in bar order (tab 1 = the domain's home). */
  tabs: [NavTab, NavTab, NavTab, NavTab]
}

// The frozen 5×4 matrix. Every icon exists in the Titanium clay set (@/shared/ui/clay).
export const DOMAINS: NavDomain[] = [
  {
    id: 'nap',
    name: 'Nap',
    tabs: [
      { label: 'Mai', route: '/nap', icon: 'i-nap' },
      { label: 'Beszélgetés', route: '/nap/uzenetek', icon: 'i-mezo' },
      { label: 'Rutin', route: '/nap/rutin', icon: 'i-rend' },
      { label: 'Napzárás', route: '/ritual', icon: 'i-hold' },
    ],
  },
  {
    id: 'train',
    name: 'Edzés',
    tabs: [
      { label: 'Mai', route: '/train/mai', icon: 'i-edzes' },
      { label: 'Terhelés', route: '/train/week', icon: 'i-meso' },
      { label: 'Napló', route: '/train/gym', icon: 'i-naplo' },
      { label: 'Tervek', route: '/train/mesocycles', icon: 'i-retegek' },
    ],
  },
  {
    id: 'fuel',
    name: 'Fuel',
    tabs: [
      // A Fuel mély oldalai nem a fülük útvonala ALATT élnek (történeti route-ok), ezért
      // mindegyik megmondja, melyik fülhöz tartozik — különben a Mai gyullad ki alattuk.
      { label: 'Mai', route: '/fuel', icon: 'i-tanyer',
        owns: ['/fuel/log', '/fuel/etkezes', '/fuel/settings', '/fuel/slots'] },
      { label: 'Kiegészítők', route: '/fuel/stack', icon: 'i-kiegeszito',
        owns: ['/fuel/gyogyszer'] },
      { label: 'Trendek', route: '/fuel/trendek', icon: 'i-trend' },
      { label: 'Konyha', route: '/fuel/konyha', icon: 'i-fazek',
        owns: ['/fuel/recipes', '/fuel/kamra'] },
    ],
  },
  {
    id: 'mezo',
    name: 'Mezo',
    tabs: [
      { label: 'Felfedezések', route: '/mezo', icon: 'i-minta' },
      { label: 'Előrejelzések', route: '/mezo/predictions', icon: 'i-hajnal' },
      { label: 'Karakter', route: '/mezo/karakter', icon: 'i-kristaly' },
      { label: 'Tudástár', route: '/mezo/knowledge', icon: 'i-tudas' },
    ],
  },
  {
    id: 'me',
    name: 'Én',
    tabs: [
      { label: 'Áttekintés', route: '/me', icon: 'i-emberek' },
      { label: 'Súly', route: '/me/weight', icon: 'i-suly' },
      { label: 'Alvás', route: '/me/sleep', icon: 'i-alvas' },
      { label: 'Napló', route: '/me/naplo', icon: 'i-naplo' },
    ],
  },
]

/** The companion mark on the bar's switch button — always the Mezo mark, per the matrix. */
export const SWITCH_MARK: ClayIconName = 'i-mezo'

/** `route` is a prefix of `pathname` iff they're equal or `pathname` sits under `route/`. */
function isPrefix(route: string, pathname: string): boolean {
  return pathname === route || pathname.startsWith(route + '/')
}

/** The active domain = the first path segment mapped to a domain, else null. */
export function activeDomainId(pathname: string): string | null {
  const first = pathname.split('/').filter(Boolean)[0]
  return DOMAINS.some((d) => d.id === first) ? first : null
}

export function domainById(id: string | null): NavDomain | undefined {
  return DOMAINS.find((d) => d.id === id)
}

/**
 * The active tab within a domain = the tab whose route is the LONGEST prefix of the
 * pathname (so `/fuel/stack/manage` still lights Kiegészítők). Returns null when no
 * tab route matches — a domain sub-page that isn't one of the four keeps the bar with
 * no tab highlighted (e.g. `/train`, `/train/sport`).
 */
export function activeTabRoute(domain: NavDomain, pathname: string): string | null {
  // An explicitly OWNED deep route wins outright: it is a statement, not a guess, and it beats
  // the domain home that would otherwise win on prefix length alone.
  for (const tab of domain.tabs) {
    if (tab.owns?.some(prefix => isPrefix(prefix, pathname))) return tab.route
  }
  let best: string | null = null
  for (const tab of domain.tabs) {
    if (isPrefix(tab.route, pathname) && (best === null || tab.route.length > best.length)) {
      best = tab.route
    }
  }
  return best
}

// --- Last-tab memory (in-session, in-memory only — no localStorage, per spec) ---
const navMemory = new Map<string, string>()

/**
 * Record the current path as its domain's last-visited tab. Scans ALL domains for the
 * tab whose route is the longest prefix of `pathname` and stores it under that tab's
 * owning domain — so cross-domain routes (e.g. `/ritual` → Nap's Napzárás) are captured
 * too. A path matching no tab route leaves memory untouched.
 */
export function rememberRoute(pathname: string): void {
  let bestDomain: string | null = null
  let bestRoute: string | null = null
  for (const domain of DOMAINS) {
    for (const tab of domain.tabs) {
      if (isPrefix(tab.route, pathname) && (bestRoute === null || tab.route.length > bestRoute.length)) {
        bestDomain = domain.id
        bestRoute = tab.route
      }
    }
  }
  if (bestDomain && bestRoute) navMemory.set(bestDomain, bestRoute)
}

/** The route the switcher should jump to for a domain: its remembered tab, else tab 1. */
export function routeForDomain(domainId: string): string {
  const domain = domainById(domainId)
  if (!domain) return '/nap'
  return navMemory.get(domainId) ?? domain.tabs[0].route
}

/** Test-only: clear the in-session memory so cases don't leak state into each other. */
export function resetNavMemory(): void {
  navMemory.clear()
}
