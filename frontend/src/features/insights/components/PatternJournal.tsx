import { Link } from 'react-router-dom'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import type { JournalEntry } from '@/features/insights/logic/patternHistory'

const DOT_COLOR: Record<JournalEntry['tone'], string> = {
  neutral: 'var(--text-disabled)',
  success: 'var(--success-base)',
  accent: 'var(--accent-base)',
}

/**
 * The pattern-pair detail page's history timeline (mezo-tk88.5, spec-mockup screen 2 „A minta
 * története"): a left rail + one tone-colored dot per `journalEntries()` row. Pure presentational —
 * every derivation (date label, tone, text, whether a fact was born) already happened in
 * `logic/patternHistory.ts`; this component only lays it out.
 */
export function PatternJournal({ entries }: { entries: JournalEntry[] }) {
  return (
    <div style={{ position: 'relative', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 13, marginTop: 10 }}>
      <div style={{ position: 'absolute', left: 5, top: 6, bottom: 6, width: 1, background: 'var(--border-subtle)' }} />
      {entries.map((entry, i) => (
        <div key={`${entry.date}-${i}`} style={{ position: 'relative' }}>
          <span
            style={{
              position: 'absolute', left: -19, top: 4, width: 7, height: 7, borderRadius: 999,
              background: DOT_COLOR[entry.tone], boxShadow: '0 0 0 3px var(--surface-1)',
            }}
          />
          <div style={{ font: '700 10px/1 var(--ff-body)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
            {entry.date}
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--text-secondary)', marginTop: 3 }}>
            <SafeMarkdown text={entry.text} />
            {entry.factLink && (
              <>
                {' '}Létrejött a tudás-tény:{' '}
                <Link to="/mezo/knowledge" style={{ color: 'var(--lav-deep)', fontWeight: 600, textDecoration: 'none' }}>
                  a Tudástárban →
                </Link>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
