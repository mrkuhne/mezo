import { ToolChipRow } from '@/shared/ui/ToolChipRow'
import { DAYS_HU } from '@/data/fuel/fuelWeek'
import type { WeeklySupplementRow } from '@/data/types'

// fuel-plan.jsx WeeklySupplementGrid (402–460)
export function WeeklySupplementGrid({ rows }: { rows: WeeklySupplementRow[] }) {
  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="row" style={{ marginBottom: 8 }}>
        <span style={{ width: 100 }} />
        <div className="row flex-1" style={{ gap: 4 }}>
          {DAYS_HU.map((d, i) => (
            <span
              key={i}
              className="label-mono"
              style={{ flex: 1, textAlign: 'center', fontSize: 9, color: 'var(--text-tertiary)' }}
            >
              {d}
            </span>
          ))}
        </div>
      </div>
      <div className="col gap-xs">
        {rows.map((s, i) => (
          <div key={i} className="row gap-sm" style={{ alignItems: 'center' }}>
            <div className="col" style={{ width: 100, minWidth: 100 }}>
              <span style={{ fontSize: 11, color: 'var(--text-primary)' }}>{s.name}</span>
              <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>
                {s.dose}
              </span>
            </div>
            <div className="row flex-1" style={{ gap: 4 }}>
              {s.days.map((on, di) => (
                <div
                  key={di}
                  style={{
                    flex: 1,
                    height: 22,
                    background: on
                      ? 'color-mix(in srgb, ' + s.color + ' 13%, transparent)'
                      : 'var(--surface-2)',
                    border:
                      '1px solid ' +
                      (on
                        ? 'color-mix(in srgb, ' + s.color + ' 38%, transparent)'
                        : 'var(--border-subtle)'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {on ? (
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: s.color,
                        boxShadow: '0 0 4px ' + s.color,
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: 9, color: 'var(--text-quaternary)' }}>—</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-md" style={{ paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
        <ToolChipRow
          tools={[
            { type: 'read', name: 'get_supplements_stash()' },
            { type: 'compute', name: 'computeWeeklyTiming()' },
          ]}
        />
      </div>
    </div>
  )
}
