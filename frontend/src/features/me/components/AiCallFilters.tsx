import { useState } from 'react'
import { callKindLabel } from '@/features/me/logic/llmCallFormat'
import type { components } from '@/data/_client/api.gen'
import type { LlmCallFilters as Filters } from '@/data/me/llmUsageApi'

type Totals = components['schemas']['LlmUsageTotals']

// The list's filter strip (mezo-uakh). Every chip toggles: clicking the active one clears it, so
// there is never a filter you cannot get out of. The feature chip is not chosen here — it arrives
// from the breakdown bars above — but it IS shown here so the active narrowing lives in one place.
//
// `totals` is NULLABLE on purpose: when the breakdown read failed while the list succeeded, the
// chips stay usable (the filters run server-side on the list endpoint, which is fine) but the
// counts are omitted rather than invented — a failed rollup is unknown, not "Siker 0 · Hiba 0".
//
// Token note: the brief's `--border` (with a `var(--surface-2)` fallback) does not exist on this
// surface (grepped frontend/src/styles/prototype.css). Substituted `--border-subtle` — the pill/card
// border weight used throughout (MacroPanel, NovaPanel, GoalRecept, GoalTimeline). `--surface-1`
// does exist, so its fallback was just dead code and is dropped.

/** Every kind the backend writes onto a row (CallKind) — the `callKind` axis of the list query. */
const CALL_KINDS = [
  'CHAT', 'CHAT_STREAM', 'VISION', 'SMART', 'TOOL', 'TRANSCRIBE', 'EMBED_DOC', 'EMBED_QUERY',
] as const

function chipStyle(active: boolean): React.CSSProperties {
  return {
    flexShrink: 0, fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '6px 11px',
    cursor: 'pointer', border: '1px solid var(--border-subtle)',
    background: active ? 'var(--text-primary)' : 'var(--surface-1)',
    color: active ? 'var(--surface-1)' : 'var(--text-secondary)',
  }
}

export function AiCallFilters({ totals, filters, onChange }: {
  totals: Totals | null
  filters: Filters
  onChange: (next: Filters) => void
}) {
  // The eight kinds do not fit the strip, so they live behind a "Típus ▾" disclosure — still
  // chips, not a new widget. Once one is picked the disclosure collapses into the picked chip.
  const [kindsOpen, setKindsOpen] = useState(false)

  const toggleStatus = (status: string) => {
    const { status: current, ...rest } = filters
    onChange(current === status ? rest : { ...rest, status })
  }

  const pickKind = (callKind: string) => {
    setKindsOpen(false)
    onChange({ ...filters, callKind })
  }

  const clearKind = () => {
    const { callKind, ...rest } = filters
    onChange(rest)
  }

  // `n == null` (no rollup to read) drops the number entirely; a real 0 still prints as "0".
  const chipLabel = (text: string, n: number | undefined) => (n == null ? text : `${text} ${n}`)

  return (
    <div className="col" style={{ gap: 6, padding: '12px 0 2px' }}>
      <div className="row" style={{ gap: 6, overflowX: 'auto' }}>
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
          {chipLabel('Siker', totals?.successCount)}
        </button>
        <button type="button" style={chipStyle(filters.status === 'ERROR')} onClick={() => toggleStatus('ERROR')}>
          {chipLabel('Hiba', totals?.errorCount)}
        </button>
        <button type="button" style={chipStyle(filters.status === 'CANCELLED')} onClick={() => toggleStatus('CANCELLED')}>
          {chipLabel('Megszakadt', totals?.cancelledCount)}
        </button>

        {filters.callKind ? (
          <button type="button" style={chipStyle(true)} onClick={clearKind}>
            {callKindLabel(filters.callKind)} ✕
          </button>
        ) : (
          <button
            type="button"
            style={chipStyle(false)}
            aria-expanded={kindsOpen}
            onClick={() => setKindsOpen((open) => !open)}
          >
            Típus ▾
          </button>
        )}
      </div>

      {kindsOpen && !filters.callKind && (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {CALL_KINDS.map((kind) => (
            <button key={kind} type="button" style={chipStyle(false)} onClick={() => pickKind(kind)}>
              {callKindLabel(kind)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
