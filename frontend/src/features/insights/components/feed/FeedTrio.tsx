import { useState } from 'react'
import { usePatternActions, useObservationReply } from '@/data/hooks'
import { AFTERLIFE, type FeedPost } from '@/features/insights/logic/teamFeed'
import { Icon3D } from '@/shared/ui/clay'
import type { FeedbackHandle } from '@/data/feedback/feedbackTypes'
import { useFeedSession, type FeedVote } from './useFeedSession'

/** Mit kér a hármas a laptól: „Elmesélem”, vagy a „Nem így érzem” visszakérdezése (spec §2.8). */
export type FeedReplyMode = 'tell' | 'down'

/**
 * Az egységes hármas (spec §2.8, mezo-a9bo7.8): Ez talál · Nem így érzem · Elmesélem — minden
 * poszton ugyanaz, a poszt forrása dönti el, mit jelent:
 *  - minta-kérdés (`decision`) → a meglévő minta-döntés (`usePatternActions().decide`);
 *  - észrevétel-kérdés (`observation`) → a meglévő chip-válasz (`useObservationReply`);
 *  - minden más → könnyű, munkamenetnyi visszajelzés (visszavonható, nem ír a szerverre).
 * Döntés után a hármas helyén az utóélet-címke áll. A „Nem így érzem” visszakérdez: a döntés
 * mellett a válasz-lapot is kéri, hogy a felhasználó elmondhassa, mi nem stimmel.
 */
export function FeedTrio({ post, onReply }: { post: FeedPost; onReply: (post: FeedPost, mode: FeedReplyMode) => void }) {
  const { decide, pending: decidePending } = usePatternActions()
  const { reply, pendingPatternId } = useObservationReply()
  const session = useFeedSession()
  const [error, setError] = useState('')

  const afterlife = post.afterlife ?? session.afterlife[post.id]?.label
  if (afterlife) {
    return (
      <span className="tf-after">
        <Icon3D name="t-tick" size={15} />
        {afterlife}
      </span>
    )
  }

  const busy = decidePending || (post.observation != null && pendingPatternId === post.observation.patternId)
  const vote = session.votes[post.id]

  async function answer(v: FeedVote) {
    setError('')
    if (post.decision) {
      decide(post.decision.patternId, v === 'up' ? 'confirm' : 'reject')
      session.settle(post, v === 'up' ? AFTERLIFE.confirm : AFTERLIFE.reject)
    } else if (post.observation) {
      try {
        await reply(post.observation.patternId, v === 'up' ? 'watch' : 'reject')
      } catch {
        setError('Nem sikerült elküldeni — próbáld újra egy kicsit később.')
        return
      }
      session.settle(post, v === 'up' ? AFTERLIFE.watch : AFTERLIFE.reject)
    } else {
      session.toggleVote(post.id, v)
    }
    if (v === 'down' && vote !== 'down') onReply(post, 'down')
  }

  return (
    <TrioButtons
      vote={vote}
      busy={busy}
      onVote={v => void answer(v)}
      onTell={() => onReply(post, 'tell')}
      labels={post.observation ? OBSERVATION_LABELS : undefined}
      error={error}
    />
  )
}

const DEFAULT_LABELS = { up: 'Ez talál', down: 'Nem így érzem', tell: 'Elmesélem' }
const OBSERVATION_LABELS = { up: 'Igen, ez igaz rám', down: 'Nem, ez nem stimmel', tell: 'Beszéljük meg' }

/** A hármas gombsora — egyetlen markup a fal posztjainak és a csapat-chat sorainak. */
function TrioButtons({ vote, busy, onVote, onTell, labels = DEFAULT_LABELS, error }: {
  vote: FeedVote | undefined
  busy: boolean
  onVote: (v: FeedVote) => void
  onTell: () => void
  labels?: { up: string; down: string; tell: string }
  error?: string
}) {
  return (
    <>
      <div className="tf-acts">
        <button type="button" aria-pressed={vote === 'up'} disabled={busy} onClick={() => onVote('up')}>
          <Icon3D name="t-thumb-up" size={19} />
          {labels.up}
        </button>
        <button type="button" aria-pressed={vote === 'down'} disabled={busy} onClick={() => onVote('down')}>
          <Icon3D name="t-thumb-down" size={19} />
          {labels.down}
        </button>
        <button type="button" disabled={busy} onClick={onTell}>
          <Icon3D name="t-chat" size={19} />
          {labels.tell}
        </button>
      </div>
      {error && <p className="tf-error" role="alert">{error}</p>}
    </>
  )
}

/**
 * Az egységes hármas egy szerver-oldali műterméken (csapat-chat sor, mezo-a9bo7.24): a 👍/👎 a
 * közös visszajelzés-csatornába megy (`useFeedback(kind, ids)` — a hívó oldal EGYSZER kéri le az
 * összes azonosítóra, és a kezelőt adja át), újra-koppintás visszavon. A „Nem így érzem” a fal
 * hármasához hasonlóan a válasz-lapot is kéri; az „Elmesélem” azt nyitja.
 */
export function ArtifactTrio({ feedback, artifactId, onReply }: {
  feedback: FeedbackHandle
  artifactId: string
  onReply: (mode: FeedReplyMode) => void
}) {
  const vote = feedback.get(artifactId)?.verdict
  return (
    <TrioButtons
      vote={vote}
      busy={false}
      onVote={v => {
        feedback.vote(artifactId, v)
        if (v === 'down' && vote !== 'down') onReply('down')
      }}
      onTell={() => onReply('tell')}
    />
  )
}
