import { useState } from 'react'
import type { LifeEventCandidate, LifeEventDecision } from '@/data/types'
import { CANDIDATE_COPY } from '@/data/insights/graph'
import { graphCandidateByline } from '@/features/insights/logic/roladCopy'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'

/** Üveg (U9 · mezo-me75u.9): an életesemény speaks amber, a szezon sky — each a glass case
 *  with its own status chip and 3D icon (prototype `uveg-mezo-teljes-u9.js` tudastar). */
const CARD_SKIN: Record<LifeEventCandidate['kind'], { accent: 'gold' | 'sky'; status: string; icon: Icon3DName }> = {
  LIFE_EVENT: { accent: 'gold', status: 'Életesemény-jelölt', icon: 't-journal' },
  SEASON: { accent: 'sky', status: 'Évszak-jelölt', icon: 't-calendar' },
}

/**
 * Egy L2 gráf-jelölt kártyája — akár egy éjszakai életesemény (W2.3, mezo-b3pp.8), akár egy
 * negyedéves szezon (W5.3, mezo-b3pp.20). A kártya kimondja, honnan jött és mit tesz a négy gomb —
 * a megerősítés sosem néma (IDENT-6, a FactCandidateCard idiómája).
 *
 * A „Pontosítom" (mezo-ms9a Task 11) szerkeszt-aztán-elfogad affordance: a FactCandidateCard
 * inline refine idiómáját követi, de kind-agnosztikus (LIFE_EVENT és SEASON is), és mindkét
 * mezőt (cím + összefoglaló) szerkeszthetővé teszi, mert a kártya mindkettőt kiírja.
 *
 * A négy döntésgomb (U9b Task 8, mezo-zpxv7): „Igen, jegyezd meg" / „Pontosítom" / „Most ne"
 * (snooze) / „Nem igaz" (reject, néma szöveggomb) — a FactCandidateCard idiómája ismétlődik meg.
 */
export function LifeEventCandidateCard({ candidate, onDecide }: {
  candidate: LifeEventCandidate
  onDecide: (decision: LifeEventDecision, refined?: { title?: string; summary?: string }) => void
}) {
  const [refining, setRefining] = useState(false)
  const [title, setTitle] = useState(candidate.title)
  const [summary, setSummary] = useState(candidate.summary ?? '')

  const startRefine = () => {
    setTitle(candidate.title)
    setSummary(candidate.summary ?? '')
    setRefining(true)
  }

  const acceptRefined = () => {
    // Üres összefoglaló undefined-ként megy tovább, sosem ""-ként — a backend DTO
    // @Size(min=1)-et ír elő refinedSummary-re, egy üres string 400-at dobna real módban.
    onDecide('accept', { title: title.trim() || undefined, summary: summary.trim() || undefined })
  }

  const skin = CARD_SKIN[candidate.kind]
  return (
    <article className={`glass tf-case tf-c-${skin.accent} tf-s-${skin.accent} tud9-case tud9-life`} data-graph-card>
      <span className="tf-crow">
        <span className="tf-st">{skin.status}</span>
        <em>{graphCandidateByline(candidate)}</em>
      </span>

      {refining ? (
        <div className="tud9-refine is-col">
          <input
            className="tud9-input"
            aria-label="Jelölt címe"
            value={title}
            maxLength={160}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="tud9-input"
            aria-label="Jelölt összefoglalója"
            value={summary}
            maxLength={500}
            onChange={(e) => setSummary(e.target.value)}
            rows={2}
          />
          <div className="tud9-acts is-pair">
            <button type="button" className="tud9-btn is-main" disabled={!title.trim()} onClick={acceptRefined}>
              <Icon3D name="t-tick" size={20} />Így jegyezd meg
            </button>
            <button type="button" className="tud9-btn" onClick={() => setRefining(false)}>
              Mégse
            </button>
          </div>
        </div>
      ) : (
        <>
          <span className="tf-cmain">
            <Icon3D name={skin.icon} size={36} />
            <span className="tf-ctxt">
              <span className="tf-ctitle">{candidate.title}</span>
              {candidate.summary && <span className="tf-csub">{candidate.summary}</span>}
            </span>
          </span>
          <p className="tud9-prov">{CANDIDATE_COPY[candidate.kind].provenance}</p>

          <div className="tud9-acts">
            <button type="button" className="tud9-btn is-main" onClick={() => onDecide('accept')}>
              <Icon3D name="t-tick" size={20} />Igen, jegyezd meg
            </button>
            <button type="button" className="tud9-btn" onClick={startRefine}>
              <Icon3D name="t-pencil" size={20} />Pontosítom
            </button>
            <button type="button" className="tud9-btn" onClick={() => onDecide('snooze')}>
              <Icon3D name="t-clock" size={20} />Most ne
            </button>
          </div>
          <button type="button" className="tud9-no" onClick={() => onDecide('reject')}>
            Nem igaz
          </button>
          {candidate.proposedEdgeCount > 0 && (
            <p className="tud9-foot">Elfogadás után {candidate.proposedEdgeCount} kapcsolat is bekerül.</p>
          )}
        </>
      )}
    </article>
  )
}
