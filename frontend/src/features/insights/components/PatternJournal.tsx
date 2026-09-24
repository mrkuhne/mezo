import { Link } from 'react-router-dom'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import type { JournalEntry } from '@/features/insights/logic/patternHistory'

const TONE: Record<JournalEntry['tone'], string> = {
  neutral: 'mute',
  success: 'sage',
  accent: 'gold',
}

/**
 * The pattern-pair detail page's history timeline (mezo-tk88.5, spec-mockup screen 2 „A minta
 * története"): a rail + one tone-coloured dot per `journalEntries()` row. Pure presentational —
 * every derivation (date label, tone, text, whether a fact was born) already happened in
 * `logic/patternHistory.ts`; this component only lays it out. Üvegben (mezo-me75u.13) it shares
 * the evidence log's rail and dots (`.pdt-timeline` / `.pdt-event`), upright text.
 */
export function PatternJournal({ entries }: { entries: JournalEntry[] }) {
  return (
    <div className="pdt-timeline pdt-journal">
      {entries.map((entry, i) => (
        <div key={`${entry.date}-${i}`} className={`pdt-event pdt-event-${TONE[entry.tone]}`}>
          <span className="pdt-evh"><time>{entry.date}</time></span>
          <p>
            <SafeMarkdown text={entry.text} />
            {entry.factLink && (
              <>
                {' '}Létrejött a tudás-tény:{' '}
                <Link to="/mezo/knowledge" className="pdt-srcl">a Tudástárban →</Link>
              </>
            )}
          </p>
        </div>
      ))}
    </div>
  )
}
