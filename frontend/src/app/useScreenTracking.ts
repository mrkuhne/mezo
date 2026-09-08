import { useContext, useEffect } from 'react'
import { UNSAFE_DataRouterStateContext, useLocation } from 'react-router-dom'
import { trackScreenView } from '@/data/telemetry/telemetryClient'

// Router-level screen tracking (bd mezo-o5cz, spec §6). Mounted ONCE per shell — AppLayout for
// the phone surface, AdminLayout for the desktop admin surface — because both are route ELEMENTS
// that mount once per session; a page under the Outlet would re-register on every navigation.

/** Looks like a param value rather than a route segment: uuid, number, or ISO date. */
const OPAQUE_SEGMENT = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+|\d{4}-\d{2}-\d{2})$/i

/**
 * Turns the concrete pathname back into its ROUTE PATTERN by substituting each matched param
 * value with `:name` (spec T3): `/admin/users/42` becomes `/admin/users/:id`.
 *
 * <p>Driven by the params the ROUTER itself resolved, so any value the router bound as a param is
 * replaced — a leaked id would have to be a segment the router never bound, which the
 * {@link scrubPathname} fallback below then catches anyway.
 */
export function routePatternOf(pathname: string, params: Record<string, string | undefined>): string {
  let pattern = pathname
  for (const [key, value] of Object.entries(params)) {
    if (!value) continue
    // The splat (`*`) param is a whole trailing path, not a single segment — collapse it to a
    // literal `*` so a 404-catchall never reports the URL the user actually typed.
    pattern = pattern.split(value).join(key === '*' ? '*' : `:${key}`)
  }
  return pattern
}

/**
 * Belt-and-braces: replaces every id-looking segment with `:id`, with no router knowledge at all.
 * Used when no data router is present (component tests render the layouts under a plain
 * `MemoryRouter`, which has no match state) — the point is that the NO-PATTERN path still cannot
 * emit a concrete id, rather than that it produces a perfectly faithful pattern.
 */
export function scrubPathname(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) => (OPAQUE_SEGMENT.test(segment) ? ':id' : segment))
    .join('/')
}

/**
 * Reports one `view` per route change. Never reports the concrete URL and never the query string
 * (`location.search` is not read at all) — only the pattern leaves the client.
 */
export function useScreenTracking(): void {
  const location = useLocation()
  // `useMatches()` would be the direct route to the leaf match — but it THROWS outside a data
  // router, and both shells are rendered under a plain `MemoryRouter` by their existing component
  // tests. Reading the same state optionally keeps telemetry from being able to crash a shell,
  // which is the whole posture of this feature.
  const routerState = useContext(UNSAFE_DataRouterStateContext)
  const matches = routerState?.matches ?? []
  const leaf = matches.length > 0 ? matches[matches.length - 1] : undefined
  const params = (leaf?.params ?? {}) as Record<string, string | undefined>
  const screen = leaf
    ? routePatternOf(location.pathname, params)
    : scrubPathname(location.pathname)

  useEffect(() => {
    trackScreenView(screen)
  }, [screen])
}
