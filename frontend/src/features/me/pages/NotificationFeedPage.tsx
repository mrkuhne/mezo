// ============================================================
// Mezo · NotificationFeedPage — az „Összes értesítés" saját teljes oldala (mezo-nol0).
// A fejléc csengője 3 sort mutat, a lábléce ide vezet. Ez az oldal EGYBEN a hiányzó
// `markAllRead` hívó: előtte a fában nem volt elérhető útvonal, ami olvasottá tett volna
// egy értesítést, tehát a badge minden képernyőn véglegesen égett (mezo-61w0).
// A kiemelés a NYITÁSKORI pillanatképből jön, nem az élő `readAt`-ból: a badge azonnal
// nullázódik, de amíg itt vagy, látod, mi volt új — a törölt NotificationBell szemantikája.
// ============================================================
import { useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificationKindMeta } from '@/data/types'
import { useNotificationFeed, useNotificationFeedActions } from '@/data/notification/feedHooks'
import { groupByDay } from '@/features/notification/logic/groupByDay'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { ClayIcon } from '@/shared/ui/clay'
import { GhostState } from '@/shared/ui/GhostState'
import { Skeleton } from '@/shared/ui/Skeleton'
import { cn } from '@/shared/lib/cn'
import { localDateString } from '@/shared/lib/dates'

const timeLabel = (occurredAt: string) =>
  new Date(occurredAt).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })

// Stable fallback identity for `wasUnread` before the snapshot is captured — a fresh `new Set()`
// on every render would change the `useEffect` dependency each time and re-run its (no-op) body
// throughout the real-mode loading window (fix round 1, item 2).
const EMPTY: ReadonlySet<string> = new Set()

export function NotificationFeedPage() {
  const navigate = useNavigate()
  const { items, isPending } = useNotificationFeed()
  const { markAllRead } = useNotificationFeedActions()

  // Nyitáskori pillanatkép: a lista ebből rajzolja a kiemelést, nem az élő `readAt`-ból —
  // különben a `markAllRead` a szemünk előtt tüntetné el, mi volt új.
  const snapshot = useRef<ReadonlySet<string> | null>(null)
  if (snapshot.current === null && items.length > 0) {
    snapshot.current = new Set(items.filter((n) => n.readAt === null).map((n) => n.id))
  }
  const wasUnread = snapshot.current ?? EMPTY

  const marked = useRef(false)
  useEffect(() => {
    if (marked.current || wasUnread.size === 0) return
    marked.current = true
    // A repó fire-and-forget idiómája (JournalPage.tsx, ReflectionStep.tsx): a `.catch(() => {})`
    // KIÍRVA. A `markAllRead` egy `mutateAsync(...).then(...)`, ami real-módban elszálló POST-nál
    // elutasít; a `void` csak a lintet hallgattatná el, a rejectiont nem. A visszagörgetést az
    // `onError` már elvégezte, tehát a rejection nem hordoz információt — csak uncaught error lenne.
    void markAllRead().catch(() => {})
  }, [wasUnread, markAllRead])

  const groups = useMemo(() => groupByDay(items, localDateString()), [items])

  return (
    <MozaikPage tone="sky" className="nf-page">
      {/* Fix célpont, nem `navigate(-1)`: a beállítások vissza gombja ide (`/me/ertesitesek`) mutat,
          tehát egy history-alapú vissza a feedről oda-vissza hurkot csinált a két lappal, és az Én
          hub csak a tab-sávról volt elérhető. A Me-allap idióma (GoalsPage, GrowthPage, WeekHubPage)
          fix `/me` + kiírt `‹ Én` címke — így a létra beállítások → feed → hub kifelé vezet. */}
      <PageHead onBack={() => navigate('/me')} label="‹ Én">
        {/* A `marginLeft` szándékosan inline, ne „rendezd" vissza az osztályra: a
            `.mz-page-head .mzc-pgact:first-of-type { margin-left: auto }` (prototype.css) SOSEM
            illeszkedik, mert a `:first-of-type` az első <button> testvért jelenti, azt pedig a
            `PageHead` saját `.mz-backbtn`-je foglalja. Ez a repó uralkodó idiómája is
            (GoalsPage, FuelRecipesPage, FuelStackPage). A szelektor javítása külön ügy (mezo-wd02). */}
        <button type="button" className="mzc-pgact" aria-label="Beállítások"
          style={{ marginLeft: 'auto' }}
          onClick={() => navigate('/me/ertesitesek/beallitasok')}>
          Beállítások ›
        </button>
      </PageHead>
      {/* A `big`/`sub` az ÉLŐ `items`-ből olvasna 0-t a real-módú hideg-fetch alatt, ami a
          „nincs értesítésed" hazugságot ismételné a fejlécben is — pending alatt egyiket sem
          mutatjuk, ahelyett hogy egy még-be-nem-töltött 0-t állítanánk (fix round 1, item 1).
          A `|| undefined` pedig a nulla olvasatlant tünteti el: a `big` NYITÁSKORI pillanatkép,
          a `sub` élő, tehát minden későbbi látogatáson egy nagy `0` állna a „6 értesítés" fölött.
          A `PageHero` `undefined`-ra kapuz, így bignum nélkül rajzol — ugyanaz az elv, amit a
          beállítások oldal mond ki magára („egy szám olyan értesítésekről, amik nem történhetnek"). */}
      <PageHero icon="i-ertesites" name="Értesítések"
        big={isPending ? undefined : wasUnread.size || undefined}
        sub={isPending ? undefined : `${items.length} értesítés`} />
      <PageBody>
        {isPending ? (
          // Real-mode cold-load window: `useDualQuery`'s `realEmpty: []` makes an unresolved
          // feed indistinguishable from a genuinely empty one — showing the ghost state here
          // would tell the user "nincs értesítésed" and then immediately contradict itself
          // once the feed resolves (fix round 1, item 1). No distinctive feed-row shape to
          // mirror yet, so a generic skeleton stands in (WeekAnalysisPage.tsx idiom).
          <div className="col gap-sm" role="status" aria-label="Betöltés…">
            <Skeleton variant="card" height={64} />
            <Skeleton variant="card" height={64} />
            <Skeleton variant="card" height={64} />
          </div>
        ) : groups.length === 0 ? (
          <GhostState message="Még nincs értesítésed." />
        ) : (
          <EntranceGroup>
            {groups.map((g, gi) => (
              // Teljes oldalon a napcímkék a dokumentum SZERKEZETE (a 3 soros dropdownban még nem
              // voltak azok): `<h2>` + `role="group"`/`aria-labelledby`, különben a képernyőolvasó
              // egy tagolatlan gomb-futamot kap a nap szerint rendezett feed helyett.
              <div key={g.day} className="nf-group rise" role="group" aria-labelledby={`nf-day-${g.day}`}
                style={{ '--d': `${gi * 60}ms` } as React.CSSProperties}>
                <h2 id={`nf-day-${g.day}`} className="nf-daylabel">{g.label}</h2>
                {g.items.map((n) => {
                  const meta = notificationKindMeta(n.kind)
                  return (
                    <button key={n.id} type="button"
                      className={cn('nf-row', wasUnread.has(n.id) && 'unread')}
                      // Védőőr, mint a fejléc peekjében (`AppHeader.tsx`): a backend oszlop non-null,
                      // de két felület, ami ugyanazt a mezőt olvassa, ne mondjon két különbözőt.
                      onClick={() => { if (n.deeplink) navigate(n.deeplink) }}>
                      {wasUnread.has(n.id) && <>
                        <span className="nf-dot" aria-hidden="true" />
                        {/* Az olvasatlanság eddig CSAK látó felhasználónak létezett (osztály + egy
                            aria-hidden pötty). A repó `sr-only` helperje viszi hangba is. */}
                        <span className="sr-only">Olvasatlan</span>
                      </>}
                      <span className={cn('nf-ico', meta.tint)} aria-hidden="true">
                        <ClayIcon name={meta.clay} size={20} />
                      </span>
                      <span className="nf-txt">
                        <span className="nf-t">{n.title}</span>
                        {n.body && <span className="nf-x">{n.body}</span>}
                      </span>
                      <span className="nf-time">{timeLabel(n.occurredAt)}</span>
                    </button>
                  )
                })}
              </div>
            ))}
          </EntranceGroup>
        )}
      </PageBody>
    </MozaikPage>
  )
}
