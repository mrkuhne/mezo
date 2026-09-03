// ============================================================
// Mezo · AppHeader — az app EGYETLEN felső fejléce (mezo-atry). Korábban mind az öt
// tab-gyökér külön bemásolta a `.nap-head` receptet, eltérő tartalommal; itt egy helyen
// él, és az AppLayout mountolja minden oldalra. Sorrend fixen:
//   szekció (spot + név) · [kalauz ?] · napszakváltó · Mezo-üzenetek · értesítések · profil orb
// A napszak-választás állapota az URL-ben marad (`/nap?dp=`) — nincs globális state, és a
// meglévő deep-linkek változatlanul működnek. A választó BÁRHONNAN a Nap oldalra navigál.
//
// A napszak-feloldás a `useDayFace()`-é, az üzenet-szál a `MezoThreadProvider`-é: mindkettő
// megosztott a Nap oldallal, hogy a fejléc és az oldal ne tudjon szétcsúszni (mezo-atry
// fix-hullám). Fókuszkezelés (focus trap / roving tabindex) tudatosan NINCS — a
// `docs/features/today.md` külön halasztott tételként tartja számon.
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ClayIcon, ClaySpot } from '@/shared/ui/clay'
import { cn } from '@/shared/lib/cn'
import { useNotificationFeed } from '@/data/notification/feedHooks'
import { DAY_FACES, FACE_LABEL, type DayFace } from '@/features/today/logic/dayFace'
import { useDayFace } from '@/features/today/logic/useDayFace'
import { useMezoThread } from '@/features/today/MezoThreadProvider'
import { useTutorial } from '@/features/tutorial/TutorialProvider'
import { HeaderAurora } from '@/app/HeaderAurora'
import { sectionFor } from '@/app/headerSection'
import { useCondensedHeader } from '@/app/useCondensedHeader'

const FACE_ICON: Record<DayFace, 'i-hajnal' | 'i-nap' | 'i-alvas'> = {
  reggel: 'i-hajnal', nap: 'i-nap', este: 'i-alvas',
}

export function AppHeader() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [params] = useSearchParams()

  const { face, nowFace } = useDayFace()
  // A `?dp=` CSAK a Nap oldalon jelent napszak-választást; máshol a valós napszak látszik.
  const onNap = pathname === '/nap'
  // A bal oldal a szekciót mutatja („hol vagyok"); a pontos oldalcím a lapok PageHead-jéé.
  const section = sectionFor(pathname)
  const condensed = useCondensedHeader()

  const { items: notifications } = useNotificationFeed()
  const unreadNtf = notifications.filter((n) => n.readAt === null).length
  const { unread: unreadMsgs } = useMezoThread()
  const kalauz = useTutorial()
  const qUnseenDot = kalauz.current !== null && kalauz.current.tier === 'T3' && kalauz.isUnseen(kalauz.current.id)

  const [dpOpen, setDpOpen] = useState(false)
  const [ntfOpen, setNtfOpen] = useState(false)
  const rootRef = useRef<HTMLElement>(null)
  // Útvonalváltáskor minden popover bezárul — a shellben élő fejléc nem remountol.
  useEffect(() => { setDpOpen(false); setNtfOpen(false) }, [pathname])
  // Escape és kívülre kattintás: a popover-alapszerződés, amit mind az öt korábbi másolat
  // elmulasztott. Csak nyitott menü mellett iratkozunk fel.
  const anyOpen = dpOpen || ntfOpen
  useEffect(() => {
    if (!anyOpen) return
    const close = () => { setDpOpen(false); setNtfOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [anyOpen])

  const pickFace = (f: DayFace) => {
    setDpOpen(false)
    // A többi query-paraméter (`?day=`, `?medCycleDay=`, `?niggle=`, `?vulnerable=`,
    // `?ritual=`) app-szintű szcenárió-kapcsoló (`useTodayScenario`) — egy napszakváltás
    // nem söpörheti el őket. `replace`, hogy a napszak-kattintgatás ne töltse a historyt.
    const next = new URLSearchParams(params)
    if (f === nowFace) next.delete('dp')
    else next.set('dp', f)
    const qs = next.toString()
    navigate(qs ? `/nap?${qs}` : '/nap', { replace: true })
  }

  return (
    <header className={cn('nap-head app-head', condensed && 'is-cond')} ref={rootRef}>
      <HeaderAurora face={face} />
      <div className="nap-head-grow app-head-sec">
        {section && (
          <>
            <ClaySpot name={section.spot} size={30} className="app-head-spot" />
            <span className="app-head-title">{section.label}</span>
          </>
        )}
      </div>

      {/* Mezo-kalauz (mezo-gb1s.1): az oldal kalauza — csak ott, ahol van (honest state).
          A gombsor BAL szélén, minden oldalon ugyanott; arany pont = T3 oldal még nem látott
          kalauzzal (T1/T2 magától felugrik, ott a pont fölösleges). */}
      {kalauz.current && (
        <button type="button" className={cn('nap-roundbtn', 'nap-q', kalauz.openId === kalauz.current.id && 'is-open')}
          aria-label="Kalauz ehhez az oldalhoz" aria-haspopup="dialog"
          onClick={() => { setDpOpen(false); setNtfOpen(false); kalauz.open(kalauz.current!.id) }}>
          <span className="nap-q-glyph" aria-hidden="true">?</span>
          {qUnseenDot && <span className="nap-offnow" aria-hidden="true" />}
        </button>
      )}

      <div className="nap-dpwrap">
        <button type="button" className="nap-roundbtn" aria-label="Napszak váltása"
          aria-haspopup="menu" aria-expanded={dpOpen}
          onClick={() => { setNtfOpen(false); setDpOpen((o) => !o) }}>
          <ClayIcon name={FACE_ICON[face]} size={22} />
          {onNap && face !== nowFace && <span className="nap-offnow" aria-hidden="true" />}
        </button>
        {dpOpen && (
          <div className="nap-dpmenu" role="menu" aria-label="Napszak">
            {/* menuitemRADIO: a választás nem csak vizuális (`.on`), a kisegítő technológia
                is látja, melyik napszakon állunk. */}
            {DAY_FACES.map((f) => (
              <button key={f} type="button" role="menuitemradio" aria-checked={f === face}
                aria-label={FACE_LABEL[f]}
                className={cn(f === face && 'on')} onClick={() => pickFace(f)}>
                <ClayIcon name={FACE_ICON[f]} size={22} />
              </button>
            ))}
          </div>
        )}
      </div>

      <button type="button" className="nap-roundbtn"
        aria-label={unreadMsgs > 0 ? `Mezo üzenetei, ${unreadMsgs} olvasatlan` : 'Mezo üzenetei'}
        onClick={() => navigate('/nap/uzenetek')}>
        <ClayIcon name="i-level" size={21} />
        {unreadMsgs > 0 && <span className="nap-badge">{unreadMsgs}</span>}
      </button>

      <div className="nap-dpwrap">
        <button type="button" className="nap-roundbtn" aria-haspopup="menu" aria-expanded={ntfOpen}
          aria-label={unreadNtf > 0 ? `Értesítések, ${unreadNtf} olvasatlan` : 'Értesítések'}
          onClick={() => { setDpOpen(false); setNtfOpen((o) => !o) }}>
          <ClayIcon name="i-ertesites" size={21} />
          {unreadNtf > 0 && <span className="nap-badge">{unreadNtf}</span>}
        </button>
        {ntfOpen && (
          // A menü fejléc-sora nem menüelem: `presentation`-ként kikerül a kisegítő fából,
          // a felirat pedig a menü `aria-label`-jeként marad meg.
          <div className="nap-ntfmenu" role="menu" aria-label="Értesítések · ma">
            <span className="mz-eyebrow" role="presentation">Értesítések · ma</span>
            {notifications.slice(0, 3).map((n) => (
              <button key={n.id} type="button" role="menuitem" className="nap-ntfrow"
                onClick={() => { setNtfOpen(false); if (n.deeplink) navigate(n.deeplink) }}>
                <span className="nap-ntf-t">{n.title}</span>
                <span className="nap-ntf-x">{n.body}</span>
              </button>
            ))}
            <button type="button" role="menuitem" className="nap-ntffoot"
              onClick={() => { setNtfOpen(false); navigate('/me/ertesitesek') }}>
              Összes értesítés ›
            </button>
          </div>
        )}
      </div>

      <button type="button" className="nap-avatar" aria-label="Profil" onClick={() => navigate('/me')}>
        <ClaySpot name="s-orb" size={40} />
      </button>
    </header>
  )
}
