import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { APP_NOTIFICATION_KIND_META, type AppNotificationView } from '@/data/types'
import { groupByDay } from '@/features/notification/logic/groupByDay'
import { localDateString } from '@/shared/lib/dates'
import { cn } from '@/shared/lib/cn'

function timeLabel(occurredAt: string, group: string): string {
  const d = new Date(occurredAt)
  if (group === 'Korábban') {
    return d.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })
  }
  return d.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })
}

/** The A-variant dropdown panel (spec 2026-08-18 §6, mockup A). Purely presentational —
 *  the bell owns open-state and read-marking; `wasUnread` is the bell's open-time snapshot
 *  so the dots stay visible while the panel is open even though the cache is already stamped. */
export function NotificationPanel({ items, wasUnread, onClose }: {
  items: AppNotificationView[]
  wasUnread: ReadonlySet<string>
  onClose: () => void
}) {
  const navigate = useNavigate()
  const groups = groupByDay(items, localDateString())
  return (
    <>
      {createPortal(
        <button type="button" className="dd-backdrop" aria-label="Bezárás" onClick={onClose} />,
        document.querySelector('.phone-screen') ?? document.body,
      )}
      <div className="nf-panel" role="dialog" aria-label="Értesítések">
        <div className="nf-head">
          <span className="nf-title">Értesítések</span>
        </div>
        <div className="nf-scroll">
          {groups.length === 0 && <p className="nf-empty">Még nincs értesítés.</p>}
          {groups.map((group) => (
            <div key={group.label}>
              <div className="nf-group">{group.label}</div>
              {group.items.map((n) => {
                const meta = APP_NOTIFICATION_KIND_META[n.kind]
                return (
                  <button
                    key={n.id}
                    type="button"
                    className={cn('nf-item np-press', wasUnread.has(n.id) && 'unread')}
                    onClick={() => { onClose(); navigate(n.deeplink) }}
                  >
                    {wasUnread.has(n.id) && <span className="nf-dot" aria-hidden="true" />}
                    <span className={cn('nf-ico', meta.tint)} aria-hidden="true">{meta.emoji}</span>
                    <span className="nf-txt">
                      <span className="nf-t">{n.title}</span>
                      {n.body && <span className="nf-b">{n.body}</span>}
                    </span>
                    <span className="nf-time">{timeLabel(n.occurredAt, group.label)}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
