// ============================================================
// Mezo · AppHeader — az app EGYETLEN felső fejléce (mezo-atry). Korábban mind az öt
// tab-gyökér külön bemásolta a `.nap-head` receptet, eltérő tartalommal; itt egy helyen
// él, és az AppLayout mountolja minden oldalra. Sorrend fixen:
//   dátum-eyebrow · napszakváltó · Mezo-üzenetek · értesítések · profil orb
// A napszak-választás állapota az URL-ben marad (`/nap?dp=`) — nincs globális state, és a
// meglévő deep-linkek változatlanul működnek. A választó BÁRHONNAN a Nap oldalra navigál.
// ============================================================
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ClayIcon } from '@/shared/ui/clay'
import { cn } from '@/shared/lib/cn'
import { localDateString } from '@/shared/lib/dates'
import { lastSeenMessage } from '@/shared/lib/seenMessages'
import { resolveBriefing, useCompanionFeed, useSleepGoal, useToday, useTodayScenario } from '@/data/hooks'
import { useNotificationFeed } from '@/data/notification/feedHooks'
import { DAY_FACES, FACE_LABEL, dayFace, type DayFace } from '@/features/today/logic/dayFace'
import { useMinuteTick } from '@/features/today/logic/useMinuteTick'
import { buildMezoMessages } from '@/features/today/logic/mezoMessages'

const FACE_ICON: Record<DayFace, 'i-hajnal' | 'i-nap' | 'i-alvas'> = {
  reggel: 'i-hajnal', nap: 'i-nap', este: 'i-alvas',
}
const isFace = (v: string | null): v is DayFace =>
  v !== null && (DAY_FACES as readonly string[]).includes(v)

export function AppHeader() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [params] = useSearchParams()

  const { today } = useToday()
  const { goal: sleepGoal } = useSleepGoal()
  const nowFace = dayFace(useMinuteTick(), sleepGoal)
  // A `?dp=` CSAK a Nap oldalon jelent napszak-választást; máshol a valós napszak látszik.
  const onNap = pathname === '/nap'
  const dpParam = params.get('dp')
  const face: DayFace = onNap && isFace(dpParam) ? dpParam : nowFace

  const { items: notifications } = useNotificationFeed()
  const unreadNtf = notifications.filter((n) => n.readAt === null).length

  const scenario = useTodayScenario()
  const feed = useCompanionFeed()
  const messages = useMemo(
    () => buildMezoMessages({ feed, demoBriefing: resolveBriefing(scenario.dayState) }),
    [feed, scenario.dayState],
  )
  // Az olvasatlan-vízjel localStorage-ban él, és a fejléc — a shellben lévén — NEM remountol
  // az üzenetek oldalról visszatérve. Ezért minden útvonalváltás után újraolvassuk, különben
  // a badge beragadna.
  const date = localDateString()
  const [seenId, setSeenId] = useState<string | null>(() => lastSeenMessage(date))
  useEffect(() => { setSeenId(lastSeenMessage(date)) }, [date, pathname])
  const unreadMsgs = useMemo(() => {
    if (seenId === null) return messages.length
    const idx = messages.findIndex((m) => m.id === seenId)
    return idx < 0 ? messages.length : messages.length - (idx + 1)
  }, [seenId, messages])

  const [dpOpen, setDpOpen] = useState(false)
  const [ntfOpen, setNtfOpen] = useState(false)
  // Útvonalváltáskor minden popover bezárul — a shellben élő fejléc nem remountol.
  useEffect(() => { setDpOpen(false); setNtfOpen(false) }, [pathname])

  // Mindig explicit `dp` paraméterrel navigálunk — a választás nem a pillanatnyi valós
  // napszaktól függ, különben a viselkedés az óra állásától válna determinisztikátlanná.
  const pickFace = (f: DayFace) => {
    setDpOpen(false)
    navigate(`/nap?dp=${f}`)
  }

  return (
    <div className="nap-head app-head">
      <div className="nap-head-grow">
        <span className="mz-eyebrow">{today.dayLabel} · {today.dateLabel}</span>
      </div>

      <div className="nap-dpwrap">
        <button type="button" className="nap-roundbtn" aria-label="Napszak váltása" aria-expanded={dpOpen}
          onClick={() => { setNtfOpen(false); setDpOpen((o) => !o) }}>
          <ClayIcon name={FACE_ICON[face]} size={22} />
          {onNap && isFace(dpParam) && <span className="nap-offnow" aria-hidden="true" />}
        </button>
        {dpOpen && (
          <div className="nap-dpmenu" role="menu">
            {DAY_FACES.map((f) => (
              <button key={f} type="button" role="menuitem" aria-label={FACE_LABEL[f]}
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
        <button type="button" className="nap-roundbtn" aria-expanded={ntfOpen}
          aria-label={unreadNtf > 0 ? `Értesítések, ${unreadNtf} olvasatlan` : 'Értesítések'}
          onClick={() => { setDpOpen(false); setNtfOpen((o) => !o) }}>
          <ClayIcon name="i-ertesites" size={21} />
          {unreadNtf > 0 && <span className="nap-badge">{unreadNtf}</span>}
        </button>
        {ntfOpen && (
          <div className="nap-ntfmenu" role="menu">
            <span className="mz-eyebrow">Értesítések · ma</span>
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
        <ClayIcon name="i-mezo" size={19} />
      </button>
    </div>
  )
}
