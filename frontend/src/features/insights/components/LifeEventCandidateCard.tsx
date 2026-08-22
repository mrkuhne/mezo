import type { LifeEventCandidate, LifeEventDecision } from '@/data/types'

/**
 * Egy éjszakai életesemény-jelölt (W2.3, mezo-b3pp.8). A kártya kimondja, honnan jött és mit
 * tesz a két gomb — a megerősítés sosem néma (IDENT-6, a FactCandidateCard idiómája).
 */
export function LifeEventCandidateCard({ candidate, onDecide }: {
  candidate: LifeEventCandidate
  onDecide: (decision: LifeEventDecision) => void
}) {
  return (
    <div className="card" style={{ padding: '12px 14px 12px 16px', position: 'relative', borderColor: 'var(--line)' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--amber-deep)' }} />

      {candidate.occurredOn && (
        <span className="label-mono" style={{ fontSize: 9, color: 'var(--amber-deep)' }}>{candidate.occurredOn}</span>
      )}
      <p style={{ fontSize: 15, lineHeight: 1.4, color: 'var(--text-primary)', margin: '6px 0 0' }}>{candidate.title}</p>
      {candidate.summary && (
        <p className="text-secondary" style={{ fontSize: 12, lineHeight: 1.5, margin: '6px 0 0' }}>{candidate.summary}</p>
      )}
      <p className="text-secondary" style={{ fontSize: 12, lineHeight: 1.5, margin: '6px 0 0' }}>
        Ezt a napod szövegeiből szűrtem ki — csak akkor kerül a gráfba, ha elfogadod.
      </p>

      <div className="row gap-sm" style={{ marginTop: 10 }}>
        <button className="chip" onClick={() => onDecide('accept')} style={{ fontSize: 11, color: 'var(--lav-deep)' }}>
          Elfogad
        </button>
        <button className="chip" onClick={() => onDecide('reject')} style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          Elvet
        </button>
      </div>
      <p className="text-tertiary" style={{ fontSize: 10.5, lineHeight: 1.5, margin: '6px 0 0' }}>
        {candidate.proposedEdgeCount > 0
          ? `Elfogad → bekerül a gráfba ${candidate.proposedEdgeCount} kapcsolattal · Elvet → eldobom.`
          : 'Elfogad → bekerül a gráfba · Elvet → eldobom.'}
      </p>
    </div>
  )
}
