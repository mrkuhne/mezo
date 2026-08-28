import { cn } from '@/shared/lib/cn'
import { ClayIcon, type ClayIconName } from '@/shared/ui/clay'
import { Toggle } from '@/shared/ui/Toggle'
import { factCategoryLabel } from '@/data/insights/knowledge'
import {
  humanizeFactText, originChipLabel, originSentence, promptStatusLabel, reinforcementSentence,
  type FactBucket,
} from '@/features/insights/logic/factCopy'
import type { FactCategory, KnowledgeFact } from '@/data/types'

/** Kategória → Mozaik wash + clay ikon + tinta (iterációk §1: edzés korall · egészség
 *  borostyán · élet égkék; az étkezés a Fuel domain zsályáját beszéli). */
const CATEGORY_SKIN: Record<FactCategory, { wash: string; icon: ClayIconName; ink: string }> = {
  train: { wash: 'mz-w-coral', icon: 'i-edzes', ink: 'var(--mz-cell-coral-ink)' },
  fuel: { wash: 'mz-w-sage', icon: 'i-fuel', ink: 'var(--mz-cell-sage-ink)' },
  health: { wash: 'mz-w-gold', icon: 'i-eletjel', ink: 'var(--mz-cell-amber-ink)' },
  life: { wash: 'mz-w-sky', icon: 'i-nap', ink: 'var(--mz-cell-sky-ink)' },
}

/**
 * Egy tény a Tudástárban (mezo-9ryh · re-face mezo-d20.5.5) — kategória-mosott csempe
 * clay ikon-koronggal és soronkénti kapcsolóval (prototype mezo-body .facttile); a
 * kikapcsolt tény szaggatott csempére halkul. Önmagyarázó marad: mit tud rólad a társ,
 * honnan tudja, hányszor jött vissza magától, és épp bekerül-e a chat elé. Minden mondat
 * a `logic/factCopy` tiszta moduljából jön; a komponens csak propokat kap.
 */
export function KnowledgeFactRow({ fact, bucket, onToggle }: {
  fact: KnowledgeFact
  bucket: FactBucket
  onToggle: () => void
}) {
  const skin = CATEGORY_SKIN[fact.category]
  const title = humanizeFactText(fact.text)

  return (
    <div className={cn('mz-facttile', fact.active ? skin.wash : 'off')}>
      <span className="mz-fic"><ClayIcon name={skin.icon} size={21} /></span>
      <div className="mz-fact-grow">
        <p className="mz-fact-tx">{title}</p>
        <p className="mz-fact-sb">
          <span style={{ color: fact.active ? skin.ink : undefined, fontWeight: 700 }}>
            {factCategoryLabel(fact.category).toLowerCase()}
          </span>
          {' · '}
          <span>{reinforcementSentence(fact.reinforced, fact.lastReinforcedAt)}</span>
          {' · '}
          <span>{originChipLabel(fact.source)}</span>
        </p>
        {/* A minta-eredet mondata marad kiírva (kereshető minta-címmel — factCopy.matchesQuery);
            chat/kézi tényeknél az eredet-chip már elmondja ugyanezt, ott nem ismételjük. */}
        {fact.source === 'pattern' && <p className="mz-fact-origin">{originSentence(fact)}</p>}
        <p className="mz-fact-status">{promptStatusLabel(bucket)}</p>
      </div>
      <Toggle on={fact.active} onToggle={onToggle} ariaLabel={`${title} — bekerül a chatbe`} />
    </div>
  )
}
