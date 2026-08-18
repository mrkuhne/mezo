import { Toggle } from '@/shared/ui/Toggle'
import { factCategoryColor, factCategoryLabel } from '@/data/insights/knowledge'
import {
  humanizeFactText, originChipLabel, originSentence, promptStatusLabel, reinforcementSentence,
  type FactBucket,
} from '@/features/insights/logic/factCopy'
import type { KnowledgeFact } from '@/data/types'

/**
 * Egy tény a Tudástárban (mezo-9ryh) — önmagyarázó kártya: mit tud rólad a társ, honnan tudja,
 * hányszor jött vissza magától, és hogy épp bekerül-e a chat elé. Minden mondat a
 * `logic/factCopy` tiszta moduljából jön; a komponens csak propokat kap.
 */
export function KnowledgeFactRow({ fact, bucket, onToggle }: {
  fact: KnowledgeFact
  bucket: FactBucket
  onToggle: () => void
}) {
  const color = factCategoryColor(fact.category)
  const title = humanizeFactText(fact.text)

  return (
    <div
      className="card"
      style={{ padding: '12px 14px 12px 16px', position: 'relative', opacity: fact.active ? 1 : 0.6 }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: color }} />

      <div className="row gap-sm" style={{ alignItems: 'center', marginBottom: 6 }}>
        <span className="label-mono" style={{ fontSize: 9, color }}>{factCategoryLabel(fact.category)}</span>
        <span className="text-tertiary" style={{ fontSize: 9 }}>·</span>
        <span className="text-tertiary" style={{ fontSize: 9.5 }}>{originChipLabel(fact.source)}</span>
      </div>

      <p style={{ fontSize: 15, lineHeight: 1.4, color: 'var(--text-primary)', margin: 0 }}>{title}</p>

      <p className="text-secondary" style={{ fontSize: 12, lineHeight: 1.5, margin: '6px 0 0' }}>
        {originSentence(fact)}
      </p>

      <p className="text-tertiary" style={{ fontSize: 11, margin: '4px 0 0', fontVariantNumeric: 'tabular-nums' }}>
        {reinforcementSentence(fact.reinforced, fact.lastReinforcedAt)}
      </p>

      <div
        className="row"
        style={{
          justifyContent: 'space-between', alignItems: 'center', gap: 10,
          marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)',
        }}
      >
        <span style={{ fontSize: 12, color: fact.active ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
          {promptStatusLabel(bucket)}
        </span>
        <Toggle on={fact.active} onToggle={onToggle} ariaLabel={`${title} — bekerül a chatbe`} />
      </div>
    </div>
  )
}
