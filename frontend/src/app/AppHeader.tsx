// ============================================================
// Mezo · AppHeader — az app EGYETLEN felső fejléce (mezo-atry). Korábban mind az öt
// tab-gyökér külön bemásolta a `.nap-head` receptet, eltérő tartalommal; itt egy helyen
// él, és az AppLayout mountolja minden oldalra. Sorrend fixen:
//   szekció (spot + név) · [kalauz ?] · napszakváltó · Mezo-üzenetek · értesítések · napi orb
// A napszak-választás állapota az URL-ben marad (`/nap?dp=`) — nincs globális state, és a
// meglévő deep-linkek változatlanul működnek. A választó BÁRHONNAN a Nap oldalra navigál.
//
// A napszak-feloldás a `useDayFace()`-é, az üzenet-szál a `MezoThreadProvider`-é: mindkettő
// megosztott a Nap oldallal, hogy a fejléc és az oldal ne tudjon szétcsúszni (mezo-atry
// fix-hullám). Fókuszkezelés (focus trap / roving tabindex) tudatosan NINCS — a
// `docs/features/today.md` külön halasztott tételként tartja számon.
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ClayIcon, ClaySpot, type ClayIconName } from '@/shared/ui/clay'
import { DayOrb } from '@/shared/ui/DayOrb'
import { cn } from '@/shared/lib/cn'
import { localDateString } from '@/shared/lib/dates'
import { notificationKindMeta } from '@/data/types'
import { useNotificationFeed, useNotificationFeedActions } from '@/data/notification/feedHooks'
import { groupByDay } from '@/features/notification/logic/groupByDay'
import { timeLabel } from '@/features/notification/logic/stamp'
import {
  NOTIFICATION_CATEGORIES, notificationCategory, type NotificationCategoryId,
} from '@/features/notification/logic/category'
import { DAY_FACES, FACE_LABEL, type DayFace } from '@/features/today/logic/dayFace'
import { useDayFace } from '@/features/today/logic/useDayFace'
import { useDayOrbFill } from '@/features/today/logic/useDayOrbFill'
import { useMezoThread } from '@/features/today/MezoThreadProvider'
import { useTutorial } from '@/features/tutorial/TutorialProvider'
import { HeaderAurora } from '@/app/HeaderAurora'
import { sectionFor } from '@/app/headerSection'
import { useCondensedHeader } from '@/app/useCondensedHeader'

const FACE_ICON: Record<DayFace, 'i-hajnal' | 'i-nap' | 'i-alvas'> = {
  reggel: 'i-hajnal', nap: 'i-nap', este: 'i-alvas',
}

/** Az értesítés-panel felső korlátja. A többi a teljes feed oldalé (`/me/ertesitesek`) — egy
 *  fejléc-panel nem a feed második példánya, és egy több százas lista görgetése ott a helyes. */
const NTF_PANEL_CAP = 30
type NtfFilter = 'all' | 'unread' | NotificationCategoryId

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
  const { markAllRead } = useNotificationFeedActions()
  const unreadNtf = notifications.filter((n) => n.readAt === null).length
  // A panel a LEGÚJABB 30 sort viszi (korábban hármat). A nyers `slice()` a feed érkezési
  // sorrendjét vette, ami se a backendben, se a mock seedben nem garantáltan csökkenő — a mock
  // seed épp növekvő, tehát a csengő a mai LEGRÉGEBBI sorokat rajzolta (mezo-tdzy). A rendezés
  // a felbontott időpontra épül, nem az ISO-string lexikografikus sorrendjére (`groupByDay`
  // ugyanígy). A 30-as ablak MINDENNEK a forrása — a chipek darabszámai is ebből számolnak,
  // különben egy chip többet ígérne, mint amennyit a lista megmutat (mezo-g9fz).
  const recent = useMemo(
    () => [...notifications]
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
      .slice(0, NTF_PANEL_CAP),
    [notifications],
  )
  const { unread: unreadMsgs } = useMezoThread()
  const dayOrb = useDayOrbFill()
  const kalauz = useTutorial()
  const qUnseenDot = kalauz.current !== null && kalauz.current.tier === 'T3' && kalauz.isUnseen(kalauz.current.id)

  const [dpOpen, setDpOpen] = useState(false)
  const [ntfOpen, setNtfOpen] = useState(false)
  const [ntfFilter, setNtfFilter] = useState<NtfFilter>('all')
  const rootRef = useRef<HTMLElement>(null)
  // Útvonalváltáskor minden popover bezárul — a shellben élő fejléc nem remountol.
  useEffect(() => { setDpOpen(false); setNtfOpen(false) }, [pathname])
  // A szűrő a panel ÉLETTARTAMÁIG él: egy legközelebbi nyitás megint a teljes listát mutatja,
  // nem egy fél napja otthagyott kategóriát.
  useEffect(() => { if (!ntfOpen) setNtfFilter('all') }, [ntfOpen])

  // A chip-sor CSAK azokat a kategóriákat rajzolja, amikre van sor a 30-as ablakban: egy üres
  // chip olyan szűrőt ígérne, ami nulla találatot ad. Ugyanezért esik ki az „Olvasatlan" is,
  // amint minden sor olvasott — és ilyenkor a kiválasztás visszaesik a `Mind`-re, hogy a lista
  // ne egy már nem létező szűrő mögött ürüljön ki.
  const ntfChips = useMemo(() => {
    const chips: { id: NtfFilter; label: string; icon?: ClayIconName; n: number }[] =
      [{ id: 'all', label: 'Mind', n: recent.length }]
    const unread = recent.filter((n) => n.readAt === null).length
    if (unread > 0) chips.push({ id: 'unread', label: 'Olvasatlan', n: unread })
    for (const c of NOTIFICATION_CATEGORIES) {
      const n = recent.filter((r) => notificationCategory(r.kind) === c.id).length
      if (n > 0) chips.push({ id: c.id, label: c.label, icon: c.icon, n })
    }
    return chips
  }, [recent])
  const activeNtfFilter = ntfChips.some((c) => c.id === ntfFilter) ? ntfFilter : 'all'

  const ntfGroups = useMemo(() => {
    const rows = recent.filter((n) => {
      if (activeNtfFilter === 'all') return true
      if (activeNtfFilter === 'unread') return n.readAt === null
      return notificationCategory(n.kind) === activeNtfFilter
    })
    // Ugyanaz a nap-csoportosítás, amit a teljes feed oldal használ — a két felület nem
    // mondhat két különbözőt UGYANARRA a napra (mezo-tdzy).
    return groupByDay(rows, localDateString())
  }, [recent, activeNtfFilter])
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
            <ClaySpot name={section.spot} size={32} className="app-head-spot" />
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
          <ClayIcon name={FACE_ICON[face]} size={24} />
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
                <ClayIcon name={FACE_ICON[f]} size={24} />
              </button>
            ))}
          </div>
        )}
      </div>

      <button type="button" className="nap-roundbtn"
        aria-label={unreadMsgs > 0 ? `Mezo üzenetei, ${unreadMsgs} olvasatlan` : 'Mezo üzenetei'}
        onClick={() => navigate('/nap/uzenetek')}>
        <ClayIcon name="i-level" size={23} />
        {unreadMsgs > 0 && <span className="nap-badge">{unreadMsgs}</span>}
      </button>

      {/* A csengő wrapperének NINCS `nap-dpwrap`-ja: a panel nem a gomb alá tapad, hanem a
          fejléc két széléhez (`.nap-ntfpanel`, a `<header>` gyereke) — ez adja a teljes
          szélességet, amiben egy cím és két sor törzs is kifér (mezo-g9fz). */}
      <button type="button" className={cn('nap-roundbtn', ntfOpen && 'is-open')}
        aria-haspopup="dialog" aria-expanded={ntfOpen}
        aria-label={unreadNtf > 0 ? `Értesítések, ${unreadNtf} olvasatlan` : 'Értesítések'}
        onClick={() => { setDpOpen(false); setNtfOpen((o) => !o) }}>
        <ClayIcon name="i-ertesites" size={23} />
        {unreadNtf > 0 && <span className="nap-badge">{unreadNtf}</span>}
      </button>

      {/* mezo-idz2: a jobb szélső orb korábban a profilra vitt — ugyanoda, ahova az alsó
          „Én" fül, tehát duplikátum volt. Most a nap állapotjelzője: alulról fölfelé telik
          a rögzített jelek szerint, és a mai nap-oldalra visz. A töltöttség maga a jelzés,
          ezért nincs rajta badge. */}
      <button type="button" className="nap-avatar" aria-label={dayOrb.label}
        onClick={() => navigate(`/me/week/napok/${localDateString()}`)}>
        <DayOrb pct={dayOrb.pct} intensity={dayOrb.intensity} size={42} />
      </button>

      {ntfOpen && <>
        {/* A takaró a fejléc gyereke, `z-index: 0`-val — a fejléc `isolation: isolate`-je
            saját stacking contextet nyit, tehát a takaró a fejléc GYEREKEIHEZ képest rendeződik:
            a gombok (1) és a panel (2) fölötte maradnak és világosak, a lap tartalma viszont
            a takaró alá kerül, mert az EGÉSZ fejléc (46) a lap fölött ül. A `body`-ba portálozva
            fordítva sülne el: ott a `.screen-content` saját kontextusa miatt a takaró a fejléc
            FÖLÉ kerülne, és elnyelné a csengő kattintását. A `mousedown`-figyelő önmagában is
            bezárna, ez a réteg a VIZUÁLIS elhatárolás. */}
        <div className="nap-ntfscrim" aria-hidden="true" onClick={() => setNtfOpen(false)} />
        {/* `dialog`, nem `menu`: a panel szűrő-chipeket és egy „Mind olvasott" gombot is
            tartalmaz, amik nem `menuitem`-ek — egy `role="menu"` alattuk hazug fa lenne. */}
        <div className="nap-ntfpanel" role="dialog" aria-label="Értesítések">
          <div className="nap-ntfhd">
            <span className="nap-ntfeyebrow">Értesítések</span>
            <span className={cn('nap-ntfcnt', unreadNtf === 0 && 'is-none')}>
              {unreadNtf > 0 ? `${unreadNtf} új` : 'nincs új'}
            </span>
            {unreadNtf > 0 && (
              // A repó fire-and-forget idiómája: a `.catch(() => {})` KIÍRVA — a `markAllRead`
              // egy `mutateAsync`, ami real-módban elszálló POST-nál elutasít, és a
              // visszagörgetést az `onError` már elvégezte (NotificationFeedPage.tsx).
              <button type="button" className="nap-ntfallread"
                onClick={() => { void markAllRead().catch(() => {}) }}>
                Mind olvasott
              </button>
            )}
          </div>
          <div className="nap-ntftabs" role="group" aria-label="Szűrés">
            {ntfChips.map((c) => (
              // Kiírt `aria-label`: a címke és a darabszám két szomszédos span, amikből az
              // elérhető név szóköz nélkül tapadna össze („Mind3").
              <button key={c.id} type="button" aria-pressed={c.id === activeNtfFilter}
                aria-label={`${c.label}, ${c.n} értesítés`}
                className={cn(c.id === activeNtfFilter && 'on')}
                onClick={() => setNtfFilter(c.id)}>
                {c.icon && <ClayIcon name={c.icon} size={17} />}
                <span>{c.label}</span>
                <span className="n">{c.n}</span>
              </button>
            ))}
          </div>
          <div className="nap-ntfscroll">
            {ntfGroups.length === 0 ? (
              <p className="nap-ntfempty">
                {activeNtfFilter === 'unread'
                  ? 'Minden értesítésedet elolvastad.'
                  : 'Nincs ilyen értesítésed.'}
              </p>
            ) : ntfGroups.map((g) => (
              <div key={g.day} className="nap-ntfgroup" role="group" aria-labelledby={`nph-${g.day}`}>
                <h2 id={`nph-${g.day}`} className="nap-ntfday">{g.label}</h2>
                {g.items.map((n) => {
                  const meta = notificationKindMeta(n.kind)
                  return (
                    // Az olvasottság ITT az ÉLŐ `readAt` (nem nyitáskori pillanatkép, mint a teljes
                    // feed oldalon): a „Mind olvasott" a szemed előtt tünteti el a kiemelést, és
                    // pont ez a gomb dolga — a pillanatkép a feed oldal szerződése.
                    <button key={n.id} type="button"
                      className={cn('nap-ntfrow', n.readAt === null && 'unread')}
                      onClick={() => { setNtfOpen(false); if (n.deeplink) navigate(n.deeplink) }}>
                      <span className={cn('nap-ntfico', meta.tint)} aria-hidden="true">
                        <ClayIcon name={meta.clay} size={24} />
                      </span>
                      <span className="nap-ntftxt">
                        <span className="nap-ntf-t">{n.title}</span>
                        {n.body && <span className="nap-ntf-x">{n.body}</span>}
                        {/* A napot a csoportcímke hordozza (a teljes feed oldal idiómája), ezért
                            itt a puszta óra:perc a helyes — nem a `notificationStamp`. */}
                        <span className="nap-ntf-when">{timeLabel(n.occurredAt)}</span>
                      </span>
                      {n.readAt === null && <>
                        <span className="nap-ntf-dot" aria-hidden="true" />
                        {/* Az osztály és a pötty csak látó felhasználónak létezik — a repó
                            `sr-only` helperje viszi hangba is (a feed sorok ugyanezt teszik). */}
                        <span className="sr-only">Olvasatlan</span>
                      </>}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          <div className="nap-ntfft">
            <button type="button"
              onClick={() => { setNtfOpen(false); navigate('/me/ertesitesek') }}>
              Összes értesítés ›
            </button>
          </div>
        </div>
      </>}
    </header>
  )
}
