// ============================================================
// Mezo · MesoEditorHero — top hero card of the unified meso day editor
// (mezo-7rdg, spec 2026-08-01-set-budget-unified-editor, composite-v2
// mockup). Wash→surface gradient + radial glow precedent from
// ActiveMesoCard; flips to the amber wash + error status line when the
// day carries set-budget warnings (warningCount > 0).
// ============================================================
import { Eyebrow } from '@/shared/ui/Eyebrow'

interface MesoEditorHeroProps {
  dayType: string
  daySets: number
  dayExerciseCount: number
  weekSets: number
  trainingDays: number
  warningCount: number
}

export function MesoEditorHero({ dayType, daySets, dayExerciseCount, weekSets, trainingDays, warningCount }: MesoEditorHeroProps) {
  const hasWarnings = warningCount > 0

  return (
    <div
      className="card"
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: 20,
        background: `linear-gradient(180deg, ${hasWarnings ? 'var(--wash-amber)' : 'var(--wash-gym)'} 0%, var(--surface-1) 100%)`,
      }}
    >
      <span
        style={{
          position: 'absolute',
          right: -50,
          top: -50,
          width: 180,
          height: 180,
          borderRadius: '50%',
          background: `radial-gradient(circle, color-mix(in srgb, ${hasWarnings ? 'var(--error)' : 'var(--coral)'} 18%, transparent), transparent 70%)`,
        }}
      />

      <div style={{ position: 'relative' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Eyebrow brand>{dayType}</Eyebrow>
          <span className="label-mono">{dayExerciseCount} gyakorlat</span>
        </div>

        <div className="row" style={{ alignItems: 'baseline', gap: 8, marginTop: 6 }}>
          <span style={{ fontFamily: 'var(--ff-display)', fontSize: 40, fontWeight: 800, lineHeight: 1 }}>{daySets}</span>
          <span className="text-secondary">szett ma</span>
        </div>

        <div
          className="row"
          style={{
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 14,
            paddingTop: 14,
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <span className="text-secondary" style={{ fontSize: 12 }}>
            Heti terhelés: <strong>{weekSets} szett</strong> · {trainingDays} edzésnap
          </span>
          {hasWarnings ? (
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--error)' }}>⚠ {warningCount} jelzés</span>
          ) : (
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--sage-deep)' }}>✓ kereten belül</span>
          )}
        </div>
      </div>
    </div>
  )
}
