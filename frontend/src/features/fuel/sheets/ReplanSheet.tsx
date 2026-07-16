// ============================================================
// Mezo · ReplanSheet
// Scenario-cascade bottom sheet — context change → AI cascade response.
// Két fázis: preview (scenario picker + cascade) → applied (megerősítés).
// Port: prototype/src/fuel-stack.jsx ReplanSheet (607–761).
// ============================================================
import { useState } from 'react'
import type { ReplanCascade } from '@/data/types'
import { useReplanScenarios, useProtocol } from '@/data/hooks'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Display } from '@/shared/ui/Display'
import { ToolChipRow } from '@/shared/ui/ToolChipRow'
import { Chip } from '@/shared/ui/Chip'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'

// Per-system accent colors (port: fuel-stack.jsx ~613).
const SYSTEM_COLOR: Record<ReplanCascade['system'], string> = {
  Fuel: 'var(--coral)',
  Train: 'var(--cat-physiology)',
  Sleep: 'var(--cat-preference)',
  Insights: 'var(--cat-tendency)',
}

export function ReplanSheet({
  onClose,
  initialScenarioId,
}: {
  onClose: () => void
  initialScenarioId?: string
}) {
  const { scenarios } = useReplanScenarios()
  const { protocol } = useProtocol()
  const [scenarioId, setScenarioId] = useState(initialScenarioId ?? scenarios[0].id)
  const [phase, setPhase] = useState<'preview' | 'applied'>('preview')

  const scenario = scenarios.find(s => s.id === scenarioId) ?? scenarios[0]
  // Apply does NOT mutate the global protocol — we only display the next version.
  const nextVersion = protocol.version + 1

  return (
    <Sheet onClose={onClose} labelledBy="replan-title">
      {(close) => (
        <>
          {/* Header */}
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div className="col" style={{ flex: 1 }}>
              <Eyebrow brand>Replan · Mezo</Eyebrow>
              <div id="replan-title" style={{ marginTop: 4 }}>
                <Display size="md">{phase === 'applied' ? 'Frissítve · v' + nextVersion : 'Mi változott?'}</Display>
              </div>
              <span
                className="text-secondary"
                style={{ fontSize: 11.5, marginTop: 4, fontFamily: 'var(--ff-mono)' }}
              >
                {phase === 'applied' ? 'Mai timeline újraszámolva' : 'Válassz scenario-t · látod a cascade-et'}
              </span>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          {phase === 'preview' && (
            <>
              {/* Scenario picker */}
              <div className="col gap-xs" style={{ marginBottom: 14 }}>
                {scenarios.map(s => {
                  const selected = scenarioId === s.id
                  return (
                    <button
                      key={s.id}
                      onClick={() => setScenarioId(s.id)}
                      className="card row"
                      style={{
                        padding: '10px 12px',
                        width: '100%',
                        textAlign: 'left',
                        alignItems: 'center',
                        gap: 10,
                        background: selected
                          ? 'color-mix(in srgb, var(--coral) 6%, transparent)'
                          : 'var(--surface-1)',
                        borderColor: selected ? 'var(--line)' : 'var(--border-subtle)',
                        borderLeft: '2px solid ' + s.color,
                      }}
                    >
                      <Icon name={s.icon} size={14} color={s.color} />
                      <div className="col flex-1" style={{ minWidth: 0 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{s.title}</span>
                        <span
                          className="text-tertiary"
                          style={{ fontSize: 10, fontFamily: 'var(--ff-mono)', marginTop: 2 }}
                        >
                          {s.detail}
                        </span>
                      </div>
                      <div
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          border: '1.5px solid ' + (selected ? s.color : 'var(--border-strong)'),
                          background: selected ? s.color : 'transparent',
                        }}
                      />
                    </button>
                  )
                })}
              </div>

              {/* Cascade preview */}
              <div
                className="card"
                style={{
                  padding: 14,
                  background:
                    'linear-gradient(180deg, color-mix(in srgb, ' +
                    scenario.color +
                    ' 6%, transparent) 0%, var(--surface-1) 100%)',
                  borderColor: 'color-mix(in srgb, ' + scenario.color + ' 25%, transparent)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: scenario.color }} />
                <div style={{ paddingLeft: 6 }}>
                  <span className="eyebrow" style={{ color: scenario.color }}>
                    Cascade · {scenario.cascades.length} system hatás
                  </span>
                  <div className="col gap-sm mt-md">
                    {scenario.cascades.map((c, i) => {
                      const sysColor = SYSTEM_COLOR[c.system]
                      return (
                        <div
                          key={i}
                          className="row gap-sm"
                          style={{
                            alignItems: 'flex-start',
                            padding: '8px 0',
                            borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none',
                          }}
                        >
                          <span
                            style={{
                              padding: '2px 6px',
                              fontFamily: 'var(--ff-mono)',
                              fontSize: 9,
                              fontWeight: 600,
                              color: sysColor,
                              border: '1px solid color-mix(in srgb, ' + sysColor + ' 25%, transparent)',
                              background: 'color-mix(in srgb, ' + sysColor + ' 6%, transparent)',
                              letterSpacing: '0.1em',
                              textTransform: 'uppercase',
                              flexShrink: 0,
                            }}
                          >
                            {c.system}
                          </span>
                          <div className="col flex-1">
                            <span style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500 }}>
                              {c.impact}
                            </span>
                            <span
                              className="text-secondary"
                              style={{ fontSize: 11, lineHeight: 1.4, marginTop: 2, display: 'block' }}
                            >
                              <SafeMarkdown text={c.detail} />
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Tool transparency + confidence */}
              <div className="row gap-xs flex-wrap" style={{ marginTop: 12, alignItems: 'center' }}>
                <ToolChipRow tools={scenario.tools} />
                <span className="label-mono" style={{ fontSize: 9, marginLeft: 'auto' }}>
                  conf {(scenario.confidence * 100).toFixed(0)}%
                </span>
              </div>

              {/* Actions */}
              <div className="row gap-sm mt-lg">
                <button className="cta-ghost flex-1" onClick={close}>
                  Mégse · marad a régi
                </button>
                <button className="cta-primary flex-1" onClick={() => setPhase('applied')}>
                  <Icon name="check" size={14} /> Alkalmazom
                </button>
              </div>
            </>
          )}

          {phase === 'applied' && (
            <>
              <div
                className="card"
                style={{
                  padding: 18,
                  background: 'color-mix(in srgb, var(--coral) 6%, transparent)',
                  borderColor: 'var(--line)',
                  textAlign: 'center',
                }}
              >
                <Icon name="sparkle" size={20} color="var(--coral)" />
                <div
                  style={{
                    fontFamily: 'var(--ff-display)',
                    fontSize: 20,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginTop: 8,
                  }}
                >
                  Protokoll · v{nextVersion}
                </div>
                <span className="text-secondary" style={{ fontSize: 12, marginTop: 6, display: 'block' }}>
                  A Mai timeline frissült · {scenario.cascades.length} slot újraszámolva.
                </span>
                <div className="row gap-xs flex-wrap mt-md" style={{ justifyContent: 'center' }}>
                  {scenario.cascades.map((c, i) => (
                    <Chip key={i} variant="brand" style={{ fontSize: 9 }}>
                      {c.impact}
                    </Chip>
                  ))}
                </div>
              </div>

              <button className="cta-primary mt-lg" onClick={close}>
                <Icon name="check" size={14} /> Megnézem
              </button>
            </>
          )}

          <div style={{ height: 24 }} />
        </>
      )}
    </Sheet>
  )
}
