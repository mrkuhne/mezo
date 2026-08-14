import { useState, type ReactNode } from 'react'
import { DOMAIN_META } from '@/features/insights/logic/domains'
import type { MetricDomain } from '@/data/types'

/**
 * Összecsukható domén-szekció a Motor tabon (mezo-18bx): bal színsáv + ikon-badge + tinted
 * fejléc. Alapállapotban az él, amelyikben élő pár van; a többi csukva.
 */
export function DomainSection({
  domain,
  pairCount,
  liveCount,
  filteredEmpty,
  children,
}: {
  domain: MetricDomain
  pairCount: number
  liveCount: number
  /** Az aktív verdikt-szűrő minden sort kiszűrt — a fejléc marad, a törzs őszinte üres sor. */
  filteredEmpty: boolean
  children: ReactNode
}) {
  const meta = DOMAIN_META[domain]
  const [open, setOpen] = useState(liveCount > 0)

  return (
    <div className="card" style={{ overflow: 'hidden', borderLeft: `5px solid ${meta.rail}`, padding: 0 }}>
      <button
        type="button"
        data-testid="domain-header"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="row gap-sm"
        style={{
          width: '100%',
          alignItems: 'center',
          padding: '11px 13px',
          background: meta.tint,
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span
          className="row"
          style={{
            width: 30,
            height: 30,
            borderRadius: 10,
            background: meta.rail,
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 15,
            flexShrink: 0,
          }}
        >
          {meta.icon}
        </span>
        <span className="col" style={{ gap: 0 }}>
          <span style={{ fontFamily: 'var(--ff-display)', fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
            {meta.label}
          </span>
          <span className="eyebrow text-tertiary">{pairCount} pár</span>
        </span>
        {liveCount > 0 && (
          <span
            className="chip"
            style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, color: 'var(--text-inverse)', background: 'var(--success-base)', border: 'none' }}
          >
            {liveCount} élő
          </span>
        )}
        <span className="text-tertiary" style={{ marginLeft: liveCount > 0 ? 8 : 'auto', fontSize: 13 }}>
          {open ? '▾' : '▸'}
        </span>
      </button>

      {open && (
        <div className="col gap-sm" style={{ padding: 10 }}>
          {filteredEmpty ? (
            <p className="text-tertiary" style={{ fontSize: 12, textAlign: 'center', padding: 6 }}>
              0 találat a szűrőre.
            </p>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  )
}
