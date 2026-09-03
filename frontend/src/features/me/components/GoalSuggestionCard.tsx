import type { GoalSuggestionResponse } from '@/data/me/goalApi'

// Diet-phase suggestion card (Diet Plan slice 4) — the suggest+approve surface: the
// engine proposed a diet change (trajectory flip or deload maintenance week), the owner
// decides here. Pure presentational; actions come from useSuggestionActions via props.
interface GoalSuggestionCardProps {
  suggestion: GoalSuggestionResponse
  onAccept: () => void
  onDismiss: () => void
  pending?: boolean
}

const TRAJECTORY_HU: Record<string, string> = { cut: 'Fogyás ↓', bulk: 'Hízás ↑', maintain: 'Tartás ≈' }

export function GoalSuggestionCard({ suggestion, onAccept, onDismiss, pending }: GoalSuggestionCardProps) {
  const p = suggestion.payload
  const isWeeklyCorrection = suggestion.kind === 'weekly_correction'
  const headline = isWeeklyCorrection
    ? `Heti felülvizsgálat: ${p.deltaKcal != null && p.deltaKcal > 0 ? '+' : '−'}${Math.abs(p.deltaKcal ?? 0)} kcal/nap${p.deltaKcal != null && p.deltaKcal < 0 ? ' (mélyebb deficit)' : ' (több étel)'}`
    : p.suggestedTrajectory
      ? `Javaslat: váltás — ${TRAJECTORY_HU[p.suggestedTrajectory]}`
      : `Javaslat: deload hét tartáson (W${p.fromWeek})`
  return (
    <div
      className="card"
      style={{
        padding: '10px 11px',
        marginBottom: 8,
        background: 'color-mix(in srgb, var(--warning) 7%, transparent)',
        border: '1px solid color-mix(in srgb, var(--warning) 35%, transparent)',
      }}
    >
      <div className="row" style={{ alignItems: 'center', gap: 7 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--warning)', flex: '0 0 auto' }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--warning)' }}>{headline}</span>
      </div>
      <p style={{ fontSize: 10, lineHeight: 1.5, color: 'var(--text-secondary)', margin: '6px 0 8px' }}>{p.reason}</p>
      {isWeeklyCorrection && (
        <>
          {p.observedRateKgPerWk != null && p.targetRateKgPerWk != null && (
            <p style={{ fontSize: 10, lineHeight: 1.5, color: 'var(--text-tertiary)', margin: p.dampedBySleep ? '0 0 4px' : '0 0 8px' }}>
              Mért ütem {p.observedRateKgPerWk.toFixed(2)} kg/hét · cél {p.targetRateKgPerWk.toFixed(2)} kg/hét
              {p.adherenceLoggedDays != null && p.adherenceLoggedDays > 0 &&
                ` · loggolva ${p.adherenceLoggedDays}/7 nap (átlag ${p.adherenceAvgIntakeKcal} / cél ${p.adherenceAvgTargetKcal} kcal)`}
            </p>
          )}
          {p.dampedBySleep && (
            <p style={{ fontSize: 10, lineHeight: 1.5, color: 'var(--warning)', margin: '0 0 8px' }}>
              Alváshiány miatt a javasolt lépés a felére tompítva.
            </p>
          )}
        </>
      )}
      <div className="row" style={{ gap: 6 }}>
        <button type="button" className="chip" onClick={onAccept} disabled={pending}
          style={{ borderColor: 'transparent', background: 'var(--wash-sage)', color: 'var(--sage-deep)' }}>
          {pending ? 'Alkalmazás…' : '✓ Elfogadom'}
        </button>
        <button type="button" className="chip" onClick={onDismiss} disabled={pending}
          style={{ color: 'var(--text-tertiary)' }}>
          Elvetem
        </button>
      </div>
    </div>
  )
}
