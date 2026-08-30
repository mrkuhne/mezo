import { axisEndLabels, formatMetricValue, formatP, formatR, lastSeenLabel } from '@/features/insights/logic/metricFormat'
import { addDays, huMonthDay, localDateString } from '@/shared/lib/dates'

describe('formatMetricValue', () => {
  test('hour-kind metrics render as wall-clock HH:mm', () => {
    expect(formatMetricValue('late-meal-hour', 15.683333333333334)).toBe('15:41')
    expect(formatMetricValue('wakeup-hour', 6.416666666666667)).toBe('06:25')
    expect(formatMetricValue('late-meal-hour', 20.3)).toBe('20:18')
  })

  test('bedtime-hour arrives past-midnight-shifted (<12 → +24) and folds back to clock time', () => {
    expect(formatMetricValue('bedtime-hour', 25.5)).toBe('01:30')
    expect(formatMetricValue('bedtime-hour', 23.75)).toBe('23:45')
  })

  test('minute rounding carries into the hour instead of printing :60', () => {
    expect(formatMetricValue('late-meal-hour', 21.9999)).toBe('22:00')
  })

  test('binary metrics render igen/nem', () => {
    expect(formatMetricValue('weekend', 1)).toBe('igen')
    expect(formatMetricValue('weekend', 0)).toBe('nem')
    expect(formatMetricValue('ritual-closed', 1)).toBe('igen')
  })

  test('plain numerics trim to at most one decimal', () => {
    expect(formatMetricValue('daily-kcal', 2350)).toBe('2350')
    expect(formatMetricValue('sleep-quality', 7.6)).toBe('7.6')
    expect(formatMetricValue('weight-delta-kg', -0.3333333)).toBe('-0.3')
  })
})

describe('axisEndLabels', () => {
  test('weekend gets named columns instead of alacsony/magas', () => {
    expect(axisEndLabels('weekend')).toEqual({ low: 'hétköznap', high: 'hétvége' })
  })

  test('hour-kind metrics read as earlier/later', () => {
    expect(axisEndLabels('late-meal-hour')).toEqual({ low: 'korábban', high: 'később' })
  })

  test('everything else keeps the generic ends', () => {
    expect(axisEndLabels('sleep-quality')).toEqual({ low: 'alacsony', high: 'magas' })
  })
})

describe('formatR / formatP', () => {
  test('r rounds to two decimals, p to three with trailing zeros trimmed', () => {
    expect(formatR(-0.37383063546416445)).toBe('-0.37')
    expect(formatP(0.18794141905232353)).toBe('0.188')
    expect(formatP(0.058)).toBe('0.058')
    expect(formatP(0.52)).toBe('0.52')
  })

  test('a p below display precision reads as a bound, not 0.000', () => {
    expect(formatP(0.0004)).toBe('<0.001')
    expect(formatP(0.001)).toBe('0.001')
  })

  test('missing stats render as an em dash', () => {
    expect(formatR(null)).toBe('—')
    expect(formatP(null)).toBe('—')
  })
})

// mezo-d20.11: a `lastSeenLabel` a gazdátlan `MetricCoverageRing` komponensből költözött ide
// (a komponensnek a Mozaik-re-face óta egyetlen hívója sem volt; a formázónak van — a Minták
// Adat-egészség csempéi). A viselkedése bitre ugyanaz.
describe('lastSeenLabel', () => {
  test('ma / tegnap / rövid magyar dátum — hiányzó nap esetén semmi', () => {
    const today = localDateString()
    expect(lastSeenLabel(null)).toBeNull()
    expect(lastSeenLabel(today)).toBe('ma')
    expect(lastSeenLabel(addDays(today, -1))).toBe('tegnap')
    expect(lastSeenLabel('2026-05-20')).toBe(huMonthDay('2026-05-20'))
  })
})
