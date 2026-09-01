import { useState } from 'react'
import type { LifeEventCandidate, LifeEventDecision } from '@/data/types'
import { CANDIDATE_COPY, formatCandidateDate } from '@/data/insights/graph'

/**
 * Egy L2 gráf-jelölt kártyája — akár egy éjszakai életesemény (W2.3, mezo-b3pp.8), akár egy
 * negyedéves szezon (W5.3, mezo-b3pp.20). A kártya kimondja, honnan jött és mit tesz a két gomb —
 * a megerősítés sosem néma (IDENT-6, a FactCandidateCard idiómája).
 *
 * A „Pontosít" (mezo-ms9a Task 11) szerkeszt-aztán-elfogad affordance: a FactCandidateCard
 * inline refine idiómáját követi, de kind-agnosztikus (LIFE_EVENT és SEASON is), és mindkét
 * mezőt (cím + összefoglaló) szerkeszthetővé teszi, mert a kártya mindkettőt kiírja.
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

  return (
    <div className="card" style={{ padding: '12px 14px 12px 16px', position: 'relative', borderColor: 'var(--line)' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--amber-deep)' }} />

      {candidate.occurredOn && (
        <span className="label-mono" style={{ fontSize: 9, color: 'var(--amber-deep)' }}>
          {formatCandidateDate(candidate.kind, candidate.occurredOn)}
        </span>
      )}

      {refining ? (
        <div className="col gap-sm" style={{ marginTop: 6 }}>
          <input
            aria-label="Jelölt címe"
            value={title}
            maxLength={160}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              fontSize: 15, padding: '6px 8px', borderRadius: 6,
              border: '1px solid var(--border-default)', background: 'var(--surface-0)', color: 'var(--text-primary)',
            }}
          />
          <textarea
            aria-label="Jelölt összefoglalója"
            value={summary}
            maxLength={500}
            onChange={(e) => setSummary(e.target.value)}
            rows={2}
            style={{
              fontSize: 12, padding: '6px 8px', borderRadius: 6, resize: 'vertical',
              border: '1px solid var(--border-default)', background: 'var(--surface-0)', color: 'var(--text-primary)',
            }}
          />
          <div className="row gap-sm">
            <button type="button" className="chip" disabled={!title.trim()} onClick={acceptRefined} style={{ fontSize: 11, color: 'var(--lav-deep)' }}>
              Elfogad így
            </button>
            <button type="button" className="chip" onClick={() => setRefining(false)} style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              Mégse
            </button>
          </div>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 15, lineHeight: 1.4, color: 'var(--text-primary)', margin: '6px 0 0' }}>{candidate.title}</p>
          {candidate.summary && (
            <p className="text-secondary" style={{ fontSize: 12, lineHeight: 1.5, margin: '6px 0 0' }}>{candidate.summary}</p>
          )}
          <p className="text-secondary" style={{ fontSize: 12, lineHeight: 1.5, margin: '6px 0 0' }}>
            {CANDIDATE_COPY[candidate.kind].provenance}
          </p>

          <div className="row gap-sm" style={{ marginTop: 10 }}>
            <button className="chip" onClick={() => onDecide('accept')} style={{ fontSize: 11, color: 'var(--lav-deep)' }}>
              Elfogad
            </button>
            <button className="chip" onClick={startRefine} style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              Pontosít
            </button>
            <button className="chip" onClick={() => onDecide('reject')} style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              Elvet
            </button>
          </div>
          <p className="text-tertiary" style={{ fontSize: 10.5, lineHeight: 1.5, margin: '6px 0 0' }}>
            {candidate.proposedEdgeCount > 0
              ? `Elfogad → bekerül a gráfba ${candidate.proposedEdgeCount} kapcsolattal · Pontosít → átírod cím/összefoglaló · Elvet → eldobom.`
              : 'Elfogad → bekerül a gráfba · Pontosít → átírod cím/összefoglaló · Elvet → eldobom.'}
          </p>
        </>
      )}
    </div>
  )
}
