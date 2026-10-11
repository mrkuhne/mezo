// The one place dates and numbers are formatted for display (mezo-n4wf5.11). The locale ALWAYS comes
// from the app language (`getLang()`), never from the device. Hungarian output is the hand-rolled
// strings the app always showed; English uses en-GB (day first, no ordinal, no dots, 24-hour clock).
import { getLang } from '@/shared/i18n'

export type FmtDateStyle = 'weekdayLong' | 'weekdayShort' | 'monthDay' | 'monthDayWeekday' | 'full' | 'frame'

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

/** 'YYYY-MM-DD' of a Date in the browser's local zone (machine format, not a display format). */
export const isoDay = (d: Date): string => dateFormatter('en-CA', {}).format(d)

export function fmtDate(input: Date | string, style: FmtDateStyle): string {
  const date = toDate(input)
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
  }
}

const decimalMark = (): string => (getLang() === 'hu' ? ',' : '.')
const groupMark = (): string => (getLang() === 'hu' ? ' ' : ',')

/** Decimal number, no grouping; a zero fraction is dropped (78.6 → „78,6" / "78.6", 73 → "73"). */
export function fmtNum(v: number, digits: 0 | 1 | 2 = 1): string {
  const s = v.toFixed(digits).replace(/\.0+$/, '')
  return s.replace('.', decimalMark())
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
