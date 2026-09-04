/**
 * Human-readable rendering of the pattern engine's per-day metric values (mezo-fy97). The wire
 * carries raw doubles keyed by the backend `MetricKey.wireKey()` catalog; two families need more
 * than digit-trimming: hour-of-day metrics arrive as fractional clock hours (bedtime-hour
 * past-midnight-shifted: <12 → +24, see MetricSeriesService.clockHour) and binary metrics as 0/1.
 * The key sets below mirror the backend extractors — a new hour/binary MetricKey needs an entry
 * here too, otherwise it falls back to the plain-number path.
 */
import { addDays, huMonthDay, localDateString } from '@/shared/lib/dates'

const HOUR_KEYS = new Set(['late-meal-hour', 'bedtime-hour', 'wakeup-hour'])
const BINARY_KEYS = new Set(['weekend', 'ritual-closed'])

/** Raw aligned-day value → what the days table shows: "15:41", "igen"/"nem", or "7.6". */
export function formatMetricValue(metricKey: string, value: number): string {
  if (HOUR_KEYS.has(metricKey)) {
    // Round on total minutes so :60 carries into the hour; mod 24 folds the bedtime shift back.
    const totalMin = Math.round(value * 60)
    const h = Math.floor(totalMin / 60) % 24
    const m = totalMin % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  if (BINARY_KEYS.has(metricKey)) return value >= 0.5 ? 'igen' : 'nem'
  return String(Math.round(value * 10) / 10)
}

/** The scatter x-axis end labels — named columns for binary metrics, earlier/later for clock
 *  metrics, the mockup's generic alacsony/magas otherwise. */
export function axisEndLabels(metricKey: string): { low: string; high: string } {
  if (metricKey === 'weekend') return { low: 'hétköznap', high: 'hétvége' }
  if (metricKey === 'ritual-closed') return { low: 'kimaradt', high: 'megvolt' }
  if (HOUR_KEYS.has(metricKey)) return { low: 'korábban', high: 'később' }
  return { low: 'alacsony', high: 'magas' }
}

export interface BinaryGroupLabels {
  zero: { axis: string; day: string }
  one: { axis: string; day: string }
}

/** Copy metadata for binary comparison groups; chart selection comes from the API value kind. */
export function binaryGroupLabels(metricKey: string): BinaryGroupLabels {
  if (metricKey === 'weekend') {
    return {
      zero: { axis: 'hétköznap', day: 'hétköznapi' },
      one: { axis: 'hétvége', day: 'hétvégi' },
    }
  }
  if (metricKey === 'ritual-closed') {
    return {
      zero: { axis: 'kimaradt', day: 'lezárás nélküli' },
      one: { axis: 'megvolt', day: 'lezárt esti' },
    }
  }
  return {
    zero: { axis: '0-s csoport', day: '0-s csoportbeli' },
    one: { axis: '1-es csoport', day: '1-es csoportbeli' },
  }
}

/** Diagnostics r at the mockup's precision (r=0.58), em dash when the gate hasn't produced one. */
export function formatR(r: number | null | undefined): string {
  return r == null ? '—' : r.toFixed(2)
}

/** Diagnostics p at three decimals, trailing zeros trimmed (0.52, 0.058, 0.001); anything below
 *  display precision reads as a bound instead of a misleading 0. */
export function formatP(p: number | null | undefined): string {
  if (p == null) return '—'
  if (p < 0.0005) return '<0.001'
  return String(Number(p.toFixed(3)))
}

/** „ma" / „tegnap" / „Máj 20" — a lefedettség-csempe emberi dátuma (mezo-fj1g).
 *  A `MetricCoverageRing` komponensből költözött ide (mezo-d20.11): a komponensnek a
 *  Mozaik-re-face óta nem volt hívója (gazdátlan), ez a formázó viszont a Minták
 *  Adat-egészség csempéin él tovább. */
export function lastSeenLabel(iso: string | null): string | null {
  if (!iso) return null
  const today = localDateString()
  if (iso === today) return 'ma'
  if (iso === addDays(today, -1)) return 'tegnap'
  return huMonthDay(iso)
}
