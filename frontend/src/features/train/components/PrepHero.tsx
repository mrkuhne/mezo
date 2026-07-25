// ============================================================
// Mezo · PrepHero — mission-briefing hero (mezo-bxpg): centered overline +
// title, a bordered XP-ring beside up to 3 forecast skill rows (progress bar +
// "⚡ szintlépés-esély!" micro-badge when about to level up), and a summary
// stats pill below. Presentational only — `forecast` null (no athletic
// profile / no meso context) hides the ring + skill rows but the stats pill
// always renders; the caller (Task 4) composes all the data via props.
// ============================================================
import { clampPct } from '@/shared/lib/pct'
import { ATHLETIC_META } from '@/features/progression/logic/levelUpMeta'
import { MUSCLE_LABELS } from '@/data/train/train'
import { muscleColor } from '@/features/train/logic/muscleColors'
import type { PrepForecast, PrepStats } from '@/features/train/logic/prepBriefing'

export function PrepHero({ overline, title, forecast, stats }: {
  overline: string
  title: string
  forecast: PrepForecast | null
  stats: PrepStats
}) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="col" style={{ alignItems: 'center', textAlign: 'center', gap: 2 }}>
        <span className="eyebrow">{overline}</span>
        <span className="h-display size-lg">{title}</span>
      </div>

      {forecast && (
        <div className="row" style={{ gap: 16, alignItems: 'center', marginTop: 16 }}>
          <div
            style={{
              width: 86, height: 86, borderRadius: '50%', border: '4px solid var(--coral)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span style={{ fontFamily: 'var(--ff-display)', fontSize: 20, fontWeight: 800, color: 'var(--coral-deep)' }}>
              +{forecast.totalXp}
            </span>
            <span className="label-mono" style={{ fontSize: 7, marginTop: 2 }}>VÁRHATÓ XP</span>
          </div>

          {forecast.skills.length > 0 && (
            <div className="col flex-1" style={{ gap: 10, minWidth: 0 }}>
              {forecast.skills.slice(0, 3).map((s) => {
                const meta = ATHLETIC_META[s.skillKey]
                const barColor = s.willLevelUp ? 'var(--amber)' : 'var(--sage)'
                return (
                  <div key={s.skillKey} className="col" style={{ gap: 4 }}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-primary)' }}>
                        {meta?.icon ?? '✨'} {meta?.name ?? s.skillKey}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }}>
                        +{s.xpEst}
                      </span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'var(--surface-2)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${clampPct(s.progressPct)}%`, background: barColor, borderRadius: 2 }} />
                    </div>
                    {s.willLevelUp && (
                      <span className="label-mono" style={{ fontSize: 8, color: 'var(--amber-deep)' }}>
                        ⚡ szintlépés-esély!
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* „Ma építed" — top muscle-volume XP chips (mezo-87d2); hidden when the
          forecast has no weighted volume to attribute (no anchors/targets). */}
      {forecast && forecast.muscles.length > 0 && (
        <div className="row" style={{ justifyContent: 'center', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
          <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)', alignSelf: 'center' }}>
            MA ÉPÍTED
          </span>
          {forecast.muscles.map((m) => {
            const fam = muscleColor(m.muscle)
            return (
              <span
                key={m.muscle}
                className="chip"
                style={{ fontSize: 9.5, background: fam.wash, color: fam.deep, border: 'none' }}
              >
                {MUSCLE_LABELS[m.muscle] ?? m.muscle} +{m.xp} XP
              </span>
            )
          })}
        </div>
      )}

      <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
        <span className="chip" style={{ fontSize: 10.5 }}>
          {[
            `${stats.workSets} szett`,
            `~${stats.repsEst} rep`,
            // No fabricated numbers: a day without a duration estimate shows no perc pill (mezo-vlr9).
            stats.durationEst > 0 ? `~${stats.durationEst} perc` : null,
            `${stats.muscleCount} izomcsoport`,
          ].filter(Boolean).join(' · ')}
        </span>
      </div>
    </div>
  )
}
