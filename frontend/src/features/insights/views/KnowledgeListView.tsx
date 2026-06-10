import { useState } from 'react'
import { Toggle } from '@/components/ui/Toggle'
import { useKnowledge } from '@/data/hooks'
import { factCategoryColor } from '@/data/knowledge'

export function KnowledgeListView() {
  const { facts } = useKnowledge()
  const [active, setActive] = useState<Record<string, boolean>>(() =>
    facts.reduce<Record<string, boolean>>((acc, f) => ({ ...acc, [f.id]: f.active }), {}),
  )
  const activeCount = facts.filter((f) => active[f.id]).length

  return (
    <div className="col gap-md">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow">Tudás · {facts.length} fact</span>
        <span className="eyebrow brand">{activeCount} aktív promptban</span>
      </div>

      <div className="col gap-sm">
        {facts.map((f) => {
          const color = factCategoryColor(f.category)
          return (
            <div key={f.id} className="card notch-4" style={{ padding: 12, opacity: active[f.id] ? 1 : 0.5, position: 'relative' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: color }} />
              <div className="row gap-sm" style={{ paddingLeft: 8, alignItems: 'center' }}>
                <div className="col flex-1">
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{f.text}</span>
                  <div className="row gap-sm mt-sm">
                    <span className="label-mono" style={{ fontSize: 9, color }}>{f.category}</span>
                    <span className="text-tertiary" style={{ fontSize: 10, fontFamily: 'var(--ff-mono)' }}>×{f.reinforced} reinforced</span>
                  </div>
                </div>
                <Toggle
                  on={active[f.id]}
                  onToggle={() => setActive((a) => ({ ...a, [f.id]: !a[f.id] }))}
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
