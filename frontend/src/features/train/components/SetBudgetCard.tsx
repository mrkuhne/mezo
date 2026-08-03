// ============================================================
// Mezo · SetBudgetCard — collapsible weekly per-muscle set-budget card for
// the unified meso day editor (mezo-7rdg, spec 2026-08-01-set-budget-
// unified-editor, composite-v2 mockup). Collapsed: a pill wrap, one per
// muscle group, colored by budget level. Expanded: one row per group with
// a rail + progress bar, plus warning lines for over-budget groups and
// single-session cap breaches (sessionCapWarnings).
// ============================================================
import { useState } from 'react'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { muscleColor } from '@/features/train/logic/muscleColors'
import type { MuscleBudgetRow, SessionCapWarning } from '@/features/train/logic/setBudget'

interface SetBudgetCardProps {
  budgets: MuscleBudgetRow[]
  capWarnings: SessionCapWarning[]
  defaultOpen?: boolean
}

function pct(budget: number): number {
  return Math.round(budget * 100)
}

// "8🔥+8🌿" — omit whichever side is zero.
function setStyleSummary(failureSets: number, volumeSets: number): string {
  if (failureSets > 0 && volumeSets > 0) return `${failureSets}🔥+${volumeSets}🌿`
  if (failureSets > 0) return `${failureSets}🔥`
  return `${volumeSets}🌿`
}

function pillColors(row: MuscleBudgetRow): { bg: string; fg: string } {
  if (row.level === 'over') return { bg: 'color-mix(in srgb, var(--error) 12%, transparent)', fg: 'var(--error)' }
  if (row.level === 'near') return { bg: 'var(--wash-amber)', fg: 'var(--amber-deep)' }
  const fam = muscleColor(row.colorMuscle)
  return { bg: fam.wash, fg: fam.deep }
}

export function SetBudgetCard({ budgets, capWarnings, defaultOpen }: SetBudgetCardProps) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const overBudgets = budgets.filter((b) => b.level === 'over')

  return (
    <div className="card" style={{ padding: 16 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="row"
        style={{
          width: '100%', justifyContent: 'space-between', alignItems: 'center',
          background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0,
        }}
      >
        <Eyebrow brand>Heti szet-büdzsé</Eyebrow>
        <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>{open ? '▴' : '▾'}</span>
      </button>

      {!open && (
        <div className="row gap-xs flex-wrap" style={{ marginTop: 12 }}>
          {budgets.map((row) => {
            const colors = pillColors(row)
            return (
              <span
                key={row.group}
                style={{
                  fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                  background: colors.bg, color: colors.fg,
                }}
              >
                {row.label} {pct(row.budget)}%
              </span>
            )
          })}
        </div>
      )}

      {open && (
        <div className="col" style={{ gap: 12, marginTop: 14 }}>
          {budgets.map((row) => {
            const fam = muscleColor(row.colorMuscle)
            const p = pct(row.budget)
            const fillWidth = Math.min(100, p)
            const fillBackground = row.level === 'over' ? 'linear-gradient(90deg, var(--coral), var(--error))' : fam.rail
            return (
              <div key={row.group} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                <span style={{ width: 5, height: 34, borderRadius: 2, background: fam.rail, flexShrink: 0 }} />
                <div className="col flex-1" style={{ gap: 4, minWidth: 0 }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>{row.label}</span>
                    <span className="label-mono" style={{ fontSize: 10.5 }}>
                      {p}% · {setStyleSummary(row.failureSets, row.volumeSets)}
                      {row.plyoSets > 0 && <span style={{ color: 'var(--text-tertiary)' }}> +{row.plyoSets} plyo</span>}
                    </span>
                  </div>
                  <div style={{ height: 8.5, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${fillWidth}%`, borderRadius: 999, background: fillBackground }} />
                  </div>
                </div>
              </div>
            )
          })}

          {overBudgets.length > 0 || capWarnings.length > 0 ? (
            <div className="col" style={{ gap: 8 }}>
              {overBudgets.map((row) => {
                const p = pct(row.budget)
                return (
                  <div
                    key={row.group}
                    style={{
                      borderRadius: 12, padding: '9px 11px', fontSize: 11.5, lineHeight: 1.4,
                      background: 'color-mix(in srgb, var(--error) 8%, transparent)', color: 'var(--error)',
                    }}
                  >
                    ⚠ <strong>{row.label}: heti keret {p}%.</strong> A failure/volume kereten túl — a plusz szettek már alig hoznak növekedést.
                  </div>
                )
              })}
              {capWarnings.map((warning, i) => (
                <div
                  key={`${warning.day}-${warning.group}-${i}`}
                  style={{
                    borderRadius: 12, padding: '9px 11px', fontSize: 11.5, lineHeight: 1.4,
                    background: 'var(--wash-amber)', color: 'var(--amber-deep)',
                  }}
                >
                  ⚠ <strong>{warning.label}: {warning.sets} szett egy edzésen ({warning.day}).</strong> 11 fölött nincs kimutatható plusz — oszd el két napra!
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
