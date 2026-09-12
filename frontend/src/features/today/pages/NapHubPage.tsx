// ============================================================
// Mezo · NapHubPage — a `/nap` nyitóoldal, companion-first (mezo-7flr)
// Source of truth: docs/superpowers/specs/2026-09-11-nap-mai-companion-first.md
// (owner directive 2026-09-11).
//
// The default landing is a PURE companion entry — nothing else competes with the
// presence:
//   1. the 3D companion (TitanCompanion / TitanScene) as the enlarged centrepiece,
//      its aura the Életjel gauge, a tap still opens the Életjelek surface;
//   2. a short daypart greeting (the "presence that knows me" line);
//   3. BELOW it a composer — a text field + a mic disc. Typing + send, or a
//      confirmed voice transcript, hands the message to the Mezo conversation and
//      takes the user INTO that conversation (`/mezo/chat`), where Mezo's reply
//      streams. The chat engine is reused verbatim (ChatPage's own `send`), via a
//      router-state handoff — no second chat engine, no duplicate thread.
//
// What LEFT the page (owner directive + mezo-jkh4 nav): the one next-step card, the
// six tiles (víz · alvás · étkezés · edzés · rutin · napló), the evening stat strip,
// the timed night door and the rough-day anchor tile mosaic. Every daily function
// those tiles reached is now reached through the navigation (shipped) — duplicating
// them here would fork the surface. The rough/anchor day keeps the SAME companion +
// composer, only with a calmer greeting and a quiet aura (no anchor tiles).
// ============================================================
import { useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@/shared/ui/Icon'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { cn } from '@/shared/lib/cn'
import { useTodayScenario } from '@/data/hooks'
import { useDayFace } from '@/features/today/logic/useDayFace'
import { useMinuteTick } from '@/features/today/logic/useMinuteTick'
import { useNeeds } from '@/features/today/logic/useNeeds'
import { useVoiceInput } from '@/features/insights/logic/useVoiceInput'
import { TitanCompanion } from '@/features/today/components/TitanCompanion'

// A composer legfeljebb ennyire nő meg (~5 sor 13px/1.45-nél), utána befelé görget —
// ugyanaz a korlát, mint a beszélgetés-felület mezőjén (ChatPage, mezo-a837).
const COMPOSER_MAX_HEIGHT = 104

export function NapHubPage() {
  const navigate = useNavigate()
  const scenario = useTodayScenario()
  const tick = useMinuteTick()
  // A `?dp=`-vagy-óra feloldás a shell fejlécével KÖZÖS (mezo-atry): egy hook, egy óra.
  const { face } = useDayFace()
  const needs = useNeeds(tick)

  const [draft, setDraft] = useState('')
  const draftRef = useRef<HTMLTextAreaElement>(null)
  // A leirat a mezőbe kerül, nem megy el azonnal — a felhasználó előbb ellenőrzi (ugyanaz a
  // szerződés, mint a beszélgetés-felületen). A szerveroldali leiratozó (useTranscribe) fut.
  const voice = useVoiceInput((text) => setDraft((d) => (d ? `${d} ${text}` : text)))
  const recording = voice.state === 'recording'

  // A mező TÖRJÖN, ne oldalra csússzon: minden változásnál egy sorra nullázzuk, majd a
  // tartalom magasságára állítjuk (ChatPage-idióma, mezo-a837).
  useLayoutEffect(() => {
    const el = draftRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT)}px`
  }, [draft])

  // Submit — typed vagy megerősített hang: átadjuk a szöveget a Mezo-beszélgetésnek és
  // ODAVISSZÜK a felhasználót, ahol a válasz megszületik. A küldést maga a ChatPage `send`-je
  // végzi (router-state handoff), így a stream a beszélgetés-felület saját motorjában él —
  // nincs második chat-motor, és a szál is EGY marad.
  const submit = () => {
    const text = draft.trim()
    if (!text) return
    navigate('/mezo/chat', { state: { compose: text } })
    setDraft('')
  }

  return (
    <div className="nap-hub nap-titan nap-companion-page">
      <EntranceGroup replayKey={face} className="mz-panel-stack nap-companion-stack">
        {/* ── a társ — a teljes képernyő közepén, csak a 3D elem (doboz, aura és
            köszöntő nélkül, owner 2026-09-11) ────────────────────────────── */}
        <div
          className={cn('nap-companion-hero rise', scenario.anchorMode && 'nap-titan-quiet')}
          data-kalauz-anchor="nap-hero"
          style={{ '--d': '0ms' } as React.CSSProperties}
        >
          <TitanCompanion states={needs.states} onOpenSignals={() => navigate('/nap/eletjel')} />
        </div>

        {/* ── a társhoz írni: mező + mikrofon, alul a menü fölött ─────────── */}
        <div className="nap-composer-wrap rise" style={{ '--d': '60ms' } as React.CSSProperties}>
          {voice.error && (
            <p className="nap-composer-err" role="alert">{voice.error}</p>
          )}
          <div className="mzc-composer nap-composer">
            <button
              type="button"
              className={cn('mzc-cmic', recording && 'rec chat-mic-live')}
              onClick={voice.toggle}
              disabled={voice.state === 'unsupported' || voice.state === 'transcribing'}
              aria-label={recording ? 'Felvétel leállítása' : 'Hangbevitel'}
              aria-pressed={recording}
            >
              <Icon name={recording ? 'voice-wave' : 'mic'} size={15} />
            </button>
            <textarea
              ref={draftRef}
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              // Enter küld, Shift+Enter új sort tesz; IME-kompozíció közben egyik sem.
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
                e.preventDefault()
                submit()
              }}
              enterKeyHint="send"
              placeholder={
                recording ? 'Hallgatlak…'
                  : voice.state === 'transcribing' ? 'Leiratozom…'
                    : 'Írj vagy mondj valamit Mezónak…'
              }
              style={{
                flex: 1,
                minWidth: 0,
                padding: '8px 4px',
                fontSize: 13,
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
              aria-label="Küldés"
            >
              <Icon name="send" size={15} />
            </button>
          </div>
        </div>
      </EntranceGroup>
    </div>
  )
}
