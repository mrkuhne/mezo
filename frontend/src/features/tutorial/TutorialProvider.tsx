// ============================================================
// Mezo · TutorialProvider — a Mezo-kalauz motorja (mezo-gb1s.1, spec §5–§7).
// Egy példány a shellben (AppLayout, a MezoThreadProvider mintája). Route-váltásra a
// registry-ből keres kalauzt; T1/T2 és nem-látott (verzió szerint) esetén az oldal belépő
// koreográfiája után (AUTO_DELAY_MS, reduced-motion alatt 0) megnyitja. „Látva" = MEGJELENT
// (Appcues modál-szabály): a seenAt a nyitáskor íródik, a Kihagyom/✕/Escape csak
// dismissedAtStep-et, az „Értem, kezdjük" completedAt-ot ad. Session-guard: egy kalauz egy
// app-sessionben legfeljebb egyszer ugrik fel magától (a backend-válasz késése ellen is).
// Írás-sorrend: localStorage + React-state azonnal → PUT a háttérben; PUT-hiba esetén a
// lokális marad az igazság. Beérkező szerver-állapot: merge (későbbi seenAt nyer), és ha a
// lokálisban több van, visszaírjuk — ez a „következő olvasásnál újrapróbál".
// ============================================================
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTutorialProgress, useTutorialProgressActions } from '@/data/hooks'
import type { TutorialProgress } from '@/data/types'
import { mergeProgress, readLocalProgress, writeLocalProgress } from '@/shared/lib/tutorialSeen'
import { KalauzSheet, type KalauzCloseReason } from '@/shared/ui/kalauz/KalauzSheet'
import { findKalauz, getKalauz, type KalauzEntry } from '@/features/tutorial/registry'

export const AUTO_DELAY_MS = 600

export interface TutorialContextValue {
  current: KalauzEntry | null
  openId: string | null
  open: (id: string) => void
  close: (reason: KalauzCloseReason, step: number) => void
  isUnseen: (id: string) => boolean
  resetAll: () => Promise<void>
}

const TutorialContext = createContext<TutorialContextValue | null>(null)

export function useTutorial(): TutorialContextValue {
  const v = useContext(TutorialContext)
  if (v === null) throw new Error('useTutorial: hiányzik a TutorialProvider')
  return v
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function TutorialProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { progress: serverProgress, isPending } = useTutorialProgress()
  const { setProgress, resetProgress } = useTutorialProgressActions()

  const [progress, setLocal] = useState<TutorialProgress>(() => readLocalProgress())
  const [openId, setOpenId] = useState<string | null>(null)
  const autoShown = useRef<Set<string>>(new Set())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Unstable-closure mirrors, assigned during render (no effect involved). `setProgress` is a
  // fresh closure every render (the hook doesn't memoize it). `progress` is mirrored too: any
  // callback that reads it must see the LATEST map, never the one from the render that created
  // the callback — otherwise a delayed setTimeout (the auto-open timer) or the route-change
  // effect can `persist()` a stale snapshot and clobber a server-merge write that landed in the
  // window between the callback being created and it actually running.
  const setProgressRef = useRef(setProgress)
  setProgressRef.current = setProgress
  const progressRef = useRef(progress)
  progressRef.current = progress

  // A lokális az igazság a PUT visszaérkezéséig; a szerver-állapot beolvad, a többlet visszaíródik.
  useEffect(() => {
    if (isPending) return
    setLocal((local) => {
      const merged = mergeProgress(serverProgress, local)
      // mergeProgress always builds a NEW object — bail out with the SAME reference when the
      // content didn't actually change, or the state "change" re-renders forever (new object
      // in, effect reruns, new object out, ...).
      if (JSON.stringify(merged) === JSON.stringify(local)) return local
      writeLocalProgress(merged)
      const localOnly = Object.keys(merged).some((k) => !(k in serverProgress) || serverProgress[k].seenAt !== merged[k].seenAt)
      if (localOnly) void setProgressRef.current(merged).catch(() => undefined)
      return merged
    })
  }, [serverProgress, isPending])

  // No deps beyond refs — `persist` never needs to change identity, so nothing downstream that
  // calls it needs to either.
  const persist = useCallback((next: TutorialProgress) => {
    setLocal(next)
    writeLocalProgress(next)
    void setProgressRef.current(next).catch(() => undefined) // PUT-hiba: a lokális marad; a következő merge újrapróbál
  }, [])

  const isUnseen = useCallback((id: string) => {
    const e = getKalauz(id)
    if (!e) return false
    const p = progressRef.current[id]
    return !p || p.version < e.version
  }, [])

  const open = useCallback((id: string) => {
    const e = getKalauz(id)
    if (!e) return
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    setOpenId(id)
    // Látva = megjelent. Frissebb verzió esetén új rekord, completedAt/dismissedAtStep nullázva.
    const map = progressRef.current
    const prev = map[id]
    if (!prev || prev.version < e.version) {
      persist({ ...map, [id]: { version: e.version, seenAt: new Date().toISOString(), completedAt: null, dismissedAtStep: null } })
    }
  }, [persist])

  const close = useCallback((reason: KalauzCloseReason, step: number) => {
    setOpenId((id) => {
      if (id === null) return null
      const map = progressRef.current
      const prev = map[id]
      if (prev) {
        persist({
          ...map,
          [id]: reason === 'done'
            ? { ...prev, completedAt: new Date().toISOString() }
            : { ...prev, dismissedAtStep: step },
        })
      }
      return null
    })
  }, [persist])

  const resetAll = useCallback(async () => {
    autoShown.current.clear()
    setLocal({})
    writeLocalProgress({})
    await resetProgress().catch(() => undefined)
  }, [resetProgress])

  const current = useMemo(() => findKalauz(pathname), [pathname])

  // `open`/`isUnseen` mirrors for the route effect below — same rationale as `setProgressRef`
  // above (brief's documented alternative to `eslint-disable-next-line react-hooks/exhaustive-deps`):
  // the auto-open decision is tied to the route-change MOMENT, so the effect's deps stay
  // `[pathname, current]` and the delayed timer callback reads `openRef.current` at fire time
  // instead of closing over the `open` from the render that scheduled it.
  const openRef = useRef(open)
  openRef.current = open
  const isUnseenRef = useRef(isUnseen)
  isUnseenRef.current = isUnseen

  // Route-váltás: nyitott kalauz zár (dismissed), és az új route auto-kalauza időzítve nyílik.
  useEffect(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    setOpenId((id) => {
      if (id !== null) {
        const map = progressRef.current
        const prev = map[id]
        if (prev && prev.completedAt === null && prev.dismissedAtStep === null) {
          persist({ ...map, [id]: { ...prev, dismissedAtStep: 0 } })
        }
      }
      return null
    })
    if (!current || current.tier === 'T3') return
    if (autoShown.current.has(current.id) || !isUnseenRef.current(current.id)) return
    const id = current.id
    timer.current = setTimeout(() => {
      timer.current = null
      autoShown.current.add(id) // csak akkor jelöljük "megpróbáltnak", ha ténylegesen kinyílt (StrictMode dupla-futás alatt a cleanup törli a timert, de az elmaradt fut sosem foglalja el a guardot)
      openRef.current(id)
    }, prefersReducedMotion() ? 0 : AUTO_DELAY_MS)
    return () => { if (timer.current) { clearTimeout(timer.current); timer.current = null } }
  }, [pathname, current, persist])

  const value = useMemo<TutorialContextValue>(
    () => ({ current, openId, open, close, isUnseen, resetAll }),
    [current, openId, open, close, isUnseen, resetAll],
  )
  const entry = openId ? getKalauz(openId) : null

  return (
    <TutorialContext.Provider value={value}>
      {children}
      {entry && (
        <KalauzSheet
          label={entry.label}
          cards={entry.cards}
          onClose={close}
          onNavigate={(to) => navigate(to)}
        />
      )}
    </TutorialContext.Provider>
  )
}
