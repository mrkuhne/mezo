// ============================================================
// Mezo · EvidenceLog — a laborfüzet „Bizonyíték-napló" idővonala (Reflexió S6, mezo-eq85.6)
// Vizuális igazság: docs/design_2.0/prototypes/eszrevetelek.html #labScreen `.log`/`.timeline`.
// MINDEN, ami a hipotézissel történt, időrendben: az észrevétel, a TE válaszod (idézve, a
// saját hangodon), az átfogalmazás, és éjszakánként egy bizonyíték-sor. A döntés- és
// motor-események a `PatternJournal` régi, bevált szövegeit tartják meg.
// ============================================================
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { timeLabel } from '@/features/notification/logic/stamp'
import type { PatternEvent, PatternEventKind } from '@/data/types'

/** A prototípus dot-színei — a három reflexiós fajta kap saját tónust, a többi a halk alap. */
type LogTone = 'coral' | 'lav' | 'gold' | 'sage' | 'mute'

export interface EvidenceLogRow {
  stamp: string
  label: string
  tone: LogTone
  text: string
  /** `user_reply`: a te szavaid — idézőjelben, dőlten. */
  quoted?: boolean
}

const HU_MONTHS = ['Jan.', 'Febr.', 'Márc.', 'Ápr.', 'Máj.', 'Jún.', 'Júl.', 'Aug.', 'Szept.', 'Okt.', 'Nov.', 'Dec.']

/** `2026-09-06T12:12:00Z` → `Szept. 6. · 14:12` — az óra HELYI idő (a drót UTC-ben jön). */
export function logStamp(occurredAt: string): string {
  const day = new Date(occurredAt)
  return `${HU_MONTHS[day.getMonth()]} ${day.getDate()}. · ${timeLabel(occurredAt)}`
}

/** A `PatternGate.Verdict` néma ágai — a kapu MINDEN éjjel ír egy sort, és ezek mondják meg,
 *  miért nem lett belőle bizonyíték. Ismeretlen (új) verdikt a legóvatosabb olvasatot kapja. */
const SILENT_VERDICT: Record<string, string> = {
  few_days: 'Kevés nap',
  imbalanced_groups: 'Még vékony csoport',
  degenerate: 'Nem mozdult',
  no_data: 'Nincs adat',
}

/** Egy bizonyíték-éjszaka emberi olvasata: bejött / nem jött be, vagy amiért a kapu hallgat.
 *  `nights > 1` = összevont néma sorozat (ld. `significantEvents`). */
function evidenceText(event: PatternEvent, nights: number): string {
  if (event.hit === true) return `Bejött${event.n != null ? ` · ${event.n} nap` : ''}`
  if (event.hit === false) return `Nem jött be${event.n != null ? ` · ${event.n} nap` : ''}`
  const silent = SILENT_VERDICT[event.verdict?.toLowerCase() ?? ''] ?? 'Nincs adat'
  return nights > 1 ? `${silent} · ${nights} éjszaka` : silent
}

interface LogItem { event: PatternEvent; nights: number }

/**
 * A zaj kiszűrése — a ház szabálya a `patternHistory.journalEntries`-ből: minden ember-jelentőségű
 * esemény marad (észrevétel, a te válaszod, átfogalmazás, döntés, élő bizonyíték-éjszaka), a
 * gépi ismétlés viszont összevonódik. A kapu naponta ír: egy hónapnyi „Kevés nap" különben
 * maga alá temetné az egész laborfüzetet. Az összevont sor a LEGUTÓBBI éjszaka dátumát viseli
 * (az olvasat: „tegnap éjjel is még mindig ez"), és kiírja, hány éjszakáról van szó.
 */
function significantEvents(events: PatternEvent[]): LogItem[] {
  const sorted = [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
  const items: LogItem[] = []
  let sawFirstSnapshot = false
  for (const event of sorted) {
    // `snapshot`: csak az ELSŐ kap sort — a szövege („Először számolhatóvá vált") a többire
    // hazugság is lenne (ugyanaz a szabály, mint a katalógus naplójában).
    if (event.kind === 'snapshot') {
      if (sawFirstSnapshot) continue
      sawFirstSnapshot = true
    }
    const previous = items[items.length - 1]
    const silentNight = event.kind === 'evidence' && event.hit == null
    if (silentNight && previous != null && previous.event.kind === 'evidence'
      && previous.event.hit == null && previous.event.verdict === event.verdict) {
      items[items.length - 1] = { event, nights: previous.nights + 1 }
      continue
    }
    items.push({ event, nights: 1 })
  }
  return items
}

/** A döntés- és motor-események a `PatternJournal` bevált szövegeit tartják meg SZÓ SZERINT —
 *  a két olvasat sose mondjon mást ugyanarról az eseményről (mezo-eq85.6 review). */
const PLAIN: Partial<Record<PatternEventKind, { label: string; tone: LogTone; text: string }>> = {
  monitoring: { label: 'döntés', tone: 'lav', text: 'Megfigyelésre tetted.' },
  confirmed: { label: 'döntés', tone: 'sage', text: '**Megerősítetted.**' },
  rejected: { label: 'döntés', tone: 'mute', text: 'Elvetetted — befagyasztva.' },
  refuted: { label: 'lezárás', tone: 'mute', text: 'Megnéztük — nem igazolódott.' },
  dormant: { label: 'szünet', tone: 'mute', text: 'Pihen — várom az adatot.' },
  promoted: { label: 'tudás', tone: 'sage', text: 'Bekerült a tudástárba.' },
}

/** Az append-only esemény-lista → idővonal-sorok, a legrégebbi elöl (a prototípus olvasata). */
export function evidenceLogRows(events: PatternEvent[]): EvidenceLogRow[] {
  return significantEvents(events)
    .map(({ event, nights }) => {
      const stamp = logStamp(event.occurredAt)
      switch (event.kind) {
        case 'observation':
          return { stamp, label: 'észrevétel', tone: 'coral' as const, text: event.text ?? 'Feltűnt egy összefüggés.' }
        case 'user_reply':
          return { stamp, label: 'te', tone: 'lav' as const, text: `„${event.text ?? 'Válaszoltál.'}”`, quoted: true }
        case 'revised':
          return { stamp, label: 'átfogalmazva', tone: 'gold' as const, text: event.text ?? 'Újrafogalmaztam a hipotézist.' }
        case 'evidence':
          return { stamp, label: 'bizonyíték', tone: 'gold' as const, text: evidenceText(event, nights) }
        case 'reinforced':
          return {
            stamp,
            label: 'megerősödés',
            tone: 'sage' as const,
            text: `Újra előjött ugyanabban az irányban — a tudás megerősödött (×${event.reinforcementCount ?? 1}).`,
          }
        case 'snapshot':
          return { stamp, label: 'számítás', tone: 'mute' as const, text: `Először számolhatóvá vált — ${event.n ?? 0} közös nap.` }
        default: {
          const plain = PLAIN[event.kind]
          return { stamp, label: plain?.label ?? 'esemény', tone: plain?.tone ?? 'mute', text: plain?.text ?? '' }
        }
      }
    })
}

export function EvidenceLog({ events }: { events: PatternEvent[] }) {
  const rows = evidenceLogRows(events)
  if (rows.length === 0) {
    return (
      <section className="pdt-log">
        <p className="pdt-note">Még nincs bejegyzés — az első bizonyíték-éjszaka tölti fel.</p>
      </section>
    )
  }
  return (
    <section className="pdt-log">
      <div className="pdt-timeline">
        {rows.map((row, i) => (
          <div key={`${row.stamp}-${i}`} className={`pdt-event pdt-event-${row.tone}${row.quoted ? ' pdt-event-you' : ''}`}>
            <time>{row.stamp} <em>{row.label}</em></time>
            <p><SafeMarkdown text={row.text} /></p>
          </div>
        ))}
      </div>
    </section>
  )
}
