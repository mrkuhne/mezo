// ============================================================
// Mezo · NotificationFeedPage — az „Összes értesítés" saját teljes oldala (mezo-nol0).
// A fejléc csengőjének paneljéből érhető el. Egy sor kattintása csak azt a sort
// jelöli olvasottnak; a többi olvasatlan marad.
// ============================================================
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificationKindMeta } from '@/data/types'
import { useNotificationFeed, useNotificationFeedActions } from '@/data/hooks'
import { groupByDay } from '@/features/notification/logic/groupByDay'
import { timeLabel } from '@/features/notification/logic/stamp'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { ContentIcon } from '@/shared/ui/clay'
import { ntfIcon } from '@/features/notification/logic/kindIcon'
import { Skeleton } from '@/shared/ui/Skeleton'
import { cn } from '@/shared/lib/cn'
import { localDateString } from '@/shared/lib/dates'

export function NotificationFeedPage() {
  const navigate = useNavigate()
  const { items, isPending } = useNotificationFeed()
  const { markItemRead } = useNotificationFeedActions()
  const unreadCount = items.filter((n) => n.readAt === null).length

  const groups = useMemo(() => groupByDay(items, localDateString()), [items])

  return (
    <MozaikPage tone="sky" className="nf-page">
      <PageHead glass history fallback="/me" label="Hol tartok" />
      {/* Hideg fetch alatt a valódi darabszám még nem ismert. */}
      <PageHero art="t-bell" accent="var(--dv-sky)" name="Értesítések"
        big={isPending ? undefined : unreadCount || undefined}
        sub={isPending ? undefined : `${items.length} értesítés`} />
      <PageBody>
        {isPending ? (
          // Real-mode cold-load window: `useDualQuery`'s `realEmpty: []` makes an unresolved
          // feed indistinguishable from a genuinely empty one — showing the ghost state here
          // would tell the user "nincs értesítésed" and then immediately contradict itself
          // once the feed resolves (fix round 1, item 1). No distinctive feed-row shape to
          // mirror yet, so a generic skeleton stands in (WeekAnalysisPage.tsx idiom).
          <div className="nf-loading" role="status" aria-label="Betöltés…">
            <Skeleton variant="card" height={66} radius={18} className="nf-skel" />
            <Skeleton variant="card" height={66} radius={18} className="nf-skel" />
            <Skeleton variant="card" height={66} radius={18} className="nf-skel" />
          </div>
        ) : groups.length === 0 ? (
          // Üveg (mezo-me75u.7): the empty state is free space — a dashed sky outline, not a card.
          <p className="nf-empty uv-empty">Még nincs értesítésed.</p>
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
                      className={cn('nf-row', n.readAt === null && 'unread')}
                      // Védőőr, mint a fejléc peekjében (`TitleBar.tsx`): a backend oszlop non-null,
                      // de két felület, ami ugyanazt a mezőt olvassa, ne mondjon két különbözőt.
                      onClick={() => {
                        if (n.readAt === null) void markItemRead(n.id).catch(() => {})
                        if (n.deeplink) navigate(n.deeplink)
                      }}>
                      {n.readAt === null && <>
                        <span className="nf-dot" aria-hidden="true" />
                        {/* Az olvasatlanság eddig CSAK látó felhasználónak létezett (osztály + egy
                            aria-hidden pötty). A repó `sr-only` helperje viszi hangba is. */}
                        <span className="sr-only">Olvasatlan</span>
                      </>}
                      {/* Ugyanaz a 3D ikon, mint a fejléc paneljén (`ntfIcon`, közös térkép), egy
                          fajta-tintával megvilágított kútban (üveg, mezo-me75u.7). */}
                      <span className={cn('nf-ico uv-well', meta.tint)} aria-hidden="true">
                        <ContentIcon name={ntfIcon(meta.clay)} size={28} />
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
