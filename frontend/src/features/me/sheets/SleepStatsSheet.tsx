import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Icon3D } from '@/shared/ui/clay'
import {
  ESCALATION_CBT, ESCALATION_HEAVY_STATS, ESCALATION_LEAD, STAT_DECK,
} from '@/features/me/logic/sleepEducation'

/** The full Walker deck (slice C3, spec D3) + the escalation section (spec D4) when the
 *  trigger fired — the ONLY place the heavy clinical stats render.
 *  Üveg (mezo-me75u.6): one floating gold glass sheet, the deck rows flat inside it. */
export function SleepStatsSheet({
  escalation,
  onClose,
}: {
  escalation: 'short' | 'quality' | null
  onClose: () => void
}) {
  return (
    <Sheet onClose={onClose} labelledBy="sleep-stats-title" className="glass sst-sheet">
      {(close) => (
        <div className="sst-body">
          <div className="sst-head">
            <Icon3D name="t-book" size={44} />
            <div className="sst-head-tx">
              <span className="sst-eye">Miért számít az alvás?</span>
              <div id="sleep-stats-title" className="sst-title">A kutatás számai</div>
            </div>
            <button type="button" className="sst-x" aria-label="Bezárás" onClick={close}><Icon name="x" size={12} /></button>
          </div>

          {escalation && (
            <section className="sesc-sheet" aria-label="Az alvásod jelez">
              <span className="sstat-head">
                <Icon3D name="t-info" size={26} />
                <span className="sstat-eye">Az alvásod jelez</span>
              </span>
              <p className="sesc-lead">
                {ESCALATION_LEAD[escalation]}
                {' '}Ez nem akaraterő kérdése.
              </p>
              <p className="sesc-body">{ESCALATION_HEAVY_STATS}</p>
              <p className="sesc-body"><b>{ESCALATION_CBT}</b></p>
            </section>
          )}

          <div className="sst-rows">
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
