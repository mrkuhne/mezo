import { useEffect, useRef, type CSSProperties } from 'react'
import { cn } from '@/shared/lib/cn'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { Toggle } from '@/shared/ui/Toggle'
import { factCategoryLabel } from '@/data/insights/knowledge'
import {
  humanizeFactText, originChipLabel, originSentence, promptStatusLabel, reinforcementSentence,
  type FactBucket,
} from '@/features/insights/logic/factCopy'
import type { FactCategory, KnowledgeFact } from '@/data/types'

/** Üveg (U9 · mezo-me75u.9): kategória → 3D ikon + akcentus (prototype `CAT`): edzés égkék
 *  súlyzó · étkezés zsálya tál · egészség rózsa szív · élet borostyán nap. */
const CATEGORY_SKIN: Record<FactCategory, { icon: Icon3DName; accent: string }> = {
  train: { icon: 't-dumbbell', accent: 'var(--dv-sky)' },
  fuel: { icon: 't-bowl', accent: 'var(--dv-sage)' },
  health: { icon: 't-heart', accent: 'var(--dv-rose)' },
  life: { icon: 't-sun', accent: 'var(--dv-amber)' },
}

/**
 * Egy tény a Tudástárban (mezo-9ryh · üveg U9 mezo-me75u.9) — egy lapos `tf-tlist` sor a
 * kategória 3D ikonjával és soronkénti kapcsolóval; a kikapcsolt tény halkul. Önmagyarázó
 * marad: mit tud rólad a társ, honnan tudja, hányszor jött vissza magától, és épp bekerül-e a
 * chat elé. Minden mondat a `logic/factCopy` tiszta moduljából jön; a komponens csak propokat kap.
 */
export function KnowledgeFactRow({ fact, bucket, onToggle, highlight = false }: {
  fact: KnowledgeFact
  bucket: FactBucket
  onToggle: () => void
  /** T10 (mezo-ms9a): a `?fact=<id>` deep link egyszeri kiemelése — a hívó (FactsView) dönti el,
   *  hogy EZ a sor a célzott. Mountkor középre görget és egy egyszeri sárgás CSS-animációt kap
   *  (`tud9-hl`, prototype.css üveg-blokk); az osztály önmagában ártalmatlan (nincs `!important`,
   *  a `.off` variánssal is összefér). */
  highlight?: boolean
}) {
  const skin = CATEGORY_SKIN[fact.category]
  const title = humanizeFactText(fact.text)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (highlight) ref.current?.scrollIntoView({ block: 'center' })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot mount-centring per row instance
  }, [])

  return (
    <div
      ref={ref}
      data-fact-row
      data-cat={fact.category}
      data-bucket={bucket}
      className={cn('tf-trow tud9-fact', !fact.active && 'off', highlight && 'tud9-hl')}
      style={{ '--c': skin.accent } as CSSProperties}
    >
      <Icon3D name={skin.icon} size={24} />
      <span className="tf-ttx">
        <span className="tf-ttitle">{title}</span>
        <span className="tf-tsub">
          <span className="tud9-cat">{factCategoryLabel(fact.category).toLowerCase()}</span>
          {' · '}
          <span>{reinforcementSentence(fact.reinforced, fact.lastReinforcedAt)}</span>
          {' · '}
          <span>{originChipLabel(fact.source)}</span>
        </span>
        {/* A minta-eredet mondata marad kiírva (kereshető minta-címmel — factCopy.matchesQuery);
            chat/kézi tényeknél az eredet-chip már elmondja ugyanezt, ott nem ismételjük. */}
        {fact.source === 'pattern' && <span className="tud9-origin">{originSentence(fact)}</span>}
        <span className={cn('tud9-status', bucket === 'in-prompt' && 'is-in')}>{promptStatusLabel(bucket)}</span>
      </span>
      <Toggle glass on={fact.active} onToggle={onToggle} ariaLabel={`${title} — bekerül a chatbe`} />
    </div>
  )
}
