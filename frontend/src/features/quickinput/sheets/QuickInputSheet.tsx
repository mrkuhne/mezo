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
import { QuickSleepSheet } from '@/features/quickinput/sheets/QuickSleepSheet'
import { CheckInSheet } from '@/features/today/sheets/CheckInSheet'
import { isFillableSlot } from '@/features/today/logic/todayItems'
import { useCheckins } from '@/data/hooks'

/** Which surface the sheet shows: the launcher grid, or a log sheet opened in its place. */
type Phase = 'menu' | 'sleep' | 'naplo' | 'checkin'

const NAV_ACTIONS = [
  { label: 'Étkezés', sub: 'recept vagy szabad', emoji: '🍽', to: '/fuel' },
  { label: 'Edzés', sub: 'indítás · jegyzet', emoji: '🏋️', to: '/train' },
  { label: 'Víz', sub: '+250 ml', emoji: '💧', to: '/fuel' },
  { label: 'Súly', sub: 'reggeli mérés', emoji: '⚖️', to: '/me/weight' },
  { label: 'Stack', sub: 'bevettem', emoji: '💊', to: '/fuel/stack' },
] as const

function Tile({
  emoji, label, hint, onClick,
}: { emoji: string; label: string; hint: string; onClick: () => void }) {
  return (
    <button type="button" className="quicklog-tile np-press" onClick={onClick}>
      <span className="quicklog-emoji" aria-hidden>{emoji}</span>
      <span className="quicklog-label">{label}</span>
      <span className="quicklog-hint">{hint}</span>
    </button>
  )
}

export function QuickInputSheet({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('menu')

  // The day's four canonical slots are already in the Today query cache, so this is a
  // cache read, not a second fetch. -1 = every slot is done for today.
  const { checkins, saveCheckIn } = useCheckins()
  const checkInIdx = checkins.findIndex(isFillableSlot)

  // Each log sheet brings its own portal + backdrop, so it REPLACES the menu
  // rather than layering over it. Closing it closes the whole stack.
  if (phase === 'sleep') return <QuickSleepSheet onClose={onClose} />
  if (phase === 'naplo') return <ActivityLogSheet onClose={onClose} />
  if (phase === 'checkin' && checkInIdx >= 0) {
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
              <Tile key={a.label} emoji={a.emoji} label={a.label} hint={a.sub}
                onClick={() => { close(); navigate(a.to) }} />
            ))}
            <Tile emoji="❤️" label="Check-in"
              hint={checkInIdx >= 0 ? `${checkins[checkInIdx].time} · hogy vagyok` : 'mára mind megvan'}
              onClick={() => {
                if (checkInIdx >= 0) setPhase('checkin')
                else { close(); navigate('/today') }
              }} />
            <Tile emoji="😴" label="Alvás" hint="az éjszakád"
              onClick={() => setPhase('sleep')} />
            <Tile emoji="📓" label="Napló" hint="egy mondat a napról"
              onClick={() => setPhase('naplo')} />
          </div>
        </div>
      )}
    </Sheet>
  )
}
