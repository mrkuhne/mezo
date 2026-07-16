import { useState } from 'react'
import { Toggle } from '@/shared/ui/Toggle'
import { useKnowledge, useKnowledgeActions } from '@/data/hooks'
import { factCategoryColor, factCategoryLabel } from '@/data/insights/knowledge'
import type { FactCandidate, FactDecision } from '@/data/types'

function CandidateCard({ candidate, onDecide }: {
  candidate: FactCandidate
  onDecide: (decision: FactDecision, refinedText?: string) => void
}) {
  const [refining, setRefining] = useState(false)
  const [refinedText, setRefinedText] = useState(candidate.text)
  const color = factCategoryColor(candidate.category)

  return (
    <div className="card" style={{ padding: 12, position: 'relative', borderColor: 'var(--line)' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: color }} />
      <div className="col gap-sm" style={{ paddingLeft: 8 }}>
        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{candidate.text}</span>
        <span className="label-mono" style={{ fontSize: 9, color }}>{factCategoryLabel(candidate.category)}</span>
        {refining ? (
          <div className="row gap-sm" style={{ alignItems: 'center' }}>
            <input
              aria-label="Pontosított tény"
              value={refinedText}
              onChange={(e) => setRefinedText(e.target.value)}
              style={{
                flex: 1, fontSize: 12, padding: '6px 8px', borderRadius: 6,
                border: '1px solid var(--border-default)', background: 'var(--surface-0)', color: 'var(--text-primary)',
              }}
            />
            <button
              className="chip"
              disabled={!refinedText.trim()}
              onClick={() => onDecide('refine', refinedText.trim())}
              style={{ fontSize: 11 }}
            >
              Mentés
            </button>
          </div>
        ) : (
          <div className="row gap-sm">
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
        )}
      </div>
    </div>
  )
}

export function KnowledgeListPage() {
  const { facts, candidates, activeCount, degraded } = useKnowledge()
  const { toggle, decide } = useKnowledgeActions()

  if (degraded) {
    return (
      <div className="col gap-md">
        <div className="card" style={{ padding: 14 }}>
          <span className="text-secondary" style={{ fontSize: 12, lineHeight: 1.5 }}>
            A társ jelenleg nincs bekapcsolva — a tudástár most nem elérhető.
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="col gap-md">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow">Tudás · {facts.length} fact</span>
        <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>{activeCount} aktív promptban</span>
      </div>

      {candidates.length > 0 && (
        <div className="col gap-sm">
          <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>
            Jóváhagyásra vár · {candidates.length}
          </span>
          {candidates.map((c) => (
            <CandidateCard
              key={c.id}
              candidate={c}
              onDecide={(decision, refinedText) => decide(c.id, decision, refinedText)}
            />
          ))}
        </div>
      )}

      <div className="col gap-sm">
        {facts.map((f) => {
          const color = factCategoryColor(f.category)
          return (
            <div key={f.id} className="card" style={{ padding: 12, opacity: f.active ? 1 : 0.5, position: 'relative' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: color }} />
              <div className="row gap-sm" style={{ paddingLeft: 8, alignItems: 'center' }}>
                <div className="col flex-1">
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{f.text}</span>
                  <div className="row gap-sm mt-sm">
                    <span className="label-mono" style={{ fontSize: 9, color }}>{factCategoryLabel(f.category)}</span>
                    <span className="text-tertiary" style={{ fontSize: 10, fontVariantNumeric: 'tabular-nums' }}>×{f.reinforced} reinforced</span>
                    {f.patternTitle && (
                      <span className="chip" style={{ fontSize: 9 }} title={f.patternTitle}>minta: {f.patternTitle}</span>
                    )}
                  </div>
                </div>
                <Toggle
                  on={f.active}
                  onToggle={() => toggle(f.id, !f.active)}
                  ariaLabel={`${f.text} aktív a promptban`}
                />
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-tertiary mt-md" style={{ fontSize: 11, textAlign: 'center', lineHeight: 1.5, padding: '0 20px' }}>
        Az aktív tények minden chat-fordulóba bekerülnek a system promptba. A graph nézethez · Me → Knowledge.
      </p>
    </div>
  )
}
