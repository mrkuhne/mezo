import type { CSSProperties } from 'react'
import { Icon } from '@/shared/ui/Icon'
import { ClayIcon } from '@/shared/ui/clay'
import type { Mention, PersonEntry } from '@/data/types'
import { CTX_META, SRC_META } from '@/features/me/logic/peopleVisuals'

/** Prototype `.mrowt.tw-*` wash keys, keyed by `Mention.tone` — mixed/neutral never carry
 *  the same wash: 'neutral'/undefined rows are intentionally left unwashed (the honest
 *  "no tone yet" state), never defaulted to a color that would imply a night-run verdict
 *  that hasn't happened. */
const TONE_WASH: Partial<Record<NonNullable<Mention['tone']>, string>> = {
  positive: 'ppl-tw-jo',
  mixed: 'ppl-tw-vegyes',
  negative: 'ppl-tw-nehez',
}

/**
 * Emberek S3 Említések (mezo-06o0.2 Task 5) — port of emberek-body.html feedHtml()'s
 * `.mrowt` row: a tone-washed tile carrying the source disc, a mini person avatar, the
 * context chip, FIGYELEM pulse, and the automata-only undo (✕). Rewritten interface vs.
 * the S2 shape — `person` is now optional (the row falls back to the mention's own
 * `personName` initial when the caller has no PersonEntry at hand, e.g. an archived
 * person), and the source disc/context chip now come straight from Task 1's SRC_META/
 * CTX_META rather than a locally re-derived icon map.
 */
export function MentionRow({
  mention,
  person,
  delayMs,
  onUndo,
}: {
  mention: Mention
  person?: PersonEntry
  delayMs?: number
  onUndo?: (mention: Mention) => void
}) {
  const src = SRC_META[mention.source]
  const ctx = mention.contextLabel ? CTX_META[mention.contextLabel] : null
  const wash = mention.tone ? TONE_WASH[mention.tone] : undefined
  const initial = person?.initial ?? mention.personName.charAt(0)
  const style = delayMs !== undefined ? ({ '--d': `${delayMs}ms` } as CSSProperties) : undefined
  const undoable = onUndo && (mention.source === 'text' || mention.source === 'chat')

  return (
    <div className={`ppl-mrowt${wash ? ` ${wash}` : ''} rise`} style={style}>
      <div className="ppl-mtop">
        <span className="ppl-srcdisc" title={src.label}>
          {src.clay ? <ClayIcon name={src.clay} size={13} /> : <Icon name={src.icon ?? 'anchor'} size={12} />}
        </span>
        <span className="ppl-mavat">{initial}</span>
        <span className="ppl-mname">{mention.personName}</span>
        <span className="ppl-msrc">{mention.timeLabel} · {src.label}</span>
        {ctx && (
          <span
            className="ppl-ctxch"
            style={{ background: `color-mix(in srgb, var(${ctx.cssVar}) 16%, transparent)`, color: `var(${ctx.cssVar})` } as CSSProperties}
          >
            {ctx.label}
          </span>
        )}
        {mention.flagged && <span className="ppl-figy">FIGYELEM</span>}
        {undoable && (
          <button
            type="button"
            className="ppl-mundo"
            aria-label="Említés visszavonása"
            onClick={() => onUndo(mention)}
          >
            <Icon name="x" size={10} />
          </button>
        )}
      </div>
      <p className="ppl-mx">„{mention.excerpt}”</p>
      {mention.tiedTo && (
        <div className="ppl-mtie">
          <span className="ppl-mtielbl">kapcsolódik</span>
          <span className="ppl-mtiechip">{mention.tiedTo.label}</span>
        </div>
      )}
    </div>
  )
}
