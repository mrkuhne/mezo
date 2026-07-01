import { describe, expect, it } from 'vitest'
import { skillDisplay, HEADLINE_BY_SOURCE, HEADLINE_NO_LEVELUP, CHIP_ICON_BY_SOURCE } from '@/features/progression/levelUpMeta'

describe('skillDisplay', () => {
  it('maps athletic skill keys to HU name + emoji', () => {
    expect(skillDisplay('max_strength', 'ATHLETIC')).toEqual({ name: 'Maximális erő', icon: '🏋️' })
    expect(skillDisplay('explosiveness', 'ATHLETIC')).toEqual({ name: 'Robbanékonyság', icon: '⚡' })
    expect(skillDisplay('anaerobic_capacity', 'ATHLETIC')).toEqual({ name: 'Anaerob kapacitás', icon: '🔥' })
  })

  it('maps muscle keys via MUSCLE_LABELS with a flexed-arm icon', () => {
    expect(skillDisplay('chest', 'MUSCLE')).toEqual({ name: 'Mell', icon: '💪' })
    expect(skillDisplay('back-mid', 'MUSCLE')).toEqual({ name: 'Hát (közép)', icon: '💪' })
  })

  it('falls back to the backend name then the raw key for unknown skills', () => {
    expect(skillDisplay('unknown_skill', 'ATHLETIC', 'Backend Name')).toEqual({ name: 'Backend Name', icon: '✨' })
    expect(skillDisplay('zzz', 'ATHLETIC')).toEqual({ name: 'zzz', icon: '✨' })
  })

  it('exposes per-source headline + chip-icon maps', () => {
    expect(CHIP_ICON_BY_SOURCE.GYM).toBe('🏋️')
    expect(CHIP_ICON_BY_SOURCE.RUN).toBe('🏃')
    expect(CHIP_ICON_BY_SOURCE.SPORT).toBe('🏐')
    expect(HEADLINE_BY_SOURCE.GYM).toBeTruthy()
    expect(HEADLINE_NO_LEVELUP).toBe('Szépen gyűlik.')
  })
})
