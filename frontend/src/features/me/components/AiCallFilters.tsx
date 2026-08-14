import type { components } from '@/data/_client/api.gen'
import type { LlmCallFilters as Filters } from '@/data/me/llmUsageApi'

type Totals = components['schemas']['LlmUsageTotals']

// The list's filter strip (mezo-uakh). Every chip toggles: clicking the active one clears it, so
// there is never a filter you cannot get out of. The feature chip is not chosen here — it arrives
// from the breakdown bars above — but it IS shown here so the active narrowing lives in one place.
//
// Token note: the brief's `--border` (with a `var(--surface-2)` fallback) does not exist on this
// surface (grepped frontend/src/styles/prototype.css). Substituted `--border-subtle` — the pill/card
// border weight used throughout (MacroPanel, NovaPanel, GoalRecept, GoalTimeline). `--surface-1`
// does exist, so its fallback was just dead code and is dropped.

function chipStyle(active: boolean): React.CSSProperties {
  return {
    flexShrink: 0, fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '6px 11px',
    cursor: 'pointer', border: '1px solid var(--border-subtle)',
    background: active ? 'var(--text-primary)' : 'var(--surface-1)',
    color: active ? 'var(--surface-1)' : 'var(--text-secondary)',
  }
}

export function AiCallFilters({ totals, filters, onChange }: {
  totals: Totals
  filters: Filters
  onChange: (next: Filters) => void
}) {
  const toggleStatus = (status: string) => {
    const { status: current, ...rest } = filters
    onChange(current === status ? rest : { ...rest, status })
  }

  return (
    <div className="row" style={{ gap: 6, overflowX: 'auto', padding: '12px 0 2px' }}>
      {filters.feature && (
        <button type="button" style={chipStyle(true)} onClick={() => {
          const { feature, ...rest } = filters
          onChange(rest)
        }}>
          {filters.feature} ✕
        </button>
      )}
      <button type="button" style={chipStyle(!filters.status)} onClick={() => {
        const { status, ...rest } = filters
        onChange(rest)
      }}>
        Mind
      </button>
      <button type="button" style={chipStyle(filters.status === 'SUCCESS')} onClick={() => toggleStatus('SUCCESS')}>
        Siker {totals.successCount}
      </button>
      <button type="button" style={chipStyle(filters.status === 'ERROR')} onClick={() => toggleStatus('ERROR')}>
        Hiba {totals.errorCount}
      </button>
      <button type="button" style={chipStyle(filters.status === 'CANCELLED')} onClick={() => toggleStatus('CANCELLED')}>
        Megszakadt {totals.cancelledCount}
      </button>
    </div>
  )
}
