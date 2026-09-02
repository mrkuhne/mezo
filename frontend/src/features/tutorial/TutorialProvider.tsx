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
  // `setProgress` is a fresh closure every render (the hook doesn't memoize it) — a ref
  // mirror keeps the sync effect below off that unstable reference, so it only reruns when
  // the SERVER state actually changes, not on every local render.
  const setProgressRef = useRef(setProgress)
  setProgressRef.current = setProgress

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

  const persist = useCallback((next: TutorialProgress) => {
    setLocal(next)
    writeLocalProgress(next)
    void setProgress(next).catch(() => undefined) // PUT-hiba: a lokális marad; a következő merge újrapróbál
  }, [setProgress])

  const isUnseen = useCallback((id: string) => {
    const e = getKalauz(id)
    if (!e) return false
    const p = progress[id]
    return !p || p.version < e.version
  }, [progress])

  const open = useCallback((id: string) => {
    const e = getKalauz(id)
    if (!e) return
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    setOpenId(id)
    // Látva = megjelent. Frissebb verzió esetén új rekord, completedAt/dismissedAtStep nullázva.
    const prev = progress[id]
    if (!prev || prev.version < e.version) {
      persist({ ...progress, [id]: { version: e.version, seenAt: new Date().toISOString(), completedAt: null, dismissedAtStep: null } })
    }
  }, [progress, persist])

  const close = useCallback((reason: KalauzCloseReason, step: number) => {
    if (openId === null) return
    const prev = progress[openId]
    if (prev) {
      persist({
        ...progress,
        [openId]: reason === 'done'
          ? { ...prev, completedAt: new Date().toISOString() }
          : { ...prev, dismissedAtStep: step },
      })
    }
    setOpenId(null)
  }, [openId, progress, persist])

  const resetAll = useCallback(async () => {
    autoShown.current.clear()
    setLocal({})
    writeLocalProgress({})
    await resetProgress().catch(() => undefined)
  }, [resetProgress])

  const current = useMemo(() => findKalauz(pathname), [pathname])

  // Route-váltás: nyitott kalauz zár (dismissed), és az új route auto-kalauza időzítve nyílik.
  useEffect(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    setOpenId((id) => {
      if (id !== null) {
        const prev = progress[id]
        if (prev && prev.completedAt === null && prev.dismissedAtStep === null) {
          persist({ ...progress, [id]: { ...prev, dismissedAtStep: 0 } })
        }
      }
      return null
    })
    if (!current || current.tier === 'T3') return
    if (autoShown.current.has(current.id) || !isUnseen(current.id)) return
    autoShown.current.add(current.id)
    const id = current.id
    timer.current = setTimeout(() => { timer.current = null; open(id) }, prefersReducedMotion() ? 0 : AUTO_DELAY_MS)
    return () => { if (timer.current) { clearTimeout(timer.current); timer.current = null } }
    // A `progress`/`open`/`isUnseen` szándékosan nincs a függőségek között: a döntés a
    // route-váltás PILLANATÁHOZ kötött, egy közbeni seen-frissítés nem indíthat új időzítőt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, current])

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
