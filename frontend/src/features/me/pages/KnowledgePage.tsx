import { Eyebrow } from '@/shared/ui/Eyebrow'
import { useKnowledge } from '@/data/hooks'
import { FACT_CATEGORIES, factCategoryColor } from '@/data/insights/knowledge'
import { CategoryHeader } from '@/features/me/components/CategoryHeader'
import { KnowledgeFactCard } from '@/features/me/components/KnowledgeFactCard'

export function KnowledgePage() {
  const { facts, edges, activeCount } = useKnowledge()

  return (
    <>
      {/* Header */}
      <div className="pghead-np lav">
        <div>
          <div className="over">Me · Tudás</div>
          <h1>Tudásgráf</h1>
        </div>
      </div>

      {/* Summary band */}
      <div style={{ padding: '0 24px 16px' }}>
        <div
          className="card notch-12"
          style={{
            padding: 16,
            position: 'relative',
            overflow: 'hidden',
            background: 'linear-gradient(180deg, var(--wash-lav) 0%, var(--surface-1) 65%)',
          }}
        >
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="col">
              <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>Élő mindmap · növekvő</span>
              <div style={{ fontFamily: 'var(--ff-display)', fontSize: 22, fontWeight: 600, marginTop: 6, lineHeight: 1.1 }}>
                {`${facts.length} tudás · ${edges.length} kapcsolat`}
              </div>
              <span className="text-secondary" style={{ fontSize: 11, marginTop: 6, lineHeight: 1.45, display: 'block' }}>
                {`${activeCount} aktív a prompt kontextusban · ${facts.length - activeCount} stabilizált vagy archiv`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Facts by category */}
      <div style={{ padding: '0 24px 32px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <Eyebrow>Kategóriánként</Eyebrow>
          <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>{facts.length}</span>
        </div>
        <div className="col gap-md">
          {FACT_CATEGORIES.map(([cat, label]) => {
            const items = facts.filter(f => f.category === cat)
            if (items.length === 0) return null
            return (
              <div key={cat}>
                <CategoryHeader label={label} color={factCategoryColor(cat)} count={items.length} />
                <div className="col gap-xs">
                  {items.map(f => (
                    <KnowledgeFactCard key={f.id} fact={f} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
