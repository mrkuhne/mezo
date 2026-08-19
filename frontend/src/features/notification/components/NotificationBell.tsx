import { useRef, useState } from 'react'
import { useNotificationFeed, useNotificationFeedActions } from '@/data/hooks'
import { NotificationPanel } from '@/features/notification/components/NotificationPanel'

/** The 4th AppHero counter chip: 🔔 + unread badge; opens the dropdown panel and marks
 *  everything read on open (classic bell semantics — the badge clears immediately, the
 *  open-time snapshot keeps the dots visible inside the panel until it closes). */
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const { items } = useNotificationFeed()
  const { markAllRead } = useNotificationFeedActions()
  const snapshotRef = useRef<ReadonlySet<string>>(new Set())

  const unread = items.filter((n) => !n.readAt).length

  const toggle = () => {
    if (!open) {
      snapshotRef.current = new Set(items.filter((n) => !n.readAt).map((n) => n.id))
      if (unread > 0) void markAllRead()
    }
    setOpen((v) => !v)
  }

  return (
    <div className="nf-bell">
      <button
        type="button"
        className="cnt bell np-press"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread > 0 ? `Értesítések, ${unread} olvasatlan` : 'Értesítések'}
        onClick={toggle}
      >
        🔔
        {unread > 0 && <span className="bell-badge">{unread}</span>}
      </button>
      {open && (
        <NotificationPanel items={items} wasUnread={snapshotRef.current} onClose={() => setOpen(false)} />
      )}
    </div>
  )
}
