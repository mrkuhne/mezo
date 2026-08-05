import { describe, expect, it } from 'vitest'
import { fromProtocolView } from '@/data/fuel/fuelApi'
import type { components } from '@/data/_client/api.gen'

type ProtocolViewResponse = components['schemas']['ProtocolViewResponse']

const full: ProtocolViewResponse = {
  active: {
    id: 'proto-1',
    version: 3,
    builtAt: '2026-06-30T08:00:00Z',
    status: 'active',
    confidence: 0.82,
    lastReplanReason: 'Új cél',
    items: [
      { id: 'item-a', pantryItemId: 'a', slotKey: 'wake', pinned: false, placementSource: 'rule', placementReason: 'r1' },
      { id: 'item-b', pantryItemId: 'b', slotKey: 'lunch', pinned: true, placementSource: 'user' },
      { id: 'item-c', pantryItemId: 'c', slotKey: 'evening', pinned: false, placementSource: 'fallback', dose: '5g' },
    ],
  },
  history: [
    { version: 3, builtAt: '2026-06-30T08:00:00Z', reason: 'Új cél' },
    // wire can carry null for an absent reason — mapper coalesces to ''
    { version: 2, builtAt: '2026-06-01T08:00:00Z', reason: null as unknown as string },
  ],
}

describe('fromProtocolView', () => {
  it('maps a full response onto the FE Protocol shape', () => {
    const { protocol } = fromProtocolView(full)
    expect(protocol).not.toBeNull()
    expect(protocol!.version).toBe(3)
    expect(protocol!.status).toBe('active')
    expect(protocol!.source).toBe('Stack builder')
    expect(protocol!.itemCount).toBe(3) // = items length
    expect(protocol!.confidence).toBe(0.82)
    expect(protocol!.lastReplanReason).toBe('Új cél')
    expect(protocol!.builtAt).not.toBe('') // formatted, non-empty
  })

  it('maps history entries incl. null reason → empty string', () => {
    const { protocol } = fromProtocolView(full)
    expect(protocol!.history).toHaveLength(2)
    expect(protocol!.history[0]).toMatchObject({ v: 3, reason: 'Új cél' })
    expect(protocol!.history[0].when).not.toBe('')
    expect(protocol!.history[1]).toMatchObject({ v: 2, reason: '' })
  })

  it('maps items into occurrences (mezo-vx9v)', () => {
    const { occurrences } = fromProtocolView(full)
    expect(occurrences).toHaveLength(3)
    expect(occurrences[0]).toEqual({
      id: 'item-a', pantryItemId: 'a', slotKey: 'wake', dose: null, pinned: false,
      placementSource: 'rule', placementReason: 'r1', restDayFallback: null, dailyTotalHint: null,
    })
    expect(occurrences[1]).toMatchObject({ pantryItemId: 'b', slotKey: 'lunch', pinned: true, placementSource: 'user' })
    expect(occurrences[2]).toMatchObject({ pantryItemId: 'c', dose: '5g', placementSource: 'fallback' })
  })

  it('defaults optional confidence → 0 and lastReplanReason → null', () => {
    const noOptionals: ProtocolViewResponse = {
      active: {
        id: 'proto-2',
        version: 1,
        builtAt: '2026-06-30T08:00:00Z',
        status: 'active',
        items: [],
      },
      history: [],
    }
    const { protocol, occurrences } = fromProtocolView(noOptionals)
    expect(protocol!.confidence).toBe(0)
    expect(protocol!.lastReplanReason).toBeNull()
    expect(protocol!.history).toEqual([])
    expect(occurrences).toEqual([])
  })

  it('returns nulls/empties when there is no active protocol', () => {
    const empty: ProtocolViewResponse = { history: [] }
    expect(fromProtocolView(empty)).toEqual({ protocol: null, occurrences: [] })
  })
})
