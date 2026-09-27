import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Icon3D } from '@/shared/ui/clay'
import { useCountUp } from '@/shared/ui/mozaik/motion'
import { HubTiles } from '@/features/insights/components/hub/HubTiles'
import type { HubCounts } from '@/features/insights/logic/hubCounts'
import { HERO, LINKS, TILE_STATE } from '@/features/insights/logic/hubCopy'

export type HubNavTarget = 'tenyek' | 'emberek' | 'eszrevetelek' | 'hatasok' | 'kategoriak' | 'hogyan'

/**
 * S6 (mezo-d6ivw.6) — the Tudástár hub (prototype `uveg-tudastar-hub.html` `tudastar()`): a
 * frameless hero numeral of everything Mezo knows (an observation and its fact counted once), the
 * on/muted split, an honesty note, the four section tiles, and quiet secondary links (the Rólad
 * decision pointer, Kategóriák, Hogyan tanul?). Candidates are decided on the Rólad page only.
 */
export function KnowledgeBaseView(props: {
  pendingCount: number
  counts: HubCounts
  onNavigate: (view: HubNavTarget) => void
}) {
  const { pendingCount, counts, onNavigate } = props
  const shown = useCountUp(counts.total)
  const lk = (i: number) => ({ '--i': i } as CSSProperties)

  return (
    <>
      <div className="th-hero rise">
        <Icon3D name="t-brain" size={80} className="art" />
        {counts.hero !== 'number' ? (
          <span className="big is-wait" aria-live="polite">
            {counts.hero === 'loading' ? TILE_STATE.loading : HERO.unavailable}
          </span>
        ) : (
          <span className="big" data-total={counts.total}>{shown}</span>
        )}
        <h1>{HERO.title}</h1>
        <p>{HERO.sub}</p>
        {counts.hero === 'number' && (
          <div className="th-split">
            <span><i /><b>{counts.total - counts.muted}</b> {HERO.on}</span>
            <span><i className="o" /><b>{counts.muted}</b> {HERO.off}</span>
          </div>
        )}
      </div>
      {counts.hero === 'number' && (
        <p className="th-fn th-hero-note">{counts.note}</p>
      )}

      <HubTiles {...counts.sections} onOpen={onNavigate} />

      <div className="th-links rise" style={lk(5)}>
        {pendingCount > 0 && (
          <Link to="/mezo/rolad" className="th-lk">
            <Icon3D name="t-bell" size={26} />
            <span><b>{LINKS.pending(pendingCount)}</b><small>{LINKS.pendingSub}</small></span>
            <span className="chev" aria-hidden="true">›</span>
          </Link>
        )}
        <button type="button" className="th-lk" onClick={() => onNavigate('kategoriak')}>
          <Icon3D name="t-graph" size={26} />
          <span><b>{LINKS.kategoriak}</b><small>{LINKS.kategoriakSub}</small></span>
          <span className="chev" aria-hidden="true">›</span>
        </button>
        <button type="button" className="th-lk" onClick={() => onNavigate('hogyan')}>
          <Icon3D name="t-info" size={26} />
          <span><b>{LINKS.hogyan}</b><small>{LINKS.hogyanSub}</small></span>
          <span className="chev" aria-hidden="true">›</span>
        </button>
      </div>
    </>
  )
}
