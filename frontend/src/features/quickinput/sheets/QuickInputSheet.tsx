// ============================================================
// Mezo · QuickInputSheet — Napív 6-tile quick-log launcher
// Navigation-only in S1; real quick-actions wire up in S4/S6/S7.
// ============================================================
import { useNavigate } from 'react-router-dom'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'

const ACTIONS = [
  { label: 'Étkezés', sub: 'recept vagy szabad', emoji: '🍽', to: '/fuel' },
  { label: 'Edzés', sub: 'indítás · jegyzet', emoji: '🏋️', to: '/train' },
  { label: 'Víz', sub: '+250 ml', emoji: '💧', to: '/fuel' },
  { label: 'Súly', sub: 'reggeli mérés', emoji: '⚖️', to: '/me/weight' },
  { label: 'Stack', sub: 'bevettem', emoji: '💊', to: '/fuel/stack' },
  { label: 'Check-in', sub: 'hogy vagyok', emoji: '❤️', to: '/today' },
] as const

export function QuickInputSheet({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
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
            {ACTIONS.map(a => (
              <button key={a.label} type="button" className="quicklog-tile np-press"
                onClick={() => { close(); navigate(a.to) }}>
                <span className="quicklog-emoji" aria-hidden>{a.emoji}</span>
                <span className="quicklog-label">{a.label}</span>
                <span className="quicklog-hint">{a.sub}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  )
}
