import type { MealMatch } from '@/data/types'
import { Icon } from '@/shared/ui/Icon'
import { useRecipes } from '@/data/hooks'

// fuel-stack.jsx MealMatchRow (365–391)
export function MealMatchRow({ match }: { match: MealMatch }) {
  const r = useRecipes().recipes.find(rec => rec.id === match.recipeId)
  if (!r) return null
  return (
    <div className="card row" style={{ padding: '10px 12px', alignItems: 'center', gap: 10 }}>
      <div
        className="col"
        style={{
          width: 36,
          height: 36,
          flexShrink: 0,
          background: 'repeating-linear-gradient(45deg, var(--surface-2) 0 4px, var(--surface-3) 4px 8px)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="fuel" size={12} color="var(--text-tertiary)" />
      </div>
      <div className="col flex-1" style={{ minWidth: 0 }}>
        <span style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500 }}>{r.name}</span>
        <span className="text-tertiary" style={{ fontSize: 10, marginTop: 2 }}>
          {match.reason}
        </span>
      </div>
      <div className="col" style={{ alignItems: 'flex-end' }}>
        <span className="label-mono" style={{ fontSize: 9 }}>
          fit {((r.mezoFit.score ?? 0) * 100).toFixed(0)}
        </span>
        <span className="label-mono text-tertiary mt-xs" style={{ fontSize: 9 }}>
          {match.slot}
        </span>
      </div>
    </div>
  )
}
