import type { CSSProperties } from 'react'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { TILE, TILE_STATE } from '@/features/insights/logic/hubCopy'
import type { SectionLoadState } from '@/features/insights/logic/hubCounts'

export interface SectionState { state: SectionLoadState; total: number; sub: string; retry?: () => void }
export type HubSectionKey = 'tenyek' | 'emberek' | 'eszrevetelek' | 'hatasok'

const SKIN: Record<HubSectionKey, { title: string; icon: Icon3DName; c: string; offText: string }> = {
  tenyek: { title: TILE.facts, icon: 't-person', c: 'var(--dv-rose)', offText: TILE_STATE.offFacts },
  emberek: { title: TILE.people, icon: 't-people', c: 'var(--dv-lav)', offText: TILE_STATE.off },
  eszrevetelek: { title: TILE.observations, icon: 't-pattern', c: 'var(--dv-amber)', offText: TILE_STATE.off },
  hatasok: { title: TILE.effects, icon: 't-cowave', c: 'var(--dv-sky)', offText: TILE_STATE.off },
}

/**
 * S6 (mezo-d6ivw.6) — the hub's four section doors (prototype `tudastar()` tiles): one glass tile
 * per section, each with its own accent. A section that is loading, failed or switched off is a
 * dashed, inert tile with an em dash instead of a number — never an invented zero.
 */
export function HubTiles(p: {
  facts: SectionState
  people: SectionState
  observations: SectionState
  effects: SectionState
  onOpen: (v: HubSectionKey) => void
  /** S6c (mezo-2dfy2): on the Rólad page the first tile reads „Tények rólad” — a tile called
   *  „Rólad” ON the Rólad page would point at itself. */
  factsTitle?: string
}) {
  const tiles: Array<[HubSectionKey, SectionState]> = [
    ['tenyek', p.facts], ['emberek', p.people], ['eszrevetelek', p.observations], ['hatasok', p.effects],
  ]
  return (
    <div className="th-tiles">
      {tiles.map(([key, s], i) => {
        const skin = SKIN[key]
        const title = key === 'tenyek' && p.factsTitle ? p.factsTitle : skin.title
        const style = { '--c': skin.c, '--i': i + 1 } as CSSProperties
        if (s.state === 'ok') {
          return (
            <button key={key} type="button" className="th-tile glass lift rise" style={style} onClick={() => p.onOpen(key)}>
              <span className="top"><Icon3D name={skin.icon} size={34} /><b>{s.total}</b></span>
              <strong>{title}</strong><small>{s.sub}</small>
            </button>
          )
        }
        const text = s.state === 'off' ? skin.offText : s.state === 'error' ? TILE_STATE.error : TILE_STATE.loading
        return (
          <div key={key} className="th-tile is-dash rise" style={style} data-state={s.state}>
            <span className="top"><Icon3D name={skin.icon} size={34} /><b aria-hidden="true">—</b></span>
            <strong>{title}</strong><small>{text}</small>
            {s.state === 'error' && s.retry && (
              <button type="button" className="retry" onClick={s.retry}>{TILE_STATE.retry}</button>
            )}
          </div>
        )
      })}
    </div>
  )
}
