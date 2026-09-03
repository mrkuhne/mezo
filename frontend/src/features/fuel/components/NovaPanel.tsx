// ============================================================
// Mezo · NovaPanel (feldolgozottság · NOVA dimenzió csempe-grafikája)
// Mozaik 2.0 (mezo-jcpt.1): the prototype's `.stackbar` + `.legend` — one rounded
// segment per NOVA class sized by its share, and a legend that says WHAT is in each
// class („NOVA 1 · csirke, rizs, bab"), which is the whole point of the graphic. The
// per-item list stays below it as the receipt.
// ============================================================
import type { NovaDimension } from '@/data/types'
import { NOVA_META } from '@/data/nova'
import { Icon } from '@/shared/ui/Icon'

export function NovaPanel({ dim }: { dim: NovaDimension }) {
  const n = dim.nova
  const live = n.stack.filter(s => s.pct > 0)
  return (
    <div className="col mt-md">
      <div className="sb-stackbar">
        {live.map((s, i) => (
          <i key={i} style={{ width: `${s.pct}%`, background: NOVA_META[s.nova].color }}
            title={`${NOVA_META[s.nova].label} · ${s.pct}%`} />
        ))}
      </div>
      <div className="sb-legend">
        {live.map((s, i) => (
          <span key={i}>
            <b style={{ background: NOVA_META[s.nova].color }} />
            NOVA {s.nova} · {s.label} <em style={{ fontStyle: 'normal', color: 'var(--mz-ink-mut)' }}>{s.pct}%</em>
          </span>
        ))}
      </div>
      <div className="col" style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
        {n.items.map((it, i) => (
          <div key={i} className="sb-novaitem" style={{ '--nc': NOVA_META[it.nova].color } as React.CSSProperties}>
            <b>N{it.nova}</b>
            <span>{it.name}</span>
            {it.warning && <Icon name="sparkle" size={10} color="var(--warning)" />}
          </div>
        ))}
      </div>
    </div>
  )
}
