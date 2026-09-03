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
import { KalauzWelcome } from '@/shared/ui/kalauz/KalauzWelcome'
import { findKalauz, getKalauz, versionOf, type KalauzEntry } from '@/features/tutorial/registry'
import { WELCOME, WELCOME_ID, WELCOME_VERSION } from '@/features/tutorial/registry/welcome'

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
  // T0 welcome (S2b spec §4.2). Lokális-először, mint minden más: a kezdőállapot a
  // localStorage-tükörből jön, hogy a legelső renderben már tudjuk, van-e dolgunk.
  const [welcomeStatus, setWelcomeStatus] = useState<'pending' | 'done'>(
    () => ((readLocalProgress()[WELCOME_ID]?.version ?? 0) >= WELCOME_VERSION ? 'done' : 'pending'),
  )
  const [welcomeOpen, setWelcomeOpen] = useState(false)
  const autoShown = useRef<Set<string>>(new Set())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Unstable-closure mirrors, assigned during render (no effect involved). `setProgress` is a
  // fresh closure every render (the hook doesn't memoize it). `progress` is mirrored too: any
  // callback that reads it must see the LATEST map, never the one from the render that created
  // the callback — otherwise a delayed setTimeout (the auto-open timer) or the route-change
  // effect can `persist()` a stale snapshot and clobber a server-merge write that landed in the
  // window between the callback being created and it actually running. `openId` gets the same
  // treatment: React setState updaters must stay pure (StrictMode invokes each one twice), so
  // `close` and the route effect below read `openIdRef.current` and call `persist()` OUTSIDE any
  // updater — the updater form would otherwise double-write localStorage and double-PUT with two
  // different `new Date()` values racing.
  const setProgressRef = useRef(setProgress)
  setProgressRef.current = setProgress
  const progressRef = useRef(progress)
  progressRef.current = progress
  // `openIdRef` a render alatt is szinkronba kerül a state-tel, de a nyitás/zárás pillanatában
  // EAGERLY is átírjuk (open/close/force-dismiss): a route-effect és az auto-open timer még a
  // következő render ELŐTT kérdezi meg, hogy „van-e nyitva valami" — egy elavult ref ott vagy
  // téves némán-zárást (lásd lent), vagy téves elnyomást okozna.
  const openIdRef = useRef(openId)
  openIdRef.current = openId
  // A route-effekt guardja ezt a render ELŐTT kérdezi meg (ugyanabban a futásban, mint az
  // openIdRef-et), ezért ref-tükör jár neki is. Route-hoz kötött: egy függő welcome CSAK a
  // /nap auto-openjét nyomja el, más oldal kalauzát nem.
  const shouldWelcome = welcomeStatus === 'pending' && pathname === '/nap'
  const shouldWelcomeRef = useRef(shouldWelcome)
  shouldWelcomeRef.current = shouldWelcome
  // Ugyanaz az EAGER ref-írás, mint az `openIdRef`-nél: a megnyitó effekt alább a `setWelcomeStatus`
  // leképeződése ELŐTT futhat le újra (StrictMode mount → cleanup → re-run, közben nincs render),
  // és a `progressRef` is csak renderkor frissül — a state-re támaszkodó kapu tehát kétszer engedné
  // át a `persist`-et, két külön `new Date()`-tel. A latch a nyitás pillanatában zár.
  const welcomeStatusRef = useRef(welcomeStatus)
  welcomeStatusRef.current = welcomeStatus
  // The kapcsolat-chip navigates AND animates the Sheet's close in the same click — `navigate()`
  // schedules the route-change effect below, but the animated close's `persist()` (the actual
  // 'done'/completedAt write) only runs once the exit animation finishes (Sheet's `onClose`,
  // fired by `close` above). Without this flag the route effect would run FIRST (same commit),
  // force-dismiss the still-open kalauz, and unmount <KalauzSheet>, which cancels the exit
  // timer/rAF — so the real 'done' write never happens. Set synchronously right before `navigate`
  // (see `onKalauzNavigate` below), consumed (and cleared) once by the route effect.
  const navPendingCloseRef = useRef(false)

  // A lokális az igazság a PUT visszaérkezéséig; a szerver-állapot beolvad, a többlet visszaíródik.
  // A `merged` számítása, az egyenlőség-ellenőrzés, a writeLocalProgress és a write-back PUT az
  // updateren KÍVÜL fut (lásd a fenti megjegyzést) — a `setLocal(merged)` az egyetlen state-írás.
  useEffect(() => {
    if (isPending) return
    const local = progressRef.current
    const merged = mergeProgress(serverProgress, local)
    // mergeProgress always builds a NEW object — bail out (no setLocal at all) when the content
    // didn't actually change, or the state "change" re-renders forever (new object in, effect
    // reruns, new object out, ...).
    if (JSON.stringify(merged) === JSON.stringify(local)) return
    writeLocalProgress(merged)
    // Compare the WHOLE entry, not just seenAt — a failed completedAt/dismissedAtStep PUT (server
    // still has the old entry) must also count as "local is ahead" so it gets retried here.
    const localOnly = Object.keys(merged).some(
      (k) => !(k in serverProgress) || JSON.stringify(serverProgress[k]) !== JSON.stringify(merged[k]),
    )
    if (localOnly) void setProgressRef.current(merged).catch(() => undefined)
    setLocal(merged)
  }, [serverProgress, isPending])

  // No deps beyond refs — `persist` never needs to change identity, so nothing downstream that
  // calls it needs to either.
  const persist = useCallback((next: TutorialProgress) => {
    setLocal(next)
    writeLocalProgress(next)
    void setProgressRef.current(next).catch(() => undefined) // PUT-hiba: a lokális marad; a következő merge újrapróbál
  }, [])

  const isUnseen = useCallback((id: string) => {
    // `versionOf`, nem `getKalauz`: a T0 welcome a registryn kívül él, de a seen-állapota
    // ugyanebben a mapben — enélkül `isUnseen('welcome')` mindig false lenne.
    const version = versionOf(id)
    if (version === null) return false
    const p = progressRef.current[id]
    return !p || p.version < version
  }, [])

  const open = useCallback((id: string) => {
    const e = getKalauz(id)
    if (!e) return
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    openIdRef.current = id
    setOpenId(id)
    // Látva = megjelent. Frissebb verzió esetén új rekord, completedAt/dismissedAtStep nullázva.
    const map = progressRef.current
    const prev = map[id]
    if (!prev || prev.version < e.version) {
      persist({ ...map, [id]: { version: e.version, seenAt: new Date().toISOString(), completedAt: null, dismissedAtStep: null } })
    }
  }, [persist])

  const close = useCallback((reason: KalauzCloseReason, step: number) => {
    const id = openIdRef.current
    if (id !== null) {
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
    }
    openIdRef.current = null
    setOpenId(null)
  }, [persist])

  // A welcome zárása. Ugyanaz a szerződés, mint a KalauzSheet close-jánál (done → completedAt,
  // skip → dismissedAtStep), csak a fix `welcome` kulcsra; a bejegyzést a megnyitó effekt
  // már megírta, tehát a `prev` hiánya csak elméleti.
  const closeWelcome = useCallback((reason: KalauzCloseReason, step: number) => {
    setWelcomeOpen(false)
    const map = progressRef.current
    const prev = map[WELCOME_ID]
    if (!prev) return
    persist({
      ...map,
      [WELCOME_ID]: reason === 'done'
        ? { ...prev, completedAt: new Date().toISOString() }
        : { ...prev, dismissedAtStep: step },
    })
  }, [persist])

  const onKalauzNavigate = useCallback((to: string) => {
    navPendingCloseRef.current = true
    navigate(to)
  }, [navigate])

  const resetAll = useCallback(async () => {
    // Minden session-állapot vissza a nullára: a guard, a futó timer és a NYITOTT kalauz is —
    // enélkül a reset után az épp látszó sheet a törölt bejegyzésre írna vissza záráskor.
    autoShown.current.clear()
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    openIdRef.current = null
    setOpenId(null)
    setWelcomeOpen(false)
    // Eager ref-írás is kell, ugyanúgy, mint a nyitó effektnél (lásd `welcomeStatusRef` fent):
    // a state-írás csak a következő render-flush-kor jelenik meg a refben, de a megnyitó effekt
    // a refet olvassa ELŐBB, mint a `setWelcomeStatus('pending')` leképeződne — enélkül a welcome
    // a reset UTÁNI /nap-belépéskor is némán elnyomva maradna.
    welcomeStatusRef.current = 'pending'
    setWelcomeStatus('pending')
    setLocal({})
    writeLocalProgress({})
    // A hiba KISZÁLL (mezo-gb1s.2): a hívó dönt, mit mutat — a néma nyelés miatt fordult
    // vissza korábban a reset a következő szerver-merge-nél.
    await resetProgress()
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
    if (navPendingCloseRef.current) {
      // A kalauz saját navigációja indította ezt a route-váltást — a force-dismiss ágat
      // kihagyjuk, a nyitott kalauzt a Sheet animált onClose-ja zárja a helyes reasonnel.
      navPendingCloseRef.current = false
    } else {
      const openedId = openIdRef.current
      if (openedId !== null) {
        const map = progressRef.current
        const prev = map[openedId]
        if (prev && prev.completedAt === null && prev.dismissedAtStep === null) {
          persist({ ...map, [openedId]: { ...prev, dismissedAtStep: 0 } })
        }
      }
      // Eager ref-írás: az alábbi „már van nyitva valami" kapu ugyanebben a futásban kérdez.
      openIdRef.current = null
      setOpenId(null)
    }
    if (!current || current.tier === 'T3') return
    if (autoShown.current.has(current.id) || !isUnseenRef.current(current.id)) return
    // Semmi nem ugorhat fel MÁS nyitott felület alá/fölé. A `navPendingCloseRef`-ág (kapcsolat-chip)
    // szándékosan nyitva hagyja a kalauzt a kilépő animáció végéig — reduced-motion alatt az
    // auto-open késleltetése 0, a kilépés viszont EXIT_MS=300, így a cél kalauza a MÉG KILÉPŐ
    // sheetbe nyílna: seenAt+completedAt íródna rá anélkül, hogy megjelent volna (a 300 ms-nál
    // lefutó onClose az addigra átírt openIdRef-et olvassa). Általános „már van nyitva valami"
    // kapu — a következő szelet első-indítás welcome-flow-ja ugyanezen a résen fogja elnyomni a
    // /nap auto-open-jét. A `current` így egyszerűen nem ugrik fel ebben a navigációban; nem lesz
    // `autoShown`, nem lesz seenAt — a következő belépésre újra esélyes.
    // A T0 welcome ugyanezen a résen nyom el: amíg `shouldWelcome`, a /nap timere el sem
    // indul, tehát a welcome-ot nem előzheti be a 600 ms-os (reduced-motion alatt 0 ms-os) sheet.
    if (openIdRef.current !== null || shouldWelcomeRef.current) return
    const id = current.id
    timer.current = setTimeout(() => {
      timer.current = null
      if (openIdRef.current !== null) return // időzítés közben nyílt valami (pl. a „?" gomb) — nem lépünk rá
      autoShown.current.add(id) // csak akkor jelöljük "megpróbáltnak", ha ténylegesen kinyílt (StrictMode dupla-futás alatt a cleanup törli a timert, de az elmaradt fut sosem foglalja el a guardot)
      openRef.current(id)
    }, prefersReducedMotion() ? 0 : AUTO_DELAY_MS)
    return () => { if (timer.current) { clearTimeout(timer.current); timer.current = null } }
  }, [pathname, current, persist])

  // A welcome megnyitása. A `!isPending` várakozás szándékos: egy ÚJ eszközön (üres
  // localStorage, a szerver szerint viszont látott) enélkül felvillanna, mielőtt a merge
  // megérkezik. Amíg várunk, a fenti guard blokkolja a /nap auto-openjét, tehát nincs verseny.
  // `persist` az effektben, nem setState-updaterben (StrictMode kétszer hívná az updatert).
  useEffect(() => {
    if (isPending || welcomeStatus !== 'pending' || pathname !== '/nap') return
    if (welcomeStatusRef.current !== 'pending') return // a fenti latch: a re-run closure-je még 'pending'-et lát
    // A `progressRef` a SAJÁT effekt-flush-ünkön belül elavult, és ezt ref-tükör nem gyógyítja:
    // a merge-effekt (fent) ugyanerre az `isPending`-re van kötve, react-query pedig EGY renderben
    // billenti az isPending-et és adja a datát — a két effekt tehát ugyanabban a passzív flush-ban
    // fut, deklarációs sorrendben, KÖZTÜK NINCS RENDER, a ref pedig csak renderkor frissül.
    // Ezért a szerver-mapet itt magunk fésüljük össze, és ez lesz a gate ÉS a `persist` bázisa is:
    // enélkül egy új eszközön (üres localStorage, szerver szerint látott) a welcome felvillanna,
    // majd a merge-elt map helyére egy welcome-only mapet írna vissza — lokálisan és PUT-tal is.
    const map = mergeProgress(serverProgress, progressRef.current)
    if ((map[WELCOME_ID]?.version ?? 0) >= WELCOME_VERSION) {
      welcomeStatusRef.current = 'done'
      setWelcomeStatus('done')
      return
    }
    // „látva = megjelent" — a státusz a megnyitással zárul le (előbb a latch, lásd fent).
    welcomeStatusRef.current = 'done'
    setWelcomeStatus('done')
    setWelcomeOpen(true)
    persist({ ...map, [WELCOME_ID]: { version: WELCOME_VERSION, seenAt: new Date().toISOString(), completedAt: null, dismissedAtStep: null } })
  }, [isPending, serverProgress, welcomeStatus, pathname, persist])

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
          // Kalauz-váltás = ÚJ sheet-példány, nem a régi továbbélése: enélkül a kicserélt kártyák
          // az előző példány `step`-jét öröklik (a `cards[step]` `undefined` lehet, ha az új
          // kalauznak kevesebb kártyája van), és egy épp kilépő sheet menet közben átváltana.
          key={openId}
          label={entry.label}
          cards={entry.cards}
          onClose={close}
          onNavigate={onKalauzNavigate}
        />
      )}
      {welcomeOpen && <KalauzWelcome steps={WELCOME.steps} onClose={closeWelcome} />}
    </TutorialContext.Provider>
  )
}
