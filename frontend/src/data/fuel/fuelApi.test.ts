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
    selectedPantryItemIds: ['a', 'b', 'c'],
  },
  history: [
    { version: 3, builtAt: '2026-06-30T08:00:00Z', reason: 'Új cél' },
    // wire can carry null for an absent reason — mapper coalesces to ''
    { version: 2, builtAt: '2026-06-01T08:00:00Z', reason: null as unknown as string },
  ],
}

describe('fromProtocolView', () => {
  it('maps a full response onto the FE Protocol shape', () => {
    const { protocol, selectedIds } = fromProtocolView(full)
    expect(protocol).not.toBeNull()
    expect(protocol!.version).toBe(3)
    expect(protocol!.status).toBe('active')
    expect(protocol!.source).toBe('Stack builder')
    expect(protocol!.itemCount).toBe(3) // = selection length
    expect(protocol!.confidence).toBe(0.82)
    expect(protocol!.lastReplanReason).toBe('Új cél')
    expect(protocol!.builtAt).not.toBe('') // formatted, non-empty
    expect(selectedIds).toEqual(['a', 'b', 'c'])
  })

  it('maps history entries incl. null reason → empty string', () => {
    const { protocol } = fromProtocolView(full)
    expect(protocol!.history).toHaveLength(2)
    expect(protocol!.history[0]).toMatchObject({ v: 3, reason: 'Új cél' })
    expect(protocol!.history[0].when).not.toBe('')
    expect(protocol!.history[1]).toMatchObject({ v: 2, reason: '' })
  })

  it('defaults optional confidence → 0 and lastReplanReason → null', () => {
    const noOptionals: ProtocolViewResponse = {
      active: {
        id: 'proto-2',
        version: 1,
        builtAt: '2026-06-30T08:00:00Z',
        status: 'active',
        selectedPantryItemIds: ['x'],
      },
      history: [],
    }
    const { protocol } = fromProtocolView(noOptionals)
    expect(protocol!.confidence).toBe(0)
    expect(protocol!.lastReplanReason).toBeNull()
    expect(protocol!.history).toEqual([])
  })

  it('returns nulls when there is no active protocol', () => {
    const empty: ProtocolViewResponse = { history: [] }
    expect(fromProtocolView(empty)).toEqual({ protocol: null, selectedIds: null })
  })
})
