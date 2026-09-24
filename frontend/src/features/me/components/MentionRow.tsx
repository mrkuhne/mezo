import type { CSSProperties } from 'react'
import { Icon3D } from '@/shared/ui/clay'
import type { Mention, PersonEntry } from '@/data/types'
import { CTX_META, SRC_META, toneColor } from '@/features/me/logic/peopleVisuals'

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
 *
 * Üveg (mezo-me75u.7, prototype `emlitesek()` `.mention`): a SECONDARY list, so the row is a
 * flat tone-edged cell, never glass — the wash class paints a 3px tone edge + a faint tone tint
 * (`--tc`). Top line: the source's 3D icon, the tone-ringed mini avatar, name, time · source,
 * the undo ✕ in a flat round button. Under the quote ONE wrapping chip line: the context chip,
 * the coral FIGYELEM pill, the „kapcsolódik" tie chip.
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
  const style = {
    '--pc': toneColor(person?.affect_baseline ?? 'neutral'),
    ...(wash && mention.tone ? { '--tc': toneColor(mention.tone) } : {}),
    ...(delayMs !== undefined ? { '--d': `${delayMs}ms` } : {}),
  } as CSSProperties
  const undoable = onUndo && (mention.source === 'text' || mention.source === 'chat')
  const hasChips = Boolean(ctx || mention.flagged || mention.tiedTo)

  return (
    <div className={`ppl-mrowt${wash ? ` ${wash}` : ''} rise`} style={style}>
      <div className="ppl-mtop">
        <span className="ppl-srcdisc" title={src.label}>
          <Icon3D name={src.art} size={22} />
        </span>
        <span className="ppl-mavat">{initial}</span>
        <span className="ppl-mname">{mention.personName}</span>
        <span className="ppl-msrc">{mention.timeLabel} · {src.label}</span>
        {undoable && (
          <button
            type="button"
            className="ppl-mundo"
            aria-label="Említés visszavonása"
            onClick={() => onUndo(mention)}
          >
            <span aria-hidden="true">✕</span>
          </button>
        )}
      </div>
      <p className="ppl-mx">„{mention.excerpt}”</p>
      {hasChips && (
        <div className="ppl-mchips">
          {ctx && (
            <span className="ppl-ctxch" style={{ '--dc': `var(${ctx.cssVar})` } as CSSProperties}>
              {ctx.label}
            </span>
          )}
          {mention.flagged && <span className="ppl-figy">FIGYELEM</span>}
          {mention.tiedTo && (
            <span className="ppl-mtie">
              <Icon3D name="t-link" size={16} />
              <span className="ppl-mtielbl">kapcsolódik</span>
              <span className="ppl-mtiechip">{mention.tiedTo.label}</span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
