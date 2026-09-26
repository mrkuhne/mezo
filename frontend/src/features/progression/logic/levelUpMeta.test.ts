import { describe, expect, it } from 'vitest'
import {
  skillDisplay, HEADLINE_BY_SOURCE, HEADLINE_NO_LEVELUP, CHIP_ICON_BY_SOURCE, CHIP_3D_BY_SOURCE, ATHLETIC_META,
} from '@/features/progression/logic/levelUpMeta'
import titaniumRaw from '@/shared/ui/clay/titanium-icons.svg?raw'

describe('skillDisplay', () => {
  it('maps athletic skill keys to HU name + emoji + 3D symbol', () => {
    expect(skillDisplay('max_strength', 'ATHLETIC')).toEqual({ name: 'Maximális erő', icon: '🏋️', art3d: 't-dumbbell' })
    expect(skillDisplay('explosiveness', 'ATHLETIC')).toEqual({ name: 'Robbanékonyság', icon: '⚡', art3d: 't-bolt' })
    expect(skillDisplay('anaerobic_capacity', 'ATHLETIC')).toEqual({ name: 'Anaerob kapacitás', icon: '🔥', art3d: 't-flame' })
  })

  it('gives every athletic skill its approved 3D symbol, and each one exists in the sprite (U10)', () => {
    const art = Object.fromEntries(Object.entries(ATHLETIC_META).map(([k, m]) => [k, m.art3d]))
    expect(art).toEqual({
      explosiveness: 't-bolt', vertical_jump: 't-jump', sprint_speed: 't-sprint',
      aerobic_capacity: 't-breath', anaerobic_capacity: 't-flame', strength_endurance: 't-repeat',
      core_stability: 't-core', max_strength: 't-dumbbell', coordination: 't-juggle',
      mobility: 't-stretch', agility: 't-target', robustness: 't-shield',
    })
    for (const id of [...Object.values(art), ...Object.values(CHIP_3D_BY_SOURCE), 't-muscle', 't-spark']) {
      expect(titaniumRaw).toContain(`<symbol id="${id}"`)
    }
  })

  it('maps muscle keys via MUSCLE_LABELS with a flexed-arm emoji and the 3D muscle', () => {
    expect(skillDisplay('chest', 'MUSCLE')).toEqual({ name: 'Mell', icon: '💪', art3d: 't-muscle' })
    expect(skillDisplay('back-mid', 'MUSCLE')).toEqual({ name: 'Hát (közép)', icon: '💪', art3d: 't-muscle' })
  })

  it('draws a LIFE skill with its clay symbol (ContentIcon maps it onto the 3D set)', () => {
    expect(skillDisplay('mindfulness', 'LIFE')).toMatchObject({ name: 'Tudatosság', clayIcon: 'i-life-tudatossag', art3d: 'i-life-tudatossag' })
  })

  it('falls back to the backend name then the raw key for unknown skills', () => {
    expect(skillDisplay('unknown_skill', 'ATHLETIC', 'Backend Name')).toEqual({ name: 'Backend Name', icon: '✨', art3d: 't-spark' })
    expect(skillDisplay('zzz', 'ATHLETIC')).toEqual({ name: 'zzz', icon: '✨', art3d: 't-spark' })
    expect(skillDisplay('zzz', 'LIFE')).toEqual({ name: 'zzz', icon: '✨', art3d: 't-spark' })
  })

  it('exposes per-source headline + chip-icon maps', () => {
    expect(CHIP_ICON_BY_SOURCE.GYM).toBe('🏋️')
    expect(CHIP_ICON_BY_SOURCE.RUN).toBe('🏃')
    expect(CHIP_ICON_BY_SOURCE.SPORT).toBe('🏐')
    expect(CHIP_3D_BY_SOURCE).toEqual({
      GYM: 't-dumbbell', RUN: 't-run', SPORT: 't-volley', QUEST: 't-quest', ACTIVITY: 't-pencil', HABIT: 't-dawn',
    })
    expect(HEADLINE_BY_SOURCE.GYM).toBeTruthy()
    expect(HEADLINE_NO_LEVELUP).toBe('Szépen gyűlik.')
  })
})
