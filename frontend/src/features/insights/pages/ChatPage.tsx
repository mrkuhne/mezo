import { useState } from 'react'
import { Icon } from '@/shared/ui/Icon'
import { useChat, useChatActions } from '@/data/hooks'
import { ChatMessage } from '@/features/insights/components/ChatMessage'

const SUBTITLE = { mock: 'demo beszélgetés', live: 'Gemini · élő' } as const

function ThinkingDots() {
  return (
    <div className="col gap-sm" style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
      <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>Mezo</span>
      <div className="card" style={{ padding: 14 }}>
        <div className="row gap-xs">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="np-pulse"
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--lav-deep)',
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function ChatPage() {
  const { data, isPending } = useChat()
  const { send, turn, error } = useChatActions()
  const [draft, setDraft] = useState('')
  const { messages, degraded, mode } = data

  const submit = () => {
    if (!draft.trim() || degraded || turn) return
    send(draft)
    setDraft('')
  }

  return (
    <div className="col gap-md">
      <div className="row gap-sm" style={{ justifyContent: 'space-between' }}>
        <div className="col">
          <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>Mezo · társ</span>
          <span className="text-tertiary" style={{ fontSize: 11, fontFamily: 'var(--ff-mono)' }}>
            {degraded ? 'a társ most nem elérhető' : SUBTITLE[mode]}
          </span>
        </div>
      </div>

      {degraded && (
        <div className="card" style={{ padding: 14 }}>
          <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
            A társ jelenleg nincs bekapcsolva — a beszélgetés nem elérhető. A napló, az edzés és a
            Fuel változatlanul működik.
          </p>
        </div>
      )}

      <div className="col gap-md" style={{ minHeight: 320 }}>
        {isPending && !degraded && messages.length === 0 && !turn && <ThinkingDots />}
        {messages.map((m, i) => (
          <ChatMessage key={i} m={m} />
        ))}
        {turn && <ChatMessage m={{ role: 'user', ts: 'most', text: turn.userText }} />}
        {turn && turn.thinking && <ThinkingDots />}
        {turn && !turn.thinking && turn.draft && (
          <ChatMessage m={{ role: 'assistant', ts: 'most', text: turn.draft }} />
        )}
        {error && (
          <div className="card" style={{ padding: 14, alignSelf: 'flex-start', maxWidth: '85%' }}>
            <p style={{ fontSize: 13, color: 'var(--text-primary)' }}>{error}</p>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" className="chip" style={{ padding: 8 }} aria-label="Hangbevitel">
          <Icon name="mic" size={14} />
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Mondj valamit..."
          disabled={degraded}
          style={{ flex: 1, padding: '8px 4px', fontSize: 13 }}
        />
        <button
          type="button"
          className="chip"
          onClick={submit}
          disabled={degraded}
          style={{ padding: 8, background: 'var(--wash-lav)', borderColor: 'var(--lav-deep)', color: 'var(--lav-deep)' }}
          aria-label="Küldés"
        >
          <Icon name="send" size={14} />
        </button>
      </div>
    </div>
  )
}
