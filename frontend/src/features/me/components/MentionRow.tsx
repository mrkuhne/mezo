import { Icon } from '@/shared/ui/Icon'
import type { IconName } from '@/shared/ui/Icon'
import type { Mention, MentionSource } from '@/data/types'

function sourceIconFor(source: MentionSource): IconName {
  switch (source) {
    case 'voice':
      return 'mic'
    case 'camera':
      return 'camera'
    case 'chip':
      return 'check'
    case 'text':
      return 'send'
    case 'chat':
      return 'me'
    default:
      return 'anchor'
  }
}

/**
 * Mozaik re-face (mezo-d20.6.7) — prototype en-body .mrowt: a washed mention
 * tile (time · name · source · FIGYELEM), the italic excerpt, and the
 * `kapcsolódik` pattern-tie chip. Behavioral contract unchanged: FIGYELEM only
 * on `mention.flagged`, the tie chip only when `mention.tiedTo` is present.
 */
export function MentionRow({
  mention,
  delayMs,
  onUndo,
}: {
  mention: Mention
  delayMs?: number
  onUndo?: (mention: Mention) => void
}) {
  const sourceIcon = sourceIconFor(mention.source)
  const style = delayMs !== undefined ? ({ '--d': `${delayMs}ms` } as React.CSSProperties) : undefined
  const undoable = onUndo && (mention.source === 'text' || mention.source === 'chat')

  return (
    <div className="ppl-mrowt rise" style={style}>
      <div className="ppl-mtop">
        <span className="ppl-mtime">{mention.timeLabel} · {mention.dayLabel}</span>
        <span className="ppl-mname">{mention.personName}</span>
        <span className="ppl-msrc">
          <Icon name={sourceIcon} size={10} />
          {mention.duration_s ? `${mention.duration_s}s` : mention.source}
        </span>
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
