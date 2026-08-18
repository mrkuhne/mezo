import { useState } from 'react'
import { factCategoryColor, factCategoryLabel } from '@/data/insights/knowledge'
import type { FactCandidate, FactDecision } from '@/data/types'

/**
 * Egy jóváhagyásra váró jelölt (mezo-9ryh) — a mai kártya kiemelve a page-ből, kiírva, hogy
 * honnan jött és hogy a három gomb pontosan mit tesz. A „Pontosít" inline input viselkedése
 * változatlan (V1.2 L2 döntés, a confirm sosem néma).
 */
export function FactCandidateCard({ candidate, onDecide }: {
  candidate: FactCandidate
  onDecide: (decision: FactDecision, refinedText?: string) => void
}) {
  const [refining, setRefining] = useState(false)
  const [refinedText, setRefinedText] = useState(candidate.text)
  const color = factCategoryColor(candidate.category)

  return (
    <div className="card" style={{ padding: '12px 14px 12px 16px', position: 'relative', borderColor: 'var(--line)' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: color }} />

      <span className="label-mono" style={{ fontSize: 9, color }}>{factCategoryLabel(candidate.category)}</span>
      <p style={{ fontSize: 15, lineHeight: 1.4, color: 'var(--text-primary)', margin: '6px 0 0' }}>{candidate.text}</p>
      <p className="text-secondary" style={{ fontSize: 12, lineHeight: 1.5, margin: '6px 0 0' }}>
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
          <button className="chip" disabled={!refinedText.trim()} onClick={() => onDecide('refine', refinedText.trim())} style={{ fontSize: 11 }}>
            Mentés
          </button>
        </div>
      ) : (
        <>
          <div className="row gap-sm" style={{ marginTop: 10 }}>
            <button className="chip" onClick={() => onDecide('accept')} style={{ fontSize: 11, color: 'var(--lav-deep)' }}>
              Elfogad
            </button>
            <button className="chip" onClick={() => setRefining(true)} style={{ fontSize: 11 }}>
              Pontosít
            </button>
            <button className="chip" onClick={() => onDecide('reject')} style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              Elvet
            </button>
          </div>
          <p className="text-tertiary" style={{ fontSize: 10.5, lineHeight: 1.5, margin: '6px 0 0' }}>
            Elfogad → bekerül a tudástárba · Pontosít → átírod a szövegét · Elvet → eldobom.
          </p>
        </>
      )}
    </div>
  )
}
