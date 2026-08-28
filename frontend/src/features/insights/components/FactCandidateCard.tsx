import { useState } from 'react'
import { ClaySpot } from '@/shared/ui/clay'
import { factCategoryColor, factCategoryLabel } from '@/data/insights/knowledge'
import type { FactCandidate, FactDecision } from '@/data/types'

/**
 * Egy jóváhagyásra váró jelölt (mezo-9ryh · re-face mezo-d20.5.5) — a prototype mezo-body
 * `.candc` arany-gyűrűs inbox-kártyája: figyelő orb + kategória-címke, a jelölt szövege,
 * a proveniencia-mondat, és a három 44pt-os döntésgomb. A „Pontosít" inline input
 * viselkedése változatlan (V1.2 L2 döntés, a confirm sosem néma).
 */
export function FactCandidateCard({ candidate, onDecide }: {
  candidate: FactCandidate
  onDecide: (decision: FactDecision, refinedText?: string) => void
}) {
  const [refining, setRefining] = useState(false)
  const [refinedText, setRefinedText] = useState(candidate.text)
  const color = factCategoryColor(candidate.category)

  return (
    <div className="mz-candc">
      <div className="row gap-sm" style={{ alignItems: 'center' }}>
        <ClaySpot name="s-orb-figyel" size={26} />
        <span className="label-mono" style={{ fontSize: 9, color }}>{factCategoryLabel(candidate.category)}</span>
      </div>
      <p style={{ fontSize: 15, lineHeight: 1.4, color: 'var(--text-primary)', margin: '6px 0 0' }}>{candidate.text}</p>
      <p className="text-secondary" style={{ fontSize: 12, lineHeight: 1.5, margin: '4px 0 0' }}>
        Ezt a beszélgetésből szűrtem ki — csak akkor jegyzem meg, ha elfogadod.
      </p>

      {refining ? (
        <div className="row gap-sm" style={{ alignItems: 'center', marginTop: 10 }}>
          <input
            aria-label="Pontosított tény"
            value={refinedText}
            onChange={(e) => setRefinedText(e.target.value)}
            style={{
              flex: 1, fontSize: 12, padding: '6px 8px', borderRadius: 6,
              border: '1px solid var(--border-default)', background: 'var(--surface-0)', color: 'var(--text-primary)',
            }}
          />
          <button type="button" className="mz-decbtn primary" disabled={!refinedText.trim()} onClick={() => onDecide('refine', refinedText.trim())}>
            Mentés
          </button>
        </div>
      ) : (
        <>
          <div className="mz-decrow">
            <button type="button" className="mz-decbtn primary" onClick={() => onDecide('accept')}>
              Elfogad
            </button>
            <button type="button" className="mz-decbtn" onClick={() => setRefining(true)}>
              Pontosít
            </button>
            <button type="button" className="mz-decbtn" onClick={() => onDecide('reject')}>
              Elvet
            </button>
          </div>
          <p className="text-tertiary" style={{ fontSize: 10.5, lineHeight: 1.5, margin: '8px 0 0' }}>
            Elfogad → bekerül a tudástárba · Pontosít → átírod a szövegét · Elvet → eldobom.
          </p>
        </>
      )}
    </div>
  )
}
