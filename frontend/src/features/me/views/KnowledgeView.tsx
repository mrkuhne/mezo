import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageTitle } from '@/components/ui/PageTitle'
import { Chip } from '@/components/ui/Chip'
import { Icon } from '@/components/ui/Icon'
import { LabelMono } from '@/components/ui/LabelMono'
import { ToolChipRow } from '@/components/ui/ToolChipRow'
import type { Tool } from '@/components/ui/ToolChip'
import { useKnowledge } from '@/data/hooks'
import { FACT_CATEGORIES, factCategoryColor } from '@/data/knowledge'
import { CategoryHeader } from '../components/CategoryHeader'
import { KnowledgeFactCard } from '../components/KnowledgeFactCard'

const KNOWLEDGE_TOOLS: Tool[] = [
  { type: 'read', name: 'get_knowledge_facts' },
  { type: 'read', name: 'get_edges' },
  { type: 'compute', name: 'recomputeGraphLayout' },
]

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
        {/* Search chip is inert */}
        <Chip style={{ padding: '8px 10px' }}>
          <Icon name="search" size={12} />
        </Chip>
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

      {/* Graph view — deferred to Slice 4 */}
      <div style={{ padding: '0 24px 16px' }}>
        <div
          className="card notch-12"
          style={{
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--canvas)',
          }}
        >
          <LabelMono>Gráf nézet · hamarosan (Slice 4)</LabelMono>
        </div>
      </div>

      {/* Facts by category */}
      <div style={{ padding: '0 24px 16px' }}>
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
        <div className="mt-md">
          <ToolChipRow tools={KNOWLEDGE_TOOLS} />
        </div>
      </div>

      {/* LearnedFact transparency footer */}
      <div style={{ padding: '0 24px 32px' }}>
        <div className="card notch-4" style={{ padding: 12 }}>
          <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
            <Icon name="sparkle" size={11} color="var(--brand-glow)" />
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1 }}>
              <span style={{ color: 'var(--brand-glow)' }}>LearnedFact transzparencia.</span>{' '}
              Egy fact akkor kerül a promptodba, ha aktív. Húzz egy csomópontot a gráfon, és állítsd át — Mezo a következő
              üzenetben tükrözi.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
