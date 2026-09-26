import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '@/shared/ui/Icon'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { NEW_CHAT, useChat, useChatActions, useConversations, useFeedback, useMemoryRetrievalFeedback } from '@/data/hooks'
import { ChatMessage } from '@/features/insights/components/ChatMessage'
import { RememberedChips } from '@/features/insights/components/RememberedChips'
import { ToolWorkStrip } from '@/features/insights/components/ToolWorkStrip'
import { ConversationPickerSheet } from '@/features/insights/sheets/ConversationPickerSheet'
import { ConversationActionsSheet } from '@/features/insights/sheets/ConversationActionsSheet'
import type { ConversationResponse } from '@/data/insights/chatApi'
import { useStickToBottom } from '@/features/insights/logic/useStickToBottom'
import { useVoiceInput } from '@/features/insights/logic/useVoiceInput'
import { VoiceBubble } from '@/shared/ui/voice/VoiceBubble'
import { cn } from '@/shared/lib/cn'
import { QUICK_QUESTIONS } from '@/features/insights/logic/quickQuestions'

// Üveg (mezo-me75u.8): each quick question wears a 3D icon for its domain. Keyed by the copy so a
// reordered list keeps its icons; an unknown question falls back to the Mezo chat glyph.
const QQ_ICON: Record<string, Icon3DName> = {
  'Foglald össze a mai napom röviden': 't-sun',
  'Alvás és súly alapján mire figyeljek ma?': 't-sleep',
  'Hogy készüljek az esti edzésre?': 't-dumbbell',
  'Mit egyek ma este a maradék makróimba?': 't-bowl',
}

const SUBTITLE = { mock: 'demo beszélgetés', live: 'élő · Gemini' } as const

// A composer legfeljebb ennyire nő meg (~5 sor 13px/1.45-nél), utána a mező befelé görget —
// egy hosszú üzenet sem eszi meg az egész beszélgetést (mezo-a837).
const COMPOSER_MAX_HEIGHT = 104

// mezo-rj214.7: the Hungarian narration for each SSE/mock phase — the thinking bubble's only
// window into what the companion is doing before any draft text exists. An unknown phase value
// (future wire addition) renders nothing rather than a raw key — forward-compatible by silence.
const PHASE_COPY: Record<string, string> = {
  planning: 'átgondolom…',
  retrieving: 'megnézem az adataidat…',
  answering: 'fogalmazok…',
}

// `bare`: when ThinkingDots sits inside a caller-owned `.mzc-msg-a` wrapper (the tools-only
// streaming block below), it must not lay down a second `.mzc-msg-a` of its own — that widths
// compound (85% of 92%). Standalone callers leave it unset and get the bubble sizing as before.
function ThinkingDots({ bare, phase }: { bare?: boolean; phase?: string } = {}) {
  // Prototype typing bubble: orb-led meta row + three pulsing lavender dots in a
  // 4/16-radius bubble (mezo-d20.5.2). The .np-pulse animation stays the page's
  // reduced-motion-guarded pulse (prototype.css).
  const phaseLabel = phase ? PHASE_COPY[phase] : undefined
  return (
    <div className={bare ? 'col gap-sm mzc-think' : 'mzc-msg-a col gap-sm mzc-think'} style={bare ? undefined : { maxWidth: '85%' }}>
      <div className="mzc-meta">
        <Icon3D name="t-chat" size={20} />
        <span className="mzc-eb">Mezo</span>
      </div>
      <div className="mzc-typing">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="np-pulse"
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: 'var(--dv-lav)',
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
      {/* mezo-rj214.7: `.text-tertiary` is the file's own established muted-caption reuse
          (e.g. the quick-question captions) — no new CSS class or animation. */}
      {phaseLabel && <span className="text-tertiary mzc-phase" style={{ fontSize: 12 }}>{phaseLabel}</span>}
    </div>
  )
}

export function ChatPage() {
  // Which conversation is on screen lives in the URL (`?c=<id>` / `?c=new`) — a shared link,
  // a back navigation and a reload all land on the same thread (mezo-at8x.3).
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const selection = params.get('c')
  const [pickerOpen, setPickerOpen] = useState(false)
  // F7.5 (mezo-d20.8.5): which conversation the actions sheet (Átnevezés/Törlés) is open for.
  const [actionsFor, setActionsFor] = useState<ConversationResponse | null>(null)
  const { endRef, scrollToBottom, scrollIfStuck } = useStickToBottom<HTMLDivElement>()

  const selectConversation = (id: string | null) => {
    setParams(id ? { c: id } : {}, { replace: true })
  }

  const { data, isPending } = useChat(selection)
  const { conversations, degraded: companionOff } = useConversations().data
  const { send, turn, error, failedText, retry, editFailed } = useChatActions(selection, selectConversation)
  const [draft, setDraft] = useState('')
  const draftRef = useRef<HTMLTextAreaElement>(null)
  // The transcript lands in the composer rather than being sent — the user checks it first.
  const voice = useVoiceInput((text) => setDraft((d) => (d ? `${d} ${text}` : text)))
  const recording = voice.state === 'recording'
  const { messages, mode } = data
  // The switch-off 404 can surface on either read; a draft thread makes no read of its own.
  const degraded = data.degraded || companionOff
  const isNew = selection === NEW_CHAT

  // ONE feedback read for the whole thread (mezo-b3pp.15) — a per-bubble hook would fire one
  // HTTP request per answer. Only persisted assistant rows are votable: the in-flight draft has
  // no id yet, and a user bubble is not an AI artifact.
  const assistantIds = useMemo(
    () => messages.flatMap((m) => (m.role === 'assistant' && m.id ? [m.id] : [])),
    [messages],
  )
  const feedback = useFeedback('chat_message', assistantIds)

  // S3 (mezo-d6ivw.3): a „Megjegyeztem" chip csak az EBBEN a munkamenetben küldött körök után
  // fut — régi beszélgetés megnyitása nem indít utólagos tény-lekérdezést. A turn lezárultával
  // (refetch után) az utolsó user-üzenet perzisztált id-ja a forrás-hivatkozás.
  const armedRef = useRef(false)
  if (turn) armedRef.current = true
  const lastUserMsgId = useMemo(() => {
    if (turn || !armedRef.current) return null
    const last = [...messages].reverse().find((m) => m.role === 'user' && m.id)
    return last?.id ?? null
  }, [messages, turn])

  const recalledResultIds = useMemo(
    () => messages.flatMap((m) => (m.recalled ?? []).flatMap((r) => r.retrievalResultId ? [r.retrievalResultId] : [])),
    [messages],
  )
  const memoryFeedback = useMemoryRetrievalFeedback(recalledResultIds)

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

  // A mező textarea, hogy a hosszú üzenet TÖRJÖN, ne oldalra csússzon (mezo-a837): minden
  // változásnál egy sorra nullázzuk, majd a tartalom magasságára állítjuk — a maxHeight fölött
  // már a textarea saját görgetője viszi tovább.
  useLayoutEffect(() => {
    const el = draftRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT)}px`
  }, [draft])

  const submit = () => {
    if (!draft.trim() || degraded || turn) return
    send(draft)
    setDraft('')
  }

  // Companion-first handoff (mezo-7flr): the `/nap` composer navigates here with the message in
  // router state instead of running its own chat engine. We send it through THIS page's `send`
  // (one engine, one thread — the stream lives here where the reply shows) exactly once, then
  // strip the state so a reload or Back never re-sends. Skipped while degraded — the user then
  // just sees the "társ nem elérhető" bubble, with their text still typed.
  const handedOffRef = useRef(false)
  useEffect(() => {
    if (handedOffRef.current) return
    const compose = (location.state as { compose?: string } | null)?.compose
    if (!compose || degraded) return
    handedOffRef.current = true
    send(compose)
    navigate(location.pathname + location.search, { replace: true, state: null })
  }, [location, degraded, send, navigate])

  return (
    <div className="col gap-md chat-page mzc-u8">
      {/* mezo-vdf4: orb-led single-row header (ADR 0032 still holds — this IS the page's own
          header; the shell AppHeader stays above). Status precedence is the audited contract
          unchanged (degraded → new → mode), with one addition: a streaming turn reads
          `dolgozom rajta…`. */}
      <div className="mzc-chathead">
        <button type="button" className="mzc-hdisc glass is-round" onClick={() => navigate('/mezo')} aria-label="Vissza">
          ‹
        </button>
        <span className={cn('mzc-horb uv-well', turn && 'busy')}>
          <Icon3D name="t-chat" size={30} />
        </span>
        <span className="col grow" style={{ gap: 1, minWidth: 0 }}>
          <span className="mzc-hnm">Mezo</span>
          <span
            className="mzc-hstat"
            data-st={degraded ? 'off' : turn ? 'busy' : isNew ? 'new' : mode === 'live' ? 'live' : 'demo'}
          >
            <span className="mzc-hdot" />
            {degraded
              ? 'a társ most nem elérhető'
              : turn ? 'dolgozom rajta…' : isNew ? 'új beszélgetés' : SUBTITLE[mode]}
          </span>
        </span>
        <button
          type="button"
          className="mzc-hdisc glass is-round"
          onClick={() => setPickerOpen(true)}
          disabled={degraded}
          aria-label="Beszélgetések"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h10" />
          </svg>
        </button>
        <button
          type="button"
          className="mzc-hdisc is-new glass is-round"
          onClick={() => selectConversation(NEW_CHAT)}
          disabled={degraded || isNew}
          aria-label="Új beszélgetés"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        {/* F7.5: the current conversation's actions (Átnevezés/Törlés). Disabled on a draft
            thread — there is no persisted row to act on yet. The status precedence above is
            untouched: this disc only appends to the row. */}
        <button
          type="button"
          className="mzc-hdisc glass is-round"
          onClick={() => {
            const currentId = isNew ? null : (selection ?? data.conversationId)
            const current = conversations.find((c) => c.id === currentId)
            if (current) setActionsFor(current)
          }}
          disabled={degraded || isNew || !conversations.some((c) => c.id === (selection ?? data.conversationId))}
          aria-label="A beszélgetés műveletei"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="12" r="2.1" /><circle cx="12" cy="12" r="2.1" /><circle cx="19" cy="12" r="2.1" />
          </svg>
        </button>
      </div>

      {pickerOpen && (
        <ConversationPickerSheet
          conversations={conversations}
          activeId={isNew ? null : (selection ?? data.conversationId)}
          onSelect={(id) => { selectConversation(id); setPickerOpen(false) }}
          onNew={() => { selectConversation(NEW_CHAT); setPickerOpen(false) }}
          onClose={() => setPickerOpen(false)}
          onActions={(c) => { setPickerOpen(false); setActionsFor(c) }}
        />
      )}

      {actionsFor && (
        <ConversationActionsSheet
          conversation={actionsFor}
          onClose={() => setActionsFor(null)}
          onDeleted={() => {
            // Deleting the on-screen conversation moves the URL off the dead id — the newest
            // remaining thread takes over (or the empty state when none is left).
            const currentId = isNew ? null : (selection ?? data.conversationId)
            if (actionsFor.id === currentId) selectConversation(null)
          }}
        />
      )}

      {degraded && (
        <div className="mzc-degr">
          <p>
            A társ jelenleg nincs bekapcsolva — a beszélgetés nem elérhető. A napló, az edzés és a
            Fuel változatlanul működik.
          </p>
        </div>
      )}

      <div className="col gap-md chat-thread">
        {isPending && !degraded && !isNew && messages.length === 0 && !turn && <ThinkingDots />}
        {!degraded && !isPending && messages.length === 0 && !turn && (
          <div className="mzc-empty col">
            {/* Üveg: a frameless lavender halo hero (no card), then flat quick-question rows. */}
            <div className="mzc-emptyhero">
              <Icon3D name="t-chat" size={92} />
              <h2>Új beszélgetés</h2>
              <p>Kérdezz bármit, vagy koppints egy kérdésre.</p>
            </div>
            {/* mezo-dz3y: the quick-question chips — one tap sends. They live ONLY in the
                empty state (they leave with it), so a running thread pays no screen tax. */}
            <div className="mzc-qqs">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  className="mzc-qq"
                  onClick={() => send(q)}
                  disabled={degraded || !!turn}
                >
                  <Icon3D name={QQ_ICON[q] ?? 't-chat'} size={26} />
                  <span>{q}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Keyed by the persisted row id where there is one, so React never reuses one bubble's
            FeedbackChips instance — and its session-local reason-row state — for a different
            answer. Unpersisted rows (mock user bubbles) keep the positional fallback — they
            render no chips and only ever get appended to the end. */}
        {messages.map((m, i) => (
          <ChatMessage
            key={m.id ?? `idx-${i}`}
            m={m}
            memoryFeedback={memoryFeedback}
            feedback={
              m.role === 'assistant' && m.id
                ? {
                    value: feedback.get(m.id),
                    onVote: (verdict, reason) => feedback.vote(m.id!, verdict, reason),
                  }
                : undefined
            }
          />
        ))}
        {!turn && <RememberedChips userMessageId={lastUserMsgId} />}
        {turn && <ChatMessage m={{ role: 'user', ts: 'most', text: turn.userText }} />}
        {/* mezo-280 (Finding 3): thinking flips false the moment a 'tool' event lands, well before
            the first 'delta' — gating on turn.draft instead keeps the dots visible next to the
            live chips through that gap, instead of an empty grey answer card. The live work
            strip (mezo-vdf4) renders here too, next to the dots — once the draft starts
            streaming the second block below takes over and renders it non-live, inside the
            answer card. */}
        {turn && !turn.draft && (
          <div className="mzc-msg-a mzc-pending col gap-sm">
            {turn.tools.length > 0 && <ToolWorkStrip tools={turn.tools} live />}
            <ThinkingDots bare phase={turn.phase} />
          </div>
        )}
        {turn && !turn.thinking && turn.draft && (
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
          // F7.5: the error bubble grew hands — Újra re-sends the SAME failed turn (replace,
          // don't append), Szerkesztés hands the text back to the composer. Amber tone per the
          // prototype (a hiccup, not a scolding — ADR 0010).
          <div className="mzc-bub-err">
            <p>
              <b>{error}</b>
              {failedText ? ' Az üzeneted nem veszett el.' : ''}
            </p>
            {failedText && (
              <div className="mzc-errrow">
                <button type="button" className="mzc-ebtn go" onClick={retry}>
                  Újra
                </button>
                <button
                  type="button"
                  className="mzc-ebtn ghost"
                  onClick={() => {
                    const text = editFailed()
                    if (text) setDraft(text)
                    draftRef.current?.focus()
                  }}
                >
                  Szerkesztés
                </button>
              </div>
            )}
          </div>
        )}
        {/* The scroll anchor useStickToBottom pins the view to. */}
        <div ref={endRef} aria-hidden style={{ height: 1 }} />
      </div>

      <VoiceBubble voice={voice} domain="mezo" />

      {/* Prototype composer pill (mezo-d20.5.2): round mic disc · borderless field · lav
          gradient send disc. The sticky/`:has` plumbing keys off `.chat-composer`, so that
          class stays; controls honor the 44pt touch-target guardrail (prototype ~35px ×1.18). */}
      <div className="chat-composer mzc-composer glass is-still">
        <button
          type="button"
          className={cn('mzc-cmic', recording && 'rec chat-mic-live')}
          onClick={voice.toggle}
          disabled={degraded || voice.state === 'unsupported' || voice.state === 'transcribing'}
          aria-label={recording ? 'Felvétel leállítása' : 'Hangbevitel'}
          aria-pressed={recording}
        >
          {/* Recording keeps the line voice-wave: the 3D set has no "listening" glyph. */}
          {recording ? <Icon name="voice-wave" size={18} /> : <Icon3D name="t-mic" size={28} />}
        </button>
        <textarea
          ref={draftRef}
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          // Enter küld (mint eddig), Shift+Enter új sort tesz; IME-kompozíció közben egyik sem.
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
            e.preventDefault()
            submit()
          }}
          enterKeyHint="send"
          placeholder={
            recording ? 'Hallgatlak…'
              : voice.state === 'transcribing' ? 'Leiratozom…'
                : 'Mondj valamit…'
          }
          disabled={degraded}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '8px 4px',
            fontSize: 14,
            lineHeight: 1.45,
            resize: 'none',
            overflowY: 'auto',
            maxHeight: COMPOSER_MAX_HEIGHT,
          }}
        />
        <button
          type="button"
          className="mzc-csend"
          onClick={submit}
          disabled={degraded}
          aria-label="Küldés"
        >
          <Icon3D name="t-send" size={28} />
        </button>
      </div>
    </div>
  )
}
