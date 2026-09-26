import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useFeedback, useTeamChat, useTeamChatActions } from '@/data/hooks'
import type { TeamChatDay, TeamChatLine, TeamChatThread } from '@/data/character/teamChatApi'
import type { FeedbackHandle } from '@/data/feedback/feedbackTypes'
import { TEAM, type TeamCharacterId } from '@/features/insights/logic/team'
import {
  TEAM_CHAT_LAST_SEEN_KEY,
  chips,
  clockOf,
  groupByDayPart,
  type DayPart,
} from '@/features/insights/logic/teamChat'
import { FeedAvatar } from '@/features/insights/components/feed/FeedPostHead'
import { ArtifactTrio, type FeedReplyMode } from '@/features/insights/components/feed/FeedTrio'
import { renderInline } from '@/shared/lib/markdown'
import { huMonthDay, huWeekdayFullIso, localDateString } from '@/shared/lib/dates'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { GlassBox } from '@/shared/ui/mozaik/GlassBox'
import { ScreenSkeleton } from '@/shared/ui/ScreenSkeleton'
import '@/features/insights/boop-world.css'

const PART_LABEL: Record<DayPart, string> = {
  REGGEL: 'Reggel',
  DÉLBEN: 'Délben',
  DÉLUTÁN: 'Délután',
  ESTE: 'Este',
  ÉJJEL: 'Éjjel',
}

const WATCHERS: TeamCharacterId[] = ['szunya', 'mocor', 'falat', 'deru', 'mezo']

const OWNER_ICON: Record<TeamChatThread['owner'], Icon3DName> = {
  szunya: 't-moon',
  mocor: 't-bolt',
  falat: 't-bowl',
  deru: 't-sun',
  mezo: 't-orb',
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const lineAnchor = (lineId: string) => `tc-${lineId}`

/** Every ügy the page knows about — the OPEN line's embedded snapshot plus the open list. */
function threadIndex(day: TeamChatDay): Map<string, TeamChatThread> {
  const map = new Map<string, TeamChatThread>()
  for (const l of day.lines) if (l.thread) map.set(l.thread.id, l.thread)
  for (const t of day.openThreads) if (!map.has(t.id)) map.set(t.id, t)
  return map
}

function statusLabel(t: TeamChatThread): string {
  if (t.status === 'RESOLVED') return t.closedAt ? `rendeződött ${clockOf(t.closedAt)}` : 'rendeződött'
  if (t.status === 'EXPIRED') return 'lejárt'
  return 'nyitott'
}

interface ReplyTarget {
  thread: TeamChatThread
  mode: FeedReplyMode
}

/**
 * A csapat beszél (Csapatfal Act III, mezo-a9bo7.24) — a csapat élő beszélgetése: a nap sorai
 * napszakok szerint, minden ügy nyitó sora alatt az ügy címkéje, az értesítés-jel, a „Miből
 * látszik?”, az egységes hármas és az ügy ajánlott lépései. Rangsor: EGY üveg (a „Rád vár” sáv),
 * minden üzenet lapos buborék. A karakter-mondatokat a szerver írja; a UI semmit nem fogalmaz
 * hozzá (ADR 0049).
 */
export function TeamChatPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const raw = params.get('d')
  const requested = raw && DAY_RE.test(raw) ? raw : undefined
  const { day, loading } = useTeamChat(requested)
  const { reply, apply, pending } = useTeamChatActions()
  const openLineIds = useMemo(() => day.lines.filter(l => l.kind === 'OPEN').map(l => l.id), [day.lines])
  const feedback = useFeedback('team_chat_line', openLineIds)
  const [evidence, setEvidence] = useState<TeamChatLine | null>(null)
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null)
  // Only a CONFIRMED apply lands here (never before the server said yes — honesty); the
  // server's own `thread.applied` wins once the refetch brings it.
  const [applied, setApplied] = useState<Record<string, string>>({})
  const [applyError, setApplyError] = useState<Record<string, boolean>>({})

  const today = localDateString()
  const isToday = requested == null || requested === today

  // A fal élő sávja ebből számolja az olvasatlanokat — csak a MAI szoba megnyitása számít látottnak.
  useEffect(() => {
    if (!isToday) return
    try {
      localStorage.setItem(TEAM_CHAT_LAST_SEEN_KEY, new Date().toISOString())
    } catch {
      /* privát mód / tiltott tároló: az olvasatlan-szám legfeljebb nem nullázódik */
    }
  }, [isToday])

  // Betöltés-kapu AZ ÜRES-ÁLLAPOT ELŐTT (TeamFeedPage precedens): félkész adatból nem villan fel „csend van”.
  if (loading) return <ScreenSkeleton />

  const threads = threadIndex(day)
  const groups = groupByDayPart(day.lines)
  const c = chips(day)
  const waiting = [...day.openThreads].sort((a, b) => Date.parse(a.openedAt) - Date.parse(b.openedAt))[0]
  const waitingLine = waiting ? day.lines.find(l => l.kind === 'OPEN' && l.threadId === waiting.id) : undefined

  const toWaiting = () => {
    if (!waiting) return
    if (waitingLine) {
      document.getElementById(lineAnchor(waitingLine.id))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      navigate(`/mezo/elo?d=${localDateString(new Date(waiting.openedAt))}`)
    }
  }
  const onApply = async (thread: TeamChatThread, key: string) => {
    setApplyError(e => ({ ...e, [thread.id]: false }))
    try {
      await apply(thread.id, key)
      setApplied(a => ({ ...a, [thread.id]: key }))
    } catch {
      setApplyError(e => ({ ...e, [thread.id]: true }))
    }
  }

  const small = isToday
    ? `Ma · élőben · ${huWeekdayFullIso(day.date)}`
    : `${huMonthDay(day.date)} · ${huWeekdayFullIso(day.date)}`

  return (
    <div className="tf-page">
      <div className="tf-dhead">
        <Link to="/mezo" className="tf-back tf-chat-back" aria-label="Vissza a falra">‹</Link>
        <span className="tf-dtitle"><small>{small}</small><strong>A csapat beszél</strong></span>
      </div>

      {isToday && (
        <div className="tf-chat-live">
          <i className="tf-chat-ldot" aria-hidden="true" />
          Mind az öten figyelnek — akkor szólnak, ha teendő van
          <span className="tf-chat-minis" aria-hidden="true">
            {WATCHERS.map(id => <FeedAvatar key={id} id={id} size={18} />)}
          </span>
        </div>
      )}

      <div className="tf-chat-chips">
        <div className="tf-chips">
          <span className={c.open > 0 ? 'is-warn' : undefined}>{c.open} nyitott ügy</span>
          <span className="is-good">{c.resolved} rendeződött</span>
          <span>{isToday ? 'értesítés ma' : 'értesítés aznap'}: {c.pushes}</span>
        </div>
      </div>

      {waiting && (
        <button type="button" className="glass tf-strip tf-c-lav" onClick={toWaiting}>
          <Icon3D name={OWNER_ICON[waiting.owner]} size={24} />
          <span className="tf-strip-text tf-chat-strip-text">
            Rád vár: <b>{waiting.ruleLabel}</b> —{' '}
            {waitingLine
              ? `${TEAM[waiting.owner].name} ${clockOf(waiting.openedAt)}-kor szólt.`
              : `${TEAM[waiting.owner].name} figyeli.`}
          </span>
          <em className="tf-strip-count">{waitingLine ? 'Ugrás' : 'Megnézem'}</em>
        </button>
      )}

      {groups.length === 0 ? (
        <p className="tf-note">
          {isToday
            ? 'Ma még csend van — a csapat akkor szól, ha valamit tenned kell.'
            : 'Ezen a napon csend volt — nem akadt teendő.'}
        </p>
      ) : (
        groups.map((g, i) => (
          <section key={`${g.part}-${i}`} aria-label={PART_LABEL[g.part]}>
            <div className="tf-day"><span>{PART_LABEL[g.part]}</span></div>
            {g.lines.map(l => (
              <ChatLine
                key={l.id}
                line={l}
                thread={l.threadId ? threads.get(l.threadId) : undefined}
                feedback={feedback}
                applied={l.threadId ? applied[l.threadId] : undefined}
                applyFailed={l.threadId ? applyError[l.threadId] === true : false}
                busy={pending}
                onEvidence={() => setEvidence(l)}
                onReply={(thread, mode) => setReplyTo({ thread, mode })}
                onApply={onApply}
              />
            ))}
          </section>
        ))
      )}

      {waiting && (
        <div className="tf-chat-reply">
          <button type="button" className="tf-rrow" onClick={() => setReplyTo({ thread: waiting, mode: 'tell' })}>
            <span className="tf-me">Te</span>
            Te hogy látod? Válaszolj…
            <Icon3D name="t-send" size={18} />
          </button>
        </div>
      )}

      <EvidenceSheet line={evidence} thread={evidence?.threadId ? threads.get(evidence.threadId) : undefined} onClose={() => setEvidence(null)} />
      <ChatReplySheet target={replyTo} onSend={(t, text) => reply(t.id, text)} onClose={() => setReplyTo(null)} />
    </div>
  )
}

function ChatLine({ line, thread, feedback, applied, applyFailed, busy, onEvidence, onReply, onApply }: {
  line: TeamChatLine
  thread: TeamChatThread | undefined
  feedback: FeedbackHandle
  applied: string | undefined
  applyFailed: boolean
  busy: boolean
  onEvidence: () => void
  onReply: (thread: TeamChatThread, mode: FeedReplyMode) => void
  onApply: (thread: TeamChatThread, key: string) => Promise<void>
}) {
  const time = clockOf(line.occurredAt)
  if (line.kind === 'USER' || line.character == null) {
    return (
      <div className="tf-chat-cm is-me" id={lineAnchor(line.id)}>
        <div className="tf-chat-bub">
          <span className="tf-chat-nm">Te<em>{time}</em></span>
          <p className="tf-chat-tx">{line.body}</p>
        </div>
      </div>
    )
  }

  const who = TEAM[line.character]
  const guest = line.kind === 'GUEST' || line.kind === 'SKEPTIC'
  const opens = line.kind === 'OPEN' && thread != null
  const live = opens && thread.status === 'OPEN'
  const appliedKey = thread?.applied ?? applied ?? null
  const appliedAction = appliedKey ? thread?.actions.find(a => a.key === appliedKey) : undefined

  return (
    <div className={`tf-chat-cm tf-c-${who.accent}${guest ? ' is-guest' : ''}`} id={lineAnchor(line.id)}>
      <FeedAvatar id={who.id} size={guest ? 20 : 30} />
      <div className="tf-chat-cb">
        <div className="tf-chat-bub">
          <span className="tf-chat-nm">
            {who.name}
            {!guest && who.area && <small>{who.area}</small>}
            <em>{time}</em>
          </span>
          <p className="tf-chat-tx">{renderInline(line.body, { boldOnly: true })}</p>
        </div>

        {opens && (
          <div className="tf-chat-tag">
            <span className={`tf-st ${thread.status === 'RESOLVED' ? 'tf-s-sage' : `tf-s-${who.accent}`}`}>
              {thread.ruleLabel} · {statusLabel(thread)}
            </span>
            {thread.pushed ? (
              <span className="tf-chat-pm"><Icon3D name="t-bell" size={14} />értesítettünk · {clockOf(thread.openedAt)}</span>
            ) : (
              <span className="tf-chat-pm"><Icon3D name="t-clock" size={14} />csendben</span>
            )}
            <button type="button" className="tf-chat-ev" onClick={onEvidence}>Miből látszik?</button>
          </div>
        )}
        {line.kind === 'RESOLVE' && (
          <div className="tf-chat-tag">
            <span className="tf-st tf-s-sage">Rendeződött · {time}</span>
            <span className="tf-chat-pm"><Icon3D name="t-clock" size={14} />csendben · a lezárás sosem értesít</span>
            <button type="button" className="tf-chat-ev" onClick={onEvidence}>Miből látszik?</button>
          </div>
        )}

        {live && (
          <>
            <ArtifactTrio feedback={feedback} artifactId={line.id} onReply={mode => onReply(thread, mode)} />
            {appliedAction ? (
              <span className="tf-after"><Icon3D name="t-tick" size={15} />Beállítva: {appliedAction.label}</span>
            ) : (
              thread.actions.length > 0 && (
                <div className="tf-chat-apply">
                  {thread.actions.map(a => (
                    <button key={a.key} type="button" disabled={busy} onClick={() => void onApply(thread, a.key)}>
                      <Icon3D name="t-tick" size={18} />
                      {a.label}
                    </button>
                  ))}
                </div>
              )
            )}
            {applyFailed && !appliedAction && (
              <p className="tf-error" role="alert">Nem sikerült beállítani — próbáld újra egy kicsit később.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/** „Miből látszik?” — a sor tényei (a mondat csak ezekből a számokból dolgozhatott), az ügy
 *  neve, és a motor napi naplója a Gépteremben. */
function EvidenceSheet({ line, thread, onClose }: { line: TeamChatLine | null; thread: TeamChatThread | undefined; onClose: () => void }) {
  const who = line?.character ? TEAM[line.character] : null
  return (
    <GlassBox
      open={line != null}
      onClose={onClose}
      label={thread?.ruleLabel ?? 'Miből látszik?'}
      eyebrow={line ? `${who ? `${who.name} · ` : ''}${clockOf(line.occurredAt)} · miből látszik` : undefined}
      tint="var(--dv-lav)"
      art={<Icon3D name={thread ? OWNER_ICON[thread.owner] : 't-info'} size={30} />}
    >
      {line && (
        <div className="tf-reply">
          {line.facts.length > 0 ? (
            <>
              <p className="tf-reply-intro">Ezekből a számokból született a mondat:</p>
              <ul className="tf-chat-facts">
                {line.facts.map(f => <li key={f}>{f}</li>)}
              </ul>
            </>
          ) : (
            <p className="tf-reply-intro">Ehhez a sorhoz nem tartozik külön szám — az ügy nyitó sora mutatja, miből indult.</p>
          )}
          <p className="tf-reply-note">
            {line.voiced
              ? 'A mondatot a karakter hangján írtuk meg, de csak ezek a számok szerepelhetnek benne. Ha az ellenőrzés elbukik, a nyers szabály-szöveg jelenik meg.'
              : 'Ez a szabály nyers szövege — most nem a karakter hangján szól.'}
          </p>
          <Link to="/mezo/coaching/megfigyelo" className="tf-source tf-c-lav">
            <Icon3D name="t-info" size={18} />
            A motor naplója a Gépteremben →
          </Link>
        </div>
      )}
    </GlassBox>
  )
}

const REPLY_INTRO: Record<FeedReplyMode, string> = {
  tell: 'Mi az, amit csak te tudhatsz erről? A válaszod az ügyhöz kerül, a csapat látja — lezárni viszont csak az adataid tudják.',
  down: 'Mi nem stimmel? Ebből tanulunk a legtöbbet — írd meg a saját szavaiddal, az ügyhöz kerül.',
}

/** Az „Elmesélem” / „Nem így érzem” lapja a csapat-chatben — a válasz az ügybe íródik. Csak a
 *  SIKERES mentés után zár be; hibánál a szöveg megmarad, és kimondjuk, hogy nem ment el. */
function ChatReplySheet({ target, onSend, onClose }: {
  target: ReplyTarget | null
  onSend: (thread: TeamChatThread, text: string) => Promise<void>
  onClose: () => void
}) {
  const thread = target?.thread
  return (
    <GlassBox
      open={target != null}
      onClose={onClose}
      label={target?.mode === 'down' ? 'Mi nem stimmel?' : 'Elmesélem'}
      eyebrow={thread ? `${thread.ruleLabel} · ${TEAM[thread.owner].name} ügye` : undefined}
      tint="var(--dv-lav)"
      art={<Icon3D name="t-chat" size={30} />}
    >
      {target && (
        // A kulcs az ügy: másik ügyre váltva a félig írt szöveg nem vándorol át.
        <ReplyComposer key={target.thread.id} target={target} onSend={onSend} onClose={onClose} />
      )}
    </GlassBox>
  )
}

function ReplyComposer({ target, onSend, onClose }: {
  target: ReplyTarget
  onSend: (thread: TeamChatThread, text: string) => Promise<void>
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const send = async () => {
    const t = text.trim()
    if (!t || sending) return
    setError('')
    setSending(true)
    try {
      await onSend(target.thread, t)
      setText('')
      onClose()
    } catch {
      setError('Nem sikerült elküldeni — a szöveged megmaradt, próbáld újra egy kicsit később.')
    } finally {
      setSending(false)
    }
  }
  return (
    <div className="tf-reply">
      <p className="tf-reply-intro">{REPLY_INTRO[target.mode]}</p>
      <textarea
        className="tf-reply-text"
        aria-label="A válaszod"
        placeholder="Például: tegnap későn értem haza, azért csúszott a lefekvés…"
        value={text}
        onChange={e => setText(e.target.value)}
      />
      {error && <p className="tf-error" role="alert">{error}</p>}
      <button type="button" className="glass tf-send tf-c-lav" disabled={sending || !text.trim()} onClick={() => void send()}>
        <Icon3D name="t-send" size={22} />
        Válasz küldése
      </button>
    </div>
  )
}
