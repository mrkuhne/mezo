import { describe, expect, it } from 'vitest'
import { widenWindows, hitOf, hitLabel, durHu, windowReasonCopy, az, Az } from './mealWindow'

const ctx = { eatingStart: 7 * 60 + 25, kitchenClose: 21 * 60 + 30, bedMin: 23 * 60 }
const h = (hh: number, mm = 0) => hh * 60 + mm

describe('widenWindows', () => {
  it('widens by rule and attaches reasons', () => {
    const [b, l] = widenWindows([
      { time: h(8), kind: 'meal', rule: 'breakfast' },
      { time: h(13), kind: 'meal', rule: 'main' },
    ], ctx)
    expect(b).toEqual({ from: h(7, 25), to: h(9, 20), reasons: ['after-wake', 'protein-start'] }) // 7:20 clamped to eatingStart
    expect(l).toEqual({ from: h(12, 15), to: h(13, 45), reasons: ['protein-spacing'] })
  })

  it('clamps to kitchen close and adds before-bed near bedtime', () => {
    const [d] = widenWindows([{ time: h(21), kind: 'meal', rule: 'post-training' }], ctx)
    expect(d.from).toBe(h(20, 30))
    expect(d.to).toBe(h(21, 30))
    expect(d.reasons).toEqual(['post-training', 'before-bed'])
  })

  it('splits overlapping neighbours at the midpoint of their placed times', () => {
    const [a, b] = widenWindows([
      { time: h(15), kind: 'meal', rule: 'main' },
      { time: h(16), kind: 'snack', rule: 'pre-training-snack' },
    ], ctx)
    expect(a.to).toBe(h(15, 30))
    expect(b.from).toBe(h(15, 30))
    expect(b.to).toBe(h(16, 15))
    expect(b.reasons).toEqual(['pre-training-snack'])
  })

  it('keeps input order even when times are unsorted', () => {
    const out = widenWindows([
      { time: h(13), kind: 'meal', rule: 'main' },
      { time: h(10, 30), kind: 'snack', rule: 'snack' },
    ], ctx)
    expect(out[1].reasons).toEqual(['bridge'])
    expect(out[1].from).toBe(h(10))
  })

  it('never returns a window narrower than 30 min', () => {
    const [w] = widenWindows([{ time: h(21, 30), kind: 'snack', rule: 'snack' }], ctx)
    expect(w.to - w.from).toBeGreaterThanOrEqual(30)
  })

  it('maps template anchors to reasons', () => {
    const out = widenWindows([
      { time: h(8), kind: 'meal', rule: 'template-wake' },
      { time: h(16), kind: 'snack', rule: 'template-training-start' },
      { time: h(19), kind: 'meal', rule: 'template-training-end' },
      { time: h(12), kind: 'meal', rule: 'template-fixed' },
    ], ctx)
    expect(out.map(o => o.reasons)).toEqual([
      ['after-wake', 'protein-start'], ['pre-training-snack'], ['post-training'], ['template-fixed'],
    ])
  })
})

describe('hitOf / hitLabel / durHu', () => {
  it('classifies in / near / far', () => {
    expect(hitOf('07:20', '09:20', '08:46')).toEqual({ kind: 'in' })
    expect(hitOf('10:30', '11:30', '11:55')).toEqual({ kind: 'near', offsetMin: 25 })
    expect(hitOf('19:00', '20:30', '22:15')).toEqual({ kind: 'far', offsetMin: 105 })
    expect(hitOf('12:00', '13:00', '11:20')).toEqual({ kind: 'near', offsetMin: -40 })
  })
  it('words the hit without a score', () => {
    expect(hitLabel({ kind: 'in' })).toBe('Az ablakban')
    expect(hitLabel({ kind: 'near', offsetMin: 25 })).toBe('+25 p később')
    expect(hitLabel({ kind: 'near', offsetMin: -40 })).toBe('−40 p korábban')
    expect(hitLabel({ kind: 'far', offsetMin: 105 })).toBe('+1 ó 45 p később')
  })
  it('formats durations', () => {
    expect(durHu(25)).toBe('25 p')
    expect(durHu(120)).toBe('2 ó')
    expect(durHu(105)).toBe('1 ó 45 p')
  })
})

describe('windowReasonCopy / articles', () => {
  const c = { wake: '06:40', bed: '23:00', trainingStart: '17:30', trainingEnd: '18:45' }
  it('names the concrete anchors', () => {
    expect(windowReasonCopy('after-wake', c).title).toContain('06:40')
    expect(windowReasonCopy('pre-training-main', c).title).toContain('17:30')
    expect(windowReasonCopy('post-training', c).title).toContain('18:45')
    expect(windowReasonCopy('before-bed', c)).toMatchObject({ icon: 't-moon' })
    expect(windowReasonCopy('before-bed', c).title).toContain('23:00')
  })
  it('drops the training time when there is none', () => {
    const t = windowReasonCopy('pre-training-snack', { ...c, trainingStart: null }).title
    expect(t).not.toContain('(')
  })
  it('never uses imperative must-copy', () => {
    const codes = ['after-wake', 'protein-start', 'protein-spacing', 'bridge', 'pre-training-main',
      'pre-training-snack', 'post-training', 'before-bed', 'template-fixed'] as const
    for (const code of codes) {
      const { title, body } = windowReasonCopy(code, c)
      expect(`${title} ${body}`).not.toMatch(/\bkell\b|különben/)
    }
  })
  it('picks the Hungarian article', () => {
    expect(az('Ebéd')).toBe('az Ebéd')
    expect(az('Vacsora')).toBe('a Vacsora')
    expect(Az('Uzsonna')).toBe('Az Uzsonna')
  })
})
