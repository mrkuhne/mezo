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

/** Egy bizonyíték-éjszaka emberi olvasata: bejött / nem jött be, vagy amiért a kapu hallgat. */
function evidenceText(event: PatternEvent): string {
  if (event.hit === true) return `Bejött${event.n != null ? ` · ${event.n} nap` : ''}`
  if (event.hit === false) return `Nem jött be${event.n != null ? ` · ${event.n} nap` : ''}`
  return event.verdict?.toLowerCase() === 'few_days' ? 'Kevés nap' : 'Nincs adat'
}

const PLAIN: Partial<Record<PatternEventKind, { label: string; tone: LogTone; text: string }>> = {
  monitoring: { label: 'döntés', tone: 'lav', text: 'Megfigyelésre tetted.' },
  confirmed: { label: 'döntés', tone: 'sage', text: 'Megerősítetted.' },
  rejected: { label: 'döntés', tone: 'mute', text: 'Elvetetted — befagyasztva.' },
  refuted: { label: 'lezárás', tone: 'mute', text: 'Megnéztük — nem igazolódott.' },
  dormant: { label: 'szünet', tone: 'mute', text: 'Pihen — várom az adatot.' },
  promoted: { label: 'tudás', tone: 'sage', text: 'Bekerült a tudástárba.' },
}

/** Az append-only esemény-lista → idővonal-sorok, a legrégebbi elöl (a prototípus olvasata). */
export function evidenceLogRows(events: PatternEvent[]): EvidenceLogRow[] {
  return [...events]
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
    .map((event) => {
      const stamp = logStamp(event.occurredAt)
      switch (event.kind) {
        case 'observation':
          return { stamp, label: 'észrevétel', tone: 'coral' as const, text: event.text ?? 'Feltűnt egy összefüggés.' }
        case 'user_reply':
          return { stamp, label: 'te', tone: 'lav' as const, text: `„${event.text ?? 'Válaszoltál.'}”`, quoted: true }
        case 'revised':
          return { stamp, label: 'átfogalmazva', tone: 'gold' as const, text: event.text ?? 'Újrafogalmaztam a hipotézist.' }
        case 'evidence':
          return { stamp, label: 'bizonyíték', tone: 'gold' as const, text: evidenceText(event) }
        case 'reinforced':
          return {
            stamp,
            label: 'megerősödés',
            tone: 'sage' as const,
            text: `Újra előjött ugyanabban az irányban (×${event.reinforcementCount ?? 1}).`,
          }
        case 'snapshot':
          return { stamp, label: 'számítás', tone: 'mute' as const, text: `Újraszámolva — ${event.n ?? 0} közös nap.` }
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
