// ============================================================
// Mezo · Folyadék frame — the title bar (mezo-n4wf5.1, owner-approved 2026-10-09)
//
// ONE instance, in the shell, on every chrome route. It answers „hol vagyok": the context line
// and the page title, derived from the path (navModel `frameFor`) and overridable by the page
// (`useFrameTitle`). Two faces:
//   · HUB (the path is one of the domain's four tab routes): line 1 = context line + five round
//     buttons — Minden oldal · Mezo üzenetei · Értesítések · Beállítások · the day orb; line 2 =
//     the title with the kalauz „?" after it; then the top tabs (the `children` slot).
//   · SUB-PAGE: back · context line + title + „?" · the bell.
// The back button runs the page's own handler when it registered one (`useFrameBack`, which
// `PageHead` does), else it returns where the user came from, else to the owning tab.
//
// Every control of the old header is here: the kalauz „?" (only where the page has one; a
// liquid dot = an unseen T3 guide), settings with its `state.from` return logic, Mezo's
// messages with the unread badge, the notification bell + panel (ported UNCHANGED from the
// retired AppHeader), and the filling day orb.
//
// Look: docs/design_2.0/prototypes/vilagos/kit.js `top(d,o)`; CSS `.fo-top` in
// styles/folyadek-frame.css.
// ============================================================
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ContentIcon, Icon3D, type ClayIconName } from '@/shared/ui/clay'
import { Drop, useFrame, useTitleBarMounted } from '@/shared/ui/folyadek'
import { cn } from '@/shared/lib/cn'
import { localDateString } from '@/shared/lib/dates'
import { notificationKindMeta } from '@/data/types'
import { useNotificationFeed, useNotificationFeedActions } from '@/data/hooks'
import { groupByDay } from '@/features/notification/logic/groupByDay'
import { timeLabel } from '@/features/notification/logic/stamp'
import { ntfIcon } from '@/features/notification/logic/kindIcon'
import {
  NOTIFICATION_CATEGORIES, notificationCategory, type NotificationCategoryId,
} from '@/features/notification/logic/category'
import { useDayOrbFill } from '@/features/today/logic/useDayOrbFill'
import { useMezoThread } from '@/features/today/MezoThreadProvider'
import { useTutorial } from '@/features/tutorial/TutorialProvider'
import { canGoBack, frameFor } from '@/app/navModel'

/** Az értesítés-panel felső korlátja. A többi a teljes feed oldalé (`/me/ertesitesek`) — egy
 *  fejléc-panel nem a feed második példánya, és egy több százas lista görgetése ott a helyes. */
const NTF_PANEL_CAP = 30
type NtfFilter = 'all' | 'unread' | NotificationCategoryId

// The notification panel's CONTENT icons wear the 3D set (üveg bible §4/§7.1, mezo-me75u.3,
// prototypes/uveg-nap.html — the bell). The chrome buttons above keep their clay icons. The
// call-site meanings (`NTF_3D`/`ntfIcon`) are shared with the full feed page since U7
// (mezo-me75u.7), so both surfaces draw the same icon per kind.

/** The day orb's liquid (kit.js `top`): the Nap blue, on every domain. */
const DAY_ORB_COLOR = '#1877F2'

export function TitleBar({ children }: {
  /** The top-tabs slot: rendered under the title on a hub, so the whole block pins as one. */
  children?: ReactNode
}) {
  const navigate = useNavigate()
  const { pathname, search, state, key: locationKey } = useLocation()
  // The page may override what the path says (a converted page names itself) and hands over its
  // own back handler; everything else is derived from the path.
  const page = useFrame()
  const derived = frameFor(pathname, new Date())
  const title = page.title ?? derived.title
  const eyebrow = page.eyebrow ?? derived.eyebrow
  useTitleBarMounted()

  const { items: notifications } = useNotificationFeed()
  const { markAllRead, markItemRead } = useNotificationFeedActions()
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

  const [ntfOpen, setNtfOpen] = useState(false)
  const [ntfFilter, setNtfFilter] = useState<NtfFilter>('all')
  const rootRef = useRef<HTMLElement>(null)
  // Útvonalváltáskor minden popover bezárul — a shellben élő fejléc nem remountol.
  useEffect(() => { setNtfOpen(false) }, [pathname])
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
  const anyOpen = ntfOpen
  useEffect(() => {
    if (!anyOpen) return
    const close = () => { setNtfOpen(false) }
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


  // The page's sticky chrome (`.sticky-top`) pins BELOW the title bar, whose height differs by
  // face (hub with tabs / sub-page) and by width — so the bar publishes its own height to the
  // scroller instead of a hand-kept token.
  useEffect(() => {
    const el = rootRef.current
    const scroller = el?.closest<HTMLElement>('.screen-content')
    if (!el || !scroller) return
    const publish = () => scroller.style.setProperty('--fo-top-h', `${Math.round(el.getBoundingClientRect().height)}px`)
    publish()
    if (typeof ResizeObserver === 'undefined') return () => scroller.style.removeProperty('--fo-top-h')
    const ro = new ResizeObserver(publish)
    ro.observe(el)
    return () => { ro.disconnect(); scroller.style.removeProperty('--fo-top-h') }
  }, [])

  const goBack = () => {
    // A page with a handler that does more than navigate (a confirm, a step back inside a flow)
    // runs it. Otherwise the owner rule: back where the user came from — and only when the app
    // was opened right here, to the page's own fallback route, else the tab that owns the page.
    if (page.onBack) return page.onBack()
    if (canGoBack(window.history.state, locationKey)) navigate(-1)
    else navigate(page.fallback ?? derived.fallback)
  }

  // Mezo-kalauz (mezo-gb1s.1): az oldal kalauza — csak ott, ahol van (honest state). A cím
  // UTÁN áll; a folyadék-pötty = T3 oldal még nem látott kalauzzal (T1/T2 magától felugrik,
  // ott a pont fölösleges).
  const help = kalauz.current && (
    <button type="button" className={cn('fo-help', qUnseenDot && 'new', kalauz.openId === kalauz.current.id && 'is-open')}
      aria-label="Kalauz ehhez az oldalhoz" aria-haspopup="dialog"
      onClick={() => { setNtfOpen(false); kalauz.open(kalauz.current!.id) }}>
      ?
    </button>
  )

  // A csengő panelje nem a gomb alá tapad, hanem a fejléc két széléhez (`.nap-ntfpanel`, a
  // `<header>` gyereke) — ez adja a teljes szélességet, amiben egy cím és két sor törzs is
  // kifér (mezo-g9fz).
  const bell = (
    <button type="button" className={cn('fo-ib', ntfOpen && 'is-open')}
      aria-haspopup="dialog" aria-expanded={ntfOpen}
      aria-label={unreadNtf > 0 ? `Értesítések, ${unreadNtf} olvasatlan` : 'Értesítések'}
      onClick={() => { setNtfOpen((o) => !o) }}>
      <Icon3D name="t-bell" size={24} />
      {unreadNtf > 0 && <b className="fo-badge-n">{unreadNtf}</b>}
    </button>
  )

  return (
    <header className={cn('fo-top', !derived.isHub && 'sub')} ref={rootRef}>
      {derived.isHub ? <>
        <div className="fo-trow hub">
          <small className="fo-eb"><i aria-hidden="true" /><span>{eyebrow}</span></small>
          <div className="fo-btns">
            {/* Az oldal-leltár bejárata (mezo-ju4j6.17): a nyugdíjazott területváltó alsó sora
                ide költözött. A horgony a JELENLEGI területre nyitja a listát. */}
            <button type="button" className="fo-ib" aria-label="Minden oldal"
              onClick={() => navigate(`/minden#${derived.domain.id}`)}>
              <Icon3D name="t-grid" size={24} />
            </button>
            <button type="button" className="fo-ib"
              aria-label={unreadMsgs > 0 ? `Mezo üzenetei, ${unreadMsgs} olvasatlan` : 'Mezo üzenetei'}
              onClick={() => navigate('/nap/uzenetek')}>
              <Icon3D name="t-chat" size={24} />
              {unreadMsgs > 0 && <b className="fo-badge-n">{unreadMsgs}</b>}
            </button>
            {bell}
            <button type="button" className="fo-ib" aria-label="Beállítások"
              onClick={() => navigate('/settings', { state: { from: pathname.startsWith('/settings') ? state?.from : pathname + search } })}>
              <Icon3D name="t-gear" size={24} />
            </button>
            {/* mezo-idz2: a nap állapotjelzője — alulról fölfelé telik a rögzített jelek
                szerint, és a mai nap-oldalra visz. A töltöttség maga a jelzés, nincs badge. */}
            <button type="button" className="fo-ib fo-day" aria-label={dayOrb.label}
              onClick={() => navigate(`/nap/napom/${localDateString()}`)}>
              <Drop pct={dayOrb.pct} color={DAY_ORB_COLOR} size={30} />
            </button>
          </div>
        </div>
        <div className="fo-title"><div className="fo-h"><h1>{title}</h1>{help}</div></div>
        {children}
      </> : (
        <div className="fo-trow">
          <button type="button" className="fo-ib fo-back" aria-label="Vissza" onClick={goBack}>
            <span aria-hidden="true">‹</span>
          </button>
          <div className="fo-title">
            <small><i aria-hidden="true" /><span>{eyebrow}</span></small>
            <div className="fo-h sm"><h1>{title}</h1>{help}</div>
          </div>
          {bell}
        </div>
      )}

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
                {c.icon && <ContentIcon name={ntfIcon(c.icon)} size={17} />}
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
                    // A panel és a teljes feed oldal egyaránt az élő `readAt` mezőt mutatja.
                    <button key={n.id} type="button"
                      className={cn('nap-ntfrow', n.readAt === null && 'unread')}
                      onClick={() => {
                        setNtfOpen(false)
                        if (n.readAt === null) void markItemRead(n.id).catch(() => {})
                        if (n.deeplink) navigate(n.deeplink)
                      }}>
                      <span className={cn('nap-ntfico', meta.tint)} aria-hidden="true">
                        <ContentIcon name={ntfIcon(meta.clay)} size={28} />
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
