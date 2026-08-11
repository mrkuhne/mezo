import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon } from '@/shared/ui/Icon'
import { NEW_CHAT, useChat, useChatActions, useConversations } from '@/data/hooks'
import { ChatMessage } from '@/features/insights/components/ChatMessage'
import { ConversationPickerSheet } from '@/features/insights/sheets/ConversationPickerSheet'
import { useStickToBottom } from '@/features/insights/logic/useStickToBottom'
import { useVoiceInput } from '@/features/insights/logic/useVoiceInput'
import { cn } from '@/shared/lib/cn'

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
  // Which conversation is on screen lives in the URL (`?c=<id>` / `?c=new`) — a shared link,
  // a back navigation and a reload all land on the same thread (mezo-at8x.3).
  const [params, setParams] = useSearchParams()
  const selection = params.get('c')
  const [pickerOpen, setPickerOpen] = useState(false)
  const { endRef, scrollToBottom, scrollIfStuck } = useStickToBottom<HTMLDivElement>()

  const selectConversation = (id: string | null) => {
    setParams(id ? { c: id } : {}, { replace: true })
  }

  const { data, isPending } = useChat(selection)
  const { conversations, degraded: companionOff } = useConversations().data
  const { send, turn, error } = useChatActions(selection, selectConversation)
  const [draft, setDraft] = useState('')
  // The transcript lands in the composer rather than being sent — the user checks it first.
  const voice = useVoiceInput((text) => setDraft((d) => (d ? `${d} ${text}` : text)))
  const recording = voice.state === 'recording'
  const { messages, mode } = data
  // The switch-off 404 can surface on either read; a draft thread makes no read of its own.
  const degraded = data.degraded || companionOff
  const isNew = selection === NEW_CHAT

  // Landing on the conversation (or gaining a message) parks the view on the newest turn —
  // a chat opens at the bottom, never at its first line (mezo-at8x.2).
  useEffect(() => {
    if (messages.length) scrollToBottom()
  }, [messages.length, scrollToBottom])

  // The user just sent something — follow it down unconditionally...
  useEffect(() => {
    if (turn?.userText) scrollToBottom()
  }, [turn?.userText, scrollToBottom])

  // ...but a streaming answer only pulls the view along while the user is still at the bottom.
  useEffect(() => {
    if (turn) scrollIfStuck()
  }, [turn, turn?.draft, turn?.tools.length, scrollIfStuck])

  const submit = () => {
    if (!draft.trim() || degraded || turn) return
    send(draft)
    setDraft('')
  }

  return (
    <div className="col gap-md chat-page">
      <div className="row gap-sm" style={{ justifyContent: 'space-between' }}>
        <div className="col">
          <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>Mezo · társ</span>
          <span className="text-tertiary" style={{ fontSize: 11 }}>
            {degraded ? 'a társ most nem elérhető' : isNew ? 'új beszélgetés' : SUBTITLE[mode]}
          </span>
        </div>
        <div className="row gap-xs">
          <button
            type="button"
            className="chip"
            style={{ padding: 8 }}
            onClick={() => setPickerOpen(true)}
            disabled={degraded}
            aria-label="Beszélgetések"
          >
            <Icon name="bookmark" size={14} />
          </button>
          <button
            type="button"
            className="chip"
            style={{ padding: 8 }}
            onClick={() => selectConversation(NEW_CHAT)}
            disabled={degraded || isNew}
            aria-label="Új beszélgetés"
          >
            <Icon name="plus" size={14} />
          </button>
        </div>
      </div>

      {pickerOpen && (
        <ConversationPickerSheet
          conversations={conversations}
          activeId={isNew ? null : (selection ?? data.conversationId)}
          onSelect={(id) => { selectConversation(id); setPickerOpen(false) }}
          onNew={() => { selectConversation(NEW_CHAT); setPickerOpen(false) }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {degraded && (
        <div className="card" style={{ padding: 14 }}>
          <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
            A társ jelenleg nincs bekapcsolva — a beszélgetés nem elérhető. A napló, az edzés és a
            Fuel változatlanul működik.
          </p>
        </div>
      )}

      <div className="col gap-md chat-thread">
        {isPending && !degraded && !isNew && messages.length === 0 && !turn && <ThinkingDots />}
        {!degraded && !isPending && messages.length === 0 && !turn && (
          <div className="card" style={{ padding: 14, alignSelf: 'flex-start', maxWidth: '85%' }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Új beszélgetés — kérdezz bármit, vagy mondd fel a mikrofonnal.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <ChatMessage key={i} m={m} />
        ))}
        {turn && <ChatMessage m={{ role: 'user', ts: 'most', text: turn.userText }} />}
        {/* mezo-280 (Finding 3): thinking flips false the moment a 'tool' event lands, well before
            the first 'delta' — gating on turn.draft instead keeps the dots visible next to the
            live chips through that gap, instead of an empty grey answer card. */}
        {turn && !turn.draft && <ThinkingDots />}
        {turn && !turn.thinking && (turn.draft || turn.tools.length > 0) && (
          <ChatMessage
            m={{
              role: 'assistant',
              ts: 'most',
              text: turn.draft,
              ...(turn.tools.length > 0 ? { tools: turn.tools } : {}),
            }}
          />
        )}
        {error && (
          <div className="card" style={{ padding: 14, alignSelf: 'flex-start', maxWidth: '85%' }}>
            <p style={{ fontSize: 13, color: 'var(--text-primary)' }}>{error}</p>
          </div>
        )}
        {/* The scroll anchor useStickToBottom pins the view to. */}
        <div ref={endRef} aria-hidden style={{ height: 1 }} />
      </div>

      {voice.error && (
        <p className="text-tertiary" style={{ fontSize: 11, textAlign: 'center' }}>{voice.error}</p>
      )}

      <div className="card chat-composer" style={{ padding: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          className={cn('chip', recording && 'chat-mic-live')}
          style={{
            padding: 8,
            ...(recording
              ? { background: 'var(--wash-amber)', borderColor: 'var(--coral-deep)', color: 'var(--coral-deep)' }
              : null),
          }}
          onClick={voice.toggle}
          disabled={degraded || voice.state === 'unsupported' || voice.state === 'transcribing'}
          aria-label={recording ? 'Felvétel leállítása' : 'Hangbevitel'}
          aria-pressed={recording}
        >
          <Icon name={recording ? 'voice-wave' : 'mic'} size={14} />
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={
            recording ? 'Hallgatlak…'
              : voice.state === 'transcribing' ? 'Leiratozom…'
                : 'Mondj valamit...'
          }
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
