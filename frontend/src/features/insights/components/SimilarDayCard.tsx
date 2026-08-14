import type { SimilarDay } from '@/data/types'

const RING_R = 21
const RING_C = 2 * Math.PI * RING_R

function ageDays(date: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(`${date}T00:00:00`).getTime()) / 86_400_000))
}

/**
 * Gazdag találati kártya (UI-spec §4): egyezés-gyűrű + similarity-sáv + memoir-kivonat + a
 * pontszám-matek chipsora (egyezés × frissesség = végső). A frissesség kliens-oldalon számolt
 * (finalScore / similarity — pontosan a szerver decay-szorzója), színe ≥0.9 → success, alatta warning.
 */
export function SimilarDayCard({ day, rank, onPick }: { day: SimilarDay; rank: number; onPick: (date: string) => void }) {
  const freshness = day.similarity === 0 ? 0 : day.finalScore / day.similarity
  const ringColor = rank === 0 ? 'var(--lav-deep)' : 'var(--lav)'
  const freshColor = freshness >= 0.9 ? 'var(--success)' : 'var(--warning)'
  return (
    <div
      className="card np-press" role="button" tabIndex={0}
      style={{ padding: 14, cursor: 'pointer' }}
      onClick={() => onPick(day.date)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(day.date) } }}
    >
      <div className="row" style={{ gap: 12, alignItems: 'center' }}>
        <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true">
          <circle cx="26" cy="26" r={RING_R} fill="none" stroke="var(--surface-glass)" strokeWidth="5" />
          <circle
            cx="26" cy="26" r={RING_R} fill="none" stroke={ringColor} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={`${day.similarity * RING_C} ${RING_C}`} transform="rotate(-90 26 26)"
          />
          <text x="26" y="24" textAnchor="middle" fontSize="12" fontWeight="700" fill={ringColor}
            fontFamily="var(--ff-display)">{Math.round(day.similarity * 100)}%</text>
          <text x="26" y="35" textAnchor="middle" fontSize="6" fontWeight="700" fill="var(--text-tertiary)">EGYEZÉS</text>
        </svg>
        <div style={{ flex: 1 }}>
          <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>{day.date}</span>
          <div className="eyebrow text-tertiary" style={{ marginTop: 3 }}>{ageDays(day.date)} napja</div>
          <div className="bar" style={{ marginTop: 8 }}>
            <div
              className="bar-fill"
              style={{ width: `${Math.round(day.similarity * 100)}%`, background: ringColor }}
            />
          </div>
        </div>
      </div>
      <p style={{ fontSize: 12, lineHeight: 1.6, marginTop: 10, color: 'var(--text-primary)', fontFamily: 'var(--ff-display)' }}>
        {day.excerpt}
      </p>
      <div className="row gap-sm" style={{ marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="chip" style={{ fontSize: 9, color: 'var(--lav-deep)' }}>egyezés {day.similarity.toFixed(2)}</span>
        <span className="eyebrow text-tertiary">×</span>
        <span className="chip" style={{ fontSize: 9, color: freshColor }}>frissesség {freshness.toFixed(2)}</span>
        <span className="eyebrow text-tertiary">=</span>
        <span className="chip" style={{ fontSize: 9, color: freshColor, fontWeight: 800 }}>végső {day.finalScore.toFixed(2)}</span>
        <span style={{ flex: 1 }} />
        <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>Napló →</span>
      </div>
    </div>
  )
}
