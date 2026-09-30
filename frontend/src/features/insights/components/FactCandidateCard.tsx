import { useState } from 'react'
import { Icon3D } from '@/shared/ui/clay'
import { MERGE_COPY, candidateByline } from '@/features/insights/logic/roladCopy'
import type { FactCandidate, FactDecision, KnowledgeFact } from '@/data/types'

/**
 * Egy jóváhagyásra váró jelölt (mezo-9ryh · üveg U9 mezo-me75u.9, byline+négy gomb U9b
 * mezo-zpxv7 Task 8) — a csapatfal-világ arany üveg-ügye (`glass tf-case`): „Tényjelölt"
 * státusz + byline (ki hozta · mikor), a jelölt szövege, a proveniencia-mondat, és a négy
 * döntésgomb (Igen, jegyezd meg világít). A „Pontosítom" inline input viselkedése változatlan
 * (V1.2 L2 döntés, a confirm sosem néma).
 *
 * Konfliktus-jelzés (Task 12, mezo-ms9a): ha a base view a jelölthöz egy ütköző, létező
 * tényt talált (`conflictsWithFactId` → `conflictFact`), egy figyelmeztető sor + bejelölt
 * checkbox jelenik meg. Bármelyik ELFOGADÓ útvonalon (Igen, jegyezd meg VAGY Pontosítom+Így
 * jegyezd meg — mindkettő ténnyé promótál) a decide UTÁN, ha a checkbox be van jelölve, az
 * ütköző tény ki is kapcsol (`onToggleConflict`). A „Most ne" (snooze) és a „Nem igaz" (reject)
 * útvonalon a toggle sosem fut.
 */
export function FactCandidateCard({ candidate, onDecide, conflictFact = null, onToggleConflict }: {
  candidate: FactCandidate
  onDecide: (decision: FactDecision, refinedText?: string) => void
  conflictFact?: KnowledgeFact | null
  onToggleConflict?: (factId: string, active: boolean) => void
}) {
  const [refining, setRefining] = useState(false)
  const [refinedText, setRefinedText] = useState(candidate.text)
  const [turnOffOld, setTurnOffOld] = useState(true)

  const decide = (decision: FactDecision, text?: string) => {
    if (text === undefined) onDecide(decision)
    else onDecide(decision, text)
    if (decision !== 'reject' && decision !== 'snooze' && conflictFact && turnOffOld) {
      onToggleConflict?.(conflictFact.id, false)
    }
  }

  if (candidate.source === 'merge') {
    const sources = candidate.mergeSources ?? []
    return (
      <article className="glass tf-case tf-c-gold tf-s-gold tud9-case tud9-cand" data-fact-candidate data-merge-candidate>
        <span className="tf-crow">
          <span className="tf-st">{MERGE_COPY.tag}</span>
          <em>{candidateByline(candidate.owner, candidate.createdAt)}</em>
        </span>
        <ul className="s9src">
          {sources.map((t, i) => (
            <li key={i}><Icon3D name="t-note" size={18} />„{t}”</li>
          ))}
        </ul>
        <div className="s9arrow">{MERGE_COPY.eyebrow}</div>
        <span className="tf-cmain">
          <Icon3D name="t-layers" size={36} />
          <span className="tf-ctxt">
            <span className="tf-ctitle">„{candidate.text}”</span>
            <span className="tf-csub">{MERGE_COPY.helper(sources.length)}</span>
          </span>
        </span>
        {refining ? (
          <div className="tud9-refine">
            <textarea
              className="tud9-input"
              rows={2}
              aria-label={MERGE_COPY.refineAria}
              value={refinedText}
              onChange={(e) => setRefinedText(e.target.value)}
            />
            <button type="button" className="tud9-btn is-main" disabled={!refinedText.trim()} onClick={() => decide('refine', refinedText.trim())}>
              <Icon3D name="t-tick" size={20} />{MERGE_COPY.refineSave}
            </button>
            <button type="button" className="tud9-btn" onClick={() => { setRefinedText(candidate.text); setRefining(false) }}>
              {MERGE_COPY.refineCancel}
            </button>
          </div>
        ) : (
          <>
            <div className="tud9-acts">
              <button type="button" className="tud9-btn is-main" onClick={() => decide('accept')}>
                <Icon3D name="t-layers" size={20} />{MERGE_COPY.accept}
              </button>
              <button type="button" className="tud9-btn" onClick={() => setRefining(true)}>
                <Icon3D name="t-pencil" size={20} />{MERGE_COPY.refine}
              </button>
              <button type="button" className="tud9-btn" onClick={() => decide('snooze')}>
                <Icon3D name="t-clock" size={20} />{MERGE_COPY.snooze}
              </button>
            </div>
            <button type="button" className="tud9-no" onClick={() => decide('reject')}>{MERGE_COPY.reject}</button>
          </>
        )}
      </article>
    )
  }

  return (
    <article className="glass tf-case tf-c-gold tf-s-gold tud9-case tud9-cand" data-fact-candidate>
      <span className="tf-crow">
        <span className="tf-st">Tényjelölt</span>
        <em>{candidateByline(candidate.owner, candidate.createdAt)}</em>
      </span>
      <span className="tf-cmain">
        <Icon3D name="t-note" size={36} />
        <span className="tf-ctxt">
          <span className="tf-ctitle">{candidate.text}</span>
          <span className="tf-csub">
            {candidate.evidence ?? 'A beszélgetésből szűrtük ki — csak akkor jegyezzük meg, ha elfogadod.'}
          </span>
        </span>
      </span>

      {conflictFact && (
        <div className="tud9-conflictw">
          <p className="tud9-conflict">
            <Icon3D name="t-info" size={18} /> Ellentmond ennek: »{conflictFact.text}«
          </p>
          <label className="tud9-chk">
            <input
              type="checkbox"
              aria-label="A régit kikapcsolom"
              checked={turnOffOld}
              onChange={(e) => setTurnOffOld(e.target.checked)}
            />
            <i aria-hidden="true"><Icon3D name="t-tick" size={14} /></i>
            A régit kikapcsolom
          </label>
        </div>
      )}

      {refining ? (
        <div className="tud9-refine">
          <input
            className="tud9-input"
            aria-label="Pontosított tény"
            value={refinedText}
            onChange={(e) => setRefinedText(e.target.value)}
          />
          <button type="button" className="tud9-btn is-main" disabled={!refinedText.trim()} onClick={() => decide('refine', refinedText.trim())}>
            Így jegyezd meg
          </button>
        </div>
      ) : (
        <>
          <div className="tud9-acts">
            <button type="button" className="tud9-btn is-main" onClick={() => decide('accept')}>
              <Icon3D name="t-tick" size={20} />Igen, jegyezd meg
            </button>
            <button type="button" className="tud9-btn" onClick={() => setRefining(true)}>
              <Icon3D name="t-pencil" size={20} />Pontosítom
            </button>
            <button type="button" className="tud9-btn" onClick={() => decide('snooze')}>
              <Icon3D name="t-clock" size={20} />Most ne
            </button>
          </div>
          <button type="button" className="tud9-no" onClick={() => decide('reject')}>
            Nem igaz
          </button>
        </>
      )}
    </article>
  )
}
