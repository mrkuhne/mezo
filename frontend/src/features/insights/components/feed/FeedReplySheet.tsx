import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCharacterReplies, useCharacterReplyDraft, useObservationReply } from '@/data/hooks'
import type { CharacterReplySource } from '@/data/character/characterApi'
import { TEAM } from '@/features/insights/logic/team'
import type { FeedPost } from '@/features/insights/logic/teamFeed'
import { Icon3D } from '@/shared/ui/clay'
import { GlassBox } from '@/shared/ui/mozaik/GlassBox'
import type { FeedReplyMode } from './FeedTrio'

export interface FeedReplyTarget {
  post: FeedPost
  mode: FeedReplyMode
}

const INTRO: Record<FeedReplyMode, string> = {
  tell: 'Mi az, amit csak te tudhatsz erről? A válaszod a témához kerül, és a csapat újraértékeli vele a képet.',
  down: 'Mi nem stimmel? Ebből tanulunk a legtöbbet — írd meg a saját szavaiddal, a csapat feljegyzi.',
}

/** A küldés utáni folyamat-előnézet — a prototípus három lépése (uveg-uzenofal.html). */
function NextSteps() {
  return (
    <div className="tf-steps" role="status">
      <p className="tf-steps-title"><Icon3D name="t-sprout" size={28} />Megvan — köszönjük!</p>
      <ol>
        <li><strong>A válaszod a témánál marad</strong> — a te szavaiddal, forrásként megjelölve.</li>
        <li><strong>A csapat újraértékel</strong> — megnézik, melyik magyarázatot erősíti vagy gyengíti.</li>
        <li><strong>Ha új tudás születik</strong>, külön megmutatjuk — te hagyod jóvá, mielőtt bekerül a rólad szóló képbe.</li>
      </ol>
    </div>
  )
}

function Composer({ value, onChange, onSend, sendLabel, pending, error }: {
  value: string
  onChange: (text: string) => void
  onSend: () => void
  sendLabel: string
  pending: boolean
  error: string
}) {
  return (
    <>
      <textarea
        className="tf-reply-text"
        aria-label="A válaszod"
        placeholder="Például: két este későig dolgoztam, azért csúszott a vacsora…"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {error && <p className="tf-error" role="alert">{error}</p>}
      <button type="button" className="glass tf-send tf-c-lav" disabled={pending || !value.trim()} onClick={onSend}>
        <Icon3D name="t-send" size={22} />
        {sendLabel}
      </button>
    </>
  )
}

/** Karakter-poszt: a meglévő hozzászólás-szál (vázlat a query-cache-ben, idempotens kérés-azonosító). */
function ThreadReply({ source }: { source: CharacterReplySource }) {
  const { send, pending } = useCharacterReplies(source)
  const { draft, setDraft, requestId, clearDraft } = useCharacterReplyDraft(source)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  if (sent) return <NextSteps />
  async function submit() {
    const text = draft.trim()
    if (!text) return
    setError('')
    const id = requestId()
    try {
      await send(text, id)
      clearDraft(id)
      setSent(true)
    } catch {
      setError('Nem sikerült menteni. A szöveged megmaradt, próbáld újra.')
    }
  }
  return <Composer value={draft} onChange={setDraft} onSend={() => void submit()} sendLabel="Válasz küldése" pending={pending} error={error} />
}

/** Észrevétel-kérdés: a meglévő „Mesélj erről” ág — a beszélgetésbe visz, ahol a csapat folytatja. */
function ObservationTalk({ patternId }: { patternId: string }) {
  const { reply, pendingPatternId } = useObservationReply()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  if (sent) return <NextSteps />
  async function submit() {
    setError('')
    try {
      const res = await reply(patternId, 'talk', text.trim())
      if (res.conversationId) navigate(`/mezo/chat?c=${encodeURIComponent(res.conversationId)}`)
      else setSent(true)
    } catch {
      setError('Nem sikerült elküldeni. A szöveged megmaradt, próbáld újra.')
    }
  }
  return <Composer value={text} onChange={setText} onSend={() => void submit()} sendLabel="Válasz küldése" pending={pendingPatternId === patternId} error={error} />
}

/** Nincs saját válasz-szál (minta, kísérlet, előrejelzés): őszintén a beszélgetésbe visz, a poszttal. */
function ChatHandoff({ post }: { post: FeedPost }) {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const compose = [post.title, post.body, text.trim()].filter(Boolean).join('\n\n')
  return (
    <>
      <p className="tf-reply-note">Ehhez a bejegyzéshez még nincs külön válasz-szál — Booppal beszéled meg, a bejegyzés szövegével együtt.</p>
      <Composer
        value={text}
        onChange={setText}
        onSend={() => navigate('/mezo/chat', { state: { compose } })}
        sendLabel="Tovább a beszélgetésbe"
        pending={false}
        error=""
      />
    </>
  )
}

/** Az „Elmesélem” / „Nem így érzem” lapja (spec §2.8) — a poszt forrása választja a csatornát. */
export function FeedReplySheet({ target, onClose }: { target: FeedReplyTarget | null; onClose: () => void }) {
  const post = target?.post
  return (
    <GlassBox
      open={target != null}
      onClose={onClose}
      label={target?.mode === 'down' ? 'Mi nem stimmel?' : 'Elmesélem'}
      eyebrow={post ? `${TEAM[post.author].name} kérdezi` : undefined}
      tint="var(--dv-lav)"
      art={<Icon3D name="t-chat" size={44} />}
    >
      {target && post && (
        <div className="tf-reply" key={`${post.id}:${target.mode}`}>
          <p className="tf-reply-intro">{INTRO[target.mode]}</p>
          {post.thread ? (
            <ThreadReply source={post.thread} />
          ) : post.observation ? (
            <ObservationTalk patternId={post.observation.patternId} />
          ) : (
            <ChatHandoff post={post} />
          )}
        </div>
      )}
    </GlassBox>
  )
}
