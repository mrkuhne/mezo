// ============================================================
// Mezo · VolumeBand — the compact MEV/MAV/MRV zone bar used by the week
// mosaic tiles and the muscle page's „A sáv" card: three brand-alpha zones,
// a dim marker at last week's planned set count and a glowing marker at this
// week's. Visual sibling of VolumeBar's own header band (kept there for the
// builder's provenance list) — same inline-style idiom (percentages of the
// 0→MRV span), just without VolumeBar's own tap-to-expand chrome, since the
// week/muscle pages open the derivation as its own always-visible section
// (DerivationSteps) instead.
// ============================================================
interface VolumeBandProps {
  mev: number
  mav: number
  mrv: number
  current: number
  prev: number | null
  color: string
  height?: number
}

export function VolumeBand({ mev, mav, mrv, current, prev, color, height = 9 }: VolumeBandProps) {
  const pct = (v: number) => (mrv > 0 ? Math.min(100, (v / mrv) * 100) : 0)
  const mevPct = pct(mev)
  const mavPct = pct(mav)
  const curPct = pct(current)

  return (
    <div className="col gap-xs" style={{ marginTop: 5 }}>
      <div style={{ position: 'relative', height, background: 'var(--mz-cellbg)', borderRadius: height / 2, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, width: `${mevPct}%`, background: `color-mix(in srgb, ${color} 10%, transparent)` }} />
        <div style={{ position: 'absolute', left: `${mevPct}%`, top: 0, bottom: 0, width: `${mavPct - mevPct}%`, background: `color-mix(in srgb, ${color} 20%, transparent)` }} />
        <div style={{ position: 'absolute', left: `${mavPct}%`, top: 0, bottom: 0, width: `${100 - mavPct}%`, background: `color-mix(in srgb, ${color} 32%, transparent)` }} />
        {prev !== null && (
          <div style={{ position: 'absolute', left: `calc(${pct(prev)}% - 1px)`, top: 0, bottom: 0, width: 2, background: `color-mix(in srgb, ${color} 45%, transparent)` }} />
        )}
        <div style={{ position: 'absolute', left: `calc(${curPct}% - 2px)`, top: -1, bottom: -1, width: 4, background: color, boxShadow: `0 0 6px ${color}` }} />
      </div>
      <div className="row" style={{ justifyContent: 'space-between', fontVariantNumeric: 'tabular-nums', fontSize: 8.5 }}>
        <span className="mz-mut">MEV {mev}</span>
        <span className="mz-mut">MAV {mav}</span>
        <span className="mz-mut">MRV {mrv}</span>
      </div>
    </div>
  )
}
