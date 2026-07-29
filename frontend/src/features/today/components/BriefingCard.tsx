// ============================================================
// Mezo · BriefingCard — the day's narrative, dressed in the shared `ItemCard`
// language (mezo-j7u4). The card has NO display title: the briefing's prose IS
// its body, so `title=""` (ItemCard renders no heading for an empty title) and
// the eyebrow tag carries `briefing.eyebrow`. Behaviour is unchanged from the
// `.card` version: collapsed → a two-line `.brief-clamp` preview + `bővebben`;
// expanded → full paragraphs, the „Hivatkozott" refs row, the honest
// „Demo tartalom" label (real mode) or the confidence %, and `összecsuk`.
// ============================================================
import { useState } from 'react'
import { RefTag } from '@/shared/ui/RefTag'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { ItemCard } from '@/shared/ui/ItemCard'
import type { Briefing } from '@/data/types'

export function BriefingCard({
  briefing,
  demo,
  facts = [],
}: {
  briefing: Briefing
  /** True in real mode — the prose is static demo copy, so the fabricated confidence % is replaced by an honest label. */
  demo?: boolean
  /** Caller-supplied `.metapill` facts (the day's numbers); falsy entries drop out. */
  facts?: readonly (string | null | undefined | false)[]
}) {
  const [expanded, setExpanded] = useState(false)

  // Same conditional as the `.card` version: demo label wins, then the confidence %,
  // and either only ever shows while expanded.
  const meta = demo ? (
    <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Demo tartalom</span>
  ) : briefing.confidence != null ? (
    <span className="label-mono" style={{ fontSize: 9 }}>Confidence {Math.round(briefing.confidence * 100)}%</span>
  ) : null

  return (
    <ItemCard
      tone="mind"
      emoji="✨"
      tag={briefing.eyebrow || 'Mezo · reggeli briefing'}
      title=""
      facts={facts}
      logged={false}
    >
      {expanded ? (
        <>
          {meta && (
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 6 }}>{meta}</div>
          )}
          <div className="col gap-md mt-md briefing-body">
            {briefing.body.map((p, i) => (
              <p key={i} style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--text-primary)' }}>
                <SafeMarkdown text={p.text} />
              </p>
            ))}
          </div>
          <div className="row gap-sm flex-wrap mt-lg" style={{ paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
            <span className="eyebrow text-tertiary" style={{ fontSize: 9 }}>Hivatkozott</span>
            {briefing.refs.map((r, i) => (
              <RefTag key={i} kind={r.kind} label={r.label} />
            ))}
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
            <button type="button" className="brief-more" onClick={() => setExpanded(false)}>összecsuk</button>
          </div>
        </>
      ) : (
        <div className="brief">
          <div className="brief-clamp">
            <SafeMarkdown text={briefing.body[0]?.text ?? ''} />
          </div>
          <button type="button" className="brief-more" onClick={() => setExpanded(true)}>bővebben</button>
        </div>
      )}
    </ItemCard>
  )
}
