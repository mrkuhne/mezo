import { describe, expect, it } from 'vitest'
import { stackAnchorOf, ropeKindOf } from '@/features/me/logic/chainStacking'
import type { HabitDefInfo } from '@/data/types'

function def(habitKey: string, over: Partial<HabitDefInfo> = {}): HabitDefInfo {
  return {
    id: `d-${habitKey}`, habitKey, chainKey: 'MORNING', position: 1, title: habitKey,
    why: null, anchorCopy: null, mode: 'MANUAL', metric: 'manual', skillKey: 'mindset',
    xp: 5, linkUrl: null, isActive: true, framework: null, anchorHabitKey: null,
    cue: null, craving: null, reward: null, celebration: null, identity: null, ...over,
  }
}

// Egy lánc: viz → feny → mozgas; a feny a vizhez kötve (linked), a mozgas a vizhez (foreign),
// a naplo egy MÁSIK lánc szokásához.
const viz = def('viz', { title: 'Egy pohár víz' })
const feny = def('feny', { title: 'Reggeli fény', framework: 'FOGG', anchorHabitKey: 'viz', celebration: 'x' })
const mozgas = def('mozgas', { title: 'Mozgás', framework: 'FOGG', anchorHabitKey: 'viz', celebration: 'x' })
const szabad = def('szabad', { title: 'Szabad', anchorCopy: 'ebéd után' })
const idegen = def('idegen', { title: 'Idegen', framework: 'FOGG', anchorHabitKey: 'nyujtas', celebration: 'x' })
const nyujtas = def('nyujtas', { title: 'Esti nyújtás', chainKey: 'EVENING' })

const chain = [viz, feny, mozgas, szabad, idegen]
const all = [...chain, nyujtas]

describe('chainStacking — a lánc-pozíció és a horgony két külön rendezés (mezo-vxd8)', () => {
  it('az előzőhöz kötött elem linked, a saját horgony-címkéjével', () => {
    expect(stackAnchorOf(chain, all, 1)).toEqual({ kind: 'linked', label: 'Egy pohár víz' })
  })

  it('a nem-az-előzőhöz kötött elem foreign, és megmondja, hogy a láncon belül van', () => {
    expect(stackAnchorOf(chain, all, 2)).toEqual({ kind: 'foreign', label: 'Egy pohár víz · nem az előző' })
  })

  it('a másik lánc szokásához kötött elem foreign · másik lánc', () => {
    expect(stackAnchorOf(chain, all, 4)).toEqual({ kind: 'foreign', label: 'Esti nyújtás · másik lánc' })
  })

  it('a kulcs nélküli elem free, a szabad szövegével (vagy honest — nincs horgony)', () => {
    expect(stackAnchorOf(chain, all, 3)).toEqual({ kind: 'free', label: 'ebéd után' })
    expect(stackAnchorOf(chain, all, 0)).toEqual({ kind: 'free', label: 'nincs horgony' })
  })

  it('a feloldhatatlan kulcs (törölt horgony) free-ként degradál, sosem dob', () => {
    const dangling = def('lóg', { framework: 'FOGG', anchorHabitKey: 'nincs-mar', anchorCopy: 'kész a régi', celebration: 'x' })
    expect(stackAnchorOf([viz, dangling], [viz, dangling], 1)).toEqual({ kind: 'free', label: 'kész a régi' })
  })

  it('a kötél az első elemnél nem létezik, linked párnál teli, különben szaggatott', () => {
    expect(ropeKindOf(chain, all, 0)).toBeNull()
    expect(ropeKindOf(chain, all, 1)).toBe('linked')
    expect(ropeKindOf(chain, all, 2)).toBe('broken')
    expect(ropeKindOf(chain, all, 3)).toBe('broken')
  })
})
