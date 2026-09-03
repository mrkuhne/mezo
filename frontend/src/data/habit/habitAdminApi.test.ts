import { describe, expect, it, vi, beforeEach } from 'vitest'
import { habitAdminApi } from '@/data/habit/habitAdminApi'

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }))
vi.mock('@/data/_client/api', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a), ApiError: class extends Error {} }))

beforeEach(() => apiFetch.mockReset())

describe('habitAdminApi.createDef', () => {
  it('sends the framework fields and maps them back onto HabitDefInfo', async () => {
    apiFetch.mockResolvedValue({
      id: 'd1', habitKey: 'custom_1', chainKey: 'MORNING', position: 1, title: 'Napi mondat',
      why: null, anchorCopy: null, mode: 'MANUAL', metric: 'manual', skillKey: 'mindset',
      xp: 10, linkUrl: null, isActive: true,
      framework: 'FOGG', anchorHabitKey: 'morning_sunlight', cue: null, craving: null,
      reward: null, celebration: 'ökölrázás', identity: null,
    })

    const def = await habitAdminApi.createDef({
      chainKey: 'MORNING', title: 'Napi mondat', mode: 'MANUAL', skillKey: 'mindset', xp: 10,
      framework: 'FOGG', anchorHabitKey: 'morning_sunlight', celebration: 'ökölrázás',
    })

    const body = JSON.parse((apiFetch.mock.calls[0][1] as { body: string }).body)
    expect(body.framework).toBe('FOGG')
    expect(body.anchorHabitKey).toBe('morning_sunlight')
    expect(body.celebration).toBe('ökölrázás')
    expect(def.framework).toBe('FOGG')
    expect(def.celebration).toBe('ökölrázás')
    expect(def.cue).toBeNull()
  })
})
