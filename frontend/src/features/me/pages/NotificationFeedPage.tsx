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
import { APP_NOTIFICATION_KIND_META } from '@/data/types'
import { useNotificationFeed, useNotificationFeedActions } from '@/data/notification/feedHooks'
import { groupByDay } from '@/features/notification/logic/groupByDay'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { ClayIcon } from '@/shared/ui/clay'
import { GhostState } from '@/shared/ui/GhostState'
import { cn } from '@/shared/lib/cn'
import { localDateString } from '@/shared/lib/dates'

const timeLabel = (occurredAt: string) =>
  new Date(occurredAt).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })

export function NotificationFeedPage() {
  const navigate = useNavigate()
  const { items } = useNotificationFeed()
  const { markAllRead } = useNotificationFeedActions()

  // Nyitáskori pillanatkép: a lista ebből rajzolja a kiemelést, nem az élő `readAt`-ból —
  // különben a `markAllRead` a szemünk előtt tüntetné el, mi volt új.
  const snapshot = useRef<ReadonlySet<string> | null>(null)
  if (snapshot.current === null && items.length > 0) {
    snapshot.current = new Set(items.filter((n) => n.readAt === null).map((n) => n.id))
  }
  const wasUnread = snapshot.current ?? new Set<string>()

  const marked = useRef(false)
  useEffect(() => {
    if (marked.current || wasUnread.size === 0) return
    marked.current = true
    void markAllRead()
  }, [wasUnread, markAllRead])

  const groups = useMemo(() => groupByDay(items, localDateString()), [items])

  return (
    <MozaikPage tone="sky" className="nf-page">
      <PageHead onBack={() => navigate(-1)}>
        <button type="button" className="mzc-pgact" aria-label="Beállítások"
          onClick={() => navigate('/me/ertesitesek/beallitasok')}>
          Beállítások ›
        </button>
      </PageHead>
      <PageHero icon="i-ertesites" name="Értesítések" big={wasUnread.size}
        sub={`${items.length} értesítés`} />
      <PageBody>
        {groups.length === 0 ? (
          <GhostState message="Még nincs értesítésed." />
        ) : (
          <EntranceGroup>
            {groups.map((g, gi) => (
              <div key={g.day} className="nf-group rise"
                style={{ '--d': `${gi * 60}ms` } as React.CSSProperties}>
                <div className="nf-daylabel">{g.label}</div>
                {g.items.map((n) => {
                  const meta = APP_NOTIFICATION_KIND_META[n.kind]
                  return (
                    <button key={n.id} type="button"
                      className={cn('nf-row', wasUnread.has(n.id) && 'unread')}
                      onClick={() => navigate(n.deeplink)}>
                      {wasUnread.has(n.id) && <span className="nf-dot" aria-hidden="true" />}
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
