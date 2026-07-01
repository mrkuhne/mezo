import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { useChat } from '@/data/hooks'
import type { ChatMessage as ChatMessageT } from '@/data/types'
import { ChatMessage } from '@/features/insights/components/ChatMessage'

export function ChatView() {
  const { initialChat } = useChat()
  const [messages, setMessages] = useState<ChatMessageT[]>(initialChat)
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)

  const send = () => {
    const text = draft.trim()
    if (!text) return
    setMessages((m) => [...m, { role: 'user', ts: 'now', text }])
    setDraft('')
    setThinking(true)
    setTimeout(() => {
      setThinking(false)
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          ts: 'now',
          text:
            'Értem — és köszönöm hogy megosztottad. ' +
            (text.toLowerCase().includes('fáradt')
              ? 'A Reta D3-on ez gyakori; ne erőltessük a Pull Day-t ma. Egy könnyű walk és egy fehérje-snack többet adhat mint egy fél-erővel csinált edzés.'
              : 'Nézzük meg az adatokat: az elmúlt 3 napban a kalória-pacing 80%+ volt, és a Reta D3 ablakban ez stabil — innen indulhatunk.'),
          tools: [
            { type: 'read', name: 'get_recent_checkins(d=3)' },
            { type: 'compute', name: `recallSharedMemory(theme='${text.slice(0, 20)}')` },
          ],
          refs: [{ kind: 'CheckIn', id: 'ci-2026-05-21' }],
        },
      ])
    }, 1200)
  }

  return (
    <div className="col gap-md">
      <div className="row gap-sm" style={{ justifyContent: 'space-between' }}>
        <div className="col">
          <span className="eyebrow brand">Mezo · társ</span>
          <span className="text-tertiary" style={{ fontSize: 11, fontFamily: 'var(--ff-mono)' }}>
            23 facts active · Gemini 3.1 Pro
          </span>
        </div>
        <span className="chip brand" style={{ fontSize: 9 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand-glow)' }} />
          L4 aktív
        </span>
      </div>

      <div className="col gap-md" style={{ minHeight: 320 }}>
        {messages.map((m, i) => (
          <ChatMessage key={i} m={m} />
        ))}
        {thinking && (
          <div className="col gap-sm" style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
            <span className="eyebrow brand">Mezo</span>
            <div className="card notch-12" style={{ padding: 14 }}>
              <div className="row gap-xs">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--brand-glow)',
                      animation: `pulse-soft 1.2s ease-in-out infinite ${i * 0.2}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card notch-12" style={{ padding: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" className="chip" style={{ padding: 8 }} aria-label="Hangbevitel">
          <Icon name="mic" size={14} />
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Mondj valamit..."
          style={{ flex: 1, padding: '8px 4px', fontSize: 13 }}
        />
        <button type="button" className="chip brand" onClick={send} style={{ padding: 8 }} aria-label="Küldés">
          <Icon name="send" size={14} />
        </button>
      </div>
    </div>
  )
}
