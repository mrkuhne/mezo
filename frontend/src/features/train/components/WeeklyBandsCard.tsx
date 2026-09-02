// ============================================================
// Mezo · WeeklyBandsCard — wizard v2's weekly per-muscle set band card:
// current → ceiling per muscle, tier chip, step arrow. Replaces
// SetBudgetCard's % pills/rows (mesocycle wizard redesign, mezo-d20.14).
// No percentages anywhere — the bar is the only place `pct` shows up, and
// only as a fill width.
// ============================================================
import type { BandRow } from '@/features/train/logic/weeklyBands'
import { muscleColor } from '@/features/train/logic/muscleColors'

const TIER_LABEL = { emphasize: 'Emphasize', grow: 'Grow', maintain: 'Maintain' } as const

interface WeeklyBandsCardProps {
  rows: BandRow[]
  eyebrow?: string
  note?: string
}

export function WeeklyBandsCard({ rows, eyebrow = 'Heti szetek · izmonként', note }: WeeklyBandsCardProps) {
  if (!rows.length) return null
  return (
    <div className="mz-card mz-bands" role="group" aria-label={eyebrow}>
      <div className="mz-eyebrow">{eyebrow}</div>
      {rows.map((r) => {
        const fam = muscleColor(r.group)
        return (
          <div className="mz-band" key={r.group} role="group" aria-label={`${r.label} · ${TIER_LABEL[r.tier]}`}>
            <div className="mz-band-row">
              <span className="mz-pill" style={{ background: fam.wash, color: fam.deep }}>{r.label}</span>
              <span className={`mz-tchip mz-tchip-${r.tier}`}>{TIER_LABEL[r.tier]}</span>
              <span className="mz-grow" />
              {r.tier !== 'maintain' && <span className="mz-stepchip">{r.step === '+2' ? '▲ +2 / hét' : 'plafonon'}</span>}
              <span className="mz-band-nums">{r.tier === 'maintain' ? `${r.planned} szett · tart` : `${r.planned} → ${r.ceiling}`}</span>
            </div>
            {r.tier !== 'maintain' && (
              <div className="mz-band-bar"><div style={{ width: `${Math.min(100, r.pct)}%`, background: fam.deep }} /></div>
            )}
          </div>
        )
      })}
      {note && <div className="mz-habnote">{note}</div>}
    </div>
  )
}
