import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import {
  ESCALATION_CBT, ESCALATION_HEAVY_STATS, STAT_DECK,
} from '@/features/me/logic/sleepEducation'

/** The full Walker deck (slice C3, spec D3) + the escalation section (spec D4) when the
 *  trigger fired — the ONLY place the heavy clinical stats render. */
export function SleepStatsSheet({
  escalation,
  onClose,
}: {
  escalation: 'short' | 'quality' | null
  onClose: () => void
}) {
  return (
    <Sheet onClose={onClose} labelledBy="sleep-stats-title">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div className="col">
              <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>Miért számít az alvás?</span>
              <div id="sleep-stats-title" className="h-display size-md" style={{ marginTop: 4 }}>A kutatás számai</div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}><Icon name="x" size={12} /></button>
          </div>

          {escalation && (
            <section className="sesc-sheet" aria-label="Az alvásod jelez">
              <span className="sstat-eye" style={{ color: 'var(--amber-deep)' }}>Az alvásod jelez</span>
              <p className="sesc-lead">
                {escalation === 'short'
                  ? 'Az elmúlt két hétben tartósan kevés az alvásod.'
                  : 'Az elmúlt két hétben tartósan rossz minőségű az alvásod.'}
                {' '}Ez nem akaraterő kérdése.
              </p>
              <p className="sesc-body">{ESCALATION_HEAVY_STATS}</p>
              <p className="sesc-body"><b>{ESCALATION_CBT}</b></p>
            </section>
          )}

          <div className="col gap-sm">
            {STAT_DECK.map((s) => (
              <div key={s.key} className="sstat-row">
                <span className="sstat-title">{s.title}</span>
                <span className="sstat-text">{s.text}</span>
                <span className="sstat-src">{s.source}</span>
              </div>
            ))}
          </div>

          <p className="sstat-foot">
            Források: Matthew Walker (Diary of a CEO interjú) és Jeremy Ethier — feldolgozva a
            projekt research-wikijében (docs/research).
          </p>
        </div>
      )}
    </Sheet>
  )
}
