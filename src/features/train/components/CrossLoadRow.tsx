// ============================================================
// Mezo · CrossLoadRow — one cross-system impact row in the SportView
// cross-load list: system icon + uppercase label, the affected target,
// an impact readout and the reasoning. Warning rows get an amber tint
// + a 2px left strip. Ported from prototype sport.jsx CrossLoadRow.
// ============================================================
import { Icon } from '@/components/ui/Icon'
import { SYSTEM_LABELS } from '@/data/train'
import type { CrossLoadRow as CrossLoadRowData } from '@/data/types'

const FALLBACK = { label: 'tool', color: 'var(--text-secondary)', icon: 'tool' as const }

interface CrossLoadRowProps {
  item: CrossLoadRowData
}

export function CrossLoadRow({ item }: CrossLoadRowProps) {
  const sys = SYSTEM_LABELS[item.system] ?? { ...FALLBACK, label: item.system }
  return (
    <div
      className="card notch-4"
      style={{
        padding: 14,
        borderColor: item.warning ? 'color-mix(in srgb, var(--warning) 30%, transparent)' : 'var(--border-subtle)',
        background: item.warning ? 'color-mix(in srgb, var(--warning) 4%, transparent)' : 'var(--surface-1)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {item.warning && (
        <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: 'var(--warning)' }} />
      )}
      <div
        className="row"
        style={{ justifyContent: 'space-between', alignItems: 'flex-start', paddingLeft: item.warning ? 6 : 0 }}
      >
        <div className="row gap-sm" style={{ alignItems: 'flex-start', flex: 1 }}>
          <Icon name={sys.icon} size={14} color={sys.color} />
          <div className="col flex-1">
            <span className="label-mono" style={{ fontSize: 9, color: sys.color, letterSpacing: '0.14em' }}>
              {sys.label.toUpperCase()}
            </span>
            <span
              style={{
                fontSize: 13,
                color: 'var(--text-primary)',
                marginTop: 4,
                fontFamily: 'var(--ff-display)',
                fontWeight: 500,
                lineHeight: 1.2,
                display: 'block',
              }}
            >
              {item.target}
            </span>
          </div>
        </div>
        <span
          className="label-mono"
          style={{
            fontSize: 11,
            color: item.warning ? 'var(--warning)' : 'var(--brand-glow)',
            whiteSpace: 'nowrap',
            marginLeft: 12,
          }}
        >
          {item.impact}
        </span>
      </div>
      <p
        className="text-secondary mt-sm"
        style={{
          fontSize: 12,
          lineHeight: 1.5,
          paddingTop: 8,
          marginTop: 8,
          borderTop: '1px solid var(--border-subtle)',
          paddingLeft: item.warning ? 6 : 0,
        }}
      >
        {item.why}
      </p>
    </div>
  )
}
