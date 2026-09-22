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
import type { BoopDomain, ClayIconName } from '@/shared/ui/clay'

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
  /** First path segment that selects this domain (`/nap`→nap, `/train`→train, …).
   *  A típus a Boop-változatok uniója (mezo-ju4j6.15): a sáv és a területváltó a domain
   *  azonosítójából választ figurát, tehát egy ÚJ terület csak figurával együtt születhet —
   *  különben a sora némán, jel nélkül renderelne (ez történt az Én területével). */
  id: BoopDomain
  /** The domain's display name — accessible switch label and visible switcher list. */
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
      // Owner-approved four tabs (2026-09-12): sport/running are not a tab — logging
      // lives on Mai, plans on Terv, history beside the volume on Terhelés.
      { label: 'Mai', route: '/train/mai', icon: 'i-edzes',
        // `/train/sport` covers the full-screen sport-logging flow at `/train/sport/log`
        // too — `isPrefix` matches everything under the owned route (T8 Task 4).
        owns: ['/train/session', '/train/review', '/train/sport', '/train/custom'] },
      { label: 'Terv', route: '/train/mesocycles', icon: 'i-retegek',
        owns: ['/train/templates', '/train/futas'] },
      { label: 'Terhelés', route: '/train/week', icon: 'i-meso',
        // `/train/week/jelek` („Minden izomjel", parity P2 Task 1) would already win on
        // prefix — it is listed so the subpage SAYS where it belongs, the rule this
        // field exists for.
        owns: ['/train/gym', '/train/week/jelek'] },
      { label: 'Gyakorlatok', route: '/train/exercises', icon: 'i-naplo',
        // `/train/exercises/:key` (one exercise's story, parity P2) sits UNDER the tab
        // route, so the prefix rule would already light it — it is listed so the subpage
        // SAYS where it belongs, the same statement `/train/week/jelek` makes.
        owns: ['/train/medals', '/train/exercises'] },
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
      { label: 'Üzenőfal', route: '/mezo', icon: 'i-mezo', owns: ['/mezo/karakter/feed'] },
      { label: 'Menü', route: '/mezo/menu', icon: 'i-minta', owns: ['/mezo/patterns', '/mezo/predictions', '/mezo/diagnozis', '/mezo/experiments', '/mezo/coaching', '/mezo/karakter/gepterem', '/mezo/karakter/konzilium', '/mezo/karakter/csapat', '/mezo/memoria', '/mezo/chat'] },
      { label: 'Rólad', route: '/mezo/rolad', icon: 'i-kristaly', owns: ['/mezo/knowledge', '/mezo/karakter'] },
      { label: 'Emlékek', route: '/mezo/emlekek', icon: 'i-memoar', owns: ['/mezo/memoir'] },
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

/** A sáv váltó-gombjának jele. Visszaöltöztetés (mezo-ju4j6.15): a jel BOOP, az aktuális
 *  terület színében — a `TabBar` a domain id-ből választ változatot, ezért itt nincs több
 *  fix ikonnév. A konstans azért marad, mert a régi Mezo-jel a NÉVSORBAN (Beszélgetés fül)
 *  továbbra is él, és több teszt erre a névre hivatkozik. */
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
 * no tab highlighted. Train Titanium T4 (2026-09-12) gave every Train deep route an
 * explicit `owns` entry, so `/train/sport` now lights Mai rather than falling through
 * here — the only Train path this still applies to is the bare `/train` itself
 * (its tab is `/train/mai`, not `/train`), and that path never actually renders the
 * bar: `TrainIndex` (`router.tsx`) redirects it to `/train/mai` before paint.
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
  const currentDomain = domainById(activeDomainId(pathname))
  const ownedRoute = currentDomain ? activeTabRoute(currentDomain, pathname) : null
  if (currentDomain && ownedRoute) {
    navMemory.set(currentDomain.id, ownedRoute)
    return
  }
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
