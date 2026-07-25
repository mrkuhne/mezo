import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrivalStep } from '@/features/ritual/components/ArrivalStep'
import { DayStoryStep } from '@/features/ritual/components/DayStoryStep'
import { LoopsStep } from '@/features/ritual/components/LoopsStep'
import { ReleaseStep } from '@/features/ritual/components/ReleaseStep'
import { CheckInSheet } from '@/features/today/sheets/CheckInSheet'
import { ActivityLogSheet } from '@/features/today/sheets/ActivityLogSheet'
import { localDateString } from '@/shared/lib/dates'
import { useCheckins, useDayRecap, useRitualDay } from '@/data/hooks'

const ACT_COUNT = 5

/**
 * Full-screen Napzárás flow (/ritual, spec §4, mezo-ilsj) — a 5-act state machine over a
 * forced-dark surface (train/session idiom: AppLayout hides the tab bar for this route).
 * Act 4 (harvest) is still a placeholder stub here — Task 6 replaces it with the real
 * component; nothing writes anything before act 4 (the harvest close, Task 6) — the ✕ exit
 * is consequence-free at any point.
 *
 * Act 3 (LoopsStep) only SIGNALS (onOpenCheckIn/onOpenJournal) — the reused sheets
 * (CheckInSheet, ActivityLogSheet) are mounted HERE, at the page level, exactly like
 * TodayPage.tsx mounts CheckInSheet (TodayPage.tsx:37-42/76-83): this page keeps its own
 * `useCheckins` + the same next-open-slot `findIndex` predicate so it can resolve
 * onOpenCheckIn to a concrete slot index without LoopsStep needing to know or pass it.
 */
export function RitualPage() {
  const navigate = useNavigate()
  const date = localDateString()
  const { data } = useRitualDay(date)
  const { closingNote } = useDayRecap(date)
  const { checkins, saveCheckIn } = useCheckins()
  const [act, setAct] = useState(1)
  const [checkInIdx, setCheckInIdx] = useState<number | null>(null)
  const [journalOpen, setJournalOpen] = useState(false)

  const nextCheckinIdx = checkins.findIndex((c) => c.state === 'now' || c.state === 'pending')

  return (
    <div className="rz-screen">
      <div className="rz-top">
        <div className="rz-dots" aria-hidden="true">
          {Array.from({ length: ACT_COUNT }, (_, i) => (
            <span key={i} className={i < act ? 'rz-dot on' : 'rz-dot'} />
          ))}
        </div>
        <button className="rz-exit" aria-label="Kilépés" onClick={() => navigate('/today')}>✕</button>
      </div>

      {act === 1 && <ArrivalStep onNext={() => setAct(2)} />}
      {act === 2 && <DayStoryStep onNext={() => setAct(3)} />}
      {act === 3 && (
        <LoopsStep
          onNext={() => setAct(4)}
          onOpenCheckIn={() => setCheckInIdx(nextCheckinIdx)}
          onOpenJournal={() => setJournalOpen(true)}
        />
      )}
      {act === 4 && <div className="rz-act" data-testid="act-4">A mai termés — hamarosan.</div>}
      {act === 5 && (
        <ReleaseStep
          prepStartsAt={data.window.prepStartsAt}
          bedTime={data.window.bedTime}
          closingNote={closingNote}
          onFinish={() => navigate('/today')}
        />
      )}

      {checkInIdx !== null && (
        <CheckInSheet
          slot={checkins[checkInIdx]}
          slotIdx={checkInIdx}
          onClose={() => setCheckInIdx(null)}
          onSave={(data) => saveCheckIn(checkInIdx, data)}
        />
      )}
      {journalOpen && <ActivityLogSheet onClose={() => setJournalOpen(false)} />}
    </div>
  )
}
