// ============================================================
// Mezo · DayBreakdownCard — "Ma" card in the unified meso day editor:
// per-muscle-group session breakdown for the ACTIVE day against the
// SESSION_MUSCLE_CAP (mezo-smhn, spec 2026-08-03-daily-session-breakdown-
// design, variant A mockup). Sits between MesoEditorHero and the weekly
// WeeklyBandsCard (formerly SetBudgetCard) — both levels stay visible at
// once (variant B's Ma/Hét switcher was rejected). Presentational only:
// parent computes rows +
// warnings (daySessionBreakdown / leastLoadedDayFor).
// ============================================================
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { muscleColor } from '@/features/train/logic/muscleColors'
import { SESSION_MUSCLE_CAP, type DayGroupRow } from '@/features/train/logic/setBudget'

export interface DayBreakdownWarning {
  label: string
  sets: number
  suggestDay: string | null
}

interface DayBreakdownCardProps {
  rows: DayGroupRow[]
  warnings: DayBreakdownWarning[]
}

export function DayBreakdownCard({ rows, warnings }: DayBreakdownCardProps) {
  if (rows.length === 0) return null

  const capLinePct = (SESSION_MUSCLE_CAP / (SESSION_MUSCLE_CAP + 1)) * 100

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Eyebrow brand>Ma · izmonként</Eyebrow>
        <span className="label-mono" style={{ fontSize: 9 }}>max {SESSION_MUSCLE_CAP} szett/izom</span>
      </div>

      <div className="col" style={{ gap: 4, marginTop: 10 }}>
        {rows.map((row) => {
          const fam = muscleColor(row.colorMuscle)
          const plyoOnly = row.sets === 0 && row.exemptSets > 0
          const fillWidth = Math.min(100, (row.sets / (SESSION_MUSCLE_CAP + 1)) * 100)
          const fillBackground = row.over ? `linear-gradient(90deg, ${fam.rail}, var(--error))` : fam.rail
          return (
            <div
              key={row.group}
              className="row"
              style={{ gap: 10, alignItems: 'flex-start', padding: '7px 0', borderTop: '1px solid var(--border-subtle)' }}
            >
              <span style={{ width: 5, alignSelf: 'stretch', borderRadius: 3, background: fam.rail, flexShrink: 0 }} />
              <div className="col flex-1" style={{ gap: 4, minWidth: 0 }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 700, fontSize: 12.5 }}>{row.label}</span>
                  {plyoOnly ? (
                    <span className="label-mono" style={{ fontSize: 10 }}>{row.exemptSets} kiegészítő</span>
                  ) : (
                    <span
                      className="label-mono"
                      style={{ fontSize: 10, color: row.over ? 'var(--error)' : undefined, fontWeight: row.over ? 700 : undefined }}
                    >
                      {row.sets} / {SESSION_MUSCLE_CAP}{row.over && ' ⚠'}
                    </span>
                  )}
                </div>
                {!plyoOnly && (
                  <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden', position: 'relative' }}>
                    <div style={{ height: '100%', width: `${fillWidth}%`, borderRadius: 4, background: fillBackground }} />
                    <span
                      style={{
                        position: 'absolute', top: -2, bottom: -2, left: `${capLinePct}%`,
                        width: 2, background: 'var(--text-tertiary)', opacity: 0.5,
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {warnings.length > 0 && (
        <div className="col" style={{ gap: 8, marginTop: 9 }}>
          {warnings.map((warning, i) => (
            <div
              key={`${warning.label}-${i}`}
              style={{
                borderRadius: 12, padding: '9px 11px', fontSize: 11.5, lineHeight: 1.4,
                background: 'var(--wash-amber)', color: 'var(--amber-deep)',
              }}
            >
              ⚠ <strong>{warning.label}: ma {warning.sets} szett</strong> — {SESSION_MUSCLE_CAP} fölött nincs kimutatható plusz.
              {warning.suggestDay != null && ` Vigyél át szettet egy másik napra (pl. ${warning.suggestDay})!`}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
