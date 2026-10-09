// ============================================================
// Mezo · Titanium navigation model (mezo-jkh4)
// The owner-approved companion model: ONE domain-switch mark + the CURRENT
// domain's four contextual tabs, with per-domain last-tab memory. This module is
// the single source of truth for the 5×4 matrix (label → route → clay icon), the
// active-domain / active-tab derivation, and the in-session `navMemory` store —
// consumed by the Folyadék frame (mezo-n4wf5.1): BottomBar (the five domains, always),
// TopTabs (the active domain's four pages as pills) and TitleBar (`frameFor`: what the
// title bar says for a path — hub or sub-page, title, context line, back fallback).
//
// Frozen spec: docs/superpowers/specs/2026-09-11-titanium-nav-design.md
// Prior art: docs/design_2.0/prototypes/companion-titanium/navigation.js
//            (the `domains` object + `rememberRoute`; there memory keyed page
//             INDEX, here it keys the tab's full ROUTE).
// ============================================================
import type { BoopDomain, ClayIconName } from '@/shared/ui/clay'
import { PAGE_INDEX } from '@/app/pageIndex'

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
  /** The page TITLE in the title bar when it differs from the tab label (Folyadék frame,
   *  mezo-n4wf5.1): a domain's first tab is labelled „Mai" but its page is titled „Ma" /
   *  „Edzés" / „Fuel". Absent = the label is the title. */
  title?: string
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
      { label: 'Mai', route: '/nap', icon: 'i-nap', title: 'Ma' },
      // A napom (mezo-yjzhw.4, owner decision 2026-09-24): replaces the retired Napzárás
      // tab — the day's own reading + next action, not just the evening close. `/ritual`
      // itself survives as a reachable page (Rutin's evening row, the leltár, later a
      // Mai evening card); the Rutin tab OWNS it so the page index files it correctly.
      { label: 'A napom', route: '/nap/napom', icon: 'i-heti' },
      { label: 'Beszélgetés', route: '/nap/uzenetek', icon: 'i-mezo' },
      { label: 'Rutin', route: '/nap/rutin', icon: 'i-rend', owns: ['/ritual'] },
    ],
  },
  {
    id: 'train',
    name: 'Edzés',
    tabs: [
      // Owner-approved four tabs (2026-09-12): sport/running are not a tab — logging
      // lives on Mai, plans on Terv, history beside the volume on Terhelés.
      { label: 'Mai', route: '/train/mai', icon: 'i-edzes', title: 'Edzés',
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
      { label: 'Mai', route: '/fuel', icon: 'i-tanyer', title: 'Fuel',
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
      // Csapat-üzenőfal (mezo-a9bo7.10, spec §2.5): the dock is Üzenőfal · A csapat · Rólad ·
      // Emlékek. „A kijelölés nem ugrál": every page a POST opens into (records, their lists,
      // the reply chat) stays under Üzenőfal; the team's own rooms and the machinery behind
      // them (konzílium, Gépterem + its „Összes funkció” grid, memória) stay under A csapat.
      { label: 'Üzenőfal', route: '/mezo', icon: 'i-mezo', title: 'Üzenőfal',
        owns: ['/mezo/karakter/feed', '/mezo/patterns', '/mezo/predictions', '/mezo/experiments',
          '/mezo/coaching', '/mezo/chat'] },
      { label: 'A csapat', route: '/mezo/csapat', icon: 'i-emberek',
        // Kérdezd a csapatot (mezo-u3712): the Diagnózis page is entered from A csapat.
        owns: ['/mezo/karakter/gepterem', '/mezo/karakter/konzilium',
          '/mezo/memoria', '/mezo/diagnozis'] },
      { label: 'Rólad', route: '/mezo/rolad', icon: 'i-kristaly', owns: ['/mezo/knowledge', '/mezo/karakter'] },
      { label: 'Emlékek', route: '/mezo/emlekek', icon: 'i-memoar', owns: ['/mezo/memoir'] },
    ],
  },
  {
    id: 'me',
    name: 'Én',
    tabs: [
      // Én IA (mezo-lhqw7, owner 2026-09-28): the hub answers „Hol tartok"; the week family,
      // Fejlődés and Emberek are its deep pages. `/me/ertesitesek` is entered from the header
      // bell only — it is filed here so the lit tab is a statement, not a prefix guess.
      { label: 'Hol tartok', route: '/me', icon: 'i-emberek', title: 'Én',
        owns: ['/me/week', '/me/growth', '/me/people', '/me/ertesitesek'] },
      // Test = Súly + Alvás under one tab. The two pages keep their URLs (deep links from
      // habitAction/questAction/push stay valid); the tab home is Súly (owner decision 6).
      { label: 'Test', route: '/me/weight', icon: 'i-suly', owns: ['/me/sleep'] },
      { label: 'Célok', route: '/me/goals', icon: 'i-cel' },
      { label: 'Napló', route: '/me/naplo', icon: 'i-naplo' },
    ],
  },
]

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

// --- The Folyadék frame (mezo-n4wf5.1): what the title bar says for a path ---

export interface Frame {
  /** The domain whose colour the frame wears (Nap outside the five domains). */
  domain: NavDomain
  /** The tab that owns the path, or null (outside the domains, or a path no tab owns). */
  tab: NavTab | null
  /** A hub = the path IS one of the domain's four tab routes: big title, five buttons, top tabs.
   *  Everything else is a sub-page: back · title · bell, no top tabs. */
  isHub: boolean
  title: string
  /** The context line above the title: the date on a hub, „Terület · Fül" on a sub-page. */
  eyebrow: string
  /** Where the back button goes when there is no history to go back to. */
  fallback: string
}

const HU_LONG_DATE = new Intl.DateTimeFormat('hu-HU', { weekday: 'long', month: 'long', day: 'numeric' })

/** „Szerda, október 7." — the hub's context line. */
export function frameDate(today: Date): string {
  const s = HU_LONG_DATE.format(today) // „október 7., szerda"
  const [monthDay, weekday] = s.split(', ')
  const text = weekday ? `${weekday}, ${monthDay}` : s
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** The leltár label of the page whose route is the LONGEST prefix of the path, if any. */
function indexedLabel(pathname: string): string | null {
  let best: { route: string; label: string } | null = null
  for (const page of PAGE_INDEX) {
    if (isPrefix(page.route, pathname) && (best === null || page.route.length > best.route.length)) best = page
  }
  return best?.label ?? null
}

export function frameFor(pathname: string, today: Date): Frame {
  const domain = domainById(activeDomainId(pathname))
  if (!domain) {
    // Outside the five domains the frame wears Nap's colour and is always a sub-page.
    const map = isPrefix('/minden', pathname)
    return {
      domain: DOMAINS[0], tab: null, isHub: false,
      title: indexedLabel(pathname) ?? (map ? 'Minden oldal' : 'Beállítások'),
      eyebrow: map ? 'Az app térképe' : 'Beállítások',
      fallback: '/nap',
    }
  }
  const tabRoute = activeTabRoute(domain, pathname)
  const tab = domain.tabs.find((t) => t.route === tabRoute) ?? null
  const isHub = domain.tabs.some((t) => t.route === pathname)
  if (isHub && tab) {
    return { domain, tab, isHub: true, title: tab.title ?? tab.label, eyebrow: frameDate(today), fallback: tab.route }
  }
  return {
    domain, tab, isHub: false,
    title: indexedLabel(pathname) ?? tab?.label ?? domain.name,
    eyebrow: tab ? `${domain.name} · ${tab.label}` : domain.name,
    fallback: tab?.route ?? domain.tabs[0].route,
  }
}
