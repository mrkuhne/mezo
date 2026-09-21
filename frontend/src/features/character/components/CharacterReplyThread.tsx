import { useEffect, useRef, useState } from 'react'
import { useCharacterReplies, useCharacterReplyDraft, useCharacterExperts } from '@/data/hooks'
import type { CharacterReplySource } from '@/data/character/characterApi'
import { PersonaOrb } from '@/features/character/components/PersonaOrb'
import { CharacterExpertComment } from '@/features/character/components/CharacterExpertComment'

const STATUS_LABEL = {
  SAVED: 'Válaszod mentve · feldolgozásra vár',
  PROCESSING: 'Válaszod mentve · a csapat mérlegeli',
  FAILED: 'A válaszod mentve. A feldolgozás most nem sikerült.',
  NEEDS_CLARIFICATION: 'A csapat még kérdez',
  COMPLETED: 'Feldolgozva',
} as const
export function CharacterReplyThread({
  source,
  initialOpen = false,
  openSignal = 0,
}: {
  source: CharacterReplySource
  initialOpen?: boolean
  openSignal?: number
}) {
  const { replies, pending, isLoading, isError, refetch, send, retry } = useCharacterReplies(source)
  const { experts } = useCharacterExperts()
  const [open, setOpen] = useState(initialOpen)
  const { draft, setDraft, requestId, clearDraft } = useCharacterReplyDraft(source)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const textarea = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (openSignal > 0) setOpen(true)
  }, [openSignal])
  useEffect(() => {
    if (open) textarea.current?.focus()
  }, [open])
  async function submit() {
    const text = draft.trim()
    if (!text || pending) return
    setError('')
    setSaved(false)
    const submittedId = requestId()
    try {
      await send(text, submittedId)
      clearDraft(submittedId)
      setSaved(true)
    } catch {
      setError('Nem sikerült menteni. A szöveged megmaradt, próbáld újra.')
    }
  }
  async function retryProcessing(id: string) {
    setError('')
    try {
      await retry(id)
    } catch {
      setError('Nem sikerült újraindítani. A mentett válaszod megmaradt.')
    }
  }
  return (
    <div className="kr-reply-thread">
      {isLoading && <small role="status">Hozzászólások betöltése…</small>}
      {isError && (
        <p role="alert">
          A hozzászólások nem töltődtek be.{' '}
          <button type="button" onClick={refetch}>
            Újratöltés
          </button>
        </p>
      )}
      {replies.map((reply) => (
        <div className="kr-reply-pair" key={reply.id}>
          <div className="kr-social-comment">
            <span className="kr-self-avatar">Te</span>
            <div>
              <strong>
                {reply.authorName || 'Te'}{' '}
                <small>Saját közlés · {new Date(reply.createdAt).toLocaleDateString('hu-HU')}</small>
              </strong>
              <p>{reply.text}</p>
              <small className="kr-reply-status" role="status">
                {STATUS_LABEL[reply.status]}
              </small>
            </div>
          </div>
          {reply.discussion?.map((reaction, index) => <CharacterExpertComment key={`${reply.id}-${index}`} reaction={reaction} experts={experts} />)}
          {reply.outcomeText && (
            <div className="kr-social-comment is-mezo">
              <PersonaOrb expertKey="mezo" size={28} />
              <div>
                <strong>
                  Mezo <small>A válaszod alapján</small>
                </strong>
                <p>{reply.outcomeText}</p>
                {reply.status === 'COMPLETED' &&
                  (reply.outcome === 'UPDATED' || reply.outcome === 'WITHDRAWN') && (
                    <span className="kr-reply-reward">Közösen pontosítva</span>
                  )}
              </div>
            </div>
          )}
          {(reply.status === 'FAILED' ||
            ((reply.status === 'SAVED' || reply.status === 'PROCESSING') &&
              Date.now() - Date.parse(reply.createdAt) > 300_000)) && (
            <button
              type="button"
              className="kr-retry"
              disabled={pending}
              onClick={() => void retryProcessing(reply.id)}
            >
              Feldolgozás újra
            </button>
          )}
        </div>
      ))}
      {!open ? (
        <button type="button" className="kr-quick-reply" onClick={() => setOpen(true)}>
          <span className="kr-self-avatar">Te</span>
          <span>Te hogy látod? Válaszolj…</span>
          <span aria-hidden="true">↗</span>
        </button>
      ) : (
        <form
          className="kr-reply-composer"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <label>
            Válasz a bejegyzésre
            <textarea
              ref={textarea}
              aria-label="Mit pontosítanál?"
              placeholder="Mit pontosítanál?"
              maxLength={2000}
              value={draft}
              disabled={pending}
              onChange={(event) => {
                setDraft(event.target.value)
                setSaved(false)
              }}
            />
          </label>
          <div>
            <small>A válaszod bekerül a közös tudásba.</small>
            <button type="submit" className="cta" disabled={pending || !draft.trim()}>
              {pending ? 'Mentés…' : 'Küldés'}
            </button>
          </div>
        </form>
      )}
      {saved && (
        <p className="kr-reply-saved" role="status">
          Válaszod mentve. A feldolgozás eredménye itt jelenik meg.
        </p>
      )}
      {error && (
        <p role="alert" className="kr-reply-error">
          {error}
        </p>
      )}
    </div>
  )
}
