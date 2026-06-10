// ============================================================
// Mezo · NovaPanel (feldolgozottság · NOVA dimension)
// Dominant badge + stacked NOVA-class bar + per-item NOVA list
// ============================================================
import type { NovaDimension } from '@/data/types'
import { NOVA_META } from '@/data/nova'
import { Icon } from '@/components/ui/Icon'

export function NovaPanel({ dim }: { dim: NovaDimension }) {
  const n = dim.nova
  const dominantMeta = NOVA_META[n.dominant]
  return (
    <div className="col gap-md mt-md">
      {/* Dominant badge */}
      <div className="row gap-sm" style={{
        padding: '8px 10px',
        background: 'var(--surface-2)',
        border: '1px solid var(--border-subtle)',
        borderLeft: '3px solid ' + dominantMeta.color,
        clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
        alignItems: 'center',
      }}>
        <span style={{
          fontFamily: 'var(--ff-display)', fontSize: 13, fontWeight: 600,
          color: dominantMeta.color,
        }}>{dominantMeta.label}</span>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', flex: 1, lineHeight: 1.3 }}>
          {dominantMeta.desc} — domináns
        </span>
      </div>

      {/* Stacked NOVA bar */}
      <div className="col gap-xs">
        <div style={{
          display: 'flex', height: 10,
          border: '1px solid var(--border-subtle)',
          borderRadius: 2, overflow: 'hidden',
        }}>
          {n.stack.filter(s => s.pct > 0).map((s, i) => (
            <div key={i} style={{
              width: s.pct + '%',
              background: NOVA_META[s.nova].color,
              boxShadow: s.nova === n.dominant ? ('inset 0 0 6px ' + NOVA_META[s.nova].color) : 'none',
            }} title={`${NOVA_META[s.nova].label} · ${s.pct}%`} />
          ))}
        </div>
        <div className="row gap-md flex-wrap" style={{ fontFamily: 'var(--ff-mono)', fontSize: 9 }}>
          {n.stack.filter(s => s.pct > 0).map((s, i) => (
            <div key={i} className="row gap-xs" style={{ alignItems: 'center' }}>
              <span style={{ width: 6, height: 6, borderRadius: 1, background: NOVA_META[s.nova].color }} />
              <span style={{ color: 'var(--text-secondary)' }}>{NOVA_META[s.nova].label}</span>
              <span style={{ color: 'var(--text-tertiary)' }}>{s.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Item-level NOVA */}
      <div className="col gap-xs" style={{
        padding: '6px 0', borderTop: '1px solid var(--border-subtle)',
      }}>
        {n.items.map((it, i) => (
          <div key={i} className="row gap-sm" style={{ padding: '4px 0', alignItems: 'center' }}>
            <span style={{
              width: 36, padding: '2px 0',
              textAlign: 'center',
              fontFamily: 'var(--ff-mono)', fontSize: 9, fontWeight: 600,
              color: NOVA_META[it.nova].color,
              border: '1px solid ' + NOVA_META[it.nova].color,
              borderRadius: 2,
              background: 'transparent',
            }}>N{it.nova}</span>
            <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1 }}>{it.name}</span>
            {it.warning && <Icon name="sparkle" size={10} color="var(--warning)" />}
          </div>
        ))}
      </div>
    </div>
  )
}
