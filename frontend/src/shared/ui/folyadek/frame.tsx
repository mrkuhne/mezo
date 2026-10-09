import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'

/** What the app frame shows for the page currently mounted. Pages set it; the frame (task 5) reads it. */
export interface FrameState { title?: string; eyebrow?: string; onBack?: () => void }

type Patch = (fn: (prev: FrameState) => FrameState) => void

const ValueCtx = createContext<FrameState | null>(null)
const SetCtx = createContext<Patch | null>(null)
const NONE: FrameState = {}
/** How many title bars are mounted under the provider, and the way a bar announces itself. */
const BarsCtx = createContext(0)
const SetBarsCtx = createContext<((fn: (n: number) => number) => void) | null>(null)

export function FrameProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FrameState>(NONE)
  const [bars, setBars] = useState(0)
  const value = useMemo(() => state, [state])
  return (
    <SetCtx.Provider value={setState}>
      <SetBarsCtx.Provider value={setBars}>
        <BarsCtx.Provider value={bars}>
          <ValueCtx.Provider value={value}>{children}</ValueCtx.Provider>
        </BarsCtx.Provider>
      </SetBarsCtx.Provider>
    </SetCtx.Provider>
  )
}

/** The title bar announces itself while mounted, so a page knows whether the shell draws its back
 *  control. A layout effect: the page below re-renders BEFORE paint, so its own fallback back
 *  button never flashes. No-op without a provider. */
export function useTitleBarMounted(): void {
  const set = useContext(SetBarsCtx)
  useLayoutEffect(() => {
    if (!set) return
    set((n) => n + 1)
    return () => set((n) => n - 1)
  }, [set])
}

/** True while a title bar is mounted under the nearest provider. Without a provider — a page
 *  rendered alone, or a chrome-free full-screen route — it is false, and the page keeps its own
 *  back control. */
export function useHasTitleBar(): boolean {
  return useContext(BarsCtx) > 0
}

/** The current frame values. Without a provider: always empty. */
export function useFrame(): FrameState {
  return useContext(ValueCtx) ?? NONE
}

/** Sets the frame title/eyebrow while the calling component is mounted; clears on unmount. No-op without a provider. */
export function useFrameTitle(o: { title?: string; eyebrow?: string }): void {
  const set = useContext(SetCtx)
  const { title, eyebrow } = o
  useEffect(() => {
    if (!set) return
    set((p) => ({ ...p, title, eyebrow }))
    return () => set((p) => (p.title === title && p.eyebrow === eyebrow ? { ...p, title: undefined, eyebrow: undefined } : p))
  }, [set, title, eyebrow])
}

/** Registers the back handler while mounted. The latest handler always runs (via a ref), so re-renders do not
 *  thrash the frame state. No-op without a provider. */
export function useFrameBack(fn?: () => void): void {
  const set = useContext(SetCtx)
  const ref = useRef(fn)
  ref.current = fn
  const stable = useCallback(() => ref.current?.(), [])
  const has = !!fn
  useEffect(() => {
    if (!set || !has) return
    set((p) => ({ ...p, onBack: stable }))
    return () => set((p) => (p.onBack === stable ? { ...p, onBack: undefined } : p))
  }, [set, has, stable])
}

/**
 * A page's own back button, handed to the shell. Inside the app frame the title bar draws the
 * back control and runs THIS handler, so the page draws nothing; where no title bar is mounted
 * (a chrome-free full-screen route, a page rendered alone) the page keeps its button exactly
 * as it was — `className`, label and glyph are the page's.
 */
export function FrameBack({ onBack, history = false, label = 'Vissza', className, children }: {
  onBack: () => void
  /** The handler is plain „go back in history" (`navigate(-1)`). It is then NOT handed to the
   *  frame: the title bar's own default applies — history when there is in-app history, else
   *  the page's fallback route — so back is never dead on a direct deep link. The handler still
   *  drives the page's own button where no title bar is mounted. */
  history?: boolean
  label?: string; className?: string; children?: ReactNode
}) {
  useFrameBack(history ? undefined : onBack)
  if (useHasTitleBar()) return null
  return <button type="button" className={className} onClick={onBack} aria-label={label}>{children}</button>
}
