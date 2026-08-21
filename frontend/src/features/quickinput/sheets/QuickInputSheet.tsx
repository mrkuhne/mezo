// ============================================================
// Mezo · QuickInputSheet — Napív quick-log launcher
// A highlighted chat row + an 8-tile grid. The navigating tiles route away;
// Alvás/Napló/Check-in swap this sheet for the matching log sheet in place,
// so a log is always two taps from anywhere (mezo-967c).
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { ActivityLogSheet } from '@/features/today/sheets/ActivityLogSheet'
import { JournalSheet } from '@/features/me/sheets/JournalSheet'
import { QuickSleepSheet } from '@/features/quickinput/sheets/QuickSleepSheet'
import { CheckInSheet } from '@/features/today/sheets/CheckInSheet'
import { isFillableSlot } from '@/features/today/logic/todayItems'
import { useCheckins } from '@/data/hooks'

/** Which surface the sheet shows: the launcher grid, an in-place two-option picker, or a log
 * sheet opened in its place. Napló used to jump straight to the activity log (`'naplo'`); it now
 * offers a choice first (mezo-b3pp.1) — `'naplo-pick'` renders inside the same Sheet shell, while
 * `'aktivitas'`/`'journal'`/`'gratitude'` are the three log sheets it can swap in. */
type Phase = 'menu' | 'sleep' | 'naplo-pick' | 'aktivitas' | 'journal' | 'gratitude' | 'checkin'

const NAV_ACTIONS = [
  { label: 'Étkezés', emoji: '🍽', to: '/fuel' },
  { label: 'Edzés', emoji: '🏋️', to: '/train' },
  { label: 'Víz', emoji: '💧', to: '/fuel' },
  { label: 'Súly', emoji: '⚖️', to: '/me/weight' },
  { label: 'Stack', emoji: '💊', to: '/fuel/stack' },
] as const

function Tile({
  emoji, label, onClick,
}: { emoji: string; label: string; onClick: () => void }) {
  return (
    <button type="button" className="quicklog-tile np-press" onClick={onClick}>
      <span className="quicklog-emoji" aria-hidden>{emoji}</span>
      <span className="quicklog-label">{label}</span>
    </button>
  )
}

export function QuickInputSheet({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('menu')

  // The day's four canonical slots are usually still in the Today query cache — cheap and
  // shared with Today's own read — but past the 30s staleTime (QueryProvider.tsx) a `+` tap
  // does issue a real GET. -1 = every slot is done for today.
  const { checkins, saveCheckIn } = useCheckins()
  // Pinned at click time (see the tile below), NOT recomputed here: `saveCheckIn` flips this
  // slot's state synchronously via its own optimistic `local` layer, so a live `findIndex`
  // would flip out from under `CheckInSheet` mid-save and unmount it before its exit
  // animation's onClose ever fires (mezo-967c finding 1). `nextCheckInIdx` below still drives
  // the tile's click with a fresh read — only the mounted sheet needs the pin.
  const [checkInIdx, setCheckInIdx] = useState<number | null>(null)
  const nextCheckInIdx = checkins.findIndex(isFillableSlot)

  // Each log sheet brings its own portal + backdrop, so it REPLACES the menu
  // rather than layering over it. Closing it closes the whole stack.
  if (phase === 'sleep') return <QuickSleepSheet onClose={onClose} />
  if (phase === 'aktivitas') return <ActivityLogSheet onClose={onClose} />
  if (phase === 'journal') return <JournalSheet onClose={onClose} />
  if (phase === 'gratitude') return <JournalSheet onClose={onClose} initialMode="gratitude" />
  if (phase === 'checkin' && checkInIdx !== null) {
    return (
      <CheckInSheet
        slot={checkins[checkInIdx]}
        slotIdx={checkInIdx}
        onClose={onClose}
        onSave={data => saveCheckIn(checkInIdx, data)}
      />
    )
  }

  return (
    <Sheet onClose={onClose} labelledBy="quicklog-title">
      {close => (
        <div className="quicklog">
          {phase === 'naplo-pick' ? (
            <>
              <h2 id="quicklog-title">Mit naplózol?</h2>
              <div className="quicklog-grid mt-lg">
                <Tile emoji="✍️" label="Aktivitás"
                  onClick={() => setPhase('aktivitas')} />
                <Tile emoji="📓" label="Napló"
                  onClick={() => setPhase('journal')} />
                <Tile emoji="🙏" label="Hála"
                  onClick={() => setPhase('gratitude')} />
              </div>
            </>
          ) : (
            <>
              <h2 id="quicklog-title">Gyors logolás</h2>
              <p className="quicklog-sub">bármikor, két koppintás</p>

              <button
                type="button"
                className="quicklog-chat np-press"
                onClick={() => { close(); navigate('/insights/chat') }}
              >
                <span className="quicklog-chat-emoji" aria-hidden>💬</span>
                <span className="quicklog-chat-text">
                  <span className="quicklog-chat-label">Beszélgetés a társsal</span>
                  <span className="quicklog-chat-hint">kérdezz, mesélj, tervezz</span>
                </span>
                <Icon name="chevron-right" size={18} />
              </button>

              <div className="quicklog-grid">
                {NAV_ACTIONS.map(a => (
                  <Tile key={a.label} emoji={a.emoji} label={a.label}
                    onClick={() => { close(); navigate(a.to) }} />
                ))}
                <Tile emoji="❤️" label="Check-in"
                  onClick={() => {
                    if (nextCheckInIdx >= 0) { setCheckInIdx(nextCheckInIdx); setPhase('checkin') }
                    else { close(); navigate('/today') }
                  }} />
                <Tile emoji="😴" label="Alvás"
                  onClick={() => setPhase('sleep')} />
                <Tile emoji="📓" label="Napló"
                  onClick={() => setPhase('naplo-pick')} />
              </div>
            </>
          )}
        </div>
      )}
    </Sheet>
  )
}
