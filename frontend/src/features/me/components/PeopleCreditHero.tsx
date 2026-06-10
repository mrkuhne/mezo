import { Display } from '@/components/ui/Display'
import { affectColor } from '@/data/people'
import type { Affect, PeopleSummary, PersonEntry } from '@/data/types'

const LEGEND: [Affect, string][] = [
  ['positive', 'Pozitív'],
  ['neutral', 'Semleges'],
  ['mixed', 'Vegyes'],
  ['negative', 'Nehéz'],
]

export function PeopleCreditHero({ summary, people }: { summary: PeopleSummary; people: PersonEntry[] }) {
  const score = Math.round(summary.affectScoreWeek * 100)
  const trendUp = summary.creditTrend === 'rising'
  const totalAffect = people.reduce((acc, p) => acc + p.mentionsThisWeek, 0)

  return (
    <div
      className="card notch-12"
      style={{
        padding: 20,
        background: 'linear-gradient(180deg, rgba(244, 114, 182, 0.06) 0%, var(--surface-1) 100%)',
        borderColor: 'rgba(244, 114, 182, 0.3)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--cat-tendency)' }} />
      <div
        style={{
          position: 'absolute',
          right: -50,
          top: -50,
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(244, 114, 182, 0.14), transparent 70%)',
        }}
      />
      <div style={{ position: 'relative' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div className="col">
            <span className="eyebrow" style={{ color: 'var(--cat-tendency)' }}>PERMA · R · hét 21</span>
            <Display size="md" className="mt-sm">Kapcsolati credit</Display>
            <span className="text-secondary" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.45 }}>
              {people.length} ember · {summary.mentionsThisWeek} említés ezen a héten ({summary.mentionsLastWeek} előtte)
            </span>
          </div>
          <div className="col" style={{ alignItems: 'flex-end' }}>
            <span className="label-mono" style={{ fontSize: 8 }}>{trendUp ? 'RISING' : 'STABLE'}</span>
            <span
              style={{
                fontFamily: 'var(--ff-display)',
                fontSize: 36,
                fontWeight: 600,
                color: 'var(--cat-tendency)',
                lineHeight: 1,
                marginTop: 4,
                textShadow: '0 0 18px rgba(244, 114, 182, 0.35)',
              }}
            >
              {score}
              <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 4 }}>/100</span>
            </span>
          </div>
        </div>

        {/* Affect ribbon — each person as a colored cell, width = mentions this week */}
        <div className="mt-lg">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="label-mono" style={{ fontSize: 8 }}>Heti említések · affect-szín</span>
            <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>{totalAffect}</span>
          </div>
          <div style={{ display: 'flex', height: 10, gap: 2, overflow: 'hidden' }}>
            {people.map(p => (
              <div
                key={p.id}
                style={{
                  flex: Math.max(1, p.mentionsThisWeek),
                  background: affectColor(p.affect_baseline),
                  opacity: 0.85,
                  position: 'relative',
                }}
                title={`${p.name} · ${p.mentionsThisWeek}× ezen a héten`}
              >
                <span
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--ff-mono)',
                    fontSize: 8,
                    fontWeight: 600,
                    color: 'rgba(10, 15, 20, 0.7)',
                    letterSpacing: '0.06em',
                  }}
                >
                  {p.initial}
                </span>
              </div>
            ))}
          </div>
          <div className="row gap-md mt-md flex-wrap">
            {LEGEND.map(([k, l]) => (
              <div key={k} className="row gap-xs" style={{ alignItems: 'center' }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: affectColor(k) }} />
                <span className="text-tertiary" style={{ fontSize: 10, fontFamily: 'var(--ff-mono)' }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
