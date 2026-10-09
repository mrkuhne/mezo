import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

/** What the app frame shows for the page currently mounted. Pages set it; the frame (task 5) reads it. */
export interface FrameState { title?: string; eyebrow?: string; onBack?: () => void }

type Patch = (fn: (prev: FrameState) => FrameState) => void

const ValueCtx = createContext<FrameState | null>(null)
const SetCtx = createContext<Patch | null>(null)
const NONE: FrameState = {}

export function FrameProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FrameState>(NONE)
  const value = useMemo(() => state, [state])
  return (
    <SetCtx.Provider value={setState}>
      <ValueCtx.Provider value={value}>{children}</ValueCtx.Provider>
    </SetCtx.Provider>
  )
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
