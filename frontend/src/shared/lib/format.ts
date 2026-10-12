// The one place dates and numbers are formatted for display (mezo-n4wf5.11). The locale ALWAYS comes
// from the app language (`getLang()`), never from the device. Hungarian output is the hand-rolled
// strings the app always showed; English uses en-GB (day first, no ordinal, no dots, 24-hour clock).
import { getLang } from '@/shared/i18n/lang'

export type FmtDateStyle = 'weekdayLong' | 'weekdayShort' | 'monthDay' | 'monthDayWeekday' | 'full' | 'frame'
  // the Folyadék formats (prototype `dS` · `dL` · `dW` · `dF` · `wd`), mezo-n4wf5.5
  | 'short' | 'long' | 'shortWeekday' | 'longWeekday' | 'weekdayLower' | 'weekdayCompact' | 'weekdayLetter' | 'monthYear'

export const locale = (): 'hu-HU' | 'en-GB' => (getLang() === 'hu' ? 'hu-HU' : 'en-GB')

const HU_MONTHS = ['Jan', 'Feb', 'Már', 'Ápr', 'Máj', 'Jún', 'Júl', 'Aug', 'Szep', 'Okt', 'Nov', 'Dec']
const HU_MONTHS_FULL = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június',
  'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December']
const HU_DOW = ['Vas', 'Hét', 'Kedd', 'Sze', 'Csü', 'Pén', 'Szo']
const HU_DOW_FULL = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat']

// Formatters are built once per locale + options.
const formatters = new Map<string, Intl.DateTimeFormat>()
function dateFormatter(loc: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${loc}|${JSON.stringify(opts)}`
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat(loc, opts)
    formatters.set(key, f)
  }
  return f
}

const numberFormatters = new Map<string, Intl.NumberFormat>()
function numberFormatter(loc: string, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${loc}|${JSON.stringify(opts)}`
  let f = numberFormatters.get(key)
  if (!f) {
    f = new Intl.NumberFormat(loc, opts)
    numberFormatters.set(key, f)
  }
  return f
}

/** A date-only string ('2026-10-07') is the 7th in every time zone: its parts are read, never parsed as UTC. */
function toDate(d: Date | string): Date {
  if (typeof d !== 'string') return d
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : new Date(d)
}

function enPart(date: Date, type: 'weekday' | 'month'): string {
  // only reached when the language is English, so 'en-GB' is exactly locale()
  const parts = dateFormatter('en-GB', { weekday: 'long', month: 'long' }).formatToParts(date)
  return parts.find((p) => p.type === type)?.value ?? ''
}

const pad = (n: number, width: number) => String(n).padStart(width, '0')

/**
 * 'YYYY-MM-DD' of a Date in the browser's local zone (machine format, not a display format).
 * Built from the Date's own local fields, never from a cached Intl formatter: a formatter keeps the
 * zone it was created in, so a live app that crosses a time zone would keep computing "today" in the old one.
 */
export const isoDay = (d: Date): string => `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`

// The Folyadék formats are built from the date's own fields and these name tables — no `Intl` formatter is involved, so
// nothing here can keep a stale time zone (bible N1.17).
const HU_MONTHS_DOT = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.']
const HU_DOW_COMPACT = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo']
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const EN_DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function folyadekDate(date: Date, style: FmtDateStyle): string | null {
  const day = date.getDate(), month = date.getMonth(), dow = date.getDay()
  if (getLang() === 'hu') {
    switch (style) {
      case 'short': return `${HU_MONTHS_DOT[month]} ${day}.`
      case 'long': return `${HU_MONTHS_FULL[month].toLowerCase()} ${day}.`
      case 'shortWeekday': return `${HU_DOW_COMPACT[dow]}, ${HU_MONTHS_DOT[month]} ${day}.`
      case 'longWeekday': return `${HU_DOW_FULL[dow].toLowerCase()}, ${HU_MONTHS_FULL[month].toLowerCase()} ${day}.`
      case 'weekdayLower': return HU_DOW_FULL[dow].toLowerCase()
      case 'weekdayCompact': return HU_DOW_COMPACT[dow]
      case 'weekdayLetter': return HU_DOW_COMPACT[dow][0]
      case 'monthYear': return `${date.getFullYear()}. ${HU_MONTHS_FULL[month].toLowerCase()}`
      default: return null
    }
  }
  switch (style) {
    case 'short': return `${day} ${EN_MONTHS[month].slice(0, 3)}`
    case 'long': return `${day} ${EN_MONTHS[month]}`
    case 'shortWeekday': return `${EN_DOW[dow].slice(0, 3)}, ${day} ${EN_MONTHS[month].slice(0, 3)}`
    case 'longWeekday': return `${EN_DOW[dow]}, ${day} ${EN_MONTHS[month]}`
    case 'weekdayLower': return EN_DOW[dow]
    case 'weekdayCompact': return EN_DOW[dow].slice(0, 3)
    case 'weekdayLetter': return EN_DOW[dow][0]
    case 'monthYear': return `${EN_MONTHS[month]} ${date.getFullYear()}`
    default: return null
  }
}

export function fmtDate(input: Date | string, style: FmtDateStyle): string {
  const date = toDate(input)
  const folyadek = folyadekDate(date, style)
  if (folyadek != null) return folyadek
  const day = date.getDate()
  if (getLang() === 'hu') {
    const month = date.getMonth()
    const dow = date.getDay()
    switch (style) {
      case 'weekdayLong': return HU_DOW_FULL[dow]
      case 'weekdayShort': return HU_DOW[dow]
      case 'monthDay': return `${HU_MONTHS[month]} ${day}`
      case 'monthDayWeekday': return `${HU_MONTHS[month]} ${day} · ${HU_DOW[dow]}`
      case 'full': return `${HU_MONTHS_FULL[month]} ${day}., ${HU_DOW_FULL[dow].toLowerCase()}`
      case 'frame': return `${HU_DOW_FULL[dow]}, ${HU_MONTHS_FULL[month].toLowerCase()} ${day}.`
      default: return ''
    }
  }
  const weekday = enPart(date, 'weekday')
  const month = enPart(date, 'month')
  switch (style) {
    case 'weekdayLong': return weekday
    case 'weekdayShort': return weekday.slice(0, 3)
    case 'monthDay': return `${day} ${month.slice(0, 3)}`
    case 'monthDayWeekday': return `${day} ${month.slice(0, 3)} · ${weekday.slice(0, 3)}`
    case 'full':
    case 'frame': return `${weekday}, ${day} ${month}`
    default: return ''
  }
}

/** An ISO instant or a `YYYY-MM-DD[T ]HH:mm` wall clock → a Date; a date-only string is read by its parts (`toDate`). */
const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/
function toMoment(input: Date | string): Date {
  if (typeof input !== 'string') return input
  // a zone-less wall clock keeps its own digits in every zone (and in every engine: no reliance on Date.parse)
  const w = WALL_CLOCK.exec(input)
  if (w) return new Date(Number(w[1]), Number(w[2]) - 1, Number(w[3]), Number(w[4]), Number(w[5]), Number(w[6] ?? 0))
  return toDate(input)
}

/**
 * The 24-hour clock of a moment: 'HH:mm' (the same in both languages). An instant with a zone ('…Z', '…+02:00') is shown in
 * the zone the device is in NOW — read from the Date's own local fields, never from a cached `Intl` formatter, which would
 * keep the zone of its first use. A zone-less wall clock ('2026-05-20T09:14:00', what the server sends for a logged time)
 * prints its own digits.
 */
export function fmtClock(input: Date | string): string {
  const d = toMoment(input)
  return `${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}`
}

/** A day with its clock: „máj. 20. · 09:14" / "20 May · 09:14" (prototype `whenT`). */
export function fmtDateTime(input: Date | string): string {
  const d = toMoment(input)
  return `${fmtDate(d, 'short')} · ${fmtClock(d)}`
}

/**
 * A range of days (prototype `dR`): inside one month „okt. 5–11." / "5–11 Oct", across two „szept. 28. – okt. 4." /
 * "28 Sep – 4 Oct". Date-only strings are read by their parts, so the range is the same days in every time zone.
 */
export function fmtRange(start: Date | string, end: Date | string): string {
  const a = toDate(start), b = toDate(end)
  if (a.getMonth() !== b.getMonth() || a.getFullYear() !== b.getFullYear()) return `${fmtDate(a, 'short')} – ${fmtDate(b, 'short')}`
  return getLang() === 'hu'
    ? `${HU_MONTHS_DOT[a.getMonth()]} ${a.getDate()}–${b.getDate()}.`
    : `${a.getDate()}–${b.getDate()} ${EN_MONTHS[b.getMonth()].slice(0, 3)}`
}

const decimalMark = (): string => (getLang() === 'hu' ? ',' : '.')
const groupMark = (): string => (getLang() === 'hu' ? ' ' : ',')

/** Decimal number, no grouping; a zero fraction is dropped (78.6 → „78,6" / "78.6", 73 → "73"). */
export function fmtNum(v: number, digits: 0 | 1 | 2 = 1): string {
  const s = v.toFixed(digits).replace(/\.0+$/, '')
  return s.replace('.', decimalMark())
}

/** Decimal number with FIXED fraction digits, no grouping: the zero stays („5,0" / "5.0" — a score, a weight, litres).
 *  Unicode minus when negative; a value that rounds to zero never prints a minus. */
export function fmtFixed(v: number, digits: 1 | 2 | 3 = 1): string {
  const s = Math.abs(v).toFixed(digits)
  return `${v < 0 && Number(s) !== 0 ? '−' : ''}${s.replace('.', decimalMark())}`
}

/** Integer rounded, grouped with the language's separator ("1 200" / "1,200"), Unicode minus when negative. */
export function fmtGrouped(v: number): string {
  const grouped = Math.round(Math.abs(v)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, groupMark())
  return v < 0 ? `−${grouped}` : grouped
}

/** Integer in the locale's own grouping rule (Hungarian groups from 5 digits up), spaces regular. */
export function fmtInt(v: number): string {
  return numberFormatter(locale(), { maximumFractionDigits: 0 }).format(Math.round(v)).replace(/[\u00a0\u202f]/g, ' ')
}
