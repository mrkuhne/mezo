import { describe, expect, it } from 'vitest'
import { habitAnchorOptions, MEZO_EVENT_ANCHORS } from '@/features/me/logic/habitAnchors'
import type { HabitCatalog, HabitDefInfo } from '@/data/types'

function def(id: string, habitKey: string, title: string, isActive = true): HabitDefInfo {
  return {
    id, habitKey, chainKey: 'MORNING', position: 1, title, why: null, anchorCopy: null,
    mode: 'MANUAL', metric: 'manual', skillKey: 'mindset', xp: 5, linkUrl: null, isActive,
    framework: null, anchorHabitKey: null, cue: null, craving: null, reward: null,
    celebration: null, identity: null,
  }
}

const catalog: HabitCatalog = {
  chains: [{
    id: 'c1', chainKey: 'MORNING', title: 'Reggeli rutin', daypart: 'MORNING',
    position: 1, isActive: true,
    defs: [def('d1', 'sun', 'Reggeli fény'), def('d2', 'water', 'Hidratálás'), def('d3', 'old', 'Szünetel', false)],
  }],
}

describe('habitAnchorOptions', () => {
  it('offers the active habits first, then the mezo events', () => {
    const options = habitAnchorOptions(catalog)
    expect(options.slice(0, 2)).toEqual([
      { label: 'kész a Reggeli fény', source: 'SZOKÁS', habitKey: 'sun' },
      { label: 'kész a Hidratálás', source: 'SZOKÁS', habitKey: 'water' },
    ])
    expect(options.filter((o) => o.source === 'MEZO')).toEqual(MEZO_EVENT_ANCHORS)
  })

  it('drops paused habits and the def being edited', () => {
    const labels = habitAnchorOptions(catalog, 'd1').map((o) => o.label)
    expect(labels).not.toContain('kész a Reggeli fény')
    expect(labels).not.toContain('kész a Szünetel')
  })
})
