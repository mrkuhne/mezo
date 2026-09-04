// ============================================================
// Mezo · Arrival mode (mezo-kuwj)
// "Did the user ARRIVE at this screen, or RETURN to it?"
//
// The Mozaik 2.0 entrance choreography is armed once per MOUNT (see motion.tsx),
// and react-router unmounts the previous page on every route change — so a back
// navigation (the browser/OS swipe-back gesture -> popstate) looks exactly like a
// first visit and the whole page fades in from opacity 0 again. That replay is
// what reads as the page "flashing / reloading" on swipe-back.
//
// The fix is to make the distinction explicit and let the motion primitives ask.
// It travels as a PLAIN React context, not a router hook at the leaves:
// `useNavigationType()` reads a `null`-defaulted context and therefore THROWS
// outside a <Router>, while `EntranceGroup` and the count-up hooks are unit-tested
// (and used inside portaled sheets) without one. The context defaults to 'push',
// so every such consumer keeps its existing animated behaviour untouched.
// ============================================================
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigationType } from 'react-router-dom'

/** 'pop' = the user came BACK (or forward) to a screen they have already seen. */
export type Arrival = 'push' | 'pop'

/** Defaults to 'push': outside the shell (router-less component tests, portaled
 *  sheets) nothing is a "return", so the choreography stays armed as before. */
const ArrivalContext = createContext<Arrival>('push')

/** The raw context — the shell uses `ArrivalProvider`; a consumer that needs to pin
 *  the mode without a <Router> (component tests) provides this directly. */
export { ArrivalContext }

/** Publishes the arrival mode of the CURRENT navigation. Mount it once, inside the
 *  Router and above every page (the app shell does this in `AppLayout`). */
export function ArrivalProvider({ children }: { children: ReactNode }) {
  const navigationType = useNavigationType()
  // `createBrowserHistory`/`createMemoryHistory` both start out with `action = "POP"`,
  // so the INITIAL document load reports POP just like a back navigation does. Only a
  // navigation that happened while the app was already running can be a return — hence
  // the first render is always an arrival, or the choreography would die on cold start.
  const navigatedRef = useRef(false)
  const arrival: Arrival = navigatedRef.current && navigationType === 'POP' ? 'pop' : 'push'
  useEffect(() => { navigatedRef.current = true }, [])
  return <ArrivalContext.Provider value={arrival}>{children}</ArrivalContext.Provider>
}

/** The current arrival mode — 'push' outside an `ArrivalProvider`. */
export function useArrival(): Arrival {
  return useContext(ArrivalContext)
}

/**
 * True when THIS component mounted as the result of a back/forward navigation, i.e. the
 * user is returning to a screen they have already seen and an entrance animation would be
 * a replay rather than an arrival.
 *
 * Snapshotted on mount deliberately: a later in-page change (a fresh water log bumping the
 * hero kcal, a daypart switch) must still animate, even though the navigation that brought
 * the user here was a POP.
 */
export function useSettledArrival(): boolean {
  const arrival = useArrival()
  const [settled] = useState(() => arrival === 'pop')
  return settled
}
