import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WeekDayTile } from '@/features/me/components/week/WeekDayTile'
import type { MeWeekDay } from '@/data/me/meWeek'

// mezo-jcpt.5: a hat sub-jel 3+3 csoportban (amit tettél | ahogy állsz), a csoporthatárt
// a `DAY_DIMENSIONS`-ból származtatva, nem bedrótozott dimenzió-kulccsal.
const scoredDay: MeWeekDay = {
  date: '2026-05-20',
  score: 100,
  subscores: { nutrition: 100, quality: 100, training: 100, sleep: 100, logging: 100, rhythm: 100 },
  kcal: 3000, proteinG: 220, carbsG: 350, fatG: 90,
  kcalTarget: 3100, proteinTargetG: 220,
  weightKg: 84,
  sleepMin: 440, sleepQuality: 8,
  checkinCount: 4, checkinEnergyAvg: 8,
  workoutCount: 1, xp: 140,
}

describe('WeekDayTile', () => {
  it('hat pálcikát rajzol, a harmadik után csoportréssel (mezo-jcpt.5)', () => {
    const { container } = render(<WeekDayTile day={scoredDay} todayIso="2026-05-21"
      hasNote={false} delayMs={0} onOpen={() => {}} />)
    const bars = container.querySelectorAll('.wkd-sparks i')
    expect(bars).toHaveLength(6)
    // A csoporthatár az „amit tettél" (tápanyag·minőség·edzés) és az „ahogy állsz"
    // (alvás·logolás·ritmus) között van — az edzés pálcikája viseli.
    expect(bars[2]).toHaveClass('is-gsep')
    expect(bars[0]).not.toHaveClass('is-gsep')
    expect(bars[5]).not.toHaveClass('is-gsep')
  })

  it('null sub-jel csonkot kap, nem hamis nullát', () => {
    const day = { ...scoredDay, subscores: { ...scoredDay.subscores, quality: null, rhythm: null } }
    const { container } = render(<WeekDayTile day={day} todayIso="2026-05-21"
      hasNote={false} delayMs={0} onOpen={() => {}} />)
    const none = container.querySelectorAll('.wkd-sparks i.is-none')
    expect(none).toHaveLength(2)
    // a csonk a csoportrést akkor is viszi, ha éppen ő a harmadik
    expect(container.querySelectorAll('.wkd-sparks i')[2]).toHaveClass('is-gsep')
  })
})
