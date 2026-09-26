import { describe, expect, it } from 'vitest'
import { mealForecast, type ForecastInput } from './mealForecast'

const E = { low: 'Egyenletes energia 3-4 órára', mid: 'Stabil energia 2-3 órára', high: 'Gyors löket, majd visszaesés' }
const base: ForecastInput = {
  level: 'mid', energyText: E.mid, kcal: 784, eatenAt: '08:46', window: { from: '07:20', to: '09:20' },
  training: { start: '17:30', end: '18:45' }, bed: '23:00',
  next: { label: 'Tízórai', from: '10:30', to: '11:30' },
}

describe('mealForecast', () => {
  it('builds energy / hunger / rhythm for an in-window breakfast', () => {
    const f = mealForecast(base)
    expect(f.rows.map(r => r.title)).toEqual(['Energia', 'Mikor leszel éhes', 'A nap ritmusa'])
    expect(f.rows[0].body).toBe('Stabil energia 2-3 órára.')
    expect(f.rows[1].body).toContain('Nagyjából 12:16') // 08:46 + 210
    expect(f.rows[2].body).toContain('3–4 órás')
    expect(f.late).toBe(false)
    expect(f.tip).toBeNull()
  })

  it('adds the pre-training clause within 2h of training', () => {
    const f = mealForecast({ ...base, level: 'high', energyText: E.high, kcal: 240, eatenAt: '16:20', window: { from: '16:00', to: '16:45' }, next: { label: 'Vacsora', from: '19:00', to: '20:30' } })
    expect(f.rows[0].body).toContain('Edzés előtt ez most előny')
  })

  it('late high-load dinner → sleep row and the no-judgement tip', () => {
    const f = mealForecast({ ...base, level: 'high', energyText: E.high, kcal: 1120, eatenAt: '22:15', window: { from: '19:00', to: '20:30' }, next: null })
    expect(f.late).toBe(true)
    expect(f.rows[1].body).toContain('utolsó étkezése')
    expect(f.rows[2].title).toBe('Alvás')
    expect(f.rows[2].body).toContain('nyugtalanabb')
    expect(f.tip).toContain('ne az éjszaka mérésein')
  })

  it('outside the window: rhythm row names the shift, with the Hungarian article', () => {
    const f = mealForecast({ ...base, level: 'low', energyText: E.low, kcal: 290, eatenAt: '11:55', window: { from: '10:30', to: '11:30' }, next: { label: 'Ebéd', from: '13:00', to: '14:00' } })
    expect(f.rows[2].body).toContain('25 p-cel később')
    expect(f.rows[2].body).toContain('az Ebéd ablaka')
  })

  it('no band → no energy row, still hunger + rhythm', () => {
    const f = mealForecast({ ...base, level: null, energyText: null })
    expect(f.rows.map(r => r.title)).toEqual(['Mikor leszel éhes', 'A nap ritmusa'])
  })

  it('no window → rhythm row says it had no window', () => {
    const f = mealForecast({ ...base, window: null })
    expect(f.rows.at(-1)!.body).toContain('Nem tartozott ablakhoz')
  })

  it('never shows a number or the word "glikémiás"', () => {
    for (const level of ['low', 'mid', 'high'] as const) {
      const f = mealForecast({ ...base, level, energyText: E[level] })
      const all = [...f.rows.map(r => r.body), f.tip ?? ''].join(' ')
      expect(all).not.toMatch(/glikémiás/i)
    }
  })
})
