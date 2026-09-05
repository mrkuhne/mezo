import { useState } from 'react'
import { Icon } from '@/shared/ui/Icon'
import { ClayIcon } from '@/shared/ui/clay'
import { memoryIcon } from '@/features/insights/logic/toolDomains'
import type { ChatRecalledMemory } from '@/data/types'
import type { MemoryRetrievalFeedbackHandle } from '@/data/hooks'

/** W3.1b (mezo-b3pp.28): what ambient recall put in front of the model before it answered —
 *  collapsed by default (the answer is the point; this is its provenance). mezo-vdf4 face:
 *  the expanded rows became a horizontally scrollable lavender card strip (type icon + date
 *  + similarity ring + clamped gist; a tapped card widens and unclamps). Copy and disclosure
 *  behavior are unchanged. */
export function RecalledMemoriesRow({
  items,
  feedback,
}: {
  items: ChatRecalledMemory[]
  feedback?: MemoryRetrievalFeedbackHandle
}) {
  const [open, setOpen] = useState(false)
  const [openCard, setOpenCard] = useState<number | null>(null)
  const [confirmSuppress, setConfirmSuppress] = useState<string | null>(null)
  if (items.length === 0) return null
  return (
    <div className="mzc-memwrap col gap-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mzc-membtn row gap-xs"
        title="Ezekre emlékezett a társ a válasz előtt (W3.1 ambient recall)"
        aria-expanded={open}
      >
        <span className="mzc-memeb">
          <Icon name="sparkle" size={10} /> Emlékek · {items.length}
        </span>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={10} color="var(--text-tertiary)" />
      </button>
      {open && (
        <div className="mzc-memcards">
          {items.map((r, i) => {
            const actionable = Boolean(feedback && r.retrievalRunId && r.retrievalResultId)
            const suppressible = actionable && Boolean(r.memoryItemId)
            const stored = actionable ? feedback?.get(r.retrievalResultId!) : undefined
            const suppressed = stored?.action === 'suppress'
            return (
              <article
                key={r.retrievalResultId ?? `${r.kind}-${r.occurredOn}-${i}`}
                className={[
                  'mzc-memcard',
                  openCard === i ? 'open' : '',
                  actionable ? 'feedback' : '',
                  suppressed ? 'suppressed' : '',
                ].filter(Boolean).join(' ')}
              >
                <button
                  type="button"
                  className="mzc-memcard-body"
                  aria-label={`Emlék megnyitása: ${r.label}`}
                  aria-expanded={openCard === i}
                  onClick={() => setOpenCard(openCard === i ? null : i)}
                >
                  <span className="mzc-memtop">
                    <span className="mzc-memic"><ClayIcon name={memoryIcon(r.kind)} size={13} /></span>
                    <span className="mzc-memkt">
                      <span className="mzc-memkind">{r.label}</span>
                      <span className="mzc-memd">{r.occurredOn || 'dátum nélkül'}</span>
                    </span>
                    <span
                      className="mzc-simr"
                      style={{ ['--v' as string]: Math.round(r.similarity * 100) }}
                    >
                      <span className="mzc-simr-n">{Math.round(r.similarity * 100)}</span>
                    </span>
                  </span>
                  {r.indicator && <span className="mzc-memindicator">{r.indicator}</span>}
                  <span className="mzc-memgist">{r.gist}</span>
                </button>
                {actionable && !suppressed && (
                  <div className="mzc-memactions" aria-label="Visszajelzés erről az emlékről" role="group">
                    <button
                      type="button"
                      aria-pressed={stored?.action === 'useful'}
                      disabled={feedback!.pending}
                      onClick={() => feedback!.act(r.retrievalRunId!, r.retrievalResultId!, 'useful')}
                    >
                      Hasznos
                    </button>
                    <button
                      type="button"
                      aria-pressed={stored?.action === 'irrelevant'}
                      disabled={feedback!.pending}
                      onClick={() => feedback!.act(r.retrievalRunId!, r.retrievalResultId!, 'irrelevant')}
                    >
                      Nem ide tartozik
                    </button>
                    {suppressible && (
                      <button
                        type="button"
                        className={confirmSuppress === r.retrievalResultId ? 'confirm' : 'danger'}
                        disabled={feedback!.pending}
                        onClick={() => {
                          if (confirmSuppress !== r.retrievalResultId) {
                            setConfirmSuppress(r.retrievalResultId!)
                            return
                          }
                          feedback!.act(r.retrievalRunId!, r.retrievalResultId!, 'suppress')
                          setConfirmSuppress(null)
                        }}
                      >
                        {confirmSuppress === r.retrievalResultId
                          ? 'Biztosan ne használd többé?'
                          : 'Ne használd többé'}
                      </button>
                    )}
                  </div>
                )}
                {suppressed && <span className="mzc-memstatus">Nem lesz többé használva</span>}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
