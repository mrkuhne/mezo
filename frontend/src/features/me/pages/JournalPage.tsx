import { useState } from 'react'
import { Icon } from '@/shared/ui/Icon'
import { GhostState } from '@/shared/ui/GhostState'
import { Skeleton, SkeletonCard } from '@/shared/ui/Skeleton'
import { useJournalNotes } from '@/data/hooks'
import { JournalSheet } from '@/features/me/sheets/JournalSheet'
import { dayLabel } from '@/features/me/logic/growthJournal'
import { localDateString } from '@/shared/lib/dates'
import type { JournalNote } from '@/data/journal/journalTypes'

function monthLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long' })
}

/** First day of the month `monthsBack - 1` months before `todayIso`'s month — `monthsBack = 3`
 * means "this month + the two before it". Widening (Task 7's "Korábbi hónapok") just grows
 * `monthsBack`, which pushes `from` further back. Derives from the SAME `today` ISO string the
 * page already computed (not a fresh `new Date()`) so both ends of the window share one source of
 * truth for "now" — pure integer month arithmetic on `todayIso`'s own year/month, no re-entry into
 * `localDateString` (which only ever formats *this instant*, not an arbitrary target date). */
function windowFrom(monthsBack: number, todayIso: string): string {
  const [y, m] = todayIso.split('-').map(Number)
  const totalMonths = y * 12 + (m - 1) - (monthsBack - 1)
  const year = Math.floor(totalMonths / 12)
  const month = ((totalMonths % 12) + 12) % 12 + 1
  return `${year}-${String(month).padStart(2, '0')}-01`
}

// /me/naplo (Journal, mezo-b3pp.1) — the read surface for free-prose journal notes: a
// month-grouped list (idiom copied from MemoryJournalPanel.tsx) over a widening date window.
// Creating opens JournalSheet with no `entry` (create mode); tapping a card reopens it with
// `entry` set (edit mode, which also offers delete) — Task 6's sheet owns both flows.
export function JournalPage() {
  const [monthsBack, setMonthsBack] = useState(3)
  const [addOpen, setAddOpen] = useState(false)
  const [editNote, setEditNote] = useState<JournalNote | null>(null)

  const today = localDateString()
  const from = windowFrom(monthsBack, today)
  const { data: notes, isPending } = useJournalNotes(from, today)

  let lastMonth = ''

  return (
    <>
      <div className="pghead-np lav">
        <div>
          <div className="over">Me · Napló</div>
          <h1>Napló</h1>
        </div>
        <button
          type="button"
          className="pgact-np np-press"
          onClick={() => setAddOpen(true)}
          style={{ background: 'var(--wash-lav)', color: 'var(--lav-deep)' }}
        >
          <Icon name="plus" size={12} /> Új bejegyzés
        </button>
      </div>

      <div style={{ padding: '8px 24px 24px' }}>
        {isPending ? (
          <div className="col gap-sm" role="status" aria-label="Betöltés…">
            {Array.from({ length: 3 }, (_, i) => (
              <SkeletonCard key={i}>
                <Skeleton width="30%" height={9} />
                <Skeleton width="90%" height={11} style={{ marginTop: 8 }} />
                <Skeleton width="70%" height={11} style={{ marginTop: 6 }} />
              </SkeletonCard>
            ))}
          </div>
        ) : notes.length === 0 ? (
          <GhostState message="Még nincs bejegyzés — kezdd a + gombbal." />
        ) : (
          <div className="col gap-md">
            {notes.map((note) => {
              const month = monthLabel(note.occurredOn)
              const showSeparator = month !== lastMonth
              lastMonth = month
              return (
                <div key={note.id} className="col gap-md">
                  {showSeparator && (
                    <span className="eyebrow text-tertiary" style={{ marginTop: 4 }}>{month}</span>
                  )}
                  <button
                    type="button"
                    className="card"
                    onClick={() => setEditNote(note)}
                    style={{ padding: 18, textAlign: 'left', width: '100%' }}
                  >
                    <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>
                      {dayLabel(note.occurredOn, today)}
                    </span>
                    <p style={{ fontSize: 14, lineHeight: 1.65, marginTop: 10, color: 'var(--text-primary)' }}>
                      {note.text}
                    </p>
                  </button>
                </div>
              )
            })}
            <button
              type="button"
              className="cta-ghost mt-md"
              onClick={() => setMonthsBack((m) => m + 3)}
              style={{ textAlign: 'center' }}
            >
              Korábbi hónapok
            </button>
          </div>
        )}
      </div>

      {addOpen && <JournalSheet onClose={() => setAddOpen(false)} />}
      {editNote && <JournalSheet entry={editNote} onClose={() => setEditNote(null)} />}
    </>
  )
}
