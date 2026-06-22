import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageTitle } from '@/components/ui/PageTitle'
import { useKnowledge } from '@/data/hooks'
import { FACT_CATEGORIES, factCategoryColor } from '@/data/knowledge'
import { CategoryHeader } from '../components/CategoryHeader'
import { KnowledgeFactCard } from '../components/KnowledgeFactCard'

export function KnowledgeView() {
  const { facts, edges, activeCount } = useKnowledge()

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <Eyebrow brand>Me · Tudás</Eyebrow>
          <PageTitle className="mt-sm">Knowledge graph</PageTitle>
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
            background: 'linear-gradient(135deg, var(--surface-1) 0%, rgba(94, 234, 212, 0.05) 100%)',
            borderColor: 'var(--border-brand)',
          }}
        >
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="col">
              <Eyebrow brand>Élő mindmap · növekvő</Eyebrow>
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
          <Eyebrow brand>{facts.length}</Eyebrow>
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
